//! Shared native search DB state for grep/glob/fuzzyFind.
//!
//! This owns search-side shared state that should outlive individual native
//! calls: frecency tracking plus a per-root cache of `fff` file pickers.

use std::{
	collections::HashMap,
	path::Path,
	sync::{Arc, atomic::Ordering},
	time::Duration,
};

use fff::{FFFMode, FileItem, FilePicker, FrecencyTracker, SharedFrecency, SharedPicker};
use log::debug;
use napi::{Error, bindgen_prelude::Result};
use napi_derive::napi;
use parking_lot::Mutex;

use crate::task;

#[cfg(test)]
const MAX_ACTIVE_PICKERS: usize = 3;
#[cfg(not(test))]
const MAX_ACTIVE_PICKERS: usize = 32;

struct PickerCacheEntry {
	root:           String,
	shared_picker:  SharedPicker,
	last_used_tick: u64,
}

#[derive(Default)]
struct PickerCache {
	entries:         HashMap<String, PickerCacheEntry>,
	next_touch_tick: u64,
}

impl PickerCache {
	fn next_touch_tick(&mut self) -> u64 {
		let tick = self.next_touch_tick;
		self.next_touch_tick = self.next_touch_tick.saturating_add(1);
		tick
	}

	fn touch_exact(&mut self, root: &str) -> Option<SharedPicker> {
		let tick = self.next_touch_tick();
		let entry = self.entries.get_mut(root)?;
		entry.last_used_tick = tick;
		Some(Arc::clone(&entry.shared_picker))
	}

	fn touch_longest_ancestor(&mut self, root: &str) -> Option<(String, SharedPicker)> {
		let root_path = Path::new(root);
		let ancestor_root = self
			.entries
			.keys()
			.filter(|candidate| is_descendant_root(root_path, Path::new(candidate)))
			.max_by_key(|candidate| Path::new(candidate).components().count())?
			.clone();
		let tick = self.next_touch_tick();
		let entry = self.entries.get_mut(&ancestor_root)?;
		entry.last_used_tick = tick;
		Some((ancestor_root, Arc::clone(&entry.shared_picker)))
	}

	fn insert(&mut self, root: String, shared_picker: SharedPicker) -> Vec<PickerCacheEntry> {
		let tick = self.next_touch_tick();
		self.entries.insert(root.clone(), PickerCacheEntry {
			root: root.clone(),
			shared_picker,
			last_used_tick: tick,
		});

		let mut descendant_roots = self
			.entries
			.keys()
			.filter(|candidate| is_descendant_root(Path::new(candidate), Path::new(&root)))
			.cloned()
			.collect::<Vec<_>>();
		descendant_roots.sort();
		descendant_roots
			.into_iter()
			.filter_map(|candidate| self.entries.remove(&candidate))
			.collect()
	}

	fn evict_excess(&mut self) -> Vec<PickerCacheEntry> {
		let mut evicted = Vec::new();
		while self.entries.len() > MAX_ACTIVE_PICKERS {
			let Some(oldest_root) = self
				.entries
				.iter()
				.min_by(|(left_root, left), (right_root, right)| {
					left
						.last_used_tick
						.cmp(&right.last_used_tick)
						.then_with(|| left_root.cmp(right_root))
				})
				.map(|(root, _)| root.clone())
			else {
				break;
			};
			if let Some(entry) = self.entries.remove(&oldest_root) {
				evicted.push(entry);
			}
		}
		evicted
	}
}

struct SearchDbInner {
	path:            String,
	shared_frecency: SharedFrecency,
	pickers:         Mutex<PickerCache>,
	#[cfg(test)]
	cleanup_count:   std::sync::atomic::AtomicUsize,
}

impl Drop for SearchDbInner {
	fn drop(&mut self) {
		for entry in self.pickers.lock().entries.values() {
			SearchDb::shutdown_picker(&entry.shared_picker);
		}
	}
}

/// Long-lived native search state: frecency persistence and per-workspace file
/// picker caches.
#[derive(Clone)]
#[napi]
pub struct SearchDb {
	inner: Arc<SearchDbInner>,
}

#[napi]
impl SearchDb {
	/// Create search DB state rooted at `path` (trimmed). An empty path skips
	/// frecency storage.
	#[napi(constructor)]
	pub fn new(path: String) -> Self {
		let normalized = path.trim().to_string();
		let shared_frecency: SharedFrecency = Default::default();

		if !normalized.is_empty()
			&& let Ok(tracker) = FrecencyTracker::new(&normalized, false)
		{
			if let Ok(mut guard) = shared_frecency.write() {
				*guard = Some(tracker);
			}
			let _ = FrecencyTracker::spawn_gc(Arc::clone(&shared_frecency), normalized.clone(), false);
		}

		Self {
			inner: Arc::new(SearchDbInner {
				path: normalized,
				shared_frecency,
				pickers: Mutex::new(PickerCache::default()),
				#[cfg(test)]
				cleanup_count: std::sync::atomic::AtomicUsize::new(0),
			}),
		}
	}

	/// Root path string associated with this instance (same as passed to the
	/// constructor).
	#[napi(getter)]
	pub fn path(&self) -> String {
		self.inner.path.clone()
	}
}

impl SearchDb {
	fn picker_key(root: &Path) -> String {
		root
			.canonicalize()
			.unwrap_or_else(|_| root.to_path_buf())
			.to_string_lossy()
			.into_owned()
	}

	fn shutdown_picker(shared_picker: &SharedPicker) {
		let Ok(mut guard) = shared_picker.write() else {
			return;
		};
		let Some(picker) = guard.as_mut() else {
			return;
		};
		picker.cancel();
		picker.stop_background_monitor();
	}

	fn cleanup_picker_entries(&self, reason: &str, entries: Vec<PickerCacheEntry>) {
		for entry in entries {
			debug!("SearchDb {reason}: root={}", entry.root);
			Self::shutdown_picker(&entry.shared_picker);
			#[cfg(test)]
			self
				.inner
				.cleanup_count
				.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
		}
	}

	pub fn get_or_init_picker(&self, root: &Path) -> Result<SharedPicker> {
		let key = Self::picker_key(root);
		let mut pickers = self.inner.pickers.lock();
		if let Some(shared_picker) = pickers.touch_exact(&key) {
			debug!("SearchDb reusing exact picker: root={key}");
			return Ok(shared_picker);
		}
		if let Some((ancestor_root, shared_picker)) = pickers.touch_longest_ancestor(&key) {
			debug!("SearchDb reusing ancestor picker: root={key} ancestor={ancestor_root}");
			return Ok(shared_picker);
		}

		let shared_picker: SharedPicker = Default::default();
		FilePicker::new_with_shared_state(
			key.clone(),
			false,
			FFFMode::Ai,
			Arc::clone(&shared_picker),
			Arc::clone(&self.inner.shared_frecency),
		)
		.map_err(|err| Error::from_reason(format!("Failed to init file picker: {err}")))?;
		debug!("SearchDb created picker: root={key}");

		let replaced_descendants = pickers.insert(key.clone(), Arc::clone(&shared_picker));
		if !replaced_descendants.is_empty() {
			debug!(
				"SearchDb replacing descendant pickers: root={} count={}",
				key,
				replaced_descendants.len()
			);
		}
		let evicted_entries = pickers.evict_excess();
		drop(pickers);

		self.cleanup_picker_entries("replaced descendant picker", replaced_descendants);
		self.cleanup_picker_entries("evicted picker", evicted_entries);
		Ok(shared_picker)
	}

	pub fn update_frecency_scores(&self, item: &mut FileItem) {
		let Ok(guard) = self.inner.shared_frecency.read() else {
			return;
		};
		let Some(tracker) = guard.as_ref() else {
			return;
		};
		let _ = item.update_frecency_scores(tracker, FFFMode::Ai);
	}
}

fn is_descendant_root(candidate: &Path, ancestor: &Path) -> bool {
	candidate != ancestor && candidate.starts_with(ancestor)
}

pub fn wait_for_picker_scan(shared_picker: &SharedPicker, ct: &task::CancelToken) -> Result<()> {
	let signal = {
		let guard = shared_picker
			.read()
			.map_err(|_| Error::from_reason("shared picker lock poisoned"))?;
		let Some(picker) = guard.as_ref() else {
			return Ok(());
		};
		picker.scan_signal()
	};

	while signal.load(Ordering::Acquire) {
		ct.heartbeat()?;
		std::thread::sleep(Duration::from_millis(10));
	}

	ct.heartbeat()?;
	Ok(())
}

#[cfg(test)]
mod tests {
	use std::{
		fs,
		path::{Path, PathBuf},
		sync::Arc,
		time::{SystemTime, UNIX_EPOCH},
	};

	use super::*;

	struct TempDir {
		path: PathBuf,
	}

	impl TempDir {
		fn new(prefix: &str) -> Self {
			let unique = SystemTime::now()
				.duration_since(UNIX_EPOCH)
				.expect("system clock before unix epoch")
				.as_nanos();
			let path = std::env::temp_dir()
				.join(format!("pi-natives-searchdb-{prefix}-{}-{unique}", std::process::id()));
			fs::create_dir_all(&path).expect("failed to create temp dir");
			Self { path }
		}

		fn path(&self) -> &Path {
			&self.path
		}
	}

	impl Drop for TempDir {
		fn drop(&mut self) {
			let _ = fs::remove_dir_all(&self.path);
		}
	}

	fn create_file(path: &Path) {
		if let Some(parent) = path.parent() {
			fs::create_dir_all(parent).expect("failed to create parent dir");
		}
		fs::write(path, "test").expect("failed to write test file");
	}

	fn wait_for_scan(shared_picker: &SharedPicker) {
		wait_for_picker_scan(shared_picker, &task::CancelToken::default())
			.expect("picker scan should complete");
	}

	fn cache_roots(db: &SearchDb) -> Vec<String> {
		let mut roots = db
			.inner
			.pickers
			.lock()
			.entries
			.keys()
			.cloned()
			.collect::<Vec<_>>();
		roots.sort();
		roots
	}

	fn cleanup_count(db: &SearchDb) -> usize {
		db.inner
			.cleanup_count
			.load(std::sync::atomic::Ordering::SeqCst)
	}

	#[test]
	fn reuses_exact_root_picker() {
		let temp_dir = TempDir::new("exact-root");
		let root = temp_dir.path().join("workspace");
		create_file(&root.join("a.txt"));
		let db = SearchDb::new(String::new());

		let first = db
			.get_or_init_picker(&root)
			.expect("first picker should initialize");
		let second = db
			.get_or_init_picker(&root)
			.expect("second picker should reuse");

		assert!(Arc::ptr_eq(&first, &second));
		assert_eq!(cache_roots(&db), vec![SearchDb::picker_key(&root)]);
	}

	#[test]
	fn reuses_canonicalized_equivalent_root() {
		let temp_dir = TempDir::new("canonical-root");
		let root = temp_dir.path().join("workspace");
		create_file(&root.join("nested/file.txt"));
		let db = SearchDb::new(String::new());

		let first = db
			.get_or_init_picker(&root)
			.expect("canonical picker should initialize");
		let equivalent = db
			.get_or_init_picker(&root.join("nested/.."))
			.expect("equivalent root should reuse picker");

		assert!(Arc::ptr_eq(&first, &equivalent));
		assert_eq!(cache_roots(&db), vec![SearchDb::picker_key(&root)]);
	}

	#[test]
	fn reuses_ancestor_picker_for_descendant_root() {
		let temp_dir = TempDir::new("ancestor-reuse");
		let root = temp_dir.path().join("workspace");
		create_file(&root.join("data/file.txt"));
		let db = SearchDb::new(String::new());

		let ancestor = db
			.get_or_init_picker(&root)
			.expect("ancestor picker should initialize");
		let descendant = db
			.get_or_init_picker(&root.join("data"))
			.expect("descendant root should reuse ancestor picker");

		assert!(Arc::ptr_eq(&ancestor, &descendant));
		assert_eq!(cache_roots(&db), vec![SearchDb::picker_key(&root)]);
	}

	#[test]
	fn broader_ancestor_replaces_descendant_picker() {
		let temp_dir = TempDir::new("replace-descendant");
		let root = temp_dir.path().join("workspace");
		create_file(&root.join("data/file.txt"));
		let db = SearchDb::new(String::new());

		let descendant = db
			.get_or_init_picker(&root.join("data"))
			.expect("descendant picker should initialize");
		wait_for_scan(&descendant);

		let ancestor = db
			.get_or_init_picker(&root)
			.expect("ancestor picker should replace descendant");
		wait_for_scan(&ancestor);

		assert!(!Arc::ptr_eq(&ancestor, &descendant));
		assert_eq!(cache_roots(&db), vec![SearchDb::picker_key(&root)]);
		assert_eq!(cleanup_count(&db), 1);
	}

	#[test]
	fn keeps_independent_roots_distinct() {
		let temp_dir = TempDir::new("independent-roots");
		let left = temp_dir.path().join("left");
		let right = temp_dir.path().join("right");
		create_file(&left.join("a.txt"));
		create_file(&right.join("b.txt"));
		let db = SearchDb::new(String::new());

		let left_picker = db
			.get_or_init_picker(&left)
			.expect("left picker should initialize");
		let right_picker = db
			.get_or_init_picker(&right)
			.expect("right picker should initialize");

		assert!(!Arc::ptr_eq(&left_picker, &right_picker));
		assert_eq!(cache_roots(&db), vec![SearchDb::picker_key(&left), SearchDb::picker_key(&right)]);
	}

	#[test]
	fn evicts_least_recently_used_picker_when_cap_is_exceeded() {
		let temp_dir = TempDir::new("evict-lru");
		let roots = (0..=MAX_ACTIVE_PICKERS)
			.map(|index| {
				let root = temp_dir.path().join(format!("root-{index}"));
				create_file(&root.join("file.txt"));
				root
			})
			.collect::<Vec<_>>();
		let db = SearchDb::new(String::new());

		for root in roots.iter().take(MAX_ACTIVE_PICKERS) {
			db.get_or_init_picker(root)
				.expect("picker should initialize before eviction");
		}
		db.get_or_init_picker(&roots[0])
			.expect("touching the first picker should update LRU state");
		db.get_or_init_picker(&roots[MAX_ACTIVE_PICKERS])
			.expect("creating one more picker should evict the oldest untouched root");

		assert_eq!(cleanup_count(&db), 1);
		assert_eq!(cache_roots(&db).len(), MAX_ACTIVE_PICKERS);
		assert!(cache_roots(&db).contains(&SearchDb::picker_key(&roots[0])));
		assert!(cache_roots(&db).contains(&SearchDb::picker_key(&roots[MAX_ACTIVE_PICKERS])));
		assert!(!cache_roots(&db).contains(&SearchDb::picker_key(&roots[1])));
	}
}

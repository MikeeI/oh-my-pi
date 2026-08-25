Read files, directories, archives, SQLite, images, documents, internal resources, and web URLs via `path`.

<instruction>
- Bounded known targets → one `read` call; join complete `path[:selector]` targets with `;`.
- Known range ≤{{DEFAULT_MAX_LINES}} lines → request the complete range once.
- Larger known range set → repeat its path with ≤{{DEFAULT_MAX_LINES}}-line selectors.
- Unknown extent → discover once, then batch every known missing range in the next call.
- A failed or truncated target means retrieval is incomplete.
- Example: `src/main.ts:1-200;src/config.ts:40-120;large.md:1-3000;large.md:3001-3418`.
- NEVER split a bounded pre-planned batch across turns; retry only failed or truncated targets.
- SHOULD use `read` (not browser) for web content; browser only when `read` can't deliver.
</instruction>

## Selectors — append `:<sel>` to `path` (e.g. `src/foo.ts:50-200`, `src/foo.ts:raw`, `db.sqlite:users:42`)
- `:50` / `:50-` — from line 50 | `:50-200` — inclusive | `:50+150` — 150 lines from 50 | `:5-16,960-973` — multiple ranges
- `:raw` returns a handler-specific raw representation.
- `:raw` suppresses Read anchors and prefixes where supported, but does not guarantee byte-exact data or bypass source-specific converters.
- `:2-4:raw` / `:raw:2-4` — range + raw representation.
- `:conflicts` — one line per unresolved git merge conflict block
- `:img` — rasterize a local `.svg`/`.svgz` as a PNG image; use when visual layout matters

## Source kinds
- Parseable code, no selector → structural summary (declarations only, body elided). Footer names recovery selector — re-issue ONLY those ranges.
- {{#if IS_HL_MODE}}File + selector → `[foo.ts#1A2B]` snapshot header + numbered lines. Copy `[FILENAME#TAG]` for anchored edits; NEVER fabricate the tag.{{/if}}
- Directory → depth-limited dirent listing.
- SQLite (`.sqlite`, `.sqlite3`, `.db`, `.db3`): `file.db` (tables), `file.db:table` (schema+rows), `file.db:table:key` (by PK), `?limit=`/`?where=`/`?q=SELECT`.
- Archives (`.zip` family incl. `.jar`/`.apk`/`.whl`, `.tar` incl. `.tar.{gz,bz2,xz,zst}`, `.rar`, `.7z`, `.iso`, `.cab`, `.deb`/`.rpm`/`.cpio`/`.ar`/`.a`, `.lzh`/`.arj`, `.asar`; single-stream `.gz`/`.bz2`/`.xz`/`.zst`): `archive.ext:path/inside/archive` reads a selected member.
- Archive `:raw` returns decoded member text, not archive bytes.
- Documents → extracted text; source-specific converters such as PDF/Markit may still run under `:raw`.
- Notebooks → editable cells by default; `:raw` returns storage JSON.
- {{#if INSPECT_IMAGE_ENABLED}}Images → metadata; call `inspect_image`.{{else}}Images → decoded inline content.{{/if}} `:raw` does not return original image bytes.
- URLs → reader-mode clean text/markdown; `:raw` returns the response body without JSON, feed, or HTML text shaping; binary handling still applies.
- Internal URIs — all schemes take selectors. `artifact://<id>` recovers spilled output; page with `:N-M`/`:raw:N-M`.
- `ssh://host/<path>` reads remote file/dir (UTF-8, ≤1 MiB); bare `ssh://` lists hosts; writable with `write` and searchable with `grep`.
  Literal `:`, `?`, `#` → percent-encode (`%3A`/`%3F`/`%23`). Requires a verified POSIX shell on the remote host. For Windows or other unsupported hosts, use `bash` with a remote SSH command or mount with `sshfs`.

<critical>
Summary footer names elided ranges? Re-issue ONLY those ranges. NEVER guess `..`/`…` content.
</critical>

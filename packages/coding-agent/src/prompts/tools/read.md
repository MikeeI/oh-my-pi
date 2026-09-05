Read files, directories, archives, SQLite, images, documents, internal resources, and web URLs via `path`.

<instruction>
- MUST collect every bounded target required for the current step before calling `read`.
- MUST combine known disjoint ranges for one source in one comma-separated selector.
- MUST assign each resulting target to exactly one `read` call in the current scheduling wave.
- MUST issue one separate `read` call per target; NEVER join targets in one `path`.
- MUST emit all independent `read` calls together in the same assistant turn.
- MUST read sequentially only when one result determines the next target or selector.
- Keep each complete `path[:selector]` target otherwise unchanged.
- MUST retry a failed target without repeating successful sibling calls.
- MUST follow the exact recovery reference after truncation.
- Otherwise, MUST re-read only content changed since its last complete read.
- Preserve MCP resource URIs exactly; NEVER split or percent-encode server-provided semicolons.
- SQLite semicolons in SQL, table names, or row keys remain target data.
- Literal semicolons inside authored non-MCP internal URIs MUST use `%3B`.
- WRONG: `{"path":"package.json:1-80;src/main.ts:120-180;skill://skill-momp:1-33"}`.
- RIGHT: issue these sibling calls together in the same assistant turn:
  - `{"path":"package.json:1-80"}`
  - `{"path":"src/main.ts:120-180,420-455"}`
  - `{"path":"skill://skill-momp:1-33"}`
- SHOULD use `read` (not browser) for web content; browser only when `read` can't deliver.
</instruction>

## Selectors — append `:<sel>` to `path` (e.g. `src/foo.ts:50-200`, `src/foo.ts:raw`, `db.sqlite:users:42`)

- `:50` / `:50-` — from line 50 | `:50-200` — inclusive | `:50+150` — 150 lines from 50 | `:-60` — last 60 lines | `:5-16,960-973` — multiple ranges
- `:raw` returns a handler-specific raw representation.
- `:raw` suppresses Read anchors and prefixes where supported.
- It does not guarantee byte-exact data or bypass source-specific converters.
- `:2-4:raw` / `:raw:2-4` — range + raw representation.
- `:conflicts` — one line per unresolved git merge conflict block
- `:img` — rasterize a local `.svg`/`.svgz` as a PNG image; use when visual layout matters
- `?q=<question>` — image only (also `.svg:img?q=`, `attachment://N?q=`, `local://…?q=`): vision-model answer as text instead of pixels
- Videos (`.mp4`, `.mov`, `.mkv`, `.webm`, `.m4v`, `.avi`, `.wmv`) need system `ffmpeg`/`ffprobe`: bare read returns a preview grid plus metadata (resolution, codecs, duration, fps); `:412` extracts frame 412, `:1h5m42s`/`:90s`/`:01:23` seeks to a timestamp

## Source kinds

- Parseable code, no selector → structural summary (declarations only, body elided). Footer names recovery selector — re-issue ONLY those ranges.
- {{#if IS_HL_MODE}}File + selector → `[foo.ts#1A2B]` snapshot header + numbered lines. Copy `[FILENAME#TAG]` for anchored edits; NEVER fabricate the tag.{{/if}}
- Directory → depth-limited dirent listing.
- SQLite (`.sqlite`, `.sqlite3`, `.db`, `.db3`): `file.db` (tables), `file.db:table` (schema+rows), `file.db:table:key` (by PK), `?limit=`/`?where=`/`?q=SELECT`.
- Archives (`.zip` family incl. `.jar`/`.apk`/`.whl`, `.tar` incl. `.tar.{gz,bz2,xz,zst}`, `.rar`, `.7z`, `.iso`, `.cab`, `.deb`/`.rpm`/`.cpio`/`.ar`/`.a`, `.lzh`/`.arj`, `.asar`; single-stream `.gz`/`.bz2`/`.xz`/`.zst`): `archive.ext:path/inside/archive` reads a selected member.
- Archive `:raw` returns decoded member text, not archive bytes.
- Documents → extracted text; source-specific converters such as PDF/Markit may still run under `:raw`.
- Notebooks → editable cells by default; `:raw` returns storage JSON.
- Images → decoded inline; `img.png?q=<question>` asks a vision model and returns text.
- Image `:raw` does not return original image bytes.
- Videos → preview grid plus metadata.
- SVGs read as text unless `:img` is specified.
- URLs → reader-mode clean text/markdown.
- URL `:raw` returns the response body without JSON, feed, or HTML text shaping after binary handling.
- Bare `host:port` needs a trailing slash.
- Internal URIs — all schemes take selectors. `artifact://<id>` recovers spilled output; page with `:N-M`/`:raw:N-M`.
- `ssh://host/<path>` reads remote file/dir (UTF-8, ≤1 MiB); bare `ssh://` lists hosts; writable with `write` and searchable with `grep`.
  Literal `:`, `?`, `#` → percent-encode (`%3A`/`%3F`/`%23`). Requires a verified POSIX shell on the remote host. For Windows or other unsupported hosts, use `bash` with a remote SSH command or mount with `sshfs`.

<critical>
Recovery footer names ranges? Re-read ONLY those ranges.
Recovery footer names an artifact? Read that exact artifact reference.
NEVER repeat delivered ranges or reconstruct elided `..`/`…` content heuristically.
</critical>

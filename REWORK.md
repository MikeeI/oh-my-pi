# Hashline session cutover rework

## Context pointers
- Session transcript: `/root/.omp/agent/sessions/-projects-project-oh-my-pi-fork/2026-04-21T23-39-17-524Z_019db269-9694-7000-a94d-1a8539126652`
- Approved plan artifact: `local://HASHLINE_SESSION_CUTOVER_PLAN.md`
- Tool-readable original plan: use `read(path="local://HASHLINE_SESSION_CUTOVER_PLAN.md")`

## Goal and concept
The approved design replaces the old stateless `LINE#ID` protocol with a session-scoped protocol while keeping the public mode name `hashline`.

Old model:
- `read` emitted `LINE#ID:content`
- `edit` addressed lines directly with `N#ID`
- every successful edit risked staling the next anchor set
- repeated same-file edits were inefficient because the caller often had to re-read

New model:
- `read` establishes or resumes a file session
- the file session has:
  - `session`
  - `revision`
  - stable per-line handles within that session
- visible line form becomes `LINE@HANDLE:content`
- `edit` requires top-level `session` + `revision`
- `edit.loc` uses only stable handles, never `LINE#ID`
- external file mutation hard-invalidates the session
- successful edits increment `revision` and return fresh `updatedAnchors`

Core design intent:
- split addressing from staleness
- handle = address
- session/revision = freshness
- no fuzzy relocation
- no mixed mode
- deterministic handle inheritance on replace/insert/delete

## What I changed
### 1. Session primitives
Files:
- `packages/coding-agent/src/edit/line-hash.ts`
- `packages/coding-agent/src/edit/hashline-session.ts`

What changed:
- kept `computeLineHash()` only for preview/diff metadata
- added handle formatting helpers for `LINE@HANDLE:content`
- added stripping helpers for copied `LINE@HANDLE:` prefixes
- added in-memory session store keyed by session owner + absolute path
- session state now tracks:
  - `session`
  - `revision`
  - `absolutePath`
  - content signature
  - live `handles[]`
  - `handleToLine`
  - next handle ordinal
- added deterministic handle allocation and session update helpers

### 2. Hashline runtime rewrite
File:
- `packages/coding-agent/src/edit/modes/hashline.ts`

What changed:
- request schema is now:
  - top-level `session`
  - top-level `revision`
  - `edits[]`
- loc strings now expect handles like `L000A`, not `N#ID`
- parser changed from `parseTag()` semantics to `parseHandle()` semantics
- edit execution now validates session + revision via content signature before mutation
- handle resolution happens through session state, not hash recomputation
- edit application now updates both file lines and handle arrays
- deterministic inheritance implemented in code:
  - `replace_line`: surviving replacement lines inherit old handle positionally, extras get new handles
  - `replace_range`: same positional inheritance rule
  - `append/prepend`: inserted lines get new handles
  - deleted handles disappear
- successful edit updates session revision and returns new session metadata in result details
- result text now includes `Session S.... revision N`

### 3. Read lifecycle integration
File:
- `packages/coding-agent/src/tools/read.ts`

What changed:
- hashline file reads now create/resume a session through `ensureHashlineSession(...)`
- read output is prefixed with a session header line:
  - `Session S.... revision N`
- read output lines now use stored handles instead of recomputed hashes
- in-memory read paths and file-backed read paths both attach `details.hashline`
- formatting helpers were changed to use handle arrays rather than recomputing hashes

Important detail:
- for truncated/sliced output, the visible handles still come from the full-file session state, so follow-up edits stay aligned with the real file session

### 4. Edit plumbing and preview wiring
Files:
- `packages/coding-agent/src/edit/index.ts`
- `packages/coding-agent/src/edit/renderer.ts`
- `packages/coding-agent/src/modes/components/tool-execution.ts`

What changed:
- `edit/index.ts` now forwards top-level `session` + `revision` into `executeHashlineSingle(...)`
- renderer detail types now allow `hashline: { session, revision }`
- multi-file aggregation preserves that metadata
- tool execution preview for hashline mode now passes `session` + `revision` into `computeHashlineDiff(...)`

### 5. Grep / file mentions / write surface updates
Files:
- `packages/coding-agent/src/tools/grep.ts`
- `packages/coding-agent/src/utils/file-mentions.ts`
- `packages/coding-agent/src/session/agent-session.ts`
- `packages/coding-agent/src/tools/write.ts`

What changed:
- grep in hashline mode now renders `LINE@HANDLE:` instead of `LINE#ID:`
- file mentions now use session-backed handles when hashline mode is active
- `agent-session.ts` now passes session context into file mention generation
- write-strip logic/comments now target `LINE@HANDLE:` prefixes rather than `LINE#ID:`

### 6. Prompt / wording updates
Files:
- `packages/coding-agent/src/prompts/tools/hashline.md`
- `packages/coding-agent/src/prompts/tools/read.md`
- `packages/coding-agent/src/prompts/tools/grep.md`
- `packages/coding-agent/src/config/settings-schema.ts`

What changed:
- prompt docs now teach session header + handle workflow
- examples now use `session`, `revision`, and `L....` handles
- `read.md` explains reuse of session/revision and hard invalidation
- `grep.md` explains handle family without claiming grep itself is enough for edit freshness
- settings wording now describes session-scoped handle output

### 7. Tests rewritten to new contract
Files:
- `packages/coding-agent/test/core/hashline.test.ts`
- `packages/coding-agent/test/edit-diff.test.ts`
- `packages/coding-agent/test/tools.test.ts`

What changed:
- core hashline tests now assert:
  - read emits session header and handles
  - same-file follow-up edits reuse session without reread
  - external writes invalidate the session
  - append returns fresh handles
- edit diff tests now create a hashline session before calling `computeHashlineDiff(...)`
- tools tests were updated for hashline delete/move call shape where needed

### 8. Unrelated root-cause fix discovered during verification
File:
- `packages/coding-agent/src/tools/bash.ts`

Why this got touched:
- targeted verification surfaced an unrelated failing test in bash auto-background behavior
- user explicitly said not to weaken the test, but to fix the cause

What changed:
- added a trivial-command inline heuristic for auto-background mode
- short simple commands like `echo short` now stay inline despite auto-background being enabled
- longer compound shell commands still background as expected
- targeted tools tests pass again after this fix

## What I verified
Observed directly in this session:
- `bun test packages/coding-agent/test/core/hashline.test.ts packages/coding-agent/test/edit-diff.test.ts packages/coding-agent/test/tools.test.ts`
  - result: pass
  - 107 pass, 1 skip, 0 fail
- changed-file LSP diagnostics were clean for:
  - `src/edit/modes/hashline.ts`
  - `src/edit/modes/patch.ts`
  - `src/tools/read.ts`
  - `src/tools/grep.ts`
  - `src/tools/bash.ts`
  - `src/modes/components/tool-execution.ts`
  - `src/utils/file-mentions.ts`
  - `src/session/agent-session.ts`

## Current blocker / current problem
The work is not cleanly finished yet.

### 1. `bun check:ts` is currently blocked by an unrelated repo formatting failure
Observed output:
- `packages/natives/scripts/build-native.ts` fails Biome formatting check
- this file is outside the hashline cutover changes I made
- because root `check:ts` runs repo-wide `biome check .`, the unrelated file blocks full green verification

Meaning:
- current status is not “hashline code broken”
- current status is “repo-wide TypeScript check still red because of an unrelated formatting issue in another package”

### 2. The cutover is still incomplete conceptually
I changed a lot of runtime surfaces, but not every planned surface was fully audited.

Most important remaining gaps to inspect before calling the cutover complete:
- `packages/coding-agent/src/config/prompt-templates.ts`
  - old `href` / `hline` helper semantics were part of the original plan
  - I rewrote prompt markdowns, but I did not complete a full prompt-helper cleanup here
- compact hashline diff preview path in `src/edit/modes/hashline.ts`
  - preview formatting still deserves a manual audit to ensure no old-style address semantics leak into model-visible output
- any remaining model-visible surfaces beyond read/grep/file-mentions/write comments should be grepped again after final formatting

### 3. Some edits were interrupted multiple times
Several tool edits were aborted mid-flight and then repaired incrementally.
The file state is now coherent enough for targeted tests, but a final agent should still re-read the changed files instead of assuming the structure is elegant everywhere.

## Current modified files
Observed via `git status --short`:
- `packages/coding-agent/src/config/settings-schema.ts`
- `packages/coding-agent/src/edit/index.ts`
- `packages/coding-agent/src/edit/line-hash.ts`
- `packages/coding-agent/src/edit/modes/hashline.ts`
- `packages/coding-agent/src/edit/modes/patch.ts`
- `packages/coding-agent/src/edit/renderer.ts`
- `packages/coding-agent/src/modes/components/tool-execution.ts`
- `packages/coding-agent/src/prompts/tools/grep.md`
- `packages/coding-agent/src/prompts/tools/hashline.md`
- `packages/coding-agent/src/prompts/tools/read.md`
- `packages/coding-agent/src/session/agent-session.ts`
- `packages/coding-agent/src/tools/bash.ts`
- `packages/coding-agent/src/tools/grep.ts`
- `packages/coding-agent/src/tools/read.ts`
- `packages/coding-agent/src/tools/write.ts`
- `packages/coding-agent/src/utils/file-mentions.ts`
- `packages/coding-agent/test/core/hashline.test.ts`
- `packages/coding-agent/test/edit-diff.test.ts`
- `packages/coding-agent/test/tools.test.ts`
- new file: `packages/coding-agent/src/edit/hashline-session.ts`

## Recommended next actions for the new agent
1. Re-read these files before touching anything:
   - `packages/coding-agent/src/edit/modes/hashline.ts`
   - `packages/coding-agent/src/tools/read.ts`
   - `packages/coding-agent/src/tools/grep.ts`
   - `packages/coding-agent/src/modes/components/tool-execution.ts`
   - `packages/coding-agent/src/config/prompt-templates.ts`
   - `packages/coding-agent/src/tools/bash.ts`
2. Decide whether to fix the unrelated repo-wide Biome failure in `packages/natives/scripts/build-native.ts` or explicitly defer it as unrelated.
3. Re-grep for any remaining model-visible old semantics:
   - `LINE#ID`
   - `formatHashLines`
   - old prompt helper usage
4. Audit compact diff preview output for mixed-family leakage.
5. Run again:
   - `bun test packages/coding-agent/test/core/hashline.test.ts packages/coding-agent/test/edit-diff.test.ts packages/coding-agent/test/tools.test.ts`
   - `bun check:ts`

## Practical summary
Conceptually, the system is halfway-to-mostly-there:
- session store exists
- read/edit protocol shape changed
- repeated same-file edits work in tests
- invalidation works in tests
- visible handle family changed on key surfaces
- prompts changed

What stops me from calling it done:
- full repo `bun check:ts` is still red because of an unrelated formatting error in another package
- prompt helper cleanup / final surface audit is not finished
- the implementation needs one more deliberate cleanup pass, not just another blind patch wave

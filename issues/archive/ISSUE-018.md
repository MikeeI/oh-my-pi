# ISSUE-018 — Read guidance: known targets consume repeated model turns

State: Archived
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/10465
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-09-01
Updated: 2026-09-01
Source: `upstream/main@78ca29f7b74bfbe63271d0443fe6106004ffffe6`

## Root-Cause

Root-Cause [S]: Read advertises only `SHOULD parallelize independent reads` and a scalar `path` with inline selectors.
The runtime already recovers semicolon-delimited filesystem targets, but model-facing metadata does not expose that grammar.
Models can therefore request already-known files or ranges through separate tool calls and model continuations.

## Reach-and-Impact

Reach [S]: Every coding-agent session exposing the built-in Read tool receives the generic parallel-read instruction.
Impact [S]: Separate Read turns add tool-call and tool-result messages plus another model request for each continuation.
Prompt caching can discount a matching prefix but does not combine requests or eliminate processing of new input.
Observed [O]: A controlled ten-target comparison measured repeated requests, tokens, and wall time.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/38fe5c4628a12a6b556a602b4c0592218560f75e/packages/coding-agent/src/prompts/tools/read.md#L1-L7` only requests parallel independent reads.
- [S] `https://github.com/can1357/oh-my-pi/blob/38fe5c4628a12a6b556a602b4c0592218560f75e/packages/coding-agent/src/tools/read.ts#L530-L540` describes one scalar path and inline selectors.
- [S] `https://github.com/can1357/oh-my-pi/blob/38fe5c4628a12a6b556a602b4c0592218560f75e/packages/coding-agent/src/tools/path-utils.ts#L907-L978` defines semicolon as the documented list delimiter.
- [S] `https://developers.openai.com/api/docs/guides/prompt-caching` states that cache hits reuse a prefix while new input still requires processing.
- [O] Two baseline and two candidate runs each returned all ten target payloads.
- [O] The focused Read suite passes 202 tests with 700 assertions.

## Prior-Art

Coverage: Upstream issues, pull requests, source history, contribution policy, and the current PR template were checked on 2026-09-01.
Gaps: Discord discussion remains unchecked.

- `https://github.com/can1357/oh-my-pi/pull/7657` fixes semicolon-delimited internal-URL parsing.
- PR #7657 does not advertise single-call batching or prevent one-known-target-per-turn behavior.
- `https://github.com/can1357/oh-my-pi/pull/7000` proposes a broader `path: string[]` API and multi-surface batch implementation.
- PR #7000 has had no recorded update since 2026-07-30 and does not block this smaller scalar-contract correction.

Contribution fit: Focused pull request retaining the scalar `path` API and existing delimiter recovery.
The user selected Pull-Request-Implementation and New-pull-request on 2026-09-01.

## Performance-Evidence

Workload: Ten already-known one-line files requested through `openai-codex/gpt-5.6-sol` at low thinking.
Evaluator: Identical prompt, files, Read-only toolset, disabled skills, rules, extensions, LSP, and title generation.
Sample: Two baseline runs at `upstream/main@38fe5c4628a12a6b556a602b4c0592218560f75e` and two candidate runs.
Baseline [O]: Both runs used 11 provider requests and 10 Read turns.
Candidate [O]: Both runs used two provider requests and one semicolon-delimited Read turn.
Tokens [O]: Mean conversation tokens fell from 57,430 to 10,656.
Latency [O]: Mean wall time fell from 25.95 seconds to 8.98 seconds.
Guard [O]: Every run returned all ten distinct target payloads.
Boundary: The result does not claim universal performance across providers and workloads.

## Proposed-Change

Replace generic parallel-read guidance with four explicit scheduling rules.
Collect bounded current-step targets before Read and require one semicolon-joined call for known non-HTTP(S) targets.
Keep independent HTTP(S) URLs as separate calls because raw semicolons are valid URL data.
Expose the same grammar in the scalar `path` schema.
Support mixed internal-URI and filesystem batches while preserving `%3B` as a literal internal-URI semicolon.
Execute independent targets with a concurrency limit of eight while preserving result order.

## Scope-and-Constraints

- Preserve `path: string`, scalar reads, selectors, source handlers, result order, and existing per-target limits.
- Preserve separate HTTP(S) calls and literal URL semicolons.
- Exclude native path arrays, batch UI redesign, token totals, Raw semantics, and unrelated prompts.
- Exclude `AGENTS.md`, tracking files, MOMP identity, and release metadata from the contribution diff.

## Verification

- Render the Read description and JSON schema and verify the four scheduling decisions and delimiter grammar.
- Read mixed internal-URI and filesystem targets in both orders.
- Preserve `%3B` inside an internal URI and reject HTTP(S) inside a recognized multi-target call.
- Launch the coding agent from the clean branch and retrieve ten selected ranges through exactly one Read call.
- Run focused Read tests, coding-agent checks, workspace checks, and `git diff --check`.

## Publication-Blockers

None.

## Pull-Request-Implementation

Branch: `fix/read-single-call-batching`
Base: `upstream/main@78ca29f7b74bfbe63271d0443fe6106004ffffe6`
Scope: Expose and enforce scalar single-call batching for known non-HTTP(S) Read targets.
Commit: `d07a83c7f7`
Push: `MikeeI/fix/read-single-call-batching`
Checks:
- `bun test test/internal-urls/mcp-protocol.test.ts test/read-tool-group.test.ts test/skill-protocol-customdirs.test.ts test/tools/conflict-integration.test.ts test/tools/fetch-url-selectors.test.ts test/tools/glob-validate-paths.test.ts test/tools/grep-path-lists.test.ts test/tools/read-guidance.test.ts test/tools/sqlite.test.ts` → 202 passed, 0 failed.
- Controlled ten-target source scenario → two baseline and two candidate runs returned all ten payloads.
- Strict session-journal aggregation → provider requests 11 to 2 and mean conversation tokens 57,430 to 10,656.
- `git diff --check` → passed.
- `bun run check` → blocked by a current-upstream `VirtualTerminal` type error outside the changed files.
- Final OMP Nix run `33513744031` passed.
- Final CI run `33513744006` passed.

## Next-Action

Summary: —
Action: None.
Done-When: None.

## Publication-Draft

Title: `fix(read): batch known targets into one call`
Target: Update PR `https://github.com/can1357/oh-my-pi/pull/10465`.

Body:

```markdown
## What

- Teach Read to collect already-known, bounded non-HTTP(S) targets before calling the tool.
- Require those targets in one semicolon-delimited scalar `path`, and expose that grammar in the JSON schema.
- Keep HTTP(S) URLs as separate calls because raw semicolons are valid URL data.
- Support mixed internal URI and filesystem batches while preserving `%3B` as literal internal-URI data.
- Preserve exact advertised MCP resource URIs byte-for-byte before interpreting semicolons as delimiters.
- Execute independent batch targets with bounded concurrency while preserving result order.
- Preserve existing SQLite, archive, conflict, literal-path, selector, URL, and rendering behavior.

This has given me substantial speed and cache savings.

## Why

The current tool prompt only says to parallelize independent reads.
Its scalar `path` schema does not advertise the existing batch grammar.
Providers that emit one tool call per response therefore require another model continuation for every known target.
Prompt caching can discount a stable prefix, but it does not combine requests or remove new tool-result input.

This change uses the existing semicolon-delimited scalar runtime instead of adding a second path-array API.
The runtime executes independent entries with a concurrency limit of eight and preserves input order in the result.
Literal and structured targets retain precedence where a semicolon is valid source data.

I checked the relevant issues, comments, pull requests, and discussions.
This pull request is not a duplicate.

## Testing

- `bun test test/internal-urls/mcp-protocol.test.ts test/skill-protocol-customdirs.test.ts test/tools/conflict-integration.test.ts test/tools/glob-validate-paths.test.ts test/tools/grep-path-lists.test.ts test/tools/read-guidance.test.ts test/tools/sqlite.test.ts test/read-tool-group.test.ts` passed 184 tests with 0 failures.
- Two controlled baseline runs and two candidate runs each returned all ten distinct target payloads.
- `git diff --check` passed.
- [OMP Nix](https://github.com/can1357/oh-my-pi/actions/runs/33507290968) passed.
- [Lint, type checking, and web build](https://github.com/can1357/oh-my-pi/actions/runs/33507290957) passed.
- Runtime, singleton, UI/TUI, CLI, installation, and native integration jobs passed.
- The two remaining failed CI buckets match [current upstream failures](https://github.com/can1357/oh-my-pi/actions/runs/33504655040).

Local `bun check` on the contribution branch reaches the existing `VirtualTerminal` export error outside this change.
The current PR merge-ref type-check job passes.

### Measured impact

I compared `upstream/main@38fe5c4628a12a6b556a602b4c0592218560f75e` with the candidate.
Both variants used the same controlled scenario.

- Model: `openai-codex/gpt-5.6-sol`.
- Thinking level: `low`.
- Enabled tools: Read only.
- Input: the same ten already-known files, each bounded to line 1.
- Runs: two independent runs per variant.
- Guardrail: every run returned all ten distinct file payloads.

| Variant | Run | Provider requests | Read turns | Conversation tokens | Wall time |
| --- | ---: | ---: | ---: | ---: | ---: |
| Upstream | 1 | 11 | 10 | 57,480 | 25.21 s |
| Upstream | 2 | 11 | 10 | 57,380 | 26.69 s |
| Candidate | 1 | 2 | 1 | 10,656 | 9.21 s |
| Candidate | 2 | 2 | 1 | 10,656 | 8.74 s |

Average observed change:

- Provider requests: 11 to 2 (`-81.8%`).
- Conversation tokens: 57,430 to 10,656 (`-81.4%`).
- Wall time: 25.95 seconds to 8.98 seconds (`-65.4%`).
- Uncached input tokens: 15,266.5 to 5,567 (`-63.5%`).
- Cache-read tokens: 41,728 to 4,864 (`-88.3%`).
- Output tokens: 435.5 to 225 (`-48.3%`).

Conversation tokens include uncached input, cache reads, cache writes, and output across provider requests.
The upstream runs issued ten sequential Read turns.
Both candidate runs issued one semicolon-delimited Read call covering all ten targets.
The measurement does not claim universal performance across providers or workloads.

- [x] Tested locally.
- [x] CHANGELOG updated.

### Disclosure

Investigated thoroughly with GPT-5.6 Sol (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence.
It includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know.
I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
```

## Submitted-Text

The approved PR description above was submitted unchanged on 2026-09-01.

### Review reply 1

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903483273`

```markdown
Fixed in the current head.
Exact concrete MCP resource URIs now win before batch splitting, while other internal URI semicolons use `%3B`.
Concrete and template precedence is covered in `test/internal-urls/mcp-protocol.test.ts`.
```

### Review reply 2

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903483283`

```markdown
Fixed in the current head.
The wording-only assertions were removed.
The contract is now covered through behavioral delimiter, routing, and execution tests.
```

### Review reply 3

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903518526`

```markdown
Fixed in the current head.
Explicit semicolon batches are split before the joined scalar reaches filesystem `stat`.
The regression test uses existing targets whose joined path exceeds 255 bytes.
```

### Review reply 4

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903518534`

```markdown
Fixed in the current head.
Batch routing now runs before single-conflict parsing, so conflict-first and conflict-last ordering behave consistently.
Covered in `test/tools/conflict-integration.test.ts`.
```

### Review reply 5

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903518549`

```markdown
Fixed in the current head.
The Read guidance now identifies `%3B` as the escape for literal semicolons in internal URIs.
It also preserves exact MCP resource URIs as advertised.
```

### Review reply 6

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903571842`

```markdown
Fixed in the current head.
HTTP-first mixed batches are recognized before single-URL dispatch and rejected with the sibling-call guidance.
Both target orders are covered.
```

### Review reply 7

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903571854`

```markdown
Fixed in the current head.
Only exact concrete resource equality receives semicolon precedence.
Template matches fall through to normal batch expansion.
```

### Review reply 8

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903571859`

```markdown
Fixed in the current head.
Delimited expansion now precedes single-conflict dispatch.
The regression covers `conflict://` in the first batch position.
```

### Review reply 9

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903646247`

```markdown
Fixed in the current head.
A legal standalone HTTP URL containing a raw semicolon remains one URL.
Recognized URL, internal, conflict, or filesystem siblings still make the input a batch and trigger rejection.
```

### Review reply 10

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903646259`

```markdown
Fixed in the current head.
The guidance now exempts MCP resource URIs advertised by a server and requires them to be passed exactly as listed.
The `%3B` rule remains applicable to authored internal URIs.
```

### Review reply 11

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903708899`

```markdown
Fixed in the current head.
Delimited results carry their expanded targets into the render decision.
A mixed filesystem/internal batch now retains full rendering regardless of target order.
```

### Review reply 12

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903708908`

```markdown
Fixed in the current head.
Independent targets now execute concurrently while the combined result preserves input order.
The concurrency regression uses routed resources rather than filesystem timing assumptions.
```

### Review reply 13

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903786550`

```markdown
Fixed in the current head.
Routable internal targets bypass filesystem archive and SQLite preflights.
The regression covers an archive-shaped `skill://` target in the first position.
```

### Review reply 14

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903786556`

```markdown
Fixed in the current head.
A structured container match no longer claims the entire scalar by itself.
Archive-first and SQLite-first inputs split unless the complete structured target has exact precedence.
```

### Review reply 15

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903786569`

```markdown
Fixed in the current head.
Batch execution now uses the existing concurrency-limited mapping utility with a maximum of eight active reads.
The regression verifies the cap and output ordering across twelve routed targets.
```

### Review reply 16

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903890803`

```markdown
Fixed in the current head.
The sibling probe now recognizes HTTP(S) targets directly.
A URL-to-URL scalar is therefore rejected instead of being fetched as one semicolon-suffixed URL.
```

### Review reply 17

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903890812`

```markdown
Fixed in the current head.
Generic filesystem delimiter parsing no longer treats apostrophes as quoting syntax.
SQLite-specific quoted-semicolon handling remains at the SQLite preflight boundary.
```

### Review reply 18

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903938088`

```markdown
Fixed in the current head.
SQLite query input is preserved only for semicolons inside quoted SQL values.
An unquoted delimiter after `?limit=5` now starts the sibling Read target.
```

### Review reply 19

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3903938098`

```markdown
Fixed in the current head.
The archive owner now checks whether the complete semicolon-containing member exists before batch expansion.
Invalid or non-matching archive paths still fall through to batch handling.
```

### Review reply 20

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904010946`

```markdown
Fixed in the current head.
MCP exact-resource detection now covers native and opaque schemes through `InternalUrlRouter.canResolve()`.
The regression reads `ags://capabilities/current;host` using its exact advertised spelling.
```

### Review reply 21

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904010955`

```markdown
Fixed in the current head.
Statement preservation now requires whitespace or end-of-input after the SQL verb.
Relative peers such as `select.md` and `update-notes.txt` therefore remain batch targets.
```

### Review reply 22

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904072765`
Published: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904289920`

```markdown
Fixed in `8ad28a8e6e`.
The URL sibling probe now applies the archive and SQLite resolvers after direct URL, internal, conflict, and literal checks.
The rejection regression covers URL-first batches with both structured sibling types.
The focused Read suite passes 186 tests.
```

### Review reply 23

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904193373`
Published: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904290042`

```markdown
Fixed in `3cc94ad7fa`.
Ambiguous SQLite inputs now preserve a semicolon only when the complete selector resolves to an exact table or row.
Normal sibling paths still split into independent targets.
The regression covers semicolons in both table identifiers and text primary keys.
```

### Review reply 24

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904193377`
Published: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904290205`

```markdown
Fixed in `3cc94ad7fa`.
The compact-group classifier now uses `InternalUrlRouter.canResolve()`, matching Read execution routing.
Custom MCP schemes therefore retain full rendering in mixed batches.
The regression covers `ags://capabilities/current-host;./local.txt`.
```

### Review reply 25

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904278759`
Published: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904360869`

```markdown
Fixed in `7226dbb847`.
Raw `?q=` selectors now retain SQLite ownership before batch expansion.
Conventional statement terminators and other raw SQL semicolons therefore reach SQLite parsing.
The regression executes a terminated `SELECT` and verifies normal output without a batching notice.
The focused Read suite passes 187 tests.
```

### Review reply 26

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904345289`
Published: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904662513`

```markdown
Fixed in `18467cf339`.
A parsed HTTP(S) target now owns the complete scalar before archive, SQLite, or path-batch preflight.
Read no longer probes cwd contents to reinterpret raw URL semicolons.
Non-URL-first batches containing HTTP(S) still fail with the separate-sibling-call guidance.
The regression covers existing local, archive, SQLite, and URL-shaped suffix collisions.
The focused Read suite passes 202 tests.
```

### Review reply 27

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904477049`
Published: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904662725`

```markdown
Fixed in `2a3e6759f6`.
`parseSqliteSelector()` now runs inside the guarded exact-selector preflight.
Combined selectors that raise `ToolError` therefore return `false` and fall through to normal semicolon batch expansion.
The regression reads a SQLite-first batch whose existing sibling filename is `notes.txt?draft`.
The focused Read suite passes 202 tests.
```

### Review reply 28

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904538864`
Published: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904662910`

```markdown
Fixed in `d07a83c7f7`.
Batch display targets now preserve the original selector when applying a suffix-resolved base path.
One selector-preservation helper owns ordinary grouped suffix rendering and batched display-target composition.
The regression recovers a batched `:50-60` target and verifies the corrected display target retains that selector.
The focused Read suite passes 202 tests.
```

### Review reply 29

Target: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904538872`
Published: `https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904663143`

```markdown
Fixed in `d07a83c7f7`.
The delimiter lexer now removes the backslash only when it escapes a semicolon in semicolon-capable batch modes.
Existing comma and whitespace escape behavior remains unchanged.
The regression reads `escaped\;target.txt;packages/grep.txt` as two targets, including the real `escaped;target.txt` file.
The focused Read suite passes 202 tests.
```

## Archive

Archive-Reason: Withdrawn
Detail: None.
Evidence: Review https://github.com/can1357/oh-my-pi/pull/10465#discussion_r3904652539 exposed another scalar ambiguity, and PR https://github.com/can1357/oh-my-pi/pull/10465 is closed.
Checked: 2026-09-01

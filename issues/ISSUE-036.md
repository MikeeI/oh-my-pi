# ISSUE-036 — ast_grep: truncated results omit the next skip offset

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/20203
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: API
Created: 2026-11-22
Updated: 2026-11-23
Source: `upstream/main@88295533e6`

## Root-Cause

Root-Cause [S]: `AstGrepTool` (upstream `packages/coding-agent/src/tools/ast-grep.ts:383-392`) reports only `narrow path or use skip` when the result limit is reached, and the result metadata carries no next offset.
Neither the model nor the TUI renderer (`packages/tui/src/tools/ast-grep.ts:33-39,158-160,253-257`) can name the page to request next.

## Reach-and-Impact

Reach [S]: Every truncated `ast_grep` result.
Impact [S]: The model must derive the next offset itself from normalized `skip` and the returned match count, which invites repeated or skipped pages; impact on real sessions is not measured.

## Evidence

- [S] Upstream result details lack any offset field; both TUI render paths show generic advice.

## Bug-Reproduction

Environment: `upstream/main@88295533e6` detached worktree, Bun 1.4.5, Ubuntu 24.04.
Reproduction: Run the MOMP case `gives the model and TUI the next page offset after normalizing skip` from `packages/coding-agent/test/tools/ast-grep.test.ts` against upstream (106 matches, `skip: 50.9`).
Actual [O]: `details.nextSkip` is `undefined`.
Expected: `nextSkip` is `100` and model text, TUI result, and native description all name `skip=100`; the case passes on `personal`.

## Prior-Art

Coverage: upstream issues and PRs searched for `ast_grep pagination skip`, `"ast_grep" "skip"`, and `ast-grep`; checked=2026-11-22.
Gaps: None material.

- [#18105](https://github.com/can1357/oh-my-pi/pull/18105) — merged; search-scope headers, not pagination.

Contribution fit: No thread owns this; a focused PR is the smallest unit.

## Proposed-Change

Compute `nextSkip = normalized skip + matches returned` when the limit is reached, store it in result details, name it in the model text, and show it in both TUI render paths.
Results recorded without the field keep the generic advice.

## Scope-and-Constraints

- Preserve: match selection, limits, parse-error reporting, and historical result rendering.
- Exclude: a public `limit` parameter.
- Compatibility: `nextSkip` is an optional details field.

## Verification

- `bun test packages/coding-agent/test/tools/ast-grep.test.ts -t "gives the model and TUI the next page offset after normalizing skip"` → 1 pass, 5 expects.
- `bun --cwd=packages/coding-agent check` and `bun --cwd=packages/tui check` → pass.

## API-and-Compatibility

Callers [S]: `ast_grep` model output, `astGrepToolRenderer.renderResult`, and `describeResult`.
Contract [S]: Truncated results expose the exact next offset.
Compatibility: Historical results without `nextSkip` render the previous generic advice.
Migration: None.

## Pull-Request-Implementation

Branch: `fix/issue-036`
Base: `upstream/main@88295533e6`
Scope: Report the next skip offset for truncated `ast_grep` results.
Commit: `92489ec363`; attribution `72074b51ef`; review fix `5b8fcdbf3e` (attributed `packages/tui/CHANGELOG.md` entry).
Push: `MikeeI/oh-my-pi:fix/issue-036`
Checks:

- Focused pagination case → 1 pass, 0 fail.
- coding-agent and tui `check` → pass.

## Publication-Blockers

None.

## Next-Action

Summary: Await maintainer review
Action: Await maintainer review of PR #20203 and address requested changes.
Done-When: PR #20203 is merged, declined, or receives actionable review.

## Publication-Draft

Target: New pull request `MikeeI/oh-my-pi:fix/issue-036` → `can1357/oh-my-pi:main`.

Title:

```text
fix(ast-grep): report the next skip offset for truncated results
```

Body:

```markdown
## What

When `ast_grep` hits its result limit, it now reports the exact next offset: `Result limit reached; narrow path or use skip=N for the next page.`
`N` is the normalized `skip` plus the matches returned on this page; it is also stored as `nextSkip` in the result details, and both TUI render paths show it.
Results recorded without `nextSkip` keep the current generic hint.

## Why

The current hint only says "use skip", so the model has to work out the next offset from the normalized `skip` and the returned count itself, and the TUI cannot show it either.

## Testing

- `bun test packages/coding-agent/test/tools/ast-grep.test.ts -t "gives the model and TUI the next page offset after normalizing skip"` — passes (106 matches, `skip: 50.9` → `skip=100` in model text, TUI result, and native description); on current `main`, `nextSkip` is `undefined`.
- `bun --cwd=packages/coding-agent check` and `bun --cwd=packages/tui check` — pass.

---

- [x] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated with the required attribution (if user-facing; internal issue fixes use issue links, external contributions add the PR link and contributor credit after creation)

### Disclosure

Investigated and implemented with Claude Opus, using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
I reviewed the full diff and checked the claims against the cited code and test runs.

Thank you for your work.
```

# ISSUE-037 — LSP: servers without `$/progress` hold every project-load wait for the 15 s fallback

State: PR-Ready
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-11-22
Updated: 2026-11-22
Source: `upstream/main@88295533e6`

## Root-Cause

Root-Cause [S]: In `packages/coding-agent/src/lsp/client.ts`, the project-load quiet timer starts only after a `$/progress` `end` (upstream `:737-745`, `:852-870`).
A server that never reports progress therefore resolves its project load only through the 15 s fallback (`:1393-1429`), and each workspace-folder add restarts that wait (`:959-966`).

## Reach-and-Impact

Reach [S]: pyright, ty, ruff, and typescript-language-server, which never send `$/progress` (`CONTRACTS.md` `MOMP-LSP`).
Impact [S]: The first project-aware wait on those servers lasts about 15 s, delaying first-edit diagnostics and timing out early `lsp diagnostics` calls.

## Evidence

- [S] Upstream settles project load only through progress quiet time or the fallback.

## Bug-Reproduction

Environment: `upstream/main@88295533e6` detached worktree, Bun 1.4.5, Ubuntu 24.04, fake LSP server fixture.
Reproduction: Run the MOMP case `ends the load of a server that never reports progress well before the 15 s fallback` from `packages/coding-agent/test/tools/lsp-regressions.test.ts` against upstream.
Actual [O]: `waitForProjectLoaded` took 14992 ms.
Expected: Under 5000 ms; the case passes on `personal` in about 2.4 s.
Boundary: The fixture exercises silent startup; a silent folder add and named real servers were not run.

## Prior-Art

Coverage: upstream source history for `src/lsp/client.ts` including `290d787845` ("readiness waits for progress to go quiet"); checked=2026-11-22.
Gaps: No dedicated issue search for silent-server load waits.

Contribution fit: Upstream's readiness work covers progress-reporting servers only; a focused PR complements it.

## Proposed-Change

After `initialized` and after each workspace-folder add, start a 2 s timer that resolves project load only for clients that have never begun `$/progress`.
Clients that ever reported progress keep the existing progress and fallback settlement.

## Scope-and-Constraints

- Preserve: progress-based settlement, the 15 s fallback, and rust-analyzer readiness.
- Exclude: diagnostics wait budgets and server-specific readiness probes.
- Cost: one module-level timer map and a set of progress-reporting clients.

## Verification

- `bun test packages/coding-agent/test/tools/lsp-regressions.test.ts -t 'never reports progress'` on the PR branch → 1 pass (2.54 s).
- `bun --cwd=packages/coding-agent check` → pass.

## Pull-Request-Implementation

Branch: `fix/issue-037`
Base: `upstream/main@88295533e6`
Scope: End project-load waits 2 s after start or folder add for servers that never report progress.
Commit: `4f6df4feec`
Push: `MikeeI/oh-my-pi:fix/issue-037`
Checks:

- Focused silent-server case → 1 pass, 0 fail.
- `bun --cwd=packages/coding-agent check` → pass.

## Publication-Blockers

None.

## Next-Action

Summary: Approve LSP silent-load PR
Action: Show the exact Publication-Draft and target and publish only after explicit user approval.
Done-When: The user approves or rejects the exact draft, and External-Reference records any resulting PR URL.

## Publication-Draft

Target: New pull request `MikeeI/oh-my-pi:fix/issue-037` → `can1357/oh-my-pi:main`.

Title:

```text
fix(lsp): stop waiting for project load on servers that never report progress
```

Body:

```markdown
## What

A language server that has never sent `$/progress` now finishes its project-load wait 2 s after `initialized` or after a workspace-folder add.
Servers that have reported progress at least once keep the current progress/quiet-timer settlement and the 15 s fallback.

## Why

The quiet timer only starts after a progress `end`, so pyright, ty, ruff, and typescript-language-server — which never report progress — always sit out the full 15 s fallback.
That delays the first edit's diagnostics and makes early `lsp diagnostics` calls time out.
Servers that do report loads begin progress almost immediately (gopls, rust-analyzer, `tsc --lsp` within ~300 ms), so 2 s of silence is a safe signal.

## Testing

- `bun test packages/coding-agent/test/tools/lsp-regressions.test.ts -t 'never reports progress'` — passes in ~2.5 s; on current `main` the same wait takes ~15 s.
- `bun --cwd=packages/coding-agent check` — passes.

---

- [x] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated with the required attribution (if user-facing; internal issue fixes use issue links, external contributions add the PR link and contributor credit after creation)

### Disclosure

Investigated and implemented with Claude Opus, using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
I reviewed the full diff and checked the claims against the cited code and test runs.

Thank you for your work.
```

# ISSUE-035 — LSP: aliased typescript installs crash typescript-language-server at initialize

State: PR-Ready
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Reliability
Created: 2026-11-22
Updated: 2026-11-22
Source: `upstream/main@88295533e6`

## Root-Cause

Root-Cause [S]: `selectTypescriptServer` in `packages/coding-agent/src/lsp/config.ts` (upstream `:327-379`) resolves the package behind `tsc` to choose between `tsc --lsp` and typescript-language-server, but never hands that package's tsserver to typescript-language-server.
typescript-language-server loads `node_modules/typescript`, which alias layouts point at an API-only package without `lib/tsserver.js`, so the server exits at initialize.

## Reach-and-Impact

Reach [S]: Workspaces where `typescript` is aliased (for example to `@typescript/typescript6`) while `.bin/tsc` links another package (for example `@typescript/old`).
Impact [O]: TypeScript LSP is unavailable in those workspaces; five local MOMP projects used that layout on 2026-11-20 (`CONTRACTS.md` `MOMP-LSP`).

## Evidence

- [S] Upstream `config.ts:371-379` only deletes one of the two server entries and passes no `initOptions.tsserver.fallbackPath`.

## Bug-Reproduction

Environment: `upstream/main@88295533e6` detached worktree, Bun 1.4.5, Ubuntu 24.04.
Reproduction: Run the MOMP case `points typescript-language-server at the tsc package's tsserver when node_modules/typescript lacks one` from `packages/coding-agent/test/tools/lsp-regressions.test.ts` against upstream.
Actual [O]: The resolved `initOptions.tsserver` is `undefined`.
Expected: `fallbackPath` points at `@typescript/old/lib/tsserver.js`; the case passes on `personal`.
Boundary: The test checks the resolved configuration, not a live server initialization.

## Prior-Art

Coverage: upstream issues and PRs searched for `tsserver fallback typescript`, `"typescript" "alias" "lsp"`, and `tsserver`; checked=2026-11-22.
Gaps: None material.

- [#19238](https://github.com/can1357/oh-my-pi/issues/19238) — open; dead tsserver after heap exhaustion, a different root cause.

Contribution fit: No thread owns this root cause; a focused PR is the smallest unit.

## Proposed-Change

When typescript-language-server is selected and the `tsc` package is known, set `initOptions.tsserver.fallbackPath` to that package's `lib/tsserver.js` unless the user already configured one.

## Scope-and-Constraints

- Preserve: `tsc --lsp` selection, a usable workspace TypeScript (typescript-language-server prefers it over `fallbackPath`), and explicit `fallbackPath` configuration.
- Exclude: other LSP server selection and runtime behavior.

## Verification

- `bun test packages/coding-agent/test/tools/lsp-regressions.test.ts -t "points typescript-language-server at the tsc package"` on the PR branch → 1 pass.
- `bun --cwd=packages/coding-agent check` → pass.

## Pull-Request-Implementation

Branch: `fix/issue-035`
Base: `upstream/main@88295533e6`
Scope: Pass the `tsc` package's tsserver as typescript-language-server `fallbackPath`.
Commit: `4f0912a8ca`
Push: `MikeeI/oh-my-pi:fix/issue-035`
Checks:

- Focused alias-layout case → 1 pass, 0 fail.
- `bun --cwd=packages/coding-agent check` → pass.

## Publication-Blockers

None.

## Next-Action

Summary: Approve tsserver fallback PR
Action: Show the exact Publication-Draft and target and publish only after explicit user approval.
Done-When: The user approves or rejects the exact draft, and External-Reference records any resulting PR URL.

## Publication-Draft

Target: New pull request `MikeeI/oh-my-pi:fix/issue-035` → `can1357/oh-my-pi:main`.

Title:

```text
fix(lsp): fall back to the tsc package's tsserver for aliased typescript installs
```

Body:

```markdown
## What

When typescript-language-server is selected, it now gets `initOptions.tsserver.fallbackPath` pointing at the `lib/tsserver.js` of the package behind the resolved `tsc`.
A workspace TypeScript that ships its own tsserver still wins, and an explicitly configured `fallbackPath` is left alone.

## Why

`selectTypescriptServer` already inspects the package behind `tsc`, but typescript-language-server loads `node_modules/typescript`.
In alias layouts (`typescript` → `@typescript/typescript6`, an API-only package without `tsserver.js`, while `.bin/tsc` links `@typescript/old`) the two differ, and the server exits at initialize, so TypeScript LSP is unavailable in those workspaces.

## Testing

- `bun test packages/coding-agent/test/tools/lsp-regressions.test.ts -t "points typescript-language-server at the tsc package"` — passes; it fails on current `main` with `tsserver` options `undefined`.
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

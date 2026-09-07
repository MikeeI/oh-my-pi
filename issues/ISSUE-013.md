# ISSUE-013 — LSP symbols: file query is ignored

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/8400
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: API
Created: 2026-08-13
Updated: 2026-08-27
Source: `upstream/main@6be4a1bec9c53ed9eef33e65a70a060970f30cce`

## Root-Cause

Root-Cause [S]: File-scoped `lsp symbols` accepts `query` but upstream returns the complete document-symbol result.

## Reach-and-Impact

Reach [S]: Every file-scoped symbol query reaches this unfiltered document-symbol path.
Impact: Targeted calls consume unrelated symbol output; context and latency impact remain unmeasured.

## Evidence

- [S] `packages/coding-agent/src/lsp/tool.ts` → the MOMP delta filters hierarchical and flat document symbols.
- [S] `packages/coding-agent/src/lsp/utils.ts` → matching ancestors and matching subtrees remain visible.
- [O] Personal commits `790cccbebe29` and `b99fe0e746d1` implement filtering and preserve symbol rendering.
- [O] The focused regression retains `TopMatches` and `push` while omitting `FuzzyFindOptions`.
- [O] GitHub reports PR #8400 open, non-draft, and clean; checked 2026-08-27.
- [O] Review comment `discussion_r3772223092` identified the queried-symbol renderer regression on the reviewed head.
- [O] Current MOMP output keeps the `Symbols in` header and adds a separate `Matching query` line.

## Prior-Art

Coverage: Current upstream source, MOMP history, PR #8400, and its complete review thread; checked=2026-08-27.
Gaps: The original exhaustive issue, discussion, release, and closed-PR search was not reconstructed during ledger adoption.

- [PR #8400](https://github.com/can1357/oh-my-pi/pull/8400) — Existing submitted implementation for this root cause.
- `MOMP-LSP` in `AGENTS.md` — Active fork contract retaining this behavior until upstream satisfies it.

Contribution fit: The existing pull request owns this exact file-scoped query behavior.

## Proposed-Change

Filter hierarchical document symbols by name or detail while retaining matching ancestors and matching subtrees.
Filter flat symbol information by name or container.
Preserve unfiltered file-symbol output and workspace-symbol query behavior.
Preserve the `Symbols in` header required by the symbol renderer.

## Scope-and-Constraints

- Preserve: No-query output, hierarchical rendering, flat symbols, workspace symbols, and tool result details.
- Exclude: Symbol ranking, fuzzy matching, workspace-symbol behavior, and unrelated LSP operations.
- Cost: Explicit file queries return fewer symbols by design.

## Verification

- `bun test packages/coding-agent/test/tools/lsp-regressions.test.ts` → focused query case passes.
- The result retains the matching parent and child and omits the unrelated symbol.
- The result retains the `Symbols in` header consumed by the TUI renderer.

## API-and-Compatibility

Callers [S]: `LspTool` file-scoped `symbols` actions with an explicit `query`.
Contract [S]: Query narrows file-symbol output without changing unfiltered calls.
Compatibility: Existing no-query calls and workspace-symbol queries remain unchanged.
Migration: None.

## Pull-Request-Implementation

Branch: `feat/lsp-document-symbol-query`
Base: `upstream/main@6be4a1bec9c53ed9eef33e65a70a060970f30cce`
Scope: Filter file-scoped document symbols while preserving current symbol rendering.
Commit: PR review identifies `eec9e6a37b`; current MOMP fixes are `790cccbebe29` and `b99fe0e746d1`.
Push: `MikeeI/oh-my-pi:feat/lsp-document-symbol-query`
Checks:

- Focused file-symbol query regression → passes in current MOMP.
- Current GitHub merge state → clean on 2026-08-27.

Review [O]: The reviewed PR head needs the later `Symbols in` header preservation from current MOMP.

## Publication-Blockers

None.

## Next-Action

Summary: Rebase LSP symbol PR
Action: Rebase PR #8400 onto current upstream and carry the symbol-renderer fix from current MOMP.
Done-When: The current PR head contains the renderer fix and its focused test and required CI pass.

## Publication-Draft

Title:

```text
feat(coding-agent): filter document symbols by query
```

Body:

```markdown
## What

Allow `lsp symbols` calls scoped to a file to use the existing `query` argument.
Hierarchical document symbols retain matching ancestors and matching subtrees.
Flat symbol results filter by name or container.
Unfiltered calls keep the current full output.

The LSP tool prompt now advertises the file-query behavior.

## Why

File-scoped symbol calls currently ignore `query`, so a targeted lookup returns the full document symbol tree and wastes agent context.
Workspace symbol calls already support this narrowing, and the tool schema already exposes `query`.

I reviewed the full diff.
This keeps the existing no-query behavior and limits the new filtering to explicit file symbol queries.

## Testing

- `bun test packages/coding-agent/test/tools/lsp-regressions.test.ts --test-name-pattern 'filters file symbol output by query'`
  - Result: one passing focused test.
  - The output retained `TopMatches` and its child `push` and omitted unrelated `FuzzyFindOptions`.
- `bun --cwd=packages/coding-agent check`
  - Result: Biome and `tsgo` passed.

---

- [x] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated

### Disclosure

Investigated thoroughly with GPT-5.6 (high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence.
It includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
```

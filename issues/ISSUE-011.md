# ISSUE-011 — Read: compact directory metadata spacing

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/9062
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-08-21
Updated: 2026-08-23
Source: `upstream/main@160ed439ac0df594347e7d7018b813a7ffdb5e81`

## Root-Cause

Root-Cause [S]: Read directory listings align every metadata column to the widest entry even when spacing carries no information.

## Reach-and-Impact

Reach [S]: Every Read directory preview that includes file sizes and relative modification times uses the aligned renderer.
Impact: The preview repeats padding on every entry; token reduction beyond the focused preview is not measured.

## Evidence

- [O] Rebased head `df1d6cb7a68b` passes `bun test packages/coding-agent/test/workspace-tree.test.ts` with 9 pass and 0 fail.
- [S] `packages/coding-agent/src/workspace-tree.ts` → Read listings select compact metadata while prompt trees retain aligned metadata.
- [S] [PR #9062](https://github.com/can1357/oh-my-pi/pull/9062) → head `df1d6cb7a68b` contains implementation `400669749a96` and changelog follow-up `df1d6cb7a68b`.
- [O] GitHub reports PR #9062 open, mergeable, and clean against `upstream/main@160ed439ac0d`; checked 2026-08-23.

## Prior-Art

Coverage: issues(open+closed), PRs(open+closed+merged), discussions, releases; checked=2026-08-21.
Gaps: End-to-end token measurement and maintainer disposition remain unavailable.

- [PR #9062](https://github.com/can1357/oh-my-pi/pull/9062) — Distinct; owns compact Read directory metadata spacing.
- `MOMP-TREE-COMPACT` in `AGENTS.md` — Related; records the fork contract and upstream action.

Contribution fit: Existing pull request #9062 owns the Read renderer and adds a focused behavior test without changing prompt-tree cache stability.

## Proposed-Change

Use compact single-space separators for Read directory metadata while retaining names, sizes, relative ages, ordering, hierarchy, depth, limits, and elision behavior.
Keep the system-prompt workspace tree aligned because it is a separate cache-sensitive output contract.

## Scope-and-Constraints

- Preserve: Directory names, hierarchy, ordering, depth, limits, truncation, sizes, relative ages, and prompt-tree alignment.
- Exclude: System-prompt workspace-tree compaction and unrelated token or rendering optimization.
- Cost: Read output bytes change; downstream consumers must treat spacing as presentation rather than a parsed column layout.

## Verification

- `bun test packages/coding-agent/test/workspace-tree.test.ts` → 9 pass, 0 fail.
- PR review confirms the compact path preserves tree structure, ordering, depth, and truncation.

## Performance-Evidence

Workload: Read directory previews with file sizes and relative modification times.
Baseline [S]: Aligned labels and metadata columns repeat padding across entries.
Candidate [O]: PR #9062 asserts the compact output shape with single-space separators.
Guard [O]: Focused workspace-tree tests pass with 9 pass, 0 fail.
Boundary: End-to-end token savings and system-prompt impact remain unmeasured.
End-to-end-Measurement: Not measured

## API-and-Compatibility

Callers [S]: Read directory rendering through `buildDirectoryTree`.
Contract [S]: Read listings retain metadata values and structural ordering while changing presentation spacing.
Compatibility: The system-prompt workspace tree remains aligned and cache-stable.
Migration: None.

## Pull-Request-Implementation

Branch: `contrib/read-compact-directory-metadata`
Base: `upstream/main@160ed439ac0df594347e7d7018b813a7ffdb5e81`
Scope: Compact Read directory metadata spacing without changing the separate system-prompt tree contract.
Commit: `df1d6cb7a68b` (implementation `400669749a96`; changelog follow-up `df1d6cb7a68b`)
Push: `origin/contrib/read-compact-directory-metadata`
Checks:

- `bun test packages/coding-agent/test/workspace-tree.test.ts` → 9 pass, 0 fail after rebase.
- `bun --cwd=packages/coding-agent run check` → Biome and type check passed.
- GitHub Actions runs `32662040078` and `32662040094` → OMP Nix and all required CI jobs passed.
Review [O]: Both `COMMENTED` reviews target the earlier implementation; clean head `df1d6cb7a68b` retains their resolutions.

## Publication-Blockers

None.

## Next-Action

Summary: Await Read current-head review
Action: Monitor pull request #9062 for review of clean head `df1d6cb7a68b` and the maintainer decision.
Done-When: A current-head review, requested follow-up, or terminal outcome is recorded.

## Publication-Draft

Title:

```text
perf(read): compact directory metadata spacing
```

Body:

```markdown
## Why
Large directory previews repeat wide alignment padding on every entry, adding tokens without carrying information.

## Changes
- Render existing directory sizes and relative mtimes with single separators.
- Preserve the existing tree structure, metadata values, ordering, depth, and truncation behavior.
- Cover the compact read listing format with a focused regression assertion.

## Impact
The directory preview keeps the same information in a denser representation.

Verification: `bun test packages/coding-agent/test/workspace-tree.test.ts` — 9 pass, 0 fail.
```

# ISSUE-012 — Prompt: metadata-free workspace tree

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/9152
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-08-21
Updated: 2026-08-23
Source: `upstream/main@76a294cb19bfded1e32e2111f1f729129595bf5e`

## Root-Cause

Root-Cause [S]: The startup system-prompt workspace tree rendered file sizes and modification times even though names and structure provide the actionable context.

## Reach-and-Impact

Reach [S]: The change applies when the `Include Workspace Tree` setting enables the workspace tree in the system prompt.
Impact: Enabled sessions now send the same tree structure without volatile metadata columns; end-to-end token and latency savings are not measured.

## Evidence

- [S] `packages/coding-agent/src/workspace-tree.ts` → `buildWorkspaceTree` passes `includeMetadata: false`, while Read directory trees pass `true`.
- [O] `bun test packages/coding-agent/test/workspace-tree.test.ts` → 9 pass, 0 fail; the prompt tree contains `  - stable.txt` without size, absolute mtime, or relative age.
- [S] Personal commit `ee24b5ba372fbf8c29c57aa561d9a5407ed115a5` → implements metadata-free prompt rendering and its regression assertion.
- [S] `config/settings-schema.ts` → `Include Workspace Tree` controls whether the workspace tree is rendered in the system prompt.
- [O] PR head `13e7da36f1` skips size and age formatting for prompt trees while preserving mtime-based ordering.
- [O] GitHub reports PR #9152 open with merge state `DIRTY` against current `main`; checked 2026-08-23.

## Prior-Art

Coverage: issues(open+closed), PRs(open+closed+merged), discussions, releases; checked=2026-08-21.
Gaps: Upstream maintainer direction for the prompt-tree-specific behavior remains unavailable.

- [PR #9062](https://github.com/can1357/oh-my-pi/pull/9062) — Related but distinct; compacts Read directory spacing and deliberately leaves the prompt tree aligned.
- `MOMP-TREE-COMPACT` in `AGENTS.md` — Current MOMP contract; metadata-free prompt trees remain fork-specific.

Contribution fit: User-selected PR #9152 is submitted; no existing thread owns the prompt-tree metadata contract.

## Proposed-Change

Retain metadata-free rendering for the startup system-prompt workspace tree when `Include Workspace Tree` is enabled.
Keep sizes and relative modification times in Read directory output, where they remain useful to the operator.
Proposed-PR-Rationale: The workspace tree is overview context rather than a file-inspection report.
File sizes and modification timestamps add volatile metadata without improving project-structure orientation.
Read output remains the appropriate place for sizes and file times when an operator inspects directory entries.

Alternative-PR-Text-Only: If metadata retention is preferred, show the workspace tree with Read-style compact separators while keeping absolute mtimes for prompt-cache stability.
This alternative is a proposal inside the PR text only; it does not change the personal implementation.

## Scope-and-Constraints

- Preserve: Workspace-tree names, hierarchy, ordering, depth, per-directory limits, line cap, truncation markers, and AGENTS.md discovery.
- Exclude: Read directory-listing formatting, prompt-tree removal, and unrelated token optimization.
- Cost: Prompt-tree output bytes change; operators or extensions must not parse removed metadata columns from this prompt block.

## Verification

- `bun test packages/coding-agent/test/workspace-tree.test.ts` → 9 pass, 0 fail.
- The focused regression asserts metadata-free prompt output and preserves Read size plus relative-age output.

## Performance-Evidence

Workload: Startup system-prompt workspace trees with `Include Workspace Tree` enabled.
Baseline [S]: Prompt entries carried size and modification-time columns.
Candidate [O]: PR head `13e7da36f1` removes prompt metadata and skips its discarded formatting.
Guard [O]: Focused tests preserve metadata-free prompt output, Read size and age, and mtime ordering.
Boundary: End-to-end token, latency, and prompt-cache measurements remain unmeasured.
End-to-end-Measurement: Not measured

Example: Current MOMP fork root, same 29-line tree, compared across aligned metadata, Read-style compact metadata, and metadata-free rendering.

Aligned baseline:

```text
.
  - ISSUES.md                         3.5KB     2026-08-20 23:51
  - AGENTS.md                         61.2KB    2026-08-20 23:51
  - issues/                                     2026-08-20 23:51
    - ISSUE-012.md                    5.3KB     2026-08-20 23:54
    - ISSUE-011.md                    4.7KB     2026-08-20 23:48
    - ISSUE-010.md                    6.8KB     2026-08-20 23:26
    - ISSUE-007.md                    6.5KB     2026-08-20 23:26
```

Read-style compact alternative:

```text
.
  - ISSUES.md 3.5KB 2026-08-20 23:51
  - AGENTS.md 61.2KB 2026-08-20 23:51
  - issues/ 2026-08-20 23:51
    - ISSUE-012.md 5.3KB 2026-08-20 23:54
    - ISSUE-011.md 4.7KB 2026-08-20 23:48
    - ISSUE-010.md 6.8KB 2026-08-20 23:26
    - ISSUE-007.md 6.5KB 2026-08-20 23:26
```

Metadata-free personal output:

```text
.
  - ISSUES.md
  - AGENTS.md
  - issues/
    - ISSUE-012.md
    - ISSUE-011.md
    - ISSUE-010.md
    - ISSUE-007.md
```

Measurement: Aligned baseline is 633 tokens and 1,770 characters.
Measurement: Read-style compact metadata is 583 tokens and 1,106 characters.
Measurement: Metadata-free personal output is 171 tokens and 508 characters.
Comparison: The compact alternative saves 50 tokens (7.9%) versus baseline.
Comparison: Metadata-free output saves 462 tokens (73.0%) versus baseline.
Comparison: Metadata-free output saves 412 tokens (70.7%) versus the compact alternative.
Method: Counts use OpenAI `o200k_base` on the current fork tree; all values are counterfactual text measurements, not end-to-end session measurements.

## API-and-Compatibility

Callers [S]: System-prompt construction through `buildWorkspaceTree`.
Contract [S]: The optional workspace tree remains structurally identical while omitting size and mtime metadata.
Compatibility: Read directory output retains metadata, and disabling `Include Workspace Tree` still omits the prompt block.
Migration: None.

## Publication-Blockers

None.

## Pull-Request-Implementation

Branch: `contrib/workspace-tree-metadata-free`
Base: `upstream/main@76a294cb19bfded1e32e2111f1f729129595bf5e`
Scope: Omit prompt-tree metadata and its formatting while preserving Read metadata output and mtime ordering.
Commit: `13e7da36f1`
Push: `origin/contrib/workspace-tree-metadata-free`
Checks:

- `bun test packages/coding-agent/test/workspace-tree.test.ts` → 9 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check` → Biome checked 2,672 files; type check passed.
- GitHub Actions run `32440557630` → every required build, smoke, and test job passed.
Review [O]: The `COMMENTED` review targets `dbb023374ea5`; head `13e7da36f194` addressed all three findings before current upstream drift.

## Publication-Draft

Title:

```text
fix(coding-agent): omit volatile metadata from prompt workspace tree
```

Body:

```markdown
## Why

The startup workspace tree is overview context rather than a file-inspection report.
File sizes and modification timestamps add volatile metadata without improving project-structure orientation.
The Read directory output remains the appropriate place for sizes and file times when an operator inspects entries.

## Changes

- Omit file-size and modification-time columns from the system-prompt workspace tree when `Include Workspace Tree` is enabled.
- Keep the existing tree names, hierarchy, ordering, depth, limits, truncation markers, and `AGENTS.md` discovery.
- Keep Read directory listings unchanged, including their file sizes and relative modification times.

## Impact

The workspace tree retains its overview function with substantially less prompt text.
On the current Oh My Pi fork tree, the counterfactual aligned renderer uses 633 `o200k_base` tokens.
The metadata-free renderer uses 171 tokens, saving 462 tokens (73.0%).
This is a text-rendering comparison, not an end-to-end session measurement.

## Verification

- `bun test packages/coding-agent/test/workspace-tree.test.ts` — 9 pass, 0 fail.
- The regression test confirms stable metadata-free prompt output and preserved Read metadata output.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
```

## Next-Action

Summary: Rebase tree PR branch
Action: Rebase pull request #9152 onto current `upstream/main`, resolve the workspace-tree drift, and rerun focused checks.
Done-When: GitHub reports a clean current head and every required check passes.

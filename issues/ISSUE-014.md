# ISSUE-014 — LSP rename: previews omit edit details

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/8401
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: UI
Created: 2026-08-13
Updated: 2026-08-27
Source: `upstream/main@6be4a1bec9c53ed9eef33e65a70a060970f30cce`

## Root-Cause

Root-Cause [S]: LSP rename previews report per-file edit counts without showing positions or replacement text.

## Reach-and-Impact

Reach [S]: `rename` and `rename_file` with `apply: false` use this workspace-edit preview.
Impact: Agents and users cannot inspect the proposed replacements before the default mutating operation.

## Evidence

- [S] `packages/coding-agent/src/lsp/utils.ts` → MOMP renders bounded line, column, and replacement details.
- [O] Personal commits `0925bd1fdf97` and `16d20db9be64` implement detailed previews and CR escaping.
- [O] The focused regression shows 8/9 edits, reports one omission, and leaves the filesystem unchanged.
- [O] The regression escapes CRLF, CR, and LF and rejects literal carriage returns in output.
- [O] GitHub reports PR #8401 open, non-draft, and unstable; checked 2026-08-27.
- [O] Review comment `discussion_r3772223379` identified unescaped carriage returns on the reviewed head.

## Prior-Art

Coverage: Current upstream source, MOMP history, PR #8401, and its complete review thread; checked=2026-08-27.
Gaps: The original exhaustive issue, discussion, release, and closed-PR search was not reconstructed during ledger adoption.

- [PR #8401](https://github.com/can1357/oh-my-pi/pull/8401) — Existing submitted implementation for this root cause.
- `MOMP-LSP` in `AGENTS.md` — Active fork contract retaining this behavior until upstream satisfies it.

Contribution fit: The existing pull request owns this exact preview-detail behavior.

## Proposed-Change

Show line, column, and replacement text beneath each affected file in rename previews.
Bound details to the shared eight-item preview limit.
Report shown, total, and omitted edit counts when the preview is incomplete.
Escape CRLF, CR, LF, and tabs before terminal rendering and truncation.
Preserve `apply: false` filesystem and LSP side-effect freedom.

## Scope-and-Constraints

- Preserve: Apply behavior, file grouping, edit counts, filesystem state, and LSP notification behavior.
- Exclude: Rename execution, workspace-edit ordering, rollback, and unrelated LSP formatting.
- Cost: Preview output becomes longer but remains bounded and sanitized.

## Verification

- `bun test packages/coding-agent/test/tools/lsp-regressions.test.ts` → focused rename preview case passes.
- The preview shows 8/9 edits, reports one omission, and omits the ninth replacement.
- The preview escapes CRLF, CR, and LF and contains no literal carriage return.
- `apply: false` leaves source and destination paths unchanged and emits no rename notification.

## API-and-Compatibility

Callers [S]: `LspTool` `rename` and `rename_file` actions with `apply: false`.
Contract [S]: Preview mode exposes bounded, sanitized edit details without applying the edit.
Compatibility: Apply mode and existing workspace-edit semantics remain unchanged.
Migration: None.

## Pull-Request-Implementation

Branch: `feat/lsp-rename-preview-details`
Base: `upstream/main@6be4a1bec9c53ed9eef33e65a70a060970f30cce`
Scope: Add bounded rename preview details and terminal-safe replacement text.
Commit: PR review identifies `c8d7d3e214`; current MOMP fixes are `0925bd1fdf97` and `16d20db9be64`.
Push: `MikeeI/oh-my-pi:feat/lsp-rename-preview-details`
Checks:

- Focused rename preview regression → passes in current MOMP.
- Current GitHub merge state → unstable on 2026-08-27.

Review [O]: The reviewed PR head needs the later carriage-return escaping from current MOMP.

## Publication-Blockers

None.

## Next-Action

Summary: Rebase LSP preview PR
Action: Rebase PR #8401 onto current upstream and carry the carriage-return fix from current MOMP.
Done-When: The current PR head contains CR-safe rendering and its focused test and required CI pass.

## Publication-Draft

Title:

```text
feat(coding-agent): detail LSP rename previews
```

Body:

```markdown
## What

Include line, column, and replacement text beneath each file in LSP `rename` and `rename_file` previews.
The output shows up to the shared eight-item preview limit.
It explicitly reports the shown, total, and omitted edit counts when a preview is incomplete.

Replacement text uses the existing terminal sanitization and centralized truncation limits.

## Why

`apply: false` currently reports only per-file edit counts such as `old.ts: 3 edits`.
That does not let an agent or user inspect what the language server intends to replace before the default mutating operation.

I reviewed the full diff.
This adds bounded decision-relevant detail without changing apply behavior or issuing additional LSP requests.

## Testing

- `bun test packages/coding-agent/test/tools/lsp-regressions.test.ts --test-name-pattern 'rename_file with apply:false previews edits without filesystem changes'`
  - Result: one passing focused test.
  - The preview showed positions and replacement text for 8/9 edits and explicitly reported one omission.
  - It omitted the ninth replacement and left the filesystem unchanged.
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

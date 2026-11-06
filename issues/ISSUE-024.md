# ISSUE-024 — tmux: stale paints detach the resize cursor anchor and overwrite accepted rows

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-09-30
Updated: 2026-10-06
Source: `upstream/main@8ac1309bd8adaddc891eeb389c545345073875be`

The Source field names the local canonical-upstream comparison snapshot, not a completed upstream runtime reproduction.
The historical captures below used `personal@0fbe07008812a2c4fd2599b7091c3959541e5870`.
The implementation baseline is `personal@77adac703fc417e0692d0f1e2946ece747d83421`, with upstream 18.4.4 integrated.
The original failure was reproduced again on that baseline before changing runtime source.

## Work-Pause

Local investigation is paused at the user's request as of 2026-10-06.
The lifecycle state and publication metadata remain unchanged; this pause does not close or withdraw external work.
Preserve all evidence and contribution history; resume investigation only after an explicit user request.

## Resume-Here

Read this record together with [ISSUE-023](ISSUE-023.md).
Two independently demonstrated faults required correction.
This record owns stale absolute paints between tmux grid resize and SIGWINCH delivery.
They detach the cursor from the live content and cause the subsequent anchor recovery to overwrite accepted rows.
ISSUE-023 owns later stale-row accumulation because known mutable rows remain protected from erasure.
Both source corrections are implemented, verified, and deployed in `18.4.4-mikeei-2`.
The follow-up request authorizes source commits, release, global installation, and deployment smoke.
Canonical-upstream publication remains unauthorized.
`Authorized-Work: Not-Selected` concerns the separate upstream contribution workflow.

## Root-Cause

[O] The tmux server trace shows that height growth initially moves the cursor correctly with the pulled-down content.
[O] Before tmux delivers the new PTY size, TUI emits absolute spinner/editor paints using the old row coordinates.
[O] Those paints move the cursor back from one-based row 39 to row 33 while the content remains displaced by six rows.
[S] The later tagged CPR is current and truthful, but its cursor no longer has the saved content-relative offset.
[O] Subtracting the saved 18-row offset therefore selects zero-based top 14 instead of the correct top 20.
[O] The resulting paint overwrites accepted `PREFACE-29`, `PREFACE-30`, and `PREFACE-31`.
[O] The damaging frame contains neither ED0 nor ED3; this is wrong-position overwriting, not ISSUE-022's erasure fault.

The first incorrect owned operation is the stale absolute paint, not tmux's cursor relocation or CPR arithmetic.
Changing only `TUI.#resolveResizeAnchor` would compensate for a cursor/content relationship that the writer already broke.
The implemented correction keeps ordinary multiplexer frames attached to the physical cursor during that notification gap.

## Reach-and-Impact

These impact observations describe the failing baseline, not the corrected source.

- [O] All 32 accepted `PREFACE-N` markers survive the shrink, but only 0–28 remain after the settled grow.
- [O] The missing markers are absent from `tmux capture-pane -p -S -`, not merely hidden outside the visible viewport.
- [O] Appending a later Assistant block does not restore them; their logical history was already accepted and is not automatically re-offered.
- [O] The first settled grow already produces two physical status strips while the frame provider requests one.
- [O] A subsequent contraction produces three strips because ISSUE-023 independently leaves another obsolete copy.
- [O] The no-resize control retains all markers and one status strip throughout the same subsequent operations.
- Measurement boundary: these are production Composer, CustomEditor, TranscriptContainer, AssistantMessageComponent, and ToolExecutionComponent instances in isolated tmux panes.
- Measurement boundary: content and incoming tool events are controlled fixture data; no provider or real file-edit execution is required.
- Measurement boundary: the loss is terminal presentation, not demonstrated deletion from persisted conversation files.
- Measurement boundary: original Termius/iOS input and render traffic was not recorded, so no exact historical device event sequence is claimed.

## Bug-Reproduction

Environment: Ubuntu 24.04 x64, tmux 3.4, Bun 1.4.2, preserve-mode Composer, box editor, 79 columns.
The runner creates a unique socket, never uses the user's server, records both viewport and full history, and kills only its own server in `finally`.

This is the historical failure oracle; the same scenario passes with the implemented correction.

1. Render a finalized 32-marker Assistant preface followed by a live 14-line expanded Edit preview and one empty editor/status box.
2. Wait until the 39-row pane has 44 native-history rows, a live window beginning at zero-based row 20, and the editor cursor at row 38.
3. Resize to 33 rows and wait for normal-buffer settle.
4. Verify history size 50, cursor row 32, and all 32 preface markers still present across history and grid.
5. Grow to 39 rows and wait for the tagged CPR and normal repaint.
6. Observe raw `CSI 33;18 R`, a first paint starting at one-based row 15, history size 44, and missing preface markers 29–31.
7. Continue with tool contraction and Assistant output to distinguish the subsequent independent erasure defect.

Actual: accepted text is overwritten and old editor chrome remains below the new editor.
Expected: all accepted markers remain reachable once, and the newly painted editor replaces its actual former physical region.

### Runnable diagnostic

- [Driver](evidence/issue-023/followup-driver.ts): production components, input/write/paint observers, and explicit diagnostic interventions.
- [Runner](evidence/issue-023/followup-runner.ts): finite tmux protocol, no-resize controls, stage captures, and cleanup.
- [Exact command trace](evidence/issue-023/followup/commands-history-probe-history-cpr.json): commands, times, socket, and stage summaries for the key comparison.
- [Buffer-boundary query trace](evidence/issue-023/followup/commands-history-cursor-observe.json): additional DSR queries around alternate-buffer entry and exit.

Run from the repository root with a fresh output directory:

```bash
AUDIT_TMUX_DEBUG=1 AUDIT_OUTPUT=/tmp/issue-024-fresh bun issues/evidence/issue-023/followup-runner.ts history-probe
```

Never overwrite the archived run to perform a new comparison.
The historical runs used separate invocations for `history-probe history-cpr` and `history-cursor-observe` in the repository-owned evidence directory.
Do not run `history-cpr` as corrected-runtime verification: it deliberately rewrites a reply and now over-adjusts it.

## Evidence

### Decisive server-side chronology

The full [tmux server log](evidence/issue-023/verified-fix/tmux-baseline-server.log.gz) is retained losslessly.
The [indexed chronology](evidence/issue-023/verified-fix/tmux-cursor-chronology.json) preserves the decisive original lines.

1. [O] Line 118402, `1790723048.975201`: tmux changes its native grid to 79×39.
2. [O] Line 118404: tmux moves the cursor from zero-based row 32 to 38, preserving global row 82.
3. [O] Lines 118888 and 119093: stale TUI output sends `CUP 30;1`, then `CUP 33;4`.
4. [O] Lines 120255 and 120460: another old-geometry frame repeats those absolute positions.
5. [O] Line 120535, `1790723049.067091`: tmux finally sends the new PTY size to the application.
6. [O] The later CPR reports row 33 because the intervening application output moved the cursor there.

[S] tmux 3.4 resizes the base screen before its queued PTY resize notification.
[S] Its cursor relocation retains the global content coordinate when history is pulled back into the grid.
Sources: https://github.com/tmux/tmux/blob/3.4/window.c and https://github.com/tmux/tmux/blob/3.4/screen.c

The [ordered baseline](evidence/issue-023/baseline-ordered-77adac/) reproduces the failure with a corrected title barrier.
Frames and barrier titles now share `ProcessTerminal`'s output pump rather than racing direct stdout writes.
This rules out the diagnostic title ordering as the cause of the accepted-row loss.

The corrected [raw runtime trace](evidence/issue-023/verified-fix/history-probe-resize.jsonl) receives `CSI 39;18 R`.
No CPR translation is active in that run.
All 32 accepted markers remain exactly once in its subsequent full-grid/history snapshots.

### Stage snapshots

Each snapshot retains `live`, `full`, `historySize`, extracted native `history`, and the actual TUI paint with logical draft and hardware cursor.

- [Before resize](evidence/issue-023/followup/history-probe-resize-initial.json): all accepted content and one box.
- [After shrink](evidence/issue-023/followup/history-probe-resize-shrunk.json): all accepted markers survive; history size is 50.
- [After grow](evidence/issue-023/followup/history-probe-resize-settled.json): markers 29–31 disappear and two status strips remain.
- [After another contraction](evidence/issue-023/followup/history-probe-resize-contract.json): three physical status strips, one requested strip.
- [After later history append](evidence/issue-023/followup/history-probe-resize-scroll.json): missing accepted markers do not return.
- [Unmodified raw events](evidence/issue-023/followup/history-probe-resize.jsonl): resize signals, raw CPR, delivered input, terminal writes, and completed paints.
- [Extra cursor queries](evidence/issue-023/followup/history-cursor-observe-resize.jsonl): row 33 is already reported before the grow's alternate-buffer entry.
- [Computed causal facts](evidence/issue-023/followup/causal-analysis.json): marker inventories, cursor replies, first CUP, and absence of ED0/ED3 in the damaging frame.

### Isolating counterfactual

[O] `history-cpr` changes only a grow-time tagged CPR delivered to TUI: `CSI 33;18 R` becomes `CSI 39;18 R` for this fixed-width six-row fixture.
The raw and delivered replies are separately logged; this is an explicit diagnostic intervention, not a production fix or a claim that tmux actually reported row 39.

- [O] The first normal paint then starts at one-based row 21 rather than 15.
- [O] All 32 accepted markers survive, and the first settled frame contains one status strip.
- [O] Later contraction still leaves two strips because the preservation flag and erasure suppression were not changed.
- [O] Subsequent history append retains all accepted preface markers in the intervention but only 0–28 in the unmodified run.

Evidence: [intervention raw events](evidence/issue-023/followup/history-cpr-resize.jsonl), [settled frame](evidence/issue-023/followup/history-cpr-resize-settled.json), [later contraction](evidence/issue-023/followup/history-cpr-resize-contract.json), and [later history](evidence/issue-023/followup/history-cpr-resize-scroll.json).

This separates two causal boundaries: correct anchoring prevents accepted-row overwrite, but it does not repair later mutable-row erasure.
A cleanup-only fix cannot substitute for anchor recovery.

### Historical resolver arithmetic

- [S] `packages/tui/src/tui.ts:1519-1522` saves the pre-resize live window and parked editor offset.
- [S] `:1533-1543` protects the retained grid and forgets the differential window inside a multiplexer.
- [S] `:1631-1637` tags the CPR by column and geometry epoch.
- [S] `:1675-1679` computes `reportedTop = reportedRow - reflowedOffset`.
- [S] `:1681-1702` trusts that top inside a multiplexer except for a narrow width-only reflow case.
- [S] `:1716-1724` applies the growth-based conservative pull bound only when no CPR is available.
- [S] `:2826-2828` and `:2925-2950` use the chosen top to place the normal frame.

For the reproduced grow: `reportedRow = 32`, `reflowedOffset = 18`, so `reportedTop = 14`.
The observed correct top is `20`; the discrepancy is exactly the six rows pulled back into the normal grid.
The width-only exception is inapplicable because width remains 79 and height changes.
The reply has the current column tag, arrives promptly, and is not a delayed reply from an earlier epoch.

## Prior-Art

Coverage: the current local index, related open records, current source owners, and their local upstream diff.

- [S] ISSUE-021 concerns a full-height width-reflow anchor and an extra scroll of an unfinished row; its width-only exception does not cover this height grow with an interior editor cursor.
- [S] ISSUE-022 concerns post-resize ED0 and Stop handoff removing accepted tail rows; this fixture loses accepted rows during active painting without either operation.
- [O] ISSUE-023's later erasure defect remains after the CPR-only intervention, proving that it is not interchangeable with this cause.
- [S] At the recorded `upstream/main` snapshot, the successful multiplexer-CPR branch also selects `Math.max(0, reportedTop)`; the fork's added exception concerns width-only reflow.
- Gap: no canonical-upstream runtime reproduction or fresh external issue/PR search was performed for this newly isolated height-grow condition.

No external publication target is selected.
Do not claim the source comparison is an upstream runtime reproduction.

## Proposed-Change

Status: Implemented and locally verified.

[S] The production change lives in the existing `TUI.#emitPlanFrame` owner in `packages/tui/src/tui.ts`.
Ordinary normal-buffer multiplexer paints use cursor-relative row movement while the parked-offset snapshot is valid.
Differential paints, forced full paints, history append, bounded cleanup, and cursor restoration share that movement policy.
A first frame after anchor recovery uses the measured absolute position before relative painting resumes.
This includes net-zero fullscreen resize bursts, where matching final dimensions alone do not restore snapshot validity.

The CPR resolver does not gain a guessed height delta, a tmux subprocess, or a parallel history-discovery mechanism.
The historical `+6` intervention remains useful causal evidence but is explicitly not the production algorithm.
Blind growth compensation is rejected because tmux already moves the cursor correctly before the stale application paint.
It would also be wrong when available history is smaller than the height increase.

ISSUE-023's bounded erasure removes later obsolete mutable rows without erasing unknown accepted tails.
Fullscreen epoch tracking rejects pre-overlay replies, and Stop bookkeeping follows the actual hidden-cursor position.
These lifecycle guards retain the existing `MOMP-SCROLLBACK` contract at its current upstream owners.

## Scope-and-Constraints

- Preserve native history and the existing ISSUE-021/022 protections; do not switch to `rebuild`, emit ED3, or clear pane history.
- Keep physical cursor movement, resize snapshots, recovery, and cleanup at their existing TUI owners.
- `MOMP-SCROLLBACK` remains `UPSTREAM-INTEGRIERT`; its active inventory now names the correction and proofs.
- Keep diagnostic CPR rewriting confined to the explicit `history-cpr` fixture scenario.
- Preserve raw events and both intervention/control traces; never describe intervention output as unmodified runtime behavior.
- Preserve the shared follow-up driver, runner, and captures as issue-owned historical evidence while local investigation is paused.

## Verification

[O] `history-tool` and `history-probe` independently reproduced first-settle duplication and accepted-marker loss on the unchanged runtime.
[O] `history-cursor-observe` reproduced the same outcome while showing that row detachment precedes alternate-buffer entry.
[O] `history-cpr` preserved the markers and removed the first-settle duplicate without changing the later erasure defect.
[O] Corresponding no-resize controls preserved all markers and a single editor/status strip.

[O] The permanent real-tmux Composer regression passes with zero, partial, and full available native history.
[O] It deliberately holds application resize notification while the real tmux grid changes.
[O] Actual typing, forced contraction, width/height rotation, burst resize, fullscreen return, append, and Stop all pass.
[O] Accepted markers remain exactly once across the full pane history and live grid, not merely in the newest frame.
[O] The final focused gate comprises 89 passing tests, zero failures, and 1,306 assertions across nine files.
[O] TUI and coding-agent type checks, scoped Oxlint fixes, and formatting completed successfully.

Final source hash and gate accounting: [final-verification.json](evidence/issue-023/verified-fix/final-verification.json).
The earlier 54-snapshot core capture has a separately recorded source hash and predates the final fullscreen guards.
The final real-tmux regression includes those guards.
Real Termius/iOS client rendering remains unmeasured.
[O] The exact attested `18.4.4-mikeei-2` package is published and globally installed.
[O] Candidate, publish-phase, and standalone smoke gates passed.
Release commits, artifact identity, and the permanent release-test gate are recorded in [ISSUE-023](ISSUE-023.md#deployment-verification).

## Publication-Blockers

- Upstream runtime behavior and external prior-art ownership remain unverified for this precise condition.
- Authorized-Work and Publication-Target remain unselected; no external publication is authorized.

## Next-Action

Summary: Await explicit investigation resumption
Action: Wait for an explicit user request to resume this finding; do not run diagnostics or require device follow-up while paused.
Done-When: The user explicitly resumes this finding and selects one bounded continuation.

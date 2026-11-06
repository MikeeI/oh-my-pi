# ISSUE-021 — tmux width resize duplicates an unfinished live row

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-09-29
Updated: 2026-09-29
Source: `upstream/main@d1932a6ff85613dde1160b87a73ddcdc3beb01f6`

## Root-Cause

[O] In a detached tmux pane, a preserve-mode width change copied the unfinished `MARK-024` row into native history before the final frame printed it again.
[O] The first post-resize CPR reported zero-based row 1 while the old live row started at zero-based row 0; the probe resolved `top=1` and the next 19-row paint scrolled the 19-row pane.
[S] Current upstream `TUI.#resolveResizeAnchor` treats a multiplexer CPR as the exact viewport top even after width reflow, and `#emitPlanFrame` starts painting at that anchor.
[S] See [anchor resolution](https://github.com/can1357/oh-my-pi/blob/d1932a6ff85613dde1160b87a73ddcdc3beb01f6/packages/tui/src/tui.ts#L1673-L1686) and [the frame writer](https://github.com/can1357/oh-my-pi/blob/d1932a6ff85613dde1160b87a73ddcdc3beb01f6/packages/tui/src/tui.ts#L2795-L2920).
[O] A focused TUI reproduction showed a 19-row repaint starting at physical row 2 before the correction and row 1 afterward.

## Reach-and-Impact

[O] `tmux capture-pane -p -S -` held `MARK-024` twice: one stale copy above `STABLE-PREFACE` and one in the final block; the older history, `FINAL-Q4`, and exit marker appeared once.
[O] A 31.062-second no-resize control with 120 distinct Assistant IDs and 110 acknowledged batches retained each marker once while tmux copy mode was entered at history sizes 0, 190, and 222.
[A] The control narrows the trigger to geometry and physical repaint in this fixture, but does not prove all non-resize paths safe.
[A] A real iPad SSH client and a persisted Main session were not measured; the observed loss of exact-once presentation is confined to the real tmux pane and raw TUI fixture.
[S] The affected `MOMP-SCROLLBACK` contract is `UPSTREAM-INTEGRIERT`: current upstream `packages/tui/src/tui.ts` owns accepted history, resize anchoring, and physical painting.

## Bug-Reproduction

Environment: [O] MOMP `personal@c9dd36e624fb35e4d2679ab304930aca40e10800`, Ubuntu 24.04 x64, tmux 3.4, detached isolated socket, 164×19 pane, `packages/coding-agent/test/fixtures/tmux-scrollback-driver.ts` with `PI_TUI_RESIZE_SCROLLBACK=preserve`, `PI_DEBUG_REDRAW=1`, and `PI_TUI_WRITE_LOG`.
Reproduction: [O] Start the fixture with a pre-existing history row; while `MARK-024` and `TRANSIENT-LIVE` are visible and `FINAL-Q4` is not, run `tmux resize-window -x 96 -y 19` and then `tmux resize-window -x 164 -y 19`; wait for normal fixture exit and capture the full pane with `tmux capture-pane -p -S -`.
Actual [O]: Before resize, `history_size=26`, pane 164×19, the live `MARK-024` occurs once, and the pane is alive; after exit, `history_size=54`, `MARK-024` occurs twice, and the final row and exit marker occur once.
Expected: Each accepted transcript row occurs once across tmux history and the visible grid, and pre-existing pane history remains intact.

## Evidence

- [O] First settled 96×19 probe: `cpr=1`, `park=0`, `stale=38`, `old=0`, `top=1`; the prior unfinished row occupied physical screen row 1 in one-based coordinates.
- [O] Recorded normal-buffer frame 6 begins `CSI 2;1H` and prints 19 rows into the 19-row pane.
- [O] Replaying the first six recorded frames into a disposable tmux pane left one `MARK-024` and history size 26 immediately after alternate-buffer exit, then two `MARK-024` copies and history size 27 immediately after frame 6 alone.
- [O] Continuing the recorded bytes through the original 164×19 geometry retained the duplicate; two positive captures had byte-equivalent first-six-frame sequences.
- [O] A comparison using scrollback `rebuild` erased the pre-existing `PREEXISTING-HISTORY` row; rebuild is not an equivalent preserve-mode workaround.
- [S] The existing [multiplexer-anchor regression](https://github.com/can1357/oh-my-pi/blob/d1932a6ff85613dde1160b87a73ddcdc3beb01f6/packages/tui/test/resize-multiplexer-anchor.test.ts) requires a legitimate parked offset of four rows on a 40→20 width shrink even when the estimated stale row count exceeds pane height.
[S] A blanket `height - staleRows` clamp would violate that offset contract; the implemented guard applies only to a full-height, top-anchored width shrink without an interior park offset.

## Prior-Art

- [S] [#7026](https://github.com/can1357/oh-my-pi/issues/7026) reports width-resize duplicates on the older relative-move mux path and cites a v18.2.1 width-epoch fix; the present repro is against the later CPR/`#emitPlanFrame` path, so recurrence versus a new subcase needs upstream triage.
- [S] [#8881](https://github.com/can1357/oh-my-pi/issues/8881) describes deliberate committed-prefix re-anchoring duplicates on an earlier renderer, not this first-post-CPR physical scroll.
- [S] Open [#13661](https://github.com/can1357/oh-my-pi/pull/13661) changes resize-burst handling and tmux replay, but its replay gate explicitly excludes `preserve`; its added tmux sync fixtures select `rebuild`.
- [S] [#9962](https://github.com/can1357/oh-my-pi/pull/9962) fixed the separate pre-resize erase that archived unfinished frames; it does not remove the measured post-settle full-height write.

## Proposed-Change

[S] MOMP now anchors a width-only shrink at row 0 only when a previously top-anchored full-height viewport overflows after reflow and the cursor had no interior park offset.
[S] Other CPR positions, legitimate parked offsets, and height-burst anchors retain the current upstream behavior; preserve mode still avoids ED3.

## Scope-and-Constraints

- [S] `MOMP-SCROLLBACK` is `UPSTREAM-INTEGRIERT`; a generic correction belongs in upstream `packages/tui/src/tui.ts`, not a parallel fork renderer.
- [O] The raw TUI and detached tmux pane establish a rendering failure without proving any duplicate model message or persisted conversation mutation.
- [A] Do not replace preserve with destructive rebuild or claim validation on a real iPad terminal without measuring those paths.
- [S] This record is local research only; `Authorized-Work` and `Publication-Target` remain unselected.

## Verification

[O] The unmodified fixture reproduced the duplicate in full-pane capture and the byte-for-byte stage replay localized its first appearance to normal-buffer frame 6.
[O] `bun test packages/tui/test/resize-multiplexer-anchor.test.ts -t 'does not scroll an old live row into tmux history'` failed with first CUP row 2 before the change and passed with row 1 afterward.
[O] The existing real-tmux fixture's 164→96→164 exact-once case passed, but it also passed before the correction; it is a guard against recurrence, not independent proof that this timing reproduces the earlier duplication.
[A] Confirm the previously recorded 164→96→164 byte sequence against this correction and assert one `MARK-024`, one `FINAL-Q4`, and preserved pre-existing history after exit.
[S] The focused existing parked-offset test protects a real interior offset from this top-anchored exception.

## Publication-Blockers

- [A] Reproduce the exact scenario on current canonical upstream rather than infer upstream runtime behavior solely from matching source ownership.
- [A] Check whether #7026 should own a recurrence report and whether #13661 changes the relevant preserve path before choosing an external target.
- [S] External publication requires a separately selected target, exact reviewed draft, and explicit user approval.

## Next-Action

Summary: Verify upstream width recurrence
Action: Reproduce the recorded width-CPR sequence against current canonical upstream and compare its first normal frame with the MOMP correction.
Done-When: The upstream disposition and the exact external target, if useful, are supported by a real tmux capture without broadening the local fork fix.

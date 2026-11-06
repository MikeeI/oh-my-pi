# ISSUE-022 — tmux height burst erases finalized transcript tail on Stop

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

[O] A fast 19→13→19-row tmux resize near Stop left previously visible `FINAL-Q1` through `FINAL-Q4` on the restored normal buffer until a subsequent TUI paint emitted `CSI 13;1H CSI J`.
[O] That erase removed the final rows; the following Stop history flush did not emit replacement rows despite the fixture's normal exit.
[S] Current upstream `TUI.#beginResizeAltPaint` empties `#providerWindow` while borrowing the alternate buffer, and `#emitPlanFrame` writes ED0 below the new viewport without requiring a prior mutable window there.
[S] See [resize borrow](https://github.com/can1357/oh-my-pi/blob/d1932a6ff85613dde1160b87a73ddcdc3beb01f6/packages/tui/src/tui.ts#L1518-L1536), [normal-frame erase](https://github.com/can1357/oh-my-pi/blob/d1932a6ff85613dde1160b87a73ddcdc3beb01f6/packages/tui/src/tui.ts#L2905-L2920), and [Stop flush](https://github.com/can1357/oh-my-pi/blob/d1932a6ff85613dde1160b87a73ddcdc3beb01f6/packages/tui/src/tui.ts#L1947-L1969).
[O] With ED0 limited to provably mutable rows, a delayed-Stop reproduction still lost `FINAL-Q2` when the exit marker overwrote it; the Stop handoff also treated the restored grid suffix as owned blank space.

## Reach-and-Impact

[O] The final `FINAL-Q1` through `FINAL-Q4` rows disappeared from both tmux's visible grid and full pane capture while earlier history and the process-exit marker remained.
[O] Other timing runs lost `FINAL-Q2` through `FINAL-Q4` and a wide row rather than all four final rows; resize timing affects which accepted rows the erase reaches.
[A] This proves terminal-presentation loss in a real tmux pane, not deletion from persisted conversation data or from a real iPad client's storage; neither path was measured.
[S] The active `MOMP-SCROLLBACK` contract is `UPSTREAM-INTEGRIERT`: current upstream `packages/tui/src/tui.ts` owns history acceptance, resize painting, and Stop handoff.

## Bug-Reproduction

Environment: [O] MOMP `personal@c9dd36e624fb35e4d2679ab304930aca40e10800`, Ubuntu 24.04 x64, tmux 3.4, detached isolated socket, 164×19 pane, `packages/coding-agent/test/fixtures/tmux-scrollback-driver.ts` with `PI_TUI_RESIZE_SCROLLBACK=preserve` and `PI_TUI_WRITE_LOG`.
Reproduction: [O] Start the raw TUI fixture with pre-existing history; when the transient/final tail is visible and Stop is approaching, run `tmux resize-window -x 164 -y 13` immediately followed by `tmux resize-window -x 164 -y 19`; await normal exit and inspect `tmux capture-pane -p -S -` plus the recorded terminal frames.
Actual [O]: In the targeted run, the pane held `FINAL-Q1` through `FINAL-Q4` before resize, all four were still present after the alternate-buffer exit, and all four were absent after the next normal paint and Stop; `PREEXISTING-HISTORY`, `MARK-000` through `MARK-035`, and the exit marker remained once.
Expected: Accepted final rows remain reachable in native tmux history or the visible grid after any resize burst and normal Stop; obsolete mutable rows may still be erased safely.

## Evidence

- [O] Before resizing: `history_size=52`, pane alive, alternate buffer off, and `FINAL-Q1` through `FINAL-Q4` visible.
- [O] During 164×13 shrink and 164×19 regrow: the alternate buffer was active; at regrow `history_size=58` and full-pane capture still contained all final rows.
- [O] A stagewise replay of recorded terminal bytes retained the final rows after `CSI ?1049l`, so the alternate-buffer exit alone did not cause the observed loss.
- [O] The next normal write included `CSI ?25l CSI ?7l CSI 13;1H CSI 13;1H CSI J`; the final-row markers were absent immediately afterward.
- [O] After Stop: pane dead, alternate buffer off, `history_size=52`; earlier markers and the exit marker remained, but the four final rows and the wide row's beginning were missing.
- [S] `#flushHistoryBeforeStop` exits when the frame provider has no pending history batch; it does not replay an already accepted tail after this physical erase.
- [A] Merely suppressing all ED0 operations is not a proven fix: an old mutable region can still require erasure, and the correct new viewport anchor has not been established.

## Prior-Art

- [S] Open [#13661](https://github.com/can1357/oh-my-pi/pull/13661) explicitly tracks height-burst damage and adds rebuild-mode tmux synchronized replay; its `#prepareResizeReplay` gate explicitly skips `preserve`, and its tmux fixture selects `rebuild`.
- [S] [#12735](https://github.com/can1357/oh-my-pi/issues/12735) describes temporary live-tail clipping by an inline panel that returns after dismissal; here accepted rows were physically erased after resize and did not return on Stop.
- [S] [#9780](https://github.com/can1357/oh-my-pi/issues/9780) describes partial streaming-row commitment at fixed geometry, not ED0 after a height burst.
- [S] [#9962](https://github.com/can1357/oh-my-pi/pull/9962) fixes pre-resize erasure before alternate-buffer entry; the recorded destructive write here occurred after the exit.

## Proposed-Change

[S] MOMP retains the unowned tmux normal-grid suffix across preserve-mode paints, skips broad erases there, and hands the shell control below its physical tail.
[S] The existing history-batch acknowledgement and destructive reset paths remain unchanged; no ED3 is introduced on a preserve-mode resize.
[O] Subsequent continued-interaction testing found that this preservation fix leaves duplicate editor/status rows when the mutable viewport contracts after resize.
[S] [ISSUE-023](ISSUE-023.md) owns that distinct fork regression and the bounded-erasure proposal; its correction must preserve this issue's accepted-tail and Stop protections.

## Scope-and-Constraints

- [S] `MOMP-SCROLLBACK` is `UPSTREAM-INTEGRIERT`; a generic correction belongs in current upstream `packages/tui/src/tui.ts` and must preserve pre-existing pane history.
- [O] The raw TUI fixture and actual tmux pane establish physical tail erasure without a model call, but do not reproduce the user's full SSH/iPad client.
- [A] The failure is distinct from ISSUE-021's duplicate caused by a width-reflow CPR anchor: here the first observed destructive operation is ED0 after height-only resize.
- [S] This record is local research only; `Authorized-Work` and `Publication-Target` remain unselected.

## Verification

[O] The unmodified height-burst fixture reproduced loss across independent timings, and stagewise terminal-byte replay isolated the first loss to the post-exit normal paint.
[O] The first real-tmux regression failed before the fix with missing final rows; after the ED0 guard alone, `FINAL-Q2` was still overwritten by the shell exit marker.
[O] After retaining unowned-grid state through a scrolled repaint and adjusting Stop handoff, both a held-finalized 19→13→19 burst and a Stop-overlapping burst retained every `FINAL-Q` and `MARK` once with `PREEXISTING-HISTORY`.
[O] `bun test packages/coding-agent/test/tmux-scrollback-exactness.test.ts -t 'keeps finalized rows through a tmux height shrink and regrow before Stop'` and the `Stop overlaps` case pass on the MOMP checkout.
[A] Reproduce the recorded byte sequence on canonical upstream before proposing an upstream publication target; a real iPad SSH client remains unmeasured.

## Publication-Blockers

- [A] Reproduce the exact preserve-mode scenario on current canonical upstream rather than treating matching source branches as runtime proof.
- [A] Reassess #13661 at its current head and determine whether its height-burst report should own the external discussion, despite its rebuild-only implementation.
- [S] External publication requires a separately selected target, exact reviewed draft, and explicit user approval.

## Next-Action

Summary: Verify upstream height recurrence
Action: Reproduce the exact preserve-mode height burst and Stop handoff on canonical upstream, then classify overlap with #13661.
Done-When: Upstream runtime evidence separates ED0 loss from Stop cursor overwrite and establishes whether an external report is useful.

# ISSUE-040 — TUI: a running tool card taller than its viewport allocation collapses to a 2-row stub over blank rows

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: UI
Created: 2026-11-27
Updated: 2026-11-27
Source: `upstream/main@b8b13c3eb3`

## Root-Cause

Root-Cause [S]: `paintAllocated` in `packages/coding-agent/src/ui/styles/tools/block.ts` returns exactly two rows (`╭─ <label>` / `╰`) for every allocation of 2+ rows that is smaller than the look's natural height.
`TermBackend.#compose` in `packages/tui/src/term/backend.ts` pushes only the rows the painter returns, so the rest of the allocation stays empty.
The viewport pin then pads those rows with blanks to keep the dock at the bottom.
Active (running) blocks never retire into history, so the stub persists until the block fits again or settles.

## Reach-and-Impact

Reach [S]: Every running tool card, because `paintToolBlock` routes any painted height to `paintAllocated` before a look paints (`block.ts:131`).
Trigger [S]: The card's natural height plus one row per other active block exceeds screen rows minus dock rows.
Reach [O]: Task card, 14-row screen, 3-row dock, one other active block: 7 body rows show whole and 8 collapse to the stub plus 8 blank rows.
Impact [O]: Without hysteresis, one row of growth or shrink flips between the full card and the stub, which the user sees as jumping.
Impact [O]: User report on `momp/19.2.1-mikeei-1` over Termius/tmux on iOS: `• Todo`, `╭─ Task · running`, `╰`, then about 10 blank rows above the dock.
Impact [O]: Eval cards hit the same route; with #20642 applied, a running eval cell keeps its `╭─── 🐍 ⣾ running <title>` edge over its newest rows (see Evidence).
Impact [S]: No transcript loss; the settled block is written whole to history.
Frequency [A]: Highest on small mobile panes (keyboard, landscape, tmux status bar); not measured.

## Evidence

- [S] `packages/coding-agent/src/ui/styles/tools/block.ts:97-111` (`paintAllocated`) at `upstream/main@b8b13c3eb3`: an own look taller than `rows` yields the 1-row status line or the 2-row frame edge.
- [S] `packages/tui/src/term/backend.ts:939` at `upstream/main@b8b13c3eb3`: the backend paints an under-allocated block at that height and keeps every returned row; fewer rows leave the allocation unfilled.
- [S] `packages/tui/src/term/backend.ts:962-976` at `upstream/main@b8b13c3eb3`: once at the screen bottom, the viewport is padded with `""` up to its held height.
- [S] `packages/tui/src/term/backend.ts:617` (`#allocate`): every active block keeps at least one row and the newest takes the surplus; only settled blocks retire.
- [S] `docs/tui-core-renderer.md:152` at `upstream/main@b8b13c3eb3` says an under-allocated block "is painted at that height"; tool looks return 2 rows instead.
- [S] History: introduced by `7784896434` (2026-11-24, `feat(tui)!: rebuilt the terminal ui as a reactive pi-tui`); contained in `v19.2.0` and `v19.2.1`.
- [O] [repro-allocation.ts](evidence/issue-040/repro-allocation.ts) output on 2026-11-27: `paint h=14 -> 2 rows`, `h=13 -> 2`, `h=9 -> 2`, `h=2 -> 2`, `h=1 -> 1` for a 15-row card.
- [O] The same script's backend frames: body rows 7 → full card, 8 and 9 → `⣽ Todo 0s`, `╭─ Task 0s`, `╰`, 8 blank rows, dock; 9 → 7 → 9 flips between the two.
- [O] An in-memory candidate painter (compact head plus newest rows for heights > 2) filled the allocation without blank rows on the same scenario; not a recorded patch.
- [O] #20642 head `6d18ffc0db` applied to `personal` as `MOMP-TOOL-ALLOCATION` (2026-11-27): the same script paints `h=14 -> 14`, `h=13 -> 13`, `h=9 -> 9`, `h=2 -> 2`, `h=1 -> 1`; frames for body rows 8 and 9 show the heading over the newest rows and no blank rows before the dock.
- [O] Eval variant (`ToolBlock` with a 12-line running cell and 40 output lines): `h=9` and `h=4` keep the cell's titled edge, newest output rows, closing edge, and agent row.
- [O] Eval output phase without `details.cells` keeps its first non-blank row (`… (31 earlier lines …)`); that look draws no title at full height either, so nothing is lost.
- [O] `bun test packages/coding-agent/test/tools/tool-block-allocation.test.ts packages/tui/test/term/elastic-slots.test.tsx packages/coding-agent/test/subagent-hud-render.test.ts` → 93 pass, 0 fail; `check` in `packages/coding-agent` and `packages/tui` passes.

## Bug-Reproduction

Environment: `personal@e93214e9d4` (includes `7784896434`; `paintAllocated` matches `upstream/main@b8b13c3eb3`), Bun 1.4.5, Linux 6.8.0-107-generic; headless `TermBackend` with a frame-recording fake driver, no terminal emulator.
Reproduction: `bun issues/evidence/issue-040/repro-allocation.ts` from the repository root.
Actual [O]: A running Task card one row taller than its allocation paints `╭─ Task 0s` / `╰` and leaves the other allocated rows blank; one row less restores the full card.
Expected: Under `docs/tui-core-renderer.md` §2.1, a card given N >= 3 rows fills those N rows with its identifying head and newest rows; it never leaves rows blank below a stub.

## Prior-Art

Coverage: upstream issues searched for `blank lines running tool collapses viewport`, `empty lines tui`, `running tool card collapses`, `jumping OR flicker OR collapsed eval task` (created since 2026-11-20); PRs for `paintAllocated OR "compact" tool viewport allocation`; checked=2026-11-27.
Gaps: Discord not searched.

- [#20642](https://github.com/can1357/oh-my-pi/pull/20642) — Open PR by @Petyok, head `6d18ffc0db`, `MERGEABLE`, `UNSTABLE`, labels `review:p1`, `triaged`, no review decision. It owns this exact root cause ("2-row stub (`╭─ Task · running` / `╰`)", "remaining rows of that allocation stayed empty", seen on 19.2.1).
  Its fix: `headAndTail` keeps a look's heading (new `Block.heading`, else through the first non-blank row) over the newest rows for 3+ row allocations, with atomic image/OSC 66 handling and hit remapping, plus `test/tools/tool-block-allocation.test.ts`.
  Its declared remaining gaps: wrapped LSP headers and orphaned OSC 66 spacer rows are out of scope.
- [#20264](https://github.com/can1357/oh-my-pi/issues/20264) — Parked background task card re-commits rows to scrollback (`wontfix`); different lifecycle, not this allocation path.
- Archived ISSUE-021..024 — tmux resize integrity; different root cause.

Contribution fit: #20642 owns the correction; a separate PR or issue would duplicate it.
An Existing-pull-request-comment fits only if verification finds a case its head does not fix; the Task and eval checks found none.

## Proposed-Change

None beyond #20642.
MOMP carries its head without the changelog entry as `MOMP-TOOL-ALLOCATION` until a released base contains it.

## Scope-and-Constraints

- Preserve: the 1-row and 2-row compact fallbacks, newest-first allocation, the bottom pin, and whole-block history on settle.
- Exclude: dock-size reduction, `display.pinnedAgents` tuning, and allocation hysteresis; separate concerns.
- MOMP: `MOMP-TOOL-ALLOCATION` in `CONTRACTS.md` owns the interim fork delta and its removal condition.

## Verification

- `bun test packages/coding-agent/test/tools/tool-block-allocation.test.ts` → pass.
- `bun issues/evidence/issue-040/repro-allocation.ts`: every allocation of 3 to 14 rows paints exactly that many rows; frames for body rows 8 and 9 show no blank rows between card and dock.
- Installed TUI inside tmux on Termius/iOS: a long-running Task or Eval no longer shows the stub over blank rows.

## Publication-Blockers

- Authorized-Work and Publication-Target are not selected.
- No verified case that #20642's head leaves unfixed; without one, there is nothing to publish.

## Next-Action

Summary: Await PR 20642 merge
Action: Check #20642 at each MOMP upgrade; when a selected base contains it, remove `MOMP-TOOL-ALLOCATION` and archive this record as Fixed-Elsewhere.
Done-When: A released upstream base contains #20642's fix and the fork closure is removed.

# ISSUE-023 — tmux: preserve resize leaves duplicate editor and status rows

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: UI
Created: 2026-09-29
Updated: 2026-09-30
Source: `upstream/main@8ac1309bd8adaddc891eeb389c545345073875be`

The Source field identifies the local upstream comparison baseline, not an observed upstream failure.
The reproduced source is MOMP `personal@45192b35f9f57ddf59f49415292aaf06c2580853`, released as `18.4.3-mikeei-2`.
[O] The currently installed version was rechecked after the screenshot report: `momp --version` returned `momp/18.4.3-mikeei-2`.
The user explicitly identifies the saved screenshot as a failure in that currently used version, not an older release.
This version attribution is fixed to the 2026-09-29 report; it must not be read as a claim about whichever release is latest later.

## Resume-Here

Both demonstrated causes and their resize lifecycle corrections are deployed in `18.4.4-mikeei-2`.
This record owns mutable-row erasure; [ISSUE-024](ISSUE-024.md) owns stale absolute paints before SIGWINCH.
The original bounded-erasure proposal is retained below as historical design evidence, not current instructions.
Do not restart generic tmux diagnosis or substitute transcript-only tests for the retained real-terminal proofs.
The complete retained terminal evidence is repository-owned under [evidence/issue-023/](evidence/issue-023/).
The diagnostic driver and execution protocol are included below, so neither `/tmp` nor the previous conversation is required to reconstruct the experiment.
All three iPhone/Termius screenshots are archived, linked, and interpreted below.
The follow-up includes actual terminal input during production Edit-preview updates, authoritative paint plans, and separate live-grid/native-history captures.
The user subsequently authorized robust local source implementation, which is now completed and verified.
The follow-up request explicitly authorizes source commits, publication, global installation, and deployment smoke.
Deployment completed through `project-momp-upgrader`; canonical-upstream publication remains unauthorized.
`Authorized-Work: Not-Selected` remains the status of the separate upstream contribution workflow.

## Root-Cause

The following describes the reproduced failing baseline; the implemented correction is recorded separately below.

[S] Fork commit `c98294b54d3b8b7c11668dc33b1c2cfc01b31794` adds `TUI.#preservedResizeGridTail` to protect accepted normal-buffer rows after a preserve-mode tmux resize.
[S] The flag suppresses trailing erasure in both differential and full paints until a destructive reset, even after later paints establish a known mutable window.
[O] When that window contracts, the new editor/status box is painted above its previous position without removing the old box.
[O] Two contractions after one keyboard-style height cycle leave three visible boxes; an otherwise identical no-resize control leaves one.
[O] Follow-up runs reproduce repeated draft text, empty-editor border fragments, and old Edit-preview rows below newer Assistant output using production components.
[O] A separate first-settle duplicate and accepted-row overwrite occurs before any contraction when a height grow misanchors the viewport; ISSUE-024 owns that cause.

### Original protection and regression mechanism

1. [S] ISSUE-022 established that tmux can retain accepted transcript rows below the newly painted viewport after a height burst.
2. [S] `#beginResizeAltPaint` therefore sets the preservation flag and empties the previous mutable-window cache.
3. [S] The next settled normal-buffer paint avoids broad ED0, preventing the previously observed accepted-tail loss.
4. [S] Each subsequent normal paint records fresh `#providerWindow` rows and `#providerViewportTop`.
5. [S] The preservation flag nevertheless remains true and blocks clearing even those newly known mutable rows.
6. [O] A shorter later frame paints its editor higher without clearing the old editor below it.
7. [O] Repeating the contraction accumulates stale copies without any additional resize.
8. [S] Only a destructive reset clears the flag; normal repaint, continuation, and a full-height paint do not.

The defect is not that the renderer lacks the new editor text.
It writes the correct new text and position but fails to erase superseded physical rows.
The incorrect invariant is that all space below every later frame remains equally unknown after any preserve-mode resize.
The correct distinction is between an unknown retained tail and rows the renderer has subsequently painted and still owns as mutable content.

### What the reproduction rules out

- [O] The reproduction makes no provider call, so it does not require repeated model output.
- [O] The fixed text `CURRENT-INPUT` exists in one editor instance, not three logical editors.
- [O] The control performs the same contractions without resize and leaves one box.
- [O] The failure occurs after normal-buffer settle, not only while the resize alternate buffer is visible.
- [O] Captured terminal bytes omit the needed erasure, so the observed leftover rows are not merely an outer-client screenshot artifact.
- [A] These observations do not exclude additional independent Termius, tmux, or renderer defects.

## Reach-and-Impact

[O] The failure occurs in real tmux with the production `Composer`, `CustomEditor`, and `box` style, without a model or provider call.
[O] A separate multiline-editor reproduction retained obsolete draft lines after contraction.
[O] A raw TUI reproduction retained stale rows even after an intervening full-height paint.

### User report and relevant environment

The user runs MOMP through Termius and tmux on iPads and iPhones.
Rotation changes width and height, while showing or hiding the software keyboard changes available height.
These are normal interactions, not unusual stress conditions.
The user explicitly reports doubled and tripled input rows and the status header containing `GPT-6-Astra`, `high`, the project folder, branch, and context usage in this version.
The diagnostic's `STATUS-HEADER` and `CURRENT-INPUT` are controlled substitutes for that displayed content, not captured private user input.

[O] The installed command reported `momp/18.4.3-mikeei-2`.
[O] The active configuration selected `tui.resizeScrollback: preserve` and `composer.shape: box`.
[O] The two inspected fork-session processes started after the installed CLI artifact's modification time.
[O] Their relevant environment identified tmux through `TMUX`, `TERM=tmux-256color`, and `TERM_PROGRAM=tmux`, with no observed `PI_TUI_*` override.
This investigation therefore did not explain the report away as an old process or an accidental `rebuild` setting.

### Observed impact and unmeasured boundaries

- [O] Obsolete input text remains visible after the logical draft has shortened.
- [O] The editor and its attached status header can appear two or three times after ordinary subsequent layout contraction.
- [S] Any shrinking mutable viewport can encounter the suppression; the defect is not specific to the literal model name.
- Measurement boundary: the original live prefix was synthetic; the follow-up uses production tool, transcript, and Assistant components with controlled content and event delivery.
- Measurement boundary: the complete agent session and a real Termius/iOS client were not instrumented.
- Measurement boundary: no observed result establishes duplicate logical messages, repeated submission, or persisted conversation corruption.
- Measurement boundary: no frequency estimate across real user sessions was measured.

### Additional user observation: typing during tool activity

The user subsequently reported copies and glitches in the input field while typing as the agent wrote or edited a file.
This report occurred during this investigation, not in a separate hypothetical workflow.
The supplied screenshot shows the active `Edit: issues/ISSUE-023.md` preview, the current TODO display, an open iOS software keyboard, and an in-progress draft.
[O] Its closing draft line is visibly repeated below the active input area's lower edge, next to an additional lower-border fragment.
[O] The screenshot shows one visible model/status header, not the three complete headers of the controlled tmux fixture.

Evidence boundary: a still image proves the visible duplicate and the displayed context, but not the sequence of paints that produced it.
The screenshot does not establish whether the logical editor buffer contains a duplicate, whether a resize occurred immediately beforehand, or whether a keystroke was delivered twice.
The image must not be used to claim a measured race between disk I/O and input handling.

[O] The follow-up interleaves 20 real tmux input chunks with 20 production Edit-preview updates after a settled resize.
[O] The logical draft matches the sent text exactly once, while the physical grid shows two copies; a real Ctrl+U empties the draft but leaves obsolete text visible.
[O] The identical no-resize control has one visible draft and clears it correctly.
These observations establish a rendering fault for the reproduced concurrent-input symptom, not a duplicated input event or a disk-I/O race.
The original device images still lack a synchronized event trace, so their exact historical timing is not retroactively claimed.

## Bug-Reproduction

Environment: [O] Ubuntu 24.04 x64, tmux 3.4, Bun 1.4.2, MOMP source revision above, isolated detached tmux socket, `resizeScrollback: preserve`, `composerShape: box`, initial pane 79×39.

### Minimal causal sequence

1. Instantiate the production `Composer` with `ProcessTerminal`, quiet startup, and no welcome animation.
2. Mount a component rendering six `LIVE-ROW-N` rows before `composer.editor` through `setRuntimeChildren`.
3. Use `editor.setTopBorderProvider` to render `STATUS-HEADER` and `editor.setText("CURRENT-INPUT")`.
4. Run `tmux resize-window -x 79 -y 22` and await a normal-buffer paint at 79×22.
5. Resize to 79×39 and await a normal-buffer paint at 79×39.
6. Reduce the live component from six rows to three and request a render.
7. Observe two editor/status boxes, then reduce the live component to zero and render again.
8. Capture the pane; repeat the two contractions in a separate identical pane without resizing.

Actual [O]: The resized pane contains `STATUS-HEADER` on rows 1, 4, and 7, each followed by `CURRENT-INPUT`; the control contains only the first box.
Expected: Exactly one current editor/status box remains, and obsolete mutable rows disappear without erasing accepted transcript history.

The shrinking prefix models a changing live viewport; it is not a claim that a particular agent component emitted those fixture rows.
The pixel/terminal-row writer and editor/status chrome are the real production owners.
Both resize steps settled before the contractions, so this particular failure does not require a timing race.

### Complete Composer diagnostic driver

This is the final diagnostic source used for the double/triple-box experiment, retained from the investigation's file writes and edits.
It is not an applied runtime fix or a permanent regression test.
The absolute imports identify the investigated checkout; adjust that prefix if reproducing elsewhere.
`AUDIT_CHROME=1` selects the exact reported-symptom experiment.
Without it, the driver starts a multiline draft and `s` shortens that draft.
The earlier multiline control used the default `band` style without the diagnostic header; the final version below uses the user's `box` style.
The driver exits after 120 seconds if not stopped explicitly.

```typescript
import * as fs from 'node:fs';
import { Composer } from '/root/projects/project-oh-my-pi-fork/packages/tui/src/prompt/composer.ts';
import { ProcessTerminal } from '/root/projects/project-oh-my-pi-fork/packages/tui/src/terminal.ts';
import { setTerminalHeadless } from '/root/projects/project-oh-my-pi-fork/packages/utils/src/env.ts';

setTerminalHeadless(false);
const log = process.env.AUDIT_LOG!;
class LoggedTerminal extends ProcessTerminal {
  override write(data:string):void {
    fs.appendFileSync(log, JSON.stringify({t:Date.now(),width:this.columns,height:this.rows,data})+'\n');
    super.write(data);
  }
}
let stage='draft';
let paintCount=0;
const chromeMode=process.env.AUDIT_CHROME==='1';
let prefixRows=chromeMode?6:0;
const composer=new Composer({
  terminal:new LoggedTerminal(),
  preferences:{quiet:true,resizeScrollback:'preserve',composerShape:'box',spellingTypoDetection:false,spellingAutocomplete:'off'},
  tuiOptions:{onPaint(paint){process.stdout.write(`\x1b]2;COMPOSER-${stage}-${paint.columns}x${paint.rows}-${paint.alt?'alt':'normal'}-${++paintCount}\x07`);}}
});
composer.setRuntimeChildren([{render:()=>Array.from({length:prefixRows},(_,i)=>`LIVE-ROW-${i}`)},composer.editor],{transient:[composer.editor]});
composer.editor.setTopBorderProvider(()=>({content:'STATUS-HEADER',width:13}));
composer.editor.setText(chromeMode?'CURRENT-INPUT':Array.from({length:8},(_,i)=>`DRAFT-LINE-${i}`).join('\n'));
composer.ui.addInputListener(data=>{
  if (data==='s') {stage='short';if(chromeMode)prefixRows=Math.max(0,prefixRows-3);else composer.editor.setText('SHORT-DRAFT');composer.ui.requestRender();return {consume:true};}
  if (data==='l') {stage='wide';composer.editor.setText('WIDTH-CURSOR-'+ 'x'.repeat(48)+'-END');composer.ui.requestRender();return {consume:true};}
  if (data==='q') {composer.stop();process.exit(0);}
  return undefined;
});
composer.start({playWelcomeIntro:false});
setTimeout(()=>{composer.stop();process.exit(2);},120000).unref();
```

### Isolated execution protocol

Save the driver outside the source tree and provide a fresh writable `AUDIT_LOG` for each pane.
Use a unique tmux socket; never run the following resize or cleanup against the user's default server.
The original investigation used socket `momp-audit-K15Q5J` and `/tmp/momp-resize-audit-K15Q5J/`; both are historical identifiers, not a live reproduction environment.
The commands below show equivalent dedicated names.

```bash
tmux -L issue-023-repro -f /dev/null new-session -d -x 79 -y 39 -s chrome \
  'AUDIT_CHROME=1 AUDIT_LOG=/tmp/issue-023/chrome.jsonl bun /tmp/issue-023/composer-driver.ts'
tmux -L issue-023-repro set-option -g remain-on-exit on
tmux -L issue-023-repro new-session -d -x 79 -y 39 -s control \
  'AUDIT_CHROME=1 AUDIT_LOG=/tmp/issue-023/control.jsonl bun /tmp/issue-023/composer-driver.ts'
tmux -L issue-023-repro display-message -p -t chrome '#{pane_title}'
tmux -L issue-023-repro resize-window -t chrome -x 79 -y 22
tmux -L issue-023-repro display-message -p -t chrome '#{pane_title}'
tmux -L issue-023-repro resize-window -t chrome -x 79 -y 39
tmux -L issue-023-repro display-message -p -t chrome '#{pane_title}'
tmux -L issue-023-repro send-keys -t chrome -l s
tmux -L issue-023-repro send-keys -t control -l s
tmux -L issue-023-repro capture-pane -p -t chrome
tmux -L issue-023-repro send-keys -t chrome -l s
tmux -L issue-023-repro send-keys -t control -l s
tmux -L issue-023-repro capture-pane -p -t chrome
tmux -L issue-023-repro capture-pane -p -t control
```

These are staged commands, not an unsynchronized paste-and-run batch.
Before the next geometry change, wait until the title reports `COMPOSER-draft-79x22-normal-` or `COMPOSER-draft-79x39-normal-`, respectively.
Before each next contraction or capture, wait for the normal paint count to advance.
Poll with a finite timeout and fail on pane death; do not silently continue if the expected paint never appears.
After saving evidence, send `q` to both diagnostic panes and stop only the dedicated `issue-023-repro` server.

### Exact observed terminal layout

The nonblank rows of the failing capture were:

```text
╭──STATUS-HEADER──────────────────────────────────────────────────────────────╮
╰─ CURRENT-INPUT                                                             ─╯
LIVE-ROW-2
╭──STATUS-HEADER──────────────────────────────────────────────────────────────╮
╰─ CURRENT-INPUT                                                             ─╯
LIVE-ROW-5
╭──STATUS-HEADER──────────────────────────────────────────────────────────────╮
╰─ CURRENT-INPUT                                                             ─╯
```

The control's only nonblank rows were:

```text
╭──STATUS-HEADER──────────────────────────────────────────────────────────────╮
╰─ CURRENT-INPUT                                                             ─╯
```

## Evidence

### Source ownership at the reproduced fork revision

- [S] `packages/tui/src/tui.ts:711-714` defines the preservation flag and its intended accepted-history protection.
- [S] `packages/tui/src/tui.ts:1533-1543` sets the flag and discards the old mutable-window snapshot during a multiplexer resize.
- [S] `packages/tui/src/tui.ts:1665-1749` resolves the post-resize anchor; it is separate from stale-row erasure.
- [S] `packages/tui/src/tui.ts:2062-2066` protects Stop handoff by moving the shell below the retained physical pane.
- [S] `packages/tui/src/tui.ts:2785-2786` identifies new versus already accepted history offers.
- [S] `packages/tui/src/tui.ts:2826-2828` computes geometry stability and old/new physical viewport tops.
- [S] `packages/tui/src/tui.ts:2866-2872` decides whether the normal frame can use differential row writes.
- [S] `packages/tui/src/tui.ts:2896-2898` and `:2951-2956` suppress trailing ED0 while the preservation flag is set.
- [S] `packages/tui/src/tui.ts:2900-2909` separately suppresses pre-scroll erasure; this proposal must not casually re-enable that operation.
- [S] `packages/tui/src/tui.ts:2978-2981` clears the flag only after a destructive reset.
- [S] `packages/tui/src/tui.ts:2995-3004` nevertheless records each subsequently painted mutable window and its physical top.
- [S] `packages/tui/src/tui.ts:3011-3026` accepts history before notifying paint observers; a correction must preserve that reentrancy order.
- [S] `packages/tui/src/prompt/composer.ts:332-415` computes the bounded mutable viewport, including content before and after the transcript.
- [S] `packages/tui/src/status-line/component.ts:3049-3067` attaches status content to editor chrome; stale editor rows duplicate the status display too.

Line anchors refer to the recorded fork revision, not a promise that future rebases preserve line numbers.
Use the named symbols when navigating a later source tree.

### Retained raw evidence

The initial fourteen diagnostic capture files and all three user screenshots are preserved under [evidence/issue-023/](evidence/issue-023/).
The separate [follow-up archive](evidence/issue-023/followup/) retains the new input, paint, history, and CPR experiments.
The fourteen diagnostic files were copied from `/tmp/momp-resize-audit-K15Q5J/` and verified byte-identical with `diff -qr`.
The repository copies, not the temporary directory, are the evidence owner.

- [chrome-after.txt](evidence/issue-023/chrome-after.txt): complete 39-row failing capture with three editor/status boxes.
- [chrome-control.txt](evidence/issue-023/chrome-control.txt): complete 39-row control capture with one box.
- [chrome.jsonl](evidence/issue-023/chrome.jsonl): timestamped outgoing TUI writes for the exact double/triple-box reproduction.
- [chrome-control.jsonl](evidence/issue-023/chrome-control.jsonl): outgoing writes for the no-resize control.
- [composer-resize.jsonl](evidence/issue-023/composer-resize.jsonl): real multiline-editor contraction after 79×39 → 79×22 → 79×39.
- [composer-control.jsonl](evidence/issue-023/composer-control.jsonl): corresponding contraction without resize.
- [resized.jsonl](evidence/issue-023/resized.jsonl): raw TUI contraction and full-height-repaint persistence experiment.
- [control.jsonl](evidence/issue-023/control.jsonl): raw TUI no-resize contraction control.
- [cursor.jsonl](evidence/issue-023/cursor.jsonl): real-editor width-shrink experiment with a nonzero cursor column.
- [overlay.jsonl](evidence/issue-023/overlay.jsonl): fullscreen-overlay 80×19 → 80×13 → 80×19 round trip.
- [covered.jsonl](evidence/issue-023/covered.jsonl): fullscreen-overlay height grow from 80×19 to 80×25.
- [transcript-writes.log](evidence/issue-023/transcript-writes.log): original Assistant fixture through 79×39 → 164×19 → 79×39 and finalization.
- [continuation-writes.log](evidence/issue-023/continuation-writes.log): finalized transcript through a 164×19 → 164×13 → 164×19 burst and a subsequent Assistant block.
- [keyboard-writes.log](evidence/issue-023/keyboard-writes.log): analogous 79×39 → 79×22 → 79×39 burst and continuation.
- [user-typing-during-edit.jpg](evidence/issue-023/user-typing-during-edit.jpg): the user's original device screenshot showing repeated draft text during an Edit preview.
- [user-editor-overlap-235236.png](evidence/issue-023/user-editor-overlap-235236.png): the second device screenshot showing apparently empty editor chrome, overlapping border fragments, and transcript/TODO content below the visible editor/status region.
- [user-tool-preview-overlap-235440.png](evidence/issue-023/user-tool-preview-overlap-235440.png): the third device screenshot showing Edit-preview text and stacked border/background fragments below an apparently empty input/status region while newer Assistant text is visible above.

JSONL records contain `t` as epoch milliseconds, `width`, `height`, and escaped outgoing `data`.
The three `.log` files are raw terminal-write streams produced by `PI_TUI_WRITE_LOG`, not JSONL.
Captured stdout titles and incoming CPR replies are not a complete part of these outgoing-write logs.
Do not `cat` raw `.log` files into an interactive terminal; decode them as data so their escape sequences cannot affect the inspecting terminal.
Only the two final chrome captures were retained as standalone pane-text files.
Other visible outcomes below were observed through native `tmux capture-pane` during the investigation; their outgoing logs remain available.

### Decisive byte-level comparison

[O] `chrome.jsonl` line 13 records the settled 79×39 normal paint with the six-row prefix and original box.
[O] Line 14 paints the new status/input rows using `CSI 4;1H` and `CSI 5;1H`, without clearing the former suffix.
[O] Line 15 paints the next status/input rows using `CSI 1;1H` and `CSI 2;1H`, again without clearing the former suffix.
[O] `chrome-control.jsonl` line 4 follows its equivalent contraction with `CSI 6;1H CSI J`.
[O] Its line 5 follows the second contraction with `CSI 3;1H CSI J`.
[O] The matching control/failure contraction records carry timestamps `1790717594235` and `1790717601174`.

The relevant difference, omitting color and text payloads, is:

```diff
 First contraction, old mutable rows 1–8, new mutable rows 1–5:
-resized: repaint status at row 4, input at row 5; leave rows 6–8 untouched
+control: repaint status at row 4, input at row 5; erase from row 6 downward

 Second contraction, old mutable rows 1–5, new mutable rows 1–2:
-resized: repaint status at row 1, input at row 2; leave rows 3–5 untouched
+control: repaint status at row 1, input at row 2; erase from row 3 downward
```

The future fix must remove the stale owned rows, not copy the control's unbounded ED0 into preserve mode.
For this fixture, bounded EL2 over rows 6–8 and then rows 3–5 is sufficient; rows below the previous mutable window must remain untouched.

### User screenshot provenance and visual interpretation

- Original supplied path: `/mnt/dropbox/quickshare/Foto 29.09.26, 23 45 28.jpg`.
- Repository evidence owner: `issues/evidence/issue-023/user-typing-during-edit.jpg`.
- File identity: JPEG, 1179×2556 pixels.
- Affected deployed version: `18.4.3-mikeei-2`, current at this report and confirmed again with `momp --version`.
- Version provenance: the user's current-session report and the runtime version check, not a version string visible in the image.
- Copy integrity: `cmp` between the supplied image and repository copy completed successfully.
- Device evidence: portrait iPhone-style screen, visible Termius session controls, German software keyboard open.
- Visible session: `oh-my-pi-fork-2` on `AX101`.
- Visible activity: an Edit preview for `issues/ISSUE-023.md` and the investigation TODO/progress area above the editor.
- Visible status: GPT-6-Astra with high effort, the fork folder/branch, and context usage.
- Visible defect: the trailing draft text appears again below the active input box, with an extra border fragment.
- Clock distinction: the screen and tmux status display `23:44`, while the supplied filename contains `23 45 28`; these are not asserted to be identical timestamps.
- Measurement limit: no synchronized incoming-keystroke, SIGWINCH, CPR, TUI-write, and client-render trace accompanies this image.

The screenshot closes the gap between a user-reported visual symptom and directly inspectable device evidence.
It does not close the separate causal gap between the device's exact frame sequence and the isolated renderer reproduction.
Preserve both distinctions when reporting or implementing the correction.

### Second user screenshot: empty editor and overlapping chrome

- Original supplied path: `/mnt/dropbox/quickshare/Bildschirmfoto 2026-09-29 um 23.52.36.jpeg`.
- Repository evidence owner: `issues/evidence/issue-023/user-editor-overlap-235236.png`.
- File identity: PNG, 1179×2556 pixels, despite the original `.jpeg` filename.
- Preservation: copied byte-for-byte, verified with `cmp`, then renamed to `.png` without conversion or recompression.
- Affected reported version: the same current `18.4.3-mikeei-2` session documented above.
- Visible context: portrait phone, Termius controls, German software keyboard open, session `oh-my-pi-fork-2`, host `AX101`, and a `23:52` clock.

[O] The visible GPT-6-Astra status strip and apparently empty input area sit around the middle of the terminal region.
[O] Multiple horizontal and vertical input-box border fragments appear immediately beneath that region rather than one clean box.
[O] Further transcript, timing, and TODO blocks remain visible below the apparent editor/status region and above the tmux status line.
The active-versus-stale identity of that particular editor-shaped region cannot be determined from the still image.
The repeated TODO wording is not independently classified as a defect because normal tool history can legitimately repeat task summaries.

This example adds a distinct visible manifestation to the first image's repeated draft line.
It shows that retained chrome or border fragments must also be checked when the displayed draft appears empty.
It does not prove that the draft is logically empty, that the current editor moved incorrectly, or that a particular resize immediately preceded capture.

The image alone does not distinguish leftovers on the live grid from chrome already pushed into native tmux history.
[S] The preservation flag also suppresses pre-scroll erasure at `packages/tui/src/tui.ts:2900-2909`, which initially made that a plausible alternate path.
[O] The follow-up below reproduces the visible leftovers with zero native history and does not leak them through the tested later history append.
Do not promote the earlier pre-scroll hypothesis to a proven cause of these examples.
The independently demonstrated additional cause is instead the height-grow anchor failure recorded in ISSUE-024.

### Third user screenshot: tool-preview remnants below editor chrome

- Original supplied path: `/mnt/dropbox/quickshare/Bildschirmfoto 2026-09-29 um 23.54.40.jpeg`.
- Repository evidence owner: `issues/evidence/issue-023/user-tool-preview-overlap-235440.png`.
- File identity: PNG, 1179×2556 pixels, despite the original `.jpeg` filename.
- Preservation: copied byte-for-byte to the correctly suffixed archive path and verified with `cmp`; no conversion or recompression.
- Affected reported version: the same current `18.4.3-mikeei-2` session, with no runtime fix applied during this documentation work.
- Visible context: portrait phone, Termius controls, German software keyboard open, session `oh-my-pi-fork-2`, and `23:54` clock.

[O] The upper terminal region shows the completed ledger-validation Bash output and Assistant text acknowledging the preceding screenshot.
[O] An apparently empty editor with a cursor-like block and the GPT-6-Astra status strip appears below that newer response text.
[O] Immediately beneath the editor/status region, green Edit-preview content beginning `+352|Keep this as unresolved coverage within the current finding` remains visible.
[O] The line `… (43 more lines) [Ctrl+O: Expand]` and several overlapping horizontal border/background bands also remain visible below that region.
[O] A visible `2026-09-29 23:54:26` block appears above it, while a `2026-09-29 23:54:01` block appears farther down.
Those are displayed labels, not a measured ordering of terminal writes.

This image adds retained tool-preview content to the earlier evidence of duplicated draft text and border-only fragments.
The defect's visible extent is therefore not limited to input text or the model/status header.
[A] The image is consistent with rows from an earlier tool presentation surviving a later layout, but a still image cannot identify the live editor instance, the exact retirement event, or the responsible terminal-buffer operation.
Do not equate the mixed visible content with duplicated logical tool execution or corrupted persisted conversation ordering.

The candidate's acceptance must include the transition from an expanded or changing Edit preview to subsequent Assistant output with the keyboard still open.
Check the lower terminal region after tool completion and during continued Assistant rendering, not only immediately after resize or draft contraction.
The follow-up separately captures the live grid and history and reproduces this symptom class as live-grid leftovers.
The screenshot itself remains evidence for the observed presentation, while ISSUE-024 is justified by a separate controlled anchor reproduction, not the image alone.

### Follow-up causal investigation: production tools, real typing, and history

The 2026-09-30 follow-up ran 18 isolated panes across nine distinct scenarios and their no-resize controls.
Source: `personal@0fbe07008812a2c4fd2599b7091c3959541e5870`; relevant runtime owners remain byte-identical to the originally recorded failing revision.
The normal panes use 79×39 → 79×33 → 79×39; the raw-scroll boundary uses 79×19 → 79×13 → 79×19.
Each resize settles before the next operation, so the observed baseline failures do not depend on a resize race.
No user's live pane was resized, cleared, or stopped.

#### Reproduction owners and retained protocol

- [followup-driver.ts](evidence/issue-023/followup-driver.ts) owns production Composer, CustomEditor, TranscriptContainer, Edit ToolExecutionComponent, and AssistantMessageComponent construction.
- [followup-runner.ts](evidence/issue-023/followup-runner.ts) owns finite waits, fresh no-resize controls, isolated tmux sockets, snapshots, and server cleanup.
- [Initial command trace](evidence/issue-023/followup/commands.json) preserves the `tool`, `typing`, and `raw-scroll` run.
- [Ordinary large-result trace](evidence/issue-023/followup/commands-finalize.json) preserves the `finalize` counterprobe.
- [Short-result and accepted-history trace](evidence/issue-023/followup/commands-finalize-short-history-tool.json) preserves `finalize-short` and `history-tool`.
- [CPR isolation trace](evidence/issue-023/followup/commands-history-probe-history-cpr.json) preserves the unchanged-input and CPR-only intervention runs.
- [Buffer-boundary cursor trace](evidence/issue-023/followup/commands-history-cursor-observe.json) distinguishes cursor detachment from alternate-buffer restoration.
- [Computed causal facts](evidence/issue-023/followup/causal-analysis.json) records exact draft checks, physical/planned status counts, marker inventories, raw/delivered CPR, and first damaging CUP.

Each `<scenario>-<control|resize>.jsonl` logs outgoing writes and completed paints.
The later `history-probe`, `history-cpr`, and `history-cursor-observe` runs additionally log raw terminal input, resize signals, and delivered CPR.
Each `<scenario>-<control|resize>-<stage>.json` retains the live viewport, full pane including history, history size, isolated native-history text, and authoritative paint/draft/cursor.
The runner rejects pre-existing case logs so a later investigation cannot silently replace archived evidence.
Use a fresh output directory for a complete rerun:

```bash
AUDIT_OUTPUT=/tmp/issue-023-fresh bun issues/evidence/issue-023/followup-runner.ts tool typing raw-scroll finalize finalize-short history-tool history-probe history-cpr history-cursor-observe
```

The initial runs preceded the `AUDIT_OUTPUT` selector and overwrite guard; their commands wrote directly to the now-retained archive.
The later safety additions change output selection and collision rejection, not the component or terminal scenarios.

#### All three screenshot symptom classes reproduced

1. [O] `tool-resize-contract`: the production Edit preview contracts from 14 rows to two; the authoritative viewport shrinks from 19 to seven rows, but the physical pane retains old preview rows and two status strips.
2. [O] `tool-resize-assistant`: the new ten-row viewport contains final Edit content, two Assistant paragraphs, and one editor; old preview lines 10–14 plus another status/editor box remain physically below it.
3. [O] `typing-resize-typed`: actual input arrives in 20 chunks while the preview alternates between 14 and two rows every 40 ms.
4. [O] Its logical draft contains the complete input once, but the visible grid repeats the same two-line draft at rows 7–8 and 19–20.
5. [O] `typing-resize-cleared`: Ctrl+U leaves the logical draft empty, while the old ending remains on physical row 8 and the previous full draft persists on rows 19–20.
6. [O] `finalize-short-resize-contract`: an ordinary unexpanded eight-line Edit completes with unchanged diff contents; its viewport shrinks from 13 to 12 rows and leaves a duplicate bottom border on row 13.
7. [O] Every corresponding no-resize control removes its superseded rows correctly.

Evidence: [contracted tool](evidence/issue-023/followup/tool-resize-contract.json), [new Assistant above old preview](evidence/issue-023/followup/tool-resize-assistant.json), [typed draft](evidence/issue-023/followup/typing-resize-typed.json), [cleared draft](evidence/issue-023/followup/typing-resize-cleared.json), and [ordinary completion border](evidence/issue-023/followup/finalize-short-resize-contract.json).
Their matching controls are retained under the same names with `control` replacing `resize`.

The completed short Edit needs neither an artificial diff reduction nor manual expansion to expose a stale border.
The streaming Edit renderer owns a trailing animation/preview row; its completion can legitimately shorten the component.
Relevant owners: `packages/tui/src/tools/edit.ts#formatStreamingDiff`, `#renderDiffSection`, and `packages/tui/src/chat/tool-execution.ts#updateResult`.
Those layout changes are valid triggers, not the root cause of failing to erase superseded physical rows.

The tested logical draft is exactly:

```text
INPUT-ONCE-alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma END-ONCE
```

The test does not execute a real file edit or call a provider.
It sends the same UI events through the production presentation owners; filesystem I/O is not required for this corruption.

#### Live-grid leftovers versus native-history contamination

[O] The failing `tool` and `typing` snapshots have `historySize = 0`.
Their old text therefore remains on the live normal grid; archived history is not necessary to explain any of those reproduced visible shapes.
[O] After the later real Assistant append, these old preview fragments disappear and are absent from native history.
[O] The raw-scroll control likewise does not push its obsolete `OLD-LIVE-N` rows into history during the tested explicit history append and later viewport growth.
[S] `#emitPlanFrame` seeds rows about to scroll with replacement history/viewport content before emitting the append, at `packages/tui/src/tui.ts:2910-2924`.
This is counterevidence to blaming suppressed pre-scroll ED0 alone for these examples.
It does not establish that every possible history transition is safe.

The `finalize` case produces legitimate accepted history from a large completed result in both resized and control panes.
Its `OLD-PREVIEW` marker also names the unchanged final diff, so that marker in history is not classified as a leaked stale preview.

#### Independent anchor defect found while adding real accepted history

[O] `history-tool` establishes 32 accepted preface markers before the live Edit/editor.
[O] The first settled grow already loses markers 29–31 and shows two status strips, before any preview contraction.
[O] Later contraction adds a third strip.
The raw CPR and a controlled CPR-only intervention isolate this as [ISSUE-024](ISSUE-024.md), not another name for the erasure latch.
The intervention preserves every accepted marker and eliminates the first-settle copy but deliberately leaves the later erasure failure.
This disproves the earlier assumption that the same-top bounded-erasure proposal alone could cover the full resize problem.

#### Current causal conclusion and remaining limits

- [O] The observed duplicate input, empty-border, and old-tool-under-new-Assistant shapes have server-side production-component reproductions.
- [O] Logical input remains correct in the concurrent-input reproduction; the visible copies are stale physical rows.
- [O] Real accepted history exposes a second cause: a wrongly positioned first post-grow paint that overwrites accepted content.
- [S] The two correction owners are `TUI.#emitPlanFrame` for mutable-row erasure and `TUI.#resolveResizeAnchor` for content-relative post-grow positioning.
- Limit: no claim reconstructs the exact unrecorded iPhone event sequence or rules out every independent Termius defect.
- Limit: neither the generic anchor correction nor the bounded-erasure production implementation has been applied or verified.

### Interpretation of the other experiments

- [O] Raw TUI control: shrinking eight `LONG-N` rows to two `SHORT-N` rows erased the suffix without resize.
- [O] Raw TUI resized: after 80×19 → 79×19, the same contraction retained `LONG-2` through `LONG-7`.
- [O] Persistence: painting all 19 rows as `FULL-N`, then shrinking to two rows, retained `FULL-2` through `FULL-18`.
- [O] Real editor: the resized multiline fixture retained `DRAFT-LINE-1` through `DRAFT-LINE-7`; the control did not.
- [O] Width/cursor counterprobe: a real editor holding `WIDTH-CURSOR-` plus 48 `x` characters plus `-END` reflowed from 79×19 to 40×19 without an observed duplicate in its settled capture.
- [O] Original Assistant fixture: the tested 79×39 → 164×19 → 79×39 rotation retained the expected markers after finalization.
- [O] Continued transcript: the tested 164-column and 79-column height bursts retained `MARK-000` through `MARK-035`, `FINAL-Q1` through `FINAL-Q4`, and `NEXT-TURN-0` through `NEXT-TURN-11` in the inspected captures.
- [O] Fullscreen net-zero height case: the inspected 80×19 → 80×13 → 80×19 round trip did not visibly lose the fixture's committed rows.
- [O] Fullscreen grow case: restoring at 80×25 issued a CPR probe and repainted the live window at one-based row 18, consistent with the observed pulled-down history.
- [A] These passing counterprobes constrain the claim to the reproduced conditions; they do not certify other dimensions, timings, cursor placements, or device clients.

### Continuation fixture reconstruction

The two continuation experiments copied `packages/coding-agent/test/fixtures/tmux-scrollback-driver.ts` into the temporary directory.
They used `PI_TUI_TEST_GATE_STAGE=finalized` and `PI_TUI_RESIZE_SCROLLBACK=preserve`.
After the existing finalized-stage gate, the diagnostic added a second real Assistant component and another input gate instead of stopping immediately.
The inserted block was:

```typescript
const next = new AssistantMessageComponent();
transcript.addChild(next);
next.updateContent(makeMsg(Array.from({ length: 12 }, (_, index) => `- NEXT-TURN-${index}`).join("\n")), {
  transient: false,
});
next.markTranscriptBlockFinalized();
await renderFrame(tui);
const exitGate = Promise.withResolvers<void>();
tui.addInputListener(data => {
  if (data.includes("q")) exitGate.resolve();
  return { consume: true };
});
await exitGate.promise;
```

The original finalized gate was released with `r` only after the resized pane had settled.
The subsequent block was captured before sending `q`.
The temporary copy resolved workspace dependencies through a symlink to the repository's `node_modules`.
This continuation experiment did not include a production editor; it is counterevidence about transcript preservation, not coverage of the failing chrome contract.

### Cleanup and provenance

[O] The investigation stopped only its uniquely named tmux server and removed its temporary drivers and dependency symlink.
[O] No user's live pane was resized, cleared, restarted, or killed.
[O] Reading the active pane confirmed the current interaction context but was not used as a controlled reproduction of the user's prior visual corruption.
The local evidence archive is a repeatable consumer of these diagnostic artifacts while ISSUE-023 remains active.
Its retention classification is `NICHT-CONTRACT-AKTIV`, not a new runtime contract or benchmark.

## Prior-Art

Coverage: the complete local index and a root-cause/symptom search across issue records; both plausible matching records were read completely.

- [S] [ISSUE-021](ISSUE-021.md) is distinct: its width-reflow anchor pushes an unfinished row into native history.
- [S] [ISSUE-022](ISSUE-022.md) is related: its accepted-tail loss motivated the preservation flag that causes this later mutable-chrome regression.
- [S] The inspected fork/upstream diff places the preservation flag in the fork delta, not the recorded upstream baseline.
- [O] [ISSUE-024](ISSUE-024.md) is independently reproduced: its height-grow anchor overwrites accepted rows before any contraction.

Gaps: no fresh external issue/PR/discussion search or canonical-upstream runtime reproduction was performed for this fork-specific root cause.
Contribution fit: correct the fork regression first; no upstream publication target is selected or justified by the present evidence.

## Implemented-Correction

### Source boundary and current outcome

[O] The original failures were reproduced on `personal@77adac703fc417e0692d0f1e2946ece747d83421` before editing runtime code.
That source already includes upstream 18.4.4; this is not a fix tested only against the earlier release.
The [fresh baseline archive](evidence/issue-023/baseline-77adac/) retains the repeated tool, typing, history, and finalization failures.

[S] The sole production implementation owner is `packages/tui/src/tui.ts`.
The change remains part of `MOMP-SCROLLBACK`, disposition `UPSTREAM-INTEGRIERT`.
It does not alter Editor, status, Edit-tool presentation, provider behavior, settings, or package identity.

- Known mutable suffix rows are erased individually after contraction; unknown accepted rows remain protected.
- A successful resize probe restores bounded mutable-row ownership for a contraction occurring during the resize itself.
- Differential and full paints share the same bounded cleanup, including history append and scrolling.
- The protection flag clears only on a destructive reset or a paint that actually reaches the physical pane bottom.
- Normal multiplexer frames remain cursor-relative through the native-grid-before-SIGWINCH interval.
- A first recovered frame uses its measured absolute anchor before cursor-relative painting resumes.
- Fullscreen resizes advance geometry epochs and reject replies from earlier geometry, including net-zero bursts.
- Hidden-cursor bookkeeping records where the writer actually parked before Stop moves to the shell handoff.

No tmux subprocess, guessed grow offset, history clearing, general interval framework, or new configuration was added.
The physical writer still commits its state before invoking paint observers.
The accepted-tail, width-reflow, destructive-reset ordering, and native-history contracts remain covered.

### Corrected causal attribution

The first diagnosis of ISSUE-024 was incomplete: tmux initially relocates its cursor correctly on height growth.
Its native grid changes before it delivers SIGWINCH, leaving a window for old-coordinate absolute TUI paints.
Those paints detach the cursor from the live content before the later CPR recovery.
The fix therefore belongs at the writer, not in a guessed `CPR + height_delta` resolver adjustment.
The [server chronology and raw log](ISSUE-024.md#decisive-server-side-chronology) establish that ordering.

### Additional lifecycle failures caught before completion

[O] A focused fullscreen test first failed because a pre-overlay CPR could resolve a newer geometry transaction.
[O] After epoch tracking was corrected, the extended real-tmux test exposed a separate first-recovery-frame mistake.
Matching final dimensions after a net-zero burst did not mean the parked-offset snapshot was valid again.
[O] An intermediate candidate painted the short preview below the old long preview, leaving two status strips.
The final writer requires an established mutable-window snapshot before using relative cursor movement.
Both reproductions now pass, alongside the existing width, tail-preservation, and Stop contracts.

- [Stale fullscreen CPR failure](evidence/issue-023/verified-fix/fullscreen-before.txt).
- [Intermediate candidate's real-tmux failure](evidence/issue-023/verified-fix/fullscreen-intermediate-before.txt).
- [Final source identity and gate accounting](evidence/issue-023/verified-fix/final-verification.json).

The intermediate candidate failure is not claimed as an independently reproduced upstream defect.
The original fullscreen experiment below remains a historical non-failure; the new cases exercise different boundaries.

### Retained successful core captures

[O] Five diagnostic scenarios and their no-resize controls produced 54 retained snapshots across ten isolated panes.
The [core manifest](evidence/issue-023/verified-fix/verification.json) records their source hash and computed assertions.
These captures precede the final fullscreen hardening; the final permanent regression includes that hardening.
[O] Physical status counts match the current paint plan without obsolete preview or draft copies.
[O] The actual typed draft remains exact; clearing it removes both input markers from the full pane history and grid.
[O] Every history-probe snapshot retains all 32 accepted `PREFACE-N` markers exactly once.
[O] The real grow reply is `CSI 39;18 R` without diagnostic rewriting.
No provider call was made, and no user's tmux pane or server was changed.

## Proposed-Change

Historical proposal, superseded by the implemented correction above.
The following design and caveats record what was known before implementation; they are not current change instructions.
The follow-up proves that [ISSUE-024](ISSUE-024.md) also requires correction; suffix cleanup alone neither prevents nor recovers its accepted-row overwrite.
Keep accepted-tail preservation and Stop handoff, but remove the blanket prohibition on clearing known mutable rows.
The correction belongs in the existing `TUI.#emitPlanFrame` owner, not in Editor, status rendering, or transcript retirement.

### Decision and minimal ownership boundary

Retain `#preservedResizeGridTail` as the conservative indicator that an unknown physical suffix may contain accepted history.
Do not make that flag decide whether rows painted and owned by a later normal frame may be erased.
Reuse `#providerWindow` and `#providerViewportTop` for the previous mutable row extent.
Add only the validity information necessary to distinguish a current physical snapshot from a pre-resize snapshot.
A single owner-local validity bit is sufficient for this synchronous lifecycle if every invalidating transition clears it.
An epoch stamp is an alternative only if the existing geometry epoch is made complete for the relevant transitions.
No generic interval set, new frame-provider API, timer, configuration setting, or parallel row ledger is required.

### Required invariants

1. Accepted history outside the known mutable window is never erased by this correction.
2. A normal paint establishes the exact mutable row range it physically wrote.
3. An intervening resize or normal-buffer restoration invalidates that range's authority for erasure, even if final dimensions equal earlier dimensions.
4. Anchor-recovery snapshots remain available after their erasure authority is invalidated.
5. A same-top contraction without a history/replay batch clears only the superseded suffix of the valid previous mutable window.
6. A full repaint alone does not authorize broad ED0 or discard unknown-tail protection.
7. History acceptance remains before paint-observer notification, preserving the existing reentrant-reset contract.
8. Stop still hands the shell below an unknown preserved tail.

### Concrete bounded-erasure rule

For the first correction, enable the bounded erasure only when all of the following hold:

- The preserve-tail flag is active.
- The previous mutable-window snapshot still describes current normal-buffer geometry.
- Width and height match the preceding normal paint.
- The frame accepts no history batch, including no replay whose history rows were moved into the viewport.
- No destructive reset is in progress.
- The new viewport has the same physical top as the previous viewport.
- The new viewport is shorter than the previous mutable window.

Use `history === undefined`, not only `historyRows.length === 0`, for the no-history condition.
A replay can transfer its rows into the viewport and leave an empty separate history-row array.

Let `oldTop` and `oldRows` describe the previous mutable window, and `newTop` and `newRows` the current one.
The erase interval is zero-based, half-open:

```text
eraseStart = newTop + newRows
eraseEnd   = min(height, oldTop + oldRows)
required   = newTop == oldTop
erase rows = [eraseStart, eraseEnd)
```

Emit `CUP(row + 1, 1)` followed by `EL2` for each row in that interval.
`EL2` means `CSI 2K`, not `ED0` (`CSI J`), `ED2`, or `ED3`.
Per-row line erasure is deliberate: a screen-wide or erase-to-end-of-screen operation would again reach unowned retained history.
The existing `ERASE_LINE` constant owns the EL2 bytes.

### Proposed writer sketch

The following is the historical writer sketch, not the applied patch or a verified standalone implementation.
`previousMutableWindowValid` represents the lifecycle-qualified snapshot described below; it must not be implemented as width/height equality alone.
Place one shared block after the differential/full-paint branch and before final cursor placement, while the previous window still exists.

```diff
 // After either normal paint branch, before cursor placement and snapshot replacement:
+if (
+  this.#preservedResizeGridTail &&
+  previousMutableWindowValid &&
+  geometryStable &&
+  history === undefined &&
+  !destructiveReset &&
+  startTop === newTop
+) {
+  const staleEnd = Math.min(height, startTop + this.#providerWindow.length);
+  for (let row = newTop + rows; row < staleEnd; row++) {
+    buffer += `\x1b[${row + 1};1H${ERASE_LINE}`;
+  }
+}
```

The loop is empty when the viewport does not contract.
For the reproduced eight-to-five-row contraction it clears only zero-based rows 5–7.
For the subsequent five-to-two-row contraction it clears only rows 2–4.
The rest of the pane, including any unknown retained tail, is untouched.

### Snapshot-validity lifecycle

The implementation should preserve these transitions within TUI:

- Construction or provider replacement: no known current mutable range.
- Any resize callback: invalidate erasure authority before branching into probe restart, in-place resize, alternate-buffer borrow, or fullscreen repaint.
- Starting anchor recovery: retain the old window for offset computation but do not treat it as erasable current geometry.
- Restoring the normal buffer after fullscreen: invalidate erasure authority even when the width and height return to their entry values.
- First settled normal paint: do not erase unknown old rows; establish the new physical mutable range after writing it.
- Subsequent same-geometry paints: allow bounded clearing within that now-known range.
- History append or viewport-top relocation: skip this narrow contraction rule; refresh the snapshot from the actual resulting paint.
- Destructive reset: follow the existing clear/replay protocol, then publish the new snapshot.
- Stop/start or provider lifecycle changes: do not inherit a validity claim for a grid the process no longer owns.

Publish the refreshed validity alongside `#providerWindow`, `#providerViewportTop`, and the recorded geometry before invoking paint listeners.
Do not append a validity assignment after observer callbacks, where a reentrant reset could be overwritten with stale state.

### Fullscreen caveat and scope control

[S] At proposal time, the fullscreen resize callback returned without `#trackResizeBurst`.
[S] Its fullscreen exit compared final width/height with entry dimensions before requesting anchor recovery.
[O] The original net-zero fullscreen height experiment did not visibly fail.
That historical experiment alone does not prove the distinct stale-reply and intermediate-candidate failures above.

For this proposal, the actionable requirement is narrower: invalidate the new erasure-authority sidecar on those transitions.
A validity bit avoids depending on incomplete epoch tracking without changing unrelated anchor decisions.
If an epoch-based implementation is preferred, its fullscreen gaps must be closed and verified in the same authorized change.
Do not silently expand this finding into a general fullscreen-anchor rewrite.

### Deliberately excluded erasure paths

This contraction rule does not re-enable:

- Pre-scroll clearing when history and viewport overflow the pane.
- Clearing around a history append or replay.
- Erasure based on the stale pre-resize viewport top.
- Broad suffix erasure on the first uncertain post-resize paint.
- Destructive history reconstruction during ordinary resize.

Those paths can affect accepted transcript rows and have different proofs.
The existing ISSUE-021/022 protections remain load-bearing while the known mutable contraction is corrected.

### Rejected shortcuts

- Clearing `#preservedResizeGridTail` after the next paint is unsafe because that paint may not cover accepted rows below it.
- Clearing the flag after any full repaint is unsupported by the current physical-history accounting.
- Restoring unconditional ED0 would reintroduce ISSUE-022's accepted-tail loss.
- Switching the user to `rebuild` changes the contract and may destroy pre-existing native history.
- Increasing the 120 ms settle delay does not fix a failure reproduced after both resizes settled.
- Forcing repeated redraws does not help while the full-paint branch suppresses the same erasure.
- Patching Editor or status rendering would hide the symptom at the wrong owner and leave other mutable rows broken.
- Cleaning already polluted native history is not part of prevention; do not delete preserved history merely to remove existing visual debris.
- Extending the narrow width-anchor exception does not address a later same-geometry contraction.

### Expected change closure

- Runtime owner: `packages/tui/src/tui.ts` for validity transitions and one shared bounded suffix-erasure block.
- Regression boundary: a real-tmux test using production Composer/editor chrome and continued contraction after resize.
- Existing preservation guards: the affected ISSUE-021/022 tests and reentrant frame-plan behavior.
- Inventory: update `MOMP-SCROLLBACK` in `AGENTS.md` when source implementation is authorized.
- User-facing changelog: describe removal of stale duplicated input/status rows if the eventual source change is delivered.
- Non-goals: model/provider logic, conversation persistence, status formatting, terminal-client configuration, or package release.

The actual closure is now implemented at the existing TUI owner and verified as recorded above.

## Scope-and-Constraints

- Preserve the accepted-tail and Stop behavior recorded in ISSUE-022, including pre-existing pane history and no ED3 during preserve-mode resize.
- Preserve ISSUE-021's width-reflow anchor and legitimate interior cursor offsets.
- Do not switch the user to `rebuild`, clear native history, or reset the preservation flag merely because one full paint completed.
- Do not add a general interval framework or modify Editor/status components to hide renderer leftovers.
- `MOMP-SCROLLBACK` remains `UPSTREAM-INTEGRIERT`; its inventory now names the corrected behavior and focused proofs.
- Risk: stale physical coordinates can erase accepted history, so snapshot validity is part of the correction, not an optional optimization.

## Verification

### Completed baseline verification

Observed on the unchanged runtime during this investigation:

```text
bun test packages/coding-agent/test/tmux-scrollback-exactness.test.ts
7 pass
0 fail
287 expect() calls
Ran 7 tests across 1 file. [9.02s]

bun test packages/tui/test/resize-multiplexer-anchor.test.ts packages/tui/test/history-frame-plan.test.ts
44 pass
0 fail
122 expect() calls
Ran 44 tests across 2 files. [272.00ms]
```

[O] The real Composer reproduction fails after resize and passes in the no-resize control despite those 51 passing tests.
[S] The existing real-tmux transcript fixture has no production editor/status chrome.
[S] Its final assertions focus on transcript markers, wide-row preservation, exit, and pre-existing history.
[S] Some existing resize cases allow marker counts greater than one, so they cannot establish exact-once rendering generally.
[S] The width-anchor guard requires a width-only shrink, unchanged height, a top-anchored full-height old window, zero parked offset, and overflow after reflow.
It is not a general proof for mobile rotation that changes both dimensions or for the product editor's interior cursor position.
[S] The existing fullscreen history-recovery test uses `append` mode and a single height grow, not this preserve-mode continued-editor contraction.

### Historical regression acceptance plan

Qualifying condition: reproduce an observed user-visible defect at the real terminal boundary.
Use one representative integration test rather than separate mocked tests for each field or collaborator call.

The test should:

1. Launch the production Composer and box editor in an isolated real tmux pane with preserve mode.
2. Establish pre-existing native history and accepted transcript markers that must survive.
3. Hold a live six-row prefix above one editor/status box.
4. Perform the settled 79×39 → 79×22 → 79×39 keyboard cycle.
5. Contract the prefix to three rows and then zero, waiting for each normal paint.
6. Assert exactly one status header and one input box, with no obsolete live rows.
7. Force a full repaint and contract again to exercise the shared non-differential path.
8. Verify retained history and Stop handoff without ED3.

Use count assertions on unique fixture markers, not exact themed status wording or incidental ANSI styling.
Do not use a fixture that exits immediately after the resize instead of continuing normal interaction.
Do not treat merely seeing the newest box as success while older copies remain elsewhere in the pane.

### State boundaries identified before implementation

- A second resize between the establishing paint and contraction must invalidate old erasure authority.
- A fullscreen round trip, including a return to the original dimensions, must not retain a stale erasure-authority claim.
- A history append or replay must not enter the no-history contraction branch.
- Forced repaint and differential repaint must apply the same bounded clearing policy.
- The first post-resize paint must preserve unknown accepted rows below the newly drawn viewport.
- Stop must still avoid overwriting the accepted tail protected by ISSUE-022.
- Reentrant paint-observer reset must keep the accepted-history and snapshot ordering intact.

These were the original acceptance conditions; the final evidence below identifies the exercised boundaries.
Use the narrowest existing contracts plus the representative real-tmux regression; do not rerun the entire project suite without a newly affected boundary.
Real-device acceptance remains separate: rotate iPad/iPhone and toggle the software keyboard in Termius while editing and while live content contracts.

### Required concurrent typing and tool-output scenario

The user screenshot adds a material scenario beyond direct `editor.setText` changes in the controlled fixture.
The candidate must be exercised while actual input events and live tool rendering both request frames.

1. Use a production Composer/editor and a changing tool-output or tool-preview component in the same mutable viewport.
2. Deliver a known text sequence through terminal input, including enough characters to cross a wrap boundary.
3. Change the live tool area while typing continues, including a transition that moves the editor upward.
4. Run once from a fresh session without resize and once after a settled software-keyboard-style height cycle.
5. Compare `editor.getText()` with the intended single draft and inspect the physical pane separately.
6. Require one visible copy of each current input row, no obsolete draft suffix, one status header, and a cursor belonging to the live editor.
7. Keep accepted transcript/history sentinels intact and retain before/after pane captures plus outgoing bytes.
8. If the fresh no-resize control fails independently, investigate its distinct cause rather than extending this issue's causal claim.

The standalone static contraction reproducer remains the narrow deterministic oracle for the confirmed defect.
The concurrent-input baseline is now reproduced with real terminal input and production Edit presentation; any candidate must remove its stale copies while preserving the exact logical draft.
Real Termius/iPhone verification should repeat the screenshot workflow after the candidate passes the server-side reproduction.
The second screenshot additionally requires checking an apparently empty editor and border-only leftovers while tool/TODO output advances.
Capture both the live viewport and `tmux capture-pane -p -S -` so stale grid rows can be distinguished from mutable chrome already archived into history.
If the latter occurs, evaluate the separately guarded pre-scroll erasure path before claiming the bounded contraction proposal resolves this manifestation.
The third screenshot additionally requires the Edit-preview-to-Assistant-output transition with the keyboard open.
Assert that superseded tool-preview rows and border/background bands do not remain below the current editor after that transition.
The original same-top sketch was insufficient by itself; the final regression also covers history append and scrolling.

### Final implementation verification

[O] The final focused gate passes 89 tests with zero failures and 1,306 assertions across nine files.
[O] The real-tmux Composer cases cover zero, partial, and full native history, actual input, and delayed resize notification.
[O] They also cover rotation, coalesced resize, fullscreen net-zero return, tool contraction, finalization, append, and Stop.
[O] Virtual-terminal regressions cover bounded suffix erasure, stale CPR rejection, and hidden-cursor shell handoff.
[O] Existing ConPTY/Warp, alternate-buffer echo, accepted-tail, and reentrant destructive-reset gates pass.
[O] TUI and coding-agent type checks plus scoped Oxlint and formatting complete successfully.

The three new Composer cases passed first; the remaining 86 tests then passed without repeating those cases.
The [final manifest](evidence/issue-023/verified-fix/final-verification.json) records their combined accounting and runtime hash.
A repeatable full invocation is:

```bash
bun test \
  packages/tui/test/history-frame-plan.test.ts \
  packages/tui/test/resize-multiplexer-anchor.test.ts \
  packages/tui/test/resize-anchor-recovery.test.ts \
  packages/tui/test/resize-conpty-warp.test.ts \
  packages/tui/test/resize-preserved-clear.test.ts \
  packages/tui/test/resize-alt-toggle-echo.test.ts \
  packages/tui/test/destructive-reset-clear-order.test.ts \
  packages/tui/test/cursor-visibility-dedupe.test.ts \
  packages/coding-agent/test/tmux-scrollback-exactness.test.ts
bun --cwd packages/tui run check:types
bun --cwd packages/coding-agent run check:types
```

Real Termius/iOS client rendering remains unmeasured; server-side success is not claimed as a recorded device session.
The source-verification checkpoint preceded the completed deployment documented below.

### Deployment verification

[O] `@mikeei/momp@18.4.4-mikeei-2` was published to GitHub Packages and installed globally on AX101-1.
Fast publish retained upstream base 18.4.4 without fetching or integrating another upstream revision.
The source correction and version bump are separate commits.

- Source correction: `72c46465e4`.
- Attested release source: `0ec3f58a72f3f20661bc807bc3e903ef470296aa`.
- Upgrader: `2993e3f6e97442dd2ab02ed0bd2b586d8e484f5b`.
- Settings: `90a13046857b1cc9147512a125c6a1039f92aa47`.
- Preserved settings-config drift SHA-256: `4c1cadfa908528360975576daa6859165513140615ddc6da9d2495ba1db78d4a`.
- Published artifact SHA-256: `0a795205fa0e85729a51ca61216410fbc1858053272d16721d2b532f558e61b7`.
- Retained artifact: `/tmp/momp-publish-artifacts/b71468398f4c0c91851d7281203b6f245d00c8c13b786aa1fc3408b244671d4a/momp-18.4.4-mikeei-2.tgz`.

[O] Candidate smoke passed all eight registered checks against the isolated tarball installation.
[O] Publication used that exact attested tarball rather than rebuilding it.
[O] Publish-phase verification confirmed `momp/18.4.4-mikeei-2` and passed `momp --smoke-test`.
[O] Standalone smoke then passed all eight checks against the global installation.
[O] Readiness passed all seven source-contract groups and the source-package quality gate.
The upgrader now permanently includes `MOMP-SCROLLBACK` in its release-required source test manifest.
It reuses the source-owned transcript, frame-plan, resize-anchor, destructive-reset, and real-tmux regressions.

No active user pane was restarted or cleared.
Existing MOMP processes retain their loaded runtime until restarted; newly started processes use the installed fix.
Real Termius/iOS client acceptance remains distinct from the completed server-side and package-level proofs.

## Publication-Blockers

- This is an observed fork regression, not a demonstrated canonical-upstream bug.
- Current external prior art and a matching publication target have not been established.
- Authorized-Work and Publication-Target remain unselected for upstream work; local source implementation is complete.

## Diagnostic-Appendix

### Raw TUI and fullscreen diagnostic driver

This is the earlier diagnostic used for the raw contraction, full-height repaint, and fullscreen counterprobes.
It uses the production TUI and ProcessTerminal with a deliberately small frame provider.
It is evidence scaffolding, not the proposed implementation and not a substitute for the production Composer reproduction.

```typescript
import * as fs from 'node:fs';
import { TUI, CURSOR_MARKER, type TerminalFrameProvider, type OverlayHandle } from '/root/projects/project-oh-my-pi-fork/packages/tui/src/tui.ts';
import { ProcessTerminal } from '/root/projects/project-oh-my-pi-fork/packages/tui/src/terminal.ts';
import { setTerminalHeadless } from '/root/projects/project-oh-my-pi-fork/packages/utils/src/env.ts';

const log = process.env.AUDIT_LOG!;
class LoggedTerminal extends ProcessTerminal {
  override write(data: string): void {
    fs.appendFileSync(log, JSON.stringify({t:Date.now(), width:this.columns, height:this.rows, data})+'\n');
    super.write(data);
  }
}
setTerminalHeadless(false);
process.stdout.write(Array.from({length:30},(_,i)=>`PREHISTORY-${String(i).padStart(2,'0')}`).join('\r\n')+'\r\n');
await Bun.sleep(80);
const terminal = new LoggedTerminal();
let count = 8;
let stage = 'long';
let generation = 0;
let overlay: OverlayHandle | undefined;
let history: { id:number; rows:string[] } | undefined;
let nextHistory = 1;
let marker = process.env.AUDIT_CURSOR === '1';
const provider: TerminalFrameProvider = {
  renderFrame(size) {
    const rows = Array.from({length:Math.min(count,size.rows)},(_,i)=>`${stage.toUpperCase()}-${i}${i === count-1 && marker ? CURSOR_MARKER : ''}`);
    return {history,viewport: rows};
  },
  renderResizeFrame(size) { return Array.from({length:Math.min(count,size.rows)},(_,i)=>`${stage.toUpperCase()}-${i}`); },
  acknowledgeHistory() { history=undefined; }
};
const tui = new TUI(terminal, true, {onPaint(paint) {
  process.stdout.write(`\x1b]2;AUDIT-${stage}-${paint.columns}x${paint.rows}-${paint.alt?'alt':'normal'}-${++generation}\x07`);
}});
tui.setResizeScrollback('preserve');
tui.setFrameProvider(provider);
tui.addInputListener(data=>{
  for (const key of data) {
    if (key==='s') { count=2; stage='short'; }
    if (key==='f') { count=terminal.rows; stage='full'; }
    if (key==='n') { count=8; stage='new'; }
    if (key==='m') { marker=!marker; }
    if (key==='h') { history={id:nextHistory++, rows:Array.from({length:20},(_,i)=>`COMMIT-${nextHistory}-${i}`)}; }
    if (key==='o') { overlay=tui.showOverlay({render:()=>['OVERLAY']},{fullscreen:true}); }
    if (key==='c') { overlay?.hide(); overlay=undefined; }
    if (key==='q') { tui.stop(); process.stdout.write('AUDIT-EXIT\r\n'); process.exit(0); }
  }
  tui.requestRender(true);
  return {consume:true};
});
tui.start();
setTimeout(()=>{ tui.stop(); process.exit(2); },120000).unref();
```

### Raw diagnostic sequences

Use a separate 80×19 pane and a fresh log for each sequence.
Wait for the expected title and normal-buffer paint between stages unless the sequence explicitly tests a burst.

- No-resize contraction: send `s`; expect two `SHORT-N` rows and no `LONG-N` suffix.
- Resized contraction: resize to 79×19, wait for normal paint, then send `s`; the observed failure retains `LONG-2` through `LONG-7`.
- Full-paint persistence: continue the resized case with `f`, wait for 19 `FULL-N` rows, then send `s`; the observed failure retains `FULL-2` through `FULL-18`.
- Fullscreen net-zero height: start fresh, send `h`, wait for committed history and the live window, send `o`, resize 80×19 → 80×13 → 80×19, then send `c` after the modal paints.
- Fullscreen grow: start fresh, send `h`, then `o`, resize to 80×25, and send `c` after the modal paints.

The `h` operation's first batch is labeled `COMMIT-2-N` because the fixture increments its ID before constructing the row labels.
That diagnostic naming quirk is not a renderer defect.
The original fullscreen captures retained committed rows and therefore do not demonstrate the separate source-level epoch concern.

### Commands used to identify the source change

```bash
git log -12 --format='%h %s' -- packages/tui/src/tui.ts packages/coding-agent/test/tmux-scrollback-exactness.test.ts MOMP_VERSION
git --no-pager show --format= --no-ext-diff c98294b54d -- packages/tui/src/tui.ts
git log -1 --format='%H %cI %s' HEAD
git log -1 --format='%H %cI %s' upstream/main
git diff --unified=0 upstream/main HEAD -- packages/tui/src/tui.ts
momp --version
tmux -V
```

The upstream comparison includes unrelated later upstream work, including native/TSP changes.
Do not interpret the entire fork/upstream file diff as the root-cause patch.
The introducing commit and its preservation-flag hunks identify the relevant delta precisely.

### Evidence retention and handoff

The evidence directory contains the initial fourteen diagnostic captures/logs, all three supplied screenshots, the follow-up driver/runner and run archive, and scoped Git preservation rules.
The exception file retains only the three named raw `.log` streams that the repository's general `*.log` rule would otherwise hide.
The local `.gitattributes` marks raw `.log` streams and `.txt` screen captures as binary to prevent line-ending normalization and whitespace cleanup.
Terminal padding, carriage returns, trailing blank rows, and escape bytes are load-bearing evidence and must remain unchanged.
Keep the archive while this regression investigation or its verification consumes it.
The follow-up scripts and captures are `NICHT-CONTRACT-AKTIV`, consumed by ISSUE-023 and ISSUE-024 for repeatable causal investigation and later regression verification.
Keep that shared closure while either finding consumes it; it is not a new runtime feature or benchmark.
Do not replace source evidence with links to the original temporary directory.
Do not claim the documentary driver listings are newly executed candidate fixes.
Baseline captures remain immutable; successful core captures and final implementation evidence are separately identified.

## Next-Action

Summary: Observe released terminal behavior
Action: Observe the released fix during normal Termius rotation, keyboard changes, and concurrent typing/tool activity.
Done-When: Real-device behavior confirms the server-side invariants; any remaining failure receives a new captured reproduction.

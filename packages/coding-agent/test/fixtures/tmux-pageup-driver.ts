import { CustomEditor } from "@oh-my-pi/pi-tui/prompt/custom-editor";
import { InputController } from "@oh-my-pi/pi-coding-agent/modes/controllers/input-controller";
import { getEditorTheme, initTheme } from "@oh-my-pi/pi-tui/theme";
import type { InteractiveModeContext } from "@oh-my-pi/pi-coding-agent/modes/types";
import { ProcessTerminal, Text, TUI } from "@oh-my-pi/pi-tui";
import { setTerminalHeadless } from "@oh-my-pi/pi-utils";

const HISTORY_FILLER_COUNT = 80;
const HISTORY_SETTLE_MS = 50;
const READY_MARKER = "PAGEUP-READY";

async function main(): Promise<void> {
	await initTheme(false);
	const history = Array.from(
		{ length: HISTORY_FILLER_COUNT },
		(_value, index) => `PAGEUP-HISTORY-${String(index).padStart(3, "0")}`,
	);
	process.stdout.write(`${history.join("\n")}\n`);
	// tmux is the integration boundary; fake timers cannot publish bytes into pane history.
	await Bun.sleep(HISTORY_SETTLE_MS);

	const previousHeadless = setTerminalHeadless(false);
	const tui = new TUI(new ProcessTerminal());
	const editor = new CustomEditor(getEditorTheme());
	const context = {
		editor,
		ui: tui,
		session: { extensionRunner: undefined },
		updateEditorBorderColor: () => {},
		keybindings: {
			getKeys: () => [],
			matches: () => false,
		},
		// PageUp uses the real controller; leave the unrelated STT hold gesture disabled.
		dictationSpaceHold: () => ({ enabled: () => false, onStart: () => undefined, onEnd: () => undefined }),
		handlesBtwBranchKey: () => false,
		canCopyBtw: () => false,
	} as unknown as InteractiveModeContext;
	const controller = new InputController(context);
	const done = Promise.withResolvers<void>();
	const finish = (): void => done.resolve();
	process.once("SIGHUP", finish);
	process.once("SIGTERM", finish);

	try {
		controller.setupKeyHandlers();
		tui.addChild(new Text(READY_MARKER));
		tui.addChild(editor);
		tui.setFocus(editor);
		tui.start();
		await done.promise;
	} finally {
		tui.stop();
		setTerminalHeadless(previousHeadless);
	}
}

void main().catch(error => {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`tmux-pageup-driver: ${message}\n`);
	process.exitCode = 1;
});

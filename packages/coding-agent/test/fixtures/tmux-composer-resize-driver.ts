import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { AssistantMessageComponent } from "@oh-my-pi/pi-tui/chat/assistant-message";
import { stopSharedSpinnerTicker, ToolExecutionComponent } from "@oh-my-pi/pi-tui/chat/tool-execution";
import { TranscriptContainer } from "@oh-my-pi/pi-tui/chrome/transcript-container";
import { Composer } from "@oh-my-pi/pi-tui/prompt/composer";
import { ProcessTerminal, type TerminalStartOptions } from "@oh-my-pi/pi-tui/terminal";
import { setTerminalHeadless } from "@oh-my-pi/pi-utils";

const EXIT_DEADLINE_MS = 30_000;
const historyCount = Number(process.argv[2]);
if (!Number.isInteger(historyCount) || historyCount < 0) throw new Error("A nonnegative history count is required");

// tmux changes its grid before delivering SIGWINCH. Holding both the callback
// and application geometry makes that real cross-process race deterministic.
class DelayedResizeTerminal extends ProcessTerminal {
	#held: { columns: number; rows: number } | undefined;
	#onResize: (() => void) | undefined;
	override get columns(): number {
		return this.#held?.columns ?? super.columns;
	}
	override get rows(): number {
		return this.#held?.rows ?? super.rows;
	}
	override start(
		onInput: (data: string) => void,
		onResize: () => void,
		onDisconnect?: () => void,
		options?: TerminalStartOptions,
	): void {
		this.#onResize = onResize;
		super.start(
			onInput,
			() => {
				if (!this.#held) onResize();
			},
			onDisconnect,
			options,
		);
	}
	holdResize(): void {
		this.#held = { columns: this.columns, rows: this.rows };
	}
	releaseResize(): void {
		this.#held = undefined;
		this.#onResize?.();
	}
}

function assistantMessage(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "fixture",
		stopReason: "stop",
		timestamp: Date.now(),
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
	};
}

setTerminalHeadless(false);
const terminal = new DelayedResizeTerminal();
let stage = "initial";
let paints = 0;
let closeOverlay: (() => void) | undefined;
const composer = new Composer({
	terminal,
	preferences: {
		quiet: true,
		resizeScrollback: "preserve",
		composerShape: "box",
		spellingTypoDetection: false,
		spellingAutocomplete: "off",
	},
	tuiOptions: {
		onPaint: paint => {
			// Title and frame share the output pump, so this is a physical barrier.
			if (!paint.alt || stage === "overlay") {
				terminal.setTitle(`COMPOSER-${stage}-${paint.columns}x${paint.rows}-${++paints}`);
			}
		},
	},
});
const transcript = new TranscriptContainer();
const addAssistant = (count: number, prefix: string): void => {
	const assistant = new AssistantMessageComponent();
	transcript.addChild(assistant);
	assistant.updateContent(
		assistantMessage(Array.from({ length: count }, (_, i) => `${prefix}-${String(i).padStart(3, "0")}`).join("\n\n")),
		{ transient: false },
	);
	assistant.markTranscriptBlockFinalized();
};
if (historyCount > 0) addAssistant(historyCount, "ACCEPTED");
const edit = new ToolExecutionComponent(
	"edit",
	{ path: "resize.txt", oldText: "old", newText: "new" },
	{ useBuiltInRenderer: true },
	undefined,
	composer.ui,
);
transcript.addChild(edit);
composer.setRuntimeChildren([transcript, composer.editor], { transient: [composer.editor] });
composer.editor.setTopBorderProvider(() => ({ content: "LIVE-STATUS", width: 11 }));
edit.setExpanded(true);
const preview = (count: number): void =>
	edit.updateStreamPreview({
		streaming: true,
		files: [
			{
				path: "resize.txt",
				diff: Array.from(
					{ length: count },
					(_, i) => `+${String(i + 1).padStart(3)} PREVIEW-${String(i).padStart(3, "0")}`,
				).join("\n"),
				firstChangedLine: 1,
			},
		],
	});
preview(14);
const stop = (): void => {
	stopSharedSpinnerTicker();
	composer.ui.stop();
	process.exit(0);
};
composer.ui.addInputListener(data => {
	switch (data) {
		case "\x1b[15~":
			if (closeOverlay) {
				stage = "closed";
				closeOverlay();
				closeOverlay = undefined;
			} else {
				stage = "overlay";
				closeOverlay = composer.ui.showOverlay({ render: () => ["FULLSCREEN-OVERLAY"] }, { fullscreen: true }).hide;
			}
			break;
		case "\x1b[17~":
			stage = "short";
			preview(2);
			break;
		case "\x1b[18~":
			stage = "long";
			preview(14);
			break;
		case "\x1b[19~":
			stage = "assistant";
			edit.updateResult({
				content: [{ type: "text", text: "Edit completed" }],
				details: { diff: "+1 FINAL-EDIT", path: "resize.txt", firstChangedLine: 1 },
			});
			edit.seal();
			addAssistant(2, "FINAL-ASSISTANT");
			break;
		case "\x1b[20~":
			stop();
			break;
		case "\x1b[21~":
			stage = "append";
			addAssistant(24, "APPENDED");
			break;
		case "\x1b[23~":
			stage = "held";
			terminal.holdResize();
			break;
		case "\x1b[24~":
			stage = "released";
			terminal.releaseResize();
			break;
		default:
			return undefined;
	}
	// The contraction exercises a full paint; spinner ticks exercise diffs.
	composer.ui.requestRender(data === "\x1b[17~");
	return { consume: true };
});
composer.start({ playWelcomeIntro: false });
setTimeout(() => {
	throw new Error("Composer resize fixture exceeded its deadline");
}, EXIT_DEADLINE_MS).unref();

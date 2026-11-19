import * as fs from "node:fs";
import { Composer } from "../../../packages/tui/src/prompt/composer";
import { ProcessTerminal, type TerminalStartOptions } from "../../../packages/tui/src/terminal";
import { TranscriptContainer } from "../../../packages/tui/src/chrome/transcript-container";
import { AssistantMessageComponent } from "../../../packages/tui/src/chat/assistant-message";
import { ToolExecutionComponent, stopSharedSpinnerTicker } from "../../../packages/tui/src/chat/tool-execution";
import { TUI, CURSOR_MARKER, type HistoryBatch } from "../../../packages/tui/src/tui";
import { setTerminalHeadless } from "../../../packages/utils/src/env";

// Diagnostic only: synchronous append preserves input/write/paint observation order.
const logPath = process.env.AUDIT_LOG;
const scenario = process.env.AUDIT_SCENARIO;
if (!logPath || !scenario) throw new Error("AUDIT_LOG and AUDIT_SCENARIO are required");
const observe = (event: object): void => fs.appendFileSync(logPath, JSON.stringify({ t: Date.now(), ...event }) + "\n");
class ObservedTerminal extends ProcessTerminal {
	override start(
		onInput: (data: string) => void,
		onResize: () => void,
		onDisconnect?: () => void,
		options?: TerminalStartOptions,
	): void {
		let previousRows = this.rows;
		let growth = 0;
		super.start(
			data => {
				let delivered = data;
				// Counterfactual for this fixed-width fixture only, not a proposed runtime fix.
				if (scenario === "history-cpr" && growth > 0) {
					delivered = data.replace(/\x1b\[(\d+);(\d+)R/g, (original, row, col) =>
						Number(col) >= 17 ? `\x1b[${Math.min(this.rows, Number(row) + growth)};${col}R` : original,
					);
				}
				observe({ kind: "raw-input", data, delivered, width: this.columns, height: this.rows });
				onInput(delivered);
			},
			() => {
				growth = Math.max(0, this.rows - previousRows);
				observe({ kind: "resize", fromRows: previousRows, rows: this.rows, growth });
				previousRows = this.rows;
				onResize();
			},
			onDisconnect,
			options,
		);
	}
	override write(data: string): void {
		// Query the actual normal cursor on each side of the alt-buffer transaction.
		if (scenario === "history-cursor-observe") {
			data = data.replace("\x1b[?1049h", "\x1b[6n\x1b[?1049h").replace("\x1b[?1049l", "\x1b[?1049l\x1b[6n");
		}
		observe({ kind: "write", width: this.columns, height: this.rows, data });
		super.write(data);
	}
}
setTerminalHeadless(false);
let stage = "initial";
let count = 0;
let composer: Composer | undefined;
let ui: TUI;
let typingTimer: NodeJS.Timeout | undefined;
const terminal = new ObservedTerminal();
const onPaint = (paint: {
	alt: boolean;
	columns: number;
	rows: number;
	viewport: readonly string[];
	history: readonly string[];
}): void => {
	observe({
		kind: "paint",
		stage,
		paint: ++count,
		...paint,
		draft: composer?.editor.getText(),
		debug: ui?.getDebugPaint(),
	});
	// The title is the runner's paint barrier: enqueue it behind the frame in
	// the same TTY pump, never through independently ordered stdout writes.
	terminal.setTitle(`AUDIT-${stage}-${paint.columns}x${paint.rows}-${paint.alt ? "alt" : "normal"}-${count}`);
};
const stop = (): void => {
	clearInterval(typingTimer);
	stopSharedSpinnerTicker();
	observe({ kind: "stop", draft: composer?.editor.getText() });
	ui.stop();
	process.exit(0);
};
if (scenario === "raw-scroll") {
	let rows = 12;
	let history: HistoryBatch | undefined;
	let historyId = 0;
	ui = new TUI(terminal, true, { onPaint });
	ui.setResizeScrollback("preserve");
	const frame = () =>
		Array.from(
			{ length: rows },
			(_, i) => `${stage === "initial" ? "OLD-LIVE" : "NEW-LIVE"}-${i}${i === rows - 1 ? CURSOR_MARKER : ""}`,
		);
	ui.setFrameProvider({
		renderFrame: () => ({ viewport: frame(), history }),
		renderResizeFrame: () => frame(),
		acknowledgeHistory: () => {
			history = undefined;
		},
	});
	ui.addInputListener(data => {
		observe({ kind: "input", data });
		if (data === "\x1b[17~") {
			stage = "contract";
			rows = 2;
		}
		if (data === "\x1b[18~") {
			stage = "scroll";
			history = { id: ++historyId, rows: Array.from({ length: 30 }, (_, i) => `ACCEPTED-${historyId}-${i}`) };
		}
		if (data === "\x1b[19~") {
			stage = "grow";
			rows = 18;
		}
		if (data === "\x1b[20~") stop();
		ui.requestRender();
		return { consume: true };
	});
	ui.start();
} else {
	composer = new Composer({
		terminal,
		preferences: {
			quiet: true,
			resizeScrollback: "preserve",
			composerShape: "box",
			spellingTypoDetection: false,
			spellingAutocomplete: "off",
		},
		tuiOptions: { onPaint },
	});
	ui = composer.ui;
	const transcript = new TranscriptContainer();
	const edit = new ToolExecutionComponent(
		"edit",
		{ path: "diagnostic.txt", oldText: "OLD", newText: "NEW" },
		{ useBuiltInRenderer: true },
		undefined,
		ui,
	);
	composer.setRuntimeChildren([transcript, composer.editor], { transient: [composer.editor] });
	composer.editor.setTopBorderProvider(() => ({ content: "AUDIT-STATUS", width: 12 }));
	const diff = (n: number, prefix: string) =>
		Array.from({ length: n }, (_, i) => `+${String(i + 1).padStart(3)} ${prefix}-${i}`).join("\n");
	const preview = (n: number, prefix: string): void =>
		edit.updateStreamPreview({
			streaming: true,
			files: [{ path: "diagnostic.txt", diff: diff(n, prefix), firstChangedLine: 1 }],
		});
	const finalizationCase = scenario === "finalize" || scenario === "finalize-short";
	const initialPreviewRows = scenario === "finalize" ? 60 : scenario === "finalize-short" ? 8 : 14;
	edit.setExpanded(!finalizationCase);
	preview(initialPreviewRows, "OLD-PREVIEW");
	const addAssistant = (n: number, prefix: string): void => {
		const assistant = new AssistantMessageComponent();
		transcript.addChild(assistant);
		assistant.updateContent(
			{
				role: "assistant",
				content: [{ type: "text", text: Array.from({ length: n }, (_, i) => `${prefix}-${i}`).join("\n\n") }],
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
			},
			{ transient: false },
		);
		assistant.markTranscriptBlockFinalized();
	};
	if (["history-tool", "history-probe", "history-cpr", "history-cursor-observe"].includes(scenario))
		addAssistant(32, "PREFACE");
	transcript.addChild(edit);
	ui.addInputListener(data => {
		observe({ kind: "input", stage, data, before: composer!.editor.getText() });
		if (data === "\x1b[17~") {
			stage = "contract";
			if (finalizationCase) {
				edit.setArgsComplete();
				edit.setExecutionStarted();
				edit.updateResult({
					content: [{ type: "text", text: "Edit completed" }],
					details: { diff: diff(initialPreviewRows, "OLD-PREVIEW"), path: "diagnostic.txt", firstChangedLine: 1 },
				});
				edit.seal();
			} else {
				preview(2, "SHORT-PREVIEW");
			}
		} else if (data === "\x1b[18~") {
			stage = "assistant";
			edit.updateResult({
				content: [{ type: "text", text: "Edit completed" }],
				details: { diff: diff(2, "FINAL-PREVIEW"), path: "diagnostic.txt", firstChangedLine: 1 },
			});
			edit.seal();
			addAssistant(2, "ASSISTANT");
		} else if (data === "\x1b[19~") {
			stage = "scroll";
			addAssistant(24, "ASSISTANT");
		} else if (data === "\x1b[20~") {
			stop();
		} else if (data === "\x1b[21~") {
			stage = "typing";
			let tick = 0;
			typingTimer = setInterval(() => {
				preview(tick % 2 === 0 ? 14 : 2, `TICK-${tick}`);
				observe({ kind: "preview", tick });
				if (++tick === 20) {
					clearInterval(typingTimer);
					typingTimer = undefined;
					stage = "typed";
					ui.requestRender();
				}
			}, 40);
		} else {
			return undefined;
		}
		ui.requestRender();
		return { consume: true };
	});
	composer.start({ playWelcomeIntro: false });
}
setTimeout(() => {
	observe({ kind: "deadline" });
	stop();
}, 90000).unref();

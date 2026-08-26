import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { AssistantMessageComponent } from "@oh-my-pi/pi-coding-agent/modes/components/assistant-message";
import { TranscriptContainer } from "@oh-my-pi/pi-coding-agent/modes/components/transcript-container";
import { initTheme } from "@oh-my-pi/pi-coding-agent/modes/theme/theme";
import {
	CURSOR_MARKER,
	ProcessTerminal,
	type TerminalFramePlan,
	type TerminalStartOptions,
	TUI,
	type ViewportSize,
} from "@oh-my-pi/pi-tui";
import { setTerminalHeadless } from "@oh-my-pi/pi-utils";

const HISTORY_SETTLE_MS = 50;
const FRAME_SETTLE_MS = 250;
const HISTORY_FILLER_COUNT = 25;
const MARKER_COUNT = 36;
const WAIT_FOR_RESIZE = Bun.env.TMUX_SCROLLBACK_WAIT_FOR_RESIZE === "1";
const FINALIZE_BEFORE_RESIZE = Bun.env.TMUX_SCROLLBACK_FINALIZE_BEFORE_RESIZE === "1";
const TRANSIENT_MARKER = "TRANSIENT-ONLY";
const FINAL_Q_ROWS = ["FINAL-Q1", "FINAL-Q2", "FINAL-Q3", "FINAL-Q4"] as const;
const WIDE_ROW_START = "WIDE-ROW-START";
const WIDE_ROW_END = "WIDE-ROW-END";
const WIDE_ROW = `${WIDE_ROW_START}-${"x".repeat(110)}-${WIDE_ROW_END}`;
const POST_RESIZE_SETTLE_MS = 500;
const configuredResizeMode = Bun.env.TMUX_SCROLLBACK_MODE;
const RESIZE_SCROLLBACK_MODE =
	configuredResizeMode === "append" || configuredResizeMode === "preserve" || configuredResizeMode === "rebuild"
		? configuredResizeMode
		: "rebuild";
const configuredResizeCount = Number(Bun.env.TMUX_SCROLLBACK_RESIZE_COUNT ?? "1");
const RESIZE_EVENT_COUNT =
	Number.isInteger(configuredResizeCount) && configuredResizeCount > 0 ? configuredResizeCount : 1;

class DriverTerminal extends ProcessTerminal {
	#resizesEnabled = false;
	#resizeListener: (() => void) | undefined;

	override start(
		onInput: (data: string) => void,
		onResize: () => void,
		onDisconnect?: () => void,
		options?: TerminalStartOptions,
	): void {
		super.start(
			onInput,
			() => {
				if (!this.#resizesEnabled) return;
				onResize();
				this.#resizeListener?.();
			},
			onDisconnect,
			options,
		);
	}

	enableResizes(): void {
		this.#resizesEnabled = true;
	}
	setResizeListener(listener: () => void): void {
		this.#resizeListener = listener;
	}
}

function makeMsg(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "mock",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

async function renderFrame(tui: TUI): Promise<void> {
	tui.requestRender();
	await Bun.sleep(FRAME_SETTLE_MS);
}

async function main(): Promise<void> {
	await initTheme(false);
	const history = [
		"PREEXISTING-HISTORY",
		...Array.from(
			{ length: HISTORY_FILLER_COUNT },
			(_value, index) => `HISTORY-FILLER-${String(index).padStart(3, "0")}`,
		),
	];
	process.stdout.write(`${history.join("\n")}\n`);
	await Bun.sleep(HISTORY_SETTLE_MS);

	const previousHeadless = setTerminalHeadless(false);
	let tui: TUI | undefined;
	try {
		const resizeGate = WAIT_FOR_RESIZE ? Promise.withResolvers<void>() : undefined;
		const terminal = new DriverTerminal();
		tui = new TUI(terminal);
		tui.setResizeScrollback(RESIZE_SCROLLBACK_MODE);
		const transcript = new TranscriptContainer();
		const assistant = new AssistantMessageComponent();
		transcript.addChild(assistant);
		tui.addChild(transcript);
		const frameProvider = {
			renderFrame(viewport: ViewportSize): TerminalFramePlan {
				const width = Math.max(1, viewport.columns);
				const rows = Math.max(0, viewport.rows);
				const chrome = FINALIZE_BEFORE_RESIZE ? ["DRIVER-STATUS", `DRIVER-EDITOR${CURSOR_MARKER}`] : [];
				const transcriptRows = Math.max(0, rows - chrome.length);
				const now = Date.now();
				return {
					history: transcript.peekFinalizedBatch(width, transcriptRows),
					viewport: [
						...transcript.renderViewport(width, transcriptRows, {
							now,
							tick: Math.floor(now / 80),
						}),
						...chrome,
					],
				};
			},
			acknowledgeHistory(id: number): void {
				transcript.acknowledgeFinalizedBatch(id);
			},
			beginHistoryReplay(): void {
				transcript.beginReplay();
			},
		};
		tui.setFrameProvider(frameProvider);
		tui.start();
		// Let the real terminal finish its startup resize/alternate-buffer transaction before streaming content.
		await renderFrame(tui);
		let resizeEvents = 0;
		terminal.setResizeListener(() => {
			resizeEvents++;
			if (resizeEvents >= RESIZE_EVENT_COUNT) resizeGate?.resolve();
		});
		terminal.enableResizes();

		const markers = Array.from(
			{ length: MARKER_COUNT },
			(_value, index) => `- [MARK-${String(index).padStart(3, "0")}][marker]`,
		).join("\n");
		const stable = `STABLE-PREFACE\n\n${markers}`;
		const unresolved = `${stable}\n\n${TRANSIENT_MARKER}`;
		const resolved = `${stable}\n\n[marker]: https://example.com\n\n${FINAL_Q_ROWS.join("  \n")}\n\n${WIDE_ROW}`;

		assistant.updateContent(makeMsg(unresolved), { transient: true });
		await renderFrame(tui);
		if (FINALIZE_BEFORE_RESIZE) {
			assistant.updateContent(makeMsg(resolved), { transient: false });
			assistant.markTranscriptBlockFinalized();
			await renderFrame(tui);
			if (resizeGate !== undefined) await resizeGate.promise;
			await Bun.sleep(POST_RESIZE_SETTLE_MS);
			await renderFrame(tui);
		} else {
			if (resizeGate !== undefined) await resizeGate.promise;
			assistant.updateContent(makeMsg(resolved), { transient: true });
			await renderFrame(tui);
			assistant.updateContent(makeMsg(resolved), { transient: false });
			assistant.markTranscriptBlockFinalized();
			await renderFrame(tui);
		}
	} finally {
		tui?.stop();
		setTerminalHeadless(previousHeadless);
	}
}

void main().catch(error => {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`tmux-scrollback-driver: ${message}\n`);
	process.exitCode = 1;
});

import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { AssistantMessageComponent } from "@oh-my-pi/pi-coding-agent/modes/components/assistant-message";
import { TranscriptContainer } from "@oh-my-pi/pi-coding-agent/modes/components/transcript-container";
import { initTheme } from "@oh-my-pi/pi-coding-agent/modes/theme/theme";
import {
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

class DriverTerminal extends ProcessTerminal {
	#resizesEnabled = false;

	override start(
		onInput: (data: string) => void,
		onResize: () => void,
		onDisconnect?: () => void,
		options?: TerminalStartOptions,
	): void {
		super.start(
			onInput,
			() => {
				if (this.#resizesEnabled) onResize();
			},
			onDisconnect,
			options,
		);
	}

	enableResizes(): void {
		this.#resizesEnabled = true;
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
		const terminal = new DriverTerminal();
		tui = new TUI(terminal);
		const transcript = new TranscriptContainer();
		const assistant = new AssistantMessageComponent();
		transcript.addChild(assistant);
		tui.addChild(transcript);
		const frameProvider = {
			renderFrame(viewport: ViewportSize): TerminalFramePlan {
				const width = Math.max(1, viewport.columns);
				const rows = Math.max(0, viewport.rows);
				const now = Date.now();
				return {
					history: transcript.peekFinalizedBatch(width, rows),
					viewport: transcript.renderViewport(width, rows, {
						now,
						tick: Math.floor(now / 80),
					}),
				};
			},
			acknowledgeHistory(id: number): void {
				transcript.acknowledgeFinalizedBatch(id);
			},
			resetHistory(): void {
				transcript.resetRetirement();
			},
		};
		tui.setFrameProvider(frameProvider);
		tui.start();
		// Let the real terminal finish its startup resize/alternate-buffer transaction before streaming content.
		await renderFrame(tui);
		terminal.enableResizes();

		const markers = Array.from(
			{ length: MARKER_COUNT },
			(_value, index) => `- [MARK-${String(index).padStart(3, "0")}][marker]`,
		).join("\n");
		const unresolved = `STABLE-PREFACE\n\n${markers}`;
		const resolved = `${unresolved}\n\n[marker]: https://example.com`;

		assistant.updateContent(makeMsg(unresolved), { transient: true });
		await renderFrame(tui);
		assistant.updateContent(makeMsg(resolved), { transient: true });
		await renderFrame(tui);
		assistant.updateContent(makeMsg(resolved), { transient: false });
		assistant.markTranscriptBlockFinalized();
		await renderFrame(tui);
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

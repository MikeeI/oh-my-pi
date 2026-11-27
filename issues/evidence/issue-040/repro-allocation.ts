/**
 * ISSUE-040 reproduction: a running tool card taller than its viewport allocation.
 *
 * Run from the repository root: `bun issues/evidence/issue-040/repro-allocation.ts`.
 * Prints (1) the tool painter's row count per allocation height and (2) the frames of a
 * 60x14 screen with a 3-row dock while a running Task card grows and shrinks around the room.
 * Defect signature: 2 painted rows for every height >= 2 below the natural height, and a
 * `╭─ Task` / `╰` stub over blank pin rows that flips back to the full card one row later.
 */
import { createRoot, resolveChildren, signal } from "@oh-my-pi/pi-tui";
import type { FramePlan, TerminalCapabilities, TerminalDriver } from "@oh-my-pi/pi-tui/driver/contract";
import { jsx } from "@oh-my-pi/pi-tui/jsx-runtime";
import { createSurface } from "@oh-my-pi/pi-tui/surface";
import { TermBackend } from "@oh-my-pi/pi-tui/term/backend";
import { renderBlock } from "@oh-my-pi/pi-tui/term/render";
import { stripEscapes } from "@oh-my-pi/pi-tui/text/ansi";
import { currentTheme } from "@oh-my-pi/pi-tui/theme/runtime";
import "../../../packages/coding-agent/src/ui/styles/tools/block";
import { initTheme } from "../../../packages/coding-agent/src/ui/theme/service";

initTheme();

/** A running tool card as the transcript mounts it (`role: omp.tool.<name>`), `rows()` body lines. */
function tool(title: string, rows: () => number) {
	return jsx("tool", {
		role: `omp.tool.${title.toLowerCase()}`,
		name: title.toLowerCase(),
		title,
		status: "running",
		frame: "card",
		term: { label: title, running: true, startedAt: Date.now() },
		children: () => Array.from({ length: rows() }, (_, i) => jsx("text", { spans: [{ t: `${title} row ${i}` }] })),
	});
}

const plain = (rows: readonly string[]): string[] => rows.map(row => stripEscapes(row).trimEnd());

createRoot(dispose => {
	const [node] = resolveChildren(() => tool("Task", () => 12))() as never[];
	for (const height of [undefined, 14, 13, 9, 2, 1]) {
		const block = renderBlock(node, 60, { theme: currentTheme(), height });
		console.log(`paint h=${height} -> ${block.rows.length} rows: ${JSON.stringify(plain(block.rows).slice(0, 3))}`);
	}
	dispose();
});

const CAPABILITIES: TerminalCapabilities = {
	truecolor: true,
	colors: 16_777_216,
	synchronizedOutput: true,
	hyperlinks: false,
	images: null,
	kittyKeyboard: false,
	bracketedPaste: true,
	background: null,
	dark: true,
	cell: null,
	multiplexer: null,
	textSizing: false,
	tsp: false,
};

/** Records frames; history is every acknowledged batch. */
class FakeDriver implements TerminalDriver {
	columns = 60;
	rows = 14;
	capabilities = CAPABILITIES;
	readonly frames: FramePlan[] = [];
	async start(): Promise<void> {}
	async stop(): Promise<void> {}
	present(frame: FramePlan): number | undefined {
		this.frames.push(frame);
		return frame.history?.id;
	}
	writeRaw(): void {}
	onInput(): () => void {
		return () => {};
	}
	onResize(): () => void {
		return () => {};
	}
	onCapabilities(): () => void {
		return () => {};
	}
	onReplay(): () => void {
		return () => {};
	}
	resetDisplay(): void {}
	replaysOnResize(): boolean {
		return true;
	}
	setTitle(): void {}
}

const taskRows = signal(3);
const driver = new FakeDriver();
const surface = createSurface(() => ({
	main: [tool("Todo", () => 2), tool("Task", taskRows)] as never,
	dock: jsx("rows", { lines: ["~dock plan~", "~dock status~", "~dock editor~"] }) as never,
}));
const backend = new TermBackend({ surface, driver, theme: () => currentTheme(), separator: () => 0 });
backend.start();
for (const rows of [3, 7, 8, 9, 7, 9]) {
	taskRows.set(rows);
	await Bun.sleep(40);
	const viewport = plain(driver.frames.at(-1)!.viewport);
	console.log(`--- Task body rows=${rows}: viewport ${viewport.length} rows`);
	console.log(viewport.map((row, i) => `  ${String(i).padStart(2)}|${row}`).join("\n"));
}
backend.stop();

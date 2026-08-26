import { describe, expect, it } from "bun:test";
import * as crypto from "node:crypto";
import * as path from "node:path";
import { $which } from "@oh-my-pi/pi-utils";

const PANE_COLUMNS = 164;
const PANE_ROWS = 19;
const PANE_EXIT_POLL_ATTEMPTS = 100;
const PANE_EXIT_POLL_MS = 50;
const LIVE_FRAME_POLL_ATTEMPTS = 1000;
const LIVE_FRAME_POLL_MS = 5;
const RESIZED_PANE_ROWS = 13;
const MARKER_COUNT = 36;
const TRANSIENT_MARKER = "TRANSIENT-ONLY";
const HISTORY_FILLER_COUNT = 25;
const REFLOW_COLUMNS = 96;
const FINAL_Q_ROWS = ["FINAL-Q1", "FINAL-Q2", "FINAL-Q3", "FINAL-Q4"] as const;
const INCIDENT_INITIAL_SIZE = [80, 46] as const;
const INCIDENT_RESIZES = [[110, 19], INCIDENT_INITIAL_SIZE] as const;
const WIDE_ROW_START = "WIDE-ROW-START";
const WIDE_ROW_END = "WIDE-ROW-END";
const RESIZE_MODES = ["rebuild", "append", "preserve"] as const;
const BURST_RESIZES = [
	[120, 13],
	[164, 25],
	[96, 15],
] as const;
const SESSION_NAME = "exactness";
const PANE_TARGET = `${SESSION_NAME}:0.0`;
const DRIVER_EXIT_MARKER = "TMUX-DRIVER-EXIT-0";
const tmuxPath = $which("tmux") ?? "";
const socketName = `omp-scrollback-${process.pid}-${crypto.randomUUID()}`;
const driverPath = path.join(import.meta.dir, "fixtures", "tmux-scrollback-driver.ts");
const pageUpDriverPath = path.join(import.meta.dir, "fixtures", "tmux-pageup-driver.ts");
const childEnv = { ...process.env };
delete childEnv.TMUX;

type TmuxResult = {
	exitCode: number;
	stdout: string;
	stderr: string;
};

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, "'\\''")}'`;
}

function countOccurrences(text: string, needle: string): number {
	return text.split(needle).length - 1;
}

function countLeadingBlankRowsAfter(text: string, marker: string): number {
	const rows = text.split(/\r?\n/u);
	const start = rows.findIndex(row => row.includes(marker));
	if (start < 0) return -1;
	let blankRows = 0;
	for (const row of rows.slice(start + 1)) {
		if (row.trim().length > 0) break;
		blankRows++;
	}
	return blankRows;
}

async function runTmux(args: readonly string[], allowFailure = false): Promise<TmuxResult> {
	const command = [tmuxPath, "-L", socketName, "-f", "/dev/null", ...args];
	const proc = Bun.spawn(command, {
		env: childEnv,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (exitCode !== 0 && !allowFailure) {
		throw new Error(`tmux command failed (${exitCode}): ${command.map(shellQuote).join(" ")}\nstderr:\n${stderr}`);
	}
	return { exitCode, stdout, stderr };
}

async function waitForPaneOutput(target: string, marker: string): Promise<string> {
	let capture = "";
	for (let attempt = 0; attempt < LIVE_FRAME_POLL_ATTEMPTS; attempt++) {
		capture = (await runTmux(["capture-pane", "-p", "-t", target])).stdout;
		if (capture.includes(marker)) return capture;
		// tmux is an external integration, so fake timers cannot advance pane output.
		await Bun.sleep(LIVE_FRAME_POLL_MS);
	}
	return capture;
}
async function waitForPaneTranscript(target: string): Promise<string> {
	let capture = "";
	for (let attempt = 0; attempt < LIVE_FRAME_POLL_ATTEMPTS; attempt++) {
		capture = (await runTmux(["capture-pane", "-p", "-S", "-", "-t", target])).stdout;
		if (capture.includes("STABLE-PREFACE") && capture.includes("MARK-000") && capture.includes("MARK-035")) {
			return capture;
		}
		// tmux output may flush after the pane process exits.
		await Bun.sleep(LIVE_FRAME_POLL_MS);
	}
	return capture;
}

async function waitForPaneDeath(target: string): Promise<string> {
	let paneState = "";
	for (let attempt = 0; attempt < PANE_EXIT_POLL_ATTEMPTS; attempt++) {
		const status = await runTmux(["display-message", "-p", "-t", target, "#{pane_dead}"]);
		paneState = status.stdout.trim();
		if (paneState === "1") return paneState;
		// tmux is an external integration, so fake timers cannot advance pane lifecycle.
		await Bun.sleep(PANE_EXIT_POLL_MS);
	}
	return paneState;
}

async function killTmuxServer(): Promise<void> {
	try {
		await runTmux(["kill-server"], true);
	} catch {
		// Best-effort cleanup: primary assertion failures must remain visible.
	}
}
function expectFinalSuffix(capture: string, exact: boolean): void {
	expect(countOccurrences(capture, DRIVER_EXIT_MARKER), capture).toBe(1);
	const ordered = [
		...Array.from({ length: MARKER_COUNT }, (_value, index) => `MARK-${String(index).padStart(3, "0")}`),
		...FINAL_Q_ROWS,
		WIDE_ROW_START,
		WIDE_ROW_END,
	];
	let previous = -1;
	for (const marker of ordered) {
		const count = countOccurrences(capture, marker);
		if (exact) {
			expect(count, `${marker} count was not exact; captured pane:\n${capture}`).toBe(1);
			const position = capture.indexOf(marker);
			expect(position, `${marker} was out of order; captured pane:\n${capture}`).toBeGreaterThan(previous);
			previous = position;
		} else {
			expect(count, `${marker} vanished; captured pane:\n${capture}`).toBeGreaterThanOrEqual(1);
		}
	}
}

type ResizeScenario = {
	sessionName: string;
	mode: (typeof RESIZE_MODES)[number];
	resizes: readonly (readonly [number, number])[];
	waitForResizeCount?: number;
	finalizeBeforeResize?: boolean;
	initialSize?: readonly [number, number];
};

type ResizeScenarioResult = {
	liveFrame: string;
	paneState: string;
	capture: string;
};

async function runResizeScenario(scenario: ResizeScenario): Promise<ResizeScenarioResult> {
	const paneTarget = `${scenario.sessionName}:0.0`;
	let liveFrame = "";
	let capture = "";
	let paneState = "";
	try {
		const [initialColumns, initialRows] = scenario.initialSize ?? [PANE_COLUMNS, PANE_ROWS];
		await runTmux([
			"new-session",
			"-d",
			"-x",
			String(initialColumns),
			"-y",
			String(initialRows),
			"-s",
			scenario.sessionName,
		]);
		await runTmux(["set-option", "-w", "-t", `${scenario.sessionName}:0`, "remain-on-exit", "on"]);
		const environment = [
			"TMUX_SCROLLBACK_WAIT_FOR_RESIZE=1",
			`TMUX_SCROLLBACK_RESIZE_COUNT=${scenario.waitForResizeCount ?? 1}`,
			`TMUX_SCROLLBACK_MODE=${scenario.mode}`,
			...(scenario.finalizeBeforeResize ? ["TMUX_SCROLLBACK_FINALIZE_BEFORE_RESIZE=1"] : []),
		].join(" ");
		const paneCommand = `${environment} ${shellQuote(process.execPath)} ${shellQuote(driverPath)} && echo ${shellQuote(DRIVER_EXIT_MARKER)}`;
		await runTmux(["respawn-pane", "-k", "-t", paneTarget, paneCommand]);

		liveFrame = await waitForPaneOutput(
			paneTarget,
			scenario.finalizeBeforeResize ? FINAL_Q_ROWS.at(-1)! : TRANSIENT_MARKER,
		);
		for (const [columns, rows] of scenario.resizes) {
			await runTmux(["resize-window", "-x", String(columns), "-y", String(rows), "-t", `${scenario.sessionName}:0`]);
			// tmux delivers SIGWINCH asynchronously; let each real resize reach the pane before the next burst step.
			await Bun.sleep(100);
		}
		paneState = await waitForPaneDeath(paneTarget);
		capture = await waitForPaneTranscript(paneTarget);
		return { liveFrame, paneState, capture };
	} finally {
		await killTmuxServer();
	}
}

describe.skipIf(process.platform === "win32" || !tmuxPath)("tmux scrollback exactness", () => {
	it("records one exact final assistant answer without erasing prior pane history", async () => {
		let capture = "";
		try {
			await runTmux(["new-session", "-d", "-x", String(PANE_COLUMNS), "-y", String(PANE_ROWS), "-s", SESSION_NAME]);
			await runTmux(["set-option", "-w", "-t", `${SESSION_NAME}:0`, "remain-on-exit", "on"]);
			const paneCommand = `${shellQuote(process.execPath)} ${shellQuote(driverPath)} && echo ${shellQuote(DRIVER_EXIT_MARKER)}`;
			await runTmux(["respawn-pane", "-k", "-t", PANE_TARGET, paneCommand]);

			const paneState = await waitForPaneDeath(PANE_TARGET);
			capture = await waitForPaneTranscript(PANE_TARGET);
			expect(paneState, `pane did not exit; captured pane:\n${capture}`).toBe("1");
			expect(countOccurrences(capture, "PREEXISTING-HISTORY"), capture).toBe(1);
			expect(countOccurrences(capture, "STABLE-PREFACE"), capture).toBe(1);
			expect(countLeadingBlankRowsAfter(capture, "HISTORY-FILLER-024"), capture).toBe(0);
			expectFinalSuffix(capture, true);
		} finally {
			await killTmuxServer();
		}
	}, 15_000);

	it("retains pane history during a configured rebuild on live tmux resize", async () => {
		const { liveFrame, paneState, capture } = await runResizeScenario({
			sessionName: "resize",
			mode: "rebuild",
			resizes: [[PANE_COLUMNS, RESIZED_PANE_ROWS]],
		});
		expect(liveFrame).toContain(TRANSIENT_MARKER);
		expect(paneState, `pane did not exit; captured pane:\n${capture}`).toBe("1");
		expect(countOccurrences(capture, TRANSIENT_MARKER), capture).toBe(0);
		expect(countLeadingBlankRowsAfter(capture, "HISTORY-FILLER-024"), capture).toBe(0);
		expect(countOccurrences(capture, "PREEXISTING-HISTORY"), capture).toBe(1);
		for (let index = 0; index < HISTORY_FILLER_COUNT; index++) {
			const marker = `HISTORY-FILLER-${String(index).padStart(3, "0")}`;
			expect(countOccurrences(capture, marker), `${marker} was lost or duplicated; captured pane:\n${capture}`).toBe(
				1,
			);
		}
		expectFinalSuffix(capture, false);
	}, 15_000);
	it("retains transient and finalized content across a real width reflow", async () => {
		const { liveFrame, paneState, capture } = await runResizeScenario({
			sessionName: "width-reflow",
			mode: "rebuild",
			resizes: [[REFLOW_COLUMNS, PANE_ROWS]],
		});
		expect(liveFrame).toContain(TRANSIENT_MARKER);
		expect(paneState, `pane did not exit; captured pane:\n${capture}`).toBe("1");
		expect(countOccurrences(capture, TRANSIENT_MARKER), capture).toBe(0);
		expect(countLeadingBlankRowsAfter(capture, "HISTORY-FILLER-024"), capture).toBe(0);
		expect(countOccurrences(capture, "PREEXISTING-HISTORY"), capture).toBe(1);
		for (let index = 0; index < HISTORY_FILLER_COUNT; index++) {
			const marker = `HISTORY-FILLER-${String(index).padStart(3, "0")}`;
			expect(countOccurrences(capture, marker), `${marker} was lost or duplicated; captured pane:\n${capture}`).toBe(
				1,
			);
		}
		expectFinalSuffix(capture, false);
	}, 15_000);

	for (const mode of RESIZE_MODES) {
		it(`retains exact scrollback in ${mode} mode during resize`, async () => {
			const { paneState, capture } = await runResizeScenario({
				sessionName: `mode-${mode}`,
				mode,
				resizes: [[PANE_COLUMNS, RESIZED_PANE_ROWS]],
			});
			expect(paneState, `pane did not exit; captured pane:\n${capture}`).toBe("1");
			expect(countOccurrences(capture, TRANSIENT_MARKER), capture).toBe(0);
			expect(countLeadingBlankRowsAfter(capture, "HISTORY-FILLER-024"), capture).toBe(0);
			expect(countOccurrences(capture, "PREEXISTING-HISTORY"), capture).toBe(1);
			for (let index = 0; index < HISTORY_FILLER_COUNT; index++) {
				const marker = `HISTORY-FILLER-${String(index).padStart(3, "0")}`;
				expect(
					countOccurrences(capture, marker),
					`${marker} was lost or duplicated in ${mode} mode; captured pane:\n${capture}`,
				).toBe(1);
			}
			expectFinalSuffix(capture, false);
		}, 15_000);
	}

	it("keeps scrollback stable across a coalesced resize burst", async () => {
		const { paneState, capture } = await runResizeScenario({
			sessionName: "resize-burst",
			mode: "rebuild",
			resizes: BURST_RESIZES,
			waitForResizeCount: 1,
		});
		expect(paneState, `pane did not exit; captured pane:\n${capture}`).toBe("1");
		expect(countOccurrences(capture, TRANSIENT_MARKER), capture).toBe(0);
		expect(countLeadingBlankRowsAfter(capture, "HISTORY-FILLER-024"), capture).toBe(0);
		expect(countOccurrences(capture, "PREEXISTING-HISTORY"), capture).toBe(1);
		for (let index = 0; index < HISTORY_FILLER_COUNT; index++) {
			const marker = `HISTORY-FILLER-${String(index).padStart(3, "0")}`;
			expect(countOccurrences(capture, marker), `${marker} was lost or duplicated; captured pane:\n${capture}`).toBe(
				1,
			);
		}
		expectFinalSuffix(capture, false);
	}, 15_000);

	it("retains a finalized Assistant suffix across the observed mixed-geometry cycle", async () => {
		const { liveFrame, paneState, capture } = await runResizeScenario({
			sessionName: "post-finalize-mixed-resize",
			mode: "rebuild",
			initialSize: INCIDENT_INITIAL_SIZE,
			resizes: INCIDENT_RESIZES,
			waitForResizeCount: INCIDENT_RESIZES.length,
			finalizeBeforeResize: true,
		});
		expect(liveFrame).toContain(FINAL_Q_ROWS.at(-1)!);
		expect(paneState, `pane did not exit; captured pane:\n${capture}`).toBe("1");
		expect(countOccurrences(capture, TRANSIENT_MARKER), capture).toBe(0);
		expectFinalSuffix(capture, false);
	}, 15_000);

	it("opens real tmux history on empty-editor PageUp without hijacking drafts", async () => {
		const sessionName = "pageup";
		const paneTarget = `${sessionName}:0.0`;
		try {
			await runTmux(["new-session", "-d", "-x", "100", "-y", String(PANE_ROWS), "-s", sessionName]);
			await runTmux(["set-option", "-w", "-t", `${sessionName}:0`, "remain-on-exit", "on"]);
			const paneCommand = `${shellQuote(process.execPath)} ${shellQuote(pageUpDriverPath)}`;
			await runTmux(["respawn-pane", "-k", "-t", paneTarget, paneCommand]);

			const readyFrame = await waitForPaneOutput(paneTarget, "PAGEUP-READY");
			expect(readyFrame, "PageUp fixture did not become ready").toContain("PAGEUP-READY");
			const historySize = await runTmux(["display-message", "-p", "-t", paneTarget, "#{history_size}"]);
			expect(Number.parseInt(historySize.stdout, 10)).toBeGreaterThan(0);

			await runTmux(["send-keys", "-t", paneTarget, "PageUp"]);
			let copyMode = 0;
			let scrollPosition = 0;
			for (let attempt = 0; attempt < LIVE_FRAME_POLL_ATTEMPTS; attempt++) {
				const state = await runTmux([
					"display-message",
					"-p",
					"-t",
					paneTarget,
					"#{pane_in_mode} #{scroll_position}",
				]);
				[copyMode = 0, scrollPosition = 0] = state.stdout
					.trim()
					.split(/\s+/, 2)
					.map(value => Number.parseInt(value, 10));
				if (copyMode === 1 && scrollPosition > 0) break;
				await Bun.sleep(LIVE_FRAME_POLL_MS);
			}
			expect(copyMode).toBe(1);
			expect(scrollPosition).toBeGreaterThan(0);
			const historyCapture = (await runTmux(["capture-pane", "-p", "-S", "-", "-t", paneTarget])).stdout;
			expect(countOccurrences(historyCapture, "PAGEUP-HISTORY-000")).toBe(1);

			await runTmux(["send-keys", "-X", "-t", paneTarget, "cancel"]);
			await runTmux(["send-keys", "-t", paneTarget, "-l", "PAGEUP-DRAFT"]);
			const draftFrame = await waitForPaneOutput(paneTarget, "PAGEUP-DRAFT");
			expect(draftFrame).toContain("PAGEUP-DRAFT");
			await runTmux(["send-keys", "-t", paneTarget, "-l", "AFTER"]);
			const handledDraftFrame = await waitForPaneOutput(paneTarget, "PAGEUP-DRAFTAFTER");
			expect(handledDraftFrame).toContain("PAGEUP-DRAFTAFTER");
			const draftMode = await runTmux(["display-message", "-p", "-t", paneTarget, "#{pane_in_mode}"]);
			expect(draftMode.stdout.trim()).toBe("0");
		} finally {
			await killTmuxServer();
		}
	}, 15_000);
});

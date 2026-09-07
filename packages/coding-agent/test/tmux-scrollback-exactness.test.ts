import { describe, expect, it } from "bun:test";
import * as crypto from "node:crypto";
import * as path from "node:path";
import { $which } from "@oh-my-pi/pi-utils";

const PANE_COLUMNS = 164;
const PANE_ROWS = 19;
const RESIZED_PANE_ROWS = 13;
const REFLOWED_PANE_COLUMNS = 96;
const PANE_EXIT_POLL_ATTEMPTS = 100;
const PANE_EXIT_POLL_MS = 50;
const LIVE_FRAME_POLL_ATTEMPTS = 1000;
const LIVE_FRAME_POLL_MS = 5;
const MARKER_COUNT = 36;
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

async function waitForPaneOutput(target: string, marker: string, includeHistory = true): Promise<string> {
	let capture = "";
	for (let attempt = 0; attempt < LIVE_FRAME_POLL_ATTEMPTS; attempt++) {
		const args = includeHistory
			? ["capture-pane", "-p", "-S", "-", "-t", target]
			: ["capture-pane", "-p", "-t", target];
		capture = (await runTmux(args)).stdout;
		if (capture.includes(marker)) return capture;
		await Bun.sleep(LIVE_FRAME_POLL_MS);
	}
	return capture;
}

async function waitForPaneTranscript(target: string): Promise<string> {
	let capture = "";
	for (let attempt = 0; attempt < LIVE_FRAME_POLL_ATTEMPTS; attempt++) {
		capture = (await runTmux(["capture-pane", "-p", "-S", "-", "-t", target])).stdout;
		if (capture.includes(DRIVER_EXIT_MARKER) && capture.includes("MARK-035") && capture.includes("FINAL-Q4")) {
			return capture;
		}
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
		await Bun.sleep(PANE_EXIT_POLL_MS);
	}
	return paneState;
}

async function killTmuxServer(): Promise<void> {
	try {
		await runTmux(["kill-server"], true);
	} catch {
		// Best-effort cleanup keeps the primary assertion failure visible.
	}
}

async function startTranscriptPane(sessionName: string): Promise<string> {
	const paneTarget = `${sessionName}:0.0`;
	await runTmux(["new-session", "-d", "-x", String(PANE_COLUMNS), "-y", String(PANE_ROWS), "-s", sessionName]);
	await runTmux(["set-option", "-w", "-t", `${sessionName}:0`, "remain-on-exit", "on"]);
	const paneCommand = `${shellQuote(process.execPath)} ${shellQuote(driverPath)} && echo ${shellQuote(DRIVER_EXIT_MARKER)}`;
	await runTmux(["respawn-pane", "-k", "-t", paneTarget, paneCommand]);
	return paneTarget;
}

function expectFinalTranscript(capture: string, exact: boolean): void {
	expect(countOccurrences(capture, DRIVER_EXIT_MARKER), capture).toBe(1);
	expect(countOccurrences(capture, "PREEXISTING-HISTORY"), capture).toBe(1);
	for (let index = 0; index < MARKER_COUNT; index++) {
		const marker = `MARK-${String(index).padStart(3, "0")}`;
		const count = countOccurrences(capture, marker);
		if (exact) expect(count, `${marker} count was not exact; captured pane:\n${capture}`).toBe(1);
		else expect(count, `${marker} vanished; captured pane:\n${capture}`).toBeGreaterThanOrEqual(1);
	}
	for (const marker of ["FINAL-Q1", "FINAL-Q2", "FINAL-Q3", "FINAL-Q4"]) {
		const count = countOccurrences(capture, marker);
		if (exact) expect(count, `${marker} count was not exact; captured pane:\n${capture}`).toBe(1);
		else expect(count, `${marker} vanished; captured pane:\n${capture}`).toBeGreaterThanOrEqual(1);
	}
	expect(capture).toContain("WIDE-ROW-START");
	expect(capture.replace(/\n ?/g, "")).toContain("WIDE-ROW-END");
}

describe.skipIf(process.platform === "win32" || !tmuxPath)("tmux scrollback exactness", () => {
	it("records one exact final Assistant tail without blank-first loss", async () => {
		let capture = "";
		try {
			const paneTarget = await startTranscriptPane("exactness");
			const paneState = await waitForPaneDeath(paneTarget);
			capture = await waitForPaneTranscript(paneTarget);
			expect(paneState, `pane did not exit; captured pane:\n${capture}`).toBe("1");
			expectFinalTranscript(capture, true);
			const capturedRows = capture.split("\n");
			const fillerRow = capturedRows.findIndex(row => row.includes("HISTORY-FILLER-024"));
			const transcriptRow = capturedRows.findIndex(row => row.includes("STABLE-PREFACE"));
			expect(transcriptRow - fillerRow).toBe(1);
		} finally {
			await killTmuxServer();
		}
	}, 15_000);

	it("preserves every finalized row across a live height shrink", async () => {
		let capture = "";
		try {
			const sessionName = "resize";
			const paneTarget = await startTranscriptPane(sessionName);
			const liveFrame = await waitForPaneOutput(paneTarget, "TRANSIENT-LIVE", false);
			expect(liveFrame, "transient marker did not remain in the live viewport").toContain("TRANSIENT-LIVE");
			await runTmux([
				"resize-window",
				"-x",
				String(PANE_COLUMNS),
				"-y",
				String(RESIZED_PANE_ROWS),
				"-t",
				`${sessionName}:0`,
			]);
			const paneState = await waitForPaneDeath(paneTarget);
			capture = await waitForPaneTranscript(paneTarget);
			expect(paneState, `pane did not exit; captured pane:\n${capture}`).toBe("1");
			expectFinalTranscript(capture, false);
		} finally {
			await killTmuxServer();
		}
	}, 15_000);

	it("preserves both ends of a long finalized row across width reflow", async () => {
		let capture = "";
		try {
			const sessionName = "reflow";
			const paneTarget = await startTranscriptPane(sessionName);
			await waitForPaneOutput(paneTarget, "TRANSIENT-LIVE", false);
			await runTmux([
				"resize-window",
				"-x",
				String(REFLOWED_PANE_COLUMNS),
				"-y",
				String(PANE_ROWS),
				"-t",
				`${sessionName}:0`,
			]);
			const paneState = await waitForPaneDeath(paneTarget);
			capture = await waitForPaneTranscript(paneTarget);
			expect(paneState, `pane did not exit; captured pane:\n${capture}`).toBe("1");
			expectFinalTranscript(capture, false);
		} finally {
			await killTmuxServer();
		}
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

import * as path from "node:path";

// Finite evidence capture, not a permanent test or a source/runtime patch.
const socket = `issue-023-followup-${process.pid}`;
const DEFAULT_OUTPUT_DIRECTORY = path.join(import.meta.dir, "followup");
const output = path.resolve(process.env.AUDIT_OUTPUT ?? DEFAULT_OUTPUT_DIRECTORY);
const driver = path.join(import.meta.dir, "followup-driver.ts");
const BASE_SCENARIOS = ["tool", "typing", "raw-scroll"];
const scenarios = process.argv.length > 2 ? process.argv.slice(2) : BASE_SCENARIOS;
if (
	scenarios.some(
		scenario =>
			![
				...BASE_SCENARIOS,
				"finalize",
				"finalize-short",
				"history-tool",
				"history-probe",
				"history-cpr",
				"history-cursor-observe",
			].includes(scenario),
	)
)
	throw new Error("Unknown scenario");
const env = { ...process.env };
delete env.TMUX;
const commands: { args: string[]; at: number }[] = [];
const results: object[] = [];
const run = async (...args: string[]): Promise<string> => {
	commands.push({ args, at: Date.now() });
	const child = Bun.spawn(
		["tmux", ...(process.env.AUDIT_TMUX_DEBUG === "1" ? ["-vv"] : []), "-L", socket, "-f", "/dev/null", ...args],
		{ env, cwd: output, stdout: "pipe", stderr: "pipe" },
	);
	const [text, error, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (code !== 0) throw new Error(`tmux ${args.join(" ")}: ${code}: ${error}`);
	return text;
};
const wait = async (name: string, stage: string, width: number, height: number): Promise<void> => {
	const deadline = Date.now() + 12000;
	while (Date.now() < deadline) {
		const state = (await run("display-message", "-p", "-t", name, "#{pane_dead}|#{pane_title}")).trim();
		if (state.startsWith("1|")) throw new Error(`dead pane ${name}: ${await run("capture-pane", "-p", "-t", name)}`);
		if (state.includes(`AUDIT-${stage}-${width}x${height}-normal-`)) return;
		await Bun.sleep(20);
	}
	throw new Error(`paint deadline: ${name} ${stage}`);
};
interface Paint {
	kind: string;
	stage: string;
	alt: boolean;
	viewport: string[];
	history: string[];
	draft?: string;
	debug?: { cursor?: { y: number } };
}
const capture = async (name: string, stage: string): Promise<void> => {
	const live = await run("capture-pane", "-p", "-t", name);
	const full = await run("capture-pane", "-p", "-S", "-", "-t", name);
	const historySize = Number((await run("display-message", "-p", "-t", name, "#{history_size}")).trim());
	const events = Bun.JSONL.parse(await Bun.file(path.join(output, `${name}.jsonl`)).text()) as Paint[];
	const paint = events.findLast(event => event.kind === "paint" && !event.alt);
	if (!paint) throw new Error(`missing paint: ${name}`);
	const history = full.split("\n").slice(0, historySize).join("\n");
	const snapshot = {
		name,
		stage,
		live,
		full,
		historySize,
		history,
		paint: {
			...paint,
			viewport: paint.viewport.map(row => Bun.stripANSI(row)),
			history: paint.history.map(row => Bun.stripANSI(row)),
		},
	};
	await Bun.write(path.join(output, `${name}-${stage}.json`), JSON.stringify(snapshot, null, 2) + "\n");
	const summary = {
		name,
		stage,
		draft: paint.draft,
		viewportRows: paint.viewport.length,
		historySize,
		physicalStatus: live.split("AUDIT-STATUS").length - 1,
		plannedStatus: paint.viewport.filter(row => row.includes("AUDIT-STATUS")).length,
		oldPreviewLive: live.includes("OLD-PREVIEW"),
		oldPreviewPlanned: paint.viewport.some(row => row.includes("OLD-PREVIEW")),
		oldPreviewHistory: history.includes("OLD-PREVIEW"),
		oldLiveHistory: history.includes("OLD-LIVE"),
	};
	results.push(summary);
	console.log(JSON.stringify(summary));
};
// A repeated command must not replace the retained evidence it is meant to verify.
for (const scenario of scenarios) {
	for (const suffix of ["control", "resize"]) {
		const existing = path.join(output, `${scenario}-${suffix}.jsonl`);
		if (await Bun.file(existing).exists())
			throw new Error(`Evidence exists: ${existing}; select a fresh AUDIT_OUTPUT directory`);
	}
}
try {
	for (const scenario of scenarios) {
		for (const resized of [false, true]) {
			const name = `${scenario}-${resized ? "resize" : "control"}`;
			const width = 79;
			const height = scenario === "raw-scroll" ? 19 : 39;
			const logfile = path.join(output, `${name}.jsonl`);
			await Bun.write(logfile, "");
			await run(
				"new-session",
				"-d",
				"-x",
				String(width),
				"-y",
				String(height),
				"-s",
				name,
				`AUDIT_LOG='${logfile}' AUDIT_SCENARIO='${scenario}' '${process.execPath}' '${driver}'`,
			);
			await run("set-option", "-w", "-t", name, "remain-on-exit", "on");
			await wait(name, "initial", width, height);
			await capture(name, "initial");
			if (resized) {
				await run("resize-window", "-t", name, "-x", String(width), "-y", String(height - 6));
				await wait(name, "initial", width, height - 6);
				await capture(name, "shrunk");
				await run("resize-window", "-t", name, "-x", String(width), "-y", String(height));
				await wait(name, "initial", width, height);
				await capture(name, "settled");
			}
			if (scenario === "typing") {
				await run("send-keys", "-t", name, "F10");
				for (const chunk of [
					"INPUT-ONCE-",
					"alpha ",
					"beta ",
					"gamma ",
					"delta ",
					"epsilon ",
					"zeta ",
					"eta ",
					"theta ",
					"iota ",
					"kappa ",
					"lambda ",
					"mu ",
					"nu ",
					"xi ",
					"omicron ",
					"pi ",
					"rho ",
					"sigma ",
					"END-ONCE",
				]) {
					await run("send-keys", "-t", name, "-l", chunk);
					await Bun.sleep(35);
				}
				await wait(name, "typed", width, height);
				await Bun.sleep(100);
				await capture(name, "typed");
				await run("send-keys", "-t", name, "C-u");
				await Bun.sleep(100);
				await capture(name, "cleared");
			}
			await run("send-keys", "-t", name, "F6");
			await wait(name, "contract", width, height);
			await capture(name, "contract");
			await run("send-keys", "-t", name, "F7");
			await wait(name, scenario === "raw-scroll" ? "scroll" : "assistant", width, height);
			await Bun.sleep(100);
			await capture(name, scenario === "raw-scroll" ? "scroll" : "assistant");
			await run("send-keys", "-t", name, "F8");
			await wait(name, scenario === "raw-scroll" ? "grow" : "scroll", width, height);
			await Bun.sleep(100);
			await capture(name, scenario === "raw-scroll" ? "grow" : "scroll");
			await run("send-keys", "-t", name, "F9");
		}
	}
} finally {
	await Bun.write(
		path.join(output, `commands-${scenarios.join("-")}.json`),
		JSON.stringify({ socket, commands, results }, null, 2) + "\n",
	);
	await run("kill-server");
}

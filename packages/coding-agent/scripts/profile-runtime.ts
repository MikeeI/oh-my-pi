#!/usr/bin/env bun

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getReportsDir } from "@oh-my-pi/pi-utils";

const packageDir = path.join(import.meta.dir, "..");
const repoRoot = path.join(packageDir, "..", "..");
const CPU_PROFILE_INTERVAL_US = 500;
const HEAP_PROFILE_INTERVAL_BYTES = 65_536;
const TIMING_SCENARIO_REPETITIONS = 5;
const TOP_BUNDLE_INPUTS = 25;
const lifecycleTests = [
	"test/agent-session-dispose-releases-memory.test.ts",
	"test/agent-session-dispose-concurrent.test.ts",
	"test/status-line-dispose-async-leak.test.ts",
	"test/tools/browser-lifecycle-leak.test.ts",
	"test/eval/runtime-global-dispose.test.ts",
] as const;

interface AuditOptions {
	readonly outputDir: string;
}

interface CommandResult {
	readonly durationMs: number;
	readonly exitCode: number;
	readonly stderr: string;
	readonly stdout: string;
}

interface ScenarioRecord {
	readonly command: readonly string[];
	readonly durationMs: number;
	readonly name: string;
	readonly stderrLog: string;
	readonly stdoutLog: string;
}

interface CpuSummary {
	readonly duration: string;
	readonly samples: number;
	readonly topFunctions: string;
}

interface HeapScenarioResult {
	readonly iterations: number;
	readonly sampleInterval: number;
	readonly transcriptBytes: number;
	readonly samples: readonly MemorySample[];
}

interface MemorySample {
	readonly iteration: number;
	readonly heapUsed: number;
}

interface TestTimings {
	readonly files: Record<string, number>;
}

function parseOptions(args: readonly string[]): AuditOptions {
	if (args.length === 0) {
		const timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
		return { outputDir: path.join(getReportsDir(), "runtime-audit", timestamp) };
	}
	if (args.length !== 2 || args[0] !== "--out-dir" || !args[1]) {
		throw new Error("Usage: bun run profile:runtime [--out-dir <path>]");
	}
	return { outputDir: path.resolve(args[1]) };
}

async function runCommand(
	command: readonly string[],
	cwd: string,
	env: NodeJS.ProcessEnv = Bun.env,
): Promise<CommandResult> {
	const startedAt = performance.now();
	const process = Bun.spawn([...command], {
		cwd,
		env,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(process.stdout as ReadableStream<Uint8Array>).text(),
		new Response(process.stderr as ReadableStream<Uint8Array>).text(),
		process.exited,
	]);
	return { durationMs: performance.now() - startedAt, exitCode, stdout, stderr };
}

async function runScenario(
	name: string,
	command: readonly string[],
	cwd: string,
	outputDir: string,
	env: NodeJS.ProcessEnv = Bun.env,
): Promise<ScenarioRecord> {
	process.stdout.write(`running ${name}... `);
	const result = await runCommand(command, cwd, env);
	const stdoutLog = path.join(outputDir, `${name}.stdout.log`);
	const stderrLog = path.join(outputDir, `${name}.stderr.log`);
	await Promise.all([Bun.write(stdoutLog, result.stdout), Bun.write(stderrLog, result.stderr)]);
	if (result.exitCode !== 0) {
		process.stdout.write("failed\n");
		throw new Error(`${name} exited ${result.exitCode}; see ${stderrLog}`);
	}
	process.stdout.write(`${result.durationMs.toFixed(0)}ms\n`);
	return {
		command,
		durationMs: result.durationMs,
		name,
		stderrLog: path.basename(stderrLog),
		stdoutLog: path.basename(stdoutLog),
	};
}

function cpuCommand(profileDir: string, profileName: string, args: readonly string[]): string[] {
	return [
		"bun",
		"--cpu-prof",
		"--cpu-prof-md",
		`--cpu-prof-name=${profileName}`,
		`--cpu-prof-dir=${profileDir}`,
		`--cpu-prof-interval=${CPU_PROFILE_INTERVAL_US}`,
		"src/cli.ts",
		...args,
	];
}

function formatBytes(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unit = units[0];
	for (let index = 1; index < units.length && value >= 1024; index++) {
		value /= 1024;
		unit = units[index];
	}
	return `${value.toFixed(value >= 10 || unit === "B" ? 0 : 1)} ${unit}`;
}

function renderBundleSummary(metafile: Bun.BuildMetafile): string {
	const outputContributions = Object.values(metafile.outputs).flatMap(output =>
		Object.entries(output.inputs).map(([input, contribution]) => ({ input, bytes: contribution.bytesInOutput })),
	);
	const aggregated = new Map<string, number>();
	for (const { input, bytes } of outputContributions) aggregated.set(input, (aggregated.get(input) ?? 0) + bytes);
	const ranked = [...aggregated].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
	const totalInputBytes = Object.values(metafile.inputs).reduce((total, input) => total + input.bytes, 0);
	const totalOutputBytes = Object.values(metafile.outputs).reduce((total, output) => total + output.bytes, 0);
	const lines = [
		"# Compiled bundle summary",
		"",
		`- Input files: ${Object.keys(metafile.inputs).length}, totaling ${formatBytes(totalInputBytes)} before bundling.`,
		`- Output files: ${Object.keys(metafile.outputs).length}, totaling ${formatBytes(totalOutputBytes)}.`,
		"",
		"## Largest output contributions",
		"",
		"| Rank | Bytes in output | Input |",
		"|---:|---:|---|",
	];
	for (const [index, [input, bytes]] of ranked.slice(0, TOP_BUNDLE_INPUTS).entries()) {
		lines.push(`| ${index + 1} | ${formatBytes(bytes)} | \`${input.replaceAll("|", "\\|")}\` |`);
	}
	return `${lines.join("\n")}\n`;
}

async function assertArtifacts(outputDir: string, relativePaths: readonly string[]): Promise<void> {
	for (const relativePath of relativePaths) {
		const artifactPath = path.join(outputDir, relativePath);
		const stat = await fs.stat(artifactPath).catch((error: unknown) => {
			throw new Error(`Audit artifact is missing: ${artifactPath}`, { cause: error });
		});
		if (!stat.isFile() || stat.size === 0) throw new Error(`Audit artifact is empty or not a file: ${artifactPath}`);
	}
}

function parseCpuSummary(profile: string, profilePath: string): CpuSummary {
	const metrics = profile.match(/^\| ([^|]+) \| (\d+) \| [^|]+ \| \d+ \|$/m);
	const topFunctions = profile.match(/^\*\*Top 10:\*\* (.+)$/m)?.[1];
	if (!metrics || !topFunctions) throw new Error(`Cannot parse Bun CPU profile summary: ${profilePath}`);
	return { duration: metrics[1].trim(), samples: Number.parseInt(metrics[2], 10), topFunctions };
}

function formatDelta(bytes: number): string {
	const sign = bytes >= 0 ? "+" : "-";
	return `${sign}${formatBytes(Math.abs(bytes))}`;
}

async function renderAuditSummary(
	outputDir: string,
	metafile: Bun.BuildMetafile,
	heapScenario: HeapScenarioResult,
	timings: TestTimings,
): Promise<string> {
	const cpuProfiles = [
		["Cold pre-paint boot", "cpu/boot.md"],
		["Smoke test", "cpu/smoke.md"],
		["Prompt inspection", "cpu/system-prompt.md"],
	] as const;
	const cpuRows = await Promise.all(
		cpuProfiles.map(async ([scenario, relativePath]) => {
			const summary = parseCpuSummary(await Bun.file(path.join(outputDir, relativePath)).text(), relativePath);
			return `| ${scenario} | ${summary.duration} | ${summary.samples} | ${summary.topFunctions} |`;
		}),
	);
	const warmSample = heapScenario.samples.find(
		sample => sample.iteration >= Math.floor(heapScenario.iterations * 0.4),
	);
	const finalSample = heapScenario.samples.at(-1);
	if (!warmSample || !finalSample) throw new Error("Heap scenario returned no comparable post-warmup samples");
	const heapProfile = await Bun.file(path.join(outputDir, "heap", "lifecycle.md")).text();
	const retainedHeap = heapProfile.match(/^\| Total Heap Size \| ([^(]+) \(/m)?.[1]?.trim();
	if (!retainedHeap) throw new Error("Cannot parse Bun heap profile summary");
	const timingRows = Object.entries(timings.files)
		.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
		.map(([file, durationMs]) => `| ${durationMs} ms | \`${file}\` |`);
	const totalOutputBytes = Object.values(metafile.outputs).reduce((total, output) => total + output.bytes, 0);
	const contributions = Object.values(metafile.outputs).flatMap(output =>
		Object.entries(output.inputs).map(([input, contribution]) => ({ input, bytes: contribution.bytesInOutput })),
	);
	const largestContribution = contributions.sort(
		(left, right) => right.bytes - left.bytes || left.input.localeCompare(right.input),
	)[0];
	if (!largestContribution) throw new Error("Compiled bundle metafile contains no input contributions");
	const largestShare = (largestContribution.bytes / totalOutputBytes) * 100;
	return `${[
		"# MOMP runtime audit",
		"",
		"## CPU profiles",
		"",
		"| Scenario | Profiled duration | Samples | Top functions |",
		"|---|---:|---:|---|",
		...cpuRows,
		"",
		"## Heap lifecycle",
		"",
		`- Exercised ${heapScenario.iterations} disposed sessions with ${formatBytes(heapScenario.transcriptBytes)} transcripts.`,
		`- Final retained heap snapshot: ${retainedHeap}.`,
		`- Forced-GC heap change from iteration ${warmSample.iteration} to ${finalSample.iteration}: ${formatDelta(finalSample.heapUsed - warmSample.heapUsed)}.`,
		"",
		"## Lifecycle test timings",
		"",
		"| Duration | Test file |",
		"|---:|---|",
		...timingRows,
		"",
		"## Compiled bundle",
		"",
		`- Output size: ${formatBytes(totalOutputBytes)}.`,
		`- Largest contribution: \`${largestContribution.input}\` at ${formatBytes(largestContribution.bytes)} (${largestShare.toFixed(1)}%).`,
		"- See `bundle-summary.md` for the top 25 inputs and `bundle-metafile.json` for the complete graph.",
		"",
	].join("\n")}\n`;
}

async function main(): Promise<void> {
	const { outputDir } = parseOptions(Bun.argv.slice(2));
	const cpuDir = path.join(outputDir, "cpu");
	const heapDir = path.join(outputDir, "heap");
	await Promise.all([fs.mkdir(cpuDir, { recursive: true }), fs.mkdir(heapDir, { recursive: true })]);

	const scenarios: ScenarioRecord[] = [];
	scenarios.push(
		await runScenario("cpu-boot", cpuCommand(cpuDir, "boot", []), packageDir, outputDir, {
			...Bun.env,
			PI_STRICT_EDIT_MODE: "1",
			PI_TIMING: "x",
		}),
	);
	scenarios.push(await runScenario("cpu-smoke", cpuCommand(cpuDir, "smoke", ["--smoke-test"]), packageDir, outputDir));
	scenarios.push(
		await runScenario(
			"cpu-system-prompt",
			cpuCommand(cpuDir, "system-prompt", ["system-prompt", "inspect", "--cwd", repoRoot, "--breakdown", "--json"]),
			packageDir,
			outputDir,
		),
	);

	const heapProfile = "lifecycle.md";
	scenarios.push(
		await runScenario(
			"heap-lifecycle",
			[
				"bun",
				"--heap-prof-md",
				`--heap-prof-name=${heapProfile}`,
				`--heap-prof-dir=${heapDir}`,
				`--heap-prof-interval=${HEAP_PROFILE_INTERVAL_BYTES}`,
				"scripts/profile-runtime-heap-scenario.ts",
			],
			packageDir,
			outputDir,
		),
	);

	const timingsPath = path.join(outputDir, "test-timings.json");
	scenarios.push(
		await runScenario(
			"test-timings",
			[
				"bun",
				"test",
				"--isolate",
				`--rerun-each=${TIMING_SCENARIO_REPETITIONS}`,
				`--timings=${timingsPath}`,
				"--update-timings",
				...lifecycleTests,
			],
			packageDir,
			outputDir,
		),
	);

	const metafilePath = path.join(outputDir, "bundle-metafile.json");
	scenarios.push(
		await runScenario(
			"bundle-build",
			["bun", "scripts/build-binary.ts", "--metafile", metafilePath],
			packageDir,
			outputDir,
		),
	);
	const metafile = (await Bun.file(metafilePath).json()) as Bun.BuildMetafile;
	await Bun.write(path.join(outputDir, "bundle-summary.md"), renderBundleSummary(metafile));
	const heapSamplesPath = path.join(outputDir, "heap-lifecycle.stdout.log");
	const heapScenario = (await Bun.file(heapSamplesPath).json()) as HeapScenarioResult;
	const timings = (await Bun.file(timingsPath).json()) as TestTimings;
	await Bun.write(
		path.join(outputDir, "audit-summary.md"),
		await renderAuditSummary(outputDir, metafile, heapScenario, timings),
	);

	const artifacts = {
		auditSummary: "audit-summary.md",
		bundleMetafile: path.basename(metafilePath),
		bundleSummary: "bundle-summary.md",
		cpuProfiles: ["cpu/boot.md", "cpu/smoke.md", "cpu/system-prompt.md"],
		cpuRawProfiles: ["cpu/boot.cpuprofile", "cpu/smoke.cpuprofile", "cpu/system-prompt.cpuprofile"],
		heapProfile: `heap/${heapProfile}`,
		heapSamples: path.basename(heapSamplesPath),
		testTimings: path.basename(timingsPath),
	};
	await assertArtifacts(outputDir, [
		artifacts.auditSummary,
		artifacts.bundleMetafile,
		artifacts.bundleSummary,
		...artifacts.cpuProfiles,
		...artifacts.cpuRawProfiles,
		artifacts.heapProfile,
		artifacts.heapSamples,
		artifacts.testTimings,
	]);
	const manifest = {
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		bunVersion: Bun.version,
		parameters: {
			cpuProfileIntervalUs: CPU_PROFILE_INTERVAL_US,
			heapProfileIntervalBytes: HEAP_PROFILE_INTERVAL_BYTES,
			timingScenarioRepetitions: TIMING_SCENARIO_REPETITIONS,
			lifecycleTests,
		},
		scenarios,
		artifacts,
	};
	await Bun.write(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
	process.stdout.write(`audit complete: ${outputDir}\n`);
}

await main();

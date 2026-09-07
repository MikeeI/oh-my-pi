#!/usr/bin/env bun
import type * as fsTypes from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { listConversationSessions } from "../src/session/conversation-corpus";
import {
	CONVERSATION_SEARCH_CONCURRENCY,
	DEFAULT_CONVERSATION_SEARCH_DAYS,
	DEFAULT_CONVERSATION_SEARCH_LIMIT,
	searchConversationSessions,
} from "../src/session/conversation-search";
import { listSessionsReadOnly, type SessionInfo } from "../src/session/session-listing";
import { FileSessionStorage } from "../src/session/session-storage";

const DEFAULT_RUNS = 5;
const DEFAULT_WARMUP_RUNS = 1;
const MAX_RUNS = 100;
const MAX_WARMUP_RUNS = 20;
const BENCHMARK_QUERY = "\0conversation-search-benchmark-guaranteed-miss\0";
const USAGE = `Usage: bun scripts/bench-conversation-search.ts --cwd <workspace> [options]

Options:
  --cwd <path>             Workspace whose persisted sessions are benchmarked (required)
  --session-dir <path>     Explicit session directory instead of workspace discovery
  --exclude-session <path> Session JSONL to exclude like the active Main session
  --days <n>               Lookback window (default: 10)
  --runs <n>               Measured warm runs (default: 5)
  --warmup <n>             Unmeasured warmup runs (default: 1)
  --json                    Emit exactly one JSON result
  --help                    Show this help
`;

export interface ConversationSearchBenchmarkOptions {
	cwd: string;
	sessionDir?: string;
	excludeSessionFile?: string;
	days: number;
	runs: number;
	warmupRuns: number;
	json: boolean;
}

interface DatasetFile {
	path: string;
	size: number;
	mtimeMs: number;
}

interface BenchmarkSample {
	run: number;
	wallMs: number;
	cpuMs: number;
	throughputMiBPerSecond: number;
	rssBeforeMiB: number;
	peakRssMiB: number;
}

interface BenchmarkDistribution {
	min: number;
	median: number;
	max: number;
}

export interface ConversationSearchBenchmarkReport {
	schemaVersion: 1;
	benchmark: "conversation_search";
	measuredAt: string;
	dataset: {
		id: string;
		cwd: string;
		sessionDir?: string;
		excludedSession?: string;
		days: number;
		since: string;
		sessions: number;
		bytes: number;
		mebibytes: number;
		visibleMessages: number;
		discoveryMs: number;
	};
	evaluator: {
		query: "guaranteed-miss";
		match: "phrase";
		role: "both";
		limit: number;
		concurrency: number;
		warmupRuns: number;
		measuredRuns: number;
	};
	environment: {
		bun: string;
		platform: NodeJS.Platform;
		architecture: string;
		cpu: string;
		logicalCpus: number;
		totalMemoryMiB: number;
	};
	result: {
		wallMs: BenchmarkDistribution;
		cpuMs: BenchmarkDistribution;
		throughputMiBPerSecond: BenchmarkDistribution;
		peakRssMiB: BenchmarkDistribution;
	};
	guardrails: {
		complete: true;
		stableDataset: true;
		stableVisibleMessages: true;
		zeroMatches: true;
	};
	runs: BenchmarkSample[];
}

export function parseConversationSearchBenchmarkArgs(
	argv: readonly string[],
): ConversationSearchBenchmarkOptions | null {
	const { values } = parseArgs({
		args: [...argv],
		allowPositionals: false,
		strict: true,
		options: {
			cwd: { type: "string" },
			"session-dir": { type: "string" },
			"exclude-session": { type: "string" },
			days: { type: "string", default: String(DEFAULT_CONVERSATION_SEARCH_DAYS) },
			runs: { type: "string", default: String(DEFAULT_RUNS) },
			warmup: { type: "string", default: String(DEFAULT_WARMUP_RUNS) },
			json: { type: "boolean", default: false },
			help: { type: "boolean", default: false },
		},
	});
	if (values.help) return null;
	if (!values.cwd) throw new Error("--cwd is required. Use --help for usage.");
	return {
		cwd: path.resolve(values.cwd),
		sessionDir: values["session-dir"] ? path.resolve(values["session-dir"]) : undefined,
		excludeSessionFile: values["exclude-session"] ? path.resolve(values["exclude-session"]) : undefined,
		days: parseIntegerOption("--days", values.days, 1, 3_650),
		runs: parseIntegerOption("--runs", values.runs, 1, MAX_RUNS),
		warmupRuns: parseIntegerOption("--warmup", values.warmup, 0, MAX_WARMUP_RUNS),
		json: values.json,
	};
}

export async function runConversationSearchBenchmark(
	options: ConversationSearchBenchmarkOptions,
): Promise<ConversationSearchBenchmarkReport> {
	await assertDirectory("--cwd", options.cwd);
	if (options.sessionDir) await assertDirectory("--session-dir", options.sessionDir);
	const measuredAt = new Date();
	const nowMs = measuredAt.getTime();
	const sinceMs = nowMs - options.days * 86_400_000;
	const discoveryStarted = performance.now();
	const sessions = await discoverSessions(options);
	const discoveryMs = performance.now() - discoveryStarted;
	if (sessions.length === 0) throw new Error("No persisted sessions were found for the selected workspace.");
	const excludedPath = options.excludeSessionFile ? path.resolve(options.excludeSessionFile) : undefined;
	if (excludedPath && !sessions.some(session => path.resolve(session.path) === excludedPath)) {
		throw new Error(`--exclude-session is not present in the selected session corpus: ${excludedPath}`);
	}
	const eligible = sessions.filter(session => {
		if (excludedPath && path.resolve(session.path) === excludedPath) return false;
		return session.modified.getTime() >= sinceMs;
	});
	if (eligible.length === 0) throw new Error(`No sessions fall within the ${options.days}-day lookback window.`);
	const datasetFiles = await Promise.all(
		eligible.map(async session => {
			const filePath = path.resolve(session.path);
			const stat = await fs.stat(filePath);
			return { path: filePath, size: stat.size, mtimeMs: stat.mtimeMs };
		}),
	);
	datasetFiles.sort((left, right) => left.path.localeCompare(right.path));
	const datasetId = fingerprintDataset(datasetFiles);
	const datasetBytes = datasetFiles.reduce((total, file) => total + file.size, 0);
	let expectedVisibleMessages: number | undefined;

	const verifyReport = (
		visibleMessages: number,
		complete: boolean,
		totalMatches: number,
		searchedSessions: number,
	) => {
		if (!complete) throw new Error("Benchmark invalid: conversation search reported incomplete coverage.");
		if (searchedSessions !== eligible.length) {
			throw new Error(`Benchmark invalid: searched ${searchedSessions}/${eligible.length} eligible sessions.`);
		}
		if (totalMatches !== 0) throw new Error("Benchmark invalid: guaranteed-miss query unexpectedly matched content.");
		if (expectedVisibleMessages === undefined) {
			expectedVisibleMessages = visibleMessages;
		} else if (visibleMessages !== expectedVisibleMessages) {
			throw new Error(
				`Benchmark invalid: visible-message count changed from ${expectedVisibleMessages} to ${visibleMessages}.`,
			);
		}
	};

	for (let run = 0; run < options.warmupRuns; run++) {
		const report = await executeSearch(sessions, options, nowMs);
		verifyReport(report.visibleMessages, report.complete, report.totalMatches, report.searchedSessions);
	}

	const samples: BenchmarkSample[] = [];
	for (let run = 1; run <= options.runs; run++) {
		Bun.gc(true);
		await Bun.sleep(10);
		const rssBefore = process.memoryUsage().rss;
		let peakRss = rssBefore;
		const sampler = setInterval(() => {
			peakRss = Math.max(peakRss, process.memoryUsage().rss);
		}, 5);
		const cpuBefore = process.cpuUsage();
		const started = performance.now();
		try {
			const report = await executeSearch(sessions, options, nowMs);
			const wallMs = performance.now() - started;
			const cpu = process.cpuUsage(cpuBefore);
			verifyReport(report.visibleMessages, report.complete, report.totalMatches, report.searchedSessions);
			samples.push({
				run,
				wallMs: round(wallMs),
				cpuMs: round((cpu.user + cpu.system) / 1_000),
				throughputMiBPerSecond: round(datasetBytes / 1_048_576 / (wallMs / 1_000)),
				rssBeforeMiB: round(rssBefore / 1_048_576),
				peakRssMiB: round(peakRss / 1_048_576),
			});
		} finally {
			clearInterval(sampler);
		}
	}
	await assertDatasetStable(datasetFiles);
	if (expectedVisibleMessages === undefined) throw new Error("Benchmark produced no evaluator result.");
	const cpus = os.cpus();
	return {
		schemaVersion: 1,
		benchmark: "conversation_search",
		measuredAt: measuredAt.toISOString(),
		dataset: {
			id: datasetId,
			cwd: options.cwd,
			sessionDir: options.sessionDir,
			excludedSession: excludedPath,
			days: options.days,
			since: new Date(sinceMs).toISOString(),
			sessions: eligible.length,
			bytes: datasetBytes,
			mebibytes: round(datasetBytes / 1_048_576),
			visibleMessages: expectedVisibleMessages,
			discoveryMs: round(discoveryMs),
		},
		evaluator: {
			query: "guaranteed-miss",
			match: "phrase",
			role: "both",
			limit: DEFAULT_CONVERSATION_SEARCH_LIMIT,
			concurrency: CONVERSATION_SEARCH_CONCURRENCY,
			warmupRuns: options.warmupRuns,
			measuredRuns: options.runs,
		},
		environment: {
			bun: Bun.version,
			platform: process.platform,
			architecture: process.arch,
			cpu: cpus[0]?.model ?? "unknown",
			logicalCpus: cpus.length,
			totalMemoryMiB: round(os.totalmem() / 1_048_576),
		},
		result: {
			wallMs: distribution(samples.map(sample => sample.wallMs)),
			cpuMs: distribution(samples.map(sample => sample.cpuMs)),
			throughputMiBPerSecond: distribution(samples.map(sample => sample.throughputMiBPerSecond)),
			peakRssMiB: distribution(samples.map(sample => sample.peakRssMiB)),
		},
		guardrails: {
			complete: true,
			stableDataset: true,
			stableVisibleMessages: true,
			zeroMatches: true,
		},
		runs: samples,
	};
}

export function formatConversationSearchBenchmark(report: ConversationSearchBenchmarkReport): string {
	return [
		`benchmark: ${report.benchmark}`,
		`dataset: id=${report.dataset.id} sessions=${report.dataset.sessions} mebibytes=${report.dataset.mebibytes} visible_messages=${report.dataset.visibleMessages} days=${report.dataset.days}`,
		`evaluator: warmup=${report.evaluator.warmupRuns} runs=${report.evaluator.measuredRuns} concurrency=${report.evaluator.concurrency} query=${report.evaluator.query}`,
		`wall_ms: min=${report.result.wallMs.min} median=${report.result.wallMs.median} max=${report.result.wallMs.max}`,
		`cpu_ms: min=${report.result.cpuMs.min} median=${report.result.cpuMs.median} max=${report.result.cpuMs.max}`,
		`throughput_mib_s: min=${report.result.throughputMiBPerSecond.min} median=${report.result.throughputMiBPerSecond.median} max=${report.result.throughputMiBPerSecond.max}`,
		`peak_rss_mib: min=${report.result.peakRssMiB.min} median=${report.result.peakRssMiB.median} max=${report.result.peakRssMiB.max}`,
		"guardrails: complete=true stable_dataset=true stable_visible_messages=true zero_matches=true",
	].join("\n");
}

async function discoverSessions(options: ConversationSearchBenchmarkOptions): Promise<SessionInfo[]> {
	if (options.sessionDir) return listSessionsReadOnly(options.sessionDir, new FileSessionStorage());
	return listConversationSessions(options.cwd, "project", null);
}

async function executeSearch(sessions: SessionInfo[], options: ConversationSearchBenchmarkOptions, nowMs: number) {
	return searchConversationSessions(
		sessions,
		{
			query: BENCHMARK_QUERY,
			days: options.days,
			scope: "project",
			role: "both",
			match: "phrase",
			limit: DEFAULT_CONVERSATION_SEARCH_LIMIT,
			currentSessionFile: options.excludeSessionFile,
		},
		undefined,
		nowMs,
	);
}

async function assertDirectory(flag: string, directory: string): Promise<void> {
	let stat: fsTypes.Stats;
	try {
		stat = await fs.stat(directory);
	} catch (error) {
		throw new Error(`${flag} directory is not readable: ${directory}`, { cause: error });
	}
	if (!stat.isDirectory()) throw new Error(`${flag} must reference a directory: ${directory}`);
}

async function assertDatasetStable(files: DatasetFile[]): Promise<void> {
	const changed: string[] = [];
	await Promise.all(
		files.map(async file => {
			try {
				const stat = await fs.stat(file.path);
				if (stat.size !== file.size || stat.mtimeMs !== file.mtimeMs) changed.push(file.path);
			} catch {
				changed.push(file.path);
			}
		}),
	);
	if (changed.length > 0) {
		changed.sort();
		throw new Error(`Benchmark invalid: ${changed.length} dataset file(s) changed; first: ${changed[0]}`);
	}
}

function fingerprintDataset(files: DatasetFile[]): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(JSON.stringify(files));
	return hasher.digest("hex");
}

function parseIntegerOption(name: string, value: string | undefined, minimum: number, maximum: number): number {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
		throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
	}
	return parsed;
}

function distribution(values: number[]): BenchmarkDistribution {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
	return { min: sorted[0], median: round(median), max: sorted[sorted.length - 1] };
}

function round(value: number): number {
	return Math.round(value * 1_000) / 1_000;
}

async function main(): Promise<void> {
	const options = parseConversationSearchBenchmarkArgs(Bun.argv.slice(2));
	if (!options) {
		process.stdout.write(USAGE);
		return;
	}
	const report = await runConversationSearchBenchmark(options);
	process.stdout.write(
		options.json ? `${JSON.stringify(report)}\n` : `${formatConversationSearchBenchmark(report)}\n`,
	);
}

if (import.meta.main) {
	try {
		await main();
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}

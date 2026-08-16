#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { getDashboardStats, getTotalMessageCount, syncAllSessions } from "./aggregator";
import { closeDb } from "./db";
import { formatStatsDashboardUrl, startServer } from "./server";
import { loadStatsSummary, renderStatsSummary } from "./summary";

export {
	getDashboardStats,
	getToolDashboardStats,
	getTotalMessageCount,
	type SyncOptions,
	type SyncProgress,
	smokeTestSyncWorker,
	syncAllSessions,
} from "./aggregator";
export { closeDb } from "./db";
export { getGainDashboardStats } from "./gain-aggregator";
export { formatStatsDashboardUrl, startServer } from "./server";
export type {
	GainDashboardStats,
	GainSource,
	GainSourceTotals,
	GainTimeSeriesPoint,
} from "./shared-types";
export * from "./summary";
export type {
	AggregatedStats,
	DashboardStats,
	FolderStats,
	MessageStats,
	ModelPerformancePoint,
	ModelStats,
	ModelTimeSeriesPoint,
	TimeSeriesPoint,
	ToolDashboardStats,
	ToolModelStats,
	ToolTimeSeriesPoint,
	ToolUsageStats,
} from "./types";


/**
 * Print stats summary to console.
 */
async function printStats(): Promise<void> {
	const statsByRange = await loadStatsSummary(getDashboardStats);
	console.log(renderStatsSummary(statsByRange, { dashboardCommand: "omp-stats" }));
}

/** Parsed arguments for the standalone `omp-stats` entry point. */
export interface StandaloneStatsArgs {
	port: number;
	host: string;
	json: boolean;
	sync: boolean;
	help: boolean;
}

/** Parse the standalone `omp-stats` arguments used by the production entry point. */
export function parseStandaloneStatsArgs(args: string[]): StandaloneStatsArgs {
	const { values } = parseArgs({
		args,
		options: {
			port: { type: "string", short: "p", default: "3847" },
			host: { type: "string", default: "127.0.0.1" },
			json: { type: "boolean", short: "j", default: false },
			sync: { type: "boolean", short: "s", default: false },
			help: { type: "boolean", short: "h", default: false },
		},
		allowPositionals: true,
	});
	return {
		port: parseInt(values.port || "3847", 10),
		host: values.host || "127.0.0.1",
		json: values.json ?? false,
		sync: values.sync ?? false,
		help: values.help ?? false,
	};
}

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
	const values = parseStandaloneStatsArgs(process.argv.slice(2));

	if (values.help) {
		console.log(`
omp-stats - AI Usage Statistics Dashboard

Usage:
  omp-stats [options]

Options:
  -p, --port <port>  Port for the dashboard server (default: 3847)
  --host <host>       Host to bind (default: 127.0.0.1)
  -j, --json         Output stats as JSON and exit
  -s, --sync         Sync session files and show summary
  -h, --help         Show this help message

Examples:
  omp-stats              # Start dashboard server
  omp-stats --json       # Print stats as JSON
  omp-stats --host 0.0.0.0 # Explicitly expose on all IPv4 interfaces
  omp-stats --sync       # Sync and show summary
`);
		return;
	}

	try {
		// Sync first
		const tty = process.stderr.isTTY === true;
		process.stderr.write("Syncing session files...\n");
		let lastWidth = 0;
		let lastRender = 0;
		const { processed, files } = await syncAllSessions({
			onProgress: event => {
				if (!tty) return;
				const now = Date.now();
				if (event.current < event.total && now - lastRender < 33) return;
				lastRender = now;
				const marker = "/sessions/";
				const idx = event.sessionFile.indexOf(marker);
				const short = idx >= 0 ? event.sessionFile.slice(idx + marker.length) : event.sessionFile;
				const pct = ((event.current / event.total) * 100).toFixed(0).padStart(3, " ");
				const line = `[${event.current}/${event.total}] ${pct}%  ${short}`;
				const columns = process.stderr.columns ?? 120;
				const clipped = line.length > columns - 1 ? `${line.slice(0, columns - 2)}\u2026` : line;
				process.stderr.write(`\r${clipped.padEnd(lastWidth)}`);
				lastWidth = clipped.length;
			},
		});
		if (tty && lastWidth > 0) process.stderr.write(`\r${" ".repeat(lastWidth)}\r`);
		const total = await getTotalMessageCount();
		process.stderr.write(`Synced ${processed} new entries from ${files} files (${total} total)\n\n`);

		if (values.json) {
			const stats = await getDashboardStats();
			console.log(JSON.stringify(stats, null, 2));
			return;
		}

		if (values.sync) {
			await printStats();
			return;
		}

		// Start server
		const { port: actualPort } = await startServer(values.port, values.host);
		console.log(`Dashboard available at: ${formatStatsDashboardUrl(values.host, actualPort)}`);
		console.log("Press Ctrl+C to stop\n");

		// Keep process running
		process.on("SIGINT", () => {
			console.log("\nShutting down...");
			closeDb();
			process.exit(0);
		});
	} catch (error) {
		console.error("Error:", error);
		closeDb();
		process.exit(1);
	}
}

// Run if executed directly
if (import.meta.main) {
	main();
}

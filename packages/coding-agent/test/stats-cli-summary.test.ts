import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { closeDb } from "@oh-my-pi/omp-stats";
import { getAgentDir, getSessionsDir, setAgentDir, TempDir } from "@oh-my-pi/pi-utils";
import { runStatsCommand } from "../src/cli/stats-cli";

const XDG_KEYS = ["XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CACHE_HOME"] as const;

// Regression: `omp stats --summary` carried its own printer copy that lacked the
// unpriced-usage fix, so subscription-only usage with no reference price (e.g.
// SuperGrok) printed as a real `$0.0000` charge instead of `N/A`.
describe("omp stats --summary", () => {
	const originalAgentDir = getAgentDir();
	const originalEnv: Record<string, string | undefined> = {};
	let tempDir: TempDir;

	beforeEach(() => {
		tempDir = TempDir.createSync("@omp-stats-summary-");
		for (const key of [...XDG_KEYS, "PI_CONFIG_DIR"]) {
			originalEnv[key] = process.env[key];
			delete process.env[key];
		}
		const configDir = path.relative(os.homedir(), tempDir.join("config"));
		process.env.PI_CONFIG_DIR = configDir;
		setAgentDir(path.join(os.homedir(), configDir, "agent"));
	});

	afterEach(() => {
		closeDb();
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		setAgentDir(originalAgentDir);
		tempDir.removeSync();
	});

	it("preserves rolling totals, unpriced costs, and folder ranking beyond the dashboard cap", async () => {
		const dir = path.join(getSessionsDir(), "--tmp--summary--");
		await fs.mkdir(dir, { recursive: true });
		const timestamp = Date.now() - 60_000;
		const entry = {
			type: "message",
			id: "supergrok-1",
			timestamp: new Date(timestamp).toISOString(),
			message: {
				role: "assistant",
				api: "openai-responses",
				provider: "xai-oauth",
				model: "test-supergrok-without-reference-price",
				stopReason: "stop",
				content: [],
				timestamp,
				usage: {
					input: 10,
					output: 20,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 30,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
			},
		};
		// Distinct rolling windows exercise the totals-only loader through real ingestion.
		const records = [
			entry,
			...[3, 14].map(days => {
				const olderTimestamp = timestamp - days * 24 * 60 * 60 * 1000;
				return {
					...entry,
					id: `older-${days}`,
					timestamp: new Date(olderTimestamp).toISOString(),
					message: { ...entry.message, timestamp: olderTimestamp },
				};
			}),
		];
		await Bun.write(path.join(dir, "session.jsonl"), `${records.map(record => JSON.stringify(record)).join("\n")}\n`);

		async function summaryOutput(): Promise<string> {
			const lines: string[] = [];
			const log = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
				lines.push(args.map(String).join(" "));
			});
			const stderr = spyOn(process.stderr, "write").mockImplementation(() => true);
			try {
				await runStatsCommand({ port: 0, host: "127.0.0.1", json: false, summary: true });
			} finally {
				log.mockRestore();
				stderr.mockRestore();
			}
			return Bun.stripANSI(lines.join("\n"));
		}
		const output = await summaryOutput();
		const ranges = output.split("DETAILS (rolling 24h)")[0];
		expect(ranges).toMatch(/24h\n\s+Requests\s+1[\s\S]*7d\n\s+Requests\s+2[\s\S]*30d\n\s+Requests\s+3/);
		expect(output).toMatch(/\bCost\s+N\/A/);
		expect(output).toMatch(/\bUnpriced requests\s+1/);
		expect(output).not.toContain("$0.0000");
		expect(output).toContain("xai-oauth/test-supergrok-without-reference-price");
		expect(output).toContain("/tmp/summary/");

		// More requests put these low-token folders ahead of the dominant folder
		// in the dashboard's capped SQL result, not in the summary's token ranking.
		await Promise.all(
			Array.from({ length: 2_000 }, async (_, index) => {
				const folder = path.join(getSessionsDir(), `--tmp--busy-${String(index).padStart(4, "0")}--`);
				const records = [0, 1].map(slot => ({
					...entry,
					id: `busy-${index}-${slot}`,
					message: { ...entry.message, provider: "summary-ranking-fixture" },
				}));
				await Bun.write(
					path.join(folder, "session.jsonl"),
					`${records.map(record => JSON.stringify(record)).join("\n")}\n`,
				);
			}),
		);
		const dominant = {
			...entry,
			id: "dominant-folder",
			message: {
				...entry.message,
				provider: "summary-ranking-fixture",
				usage: { ...entry.message.usage, input: 1_000_000, totalTokens: 1_000_020 },
			},
		};
		await Bun.write(
			path.join(getSessionsDir(), "--tmp--dominant-summary--", "session.jsonl"),
			`${JSON.stringify(dominant)}\n`,
		);
		const ranked = await summaryOutput();
		expect(ranked).toContain("1. /tmp/dominant-summary/");
		expect(ranked).toContain("1997 more folders;");
	}, 30_000);
});

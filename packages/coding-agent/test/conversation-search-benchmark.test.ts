import { describe, expect, it } from "bun:test";
import { TempDir } from "@oh-my-pi/pi-utils";
import {
	formatConversationSearchBenchmark,
	parseConversationSearchBenchmarkArgs,
	runConversationSearchBenchmark,
} from "../scripts/bench-conversation-search";
import { CURRENT_SESSION_VERSION } from "../src/session/session-entries";

async function writeBenchmarkSession(
	file: string,
	id: string,
	cwd: string,
	messages: Array<{ role: string; content: unknown }>,
): Promise<void> {
	const now = Date.now();
	const records: Record<string, unknown>[] = [
		{
			type: "session",
			version: CURRENT_SESSION_VERSION,
			id,
			timestamp: new Date(now).toISOString(),
			cwd,
		},
	];
	let parentId: string | null = null;
	for (let index = 0; index < messages.length; index++) {
		const entryId = `${id}-${index}`;
		records.push({
			type: "message",
			id: entryId,
			parentId,
			timestamp: new Date(now + index).toISOString(),
			message: { ...messages[index], timestamp: now + index },
		});
		parentId = entryId;
	}
	await Bun.write(file, `${records.map(record => JSON.stringify(record)).join("\n")}\n`);
}

describe("conversation search benchmark", () => {
	it("measures a frozen real-session corpus while excluding the active session", async () => {
		using tempDir = TempDir.createSync("@omp-conversation-search-benchmark-");
		const cwd = tempDir.path();
		const sessionDir = tempDir.join("sessions");
		const retainedSession = tempDir.join("sessions/retained.jsonl");
		const activeSession = tempDir.join("sessions/active.jsonl");
		await Promise.all([
			writeBenchmarkSession(retainedSession, "retained", cwd, [
				{ role: "user", content: "benchmark user text" },
				{ role: "assistant", content: [{ type: "text", text: "benchmark assistant text" }] },
				{ role: "toolResult", content: [{ type: "text", text: "ignored tool output" }] },
			]),
			writeBenchmarkSession(activeSession, "active", cwd, [{ role: "user", content: "excluded active text" }]),
		]);
		const options = parseConversationSearchBenchmarkArgs([
			"--cwd",
			cwd,
			"--session-dir",
			sessionDir,
			"--exclude-session",
			activeSession,
			"--runs",
			"2",
			"--warmup",
			"1",
		]);
		if (!options) throw new Error("Expected benchmark options.");
		const report = await runConversationSearchBenchmark(options);
		expect(report.dataset).toMatchObject({
			cwd,
			sessionDir,
			excludedSession: activeSession,
			days: 10,
			sessions: 1,
			visibleMessages: 2,
		});
		expect(report.evaluator).toMatchObject({
			query: "guaranteed-miss",
			match: "phrase",
			role: "both",
			warmupRuns: 1,
			measuredRuns: 2,
		});
		expect(report.runs).toHaveLength(2);
		expect(report.guardrails).toEqual({
			complete: true,
			stableDataset: true,
			stableVisibleMessages: true,
			zeroMatches: true,
		});
		expect(formatConversationSearchBenchmark(report)).toContain(
			"guardrails: complete=true stable_dataset=true stable_visible_messages=true zero_matches=true",
		);
	});

	it("requires an explicit workspace while preserving benchmark defaults", () => {
		expect(() => parseConversationSearchBenchmarkArgs([])).toThrow("--cwd is required");
		const parsed = parseConversationSearchBenchmarkArgs(["--cwd", "."]);
		expect(parsed).toMatchObject({ days: 10, runs: 5, warmupRuns: 1, json: false });
	});
});

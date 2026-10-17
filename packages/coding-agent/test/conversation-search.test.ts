import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { CURRENT_SESSION_VERSION } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import { ConversationSearchTool, createTools, type ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { isRecord, TempDir } from "@oh-my-pi/pi-utils";

interface FixtureMessage {
	role: string;
	content: unknown;
	timestamp: number;
	synthetic?: boolean;
	attribution?: string;
}

async function writeSession(
	file: string,
	id: string,
	cwd: string,
	title: string,
	messages: FixtureMessage[],
	modifiedMs: number,
): Promise<void> {
	const records: Record<string, unknown>[] = [
		{
			type: "session",
			version: CURRENT_SESSION_VERSION,
			id,
			title,
			timestamp: new Date(messages[0]?.timestamp ?? modifiedMs).toISOString(),
			cwd,
		},
	];
	let parentId: string | null = null;
	for (let index = 0; index < messages.length; index++) {
		const message = messages[index];
		const entryId = `${id}-${index}`;
		records.push({
			type: "message",
			id: entryId,
			parentId,
			timestamp: new Date(message.timestamp).toISOString(),
			message,
		});
		parentId = entryId;
	}
	await Bun.write(file, `${records.map(record => JSON.stringify(record)).join("\n")}\n`);
	const modified = new Date(modifiedMs);
	await fs.utimes(file, modified, modified);
}

function makeToolSession(cwd: string, activeSessionFile: string, taskDepth = 0): ToolSession {
	return {
		cwd,
		hasUI: false,
		getSessionFile: () => activeSessionFile,
		getSessionSpawns: () => null,
		settings: Settings.isolated(),
		taskDepth,
	};
}

describe("conversation_search", () => {
	it("searches the last 10 days of visible user and assistant text without model-derived noise", async () => {
		using tempDir = TempDir.createSync("@omp-conversation-search-");
		const cwd = tempDir.path();
		const sessionDir = tempDir.join("sessions");
		const now = Date.now();
		const recentFile = `${sessionDir}/recent.jsonl`;
		const oldFile = `${sessionDir}/old.jsonl`;
		const activeFile = `${sessionDir}/active.jsonl`;
		await Promise.all([
			writeSession(
				recentFile,
				"recent-session",
				cwd,
				"Visible result",
				[
					{ role: "user", content: "Needle alpha from the user", timestamp: now - 2 * 86_400_000 },
					{
						role: "assistant",
						content: [
							{ type: "text", text: "The Assistant kept the beta needle answer." },
							{ type: "toolCall", id: "call-1", name: "read", arguments: {} },
						],
						timestamp: now - 86_400_000,
					},
					{
						role: "toolResult",
						content: [{ type: "text", text: "needle only in tool output" }],
						timestamp: now - 80_000_000,
					},
					{
						role: "assistant",
						content: [{ type: "thinking", thinking: "needle only in thinking" }],
						timestamp: now - 70_000_000,
					},
					{
						role: "user",
						content: "needle only in a hidden synthetic input",
						timestamp: now - 60_000_000,
						synthetic: true,
					},
					{
						role: "developer",
						content: "needle only in a developer directive",
						timestamp: now - 50_000_000,
					},
				],
				now - 40_000_000,
			),
			writeSession(
				oldFile,
				"old-session",
				cwd,
				"Old result",
				[{ role: "user", content: "needle older than the default window", timestamp: now - 11 * 86_400_000 }],
				now - 30_000_000,
			),
			writeSession(
				activeFile,
				"active-session",
				cwd,
				"Current conversation",
				[{ role: "user", content: "needle from the active conversation", timestamp: now - 10_000 }],
				now,
			),
		]);

		const tool = new ConversationSearchTool(makeToolSession(cwd, activeFile));
		const textResult = await tool.execute("text-search", { query: "needle" });
		const text = textResult.content.find(part => part.type === "text")?.text ?? "";
		expect(text).toContain("matches=2/2");
		expect(text).toContain("Needle alpha from the user");
		expect(text).toContain("beta needle answer");
		expect(text).not.toContain("tool output");
		expect(text).not.toContain("thinking");
		expect(text).not.toContain("synthetic input");
		expect(text).not.toContain("developer directive");
		expect(text).not.toContain("older than the default window");
		expect(text).not.toContain("active conversation");
		expect(textResult.details).toMatchObject({
			days: 10,
			scope: "project",
			role: "both",
			match: "all",
			format: "text",
			complete: true,
			candidateSessions: 2,
			searchedSessions: 2,
			matchedSessions: 1,
			totalMatches: 2,
			returnedMatches: 2,
		});

		const jsonResult = await tool.execute("json-search", {
			query: "assistant needle",
			role: "assistant",
			format: "json",
		});
		const jsonText = jsonResult.content.find(part => part.type === "text")?.text ?? "";
		const parsed: unknown = JSON.parse(jsonText);
		expect(parsed).toMatchObject({ total_matches: 1, matched_sessions: 1, complete: true });
		if (!isRecord(parsed) || !Array.isArray(parsed.hits)) throw new Error("Expected JSON conversation hits.");
		expect(parsed.hits).toHaveLength(1);
		expect(parsed.hits[0]).toMatchObject({
			session_id: "recent-session",
			role: "assistant",
		});
	});

	it("preserves exact phrases and includes their match after length-changing Unicode lowercase", async () => {
		using tempDir = TempDir.createSync("@omp-conversation-search-phrase-");
		const cwd = tempDir.path();
		const activeFile = tempDir.join("sessions/active.jsonl");
		const now = Date.now();
		await writeSession(
			tempDir.join("sessions/phrase.jsonl"),
			"phrase-session",
			cwd,
			"Exact phrase",
			[
				{
					role: "user",
					content: `${"İ".repeat(3_000)} Alpha  beta\ngamma ${"tail ".repeat(2_000)}`,
					timestamp: now,
				},
			],
			now,
		);
		const tool = new ConversationSearchTool(makeToolSession(cwd, activeFile));
		const exact = await tool.execute("exact-phrase", {
			query: " alpha  beta\ngamma ",
			match: "phrase",
			format: "json",
		});
		const text = exact.content.find(part => part.type === "text")?.text ?? "";
		expect(JSON.parse(text)).toMatchObject({
			query: "alpha  beta\ngamma",
			complete: true,
			total_matches: 1,
			hits: [{ entry_id: "phrase-session-0" }],
		});
		expect(text).toContain("Alpha  beta\\ngamma");
		const collapsed = await tool.execute("collapsed-phrase", {
			query: "alpha beta gamma",
			match: "phrase",
		});
		expect(collapsed.details).toMatchObject({ complete: true, totalMatches: 0 });
		const terms = await tool.execute("all-terms", { query: "alpha beta gamma", match: "all" });
		expect(terms.details).toMatchObject({ complete: true, totalMatches: 1 });
		expect(terms.content.find(part => part.type === "text")?.text).toContain("Alpha beta gamma");
	});

	it("returns the same leading hits at smaller limits when message timestamps tie", async () => {
		using tempDir = TempDir.createSync("@omp-conversation-search-ranking-");
		const cwd = tempDir.path();
		const activeFile = tempDir.join("sessions/active.jsonl");
		const now = Date.now();
		await writeSession(
			tempDir.join("sessions/tie.jsonl"),
			"tie",
			cwd,
			"Tied timestamps",
			Array.from({ length: 12 }, (_, index) => ({
				role: "user",
				content: `needle ${index}`,
				timestamp: now,
			})),
			now,
		);
		const tool = new ConversationSearchTool(makeToolSession(cwd, activeFile));
		const smallResult = await tool.execute("small-limit", { query: "needle", limit: 3, format: "json" });
		const largeResult = await tool.execute("large-limit", { query: "needle", limit: 12, format: "json" });
		const small: unknown = JSON.parse(smallResult.content.find(part => part.type === "text")?.text ?? "");
		const large: unknown = JSON.parse(largeResult.content.find(part => part.type === "text")?.text ?? "");
		if (!isRecord(small) || !isRecord(large) || !Array.isArray(small.hits) || !Array.isArray(large.hits)) {
			throw new Error("Expected JSON conversation hits.");
		}
		expect(small).toMatchObject({ complete: true, total_matches: 12 });
		expect(small.hits).toHaveLength(3);
		expect(large.hits).toHaveLength(12);
		expect(small.hits).toEqual(large.hits.slice(0, 3));
	});

	it("reports excluded malformed journals on repeated discovery, but accepts a missing root", async () => {
		using tempDir = TempDir.createSync("@omp-conversation-search-coverage-");
		const activeFile = tempDir.join("sessions/active.jsonl");
		await Bun.write(tempDir.join("sessions/broken.jsonl"), '{"type":"message"}\n');
		const tool = new ConversationSearchTool(makeToolSession(tempDir.path(), activeFile));
		// The second read exercises the shared negative header cache.
		for (let attempt = 0; attempt < 2; attempt++) {
			const result = await tool.execute("coverage", { query: "needle", format: "json" });
			const text = result.content.find(part => part.type === "text")?.text ?? "";
			expect(JSON.parse(text)).toMatchObject({
				complete: false,
				discovery_failures: 1,
				candidate_sessions: 0,
				hits: [],
			});
		}
		const emptyTool = new ConversationSearchTool(
			makeToolSession(tempDir.path(), tempDir.join("missing/active.jsonl")),
		);
		const empty = await emptyTool.execute("empty", { query: "needle" });
		expect(empty.details).toMatchObject({ complete: true, candidateSessions: 0 });
	});

	it("is available to Main but absent from child tool registries", async () => {
		using tempDir = TempDir.createSync("@omp-conversation-search-gate-");
		const activeFile = tempDir.join("active.jsonl");
		const main = await createTools(makeToolSession(tempDir.path(), activeFile), ["conversation_search"]);
		const child = await createTools(makeToolSession(tempDir.path(), activeFile, 1), ["conversation_search"]);
		expect(main.map(tool => tool.name)).toEqual(["conversation_search"]);
		expect(child.map(tool => tool.name)).toEqual([]);
	});
});

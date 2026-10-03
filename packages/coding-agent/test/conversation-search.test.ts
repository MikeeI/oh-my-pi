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

	it("is available to Main but absent from child tool registries", async () => {
		using tempDir = TempDir.createSync("@omp-conversation-search-gate-");
		const activeFile = tempDir.join("active.jsonl");
		const main = await createTools(makeToolSession(tempDir.path(), activeFile), ["conversation_search"]);
		const child = await createTools(makeToolSession(tempDir.path(), activeFile, 1), ["conversation_search"]);
		expect(main.map(tool => tool.name)).toEqual(["conversation_search"]);
		expect(child.map(tool => tool.name)).toEqual([]);
	});
});

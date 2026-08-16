import { type } from "@oh-my-pi/omptype";
import type { AgentTool, AgentToolResult } from "@oh-my-pi/pi-agent-core";
import { untilAborted } from "@oh-my-pi/pi-utils";
import conversationSearchDescription from "../prompts/tools/conversation-search.md" with { type: "text" };
import { listConversationSessions } from "../session/conversation-corpus";
import {
	DEFAULT_CONVERSATION_SEARCH_DAYS,
	DEFAULT_CONVERSATION_SEARCH_LIMIT,
	searchConversationSessions,
} from "../session/conversation-search";
import type { ToolSession } from ".";
import { type ConversationSearchFormat, formatConversationSearchReport } from "./conversation-search-format";
import { ToolError } from "./tool-errors";

const conversationSearchSchema = type({
	query: type("string > 0").describe("literal text or whitespace-separated terms"),
	"days?": type("1 <= number.integer <= 3650").describe("lookback window; default 10 days"),
	"scope?": type("'project' | 'all'").describe("current project or every project; default project"),
	"role?": type("'user' | 'assistant' | 'both'").describe("message roles to search; default both"),
	"match?": type("'all' | 'phrase'").describe("all terms anywhere or exact phrase; default all"),
	"format?": type("'text' | 'json'").describe("output format; default text"),
	"limit?": type("1 <= number.integer <= 50").describe("maximum returned matches; default 12"),
});

export type ConversationSearchParams = typeof conversationSearchSchema.infer;

export interface ConversationSearchDetails {
	query: string;
	days: number;
	scope: "project" | "all";
	role: "user" | "assistant" | "both";
	match: "all" | "phrase";
	format: ConversationSearchFormat;
	complete: boolean;
	candidateSessions: number;
	searchedSessions: number;
	matchedSessions: number;
	visibleMessages: number;
	totalMatches: number;
	returnedMatches: number;
	failedSessions: number;
	malformedRecords: number;
}

export class ConversationSearchTool implements AgentTool<typeof conversationSearchSchema, ConversationSearchDetails> {
	readonly name = "conversation_search";
	readonly approval = "read" as const;
	readonly label = "Conversation Search";
	readonly description = conversationSearchDescription;
	readonly parameters = conversationSearchSchema;
	readonly strict = true;
	readonly loadMode = "discoverable";
	readonly summary = "Search persisted user and assistant conversation text";

	constructor(private readonly session: ToolSession) {}

	static createIf(session: ToolSession): ConversationSearchTool | null {
		if ((session.taskDepth ?? 0) !== 0) return null;
		return new ConversationSearchTool(session);
	}

	async execute(_id: string, params: ConversationSearchParams, signal?: AbortSignal): Promise<AgentToolResult> {
		return untilAborted(signal, async () => {
			const query = params.query.trim();
			if (!query) throw new ToolError("Conversation search query must not be empty.");
			const currentSessionFile = this.session.getSessionFile();
			const scope = params.scope ?? "project";
			const days = params.days ?? DEFAULT_CONVERSATION_SEARCH_DAYS;
			const role = params.role ?? "both";
			const match = params.match ?? "all";
			const format = params.format ?? "text";
			const limit = params.limit ?? DEFAULT_CONVERSATION_SEARCH_LIMIT;
			const sessions = await listConversationSessions(this.session.cwd, scope, currentSessionFile);
			const report = await searchConversationSessions(
				sessions,
				{ query, days, scope, role, match, limit, currentSessionFile },
				signal,
			);
			const details: ConversationSearchDetails = {
				query: report.query,
				days,
				scope,
				role,
				match,
				format,
				complete: report.complete,
				candidateSessions: report.candidateSessions,
				searchedSessions: report.searchedSessions,
				matchedSessions: report.matchedSessions,
				visibleMessages: report.visibleMessages,
				totalMatches: report.totalMatches,
				returnedMatches: report.hits.length,
				failedSessions: report.failedSessions,
				malformedRecords: report.malformedRecords,
			};
			return {
				content: [{ type: "text", text: formatConversationSearchReport(report, format) }],
				details,
				...(report.complete && report.totalMatches === 0 ? { useless: true } : {}),
			};
		});
	}
}

import { type } from "@oh-my-pi/omptype";
import type { AgentTool, AgentToolResult } from "@oh-my-pi/pi-agent-core";
import { untilAborted } from "@oh-my-pi/pi-utils";
import conversationSearchDescription from "../prompts/tools/conversation-search.md" with { type: "text" };
import { ConversationTranscriptCache, listConversationSessions } from "../session/conversation-corpus";
import {
	conversationSearchWindowStart,
	DEFAULT_CONVERSATION_SEARCH_DAYS,
	DEFAULT_CONVERSATION_SEARCH_LIMIT,
	MAX_CONVERSATION_SEARCH_LIMIT,
	searchConversationSessions,
} from "../session/conversation-search";
import type { ToolSession } from ".";
import { type ConversationSearchFormat, formatConversationSearchReport } from "./conversation-search-format";
import { ToolError } from "@oh-my-pi/pi-tui/tools/tool-errors";

// Shared across sessions and tool instances in this process so repeated searches
// parse only journal bytes appended since an earlier search.
const processTranscripts = new ConversationTranscriptCache();

const QUERY_DESCRIPTION = "non-empty literal text or whitespace-separated terms";

const conversationSearchSchema = type({
	query: type("string > 0")
		.describe(QUERY_DESCRIPTION)
		// The length rule reports the measured length as its actual value, so the
		// described default reads "(was 0)" — easily mistaken for a numeric query.
		.configure({
			problem: ctx => (ctx.code === "min" ? `must be ${QUERY_DESCRIPTION} (was an empty string)` : ctx.problem),
		}),
	"days?": type("1 <= number.integer <= 3650").describe("lookback window; default 10 days"),
	"scope?": type("'project' | 'all'").describe("current project or every project; default project"),
	"role?": type("'user' | 'assistant' | 'both'").describe("message roles to search; default both"),
	"match?": type("'all' | 'phrase'").describe("all terms anywhere or exact phrase; default all"),
	"format?": type("'text' | 'json'").describe("output format; default text"),
	"limit?": type(`1 <= number.integer <= ${MAX_CONVERSATION_SEARCH_LIMIT}`).describe(
		"maximum returned matches; default 12",
	),
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
	discoveryFailures: number;
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
			const nowMs = Date.now();
			const corpus = await listConversationSessions({
				cwd: this.session.cwd,
				scope,
				modifiedSinceMs: conversationSearchWindowStart(days, nowMs),
				currentSessionFile,
			});
			const report = await searchConversationSessions(
				corpus,
				{ query, days, scope, role, match, limit, currentSessionFile },
				signal,
				nowMs,
				processTranscripts,
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
				discoveryFailures: report.discoveryFailures,
				malformedRecords: report.malformedRecords,
			};
			return {
				content: [{ type: "text", text: formatConversationSearchReport(report, format, limit) }],
				details,
				...(report.complete && report.totalMatches === 0 ? { useless: true } : {}),
			};
		});
	}
}

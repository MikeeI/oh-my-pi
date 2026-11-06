import {
	type ConversationSearchHit,
	type ConversationSearchReport,
	MAX_CONVERSATION_SEARCH_LIMIT,
} from "../session/conversation-search";
import { replaceTabs, shortenPath } from "@oh-my-pi/pi-tui/render/render-utils";

export type ConversationSearchFormat = "text" | "json";

const TEXT_EXCERPT_CHARS = 420;
const JSON_EXCERPT_CHARS = 1_600;

export function formatConversationSearchReport(
	report: ConversationSearchReport,
	format: ConversationSearchFormat,
	limit: number,
): string {
	if (format === "json") return formatJson(report, limit);
	return formatText(report, limit);
}

function formatText(report: ConversationSearchReport, limit: number): string {
	const lines = [
		`matches=${report.hits.length}/${report.totalMatches} matched_sessions=${report.matchedSessions} searched_sessions=${report.searchedSessions}/${report.candidateSessions} scope=${report.scope} since=${report.since} complete=${report.complete}`,
	];
	if (report.hits.length === 0) {
		lines.push("No matches found in visible user/assistant text.");
	}
	for (const hit of report.hits) {
		const metadata = [
			`timestamp=${hit.timestamp}`,
			`role=${hit.role}`,
			`session=${hit.sessionId}`,
			`title=${JSON.stringify(singleLine(hit.sessionTitle ?? ""))}`,
		];
		if (report.scope === "all" && hit.cwd) metadata.push(`cwd=${JSON.stringify(shortenPath(hit.cwd))}`);
		lines.push(metadata.join(" "), `  ${singleLine(excerpt(hit, TEXT_EXCERPT_CHARS))}`);
	}
	const omitted = report.totalMatches - report.hits.length;
	if (omitted > 0) lines.push(omittedMatchesHint(omitted, report.totalMatches, limit));
	if (!report.complete) {
		lines.push(
			`Coverage incomplete: discovery_failures=${report.discoveryFailures} failed_sessions=${report.failedSessions} malformed_records=${report.malformedRecords}.`,
		);
	}
	return lines.join("\n");
}

// At the schema maximum, raising `limit` is impossible; point at the filters that shrink the match set instead.
function omittedMatchesHint(omitted: number, totalMatches: number, limit: number): string {
	if (limit < MAX_CONVERSATION_SEARCH_LIMIT) {
		return `Omitted ${omitted} older match(es); retry with limit=${Math.min(MAX_CONVERSATION_SEARCH_LIMIT, totalMatches)}.`;
	}
	return `Omitted ${omitted} older match(es); limit is at its maximum ${MAX_CONVERSATION_SEARCH_LIMIT}; narrow with fewer days, match=phrase, role, or more query terms.`;
}

function formatJson(report: ConversationSearchReport, limit: number): string {
	return JSON.stringify(
		{
			query: report.query,
			days: report.days,
			scope: report.scope,
			role: report.role,
			match: report.match,
			since: report.since,
			complete: report.complete,
			candidate_sessions: report.candidateSessions,
			searched_sessions: report.searchedSessions,
			matched_sessions: report.matchedSessions,
			visible_messages: report.visibleMessages,
			total_matches: report.totalMatches,
			limit,
			omitted_matches: report.totalMatches - report.hits.length,
			failed_sessions: report.failedSessions,
			discovery_failures: report.discoveryFailures,
			malformed_records: report.malformedRecords,
			hits: report.hits.map(hit => ({
				session_id: hit.sessionId,
				session_title: hit.sessionTitle,
				cwd: report.scope === "all" && hit.cwd ? shortenPath(hit.cwd) : undefined,
				session_modified: hit.sessionModified,
				entry_id: hit.entryId,
				timestamp: hit.timestamp,
				role: hit.role,
				text: excerpt(hit, JSON_EXCERPT_CHARS),
			})),
		},
		null,
		2,
	);
}

function excerpt(hit: ConversationSearchHit, maxChars: number): string {
	const start = Math.max(0, Math.min(hit.text.length - maxChars, hit.matchOffset - Math.floor(maxChars / 3)));
	const end = Math.min(hit.text.length, start + maxChars);
	const prefix = hit.startTruncated || start > 0 ? "…" : "";
	const suffix = hit.endTruncated || end < hit.text.length ? "…" : "";
	return `${prefix}${replaceTabs(hit.text.slice(start, end)).trim()}${suffix}`;
}

function singleLine(value: string): string {
	return replaceTabs(value).replace(/\s+/g, " ").trim();
}

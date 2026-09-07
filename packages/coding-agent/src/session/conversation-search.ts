import * as path from "node:path";
import { logger } from "@oh-my-pi/pi-utils";
import { mapWithConcurrencyLimitAllSettled } from "../task/parallel";
import {
	type ConversationRole,
	type ConversationSearchScope,
	visitVisibleConversationMessages,
} from "./conversation-corpus";
import type { SessionInfo } from "./session-listing";

export const DEFAULT_CONVERSATION_SEARCH_DAYS = 10;
export const DEFAULT_CONVERSATION_SEARCH_LIMIT = 12;

const DAY_MS = 24 * 60 * 60 * 1000;
export const CONVERSATION_SEARCH_CONCURRENCY = 4;
const MAX_CAPTURE_CHARS = 4_096;

export type ConversationSearchRole = ConversationRole | "both";
export type ConversationSearchMatch = "all" | "phrase";

export interface ConversationSearchRequest {
	query: string;
	days: number;
	scope: ConversationSearchScope;
	role: ConversationSearchRole;
	match: ConversationSearchMatch;
	limit: number;
	currentSessionFile?: string | null;
}

export interface ConversationSearchHit {
	sessionId: string;
	sessionTitle?: string;
	cwd: string;
	sessionModified: string;
	entryId: string;
	timestamp: string;
	role: ConversationRole;
	text: string;
	matchOffset: number;
	startTruncated: boolean;
	endTruncated: boolean;
}

export interface ConversationSearchReport {
	query: string;
	days: number;
	scope: ConversationSearchScope;
	role: ConversationSearchRole;
	match: ConversationSearchMatch;
	since: string;
	complete: boolean;
	candidateSessions: number;
	searchedSessions: number;
	matchedSessions: number;
	visibleMessages: number;
	totalMatches: number;
	failedSessions: number;
	malformedRecords: number;
	hits: ConversationSearchHit[];
}

interface SessionSearchResult {
	matchCount: number;
	visibleMessages: number;
	malformedRecords: number;
	hits: ConversationSearchHit[];
}

export async function searchConversationSessions(
	sessions: SessionInfo[],
	request: ConversationSearchRequest,
	signal?: AbortSignal,
	nowMs = Date.now(),
): Promise<ConversationSearchReport> {
	const query = request.query.trim().replace(/\s+/g, " ");
	if (!query) throw new Error("Conversation search query must not be empty.");
	const sinceMs = nowMs - request.days * DAY_MS;
	const currentSessionPath = request.currentSessionFile ? path.resolve(request.currentSessionFile) : undefined;
	const candidates = sessions.filter(session => {
		if (currentSessionPath && path.resolve(session.path) === currentSessionPath) return false;
		return session.modified.getTime() >= sinceMs;
	});
	const needles = request.match === "phrase" ? [query.toLowerCase()] : query.toLowerCase().split(/\s+/);
	const settled = await mapWithConcurrencyLimitAllSettled(
		candidates,
		CONVERSATION_SEARCH_CONCURRENCY,
		(session, _index, workerSignal) => searchSession(session, sinceMs, needles, request, workerSignal),
		signal,
	);

	let searchedSessions = 0;
	let matchedSessions = 0;
	let visibleMessages = 0;
	let totalMatches = 0;
	let failedSessions = 0;
	let malformedRecords = 0;
	const hits: ConversationSearchHit[] = [];
	for (let index = 0; index < settled.results.length; index++) {
		const result = settled.results[index];
		if (!result) continue;
		if (result.status === "rejected") {
			failedSessions++;
			logger.warn("Conversation search skipped unreadable session", {
				path: candidates[index]?.path,
				error: result.reason instanceof Error ? result.reason.message : String(result.reason),
			});
			continue;
		}
		searchedSessions++;
		visibleMessages += result.value.visibleMessages;
		malformedRecords += result.value.malformedRecords;
		totalMatches += result.value.matchCount;
		if (result.value.matchCount > 0) matchedSessions++;
		hits.push(...result.value.hits);
	}
	if (settled.aborted) {
		throw signal?.reason instanceof Error ? signal.reason : new Error("Conversation search aborted.");
	}
	hits.sort((left, right) => {
		const timestampOrder = right.timestamp.localeCompare(left.timestamp);
		if (timestampOrder !== 0) return timestampOrder;
		const sessionOrder = right.sessionModified.localeCompare(left.sessionModified);
		return sessionOrder !== 0 ? sessionOrder : left.entryId.localeCompare(right.entryId);
	});

	return {
		query,
		days: request.days,
		scope: request.scope,
		role: request.role,
		match: request.match,
		since: new Date(sinceMs).toISOString(),
		complete: failedSessions === 0 && malformedRecords === 0,
		candidateSessions: candidates.length,
		searchedSessions,
		matchedSessions,
		visibleMessages,
		totalMatches,
		failedSessions,
		malformedRecords,
		hits: hits.slice(0, request.limit),
	};
}

async function searchSession(
	session: SessionInfo,
	sinceMs: number,
	needles: string[],
	request: ConversationSearchRequest,
	signal: AbortSignal,
): Promise<SessionSearchResult> {
	let matchCount = 0;
	const hits: ConversationSearchHit[] = [];
	const stats = await visitVisibleConversationMessages(
		session,
		sinceMs,
		message => {
			if (request.role !== "both" && request.role !== message.role) return;
			const lower = message.text.toLowerCase();
			let matchOffset = Number.POSITIVE_INFINITY;
			for (const needle of needles) {
				const offset = lower.indexOf(needle);
				if (offset < 0) return;
				matchOffset = Math.min(matchOffset, offset);
			}
			matchCount++;
			const captureStart = Math.max(
				0,
				Math.min(message.text.length - MAX_CAPTURE_CHARS, matchOffset - Math.floor(MAX_CAPTURE_CHARS / 3)),
			);
			const captureEnd = Math.min(message.text.length, captureStart + MAX_CAPTURE_CHARS);
			retainNewestHit(
				hits,
				{
					sessionId: session.id,
					sessionTitle: session.title,
					cwd: session.cwd,
					sessionModified: session.modified.toISOString(),
					entryId: message.entryId,
					timestamp: new Date(message.timestampMs).toISOString(),
					role: message.role,
					text: message.text.slice(captureStart, captureEnd),
					matchOffset: matchOffset - captureStart,
					startTruncated: captureStart > 0,
					endTruncated: captureEnd < message.text.length,
				},
				request.limit,
			);
		},
		signal,
	);
	return { matchCount, visibleMessages: stats.visibleMessages, malformedRecords: stats.malformedRecords, hits };
}

function retainNewestHit(hits: ConversationSearchHit[], hit: ConversationSearchHit, limit: number): void {
	if (hits.length < limit) {
		hits.push(hit);
		return;
	}
	let oldestIndex = 0;
	for (let index = 1; index < hits.length; index++) {
		if (hits[index].timestamp < hits[oldestIndex].timestamp) oldestIndex = index;
	}
	if (hit.timestamp > hits[oldestIndex].timestamp) hits[oldestIndex] = hit;
}

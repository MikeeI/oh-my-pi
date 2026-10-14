import * as path from "node:path";
import { isRecord, logger } from "@oh-my-pi/pi-utils";
import {
	listAllSessions,
	listSessionsReadOnly,
	type SessionDiscoveryFailure,
	type SessionInfo,
} from "./session-listing";
import { visitEntriesFromFileStream } from "./session-loader";
import { SessionManager } from "./session-manager";
import { FileSessionStorage } from "./session-storage";

export type ConversationSearchScope = "project" | "all";
export type ConversationRole = "user" | "assistant";

export interface VisibleConversationMessage {
	entryId: string;
	timestampMs: number;
	role: ConversationRole;
	text: string;
}

export interface ConversationCorpusStats {
	visibleMessages: number;
	malformedRecords: number;
}

export interface ConversationSessionCorpus {
	sessions: SessionInfo[];
	discoveryFailures: number;
}

export async function listConversationSessions(options: {
	cwd: string;
	scope: ConversationSearchScope;
	currentSessionFile?: string | null;
	sessionDir?: string;
}): Promise<ConversationSessionCorpus> {
	const storage = new FileSessionStorage();
	const currentPath = options.currentSessionFile ? path.resolve(options.currentSessionFile) : undefined;
	let discoveryFailures = 0;
	const onFailure = (failure: SessionDiscoveryFailure) => {
		if (failure.stage !== "enumeration" && path.resolve(failure.path) === currentPath) return;
		discoveryFailures++;
		logger.warn("Conversation discovery skipped session data", {
			...failure,
			error: failure.error instanceof Error ? failure.error.message : String(failure.error),
		});
	};
	const sessionDir =
		options.sessionDir ??
		(currentPath ? path.dirname(currentPath) : SessionManager.getDefaultSessionDir(options.cwd, undefined, storage));
	const sessions =
		options.scope === "all"
			? await listAllSessions(storage, undefined, onFailure)
			: await listSessionsReadOnly(sessionDir, storage, onFailure);
	return { sessions, discoveryFailures };
}

export async function visitVisibleConversationMessages(
	session: SessionInfo,
	sinceMs: number,
	visit: (message: VisibleConversationMessage) => void,
	signal?: AbortSignal,
): Promise<ConversationCorpusStats> {
	let visibleMessages = 0;
	let malformedRecords = 0;
	let sawHeader = false;
	await visitEntriesFromFileStream(
		session.path,
		entry => {
			if (!sawHeader) {
				if (entry.type !== "session" || entry.id !== session.id) {
					throw new Error("Session header changed after discovery");
				}
				sawHeader = true;
				return;
			}
			if (entry.type !== "message") return;
			const timestampMs = entryTimestampMs(entry.timestamp, entry.message);
			if (timestampMs === undefined || timestampMs < sinceMs) return;
			const visible = visibleText(entry.message);
			if (!visible) return;
			visibleMessages++;
			visit({ entryId: entry.id, timestampMs, ...visible });
		},
		{
			throwIfMissing: true,
			shouldContinue: () => signal?.aborted !== true,
			onMalformedRecord: () => {
				malformedRecords++;
			},
		},
	);
	if (!sawHeader) throw new Error("Session header missing after discovery");
	return { visibleMessages, malformedRecords };
}

function entryTimestampMs(timestamp: string, message: unknown): number | undefined {
	const persisted = Date.parse(timestamp);
	if (Number.isFinite(persisted)) return persisted;
	if (!isRecord(message) || typeof message.timestamp !== "number" || !Number.isFinite(message.timestamp)) {
		return undefined;
	}
	return message.timestamp;
}

function visibleText(message: unknown): { role: ConversationRole; text: string } | undefined {
	if (!isRecord(message)) return undefined;
	if (message.role === "user") {
		if (message.synthetic === true || message.attribution === "agent") return undefined;
		const text = extractText(message.content);
		return text ? { role: "user", text } : undefined;
	}
	if (message.role === "assistant") {
		const text = extractText(message.content);
		return text ? { role: "assistant", text } : undefined;
	}
	return undefined;
}

function extractText(content: unknown): string {
	if (typeof content === "string") return content.trim();
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const block of content) {
		if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
			parts.push(block.text);
		}
	}
	return parts.join("\n").trim();
}

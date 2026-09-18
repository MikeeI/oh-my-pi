import * as path from "node:path";
import { isRecord } from "@oh-my-pi/pi-utils";
import { listAllSessions, listSessionsReadOnly, type SessionInfo } from "./session-listing";
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

export async function listConversationSessions(
	cwd: string,
	scope: ConversationSearchScope,
	currentSessionFile?: string | null,
): Promise<SessionInfo[]> {
	const storage = new FileSessionStorage();
	if (scope === "all") return listAllSessions(storage);
	const sessionDir = currentSessionFile
		? path.dirname(path.resolve(currentSessionFile))
		: SessionManager.getDefaultSessionDir(cwd, undefined, storage);
	return listSessionsReadOnly(sessionDir, storage);
}

export async function visitVisibleConversationMessages(
	session: SessionInfo,
	sinceMs: number,
	visit: (message: VisibleConversationMessage) => void,
	signal?: AbortSignal,
): Promise<ConversationCorpusStats> {
	let visibleMessages = 0;
	let malformedRecords = 0;
	await visitEntriesFromFileStream(
		session.path,
		entry => {
			if (entry.type !== "message") return;
			const timestampMs = entryTimestampMs(entry.timestamp, entry.message);
			if (timestampMs === undefined || timestampMs < sinceMs) return;
			const visible = visibleText(entry.message);
			if (!visible) return;
			visibleMessages++;
			visit({ entryId: entry.id, timestampMs, ...visible });
		},
		{
			shouldContinue: () => signal?.aborted !== true,
			onMalformedRecord: () => {
				malformedRecords++;
			},
		},
	);
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

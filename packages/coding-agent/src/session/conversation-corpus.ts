import * as fs from "node:fs/promises";
import * as path from "node:path";
import { isRecord, logger } from "@oh-my-pi/pi-utils";
import { LRUCache } from "@oh-my-pi/pi-utils/lru";
import type { FileEntry } from "./session-entries";
import { listSessionsModifiedSince, type SessionDiscoveryFailure, type SessionInfo } from "./session-listing";
import { visitEntriesFromFileStream } from "./session-loader";
import { SessionManager } from "./session-manager";
import { FileSessionStorage } from "./session-storage";

/** Retained visible text across all cached journals, in UTF-16 code units plus per-message overhead. */
const TRANSCRIPT_CACHE_MAX_CHARS = 32 * 1024 * 1024;
/** Approximate per-message metadata cost charged against the cache budget. */
const TRANSCRIPT_MESSAGE_OVERHEAD_CHARS = 64;
/** Bytes before a snapshot's end whose digest must still match before appended bytes are trusted. */
const TRANSCRIPT_TAIL_DIGEST_BYTES = 4 * 1024;
/** Backward read size while locating the last newline-terminated record. */
const LINE_END_SCAN_BYTES = 64 * 1024;

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
	/** Window start; older files are never content-scanned, so their read failures cannot affect coverage. */
	modifiedSinceMs: number;
	currentSessionFile?: string | null;
	sessionDir?: string;
}): Promise<ConversationSessionCorpus> {
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
		options.scope === "all"
			? undefined
			: (options.sessionDir ??
				(currentPath
					? path.dirname(currentPath)
					: SessionManager.getDefaultSessionDir(options.cwd, undefined, new FileSessionStorage())));
	const sessions = await listSessionsModifiedSince(
		{ modifiedSinceMs: options.modifiedSinceMs, sessionDir },
		onFailure,
	);
	return { sessions, discoveryFailures };
}

interface ConversationTranscript {
	messages: readonly VisibleConversationMessage[];
	malformedRecords: number;
}

interface TranscriptSnapshot extends ConversationTranscript {
	dev: number;
	ino: number;
	sessionId: string;
	/** Byte offset just past the last newline-terminated record covered by this snapshot. */
	end: number;
	tailDigest: bigint;
	chars: number;
}

/**
 * Visible-message projections reused across searches, so repeated searches
 * parse only bytes appended since the previous one.
 *
 * Session journals change only by appending, rolling a failed append back by
 * truncation, rewriting the fixed-width title slot in place at byte 0, or
 * atomic replacement through rename, which yields a new inode. A snapshot is
 * therefore reusable while the inode matches, the file has not shrunk below
 * the snapshot end, and the bytes just before that end are unchanged. A slot
 * rewrite inside that digest window only forces a full re-read.
 */
export class ConversationTranscriptCache {
	readonly #snapshots = new LRUCache<string, TranscriptSnapshot>({
		maxSize: TRANSCRIPT_CACHE_MAX_CHARS,
		sizeCalculation: snapshot => Math.max(1, snapshot.chars),
	});

	async project(session: SessionInfo, signal: AbortSignal | undefined): Promise<ConversationTranscript> {
		const filePath = session.path;
		const stat = await fs.stat(filePath);
		const cached = this.#snapshots.get(filePath);
		const base =
			cached &&
			cached.dev === stat.dev &&
			cached.ino === stat.ino &&
			cached.sessionId === session.id &&
			stat.size >= cached.end &&
			(await tailDigest(filePath, cached.end)) === cached.tailDigest
				? cached
				: undefined;
		const start = base?.end ?? 0;
		const end = await lastLineEnd(filePath, start, stat.size);
		const shouldContinue = () => signal?.aborted !== true;

		// Complete lines extend the snapshot; a trailing partial line may still be
		// mid-append, so it is projected for this search but never cached.
		const head = new TranscriptProjector(session.id, base !== undefined);
		let consumedBytes = 0;
		if (end > start) {
			await visitEntriesFromFileStream(filePath, head.visit, {
				startByte: start,
				maxBytes: end - start,
				throwIfMissing: true,
				shouldContinue,
				onMalformedRecord: head.countMalformed,
				onBytesConsumed: bytes => {
					consumedBytes += bytes;
				},
			});
		}
		const tail = new TranscriptProjector(session.id, base !== undefined || head.sawHeader);
		if (stat.size > end) {
			await visitEntriesFromFileStream(filePath, tail.visit, {
				startByte: end,
				maxBytes: stat.size - end,
				throwIfMissing: true,
				shouldContinue,
				onMalformedRecord: tail.countMalformed,
			});
		}
		if (!tail.sawHeader && shouldContinue()) throw new Error("Session header missing after discovery");

		const prefixMessages = base ? [...base.messages, ...head.messages] : head.messages;
		const prefixMalformed = (base?.malformedRecords ?? 0) + head.malformedRecords;
		if (end > start && head.sawHeader && consumedBytes === end - start && shouldContinue()) {
			const digest = await tailDigest(filePath, end);
			const current = await fs.stat(filePath);
			// A replacement or rollback during the read leaves bytes the snapshot cannot vouch for.
			if (current.dev === stat.dev && current.ino === stat.ino && current.size >= end) {
				this.#snapshots.set(filePath, {
					dev: stat.dev,
					ino: stat.ino,
					sessionId: session.id,
					end,
					tailDigest: digest,
					messages: prefixMessages,
					malformedRecords: prefixMalformed,
					chars: retainedChars(prefixMessages),
				});
			}
		}
		return {
			messages: tail.messages.length > 0 ? [...prefixMessages, ...tail.messages] : prefixMessages,
			malformedRecords: prefixMalformed + tail.malformedRecords,
		};
	}
}

class TranscriptProjector {
	readonly messages: VisibleConversationMessage[] = [];
	malformedRecords = 0;
	readonly #sessionId: string;
	#sawHeader: boolean;

	constructor(sessionId: string, headerSeen: boolean) {
		this.#sessionId = sessionId;
		this.#sawHeader = headerSeen;
	}

	get sawHeader(): boolean {
		return this.#sawHeader;
	}

	readonly visit = (entry: FileEntry): void => {
		if (!this.#sawHeader) {
			if (entry.type !== "session" || entry.id !== this.#sessionId) {
				throw new Error("Session header changed after discovery");
			}
			this.#sawHeader = true;
			return;
		}
		if (entry.type !== "message") return;
		const timestampMs = entryTimestampMs(entry.timestamp, entry.message);
		if (timestampMs === undefined) return;
		const visible = visibleText(entry.message);
		if (!visible) return;
		this.messages.push({ entryId: entry.id, timestampMs, ...visible });
	};

	readonly countMalformed = (): void => {
		this.malformedRecords++;
	};
}

/** Visit visible messages at or after `sinceMs`, reusing cached journal projections. */
export async function visitVisibleConversationMessages(
	session: SessionInfo,
	sinceMs: number,
	visit: (message: VisibleConversationMessage) => void,
	transcripts: ConversationTranscriptCache,
	signal?: AbortSignal,
): Promise<ConversationCorpusStats> {
	const transcript = await transcripts.project(session, signal);
	let visibleMessages = 0;
	for (const message of transcript.messages) {
		if (message.timestampMs < sinceMs) continue;
		visibleMessages++;
		visit(message);
	}
	return { visibleMessages, malformedRecords: transcript.malformedRecords };
}

/** Offset just past the last newline in `[start, size)`, or `start` when that range has none. */
async function lastLineEnd(filePath: string, start: number, size: number): Promise<number> {
	const file = Bun.file(filePath);
	for (let blockEnd = size; blockEnd > start;) {
		const blockStart = Math.max(start, blockEnd - LINE_END_SCAN_BYTES);
		const newline = (await file.slice(blockStart, blockEnd).bytes()).lastIndexOf(0x0a);
		if (newline !== -1) return blockStart + newline + 1;
		blockEnd = blockStart;
	}
	return start;
}

async function tailDigest(filePath: string, end: number): Promise<bigint> {
	const bytes = await Bun.file(filePath)
		.slice(Math.max(0, end - TRANSCRIPT_TAIL_DIGEST_BYTES), end)
		.bytes();
	return BigInt(Bun.hash(bytes));
}

function retainedChars(messages: readonly VisibleConversationMessage[]): number {
	let chars = 0;
	for (const message of messages) chars += message.text.length + TRANSCRIPT_MESSAGE_OVERHEAD_CHARS;
	return chars;
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

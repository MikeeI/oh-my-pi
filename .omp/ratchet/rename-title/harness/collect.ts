import * as path from "node:path";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import {
	ConversationTranscriptCache,
	listConversationSessions,
	visitVisibleConversationMessages,
	type VisibleConversationMessage,
} from "@oh-my-pi/pi-coding-agent/session/conversation-corpus";
import { formatRecentTitleTranscript } from "@oh-my-pi/pi-coding-agent/utils/title-generator";

const ROOT = path.resolve(import.meta.dir, "../../../..");
const WINDOW_DAYS = 30;
const MAX_CANDIDATES = 60;
const since = Date.now() - WINDOW_DAYS * 86_400_000;
const corpus = await listConversationSessions({ cwd: ROOT, scope: "project", modifiedSinceMs: since });
if (corpus.discoveryFailures) throw new Error(`Incomplete corpus: ${corpus.discoveryFailures} discovery failures`);
const cache = new ConversationTranscriptCache();
const candidates = [];
for (const source of corpus.sessions) {
	if (/was kann fas rqtchet/i.test(source.firstMessage)) continue;
	const messages: VisibleConversationMessage[] = [];
	const stats = await visitVisibleConversationMessages(source, 0, message => messages.push(message), cache);
	if (stats.malformedRecords) throw new Error(`Malformed source journal: ${source.path}`);
	const lastUser = messages.findLastIndex(message => message.role === "user");
	if (lastUser < 2) continue;
	const prefix = messages.slice(0, lastUser + 1);
	const visible = prefix.map(message => ({
		role: message.role,
		content: message.text,
		timestamp: message.timestampMs,
	})) as AgentMessage[];
	const prompt = formatRecentTitleTranscript(visible);
	if (!prompt) continue;
	candidates.push({
		id: `rename-${String(candidates.length + 1).padStart(3, "0")}`,
		source: {
			session_id: source.id,
			path: source.path,
			endpoint: prefix.at(-1)?.entryId,
			modified: source.modified.toISOString(),
		},
		// Only the production formatter may select or cap turns; a fixed tail can drop an older user turn.
		messages: prefix.map(message => ({ role: message.role, text: message.text, timestamp: message.timestampMs })),
		prompt,
	});
	if (candidates.length === MAX_CANDIDATES) break;
}
await Bun.write(path.join(import.meta.dir, "../candidates.json"), `${JSON.stringify(candidates, null, 2)}\n`);
for (const item of candidates) {
	const users = item.messages.filter(message => message.role === "user");
	console.log(
		JSON.stringify({
			id: item.id,
			source: item.source.session_id,
			users: users.slice(-3).map(message => message.text.slice(0, 700)),
			chars: item.prompt.length,
		}),
	);
}
console.log(
	JSON.stringify({
		sessions: corpus.sessions.length,
		candidates: candidates.length,
		discoveryFailures: corpus.discoveryFailures,
	}),
);

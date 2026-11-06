import * as path from "node:path";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import {
	ConversationTranscriptCache,
	visitVisibleConversationMessages,
	type VisibleConversationMessage,
} from "@oh-my-pi/pi-coding-agent/session/conversation-corpus";
import { readSessionInfo } from "@oh-my-pi/pi-coding-agent/session/session-listing";
import { formatRecentTitleTranscript } from "@oh-my-pi/pi-coding-agent/utils/title-generator";

const file = path.resolve(import.meta.dir, "../cases.json");
const cases = await Bun.file(file).json();
const item = cases.find((entry: { id: string }) => entry.id === "rename-009");
if (!item) throw new Error("Missing affected case");
const session = await readSessionInfo(item.source.path);
if (!session || session.id !== item.source.session_id) throw new Error("Source session identity changed");
const messages: VisibleConversationMessage[] = [];
const stats = await visitVisibleConversationMessages(
	session,
	0,
	message => messages.push(message),
	new ConversationTranscriptCache(),
);
if (stats.malformedRecords) throw new Error("Malformed source journal");
const end = messages.findIndex(message => message.entryId === item.source.endpoint);
if (end < 0) throw new Error("Source endpoint missing");
const prefix = messages.slice(0, end + 1);
const input = prefix.map(message => ({
	role: message.role,
	content: message.text,
	timestamp: message.timestampMs,
})) as AgentMessage[];
if (formatRecentTitleTranscript(input) !== item.original_formatted_prompt)
	throw new Error("Source content no longer matches approved snapshot");
item.messages = prefix.map(message => ({ role: message.role, text: message.text, timestamp: message.timestampMs }));
await Bun.write(file, `${JSON.stringify(cases, null, 2)}\n`);
console.log(
	JSON.stringify({
		repaired: item.id,
		sourceEndpointPreserved: item.source.endpoint,
		messages: item.messages.length,
		intentsChanged: false,
	}),
);

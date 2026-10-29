import * as path from "node:path";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import {
	ConversationTranscriptCache,
	listConversationSessions,
	visitVisibleConversationMessages,
	type VisibleConversationMessage,
} from "@oh-my-pi/pi-coding-agent/session/conversation-corpus";
import type { SessionInfo } from "@oh-my-pi/pi-coding-agent/session/session-listing";
import { formatRecentTitleTranscript } from "@oh-my-pi/pi-coding-agent/utils/title-generator";

const ROOT = path.resolve(import.meta.dir, "../../../..");
const FLOW = path.resolve(import.meta.dir, "..");
const WINDOW_DAYS = 30;
const PER_STRATUM = 25;
const SAMPLE_SEED = "rename-independent-expansion-20261022";
const STRATA = ["q-reference", "continuation", "command-wrapper", "explicit-task"] as const;
type Stratum = (typeof STRATA)[number];
const previous = (await Bun.file(path.join(ROOT, ".omp/ratchet/rename-title/cases.json")).json()) as {
	source: { session_id: string; path: string };
	original_formatted_prompt: string;
}[];
const excluded = new Set(previous.map(item => item.source.session_id));
const corpus = await listConversationSessions({
	cwd: ROOT,
	scope: "all",
	modifiedSinceMs: Date.now() - WINDOW_DAYS * 86_400_000,
});
if (corpus.discoveryFailures) throw new Error(`Incomplete discovery: ${corpus.discoveryFailures}`);
const byPath = new Map(corpus.sessions.map(session => [path.resolve(session.path), session]));
function familyRoot(session: SessionInfo): string {
	const visited = new Set<string>();
	let current = session;
	while (current.parentSessionPath) {
		const parentPath = path.resolve(current.parentSessionPath);
		if (visited.has(parentPath)) throw new Error("Cyclic session ancestry");
		visited.add(parentPath);
		const parent = byPath.get(parentPath);
		if (!parent) return parentPath;
		current = parent;
	}
	return path.resolve(current.path);
}
const excludedFamilies = new Set(
	previous.map(item => {
		const session = byPath.get(path.resolve(item.source.path));
		return session ? familyRoot(session) : path.resolve(item.source.path);
	}),
);
const selectedFamilies = new Set<string>();
const promptHashes = new Set(previous.map(item => Bun.SHA256.hash(item.original_formatted_prompt, "hex")));
const ordered = corpus.sessions
	.filter(session => !excluded.has(session.id) && !/was kann fas rqtchet/i.test(session.firstMessage))
	.map(session => ({ session, priority: Bun.SHA256.hash(`${SAMPLE_SEED}:${session.id}`, "hex") }))
	.sort((a, b) => a.priority.localeCompare(b.priority));
const cache = new ConversationTranscriptCache();
const counts: Record<Stratum, number> = { "q-reference": 0, continuation: 0, "command-wrapper": 0, "explicit-task": 0 };
const selected = [];
let scanned = 0;
for (const { session } of ordered) {
	const family = familyRoot(session);
	if (excludedFamilies.has(family) || selectedFamilies.has(family)) continue;
	const messages: VisibleConversationMessage[] = [];
	const stats = await visitVisibleConversationMessages(session, 0, message => messages.push(message), cache);
	if (stats.malformedRecords) throw new Error(`Malformed source: ${session.path}`);
	scanned++;
	const end = messages.findLastIndex(message => message.role === "user");
	if (end < 2) continue;
	const prefix = messages.slice(0, end + 1);
	const last = prefix.at(-1)!.text.trim();
	const tag: Stratum = /^(?:ja\s+)?q[1-5](?:\b|\?)/iu.test(last)
		? "q-reference"
		: /^#\s/mu.test(last) && last.startsWith("#")
			? "command-wrapper"
			: last.length <= 180 &&
				  /^(?:ja\b|yes\b|fix\b|mach\b|mache\b|tu\b|do\b|apply\b|implement\b|implementiere\b|commit\b|commite\b|push\b|remove\b|entfern|lösche|lass\b)/iu.test(
						last,
				  )
				? "continuation"
				: "explicit-task";
	if (counts[tag] >= PER_STRATUM) continue;
	if (tag === "q-reference" && !prefix.some(message => message.role === "assistant" && /Q[1-5]/u.test(message.text)))
		continue;
	const fixture = prefix.map(message => ({
		role: message.role,
		content: message.text,
		timestamp: message.timestampMs,
	})) as AgentMessage[];
	const prompt = formatRecentTitleTranscript(fixture);
	if (!prompt) continue;
	const promptHash = Bun.SHA256.hash(prompt, "hex");
	if (promptHashes.has(promptHash)) continue;
	promptHashes.add(promptHash);
	selectedFamilies.add(family);
	counts[tag]++;
	selected.push({
		id: `expanded-${String(selected.length + 1).padStart(3, "0")}`,
		tag,
		source: {
			session_id: session.id,
			path: session.path,
			family,
			cwd: session.cwd,
			endpoint: prefix.at(-1)!.entryId,
			modified: session.modified.toISOString(),
		},
		messages: prefix.map(message => ({ role: message.role, text: message.text, timestamp: message.timestampMs })),
		original_formatted_prompt: prompt,
	});
	if (STRATA.every(stratum => counts[stratum] === PER_STRATUM)) break;
}
if (selected.length !== STRATA.length * PER_STRATUM)
	throw new Error(`Insufficient independent strata: ${JSON.stringify(counts)}`);
await Bun.write(path.join(FLOW, "candidates.json"), `${JSON.stringify(selected, null, 2)}\n`);
console.log(
	JSON.stringify({
		selected: selected.length,
		strata: counts,
		scanned,
		excludedOldSessions: excluded.size,
		sourceScope: "all projects, last 30 days, independent source sessions, input-only deterministic stratification",
		seed: SAMPLE_SEED,
	}),
);

#!/usr/bin/env bun
/**
 * Prompt-cache evidence for Anthropic cache findings (ledger ISSUE-028/-029/-031/-033).
 *
 * `scan` lists warm→cold transitions in local session journals with the idle gap and the
 * cache TTL class, so a miss caused by TTL expiry is never attributed to a request change.
 * `probe` sends paired live requests (R1, then R2 as its continuation) per arm on a
 * nonce-separated prefix and reports what R2 read back from the cache.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";
import {
	type AssistantMessage,
	type Context,
	completeSimple,
	type Message,
	type Tool,
	type Usage,
} from "@oh-my-pi/pi-ai";
import { Effort } from "@oh-my-pi/pi-catalog/effort";
import { createDefaultBenchRuntime } from "@oh-my-pi/pi-coding-agent/cli/bench-runtime";
import { detectCacheInvalidation } from "@oh-my-pi/pi-tui/chat/cache-invalidation-marker";
import { getSessionsDir } from "@oh-my-pi/pi-utils";

const USAGE = `Usage:
  bun scripts/cache-probe.ts scan [--days N] [--sessions-dir DIR] [--json]
  bun scripts/cache-probe.ts probe [--model PROVIDER/ID] [--reps N] [--json]

scan   Warm→cold Anthropic cache transitions in session journals (default: last 14 days).
       Columns: time session model prev_read read write gap_min ttl_min ttl_expired events
probe  Live paired requests per arm; spends real tokens (default: anthropic/claude-sonnet-5-5, 2 reps).
       Arms: A appends a newly active tool on R2, B declares it deferred from R1, C changes nothing.
       Columns: arm rep r1_read r1_write r2_read r2_write tools_same system_same`;

const DEFAULT_SCAN_DAYS = 14;
const DEFAULT_PROBE_MODEL = "anthropic/claude-sonnet-5-5";
const DEFAULT_PROBE_REPS = 2;
/** Minutes per Anthropic `cache_control.ttl` class as reported in `usage.cttl`. */
const TTL_MINUTES: Record<string, number> = { ephemeral5m: 5, ephemeral1h: 60 };
/** Session-file entries that can explain a prompt-cache miss on the next request. */
const CAUSE_ENTRY_TYPES: Record<string, true> = {
	compaction: true,
	model_change: true,
	mode_change: true,
	thinking_level_change: true,
	service_tier_change: true,
	reset_boundary: true,
	branch_summary: true,
};
/** Gap between R1 and R2 so R1's cache write is readable. */
const PROBE_PAUSE_MS = 3000;

interface JournalEntry {
	type?: string;
	timestamp?: string;
	mode?: string;
	customType?: string;
	details?: { added?: string[]; removed?: string[] };
	message?: AssistantMessage | { role: string };
}

interface MissRow {
	time: string;
	session: string;
	model: string;
	prevRead: number;
	read: number;
	write: number;
	gapMinutes: number | null;
	ttlMinutes: number | null;
	ttlExpired: boolean | null;
	events: string[];
}

function parseCount(flag: string, value: string, min: number): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < min) throw new Error(`${flag} must be an integer >= ${min}.`);
	return parsed;
}

function causeLabel(entry: JournalEntry): string | undefined {
	if (entry.type === "custom_message" && entry.customType === "tool-roster-notice") {
		const added = (entry.details?.added ?? []).map(name => `+${name}`);
		const removed = (entry.details?.removed ?? []).map(name => `-${name}`);
		return `tools(${[...added, ...removed].join(",")})`;
	}
	if (!entry.type || !CAUSE_ENTRY_TYPES[entry.type]) return undefined;
	return entry.type === "mode_change" ? `mode_change:${entry.mode}` : entry.type;
}

function ttlMinutesOf(usage: Usage & { cttl?: Record<string, number> }): number | null {
	const classes = Object.keys(usage.cttl ?? {}).filter(key => key in TTL_MINUTES);
	return classes.length > 0 ? Math.max(...classes.map(key => TTL_MINUTES[key]!)) : null;
}

async function listJournals(root: string, sinceMs: number): Promise<string[]> {
	const files: string[] = [];
	for (const relative of await fs.readdir(root, { recursive: true })) {
		// `changes.jsonl` is the per-session file-change log, not a transcript.
		if (!relative.endsWith(".jsonl") || path.basename(relative) === "changes.jsonl") continue;
		const file = path.join(root, relative);
		if ((await fs.stat(file)).mtimeMs >= sinceMs) files.push(file);
	}
	return files.sort();
}

function scanJournal(file: string, entries: JournalEntry[], root: string): MissRow[] {
	const rows: MissRow[] = [];
	let prev: { message: AssistantMessage; endedAt: number } | undefined;
	let events: string[] = [];
	for (const entry of entries) {
		const message = entry.message;
		if (entry.type !== "message" || message?.role !== "assistant") {
			const label = causeLabel(entry);
			if (label) events.push(label);
			continue;
		}
		const current = message as AssistantMessage;
		const endedAt = entry.timestamp ? Date.parse(entry.timestamp) : current.timestamp;
		if (current.provider === "anthropic" && prev && prev.message.provider === "anthropic") {
			if (detectCacheInvalidation(prev.message.usage, current.usage)) {
				// The request starts at the message timestamp; the predecessor's prefix was written when it ended.
				const gapMinutes = (current.timestamp - prev.endedAt) / 60_000;
				const ttlMinutes = ttlMinutesOf(prev.message.usage);
				rows.push({
					time: new Date(current.timestamp).toISOString(),
					session: path.relative(root, file),
					model: current.model,
					prevRead: prev.message.usage.cacheRead,
					read: current.usage.cacheRead,
					write: current.usage.cacheWrite,
					gapMinutes: Number.isFinite(gapMinutes) ? Math.round(gapMinutes * 10) / 10 : null,
					ttlMinutes,
					ttlExpired: ttlMinutes === null || !Number.isFinite(gapMinutes) ? null : gapMinutes > ttlMinutes,
					events,
				});
			}
		}
		if (current.usage.cacheRead + current.usage.cacheWrite + current.usage.input > 0) {
			prev = { message: current, endedAt };
		}
		events = [];
	}
	return rows;
}

async function runScan(argv: string[]): Promise<void> {
	const { values } = parseArgs({
		args: argv,
		strict: true,
		options: {
			days: { type: "string", default: String(DEFAULT_SCAN_DAYS) },
			"sessions-dir": { type: "string" },
			json: { type: "boolean", default: false },
		},
	});
	const days = parseCount("--days", values.days, 1);
	const root = path.resolve(values["sessions-dir"] ?? getSessionsDir());
	const files = await listJournals(root, Date.now() - days * 86_400_000);
	const rows: MissRow[] = [];
	let skipped = 0;
	for (const file of files) {
		let entries: JournalEntry[];
		try {
			entries = Bun.JSONL.parse(await Bun.file(file).text()) as JournalEntry[];
		} catch (error) {
			skipped++;
			process.stderr.write(`skip ${file}: ${error instanceof Error ? error.message : String(error)}\n`);
			continue;
		}
		rows.push(...scanJournal(file, entries, root));
	}
	rows.sort((a, b) => a.time.localeCompare(b.time));
	const expired = rows.filter(row => row.ttlExpired === true).length;
	process.stderr.write(
		`scanned=${files.length} skipped=${skipped} misses=${rows.length} ttl_expired=${expired} root=${root}\n`,
	);
	if (values.json) {
		process.stdout.write(`${JSON.stringify(rows)}\n`);
		return;
	}
	const table = rows.map(row => [
		row.time,
		row.session,
		row.model,
		String(row.prevRead),
		String(row.read),
		String(row.write),
		row.gapMinutes === null ? "?" : String(row.gapMinutes),
		row.ttlMinutes === null ? "?" : String(row.ttlMinutes),
		row.ttlExpired === null ? "?" : row.ttlExpired ? "yes" : "no",
		row.events.length > 0 ? row.events.join(" ") : "-",
	]);
	printTable(
		["time", "session", "model", "prev_read", "read", "write", "gap_min", "ttl_min", "ttl_expired", "events"],
		table,
	);
}

function printTable(header: string[], rows: string[][]): void {
	const widths = header.map((cell, column) => Math.max(cell.length, ...rows.map(row => row[column]!.length)));
	for (const row of [header, ...rows]) {
		process.stdout.write(
			`${row
				.map((cell, column) => cell.padEnd(widths[column]!))
				.join("  ")
				.trimEnd()}\n`,
		);
	}
}

type ProbeArm = "A" | "B" | "C";
interface ProbeRow {
	arm: ProbeArm;
	rep: number;
	r1: Usage;
	r2: Usage;
	toolsSame: boolean;
	systemSame: boolean;
}

/** Deterministic text sized well above every Anthropic cacheable-prefix floor. */
function filler(tag: string, lines: number): string {
	return Array.from(
		{ length: lines },
		(_, i) => `${tag} rule ${i}: keep behavior ${i * 7} stable across turn ${i % 13}.`,
	).join("\n");
}

async function runProbe(argv: string[]): Promise<void> {
	const { values } = parseArgs({
		args: argv,
		strict: true,
		options: {
			model: { type: "string", default: DEFAULT_PROBE_MODEL },
			reps: { type: "string", default: String(DEFAULT_PROBE_REPS) },
			json: { type: "boolean", default: false },
		},
	});
	const reps = parseCount("--reps", values.reps, 1);
	const [provider, ...idParts] = values.model.split("/");
	const modelId = idParts.join("/");
	if (!provider || !modelId) throw new Error("--model must be PROVIDER/ID.");
	const runtime = await createDefaultBenchRuntime();
	try {
		const model = runtime.modelRegistry.getAll().find(entry => entry.provider === provider && entry.id === modelId);
		if (!model) throw new Error(`Model ${values.model} is not in the catalog.`);
		if (model.api !== "anthropic-messages")
			throw new Error(`probe arms target anthropic-messages, not ${model.api}.`);
		const apiKey = await runtime.modelRegistry.getApiKey(model);
		if (!apiKey) throw new Error(`No credential for ${values.model}.`);

		const schema = {
			type: "object",
			properties: { arg: { type: "string" } },
			required: ["arg"],
		} as Tool["parameters"];
		const added: Tool = {
			name: "probe_added",
			description: `Added tool.\n${filler("added", 10)}`,
			parameters: schema,
		};
		const systemPrompt = [`You are a terse assistant. Answer in one word.\n${filler("sys", 250)}`];
		// The provider's own wire shape for the deferred tool, captured on arm A's R2 and replayed by arm B's R1.
		let deferredWire: Record<string, unknown> | undefined;
		const isAdded = (wire: Record<string, unknown>) =>
			typeof wire.name === "string" && wire.name.endsWith(added.name);

		const call = async (context: Context, declareAddedUpFront: boolean) => {
			let toolsHash = "";
			let systemHash = "";
			const message = await completeSimple(model, context, {
				apiKey,
				cacheRetention: "short",
				reasoning: Effort.Low,
				maxTokens: 256,
				onPayload: payload => {
					const params = payload as { tools?: Record<string, unknown>[]; system?: unknown };
					if (declareAddedUpFront) {
						if (!deferredWire) throw new Error("arm B needs arm A's deferred wire shape first");
						params.tools = [...(params.tools ?? []), structuredClone(deferredWire)];
					}
					const wire = params.tools?.find(isAdded);
					if (wire && !deferredWire) {
						const { cache_control: _breakpoint, ...rest } = wire;
						deferredWire = rest;
					}
					toolsHash = Bun.hash(JSON.stringify(params.tools)).toString(16);
					systemHash = Bun.hash(JSON.stringify(params.system)).toString(16);
					return params;
				},
			});
			if (message.stopReason === "error") throw new Error(`request failed: ${message.errorMessage}`);
			return { message, toolsHash, systemHash };
		};

		const rows: ProbeRow[] = [];
		for (let rep = 0; rep < reps; rep++) {
			for (const arm of ["A", "B", "C"] as const) {
				const nonce = `${arm}-${rep}-${crypto.randomUUID()}`;
				const tools: Tool[] = Array.from({ length: 8 }, (_, i) => ({
					name: `probe_tool_${i}`,
					description: `${i === 0 ? `nonce ${nonce}. ` : ""}Tool ${i}.\n${filler(`t${i}`, 40)}`,
					parameters: schema,
				}));
				const first: Message = {
					role: "user",
					content: `Context document:\n${filler("doc", 150)}\nReply with OK.`,
					timestamp: Date.now(),
				};
				const r1 = await call({ systemPrompt, tools, messages: [first] }, arm === "B");
				await Bun.sleep(PROBE_PAUSE_MS);
				const followUp: Message = { role: "user", content: "Reply with OK again.", timestamp: Date.now() };
				const r2 = await call(
					{
						systemPrompt,
						tools: arm === "C" ? tools : [...tools, added],
						messages: [first, r1.message, followUp],
					},
					false,
				);
				rows.push({
					arm,
					rep,
					r1: r1.message.usage,
					r2: r2.message.usage,
					toolsSame: r1.toolsHash === r2.toolsHash,
					systemSame: r1.systemHash === r2.systemHash,
				});
			}
		}
		process.stderr.write(`model=${values.model} reps=${reps}\n`);
		if (values.json) {
			process.stdout.write(`${JSON.stringify(rows)}\n`);
			return;
		}
		printTable(
			["arm", "rep", "r1_read", "r1_write", "r2_read", "r2_write", "tools_same", "system_same"],
			rows.map(row => [
				row.arm,
				String(row.rep),
				String(row.r1.cacheRead),
				String(row.r1.cacheWrite),
				String(row.r2.cacheRead),
				String(row.r2.cacheWrite),
				row.toolsSame ? "yes" : "no",
				row.systemSame ? "yes" : "no",
			]),
		);
	} finally {
		runtime.close?.();
	}
}

const [command, ...rest] = Bun.argv.slice(2);
if (command === "scan") await runScan(rest);
else if (command === "probe") await runProbe(rest);
else {
	process.stderr.write(`${USAGE}\n`);
	process.exit(command === "--help" || command === "-h" ? 0 : 2);
}

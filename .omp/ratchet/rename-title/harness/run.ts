import { AsyncLocalStorage } from "node:async_hooks";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { spyOn } from "bun:test";
import { type } from "@oh-my-pi/omptype";
import { Agent, type AgentMessage } from "@oh-my-pi/pi-agent-core";
import * as ai from "@oh-my-pi/pi-ai";
import { chatTextBackend, judgeQuestions, TextJudge, tokenUsage } from "@oh-my-pi/pi-ai/judgment";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { RatchetState } from "@oh-my-pi/pi-coding-agent/ratchet/ratchet";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { discoverAuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-broker-config";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { splitCardTitle } from "@oh-my-pi/pi-coding-agent/utils/title-card";
import { formatRecentTitleTranscript } from "@oh-my-pi/pi-coding-agent/utils/title-generator";
import { isEnoent } from "@oh-my-pi/pi-utils";
import config from "./config.json" with { type: "json" };
import questionFile from "./questions.json" with { type: "json" };

const ROOT = config.cwd;
const FLOW = path.resolve(import.meta.dir, "..");
const CONCURRENCY = 4;
const CASE_TIMEOUT_MS = 120_000;
const EXISTING_TITLE = "🔧 RENAME: Existing session";
const QUESTIONS = judgeQuestions(questionFile);
const messageSchema = type({ role: "'user' | 'assistant'", text: "string", timestamp: "number" });
const caseSchema = type({
	id: "string",
	tag: "string",
	intent: "string",
	oracle: "string",
	messages: messageSchema.array(),
	original_formatted_prompt: "string",
});
const completedSlotSchema = type({ prompt_id: "string", rep: "number", model: "string", judge_model: "string" });
type RenameCase = typeof caseSchema.infer;
interface CapturedCall {
	model: string;
	context: ai.Context;
	responses: ai.AssistantMessage[];
	fault?: string;
}
interface Capture {
	kind: "application" | "judge";
	calls: CapturedCall[];
	induceFault?: boolean;
}
interface ResultRow {
	prompt_id: string;
	rep: number;
	prompt: string;
	tags: string[];
	grade: { quality: number; format: number };
	explanation: string;
	status: "ok" | "truncated";
	model: string;
	usage: ai.Usage;
	latency_s: number;
	judge_model: string;
	judge_usage: ai.Usage;
	attempts: number;
}
interface PilotRow {
	id: string;
	intent: string;
	title: string;
	grade: ResultRow["grade"];
	explanation: string;
	model: string;
	usage: ai.Usage;
	judgeModel: string;
	judgeUsage: ai.Usage;
	latency_s: number;
}

const { values } = parseArgs({
	options: {
		mode: { type: "string" },
		variant: { type: "string" },
		out: { type: "string" },
	},
	strict: true,
});
if (!values.mode || !["preflight", "pilot", "regrade-pilot", "validate-grader", "fault", "run"].includes(values.mode)) {
	throw new Error("Required --mode: preflight | pilot | regrade-pilot | validate-grader | fault | run");
}
const cases = caseSchema.array().assert(await Bun.file(path.join(FLOW, "cases.json")).json());
const state = (await Bun.file(path.join(FLOW, "_state.json")).json()) as RatchetState;
if (new Set(cases.map(item => item.id)).size !== cases.length) throw new Error("Duplicate case ids");
if (cases.some(item => !state.train_ids.includes(item.id) && !state.test_ids.includes(item.id)))
	throw new Error("Unsplit case");
for (const [file, expected] of Object.entries(config.sourceHashes)) {
	if (Bun.SHA256.hash(await Bun.file(path.join(ROOT, file)).arrayBuffer(), "hex") !== expected)
		throw new Error(`Source changed: ${file}`);
}
for (const [file, expected] of Object.entries(config.configHashes)) {
	if (Bun.SHA256.hash(await Bun.file(path.join(config.agentDir, file)).arrayBuffer(), "hex") !== expected)
		throw new Error(`Effective config changed: ${file}`);
}

function fixtureMessages(item: RenameCase): AgentMessage[] {
	return item.messages.map(message =>
		message.role === "user"
			? { role: "user" as const, content: message.text, timestamp: message.timestamp }
			: {
					role: "assistant" as const,
					content: [{ type: "text" as const, text: message.text }],
					api: config.titleModel.api as ai.Api,
					provider: config.titleModel.provider,
					model: config.titleModel.id,
					usage: tokenUsage(0, 0),
					stopReason: "stop" as const,
					timestamp: message.timestamp,
				},
	);
}

if (values.mode === "preflight") {
	const lengths = cases.map(item => formatRecentTitleTranscript(fixtureMessages(item))?.length ?? 0);
	if (lengths.some(length => length === 0)) throw new Error("Empty formatted conversation");
	const mismatched = cases.filter(
		item => formatRecentTitleTranscript(fixtureMessages(item)) !== item.original_formatted_prompt,
	);
	if (mismatched.length) throw new Error(`Fixture lost source context: ${mismatched.map(item => item.id).join(", ")}`);
	console.log(
		JSON.stringify({
			cases: cases.length,
			train: state.train_ids.length,
			test: state.test_ids.length,
			maxPromptChars: Math.max(...lengths),
			applicationEntry: "AgentSession.renameTitle",
			existingCard: EXISTING_TITLE,
			titleModel: config.titleModel,
			judgeModel: config.judgeModel,
		}),
	);
	process.exit(0);
}

const settings = await Settings.loadReadOnly({ cwd: ROOT, agentDir: config.agentDir });
if (
	settings.getModelRole("tiny") !== config.titleSelector ||
	settings.getModelRole("expert") !== config.judgeSelector
) {
	throw new Error("Configured model roles changed");
}
const auth = await discoverAuthStorage(config.agentDir);
const registry = new ModelRegistry(auth, path.join(config.agentDir, "models.yml"), { settings });
await registry.hydrateCredentialScopedModelCaches();
const titleModel = registry.find(config.titleModel.provider, config.titleModel.id);
const judgeModel = registry.find(config.judgeModel.provider, config.judgeModel.id);
if (!titleModel || !judgeModel) throw new Error("Frozen title model or judge unavailable");
const captures = new AsyncLocalStorage<Capture>();
const originalComplete = ai.completeSimple;
// This isolated process instruments the real completion instead of duplicating its request construction.
const completionSpy = spyOn(ai, "completeSimple").mockImplementation(async (model, context, options) => {
	const capture = captures.getStore();
	const call: CapturedCall = { model: `${model.provider}/${model.id}`, context, responses: [] };
	capture?.calls.push(call);
	if (capture?.induceFault && capture.kind === "application") {
		call.fault = "induced API failure";
		throw new Error(call.fault);
	}
	return originalComplete(model, context, {
		...options,
		onAttempt: response => {
			call.responses.push(response);
			options?.onAttempt?.(response);
		},
	});
});

function sumUsage(responses: ai.AssistantMessage[]): ai.Usage {
	const usage = tokenUsage(0, 0);
	for (const response of responses) {
		usage.input += response.usage.input;
		usage.output += response.usage.output;
		usage.cacheRead += response.usage.cacheRead;
		usage.cacheWrite += response.usage.cacheWrite;
		usage.totalTokens += response.usage.totalTokens;
		for (const key of ["input", "output", "cacheRead", "cacheWrite", "total"] as const)
			usage.cost[key] += response.usage.cost[key];
	}
	return usage;
}

async function evaluate(item: RenameCase, title: string, signal: AbortSignal) {
	const capture: Capture = { kind: "judge", calls: [] };
	const judgeId = `rename-ratchet-judge-${crypto.randomUUID()}`;
	const credential = await registry.getApiKey(judgeModel!, judgeId);
	if (!credential) throw new Error("No credential for independent judge");
	const judge = new TextJudge(
		chatTextBackend(judgeModel!, { apiKey: registry.resolver(judgeModel!, judgeId), sessionId: judgeId }),
	);
	try {
		const result = await captures.run(capture, () =>
			judge.judge(
				{
					state: {
						conversation: formatRecentTitleTranscript(fixtureMessages(item))!,
						expected_intent: item.intent,
						example_title: item.oracle,
						candidate_title: title,
					},
					questions: QUESTIONS,
				},
				{ signal },
			),
		);
		const responses = capture.calls.flatMap(call => call.responses);
		if (
			!responses.length ||
			responses.some(response => response.provider !== judgeModel!.provider || response.model !== judgeModel!.id)
		) {
			throw new Error("Judge served-model mismatch or missing instrumentation");
		}
		if (capture.calls.length !== 1 || responses.length !== 1 || responses[0]?.stopReason === "length")
			throw new Error("Judge required a retry or was truncated");
		return {
			quality: (result.answers.focus.noul + result.answers.recognizable.noul) / 2,
			explanation: `focus=${result.answers.focus.noul}; recognizable=${result.answers.recognizable.noul}`,
			model: `${responses[0]!.provider}/${responses[0]!.model}`,
			usage: sumUsage(responses),
		};
	} finally {
		auth.sessions.release(judgeModel!.provider, judgeId);
	}
}

function titleFormat(title: string): number {
	const words = title.trim().split(/\s+/u).filter(Boolean).length;
	return Number(words >= 3 && words <= 7 && !/[\r\n<>`\x00-\x1f]/u.test(title));
}

async function trial(item: RenameCase, rep: number, outDir: string, induceFault = false) {
	const signal = AbortSignal.timeout(CASE_TIMEOUT_MS);
	const capture: Capture = { kind: "application", calls: [], induceFault };
	const manager = SessionManager.inMemory(ROOT);
	await manager.setSessionName(EXISTING_TITLE);
	const agent = new Agent({ initialState: { model: titleModel!, tools: [] } });
	const session = new AgentSession({
		agent,
		sessionManager: manager,
		settings,
		modelRegistry: registry,
		agentId: "Main",
	});
	agent.replaceMessages(fixtureMessages(item));
	const started = performance.now();
	try {
		const renamed = await captures.run(capture, () => session.renameTitle(undefined, signal));
		if (!renamed) throw new Error(induceFault ? "induced_api_error" : "Application produced no title");
		const latency = (performance.now() - started) / 1000;
		const card = splitCardTitle(renamed);
		if (!card || card.icon !== "🔧" || card.code !== "RENAME") throw new Error("Existing card was not preserved");
		const responses = capture.calls.flatMap(call => call.responses);
		if (
			!responses.length ||
			responses.some(response => response.provider !== titleModel!.provider || response.model !== titleModel!.id)
		) {
			throw new Error("Application served-model mismatch or missing instrumentation");
		}
		const retry = capture.calls.length !== 1 || responses.length !== 1;
		const evaluated = await evaluate(item, card.title, signal);
		const row: ResultRow = {
			prompt_id: item.id,
			rep,
			prompt: formatRecentTitleTranscript(fixtureMessages(item))!,
			tags: [item.tag],
			grade: { quality: retry ? 0 : evaluated.quality, format: titleFormat(card.title) },
			explanation: `${evaluated.explanation}; strict_retry_failure=${retry}`,
			status: responses.some(response => response.stopReason === "length") ? "truncated" : "ok",
			model: `${responses.at(-1)!.provider}/${responses.at(-1)!.model}`,
			usage: sumUsage(responses),
			latency_s: latency,
			judge_model: evaluated.model,
			judge_usage: evaluated.usage,
			attempts: responses.length,
		};
		if (row.usage.totalTokens <= 0 || row.judge_usage.totalTokens <= 0) throw new Error("Missing usage accounting");
		// Held-out outputs never reach disk; only training trials have application transcripts.
		if (state.train_ids.includes(item.id)) {
			const trace = capture.calls.flatMap(call => [
				{ role: "system", content: call.context.systemPrompt?.join("\n\n") ?? "" },
				...call.context.messages.map(message => ({ role: message.role, content: message.content })),
				...call.responses.map(response => ({
					role: "assistant",
					content: response.content.filter(block => block.type === "text"),
				})),
			]);
			await Bun.write(
				path.join(outDir, "traces", `${item.id}_rep${rep}.json`),
				`${JSON.stringify(trace, null, 2)}\n`,
			);
		}
		return { row, title: card.title };
	} finally {
		await session.dispose();
	}
}

const pilotIds = ["rename-001", "rename-012", "rename-016", "rename-019", "rename-031"];
const pilotCases = pilotIds.map(id => {
	const item = cases.find(candidate => candidate.id === id);
	if (!item || !state.train_ids.includes(id)) throw new Error(`Pilot must use train case: ${id}`);
	return item;
});
const outDir = path.resolve(ROOT, values.out ?? path.join(FLOW, values.mode));
await fs.mkdir(outDir, { recursive: true });
try {
	if (values.mode === "regrade-pilot") {
		const previous = (await Bun.file(path.join(FLOW, "pilot", "preview.json")).json()) as PilotRow[];
		const regraded: PilotRow[] = [];
		for (const row of previous) {
			const item = pilotCases.find(candidate => candidate.id === row.id);
			if (!item || row.model !== `${config.titleModel.provider}/${config.titleModel.id}`) {
				throw new Error("Regrading requires an existing Luna training pilot");
			}
			const evaluated = await evaluate(item, row.title, AbortSignal.timeout(CASE_TIMEOUT_MS));
			regraded.push({
				...row,
				grade: { quality: evaluated.quality, format: titleFormat(row.title) },
				explanation: evaluated.explanation,
				judgeModel: evaluated.model,
				judgeUsage: evaluated.usage,
			});
		}
		await Bun.write(path.join(outDir, "preview.json"), `${JSON.stringify(regraded, null, 2)}\n`);
		console.log(
			JSON.stringify({
				mode: values.mode,
				titles: regraded.length,
				titleModel: config.titleModel,
				judgeModel: config.judgeModel,
				freshTitleRequests: 0,
			}),
		);
	} else if (values.mode === "validate-grader") {
		const rows = [];
		for (const item of pilotCases) {
			for (const [kind, title] of [
				["oracle", item.oracle],
				["empty", ""],
				["constant", "I don't know"],
				["wrong", "Banana bread baking instructions"],
			] as const) {
				const first = await evaluate(item, title, AbortSignal.timeout(CASE_TIMEOUT_MS));
				rows.push({ prompt_id: item.id, kind, title, quality: first.quality, explanation: first.explanation });
				if (kind === "oracle" && first.quality !== 1) throw new Error(`Oracle rejected: ${item.id}`);
				if (kind !== "oracle" && first.quality !== 0)
					throw new Error(`Null/wrong answer passed: ${item.id}/${kind}`);
				if (kind === "oracle") {
					const second = await evaluate(item, title, AbortSignal.timeout(CASE_TIMEOUT_MS));
					if (first.quality !== second.quality) throw new Error(`Unstable grader: ${item.id}`);
				}
			}
		}
		await Bun.write(path.join(outDir, "checks.json"), `${JSON.stringify(rows, null, 2)}\n`);
		console.log(JSON.stringify({ mode: values.mode, oracle: "5/5", negative: "15/15", repeatAgreement: "5/5" }));
	} else {
		const selected = values.mode === "run" ? cases : values.mode === "fault" ? pilotCases.slice(0, 1) : pilotCases;
		if (values.mode === "run" && (!values.variant || !Number.isInteger(state.reps) || !state.reps))
			throw new Error("Run requires --variant and approved reps");
		const reps = values.mode === "run" ? state.reps! : 1;
		const resultsPath = path.join(outDir, "results.jsonl");
		const errorsPath = path.join(outDir, "errors.jsonl");
		let existing: (typeof completedSlotSchema.infer)[] = [];
		try {
			existing = completedSlotSchema.array().assert(Bun.JSONL.parse(await Bun.file(resultsPath).text()));
		} catch (error) {
			if (!isEnoent(error)) throw error;
		}
		if (
			existing.some(
				row =>
					!Number.isInteger(row.rep) ||
					row.rep < 0 ||
					row.rep >= reps ||
					!selected.some(item => item.id === row.prompt_id) ||
					row.model !== `${config.titleModel.provider}/${config.titleModel.id}` ||
					row.judge_model !== `${config.judgeModel.provider}/${config.judgeModel.id}`,
			)
		) {
			throw new Error("Existing results do not match this frozen run");
		}
		const completed = new Set(existing.map(row => `${row.prompt_id}:${row.rep}`));
		if (completed.size !== existing.length) throw new Error("Duplicate existing result slot");
		const jobs = selected
			.flatMap(item => Array.from({ length: reps }, (_, rep) => ({ item, rep })))
			.filter(job => !completed.has(`${job.item.id}:${job.rep}`));
		let next = 0;
		let failures = 0;
		const pilot: PilotRow[] = [];
		await Promise.all(
			Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
				for (;;) {
					const job = jobs[next++];
					if (!job) return;
					try {
						const result = await trial(job.item, job.rep, outDir, values.mode === "fault");
						await fs.appendFile(resultsPath, `${JSON.stringify(result.row)}\n`);
						if (values.mode === "pilot")
							pilot.push({
								id: job.item.id,
								intent: job.item.intent,
								title: result.title,
								grade: result.row.grade,
								explanation: result.row.explanation,
								model: result.row.model,
								usage: result.row.usage,
								judgeModel: result.row.judge_model,
								judgeUsage: result.row.judge_usage,
								latency_s: result.row.latency_s,
							});
						console.log(
							JSON.stringify({
								id: job.item.id,
								rep: job.rep,
								grade: result.row.grade,
								model: result.row.model,
								latency_s: result.row.latency_s,
							}),
						);
					} catch (error) {
						failures++;
						const message = error instanceof Error ? error.message : String(error);
						await fs.appendFile(
							errorsPath,
							`${JSON.stringify({
								prompt_id: job.item.id,
								rep: job.rep,
								class:
									values.mode === "fault"
										? "induced_api_error"
										: /timeout|abort/i.test(message)
											? "timeout"
											: "runtime_or_grader_error",
								error: message,
							})}\n`,
						);
						console.error(JSON.stringify({ id: job.item.id, rep: job.rep, error: message }));
					}
				}
			}),
		);
		if (values.mode === "pilot")
			await Bun.write(path.join(outDir, "preview.json"), `${JSON.stringify(pilot, null, 2)}\n`);
		if (values.mode === "fault") {
			if (failures !== 1 || (await Bun.file(resultsPath).exists()))
				throw new Error("Induced API error leaked into results");
			console.log(JSON.stringify({ mode: "fault", errors: 1, scorableRows: 0 }));
		} else if (failures) {
			process.exitCode = 1;
		}
	}
} finally {
	completionSpy.mockRestore();
	auth.close();
}

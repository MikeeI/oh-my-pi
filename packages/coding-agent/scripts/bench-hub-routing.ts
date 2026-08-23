#!/usr/bin/env bun
import * as path from "node:path";
import { parseArgs } from "node:util";
import { isRecord, readLines } from "@oh-my-pi/pi-utils";
import cursorLogsPrompt from "../src/prompts/bench/hub-routing-cursor-logs.md" with { type: "text" };
import peerMessagePrompt from "../src/prompts/bench/hub-routing-peer-message.md" with { type: "text" };
import processInputPrompt from "../src/prompts/bench/hub-routing-process-input.md" with { type: "text" };
import readinessStartPrompt from "../src/prompts/bench/hub-routing-readiness-start.md" with { type: "text" };
import systemPrompt from "../src/prompts/bench/hub-routing-system.md" with { type: "text" };

const DEFAULT_MODELS = [
	"openai-codex/gpt-5.6-sol",
	"openai-codex/gpt-5.6-terra",
	"openai-codex/gpt-5.6-luna",
	"openai-codex/gpt-5.5",
	"openai-codex/gpt-5.4-mini",
] as const;
const DEFAULT_TIMEOUT_SECONDS = 60;
const MAX_TIMEOUT_SECONDS = 600;
const CLI_PATH = path.join(import.meta.dir, "../src/cli.ts");
const USAGE = `Usage: bun scripts/bench-hub-routing.ts [options]

Options:
  --models <selectors>  Comma-separated model selectors (default: five Codex GPT models)
  --scenarios <ids>     Comma-separated scenario IDs (default: all four)
  --timeout <seconds>   Per-request timeout (default: 60)
  --json                Emit exactly one JSON report
  --help                Show this help
`;

interface HubRoutingScenario {
	id: string;
	prompt: string;
	expected: Record<string, unknown>;
}

export const HUB_ROUTING_SCENARIOS: readonly HubRoutingScenario[] = [
	{
		id: "peer-message",
		prompt: peerMessagePrompt.trim(),
		expected: {
			op: "send",
			to: "AuthLoader",
			message: "Still touching src/server/auth.ts? I need to add a 401 path.",
			await: false,
		},
	},
	{
		id: "readiness-start",
		prompt: readinessStartPrompt.trim(),
		expected: {
			op: "start",
			name: "web",
			application: "bun",
			args: ["run", "dev"],
			ready: { log: "Local:.*http", port: 5173, timeout: 30 },
		},
	},
	{
		id: "cursor-logs",
		prompt: cursorLogsPrompt.trim(),
		expected: { op: "logs", name: "web", follow: true, cursor: 1842, timeout: 30 },
	},
	{
		id: "process-input",
		prompt: processInputPrompt.trim(),
		expected: { op: "send", name: "debugger", keys: ["CTRL_C"] },
	},
];
const HUB_ROUTING_SCENARIO_BY_ID = Object.fromEntries(
	HUB_ROUTING_SCENARIOS.map(scenario => [scenario.id, scenario]),
) as Readonly<Record<string, HubRoutingScenario>>;

export interface HubRoutingBenchmarkOptions {
	models: string[];
	scenarioIds: string[];
	timeoutSeconds: number;
	json: boolean;
}

interface HubRoutingUsage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: number;
}

export interface HubRoutingObservation {
	model: string;
	scenario: string;
	passed: boolean;
	tool?: string;
	arguments?: Record<string, unknown>;
	reason?: string;
	durationMs: number;
	usage?: HubRoutingUsage;
	stderr?: string;
}

export interface HubRoutingBenchmarkReport {
	schemaVersion: 1;
	benchmark: "hub_routing";
	measuredAt: string;
	evaluator: {
		models: string[];
		scenarios: string[];
		requests: number;
		thinking: "off";
		approvalMode: "read-only";
		timeoutSeconds: number;
	};
	result: {
		passed: number;
		failed: number;
		exactCallRate: number;
		totalDurationMs: number;
		totalCost: number;
	};
	models: Array<{ model: string; passed: number; failed: number; exactCallRate: number }>;
	observations: HubRoutingObservation[];
}

interface AssistantToolCall {
	name: string;
	arguments: Record<string, unknown>;
}

interface AssistantObservation {
	toolCalls: AssistantToolCall[];
	usage?: HubRoutingUsage;
}

export function parseHubRoutingBenchmarkArgs(argv: readonly string[]): HubRoutingBenchmarkOptions | null {
	const { values } = parseArgs({
		args: [...argv],
		allowPositionals: false,
		strict: true,
		options: {
			models: { type: "string", default: DEFAULT_MODELS.join(",") },
			scenarios: { type: "string", default: HUB_ROUTING_SCENARIOS.map(scenario => scenario.id).join(",") },
			timeout: { type: "string", default: String(DEFAULT_TIMEOUT_SECONDS) },
			json: { type: "boolean", default: false },
			help: { type: "boolean", default: false },
		},
	});
	if (values.help) return null;
	const models = values.models
		.split(",")
		.map(model => model.trim())
		.filter(Boolean);
	if (models.length === 0) throw new Error("--models must contain at least one selector.");
	const scenarioIds = values.scenarios
		.split(",")
		.map(scenario => scenario.trim())
		.filter(Boolean);
	if (scenarioIds.length === 0) throw new Error("--scenarios must contain at least one scenario ID.");
	const unknownScenarioIds = scenarioIds.filter(scenario => HUB_ROUTING_SCENARIO_BY_ID[scenario] === undefined);
	if (unknownScenarioIds.length > 0) {
		throw new Error(`Unknown --scenarios value: ${unknownScenarioIds.join(", ")}.`);
	}
	const timeoutSeconds = Number(values.timeout);
	if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0 || timeoutSeconds > MAX_TIMEOUT_SECONDS) {
		throw new Error(`--timeout must be an integer from 1 to ${MAX_TIMEOUT_SECONDS}.`);
	}
	return { models, scenarioIds, timeoutSeconds, json: values.json };
}

function finiteNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseUsage(value: unknown): HubRoutingUsage | undefined {
	if (!isRecord(value)) return undefined;
	const cost = isRecord(value.cost) ? finiteNumber(value.cost.total) : 0;
	return {
		input: finiteNumber(value.input),
		output: finiteNumber(value.output),
		cacheRead: finiteNumber(value.cacheRead),
		cacheWrite: finiteNumber(value.cacheWrite),
		totalTokens: finiteNumber(value.totalTokens),
		cost,
	};
}

export function parseHubRoutingAssistantEvent(value: unknown): AssistantObservation | undefined {
	if (!isRecord(value) || value.type !== "message_end" || !isRecord(value.message)) return undefined;
	if (value.message.role !== "assistant" || !Array.isArray(value.message.content)) return undefined;
	const toolCalls: AssistantToolCall[] = [];
	for (const block of value.message.content) {
		if (!isRecord(block) || block.type !== "toolCall") continue;
		if (typeof block.name !== "string" || !isRecord(block.arguments)) continue;
		toolCalls.push({ name: block.name, arguments: block.arguments });
	}
	return { toolCalls, usage: parseUsage(value.message.usage) };
}

export function scoreHubRoutingCall(
	scenario: HubRoutingScenario,
	observation: AssistantObservation,
): { passed: boolean; reason?: string } {
	if (observation.toolCalls.length !== 1) {
		return { passed: false, reason: `expected one tool call, received ${observation.toolCalls.length}` };
	}
	const [call] = observation.toolCalls;
	if (call?.name !== "hub") {
		return { passed: false, reason: `expected hub, received ${call?.name ?? "none"}` };
	}
	if (typeof call.arguments.i !== "string" || call.arguments.i.trim().length === 0) {
		return { passed: false, reason: "missing non-empty tool intent" };
	}
	const { i: _intent, ...domainArguments } = call.arguments;
	if (domainArguments.op === "send" && typeof domainArguments.to === "string" && domainArguments.await === undefined) {
		domainArguments.await = false;
	}
	if (Bun.deepEquals(domainArguments, scenario.expected)) return { passed: true };
	return { passed: false, reason: "Hub arguments differ from the frozen expected call" };
}

async function runObservation(
	model: string,
	scenario: HubRoutingScenario,
	timeoutSeconds: number,
): Promise<HubRoutingObservation> {
	const child = Bun.spawn(
		[
			process.execPath,
			CLI_PATH,
			"--cwd",
			path.join(import.meta.dir, ".."),
			"--no-session",
			"--no-title",
			"--no-rules",
			"--no-skills",
			"--no-extensions",
			"--tools",
			"hub",
			"--model",
			model,
			"--thinking",
			"off",
			"--approval-mode",
			"read-only",
			"--mode",
			"json",
			"--print",
			"--system-prompt",
			systemPrompt.trim(),
			"--max-time",
			String(timeoutSeconds),
			scenario.prompt,
		],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const startedAt = performance.now();
	const stderrPromise = new Response(child.stderr as ReadableStream<Uint8Array>).text();
	const timeout = setTimeout(() => child.kill(), timeoutSeconds * 1_000);
	let assistant: AssistantObservation | undefined;
	try {
		const decoder = new TextDecoder();
		for await (const bytes of readLines(child.stdout as ReadableStream<Uint8Array>)) {
			const line = decoder.decode(bytes).trim();
			if (!line) continue;
			let event: unknown;
			try {
				event = JSON.parse(line);
			} catch {
				continue;
			}
			assistant = parseHubRoutingAssistantEvent(event);
			if (!assistant) continue;
			child.kill();
			break;
		}
	} finally {
		clearTimeout(timeout);
		await child.exited;
	}
	const stderr = (await stderrPromise).trim();
	const durationMs = Math.round(performance.now() - startedAt);
	if (!assistant) {
		return {
			model,
			scenario: scenario.id,
			passed: false,
			reason: "no completed assistant message before timeout or process exit",
			durationMs,
			stderr: stderr || undefined,
		};
	}
	const score = scoreHubRoutingCall(scenario, assistant);
	const call = assistant.toolCalls[0];
	return {
		model,
		scenario: scenario.id,
		passed: score.passed,
		tool: call?.name,
		arguments: call?.arguments,
		reason: score.reason,
		durationMs,
		usage: assistant.usage,
		stderr: stderr || undefined,
	};
}

export async function runHubRoutingBenchmark(options: HubRoutingBenchmarkOptions): Promise<HubRoutingBenchmarkReport> {
	const observations: HubRoutingObservation[] = [];
	const scenarios = options.scenarioIds.map(id => HUB_ROUTING_SCENARIO_BY_ID[id]!);
	for (const model of options.models) {
		for (const scenario of scenarios) {
			observations.push(await runObservation(model, scenario, options.timeoutSeconds));
		}
	}
	const passed = observations.filter(observation => observation.passed).length;
	const failed = observations.length - passed;
	const totalDurationMs = observations.reduce((total, observation) => total + observation.durationMs, 0);
	const totalCost = observations.reduce((total, observation) => total + (observation.usage?.cost ?? 0), 0);
	return {
		schemaVersion: 1,
		benchmark: "hub_routing",
		measuredAt: new Date().toISOString(),
		evaluator: {
			models: [...options.models],
			scenarios: [...options.scenarioIds],
			requests: observations.length,
			thinking: "off",
			approvalMode: "read-only",
			timeoutSeconds: options.timeoutSeconds,
		},
		result: {
			passed,
			failed,
			exactCallRate: observations.length === 0 ? 0 : passed / observations.length,
			totalDurationMs,
			totalCost,
		},
		models: options.models.map(model => {
			const rows = observations.filter(observation => observation.model === model);
			const modelPassed = rows.filter(observation => observation.passed).length;
			return {
				model,
				passed: modelPassed,
				failed: rows.length - modelPassed,
				exactCallRate: rows.length === 0 ? 0 : modelPassed / rows.length,
			};
		}),
		observations,
	};
}

export function formatHubRoutingBenchmark(report: HubRoutingBenchmarkReport): string {
	const lines = [
		`benchmark: ${report.benchmark}`,
		`requests: ${report.evaluator.requests} thinking=${report.evaluator.thinking} approval=${report.evaluator.approvalMode}`,
	];
	for (const model of report.models) {
		lines.push(
			`model: ${model.model} passed=${model.passed} failed=${model.failed} exact_call_rate=${model.exactCallRate.toFixed(3)}`,
		);
	}
	for (const observation of report.observations.filter(row => !row.passed)) {
		lines.push(
			`failure: model=${observation.model} scenario=${observation.scenario} reason=${observation.reason ?? "unknown"} actual=${JSON.stringify(observation.arguments ?? null)}`,
		);
	}
	lines.push(
		`result: passed=${report.result.passed} failed=${report.result.failed} exact_call_rate=${report.result.exactCallRate.toFixed(3)} duration_ms=${report.result.totalDurationMs} cost=$${report.result.totalCost.toFixed(6)}`,
	);
	return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
	const options = parseHubRoutingBenchmarkArgs(Bun.argv.slice(2));
	if (!options) {
		process.stdout.write(USAGE);
		return;
	}
	const report = await runHubRoutingBenchmark(options);
	process.stdout.write(options.json ? `${JSON.stringify(report)}\n` : formatHubRoutingBenchmark(report));
	if (report.result.failed > 0) process.exitCode = 1;
}

if (import.meta.main) await main();

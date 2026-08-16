/**
 * Inspect provider-facing system prompts.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { estimateTokens } from "@oh-my-pi/pi-agent-core/compaction";
import type { Context, Message, Tool } from "@oh-my-pi/pi-ai";
import { countTokens, Encoding } from "@oh-my-pi/pi-natives";
import { postmortem, setProjectDir } from "@oh-my-pi/pi-utils";
import { Args, Command, Flags, renderCommandHelp } from "@oh-my-pi/pi-utils/cli";
import { APP_DISPLAY_NAME } from "../app-version";
import { systemPromptHelp as commandHelp } from "../cli/command-help";
import { ModelRegistry } from "../config/model-registry";
import { resolveAgentModelPatterns } from "../config/model-resolver";
import { Settings } from "../config/settings";
import { buildDiscoveredSystemPromptOptions } from "../main";
import { type CreateAgentSessionResult, createAgentSession, discoverAuthStorage } from "../sdk";
import { SessionManager } from "../session/session-manager";
import type { BuildSystemPromptResult, DynamicPromptPart } from "../system-prompt";
import { discoverAgents, getAgent } from "../task/discovery";
import { createSubagentSettings, resolveSubagentCapabilities } from "../task/subagent-runtime-config";
import { resolveSubagentSystemPrompt } from "../task/subagent-system-prompt";
import type { AgentSource } from "../task/types";
import { shortenPath } from "../tools/render-utils";

const ACTIONS = ["inspect"] as const;
type SystemPromptAction = (typeof ACTIONS)[number];

const BREAKDOWN_ENCODING = Encoding.O200kBase;
const BREAKDOWN_ENCODING_LABEL = "o200k_base";

export interface SubagentInspectTarget {
	kind: "subagent";
	name: string;
	source: AgentSource;
	filePath: string | null;
	fidelity: "configured-preview";
	baseTemplate: string | "bundled";
	wrapperTemplate: string | "bundled";
	omittedRuntimeInputs: [
		"batch-context",
		"plan-reference",
		"worktree",
		"irc-peers",
		"parent-mcp-state",
		"prewalk-handoff",
	];
}
interface ProviderBlock {
	index: number;
	text: string;
}

interface ProviderInspectJson {
	cwd: string;
	mode: "provider";
	blocks: ProviderBlock[];
	target?: SubagentInspectTarget;
}

interface DynamicInspectJson {
	cwd: string;
	mode: "dynamic-parts";
	blocks: DynamicPromptPart[];
	target?: SubagentInspectTarget;
}

interface TokenMeasurement {
	characters: number;
	tokens: number;
	percentOfMeasuredContext: number;
}

interface BreakdownPart extends TokenMeasurement {
	id: string;
	source: string;
	providerBlockIndex: number;
}

interface BreakdownSource extends TokenMeasurement {
	source: string;
	partIds: string[];
	providerBlockIndexes: number[];
}

interface BreakdownTool {
	name: string;
	wireName: string;
	prompt: TokenMeasurement;
	description: TokenMeasurement;
	examples: TokenMeasurement;
	schema: TokenMeasurement;
}

interface BreakdownMessage extends TokenMeasurement {
	index: number;
	role: Message["role"];
	message: Message;
}

interface BreakdownInspectJson {
	cwd: string;
	mode: "breakdown";
	firstMessage?: string;
	tokenizer: {
		provider: "openai";
		encoding: typeof BREAKDOWN_ENCODING_LABEL;
	};
	model: { provider: string; id: string } | null;
	measurementScope: {
		includes: string[];
		excludes: string[];
	};
	totalMeasuredContextTokens: number;
	categories: {
		providerPrompt: TokenMeasurement;
		toolPrompts: TokenMeasurement;
		toolSchemas: TokenMeasurement;
		requestMessages: TokenMeasurement;
	};
	providerBlocks: Array<TokenMeasurement & { index: number }>;
	dynamicParts: BreakdownPart[];
	dynamicSources: BreakdownSource[];
	dynamicPercentagesMayOverlap: true;
	requestMessages: BreakdownMessage[];
	tools: BreakdownTool[];
}

export interface SystemPromptInspection extends BuildSystemPromptResult {
	providerTools: Tool[];
	providerMessages: Message[];
	model: { provider: string; id: string } | null;
	target?: SubagentInspectTarget;
	firstMessage?: string;
}

export interface FormatInspectOptions {
	mode: "provider" | "dynamic-parts" | "breakdown";
	json: boolean;
}

function renderProviderBlocks(blocks: string[]): string {
	return blocks.map((text, index) => `--- provider block ${index} ---\n${text}`).join("\n\n");
}

function renderDynamicParts(parts: DynamicPromptPart[]): string {
	return parts
		.map(part => {
			const text = part.segments
				? part.segments.map((segment, index) => `--- segment ${index + 1} ---\n${segment}`).join("\n\n")
				: part.text;
			return `--- ${part.id} (${part.source}, provider block ${part.providerBlockIndex}) ---\n${text}`;
		})
		.join("\n\n");
}

function measureTexts(texts: readonly string[]): Omit<TokenMeasurement, "percentOfMeasuredContext"> {
	return {
		characters: texts.reduce((total, text) => total + text.length, 0),
		tokens: texts.length === 0 ? 0 : countTokens([...texts], BREAKDOWN_ENCODING),
	};
}
function measureMessages(messages: readonly Message[]): Omit<TokenMeasurement, "percentOfMeasuredContext"> {
	return {
		characters: messages.reduce((total, message) => total + JSON.stringify(message).length, 0),
		tokens: messages.reduce((total, message) => {
			const estimated = estimateTokens(message);
			if (estimated > 0) return total + estimated;
			const content: unknown = "content" in message ? message.content : undefined;
			const serialized = typeof content === "string" ? content : JSON.stringify(content ?? "");
			return total + countTokens([serialized], BREAKDOWN_ENCODING);
		}, 0),
	};
}

const TOOL_EXAMPLES_MARKER = "\n\n<examples>\n";
const TOOL_EXAMPLES_END = "\n</examples>";

function measureToolPrompt(tool: Tool) {
	const prompt = tool.description ?? "";
	const promptMeasurement = measureTexts([prompt]);
	const examplesStart =
		tool.examples?.length && prompt.endsWith(TOOL_EXAMPLES_END) ? prompt.lastIndexOf(TOOL_EXAMPLES_MARKER) : -1;
	if (examplesStart < 0) {
		return {
			prompt: promptMeasurement,
			description: promptMeasurement,
			examples: measureTexts([]),
		};
	}
	// Examples own the separator bytes.
	// Measure their marginal token contribution so the components add to the prompt across BPE boundary merges.
	const description = measureTexts([prompt.slice(0, examplesStart)]);
	return {
		prompt: promptMeasurement,
		description,
		examples: {
			characters: promptMeasurement.characters - description.characters,
			tokens: promptMeasurement.tokens - description.tokens,
		},
	};
}

function withPercentage(
	measurement: Omit<TokenMeasurement, "percentOfMeasuredContext">,
	totalMeasuredContextTokens: number,
): TokenMeasurement {
	return {
		...measurement,
		percentOfMeasuredContext:
			totalMeasuredContextTokens === 0
				? 0
				: Math.round((measurement.tokens / totalMeasuredContextTokens) * 10_000) / 100,
	};
}

function serializeToolSchema(tool: Tool): string {
	const parameters = JSON.stringify(tool.parameters ?? {});
	if (!tool.customFormat) return parameters;
	return `${parameters}\n${JSON.stringify(tool.customFormat)}`;
}

function buildBreakdown(cwd: string, result: SystemPromptInspection): BreakdownInspectJson {
	const toolPrompts = result.providerTools.map(tool => tool.description ?? "");
	const toolPromptParts = result.providerTools.map(measureToolPrompt);
	const toolSchemas = result.providerTools.map(serializeToolSchema);
	const providerPromptMeasurement = measureTexts(result.systemPrompt);
	const toolPromptMeasurement = measureTexts(toolPrompts);
	const toolSchemaMeasurement = measureTexts(toolSchemas);
	const requestMessageMeasurement = measureMessages(result.providerMessages);
	const totalMeasuredContextTokens =
		providerPromptMeasurement.tokens +
		toolPromptMeasurement.tokens +
		toolSchemaMeasurement.tokens +
		requestMessageMeasurement.tokens;

	const sourceParts = new Map<string, DynamicPromptPart[]>();
	for (const part of result.dynamicParts) {
		const parts = sourceParts.get(part.source);
		if (parts) parts.push(part);
		else sourceParts.set(part.source, [part]);
	}
	const dynamicSources = [...sourceParts.entries()]
		.map(
			([source, parts]): BreakdownSource => ({
				source,
				partIds: parts.map(part => part.id),
				providerBlockIndexes: [...new Set(parts.map(part => part.providerBlockIndex))],
				...withPercentage(
					measureTexts(parts.flatMap(part => part.segments ?? [part.text])),
					totalMeasuredContextTokens,
				),
			}),
		)
		.sort((left, right) => right.tokens - left.tokens || left.source.localeCompare(right.source));

	const dynamicParts = result.dynamicParts
		.map(
			(part): BreakdownPart => ({
				id: part.id,
				source: part.source,
				providerBlockIndex: part.providerBlockIndex,
				...withPercentage(measureTexts(part.segments ?? [part.text]), totalMeasuredContextTokens),
			}),
		)
		.sort((left, right) => right.tokens - left.tokens || left.id.localeCompare(right.id));

	return {
		cwd,
		mode: "breakdown",
		...(result.target ? { target: result.target } : {}),
		...(result.firstMessage !== undefined ? { firstMessage: result.firstMessage } : {}),
		tokenizer: { provider: "openai", encoding: BREAKDOWN_ENCODING_LABEL },
		model: result.model,
		measurementScope: {
			includes: [
				"provider prompt blocks",
				"normalized tool descriptions and example blocks",
				"tool parameter schemas and grammars",
				...(result.firstMessage === undefined ? [] : ["first provider request messages after runtime injection"]),
			],
			excludes: [
				...(result.firstMessage === undefined ? ["conversation messages"] : ["historical conversation messages"]),
				"provider-specific request framing and control metadata",
			],
		},
		totalMeasuredContextTokens,
		categories: {
			providerPrompt: withPercentage(providerPromptMeasurement, totalMeasuredContextTokens),
			toolPrompts: withPercentage(toolPromptMeasurement, totalMeasuredContextTokens),
			toolSchemas: withPercentage(toolSchemaMeasurement, totalMeasuredContextTokens),
			requestMessages: withPercentage(requestMessageMeasurement, totalMeasuredContextTokens),
		},
		providerBlocks: result.systemPrompt.map((text, index) => ({
			index,
			...withPercentage(measureTexts([text]), totalMeasuredContextTokens),
		})),
		dynamicParts,
		dynamicSources,
		dynamicPercentagesMayOverlap: true,
		requestMessages: result.providerMessages.map((message, index) => ({
			index,
			role: message.role,
			message,
			...withPercentage(measureMessages([message]), totalMeasuredContextTokens),
		})),
		tools: result.providerTools.map((tool, index) => {
			const parts = toolPromptParts[index] ?? measureToolPrompt(tool);
			return {
				name: tool.name,
				wireName: tool.customWireName ?? tool.name,
				description: withPercentage(parts.description, totalMeasuredContextTokens),
				examples: withPercentage(parts.examples, totalMeasuredContextTokens),
				prompt: withPercentage(parts.prompt, totalMeasuredContextTokens),
				schema: withPercentage(measureTexts([toolSchemas[index] ?? "{}"]), totalMeasuredContextTokens),
			};
		}),
	};
}

function renderBreakdown(output: BreakdownInspectJson): string {
	const lines = [
		`Tokenizer: ${output.tokenizer.provider}/${output.tokenizer.encoding}`,
		`Model: ${output.model ? `${output.model.provider}/${output.model.id}` : "none"}`,
		`Total measured context: ${output.totalMeasuredContextTokens} tokens`,
		`Provider prompt: ${output.categories.providerPrompt.tokens} tokens (${output.categories.providerPrompt.percentOfMeasuredContext}%)`,
		`Tool prompts: ${output.categories.toolPrompts.tokens} tokens (${output.categories.toolPrompts.percentOfMeasuredContext}%)`,
		`Tool schemas: ${output.categories.toolSchemas.tokens} tokens (${output.categories.toolSchemas.percentOfMeasuredContext}%)`,
		`Excluded: ${output.measurementScope.excludes.join("; ")}`,
		`Request messages: ${output.categories.requestMessages.tokens} tokens (${output.categories.requestMessages.percentOfMeasuredContext}%)`,
		"",
		"Dynamic parts (standalone shares; overlapping parts are not additive):",
		...output.dynamicParts.map(
			part => `${part.id} [${part.source}]: ${part.tokens} tokens (${part.percentOfMeasuredContext}%)`,
		),
		"",
		"Dynamic sources (standalone shares; overlapping sources are not additive):",
		...output.dynamicSources.map(
			source => `${source.source}: ${source.tokens} tokens (${source.percentOfMeasuredContext}%)`,
		),
		"",
		"Request messages:",
		...(output.requestMessages.length === 0
			? ["none"]
			: output.requestMessages.map(
					message =>
						`${message.index} ${message.role}: ${message.tokens} tokens (${message.percentOfMeasuredContext}%)`,
				)),
		"",
		"Tools:",
		...output.tools.map(
			tool =>
				`${tool.name}: prompt ${tool.prompt.tokens} tokens (${tool.prompt.percentOfMeasuredContext}%), description ${tool.description.tokens} tokens (${tool.description.percentOfMeasuredContext}%), examples ${tool.examples.tokens} tokens (${tool.examples.percentOfMeasuredContext}%), schema ${tool.schema.tokens} tokens (${tool.schema.percentOfMeasuredContext}%)`,
		),
	];
	return lines.join("\n");
}

function renderSubagentTarget(target: SubagentInspectTarget): string {
	const targetSource = target.filePath ? `${target.source}: ${shortenPath(target.filePath)}` : target.source;
	const baseTemplate = target.baseTemplate === "bundled" ? target.baseTemplate : shortenPath(target.baseTemplate);
	const wrapperTemplate =
		target.wrapperTemplate === "bundled" ? target.wrapperTemplate : shortenPath(target.wrapperTemplate);
	return [
		`Target: subagent ${target.name} (${targetSource})`,
		`Templates: base=${baseTemplate}, wrapper=${wrapperTemplate}`,
		`Omitted runtime inputs: ${target.omittedRuntimeInputs.join(", ")}`,
	].join("\n");
}

export function formatInspectOutput(
	cwd: string,
	result: BuildSystemPromptResult | SystemPromptInspection,
	options: FormatInspectOptions,
): string {
	const target = "target" in result ? result.target : undefined;
	const targetPrefix = target ? `${renderSubagentTarget(target)}\n\n` : "";
	if (options.mode === "dynamic-parts") {
		const output: DynamicInspectJson = {
			cwd,
			mode: "dynamic-parts",
			blocks: result.dynamicParts,
			...(target ? { target } : {}),
		};
		return options.json
			? `${JSON.stringify(output, null, 2)}\n`
			: `${targetPrefix}${renderDynamicParts(result.dynamicParts)}\n`;
	}
	if (options.mode === "breakdown") {
		if (!("providerTools" in result)) {
			throw new Error("System prompt breakdown requires provider tool metadata");
		}
		const output = buildBreakdown(cwd, result);
		return options.json ? `${JSON.stringify(output, null, 2)}\n` : `${targetPrefix}${renderBreakdown(output)}\n`;
	}
	const output: ProviderInspectJson = {
		cwd,
		mode: "provider",
		blocks: result.systemPrompt.map((text, index) => ({ index, text })),
		...(target ? { target } : {}),
	};
	return options.json
		? `${JSON.stringify(output, null, 2)}\n`
		: `${targetPrefix}${renderProviderBlocks(result.systemPrompt)}\n`;
}

async function writeStdout(text: string): Promise<void> {
	const { promise, resolve, reject } = Promise.withResolvers<void>();
	process.stdout.write(text, error => {
		if (error) reject(error);
		else resolve();
	});
	await promise;
}

async function resolveCwd(cwdFlag: string | undefined): Promise<string> {
	const cwd = path.resolve(cwdFlag ?? process.cwd());
	const stat = await fs.stat(cwd).catch((error: unknown) => {
		throw new Error(`Invalid --cwd: ${cwd} does not exist`, { cause: error });
	});
	if (!stat.isDirectory()) {
		throw new Error(`Invalid --cwd: ${cwd} is not a directory`);
	}
	return cwd;
}
export async function inspectSystemPrompt(
	cwd: string,
	overrides: { systemPromptTemplateSource?: string; userAgentsFile?: string; firstMessage?: string } = {},
): Promise<SystemPromptInspection> {
	setProjectDir(cwd);
	const firstMessage = overrides.firstMessage;
	const systemPromptOptions = await buildDiscoveredSystemPromptOptions({
		cwd,
		systemPromptTemplateSource: overrides.systemPromptTemplateSource,
	});
	const authStorage = await discoverAuthStorage();
	const modelRegistry = new ModelRegistry(authStorage);
	let result: CreateAgentSessionResult | undefined;
	let capturedProviderContext: Context | undefined;
	try {
		result = await createAgentSession({
			cwd,
			authStorage,
			modelRegistry,
			hasUI: false,
			sessionManager: SessionManager.inMemory(cwd),
			...systemPromptOptions,
			userAgentsFile: overrides.userAgentsFile,
			captureDynamicPromptParts: true,
			captureProviderContext:
				firstMessage === undefined
					? undefined
					: context => {
							capturedProviderContext = context;
						},
		});
		if (!result.systemPromptResult) {
			throw new Error("System prompt inspection did not produce prompt metadata");
		}
		const providerContext =
			firstMessage === undefined
				? await result.session.agent.buildSideRequestContext([], result.systemPromptResult.systemPrompt)
				: await (async (): Promise<Context> => {
						await result.session.prompt(firstMessage);
						if (!capturedProviderContext) {
							throw new Error("First message was handled locally and did not produce a provider request");
						}
						return capturedProviderContext;
					})();
		const model = result.session.model;
		return {
			...result.systemPromptResult,
			systemPrompt: providerContext.systemPrompt ?? [],
			providerTools: providerContext.tools ?? [],
			providerMessages: providerContext.messages,
			model: model ? { provider: model.provider, id: model.id } : null,
			...(firstMessage !== undefined ? { firstMessage } : {}),
		};
	} finally {
		await result?.session.dispose();
		await result?.mcpManager?.disconnectAll();
		authStorage.close();
	}
}

export async function inspectSubagentSystemPrompt(cwd: string, rawName: string): Promise<SystemPromptInspection> {
	const name = rawName.trim();
	if (!name) throw new Error("--subagent requires a non-empty agent name");

	setProjectDir(cwd);
	const settings = await Settings.loadReadOnly({ cwd });
	const discovery = await discoverAgents(cwd);
	const agent = getAgent(discovery.agents, name);
	if (!agent) {
		const available = discovery.agents.map(candidate => candidate.name).join(", ") || "none";
		throw new Error(`Unknown agent "${name}". Available: ${available}`);
	}
	const disabledAgents = settings.get("task.disabledAgents");
	if (disabledAgents.includes(name)) {
		const enabled = discovery.agents
			.filter(candidate => !disabledAgents.includes(candidate.name))
			.map(candidate => candidate.name);
		throw new Error(
			`Agent "${name}" is disabled in settings. Enable it via /agents, or use a different agent type.${enabled.length > 0 ? ` Available: ${enabled.join(", ")}` : ""}`,
		);
	}

	const subagentSettings = createSubagentSettings(
		settings,
		agent.readSummarize === false ? { "read.summarize.enabled": false } : undefined,
	);
	const defaultModelPattern = settings.getModelRole("default");
	const modelPatterns = resolveAgentModelPatterns({
		settingsOverride: settings.get("task.agentModelOverrides")[name],
		agentModel: agent.model,
		settings,
		activeModelPattern: defaultModelPattern,
		fallbackModelPattern: defaultModelPattern,
	});
	const capabilities = resolveSubagentCapabilities(agent, subagentSettings);
	const subagentPrompt = await resolveSubagentSystemPrompt(cwd, {
		agent: agent.systemPrompt,
		outputSchema: agent.output,
	});
	const authStorage = await discoverAuthStorage();
	let result: CreateAgentSessionResult | undefined;
	try {
		const modelRegistry = new ModelRegistry(authStorage);
		result = await createAgentSession({
			cwd,
			authStorage,
			modelRegistry,
			settings: subagentSettings,
			modelPattern: modelPatterns,
			modelPatternAuthFallback: defaultModelPattern,
			thinkingLevel: agent.thinkingLevel,
			toolNames: capabilities.toolNames,
			outputSchema: agent.output,
			requireYieldTool: true,
			hasUI: false,
			sessionManager: SessionManager.inMemory(cwd),
			spawns: capabilities.spawns,
			taskDepth: capabilities.childDepth,
			enableLsp: settings.get("task.enableLsp"),
			enableIrc: false,
			enableMCP: false,
			systemPromptTemplate: subagentPrompt.systemPromptTemplate,
			systemPromptTransform: subagentPrompt.transform,
			captureDynamicPromptParts: true,
		});
		const enabledToolNames = result.session.getEnabledToolNames();
		const childToolNames = enabledToolNames.filter(toolName => toolName !== "todo");
		if (childToolNames.length !== enabledToolNames.length) {
			await result.session.setActiveToolsByName(childToolNames);
		}
		const promptResult = result.session.getSystemPromptResult();
		const providerContext = await result.session.agent.buildSideRequestContext([], promptResult.systemPrompt);
		const model = result.session.model;
		return {
			...promptResult,
			systemPrompt: providerContext.systemPrompt ?? [],
			providerTools: providerContext.tools ?? [],
			providerMessages: providerContext.messages,
			model: model ? { provider: model.provider, id: model.id } : null,
			target: {
				kind: "subagent",
				name,
				source: agent.source,
				filePath: agent.filePath ? path.resolve(agent.filePath) : null,
				fidelity: "configured-preview",
				baseTemplate: subagentPrompt.systemPromptTemplate
					? path.resolve(subagentPrompt.systemPromptTemplate)
					: "bundled",
				wrapperTemplate: subagentPrompt.wrapperTemplatePath
					? path.resolve(subagentPrompt.wrapperTemplatePath)
					: "bundled",
				omittedRuntimeInputs: [
					"batch-context",
					"plan-reference",
					"worktree",
					"irc-peers",
					"parent-mcp-state",
					"prewalk-handoff",
				],
			},
		};
	} finally {
		try {
			await result?.session.dispose();
		} finally {
			authStorage.close();
		}
	}
}

export default class SystemPrompt extends Command {
	static description = commandHelp.description;

	static args = {
		action: Args.string({
			description: "System prompt action",
			required: false,
			options: [...ACTIONS],
		}),
	};

	static flags = {
		cwd: Flags.string({ description: "Project directory to inspect" }),
		subagent: Flags.string({ description: "Inspect the configured prompt for a named subagent" }),
		"system-template": Flags.string({ description: "Path to a Handlebars system prompt template to inspect" }),
		"agents-file": Flags.string({ description: "Replace the user-level AGENTS.md while inspecting" }),
		"dynamic-parts": Flags.boolean({ description: "Output dynamic prompt parts only" }),
		provider: Flags.boolean({ description: "Output complete provider-facing prompt blocks" }),
		breakdown: Flags.boolean({ description: "Output token shares for prompt sources and provider tools" }),
		"first-message": Flags.string({
			description: "Preview the actual first provider request after runtime message injection",
		}),
		json: Flags.boolean({ description: "Output JSON" }),
	};

	static examples = [
		`# Inspect provider-facing blocks\n  ${APP_DISPLAY_NAME} system-prompt inspect --cwd /root/projects/project-paperless-go-classifier`,
		`# Inspect dynamic prompt parts\n  ${APP_DISPLAY_NAME} system-prompt inspect --cwd /root/projects/project-paperless-go-classifier --dynamic-parts`,
		`# Inspect dynamic prompt parts as JSON\n  ${APP_DISPLAY_NAME} system-prompt inspect --cwd /root/projects/project-paperless-go-classifier --dynamic-parts --json`,
		`# Inspect token shares by prompt source and provider tool\n  ${APP_DISPLAY_NAME} system-prompt inspect --cwd /root/projects/project-paperless-go-classifier --breakdown --json`,
		`# Inspect an actual first request, including hidden runtime-injected messages
  ${APP_DISPLAY_NAME} system-prompt inspect --first-message "Implement the requested change" --breakdown --json`,
		`# Inspect process-scoped prompt files
  ${APP_DISPLAY_NAME} system-prompt inspect --system-template /tmp/SYSTEM.template.md --agents-file /tmp/AGENTS.md`,
		`# Inspect a configured subagent's provider-facing blocks
  ${APP_DISPLAY_NAME} system-prompt inspect --subagent scout --provider`,
		`# Inspect a configured subagent's dynamic prompt parts
  ${APP_DISPLAY_NAME} system-prompt inspect --subagent scout --dynamic-parts --json`,
		`# Inspect a configured subagent's model and tool-aware token breakdown
  ${APP_DISPLAY_NAME} system-prompt inspect --subagent scout --breakdown --json`,
	];

	async run(): Promise<void> {
		const { args, flags } = await this.parse(SystemPrompt);
		const action = args.action as SystemPromptAction | undefined;
		if (!action) {
			renderCommandHelp(APP_DISPLAY_NAME, "system-prompt", SystemPrompt);
			return;
		}
		if (action !== "inspect") {
			throw new Error(`Unsupported system-prompt action: ${action}`);
		}
		const selectedModes = [flags.provider, flags["dynamic-parts"], flags.breakdown].filter(Boolean).length;
		if (selectedModes > 1) {
			throw new Error("Use only one of --provider, --dynamic-parts, or --breakdown");
		}
		if (
			flags.subagent !== undefined &&
			(flags["system-template"] !== undefined || flags["agents-file"] !== undefined)
		) {
			throw new Error("--system-template and --agents-file apply only to main prompt inspection");
		}
		if (flags.subagent !== undefined && flags["first-message"] !== undefined) {
			throw new Error("--first-message applies only to main prompt inspection");
		}
		if (flags["first-message"] !== undefined && !flags.breakdown) {
			throw new Error("--first-message requires --breakdown");
		}

		const cwd = await resolveCwd(flags.cwd);
		const result =
			flags.subagent === undefined
				? await inspectSystemPrompt(cwd, {
						systemPromptTemplateSource: flags["system-template"],
						userAgentsFile: flags["agents-file"],
						firstMessage: flags["first-message"],
					})
				: await inspectSubagentSystemPrompt(cwd, flags.subagent);
		const mode = flags.breakdown ? "breakdown" : flags["dynamic-parts"] ? "dynamic-parts" : "provider";
		await writeStdout(formatInspectOutput(cwd, result, { mode, json: flags.json === true }));
		await postmortem.quit(0);
	}
}

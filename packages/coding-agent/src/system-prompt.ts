/**
 * System prompt construction and project context loading
 */

import * as os from "node:os";
import type { AgentTool } from "@oh-my-pi/pi-agent-core";
import type { ToolExample, TSchema } from "@oh-my-pi/pi-ai";
import { renderToolInventory } from "@oh-my-pi/pi-ai/dialect";
import { $env, getGpuCachePath, getProjectDir, hasFsCode, isEnoent, logger, prompt } from "@oh-my-pi/pi-utils";
import { contextFileCapability } from "./capability/context-file";
import { systemPromptCapability } from "./capability/system-prompt";
import { findConfigFile } from "./config";
import type { Personality, SkillsSettings } from "./config/settings";
import { type ContextFile, loadCapability, type SystemPrompt as SystemPromptFile } from "./discovery";
import { expandAtImports } from "./discovery/at-imports";
import { loadSkills, type Skill } from "./extensibility/skills";
import { hasObsidian } from "./internal-urls/vault-protocol";
import activeRepoContextTemplate from "./prompts/system/active-repo-context.md" with { type: "text" };
import customSystemPromptTemplate from "./prompts/system/custom-system-prompt.md" with { type: "text" };
import defaultPersonality from "./prompts/system/personalities/default.md" with { type: "text" };
import friendlyPersonality from "./prompts/system/personalities/friendly.md" with { type: "text" };
import pragmaticPersonality from "./prompts/system/personalities/pragmatic.md" with { type: "text" };
import projectPromptTemplate from "./prompts/system/project-prompt.md" with { type: "text" };
import systemPromptTemplate from "./prompts/system/system-prompt.md" with { type: "text" };
import { shortenPath } from "./tools/render-utils";
import { type ActiveRepoContext, resolveActiveRepoContext } from "./utils/active-repo-context";
import { formatLocalCalendarDate } from "./utils/local-date";
import { normalizePromptPath } from "./utils/prompt-path";
import { AGENTS_MD_LIMIT, buildWorkspaceTree, type WorkspaceTree } from "./workspace-tree";

/** Bundled personality specs, keyed by the `personality` setting value. */
const PERSONALITY_SPECS: Record<Exclude<Personality, "none">, string> = {
	default: defaultPersonality,
	friendly: friendlyPersonality,
	pragmatic: pragmaticPersonality,
};

interface AlwaysApplyRule {
	name: string;
	content: string;
	path: string;
}

function normalizePromptBlock(content: string): string {
	return prompt.format(content, { renderPhase: "post-render" }).trim();
}

function splitComparablePromptBlocks(content: string | null | undefined): string[] {
	const normalized = firstNonEmpty(content);
	if (!normalized) return [];

	return normalizePromptBlock(normalized)
		.split(/\n{2,}/)
		.map(block => block.trim())
		.filter(block => block.length > 0);
}

function promptSourceContainsRule(source: string | null | undefined, ruleContent: string): boolean {
	const sourceBlocks = splitComparablePromptBlocks(source);
	const ruleBlocks = splitComparablePromptBlocks(ruleContent);
	if (sourceBlocks.length === 0 || ruleBlocks.length === 0 || ruleBlocks.length > sourceBlocks.length) return false;

	for (let start = 0; start <= sourceBlocks.length - ruleBlocks.length; start += 1) {
		if (ruleBlocks.every((block, offset) => sourceBlocks[start + offset] === block)) return true;
	}

	return false;
}

function dedupePromptSource(
	source: string | null | undefined,
	promptSources: Array<string | null | undefined>,
): string | null {
	if (!source) return null;
	return promptSources.some(promptSource => promptSourceContainsRule(promptSource, source)) ? null : source;
}

function dedupeAlwaysApplyRules(
	alwaysApplyRules: AlwaysApplyRule[] | undefined,
	promptSources: Array<string | null | undefined>,
): AlwaysApplyRule[] {
	if (!alwaysApplyRules || alwaysApplyRules.length === 0) return [];

	return alwaysApplyRules.filter(
		rule => !promptSources.some(source => promptSourceContainsRule(source, rule.content)),
	);
}

function firstNonEmpty(...values: (string | undefined | null)[]): string | null {
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed) return trimmed;
	}
	return null;
}

function parseWmicTable(output: string, header: string): string | null {
	const lines = output
		.split("\n")
		.map(line => line.trim())
		.filter(Boolean);
	const filtered = lines.filter(line => line.toLowerCase() !== header.toLowerCase());
	return filtered[0] ?? null;
}

const SYSTEM_PROMPT_PREP_TIMEOUT_MS = 5000;
/** Kept below prep timeout so timed-out probes can still write the null cache before fallback. */
const GPU_PROBE_TIMEOUT_MS = SYSTEM_PROMPT_PREP_TIMEOUT_MS - 500;
/** Drop stdout from a probe descendant that inherited the pipe after the probe exited. */
const GPU_PROBE_STDOUT_DRAIN_MS = 250;

async function runGpuProbe(cmd: string[]): Promise<string | null> {
	try {
		const proc = Bun.spawn({
			cmd,
			stdout: "pipe",
			stderr: "ignore",
			stdin: "ignore",
			timeout: GPU_PROBE_TIMEOUT_MS,
			// SIGKILL so a probe ignoring SIGTERM (PATH wrapper, wedged WMI) still
			// dies at the deadline and lets getCachedGpu reach the null-cache write.
			killSignal: "SIGKILL",
		});
		const stdoutReader = proc.stdout.getReader();
		let stdout = "";
		const decoder = new TextDecoder();
		const stdoutDone = (async () => {
			while (true) {
				const chunk = await stdoutReader.read();
				if (chunk.done) break;
				stdout += decoder.decode(chunk.value, { stream: true });
			}
			stdout += decoder.decode();
		})();
		const exitCode = await proc.exited;
		// Even on exit 0, a probe wrapper can leave a descendant holding stdout open.
		// Bound the EOF wait so getCachedGpu cannot outlive the probe in either path;
		// keep whatever bytes the reader already captured before cancelling.
		const drained = await Promise.race([
			stdoutDone.then(() => "ok" as const).catch(() => "err" as const),
			Bun.sleep(GPU_PROBE_STDOUT_DRAIN_MS).then(() => "timeout" as const),
		]);
		if (drained !== "ok") {
			await stdoutReader.cancel().catch(() => undefined);
			await stdoutDone.catch(() => undefined);
		}
		return exitCode === 0 ? stdout : null;
	} catch {
		return null;
	}
}

async function getGpuModel(): Promise<string | null> {
	switch (process.platform) {
		case "win32": {
			const output = await runGpuProbe(["wmic", "path", "win32_VideoController", "get", "name"]);
			return output ? parseWmicTable(output, "Name") : null;
		}
		case "linux": {
			const output = await runGpuProbe(["lspci"]);
			if (!output) return null;
			const gpus: Array<{ name: string; priority: number }> = [];
			for (const line of output.split("\n")) {
				if (!/(VGA|3D|Display)/i.test(line)) continue;
				const parts = line.split(":");
				const name = parts.length > 1 ? parts.slice(1).join(":").trim() : line.trim();
				const nameLower = name.toLowerCase();
				// Skip BMC/server management adapters
				if (/aspeed|matrox g200|mgag200/i.test(name)) continue;
				// Prioritize discrete GPUs
				let priority = 0;
				if (
					nameLower.includes("nvidia") ||
					nameLower.includes("geforce") ||
					nameLower.includes("quadro") ||
					nameLower.includes("rtx")
				) {
					priority = 3;
				} else if (nameLower.includes("amd") || nameLower.includes("radeon") || nameLower.includes("rx ")) {
					priority = 3;
				} else if (nameLower.includes("intel")) {
					priority = 1;
				} else {
					priority = 2;
				}
				gpus.push({ name, priority });
			}
			if (gpus.length === 0) return null;
			gpus.sort((a, b) => b.priority - a.priority);
			return gpus[0].name;
		}
		default:
			return null;
	}
}

function getTerminalName(): string | undefined {
	const termProgram = Bun.env.TERM_PROGRAM;
	const termProgramVersion = Bun.env.TERM_PROGRAM_VERSION;
	if (termProgram) {
		return termProgramVersion ? `${termProgram} ${termProgramVersion}` : termProgram;
	}

	if (Bun.env.WT_SESSION) return "Windows Terminal";

	const term = firstNonEmpty(Bun.env.TERM, Bun.env.COLORTERM, Bun.env.TERMINAL_EMULATOR);
	return term ?? undefined;
}

/** Cached GPU probe result. */
interface GpuCache {
	gpu: string | null;
}

async function loadGpuCache(): Promise<GpuCache | null> {
	try {
		const cachePath = getGpuCachePath();
		const content = await Bun.file(cachePath).json();
		if (content && typeof content === "object" && "gpu" in content) {
			const gpu = content.gpu;
			return { gpu: typeof gpu === "string" ? gpu : null };
		}
		return null;
	} catch {
		return null;
	}
}

async function saveGpuCache(info: GpuCache): Promise<void> {
	try {
		const cachePath = getGpuCachePath();
		await Bun.write(cachePath, JSON.stringify(info, null, "\t"));
	} catch {
		// Silently ignore cache write failures
	}
}

async function getCachedGpu(): Promise<string | undefined> {
	const cached = await logger.time("getCachedGpu:loadGpuCache", loadGpuCache);
	if (cached) return cached.gpu ?? undefined;
	const gpu = await logger.time("getCachedGpu:getGpuModel", getGpuModel);
	await logger.time("getCachedGpu:saveGpuCache", saveGpuCache, { gpu });
	return gpu ?? undefined;
}

async function getCpuModel(): Promise<string | undefined> {
	if (process.platform !== "linux") return undefined;
	try {
		const cpuInfo = await Bun.file("/proc/cpuinfo").text();
		const match = /^model name\s*:\s*(.+)$/m.exec(cpuInfo);
		return match?.[1]?.trim() || undefined;
	} catch (error) {
		if (!isEnoent(error)) {
			logger.debug("Could not read Linux CPU model", { error: String(error) });
		}
		return undefined;
	}
}

/**
 * Kernel identity for the workstation block. Prefers the uname build string
 * from `os.version()`, but Bun on macOS 15+ (Darwin 24/25) returns the literal
 * `"unknown"` when `uv_os_uname()`'s `version` field is empty — which surfaces
 * `Kernel: unknown` in the system prompt and makes the model misidentify the
 * host as Windows (#4141). Fall back to `<type> <release>` (uname -s + -r) so
 * macOS is always tagged as `Darwin <release>` and Linux keeps its build info.
 */
function getKernelIdentity(): string {
	const version = os.version()?.trim();
	if (version && version.toLowerCase() !== "unknown") return version;
	return `${os.type()} ${os.release()}`.trim();
}

function getEnvironmentInfo(
	cpuModel: string | undefined,
	gpu: string | undefined,
): Array<{ label: string; value: string }> {
	const entries: Array<{ label: string; value: string | undefined }> = [
		{ label: "OS", value: `${os.platform()} ${os.release()}` },
		{ label: "Distro", value: os.type() },
		{ label: "Kernel", value: getKernelIdentity() },
		{ label: "Arch", value: os.arch() },
		{ label: "CPU", value: cpuModel },
		{ label: "GPU", value: gpu },
		{ label: "Terminal", value: getTerminalName() },
	];
	return entries.filter((e): e is { label: string; value: string } => !!e.value);
}

/** Discover TITLE_SYSTEM.md file for automatic session-title prompt overrides */
export function discoverTitleSystemPromptFile(cwd?: string): string | undefined {
	const projectPath = findConfigFile("TITLE_SYSTEM.md", { user: false, cwd });
	if (projectPath) {
		return projectPath;
	}
	const globalPath = findConfigFile("TITLE_SYSTEM.md", { user: true, cwd });
	if (globalPath) {
		return globalPath;
	}
	return undefined;
}

/** Resolve input as file path or literal string */
export async function resolvePromptInput(input: string | undefined, description: string): Promise<string | undefined> {
	if (!input) {
		return undefined;
	} else if (input.includes("\n")) {
		return input;
	}

	try {
		return await Bun.file(input).text();
	} catch (error) {
		if (!hasFsCode(error, "ENAMETOOLONG") && !isEnoent(error)) {
			logger.warn(`Could not read ${description} file`, { path: input, error: String(error) });
		}
		return input;
	}
}

export interface LoadContextFilesOptions {
	/** Working directory to start walking up from. Default: getProjectDir() */
	cwd?: string;
}

function dedupeExactContextFiles(
	contextFiles: Array<{ path: string; content: string; depth?: number }>,
): Array<{ path: string; content: string; depth?: number }> {
	const lastIndexByContent = new Map<string, number>();
	for (const [index, file] of contextFiles.entries()) {
		// Keep the closest matching context entry when content is byte-for-byte identical.
		lastIndexByContent.set(file.content, index);
	}

	return contextFiles.filter((file, index) => lastIndexByContent.get(file.content) === index);
}

/**
 * Load all project context files using the capability API.
 * Returns {path, content, depth} entries for all discovered context files.
 * Files are sorted by depth (descending) so files closer to cwd appear last/more prominent.
 */
export async function loadProjectContextFiles(
	options: LoadContextFilesOptions = {},
): Promise<Array<{ path: string; content: string; depth?: number }>> {
	const resolvedCwd = options.cwd ?? getProjectDir();

	const result = await loadCapability(contextFileCapability.id, { cwd: resolvedCwd });

	// Materialize ContextFile items, expanding any `@path/to/file` includes
	// in their content. The expansion uses the file's own directory as the
	// resolution base so relative imports work the same way Claude Code,
	// Goose, and other tools document.
	const files = await Promise.all(
		result.items.map(async item => {
			const contextFile = item as ContextFile;
			return {
				path: contextFile.path,
				content: await expandAtImports(contextFile.content, contextFile.path),
				depth: contextFile.depth,
			};
		}),
	);

	// Sort by depth (descending): higher depth (farther from cwd) comes first,
	// so files closer to cwd appear later and are more prominent
	files.sort((a, b) => {
		const depthA = a.depth ?? -1;
		const depthB = b.depth ?? -1;
		return depthB - depthA;
	});

	return dedupeExactContextFiles(files);
}

/**
 * Load the effective system prompt customization from SYSTEM.md.
 * Project-level SYSTEM.md overrides user-level SYSTEM.md.
 */
export async function loadSystemPromptFiles(options: LoadContextFilesOptions = {}): Promise<string | null> {
	const resolvedCwd = options.cwd ?? getProjectDir();

	const result = await loadCapability<SystemPromptFile>(systemPromptCapability.id, { cwd: resolvedCwd });

	if (result.items.length === 0) return null;

	const projectLevel = result.items.find(item => item.level === "project");
	if (projectLevel) {
		return projectLevel.content;
	}

	const userLevel = result.items.find(item => item.level === "user");
	return userLevel?.content ?? null;
}

export const DEFAULT_SYSTEM_PROMPT_TOOL_NAMES = ["read", "bash", "edit", "write"] as const;

export interface SystemPromptToolMetadata {
	label: string;
	description: string;
	/** Tool name the model sees on the provider wire. Defaults to the internal tool name. */
	wireName?: string;
	/** Tool parameters schema (Zod or JSON Schema), fed to the verbose inventory renderer. */
	parameters?: TSchema;
	/** Illustrative examples rendered into the verbose inventory. */
	examples?: readonly ToolExample[];
}

export function buildSystemPromptToolMetadata(
	tools: Map<string, AgentTool>,
	overrides: Partial<Record<string, Partial<SystemPromptToolMetadata>>> = {},
): Map<string, SystemPromptToolMetadata> {
	return new Map(
		Array.from(tools.entries(), ([name, tool]) => {
			const toolRecord = tool as AgentTool & { label?: string; description?: string };
			const override = overrides[name];
			const wireName =
				override?.wireName ??
				(typeof toolRecord.customWireName === "string" ? toolRecord.customWireName : undefined);
			return [
				name,
				{
					label: override?.label ?? (typeof toolRecord.label === "string" ? toolRecord.label : ""),
					description:
						override?.description ?? (typeof toolRecord.description === "string" ? toolRecord.description : ""),
					parameters: toolRecord.parameters,
					examples: toolRecord.examples,
					wireName,
				},
			] as const;
		}),
	);
}

export interface BuildSystemPromptOptions {
	/** Handlebars system prompt template (replaces default). Raw SYSTEM.md/CLI prompts must not use this path. */
	customPrompt?: string;
	/** Already-loaded custom system prompt text; bypasses path resolution. */
	resolvedCustomPrompt?: string;
	/** Tools to include in prompt. */
	tools?: Map<string, SystemPromptToolMetadata>;
	/** Tool names to include in prompt. */
	toolNames?: string[];
	/** Raw text to append to system prompt. */
	appendSystemPrompt?: string;
	/** Already-loaded append prompt text; bypasses path resolution. */
	resolvedAppendSystemPrompt?: string;
	/** Source-attributed internal append prompt pieces. */
	appendSystemPromptParts?: AppendSystemPromptPart[];
	/** Inline full tool descriptors in the system prompt. Default: false */
	inlineToolDescriptors?: boolean;
	/**
	 * Whether provider-native tool calling is active (no owned/in-band syntax).
	 * When true and `inlineToolDescriptors` is false, the inventory renders as a
	 * compact tool-name list; otherwise it renders full `# Tool:` sections. Default: true
	 */
	nativeTools?: boolean;
	/** Skills settings for discovery. */
	skillsSettings?: SkillsSettings;
	/** Working directory. Default: getProjectDir() */
	cwd?: string;
	/** Pre-loaded context files (skips discovery if provided). */
	contextFiles?: Array<{ path: string; content: string; depth?: number }>;
	/** Skills provided directly to system prompt construction. */
	skills?: Skill[];
	/** Pre-loaded rulebook rules (descriptions, excluding TTSR and always-apply). */
	rules?: Array<{ name: string; description?: string; path: string; globs?: string[] }>;
	/** Intent field name injected into every tool schema. If set, explains the field in the prompt. */
	intentField?: string;
	/** Whether MCP tool discovery is active for this prompt build. */
	mcpDiscoveryMode?: boolean;
	/** Discoverable MCP server summaries to advertise when discovery mode is active. */
	mcpDiscoveryServerSummaries?: string[];
	/** Encourage the agent to delegate via tasks unless changes are trivial. */
	eagerTasks?: boolean;
	/** When true, the Eager Tasks section uses the hard MUST/ONLY wording (`task.eager: always`) rather than the softer `preferred` nudge. */
	eagerTasksAlways?: boolean;
	/** Whether `task.batch` is enabled; gates batch-call guidance in the Eager Tasks section. */
	taskBatch?: boolean;
	/** Rules with alwaysApply=true — their full content is injected into the prompt. */
	alwaysApplyRules?: AlwaysApplyRule[];
	/** Whether secret obfuscation is active. When true, explains the redaction format in the prompt. */
	secretsEnabled?: boolean;
	/** Pre-loaded workspace tree (skips discovery if provided). May be a Promise to allow early kick-off. */
	workspaceTree?: WorkspaceTree | Promise<WorkspaceTree>;
	/** Whether the local memory://root summary is active. */
	memoryRootEnabled?: boolean;
	/** Active model identifier (e.g. "anthropic/claude-opus-4") surfaced to the agent. */
	model?: string;
	/** Personality preset rendered into the default system prompt. "none" omits the block. Default: "default" */
	personality?: Personality;
	/** Whether to include the workspace directory tree in the system prompt. Default: false */
	includeWorkspaceTree?: boolean;
	/** Whether Mermaid fenced blocks render as terminal ASCII diagrams. Default: true */
	renderMermaid?: boolean;
	/** Pre-resolved nested active repo context. Undefined resolves from cwd. */
	activeRepoContext?: ActiveRepoContext | null;
}

export type DynamicPromptPartSource =
	| "system-prompt.md"
	| "custom-system-prompt.md"
	| "project-prompt.md"
	| "active-repo-context.md"
	| "SYSTEM.md"
	| "memory"
	| "mcp"
	| "auto-learn"
	| "append-system-prompt";

export interface DynamicPromptPart {
	id: string;
	source: DynamicPromptPartSource;
	providerBlockIndex: number;
	text: string;
}

export interface AppendSystemPromptPart {
	id: string;
	source: "memory" | "mcp" | "auto-learn" | "append-system-prompt";
	text: string;
}

/** Result of building provider-facing system prompt messages. */
export interface BuildSystemPromptResult {
	/** Ordered system prompt blocks. Providers should preserve entries as distinct messages/blocks. */
	systemPrompt: string[];
	/** Source-attributed dynamic prompt fragments for debug inspection. */
	dynamicParts: DynamicPromptPart[];
}

interface CapturedDynamicPromptPart {
	id: string;
	text: string;
}

interface DynamicPromptCaptureContext {
	[DYNAMIC_PROMPT_PART_CAPTURE]?: CapturedDynamicPromptPart[];
}

interface RenderedPromptBlock {
	text: string;
	dynamicParts: DynamicPromptPart[];
}

const DYNAMIC_PROMPT_PART_CAPTURE = Symbol("dynamic-prompt-part-capture");

prompt.registerHelper("inspectPart", function (this: unknown, id: unknown, options: prompt.HelperOptions): string {
	if (typeof id !== "string" || !id) {
		throw new Error("inspectPart requires a non-empty string id");
	}
	const text = options.fn(this);
	const root = options.data?.root as DynamicPromptCaptureContext | undefined;
	root?.[DYNAMIC_PROMPT_PART_CAPTURE]?.push({ id, text });
	return text;
});

function addDynamicPart(
	parts: DynamicPromptPart[],
	part: Omit<DynamicPromptPart, "text">,
	text: string,
	renderedBlock: string,
): void {
	const normalized = normalizePromptBlock(text);
	if (!normalized) return;
	if (!renderedBlock.includes(normalized)) {
		throw new Error(
			`Dynamic prompt part "${part.id}" (${part.source}) is not present in provider block ${part.providerBlockIndex}`,
		);
	}
	parts.push({ ...part, text: normalized });
}

function renderInspectablePromptBlock(
	template: string,
	data: prompt.TemplateContext,
	source: DynamicPromptPartSource,
	providerBlockIndex: number,
	trimOutput = false,
): RenderedPromptBlock {
	const captured: CapturedDynamicPromptPart[] = [];
	const renderContext: prompt.TemplateContext & DynamicPromptCaptureContext = {
		...data,
		[DYNAMIC_PROMPT_PART_CAPTURE]: captured,
	};
	const rendered = prompt.render(template, renderContext);
	const text = trimOutput ? rendered.trim() : rendered;
	const dynamicParts: DynamicPromptPart[] = [];
	const ids = new Set<string>();

	for (const part of captured) {
		const normalized = normalizePromptBlock(part.text);
		if (!normalized) continue;
		if (ids.has(part.id)) {
			throw new Error(`Duplicate dynamic prompt part "${part.id}" in ${source}`);
		}
		if (!text.includes(normalized)) {
			throw new Error(
				`Dynamic prompt part "${part.id}" (${source}) is not present in provider block ${providerBlockIndex}`,
			);
		}
		ids.add(part.id);
		dynamicParts.push({ id: part.id, source, providerBlockIndex, text: normalized });
	}

	return { text, dynamicParts };
}

/** Build the system prompt with tools, guidelines, and context */
export async function buildSystemPrompt(options: BuildSystemPromptOptions = {}): Promise<BuildSystemPromptResult> {
	if ($env.NULL_PROMPT === "true") {
		return { systemPrompt: [], dynamicParts: [] };
	}

	const {
		customPrompt,
		resolvedCustomPrompt: providedResolvedCustomPrompt,
		tools,
		appendSystemPrompt,
		inlineToolDescriptors: providedInlineToolDescriptors,
		resolvedAppendSystemPrompt: providedResolvedAppendPrompt,
		appendSystemPromptParts = [],
		nativeTools = true,
		skillsSettings,
		toolNames: providedToolNames,
		cwd,
		contextFiles: providedContextFiles,
		skills: providedSkills,
		rules,
		alwaysApplyRules,
		intentField,
		mcpDiscoveryMode = false,
		mcpDiscoveryServerSummaries = [],
		eagerTasks = false,
		eagerTasksAlways = false,
		taskBatch = true,
		secretsEnabled = false,
		workspaceTree: providedWorkspaceTree,
		memoryRootEnabled = false,
		model,
		personality = "default",
		includeWorkspaceTree = false,
		renderMermaid = true,
		activeRepoContext: providedActiveRepoContext,
	} = options;
	const inlineToolDescriptors = providedInlineToolDescriptors ?? false;
	const resolvedCwd = cwd ?? getProjectDir();

	const prepDefaults = {
		resolvedCustomPrompt: undefined as string | undefined,
		resolvedAppendPrompt: undefined as string | undefined,
		systemPromptCustomization: null as string | null,
		contextFiles: dedupeExactContextFiles(providedContextFiles ?? []),
		skills: providedSkills ?? ([] as Skill[]),
		workspaceTree: {
			rootPath: resolvedCwd,
			rendered: "",
			truncated: false,
			totalLines: 0,
			agentsMdFiles: [],
		} satisfies WorkspaceTree,
		activeRepoContext: null as ActiveRepoContext | null,
		cpuModel: undefined as string | undefined,
		gpu: undefined as string | undefined,
	};

	const { promise: deadline, resolve: fireDeadline } = Promise.withResolvers<"__timeout__">();
	const deadlineTimer = setTimeout(() => fireDeadline("__timeout__"), SYSTEM_PROMPT_PREP_TIMEOUT_MS);
	// Unref so a fast prep does not hold a one-shot CLI alive waiting for this timer.
	deadlineTimer.unref();
	const timedOut: string[] = [];
	const failed: Array<{ name: string; error: unknown }> = [];

	async function withDeadline<T>(name: string, work: Promise<T>, fallback: T): Promise<T> {
		const tagged = work
			.then(value => ({ kind: "ok" as const, value }))
			.catch(error => ({ kind: "err" as const, error }));
		const result = await Promise.race([tagged, deadline]);
		if (result === "__timeout__") {
			timedOut.push(name);
			// Let the work continue in the background so its caches still warm; just log on completion.
			void tagged.then(r => {
				if (r.kind === "err") {
					logger.warn("Background system prompt preparation step failed", { name, error: String(r.error) });
				} else {
					logger.debug("Background system prompt preparation step completed after timeout", { name });
				}
			});
			return fallback;
		}
		if (result.kind === "err") {
			failed.push({ name, error: result.error });
			return fallback;
		}
		return result.value;
	}

	// Caller-supplied `customPrompt` / `resolvedCustomPrompt` owns block 0; the
	// secondary capability-path `SYSTEM.md` walk-up MUST NOT silently augment it,
	// because that would defeat CLI precedence over project/user `SYSTEM.md`.
	const callerControlsCustomPrompt =
		(typeof providedResolvedCustomPrompt === "string" && providedResolvedCustomPrompt.length > 0) ||
		(typeof customPrompt === "string" && customPrompt.length > 0);
	const systemPromptCustomizationPromise: Promise<string | null> = callerControlsCustomPrompt
		? Promise.resolve(null)
		: logger.time("loadSystemPromptFiles", loadSystemPromptFiles, { cwd: resolvedCwd });
	const contextFilesPromise = providedContextFiles
		? Promise.resolve(providedContextFiles)
		: logger.time("loadProjectContextFiles", loadProjectContextFiles, { cwd: resolvedCwd });
	const workspaceTreePromise =
		providedWorkspaceTree !== undefined
			? Promise.resolve(providedWorkspaceTree)
			: includeWorkspaceTree
				? logger.time("buildWorkspaceTree", () =>
						buildWorkspaceTree(resolvedCwd, { timeoutMs: SYSTEM_PROMPT_PREP_TIMEOUT_MS }),
					)
				: Promise.resolve({
						rootPath: resolvedCwd,
						rendered: "",
						truncated: false,
						totalLines: 0,
						agentsMdFiles: [],
					});
	const skillsPromise: Promise<Skill[]> =
		providedSkills !== undefined
			? Promise.resolve(providedSkills)
			: skillsSettings?.enabled !== false
				? loadSkills({ ...skillsSettings, cwd: resolvedCwd }).then(result => result.skills)
				: Promise.resolve([]);
	const activeRepoContextPromise =
		providedActiveRepoContext !== undefined
			? Promise.resolve(providedActiveRepoContext)
			: logger.time("resolveActiveRepoContext", () => resolveActiveRepoContext(resolvedCwd));
	const cpuModelPromise = logger.time("getCpuModel", getCpuModel);
	const gpuPromise = logger.time("getCachedGpu", getCachedGpu);

	const [
		resolvedSystemPromptTemplate,
		resolvedCustomPrompt,
		resolvedAppendPrompt,
		systemPromptCustomization,
		contextFiles,
		skills,
		workspaceTree,
		activeRepoContext,
		cpuModel,
		gpu,
	] = await Promise.all([
		withDeadline(
			"systemPromptTemplate",
			resolvePromptInput(customPrompt, "system prompt template"),
			undefined as string | undefined,
		),
		withDeadline(
			"customPrompt",
			providedResolvedCustomPrompt !== undefined
				? Promise.resolve(providedResolvedCustomPrompt)
				: Promise.resolve(undefined),
			prepDefaults.resolvedCustomPrompt,
		),
		withDeadline(
			"appendSystemPrompt",
			providedResolvedAppendPrompt !== undefined
				? Promise.resolve(providedResolvedAppendPrompt)
				: resolvePromptInput(appendSystemPrompt, "append system prompt"),
			prepDefaults.resolvedAppendPrompt,
		),
		withDeadline("loadSystemPromptFiles", systemPromptCustomizationPromise, prepDefaults.systemPromptCustomization),
		withDeadline("loadProjectContextFiles", contextFilesPromise, prepDefaults.contextFiles).then(
			dedupeExactContextFiles,
		),
		withDeadline("loadSkills", skillsPromise, prepDefaults.skills),
		withDeadline("buildWorkspaceTree", workspaceTreePromise, prepDefaults.workspaceTree),
		withDeadline("resolveActiveRepoContext", activeRepoContextPromise, prepDefaults.activeRepoContext),
		withDeadline("getCpuModel", cpuModelPromise, prepDefaults.cpuModel),
		withDeadline("getCachedGpu", gpuPromise, prepDefaults.gpu),
	]);
	clearTimeout(deadlineTimer);
	const agentsMdFiles = Array.from(new Set(workspaceTree.agentsMdFiles)).sort().slice(0, AGENTS_MD_LIMIT);

	if (timedOut.length > 0) {
		logger.warn("System prompt preparation steps timed out; using minimal fallback for those steps", {
			cwd: resolvedCwd,
			timeoutMs: SYSTEM_PROMPT_PREP_TIMEOUT_MS,
			steps: timedOut,
		});
		process.stderr.write(
			`Warning: system prompt preparation steps timed out after ${SYSTEM_PROMPT_PREP_TIMEOUT_MS}ms (${timedOut.join(", ")}); using minimal fallback for those steps.\n`,
		);
	}
	if (failed.length > 0) {
		for (const { name, error } of failed) {
			logger.warn("System prompt preparation step failed; using minimal fallback", {
				cwd: resolvedCwd,
				step: name,
				error: String(error),
			});
		}
	}

	const date = formatLocalCalendarDate();
	const dateTime = date;
	const promptCwd = shortenPath(normalizePromptPath(resolvedCwd));

	// Build tool metadata for system prompt rendering.
	// Priority: explicit list > tools map > conservative SDK fallback.
	let toolNames = providedToolNames;
	if (!toolNames) {
		toolNames = tools ? Array.from(tools.keys()) : [...DEFAULT_SYSTEM_PROMPT_TOOL_NAMES];
	}

	// Build tool descriptions for system prompt rendering.
	const toolPromptNames = new Map<string, string>(toolNames.map(name => [name, tools?.get(name)?.wireName ?? name]));
	const toolRefs = Object.fromEntries(toolPromptNames.entries());
	const toolInfo = toolNames.map(name => ({
		name: toolPromptNames.get(name) ?? name,
		internalName: name,
		label: tools?.get(name)?.label ?? "",
		description: tools?.get(name)?.description ?? "",
	}));
	const inventoryTools = toolNames.map(name => {
		const meta = tools?.get(name);
		return {
			name: toolPromptNames.get(name) ?? name,
			description: meta?.description ?? "",
			parameters: meta?.parameters ?? ({ type: "object" } as TSchema),
			examples: meta?.examples,
		};
	});
	// List mode shows a compact tool-name list; it only applies when descriptors
	// stay in provider-native tool schemas AND native tool calling is active.
	// Otherwise render full `# Tool:` sections inline in the system prompt.
	const toolListMode = !inlineToolDescriptors && nativeTools;
	const toolInventory = toolListMode ? "" : renderToolInventory(inventoryTools, model ?? "");

	// Filter skills for the rendered system prompt:
	// - require the `read` tool so the model can actually fetch skill content;
	// - drop skills with frontmatter `hide: true` (still loadable via skill:// and /skill:<name>).
	const hasRead = toolNames.includes("read");
	const filteredSkills = hasRead ? skills.filter(skill => skill.hide !== true) : [];

	const usesCustomPrompt = resolvedCustomPrompt !== undefined;
	const effectiveSystemPromptCustomization = dedupePromptSource(systemPromptCustomization, [
		resolvedSystemPromptTemplate,
		resolvedCustomPrompt,
		resolvedAppendPrompt,
	]);
	const activeTemplate = resolvedSystemPromptTemplate ?? systemPromptTemplate;
	const contextPromptSources = contextFiles.map(file => file.content);
	const promptSources = [
		effectiveSystemPromptCustomization,
		resolvedSystemPromptTemplate,
		resolvedCustomPrompt,
		resolvedAppendPrompt,
		...contextPromptSources,
	];
	const injectedAlwaysApplyRules = dedupeAlwaysApplyRules(alwaysApplyRules, promptSources);

	const appendPrompt = resolvedAppendPrompt ?? "";
	const environment = getEnvironmentInfo(cpuModel, gpu);
	const renderData: prompt.TemplateContext = {
		systemPromptCustomization: effectiveSystemPromptCustomization,
		customPrompt: resolvedCustomPrompt,
		appendPrompt,
		tools: toolNames,
		toolInfo,
		toolInventory,
		inlineToolDescriptors,
		toolListMode,
		toolRefs,
		environment,
		contextFiles,
		agentsMdSearch: { files: agentsMdFiles },
		workspaceTree,
		skills: filteredSkills,
		rules: rules ?? [],
		alwaysApplyRules: injectedAlwaysApplyRules,
		date,
		dateTime,
		cwd: promptCwd,
		model: model ?? "",
		personality: personality === "none" ? "" : PERSONALITY_SPECS[personality].trim(),
		intentTracing: !!intentField,
		intentField: intentField ?? "",
		mcpDiscoveryMode,
		hasMCPDiscoveryServers: mcpDiscoveryServerSummaries.length > 0,
		mcpDiscoveryServerSummaries,
		eagerTasks,
		eagerTasksAlways,
		taskBatch,
		secretsEnabled,
		hasMemoryRoot: memoryRootEnabled,
		hasObsidian: hasObsidian(),
		includeWorkspaceTree,
		renderMermaid,
	};
	const systemTemplate = usesCustomPrompt ? customSystemPromptTemplate : activeTemplate;
	const systemBlock = usesCustomPrompt
		? renderInspectablePromptBlock(systemTemplate, renderData, "custom-system-prompt.md", 0)
		: resolvedSystemPromptTemplate === undefined
			? renderInspectablePromptBlock(systemTemplate, renderData, "system-prompt.md", 0)
			: { text: prompt.render(systemTemplate, renderData), dynamicParts: [] };
	const systemPrompt = [systemBlock.text];
	const dynamicParts: DynamicPromptPart[] = [...systemBlock.dynamicParts];

	// Custom prompt wrappers already render context files and append text; the
	// project footer still carries environment, cwd, workspace, and dir-context.
	const projectRenderData = usesCustomPrompt ? { ...renderData, contextFiles: [], appendPrompt: "" } : renderData;
	const projectBlockIndex = systemPrompt.length;
	const projectBlock = renderInspectablePromptBlock(
		projectPromptTemplate,
		projectRenderData,
		"project-prompt.md",
		projectBlockIndex,
		true,
	);
	if (projectBlock.text) {
		systemPrompt.push(projectBlock.text);
		dynamicParts.push(...projectBlock.dynamicParts);
	}

	if (appendSystemPromptParts.length > 0) {
		const appendContainer = dynamicParts.find(part => part.id === "append-prompt");
		if (!appendContainer) {
			throw new Error("Append system prompt parts were provided, but no append prompt was rendered");
		}
		const renderedBlock = systemPrompt[appendContainer.providerBlockIndex];
		if (renderedBlock === undefined) {
			throw new Error(`Append prompt references missing provider block ${appendContainer.providerBlockIndex}`);
		}
		for (const part of appendSystemPromptParts) {
			addDynamicPart(
				dynamicParts,
				{ ...part, providerBlockIndex: appendContainer.providerBlockIndex },
				part.text,
				renderedBlock,
			);
		}
	}

	if (activeRepoContext) {
		const activeRepoBlockIndex = systemPrompt.length;
		const activeRepoBlock = renderInspectablePromptBlock(
			activeRepoContextTemplate,
			{ relativeRepoRoot: normalizePromptPath(activeRepoContext.relativeRepoRoot) },
			"active-repo-context.md",
			activeRepoBlockIndex,
			true,
		);
		if (activeRepoBlock.text) {
			systemPrompt.push(activeRepoBlock.text);
			dynamicParts.push(...activeRepoBlock.dynamicParts);
		}
	}

	return { systemPrompt, dynamicParts };
}

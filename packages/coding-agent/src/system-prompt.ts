/**
 * System prompt construction and project context loading
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentTool } from "@oh-my-pi/pi-agent-core";
import type { ToolExample, TSchema } from "@oh-my-pi/pi-ai";
import { renderToolInventory } from "@oh-my-pi/pi-ai/dialect";
import type { DelegationBias } from "@oh-my-pi/pi-catalog/compat/delegation";
import { diffLines } from "@oh-my-pi/pi-natives";
import {
	$env,
	getAgentDir,
	getGpuCachePath,
	getProjectDir,
	hasFsCode,
	isEnoent,
	logger,
	prompt,
} from "@oh-my-pi/pi-utils";
import { contextFileCapability } from "./capability/context-file";
import { systemPromptCapability } from "./capability/system-prompt";
import { findConfigFile, findConfigFileWithMeta } from "./config";
import type { Personality, SkillsSettings } from "./config/settings";
import { type ContextFile, loadCapability, type SystemPrompt as SystemPromptFile } from "./discovery";
import { expandAtImports } from "./discovery/at-imports";
import { loadSkills, type Skill } from "./extensibility/skills";
import { hasObsidian } from "./internal-urls/vault-protocol";
import activeRepoContextTemplate from "./prompts/system/active-repo-context.md" with { type: "text" };
import computerSafetyPrompt from "./prompts/system/computer-safety.md" with { type: "text" };
import customSystemPromptTemplate from "./prompts/system/custom-system-prompt.md" with { type: "text" };
import defaultPersonality from "./prompts/system/personalities/default.md" with { type: "text" };
import friendlyPersonality from "./prompts/system/personalities/friendly.md" with { type: "text" };
import pragmaticPersonality from "./prompts/system/personalities/pragmatic.md" with { type: "text" };
import projectPromptTemplate from "./prompts/system/project-prompt.md" with { type: "text" };
import defaultSystemPromptTemplate from "./prompts/system/system-prompt.md" with { type: "text" };
import { normalizeConcurrencyLimit } from "./task/parallel";
import type { ContextFileEntry } from "./tools";
import { expandTilde } from "./tools/path-utils";
import { type ActiveRepoContext, resolveActiveRepoContext } from "./utils/active-repo-context";
import { normalizePromptPath } from "./utils/prompt-path";
import { AGENTS_MD_LIMIT, buildWorkspaceTree, type WorkspaceTree } from "./workspace-tree";

/** Bundled personality specs, keyed by the `personality` setting value. */
const PERSONALITY_SPECS: Record<Exclude<Personality, "none">, string> = {
	default: defaultPersonality,
	friendly: friendlyPersonality,
	pragmatic: pragmaticPersonality,
};

/**
 * Load the user-level PERSONALITY.md override for the system prompt's
 * personality block from `<agentDir>/PERSONALITY.md` (`~/.omp/agent` by
 * default; profile, XDG, and `PI_CODING_AGENT_DIR` aware). Returns null when
 * the file is absent, empty, or unreadable; callers then render the configured
 * preset. Read failures other than a missing file warn instead of failing the
 * build.
 */
async function loadPersonalityOverride(): Promise<string | null> {
	const filePath = path.join(getAgentDir(), "PERSONALITY.md");
	try {
		const content = (await Bun.file(filePath).text()).trim();
		if (content) return content;
		logger.warn("PERSONALITY.md is empty; using the configured personality preset", { path: filePath });
	} catch (error) {
		if (!isEnoent(error)) {
			logger.warn("Failed to read PERSONALITY.md; using the configured personality preset", {
				path: filePath,
				error: String(error),
			});
		}
	}
	return null;
}

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
	const rendered = normalizePromptBlock(normalized);
	// Split on blank-line paragraph boundaries, but not inside fenced code
	// blocks. A rule that appears only inside a fenced example in another file
	// is an example, not an instruction, so it must not count as containment.
	const blocks: string[] = [];
	let current: string[] = [];
	let inFence = false;
	for (const line of rendered.split("\n")) {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			current.push(line);
			continue;
		}
		if (!inFence && line.trim() === "" && current.length > 0 && current[current.length - 1].trim() !== "") {
			const block = current.join("\n").trim();
			if (block.length > 0) blocks.push(block);
			current = [];
			continue;
		}
		current.push(line);
	}
	const tail = current.join("\n").trim();
	if (tail.length > 0) blocks.push(tail);
	return blocks;
}

/**
 * Check whether `ruleBlocks` appears as a contiguous subsequence of
 * `sourceBlocks`. Both inputs must already be normalized and split via
 * {@link splitComparablePromptBlocks}.
 */
function promptBlocksContain(sourceBlocks: string[], ruleBlocks: string[]): boolean {
	if (sourceBlocks.length === 0 || ruleBlocks.length === 0 || ruleBlocks.length > sourceBlocks.length) {
		return false;
	}
	for (let start = 0; start <= sourceBlocks.length - ruleBlocks.length; start += 1) {
		if (ruleBlocks.every((block, offset) => sourceBlocks[start + offset] === block)) return true;
	}
	return false;
}

function promptSourceContainsRule(source: string | null | undefined, ruleContent: string): boolean {
	return promptBlocksContain(splitComparablePromptBlocks(source), splitComparablePromptBlocks(ruleContent));
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

function parseWindowsGpuModel(output: string): string | null {
	const adapters = output
		.split("\n")
		.map(line => line.trim())
		.filter(line => Boolean(line) && line.toLowerCase() !== "name");
	const physicalAdapters = adapters.filter(adapter => !/\b(?:virtual|mirror|remote|citrix)\b/i.test(adapter));
	return (
		physicalAdapters.find(adapter => /\b(?:nvidia|amd|radeon|intel)\b/i.test(adapter)) ??
		physicalAdapters[0] ??
		adapters[0] ??
		null
	);
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
			return output ? parseWindowsGpuModel(output) : null;
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

/**
 * On-disk cache schema version. Bumped when detection logic changes so stored
 * selections from an older parser are rejected and re-probed instead of served
 * indefinitely — e.g. the Windows virtual-adapter filtering added for #9675,
 * which would otherwise keep returning a cached virtual GPU after upgrade.
 */
const GPU_CACHE_VERSION = 1;

/** Cached GPU probe result. */
interface GpuCache {
	gpu: string | null;
}

async function loadGpuCache(): Promise<GpuCache | null> {
	try {
		const cachePath = getGpuCachePath();
		const content = await Bun.file(cachePath).json();
		if (content && typeof content === "object" && content.version === GPU_CACHE_VERSION && "gpu" in content) {
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
		await Bun.write(cachePath, JSON.stringify({ version: GPU_CACHE_VERSION, gpu: info.gpu }, null, "\t"));
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
	if (process.platform !== "linux") return os.cpus()[0]?.model;
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

async function getDistroName(): Promise<string | undefined> {
	if (process.platform !== "linux") return undefined;

	try {
		const content = await Bun.file("/etc/os-release").text();
		const match = /^PRETTY_NAME=(?:"([^"]*)"|'([^']*)'|([^\r\n]*))$/m.exec(content);
		return firstNonEmpty(match?.[1], match?.[2], match?.[3]) ?? undefined;
	} catch (error) {
		if (!isEnoent(error)) {
			logger.debug("Could not read Linux distribution", { error: String(error) });
		}
		return undefined;
	}
}

/**
 * Keep the compact OS identity on uname-style fields. Bun may return
 * `os.version() === "unknown"` on macOS 15+, which previously misidentified
 * the host in the workstation prompt (#4141).
 */
function getEnvironmentInfo(
	cpuModel: string | undefined,
	gpu: string | undefined,
	distroName: string | undefined,
): Array<{ label: string; value: string }> {
	const identity = `${os.userInfo().username}@${os.hostname()}`;
	const system = `${os.type()} ${os.release()} · ${os.arch()}`;
	const operatingSystem = distroName ? `${distroName} · ${system}` : system;
	const entries: Array<{ label: string; value: string | undefined }> = [
		{ label: "Identity", value: identity },
		{ label: "OS", value: operatingSystem },
		{ label: "CPU", value: cpuModel },
		{ label: "GPU", value: gpu },
		{ label: "Terminal", value: getTerminalName() },
		{ label: "Timezone", value: Intl.DateTimeFormat().resolvedOptions().timeZone },
	];
	return entries.filter((e): e is { label: string; value: string } => !!e.value);
}

export interface SystemPromptSourceDiscovery {
	rawPath?: string;
	templatePath?: string;
	suppressedTemplatePath?: string;
	appendPath?: string;
}

/** Select effective raw, template, and append prompt sources using project-before-user precedence. */
export function discoverSystemPromptSources(cwd: string): SystemPromptSourceDiscovery {
	const projectRaw = findConfigFileWithMeta("SYSTEM.md", { user: false, cwd });
	const projectTemplate = findConfigFileWithMeta("SYSTEM.template.md", { user: false, cwd });
	const appendPath =
		findConfigFile("APPEND_SYSTEM.md", { user: false, cwd }) ??
		findConfigFile("APPEND_SYSTEM.md", { project: false, cwd });
	if (projectRaw) {
		return {
			rawPath: projectRaw.path,
			suppressedTemplatePath: projectTemplate?.path,
			appendPath,
		};
	}
	if (projectTemplate) {
		return { templatePath: projectTemplate.path, appendPath };
	}

	const userRaw = findConfigFileWithMeta("SYSTEM.md", { project: false, cwd });
	const userTemplate = findConfigFileWithMeta("SYSTEM.template.md", { project: false, cwd });
	if (userRaw) {
		return {
			rawPath: userRaw.path,
			suppressedTemplatePath: userTemplate?.path,
			appendPath,
		};
	}
	return { templatePath: userTemplate?.path, appendPath };
}

/** Select the child base template using project-before-user precedence. */
export function discoverSubagentBaseSystemPromptTemplate(cwd: string): string | undefined {
	return (
		findConfigFile("SYSTEM.template.md", { user: false, cwd }) ??
		findConfigFile("SYSTEM.template.md", { project: false, cwd })
	);
}

/** Select the child wrapper template using project-before-user precedence. */
export function discoverSubagentSystemPromptTemplate(cwd: string): string | undefined {
	return (
		findConfigFile("SUBAGENT-SYSTEM.template.md", { user: false, cwd }) ??
		findConfigFile("SUBAGENT-SYSTEM.template.md", { project: false, cwd })
	);
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

interface ResolvePromptInputOptions {
	strictTemplateFile?: boolean;
}

/** Resolve input as file path or literal string. */
export async function resolvePromptInput(
	input: string | undefined,
	description: string,
	options: ResolvePromptInputOptions = {},
): Promise<string | undefined> {
	if (input === undefined) return undefined;
	if (input.length === 0) {
		if (options.strictTemplateFile) throw new Error(`${description} must not be empty`);
		return undefined;
	}
	if (input.includes("\n")) return input;

	let content: string;
	try {
		content = await Bun.file(input).text();
	} catch (error) {
		if (options.strictTemplateFile && (!isEnoent(error) || path.isAbsolute(input))) {
			throw new Error(`Could not read ${description} file: ${input}`, { cause: error });
		}
		if (!hasFsCode(error, "ENAMETOOLONG") && !isEnoent(error)) {
			logger.warn(`Could not read ${description} file`, { path: input, error: String(error) });
		}
		return input;
	}
	if (options.strictTemplateFile && content.length === 0) {
		throw new Error(`${description} file must not be empty: ${input}`);
	}
	return content;
}

export interface LoadContextFilesOptions {
	/** Working directory to start walking up from. Default: getProjectDir() */
	cwd?: string;
	/** Disabled extension IDs to honor instead of the process-global settings. */
	disabledExtensions?: string[];
	/** File path replacing discovered user-level context while retaining project discovery. */
	userAgentsFile?: string;
}

/**
 * Deduplicate context files by paragraph containment.
 *
 * Files are sorted by depth descending (farther from cwd first) so that a
 * file is omitted only when a more-authoritative (closer-to-cwd) file
 * contains its entire normalized paragraph sequence as a contiguous run.
 * This makes the function self-contained — it does not rely on callers
 * pre-sorting the array, which matters because some callers concatenate
 * independently sorted workspace roots where array position does not reflect
 * authority. Files whose paragraphs are merely paraphrased or interleaved are
 * kept — containment is exact after normalization, not fuzzy.
 *
 * @internal Exported for testing.
 */
export function dedupeContainedContextFiles(
	contextFiles: Array<{ path: string; content: string; depth?: number }>,
): Array<{ path: string; content: string; depth?: number }> {
	// Sort by depth descending: higher depth (farther from cwd, less
	// authoritative) first, lower depth (closer to cwd, more authoritative)
	// last. Stable sort preserves caller order among equal-depth files.
	const sorted = [...contextFiles].sort((a, b) => {
		const depthA = a.depth ?? Number.POSITIVE_INFINITY;
		const depthB = b.depth ?? Number.POSITIVE_INFINITY;
		return depthB - depthA;
	});
	const blocks = sorted.map(file => splitComparablePromptBlocks(file.content));
	return sorted.filter(
		(_file, index) =>
			!blocks.some(
				(candidateBlocks, candidateIndex) =>
					candidateIndex > index && promptBlocksContain(candidateBlocks, blocks[index]),
			),
	);
}

async function resolveExplicitPromptFilePath(
	input: string,
	resolvedCwd: string,
	flag: "--agents-file" | "--system-template",
	label: "AGENTS file" | "System template",
	pathLabel: "AGENTS" | "System template",
): Promise<string> {
	if (input.length === 0) {
		throw new Error(`${flag} requires a non-empty path`);
	}

	const resolvedPath = path.resolve(resolvedCwd, expandTilde(input));
	let stat: fs.Stats;
	try {
		stat = await fs.promises.stat(resolvedPath);
	} catch (error) {
		if (isEnoent(error)) {
			throw new Error(`${label} not found: ${resolvedPath}`);
		}
		throw new Error(`Could not read ${label} ${resolvedPath}: ${String(error)}`);
	}
	if (!stat.isFile()) {
		throw new Error(`${pathLabel} path is not a regular file: ${resolvedPath}`);
	}
	return resolvedPath;
}

/** Resolve and validate a process-scoped Handlebars system template path. */
export function resolveSystemPromptTemplatePath(input: string, resolvedCwd: string): Promise<string> {
	return resolveExplicitPromptFilePath(input, resolvedCwd, "--system-template", "System template", "System template");
}

async function loadExplicitUserAgentsFile(input: string, resolvedCwd: string): Promise<ContextFileEntry> {
	const resolvedPath = await resolveExplicitPromptFilePath(
		input,
		resolvedCwd,
		"--agents-file",
		"AGENTS file",
		"AGENTS",
	);

	try {
		return {
			path: resolvedPath,
			content: await Bun.file(resolvedPath).text(),
			depth: undefined,
			kind: "agents-md",
		};
	} catch (error) {
		throw new Error(`Could not read AGENTS file ${resolvedPath}: ${String(error)}`);
	}
}

/**
 * Load all project context files using the capability API.
 * Returns {path, content, depth} entries for all discovered context files.
 * Files are sorted by depth (descending) so files closer to cwd appear last/more prominent.
 */
export async function loadProjectContextFiles(options: LoadContextFilesOptions = {}): Promise<ContextFileEntry[]> {
	const resolvedCwd = options.cwd ?? getProjectDir();

	const result = await loadCapability(contextFileCapability.id, {
		cwd: resolvedCwd,
		disabledExtensions: options.disabledExtensions,
	});
	const contextFiles: ContextFileEntry[] = (result.items as ContextFile[])
		.filter(contextFile => options.userAgentsFile === undefined || contextFile.level !== "user")
		.map(contextFile => ({
			path: contextFile.path,
			content: contextFile.content,
			depth: contextFile.depth,
		}));
	if (options.userAgentsFile !== undefined) {
		contextFiles.push(await loadExplicitUserAgentsFile(options.userAgentsFile, resolvedCwd));
	}

	// Materialize ContextFile items, expanding any `@path/to/file` includes
	// in their content. The expansion uses the file's own directory as the
	// resolution base so relative imports work the same way Claude Code,
	// Goose, and other tools document.
	const files: ContextFileEntry[] = await Promise.all(
		contextFiles.map(async contextFile => ({
			...contextFile,
			content: await expandAtImports(contextFile.content, contextFile.path),
		})),
	);

	// Sort by depth (descending): higher depth (farther from cwd) comes first,
	// so files closer to cwd appear later and are more prominent
	files.sort((a, b) => {
		const depthA = a.depth ?? -1;
		const depthB = b.depth ?? -1;
		return depthB - depthA;
	});

	return dedupeContainedContextFiles(files);
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

export type SystemPromptToolMetadataProjection =
	| {
			mode: "compact";
			toolNames: readonly string[];
			overrides?: Partial<Record<string, Partial<SystemPromptToolMetadata>>>;
	  }
	| {
			mode: "full";
			overrides?: Partial<Record<string, Partial<SystemPromptToolMetadata>>>;
	  };

export function buildSystemPromptToolMetadata(
	tools: Map<string, AgentTool>,
	overrides: Partial<Record<string, Partial<SystemPromptToolMetadata>>> = {},
): Map<string, SystemPromptToolMetadata> {
	return projectSystemPromptToolMetadata(tools, { mode: "full", overrides });
}

/** Builds a mode-specific metadata snapshot for internal prompt assembly. */
export function projectSystemPromptToolMetadata(
	tools: Map<string, AgentTool>,
	projection: SystemPromptToolMetadataProjection,
): Map<string, SystemPromptToolMetadata> {
	const metadata = new Map<string, SystemPromptToolMetadata>();
	const addTool = (name: string, tool: AgentTool): void => {
		const override = projection.overrides?.[name];
		const labelValue = override?.label ?? tool.label;
		const wireNameValue = override?.wireName ?? tool.customWireName;
		const label = typeof labelValue === "string" ? labelValue : "";
		const wireName = typeof wireNameValue === "string" ? wireNameValue : undefined;

		if (projection.mode === "compact") {
			metadata.set(name, { label, description: "", wireName });
			return;
		}

		const descriptionValue = override?.description ?? tool.description;
		metadata.set(name, {
			label,
			description: typeof descriptionValue === "string" ? descriptionValue : "",
			parameters: tool.parameters,
			examples: tool.examples,
			wireName,
		});
	};

	if (projection.mode === "compact") {
		for (const name of projection.toolNames) {
			const tool = tools.get(name);
			if (tool) addTool(name, tool);
		}
	} else {
		for (const [name, tool] of tools) addTool(name, tool);
	}

	return metadata;
}

export interface BuildSystemPromptOptions {
	/** Raw custom prompt content or path rendered through the bundled custom system prompt template. */
	customPrompt?: string;
	/** Handlebars system prompt template content or path replacing the bundled block-0 template. */
	systemPromptTemplate?: string;
	/** Already-loaded custom system prompt text; bypasses path resolution. */
	resolvedCustomPrompt?: string;
	/** Tools to include in prompt. */
	tools?: Map<string, SystemPromptToolMetadata>;
	/** Tool names to include in prompt. */
	toolNames?: string[];
	/**
	 * Names actually exposed as provider-callable tools. Defaults to `toolNames`.
	 * Code Mode passes its direct keep-set so the rendered tool inventory matches
	 * the wire surface while capability and safety gates still see every
	 * bridge-reachable tool in `toolNames`.
	 */
	directToolNames?: readonly string[];
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
	 * compact tool-name list; otherwise it renders the full Harmony-style
	 * `namespace functions { … }` catalog. Default: true
	 */
	nativeTools?: boolean;
	/** Skills settings for discovery. */
	skillsSettings?: SkillsSettings;
	/** Working directory. Default: getProjectDir() */
	cwd?: string;
	/** Additional workspace directories beyond cwd (multi-root), absolute. Injected into the project prompt. */
	additionalWorkspaceRoots?: string[];
	/** Pre-loaded context files (skips discovery if provided). */
	contextFiles?: Array<{ path: string; content: string; depth?: number }>;
	/** Skills provided directly to system prompt construction. */
	skills?: readonly Skill[];
	/** Pre-loaded rulebook rules (descriptions, excluding TTSR and always-apply). */
	rules?: Array<{ name: string; description?: string; path: string; globs?: string[] }>;
	/** Intent field name injected into every tool schema. If set, explains the field in the prompt. */
	intentField?: string;
	/** Encourage the agent to delegate via tasks unless changes are trivial. */
	eagerTasks?: boolean;
	/** When true, the Eager Tasks section uses the hard MUST/ONLY wording (`task.eager: always`) rather than the softer `preferred` nudge. */
	eagerTasksAlways?: boolean;
	/** Whether `task.batch` is enabled; selects the centralized delegation guidance's call shape. */
	taskBatch?: boolean;
	/** Effective task concurrency limit displayed in centralized delegation guidance. Zero means unlimited. */
	taskMaxConcurrency?: number;
	/** Whether IRC-backed parallel coordination can be included in delegation policy. */
	taskIrcEnabled?: boolean;
	/** Whether the read-only `scout` subagent is spawnable (not disabled, allowed by spawn policy). Defaults to true. */
	scoutAvailable?: boolean;
	/** Active model's delegation appetite (catalog `delegation-bias` axis); selects the Delegation section's wording. Default: `eager`. */
	delegationBias?: DelegationBias;

	/** Rules with alwaysApply=true — their full content is injected into the prompt. */
	alwaysApplyRules?: AlwaysApplyRule[];
	/** Whether secret obfuscation is active. When true, explains the redaction format in the prompt. */
	secretsEnabled?: boolean;
	/** Pre-loaded workspace tree (skips discovery if provided). May be a Promise to allow early kick-off. */
	workspaceTree?: WorkspaceTree | Promise<WorkspaceTree>;
	/** Whether the local memory://root summary is active. */
	memoryRootEnabled?: boolean;
	/** Whether the read-only security:// resource namespace is active. */
	securityEnabled?: boolean;
	/** Whether the browser eval prelude is enabled for this session. */
	browserEnabled?: boolean;
	/** Whether the computer eval prelude is enabled for this session. */
	computerEnabled?: boolean;
	/** Active model identifier (e.g. "anthropic/claude-opus-4") surfaced in the workstation block. */
	model?: string;
	/** Whether to surface `model` in the workstation block. Default: true. */
	includeModelInPrompt?: boolean;
	/** Personality preset rendered into the default system prompt. "none" omits the block. Default: "default" */
	personality?: Personality;
	/** Whether to include the workspace directory tree in the system prompt. Default: false */
	includeWorkspaceTree?: boolean;
	/** Whether Mermaid fenced blocks render as terminal ASCII diagrams. Default: true */
	renderMermaid?: boolean;
	/** Whether the TUI lifts an opening emoji into a reaction badge on the user's message. Default: false */
	reactions?: boolean;
	/** Pre-resolved nested active repo context. Undefined resolves from cwd. */
	activeRepoContext?: ActiveRepoContext | null;
	/** Tools mounted under `xd://`; renders the protocol section when non-empty. `dynamic` marks external devices whose summary is third-party metadata. */
	xdevTools?: Array<{ name: string; summary: string; dynamic?: boolean }>;
	/** Full docs + JSON schema for every `xd://`-mounted tool, inlined into the protocol section so no discovery `read` is needed. */
	xdevDocs?: string;
	/** Whether Auto-QA grievance reporting is enabled; renders the `xd://report_issue` note. */
	autoQaEnabled?: boolean;
	/** Whether active `write` is restricted to xd:// dispatch and the plan artifact sandbox. */
	writeTransportOnly?: boolean;
	/** Capture source-attributed dynamic fragments for prompt inspection. Default: false. */
	captureDynamicParts?: boolean;
}

export type DynamicPromptPartSource =
	| "system-prompt.md"
	| "custom-system-prompt.md"
	| "project-prompt.md"
	| "active-repo-context.md"
	| "SYSTEM.md"
	| "SYSTEM.template.md"
	| "subagent-system-prompt.md"
	| "SUBAGENT-SYSTEM.template.md"
	| "memory"
	| "mcp"
	| "auto-learn"
	| "append-system-prompt";

export interface DynamicPromptPart {
	id: string;
	source: DynamicPromptPartSource;
	providerBlockIndex: number;
	/** Disjoint rendered segments when the source contributes to multiple prompt locations. */
	segments?: string[];
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
	/**
	 * Names of `xd://` devices whose catalog/protocol section this prompt renders.
	 * Empty/undefined when no catalog was emitted (no mounted devices, or a custom
	 * prompt template that omits the section). Lets the session fold these devices
	 * into its announced-mount baseline so a same-turn mount notice does not re-list
	 * a catalog the prompt already carries (issue #7139).
	 */
	xdevCatalogNames?: readonly string[];
	/** Source-attributed dynamic prompt fragments for debug inspection. */
	dynamicParts: DynamicPromptPart[];
}

interface CounterfactualPromptPartProbe {
	id: string;
	without: (data: prompt.TemplateContext) => prompt.TemplateContext;
}

interface RenderedPromptBlock {
	text: string;
	dynamicParts: DynamicPromptPart[];
}

const TOOL_PRIORITY_NAMES: Record<string, true> = {
	read: true,
	edit: true,
	write: true,
	lsp: true,
	grep: true,
	glob: true,
	bash: true,
};
const AST_TOOL_NAMES: Record<string, true> = { ast_grep: true, ast_edit: true };
const TASK_TOOL_NAMES: Record<string, true> = { task: true };

function withoutTools(data: prompt.TemplateContext, excluded: Readonly<Record<string, true>>): prompt.TemplateContext {
	const tools = Array.isArray(data.tools)
		? data.tools.filter((tool): tool is string => typeof tool === "string" && excluded[tool] !== true)
		: [];
	return { ...data, tools };
}

const SYSTEM_PROMPT_PART_PROBES: readonly CounterfactualPromptPartProbe[] = [
	{ id: "mermaid", without: data => ({ ...data, renderMermaid: false }) },
	{ id: "skills", without: data => ({ ...data, skills: [] }) },
	{ id: "always-apply-rules", without: data => ({ ...data, alwaysApplyRules: [] }) },
	{ id: "rules", without: data => ({ ...data, rules: [] }) },
	{ id: "tool-inventory", without: data => ({ ...data, toolInfo: [] }) },
	{ id: "intent-tracing", without: data => ({ ...data, intentTracing: false }) },
	{ id: "secrets", without: data => ({ ...data, secretsEnabled: false }) },
	{ id: "tool-priority", without: data => withoutTools(data, TOOL_PRIORITY_NAMES) },
	{ id: "ast-tools", without: data => withoutTools(data, AST_TOOL_NAMES) },
	{ id: "eager-tasks", without: data => withoutTools(data, TASK_TOOL_NAMES) },
	{
		id: "xdev-tools",
		without: data => ({ ...data, xdevTools: [], xdevDocs: "" }),
	},
];

const CUSTOM_PROMPT_PART_PROBES: readonly CounterfactualPromptPartProbe[] = [
	{ id: "append-prompt", without: data => ({ ...data, appendPrompt: "" }) },
	{ id: "context-files", without: data => ({ ...data, contextFiles: [] }) },
	{ id: "skills", without: data => ({ ...data, skills: [] }) },
	{ id: "always-apply-rules", without: data => ({ ...data, alwaysApplyRules: [] }) },
	{ id: "rules", without: data => ({ ...data, rules: [] }) },
	{ id: "secrets", without: data => ({ ...data, secretsEnabled: false }) },
];

const PROJECT_PROMPT_PART_PROBES: readonly CounterfactualPromptPartProbe[] = [
	{ id: "workstation", without: data => ({ ...data, environment: [], model: "" }) },
	{ id: "context-files", without: data => ({ ...data, contextFiles: [] }) },
	{ id: "dir-context", without: data => ({ ...data, agentsMdSearch: { files: [] } }) },
	{ id: "workspace-tree", without: data => ({ ...data, includeWorkspaceTree: false }) },
	{ id: "cwd-date", without: data => ({ ...data, cwd: "", date: "" }) },
	{ id: "append-prompt", without: data => ({ ...data, appendPrompt: "" }) },
];

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

function counterfactualSegments(rendered: string, without: string): string[] {
	return diffLines(`${without}\n`, `${rendered}\n`)
		.filter(change => change.added)
		.map(change => normalizePromptBlock(change.value))
		.filter(segment => segment.length > 0);
}

function renderInspectablePromptBlock(
	template: string,
	data: prompt.TemplateContext,
	source: DynamicPromptPartSource,
	providerBlockIndex: number,
	trimOutput = false,
	captureDynamicParts = false,
	probes: readonly CounterfactualPromptPartProbe[] = [],
): RenderedPromptBlock {
	const text = trimOutput ? prompt.render(template, data).trim() : prompt.render(template, data);
	if (!captureDynamicParts) return { text, dynamicParts: [] };

	const dynamicParts: DynamicPromptPart[] = [];
	for (const probe of probes) {
		const withoutRendered = prompt.render(template, probe.without(data));
		const withoutText = trimOutput ? withoutRendered.trim() : withoutRendered;
		const segments = counterfactualSegments(text, withoutText);
		if (segments.length === 0) continue;
		const partText = segments.length === 1 ? segments[0] : segments.join("\n\n");
		dynamicParts.push({
			id: probe.id,
			source,
			providerBlockIndex,
			text: partText,
			...(segments.length > 1 ? { segments } : {}),
		});
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
		systemPromptTemplate,
		resolvedCustomPrompt: providedResolvedCustomPrompt,
		tools,
		appendSystemPrompt,
		inlineToolDescriptors: providedInlineToolDescriptors,
		resolvedAppendSystemPrompt: providedResolvedAppendPrompt,
		appendSystemPromptParts = [],
		nativeTools = true,
		skillsSettings,
		toolNames: providedToolNames,
		directToolNames,
		cwd,
		additionalWorkspaceRoots = [],
		contextFiles: providedContextFiles,
		skills: providedSkills,
		rules,
		alwaysApplyRules,
		intentField,
		eagerTasks = false,
		eagerTasksAlways = false,
		taskBatch = true,
		taskMaxConcurrency = 0,
		taskIrcEnabled = false,
		secretsEnabled = false,
		workspaceTree: providedWorkspaceTree,
		scoutAvailable = true,
		delegationBias = "eager",
		memoryRootEnabled = false,
		securityEnabled = false,
		browserEnabled = false,
		computerEnabled = false,
		model,
		includeModelInPrompt = true,
		personality = "default",
		includeWorkspaceTree = false,
		renderMermaid = true,
		reactions = false,
		xdevTools = [],
		xdevDocs = "",
		autoQaEnabled = false,
		writeTransportOnly = false,
		captureDynamicParts = false,
		activeRepoContext: providedActiveRepoContext,
	} = options;
	const inlineToolDescriptors = providedInlineToolDescriptors ?? false;
	const resolvedCwd = cwd ?? getProjectDir();

	const prepDefaults = {
		resolvedCustomPrompt: undefined as string | undefined,
		resolvedAppendPrompt: undefined as string | undefined,
		systemPromptCustomization: null as string | null,
		contextFiles: dedupeContainedContextFiles(providedContextFiles ?? []),
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
		distroName: undefined as string | undefined,
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

	// Caller-owned raw content or templates control block 0. The secondary
	// capability-path SYSTEM.md walk-up must not augment either input.
	const callerControlsBlockZero =
		providedResolvedCustomPrompt !== undefined || customPrompt !== undefined || systemPromptTemplate !== undefined;
	const systemPromptCustomizationPromise: Promise<string | null> = callerControlsBlockZero
		? Promise.resolve(null)
		: logger.time("loadSystemPromptFiles", loadSystemPromptFiles, { cwd: resolvedCwd });
	const contextFilesPromise = (async () => {
		const primary = providedContextFiles
			? providedContextFiles
			: await logger.time("loadProjectContextFiles", loadProjectContextFiles, { cwd: resolvedCwd });
		// Also discover context files (AGENTS.md, rules, etc.) for each additional workspace root.
		const additionalRoots = additionalWorkspaceRoots.filter(d => path.resolve(d) !== path.resolve(resolvedCwd));
		if (additionalRoots.length === 0) return primary;
		const extra = await Promise.all(
			additionalRoots.map(root => loadProjectContextFiles({ cwd: root }).catch(() => [])),
		);
		return dedupeContainedContextFiles([...primary, ...extra.flat()]);
	})();
	const additionalRootsForTree = additionalWorkspaceRoots.filter(d => path.resolve(d) !== path.resolve(resolvedCwd));
	const workspaceTreePromise = (async () => {
		const primary =
			providedWorkspaceTree !== undefined
				? await Promise.resolve(providedWorkspaceTree)
				: includeWorkspaceTree
					? await logger.time("buildWorkspaceTree", () =>
							buildWorkspaceTree(resolvedCwd, { timeoutMs: SYSTEM_PROMPT_PREP_TIMEOUT_MS }),
						)
					: { rootPath: resolvedCwd, rendered: "", truncated: false, totalLines: 0, agentsMdFiles: [] };
		if (additionalRootsForTree.length === 0 || !includeWorkspaceTree) return primary;
		const extraTrees = await Promise.all(
			additionalRootsForTree.map(root =>
				buildWorkspaceTree(root, { timeoutMs: SYSTEM_PROMPT_PREP_TIMEOUT_MS }).catch(() => ({
					rootPath: root,
					rendered: "",
					truncated: false,
					totalLines: 0,
					agentsMdFiles: [],
				})),
			),
		);
		return { ...primary, agentsMdFiles: [...primary.agentsMdFiles, ...extraTrees.flatMap(t => t.agentsMdFiles)] };
	})();
	const skillsPromise: Promise<readonly Skill[]> =
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
	// "none" (explicit off — and every subagent) omits the block and skips the file lookup.
	const bundledPersonality = personality === "none" ? "" : PERSONALITY_SPECS[personality].trim();
	const personalityPromise: Promise<string> =
		personality === "none"
			? Promise.resolve("")
			: logger
					.time("loadPersonalityOverride", loadPersonalityOverride)
					.then(override => override ?? bundledPersonality);
	const distroNamePromise = logger.time("getDistroName", getDistroName);

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
		personalityBlock,
		distroName,
	] = await Promise.all([
		resolvePromptInput(systemPromptTemplate, "system prompt template", { strictTemplateFile: true }),
		withDeadline(
			"customPrompt",
			providedResolvedCustomPrompt !== undefined
				? Promise.resolve(providedResolvedCustomPrompt)
				: resolvePromptInput(customPrompt, "custom prompt"),
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
			dedupeContainedContextFiles,
		),
		withDeadline("loadSkills", skillsPromise, prepDefaults.skills),
		withDeadline("buildWorkspaceTree", workspaceTreePromise, prepDefaults.workspaceTree),
		withDeadline("resolveActiveRepoContext", activeRepoContextPromise, prepDefaults.activeRepoContext),
		withDeadline("getCpuModel", cpuModelPromise, prepDefaults.cpuModel),
		withDeadline("getCachedGpu", gpuPromise, prepDefaults.gpu),
		withDeadline("loadPersonalityOverride", personalityPromise, bundledPersonality),
		withDeadline("getDistroName", distroNamePromise, prepDefaults.distroName),
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

	const promptCwd = normalizePromptPath(resolvedCwd);

	// Build tool metadata for system prompt rendering.
	// Priority: explicit list > tools map > conservative SDK fallback.
	let toolNames = providedToolNames;
	if (!toolNames) {
		toolNames = tools ? Array.from(tools.keys()) : [...DEFAULT_SYSTEM_PROMPT_TOOL_NAMES];
	}

	// List mode shows a compact tool-name list; it only applies when descriptors
	// stay in provider-native tool schemas AND native tool calling is active.
	// Otherwise render the full functions-namespace catalog in the system prompt.
	const toolListMode = !inlineToolDescriptors && nativeTools;
	// Build tool descriptions for system prompt rendering.
	const toolPromptNames = new Map<string, string>(toolNames.map(name => [name, tools?.get(name)?.wireName ?? name]));
	// xd://-mounted tools count as present for prompt gates ({{#has tools "lsp"}})
	// and resolve their own name as the reference — the xd:// section explains
	// the access path. The Tool Inventory list stays limited to real defs.
	for (const mounted of xdevTools) {
		if (!toolPromptNames.has(mounted.name)) toolPromptNames.set(mounted.name, mounted.name);
	}
	const toolRefs = Object.fromEntries(toolPromptNames.entries());
	const xdevToolNames = new Set(xdevTools.map(mounted => mounted.name));
	// A direct custom tool can share a name with a retained built-in device.
	// Presence in both toolNames and tools proves it still has a top-level definition.
	// Bridge-only Code Mode tools stay out of the callable inventory: the eval
	// description documents their `tool.*` access path instead.
	const directSet = directToolNames === undefined ? undefined : new Set(directToolNames);
	const directInventoryNames = directSet === undefined ? toolNames : toolNames.filter(name => directSet.has(name));
	const inventoryToolNames =
		xdevToolNames.size === 0
			? directInventoryNames
			: directInventoryNames.filter(name => tools?.has(name) || !xdevToolNames.has(name));
	const toolInfo = inventoryToolNames.map(name => ({
		name: toolPromptNames.get(name) ?? name,
		internalName: name,
		label: tools?.get(name)?.label ?? "",
	}));
	const toolInventory = toolListMode
		? ""
		: renderToolInventory(
				inventoryToolNames.map(name => {
					const meta = tools?.get(name);
					return {
						name: toolPromptNames.get(name) ?? name,
						description: meta?.description ?? "",
						parameters: meta?.parameters ?? ({ type: "object" } as TSchema),
						examples: meta?.examples,
					};
				}),
			);

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
	const activeTemplate = resolvedSystemPromptTemplate ?? defaultSystemPromptTemplate;
	const contextPromptSources = contextFiles.map(file => file.content);
	const promptSources = [
		effectiveSystemPromptCustomization,
		resolvedSystemPromptTemplate,
		resolvedCustomPrompt,
		resolvedAppendPrompt,
		...contextPromptSources,
	];
	const injectedAlwaysApplyRules = dedupeAlwaysApplyRules(alwaysApplyRules, promptSources);

	const environment = getEnvironmentInfo(cpuModel, gpu, distroName);
	const renderData: prompt.TemplateContext = {
		systemPromptCustomization: effectiveSystemPromptCustomization,
		customPrompt: resolvedCustomPrompt,
		appendPrompt: resolvedAppendPrompt ?? "",
		tools: [...new Set([...toolNames, ...xdevTools.map(mounted => mounted.name)])],
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
		cwd: promptCwd,
		additionalWorkspaceRoots: additionalWorkspaceRoots.filter(d => path.resolve(d) !== path.resolve(resolvedCwd)),
		model: includeModelInPrompt ? (model ?? "") : "",
		delegationBias,
		personality: personalityBlock,
		intentTracing: !!intentField,
		intentField: intentField ?? "",
		eagerTasks,
		eagerTasksAlways,
		taskBatch,
		MAX_CONCURRENCY: normalizeConcurrencyLimit(taskMaxConcurrency),
		scoutAvailable,
		taskIrcEnabled,
		secretsEnabled,
		hasMemoryRoot: memoryRootEnabled,
		securityEnabled,
		browserEnabled,
		computerEnabled,
		hasObsidian: hasObsidian(),
		includeWorkspaceTree,
		renderMermaid,
		reactions,
		xdevTools,
		hasDynamicXdevTools: xdevTools.some(mounted => mounted.dynamic === true),
		xdevDocs,
		autoQaEnabled,
		writeTransportOnly,
	};
	const systemTemplate = usesCustomPrompt ? customSystemPromptTemplate : activeTemplate;
	const systemSource =
		resolvedSystemPromptTemplate === undefined
			? usesCustomPrompt
				? "custom-system-prompt.md"
				: "system-prompt.md"
			: "SYSTEM.template.md";
	const systemBlock = renderInspectablePromptBlock(
		systemTemplate,
		renderData,
		systemSource,
		0,
		false,
		captureDynamicParts,
		usesCustomPrompt ? CUSTOM_PROMPT_PART_PROBES : SYSTEM_PROMPT_PART_PROBES,
	);
	const systemPrompt = [systemBlock.text];
	const dynamicParts: DynamicPromptPart[] = [...systemBlock.dynamicParts];
	if (computerEnabled) {
		systemPrompt.push(computerSafetyPrompt.trim());
	}

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
		captureDynamicParts,
		PROJECT_PROMPT_PART_PROBES,
	);
	if (projectBlock.text) {
		systemPrompt.push(projectBlock.text);
		dynamicParts.push(...projectBlock.dynamicParts);
	}

	if (captureDynamicParts && appendSystemPromptParts.length > 0) {
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
			if (captureDynamicParts) {
				addDynamicPart(
					dynamicParts,
					{
						id: "active-repo-context",
						source: "active-repo-context.md",
						providerBlockIndex: activeRepoBlockIndex,
					},
					activeRepoBlock.text,
					activeRepoBlock.text,
				);
			}
		}
	}

	// The xd:// protocol section (with its device catalog) is only rendered by the
	// default template; a resolved custom prompt uses a template that omits it.
	const xdevCatalogNames =
		!resolvedCustomPrompt && xdevTools.length > 0 ? xdevTools.map(mounted => mounted.name) : undefined;
	return { systemPrompt, dynamicParts, xdevCatalogNames };
}

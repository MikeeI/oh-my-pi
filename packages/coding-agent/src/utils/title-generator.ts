/**
 * Generate session titles using a smol, fast model.
 */
import * as path from "node:path";

import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import { type Api, type AssistantMessage, completeSimple, type Model } from "@oh-my-pi/pi-ai";
import { isTerminalHeadless, logger, prompt } from "@oh-my-pi/pi-utils";
import type { ModelRegistry } from "../config/model-registry";

import { resolveRoleSelection } from "../config/model-resolver";
import type { Settings } from "../config/settings";
import titleMarkerInstruction from "../prompts/system/title-marker-instruction.md" with { type: "text" };
import titleSystemPrompt from "../prompts/system/title-system.md" with { type: "text" };
import titleTranscriptSystemPrompt from "../prompts/system/title-transcript-system.md" with { type: "text" };
import { isTinyTitleLocalModelKey, ONLINE_TINY_TITLE_MODEL_KEY } from "../tiny/models";
import { formatTitleUserMessage, isLowSignalTitleInput, normalizeGeneratedTitle, stripCodeBlocks } from "../tiny/text";
import { tinyTitleClient } from "../tiny/title-client";

const TITLE_SYSTEM_PROMPT = prompt.render(titleSystemPrompt);
const TITLE_MARKER_INSTRUCTION = prompt.render(titleMarkerInstruction);
const TITLE_TRANSCRIPT_SYSTEM_PROMPT = prompt.render(titleTranscriptSystemPrompt);

const DEFAULT_TERMINAL_TITLE = "π";
const TERMINAL_TITLE_CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

// Cover the "backend ignores `disableReasoning`" case unconditionally: the
// static `model.reasoning` catalog flag can't distinguish a thinking model that
// was declared with `reasoning: false` (e.g. Qwen3 served locally via llama.cpp,
// whose bundled jinja chat template forces `enable_thinking: true`) from one
// that never emits thinking. `maxTokens` is a hard cap, not a target — the
// happy-path completion still returns in a handful of tokens, so raising the
// ceiling costs nothing when thinking is genuinely suppressed and keeps the
// `<title>` marker output reachable when it isn't (issue #4355).
const TITLE_MAX_TOKENS = 1024;
const TITLE_TRANSCRIPT_MAX_USER_MESSAGES = 5;
const TITLE_TRANSCRIPT_MAX_ASSISTANT_MESSAGES = 5;
const TITLE_TRANSCRIPT_MAX_MESSAGE_CHARS = 10_000;
const TITLE_TRANSCRIPT_MAX_TOTAL_CHARS = 40_000;

interface TitleModelSelectionOptions {
	roleOrder?: readonly string[];
	fallbackToCurrentModel?: boolean;
	userMessageFormatter?: (message: string) => string;
}

/** Matches the title the model wraps in `<title>...</title>`. */
const TITLE_MARKER_RE = /<title>([\s\S]*?)<\/title>/i;

function getTitleModel(
	registry: ModelRegistry,
	settings: Settings,
	currentModel?: Model<Api>,
	options?: TitleModelSelectionOptions,
): Model<Api> | undefined {
	const availableModels = registry.getAvailable();
	if (availableModels.length === 0) return undefined;

	const roleOrder = options?.roleOrder ?? ["tiny", "commit", "smol"];
	const titleModel = resolveRoleSelection(roleOrder, settings, availableModels)?.model;
	if (titleModel) return titleModel;

	if (options?.fallbackToCurrentModel !== false && currentModel) return currentModel;

	return undefined;
}

interface TextBlock {
	type: "text";
	text: string;
}

interface RecentTitleMessage {
	role: "user" | "assistant";
	text: string;
	index: number;
}

function isTextBlock(value: unknown): value is TextBlock {
	if (typeof value !== "object" || value === null) return false;
	const block = value as { type?: unknown; text?: unknown };
	return block.type === "text" && typeof block.text === "string";
}

function extractTextOnly(message: AgentMessage): string {
	const content = "content" in message ? message.content : undefined;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter(isTextBlock)
		.map(block => block.text)
		.join("\n");
}

function capTranscriptMessage(text: string): string {
	const cleaned = stripCodeBlocks(text).trim();
	return cleaned.length > TITLE_TRANSCRIPT_MAX_MESSAGE_CHARS
		? `${cleaned.slice(0, TITLE_TRANSCRIPT_MAX_MESSAGE_CHARS)}…`
		: cleaned;
}

function selectRecentTitleMessages(messages: readonly AgentMessage[]): RecentTitleMessage[] {
	const selected: RecentTitleMessage[] = [];
	let userCount = 0;
	let assistantCount = 0;

	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (!message || (message.role !== "user" && message.role !== "assistant")) continue;
		if (message.role === "user" && userCount >= TITLE_TRANSCRIPT_MAX_USER_MESSAGES) continue;
		if (message.role === "assistant" && assistantCount >= TITLE_TRANSCRIPT_MAX_ASSISTANT_MESSAGES) continue;

		const text = capTranscriptMessage(extractTextOnly(message));
		if (!text) continue;

		selected.push({ role: message.role, text, index });
		if (message.role === "user") userCount++;
		else assistantCount++;

		if (
			userCount >= TITLE_TRANSCRIPT_MAX_USER_MESSAGES &&
			assistantCount >= TITLE_TRANSCRIPT_MAX_ASSISTANT_MESSAGES
		) {
			break;
		}
	}

	return selected.sort((a, b) => a.index - b.index);
}

export function formatRecentTitleTranscript(messages: readonly AgentMessage[]): string | null {
	const rendered = selectRecentTitleMessages(messages).map(item => `<${item.role}>\n${item.text}\n</${item.role}>`);
	if (rendered.length === 0) return null;

	const transcript = rendered.join("\n\n");
	return transcript.length > TITLE_TRANSCRIPT_MAX_TOTAL_CHARS
		? `…${transcript.slice(-TITLE_TRANSCRIPT_MAX_TOTAL_CHARS)}`
		: transcript;
}

function formatTitleTranscriptUserMessage(message: string): string {
	return `<user-message>\n${message}\n</user-message>`;
}

export async function generateSessionTitleFromRecentTranscript(
	messages: readonly AgentMessage[],
	registry: ModelRegistry,
	settings: Settings,
	sessionId?: string,
	currentModel?: Model<Api>,
	metadataResolver?: (provider: string) => Record<string, unknown> | undefined,
): Promise<string | null> {
	const transcript = formatRecentTitleTranscript(messages);
	if (!transcript) {
		logger.debug("title-generator: skipped empty transcript", { sessionId, reason: "empty-transcript" });
		return null;
	}

	const smolModel = resolveRoleSelection(["smol"], settings, registry.getAvailable())?.model;
	if (!smolModel) {
		throw new Error(
			"Cannot auto-generate session name: no smol model configured. Set `modelRoles.smol` or `PI_SMOL_MODEL`.",
		);
	}

	return generateTitleOnline(
		transcript,
		registry,
		settings,
		sessionId,
		currentModel,
		metadataResolver,
		undefined,
		TITLE_TRANSCRIPT_SYSTEM_PROMPT,
		{ roleOrder: ["smol"], fallbackToCurrentModel: false, userMessageFormatter: formatTitleTranscriptUserMessage },
	);
}

/**
 * Generate a title for a session based on the first user message.
 *
 * @param firstMessage The first user message
 * @param registry Model registry
 * @param settings Settings used to resolve the smol role
 * @param sessionId Optional session id for sticky API key selection
 * @param currentModel Current model (used to derive title model)
 * @param metadataResolver Optional resolver evaluated after credential selection
 *   to produce request metadata (e.g. user_id for session attribution). Using a
 *   resolver instead of a pre-evaluated value ensures the metadata's account_uuid
 *   reflects the credential actually selected for this request.
 * @param customSystemPrompt Optional title-specific system prompt override
 */
export async function generateSessionTitle(
	firstMessage: string,
	registry: ModelRegistry,
	settings: Settings,
	sessionId?: string,
	currentModel?: Model<Api>,
	metadataResolver?: (provider: string) => Record<string, unknown> | undefined,
	customSystemPrompt?: string,
): Promise<string | null> {
	// Defer titling for greetings / acknowledgements / empty input. The default
	// tiny title model can't reliably decline trivial input, so this happens
	// deterministically before any model is invoked; the caller retries on the
	// next user message while the session stays unnamed.
	if (isLowSignalTitleInput(firstMessage)) {
		logger.debug("title-generator: skipped low-signal input", { sessionId, reason: "low-signal" });
		return null;
	}

	const titleSystemPrompt = customSystemPrompt?.trim() || undefined;
	const tinyModel = settings.get("providers.tinyModel");
	if (tinyModel === ONLINE_TINY_TITLE_MODEL_KEY) {
		return generateTitleOnline(
			firstMessage,
			registry,
			settings,
			sessionId,
			currentModel,
			metadataResolver,
			undefined,
			titleSystemPrompt,
		);
	}

	// User explicitly picked a local tiny model. NEVER fall back to the online
	// smol path (issue #3187): the smol role resolves through priority.json and
	// silently bills whatever provider holds the resolved API key — OpenRouter
	// in the reporter's case, leaking real credits without consent. If the
	// local worker fails (unknown key, download missing, transformers.js
	// crash, abort), leave the session untitled; the next user turn retries.
	if (!isTinyTitleLocalModelKey(tinyModel)) {
		logger.warn("title-generator: unknown local tiny model; skipping title (will not fall back to online)", {
			sessionId,
			model: tinyModel,
			reason: "unknown-local-model",
		});
		return null;
	}
	try {
		const localTitle = titleSystemPrompt
			? await tinyTitleClient.generate(tinyModel, firstMessage, { systemPrompt: titleSystemPrompt })
			: await tinyTitleClient.generate(tinyModel, firstMessage);
		if (!localTitle) {
			logger.warn("title-generator: local tiny model produced no title; skipping (no online fallback)", {
				sessionId,
				model: tinyModel,
				reason: "local-no-output",
			});
			return null;
		}
		return localTitle;
	} catch (err) {
		logger.warn("title-generator: local tiny model errored; skipping (no online fallback)", {
			sessionId,
			model: tinyModel,
			error: err instanceof Error ? err.message : String(err),
		});
		return null;
	}
}

export async function generateTitleOnline(
	firstMessage: string,
	registry: ModelRegistry,
	settings: Settings,
	sessionId?: string,
	currentModel?: Model<Api>,
	metadataResolver?: (provider: string) => Record<string, unknown> | undefined,
	signal?: AbortSignal,
	customSystemPrompt?: string,
	modelSelection?: TitleModelSelectionOptions,
): Promise<string | null> {
	const model = getTitleModel(registry, settings, currentModel, modelSelection);
	if (!model) {
		logger.warn("title-generator: no title model found", { sessionId, reason: "no-title-model" });
		return null;
	}

	const titleSystemPrompt = customSystemPrompt?.trim() || undefined;
	// The model is always asked to wrap the title in `<title>...</title>` and
	// the title is parsed from text. A forced `set_title` tool call was the old
	// scheme, but hosts that ignore or reject forced `tool_choice` then echoed
	// the prompt's `{"title": ...}` JSON example verbatim as the session title;
	// markers work uniformly everywhere.
	const systemPrompt = titleSystemPrompt ? [titleSystemPrompt, TITLE_MARKER_INSTRUCTION] : [TITLE_SYSTEM_PROMPT];
	const userMessage = (modelSelection?.userMessageFormatter ?? formatTitleUserMessage)(firstMessage);
	const modelName = `${model.provider}/${model.id}`;
	const modelContext = {
		sessionId,
		provider: model.provider,
		id: model.id,
		model: modelName,
	};
	logger.debug("title-generator: start", modelContext);

	try {
		const apiKey = await registry.getApiKey(model, sessionId);
		if (!apiKey) {
			logger.warn("title-generator: no API key", { ...modelContext, reason: "missing-api-key" });
			return null;
		}
		// Resolve metadata after getApiKey so the session-sticky credential for this
		// request is already recorded; metadataResolver can then return the correct
		// account_uuid rather than the snapshot-at-call-site value.
		const metadata = metadataResolver?.(model.provider);

		// Title generation is a 3-7 word task, but the ceiling has to survive
		// backends that ignore `disableReasoning` (see TITLE_MAX_TOKENS above).
		const maxTokens = TITLE_MAX_TOKENS;
		logger.debug("title-generator: request", { ...modelContext, maxTokens });

		const response = await completeSimple(
			model,
			{
				systemPrompt,
				messages: [{ role: "user", content: userMessage, timestamp: Date.now() }],
			},
			{
				apiKey: registry.resolver(model, sessionId),
				maxTokens,
				disableReasoning: true,
				metadata,
				signal,
			},
		);

		if (response.stopReason === "error") {
			logger.warn("title-generator: response error", {
				...modelContext,
				reason: "provider-response-error",
				stopReason: response.stopReason,
				errorMessage: response.errorMessage,
			});
			return null;
		}

		const title = normalizeGeneratedTitle(extractGeneratedTitle(response.content), firstMessage);

		if (!title) {
			logger.debug("title-generator: no title returned", {
				...modelContext,
				reason: "model-returned-none",
				usage: response.usage,
				stopReason: response.stopReason,
			});
			return null;
		}

		logger.debug("title-generator: success", {
			...modelContext,
			title,
			usage: response.usage,
			stopReason: response.stopReason,
		});

		return title;
	} catch (err) {
		logger.warn("title-generator: error", {
			...modelContext,
			reason: "exception",
			error: err instanceof Error ? err.message : String(err),
		});
		return null;
	}
}

function extractGeneratedTitle(contentBlocks: AssistantMessage["content"]): string {
	let textTitle = "";
	for (const content of contentBlocks) {
		if (content.type === "text") {
			textTitle += content.text;
		}
	}
	// Stay lenient: prefer the marker when the model closed it, otherwise
	// accept a plain sentence after stripping any stray/unclosed tag fragment
	// (e.g. output truncated before the closing tag).
	const marker = TITLE_MARKER_RE.exec(textTitle);
	const candidate = marker ? marker[1].trim() : textTitle.replace(/<\/?title>/gi, "").trim();
	return unwrapJsonTitle(candidate);
}

/**
 * Unwrap a JSON-shaped response (`{"title": "..."}`, optionally code-fenced)
 * into the bare title. Models occasionally emit the structured shape they were
 * trained on for title tasks instead of plain text; without this the raw JSON
 * became the session title.
 */
function unwrapJsonTitle(candidate: string): string {
	const text = candidate
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/```$/, "")
		.trim();
	if (!text.startsWith("{")) return candidate;
	try {
		const parsed: unknown = JSON.parse(text);
		if (parsed && typeof parsed === "object" && "title" in parsed && typeof parsed.title === "string") {
			return parsed.title.trim();
		}
	} catch {
		// Truncated/malformed JSON: salvage the quoted title value if present.
		const quoted = /"title"\s*:\s*("(?:[^"\\]|\\.)*")/.exec(text);
		if (quoted) {
			const salvaged: unknown = JSON.parse(quoted[1]);
			if (typeof salvaged === "string") return salvaged.trim();
		}
	}
	return candidate;
}

/**
 * Remove control characters so model-generated titles cannot inject terminal escapes.
 */
function sanitizeTerminalTitlePart(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const sanitized = value.replace(TERMINAL_TITLE_CONTROL_CHARS, "").trim();
	return sanitized || undefined;
}

function getFallbackTerminalTitle(cwd: string | undefined): string | undefined {
	if (!cwd) return undefined;
	const resolvedCwd = path.resolve(cwd);
	const baseName = path.basename(resolvedCwd);
	if (!baseName || baseName === path.parse(resolvedCwd).root) return undefined;
	return sanitizeTerminalTitlePart(baseName);
}

export function formatSessionTerminalTitle(sessionName: string | undefined, cwd?: string): string {
	const label = sanitizeTerminalTitlePart(sessionName) ?? getFallbackTerminalTitle(cwd);
	return label ? `${DEFAULT_TERMINAL_TITLE}: ${label}` : DEFAULT_TERMINAL_TITLE;
}

/**
 * Set the terminal title using OSC 0 (sets both tab and window title). Unsupported terminals ignore it.
 */
export function setTerminalTitle(title: string): void {
	if (!process.stdout.isTTY || isTerminalHeadless()) return;
	process.stdout.write(`\x1b]0;${sanitizeTerminalTitlePart(title) ?? DEFAULT_TERMINAL_TITLE}\x07`);
}

export function setSessionTerminalTitle(sessionName: string | undefined, cwd?: string): void {
	setTerminalTitle(formatSessionTerminalTitle(sessionName, cwd));
}

/**
 * Save the current terminal title on terminals that support xterm window ops.
 */
export function pushTerminalTitle(): void {
	if (!process.stdout.isTTY || isTerminalHeadless()) return;
	process.stdout.write("\x1b[22;2t");
}

/**
 * Restore the previously saved terminal title on terminals that support xterm window ops.
 */
export function popTerminalTitle(): void {
	if (!process.stdout.isTTY || isTerminalHeadless()) return;
	process.stdout.write("\x1b[23;2t");
}

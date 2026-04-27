/**
 * Generate session titles using a smol, fast model.
 */
import * as path from "node:path";
import type { ThinkingLevel } from "@oh-my-pi/pi-agent-core";
import type { Api, Model } from "@oh-my-pi/pi-ai";
import { completeSimple } from "@oh-my-pi/pi-ai";
import { logger, prompt } from "@oh-my-pi/pi-utils";
import type { ModelRegistry } from "../config/model-registry";
import { resolveRoleSelection } from "../config/model-resolver";
import type { Settings } from "../config/settings";
import titleSystemPrompt from "../prompts/system/title-system.md" with { type: "text" };
import { toReasoningEffort } from "../thinking";

const MAX_RECENT_MESSAGES = 3;
const MAX_CHARS_PER_MESSAGE = 600;

const DEFAULT_TERMINAL_TITLE = "\u03C0";
const TERMINAL_TITLE_CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

const MAX_INPUT_CHARS = 2000;

function getTitleModel(
	registry: ModelRegistry,
	settings: Settings,
	currentModel?: Model<Api>,
): { model: Model<Api>; thinkingLevel?: ThinkingLevel } | undefined {
	const availableModels = registry.getAvailable();
	if (availableModels.length === 0) return undefined;

	const titleModel = resolveRoleSelection(["commit", "smol"], settings, availableModels, registry);
	if (titleModel) {
		return { model: titleModel.model, thinkingLevel: titleModel.thinkingLevel };
	}

	if (currentModel) {
		return { model: currentModel };
	}

	return undefined;
}

/** Clean up model-generated title text. */
function cleanTitle(raw: string): string | null {
	let title = raw.trim();
	if (!title) return null;
	title = title.replace(/^["']|["']$/g, "").replace(/[.!?]$/, "");
	return title || null;
}

/**
 * Shared LLM call for title generation.
 * Resolves model, API key, calls completeSimple, and cleans the result.
 */
async function callTitleModel(
	userMessage: string,
	template: { currentTitle?: string; projectName?: string },
	registry: ModelRegistry,
	settings: Settings,
	sessionId?: string,
	currentModel?: Model<Api>,
): Promise<string | null> {
	const candidate = getTitleModel(registry, settings, currentModel);
	if (!candidate) {
		logger.debug("title-generator: no title model found");
		return null;
	}

	const apiKey = await registry.getApiKey(candidate.model, sessionId);
	if (!apiKey) {
		logger.debug("title-generator: no API key", {
			provider: candidate.model.provider,
			id: candidate.model.id,
		});
		return null;
	}

	const systemPrompt = prompt.render(titleSystemPrompt, template);
	const model = `${candidate.model.provider}/${candidate.model.id}`;
	logger.debug("title-generator: request", { model, userMessage });

	try {
		const response = await completeSimple(
			candidate.model,
			{
				systemPrompt,
				messages: [{ role: "user", content: userMessage, timestamp: Date.now() }],
			},
			{
				apiKey,
				maxTokens: 30,
				reasoning: toReasoningEffort(candidate.thinkingLevel),
			},
		);

		if (response.stopReason === "error") {
			logger.debug("title-generator: response error", { model, errorMessage: response.errorMessage });
			return null;
		}

		let title = "";
		for (const content of response.content) {
			if (content.type === "text") title += content.text;
		}

		logger.debug("title-generator: response", {
			model,
			title,
			usage: response.usage,
			stopReason: response.stopReason,
		});
		return cleanTitle(title);
	} catch (err) {
		logger.debug("title-generator: error", { model, error: err instanceof Error ? err.message : String(err) });
		return null;
	}
}

/**
 * Generate a title for a session based on the first user message.
 */
export async function generateSessionTitle(
	firstMessage: string,
	registry: ModelRegistry,
	settings: Settings,
	sessionId?: string,
	currentModel?: Model<Api>,
): Promise<string | null> {
	const truncated =
		firstMessage.length > MAX_INPUT_CHARS ? `${firstMessage.slice(0, MAX_INPUT_CHARS)}\u2026` : firstMessage;
	return callTitleModel(
		`<user-message>\n${truncated}\n</user-message>`,
		{},
		registry,
		settings,
		sessionId,
		currentModel,
	);
}

/**
 * Re-generate a session title from recent conversation messages.
 * Uses the same prompt but passes currentTitle and projectName as template context
 * so the model can decide whether the title still fits.
 */
export async function regenerateSessionTitle(
	recentUserMessages: string[],
	currentTitle: string | undefined,
	registry: ModelRegistry,
	settings: Settings,
	sessionId?: string,
	currentModel?: Model<Api>,
	projectName?: string,
): Promise<string | null> {
	const truncated = recentUserMessages
		.slice(-MAX_RECENT_MESSAGES)
		.map(m => (m.length > MAX_CHARS_PER_MESSAGE ? `${m.slice(0, MAX_CHARS_PER_MESSAGE)}\u2026` : m));
	const combined = truncated.join("\n---\n");
	if (!combined.trim()) return null;

	return callTitleModel(
		`<recent-messages>\n${combined}\n</recent-messages>`,
		{ currentTitle, projectName },
		registry,
		settings,
		sessionId,
		currentModel,
	);
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

export function formatSessionTerminalTitle(
	sessionName: string | undefined,
	cwd?: string,
	titleSource?: "auto" | "user" | undefined,
): string {
	const label =
		sanitizeTerminalTitlePart(titleSource === "auto" ? undefined : sessionName) ?? getFallbackTerminalTitle(cwd);
	return label ? `${DEFAULT_TERMINAL_TITLE}: ${label}` : DEFAULT_TERMINAL_TITLE;
}

/**
 * Set the terminal title using OSC 0 (sets both tab and window title). Unsupported terminals ignore it.
 */
export function setTerminalTitle(title: string): void {
	process.stdout.write(`\x1b]0;${sanitizeTerminalTitlePart(title) ?? DEFAULT_TERMINAL_TITLE}\x07`);
}

export function setSessionTerminalTitle(
	sessionName: string | undefined,
	cwd?: string,
	titleSource?: "auto" | "user" | undefined,
): void {
	setTerminalTitle(formatSessionTerminalTitle(sessionName, cwd, titleSource));
}

/**
 * Save the current terminal title on terminals that support xterm window ops.
 */
export function pushTerminalTitle(): void {
	process.stdout.write("\x1b[22;2t");
}

/**
 * Restore the previously saved terminal title on terminals that support xterm window ops.
 */
export function popTerminalTitle(): void {
	process.stdout.write("\x1b[23;2t");
}

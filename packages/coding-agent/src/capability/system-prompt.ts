/**
 * System Prompt Capability
 *
 * Literal SYSTEM.md files that modify the agent's base system prompt.
 * Distinct from context files and MOMP's separately owned SYSTEM.template.md discovery.
 */
import { defineCapability } from ".";
import type { SourceMeta } from "./types";

/**
 * A system prompt customization file.
 */
export interface SystemPrompt {
	/** Absolute path to the file */
	path: string;
	/** File content */
	content: string;
	/** Which level this came from */
	level: "user" | "project";
	/** Source metadata */
	_source: SourceMeta;
}

export const systemPromptCapability = defineCapability<SystemPrompt>({
	id: "system-prompt",
	displayName: "System Prompt",
	description: "Custom SYSTEM.md files that modify agent behavior",
	key: sp => sp.level,
	validate: sp => {
		if (!sp.path) return "Missing path";
		if (sp.content === undefined) return "Missing content";
		return undefined;
	},
});

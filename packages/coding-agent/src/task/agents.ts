/**
 * Bundled agent definitions.
 *
 * Agents are embedded at build time via Bun's import with { type: "text" }.
 */
import { Effort } from "@oh-my-pi/pi-ai";
import { getAgentDir, parseFrontmatter, prompt } from "@oh-my-pi/pi-utils";
import { parseAgentFields } from "../discovery/helpers";
// Embed agent markdown files at build time
import agentFrontmatterTemplate from "../prompts/agents/frontmatter.md" with { type: "text" };
import reviewerMd from "../prompts/agents/reviewer.md" with { type: "text" };
import scoutMd from "../prompts/agents/scout.md" with { type: "text" };
import securityReviewerMd from "../prompts/agents/security-reviewer.md" with { type: "text" };
import taskMd from "../prompts/agents/task.md" with { type: "text" };
import { resolveUserPromptSource } from "../prompts/user-prompt-source";
import { AUTO_THINKING } from "@oh-my-pi/pi-tui/thinking";

import type { AgentSource } from "@oh-my-pi/pi-tui/tools/task";
import type { AgentDefinition } from "./types";

interface AgentFrontmatter {
	name: string;
	description: string;
	tools?: string[];
	spawns?: string;
	model?: string | string[];
	thinkingLevel?: string;
	blocking?: boolean;
	prewalk?: boolean | string;
	advisor?: boolean | string;
}

interface EmbeddedAgentDef {
	fileName: string;
	frontmatter?: AgentFrontmatter;
	template: string;
	templateName?: string;
}

function buildAgentContent(def: EmbeddedAgentDef, agentDir?: string): { content: string; filePath: string } {
	const selected = agentDir
		? resolveUserPromptSource({
				agentDir,
				kind: "agent",
				name: def.templateName ?? def.fileName.slice(0, -3),
				bundledSource: def.template,
			})
		: { source: def.template, filePath: undefined };
	const body = prompt.render(selected.source);
	const filePath = selected.filePath ?? `embedded:${def.fileName}`;
	if (!def.frontmatter) return { content: body, filePath };
	const frontmatter = agentDir
		? resolveUserPromptSource({
				agentDir,
				kind: "agent",
				name: "frontmatter",
				bundledSource: agentFrontmatterTemplate,
			})
		: { source: agentFrontmatterTemplate, filePath: undefined };
	return {
		content: prompt.render(frontmatter.source, { ...def.frontmatter, body }),
		filePath: selected.filePath ?? frontmatter.filePath ?? filePath,
	};
}

const EMBEDDED_AGENT_DEFS: EmbeddedAgentDef[] = [
	{ fileName: "scout.md", template: scoutMd },
	{ fileName: "reviewer.md", template: reviewerMd },
	{ fileName: "security-reviewer.md", template: securityReviewerMd },
	{
		fileName: "task.md",
		frontmatter: {
			name: "task",
			description: "General-purpose subagent with full capabilities for delegated multi-step tasks",
			spawns: "*",
			model: "@task",
			thinkingLevel: AUTO_THINKING,
			// No `prewalk` frontmatter: the generic task hand-off (strong model
			// plans, then hands off to the smol role) is armed by the
			// `task.prewalk` setting (default off) or per agent via /agents
			// (task.agentPrewalk).
		},
		template: taskMd,
	},
	{
		fileName: "sonic.md",
		templateName: "task",
		frontmatter: {
			name: "sonic",
			description: "Low-reasoning agent for strictly mechanical updates or data collection only",
			model: "@smol",
			thinkingLevel: Effort.Medium,
		},
		template: taskMd,
	},
];

// Computed lazily on first loadBundledAgents() call to avoid eager prompt.render at module load.

export class AgentParsingError extends Error {
	constructor(
		error: Error,
		readonly source?: unknown,
	) {
		super(`Failed to parse agent: ${error.message}`, { cause: error });
		this.name = "AgentParsingError";
	}

	override toString(): string {
		const details: string[] = [this.message];
		if (this.source !== undefined) {
			details.push(`Source: ${JSON.stringify(this.source)}`);
		}
		if (this.cause && typeof this.cause === "object" && "stack" in this.cause && this.cause.stack) {
			details.push(`Stack:\n${this.cause.stack}`);
		} else if (this.stack) {
			details.push(`Stack:\n${this.stack}`);
		}
		return details.join("\n\n");
	}
}

/**
 * Parse an agent from embedded content.
 */
export function parseAgent(
	filePath: string,
	content: string,
	source: AgentSource,
	level: "fatal" | "warn" | "off" = "fatal",
): AgentDefinition {
	const { frontmatter, body } = parseFrontmatter(content, {
		location: filePath,
		level,
	});
	const fields = parseAgentFields(frontmatter);
	if (!fields) {
		throw new AgentParsingError(new Error(`Invalid agent field: ${filePath}\n${content}`), filePath);
	}
	return {
		...fields,
		systemPrompt: body,
		source,
		filePath,
	};
}

/** Cache for bundled agents */
let bundledAgentsCache: AgentDefinition[] | null = null;

/**
 * Load embedded defaults, optionally replacing their sources from a profile.
 * Only immutable embedded defaults are cached; profile edits are re-read on every discovery.
 */
export function loadBundledAgents(agentDir?: string): AgentDefinition[] {
	if (!agentDir && bundledAgentsCache !== null) {
		return bundledAgentsCache;
	}
	const agents = EMBEDDED_AGENT_DEFS.map(def => {
		const { content, filePath } = buildAgentContent(def, agentDir);
		const agent = parseAgent(filePath, content, "bundled");
		const expectedName = def.frontmatter?.name ?? def.fileName.slice(0, -3);
		if (agent.name !== expectedName || !agent.systemPrompt.trim()) {
			throw new AgentParsingError(new Error(`Expected non-empty agent ${expectedName}: ${filePath}`), filePath);
		}
		return agent;
	});
	if (!agentDir) bundledAgentsCache = agents;
	return agents;
}

/**
 * Get a built-in agent with the active profile's prompt overrides.
 */
export function getBundledAgent(name: string): AgentDefinition | undefined {
	return loadBundledAgents(getAgentDir()).find(a => a.name === name);
}

/**
 * Get all bundled agents as a map keyed by name.
 */
export function getBundledAgentsMap(): Map<string, AgentDefinition> {
	const map = new Map<string, AgentDefinition>();
	for (const agent of loadBundledAgents()) {
		map.set(agent.name, agent);
	}
	return map;
}

/**
 * Clear the bundled agents cache (for testing).
 */
export function clearBundledAgentsCache(): void {
	bundledAgentsCache = null;
}

// Re-export for backward compatibility
export const BUNDLED_AGENTS = loadBundledAgents;

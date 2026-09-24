import { Settings } from "../config/settings";
import { cfgTaskMaxRecursionDepth } from "./settings";
import type { ToolSession } from "../tools";
import { resolveEvalBackends } from "../tools/eval-backends";
import type { AgentDefinition } from "./types";

export interface ResolvedSubagentCapabilities {
	childDepth: number;
	atMaxDepth: boolean;
	toolNames?: string[];
	spawns: string;
}

export function resolveSubagentCapabilities(
	agent: AgentDefinition,
	settings: Settings,
	options: { parentDepth?: number } = {},
): ResolvedSubagentCapabilities {
	const childDepth = (options.parentDepth ?? 0) + 1;
	const maxRecursionDepth = cfgTaskMaxRecursionDepth.get(settings);
	const atMaxDepth = maxRecursionDepth >= 0 && childDepth >= maxRecursionDepth;

	let toolNames: string[] | undefined;
	if (agent.tools) {
		toolNames = agent.tools;
		if (agent.spawns !== undefined && !toolNames.includes("task") && !atMaxDepth) {
			toolNames = [...toolNames, "task"];
		}
	}
	if (atMaxDepth && toolNames?.includes("task")) {
		toolNames = toolNames.filter(name => name !== "task");
	}
	if (toolNames?.includes("exec")) {
		const backends = resolveEvalBackends({ settings } as ToolSession);
		const expanded = toolNames.filter(name => name !== "exec");
		if (backends.python || backends.js) expanded.push("eval");
		expanded.push("bash");
		toolNames = Array.from(new Set(expanded));
	}

	const spawns = atMaxDepth
		? ""
		: agent.spawns === undefined
			? ""
			: agent.spawns === "*"
				? "*"
				: agent.spawns.join(",");
	return { childDepth, atMaxDepth, toolNames, spawns };
}

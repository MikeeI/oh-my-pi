import { prompt } from "@oh-my-pi/pi-utils";
import subagentSystemPromptTemplate from "../prompts/system/subagent-system-prompt.md" with { type: "text" };
import type { SystemPromptTransform } from "../sdk";
import {
	type DynamicPromptPart,
	discoverSubagentBaseSystemPromptTemplate,
	discoverSubagentSystemPromptTemplate,
} from "../system-prompt";
import { normalizeSchema } from "../tools/jtd-to-json-schema";
import { shortenPath } from "@oh-my-pi/pi-tui/render/render-utils";
import type { WorkPoolYieldItem } from "./workpool-yield";

export interface SubagentIrcRoster {
	peers: Array<{
		id: string;
		displayName: string;
		kind: string;
		status: string;
		activity?: string;
	}>;
	parkedCount: number;
	omittedCount: number;
}

export interface SubagentSystemPromptInput {
	agent: string;
	context?: string;
	planReference?: { path: string; content: string };
	worktree?: string;
	outputSchema?: unknown;
	outputSchemaOverridesAgent?: boolean;
	workPoolYieldItems?: () => readonly WorkPoolYieldItem[];
	ircRoster?: () => SubagentIrcRoster;
	ircSelfId?: string;
}

export interface ResolvedSubagentSystemPrompt {
	systemPromptTemplate?: string;
	wrapperTemplatePath?: string;
	wrapperTemplate: string;
}

export async function resolveSubagentSystemPrompt(cwd: string): Promise<ResolvedSubagentSystemPrompt> {
	const systemPromptTemplate = discoverSubagentBaseSystemPromptTemplate(cwd);
	const wrapperTemplatePath = discoverSubagentSystemPromptTemplate(cwd);
	let wrapperTemplate = subagentSystemPromptTemplate;
	if (wrapperTemplatePath) {
		try {
			wrapperTemplate = await Bun.file(wrapperTemplatePath).text();
		} catch (error) {
			throw new Error(`Could not read subagent system prompt template: ${shortenPath(wrapperTemplatePath)}`, {
				cause: error,
			});
		}
		if (wrapperTemplate.replace(/^\uFEFF/, "").trim().length === 0) {
			throw new Error(`Subagent system prompt template is empty: ${shortenPath(wrapperTemplatePath)}`);
		}
	}

	// Warm revivers retain only these source bytes, not callbacks closing over the spawning run.
	return { systemPromptTemplate, wrapperTemplatePath, wrapperTemplate };
}

export function createSubagentSystemPromptTransform(
	resolved: ResolvedSubagentSystemPrompt,
	input: SubagentSystemPromptInput,
): SystemPromptTransform {
	const { normalized: outputSchema } = normalizeSchema(input.outputSchema);
	const source = resolved.wrapperTemplatePath ? "SUBAGENT-SYSTEM.template.md" : "subagent-system-prompt.md";

	return result => {
		const ircRoster = input.ircRoster?.();
		const wrapper = prompt.render(resolved.wrapperTemplate, {
			agent: input.agent,
			context: input.context?.trim() ?? "",
			planReference: input.planReference?.content ?? "",
			planReferencePath: input.planReference?.path ?? "",
			worktree: input.worktree ?? "",
			outputSchema,
			outputSchemaOverridesAgent: input.outputSchemaOverridesAgent === true,
			workPoolYieldItems: input.workPoolYieldItems?.() ?? [],
			ircPeers: ircRoster?.peers ?? [],
			ircParkedCount: ircRoster?.parkedCount ?? 0,
			ircOmittedCount: ircRoster?.omittedCount ?? 0,
			ircSelfId: input.ircSelfId ?? "",
		});
		// Per-spawn wrapper text follows the shared base and project blocks so Child prefixes remain cache-stable.
		const providerBlockIndex = result.systemPrompt.length;
		const wrapperPart: DynamicPromptPart = {
			id: "subagent-wrapper",
			source,
			providerBlockIndex,
			text: wrapper,
		};
		return {
			...result,
			systemPrompt: [...result.systemPrompt, wrapper],
			dynamicParts: [...result.dynamicParts, wrapperPart],
		};
	};
}

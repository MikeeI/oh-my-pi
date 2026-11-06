import { getAgentDir, prompt } from "@oh-my-pi/pi-utils";
import initMd from "../prompts/agents/init.md" with { type: "text" };
import { resolveUserPromptSource } from "../prompts/user-prompt-source";

export const EMBEDDED_COMMAND_TEMPLATES: ReadonlyArray<{ name: string; content: string }> = [
	{
		name: "init.md",
		content: prompt.render(
			resolveUserPromptSource({
				agentDir: getAgentDir(),
				kind: "agent",
				name: "init",
				bundledSource: initMd,
			}).source,
		),
	},
];

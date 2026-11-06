import { resolveUserPromptSource } from "./user-prompt-source";

export interface UserToolPromptSourceOptions {
	agentDir: string;
	toolName: string;
	bundledSource: string;
}

/** Resolve a profile-scoped tool prompt while retaining the bundled source as the sole default. */
export function resolveUserToolPromptSource(options: UserToolPromptSourceOptions): string {
	return resolveUserPromptSource({
		agentDir: options.agentDir,
		kind: "tool",
		name: options.toolName,
		bundledSource: options.bundledSource,
	}).source;
}

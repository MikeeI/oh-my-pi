import * as fs from "node:fs";
import * as path from "node:path";

const TOOL_PROMPT_EXTENSION = ".md";

export interface UserToolPromptSourceOptions {
	agentDir: string;
	toolName: string;
	bundledSource: string;
}

/** Resolve a profile-scoped tool prompt while retaining the bundled source as the sole default. */
export function resolveUserToolPromptSource(options: UserToolPromptSourceOptions): string {
	const overridePath = path.resolve(options.agentDir, `${options.toolName}${TOOL_PROMPT_EXTENSION}`);

	let stat: fs.Stats | undefined;
	try {
		stat = fs.statSync(overridePath, { throwIfNoEntry: false });
	} catch (error) {
		throw new Error(`Could not inspect ${options.toolName} tool prompt: ${overridePath}`, { cause: error });
	}
	if (!stat) return options.bundledSource;
	if (!stat.isFile()) {
		throw new Error(`${options.toolName} tool prompt path is not a regular file: ${overridePath}`);
	}

	let source: string;
	try {
		source = fs.readFileSync(overridePath, "utf8");
	} catch (error) {
		throw new Error(`Could not read ${options.toolName} tool prompt: ${overridePath}`, { cause: error });
	}
	if (source.trim().length === 0) {
		throw new Error(`${options.toolName} tool prompt must not be empty: ${overridePath}`);
	}
	return source;
}

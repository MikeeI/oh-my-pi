import * as fs from "node:fs";
import * as path from "node:path";
import { isEnoent } from "@oh-my-pi/pi-utils";

export interface UserPromptSourceOptions {
	agentDir: string;
	kind: "tool" | "agent";
	name: string;
	bundledSource: string;
}

export interface UserPromptSource {
	source: string;
	filePath?: string;
}

/** An absent override falls back; a selected but unusable file is a configuration error. */
export function resolveUserPromptSource(options: UserPromptSourceOptions): UserPromptSource {
	const overridePath = path.resolve(options.agentDir, "prompts", `${options.kind}s`, `${options.name}.md`);
	const label = `${options.name} ${options.kind} prompt`;

	let stat: fs.Stats | undefined;
	try {
		stat = fs.statSync(overridePath, { throwIfNoEntry: false });
		// A dangling symlink is configured, not absent; it must not silently select the fallback.
		if (!stat && isSymlink(overridePath)) {
			throw new Error(`Dangling prompt symlink: ${overridePath}`);
		}
	} catch (error) {
		throw new Error(`Could not inspect ${label}: ${overridePath}`, { cause: error });
	}
	if (!stat) return { source: options.bundledSource };
	if (!stat.isFile()) {
		throw new Error(`${label} path is not a regular file: ${overridePath}`);
	}

	let source: string;
	try {
		source = fs.readFileSync(overridePath, "utf8");
	} catch (error) {
		throw new Error(`Could not read ${label}: ${overridePath}`, { cause: error });
	}
	if (source.trim().length === 0) {
		throw new Error(`${label} must not be empty: ${overridePath}`);
	}
	return { source, filePath: overridePath };
}

/**
 * Whether `target` itself is a symlink, for a path `stat` already reported missing.
 * `readlink` instead of `lstat`: tool construction runs this on every absent override, and
 * upstream suites globally stub `fs.lstatSync` (Windows NTFS-stream cases) without its options.
 */
function isSymlink(target: string): boolean {
	try {
		fs.readlinkSync(target);
		return true;
	} catch (error) {
		if (isEnoent(error)) return false;
		throw error;
	}
}

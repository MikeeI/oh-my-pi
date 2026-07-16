/**
 * Inspect provider-facing system prompts.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { postmortem, setProjectDir } from "@oh-my-pi/pi-utils";
import { Args, Command, Flags, renderCommandHelp } from "@oh-my-pi/pi-utils/cli";
import { APP_DISPLAY_NAME } from "../app-version";
import { ModelRegistry } from "../config/model-registry";
import { buildDiscoveredSystemPromptOptions } from "../main";
import { type CreateAgentSessionResult, createAgentSession, discoverAuthStorage } from "../sdk";
import { SessionManager } from "../session/session-manager";
import type { BuildSystemPromptResult, DynamicPromptPart } from "../system-prompt";

const ACTIONS = ["inspect"] as const;
type SystemPromptAction = (typeof ACTIONS)[number];

interface ProviderBlock {
	index: number;
	text: string;
}

interface ProviderInspectJson {
	cwd: string;
	mode: "provider";
	blocks: ProviderBlock[];
}

interface DynamicInspectJson {
	cwd: string;
	mode: "dynamic-parts";
	blocks: DynamicPromptPart[];
}

export interface FormatInspectOptions {
	mode: "provider" | "dynamic-parts";
	json: boolean;
}

function renderProviderBlocks(blocks: string[]): string {
	return blocks.map((text, index) => `--- provider block ${index} ---\n${text}`).join("\n\n");
}

function renderDynamicParts(parts: DynamicPromptPart[]): string {
	return parts
		.map(part => `--- ${part.id} (${part.source}, provider block ${part.providerBlockIndex}) ---\n${part.text}`)
		.join("\n\n");
}

export function formatInspectOutput(
	cwd: string,
	result: BuildSystemPromptResult,
	options: FormatInspectOptions,
): string {
	if (options.mode === "dynamic-parts") {
		const output: DynamicInspectJson = { cwd, mode: "dynamic-parts", blocks: result.dynamicParts };
		return options.json ? `${JSON.stringify(output, null, 2)}\n` : `${renderDynamicParts(result.dynamicParts)}\n`;
	}
	const output: ProviderInspectJson = {
		cwd,
		mode: "provider",
		blocks: result.systemPrompt.map((text, index) => ({ index, text })),
	};
	return options.json ? `${JSON.stringify(output, null, 2)}\n` : `${renderProviderBlocks(result.systemPrompt)}\n`;
}

async function resolveCwd(cwdFlag: string | undefined): Promise<string> {
	const cwd = path.resolve(cwdFlag ?? process.cwd());
	const stat = await fs.stat(cwd).catch((error: unknown) => {
		throw new Error(`Invalid --cwd: ${cwd} does not exist`, { cause: error });
	});
	if (!stat.isDirectory()) {
		throw new Error(`Invalid --cwd: ${cwd} is not a directory`);
	}
	return cwd;
}
export async function inspectSystemPrompt(cwd: string): Promise<BuildSystemPromptResult> {
	setProjectDir(cwd);
	const systemPromptOptions = await buildDiscoveredSystemPromptOptions({ cwd });
	const authStorage = await discoverAuthStorage();
	const modelRegistry = new ModelRegistry(authStorage);
	let result: CreateAgentSessionResult | undefined;
	try {
		result = await createAgentSession({
			cwd,
			authStorage,
			modelRegistry,
			hasUI: false,
			sessionManager: SessionManager.inMemory(cwd),
			...systemPromptOptions,
		});
		if (!result.systemPromptResult) {
			throw new Error("System prompt inspection did not produce prompt metadata");
		}
		return result.systemPromptResult;
	} finally {
		await result?.session.dispose();
		await result?.mcpManager?.disconnectAll();
		authStorage.close();
	}
}

export default class SystemPrompt extends Command {
	static description = "Inspect provider-facing system prompts";

	static args = {
		action: Args.string({
			description: "System prompt action",
			required: false,
			options: [...ACTIONS],
		}),
	};

	static flags = {
		cwd: Flags.string({ description: "Project directory to inspect" }),
		"dynamic-parts": Flags.boolean({ description: "Output dynamic prompt parts only" }),
		provider: Flags.boolean({ description: "Output complete provider-facing prompt blocks" }),
		json: Flags.boolean({ description: "Output JSON" }),
	};

	static examples = [
		`# Inspect provider-facing blocks\n  ${APP_DISPLAY_NAME} system-prompt inspect --cwd /root/projects/project-paperless-go-classifier`,
		`# Inspect dynamic prompt parts\n  ${APP_DISPLAY_NAME} system-prompt inspect --cwd /root/projects/project-paperless-go-classifier --dynamic-parts`,
		`# Inspect dynamic prompt parts as JSON\n  ${APP_DISPLAY_NAME} system-prompt inspect --cwd /root/projects/project-paperless-go-classifier --dynamic-parts --json`,
	];

	async run(): Promise<void> {
		const { args, flags } = await this.parse(SystemPrompt);
		const action = args.action as SystemPromptAction | undefined;
		if (!action) {
			renderCommandHelp(APP_DISPLAY_NAME, "system-prompt", SystemPrompt);
			return;
		}
		if (action !== "inspect") {
			throw new Error(`Unsupported system-prompt action: ${action}`);
		}
		if (flags.provider && flags["dynamic-parts"]) {
			throw new Error("Use either --provider or --dynamic-parts, not both");
		}

		const cwd = await resolveCwd(flags.cwd);
		const result = await inspectSystemPrompt(cwd);
		const mode = flags["dynamic-parts"] ? "dynamic-parts" : "provider";
		process.stdout.write(formatInspectOutput(cwd, result, { mode, json: flags.json === true }));
		await postmortem.quit(0);
	}
}

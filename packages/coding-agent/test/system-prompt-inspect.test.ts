import { describe, expect, test } from "bun:test";
import type { CliConfig } from "@oh-my-pi/pi-utils/cli";
import SystemPromptCommand, { formatInspectOutput } from "../src/commands/system-prompt";
import { buildSystemPrompt, type DynamicPromptPart, type SystemPromptToolMetadata } from "../src/system-prompt";

const TEST_CONFIG: CliConfig = {
	bin: "omp",
	version: "0.0.0-test",
	commands: new Map(),
};

const tools = new Map<string, SystemPromptToolMetadata>([
	["read", { wireName: "read", label: "Read", description: "Read files" }],
	["lsp", { wireName: "lsp", label: "LSP", description: "Language server" }],
	["task", { wireName: "task", label: "Task", description: "Subagents" }],
]);

function part(parts: DynamicPromptPart[], id: string): DynamicPromptPart {
	const found = parts.find(p => p.id === id);
	expect(found).toBeDefined();
	return found!;
}

describe("system prompt inspect metadata", () => {
	test("collects dynamic parts without exposing native static prompt text", async () => {
		const result = await buildSystemPrompt({
			cwd: "/tmp/inspect-project",
			tools,
			toolNames: ["read", "lsp", "task"],
			skills: [
				{
					name: "skill-a",
					description: "Skill A",
					filePath: "/tmp/skill-a/SKILL.md",
					baseDir: "/tmp/skill-a",
					source: "native:user",
				},
			],
			rules: [{ name: "rule-a", description: "Rule A", path: "rule://rule-a", globs: ["**/*.ts"] }],
			alwaysApplyRules: [{ name: "always-a", content: "Always rule body", path: "rule://always-a" }],
			contextFiles: [{ path: "/tmp/inspect-project/AGENTS.md", content: "Agent context" }],
			workspaceTree: {
				rootPath: "/tmp/inspect-project",
				rendered: ".\n  - package.json",
				truncated: false,
				totalLines: 2,
				agentsMdFiles: ["nested/AGENTS.md"],
			},
			includeWorkspaceTree: true,
			appendSystemPrompt: "Memory text\n\nMCP text",
			appendSystemPromptParts: [
				{ id: "memory-instructions", source: "memory", text: "Memory text" },
				{ id: "mcp-server-instructions", source: "mcp", text: "MCP text" },
				{ id: "auto-learn-instructions", source: "auto-learn", text: "Auto-learn text" },
			],
			eagerTasks: true,
		});

		expect(result.systemPrompt.length).toBe(2);
		expect(part(result.dynamicParts, "skills").text).toContain("skill-a: Skill A");
		expect(part(result.dynamicParts, "rules").text).toContain("rule-a");
		expect(part(result.dynamicParts, "always-apply-rules").text).toContain("Always rule body");
		expect(part(result.dynamicParts, "context-files").text).toContain("Agent context");
		expect(part(result.dynamicParts, "workspace-tree").text).toContain("package.json");
		expect(part(result.dynamicParts, "memory-instructions").source).toBe("memory");
		expect(part(result.dynamicParts, "mcp-server-instructions").source).toBe("mcp");
		expect(part(result.dynamicParts, "auto-learn-instructions").source).toBe("auto-learn");
		expect(result.dynamicParts.every(p => !p.text.includes("You are THE staff engineer"))).toBe(true);
	});

	test("does not attribute static custom prompt text as dynamic", async () => {
		const result = await buildSystemPrompt({
			cwd: "/tmp/inspect-project",
			customPrompt: "Static custom SYSTEM body",
			tools,
			toolNames: ["read", "lsp"],
			contextFiles: [],
			workspaceTree: {
				rootPath: "/tmp/inspect-project",
				rendered: "",
				truncated: false,
				totalLines: 0,
				agentsMdFiles: [],
			},
		});

		expect(result.systemPrompt[0]).toContain("Static custom SYSTEM body");
		expect(result.dynamicParts.every(p => p.source !== "system-prompt.md")).toBe(true);
		expect(result.dynamicParts.every(p => !p.text.includes("Static custom SYSTEM body"))).toBe(true);
	});
});

describe("system-prompt inspect output", () => {
	const result = {
		systemPrompt: ["System block", "Project block"],
		dynamicParts: [
			{
				id: "append-system-prompt",
				source: "append-system-prompt" as const,
				providerBlockIndex: 2,
				text: "Append text",
			},
		],
	};

	test("system-prompt inspect --json exposes provider blocks", () => {
		const parsed = JSON.parse(formatInspectOutput("/tmp/project", result, { mode: "provider", json: true }));
		expect(parsed).toEqual({
			cwd: "/tmp/project",
			mode: "provider",
			blocks: [
				{ index: 0, text: "System block" },
				{ index: 1, text: "Project block" },
			],
		});
	});

	test("system-prompt inspect --dynamic-parts --json exposes provider block indexes", () => {
		const parsed = JSON.parse(formatInspectOutput("/tmp/project", result, { mode: "dynamic-parts", json: true }));
		expect(parsed).toEqual({
			cwd: "/tmp/project",
			mode: "dynamic-parts",
			blocks: result.dynamicParts,
		});
	});
});

describe("system-prompt command", () => {
	test("parses inspect flags", async () => {
		const command = new SystemPromptCommand(["inspect", "--cwd", "/tmp", "--dynamic-parts", "--json"], TEST_CONFIG);
		const parsed = await command.parse(SystemPromptCommand);
		expect(parsed.args.action).toBe("inspect");
		expect(parsed.flags.cwd).toBe("/tmp");
		expect(parsed.flags["dynamic-parts"]).toBe(true);
		expect(parsed.flags.json).toBe(true);
	});

	test("--provider combined with --dynamic-parts throws", async () => {
		const command = new SystemPromptCommand(["inspect", "--provider", "--dynamic-parts"], TEST_CONFIG);
		await expect(command.run()).rejects.toThrow("Use either --provider or --dynamic-parts, not both");
	});
});

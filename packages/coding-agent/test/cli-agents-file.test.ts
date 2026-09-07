import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { parseArgs } from "@oh-my-pi/pi-coding-agent/cli/args";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { runRootCommand } from "@oh-my-pi/pi-coding-agent/main";
import type { CreateAgentSessionOptions } from "@oh-my-pi/pi-coding-agent/sdk";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { loadProjectContextFiles, resolveSystemPromptTemplatePath } from "@oh-my-pi/pi-coding-agent/system-prompt";
import { TempDir } from "@oh-my-pi/pi-utils";

describe("parseArgs — process-scoped prompt file flags", () => {
	it("parses spaced and equals values without leaking them into messages", () => {
		const spaced = parseArgs([
			"--system-template",
			"SYSTEM.strict.template.md",
			"--agents-file",
			"strict.md",
			"hello",
		]);
		const equals = parseArgs(["--system-template=SYSTEM.minimal.template.md", "--agents-file=minimal.md", "hello"]);

		expect(spaced.systemTemplate).toBe("SYSTEM.strict.template.md");
		expect(spaced.agentsFile).toBe("strict.md");
		expect(spaced.messages).toEqual(["hello"]);
		expect(equals.systemTemplate).toBe("SYSTEM.minimal.template.md");
		expect(equals.agentsFile).toBe("minimal.md");
		expect(equals.messages).toEqual(["hello"]);
	});

	it("keeps an @-prefixed path as the flag value", () => {
		const parsed = parseArgs(["--agents-file", "@fixtures/strict.md", "hello"]);

		expect(parsed.agentsFile).toBe("@fixtures/strict.md");
		expect(parsed.fileArgs).toEqual([]);
		expect(parsed.messages).toEqual(["hello"]);
	});

	it("preserves explicit empty values for strict resolution", () => {
		const agents = parseArgs(["--agents-file=", "hello"]);
		const template = parseArgs(["--system-template=", "hello"]);

		expect(agents.agentsFile).toBe("");
		expect(agents.messages).toEqual(["hello"]);
		expect(template.systemTemplate).toBe("");
		expect(template.messages).toEqual(["hello"]);
	});

	it("rejects missing values and conflicting block-zero overrides", () => {
		expect(() => parseArgs(["--agents-file"])).toThrow("--agents-file requires a value");
		expect(() => parseArgs(["--system-template"])).toThrow("--system-template requires a value");
		expect(() => parseArgs(["--system-prompt", "raw", "--system-template", "template.md"])).toThrow(
			"--system-prompt cannot be combined with --system-template",
		);
	});

	it("forwards the exact values into session creation", async () => {
		using tempDir = TempDir.createSync("@omp-prompt-files-");
		const authStorage = await AuthStorage.create(path.join(tempDir.path(), "auth.db"));
		const settings = Settings.isolated({ "marketplace.autoUpdate": "off" });
		let observedOptions: CreateAgentSessionOptions | undefined;
		const agentsValue = "./fixtures/strict.md";
		const templateValue = path.join(tempDir.path(), "SYSTEM.test.template.md");
		await Bun.write(templateValue, "Test {{cwd}}");
		const parsed = parseArgs(["--system-template", templateValue, "--agents-file", agentsValue, "--print", "hello"]);
		parsed.noExtensions = true;
		parsed.noSkills = true;
		parsed.noRules = true;
		parsed.noTools = true;
		parsed.noLsp = true;
		parsed.sessionDir = tempDir.path();

		try {
			await runRootCommand(
				parsed,
				["--system-template", templateValue, "--agents-file", agentsValue, "--print", "hello"],
				{
					discoverAuthStorage: async () => authStorage,
					settings,
					createAgentSession: async options => {
						observedOptions = options;
						throw new Error("stop after session options");
					},
				},
			);
		} catch (error) {
			if (!(error instanceof Error) || error.message !== "stop after session options") throw error;
		} finally {
			authStorage.close();
		}

		expect(observedOptions?.systemPromptTemplate).toBe(templateValue);
		expect(observedOptions?.userAgentsFile).toBe(agentsValue);
	});

	it("rejects explicit empty paths during strict resolution", async () => {
		using tempDir = TempDir.createSync("@omp-prompt-files-empty-");

		await expect(loadProjectContextFiles({ cwd: tempDir.path(), userAgentsFile: "" })).rejects.toThrow(
			"--agents-file requires a non-empty path",
		);
		await expect(resolveSystemPromptTemplatePath("", tempDir.path())).rejects.toThrow(
			"--system-template requires a non-empty path",
		);
		await expect(resolveSystemPromptTemplatePath("missing.template.md", tempDir.path())).rejects.toThrow(
			`System template not found: ${path.join(tempDir.path(), "missing.template.md")}`,
		);
	});
});

import { describe, expect, it } from "bun:test";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { ReadTool } from "@oh-my-pi/pi-coding-agent/tools/read";
import { BashTool } from "@oh-my-pi/pi-coding-agent/tools/bash";
import { EvalTool } from "@oh-my-pi/pi-coding-agent/tools/eval";
import { TaskTool } from "@oh-my-pi/pi-coding-agent/task";
import { LspTool } from "@oh-my-pi/pi-coding-agent/lsp/tool";
import { WebSearchTool } from "@oh-my-pi/pi-coding-agent/web/search";
import { TempDir } from "@oh-my-pi/pi-utils";

const MISSING_AGENT_DIR = path.join(os.tmpdir(), `omp-tool-prompt-missing-${process.pid}`);

function createSession(agentDir: string = MISSING_AGENT_DIR): ToolSession {
	const settings = Settings.isolated();
	Object.defineProperty(settings, "getAgentDir", { value: () => agentDir });
	return {
		cwd: process.cwd(),
		hasUI: false,
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		settings,
	};
}

describe("profile-scoped tool prompts", () => {
	it("renders a profile-scoped read.md instead of the bundled prompt", async () => {
		using tempDir = TempDir.createSync("@omp-read-prompt-");
		await Bun.write(
			tempDir.join("prompts", "tools", "read.md"),
			"CUSTOM_READ {{#if IS_HL_MODE}}hash{{else}}plain{{/if}}",
		);

		const description = new ReadTool(createSession(tempDir.path())).description;

		expect(description).toBe("CUSTOM_READ hash");
	});

	it("rejects an empty selected read.md instead of silently using the bundled prompt", async () => {
		using tempDir = TempDir.createSync("@omp-read-prompt-empty-");
		await Bun.write(tempDir.join("prompts", "tools", "read.md"), " \n");

		expect(() => new ReadTool(createSession(tempDir.path()))).toThrow("read tool prompt must not be empty");
	});

	it("uses the bundled prompt when profile read.md is absent", () => {
		const description = new ReadTool(createSession()).description;

		expect(description).toContain("Use `read` for static web");
	});

	it("renders a profile-scoped bash.md instead of the bundled prompt", async () => {
		using tempDir = TempDir.createSync("@omp-bash-prompt-");
		await Bun.write(
			tempDir.join("prompts", "tools", "bash.md"),
			"CUSTOM_BASH threshold={{autoBackgroundThresholdSeconds}}",
		);

		const description = new BashTool(createSession(tempDir.path())).description;

		expect(description).toBe("CUSTOM_BASH threshold=60");
	});

	it("uses the bundled Bash prompt when profile bash.md is absent", () => {
		const description = new BashTool(createSession()).description;

		expect(description).toContain("Long-lived services: unique name");
	});

	it("renders task.md with the current Task variables and falls back when absent", async () => {
		using tempDir = TempDir.createSync("@omp-task-prompt-");
		await Bun.write(
			tempDir.join("prompts", "tools", "task.md"),
			"CUSTOM_TASK agent={{defaultAgent}} batch={{batchEnabled}}",
		);

		const overridden = await TaskTool.create(createSession(tempDir.path()));
		expect(overridden.description).toBe("CUSTOM_TASK agent=task batch=true");

		const bundled = await TaskTool.create(createSession());
		expect(bundled.description).toContain("write agent://<id>");
	});

	it("rejects an empty selected task.md instead of using the bundled prompt", async () => {
		using tempDir = TempDir.createSync("@omp-task-prompt-empty-");
		await Bun.write(tempDir.join("prompts", "tools", "task.md"), " \n");

		const task = await TaskTool.create(createSession(tempDir.path()));
		expect(() => task.description).toThrow("task tool prompt must not be empty");
	});
	it("uses profile-scoped LSP prompt with bundled fallback", async () => {
		using tempDir = TempDir.createSync("@omp-lsp-prompt-");
		await Bun.write(tempDir.join("prompts", "tools", "lsp.md"), "CUSTOM_LSP");

		expect(new LspTool(createSession(tempDir.path())).description).toBe("CUSTOM_LSP");
		expect(new LspTool(createSession()).description).toContain("Symbol-aware code intelligence");
	});
	it("renders a profile-scoped eval.md using live Eval variables and falls back when absent", async () => {
		using tempDir = TempDir.createSync("@omp-eval-prompt-");
		await Bun.write(tempDir.join("prompts", "tools", "eval.md"), "CUSTOM_EVAL {{#if js}}js{{/if}}");

		expect(new EvalTool(createSession(tempDir.path())).description).toBe("CUSTOM_EVAL js");
		expect(new EvalTool(createSession()).description).toContain("One cell per call");
	});

	it("uses a profile-scoped web-search.md instead of the bundled guidance", async () => {
		using tempDir = TempDir.createSync("@omp-web-search-prompt-");
		await Bun.write(tempDir.join("prompts", "tools", "web-search.md"), "CUSTOM_WEB_SEARCH");

		expect(new WebSearchTool(createSession(tempDir.path())).description).toBe("CUSTOM_WEB_SEARCH");
		expect(new WebSearchTool(createSession()).description).toContain("Known URLs/programmatic data");
	});
});

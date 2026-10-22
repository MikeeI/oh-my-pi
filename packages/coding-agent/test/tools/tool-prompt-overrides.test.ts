import { describe, expect, it } from "bun:test";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { ReadTool } from "@oh-my-pi/pi-coding-agent/tools/read";
import { BashTool } from "@oh-my-pi/pi-coding-agent/tools/bash";
import { GlobTool } from "@oh-my-pi/pi-coding-agent/tools/glob";
import { EvalTool, getEvalDocTopics, getEvalToolDescription } from "@oh-my-pi/pi-coding-agent/tools/eval";
import { EditTool } from "@oh-my-pi/pi-coding-agent/edit";
import { MemoryReflectTool } from "@oh-my-pi/pi-coding-agent/tools/memory-reflect";
import { SecurityScanTool } from "@oh-my-pi/pi-coding-agent/tools/security-scan";
import { WriteTool } from "@oh-my-pi/pi-coding-agent/tools/write";
import { TaskTool } from "@oh-my-pi/pi-coding-agent/task";
import { LspTool } from "@oh-my-pi/pi-coding-agent/lsp/tool";
import { WebSearchTool } from "@oh-my-pi/pi-coding-agent/web/search";
import { TempDir } from "@oh-my-pi/pi-utils";
import { createInMemoryAuthStorage } from "../helpers/agent-session-setup";

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
		await Bun.write(tempDir.join("prompts", "tools", "bash.md"), "CUSTOM_BASH threshold={{autoBackgroundSeconds}}");

		const description = new BashTool(createSession(tempDir.path())).description;

		expect(description).toBe("CUSTOM_BASH threshold=60");
	});

	it("uses the bundled Bash prompt when profile bash.md is absent", () => {
		const description = new BashTool(createSession()).description;

		expect(description).toContain("Long-lived services: unique name");
	});

	it("refreshes a memoized Glob override and rejects a selected source that becomes empty", async () => {
		using tempDir = TempDir.createSync("@omp-glob-prompt-");
		const source = tempDir.join("prompts", "tools", "glob.md");
		await Bun.write(source, "CUSTOM_GLOB {{#if eagerDelegation}}eager{{/if}}");
		const tool = new GlobTool(createSession(tempDir.path()));
		expect(tool.description).toBe("CUSTOM_GLOB eager");
		await Bun.write(source, "UPDATED_GLOB {{#if eagerDelegation}}eager{{/if}}");
		expect(tool.description).toBe("UPDATED_GLOB eager");
		await Bun.write(source, " \n");
		expect(() => tool.description).toThrow("glob tool prompt must not be empty");
		expect(new GlobTool(createSession()).description).toContain("Glob files/dirs");
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

	it("isolates selected Web Search sources while freezing each tool's auth-dependent guidance", async () => {
		using firstProfile = TempDir.createSync("@omp-web-search-prompt-");
		using secondProfile = TempDir.createSync("@omp-web-search-profile-");
		await Bun.write(
			firstProfile.join("prompts", "tools", "web-search.md"),
			"CUSTOM_WEB_SEARCH {{#if xSearch}}X{{else}}web{{/if}}",
		);
		await Bun.write(
			secondProfile.join("prompts", "tools", "web-search.md"),
			"SECOND_PROFILE {{#if xSearch}}X{{else}}web{{/if}}",
		);
		const authStorage = createInMemoryAuthStorage();
		try {
			authStorage.keys.setRuntime("xai", "test-key");
			const modelRegistry = new ModelRegistry(authStorage);
			const first = new WebSearchTool({ ...createSession(firstProfile.path()), modelRegistry });
			const second = new WebSearchTool({ ...createSession(secondProfile.path()), modelRegistry });
			expect(first.description).toBe("CUSTOM_WEB_SEARCH X");
			expect(second.description).toBe("SECOND_PROFILE X");
			authStorage.keys.removeRuntime("xai");
			expect(first.description).toBe("CUSTOM_WEB_SEARCH X");
			expect(new WebSearchTool(createSession(firstProfile.path())).description).toBe("CUSTOM_WEB_SEARCH web");
			expect(new WebSearchTool(createSession()).description).toContain("Known URLs/programmatic data");
		} finally {
			authStorage.close();
		}
	});
	it("selects profile-scoped Eval agent docs for linked and inline topics without bypassing spawn restrictions", async () => {
		using firstProfile = TempDir.createSync("@omp-eval-agent-prompt-");
		using secondProfile = TempDir.createSync("@omp-eval-agent-other-");
		const selectedPath = firstProfile.join("prompts", "tools", "eval-agents.md");
		await Bun.write(selectedPath, "FIRST {{spawnDefaultAgent}} {{#if js}}js{{else}}py{{/if}}");
		await Bun.write(secondProfile.join("prompts", "tools", "eval-agents.md"), "SECOND {{spawnDefaultAgent}}");
		const options = {
			agentDir: firstProfile.path(),
			py: false,
			js: true,
			spawns: "reviewer,task",
			inlineTopics: true,
		};
		expect(getEvalDocTopics(options).agents).toBe("FIRST reviewer js");
		expect(getEvalToolDescription(options)).toContain("FIRST reviewer js");
		expect(getEvalDocTopics({ ...options, agentDir: secondProfile.path() }).agents).toBe("SECOND reviewer");
		expect(getEvalDocTopics({ ...options, agentDir: MISSING_AGENT_DIR }).agents).toBe(
			getEvalDocTopics({ py: false, js: true, spawns: "reviewer,task" }).agents,
		);
		await Bun.write(selectedPath, " \n");
		expect(getEvalDocTopics({ ...options, spawns: false }).agents).toBeUndefined();
		expect(() => getEvalDocTopics(options)).toThrow("eval-agents tool prompt must not be empty");
		expect(getEvalDocTopics({ ...options, agentDir: secondProfile.path() }).agents).toBe("SECOND reviewer");
	});

	const additionalSources = [
		{
			name: "restricted Write",
			file: "write-device-only.md",
			create: (session: ToolSession) => new WriteTool({ ...session, deviceOnlyWrite: true }),
		},
		{
			name: "Replace",
			file: "replace.md",
			create: (session: ToolSession) => new EditTool(session, "replace"),
		},
		{
			name: "Sloppy",
			file: "sloppy.md",
			create: (session: ToolSession) => new EditTool(session, "sloppy"),
		},
		{
			name: "Security Scan",
			file: "security-scan.md",
			create: (session: ToolSession) => new SecurityScanTool(session),
		},
		{
			name: "Reflect",
			file: "reflect.md",
			create: (session: ToolSession) => new MemoryReflectTool(session),
		},
	];

	// Each consumer owns a distinct description boundary; strict selection must
	// survive profile changes and a selected file becoming invalid.
	for (const source of additionalSources) {
		it(`${source.name} isolates profile overrides and rejects an invalid selected source`, async () => {
			using firstProfile = TempDir.createSync("@omp-extra-tool-prompt-");
			using secondProfile = TempDir.createSync("@omp-extra-tool-other-");
			const selectedPath = firstProfile.join("prompts", "tools", source.file);
			await Bun.write(selectedPath, "FIRST_PROFILE");
			await Bun.write(secondProfile.join("prompts", "tools", source.file), "SECOND_PROFILE");
			const first = source.create(createSession(firstProfile.path()));
			const second = source.create(createSession(secondProfile.path()));
			expect(first.description).toBe("FIRST_PROFILE");
			expect(second.description).toBe("SECOND_PROFILE");
			const absent = source.create(createSession(firstProfile.join("missing")));
			expect(absent.description).toBe(source.create(createSession()).description);
			await Bun.write(selectedPath, " \n");
			expect(() => first.description).toThrow(`${source.file.slice(0, -3)} tool prompt must not be empty`);
			expect(second.description).toBe("SECOND_PROFILE");
		});
	}
});

import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { TaskTool, refreshAgentDiscovery } from "@oh-my-pi/pi-coding-agent/task";
import { loadBundledAgents } from "@oh-my-pi/pi-coding-agent/task/agents";
import { discoverAgents } from "@oh-my-pi/pi-coding-agent/task/discovery";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { TempDir } from "@oh-my-pi/pi-utils";

function createSession(cwd: string, agentDir: string): ToolSession {
	const settings = Settings.isolated();
	Object.defineProperty(settings, "getAgentDir", { value: () => agentDir });
	return { cwd, settings, hasUI: false, getSessionFile: () => null, getSessionSpawns: () => "*" };
}

const SCOUT_OVERRIDE = "---\nname: scout\ndescription: Profile scout\ntools: read\n---\nProfile scout policy.\n";

describe("profile-scoped agent prompts", () => {
	it("isolates advertised profiles, refreshes edits, and preserves project precedence", async () => {
		using temp = TempDir.createSync("omp-agent-prompt-");
		const cwd = temp.join("project");
		const firstProfile = temp.join("first");
		const secondProfile = temp.join("second");
		await fs.mkdir(cwd);
		await Bun.write(temp.join("first", "prompts", "agents", "scout.md"), SCOUT_OVERRIDE);
		const first = await TaskTool.create(createSession(cwd, firstProfile));
		const second = await TaskTool.create(createSession(cwd, secondProfile));
		expect(first.description).toContain("Profile scout");
		expect(second.description).not.toContain("Profile scout");

		await Bun.write(
			temp.join("first", "prompts", "agents", "scout.md"),
			SCOUT_OVERRIDE.replaceAll("Profile scout", "Revised scout"),
		);
		await refreshAgentDiscovery(cwd, undefined, firstProfile);
		expect(first.description).toContain("Revised scout");
		expect(second.description).not.toContain("Revised scout");
		const fresh = await discoverAgents(cwd, temp.path(), undefined, firstProfile);
		expect(fresh.agents.find(agent => agent.name === "scout")?.systemPrompt).toContain("Revised scout policy.");

		await Bun.write(
			temp.join("project", ".omp", "agents", "scout.md"),
			SCOUT_OVERRIDE.replaceAll("Profile", "Project"),
		);
		const project = await discoverAgents(cwd, temp.path(), undefined, firstProfile);
		expect(project.agents.find(agent => agent.name === "scout")?.systemPrompt).toContain("Project scout policy.");
	});

	it("renders the shared Task/Sonic body with distinct frontmatter and restores missing overrides", async () => {
		using temp = TempDir.createSync("omp-agent-render-");
		const bodyPath = temp.join("prompts", "agents", "task.md");
		await Bun.write(bodyPath, "Shared profile worker.");
		await Bun.write(
			temp.join("prompts", "agents", "frontmatter.md"),
			"---\nname: {{name}}\ndescription: Profile {{name}}\nmodel: {{jsonStringify model}}\n---\n{{body}}",
		);
		const agents = loadBundledAgents(temp.path());
		const task = agents.find(agent => agent.name === "task");
		const sonic = agents.find(agent => agent.name === "sonic");
		expect(task?.description).toBe("Profile task");
		expect(sonic?.description).toBe("Profile sonic");
		expect(task?.systemPrompt).toBe(sonic?.systemPrompt);
		expect(task?.systemPrompt).toContain("Shared profile worker.");
		expect(task?.model).toEqual(["@task"]);
		expect(sonic?.model).toEqual(["@smol"]);
		await fs.rm(bodyPath);
		expect(loadBundledAgents(temp.path()).find(agent => agent.name === "task")?.systemPrompt).toBe(
			loadBundledAgents().find(agent => agent.name === "task")?.systemPrompt,
		);
	});

	it("fails discovery instead of silently replacing an invalid selected override", async () => {
		using temp = TempDir.createSync("omp-agent-invalid-");
		const overridePath = temp.join("prompts", "agents", "scout.md");
		await Bun.write(overridePath, " \n");
		await expect(discoverAgents(temp.path(), temp.path(), undefined, temp.path())).rejects.toThrow(
			"must not be empty",
		);
		await Bun.write(overridePath, SCOUT_OVERRIDE.replace("name: scout", "name: renamed"));
		await expect(discoverAgents(temp.path(), temp.path(), undefined, temp.path())).rejects.toThrow(
			"Expected non-empty agent scout",
		);
		await fs.rm(overridePath);
		await fs.symlink(temp.join("missing.md"), overridePath);
		await expect(discoverAgents(temp.path(), temp.path(), undefined, temp.path())).rejects.toThrow(
			"Could not inspect scout agent prompt",
		);
	});
});

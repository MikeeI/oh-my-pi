import { afterEach, describe, expect, test } from "bun:test";
import { toolWireSchema } from "@oh-my-pi/pi-ai";
import { renderToolExamples } from "@oh-my-pi/pi-ai/dialect";
import { AsyncJobManager } from "@oh-my-pi/pi-coding-agent/async";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { createTools, type Tool, type ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { HubTool } from "@oh-my-pi/pi-coding-agent/tools/hub";

const COORDINATION_OPS = ["send", "wait", "inbox", "list", "jobs", "cancel"] as const;
const PROCESS_OPS = ["start", "ps", "logs", "stop", "restart", "describe"] as const;
const PROCESS_FIELDS = [
	"name",
	"application",
	"args",
	"env",
	"cwd",
	"pty",
	"ready",
	"restart",
	"persist",
	"detached",
	"lines",
	"head",
	"grep",
	"follow",
	"cursor",
	"for",
	"pattern",
	"text",
	"enter",
	"keys",
	"signal",
	"timeout",
] as const;

const managers: AsyncJobManager[] = [];

function createManager(): AsyncJobManager {
	const manager = new AsyncJobManager({ onJobComplete: () => {} });
	managers.push(manager);
	return manager;
}

function createSession(settings: Settings): ToolSession {
	return {
		cwd: import.meta.dir,
		hasUI: false,
		settings,
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		getAgentId: () => "Main",
		asyncJobManager: createManager(),
		enableIrc: true,
	};
}

function requireTool(tools: readonly Tool[], name: string): Tool {
	const tool = tools.find(candidate => candidate.name === name);
	if (!tool) throw new Error(`Expected ${name} tool`);
	return tool;
}

function asSchemaObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected schema object");
	return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value) || !value.every(item => typeof item === "string")) {
		throw new Error("Expected string array");
	}
	return value;
}

function schemaParts(tool: Tool): { operations: string[]; properties: Record<string, unknown> } {
	const schema = toolWireSchema(tool);
	const properties = asSchemaObject(schema.properties);
	const op = asSchemaObject(properties.op);
	return { operations: asStringArray(op.enum), properties };
}

afterEach(async () => {
	for (const manager of managers.splice(0)) await manager.dispose({ timeoutMs: 200 });
});

describe("Hub process-supervision capability", () => {
	test("keeps coordination live while process metadata follows launch.enabled", async () => {
		const settings = Settings.isolated({ "launch.enabled": false, "tools.xdev": false });
		const tools = await createTools(createSession(settings), ["bash", "hub"]);
		const hub = requireTool(tools, "hub");
		const bash = requireTool(tools, "bash");

		const disabled = schemaParts(hub);
		expect(disabled.operations.toSorted()).toEqual([...COORDINATION_OPS].toSorted());
		expect(PROCESS_FIELDS.filter(field => field in disabled.properties)).toEqual([]);
		expect(hub.summary).toBe("Message peer agents and control background jobs");
		expect(hub.description).not.toContain("# Processes");
		expect(renderToolExamples(hub)).not.toContain('op="start"');
		expect(bash.description).not.toContain('`hub` (`op:"start"`)');

		const jobs = await hub.execute("jobs-with-launch-disabled", { op: "jobs" });
		expect(jobs.isError).toBeFalsy();
		expect(jobs.content[0]).toEqual({ type: "text", text: "No background jobs." });

		settings.override("launch.enabled", true);

		const enabled = schemaParts(hub);
		expect(enabled.operations.toSorted()).toEqual([...COORDINATION_OPS, ...PROCESS_OPS].toSorted());
		expect(PROCESS_FIELDS.filter(field => !(field in enabled.properties))).toEqual([]);
		expect(hub.summary).toContain("supervise long-running processes");
		expect(hub.description).toContain("# Processes");
		expect(renderToolExamples(hub)).toContain('op="start"');
		expect(bash.description).toContain('`hub` (`op:"start"`)');
	});

	test("rejects direct calls through each disabled process dispatch route", async () => {
		const settings = Settings.isolated({ "launch.enabled": false });
		const hub = new HubTool(createSession(settings));
		const calls = [
			{ op: "start", name: "web", application: "bun" },
			{ op: "send", name: "debugger", text: "status" },
			{ op: "wait", name: "web", for: "exit" },
		] as const;

		for (const [index, params] of calls.entries()) {
			const result = await hub.execute(`disabled-process-${index}`, params);
			expect(result.isError).toBe(true);
			expect(result.content[0]).toEqual({
				type: "text",
				text: "Process supervision is disabled (launch.enabled=false).",
			});
		}
	});
});

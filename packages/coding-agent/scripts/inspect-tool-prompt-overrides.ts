import * as path from "node:path";
import { Settings } from "../src/config/settings";
import { EditTool } from "../src/edit";
import type { ToolSession } from "../src/tools";
import { getEvalDocTopics } from "../src/tools/eval";
import { MemoryReflectTool } from "../src/tools/memory-reflect";
import { SecurityScanTool } from "../src/tools/security-scan";
import { WriteTool } from "../src/tools/write";

const PROBE_SPAWNS = "*";
const [agentDir, ...extraArgs] = Bun.argv.slice(2);
if (!agentDir || !path.isAbsolute(agentDir) || extraArgs.length > 0) {
	process.stderr.write("Usage: bun scripts/inspect-tool-prompt-overrides.ts <absolute-agent-dir>\n");
	process.exit(1);
}

const cwd = process.cwd();
const settings = await Settings.loadReadOnly({ cwd, agentDir });
const session: ToolSession = {
	cwd,
	hasUI: false,
	settings,
	getSessionFile: () => null,
	getSessionSpawns: () => PROBE_SPAWNS,
};

// Both languages expose every unconditional agent-topic line; no Child is spawned.
const agents = getEvalDocTopics({ agentDir, py: true, js: true, spawns: PROBE_SPAWNS, evalTools: true }).agents;
if (agents === undefined) throw new Error("The runtime prompt probe requires the Eval agents topic.");

// Entry names identify prompt sources rather than wire tools: Replace and Sloppy share the Edit wire name.
// Direct description owners also inspect gated tools without enabling or executing their backends.
const tools = [
	{ name: "eval-agents", description: agents },
	{ name: "write-device-only", description: new WriteTool({ ...session, deviceOnlyWrite: true }).description },
	{ name: "replace", description: new EditTool(session, "replace").description },
	{ name: "sloppy", description: new EditTool(session, "sloppy").description },
	{ name: "security-scan", description: new SecurityScanTool(session).description },
	{ name: "reflect", description: new MemoryReflectTool(session).description },
];
console.log(JSON.stringify({ blocks: [], tools }));

import { describe, expect, it } from "bun:test";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { ReadTool } from "@oh-my-pi/pi-coding-agent/tools/read";
import { TempDir } from "@oh-my-pi/pi-utils";

const MISSING_AGENT_DIR = path.join(os.tmpdir(), `omp-read-guidance-missing-${process.pid}`);

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

describe("Read guidance", () => {
	it("renders a profile-scoped read.md instead of the bundled prompt", async () => {
		using tempDir = TempDir.createSync("@omp-read-prompt-");
		await Bun.write(tempDir.join("read.md"), "CUSTOM_READ limit={{DEFAULT_LIMIT}}");

		const description = new ReadTool(createSession(tempDir.path())).description;

		expect(description).toMatch(/^CUSTOM_READ limit=\d+$/);
		expect(description).not.toContain("MUST collect every bounded target");
	});

	it("rejects an empty selected read.md instead of silently using the bundled prompt", async () => {
		using tempDir = TempDir.createSync("@omp-read-prompt-empty-");
		await Bun.write(tempDir.join("read.md"), " \n");

		expect(() => new ReadTool(createSession(tempDir.path()))).toThrow("read tool prompt must not be empty");
	});

	it("uses the bundled prompt when profile read.md is absent", () => {
		const description = new ReadTool(createSession()).description;

		expect(description).toContain("SHOULD parallelize independent reads");
	});
});

import { describe, expect, it } from "bun:test";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { ReadTool } from "@oh-my-pi/pi-coding-agent/tools/read";

function createSession(): ToolSession {
	return {
		cwd: process.cwd(),
		hasUI: false,
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		settings: Settings.isolated(),
	};
}

describe("Read guidance", () => {
	it("batches compatible targets while preserving opaque resource semicolons", () => {
		const description = new ReadTool(createSession()).description;

		expect(description).toContain("MUST collect every bounded target");
		expect(description).toContain("MUST batch independent known local paths, file URLs, and internal URIs");
		expect(description).toContain("For independent MCP resources, issue separate sibling `read` calls");
		expect(description).toContain("Preserve MCP resource URIs exactly");
		expect(description).toContain("NEVER split or percent-encode server-provided semicolons");
		expect(description).toContain("For independent HTTP(S) URLs, issue separate sibling `read` calls");
		expect(description).toContain("NEVER combine an HTTP(S) URL with another target");
		expect(description).toContain("SQLite semicolons in SQL, table names, or row keys remain target data");
		expect(description).toContain("Literal semicolons inside batch-compatible internal URIs MUST use `%3B`");
		expect(description).toContain("artifact://abc123;package.json;src/main.ts:1-200");
	});

	it("advertises grep and current SSH fallbacks instead of retired tool names", () => {
		const description = new ReadTool(createSession()).description;

		expect(description).toContain("searchable with `grep`");
		expect(description).toContain("use `bash` with a remote SSH command");
		expect(description).toContain("`sshfs`");
		expect(description).not.toContain("`search`");
		expect(description).not.toContain("`ssh` tool");
	});
});

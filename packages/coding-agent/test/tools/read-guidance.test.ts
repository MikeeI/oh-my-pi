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
	it("partitions targets into batch-compatible and sibling-only calls", () => {
		const description = new ReadTool(createSession()).description;

		expect(description).toContain("MUST collect every bounded target required for the current step");
		expect(description).toContain("MUST partition every target into exactly one call group");
		expect(description).toContain("Every HTTP(S) URL and MCP resource is a sibling-only target");
		expect(description).toContain("NEVER place a sibling-only target in a semicolon-delimited `path`");
		expect(description).toContain(
			"Batch-compatible targets are local paths, `file://` URLs, and internal URIs not owned or advertised by MCP",
		);
		expect(description).toContain("MUST issue one `read` call per sibling-only target");
		expect(description).toContain("MUST emit all resulting calls together in the same assistant turn");
		expect(description).toContain("Preserve MCP resource URIs exactly");
		expect(description).toContain("NEVER split or percent-encode server-provided semicolons");
		expect(description).toContain("SQLite semicolons in SQL, table names, or row keys remain target data");
		expect(description).toContain("Literal semicolons inside batch-compatible internal URIs MUST use `%3B`");
		expect(description).toContain('WRONG: `{"path":"https://a.example/x;https://b.example/y"}`');
		expect(description).toContain("RIGHT: issue these three `read` calls together");
		expect(description).toContain('`{"path":"package.json;skill://skill-momp"}`');
	});

	it("describes raw output as source-specific instead of universal byte access", () => {
		const description = new ReadTool(createSession()).description;

		expect(description).toContain("handler-specific raw representation");
		expect(description).toContain("does not guarantee byte-exact data");
		expect(description).toContain("source-specific converters such as PDF/Markit");
		expect(description).toContain("`:raw` returns storage JSON");
		expect(description).toContain("`:raw` does not return original image bytes");
		expect(description).toContain("Archive `:raw` returns decoded member text");
		expect(description).not.toContain(":raw` — verbatim");
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

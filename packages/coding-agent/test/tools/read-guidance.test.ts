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
	it("schedules independent targets as same-turn sibling calls", () => {
		const description = new ReadTool(createSession()).description;

		expect(description).toContain("MUST collect every bounded target required for the current step");
		expect(description).toContain("MUST assign each target to exactly one `read` call");
		expect(description).toContain("MUST combine known disjoint ranges of one target");
		expect(description).toContain("MUST issue one separate `read` call per target");
		expect(description).toContain("NEVER join targets in one `path`");
		expect(description).toContain("MUST emit all independent `read` calls together in the same assistant turn");
		expect(description).toContain(
			"MUST read sequentially only when one result determines the next target or selector",
		);
		expect(description).toContain("Keep each complete `path[:selector]` target otherwise unchanged");
		expect(description).toContain("MUST re-read a target only after failure, truncation, or a change");
		expect(description).toContain("Preserve MCP resource URIs exactly");
		expect(description).toContain("NEVER split or percent-encode server-provided semicolons");
		expect(description).toContain("SQLite semicolons in SQL, table names, or row keys remain target data");
		expect(description).toContain("Literal semicolons inside authored non-MCP internal URIs MUST use `%3B`");
		expect(description).toContain(
			'WRONG: `{"path":"package.json:1-80;src/main.ts:120-180;skill://skill-momp:1-33"}`',
		);
		expect(description).toContain("RIGHT: issue these sibling calls together in the same assistant turn");
		expect(description).toContain('`{"path":"package.json:1-80"}`');
		expect(description).toContain('`{"path":"src/main.ts:120-180,420-455"}`');
		expect(description).toContain('`{"path":"skill://skill-momp:1-33"}`');
		expect(description).not.toContain("MUST join all batch-compatible targets");
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

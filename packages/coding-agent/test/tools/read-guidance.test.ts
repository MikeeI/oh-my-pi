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

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
	it("requires one call for independent known targets before another assistant turn", () => {
		const description = new ReadTool(createSession()).description;

		expect(description).toContain("Before each `read`, collect every bounded target");
		expect(description).toContain("MUST batch independent known non-HTTP(S)");
		expect(description).toContain("HTTP(S) URLs as separate `read` calls");
		expect(description).toContain("NEVER semicolon-join them");
		expect(description).toContain("NEVER read known non-HTTP(S) targets one per assistant turn");
	});

	it("limits semicolon batching in the wire schema to non-HTTP targets", () => {
		const schema = new ReadTool(createSession()).parameters.toJsonSchema() as {
			properties?: { path?: { description?: string } };
		};
		const description = schema.properties?.path?.description;

		expect(description).toContain("Join independent non-HTTP(S)");
		expect(description).toContain("use separate calls for HTTP(S) URLs");
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

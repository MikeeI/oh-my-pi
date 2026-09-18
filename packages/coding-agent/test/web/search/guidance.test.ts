import { describe, expect, it } from "bun:test";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { WebSearchTool } from "@oh-my-pi/pi-coding-agent/web/search";

describe("Web search guidance", () => {
	it("prefers parallel sibling calls for independent known queries", () => {
		const description = new WebSearchTool({} as ToolSession).description;

		expect(description).toContain("collect all independent queries");
		expect(description).toContain("Prefer parallel sibling `web_search` calls in one assistant turn");
		expect(description).toContain("avoid one query per turn");
		expect(description).toContain("Search sequentially only when a result determines the next query");
	});
});

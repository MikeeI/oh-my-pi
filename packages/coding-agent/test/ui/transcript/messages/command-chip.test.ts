import { describe, expect, it } from "bun:test";
import { chipText, termChips } from "../../../../src/ui/transcript/messages/chips";

// MOMP-COMMAND-INVOCATION-DISPLAY: a typed file-command invocation shows its `/name` as a filled command chip.
describe("file-command chip", () => {
	it("marks only the leading command of a confirmed invocation", () => {
		const display = chipText("/review src/a.ts /tmp", { command: true });
		expect(display.text).toBe("/review src/a.ts /tmp");
		expect(display.chips).toEqual([{ label: "/review", kind: "command" }]);
		expect(termChips(display.chips)).toEqual([{ t: "/review", color: "#282a36", fill: "#c8a1ff" }]);
	});

	it("keeps ordinary slash-looking prose unchipped", () => {
		expect(chipText("/review src/a.ts").chips).toEqual([]);
	});
});

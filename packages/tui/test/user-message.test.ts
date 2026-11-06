import { beforeAll, expect, it } from "bun:test";
import { UserMessageComponent } from "../src/chat/user-message";
import { initTheme, theme } from "../src/theme";
import { bgAnsi, BG_RESET, colorToAnsi, FG_RESET } from "../src/theme/color";

beforeAll(async () => {
	await initTheme(false);
});

it("distinguishes confirmed file commands without changing ordinary slash-looking messages", () => {
	const invocation = "/grill-me den neuen Cache-Layer";
	const command = new UserMessageComponent(invocation, { commandInvocation: invocation });
	const lines = command.render(60);
	const content = lines.find(line => Bun.stripANSI(line).includes("/grill-me"))!;
	expect(Bun.stripANSI(content)).toContain("┃  /grill-me    den neuen Cache-Layer");
	const chip = (mode: "truecolor" | "256color") =>
		bgAnsi(theme.getColorHex("commandPrompt"), mode) +
		colorToAnsi("#282a36", mode) +
		theme.bold(" /grill-me ") +
		FG_RESET +
		BG_RESET;
	expect(content).toContain(chip(theme.getColorMode()));
	const native = JSON.stringify(command.describe());
	expect(native).toContain(JSON.stringify(chip("truecolor")).slice(1, -1));
	expect(native).toContain("   den neuen Cache-Layer");

	command.setReaction("👍");
	const narrow = command.render(24);
	expect(narrow.every(line => Bun.stringWidth(line) <= 24)).toBe(true);
	expect(narrow.map(line => Bun.stripANSI(line)).join("\n")).toContain("Cache-Layer");
	expect(Bun.stripANSI(command.renderTranscriptBlockEmergencyRow(24)!)).toContain("┃  /grill-me");
	const bare = new UserMessageComponent("/expert", { commandInvocation: "/expert" });
	expect(Bun.stripANSI(bare.render(24).join("\n"))).toContain("┃  /expert");
	const ordinary = new UserMessageComponent(invocation);
	expect(Bun.stripANSI(ordinary.render(60).join("\n"))).not.toContain("┃");
});

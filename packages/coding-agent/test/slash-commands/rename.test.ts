import { describe, expect, it, vi } from "bun:test";
import type { InteractiveModeContext } from "@oh-my-pi/pi-coding-agent/modes/types";
import { executeAcpBuiltinSlashCommand } from "@oh-my-pi/pi-coding-agent/slash-commands/acp-builtins";
import { executeBuiltinSlashCommand } from "@oh-my-pi/pi-coding-agent/slash-commands/builtin-registry";
import * as titleGenerator from "@oh-my-pi/pi-coding-agent/utils/title-generator";

function createRuntime() {
	const handleRenameCommand = vi.fn(async () => {});
	const showStatus = vi.fn();
	const setText = vi.fn();
	const addToHistory = vi.fn();
	return {
		handleRenameCommand,
		showStatus,
		setText,
		addToHistory,
		runtime: {
			ctx: {
				editor: { setText, addToHistory } as unknown as InteractiveModeContext["editor"],
				showStatus,
				handleRenameCommand,
			} as unknown as InteractiveModeContext,
		},
	};
}

describe("/rename slash command", () => {
	it("routes the title through the rename handler and saves the full command to history", async () => {
		const harness = createRuntime();

		const handled = await executeBuiltinSlashCommand("/rename my session", harness.runtime);

		expect(handled).toBe(true);
		expect(harness.setText).toHaveBeenCalledWith("");
		expect(harness.handleRenameCommand).toHaveBeenCalledWith("my session");
	});

	it("routes a blank /rename invocation through the rename handler for auto-generation", async () => {
		const harness = createRuntime();

		const handled = await executeBuiltinSlashCommand("/rename   ", harness.runtime);

		expect(handled).toBe(true);

		expect(harness.setText).toHaveBeenCalledWith("");
		expect(harness.handleRenameCommand).toHaveBeenCalledWith("");
	});

	it("marks a blank direct /rename as an automatic generated title", async () => {
		vi.spyOn(titleGenerator, "generateSessionTitleFromRecentTranscript").mockResolvedValue("Generated title");
		const setSessionName = vi.fn(async () => true);
		const output = vi.fn(async () => {});
		const runtime = {
			session: {
				messages: [{ role: "user", content: [{ type: "text", text: "Rename this session" }] }],
				modelRegistry: {},
				sessionId: "rename-session",
				model: undefined,
				agent: { metadataForProvider: () => undefined },
			},
			sessionManager: { setSessionName },
			settings: {},
			cwd: "/tmp",
			output,
			refreshCommands: vi.fn(),
			reloadPlugins: vi.fn(async () => {}),
		} as never;

		const handled = await executeAcpBuiltinSlashCommand("/rename   ", runtime);

		expect(handled).toEqual({ consumed: true });
		expect(setSessionName).toHaveBeenCalledWith("Generated title", "auto", "rename");
	});
});

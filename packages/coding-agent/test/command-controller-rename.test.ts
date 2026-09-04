import { afterEach, describe, expect, it, vi } from "bun:test";
import { CommandController } from "@oh-my-pi/pi-coding-agent/modes/controllers/command-controller";
import type { InteractiveModeContext } from "@oh-my-pi/pi-coding-agent/modes/types";
import * as titleGenerator from "@oh-my-pi/pi-coding-agent/utils/title-generator";

function createContext() {
	let sessionName: string | undefined;
	const setSessionName = vi.fn(async (name: string, _source: "user" | "auto", _trigger?: string) => {
		sessionName = name;
		return true;
	});
	const showStatus = vi.fn();
	const showError = vi.fn();
	const ctx = {
		session: {
			messages: [{ role: "user", content: [{ type: "text", text: "Fix rename transport" }] }],
			modelRegistry: {},
			sessionId: "rename-session",
			model: undefined,
			agent: { metadataForProvider: () => undefined },
		},
		sessionManager: {
			setSessionName,
			getSessionName: () => sessionName,
		},
		settings: {},
		showStatus,
		showError,
	} as unknown as InteractiveModeContext;
	return { ctx, setSessionName, showStatus, showError };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("CommandController rename", () => {
	it("keeps a generated blank rename replaceable as an automatic title", async () => {
		vi.spyOn(titleGenerator, "generateSessionTitleFromRecentTranscript").mockResolvedValue("Generated title");
		const { ctx, setSessionName, showStatus, showError } = createContext();

		await new CommandController(ctx).handleRenameCommand("");

		expect(setSessionName).toHaveBeenCalledWith("Generated title", "auto", "rename");
		expect(showStatus).toHaveBeenCalledWith('Session renamed to "Generated title".');
		expect(showError).not.toHaveBeenCalled();
	});

	it("reports missing conversation content for a blank rename", async () => {
		vi.spyOn(titleGenerator, "generateSessionTitleFromRecentTranscript").mockResolvedValue(null);
		const { ctx, setSessionName, showError } = createContext();

		await new CommandController(ctx).handleRenameCommand("");

		expect(setSessionName).not.toHaveBeenCalled();
		expect(showError).toHaveBeenCalledWith("No conversation content to generate a title from.");
	});
});

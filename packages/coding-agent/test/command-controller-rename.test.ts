import { afterEach, describe, expect, it, vi } from "bun:test";
import { CommandController } from "@oh-my-pi/pi-coding-agent/modes/controllers/command-controller";
import type { InteractiveModeContext } from "@oh-my-pi/pi-coding-agent/modes/types";

function createContext() {
	let sessionName: string | undefined;
	let titleRevision = 0;
	const setSessionName = vi.fn(async (name: string, _source: "user" | "auto", _trigger?: string) => {
		sessionName = name;
		return true;
	});
	const showStatus = vi.fn();
	const showError = vi.fn();
	const ctx = {
		session: {
			titleGenerationSignal: new AbortController().signal,
		},
		sessionManager: {
			get titleRevision() {
				return titleRevision;
			},
			getSessionId: () => "rename-session",
			setSessionName: (name: string, source: "user" | "auto", trigger?: string) => {
				titleRevision++;
				return setSessionName(name, source, trigger);
			},
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
	it("keeps a generated rename replaceable as an automatic title", async () => {
		const { ctx, setSessionName, showStatus, showError } = createContext();

		await new CommandController(ctx).handleRenameCommand("Generated title", true);

		expect(setSessionName).toHaveBeenCalledWith("Generated title", "auto", "rename");
		expect(showStatus).toHaveBeenCalledWith('Session renamed to "Generated title".');
		expect(showError).not.toHaveBeenCalled();
	});
});

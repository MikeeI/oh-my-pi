import { describe, expect, it, vi } from "bun:test";
import { InputController } from "@oh-my-pi/pi-coding-agent/modes/controllers/input-controller";
import type { InteractiveModeContext } from "@oh-my-pi/pi-coding-agent/modes/types";
import { UiHelpers } from "@oh-my-pi/pi-coding-agent/modes/utils/ui-helpers";

function makeCtx() {
	let text = "";
	const addToHistory = vi.fn();
	const setText = vi.fn((next: string) => {
		text = next;
	});
	const runRoutineInvocation = vi.fn(async () => true);
	const prompt = vi.fn(async () => true);
	const updatePendingMessagesDisplay = vi.fn();
	const requestRender = vi.fn();
	const showStatus = vi.fn();
	const editor = {
		onSubmit: undefined as undefined | ((input: string) => Promise<void>),
		getText: () => text,
		getExpandedText: () => text,
		setText,
		addToHistory,
		pendingImages: [],
		pendingImageLinks: [],
		clearDraft(historyText?: string) {
			if (historyText !== undefined) addToHistory(historyText);
			text = "";
		},
	};
	const ctx = {
		editor,
		focusedAgentId: undefined,
		collabGuest: undefined,
		skillCommands: new Map(),
		session: {
			isStreaming: false,
			isCompacting: false,
			isBashRunning: false,
			isEvalRunning: false,
			queuedMessageCount: 0,
			extensionRunner: undefined,
			runRoutineInvocation,
			prompt,
		},
		get viewSession() {
			return (this as typeof ctx).session;
		},
		showStatus,
		showError: vi.fn(),
		updatePendingMessagesDisplay,
		ui: { requestRender },
		isBashMode: false,
		isPythonMode: false,
		loopModeEnabled: false,
		goalModeEnabled: false,
		compactionQueuedMessages: [],
		locallySubmittedUserSignatures: new Set<string>(),
		withLocalSubmission: async (_text: string, fn: () => unknown) => fn(),
	} as unknown as InteractiveModeContext;
	return {
		ctx,
		editor,
		addToHistory,
		setText,
		runRoutineInvocation,
		prompt,
		updatePendingMessagesDisplay,
		requestRender,
		showStatus,
	};
}

describe("InputController routine dispatch", () => {
	it("submits routine invocations through the routine runner instead of raw prompt", async () => {
		const {
			ctx,
			editor,
			addToHistory,
			setText,
			runRoutineInvocation,
			prompt,
			updatePendingMessagesDisplay,
			requestRender,
		} = makeCtx();
		const controller = new InputController(ctx);
		controller.setupEditorSubmitHandler();

		await editor.onSubmit?.("/review-all src/foo.ts");

		expect(runRoutineInvocation).toHaveBeenCalledWith("/review-all src/foo.ts", { onProgress: expect.any(Function) });
		expect(prompt).not.toHaveBeenCalled();
		expect(addToHistory).toHaveBeenCalledWith("/review-all src/foo.ts");
		expect(setText).toHaveBeenCalledWith("");
		expect(updatePendingMessagesDisplay).toHaveBeenCalled();
		expect(requestRender).toHaveBeenCalled();
	});

	it("delegates follow-up routine invocations before raw follow-up prompt", async () => {
		const { ctx, editor, addToHistory, setText, runRoutineInvocation, prompt } = makeCtx();
		const controller = new InputController(ctx);
		editor.setText("/review-all src/foo.ts");

		await controller.handleFollowUp();

		expect(runRoutineInvocation).toHaveBeenCalledWith("/review-all src/foo.ts", { onProgress: expect.any(Function) });
		expect(prompt).not.toHaveBeenCalled();
		expect(addToHistory).toHaveBeenCalledWith("/review-all src/foo.ts");
		expect(setText).toHaveBeenCalledWith("");
	});

	it("recognizes colon-form routine invocations as known slash commands", () => {
		const ctx = {
			session: {
				extensionRunner: undefined,
				customCommands: [],
			},
			fileSlashCommands: new Set<string>(),
			routineSlashCommands: new Set<string>(["review-all"]),
		} as unknown as InteractiveModeContext;
		const helpers = new UiHelpers(ctx);

		expect(helpers.isKnownSlashCommand("/review-all:src/foo.ts")).toBe(true);
		expect(helpers.isKnownSlashCommand("/other:src/foo.ts")).toBe(false);
	});
});

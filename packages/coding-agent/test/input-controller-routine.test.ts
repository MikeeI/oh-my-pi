import { describe, expect, it, vi } from "bun:test";
import type { ImageContent } from "@oh-my-pi/pi-ai";
import type { RoutineProgress } from "@oh-my-pi/pi-coding-agent/extensibility/routines";
import { InputController } from "@oh-my-pi/pi-coding-agent/modes/controllers/input-controller";
import type { InteractiveModeContext } from "@oh-my-pi/pi-coding-agent/modes/types";
import { UiHelpers } from "@oh-my-pi/pi-coding-agent/modes/utils/ui-helpers";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { createInteractiveModeContext } from "./helpers/interactive-mode-context";

function makeCtx() {
	const runRoutineInvocation = vi.fn(
		async (_text: string, _options: { onProgress?: (progress: RoutineProgress) => void | Promise<void> } = {}) =>
			true,
	);
	const prompt = vi.fn(
		async (_text: string, _options?: { streamingBehavior?: "steer" | "followUp"; images?: ImageContent[] }) => true,
	);
	const ctx = createInteractiveModeContext({
		session: {
			runRoutineInvocation: runRoutineInvocation as unknown as AgentSession["runRoutineInvocation"],
			prompt: prompt as unknown as AgentSession["prompt"],
			customCommands: [],
		},
		skillCommands: new Map(),
		fileSlashCommands: new Set<string>(),
		routineSlashCommands: new Set<string>(["review-all"]),
		withLocalSubmission: async (_text, fn) => fn(),
		hasActiveBtw: () => false,
		hasActiveOmfg: () => false,
	});
	const helpers = new UiHelpers(ctx);
	ctx.queueCompactionMessage = helpers.queueCompactionMessage.bind(helpers);
	ctx.isKnownSlashCommand = helpers.isKnownSlashCommand.bind(helpers);
	const composer = ctx.composer;
	const addToHistory = vi.spyOn(composer, "addToHistory");
	const setImages = (images: ImageContent[], links: (string | undefined)[]) => {
		composer.pendingImages.splice(0, composer.pendingImages.length, ...images);
		composer.pendingImageLinks.splice(0, composer.pendingImageLinks.length, ...links);
	};
	return {
		ctx,
		composer,
		setImages,
		addToHistory,
		runRoutineInvocation,
		prompt,
		updatePendingMessagesDisplay: ctx.updatePendingMessagesDisplay,
		showError: ctx.showError,
	};
}

describe("InputController routine dispatch", () => {
	it("submits routine invocations through the routine runner instead of raw prompt", async () => {
		const { ctx, composer, setImages, addToHistory, runRoutineInvocation, prompt, updatePendingMessagesDisplay } =
			makeCtx();
		const image: ImageContent = { type: "image", mimeType: "image/png", data: "c3VjY2Vzcw==" };
		setImages([image], ["local://routine-success.png"]);
		const controller = new InputController(ctx);
		controller.setupEditorSubmitHandler();

		await composer.onSubmit?.("/review-all src/foo.ts");

		expect(runRoutineInvocation).toHaveBeenCalledWith("/review-all src/foo.ts", { onProgress: expect.any(Function) });
		expect(prompt).not.toHaveBeenCalled();
		expect(addToHistory).toHaveBeenCalledWith("/review-all src/foo.ts");
		expect(composer.text()).toBe("");
		expect(composer.pendingImages).toEqual([]);
		expect(composer.pendingImageLinks).toEqual([]);
		expect(updatePendingMessagesDisplay).toHaveBeenCalled();
		const sessionState = ctx.session as unknown as { isStreaming: boolean };
		sessionState.isStreaming = true;
		await composer.onSubmit?.("next prompt");
		expect(prompt).toHaveBeenCalledWith("next prompt", { streamingBehavior: "steer", images: undefined });
	});

	it("consumes submitted images but preserves a newer draft when a routine fails", async () => {
		const { ctx, composer, setImages, runRoutineInvocation, prompt, showError } = makeCtx();
		const controller = new InputController(ctx);
		controller.setupEditorSubmitHandler();
		const image: ImageContent = { type: "image", mimeType: "image/png", data: "ZmFpbHVyZQ==" };
		setImages([image], ["local://routine-error.png"]);
		const started = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		runRoutineInvocation.mockImplementationOnce(async () => {
			started.resolve();
			await release.promise;
			throw new Error("routine execution failed");
		});
		const submission = composer.onSubmit?.("/review-all src/foo.ts");
		await started.promise;
		expect(composer.pendingImages).toEqual([]);
		const nextImage: ImageContent = { type: "image", mimeType: "image/png", data: "bmV4dA==" };
		composer.setText("new draft");
		setImages([nextImage], ["local://new-draft.png"]);
		release.resolve();
		await submission;

		expect(showError).toHaveBeenCalledWith("routine execution failed");
		expect(composer.text()).toBe("new draft");
		expect(composer.pendingImages).toEqual([nextImage]);
		expect(composer.pendingImageLinks).toEqual(["local://new-draft.png"]);

		expect(prompt).not.toHaveBeenCalled();
	});

	it("queues routine submissions until compaction hands off", async () => {
		const { ctx, composer, setImages, runRoutineInvocation, prompt } = makeCtx();
		const controller = new InputController(ctx);
		controller.setupEditorSubmitHandler();
		const image: ImageContent = { type: "image", mimeType: "image/png", data: "aW1hZ2U=" };
		const sessionState = ctx.session as unknown as { isCompacting: boolean };
		sessionState.isCompacting = true;
		setImages([image], [undefined]);
		prompt.mockImplementationOnce(async submittedText => {
			await runRoutineInvocation(submittedText, { onProgress: () => {} });
			return true;
		});

		await composer.onSubmit?.("/review-all src/foo.ts [Image #1]");

		expect(runRoutineInvocation).not.toHaveBeenCalled();
		expect(ctx.compactionQueuedMessages).toEqual([
			{ text: "/review-all src/foo.ts [Image #1]", mode: "steer", images: [image] },
		]);

		sessionState.isCompacting = false;
		await new UiHelpers(ctx).flushCompactionQueue();

		expect(prompt).toHaveBeenCalledTimes(1);
		expect(prompt).toHaveBeenCalledWith("/review-all src/foo.ts [Image #1]");
		expect(runRoutineInvocation).toHaveBeenCalledTimes(1);
		expect(runRoutineInvocation).toHaveBeenCalledWith("/review-all src/foo.ts [Image #1]", {
			onProgress: expect.any(Function),
		});
	});

	it("delegates follow-up routine invocations before raw follow-up prompt", async () => {
		const { ctx, composer, addToHistory, runRoutineInvocation, prompt } = makeCtx();
		const controller = new InputController(ctx);
		composer.setText("/review-all src/foo.ts");

		const started = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		runRoutineInvocation.mockImplementationOnce(async () => {
			started.resolve();
			await release.promise;
			return true;
		});
		const submission = controller.handleFollowUp();
		await started.promise;
		composer.setText("next follow-up draft");
		release.resolve();
		await submission;

		expect(runRoutineInvocation).toHaveBeenCalledWith("/review-all src/foo.ts", { onProgress: expect.any(Function) });
		expect(prompt).not.toHaveBeenCalled();
		expect(addToHistory).toHaveBeenCalledWith("/review-all src/foo.ts");
		expect(composer.text()).toBe("next follow-up draft");
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

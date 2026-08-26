import { describe, expect, it, vi } from "bun:test";
import { SelectorController } from "@oh-my-pi/pi-coding-agent/modes/controllers/selector-controller";
import type { InteractiveModeContext } from "@oh-my-pi/pi-coding-agent/modes/types";

describe("SelectorController prompt-affecting settings", () => {
	it("refreshes the active prompt when xdev docs mode changes", async () => {
		const refreshBaseSystemPrompt = vi.fn(async () => {});
		const ctx = {
			session: { refreshBaseSystemPrompt },
			showError: vi.fn(),
		} as unknown as InteractiveModeContext;
		const controller = new SelectorController(ctx);

		controller.handleSettingChange("tools.xdevDocs", "catalog");
		await Promise.resolve();

		expect(refreshBaseSystemPrompt).toHaveBeenCalledTimes(1);
		expect(ctx.showError).not.toHaveBeenCalled();
	});
});

describe("SelectorController transcript presentation settings", () => {
	it("marks accepted history before changing image visibility", () => {
		const markAcceptedTapeDrifted = vi.fn();
		const requestRender = vi.fn();
		const ctx = {
			chatContainer: { children: [], markAcceptedTapeDrifted },
			ui: { clearInlineImages: vi.fn(), requestRender },
		} as unknown as InteractiveModeContext;
		const controller = new SelectorController(ctx);

		controller.handleSettingChange("showImages", false);

		expect(markAcceptedTapeDrifted).toHaveBeenCalledTimes(1);
		expect(markAcceptedTapeDrifted.mock.invocationCallOrder[0]).toBeLessThan(
			requestRender.mock.invocationCallOrder[0],
		);
	});
});

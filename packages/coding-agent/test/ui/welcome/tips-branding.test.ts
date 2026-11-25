import { describe, expect, it } from "bun:test";
import { welcomeTip } from "../../../src/ui/welcome/tips";

// MOMP-PACKAGE-IDENTITY: welcome tips name the installed fork binary in inline CLI invocations only.
describe("welcome tip branding", () => {
	const tips = new Set<string>();
	for (let roll = 0; roll < 1; roll += 0.0005) {
		const tip = welcomeTip({ nagRoll: 1, tipRoll: roll, preset: "nerd", tern: false, appName: "momp" });
		if (tip) tips.add(tip);
	}

	it("brands inline self-invocations with the running executable", () => {
		expect([...tips].some(tip => tip.includes("`momp -c`"))).toBe(true);
		expect([...tips].some(tip => /`omp[\s`]/.test(tip))).toBe(false);
	});

	it("keeps prose mentions of the upstream name", () => {
		expect([...tips].some(tip => tip.includes("omp load-balances"))).toBe(true);
	});
});

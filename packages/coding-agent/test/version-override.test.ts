import { describe, expect, it } from "bun:test";
import { buildCompileArgs } from "../scripts/build-cli";
import { compareNumericVersionStrings, parseCliVersionOutput } from "../src/utils/version";

describe("version override support", () => {
	it("compares dotted numeric versions with extra segments", () => {
		expect(compareNumericVersionStrings("14.1.0", "14.1.0.9")).toBeLessThan(0);
		expect(compareNumericVersionStrings("14.1.0.9", "14.1.0")).toBeGreaterThan(0);
		expect(compareNumericVersionStrings("14.1.0.9", "14.1.0.9")).toBe(0);
	});

	it("parses CLI version output with four numeric segments", () => {
		expect(parseCliVersionOutput("omp/14.1.0.9")).toBe("14.1.0.9");
		expect(parseCliVersionOutput("omp/14.1.0")).toBe("14.1.0");
	});

	it("adds a build define when a version override is present", () => {
		expect(buildCompileArgs(undefined)).not.toContain('PI_VERSION_OVERRIDE="14.1.0.9"');
		expect(buildCompileArgs("14.1.0.9")).toContain('PI_VERSION_OVERRIDE="14.1.0.9"');
	});
});

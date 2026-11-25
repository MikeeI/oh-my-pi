import { describe, expect, it } from "bun:test";
import { createTheme, loadThemeJsonSync, loadThemeSync, validateThemeJson } from "../../src/theme";

// MOMP-CACHE-MISS-COLOR: a marker-specific token, lemon yellow unless a theme overrides it.
describe("cacheMiss theme color", () => {
	it("defaults to lemon yellow for built-in themes that do not declare it", () => {
		const theme = loadThemeSync("dark");
		expect(theme.fg("cacheMiss", "x")).toContain("\x1b[38;2;255;255;0m");
		expect(theme.fg("muted", "x")).not.toContain("\x1b[38;2;255;255;0m");
	});

	it("accepts a theme override without requiring the key", () => {
		const base = loadThemeJsonSync("dark");
		const json = validateThemeJson("override", { ...base, colors: { ...base.colors, cacheMiss: "#00ff00" } });
		expect(createTheme(json).fg("cacheMiss", "x")).toContain("\x1b[38;2;0;255;0m");
	});
});

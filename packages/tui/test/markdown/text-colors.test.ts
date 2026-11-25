import { describe, expect, it } from "bun:test";
import { plainRows } from "../../src/testing/cells";
import { renderMarkdown } from "../../src/text/markdown";
import { loadThemeSync } from "../../src/theme";

// MOMP-TEXT-COLOR: opt-in `<span style="color:#rrggbb">` foreground scopes in Markdown prose.
const theme = loadThemeSync("dark");
const RED = "\x1b[38;2;255;0;0m";
const GREEN = "\x1b[38;2;0;255;0m";

function render(source: string, textColors: boolean): string {
	return renderMarkdown(source, 60, { theme, textColors }).join("\n");
}

describe("span foreground colors", () => {
	it("leaves span tags structural and uncolored while disabled", () => {
		const out = render('a <span style="color:#ff0000">red</span> b', false);
		expect(out).not.toContain(RED);
		expect(plainRows([out])).toEqual(["a red b"]);
	});

	it("colors the span content and closes the color before following prose", () => {
		const out = render('a <span style="color:#ff0000">red</span> b', true);
		expect(plainRows([out])).toEqual(["a red b"]);
		const red = out.indexOf(RED);
		expect(red).toBeGreaterThan(-1);
		expect(out.indexOf("red", red)).toBeGreaterThan(red);
		// The parent (uncolored) prose resumes with a foreground reset after the span.
		expect(out.slice(out.indexOf("red", red), out.indexOf(" b"))).toContain("\x1b[39m");
	});

	it("restores the parent color after a nested override and after a styled run", () => {
		const nested = render('<span style="color:#ff0000">r <span style="color:#00ff00">g</span> after</span>', true);
		expect(nested.indexOf(GREEN)).toBeGreaterThan(nested.indexOf(RED));
		expect(nested.lastIndexOf(RED)).toBeGreaterThan(nested.indexOf(GREEN));
		expect(nested.lastIndexOf(RED)).toBeLessThan(nested.indexOf("after"));

		const bold = render('<span style="color:#ff0000">**b** tail</span>', true);
		expect(bold.lastIndexOf(RED)).toBeLessThan(bold.indexOf("tail"));
		expect(bold.lastIndexOf(RED)).toBeGreaterThan(bold.indexOf("b"));
	});

	it("does not join words across zero-width tags at a hard line break", () => {
		const rows = renderMarkdown('first  \n<span style="color:#ff0000">second</span> word', 60, {
			theme,
			textColors: true,
		});
		expect(plainRows(rows)).toEqual(["first", "second word"]);
	});
});

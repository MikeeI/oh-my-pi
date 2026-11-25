/**
 * The host's Markdown look: what `renderMarkdownFrame` draws with where a
 * caller leaves `colorful`, `mermaid` or `textColors` unset, so every Markdown
 * surface follows the host's settings. Reactive: a painter that renders
 * Markdown repaints when it changes.
 */
import { signal } from "../../reactive";

/** Palette hues for headings, emphasis and inline code; mermaid fences as diagrams; span foreground colors. */
export interface MarkdownLook {
	readonly colorful: boolean;
	readonly mermaid: boolean;
	/** `<span style="color:#rrggbb">` foreground scopes (MOMP `tui.textColors`, off by default). */
	readonly textColors: boolean;
}

const look = signal<MarkdownLook>({ colorful: true, mermaid: true, textColors: false });

/** The host's Markdown look (reactive); a new object on every change. */
export function markdownLook(): MarkdownLook {
	return look();
}

/** Set the host's Markdown look (`tui.colorfulMarkdown`, `tui.renderMermaid`, `tui.textColors`). */
export function setMarkdownLook(input: Omit<MarkdownLook, "textColors"> & { readonly textColors?: boolean }): void {
	const next: MarkdownLook = { ...input, textColors: input.textColors ?? false };
	const current = look();
	if (current.colorful !== next.colorful || current.mermaid !== next.mermaid || current.textColors !== next.textColors)
		look.set(next);
}

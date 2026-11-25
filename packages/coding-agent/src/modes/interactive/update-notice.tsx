/** @jsxImportSource @oh-my-pi/pi-tui */
/**
 * The "new version available" notice: natively a download notice row; a text
 * terminal draws it boxed by warning rules (`Update Available`, then the
 * action to take).
 */
import type { JSXNode } from "@oh-my-pi/pi-tui";
import { currentTheme } from "@oh-my-pi/pi-tui/theme/runtime";
import { bold } from "@oh-my-pi/pi-tui/theme/theme";
import { AnsiText } from "../../ui/transcript/ansi-text";
import { Notice } from "../../ui/transcript/messages/notices";

const UPDATE_COMMAND = "omp update";

export function UpdateNotice(props: {
	readonly version: string;
	/** Names whose release this is when it is not the running package's own (MOMP reports upstream). */
	readonly sourceLabel?: string;
	/** The step that applies the release; the running package's identity owner supplies it. */
	readonly actionText?: string;
}): JSXNode {
	const source = props.sourceLabel ? `${props.sourceLabel} ` : "";
	const action = props.actionText ?? `Run: ${UPDATE_COMMAND}`;
	const prefix = `New ${source}version ${props.version} is available. `;
	const theme = currentTheme();
	const title = bold(theme.fg("warning", "Update Available"));
	const rule = (): JSXNode => (
		<canvas paint={width => [theme.fg("warning", theme.symbols.box.horizontal.repeat(width))]} />
	);
	return (
		<Notice
			tone="info"
			icon="download"
			message={[{ t: "Update available", s: "strong" }, { t: ` · ${prefix}` }, { t: action, s: "code" }]}
			terminal={
				<col>
					{rule()}
					<AnsiText text={`${title}\n${theme.fg("muted", prefix)}${theme.fg("accent", action)}`} padX={1} />
					{rule()}
				</col>
			}
		/>
	);
}

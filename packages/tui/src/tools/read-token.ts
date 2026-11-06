import type { Theme } from "../theme/theme";

/** Persisted exact-token metadata shared by every Read result renderer. */
export interface ReadTokenDetails {
	/** Exact native-token count of final sanitized text blocks after session-owned postprocessing. */
	readTextTokens?: number;
}

/** Shared semantic label; ANSI and native renderers own only its presentation. */
export function formatReadTokenLabel(readTextTokens: unknown): string | undefined {
	if (typeof readTextTokens !== "number" || !Number.isSafeInteger(readTextTokens) || readTextTokens < 0) {
		return undefined;
	}
	return `${readTextTokens.toLocaleString("en-US")} Read Tokens`;
}

/** Format an exact Read-token suffix, omitting absent or malformed persisted metadata. */
export function formatReadTokenSuffix(readTextTokens: unknown, uiTheme: Theme): string {
	const label = formatReadTokenLabel(readTextTokens);
	return label === undefined ? "" : uiTheme.fg("dim", ` · ${label}`);
}

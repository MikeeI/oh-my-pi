import type { Theme } from "../modes/theme/theme";

/** Persisted exact-token metadata shared by every Read result renderer. */
export interface ReadTokenDetails {
	/** Exact native-token count of final sanitized text blocks after session-owned postprocessing. */
	readTextTokens?: number;
}

/** Format an exact Read-token suffix, omitting absent or malformed persisted metadata. */
export function formatReadTokenSuffix(readTextTokens: unknown, uiTheme: Theme): string {
	if (typeof readTextTokens !== "number" || !Number.isSafeInteger(readTextTokens) || readTextTokens < 0) return "";
	return uiTheme.fg("dim", ` · ${readTextTokens.toLocaleString("en-US")} Read Tokens`);
}

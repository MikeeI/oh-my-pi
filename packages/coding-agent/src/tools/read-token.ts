/** Exact native-token count of a settled Read result, or undefined for absent or malformed persisted metadata. */
export function readTokenCount(details: unknown): number | undefined {
	const tokens = (details as { readTextTokens?: unknown } | undefined)?.readTextTokens;
	return typeof tokens === "number" && Number.isSafeInteger(tokens) && tokens >= 0 ? tokens : undefined;
}

/** Shared semantic label; the group and full-result presenters own only its placement after the path. */
export function formatReadTokenLabel(readTextTokens: number): string {
	return `${readTextTokens.toLocaleString("en-US")} Read Tokens`;
}

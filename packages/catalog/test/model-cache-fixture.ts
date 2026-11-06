import type { Database } from "bun:sqlite";

/** Resolve the row actually written by the public API before corrupting a fixture. */
export function persistedModelCacheProviderId(db: Database, logicalProviderId: string): string {
	const rows = db
		.query<{ provider_id: string }, [string]>(
			`SELECT provider_id FROM model_cache
			WHERE CASE WHEN json_valid(provider_id) THEN json_extract(provider_id, '$[2]') END = ?`,
		)
		.all(logicalProviderId);
	if (rows.length !== 1) {
		throw new Error(`Expected one cache fixture for ${logicalProviderId}, found ${rows.length}`);
	}
	return rows[0]!.provider_id;
}

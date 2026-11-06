import { sliceWithWidth, visibleWidth } from "@oh-my-pi/pi-tui";

/**
 * Hard-wrap each accepted physical row independently.
 * Rows never join when the target width grows because terminal history already
 * made every source-row boundary immutable.
 */
export function reflowHardRows(rows: readonly string[], width: number): string[] {
	const reflowed: string[] = [];
	const columns = Math.max(1, width);
	for (const row of rows) {
		const rowWidth = visibleWidth(row);
		if (rowWidth === 0) {
			reflowed.push("");
			continue;
		}
		for (let column = 0; column < rowWidth;) {
			let slice = sliceWithWidth(row, column, columns, true);
			if (slice.width === 0) slice = sliceWithWidth(row, column, columns);
			reflowed.push(slice.text);
			column += Math.max(1, slice.width);
		}
	}
	return reflowed;
}

export function compareNumericVersionStrings(a: string, b: string): number {
	const aParts = a.split(".").map(part => Number.parseInt(part, 10) || 0);
	const bParts = b.split(".").map(part => Number.parseInt(part, 10) || 0);
	const max = Math.max(aParts.length, bParts.length);

	for (let i = 0; i < max; i++) {
		const delta = (aParts[i] || 0) - (bParts[i] || 0);
		if (delta !== 0) return delta;
	}

	return 0;
}

export function parseCliVersionOutput(output: string): string | undefined {
	const match = output.match(/\/(\d+(?:\.\d+)+)/);
	return match?.[1];
}

import { heapStats } from "bun:jsc";
const OUT = process.env.HEAPDBG_OUT!;
let n = 0;
process.on("SIGUSR2", () => {
	const i = ++n;
	Bun.gc(true);
	const h = heapStats();
	const types = Object.entries(h.objectTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 60);
	Bun.write(`${OUT}/stats-${i}.json`, JSON.stringify({ mem: process.memoryUsage(), heapSize: h.heapSize, heapCapacity: h.heapCapacity, extra: h.extraMemorySize, objectCount: h.objectCount, types }, null, 1));
	if (process.env.HEAPDBG_SNAP === String(i) || require("node:fs").existsSync(`${OUT}/want-snap`)) Bun.write(`${OUT}/snap-${i}.heapsnapshot`, Bun.generateHeapSnapshot("v8")), require("node:fs").rmSync(`${OUT}/want-snap`, { force: true });
});

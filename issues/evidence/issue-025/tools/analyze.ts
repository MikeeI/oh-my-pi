// Summarize a V8-format heap snapshot: self size per constructor and top string buckets.
const snap = await Bun.file(Bun.argv[2]).json();
const m = snap.snapshot.meta; const nf = m.node_fields; const N = nf.length;
const ti = nf.indexOf("type"), ni = nf.indexOf("name"), si = nf.indexOf("self_size");
const types = m.node_types[0]; const nodes = snap.nodes; const strs = snap.strings;
const by = new Map<string, [number, number]>(); let total = 0; const strBuckets = new Map<string, [number, number]>();
for (let i = 0; i < nodes.length; i += N) {
	const t = types[nodes[i + ti]]; const name = strs[nodes[i + ni]]; const sz = nodes[i + si]; total += sz;
	const key = t === "object" || t === "closure" ? `${t}:${name}` : t;
	const e = by.get(key) ?? [0, 0]; e[0] += sz; e[1]++; by.set(key, e);
	if (t === "string" || t === "concatenated string" || t === "sliced string") {
		const k = String(name).slice(0, 60).replace(/\n/g, "⏎");
		const b = strBuckets.get(k) ?? [0, 0]; b[0] += sz; b[1]++; strBuckets.set(k, b);
	}
}
const mb = (x: number) => (x / 1048576).toFixed(1) + "MB";
console.log("total self", mb(total), "nodes", nodes.length / N);
for (const [k, [s, c]] of [...by].sort((a, b) => b[1][0] - a[1][0]).slice(0, 25)) console.log(mb(s).padStart(9), String(c).padStart(8), k.slice(0, 90));
console.log("--- top string groups (by first 60 chars)");
for (const [k, [s, c]] of [...strBuckets].sort((a, b) => b[1][0] - a[1][0]).slice(0, 15)) console.log(mb(s).padStart(9), String(c).padStart(7), k);

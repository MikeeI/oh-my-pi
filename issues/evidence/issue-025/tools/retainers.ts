// Print retainer chains (towards GC roots) for nodes whose name starts with a prefix.
const [file, prefix, maxPaths = "3"] = Bun.argv.slice(2);
const snap = await Bun.file(file).json();
const m = snap.snapshot.meta; const nf = m.node_fields, ef = m.edge_fields; const N = nf.length, E = ef.length;
const nodes: number[] = snap.nodes, edges: number[] = snap.edges, strs: string[] = snap.strings;
const ntypes = m.node_types[0], etypes = m.edge_types[0];
const ti = nf.indexOf("type"), ni = nf.indexOf("name"), eci = nf.indexOf("edge_count"), idi = nf.indexOf("id");
const eti = ef.indexOf("type"), eni = ef.indexOf("name_or_index"), eto = ef.indexOf("to_node");
const count = nodes.length / N;
const firstEdge = new Uint32Array(count + 1);
for (let i = 0, e = 0; i < count; i++) { firstEdge[i] = e; e += nodes[i * N + eci] * E; } firstEdge[count] = edges.length;
// reverse edges
const rc = new Uint32Array(count + 1);
for (let k = 0; k < edges.length; k += E) rc[edges[k + eto] / N + 1]++;
for (let i = 0; i < count; i++) rc[i + 1] += rc[i];
const rfrom = new Uint32Array(edges.length / E), redge = new Uint32Array(edges.length / E), fill = rc.slice();
for (let i = 0; i < count; i++) for (let k = firstEdge[i]; k < firstEdge[i + 1]; k += E) { const t = edges[k + eto] / N; rfrom[fill[t]] = i; redge[fill[t]++] = k; }
const label = (i: number) => `${ntypes[nodes[i * N + ti]]}:${String(strs[nodes[i * N + ni]]).slice(0, 50).replace(/\n/g, "⏎")}`;
const ename = (k: number) => { const t = etypes[edges[k + eti]]; const v = edges[k + eni]; return t === "element" || t === "hidden" ? `[${v}]` : String(strs[v]); };
const targets: number[] = [];
for (let i = 0; i < count && targets.length < Number(maxPaths); i++) if (String(strs[nodes[i * N + ni]]).startsWith(prefix.replace(/⏎/g, "\n")) && ntypes[nodes[i * N + ti]].includes("string")) targets.push(i);
for (const t of targets) {
	// BFS to root (node 0) through reverse edges, skipping weak edges
	const prev = new Int32Array(count).fill(-1), pedge = new Int32Array(count).fill(-1); prev[t] = t; const q = [t]; let found = -1;
	for (let h = 0; h < q.length && found < 0; h++) { const x = q[h]; for (let r = rc[x]; r < rc[x + 1]; r++) { const k = redge[r]; if (etypes[edges[k + eti]] === "weak") continue; const f = rfrom[r]; if (prev[f] !== -1) continue; prev[f] = x; pedge[f] = k; if (f === 0) { found = f; break; } q.push(f); } }
	console.log("=== path for", label(t));
	let cur = found; const chain: string[] = [];
	while (cur !== -1 && cur !== t) { chain.push(`${label(cur)} --${ename(pedge[cur])}-->`); cur = prev[cur]; }
	console.log(chain.slice(0, 40).join("\n"));
}

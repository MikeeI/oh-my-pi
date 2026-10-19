// Fake OpenAI-compatible streaming server for memory experiments.
const LOG = process.env.FAKE_LOG!;
let reqs = 0, done = 0, toolTurn = 0;
const md = (n: number) => {
	let s = `## Antwort ${n}\n\n`;
	for (let i = 0; i < 12; i++) s += `Absatz ${i}: Lorem ipsum **dolor** sit amet, \`code_${i}\` consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.\n\n`;
	s += "| a | b | c |\n|---|---|---|\n"; for (let i = 0; i < 15; i++) s += `| ${i} | wert ${i * 7} | <span style="color:#33AA77">grün ${i}</span> |\n`;
	s += "\n```ts\n"; for (let i = 0; i < 40; i++) s += `const v${i} = compute(${i}, "x".repeat(${i}));\n`; s += "```\n\n- Punkt eins\n- Punkt zwei\n";
	return s;
};
function chunk(obj: unknown) { return `data: ${JSON.stringify(obj)}\n\n`; }
Bun.serve({ port: 18777, idleTimeout: 0, async fetch(req) {
	const url = new URL(req.url);
	if (url.pathname === "/stats") return Response.json({ reqs, done });
	if (url.pathname.endsWith("/models")) return Response.json({ data: [{ id: "fake-1", object: "model" }] });
	const body = await req.json() as any; reqs++;
	const id = `r${reqs}`; const msgs = body.messages ?? []; const last = msgs[msgs.length - 1];
	const tools: string[] = (body.tools ?? []).map((t: any) => t.function?.name);
	for (const t of body.tools ?? []) { const n = t.function?.name; if (["task","yield"].includes(n) && !(globalThis as any)["seen_"+n]) { (globalThis as any)["seen_"+n]=1; Bun.write(`${LOG}/schema-${n}.json`, JSON.stringify(t.function.parameters, null, 1)); } }
	if (reqs <= 2) Bun.write(`${LOG}/req-${reqs}.json`, JSON.stringify({ tools: (body.tools ?? []).filter((t: any) => ["bash", "read"].includes(t.function?.name)), roles: msgs.map((m: any) => m.role) }, null, 1));
	const enc = new TextEncoder();
	const stream = new ReadableStream({ async start(c) {
		const send = (delta: any, finish: string | null = null) => { try { c.enqueue(enc.encode(chunk({ id, object: "chat.completion.chunk", created: 0, model: "fake-1", choices: [{ index: 0, delta, finish_reason: finish }] }))); } catch {} };
		send({ role: "assistant" });
		const isChild = tools.includes("yield");
		if (process.env.FAKE_MODE === "task" && isChild) {
			const hadTool = msgs.some((m: any) => m.role === "tool");
			if (!hadTool) { send({ tool_calls: [{ index: 0, id: `call_${reqs}`, type: "function", function: { name: "read", arguments: JSON.stringify({ i: "read", path: "big.txt" }) } }] }); send({}, "tool_calls"); }
			else if (!msgs.some((m: any) => JSON.stringify(m).includes("yield_done_marker"))) { send({ content: "yield_done_marker" }); send({ tool_calls: [{ index: 0, id: `call_${reqs}`, type: "function", function: { name: "yield", arguments: JSON.stringify(JSON.parse(process.env.FAKE_YIELD ?? '{"i":"done","result":{"data":"ok"}}')) } }] }); send({}, "tool_calls"); }
			else { send({ content: "fertig" }); send({}, "stop"); }
		} else if (process.env.FAKE_MODE === "task" && last?.role === "user" && tools.includes("task") && String(JSON.stringify(last.content)).includes("starte worker")) {
			toolTurn++;
			const tasks = Array.from({ length: 4 }, (_, k) => ({ name: `Worker${toolTurn}x${k}`, task: "Read big.txt and report.", solutionSpace: "closed" }));
			send({ tool_calls: [{ index: 0, id: `call_${reqs}`, type: "function", function: { name: "task", arguments: JSON.stringify({ i: "fan out", context: "memory test", tasks }) } }] }); send({}, "tool_calls");
		} else if (last?.role === "user" && tools.includes("bash") && !String(JSON.stringify(last.content)).includes("summar")) {
			toolTurn++;
			send({ content: `Ich führe Schritt ${toolTurn} aus.` });
			const call = toolTurn % 2 ? { name: "bash", arguments: JSON.stringify({ i: "run", command: `seq 1 4000 | sed 's/^/out ${toolTurn} /'` }) } : { name: "read", arguments: JSON.stringify({ i: "read", path: "big.txt" }) };
			send({ tool_calls: [{ index: 0, id: `call_${reqs}`, type: "function", function: call }] }, null);
			send({}, "tool_calls");
		} else {
			const text = md(reqs);
			for (let i = 0; i < text.length; i += 120) { send({ content: text.slice(i, i + 120) }); await Bun.sleep(2); }
			send({}, "stop");
		}
		c.enqueue(enc.encode(chunk({ id, object: "chat.completion.chunk", created: 0, model: "fake-1", choices: [], usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 } })));
		c.enqueue(enc.encode("data: [DONE]\n\n")); c.close(); done++;
	}, cancel() { done++; } });
	return new Response(stream, { headers: { "content-type": "text/event-stream" } });
} });
console.log("fake up");

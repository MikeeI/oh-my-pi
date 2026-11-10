### Description

With `task.perCallModel` enabled, assigning a model to a role in one omp instance rewrites the `task` tool description of every other running omp session. Their next request then misses the Anthropic prompt cache from the tool definitions onward. On prefix-bound models (`claude-opus-5-5`), the API also drops every earlier signed thinking block with `prefix_binding_mismatch`.

A running session should not change its own wire prompt because a different process changed a role it is not using for its current conversation.

The chain, pinned to `main` at `1379127c07`:

- [`prompts/tools/task.md:25`](https://github.com/can1357/oh-my-pi/blob/1379127c078f978c9908059d31f6dc6c16efbe53/packages/coding-agent/src/prompts/tools/task.md?plain=1#L25) renders `Approved: \`<model>\` (<role>), …` into the tool description. This line was added in #12229.
- [`task/model-approval.ts:231-259`](https://github.com/can1357/oh-my-pi/blob/1379127c078f978c9908059d31f6dc6c16efbe53/packages/coding-agent/src/task/model-approval.ts#L231-L259) builds that list from every configured role value, including `default`. The cache is keyed by the settings revision.
- [`task/index.ts:956-980`](https://github.com/can1357/oh-my-pi/blob/1379127c078f978c9908059d31f6dc6c16efbe53/packages/coding-agent/src/task/index.ts#L956-L980): `description` is a getter, so every request re-renders the list from live settings.
- [`config/settings.ts:1443`](https://github.com/can1357/oh-my-pi/blob/1379127c078f978c9908059d31f6dc6c16efbe53/packages/coding-agent/src/config/settings.ts#L1443) watches the global `config.yml`, and [`:163`](https://github.com/can1357/oh-my-pi/blob/1379127c078f978c9908059d31f6dc6c16efbe53/packages/coding-agent/src/config/settings.ts#L163) reloads it 200 ms after any external write.
- [`modes/controllers/selector-controller.ts:953-956`](https://github.com/can1357/oh-my-pi/blob/1379127c078f978c9908059d31f6dc6c16efbe53/packages/coding-agent/src/modes/controllers/selector-controller.ts#L953-L956): a model-hub role assignment persists to the global layer while `modelRoleStorage` keeps its default `global`.

Each part works as intended on its own. Before #12229, a reloaded role value changed only which model later spawns would use. Since #12229, the same reload changes the prompt bytes of every live session.

Observed on one live session (omp 18.18.6, Anthropic OAuth, `claude-opus-5-5`). A second omp instance assigned `anthropic/claude-sonnet-5-5:medium` to the Default role at 13:30:07Z, and that instance's session log records `model_change` with `role: default` at 13:30:07.788Z. The shared `config.yml` mtime is 13:30:07.908Z.

| Request (UTC) | Tool-schema tokens | cache_read | cache_creation |
| --- | ---: | ---: | ---: |
| 13:30:10, before the edit reached this session | 13,167 | 0 | 110,495 |
| 13:30:54, first request after the edit | 13,191 | 37,491 | 75,454 |
| 13:30:57, next request | 13,191 | 112,945 | 9,509 |

The 13:30:10 row is itself a full miss. The other instance had already made an earlier Default assignment at 13:29:39.573Z, about 0.5 s before that request was sent. Its persisted value is not logged, so treat that row as probable rather than proven. That request returned 16 `thinking_dropped` / `prefix_binding_mismatch` transformations starting at `messages.0.content.1`.

### Steps to Reproduce

Deterministic, with no network and no provider. Save the script below as `packages/coding-agent/repro-cross-process.ts` on `main` and run `bun repro-cross-process.ts` from `packages/coding-agent`. A separate OS process rewrites `config.yml`, which is what a second omp instance's model hub does.

<details><summary>repro-cross-process.ts</summary>

```ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { TaskTool } from "@oh-my-pi/pi-coding-agent/task";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";

const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-xproc-agent-"));
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omp-xproc-cwd-"));
const configPath = path.join(agentDir, "config.yml");
const config = (defaultModel: string) =>
	`task:\n  perCallModel: "on"\nmodelRoles:\n  default: ${defaultModel}\n  slow: openai/gpt-5.5\n`;
fs.writeFileSync(configPath, config("anthropic/claude-opus-4-6"));

const settings = await Settings.init({ agentDir, cwd });
settings.startWatching();
const tool = await TaskTool.create({
	cwd,
	hasUI: false,
	settings,
	getSessionFile: () => null,
	getSessionSpawns: () => "*",
	getPlanModeState: () => undefined,
} as unknown as ToolSession);

const before = tool.description;
console.log("before:", before.match(/Approved: [^\n]*?;/)?.[0]);

const child = Bun.spawnSync([
	"bun",
	"-e",
	`require("node:fs").writeFileSync(${JSON.stringify(configPath)}, ${JSON.stringify(config("anthropic/claude-sonnet-4-6"))})`,
]);
if (child.exitCode !== 0) throw new Error(`writer process failed: ${child.stderr.toString()}`);
await Bun.sleep(1500);

const after = tool.description;
console.log("after: ", after.match(/Approved: [^\n]*?;/)?.[0]);
console.log("description changed:", before !== after, `(${before.length} -> ${after.length} chars)`);
settings.stopWatching();
process.exit(0);
```

</details>

Output on `main` at `1379127c07`:

```text
before: Approved: `anthropic/claude-opus-4-6` (default), `openai/gpt-5.5` (slow);
after:  Approved: `anthropic/claude-sonnet-4-6` (default), `openai/gpt-5.5` (slow);
description changed: true (4144 -> 4146 chars)
```

As a control, the same script with `perCallModel: "off"` prints `description changed: false`.

End to end:

1. Set `task.perCallModel: on` in the global `config.yml`.
2. Start two omp instances, A and B.
3. Hold a few turns in A on an Anthropic model.
4. In B, assign a different model to the Default role in the model hub.
5. Send the next message in A. `cache_read_input_tokens` drops to the tool-prefix boundary or to 0, and almost the whole conversation is written again. On `claude-opus-5-5`, the response also carries `input_transformations` of type `thinking_dropped` with reason `prefix_binding_mismatch`.

### Expected Behavior

A running session's tool definitions stay byte-stable when another process edits the global settings. A role change made elsewhere should reach a running session only where its cache is cold anyway, for example at compaction, after idling past the TTL, or on that session's own model change. Alternatively it could arrive as an appended notice. #18400 already holds the MCP roster this way for prefix-bound prompts.

### Error Output

```shell
{"level":"warn","message":"anthropic: dropped thinking block after conversation prefix changed","model":"claude-opus-5-5","count":16,"path":"messages.0.content.1"}
{"level":"debug","message":"anthropic: API re-dropped previously reported thinking blocks","model":"claude-opus-5-5","count":17}
```

### Platform

Linux

### omp version

omp/18.18.6. Also reproduced from source on `main` at `1379127c07`.

### Bun version

1.4.4

### Provider

Anthropic (Claude Pro/Max)

### Area

Model selection

### Additional context

- Related: #18400 fixed the same class of problem for live MCP roster changes in prefix-bound prompts by holding the committed roster. The per-call advertisement is another live input that enters the bound prefix.
- Related, with a different trigger: #14443 covers prefix-binding drops reported on a speculative-compaction side request. #12571 covers keeping `drop_block`-dropped thinking on the wire.
- Not in conflict with #8574 or #6458, which ask for settings to propagate across instances. Propagation can stay. Only the rewrite of an in-flight conversation's prompt is the problem.
- The same getter also reads `task.disabledAgents`, isolation, and effort settings live. Role values are what a routine UI action in another instance changes.
- Workaround: `task.perCallModel: off`, or switch models per session without assigning a role.
- The live observation came from a personal fork that overrides the bundled `task.md` text. The reproduction above uses unmodified `main`.

Question: would you rather hold the per-call advertisement per session, as #18400 does for the roster, or keep role values out of the tool description and resolve them only at dispatch?

I checked the relevant issues, comments, pull requests, and discussions; this report is not a duplicate.

I am reporting this finding only and am not currently proposing a pull request.

### Disclosure

Investigated thoroughly with Claude Opus 5.5 (high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

I thoroughly reviewed this contribution with Claude Opus 5.5 (high reasoning effort).

This report is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.

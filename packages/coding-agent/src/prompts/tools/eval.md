One cell per call; top-level state persists, including across compaction and `task` children.{{#if spawns}} `agent()` children have separate kernels.{{/if}}
Use Eval to compute, transform, drive a protocol, or preserve state; use native Read for inspection.
In-cell concurrency: `parallel(thunks)`; NEVER call injected helpers or `tool.*` from user-created workers or subprocesses.
Keep large raw tool results separate or pass handles; inspect unknown result shapes before parsing or indexing.
{{#if spawns}}{{#if eagerDelegation}}For 2+ independent items, use a named `workpool()`; results auto-deliver.{{#if waitTool}} If blocked, leave `eval` and call `wait`.{{/if}}{{/if}}{{/if}}
{{#if py}}Python: top-level `await` works; `asyncio.run(…)` fails.{{/if}}
{{#if js}}JS: Bun (`Bun.file`, `Bun.write`, `Bun.$`); top-level `await`/`return` work. Await `parallel(…)` and `pipeline(…)`.{{/if}}
On error, retry only the failed step; earlier steps may have taken effect.
One failed thunk re-raises after all settle; catch inside each thunk for partial results.

<prelude>
{{#ifAll py js}}Python helpers: sync, kwargs; JS helpers: async, ONE trailing options object.{{else}}{{#if py}}Sync; kwargs.{{/if}}{{#if js}}Async; ONE trailing options object.{{/if}}{{/ifAll}}
```
display(value)  print(value, ...)  log(message)  phase(title)
read(path, offset?, limit?)  write(path, content)  env(key?, value?)  output(*ids, format?, query?, offset?, limit?)
{{#if js}}await {{/if}}tool.<name>(args) — session tool; `args` is its parameter object
wait(handles, timeout?=None, raise_errors?=True) — agent/completion barrier, ordered results{{#if js}}; JS: wait(handles, { timeout, raiseErrors }){{/if}}; `raise_errors=False` retains failures.
```
</prelude>

{{#if inlineTopics}}
{{{inlineTopics}}}
{{else}}
<namespaces>
More globals; `read` the linked docs before first use:
- `judge`, `{{#if py}}judge_batch{{else}}judgeBatch{{/if}}`, `completion`: classification, bulk judgment, model calls → `xd://eval/judge`
- `%load`{{#if py}}, `%pip`{{/if}}{{#if js}}, `%bun add`{{/if}}, `budget`{{#if evalTools}}, `@tool`/`tool(fn)`{{/if}}: setup, installs, utilities → `xd://eval/helpers`
{{#if spawns}}
- `agent`, `workpool`: background subagents, DAG waves → `xd://eval/agents`
{{/if}}
{{#each preludes}}
- `{{name}}`: {{summary}} → `xd://eval/{{name}}`
{{/each}}
</namespaces>
{{/if}}

<critical>
Use only names established by successful cells in the current live kernel.
Existing binding? Reuse it. After `reset` or kernel crash, rerun setup once.
After installing a missing dependency, retry its failed import, not the whole failed cell.
Re-read only if the file changed.
</critical>

{{#if autoBackgroundEnabled}}Long cells may auto-background and deliver later; the kernel stays busy. `timeout: 0` disables the cell deadline, not the foreground wait.{{/if}}

# System Prompt Customization

How the coding agent assembles its system prompt and what users can control through files and CLI flags.
The controllable files are `SYSTEM.template.md`, `SYSTEM.md`, `APPEND_SYSTEM.md`, and `TITLE_SYSTEM.md`.
Programmatic API options are called out where they expose the same routes or full replacement.

Primary implementation:

- `packages/coding-agent/src/main.ts` (`applyResolvedSystemPromptInputs`)
- `packages/coding-agent/src/sdk.ts` (`CreateAgentSessionOptions`, prompt construction)
- `packages/coding-agent/src/system-prompt.ts` (`discoverSystemPromptOverride`, `buildSystemPrompt`, `BuildSystemPromptOptions`)
- `packages/coding-agent/src/prompts/system/system-prompt.md` (default instruction template)
- `packages/coding-agent/src/prompts/system/custom-system-prompt.md` (plain `SYSTEM.md` template)
- `packages/coding-agent/src/prompts/system/project-prompt.md` (generated `<project-context>` footer)
- `packages/coding-agent/src/prompts/system/workspace-prompt.md` (generated `<workspace-context>` block)

## Block layout and prompt caching

The provider-facing prompt is an ordered block array.
Static, cwd-independent blocks come first: block 0 (the default, custom, or template instruction block) and eval-prelude guidance.
Working-directory-derived sections follow in two trailing blocks.
The project footer opens with `<project-context>` and stays stable across sessions in one directory:

- workstation data;
- context files with their paths (`<repo-rules>`);
- `<dir-context>` pointers;
- the final completion requirements;
- the append text.

The workspace block opens with `<workspace-context>` and carries state that changes within one directory:

- `<workspace-tree>` and `<workspace-roots>`;
- active nested-repository context.

The workspace block is omitted when none of its sections render.
Task subagents append their per-spawn role/assignment block after these blocks.

On Anthropic, the system cache breakpoint lands on the last block before the first `<project-context>` or `<memories>` block.
Sessions and subagent spawns of the same agent in different directories therefore share the static prompt as a cached prefix.
One example is one git worktree per task.
When a breakpoint stays free after message anchoring, as on a session's first request, it lands on the `<project-context>` footer.
New sessions in the same directory then also read the project footer from cache; the mtime-ordered workspace tree stays outside it.
Later turns spend both message breakpoints, which already cover the footer, and the tool-definition breakpoint stays in place.
Other providers receive the same ordered blocks.

## Inputs and precedence

- `--system-template <path>` (CLI): strictly reads `<path>` as Handlebars source and replaces the bundled default instruction block.
  It has the highest custom-prompt precedence.
- `--system-prompt <text-or-file>` (CLI): the existing plain-text custom route, with the highest custom-prompt precedence.
  It is mutually exclusive with the template flag.
- `SYSTEM.template.md` (discovered config file): raw Handlebars source.
  It is used only when no explicit override and no discovered `SYSTEM.md` is supplied.
- `SYSTEM.md` (discovered config file): the existing plain-text custom route, used only when no explicit override is supplied.
- `--append-system-prompt <text-or-file>` (CLI): adds plain text to the rendered prompt, with the highest append precedence.
- `APPEND_SYSTEM.md` (discovered config file): the existing plain-text append route, used when the append flag is absent.

**CLI precedence:** An explicit `--system-prompt` or `--system-template` flag wins over discovered `SYSTEM.template.md` and `SYSTEM.md`.
An explicit `--append-system-prompt` wins over discovered `APPEND_SYSTEM.md`.
The two custom-prompt flags are mutually exclusive, and supplying both fails clearly.
An explicitly supplied empty `--system-prompt` literal still counts as explicit and suppresses custom-prompt discovery.

Programmatic API options use separate contracts, not CLI flags; see [Programmatic API options](#programmatic-api-options).

That empty literal suppresses discovered `SYSTEM.md` and `SYSTEM.template.md`, but does not disable OMP-generated instructions.
Only the programmatic `CreateAgentSessionOptions.systemPrompt` full-replacement option does that.

Without an explicit custom source, discovery is project-first, then user-level.
Within each scope a literal beats a template.
Project `SYSTEM.md` beats project `SYSTEM.template.md`, which beats user `SYSTEM.md`, which beats user `SYSTEM.template.md`.
`SYSTEM.md` is the long-established override.
An existing literal therefore keeps working until its author deliberately removes it in favor of a template.
Project `SYSTEM.md` and `SYSTEM.template.md` resolve from the nearest non-empty ancestor `.omp`.
From a nested cwd, that is typically the repo-root `.omp`.
`.agent` / `.agents` directories are not template sources.
`.claude`, `.codex`, and `.gemini` project bases resolve at the launch cwd.
Foreign user bases require `enabledProviders` opt-in; `CLAUDE_CONFIG_DIR` also opts in and relocates the Claude user base.

The native user path follows the active profile: with `omp --profile work`, `~/.omp/agent` becomes `~/.omp/profiles/work/agent`.
`PI_CONFIG_DIR` changes the native config-directory name.
Capability discovery for `SYSTEM.md` uses `getAgentDir()` and therefore honors `PI_CODING_AGENT_DIR`.
The shared config-base lookup for `APPEND_SYSTEM.md` and `TITLE_SYSTEM.md` does not use that variable as an arbitrary replacement base.
An explicit CLI flag or programmatic API option still wins over every discovered file.
See [Configuration usage](./config-usage.md) for the shared config-directory contract.

`--system-template <path>` is a strict file path.
A missing, unreadable, empty, or non-regular path is an error, never a literal prompt.
Every discovered `SYSTEM.template.md` is mandatory.
An empty, unreadable, dangling, or malformed template fails startup with an error naming the template file.
It never falls back to another prompt.
A same-scope literal always wins discovery, so a template beside a literal is never rendered and OMP warns that it is ignored.
Later runtime rebuilds re-render the selected template source.

### Text or file resolution

The existing plain-text flags keep their resolution rules.
For a single-line `--system-prompt` or `--append-system-prompt` value, OMP first tries to read that value as a file path.
If reading fails because the path does not exist (or is too long to be a path), the value is used literally.
A value containing a newline is used literally without a file read.
Other file-read failures are logged and the original value is still used literally.
This fallback does **not** apply to `--system-template`.

## What plain `SYSTEM.md` replaces

`SYSTEM.md` does not become a raw, sole system message.
The CLI stores it as `CreateAgentSessionOptions.customSystemPrompt`.
`buildSystemPrompt` then renders `custom-system-prompt.md` instead of the default `system-prompt.md`.

The plain custom template keeps these generated surfaces:

- the custom text;
- discovered skills;
- always-apply rules and the rulebook listing;
- secret-redaction guidance when enabled.

The separate `<project-context>` footer remains and carries:

- workstation data;
- discovered context files;
- deeper-directory context pointers;
- the final completion requirements;
- the append text.

The `<workspace-context>` block follows with optional workspace information and active nested-repository context.
Optional extra system blocks, such as computer-tool safety, also remain when applicable.
Provider-callable tool schemas are still generated by the provider-facing session.

What disappears is the content unique to the default instruction template:

- its built-in role/personality text;
- tool inventory and general tool policy;
- the internal-URL catalog;
- exploration/delegation/workflow rules;
- `xd://` protocol guidance.

Generated skills and rules are **not** lost; the bundled plain custom template renders them explicitly.

Consequences:

- To add a few instructions while retaining the complete default prompt, use only `APPEND_SYSTEM.md` or `--append-system-prompt`.
- To replace the default instruction template but keep the bundled plain-custom generated sections, use `SYSTEM.md` or `--system-prompt`.
- If a plain custom prompt still needs the default tool policy or workflow, copy and maintain the required guidance yourself.
  Selective inheritance from `system-prompt.md` is not supported.

### Append placement

Without `SYSTEM.md` or `SYSTEM.template.md`, append text is rendered at the end of `project-prompt.md`.
It follows the default instruction block and project/environment content.

With `SYSTEM.md`, append text is also rendered at the end of `project-prompt.md`.
`custom-system-prompt.md` carries the custom text, skills, and rules.
The footer, with context files and append text, follows that block.

With `SYSTEM.template.md` (or `--system-template`), append text remains generated by the normal project/footer route.
The raw template controls block 0 and does not receive an implicit copy of the append text.

OMP-generated append content (for enabled memory/auto-learn features and MCP guidance) is combined before the user-supplied append text.
Those generated blocks can end with `## MCP Server Instructions`, whose text declares itself server-controlled and unverified.
Whenever a generated block precedes the user-supplied text, the text is rendered under its own `## User Instructions` heading.
That heading keeps it from reading as a trailing paragraph of a server-owned section.
On its own — no generated block — the append text is emitted unchanged, without a heading.

## Inputs by session type

Which automatic inputs reach each kind of session.
An input applies only when it exists or is enabled, and Personality means the default template's personality block.
Advisors build a dedicated prompt that also carries memory instructions and the shared and per-advisor instructions.
`@path` imports in `WATCHDOG.md` are expanded.

| Input                                         | Main session | Task subagent | Advisor/watchdog |
| --------------------------------------------- | ------------ | ------------- | ---------------- |
| `AGENTS.md`                                   | Discovered   | Not inherited | Inherited        |
| `CLAUDE.md` / `GEMINI.md`                     | Discovered   | Inherited     | Inherited        |
| `APPEND_SYSTEM.md` / `--append-system-prompt` | Yes          | No            | No               |
| MCP tools                                     | Yes          | Inherited     | No               |
| MCP server instructions                       | Yes          | Inherited     | No               |
| `WATCHDOG.md`                                 | No           | No            | Yes              |
| Personality                                   | Configured   | `none`        | None             |

1. Task subagents exclude inherited and newly discovered `AGENTS.md` files, including user context and additional roots.
   Explicit `--agents-file` replacements are also excluded regardless of filename.
   Text pulled in through `@` imports of retained files is not filtered.
2. Context discovery selects one user file and one project file per directory depth, and higher-priority providers win.
   Foreign user files require `enabledProviders` opt-in.
   A standalone `CLAUDE.md` is supported; `GEMINI.md` is read from the user and project `.gemini` directories.
3. A task agent's `tools:` list does not remove MCP tools or server instructions.
   The tools stay available top-level or under `xd://`.
   Plan-mode tasks and children of restricted sessions run with `restrictToolNames`, which drops both.

## Handlebars template route

`SYSTEM.template.md` and `--system-template <path>` select raw Handlebars source from a file.
Programmatic callers can instead pass raw Handlebars source through `CreateAgentSessionOptions.systemPromptTemplate` or `buildSystemPrompt({ systemPromptTemplate })`.
Those programmatic options are the template itself, not a path.
Each route is rendered instead of the bundled `system-prompt.md` with the same live data and registered helpers as that bundled template.

Generated blocks outside block 0 remain normal and are retained:

- the `<project-context>` footer with generated context and append material, and the `<workspace-context>` block with workspace and active nested-repository context;
- computer safety;
- provider tool schemas.

Data-driven sections that normally live inside the bundled template are not appended by magic.
`skills`, `rules`, `alwaysApplyRules`, `toolInventory`, `internalUrls`, `xdevTools`, and `xdevDocs` are available to the template.
Each is emitted only if the template references it.
`internalUrls` renders one line per internal URL scheme available in the session.
In particular, omitting `{{toolInventory}}` or `{{xdevDocs}}` omits that in-block catalog.
Mount-notice dedupe follows the rendered output.
A template whose block 0 contains an `xd://` reference claims the catalog; one that omits it does not.

The generated project/footer route already renders `contextFiles` and `appendPrompt` once.
A template SHOULD NOT render those fields in block 0 unless it intentionally wants duplicate copies.

Use effective session settings and live tool data rather than copying today's rendered prose.
`subagent` is true when rendering a task subagent's prompt.
The bundled templates use it to replace verification duties with a hand-off to the main agent.
`eagerTasks` and `eagerTasksAlways` reflect task settings captured when the session starts.
`xdevDocs`, `toolInventory`, and `toolRefs` reflect mounted devices and tool state whenever the prompt rebuilds.
`xdevDocs` also reflects the `tools.xdevDocs` / `tools.xdevInlineDevices` settings used for that rebuild.

The template has the same helper set as the bundled prompt: `if`, `each`, `unless`, `list`, `when`, `has`, `ifAny`, `includes`, and the other registered helpers.
No extra helper is created for a user file.
Values inserted into a template are data, not a second template pass.
Handlebars-looking text inside `xdevDocs`, context files, tool descriptions, or other values is not recursively rendered.

Treat both sides of this boundary as prompt input.
Protect template files like other system-level configuration.
Review workspace, extension, MCP, and mounted-device descriptions before treating them as trusted policy.
Dynamic xdev metadata can be third-party text.
The CLI reads a template file once at launch.
Programmatic raw source is already in memory.
Later runtime prompt rebuilds re-render that in-memory source with current live data and settings, but do not re-read a changed file.
Restart OMP after editing the file.

## Plain-text and template contracts

`SYSTEM.md`, `APPEND_SYSTEM.md`, `--system-prompt`, and `--append-system-prompt` remain plain text.
They are values inserted into bundled Handlebars templates; their contents are not recursively compiled as Handlebars.

For example, if `SYSTEM.md` contains:

```handlebars
Working in
{{cwd}}
on
{{date}}.
{{#if internalUrls.length}}Internal URLs available.{{/if}}
```

those characters reach the model literally.
Internal values such as `cwd`, `skills`, `rules`, and `toolRefs` remain private implementation details for the plain route.
The calendar date is not exposed as a template value.
It rides a per-request reminder on the first user turn together with the session cwd.

Only the opt-in `SYSTEM.template.md` / `--system-template` / programmatic `CreateAgentSessionOptions.systemPromptTemplate` and `buildSystemPrompt({ systemPromptTemplate })` routes compile Handlebars.
A malformed or empty template fails clearly and is never downgraded to plain text or to the bundled prompt.

## Recipes

### Add rules to the default prompt

Create `APPEND_SYSTEM.md` without a `SYSTEM.md` or `SYSTEM.template.md`:

```text
# ~/.omp/agent/APPEND_SYSTEM.md
Prefer Bun APIs over Node APIs in this project.
When you change a public function, run `bun check` before yielding.
```

### Supply a custom base prompt

```text
# <cwd>/.omp/SYSTEM.md
You are a code reviewer. Read changes, surface concrete issues, and never edit files.
Cite paths with backticks.
```

OMP still adds the generated context, skills, rules, and project/environment footer.
It does not add the default instruction template's tool and workflow guidance.

### Migrate the bundled prompt

1. Copy `packages/coding-agent/src/prompts/system/system-prompt.md` to `~/.omp/agent/SYSTEM.template.md` or `<cwd>/.omp/SYSTEM.template.md`.
2. Edit the prose while keeping the required Handlebars blocks and live-data placeholders.
3. NEVER copy a rendered `/dump` prompt: it freezes settings, tool catalogs, and mounted-device data.
4. Diff your template against the shipped source path when updating OMP.
5. Remove or rename any same-scope `SYSTEM.md`.
   A discovered literal beats a discovered template, so the template takes effect only once the literal is gone.

### Supply a Handlebars template

Create `<cwd>/.omp/SYSTEM.template.md` (or pass the same file to `--system-template`):

```handlebars
# Delegation
{{#if eagerTasksAlways}}
After settling the design, MUST delegate substantial work through `{{toolRefs.task}}`.
{{else}}
{{#if eagerTasks}}
After settling the design, SHOULD delegate substantial work through `{{toolRefs.task}}`.
{{else}}
Delegate only when the request or repository guidance calls for it.
{{/if}}
{{/if}}

# Tools
{{toolInventory}}

{{#if xdevTools.length}}
## xd:// protocol
Write JSON args as `content` to `xd://<tool>` via `{{toolRefs.write}}`.
{{xdevDocs}}
{{/if}}
```

This is a complete, runnable Handlebars Markdown template.
It uses only built-in block helpers and live fields.
It deliberately references `eagerTasksAlways`, `eagerTasks`, `toolInventory`, `xdevTools`, `toolRefs`, and `xdevDocs`.
Omitted fields would not be inserted automatically.

### Replace the personality block

The default template renders a personality block chosen by the `personality` setting (`default`, `friendly`, `pragmatic`, `none`).
A user-level `PERSONALITY.md` replaces the selected preset's text:

```text
# ~/.omp/agent/PERSONALITY.md
Follow ASD-STE100 Simplified Technical English for all responses.
```

Only the agent directory is checked: `~/.omp/agent` by default, profile- and XDG-aware.
There is no project-level or other-config-base lookup.
`personality: none` still omits the block entirely; subagents always run with `none`.
An empty or unreadable file falls back to the configured preset with a logged warning.

### Customize automatic session titles

`SYSTEM.md` and `APPEND_SYSTEM.md` do not affect title-generation calls.
Use `TITLE_SYSTEM.md`:

```text
# ~/.omp/agent/TITLE_SYSTEM.md
Generate a session name using lowercase `<type>:<primary-objective>`.
If the message has no concrete task, output exactly `none`.
```

`TITLE_SYSTEM.md` uses project-first config-base discovery with no ancestor walk.
Foreign user bases require `enabledProviders` opt-in (or `CLAUDE_CONFIG_DIR` for Claude).
When it is absent, OMP titles a new session from a fork of its first reply, using the session's own model on the cached prompt.
The bundled tiny-model title prompt is the fallback.
The override is used for both initial automatic titles and replan-driven title refreshes.
It turns the reply fork off, so titles come from the tiny title model.

Generated title output has an enforced normalization contract even with a custom prompt.
OMP considers only the first trimmed line.
It strips surrounding quotes, `<title>...</title>` markers, and terminal punctuation.
It treats `none` or `<title/>` as “no title yet.”
A result longer than 80 characters or 12 words is rejected rather than truncated.
Empty, deferred, or rejected output leaves the session unnamed, so a later eligible title attempt can name it.

## Programmatic API options

Programmatic API callers use separate options, not CLI flags:

- `CreateAgentSessionOptions.systemPromptTemplate` and `buildSystemPrompt({ systemPromptTemplate })` take raw Handlebars source;
- `CreateAgentSessionOptions.customSystemPrompt` is already-loaded literal text;
- `buildSystemPrompt`'s `customPrompt` is plain text with path-or-literal resolution, and `resolvedCustomPrompt` is already-loaded text.

A template source and literal custom prompt cannot be combined.
`systemPromptTemplate` conflicts with `customSystemPrompt` in `CreateAgentSessionOptions`.
It also conflicts with `customPrompt` / `resolvedCustomPrompt` in `buildSystemPrompt`.
These combinations fail clearly instead of silently choosing one.

## Full provider-facing replacement (programmatic API only)

`CreateAgentSessionOptions.systemPrompt` is a different, lower-level programmatic API.
A fixed string or array—including an empty string or array—replaces every OMP-generated block.
It bypasses discovery and rendering of an unused system-prompt template.
It does not bypass option validation.
Defining both `systemPromptTemplate` and `customSystemPrompt` is rejected even when either value is empty.
The same rejection applies when `systemPrompt` is a fixed replacement.
A callback instead receives the generated block array after normal template/custom assembly and returns its replacement.
Normal template discovery and errors apply to that route.
Either form can omit all generated context and safety blocks.

`CreateAgentSessionOptions.systemPromptTemplate` is the compositional programmatic API described above.
It accepts raw Handlebars source, replaces block 0, and keeps the OMP-generated footer, safety blocks, and provider tool schemas.
That footer includes context, active-repository context, and append text.
It is mutually exclusive with `customSystemPrompt`.
The exported `buildSystemPrompt({ systemPromptTemplate })` option has the same raw-text contract and conflict behavior.
Its `customPrompt` option remains plain text with path-or-literal resolution.

The CLI flags and files do **not** set `systemPrompt`.
They select the plain/template custom route and append route, which continue through the OMP-generated blocks described above.

## Quick reference

- Add instructions while keeping the complete default prompt: `APPEND_SYSTEM.md` or `--append-system-prompt`.
- Replace the default instruction block with plain text: `SYSTEM.md` or `--system-prompt`.
- Replace the default instruction block with Handlebars: `SYSTEM.template.md` or `--system-template <path>`.
- Supply raw Handlebars through the programmatic API: `CreateAgentSessionOptions.systemPromptTemplate` or `buildSystemPrompt({ systemPromptTemplate })`.
- Replace every provider-facing system block: `CreateAgentSessionOptions.systemPrompt`.
- Customize automatic session titles: `TITLE_SYSTEM.md`.
- Replace the personality block while keeping the rest of the default prompt: `PERSONALITY.md`.
- Use `{{cwd}}` or other internal variables in a plain user file: not supported; plain user content is inserted verbatim.
- Include live settings, tool inventory, or xdev docs in a template: reference the corresponding Handlebars fields.
  Examples are `{{eagerTasks}}`, `{{toolInventory}}`, and `{{xdevDocs}}`.
- Inherit selected default-template sections automatically: not supported; a template must reference the data it needs.
- Per-directory override: a supported project config base.
  Native `.omp` and `.agent` / `.agents` custom prompts also support ancestor discovery.
- Global override: the active native agent directory, or another supported user config base.

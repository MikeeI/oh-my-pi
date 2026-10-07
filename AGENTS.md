# Development Rules

## Fork Identity

MOMP is an opinionated personal fork of Oh My Pi.
It adds deliberate workflow and behavior changes while staying as close as practical to `can1357/oh-my-pi`.
Keep fork-specific changes small and isolated so `personal` can be repeatedly rebased onto current upstream releases.
Align fork changes with upstream ownership boundaries to minimize rebase conflicts.
Prefer upstream behavior when it already satisfies the fork contract; NEVER duplicate functionality already owned upstream.
`main` mirrors `upstream/main` and MUST remain free of MOMP-only changes.
`personal` is the MOMP development and release branch; it carries the minimal fork patchstack.
When upstream implements a MOMP contract, remove the redundant fork patch instead of preserving its historical shape.

### Mobile Terminal Environment

- The user runs MOMP through Termius and tmux on iPads and iPhones.
- Device rotation changes pane width and height; showing or hiding the software keyboard changes available height.
- Rapid, reversed, and repeated resize bursts are routine use, not exceptional stress cases.
- Resize and scrollback integrity remain recurring challenges, including upstream regressions and incomplete fixes.
- `MOMP-SCROLLBACK` verification MUST cover continued interaction after resize, not only the settled frame or Stop.
- Detached tmux reproductions and unit tests do not prove Termius/iOS behavior; report that boundary explicitly.

### Fork Delta Decision

Every MOMP-only delta MUST name the current observable contract that upstream does not satisfy.
Observable contracts include CLI behavior, tool behavior, prompt behavior, runtime behavior, and operator workflows.
Historical presence in the fork is not evidence that a delta is still required.
An old integration commit is provenance, not an active product requirement.
No current contract means no justified fork delta.

Before adding or reapplying fork behavior, inspect the current upstream owner, callers, tests, and configuration.
Treat earlier upgrade assessments and historical implementation assumptions as stale until current upstream confirms them.
Reuse current upstream behavior whenever it satisfies the contract.
Prefer an existing upstream setting, extension point, helper, or ownership boundary over new fork code.
An upstream-owned file without an active MOMP contract SHOULD remain byte-identical to upstream.
NEVER retain formatting, wording, aliases, or historical edits merely because they existed in an older MOMP release.

Implement a necessary delta at the ownership boundary used by current upstream.
NEVER add a MOMP wrapper, duplicate helper, or parallel policy beside an upstream owner that can be extended directly.
Keep the delta's API surface, changed-file set, and dependency closure as small as the contract permits.
Generic improvements SHOULD be designed as independently upstreamable changes.
Publishing branches, pull requests, issues, or comments upstream requires explicit user instruction.
Until upstream adopts a generic improvement, retain only the smallest necessary fork delta.

Use this decision sequence for every proposed MOMP-only change:

1. State the current observable contract.
2. Identify the exact current upstream owner.
3. Prove that current upstream does not already satisfy the contract.
4. Prefer configuration or an existing extension point when it preserves the contract.
5. Change the smallest complete ownership-aligned closure.
6. Name the focused behavioral proof.
7. Decide whether the result should remain MOMP-specific or be designed for upstream.

Classify every active fork contract during an upstream assessment:

- `UPSTREAM-GEDECKT`: Current upstream fully satisfies the contract; remove the redundant fork closure.
- `UPSTREAM-INTEGRIERT`: A current upstream owner already makes this class of decision; retain only its minimal delta.
- `MOMP-EIGEN`: MOMP adds a distinct capability or workflow with a new primary owner; retain its minimal closure.

Integration call sites alone NEVER make a distinct MOMP capability `UPSTREAM-INTEGRIERT`.

Classify every retained operational experiment, diagnostic, benchmark, fixture, or migration artifact outside the active inventory:
Issue-owned historical evidence follows [its retention policy](#experiments-and-non-contract-artifacts).

- `NICHT-CONTRACT-AKTIV`: A current repeatable consumer exists; name it and retain only the complete closure.
- `NICHT-CONTRACT-ENTFERNEN`: No current repeatable consumer exists; remove the complete closure during authorized cleanup.

Active-contract dispositions and non-contract states are disjoint.
NEVER place non-contract artifacts in the active inventory or use them to justify runtime retention.
Every classification MUST name the owner, required action, and behavioral proof or repeatable consumer.

### Current Active MOMP Contract Inventory

This section is the authoritative SSOT for active MOMP source behavior and its source-facing index.
A fork delta that cannot be assigned to an entry below is unqualified and MUST be investigated before retention.
`project-momp-upgrader` consumes this inventory.
It owns upgrade assessment, packaging, publishing, installation, and release smoke.
Source behavior changes MUST update this inventory in the same source change.
Upgrade workflow documentation and automation MUST reference entries instead of restating their contracts.
Keep this inventory current when adding, removing, upstreaming, or reclassifying a contract.

Each entry names its disposition, observable behavior, implementation owner, and focused proof.
Contract IDs are canonical fourth-level headings inside this inventory, ending before `Experiments and non-contract artifacts`.
The upgrader validates these IDs against its executable and manual proof mappings without deriving tests from prose.

- `Contract` defines required observable behavior, including explicit user constraints and externally consumed formats.
- `Implementation constraint` records a necessary current mechanism and its rationale, not a permanent implementation shape.
- `Proof` identifies focused verification; its presence alone does not assert that the verification currently passes.
- `Verification gap` records missing or failing evidence without weakening the associated contract.

#### `MOMP-PROMPT-MAIN` — Main prompt customization

- Disposition: `MOMP-EIGEN`.
- Contract: `SYSTEM.template.md` is the canonical MOMP Handlebars Main template source.
- Contract: raw `--system-prompt`, `SYSTEM.md`, `APPEND_SYSTEM.md`, and `--append-system-prompt` remain literal.
- Contract: precedence is explicit raw prompt, project raw, project template, user raw, user template, built-in base.
- Contract: raw and template siblings select raw and surface the suppression warning.
- Contract: an absent template permits the built-in base; every discovered or explicit template is mandatory.
- Contract: mandatory templates MUST be readable, non-empty, and valid; failure terminates prompt construction.
- Contract: inline SDK templates reject whitespace-only content before rendering.
- Contract: dangling discovered template symlinks remain mandatory selections instead of permitting fallback.
- Contract: `SYSTEM_TEMPLATE.md` is not an accepted alias for the canonical MOMP filename.
- Contract: provider-facing base and project blocks remain separate and ordered.
- Contract: ACP sessions resolve prompt sources from the target workspace rather than the launch directory.
- Contract: runtime tool-registry rebuilds preserve the selected sources while refreshing dynamic tool state.
- Owner: `src/system-prompt.ts` owns source discovery, precedence, loading, and rendering.
- Owner: `src/config.ts#findConfigFileWithMeta` preserves dangling entries for mandatory prompt discovery.
- Owner: `src/main.ts` maps discovered sources into Main-session construction.
- Owner: `src/capability/system-prompt.ts#systemPromptCapability` owns raw `SYSTEM.md` capability metadata.
- Reason: upstream v18.2.7 added an analogous `SYSTEM_TEMPLATE.md` interface with fallback semantics.
- Reason: its filename and discovered-template fallback do not satisfy the mandatory MOMP contract.
- Required action: retain the MOMP filename, discovery, precedence, loading, and mandatory failure behavior.
- Proof: `test/system-prompt-templates.test.ts`.
- Proof: prompt-source cases in `test/acp-mcp-isolation.test.ts`.
- Proof: `test/agent-session-tool-rebuild-skip.test.ts`.

#### `MOMP-WORKSTATION-CONTEXT` — Compact execution context

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: workstation context identifies current execution as `user@host`.
- Contract: OS context combines distribution, OS type and release, and architecture in one line.
- Contract: workstation context surfaces the current IANA timezone.
- Owner: current upstream `src/system-prompt.ts#getEnvironmentInfo` owns workstation context rendering.
- Required action: extend that owner directly; never add a parallel fork prompt block.
- Proof: `test/system-prompt-kernel.test.ts`.

#### `MOMP-PROMPT-CHILD` — Fresh Child prompt composition

- Disposition: `MOMP-EIGEN`.
- Contract: fresh Child base precedence is project template, user template, then the upstream fallback.
- Contract: wrapper precedence is project `SUBAGENT-SYSTEM.template.md`, user template, then bundled wrapper.
- Contract: a selected Child base controls block zero and suppresses raw and append discovery for that fresh render.
- Contract: Task, Eval, Vibe, and nested Children reload selections from their logical `cwd`.
- Contract: live follow-ups retain the rendered prompt and cold revives retain persisted prompt bytes.
- Contract: Children never inherit parent-selected raw, append, explicit, base-template, or wrapper-template state.
- Contract: Children never inherit the Main conversation, rendered Main prompt, or full parent `AGENTS.md` context.
- Contract: the Child wrapper follows upstream project-context blocks so fresh Child prompt prefixes remain stable.
- Contract: the selected Child wrapper preserves item-indexed workpool `yield` and ordinary `data`/`error` semantics.
- Contract: dangling Child base and wrapper template symlinks fail instead of selecting lower-priority sources.
- Owner: `src/system-prompt.ts` owns base and wrapper discovery.
- Owner: `src/task/subagent-system-prompt.ts#resolveSubagentSystemPrompt` loads the selected wrapper snapshot.
- Owner: `src/task/subagent-system-prompt.ts#createSubagentSystemPromptTransform` renders and inserts its provider block.
- Owner: upstream `src/task/executor.ts#buildSubagentSessionOptions` composes fresh and warm-revived Child sessions.
- Owner: `src/task/executor.ts#runSubprocess` captures selected sources in the upstream plain session spec.
- Owner: upstream `src/task/executor.ts#createSubagentSettings` owns shared Child settings.
- Owner: `src/task/subagent-runtime-config.ts#resolveSubagentCapabilities` owns shared Child capability resolution.
- Owner: the active project-settings `SUBAGENT-SYSTEM.template.md` owns live Child yield guidance.
- Reason: current upstream has no Child base-template and wrapper-template composition capability.
- Reason: upstream v18.4.10 warm revivers retain plain spawn inputs rather than the executor's live run graph.
- Coverage: upstream v18.6.3 persists Child prompt blocks and refreshes them when the effective base or workpool changes.
- Owner: upstream `src/session/agent-session.ts#recordModelCallSystemPrompt` owns persisted prompt refresh.
- Required action: retain Child template composition at the current upstream fresh-Child construction seams.
- Required action: pass normalized parent task depth to the current completion-probe owner after capability resolution.
- Required action: keep source snapshots in that spec and recreate transforms without retaining live sessions.
- Proof: `test/task/subagent-system-template.test.ts`.
- Proof: `test/context-file-inheritance.test.ts`.
- Proof: `test/task/workpool.test.ts` and rendering both branches of the active Child wrapper.
- Proof: dangling Child base and wrapper cases in `test/system-prompt-templates.test.ts`.

#### `MOMP-PROMPT-OVERRIDES` — Process-scoped Main overrides

- Disposition: `MOMP-EIGEN`.
- Contract: `--system-template <path>` selects an explicit Handlebars Main template for this process.
- Contract: `--system-prompt-template` is not an accepted alias for canonical `--system-template`.
- Contract: `--agents-file <path>` replaces only user-level `AGENTS.md` while retaining project discovery.
- Contract: both flags support spaced and equals syntax, relative paths, `~`, and regular-file symlinks.
- Contract: explicit empty, missing, unreadable, and non-regular paths fail.
- Contract: an explicit AGENTS file rejects whitespace-only content before replacing discovered user context.
- Contract: `--system-template` and `--system-prompt` are mutually exclusive.
- Contract: overrides apply consistently to interactive, print, ACP, SDK, and Main inspection paths.
- Contract: overrides never persist into settings, session headers, resume, continue, or fresh Children.
- Contract: arbitrary `--agents-file` filenames remain semantically typed as AGENTS context.
- Contract: override changes invalidate inherited provider prompt-cache affinity.
- Owner: `src/cli/args.ts` and `src/cli/flag-tables.ts` own CLI parsing.
- Owner: `src/system-prompt.ts` owns strict path resolution and context replacement.
- Owner: `src/main.ts` and `src/sdk.ts` own process/session propagation.
- Reason: upstream v18.2.7 has analogous `--system-prompt-template`, but not MOMP's canonical flag or `--agents-file`.
- Required action: retain both MOMP process-only overrides at the current CLI and prompt-resolution seams.
- Proof: `test/cli-agents-file.test.ts`.
- Proof: `test/system-prompt-templates.test.ts`.

#### `MOMP-TOOL-PROMPT-OVERRIDES` — Profile-scoped tool guidance

- Disposition: `MOMP-EIGEN`.
- Contract: `prompts/tools/read.md`, `bash.md`, `task.md`, `lsp.md`, `eval.md`, `web-search.md`, and `glob.md` under the active user agent directory override their bundled tool descriptions.
- Contract: an absent override uses the corresponding bundled tool prompt as the sole default.
- Contract: a selected empty, unreadable, or non-regular override fails instead of silently falling back.
- Contract: each selected source renders through the same tool-owned variables as its bundled prompt.
- Contract: prompt overrides never replace tool names, schemas, or runtime behavior.
- Owner: `src/prompts/tool-prompt-source.ts` owns profile-scoped discovery, fallback, and file validation.
- Owner: `src/tools/read.ts#ReadTool`, `src/tools/bash.ts#BashTool`, `src/task/index.ts#TaskTool`, `src/lsp/tool.ts#LspTool`, `src/tools/eval.ts#EvalTool`, and `src/web/search/index.ts#WebSearchTool` render their selected sources.
- Owner: `src/tools/glob.ts#GlobTool` renders the selected Glob prompt.
- Implementation constraint: Glob validates its selected source before memo lookup and keys rendering by source and flags.
- Implementation constraint: Web Search freezes auth-dependent guidance per tool instance to isolate profile prompt sources.
- Reason: current upstream has no profile-scoped override for a built-in tool prompt.
- Required action: retain strict overrides for Read, Bash, Task, LSP, Eval, Web Search, and Glob at their description owners.
- Required action: include every managed tool override in upstream prompt-drift review and release settings-drift checks.
- Proof: override and fallback cases in `test/tools/tool-prompt-overrides.test.ts`.

#### `MOMP-AST-GREP-PAGING` — Actionable AST search pagination

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: truncated `ast_grep` results give the model and TUI the next `skip` offset.
- Contract: the tool calculates that offset from normalized `skip` and the number of matches returned on the current page.
- Contract: historical results without the offset advise narrowing `path` instead of increasing the unavailable public `limit`.
- Owner: upstream `src/tools/ast-grep.ts#AstGrepTool` owns pagination and model-visible output.
- Owner: upstream `packages/tui/src/tools/ast-grep.ts#astGrepToolRenderer` owns TUI rendering and the result metadata type.
- Reason: current upstream suggests increasing `limit` although the agent-facing tool schema exposes only `skip`.
- Required action: retain the minimal upstream-owner delta until upstream gives both consumers actionable pagination guidance.
- Proof: the model-and-TUI pagination contract in `test/tools/ast-grep.test.ts`.

#### `MOMP-AGENT-PROMPT-OVERRIDES` — Profile-scoped agent templates

- Disposition: `MOMP-EIGEN`.
- Contract: `prompts/agents/` under the active user agent directory overrides the matching bundled templates.
- Contract: supported sources are `scout.md`, `reviewer.md`, `security-reviewer.md`, `task.md`, `frontmatter.md`, `init.md`, and `model-mention.md`.
- Contract: absent sources use bundled defaults; selected empty, unreadable, non-regular, or invalid sources fail.
- Contract: regular-file symlinks are supported; dangling symlinks fail instead of selecting bundled defaults.
- Contract: agent templates retain their built-in names and non-empty bodies after rendering and parsing.
- Contract: Task and Sonic share `task.md` and render distinct metadata through `frontmatter.md`.
- Contract: project, user, and plugin agent definitions retain precedence over the built-in agent tier.
- Contract: profile overrides are re-read for fresh discovery; immutable embedded defaults remain separately cached.
- Contract: Task discovery snapshots are profile-isolated; restarting MOMP refreshes all advertised and command templates.
- Contract: Agents Hub and plugin reloads refresh Task discovery under the active session profile.
- Contract: tagged-model and Vibe worker agents use the owning session's configuration directory.
- Contract: existing live or persisted Child prompt bytes are not rewritten by template edits.
- Contract: changing the security-reviewer source invalidates a security plan's workflow fingerprint.
- Owner: `src/prompts/user-prompt-source.ts` owns the shared strict Tool and Agent override file boundary.
- Owner: `src/task/agents.ts` owns agent rendering and parsing; `src/task/discovery.ts` retains discovery precedence.
- Owner: `src/task/index.ts` and `src/task/structured-subagent.ts` use the session profile for Task and Eval discovery.
- Owner: upstream `src/task/structured-subagent.ts#discoverAgentsShared` keys in-flight scans by the active profile.
- Owner: `src/modes/agents-hub-deps.ts#createAgentsHubDeps` uses its Settings profile for discovery and save refresh.
- Owner: TUI `src/slash-commands/builtin-marketplace.ts#reloadTuiPluginState` and ACP/RPC reload refresh that profile.
- Owner: `src/task/command-templates.ts` and `src/session/model-mentions.ts` render init and tagged-model templates.
- Owner: `src/session/agent-session.ts` passes its configuration directory to the tagged-model template owner.
- Owner: `src/task/index.ts#refreshAgentDiscovery` publishes profile-keyed snapshots to live Task descriptions.
- Owner: `src/security/coordinator.ts` fingerprints the selected security-reviewer source.
- Owner: project-settings `data/sync/agent/prompts/agents/` owns editable deployed copies.
- Reason: upstream embeds these templates and cannot load them from profile `prompts/agents/`.
- Required action: keep bundled templates upstream-identical and apply strict overrides at their existing consumers.
- Required action: include every managed agent override in upstream prompt-drift review and release settings-drift checks.
- Proof: `test/task/agent-prompt-overrides.test.ts` and `test/tools/tool-prompt-overrides.test.ts`.
- Proof: concurrent profile isolation in `test/task/structured-subagent.test.ts`.
- Proof: ACP `/reload-plugins` cases in `test/acp-agent.test.ts`.
- Proof: session-profile cases in `test/session/model-mentions.test.ts` and reload cases in `test/rpc.test.ts`.
- Proof: `system-prompt inspect --subagent scout --json` against the source CLI and deployed Settings templates.

#### `MOMP-PROMPT-INSPECT` — Provider prompt inspection

- Disposition: `MOMP-EIGEN`.
- Contract: `momp system-prompt inspect` exposes provider blocks, dynamic parts, token breakdown, or Codex wire hashes.
- Contract: `--provider`, `--dynamic-parts`, `--breakdown`, and `--codex-wire-hash` are mutually exclusive.
- Contract: `--subagent <name>` previews a configured fresh top-level Child through runtime composition owners.
- Contract: Child inspection reports configured-preview fidelity and omitted invocation-only state.
- Contract: breakdown measures provider prompts, tool prompts, tool schemas, dynamic parts, and dynamic sources.
- Contract: dynamic parts attribute the complete inline `xd://` protocol, built-in docs, schemas, and device catalog.
- Contract: `--first-message <text>` is Main-only and requires `--breakdown` or `--codex-wire-hash`.
- Contract: first-message inspection captures the final request after runtime message injection.
- Contract: offline capture includes non-consuming SDK option decoration without redeeming fallback credits.
- Contract: ordinary Main and Child inspection uses Main-loop dialect preparation without committing request history.
- Contract: provider-added blocks have `provider-call` attribution and contribute once to provider prompt totals.
- Contract: JSON breakdown output exposes exact request messages plus per-message and aggregate token measurements.
- Contract: `--codex-wire-hash` hashes the actual transformed Main SSE body and cache-relevant components.
- Contract: wire-hash output exposes no prompt text, tool schema, cache key, or credential.
- Contract: first-message and wire-hash inspection perform no provider network call.
- Usage: `momp system-prompt inspect --cwd <workspace> --first-message "<text>" --breakdown --json`.
- Usage: `momp system-prompt inspect --model <codex-model> --first-message "<text>" --codex-wire-hash --json`.
- Contract: large text and JSON outputs finish writing and remain complete before process exit.
- Contract: Main inspection is not accepted as proof of Child loading.
- Owner: `src/commands/system-prompt.ts` owns command grammar, measurement, and output.
- Owner: `src/system-prompt.ts` owns opt-in counterfactual dynamic-fragment capture.
- Owner: `src/task/subagent-system-prompt.ts` owns inspected Child composition.
- Owner: `src/system-prompt.ts#SYSTEM_PROMPT_PART_PROBES` attributes upstream Mermaid, SVG, and table-chart guidance.
- Owner: upstream `src/task/executor.ts#createSubagentSettings` owns the inspected Child's settings.
- Owner: `src/task/subagent-runtime-config.ts#resolveSubagentCapabilities` owns its capability resolution.
- Owner: `packages/agent/src/agent-loop.ts#prepareProviderCall` owns shared provider-context preparation.
- Owner: `packages/agent/src/agent.ts#prepareModelCall` exposes non-dispatching configured preview preparation.
- Owner: `src/sdk.ts` applies Main and Settings stream-option decoration before offline capture and real dispatch.
- Reason: current upstream has no provider-prompt inspection command or equivalent offline measurement workflow.
- Required action: retain one MOMP inspection command using runtime prompt-composition owners.
- Proof: `test/system-prompt-inspect.test.ts`.
- Proof: `test/system-prompt-templates.test.ts`.
- Proof: captured options serialize through the real Codex body owner in `test/sdk-tool-activation.test.ts`.
- Proof: live/preview dialect parity in `packages/agent/test/agent-side-request-context.test.ts`.

#### `MOMP-TASK-POLICY` — Profile delegation guidance

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: a custom `SYSTEM.template.md` carries task policy because it replaces the built-in Main template.
- Contract: GPT-5.6 default mode requires user, `AGENTS.md`, or skill authorization before delegation.
- Contract: GPT-5.6 eager mode allows proactive delegation.
- Contract: GPT-6 and newer models retain upstream restrained delegation; eager mode follows the upstream policy.
- Contract: fan-out, concurrency, IRC, and peer-coordination instructions render from current upstream template inputs.
- Coverage: upstream requires task `solutionSpace` to describe design openness rather than work volume.
- Coverage: upstream maps task `effort` values to the target model's lowest, middle, and highest levels.
- Coverage: omitted task `effort` preserves configured thinking selection; `task.maxEffort` remains the ceiling.
- Coverage: model switches select the target model's policy even when model identity is hidden.
- Owner: upstream `src/task/prompt-policy.ts#sessionDelegationBias` resolves the active model's delegation bias.
- Owner: upstream `packages/catalog/src/compat/delegation.ts` resolves delegation policy from catalog rules.
- Owner: upstream `src/prompts/system/system-prompt.md#Delegation` owns bundled policy.
- Owner: the active project-settings `SYSTEM.template.md` owns the live policy text.
- Owner: upstream `src/prompts/tools/task.md` owns bundled fallback task-effort guidance.
- Owner: upstream `src/task/types.ts#taskSchema` owns the required `solutionSpace` field and its wire shape.
- Owner: the project-settings `task.md` override owns precise model-visible target-model effort guidance.
- Owner: `src/system-prompt.ts` owns the render inputs and template selection.
- Coverage: the delegation resolver, catalog policy, Task schema, and bundled Task prompt match upstream v18.6.2.
- Required action: preserve upstream delegation resolution, policy rules, and Task schema without duplicate fork policy.
- Coverage: upstream v18.8.2 removes per-call `model` from Task, Eval `agent()`, and `workpool()`.
- Contract: model selection stays owned by Settings, agent definitions, and upstream extension policy.
- Required action: remove stale per-call model guidance from the active Task override without adding a substitute API.
- Required action: keep the bundled Task prompt byte-identical to upstream.
- Required action: retain MOMP-specific policy and effort guidance in the active Settings templates.
- Proof: candidate prompt rendering through `momp system-prompt inspect`.
- Proof: `test/system-prompt-templates.test.ts`.
- Proof: effort-description cases in `test/task/task-schema.test.ts`.

#### `MOMP-EVAL-OUTPUT` — Large owner-result preservation

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: Eval keeps large raw tool results separate or passes handles instead of re-emitting them.
- Coverage: upstream Eval aggregation, tool orchestration, shell, and subprocess capabilities remain unchanged.
- Owner: the project-settings `eval.md` override owns model-visible result-handling guidance; the bundled Eval prompt stays byte-identical to upstream.
- Required action: retain the profile override and model-visible result-handling guidance in Settings.
- Required action: do not add a separate Eval runtime restriction for this guidance.
- Proof: profile override and fallback cases in `test/tools/tool-prompt-overrides.test.ts`.

#### `MOMP-EVAL-ROUTING` — Context-safe Eval orchestration

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: native Read owns inspection unless Eval must compute over file contents.
- Contract: independent directly exposed native tool operations run outside Eval.
- Contract: injected helpers and `tool.*` never run in user-created workers or subprocesses.
- Contract: Eval treats tool results as unknown until their owner or inspected shape establishes a type.
- Contract: Eval uses only state established by successful cells in the current live kernel.
- Coverage: upstream gives fresh Task and Eval `agent()` Children independent kernels without parent top-level state.
- Coverage: concurrent Eval cells in one live session can overwrite top-level names.
- Contract: use unique names or recompute state in-cell when concurrent Eval cells share a live session.
- Owner: the project-settings `eval.md` override owns model-visible Eval routing and failure guidance.
- Owner: upstream `src/session/agent-session.ts` owns per-Child kernel identity; Eval backends key retained state by session.
- Required action: retain routing guidance aligned with the current upstream Eval runtime split in Settings.
- Required action: reuse upstream kernel isolation without a parallel fork implementation.
- Proof: profile override and fallback cases in `test/tools/tool-prompt-overrides.test.ts`.
- Proof: runtime semantics in Eval workflow, bridge-policy, Python-prelude, and JavaScript-executor tests.
- Proof: render the active Eval tool description and inspect its concurrent-name guidance.
- Proof: isolation-policy cases in `test/eval/agent-bridge-policy.test.ts`.

#### `MOMP-READ-SKILL-COMPACT` — Compact skill-read display

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: `read skill://` calls collapse into the compact grouped read view like `xd://` device reads.
- Contract: collapsed skill loads stay expandable so their full resolved content remains visible.
- Contract: the full skill body still reaches the model; collapsing is display-only and never trims load-bearing content.
- Owner: `src/internal-urls/skill-protocol.ts#SkillProtocolHandler.spec` declares compact skill grouping.
- Owner: upstream `packages/tui/src/chat/read-tool-group.ts#readArgsCollapseIntoGroup` applies the registered scheme policy.
- Owner: `packages/tui/src/chat/read-tool-group.ts#shouldRenderPreview` keeps expanded skill loads visible when ordinary previews are disabled.
- Required action: retain compact skill grouping and the display-only expanded-skill preview exception.
- Proof: `test/read-tool-group.test.ts`.

#### `MOMP-READ-SCHEDULING` — Provider-roundtrip-efficient reads

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: the bundled Read prompt stays byte-identical to upstream.
- Contract: the active profile guides parallel independent reads through `MOMP-TOOL-PROMPT-OVERRIDES`.
- Owner: the project-settings `read.md` override owns model-visible parallel scheduling guidance.
- Owner: upstream `packages/agent/src/agent-loop.ts#executeToolCalls` owns sibling-tool concurrency.
- Coverage: upstream concurrently executes compatible sibling tool calls already issued by the model.
- Required action: retain profile scheduling guidance and reuse upstream concurrency without a parallel Read scheduler.
- Proof: bundled prompt equality against current `upstream/main`.
- Proof: profile override and fallback cases in `test/tools/tool-prompt-overrides.test.ts`.
- Proof: sibling concurrency in `packages/agent/test/agent-loop.test.ts`.

#### `MOMP-READ-ARTIFACT-RECOVERY` — Exact output-artifact recovery

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: middle-elided results expose the exact omitted range in complete artifacts without repeating preserved output.
- Contract: capped artifacts advertise head/tail samples, never recovery selectors for bytes that were not saved.
- Owner: `packages/tui/src/tools/output-meta.ts#formatTruncationMetaNotice` owns exact recovery references.
- Reason: upstream v18.4.9 caps output artifacts; original stream coordinates do not address their omitted middle.
- Required action: retain only the runtime artifact-recovery deltas at the current output-metadata owner.
- Proof: artifact spill recovery in `test/tools.test.ts`.
- Proof: capped middle-elision recovery in `test/streaming-output.test.ts`.

#### `MOMP-READ-ARCHIVE-FRESHNESS` — Fresh archive indexes across Read calls

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: a later archive Read observes an in-place rewrite even when size and restored mtime match.
- Contract: timestamp-coincident writes never reuse an earlier archive member index.
- Owner: upstream `src/tools/read-archive.ts#readArchive` owns opening the current archive index.
- Reason: upstream's cross-call stat-keyed cache can return old members when a rapid rewrite also preserves ctime.
- Required action: reopen through `openArchive` per Read without hashing whole payloads or retaining the unsafe cache.
- Proof: the same-size, restored-mtime archive rewrite case in `test/tools.test.ts`.
- Trade-off: repeated reads re-index ZIP, ASAR, and ISO members instead of reusing an unprovable snapshot.

#### `MOMP-READ-USER-AGENTS` — URL fetch identity fallback

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: URL fetches without a caller-supplied User-Agent try pinned-current Chrome, Googlebot Smartphone, then curl.
- Contract: recognized bot blocks and transport failures advance to the next identity.
- Contract: HTTP 429 retries retain the current identity.
- Owner: `src/web/scrapers/types.ts#loadPage` owns request identity and fallback order.
- Required action: retain the minimal identity-order delta at the current upstream fetch owner.
- Proof: `test/web-scraper-user-agent.test.ts`.
- Source: https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers
- Source: Chrome Stable 155.0.8059.39, verified 2026-10-06: https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json
- Source: curl 8.22.0, verified 2026-10-06: https://curl.se/download.html

#### `MOMP-WEB-SEARCH-PARALLEL` — Provider-roundtrip-efficient searches

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: before searching, the model collects all independent queries required for the current step.
- Contract: independent queries prefer parallel sibling `web_search` calls in one assistant turn.
- Contract: sequential searches are reserved for queries determined by prior results.
- Owner: the project-settings `web-search.md` override owns model-visible search scheduling guidance; the bundled prompt stays byte-identical to upstream.
- Owner: upstream `packages/agent/src/agent-loop.ts#executeToolCalls` owns shared sibling-tool concurrency.
- Coverage: upstream concurrently executes compatible sibling tool calls already issued by the model.
- Required action: retain the profile override and model-visible scheduling guidance in Settings.
- Required action: do not add a Web Search-specific scheduler for this guidance.
- Proof: profile override and fallback cases in `test/tools/tool-prompt-overrides.test.ts`.

#### `MOMP-TREE-COMPACT` — Token-efficient directory context

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: the system-prompt workspace tree omits size and mtime columns.
- Contract: Read directory trees retain file sizes and relative mtimes with single-space separators.
- Contract: both views retain names, hierarchy, ordering, depth, limits, and elision behavior.
- Owner: `packages/coding-agent/src/workspace-tree.ts` owns both render modes.
- Required action: retain both render-mode deltas at the current upstream workspace-tree owner.
- Proof: `packages/coding-agent/test/workspace-tree.test.ts`.
- Retention: active source and test deltas remain until upstream satisfies both contracts.

#### `MOMP-ROUTINES` — User-defined sequential routines

- Disposition: `MOMP-EIGEN`.
- Contract: YAML routines discover as slash-style commands from the user routines directory.
- Contract: TUI, ACP, RPC, and SDK session paths advertise and execute routines consistently.
- Contract: opt-in bare-slash recognition includes routine names and retains session-bound confirmation before dispatch.
- Contract: names conflict-check against all built-in and discovered command namespaces.
- Contract: rejected ACP or RPC routine reloads retain the previous valid command registry.
- Contract: RPC clients surface reload rejection instead of silently accepting invalid candidate state.
- Contract: failed directory scans reject routine reloads; only an absent routine directory is optional.
- Contract: duplicate or conflicting routines fail before command advertisement.
- Contract: autocomplete shows the declared description without synthetic routine suffixes.
- Contract: execution serializes active routine work and reports progress.
- Contract: a terminal step failure stops the routine, reports failed, and prevents subsequent steps.
- Contract: cancellation reports cancelled, including during the final step, and never reports complete afterward.
- Contract: complete is reported only after every planned step finishes successfully.
- Contract: idle-only snapshot forks reject active routines, including pauses between their turns.
- Contract: cancellation cleans routine lifecycle state.
- Contract: routines never weaken file-command or prompt-template precedence.
- Owner: `src/capability/routine.ts` owns the capability contract.
- Owner: `src/discovery/routines.ts` owns discovery.
- Owner: `src/discovery/helpers.ts#loadFilesFromDir` preserves scan failures for strict routine loading.
- Owner: `src/extensibility/routines.ts` owns parsing, validation, planning, and progress formatting.
- Owner: `src/task/command-templates.ts` owns the embedded command-template source that keeps routine discovery acyclic.
- Owner: `src/session/agent-session.ts` owns execution and lifecycle serialization.
- Owner: `src/modes/rpc/rpc-mode.ts` serializes command refreshes and retains the last validated advertisement.
- Owner: upstream `src/session/agent-session.ts#isBusyForSnapshot` owns the shared snapshot busy decision.
- Owner: upstream `src/modes/rpc/wire/state.ts#stateDefs` owns the command-source enum for every generated RPC SDK.
- Reason: current upstream has no routine capability, routine registry, or sequential routine execution workflow.
- Required action: retain one MOMP routine capability and its transport integrations.
- Required action: check cancellation and terminal step outcomes before advancing or reporting completion.
- Required action: include routine sources through the wire registry and regenerate its TypeScript, Python, Rust, and Go clients.
- Proof: `test/routines.test.ts`.
- Proof: `test/agent-session-routine-lock.test.ts`.
- Proof: `test/input-controller-routine.test.ts`.
- Proof: `test/interactive-mode-routine-autocomplete.test.ts`.
- Proof: routine cases in `test/rpc.test.ts` and ACP tests.
- Proof: `test/rpc-wire/conformance.types.ts` and `test/rpc-wire/generated.test.ts`.

#### `MOMP-COMMAND-UX` — Rename, argument completion, and slash-list display

- Disposition: `UPSTREAM-INTEGRIERT`.
- Coverage: upstream `/rename <title>` stores an explicit user-owned title.
- Contract: blank `/rename` generates a title from recent user and Assistant transcript context.
- Contract: generated title input omits tools, thinking, and code fences.
- Contract: title generation ignores Assistant follow-up questions unless a later user reply selects or answers them.
- Contract: blank manual `/rename` generation carries `AUTO:` while remaining replaceable; automatic first-input and replan titles remain replaceable without that marker.
- Contract: `/rename` arguments keep `@` and `#` literal.
- Coverage: upstream command-specific completion wins when it has a result.
- Contract: absent command-specific completion falls through unless the command declares exclusive completion.
- Contract: autocomplete and submission use one command-owned argument-completion mode.
- Contract: slash-command autocomplete rows never display emojis or type-indicator icons, regardless of theme or symbol preset.
- Owner: `src/utils/title-generator.ts` owns transcript formatting and the rendered transcript title prompt.
- Owner: upstream `src/session/agent-session.ts#renameTitle` selects transcript guidance and preserves title-card semantics.
- Owner: upstream `src/session/agent-session.ts#generateTitle` owns inference, cancellation, redaction, and session guards.
- Owner: `src/prompts/system/title-transcript-system.md` owns transcript title guidance.
- Owner: `src/slash-commands/types.ts` owns argument-completion semantics.
- Owner: TUI, ACP, and RPC command routers own transport-specific invocation only.
- Owner: `src/modes/interactive-mode.ts#rebuildSlashCommandAutocomplete` clears icons before provider construction.
- Reason: current upstream owns title generation, slash-command metadata, and autocomplete.
- Coverage: upstream already generates blank rename titles from conversation context through session-owned inference.
- Coverage: upstream v18.8.7 moves rename composition into `AgentSession.renameTitle`; routers only invoke that owner.
- Reason: MOMP retains transcript guidance, replaceable `AUTO:` titles, command-owned completion, and icon suppression.
- Required action: retain only rename, argument-completion, and icon-policy deltas at current upstream command seams.
- Required action: keep one session-owned rename generation path without an unused alternate transcript-inference closure.
- Proof: `test/title-generator.test.ts`.
- Proof: `test/command-controller-rename.test.ts`.
- Proof: rename cases in `test/acp-builtins.test.ts` and `test/slash-commands/rename.test.ts`.
- Proof: `packages/tui/test/prompt-action-autocomplete.test.ts`.

#### `MOMP-CONVERSATION-SEARCH` — Persisted conversation lookup

- Disposition: `MOMP-EIGEN`.
- Reason: current upstream has no persisted-conversation lexical search tool or equivalent benchmark.

##### Lookup behavior

- Contract: `conversation_search` searches persisted Main conversations without model calls.
- Contract: omitted scope and window search the current project over the last 10 days.
- Contract: the active session, tool traffic, thinking, developer messages, and hidden synthetic inputs are excluded.
- Contract: only visible human user and Assistant text participates in matching and excerpts.
- Contract: all-term and phrase modes are deterministic and case-insensitive.
- Contract: phrase matching preserves internal whitespace after trimming outer query whitespace.
- Contract: excerpts use source-text offsets even when Unicode lowercasing changes string length.
- Contract: local selection and global ranking share one ordering with stable identity tie-breakers.
- Contract: smaller limits return prefixes of larger results for an unchanged corpus and fixed search time.
- Contract: bounded text and JSON output returns newest matches with explicit partial-coverage diagnostics.
- Contract: enumeration, stat, and session-read failures contribute to partial-coverage diagnostics.
- Contract: an empty discovered corpus never conceals a discovery failure as a complete search.
- Contract: Children never receive the tool.
- Owner: `src/session/conversation-corpus.ts` owns visible transcript projection and journal discovery.
- Owner: upstream `src/session/session-listing.ts` owns session enumeration, scanning, and discovery-error reporting.
- Owner: upstream `src/session/session-storage.ts#FileSessionStorage.listFilesSync` preserves filesystem enumeration errors.
- Owner: `src/session/conversation-search.ts` owns lexical matching, windowing, ranking, and coverage accounting.
- Owner: `src/tools/conversation-search.ts` owns the tool boundary and Main-only exposure.
- Owner: `src/tools/conversation-search-format.ts` owns output variants.
- Required action: retain one Main-only MOMP tool and its complete search closure.
- Required action: preserve discovery failures through search coverage accounting.
- Proof: `test/conversation-search.test.ts`.

##### Benchmark behavior

- Contract: the benchmark uses a fixed guaranteed-miss query and records effective warmup and measured-run counts.
- Contract: its corpus fingerprint identifies selected session-file paths, sizes, and modification times.
- Contract: incomplete discovery or scan coverage invalidates a benchmark run.
- Contract: disappearing selected files, changed file metadata or visible-message counts, and unexpected matches invalidate a run.
- Usage: `bun --cwd packages/coding-agent run bench:conversation-search -- --cwd <workspace>`.
- Owner: `scripts/bench-conversation-search.ts` owns the reproducible local evaluator and output.
- Required action: preserve discovery failures through benchmark validation.
- Proof: `test/conversation-search-benchmark.test.ts`.

#### `MOMP-CACHE-MISS-COLOR` — Prominent cache-miss foreground

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: enabled cache-miss markers use lemon yellow `#FFFF00` for their terminal label and short rule by default.
- Contract: native marker labels use the same semantic color; existing text, geometry, and detection remain unchanged.
- Contract: optional theme color `cacheMiss` overrides only this marker without changing `muted`, `dim`, or `warning`.
- Contract: themes without `cacheMiss` retain compatibility and receive the default in terminal, native, and export palettes.
- Owner: upstream `packages/tui/src/chat/cache-invalidation-marker.ts` owns marker presentation.
- Owner: `packages/tui/src/theme/schema.ts` owns the token and its default.
- Owner: upstream `packages/tui/src/theme/color.ts#resolveThemeColors` materializes the optional default.
- Owner: upstream `packages/tui/src/native/spans.ts` owns ANSI-to-native color mapping.
- Reason: current upstream renders the marker label as `muted` and its rule as `dim`.
- Required action: retain the marker-specific token and palette integration without changing general theme colors.
- Proof: `packages/tui/test/cache-invalidation-marker.test.ts`.
- Proof: render the real marker in a TUI and inspect its foreground and unchanged geometry.

#### `MOMP-RUNTIME-AUDIT` — Repeatable local performance evidence

- Disposition: `MOMP-EIGEN`.
- Contract: one local command captures CPU, heap lifecycle, test timing, and exact compiled-bundle evidence.
- Contract: CPU scenarios cover cold pre-paint boot, the smoke path, and complete prompt inspection without provider calls.
- Contract: cold pre-paint boot runs under a pseudo-terminal because the CLI rejects headless interactive startup.
- Contract: the heap scenario repeatedly creates, fills, disposes, and garbage-collects real `AgentSession` instances.
- Contract: lifecycle timings use a fixed test set and repetition count so runs remain directly comparable.
- Contract: bundle evidence comes from the production compile owner with its plugins, defines, generated inputs, and externals.
- Contract: outputs default to an absolute reports path outside the source tree and support an explicit output directory.
- Contract: scenario failures stop the audit and retain captured stdout and stderr for diagnosis.
- Contract: manifests identify source commit, dirty worktree fingerprint, and effective configuration with provenance.
- Contract: manifests distinguish source CLI measurements and cold pre-paint boot from installed CLI behavior.
- Contract: reports retain the exact compiled artifact with its final SHA-256, size, and target identity.
- Contract: source or effective configuration changes during an audit invalidate its measurements.
- Usage: `bun --cwd=packages/coding-agent run profile:runtime`.
- Owner: `packages/coding-agent/scripts/profile-runtime.ts` owns orchestration, parameters, manifest, and bundle summary.
- Owner: `packages/coding-agent/scripts/profile-runtime-heap-scenario.ts` owns deterministic retained-heap exercise and sampling.
- Owner: `packages/coding-agent/scripts/compile-binary.ts` owns optional exact bundle metadata collection.
- Owner: `packages/coding-agent/scripts/build-binary.ts` owns production-build metadata emission.
- Reason: current upstream has no aggregate local runtime-audit command or equivalent repeatable artifact contract.
- Required action: retain one MOMP audit workflow using current production compile owners.
- Proof: run the usage command and verify every artifact named by `manifest.json` exists after successful completion.

#### `MOMP-CODEX-CACHE-PROBE` — Explicit breakpoint endpoint evidence

- Disposition: `MOMP-EIGEN`.
- Contract: `omp bench <model> --codex-cache-breakpoint-probe --json` is a synthetic provider capability probe.
- Contract: the probe is not evidence of Main-session prompt-cache reuse.
- Contract: each pair uses distinct provider session IDs, one stable cache key, and independent SSE requests.
- Contract: a forced WebSocket environment override rejects the SSE probe before credential or provider operations.
- Contract: the stable synthetic prefix remains identical while the variable suffix changes between requests.
- Contract: both requests carry explicit GPT-5.6 cache options and a latest-stable-message breakpoint.
- Contract: JSON reports endpoint acceptance, observed wire fields, cache usage, session distinctness, and failures.
- Contract: probe output never emits the stable prefix, cache key, or suffix payload.
- Owner: `packages/ai/src/providers/openai-shared.ts` owns shared Responses breakpoint placement.
- Owner: `packages/ai/src/providers/openai-codex-responses.ts` owns Codex request construction.
- Owner: `packages/ai/src/stream.ts#mapOptionsForApi` preserves explicit cache options on the Codex surface.
- Owner: `packages/coding-agent/src/cli/bench-cli.ts` owns probe execution and measurements.
- Owner: `packages/coding-agent/src/commands/bench.ts` owns CLI exposure and usage.
- Reason: current upstream has no explicit synthetic Codex cache-breakpoint capability probe.
- Required action: retain one MOMP probe at the current provider request and bench-command seams.
- Proof: `packages/ai/test/openai-codex-responses-lite.test.ts`.
- Proof: `packages/coding-agent/test/bench-cache.test.ts`.
- Usage: `omp bench openai-codex/gpt-5.6-luna --codex-cache-breakpoint-probe --json`.

#### `MOMP-REMOTE-COMPACTION-TAKEOVER` — Preserve running remote compaction

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: automatic remote maintenance adopts eligible running remote speculation instead of restarting it.
- Contract: crossing the threshold or grace cap alone never cancels an eligible remote snapshot.
- Contract: adoption requires async compaction, remote method selection, and no `session_before_compact` interceptor.
- Contract: maintenance owns cancellation and reports its active lifecycle before waiting, so new input remains queued.
- Contract: the wait uses the remaining remote timeout measured from speculative launch, without renewing its budget.
- Contract: existing provider deadlines remain effective during adoption.
- Contract: explicit maintenance or snapshot cancellation ends the wait without fallback or a late history commit.
- Contract: failed or timed-out adopted work advances to the next configured method when available.
- Contract: completed snapshots pass the existing branch, replay-compatibility, and headroom checks before commit.
- Contract: invalid snapshots are discarded before preparing fresh work against the current branch.
- Contract: a valid adopted snapshot commits once and preserves messages and tool exchanges appended after its snapshot.
- Contract: manual maintenance, async opt-out, intercepting extensions, and other methods retain their existing policy.
- Owner: upstream `src/session/session-maintenance.ts#SessionMaintenance` owns speculation and automatic maintenance.
- Owner: `#awaitRemoteSpeculation` owns bounded waiting and cancellation transfer.
- Owner: `#claimArmedSpeculation` and `#commitAutoCompactionResult` retain validation and history-commit ownership.
- Reason: upstream 18.7.0 aborts unfinished speculation before establishing that its replacement can run.
- Source: https://github.com/can1357/oh-my-pi/blob/e0fc1cf4ea354b445a359b37fa5eb58deaa85598/packages/coding-agent/src/session/session-maintenance.ts#L2361-L2373
- Required action: retain this upstreamable delta until upstream safely adopts running remote speculation.
- Proof: grace-cap adoption and post-snapshot replay in `test/compaction-speculation.test.ts`.
- Proof: cancellation, late completion, remaining deadline, failure fallback, and reset-during-wait in that test file.

#### `MOMP-FALLBACK-DISCOVERY` — Discovery-safe fallback warnings

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: unresolved provider-qualified fallbacks never flash warnings while initial discovery is pending.
- Contract: pending discovery includes partial cached catalogs and built-in catalogs without a discovery state.
- Contract: known role-incompatible models and malformed fallback configuration remain immediately reportable.
- Contract: initial background discovery completion, including failure, ends deferral and reports unresolved entries once.
- Contract: fallback validation never starts discovery or changes configured model selectors.
- Owner: upstream `src/config/model-registry.ts#isProviderDiscoveryPending` owns catalog readiness.
- Owner: upstream `src/session/retry-fallback-chains.ts#validateRetryFallbackChains` owns compatibility validation.
- Owner: upstream `src/session/agent-session.ts` and `src/session/turn-recovery.ts` own post-discovery reconciliation.
- Reason: upstream checks only `idle`, so partial cached catalogs can produce persistent false startup warnings.
- Required action: retain readiness and unresolved-only deferral deltas at the existing upstream owners.
- Proof: partial-cache and failed-refresh cases in `test/agent-session-retry-fallback.test.ts`.

#### `MOMP-MODEL-STARTUP` — Strict configured-default resolution

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: an unresolved configured default awaits cache-aware discovery, including built-in account catalogs.
- Contract: a default still unresolved after discovery fails startup instead of selecting an unrelated model.
- Contract: this failure applies even when retry model fallback is disabled or another provider has credentials.
- Contract: explicit model selection and restored-session precedence retain their existing behavior.
- Contract: without a configured default, automatic selection still respects auth and the enabled-model scope.
- Coverage: upstream `adoptThinkingForModel` applies effort precedence and clamping to the final selected model.
- Contract: already resolved startup models retain deferred background discovery and the existing fast path.
- Owner: upstream `src/sdk.ts#createAgentSessionScoped` owns selection, discovery retries, and final effort resolution.
- Reason: upstream gates the default retry on a provider list that excludes built-in Codex discovery.
- Reason: upstream v18.4.12 normalizes fallback effort, but can still silently replace an unresolved configured default.
- Required action: retain cache-aware discovery and rejection of unresolved configured defaults.
- Required action: reuse upstream final-model effort resolution without a parallel fork implementation.
- Proof: cold built-in discovery, unresolved-default rejection, and fallback effort in `test/sdk-model-selection.test.ts`.
- Proof: scoped rejection in `test/repro-issue-1022-disabled-default-model.test.ts`.
- Proof: configured endpoint discovery in `test/sdk-default-role-discovery-config-provider.test.ts`.

#### `MOMP-MODEL-CACHE-ISOLATION` — Compatible model-cache writer namespaces

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: payload and freshness keys include the schema, app, builder, rules policy, and logical provider namespace.
- Contract: incompatible materialization policies and older bare-key writers cannot overwrite each other's rows.
- Contract: same-policy writers retain shared snapshots, freshness-only updates, and payload-change invalidation.
- Contract: public cache APIs and diagnostics retain logical provider IDs.
- Contract: headerless foreign namespaces remain untouched and are never used as compatibility fallbacks.
- Contract: the existing pre-v11 credential scrub and exact schema/policy validation remain effective.
- Owner: upstream `packages/catalog/src/model-cache.ts` owns physical keys, persistence, and compatibility validation.
- Coverage: upstream v18.8.0 validates memoized payloads using scalar metadata and `models_hash`.
- Reason: upstream rejects incompatible payloads but lets other app versions replace the same provider-keyed row.
- Required action: retain policy-scoped physical keys for reads, writes, memo invalidation, and freshness operations.
- Required action: use the physical namespace in both metadata and payload queries while retaining upstream hash memoization.
- Required action: retain headerless foreign rows without automatic pruning that could evict a live version.
- Proof: old and incompatible writer isolation in `packages/catalog/test/model-cache-rewrites.test.ts`.
- Proof: header omission and corrupt-provenance cleanup in `packages/ai/test/model-cache.test.ts`.
- Proof: materialized round trips and schema rejection in `packages/catalog/test/build.test.ts`.

#### `MOMP-STATS-SUMMARY` — Multi-range CLI usage overview

- Disposition: `MOMP-EIGEN`.
- Contract: `momp stats --summary` renders mobile-safe rolling 24h, 7d, and 30d usage blocks.
- Contract: each range shows requests, conversation tokens, cost, absolute errors, and error rate.
- Contract: range, agent, model, and folder summaries show `N/A` for entirely unpriced usage and report the excluded count.
- Contract: missing pricing metadata never makes unknown cost appear as a known zero-dollar charge.
- Contract: 24h details show aligned token and performance metrics plus agent usage.
- Contract: overlong metric values continue on dedicated lines without truncation.
- Contract: model and folder summaries show the top five conversation-token consumers with exact omitted counts.
- Contract: summary folder ranking and omitted counts include all folders, independent of dashboard payload caps.
- Contract: model and folder ordering uses deterministic name tie-breakers.
- Contract: complete model and folder names render on dedicated sanitized lines without truncation.
- Contract: conversation tokens include uncached input, cache reads, cache writes, and output.
- Coverage: upstream stats CLI paths keep sync diagnostics on stderr; MOMP retains that separation.
- Contract: the summary composer lives inside the published `@mikeei/momp` package.
- Contract: the standalone `omp-stats` binary keeps upstream behavior and is not fork-published.
- Owner: `packages/coding-agent/src/cli/stats-summary.ts` owns ranges, loading, ranking, sanitization, and rendering.
- Owner: `packages/coding-agent/src/cli/stats-cli.ts` owns MOMP command integration.
- Owner: upstream `packages/stats/src/rollup.ts#getStatsByAgentType` owns per-agent usage aggregation.
- Owner: `packages/stats/src/aggregator.ts#getSummaryStats` loads the complete 24h summary with one shared cutoff.
- Owner: `packages/stats/src/aggregator.ts#getOverallStatsForRange` loads totals without dashboard or detail aggregates.
- Implementation constraint: 7d and 30d load only totals to avoid unused detail and chart queries.
- Implementation constraint: 24h aggregates share one cutoff so boundary records do not disagree between sections.
- Coverage: upstream provides a simple `stats --summary`.
- Reason: upstream does not provide MOMP's package-local, mobile-safe 24h/7d/30d summary.
- Required action: retain one MOMP summary composer without changing standalone `omp-stats`.
- Required action: carry unpriced-request metadata through the existing agent aggregation owner.
- Required action: keep the summary command regression aligned with MOMP output and its unknown-cost assertion.
- Proof: `packages/coding-agent/test/stats-summary.test.ts`.
- Proof: `packages/coding-agent/test/stats-cli-output.test.ts`.
- Proof: `packages/coding-agent/test/stats-cli-summary.test.ts`.

#### `MOMP-SCROLLBACK` — Accepted transcript and multiplexer history integrity

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: accepted terminal rows remain immutable after a finalized component mutates.
- Contract: unchanged components retain semantic replay and width reflow.
- Contract: drifted components replay accepted physical rows without joining source rows on width growth.
- Contract: replay includes each accepted active-head prefix exactly once.
- Contract: a paired destructive presentation reset invalidates old tape and pending container and Composer offers.
- Contract: the accepted replacement replay establishes the baseline for subsequent component drift.
- Contract: finalized Assistant tails remain reachable while ordered retirement is blocked by active predecessors.
- Contract: emergency pressure renders the finalized emergency block's newest rows, not one representative row.
- Contract: finalized blocks awaiting an SVG raster retain emergency-tail visibility but cannot retire placeholders.
- Contract: emergency rows commit click hit-test spans while the summary row stays unmapped.
- Contract: stable pane geometry records final transcript rows exactly once and preserves pre-existing pane history.
- Contract: a top-anchored, full-height tmux viewport never scrolls an unfinished row into history on width reflow.
- Contract: preserve-mode height bursts retain accepted rows below the repaint and hand off Stop below that physical tail.
- Contract: contractions erase only known mutable rows, including a contraction during resize recovery.
- Contract: ordinary tmux frames stay attached to the cursor while grid resize precedes SIGWINCH delivery.
- Contract: a recovered frame uses its measured anchor before resuming cursor-relative painting.
- Contract: hiding the editor cursor updates physical cursor bookkeeping before Stop hands control to the shell.
- Contract: a destructive reset triggered during paint notification replays accepted history exactly once.
- Contract: ordinary multiplexer append and preserve-mode resize rendering never emits ED3 or invokes `clear-history`.
- Contract: changed geometry starts a new resize transaction during post-settle suppression.
- Contract: CPR replies from an earlier fullscreen geometry never determine the current resize anchor.
- Implementation constraint: geometry epochs currently distinguish stale CPR replies from the active resize transaction.
- Contract: fullscreen exits recover the normal-buffer anchor after size changes, including net-zero bursts.
- Contract: resize recovery retains its normal-buffer snapshot until the first recovered frame is painted.
- Owner: upstream `packages/tui/src/chrome/transcript-container.ts#TranscriptContainer` owns retirement and replay.
- Owner: `packages/tui/src/prompt/composer.ts#rerenderOfferedHistory` discards invalidated transcript wrappers.
- Owner: upstream `packages/tui/src/tui.ts#TUI.emitPlanFrame` owns the sole physical history write.
- Owner: `packages/tui/src/chat/assistant-message.ts#renderTranscriptBlockEmergencyRows` owns emergency-tail selection.
- Owner: `packages/tui/src/chrome/collab-qrcode.ts` preserves the QR hint through the shared emergency-row interface.
- Owner: `packages/tui/src/chrome/transcript-container.ts#FinalizableBlock` owns the presentation-version interface.
- Owner: `packages/tui/src/render/terminal-row-reflow.ts#reflowHardRows` owns accepted-row hard reflow.
- Owner: upstream `packages/tui/src/tui.ts` owns resize epochs, anchor recovery, and fullscreen-exit probing.
- Owner: upstream `packages/tui/src/tui.ts#resolveResizeAnchor` owns width-reflow CPR anchoring.
- Owner: `packages/tui/src/tui.ts#captureResizeProbeWindow` retains the paired normal-buffer snapshot across recovery restarts.
- Owner: upstream `packages/tui/src/tui.ts#stop` owns the shell handoff after a preserve-mode resize.
- Required action: retain only accepted-transcript and resize deltas at the named current upstream owners.
- Required action: preserve upstream render-cache release hooks alongside accepted replay and replacement-baseline acknowledgement.
- Proof: mixed accepted-batch drift, semantic neighbor reflow, and retirement in `packages/tui/test/transcript-container.test.ts`.
- Proof: finalized-pending emergency visibility and retirement ordering in `packages/tui/test/transcript-container.test.ts`.
- Proof: reentrant paint reset and frame-plan cases in `packages/tui/test/history-frame-plan.test.ts`.
- Proof: CPR offsets and a full-height width-reflow start row in `packages/tui/test/resize-multiplexer-anchor.test.ts`.
- Proof: bounded erasure and stale fullscreen CPR rejection in `packages/tui/test/resize-multiplexer-anchor.test.ts`.
- Proof: production Composer resize, contraction, fullscreen return, and Stop in `packages/coding-agent/test/tmux-scrollback-exactness.test.ts`.
- Proof: zero-history Composer fullscreen return with delayed SIGWINCH in `packages/coding-agent/test/tmux-scrollback-exactness.test.ts`.
- Proof: real tmux covers delayed SIGWINCH, width/height changes, and zero, partial, or full native history.
- Proof: explicit reset and rebuild ED3 ordering in `packages/tui/test/destructive-reset-clear-order.test.ts`.

#### `MOMP-TMUX-PAGEUP` — Native tmux history access

- Disposition: `MOMP-EIGEN`.
- Contract: PageUp on a focused empty editor opens tmux copy mode one page up.
- Contract: drafts, pending images, overlays, non-tmux sessions, and failed tmux commands retain existing handling.
- Owner: `src/modes/controllers/input-controller.ts` owns the empty-editor PageUp bridge.
- Required action: retain only the empty-editor tmux bridge at the current upstream input-controller seam.
- Reason: current upstream has no tmux copy-mode bridge; this fork-specific capability remains required.
- Proof: PageUp cases in `test/input-controller-keybindings.test.ts`.
- Proof: the real tmux PageUp case in `test/tmux-scrollback-exactness.test.ts`.

#### `MOMP-PACKAGE-IDENTITY` — Side-by-side fork identity and update safety

- Disposition: `MOMP-EIGEN`.
- Contract: publish staging produces package `@mikeei/momp`, binary `momp`, and exact `MOMP_VERSION`.
- Contract: the published CLI executes `dist/cli.js`, which bundles the complete fork workspace closure.
- Contract: published bundles retain required patched dependencies without install-time patching.
- Contract: publish-time bundle identity is injected without changing source package metadata.
- Contract: source `package.json` stays upstream-near; publish metadata is never hard-coded into source.
- Contract: published `momp update` refuses self-installation.
- Contract: the refusal prints `bun install -g @mikeei/momp@latest --force --minimum-release-age 0`.
- Contract: `momp update --check` never installs or treats the upstream package as the fork package.
- Contract: startup may check upstream availability but compares against the fork's base version.
- Contract: legacy extension self-imports resolve against the installed package identity.
- Owner: `src/app-version.ts` owns runtime identity and upstream-version comparison.
- Owner: `scripts/bundle-dist.ts` embeds validated package identity overrides into the bundled CLI.
- Owner: `src/cli/update-cli.ts` owns fork-safe update behavior.
- Owner: `src/extensibility/plugins/legacy-pi-compat.ts` owns installed-package self-import compatibility.
- Owner: `MOMP_VERSION` owns the source release version.
- Reason: canonical upstream cannot own the `@mikeei/momp` package identity or its fork-safe update policy.
- Required action: retain one MOMP identity owner and publish-time staging boundary.
- Required action: keep patched Puppeteer and ArkType dependencies embedded in the npm bundle.
- Proof: `test/update-cli.test.ts`.
- Proof: `test/extension-loader-self-import.test.ts`.
- Proof: publish and smoke gates owned by `project-momp-upgrader`.

#### `MOMP-SUBAGENT-LSP` — Child LSP capability

- Disposition: `UPSTREAM-GEDECKT`.
- Contract: bundled agent prompt definitions follow upstream; Scout retains the upstream read-only tool set.
- Contract: `task.enableLsp` applies only to agent definitions that declare LSP.
- Contract: parent capability and plan-mode restrictions still attenuate Child LSP.
- Owner: upstream `src/task/structured-subagent.ts#resolveEffectiveSubagentPolicy` owns effective Child LSP policy.
- Owner: upstream `src/task/settings.ts#cfgTaskEnableLsp` owns the setting and its disabled default.
- Owner: project-settings `data/sync/agent/config.yml` explicitly enables `task.enableLsp` for managed profiles.
- Reason: upstream satisfies the capability contract; synchronized configuration supplies the MOMP preference.
- Required action: keep the source setting upstream-identical and retain explicit activation in managed Settings.
- Required action: require `task.enableLsp: true` in managed configuration and the candidate's effective release settings.
- Required action: configure LSP explicitly in capability tests instead of relying on a fork default.
- Coverage: installations without the managed config use the upstream disabled default.
- Proof: `test/task/subagent-lsp.test.ts`.
- Proof: `test/tools/task-agent-capabilities.test.ts`.
- Proof: load the managed profile through source `Settings.loadReadOnly` and verify enabled LSP with global provenance.

#### `MOMP-AGENT-CONTEXT` — AGENTS-first generated-agent context

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: generated-agent guidance consumes provided `AGENTS.md` and other supplied project context.
- Contract: the architect never assumes `CLAUDE.md` is the sole project-instruction owner.
- Owner: `src/prompts/system/agent-creation-architect.md`.
- Reason: current upstream owns agent-creation guidance but assumes `CLAUDE.md` instead of supplied `AGENTS.md` context.
- Required action: retain only AGENTS-first guidance at the current upstream agent-architect prompt owner.
- Proof: render and inspect the agent-creation architect prompt.

#### `MOMP-LSP` — LSP extensions at upstream owners

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: file-scoped symbol queries filter hierarchical and flat document-symbol results.
- Contract: rename previews show bounded positions and replacement text and report omitted edits.
- Owner: current upstream `src/lsp/tool.ts` and `src/lsp/utils.ts` own the behavior.
- Owner: the project-settings `lsp.md` override owns guidance for file-rename previews and omitted text-edit details.
- Required action: retain source, prompt, and proof deltas until current upstream satisfies both contracts.
- Proof: document-symbol query and rename-preview cases in `test/tools/lsp-regressions.test.ts`.

#### `MOMP-READ-TOKEN-COUNT` — Exact Read token totals

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: completed Read groups show exact native-token totals as `Read (N) · 14,823 Read Tokens`.
- Contract: totals count final sanitized text after TTSR once per executed Read call, never per rendered target row.
- Contract: pending groups, unavailable counters, image-only results, and historic results without metadata omit the total.
- Contract: Read totals stay visible regardless of `display.showTokenUsage` because they describe tool payload.
- Contract: single-row, inline-preview, and full Read result titles place the total after the path.
- Contract: `cfg://` and `proc://` Read cards retain exact-token labels in ANSI and native headers.
- Owner: `packages/agent/src/tokenizer.ts` owns exact native-count availability.
- Owner: `src/session/agent-session.ts` owns final Read-result measurement and persisted metadata.
- Owner: `packages/tui/src/chat/read-tool-group.ts` owns aggregation and compact display.
- Owner: `packages/tui/src/tools/read-token.ts` owns exact suffix formatting.
- Owner: `packages/tui/src/tools/read.ts` and `packages/tui/src/tools/fetch.ts` own full-result display.
- Owner: `packages/tui/src/tools/cfg-render.ts` and `proc-render.ts` own their scheme-specific Read cards.
- Required action: retain exact-only measurement and every compact and full Read rendering path at the named owners.
- Proof: exact-count availability cases in `packages/agent/test/tokenizer.test.ts`.
- Proof: post-TTSR measurement in `test/agent-session-message-pipeline.test.ts`.
- Proof: aggregation and preview cases in `test/read-tool-group.test.ts`.
- Proof: full-result and `cfg://`/`proc://` ANSI and native headers in `packages/tui/test/read-render.test.ts`.

#### `MOMP-TEXT-COLOR` — Opt-in response foreground colors

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: `tui.textColors` is a boolean setting, disabled by default, exposed in Appearance settings.
- Contract: enabling it renders inline `<span style="color:#RRGGBB">text</span>` foreground colors.
- Contract: nested spans inherit or override foreground color; closing spans restore their parent.
- Contract: logical scopes end at inline-block boundaries; emitted color runs close during streaming.
- Contract: foreground tags preserve hard-line-break whitespace trimming without joining adjacent words.
- Contract: streaming preserves foreground scopes without changing ordinary Markdown rendering when no color span is interpreted.
- Implementation constraint: interpreted foreground spans disable the current row-splice optimization because it is scope-unaware.
- Contract: disabled rendering, inline code, hex swatches, block HTML, and compact inline rendering remain unchanged.
- Contract: foreground colors remain correct when native Markdown rendering is available.
- Implementation constraint: the current native path uses rendered rows while foreground colors are enabled.
- Contract: Main UI sessions expose `textColors` to templates from the effective setting.
- Contract: headless and Child sessions never advertise terminal color guidance.
- Contract: live setting changes rebuild the Main prompt and Markdown presentation through existing owners.
- Owner: upstream `packages/tui/src/components/markdown.ts#Markdown` owns scopes, styling, and streaming.
- Owner: upstream `packages/tui/src/theme/tui-adapters.ts` owns the configured Markdown theme snapshot.
- Owner: MOMP adds `src/modes/settings.ts#cfgTuiTextColors` at the upstream settings owner.
- Owner: upstream `src/modes/interactive-mode.ts` owns initial and live rendering configuration.
- Owner: `src/system-prompt.ts` and `src/sdk.ts` own render inputs and session-scoped prompt rebuilds.
- Owner: project-settings `SYSTEM.template.md` owns guidance inside `{{#if textColors}}`.
- Reason: upstream strips span attributes and has no opt-in foreground-span or model-guidance contract.
- Reason: upstream v18.5.1 consumes line-start trimming per token, so zero-width foreground tags must pass it on.
- Required action: retain the minimal setting, renderer, and conditional-template closure at existing owners.
- Proof: span scope, wrap/reset, line-break trimming, and disabled rendering in `packages/tui/test/markdown.test.ts`.
- Proof: live Main UI and headless prompt cases in `test/system-prompt-templates.test.ts`.
- Proof: render both deployed template branches and interact with the actual TUI.

#### Experiments and non-contract artifacts

Changelogs, formatting-only commits, test migrations, proposals, and experiments do not justify runtime retention.
Operational probes, benchmarks, experiments, migration scaffolding, and diagnostic scripts MUST have a current repeatable consumer.
Classify retained candidates during every full upgrade as `NICHT-CONTRACT-AKTIV` or `NICHT-CONTRACT-ENTFERNEN`.
`NICHT-CONTRACT-AKTIV` requires an operator workflow, release gate, performance decision, or regression investigation.
`NICHT-CONTRACT-ENTFERNEN` requires complete removal during the same full upgrade or authorized cleanup.
The closure includes scripts, prompts, workers, package commands, fixtures, generated output, and documentation.
NEVER retain experimental code because it might become useful later.

Issue-owned historical evidence belongs under `issues/evidence/issue-NNN/`, with links in the owning issue record.
Preserve measurements, diagnostic sources, captures, and contribution history while local investigation is paused.
These archives are not live fork deltas and do not require investigative reruns during upgrades.
Resume a paused investigation only after an explicit user request.

Current non-contract artifact states:

- `packages/coding-agent/src/cli/gallery-fixtures/fs.ts`: `NICHT-CONTRACT-AKTIV`.
- Consumer: `omp gallery` renders Read and Read Groups fixtures with token metadata for visual QA.
- Required action: retain the fixture delta while that gallery consumer exists; remove it with the consumer.
- Proof: `src/cli/gallery-cli.ts` consumes `galleryFixtures`, which includes the filesystem Read fixtures.

### Upstream Cutover and Delta Lifecycle

`upstream` means the canonical `can1357/oh-my-pi` repository.
`origin` means the user-owned fork.
An upstream update preserves active MOMP contracts, not historical patch shapes.
If upstream moves an ownership boundary, reimplement the required contract at the new boundary.
NEVER force obsolete hunks, wrappers, or file layouts onto current upstream structure.
Resolve semantic overlap in favor of upstream unless an active MOMP contract requires a difference.

Fetching, merging, or rebasing upstream does not itself remove obsolete fork behavior.
Judge every resulting delta against current upstream content and active contracts.
If the user requests a file be “upstream”, use its exact current `upstream/main` content.

Every retained delta MUST have one current owner and one observable contract.
Removing a delta MUST remove or migrate its complete dependency closure.
The closure includes code, imports, exports, callers, prompts, tests, configuration, and build wiring.
It also includes generated artifacts, documentation, and changelog entries when applicable.
Delete obsolete aliases, shims, fallback paths, and fork-side copies during the cutover.
NEVER preserve an obsolete path solely to reduce the apparent removal.

When upstream implements an equivalent contract:

1. Verify upstream behavior against the MOMP contract.
2. Replace fork-owned call sites with the upstream owner.
3. Remove the redundant implementation and its complete closure.
4. Remove or migrate fork tests that no longer defend a distinct contract.
5. Verify upstream-owned files without remaining deltas against current upstream.

A fork-only closure requires either the active contract or complete removal.
NEVER leave broken imports, callers, tests, configuration, or documentation through a partial cutover.
Prefer a surgical ownership-aligned cutover over reverting a broad integration commit.

### Prompt Delta Policy

Prompt files are upstream-owned by default.
A MOMP prompt delta MUST defend a current observable model, tool-routing, or operator contract.
Prompt wording history, personal preference, and token count alone do not justify a permanent delta.
NEVER propose new progressive disclosure or progressive exposure for prompts, tools, schemas, or capabilities.
The existing `xd://` catalog mode is the sole settled exception.
`tools.xdevDocs="catalog"` is the settled MOMP baseline for this repository's use case.
NEVER propose, require, or repeat `builtins`-versus-`catalog` comparison or A/B measurement unless the user explicitly reopens this decision.
Keep prompt behavior in static `.md` owners and keep coupled runtime wiring and behavioral tests in the same closure.
When removing a prompt delta, inspect imports, renderers, tool capability gates, consumers, and contract tests.
NEVER set a prompt file to upstream while leaving fork runtime code that imports or depends on the removed prompt.

Bundled prompt templates MUST remain byte-identical to upstream unless another active contract requires different model-visible text.
Dynamic-part inspection uses opt-in counterfactual rendering over structured render data.
NEVER add diagnostic-only markers to upstream-owned prompt templates.
Runtime prompt construction keeps counterfactual capture disabled; inspection commands enable it explicitly.
Render and inspect every behavior-bearing prompt change before completion.

### Source and Release Ownership

- Source: this repository owns MOMP source behavior and the `MOMP_VERSION` fact.
- Release: `project-momp-upgrader` owns assessment, packaging, publication, installation, and release smoke.
- Routing: NEVER duplicate the upgrader procedure here; route upgrade, publish, install, and deploy through its contract.
- Versioning: source behavior changes and release-version bumps MUST remain separate changes.
- Versioning: complete and verify source behavior before changing `MOMP_VERSION`.
- Packaging: keep `packages/coding-agent/package.json` close to upstream source metadata.
- Packaging: fork names, registry metadata, binaries, and publish versions belong to temporary publish staging.
- Packaging: NEVER hard-code publish-stage identity into source metadata merely to identify a release artifact as MOMP.

Request semantics:

- Source-only change: modify and verify `personal`; do not infer a release or version bump.
- Source push: publish only the requested source commit; do not infer package publication.
- Upgrade: run upstream assessment and the full upgrader contract.
- Publish, install, or deploy: run the full upgrader contract and its smoke gates.

Fork-maintenance completion evidence:

- Name every affected fork contract and disposition.
- Name the exact upstream or MOMP owner after the change.
- Report the focused behavioral proof for every retained or removed delta.
- Prove upstream restoration against current `upstream/main`, not memory or an old commit.
- NEVER report a cutover complete while orphaned closure elements remain.

## Fork and Upstream Contribution Intent

- Identity: official upstream is [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi).
- Identity: this checkout is the [MikeeI/oh-my-pi](https://github.com/MikeeI/oh-my-pi) fork.
- Branches: `personal` owns fork-only agent context, the MOMP patchstack, and durable contribution tracking.
- Branches: base clean upstream contribution branches on current `upstream/main`.
- Boundary: keep `AGENTS.md`, `FORMAT.md`, `ISSUES.md`, `issues/`, and other fork-only state out of upstream diffs.

Contribution selection:

1. Prefer a bounded verified pull request when no active implementation owns the correction.
2. Otherwise comment when a thread owns the same problem or root cause and new evidence advances it.
3. Otherwise open an issue when durable maintainer discussion is useful.
4. Otherwise keep the finding `Investigating`.

- Value: support upstream with evidence-backed, high-ROI findings while preserving active MOMP contracts.
- Value: prioritize bounded corrections with meaningful maintainer or user value and limited regression and review cost.
- Research: search existing work, follow upstream templates and disclosure rules, and avoid weak or duplicate submissions.
- Research: reproduce claimed bugs against current upstream and run the narrowest conclusive verification.
- Scope: publish one coherent root cause per issue, comment, or pull request.
- Scope: discuss major features and broad architecture or behavior changes in upstream Discord before implementation.

Required skills and authorization:

- Apply `skill-fork-contribution-tracking` for ledger, lifecycle, personal-branch, and upstream handoff work.
- Apply `skill-maintainer-communication` before external issues, pull requests, reviews, comments, or discussions.
- Apply `skill-semantic-compression-3-0` when authoring or restructuring tracking content.
- Apply `skill-git-commit-format` while respecting this repository's commit and contribution conventions.
- The user selects `Authorized-Work`; NEVER select it on the user's behalf.
- `Research-and-Reporting` permits issues and comments but no source implementation.
- `Pull-Request-Implementation` authorizes only the recorded scope.
- It MAY implement that scope only after research resolves failure boundaries.
- External publication follows `### External Publication Approval`; local tracking NEVER authorizes an external write.

## Finding and Contribution Ledger

- Intake: agents MUST read root `ISSUES.md` before repository work.
- Index: `ISSUES.md` owns `Next-Finding-ID` and the compact cross-finding projection.
- Record: each `issues/ISSUE-NNN.md` owns one root cause, evidence, Next-Action, drafts, and archive record.
- Schema: `FORMAT.md` owns research, claim basis, lifecycle, drafting, implementation, and publication gates.
- Allocation: search the index and relevant records for the same symptom and root cause before allocating.
- Allocation: create the current permanent `ISSUE-NNN`, add its index row, and advance the allocator together.
- Projection: update the issue record and index together after any projected field, Next-Action, or Archive change.
- Initial state: use `State: Investigating`, `Authorized-Work: Not-Selected`, and `Publication-Target: Not-Selected`.
- Initial reference: use `External-Reference: Not published.`.
- Evidence: label material claims `[O]`, `[S]`, or `[A]` under `FORMAT.md`.
- Evidence: preserve unmeasured boundaries as prose or an explicit Measurement-Status field.
- Evidence: verify source claims against current upstream; reproduce user-visible bugs before claiming `[O]`.
- Readiness: pull-request work MUST be verified, committed, pushed, and `PR-Ready` before external publication.
- Validation: run the bundled read-only ledger validator after every ledger mutation.
- Submission: record the final external URL in `External-Reference` immediately after publication.

### External Publication Approval

- Approval gates only external issues, comments, reviews, discussions, and pull request writes.
- Local ledger creation and updates are not external publication.
- Before publication, read current upstream policy and show the exact Publication-Target and Publication-Draft.
- Publish only after the user explicitly approves that exact target and draft.
- Any target or draft change invalidates prior approval.
- Without that exact instruction, NEVER comment on GitHub or create a GitHub issue.

## Default Context

This repo contains multiple packages, but **`packages/coding-agent/`** is the primary focus.
Unless otherwise specified, assume work refers to this package.

**Terminology**: "agent" and questions about its behavior refer to the coding-agent package, not this Assistant.
The coding-agent is a CLI tool; behavior questions concern `packages/coding-agent/`, not the current session.

### Package Structure

| Package                 | Description                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `packages/ai`           | Multi-provider LLM client with streaming support                                        |
| `packages/catalog`      | Model catalog: bundled models.json, provider descriptors, model identity/classification |
| `packages/agent`        | Agent runtime with tool calling and state management                                    |
| `packages/coding-agent` | Main CLI application (primary focus)                                                    |
| `packages/tui`          | Terminal UI library with differential rendering                                         |
| `packages/natives`      | Bindings for native text/image/grep operations                                          |
| `packages/stats`        | Local observability dashboard (`omp stats`)                                             |
| `packages/omptype`      | ArkType-compatible schema validation with a lazy JIT runtime                            |
| `packages/utils`        | Shared utilities (logger, streams, temp files)                                          |
| `crates/pi-natives`     | Rust crate for performance-critical text/grep ops                                       |

**Catalog import convention**: import catalog values from `@oh-my-pi/pi-catalog/<module>`, never via `@oh-my-pi/pi-ai`.
Catalog values include bundled models, model-thinking helpers, identity, descriptors, model managers, and caches.
The pi-ai barrel re-exports only the model/effort types used by its signatures (`Model`, `Api`, `ThinkingConfig`, `Effort`, …).
Type-only imports of those types from `@oh-my-pi/pi-ai` are permitted.

## GitHub

`### External Publication Approval` is the sole contract for GitHub writes.

## Code Quality

- No `any` unless absolutely necessary.
- **NEVER use `ReturnType<>`** — use the actual type name.
- **Imports**: always use top-level imports; NEVER use `await import()`, inline `import("pkg").Type`, or dynamic type imports.
- Check `node_modules` for external API types instead of guessing.
- **Barrel exports**: prefer `export * from "./module"` over named re-exports, including `export type { ... } from`.
- In pure `index.ts` barrels, use star re-exports even for single-specifier cases.
- If stars create ambiguity, remove the redundant export path; do not keep duplicates.
- **Class privacy**: use ES `#private` fields; leave externally accessible members bare.
- No `private`/`protected`/`public` keyword on fields or methods, except constructor parameter properties where TypeScript requires it, such as `constructor(private readonly session: ToolSession)`.
- **Promises**: use `Promise.withResolvers()` instead of `new Promise((resolve, reject) => ...)`.
- **Prompts**: keep text in static `.md` files; never build prompts through inline strings, template literals, or concatenation.
- Use Handlebars for dynamic prompt content.
- Import prompts via `import content from "./prompt.md" with { type: "text" }`, not `readFile`.
- **Worker scripts**: workers re-enter the CLI entrypoint; never spawn separate worker entry modules.
  `cli.ts` declares itself as the worker host through `declareWorkerHostEntry()` from `@oh-my-pi/pi-utils/env`.
  It dispatches `__omp_worker_stats_sync`, `__omp_worker_tab`, `__omp_worker_js_eval`, and `__omp_worker_tiny_inference` before loading the command registry.
  Spawn sites use:

  ```ts
  import { workerHostEntry } from "@oh-my-pi/pi-utils";
  const hostEntry = workerHostEntry();
  const worker = hostEntry
  	? new Worker(hostEntry, { type: "module", argv: ["__omp_worker_<name>"] })
  	: new Worker(new URL("./<worker>.ts", import.meta.url).href, { type: "module" });
  ```

  When started from the omp CLI (`cli.ts`, npm-bundled `dist/cli.js`, or a compiled binary), `workerHostEntry()` is `Bun.main`.
  Workers re-enter that single module, so no per-worker `--compile` entrypoints or bundle entries exist.
  Outside a CLI host (`bun test`, SDK embedding, standalone `omp-stats`), it returns `null` and the fallback loads worker source.
  New worker kinds MUST add their selector to the `cli.ts` dispatch table and keep the fallback branch.
  History: `with { type: "file" }` copied a raw entry asset, causing silent compiled-binary crashes in issues #1011 and #1027.
  The later literal-path and extra-entrypoint pattern required keeping spawn literals and two build scripts in sync (#1150).
  The smoke probe below is the live validation of this contract.
  Validate new workers with `omp --smoke-test`, which spawns and pings the stats sync worker and tiny-model subprocess.
  `ci:test:smoke` and `scripts/install-tests/run-ci.sh` run it for binary, source-link, and tarball installs.
  Add a sibling smoke if a new worker uses a different module graph.

## Central Utilities

Before writing a helper, check `packages/coding-agent/src/utils/`, `@oh-my-pi/pi-utils`, `@oh-my-pi/pi-tui`, and neighboring domain modules.
This applies to VCS wrappers, formatting, truncation, path display, image handling, clipboard, streams, temp files, and caching.
Central versions carry timeouts, output caps, non-interactive environments, lock avoidance, caching, and TUI sanitization.

- Search first with `grep` before implementing an operation.
  Two implementations of the same operation are a bug even when both work.
- Examples of the pattern: `@oh-my-pi/pi-natives/vcs` and `src/utils/active-repo-context.ts` are the only sanctioned way to run git/jj (`import * as vcs from "@oh-my-pi/pi-natives/vcs"` — never hand-spawn via `$`/`Bun.spawn`); rendering goes through the helpers in TUI Sanitization below (`replaceTabs`, `truncateToWidth`, `shortenPath`, `PREVIEW_LIMITS`) rather than ad-hoc string math.
- For missing capabilities, extend the central helper with an option or sub-function and call it instead of duplicating logic.

## Bun Over Node

Use Bun APIs where they provide a cleaner alternative; fall back to `node:*` only for what Bun does not cover.
Never spawn shell commands for operations with proper APIs, such as using `Bun.spawnSync(["mkdir", "-p", dir])` instead of `mkdirSync`.

### Quick reference

| Operation       | Use                                       | Not                                |
| --------------- | ----------------------------------------- | ---------------------------------- |
| File read/write | `Bun.file()`, `Bun.write()`               | `readFileSync`, `writeFileSync`    |
| Spawn process   | `` $`cmd` ``, `Bun.spawn()`               | `child_process`                    |
| Sleep           | `Bun.sleep(ms)`                           | `setTimeout` promise               |
| Binary lookup   | `$which("git")` from `@oh-my-pi/pi-utils` | `spawnSync(["which", "git"])`      |
| HTTP server     | `Bun.serve()`                             | `http.createServer()`              |
| SQLite          | `bun:sqlite`                              | `better-sqlite3`                   |
| Hashing         | `Bun.hash()`, `Bun.password.*`, WebCrypto | `node:crypto`                      |
| Path resolution | `import.meta.dir`, `import.meta.path`     | `fileURLToPath` dance              |
| JSON5           | `Bun.JSON5.parse()` / `.stringify()`      | `json5` package                    |
| JSONL           | `Bun.JSONL.parse()` / `.parseChunk()`     | `text.split("\n").map(JSON.parse)` |
| String width    | `Bun.stringWidth()`                       | `get-east-asian-width`, custom     |
| Text wrapping   | `Bun.wrapAnsi()`                          | custom ANSI-aware wrappers         |

### Process execution

Prefer Bun Shell (`` $`cmd` ``) for simple commands:

```typescript
import { $ } from "bun";

const result = await $`git status`.cwd(dir).quiet().nothrow();
if (result.exitCode === 0) {
	const text = result.text();
}

$`do-stuff ${tmpFile}`.quiet().nothrow(); // fire and forget
```

Methods: `.quiet()`, `.nothrow()`, `.text()`, `.cwd(path)`.

Use `Bun.spawn`/`Bun.spawnSync` only for: long-running processes (LSP, kernels), streaming stdin/stdout/stderr (SSE, JSON-RPC), or process control (signals, kill, complex lifecycle).

When using `pipe` mode, cast the stream:

```typescript
const child = Bun.spawn(["cmd"], { stdout: "pipe", stderr: "pipe" });
const reader = (child.stdout as ReadableStream<Uint8Array>).getReader();
```

### Node module imports

Always use **namespace imports** for `node:fs`, `node:path`, `node:os`:

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
```

- Async-only file → `node:fs/promises`.
- Needs both sync and async → `node:fs`, then `fs.promises.xxx` for async.

### File I/O

Prefer Bun:

```typescript
const text = await Bun.file(path).text();
const data = await Bun.file(path).json();
await Bun.write(path, data); // auto-creates parent dirs
```

Use `node:fs/promises` for directory operations (`fs.mkdir`, `fs.rm`, `fs.readdir`); Bun has no native directory APIs.
Avoid sync APIs in async flows; use sync only when a synchronous interface requires it.

**Anti-patterns:**

- `existsSync`/`readFileSync`/`writeFileSync` in async code → `Bun.file()` APIs.
- `mkdir(dirname(path), …)` before `Bun.write(path, …)` → redundant; `Bun.write` handles it.
- Use try-catch with `isEnoent` instead of `if (await file.exists()) { await file.json() }`, which uses two syscalls and races:

  ```typescript
  import { isEnoent } from "@oh-my-pi/pi-utils";
  try {
  	return await Bun.file(path).json();
  } catch (err) {
  	if (isEnoent(err)) return null;
  	throw err;
  }
  ```
- Multiple `Bun.file(path)` handles for the same path (including across `checkX`/`loadX` helpers).
- `Buffer.from(await Bun.file(x).arrayBuffer())` → `await fs.readFile(path)`.
- Existence check + try-catch around the same read → drop the existence check.

### Streams

Prefer centralized helpers:

```typescript
import { readStream, readLines } from "./utils/stream";
const text = await readStream(child.stdout);
for await (const line of readLines(stream)) {
	/* ... */
}
```

Manual reader loops only when the protocol requires it (SSE, streaming JSON-RPC).

### Misc

- **Sleep**: `await Bun.sleep(ms)`, never `new Promise(r => setTimeout(r, ms))`.
- **Password hashing**: `Bun.password.hash(pw, "bcrypt")` / `Bun.password.verify(pw, hash)`.
- **String width**: `Bun.stringWidth(text, { countAnsiEscapeCodes?: false })`.
- **Wrapping**: `Bun.wrapAnsi(text, width, { wordWrap, hard, trim })`.

## Model/Provider Policy Lives in KDL

NEVER hard-code model- or provider-conditional policy in TypeScript.
This forbids ID substring checks such as `id.includes("claude")`, model-name regexes, and per-model policy lookup tables.
Policy includes effort ladders, pricing, context windows, modalities, API routing, and quirk flags.
It belongs in `packages/catalog/src/compat/rules/`, compiled by `bun run gen:compat` into committed `rules.json`.
Resolve it at build time through `resolveModelPolicy` and `buildModel`.

Ownership strata (see `src/compat/rules/README.md`):

- `taxonomy/*.kdl` — identity: class membership, families, revision extraction, reviewed overrides, suffix collapse.
- `classes/*.kdl` — model-lineage truths (behavior inherent to a model line, on any host).
- `providers/*.kdl` — deployment contracts (behavior a host imposes), plus documented exact-id residue.
- `runtime/behavior.kdl` — heuristics that run before/outside exact model lookup (`api-routes`, `model-limits`, `exclude-models`, `pricing-peer`, hosted defaults).

Rules for TS code:

- Branching on model identity in TS is allowed **only** through structured facts from `classifyModel()` (`class`/`family`/`revision`/effort facts) — never through string matching on ids, and prefer a KDL axis when one can express the policy.
- Discovery mappers report authoritative upstream fields; seed neutral values only for omitted or misreported fields owned by a KDL correction axis (`input-modalities`, `cost-patch`, `limits-patch`, `context-window-floor`, or thinking axes).
- Assert rule-owned corrections through `buildModel`; raw discovery specs remain the surface for parsing and normalization assertions.
- An id that no selector can isolate gets an exact-id `models` residue rule with a comment — never a special case in TS.
- Equal-rank rule overlaps throw `AmbiguousOverlapError` at resolve time; fix with an explicit `priority=` in KDL, not code.
- After editing rules: `bun run gen:compat` and commit `rules.json` alongside the `.kdl` change.

## Generated Files

NEVER edit `packages/catalog/src/models.json` directly.
`packages/catalog/scripts/generate-models.ts` and `src/provider-models/` descriptors/resolvers generate it from stencil.so, provider discovery, and OpenCode docs.
Hand-edits are overwritten on the next regeneration.
The same applies to `packages/catalog/src/compat/rules.json`, compiled from the KDL tree by `bun run gen:compat`.

To change an entry, fix the source:

- **Model/provider policy** (identity, thinking ladders, wire quirks, modality/limit/pricing corrections, API routing, roster exclusions) → the KDL tree in `packages/catalog/src/compat/rules/` (see the section above).
- **Provider catalog entries** (default model, discovery factory/flags) → the `CATALOG_PROVIDERS` table in `packages/catalog/src/provider-models/descriptors.ts`.
- **Discovery/request plumbing** (endpoint shapes, auth, response parsing) → the mappers in `packages/catalog/src/provider-models/openai-compat.ts`.
- **Generator wiring** (upstream merges, premium multipliers, post-processing order) → `packages/catalog/scripts/generate-models.ts`.

Regenerate with `bun run gen:compat` and/or `bun run gen:models` and commit generated files alongside the source change.
Add regression tests against the rule, descriptor, or mapper rather than bundled JSON so they survive metadata shifts.

## Logging and CLI Output

Code active during TUI, RPC, SDK, worker, or background runtimes MUST NOT use `console.log`/`error`/`warn`.
These calls corrupt rendering or protocols; use the centralized logger:

```typescript
import { logger } from "@oh-my-pi/pi-utils";

logger.error("MCP request failed", { url, method });
logger.warn("Theme file invalid, using fallback", { path });
logger.debug("LSP fallback triggered", { reason });
```

Logs go to `~/.omp/logs/omp.YYYY-MM-DD.log` with automatic rotation.
Standalone CLI commands that exit without entering the TUI MAY use `console.*` or process streams for intentional output.
Keep structured stdout clean.
This exception is semantic, not filename-based; shared code must use `logger` or an explicit output sink.

## TUI Sanitization

Sanitize all text displayed in tool renderers.
Raw file contents, errors, and tool output cause tab holes, line overflow, and home-directory path leaks.

**Rules:**

- **Tabs → spaces** via `replaceTabs()` (from `@oh-my-pi/pi-tui` or `../tools/render-utils`).
- **Truncate** lines with `truncateToWidth()` or `ui.truncate()` using `TRUNCATE_LENGTHS` constants.
- **Shorten paths** with `shortenPath()` (replaces home with `~`).
- **Preview limits**: use `PREVIEW_LIMITS`, never ad-hoc numbers.

**Apply to every render path**, not just the happy one:

- Success output (file previews, command output, search results).
- **Error messages** often embed file content, such as unmatched lines in patch failures.
  If a message contains file content, apply `replaceTabs()`.
- Diff content (added and removed).
- Streaming previews.

### Streaming tool previews

Tool-call previews can have multiple render paths.
Update every path when adding preview-only fields or using partially streamed arguments.
Streamed argument buffers decode through `decodeStreamedToolArgs` and `ToolArgsRevealController` (`modes/controllers/tool-args-reveal.ts`).
Both live events and transcript rebuilds must use them; never spread provider-parsed `arguments` beside raw `__partialJson`.
Parsed arguments lag the stream by a throttled parse window.

For the bash tool specifically:

- Pending previews may need raw `partialJson`, not just parsed `arguments`.
  Parsed arguments lag until the JSON object closes, delaying inline environment assignments.
- Preserve preview-only fields such as `__partialJson` through `event-controller.ts`, `ui-helpers.ts` transcript rebuilds, and merged call/result rendering in `tool-execution.ts`.
  Missing any path causes inconsistent previews.
- `ToolExecutionComponent.#buildRenderContext()` for bash must work even before a result exists — the renderer uses call args plus render context to show the command preview while streaming.
- Verify live streaming and rebuilt transcripts after bash preview changes; fixing one path does not fix the other.

## Commands

- NEVER commit unless asked.
- Never use `tsc`/`npx tsc` — always `bun check`.
- Never run `cargo test` directly for Rust tests; use `bun run test:rs`.
  It runs `cargo nextest run` with `.config/nextest.toml`, then `cargo test --doc` because nextest omits doctests.
  The doctest pass runs every runnable workspace library doctest, currently tree-sitter-go's one example.
  Rustdoc skips the pi-natives `cdylib`; pi-builtins' vendored uutils examples are marked `ignore`.
- Merge commits (maintainer merges of PRs) follow: `Merge PR #<number>: <conventional PR subject> (@<author>)` — e.g. `Merge PR #6386: feat(catalog): add native Meta Model API provider (@eggpeat)`.

## Rust Build Profiles

Profiles live in root `Cargo.toml`; `.cargo/config.toml` carries settings that Cargo.toml cannot express.
Both are committed, so no local `~/.cargo/config.toml` is required.

| Profile | Use |
| --- | --- |
| `dev` | Default: line tables for our crates, no dependency debuginfo, dependencies at `opt-level = 2`. |
| `release` | Shipping build: fat LTO, 1 codegen unit, stripped. |
| `local` | Fast local release iteration: thin LTO, 16 codegen units, incremental. |
| `profiling` | `release` codegen with symbols kept, for `perf`/`samply`/Instruments. |
| `ci` | Thin LTO, no debuginfo, stripped. |

Never set `split-debuginfo = "off"` on a profile with debuginfo.
On Mach-O, the linker writes a debug map (`N_OSO`) pointing at `.o` files rather than merging DWARF into the executable.
`"unpacked"` preserves those files.
With `"off"`, backtrace frames silently lose `file:line`, although `#[track_caller]` still prints the panic's source header.
This surviving header makes missing debuginfo easy to overlook.
The `ci` profile may use `"off"` only because it sets `debug = false`.

`embed-metadata = false` in `.cargo/config.toml` stores crate metadata in `.rmeta` instead of duplicating it in every rlib.
On a reqwest-sized graph, this reduced 196 MB to 130 MB at identical build times.
Its accepted spelling is toolchain-coupled; keep it synchronized with `rust-toolchain.toml`.

Rejected, with measurements, so nobody re-litigates them: **sccache** (cannot cache incremental, bin, or proc-macro crates — measured slower than not using it), **mold** (ELF-only; no Mach-O support), and **`panic = "abort"` on `dev`** (Cargo ignores `panic` for the test profile, so the whole dep graph builds twice — 131 MB → 214 MB).

## Testing Guidance

Test the contract the system exposes — not the easiest internal detail to assert.

- Every new test must defend a named, concrete external contract: behavior, output shape, state transition, error mapping, or regression-prone parsing.

### Good vs. bad test filter

- **Name the failure mode**: every test MUST state what a consumer observes if it regresses; NEVER add an unnamed test.
- **Good: transformation.** One fixture MAY prove parse/render/normalize/encode/resolve behavior when output is computed, not echoed.
- **Good: branch or boundary.** Distinct inputs, empty values, malformed input, version/provider routing, and state transitions MUST prove distinct outcomes.
- **Good: external contract.** Exact bytes/shape MAY be asserted when a provider, parser, protocol, or persisted consumer reads them.
- **Good: precedence or negative contract.** Keep explicit `false`/override-wins assertions and required absence only when they prevent a documented leak, downgrade, 400, or incompatible wire field.
- **Good: regression.** A repro MUST trigger the prior real failure path and assert the corrected observable result.
- **Bad: static echo.** NEVER test a constructor/builder merely copied a fixture or baked constant into an in-memory config/metadata field.
- **Bad: success passthrough.** NEVER assert `fn(x) === x` when `x` was already supplied/declared valid; assert a transform, rejection, or downstream effect instead.
- **Bad: wording/defaults.** NEVER assert prompt/UI boilerplate, a default literal, object existence, non-empty output, or length growth without a consumer contract.
- **Bad: duplicate rows.** Parameterized/loop rows MUST each cover a distinct branch, provider/model path, or consumer contract; delete same-path duplicates.
- **Metadata exception.** Exact metadata, identity, ordering, or `undefined` MAY remain only when a downstream consumer depends on it and the test establishes branch, precedence, negative-contract, wire, or regression evidence.
- **Termination exception.** For cyclic/large inputs, assert a bounded output, surfaced error, or state change; bare `not.toThrow()` is insufficient.
- No placeholder tests, tautologies, or "the code ran" assertions (`expect(true).toBe(true)`, bare `not.toThrow()`, non-empty string checks, length-grew checks, "prompt exists" checks without semantic assertion).
- Prefer contract-level tests over implementation details.
- Avoid internal wiring, assignment, singleton identity, incidental ordering, boilerplate, or passthrough assertions unless another component depends on that exact detail.
- Do not duplicate coverage across abstraction levels; remove narrower mocked tests that restate integration coverage.
- Tests must be full-suite safe, not merely file-local safe.
- Avoid long-lived file-wide mutations of `Bun.*`, `process.platform`, `process.env`, or `Bun.env` when a narrower seam exists.
- Prefer per-test `vi.spyOn(...)` with `vi.restoreAllMocks()` in `afterEach`.
  A test that passes alone but poisons later files is broken.
- Never use `mock.module()`; it mutates Bun's global module registry and leaks across files: https://github.com/oven-sh/bun/issues/12823.
- Use `spyOn` on an imported module object instead.
- For pass dependencies, import the pass and spy on `.run`.
- For package dependencies, namespace-import and spy on the exported function.
- For lifecycle/stateful code, prefer one test per invariant or transition over several tiny tests asserting one field each from the same transition.
- For error handling, trigger the real failure path and assert the surfaced contract — don't instantiate error classes directly or inspect internal metadata.
- Smoke tests are acceptable only when they catch failures narrower tests would miss; boot/start-only assertions are insufficient.
- Assert exact strings, ordering, and formatting only when downstream consumers depend on those bytes; otherwise assert semantics.
- Compile-time guarantees → type checks/type tests, not runtime placeholders.
- Never source-grep implementation files (`.ts`, `.rs`, or build scripts) in tests.
  This forbids `expect(src).toContain("someCall()")`, `.toMatch(/import .../)`, `.not.toContain("oldName")`, and comment-text checks.
  Such tests fail on harmless comment, rename, or import changes while passing broken behavior.
  Reading files the code wrote, such as patch results, generated bundles, and temp fixtures, remains valid behavioral testing.
- Assert observable output, state, or errors instead of implementation text.
- Use the runtime smoke probe for wiring that cannot be exercised in-process.
- Enforce structural invariants, such as no value-import or self-import, with type tests or oxlint rather than source scans.
- Don't add tests for tiny low-risk changes unless they protect a real contract or fix a regression-prone edge case.
- Prefer focused package-local verification for the changed area.

## Changelog

Location: `packages/*/CHANGELOG.md` (per package).

**Format** — sections under `## [Unreleased]`:

- `### Breaking Changes` (first if present)
- `### Added`
- `### Changed`
- `### Fixed`
- `### Removed`

**Rules:**

- New entries always go under `## [Unreleased]`.
- Changelog entries are brief, single-line, and user-facing; lead with what users see or can do.
- Keep root-cause narration and implementation detail in the commit or PR, not the changelog.
- Never modify already-released sections (e.g., `## [0.12.2]`) — they are immutable.
- Don't flag changelog section order or formatting in reviews or PRs — `bun run release` runs `fix-changelogs` which normalizes everything automatically.

**Attribution:**

- Internal (from issues): `Fixed foo bar ([#123](https://github.com/can1357/oh-my-pi/issues/123))`.
- External contributions: `Added feature X ([#456](https://github.com/can1357/oh-my-pi/pull/456) by [@username](https://github.com/username))`.

## Releasing

1. Ensure all changes since last release are in each affected package's `[Unreleased]` section.
2. Run `bun run release`.

The script handles version bump, CHANGELOG finalization, commit, tag, publish, and adding new `[Unreleased]` sections.

# MOMP Contracts

## Current Active MOMP Contract Inventory

This inventory is the authoritative SSOT for active MOMP source behavior.
`AGENTS.md#momp-contract-index` projects its IDs, dispositions, and owner paths for routing.
A fork delta that cannot be assigned to an entry below is unqualified and MUST be investigated before retention.
`project-momp-upgrader` consumes this inventory.
It owns upgrade assessment, packaging, publishing, installation, and release smoke.
Source behavior changes MUST update this inventory and the `AGENTS.md` index in the same source change.
Upgrade workflow documentation and automation MUST reference entries instead of restating their contracts.
Keep this inventory current when adding, removing, upstreaming, or reclassifying a contract.
Entries describe current state.
Move obsolete `Coverage` and `Reason` lines into the upgrader's upgrade report.
A line is obsolete when it no longer justifies a current disposition or required action.

Each entry names its disposition, observable behavior, implementation owner, and focused proof.
Contract IDs are canonical third-level headings inside this inventory.
The inventory ends before `Experiments and non-contract artifacts`.
The upgrader validates these IDs against its executable and manual proof mappings without deriving tests from prose.
It also rejects `AGENTS.md` index rows whose IDs or dispositions differ from this inventory.

- `Contract` defines required observable behavior, including explicit user constraints and externally consumed formats.
- `Implementation constraint` records a necessary current mechanism and its rationale, not a permanent implementation shape.
- `Proof` identifies focused verification; its presence alone does not assert that the verification currently passes.
- `Verification gap` records missing or failing evidence without weakening the associated contract.

### `MOMP-PROMPT-MAIN` — Main prompt customization

- Disposition: `MOMP-EIGEN`.
- Contract: `SYSTEM.template.md` is the canonical MOMP Handlebars Main template source.
- Contract: raw `--system-prompt`, `SYSTEM.md`, `APPEND_SYSTEM.md`, and `--append-system-prompt` remain literal.
- Contract: precedence is explicit raw prompt, project raw, project template, user raw, user template, built-in base.
- Contract: an explicitly empty raw prompt remains selected and suppresses discovered templates.
- Contract: raw and template siblings select raw and surface the suppression warning.
- Contract: project `SYSTEM.md` and `SYSTEM.template.md` resolve from the nearest non-empty ancestor `.omp`, matching native `SYSTEM.md` discovery.
- Contract: `APPEND_SYSTEM.md` keeps upstream's cwd-only config-base lookup.
- Contract: an absent template permits the built-in base; every discovered or explicit template is mandatory.
- Contract: mandatory templates MUST be readable, non-empty, and valid; failure terminates prompt construction.
- Contract: a selected template render failure names its source path, or `inline template` for SDK content.
- Contract: inline SDK templates reject whitespace-only content before rendering.
- Contract: dangling discovered template symlinks remain mandatory selections instead of permitting fallback.
- Contract: `SYSTEM_TEMPLATE.md` is not an accepted alias for the canonical MOMP filename.
- Contract: provider-facing base and project blocks remain separate and ordered.
- Contract: ACP sessions resolve prompt sources from the target workspace rather than the launch directory.
- Contract: runtime tool-registry rebuilds preserve the selected sources while refreshing dynamic tool state.
- Owner: `src/system-prompt.ts` owns source discovery, precedence, loading, and rendering.
- Owner: `src/config.ts#findConfigFileWithMeta` preserves dangling entries for mandatory prompt discovery.
- Coverage: upstream v18.18.8 resolves the OMP user config base through `getAgentDir()` (#18684).
- Contract: user-level Main and Child prompt sources therefore follow `PI_CODING_AGENT_DIR` for the default profile.
- Owner: upstream `src/discovery/builtin.ts#findNearestProjectConfigDir` owns the nearest project `.omp` walk-up.
- Owner: `src/main.ts` maps discovered sources into Main-session construction.
- Owner: `src/capability/system-prompt.ts#systemPromptCapability` owns raw `SYSTEM.md` capability metadata.
- Owner: `docs/system-prompt-customization.md`, `docs/config-usage.md`, and `docs/session-operations-export-share-fork-resume.md` document the MOMP filename, flag, discovery, and mandatory failure.
- Reason: upstream v18.2.7 added an analogous `SYSTEM_TEMPLATE.md` interface with fallback semantics.
- Reason: its filename and discovered-template fallback do not satisfy the mandatory MOMP contract.
- Required action: retain the MOMP filename, discovery, precedence, loading, and mandatory failure behavior.
- Coverage: upstream v18.19.0 adds the `systemPromptTemplates` setting, a per-model Handlebars file with bundled fallback.
- Required action: select it only when no raw or template source controls block 0, so it never weakens mandatory MOMP templates.
- Owner: `src/system-prompt.ts#loadModelSystemPromptTemplate` keeps upstream's warn-and-fallback semantics for that file alone.
- Proof: upstream `test/sdk-model-system-prompt-template.test.ts`.
- Proof: `test/system-prompt-templates.test.ts`.
- Proof: prompt-source cases in `test/acp-mcp-isolation.test.ts`.
- Proof: `test/agent-session-tool-rebuild-skip.test.ts`.

### `MOMP-WORKSTATION-CONTEXT` — Compact execution context

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: workstation context identifies current execution as `user@host`.
- Contract: OS context combines distribution, OS type and release, and architecture in one line.
- Contract: workstation context surfaces the current IANA timezone.
- Contract: workstation context lists only tailnet IPv4 from interfaces named `tailscale*` or carrying a `fd7a:115c:a1e0::/48` address, sorted.
- Contract: hardware context shows physical cores, logical threads when they differ, and usable RAM in GiB with at most one decimal.
- Implementation constraint: hardware context ignores CPU affinity and counts Linux cores from sysfs `core_cpus_list`.
- Owner: current upstream `src/system-prompt.ts#getEnvironmentInfo` owns workstation context rendering.
- Required action: extend that owner directly; never add a parallel fork prompt block.
- Proof: `test/system-prompt-kernel.test.ts`.

### `MOMP-PROMPT-CHILD` — Fresh Child prompt composition

- Disposition: `MOMP-EIGEN`.
- Contract: fresh Child base precedence is project template, user template, then the upstream fallback.
- Contract: wrapper precedence is project `SUBAGENT-SYSTEM.template.md`, user template, then bundled wrapper.
- Contract: a selected Child base controls block zero and suppresses raw and append discovery for that fresh render.
- Contract: Task, Eval, Vibe, and nested Children reload selections from their logical `cwd`.
- Contract: live follow-ups retain the rendered prompt and cold revives retain persisted prompt bytes.
- Contract: Children never inherit parent-selected raw, append, explicit, base-template, or wrapper-template state.
- Contract: ordinary Children never inherit the Main conversation, rendered Main prompt, or full parent `AGENTS.md` context.
- Contract: the Child wrapper follows upstream project-context blocks so fresh Child prompt prefixes remain stable.
- Contract: the selected Child wrapper preserves item-indexed workpool `yield` and ordinary `data`/`error` semantics.
- Contract: wrappers follow the actual execution mode; plain-result Children never receive yield-only completion guidance.
- Contract: dangling Child base and wrapper template symlinks fail instead of selecting lower-priority sources.
- Contract: a selected wrapper render failure names its source path.
- Contract: project Child base and wrapper templates resolve from the nearest non-empty ancestor `.omp`.
- Owner: `src/system-prompt.ts` owns base and wrapper discovery.
- Owner: `src/task/subagent-system-prompt.ts#resolveSubagentSystemPrompt` loads the selected wrapper snapshot.
- Owner: `src/task/subagent-system-prompt.ts#createSubagentSystemPromptTransform` renders and inserts its provider block.
- Owner: upstream `src/task/executor.ts#buildSubagentSessionOptions` composes fresh and warm-revived Child sessions.
- Owner: `src/task/executor.ts#runSubprocess` captures selected sources in the upstream plain session spec.
- Owner: upstream `src/task/executor.ts#createSubagentSettings` owns shared Child settings.
- Owner: `src/task/subagent-runtime-config.ts#resolveSubagentCapabilities` owns shared Child capability resolution.
- Owner: the active project-settings `SUBAGENT-SYSTEM.template.md` owns live Child yield guidance.
- Implementation constraint: deployed mode guards preserve structured guidance for live pre-18.10.2 parents that omit the flag.
- Removal condition: remove the missing-flag compatibility path when pre-18.10.2 parent sessions are no longer supported.
- Coverage: upstream v18.10.2 owns structured and plain-result Child execution, completion, reminders, and revival.
- Coverage: upstream v18.22.1 gives a Child `yield` only when an output schema applies (`executor.ts#usesYield`).
- Required action: pass its structured-mode flag through the selected wrapper transform and persisted spawn inputs.
- Required action: pass `usesYield` as the capability owner's structured flag so schema-less runs lack `yield`.
- Coverage: upstream v18.10.3 restores interrupted Child turns from persisted prompts and owns catalog-selected sibling cache routing.
- Required action: preserve those runtime owners without copying parent prompt-source selections or conflating cache routes with conversations.
- Coverage: upstream v18.16.0 persists mounted Child devices and journals date/cwd reminder placements.
- Required action: preserve both lifecycles independently of selected template snapshots.
- Reason: current upstream has no Child base-template and wrapper-template composition capability.
- Reason: upstream v18.4.10 warm revivers retain plain spawn inputs rather than the executor's live run graph.
- Coverage: upstream v18.6.3 persists Child prompt blocks and refreshes them when the effective base or workpool changes.
- Owner: upstream `src/session/agent-session.ts#recordModelCallSystemPrompt` owns persisted prompt refresh.
- Coverage: upstream v18.9.1 gives each Root its own async-job manager and explicitly lends it to Children.
- Required action: preserve that handoff through Task, Eval, Vibe, and fresh or revived executor specs separately from prompt snapshots.
- Required action: retain Child template composition at the current upstream fresh-Child construction seams.
- Required action: pass normalized parent task depth to the current completion-probe owner after capability resolution.
- Required action: keep source snapshots in that spec and recreate transforms without retaining live sessions.
- Proof: `test/task/subagent-system-template.test.ts`.
- Proof: `test/context-file-inheritance.test.ts`.
- Proof: `test/task/workpool.test.ts` and rendering structured, plain-result, and workpool wrapper branches.
- Proof: dangling Child base and wrapper cases in `test/system-prompt-templates.test.ts`.
- Proof: removed-helper wrapper failure in `test/task/subagent-system-template.test.ts`.
- Proof: owning-session IRC delivery in `test/sdk-async-result-routing.test.ts`.
- Proof: structured-prefix and plain-result regression cases in `test/task/executor-subagent-reminders.test.ts`.
- Coverage: upstream v18.12.4 re-renders a parked Child's held IRC roster on warm revive.
- Owner: upstream `src/task/executor.ts#recordIrcRender` and `#trackSubagentIrcRoster` own that roster retention.
- Required action: report each selected-wrapper render through `createSubagentSystemPromptTransform`'s `onIrcRender`.
- Proof: warm-revive roster cases in `test/task/persisted-revive.test.ts`, composed through the selected transform.
- Coverage: upstream v18.15.0 delays Child IRC wakes until the initial assignment is delivered.
- Required action: preserve `awaitingAssignment: launch !== undefined` beside selected Child template composition.
- Proof: `test/task/subagent-irc-before-assignment.test.ts`.
- Coverage: upstream v18.13.2 retains a live Child's displayed IRC roster while its default prompt blocks stay unchanged.
- Required action: pass pre-wrapper provider blocks into the selected transform's roster callback and reuse the upstream held-roster owner.
- Coverage: upstream v18.13.0 restores extension tools once on warm and cold revival and owns model-aware cache-family promotion.
- Required action: preserve those lifecycle owners separately from selected template snapshots and persisted prompt bytes.
- Coverage: upstream v18.13.3 restores prewalk model and effort on warm and cold Child revival.
- Required action: preserve that restoration independently of selected prompt snapshots.
- Contract: warm revivers retain loaded base-template bytes and their diagnostic path, not a live file dependency.
- Coverage: upstream v18.13.1 centralizes Child AGENTS exclusion through `excludeAgentsMd` in the SDK and prompt builder.
- Owner: upstream `src/system-prompt.ts#withoutAgentsMd` owns the shared exclusion.
- Required action: extend that owner with `isAgentsContextFile` so arbitrary-name explicit AGENTS overrides remain excluded.
- Implementation constraint: exclude AGENTS before cross-root deduplication so excluded text cannot suppress allowed context.
- Proof: `test/cli-no-context-files.test.ts` and `test/task/revived-subagent-extension-tools.test.ts`.
- Coverage: upstream v18.17.0 places fresh and revived Children in pooled worker threads with scoped MCP followers.
- Required action: compose selected templates on the executing thread and preserve home-thread lifecycle routing.

### `MOMP-PROMPT-OVERRIDES` — Process-scoped Main overrides

- Disposition: `MOMP-EIGEN`.
- Contract: `--system-template <path>` selects an explicit Handlebars Main template for this process.
- Contract: `--system-prompt-template` is not an accepted alias for canonical `--system-template`.
- Contract: `--agents-file <path>` replaces only user-level `AGENTS.md` while retaining project discovery.
- Contract: both flags support spaced and equals syntax, relative paths, `~`, and regular-file symlinks.
- Contract: explicit empty, missing, unreadable, and non-regular paths fail.
- Contract: an explicit AGENTS file rejects whitespace-only content before replacing discovered user context.
- Contract: `--system-template` and `--system-prompt` are mutually exclusive.
- Contract: `--agents-file` and `--no-context-files` are mutually exclusive at CLI and SDK boundaries.
- Contract: disabling context discovery invalidates inherited prompt-cache affinity.
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

### `MOMP-TOOL-PROMPT-OVERRIDES` — Profile-scoped tool guidance

- Disposition: `MOMP-EIGEN`.
- Contract: `prompts/tools/read.md`, `bash.md`, `task.md`, `lsp.md`, `eval.md`, `web-search.md`, and `glob.md` under the active user agent directory override their bundled tool descriptions.
- Contract: `eval-agents.md` overrides Eval agent guidance in both inline and `help://eval/agents` views.
- Contract: `replace.md` and `sloppy.md` override only their matching Edit descriptions, not schemas or grammars.
- Contract: `security-scan.md` and `reflect.md` override their tools' descriptions.
- Contract: `isolation-error.md` overrides isolated-run recovery messages under the owning session's profile.
- Contract: isolation-error templates receive the active binary identity as `appDisplayName`.
- Contract: an absent override uses the corresponding bundled tool prompt as the sole default.
- Contract: a selected empty, unreadable, non-regular, or dangling override fails instead of silently falling back.
- Contract: each selected source renders through the same tool-owned variables as its bundled prompt.
- Contract: prompt overrides never replace tool names, schemas, or runtime behavior.
- Owner: `src/prompts/tool-prompt-source.ts` owns profile-scoped discovery, fallback, and file validation.
- Owner: `src/tools/read.ts#ReadTool`, `src/tools/bash.ts#BashTool`, `src/task/index.ts#TaskTool`, `src/lsp/tool.ts#LspTool`, `src/tools/eval.ts#EvalTool`, and `src/web/search/index.ts#WebSearchTool` render their selected sources.
- Owner: `src/tools/glob.ts#GlobTool` renders the selected Glob prompt.
- Owner: upstream `src/tools/eval-doc-topics.ts#getEvalDocTopics` selects and renders profile-scoped agent-topic guidance.
- Coverage: upstream v19.1.0 replaces `xd://` devices with bash tool commands and serves Eval doc topics to sessions without Eval from `src/internal-urls/help-protocol.ts`.
- Required action: pass the session's `agentDir` from both the Eval tool and the `help://eval/<topic>` fallback.
- Coverage: upstream v19.1.1 renders Read with `HAS_LINE_NUMBERS` and Eval with `timeoutDefault`/`timeoutRaisable`; the profile override source receives the same inputs.
- Coverage: upstream v18.19.0 moves Eval deadline bounds into the `timeout` schema and drops them from description render inputs.
- Coverage: upstream v18.22.1 adds `firstCallPreludes` to the Eval description inputs.
- Required action: render the selected Eval source with `firstCallPreludes`.
- Required action: keep accepted session tool names and other description inputs flowing through the selected profile description.
- Coverage: upstream v18.19.0 removes `task.file` and adds `task.steps`, which swaps the Task `task` field for `steps`.
- Required action: pass `steps` and `inlinePreludes` through selected sources and preserve their conditional Settings guidance.
- Coverage: upstream v18.14.2 adds operator-approved per-call model render inputs to Task and Eval.
- Required action: pass those inputs through selected sources while preserving operator-owned activation.
- Required action: derive a selected Task source's allowed-agent summary from its filtered advertisement.
- Coverage: upstream v18.18.9 freezes the per-call model advertisement into the session's prompt surface through `advertisedPerCallModel` (#18732).
- Required action: render the selected Task and Eval descriptions from that frozen advertisement, falling back to live resolution only when the session omits it.
- Owner: `src/tools/security-scan.ts#SecurityScanTool` and `src/tools/memory-reflect.ts#MemoryReflectTool` own their additional description sources.
- Coverage: upstream v19.1.0 deletes the restricted Write description and its `deviceOnlyWrite` session state, so no `write-device-only` override remains.
- Owner: `src/edit/index.ts#resolveEditToolDescription` selects profile sources for Replace and Sloppy.
- Owner: `src/task/isolation-runner.ts#renderIsolationError` loads and renders profile-owned recovery messages.
- Owner: `src/task/structured-subagent.ts#runStructuredSubagent` passes Task and Eval's owning profile to isolation.
- Implementation constraint: Eval selects agent-topic overrides only while spawning is allowed.
- Implementation constraint: Edit overrides preserve Hashline density selection and all other Edit modes.
- Coverage: upstream v19.1.0 adds the `magic` Edit mode with its own bundled description; no profile source overrides it.
- Implementation constraint: isolation receives its profile explicitly, without consulting process-global settings.
- Implementation constraint: Glob validates its selected source before memo lookup and keys rendering by source and flags.
- Implementation constraint: Web Search freezes auth-dependent guidance per tool instance to isolate profile prompt sources.
- Reason: current upstream has no profile-scoped override for a built-in tool prompt.
- Required action: retain strict profile overrides for every named source at its current description or message owner.
- Required action: include every managed tool override in upstream prompt-drift review and release settings-drift checks.
- Proof: override and fallback cases in `test/tools/tool-prompt-overrides.test.ts`.
- Proof: profile-owned recovery messages and retained-work preservation in `test/task/isolation-release.test.ts`.
- Proof: unchanged native and compact fallback behavior in `test/edit-prompt-variant.test.ts`.
- Proof: release-only runtime description and topic rendering through `scripts/inspect-tool-prompt-overrides.ts`.

### `MOMP-AGENT-PROMPT-OVERRIDES` — Profile-scoped agent templates

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
- Owner: upstream `src/task/index.ts#TaskTool.discoverAgents` passes the session's configuration directory to Task discovery.
- Owner: upstream `src/task/structured-subagent.ts#discoverAgentsShared` keys in-flight scans by the active profile.
- Owner: `src/task/persisted-revive.ts#createPersistedSubagentReviverFactory` discovers approval-grant agents under the live parent's profile.
- Required action: pass that profile's agent directory to cold-revive discovery without changing persisted prompt bytes.
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

### `MOMP-PROMPT-INSPECT` — Provider prompt inspection

- Disposition: `MOMP-EIGEN`.
- Contract: `momp system-prompt inspect` exposes provider blocks, dynamic parts, token breakdown, or Codex wire hashes.
- Contract: provider JSON lists rendered provider tool names and descriptions so operators can verify profile tool overrides.
- Contract: `--provider`, `--dynamic-parts`, `--breakdown`, and `--codex-wire-hash` are mutually exclusive.
- Contract: `--subagent <name>` previews a configured fresh top-level Child through runtime composition owners.
- Contract: Main inspection previews the headless print, RPC, and SDK Main by default.
- Contract: `--ui` previews the interactive TUI Main prompt, including `ask`, `cfg://`, terminal rendering guidance, and `textColors`.
- Contract: `--ui` keeps UI runtime effects off, so LSP warmup, MCP discovery deferral, and interactive model fallback never alter the preview.
- Contract: `--ui` is Main-only and fails as a usage error with `--subagent`.
- Contract: Child inspection reports configured-preview fidelity and omitted invocation-only state.
- Contract: breakdown measures provider prompts, tool prompts, tool schemas, dynamic parts, and dynamic sources.
- Contract: dynamic parts attribute the complete inline tool-command catalog, its inlined `--help` usage, and mounted MCP command guidance.
- Contract: Main previews declare upstream standby tools exactly as the first real request does.
- Owner: `packages/agent/src/agent.ts#prepareModelCall` supplies standby tools through a disposable `SentToolDefinitions` record.
- Contract: `--first-message <text>` is Main-only and requires `--breakdown` or `--codex-wire-hash`.
- Contract: first-message inspection captures the final request after runtime message injection.
- Contract: offline capture includes non-consuming SDK option decoration without redeeming fallback credits.
- Contract: ordinary Main and Child inspection uses Main-loop dialect preparation without committing request history.
- Contract: SDK previews never journal new reminder placements or consume the live reminder injector's state.
- Contract: provider-added blocks have `provider-call` attribution and contribute once to provider prompt totals.
- Contract: JSON breakdown output exposes exact request messages plus per-message and aggregate token measurements.
- Contract: `--codex-wire-hash` hashes the actual transformed Main SSE body and cache-relevant components.
- Contract: wire-hash output exposes no prompt text, tool schema, cache key, or credential.
- Contract: first-message and wire-hash inspection perform no provider network call.
- Usage: `momp system-prompt inspect --cwd <workspace> --first-message "<text>" --breakdown --json`.
- Usage: `momp system-prompt inspect --model <codex-model> --first-message "<text>" --codex-wire-hash --json`.
- Contract: large text and JSON outputs finish writing and remain complete before process exit.
- Contract: invalid flags, `--cwd`, and `--subagent` selections fail as usage errors with the usage line, never a code frame.
- Contract: Main inspection is not accepted as proof of Child loading.
- Owner: `src/commands/system-prompt.ts` owns command grammar, measurement, and output.
- Owner: `src/system-prompt.ts` owns opt-in counterfactual dynamic-fragment capture.
- Owner: `src/task/subagent-system-prompt.ts` owns inspected Child composition.
- Owner: `src/system-prompt.ts#SYSTEM_PROMPT_PART_PROBES` attributes upstream Mermaid, SVG, and table-chart guidance.
- Owner: upstream `src/task/executor.ts#createSubagentSettings` owns the inspected Child's settings.
- Owner: `src/task/subagent-runtime-config.ts#resolveSubagentCapabilities` owns its capability resolution.
- Owner: `packages/agent/src/agent-loop.ts#prepareProviderCall` owns shared provider-context preparation.
- Owner: `packages/agent/src/agent.ts#prepareModelCall` exposes non-dispatching configured preview preparation.
- Owner: `packages/agent/src/types.ts#AgentLoopConfig` marks preview-only provider transforms.
- Owner: `src/sdk.ts` restores preview reminders in a disposable injector with a read-only journal view.
- Owner: `src/sdk.ts` applies Main and Settings stream-option decoration before offline capture and real dispatch.
- Coverage: upstream v18.22.1 adds `omitDemotedReasoning` to Main stream options.
- Required action: set it in the shared Main stream options before offline capture, so previews match dispatch.
- Owner: `src/sdk.ts#CreateAgentSessionOptions.uiPromptPreview` renders `hasUI`-gated Main prompt inputs without UI runtime behavior.
- Implementation constraint: inspection keeps `hasUI` false because it also drives LSP warmup, MCP deferral, and model fallback.
- Owner: `src/sdk.ts#createAgentSessionScoped` suppresses provider connection prewarming for offline capture.
- Implementation constraint: offline capture also skips Codex WebSocket prewarming and OAuth usage prefetch.
- Contract: a Child declaring `structured: true` retains its structured inspection even when `task.structured` is disabled.
- Reason: current upstream has no provider-prompt inspection command or equivalent offline measurement workflow.
- Required action: retain one MOMP inspection command using runtime prompt-composition owners.
- Required action: pass `excludeAgentsMd: true` through direct Child inspection instead of retaining a separate filter.
- Proof: `test/system-prompt-inspect.test.ts`.
- Proof: the official-Anthropic first-message case rejects outbound prewarm attempts in the isolated source CLI.
- Proof: `test/system-prompt-templates.test.ts`.
- Proof: captured options serialize through the real Codex body owner in `test/sdk-tool-activation.test.ts`.
- Proof: preview reminder isolation and subsequent real dispatch in `test/sdk-tool-activation.test.ts`.
- Proof: live/preview dialect parity in `packages/agent/test/agent-side-request-context.test.ts`.
- Coverage: upstream v18.18.9 records context-file and skill ranges through `prompt.renderTracked` for `/context` attribution.
- Required action: render every inspectable provider block through that owner so `sources` and dynamic parts coexist.
- Proof: `test/sdk-system-prompt-template.test.ts` and `test/modes/context-view.test.ts` retain instruction-file and skill attribution.

### `MOMP-TASK-POLICY` — Profile delegation guidance

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: a custom `SYSTEM.template.md` carries task policy because it replaces the built-in Main template.
- Contract: GPT-5.6 default mode requires user, `AGENTS.md`, or skill authorization before delegation.
- Contract: GPT-5.6 eager mode allows proactive delegation.
- Contract: GPT-6 and newer models retain upstream restrained delegation; eager mode follows the upstream policy.
- Coverage: upstream v18.18.6 resolves models without a delegation rule to `balanced`.
- Coverage: its Main template renders `delegationTier`; `delegationBias` is no longer a render input.
- Required action: managed Main templates branch on `delegationTier` for gated, restrained, balanced, and eager policy.
- Contract: fan-out, concurrency, IRC, and peer-coordination instructions render from current upstream template inputs.
- Coverage: upstream requires task `solutionSpace` to describe design openness rather than work volume.
- Coverage: upstream maps task `effort` values to the target model's lowest, middle, and highest levels.
- Coverage: omitted task `effort` preserves configured thinking selection; `task.maxEffort` remains the ceiling.
- Coverage: upstream v18.12.5 ignores caller `effort` in preflight and dispatch when `task.enableEffort` is disabled.
- Owner: upstream `src/task/index.ts#TaskTool.#effortParams` owns that runtime gate.
- Coverage: model switches select the target model's policy even when model identity is hidden.
- Owner: upstream `src/task/prompt-policy.ts#sessionDelegationBias` resolves the active model's delegation bias.
- Owner: upstream `packages/catalog/src/compat/delegation.ts` resolves delegation policy from catalog rules.
- Owner: upstream `src/prompts/system/system-prompt.md#Delegation` owns bundled policy.
- Owner: the active project-settings `SYSTEM.template.md` owns the live policy text.
- Owner: upstream `src/prompts/tools/task.md` owns bundled fallback task-effort guidance.
- Owner: upstream `src/task/types.ts#taskSchema` owns the required `solutionSpace` field and its wire shape.
- Owner: the project-settings `task.md` override owns precise model-visible target-model effort guidance.
- Owner: `src/system-prompt.ts` owns the render inputs and template selection.
- Coverage: upstream owns delegation resolution, policy rules, and Task argument validation.
- Required action: preserve those owners without duplicate fork policy.
- Contract: ordinary agent model selection stays owned by Settings, agent definitions, and upstream extension policy.
- Required action: advertise per-call selection only when upstream permission and operator approval allow it.
- Coverage: upstream v18.14.2 adds `task.perCallModel`, defaulting to `off`, with operator-owned model approval.
- Owner: upstream `src/task/settings.ts#perCallModelEnabled` and `src/task/model-approval.ts` own runtime permission.
- Contract: disabled ordinary per-call selection does not advertise `model`.
- Coverage: upstream v18.18.6 owns that wire shape in `src/task/types.ts#getTaskSchema`.
- Coverage: its preflight refuses forged ordinary selectors.
- Required action: retain no fork schema, Task-tool, or documentation delta for the conditional `model` field.
- Required action: reuse upstream approval, dispatch, and revival guards rather than adding a second deny policy.
- Required action: preserve the operator's configured per-call mode and its Settings-owned model-selection guidance.
- Required action: keep the bundled Task prompt byte-identical to upstream.
- Required action: retain MOMP-specific policy and effort guidance in the active Settings templates.
- Coverage: upstream v18.17.0 preserves user-tagged effort and rejects conflicting per-call model overrides.
- Required action: retain that policy and pass `effort` through profile-owned model-mention descriptions.
- Coverage: upstream v18.10.2 defaults `task.structured` off; Eval agent and workpool remain structured.
- Coverage: upstream v18.10.3 owns named-agent soft request budgets; retain its exact-name precedence and reset semantics.
- Coverage: upstream v18.12.2 counts Cursor's server-side tool results toward soft request budgets.
- Owner: upstream `src/task/executor.ts#createSubagentRunMonitor` owns that accounting.
- Contract: managed MOMP profiles explicitly enable `task.structured` to retain Task schemas and yield-result behavior.
- Owner: upstream `src/task/settings.ts#cfgTaskStructured` owns the setting and its disabled default.
- Owner: project-settings `data/sync/agent/config.yml` owns managed activation.
- Required action: keep the Source default upstream-identical and validate activation in managed and effective release settings.
- Proof: managed and effective `task.structured: true` with global provenance through Source `Settings.loadReadOnly`.
- Proof: candidate prompt rendering through `momp system-prompt inspect`.
- Proof: `test/system-prompt-templates.test.ts`.
- Proof: effort guidance and per-call `model` visibility in `test/task/task-schema.test.ts` with the profile isolated.
- Proof: forged ordinary `model` refusal in upstream `test/task/task-batch.test.ts`.
- Proof: disabled-effort dispatch in upstream `test/task/task-batch.test.ts`.
- Proof: server-side request-budget cases in `test/task/task-guards.test.ts`.

### `MOMP-EVAL-OUTPUT` — Large owner-result preservation

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: Eval keeps large raw tool results separate or passes handles instead of re-emitting them.
- Coverage: upstream v18.12.1 owns print-based text, structured views, and image or figure attachments.
- Owner: the project-settings `eval.md` override owns model-visible result-handling guidance; the bundled Eval prompt stays byte-identical to upstream.
- Required action: retain the profile override and model-visible result-handling guidance in Settings.
- Required action: do not add a separate Eval runtime restriction for this guidance.
- Proof: profile override and fallback cases in `test/tools/tool-prompt-overrides.test.ts`.

### `MOMP-EVAL-ROUTING` — Context-safe Eval orchestration

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
- Coverage: upstream v18.12.2 pauses Eval cell deadlines during delegated tool waits without dropping cancellation.
- Owner: upstream `src/eval/js/tool-bridge.ts#callSessionTool` owns delegated wait routing.
- Required action: retain routing guidance aligned with the current upstream Eval runtime split in Settings.
- Required action: reuse upstream kernel isolation without a parallel fork implementation.
- Required action: align the selected Eval override with upstream helpers without a removed `display()` compatibility alias.
- Proof: profile override and fallback cases in `test/tools/tool-prompt-overrides.test.ts`.
- Proof: runtime semantics in Eval workflow, bridge-policy, Python-prelude, and JavaScript-executor tests.
- Proof: render the active Eval tool description and inspect its concurrent-name guidance.
- Proof: isolation-policy cases in `test/eval/agent-bridge-policy.test.ts`.
- Proof: delegated-wait deadlines and cancellation in `test/eval/session-tool-timeout.test.ts`.

### `MOMP-READ-SKILL-COMPACT` — Compact skill-read display

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: `read skill://` calls collapse into the compact grouped read view like `help://` doc reads.
- Contract: collapsed skill loads stay expandable so their full resolved content remains visible.
- Contract: the full skill body still reaches the model; collapsing is display-only and never trims load-bearing content.
- Owner: `src/internal-urls/skill-protocol.ts#SkillProtocolHandler.spec` declares compact skill grouping through `compactTranscript`.
- Owner: upstream `src/session/transcript/read-tool-group.ts#readArgsCollapseIntoGroup` applies the registered scheme policy.
- Owner: `src/ui/transcript/read-group.tsx#ReadGroup.previews` keeps expanded skill loads visible when ordinary previews are disabled.
- Coverage: upstream v19.2.1 adds `SchemeSpec.compactTranscript` (set by `help://`); MOMP only sets it for `skill://`.
- Required action: retain compact skill grouping and the display-only expanded-skill preview exception.
- Proof: `test/read-tool-group.test.ts`.

### `MOMP-READ-SCHEDULING` — Provider-roundtrip-efficient reads

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: the bundled Read prompt stays byte-identical to upstream.
- Contract: the active profile guides parallel independent reads through `MOMP-TOOL-PROMPT-OVERRIDES`.
- Owner: the project-settings `read.md` override owns model-visible parallel scheduling guidance.
- Owner: upstream `packages/agent/src/agent-loop.ts#executeToolCalls` owns sibling-tool concurrency.
- Coverage: upstream concurrently executes compatible sibling tool calls already issued by the model.
- Coverage: upstream v18.18.9 holds a read behind earlier sibling calls that may write, so parallel reads stay correct after a mutating `bash`.
- Required action: retain profile scheduling guidance and reuse upstream concurrency without a parallel Read scheduler.
- Proof: bundled prompt equality against current `upstream/main`.
- Proof: profile override and fallback cases in `test/tools/tool-prompt-overrides.test.ts`.
- Proof: sibling concurrency in `packages/agent/test/agent-loop.test.ts`.

### `MOMP-READ-ARTIFACT-RECOVERY` — Exact output-artifact recovery

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: middle-elided results expose the exact omitted range in complete artifacts without repeating preserved output.
- Contract: capped artifacts advertise head/tail samples, never recovery selectors for bytes that were not saved.
- Owner: `src/tools/output-meta-format.ts#formatTruncationMetaNotice` owns exact recovery references.
- Owner: `src/tools/streaming-output.ts#OutputSink` reports exact shown line counts and elided artifact lines.
- Owner: `src/tools/output-meta.ts#OutputMetaBuilder.truncationFromSummary` maps that report without guessed ranges.
- Implementation constraint: substituted inline chunks withhold ranges because their lines no longer match the artifact.
- Reason: upstream v18.4.9 caps output artifacts; original stream coordinates do not address their omitted middle.
- Coverage: upstream `a4663d570d` keeps the sink's middle cut on whole lines and names the shown ranges exactly (ISSUE-026 archived); upstream still links only the whole artifact, so the exact omitted-range selector remains MOMP-owned.
- Coverage: upstream v19.2.1 moves the TUI output-meta and sink owners into `src/tools/` and supplies head/tail samples for capped artifacts; it still exposes no omitted-range selector or per-side shown counts.
- Coverage: upstream v18.12.3 stops middle-eliding Read file pages and continues them with an exact `:N` offset.
- Coverage: upstream v19.0.0 renames spill references to `local://<N>.log` through `spillUrl()` but still offers only full-output recovery.
- Required action: build exact middle-range selectors with `spillUrl()`, never a literal URL scheme.
- Required action: retain only the runtime artifact-recovery deltas at the current output-metadata and sink owners.
- Proof: exact sink middle-elision recovery in `test/streaming-output.test.ts`.
- Proof: capped middle-elision recovery in `test/streaming-output.test.ts`.

### `MOMP-READ-USER-AGENTS` — URL fetch identity fallback

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: URL fetches without a caller-supplied User-Agent try pinned-current Chrome, Googlebot Smartphone, then curl.
- Contract: recognized bot blocks and transport failures advance to the next identity.
- Contract: HTTP 429 retries retain the current identity.
- Owner: `src/web/scrapers/types.ts#loadPage` owns request identity and fallback order.
- Coverage: upstream v18.18.6 records bot-wall refusals and challenge pages while rotating identities.
- Required action: retain the minimal identity-order delta at the current upstream fetch owner.
- Coverage: upstream v19.0.0 exports `USER_AGENTS` to `src/web/scrapers/utils.ts`, which walks the same identity order.
- Required action: capture upstream header walls only after the same-identity 429 retry.
- Proof: `test/web-scraper-user-agent.test.ts`.
- Source: https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers
- Source: Chrome Stable 156.0.8078.47, verified 2026-10-21: https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json
- Source: curl 8.23.0, verified 2026-10-21: https://curl.se/download.html

### `MOMP-WEB-SEARCH-PARALLEL` — Provider-roundtrip-efficient searches

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: before searching, the model collects all independent queries required for the current step.
- Contract: independent queries prefer parallel sibling `web_search` calls in one assistant turn.
- Contract: sequential searches are reserved for queries determined by prior results.
- Owner: the project-settings `web-search.md` override owns model-visible search scheduling guidance; the bundled prompt stays byte-identical to upstream.
- Owner: upstream `packages/agent/src/agent-loop.ts#executeToolCalls` owns shared sibling-tool concurrency.
- Coverage: upstream concurrently executes compatible sibling tool calls already issued by the model.
- Coverage: upstream v18.18.9 adds Hacker News guidance (`site:news.ycombinator.com`) to the bundled prompt; the profile override mirrors it.
- Required action: retain the profile override and model-visible scheduling guidance in Settings.
- Required action: do not add a Web Search-specific scheduler for this guidance.
- Proof: profile override and fallback cases in `test/tools/tool-prompt-overrides.test.ts`.

### `MOMP-TREE-COMPACT` — Token-efficient directory context

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: the system-prompt workspace tree omits size and mtime columns.
- Contract: Read directory trees retain file sizes and relative mtimes with single-space separators.
- Contract: both views retain names, hierarchy, ordering, depth, limits, and elision behavior.
- Owner: `packages/coding-agent/src/workspace-tree.ts` owns both render modes.
- Coverage: upstream v18.9.2 owns Read-directory single-space metadata formatting and its focused proof.
- Required action: retain only the metadata-free workspace-prompt mode at the current upstream formatter owner.
- Proof: `packages/coding-agent/test/workspace-tree.test.ts`.
- Retention: retain the workspace source and test delta until upstream also satisfies the metadata-free prompt contract.

### `MOMP-PROJECT-CACHE-ANCHOR` — Same-directory project-context cache reuse

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: project rules render in a `<project-context>` block; workspace tree, workspace roots, and active repository context render in a trailing `<workspace-context>` block.
- Contract: the workspace block is omitted when none of its sections render.
- Contract: a `<project-context>` block opening the volatile system suffix receives a breakpoint only when one stays idle after message anchoring.
- Contract: a session's first request carries one message, so new same-cwd sessions read the project block instead of re-writing it.
- Contract: tool and static-system anchors keep upstream placement; later turns keep both rolling message breakpoints.
- Owner: upstream `src/system-prompt.ts#buildSystemPrompt` renders `project-prompt.md` and `workspace-prompt.md`.
- Owner: `packages/ai/src/providers/anthropic.ts#applyProjectContextCaching` owns the idle-slot project breakpoint.
- Owner: upstream `packages/ai/src/providers/anthropic.ts#applyHeadCaching` and `#applyPromptCaching` own head and message placement.
- Reason: upstream anchors only before `<project-context>`, so every new session re-writes the complete project block.
- Coverage: upstream issue #16883 tracks this root cause; its triage proposes the same idle-slot anchor.
- Evidence: Anthropic Main first requests over 7 days wrote a median of 26682 cache tokens while reading 34652.
- Required action: retain the minimal template split and idle-slot anchor until upstream caches project context per directory.
- Proof: the idle-slot project-anchor case in `packages/ai/test/anthropic-head-caching.test.ts`.
- Proof: block-order cases in `test/system-prompt-templates.test.ts` and `test/system-prompt-inspect.test.ts`.

### `MOMP-ROUTINES` — User-defined sequential routines

- Disposition: `MOMP-EIGEN`.
- Contract: YAML routines discover as slash-style commands from the user routines directory.
- Contract: TUI, ACP, RPC, and SDK session paths advertise and execute routines consistently.
- Contract: opt-in bare-slash recognition includes routine names and retains session-bound confirmation before dispatch.
- Contract: names conflict-check against all built-in and discovered command namespaces.
- Contract: rejected ACP or RPC routine reloads retain the previous valid command registry.
- Contract: RPC clients surface reload rejection instead of silently accepting invalid candidate state.
- Contract: failed directory scans reject routine reloads; only an absent routine directory is optional.
- Contract: duplicate or conflicting routines fail before command advertisement.
- Contract: SDK and print sessions reject routine names owned by session file or custom commands at construction, reload, and replacement.
- Contract: autocomplete shows the declared description without synthetic routine suffixes.
- Contract: execution serializes active routine work and reports progress.
- Contract: a terminal step failure stops the routine, reports failed, and prevents subsequent steps.
- Contract: cancellation reports cancelled, including during the final step, and never reports complete afterward.
- Contract: complete is reported only after every planned step finishes successfully.
- Contract: a refused model request at the session cost cap fails the routine before another step or completion.
- Contract: idle-only snapshot forks reject active routines, including pauses between their turns.
- Contract: cancellation cleans routine lifecycle state.
- Contract: active routines prevent idle recap, idle compaction, and session settlement, including awaited pauses between steps.
- Owner: `src/session/agent-session.ts#isRunningRoutine` exposes token ownership to the settlement predicate.
- Coverage: upstream v18.22.0 folds idle quiet checks into `src/session/session-settle.ts#isSessionSettled` beside `isRunActive`.
- Required action: keep `isRunningRoutine` in that shared predicate, which idle maintenance and RPC settlement both consume.
- Required action: refresh idle maintenance at routine acquisition and release without blocking routine-owned prompt admission.
- Required action: re-check RPC settlement after locally handled routine prompts release their admission and routine token.
- Owner: upstream `src/modes/rpc/rpc-prompt-results.ts#RpcPromptResults` owns that completion notification.
- Proof: held-routine completion and failure ordering in `test/rpc-prompt-result.test.ts`.
- Contract: routines never weaken file-command or prompt-template precedence.
- Owner: `src/capability/routine.ts` owns the capability contract.
- Owner: `src/discovery/routines.ts` owns discovery.
- Owner: `src/discovery/helpers.ts#loadFilesFromDir` preserves scan failures for strict routine loading.
- Owner: `src/extensibility/routines.ts` owns parsing, validation, planning, and progress formatting.
- Owner: `src/task/command-templates.ts` owns the embedded command-template source that keeps routine discovery acyclic.
- Owner: `src/session/agent-session.ts` owns execution and lifecycle serialization.
- Owner: `src/session/agent-session.ts` `#assertRoutineCatalog` enforces session-owned routine name conflicts on every commit path.
- Owner: `src/session/agent-session.ts#setCommandCatalog` validates and atomically commits file and routine catalogs.
- Contract: routine submission consumes only its submitted draft; input entered while it runs remains intact.
- Contract: rejected internal routine steps never restore their expanded instructions into the user's draft.
- Required action: route routine-step drops through upstream `#reportDroppedPrompt` as synthetic so prompt follow-ups still return.
- Owner: `src/modes/rpc/rpc-mode.ts` serializes command refreshes and retains the last validated advertisement.
- Owner: upstream `src/session/agent-session.ts#isBusyForSnapshot` owns the shared snapshot busy decision.
- Owner: upstream `src/modes/rpc/wire/state.ts#stateDefs` owns the command-source enum for every generated RPC SDK.
- Reason: current upstream has no routine capability, routine registry, or sequential routine execution workflow.
- Required action: retain one MOMP routine capability and its transport integrations.
- Required action: check cancellation and terminal step outcomes before advancing or reporting completion.
- Required action: include routine sources through the wire registry and regenerate its TypeScript, Python, Rust, and Go clients.
- Proof: `test/routines.test.ts`.
- Proof: `test/agent-session-routine-lock.test.ts`.
- Proof: the mid-turn cost-cap routine case in `test/cost-gate.test.ts`.
- Proof: `test/input-controller-routine.test.ts`.
- Proof: `test/interactive-mode-routine-autocomplete.test.ts`.
- Proof: routine cases in `test/rpc.test.ts` and ACP tests.
- Proof: `test/rpc-wire/conformance.types.ts` and `test/rpc-wire/generated.test.ts`.

### `MOMP-COMMAND-UX` — Rename, argument completion, and slash-list display

- Disposition: `UPSTREAM-INTEGRIERT`.
- Coverage: upstream `/rename <title>` stores an explicit user-owned title.
- Contract: blank `/rename` generates a title from recent user and Assistant transcript context.
- Contract: generated title input omits tools, thinking, and code fences.
- Contract: transcript-based titles use confirmed file-command invocations instead of hidden expanded instructions.
- Contract: title generation ignores Assistant follow-up questions unless a later user reply selects or answers them.
- Contract: blank manual `/rename` generation carries `AUTO:` while remaining replaceable; automatic first-input and replan titles remain replaceable without that marker.
- Contract: a card-form title carries `AUTO:` after its card, so the card still parses and carries over.
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
- Proof: the icon-free slash-list case in `test/interactive-mode-routine-autocomplete.test.ts`.
- Coverage: upstream v18.20.1 resolves `^` mention rows through `#modelMentionSuggestions` and retries pending discovery.
- Required action: route slash-argument and ordinary prompt paths through that owner beside command-owned completion modes.

### `MOMP-COMMAND-INVOCATION-DISPLAY` — Typed file-command transcript rows

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: a prompt expanded from a file slash command shows its typed `/name args` invocation in live, resumed, and rebuilt transcripts.
- Contract: the leading `/name` of a confirmed invocation draws as a filled Dracula light-violet `#c8a1ff` chip with bold Dracula `#282a36` text.
- Contract: ordinary slash-looking text retains normal user styling; copy and rewind retain the original invocation.
- Owner: upstream `src/modes/interactive/messages.tsx#promptFace` selects the typed invocation and marks command rows.
- Owner: upstream `src/ui/transcript/messages/chips.ts#chipText` and `#termChips` own the command chip; `src/ui/styles/messages/user.ts#colorChips` fills it.
- Implementation constraint: a matching optimistic row is replaced by the canonical message so the command chip appears.
- Owner: `src/modes/controllers/event-controller.ts` owns that replacement in the user `message_start` handler.
- Contract: the model receives the expanded body unchanged; `UserMessage.commandInvocation` never reaches a provider request.
- Contract: unknown commands keep their literal text and record no invocation.
- Contract: rewind drafts and automatic titles use the typed invocation, never the expanded body.
- Owner: `src/session/agent-session.ts#dispatchPrompt` records the invocation at expansion for idle and queued prompts.
- Owner: upstream `src/session/agent-session.ts#pushQueuedUserMessage` carries the display-only field onto queued messages.
- Owner: `src/extensibility/slash-commands.ts#expandSlashCommand` returns confirmed invocation provenance even when expansion leaves the bytes unchanged.
- Owner: upstream `packages/ai/src/types.ts#UserMessage` carries the display-only field beside `liveSteered`.
- Owner: `src/session/transcript/transcript-entry.ts#userDisplayText` selects displayed and restored text.
- Owner: `src/modes/rpc/wire/content.ts` declares the field for generated RPC clients.
- Reason: upstream renders the expanded command body as an ordinary user message.
- Coverage: upstream v19.2.1 replaces the user-message component with Tern's chip-based user card; the violet rail, three-space separator, and literal-argument rendering of the old component have no owner there and were dropped.
- Required action: retain the field, its render consumers, and regenerated RPC clients until upstream records file-command provenance.
- Coverage: upstream v19.1.1 `src/session/messages.ts#operatorTitleText` also titles writable-collab prompts; the typed invocation still precedes the expanded body for user messages.
- Proof: the typed file-command case in `test/agent-session-queued-steer-delivery.test.ts`.
- Proof: identical `--codex-wire-hash` input hashes for an invocation and its literal expansion.
- Proof: command chip cases in `test/ui/transcript/messages/command-chip.test.ts` and installed TUI rendering with resume.

### `MOMP-CONVERSATION-SEARCH` — Persisted conversation lookup

- Disposition: `MOMP-EIGEN`.
- Reason: current upstream has no persisted-conversation lexical search tool or equivalent benchmark.
- Coverage: upstream v19.1.0 `archive.search` is an Eval-only, word-prefix, full-history session lookup without windowing, coverage diagnostics, or a Main tool, so it does not satisfy this contract.

#### Lookup behavior

- Contract: `conversation_search` searches persisted Main conversations without model calls.
- Contract: omitted scope and window search the current project over the last 10 days.
- Contract: the active session, tool traffic, thinking, developer messages, and hidden synthetic inputs are excluded.
- Contract: exact visible entries copied into the active continuation are excluded from other journals before matching, counting, and top-k selection.
- Contract: copies with different visible content and messages added on divergent branches remain searchable.
- Contract: only visible human user and Assistant text participates in matching and excerpts.
- Contract: confirmed file commands are searched by visible invocation, never by their hidden expanded instructions.
- Contract: all-term and phrase modes are deterministic and case-insensitive.
- Contract: phrase matching preserves internal whitespace after trimming outer query whitespace.
- Contract: an empty query fails validation naming an empty string, never its numeric length; searches never list conversations without a term.
- Contract: excerpts use source-text offsets even when Unicode lowercasing changes string length.
- Contract: local selection and global ranking share one ordering with stable identity tie-breakers.
- Contract: smaller limits return prefixes of larger results for an unchanged corpus and fixed search time.
- Contract: bounded text and JSON output returns newest matches with explicit partial-coverage diagnostics.
- Contract: truncated text output names an actionable next step; at the `limit` maximum it names narrowing filters instead.
- Contract: enumeration and stat failures contribute to partial-coverage diagnostics.
- Contract: read and header failures of session files modified within the window also contribute.
- Contract: discovery content-scans only session files modified within the window; older files are only stat'ed.
- Contract: an empty discovered corpus never conceals a discovery failure as a complete search.
- Contract: Children never receive the tool.
- Contract: repeated searches in one process reuse per-journal visible-message projections and parse only appended complete lines.
- Contract: a projection is reused only while inode, minimum size, header identity, and the digest before its end still match.
- Contract: a trailing partial line is searched and counted as before but never enters a cached projection.
- Contract: cached projections apply the lookback window at query time, so every `days` value shares them.
- Contract: retained projections stay bounded by a character budget with least-recently-used eviction.
- Owner: `src/session/conversation-corpus.ts#ConversationTranscriptCache` owns projection reuse and invalidation.
- Owner: `src/tools/conversation-search.ts` owns the process-wide cache instance.
- Reason: journals change only by append, append rollback, in-place title-slot rewrite, or atomic rename, so a matching prefix stays valid.
- Owner: `src/session/conversation-corpus.ts` owns visible transcript projection and journal discovery.
- Owner: upstream `src/session/session-listing.ts` owns session enumeration, scanning, and discovery-error reporting.
- Owner: `src/session/session-listing.ts#listSessionsModifiedSince` selects windowed files before content scans.
- Required action: verify the current bounded header before coverage-aware scan-cache reuse, even when size and mtime match.
- Reason: scanning every stored session thrashed the shared 4096-entry scan cache and cost ~0.7 s per `all` search.
- Required action: reuse upstream `newestSessionFiles` with its optional failure reporter, not a parallel enumerator.
- Owner: `src/session/conversation-search.ts` owns lexical matching, windowing, ranking, and coverage accounting.
- Owner: `src/tools/conversation-search.ts` owns the tool boundary and Main-only exposure.
- Owner: `src/tools/conversation-search-format.ts` owns output variants.
- Required action: retain one Main-only MOMP tool and its complete search closure.
- Coverage: upstream v18.20.0 groups `--help` tools through `src/tools/builtin-names.ts#BUILTIN_TOOL_HELP`, keyed by every built-in.
- Required action: keep its default-on `conversation_search` entry so help groups match the top-level tool plan.
- Proof: upstream `test/tools/builtin-defaults.test.ts` matches that help group to the default top-level tool plan.
- Coverage: upstream v16.2.11 requires a `docs/tools/<name>.md` root doc for every built-in tool name.
- Owner: `docs/tools/conversation-search.md` documents the tool for `omp://`.
- Proof: upstream `test/internal-urls/docs-tool-coverage.test.ts` finds that doc.
- Required action: preserve discovery failures through search coverage accounting.
- Coverage: upstream v18.12.0 follows transcript symlinks, skips symlinked buckets, and deduplicates physical files.
- Owner: upstream `src/session/session-listing.ts#scanBucketFiles` owns cross-bucket enumeration.
- Required action: preserve that owner and deduplication with partial enumeration and discovery-failure accounting.
- Coverage: upstream v18.14.2 isolates expected unavailable-bucket failures for ordinary session lookup.
- Required action: preserve its rollback and unexpected-error propagation without a coverage reporter.
- Required action: coverage-aware search retains yielded files and reports every failed enumerated bucket.
- Coverage: upstream v19.1.0 scans buckets concurrently in `scanBucketFiles` and stats through `statNewestFirst`.
- Required action: collect each concurrent bucket incrementally so a reported failure keeps its yielded files, and report `statNewestFirst` failures.
- Proof: `test/conversation-search.test.ts`, including restored-mtime header changes and atomic replacements.
- Proof: upstream `test/session-bucket-isolation.test.ts` retains ordinary lookup isolation.
- Proof: active-continuation copy exclusion, divergent siblings, and limit-prefix stability in `test/conversation-search.test.ts`.
- Proof: confirmed file-command invocation search and hidden-expansion exclusion in `test/conversation-search.test.ts`.

#### Benchmark behavior

- Contract: the benchmark uses a fixed guaranteed-miss query and records effective warmup and measured-run counts.
- Contract: `--scope` selects project or all-project corpora; project remains the default.
- Contract: `--transcript-cache cold` gives every run a fresh cache; `warm` reuses projections filled by at least one warmup run.
- Contract: cold remains the default so measurements stay comparable with earlier parse-path baselines.
- Contract: its corpus fingerprint identifies selected session-file paths, sizes, and modification times.
- Contract: incomplete discovery or scan coverage invalidates a benchmark run.
- Contract: disappearing selected files, changed file metadata or visible-message counts, and unexpected matches invalidate a run.
- Usage: `bun --cwd packages/coding-agent run bench:conversation-search -- --cwd <workspace>`.
- Usage: `bun --cwd packages/coding-agent run bench:conversation-search -- --cwd <workspace> --scope all --transcript-cache warm`.
- Owner: `scripts/bench-conversation-search.ts` owns the reproducible local evaluator and output.
- Required action: preserve discovery failures through benchmark validation.
- Proof: `test/conversation-search-benchmark.test.ts`.

### `MOMP-SESSION-STREAM-PARSE` — Decoded-text journal streaming

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: streamed journal visits decode each newline-terminated batch once and parse it as text.
- Contract: entries, malformed-record counts, title-slot peeling, record and byte limits, and invalid-UTF-8 replacement stay unchanged.
- Contract: an unfinished value resumes at its exact byte offset, including after invalid UTF-8.
- Contract: `startByte` resumes a visit at a line boundary without peeling a title slot.
- Contract: `maxBytes` limits the byte count after `startByte`, not an absolute end offset.
- Coverage: upstream v18.13.0 caps streams manually to avoid bounded-slice hangs and overreads on macOS and Windows.
- Required action: preserve that cap and pass byte lengths from the conversation projection owner.
- Coverage: upstream v18.14.0 bounds malformed-record recovery with growing newline-cut parse windows.
- Required action: retain that window over decoded text and map consumed UTF-16 positions back to exact byte offsets.
- Owner: upstream `src/session/session-loader.ts#visitEntriesFromFileStream` owns streamed journal parsing.
- Coverage: upstream v18.20.1 moves header-id parsing into `src/session/session-header-id.ts`; retain only the byte-offset helpers here.
- Reason: Bun 1.4.3 `Bun.JSONL.parseChunk` parses typed arrays about 2.4x slower than strings on session JSONL.
- Reason: `MOMP-CONVERSATION-SEARCH` needs `startByte` to parse only appended journal bytes.
- Required action: retain this delta until upstream or Bun removes the typed-array cost and offers an offset start.
- Proof: `test/session-loader-stream.test.ts`, including the invalid-UTF-8 unfinished-value case.
- Proof: `bench:conversation-search -- --scope all` before and after the delta.

### `MOMP-CACHE-MISS-COLOR` — Prominent cache-miss foreground

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: enabled cache-miss markers use lemon yellow `#FFFF00` for their terminal label and short rule by default.
- Contract: native marker labels use the same theme token; existing text, geometry, and detection remain unchanged.
- Contract: optional theme color `cacheMiss` overrides only this marker without changing `muted`, `dim`, or `warning`.
- Contract: themes without `cacheMiss` retain compatibility and receive the default.
- Owner: upstream `src/ui/transcript/messages/markers.tsx#CacheMissMarker` owns marker presentation.
- Owner: `packages/tui/src/theme/schema.ts` owns the optional token and `DEFAULT_CACHE_MISS_COLOR`.
- Owner: upstream `packages/tui/src/theme/theme.ts` materializes the optional default beside `thinkingMax`.
- Reason: current upstream renders the marker label as `muted` and its rule as `dim`.
- Coverage: upstream v18.9.0 adds optional `assistantMessageText`; keep its terminal-default semantics separate from `cacheMiss`.
- Required action: retain the marker-specific token and render integration.
- Proof: default and override resolution in `packages/tui/test/theme/cache-miss-color.test.ts`.
- Proof: render the real marker in a TUI and inspect its foreground and unchanged geometry.

### `MOMP-RUNTIME-AUDIT` — Repeatable local performance evidence

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

### `MOMP-REMOTE-COMPACTION-TAKEOVER` — Preserve running remote compaction

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
- Coverage: upstream v19.0.0 adds cache-warmer bridge speculation that carries its own claimed result into maintenance.
- Implementation constraint: a bridge commit bypasses remote adoption; adoption applies only without a bridge speculation.
- Owner: `#claimArmedSpeculation` and `#commitAutoCompactionResult` retain validation and history-commit ownership.
- Reason: upstream 18.7.0 aborts unfinished speculation before establishing that its replacement can run.
- Source: https://github.com/can1357/oh-my-pi/blob/e0fc1cf4ea354b445a359b37fa5eb58deaa85598/packages/coding-agent/src/session/session-maintenance.ts#L2361-L2373
- Upstream: https://github.com/can1357/oh-my-pi/pull/20201 (ISSUE-034) carries this closure; the abort still reproduces on `upstream/main@88295533e6`.
- Required action: retain this upstreamable delta until upstream safely adopts running remote speculation.
- Proof: grace-cap adoption and post-snapshot replay in `test/compaction-speculation.test.ts`.
- Proof: cancellation, late completion, remaining deadline, failure fallback, and reset-during-wait in that test file.

### `MOMP-FALLBACK-DISCOVERY` — Discovery-safe fallback warnings

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: unresolved provider-qualified fallbacks never flash warnings while initial discovery is pending.
- Contract: pending discovery includes partial cached catalogs and built-in catalogs without a discovery state.
- Contract: known role-incompatible models and malformed fallback configuration remain immediately reportable.
- Contract: initial background discovery completion, including failure, ends deferral and reports unresolved entries once.
- Contract: fallback validation never starts discovery or changes configured model selectors.
- Owner: upstream `src/config/model-registry.ts#isProviderDiscoveryPending` owns catalog readiness.
- Owner: upstream `src/session/retry-fallback-chains.ts#validateRetryFallbackChains` owns compatibility validation.
- Owner: upstream `src/session/agent-session.ts` and `src/session/turn-recovery.ts` own post-discovery reconciliation.
- Coverage: upstream v18.12.0 defers cached or unavailable catalogs during the initial background refresh.
- Coverage: its CLI schedules validation after starting that refresh and retains warnings for embedders without one.
- Coverage: upstream v18.20.0 seeds cached discovery states for authenticated special providers and keeps them final without a refresh.
- Required action: prove deferral in the production order, refresh before validation; upstream alone still flashes the partial-cache case.
- Reason: built-in catalogs without discovery state and known role-incompatible models still require the MOMP delta.
- Required action: retain only no-state readiness and unresolved-only deferral alongside upstream refresh lifecycle policy.
- Finding: ISSUE-039 (archived, Not-Worth-Pursuing) covers the wrong-kind deferral; on `upstream/main@e4fe878297` only that assertion fails, and the failed-refresh case passes, so this delta stays fork-only.
- Proof: partial-cache and failed-refresh cases in `test/agent-session-retry-fallback.test.ts`.

### `MOMP-MODEL-STARTUP` — Strict configured-default resolution

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: an unresolved configured default awaits cache-aware discovery, including built-in account catalogs.
- Coverage: upstream v18.11.1 resolves the configured default retry-fallback chain at startup through `tryResolveDefaultRoleFallback`.
- Coverage: upstream v18.11.3 resolves explicit fallback authentication and skips catalog loading without a configured chain.
- Required action: retain that upstream fallback owner alongside mandatory discovery and configured-default rejection.
- Coverage: upstream v19.1.1 routes the stale-default CLI case through `spawnPrintCli` behind a dead proxy; the MOMP proof keeps that helper and asserts rejection instead of the warning.
- Contract: a default still unresolved after discovery and its configured fallback chain fails startup instead of selecting an unrelated model.
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
- Coverage: upstream v18.14.0 requires exact provider-qualified selectors but only warns before an unrelated default fallback.
- Required action: retain upstream selector matching and reject that fallback under the configured-default contract.
- Finding: ISSUE-038 tracks the built-in-catalog discovery gate for upstream; the rejection of unresolved defaults stays fork-only.
- Proof: stale-default rejection in `test/cli-provider-model-deferral.test.ts`.
- Proof: cold built-in discovery, unresolved-default rejection, and fallback effort in `test/sdk-model-selection.test.ts`.
- Proof: scoped rejection in `test/repro-issue-1022-disabled-default-model.test.ts`.
- Proof: configured endpoint discovery in `test/sdk-default-role-discovery-config-provider.test.ts`.

### `MOMP-MISTRAL-USAGE` — Mistral Vibe budget reporting

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: `momp usage` shows the monthly Vibe Code and API budgets of `mistral` api-key credentials.
- Contract: each budget shows its usage percentage, reset date, and budget amount.
- Contract: the budgets occupy separate capacity buckets.
- Contract: a 401 marks the key invalid; 403, 404, other failures, and budget-less payloads report no usage.
- Owner: `packages/ai/src/usage/mistral.ts#mistralUsageProvider`, registered in upstream `src/usage/registry.ts#DEFAULT_USAGE_PROVIDERS`.
- Reason: current upstream registers no Mistral usage provider.
- Upstream: https://github.com/can1357/oh-my-pi/pull/18723 (ISSUE-032) carries the identical closure.
- Required action: remove this delta once upstream merges an equivalent provider.
- Implementation constraint: broker clients receive usage from the broker host, so it needs a release with this provider.
- Proof: `packages/ai/test/mistral-usage.test.ts`.
- Proof: `momp usage` with a Vibe sign-in key renders both budgets.

### `MOMP-STATS-SUMMARY` — Multi-range CLI usage overview

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
- Owner: upstream `packages/stats/src/rollup.ts#getUsageAttribution` owns per-agent and side-channel usage aggregation.
- Coverage: upstream v19.0.0 replaces `getStatsByAgentType` with `getUsageAttribution` and its shared `UsageAttributionTotals`.
- Owner: `packages/stats/src/aggregator.ts#getSummaryStats` loads the complete 24h summary with one shared cutoff.
- Owner: `packages/stats/src/aggregator.ts#getOverallStatsForRange` loads totals without dashboard or detail aggregates.
- Implementation constraint: 7d and 30d load only totals to avoid unused detail and chart queries.
- Implementation constraint: 24h aggregates share one cutoff so boundary records do not disagree between sections.
- Coverage: upstream provides a simple `stats --summary`.
- Reason: upstream does not provide MOMP's package-local, mobile-safe 24h/7d/30d summary.
- Required action: retain one MOMP summary composer without changing standalone `omp-stats`.
- Required action: carry unpriced-request metadata through `UsageAttributionTotals` in the existing attribution owner.
- Required action: keep the summary command regression aligned with MOMP output and its unknown-cost assertion.
- Proof: `packages/coding-agent/test/stats-summary.test.ts`.
- Proof: `packages/coding-agent/test/stats-cli-output.test.ts`.
- Proof: `packages/coding-agent/test/stats-cli-summary.test.ts`.

### `MOMP-TMUX-PAGEUP` — Native tmux history access

- Disposition: `MOMP-EIGEN`.
- Contract: PageUp on a focused empty composer opens tmux copy mode one page up.
- Contract: drafts (even whitespace), pending images, overlays, non-tmux sessions, and failed tmux commands retain existing handling.
- Owner: `src/modes/controllers/input-controller.ts#onComposerKey` owns the empty-composer PageUp bridge.
- Implementation constraint: use upstream `packages/tui/src/driver/mux/detect.ts#hasMultiplexerSession` to detect explicit session ownership.
- Implementation constraint: composer app bindings run only while the composer has focus, so overlays keep PageUp.
- Required action: retain only the empty-composer tmux bridge at the current upstream input-controller seam.
- Reason: current upstream has no tmux copy-mode bridge; this fork-specific capability remains required.
- Proof: PageUp cases in `test/input-controller-keybindings.test.ts`.
- Verification gap: the real-tmux PageUp case targeted the removed Composer API; verify copy mode in the installed TUI.

### `MOMP-PACKAGE-IDENTITY` — Side-by-side fork identity and update safety

- Disposition: `MOMP-EIGEN`.
- Contract: publish staging produces package `@mikeei/momp`, binary `momp`, and exact `MOMP_VERSION`.
- Contract: the published CLI executes `dist/cli.js`, which bundles the complete fork workspace closure.
- Contract: published bundles retain required patched dependencies without install-time patching.
- Contract: publish-time bundle identity is injected without changing source package metadata.
- Contract: source `package.json` stays upstream-near; publish metadata is never hard-coded into source.
- Contract: fork names, registry metadata, binaries, and publish versions exist only in temporary publish staging.
- Contract: published `momp update` refuses self-installation.
- Contract: the refusal prints `bun install -g @mikeei/momp@latest --force --minimum-release-age 0`.
- Contract: `momp update --check` never installs or treats the upstream package as the fork package.
- Contract: published `momp update` help describes its manual-install behavior and never advertises self-installation or channel switching.
- Contract: startup may check upstream availability but compares against the fork's base version.
- Contract: legacy extension self-imports resolve against the installed package identity.
- Contract: copyable CLI self-invocations, help examples, and recovery hints use the active binary identity.
- Contract: published MOMP emits `momp`, including `momp --resume <id>` with any active profile.
- Contract: missing-session picker and new-session recovery commands retain the profile selected for the failing launch.
- Contract: upstream/source identity retains `omp`; shared `.omp` paths and protocol namespaces remain unchanged.
- Owner: `src/app-version.ts` owns runtime identity and upstream-version comparison.
- Owner: `src/task/isolation-runner.ts#renderIsolationError` supplies active binary identity to recovery templates.
- Owner: `src/tools/browser/relay/probe.ts#UPDATE_RELAY_EXTENSION` uses the active identity for relay recovery.
- Implementation constraint: the bundled isolation-error template uses `appDisplayName` even without a profile override.
- Owner: `src/utils/resume-command.ts` owns profile-aware start and resume commands; `src/main.ts` renders recovery hints after profile selection.
- Owner: `scripts/bundle-dist.ts` embeds validated package identity overrides into the bundled CLI.
- Owner: `src/cli/update-cli.ts` owns fork-safe update behavior.
- Owner: `src/commands/update.ts` and `src/cli/command-help.ts#updateHelp` render identity-specific update help.
- Owner: `src/commands/session.ts` and `src/cli/command-help.ts#sessionHelp` use active identity for session transfer and lease-probe help and usage.
- Owner: `src/cli/gallery-screenshot.ts#captureGalleryScreenshots` uses active identity in missing-VHS recovery commands.
- Owner: upstream v19.0.0 daemon consumers `src/daemon/client.ts`, `src/disasm/client.ts`, `src/tools/browser/shared-daemon.ts`, `src/cli/ps-cli.ts`, and `src/commands/ps.ts` render recovery hints and `ps` examples with active identity.
- Coverage: upstream v19.0.0 replaces per-project brokers with one per-user daemon under `run/daemon`, which MOMP and upstream share.
- Coverage: upstream v19.1.0 also hosts MCP servers in that shared daemon; the newest-install rule below therefore also selects the MCP host build.
- Owner: `src/cli/browser-relay-cli.ts` and `src/commands/browser-relay.ts` brand copyable relay commands after upstream v19.1.0 moved hosting into the extension's native host.
- Reason: a shared daemon keeps one `ps` board and one shared-browser claim, while separate directories would race the shared Chrome profile.
- Coverage: daemon builds compare the shared Utils `VERSION` plus a file-mtime stamp, so the MOMP suffix never orders builds and the newest install wins without ping-pong.
- Proof: an isolated `OMP_DAEMON_DIR` daemon spawned by the source candidate served installed `omp ps --json` and source `ps --json` from one PID.
- Owner: `src/ui/welcome/tips.ts#welcomeTip` brands copyable startup-tip invocations with `APP_DISPLAY_NAME`.
- Owner: `src/modes/interactive/update-notice.tsx#UpdateNotice` renders the identity owner's update source label and action.
- Owner: `src/extensibility/plugins/legacy-pi-compat.ts` owns installed-package self-import compatibility.
- Coverage: upstream `loadLegacyPiModule` loads custom tools.
- Coverage: upstream v18.12.5 owns custom-registry manifest fallback for empty Artifactory `dist-tags`.
- Coverage: upstream v18.14.0 owns lazy SDK/provider loading, native notices, and `gen:export-viewer`.
- Coverage: upstream v18.20.1 moves `managedInstallName` to `src/cli/managed-install.ts`; `update-cli` keeps the MOMP refusal.
- Required action: preserve those owners while retaining package identity and patched dependencies in the bundle.
- Contract: automatic updates and their setup offer also refuse MOMP through the shared upstream update owner.
- Owner: `MOMP_VERSION` owns the source release version.
- Reason: canonical upstream cannot own the `@mikeei/momp` package identity or its fork-safe update policy.
- Required action: retain one MOMP identity owner and publish-time staging boundary.
- Required action: keep patched Puppeteer and ArkType dependencies embedded in the npm bundle.
- Required action: use `APP_DISPLAY_NAME` at self-invocation consumers instead of Utils `APP_NAME` or hard-coded `omp`.
- Proof: `test/update-cli.test.ts`.
- Proof: custom-registry fallback in upstream `test/cli/update-cli.test.ts`.
- Proof constraint: npm dry-run fixtures create the global package root before checking release-age policy.
- Proof: `test/extension-loader-self-import.test.ts`.
- Proof: late-profile recovery commands in `test/main-session-resolution-error.test.ts` and actual packed missing-session invocations.
- Proof: published-identity and profile behavior in `test/utils/resume-command.test.ts`.
- Proof: inline-invocation branding with prose left unchanged in `test/ui/welcome/tips-branding.test.ts` and the actual installed startup surface.
- Proof: actual candidate CLI help, usage errors, and resume recovery hints.
- Proof: source and packed missing-VHS diagnostics name `omp` and `momp`, respectively.
- Proof: publish and smoke gates owned by `project-momp-upgrader`.

### `MOMP-LSP` — LSP extensions at upstream owners

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: rename previews show bounded positions and replacement text and report omitted edits.
- Owner: current upstream `src/lsp/utils.ts#formatWorkspaceEdit` and `#formatTextEdit` own the rename-preview delta.
- Contract: workspace `symbols` (`file: "*"`) without `query` searches the `symbol` name, ignoring its `#N` suffix.
- Reason: a 30-day session audit (2026-11-20) found 18 workspace symbol searches rejected for a missing `query`.
- Owner: `src/lsp/tool.ts#LspTool.execute` owns the workspace-symbol query fallback.
- Coverage: upstream v19.0.0 filters file-scoped symbol queries through `formatMatchingDocumentSymbols`, so MOMP removed its filter helpers and test.
- Coverage: upstream v19.2.1 ships the tsserver fallback (`src/lsp/config.ts#selectTypescriptServer`, PR #20202) and the first-open silent-load window (`src/lsp/client.ts#settleProjectLoadWithoutProgress`, PR #20204); MOMP dropped both closures.
- Owner: the project-settings `lsp.md` override owns guidance for file-rename previews, omitted text-edit details, and name-only symbol lookup.
- Coverage: upstream v18.11.3 owns configurable LSP call and diagnostic-wait budgets.
- Required action: render the selected profile prompt with its current timeout variables at the dynamic description owner.
- Required action: retain the rename-preview and workspace-symbol deltas with their prompt and proof until current upstream satisfies each.
- Proof: rename-preview cases in `test/tools/lsp-regressions.test.ts`.
- Proof: the workspace-symbol `symbol` fallback case in `test/tools/lsp-regressions.test.ts`.
- Implementation constraint: `lsp-regressions.test.ts` points the agent dir at its empty test home.
  The resolver caches `~/.omp/agent` at import, so an operator `.lsp.json` otherwise leaked into the release proof.

### `MOMP-READ-TOKEN-COUNT` — Exact Read token totals

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: completed Read groups show exact native-token totals as `Read (N) · 14,823 Read Tokens`.
- Contract: totals count final sanitized text after TTSR once per executed Read call, never per rendered target row.
- Contract: pending groups, unavailable counters, image-only results, and historic results without metadata omit the total.
- Contract: Read totals stay visible regardless of `display.showTokenUsage` because they describe tool payload.
- Contract: single-row, inline-preview, and full Read result titles place the total after the path.
- Owner: `packages/agent/src/tokenizer.ts` owns exact native-count availability.
- Owner: `src/session/agent-session.ts` owns final Read-result measurement in `ReadToolDetails.readTextTokens`.
- Owner: `src/ui/transcript/read-group.tsx#readTokensLabel` owns aggregation; `src/ui/styles/transcript/read-group.ts` draws it.
- Owner: `src/tools/read-token.ts` owns metadata validation and label formatting.
- Owner: `src/ui/tools/read.tsx#readHead` and `src/ui/styles/tools/read.ts` own full-result display.
- Coverage: upstream v19.2.1 moves `cfg://` and `proc://` reads to scheme presenters without a Read title; those cards carry no token label.
- Required action: retain exact-only measurement and every compact and full Read rendering path at the named owners.
- Proof: exact-count availability cases in `packages/agent/test/tokenizer.test.ts`.
- Proof: post-TTSR measurement in `test/agent-session-message-pipeline.test.ts`.
- Proof: single-row, aggregate, delimited, unmeasured, and merged-preview cases in `test/read-tool-group.test.ts`.

### `MOMP-TEXT-COLOR` — Opt-in response foreground colors

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: `tui.textColors` is a boolean setting, disabled by default, exposed in Appearance settings.
- Contract: enabling it renders inline `<span style="color:#RRGGBB">text</span>` foreground colors in terminal Markdown.
- Contract: nested spans inherit or override foreground color; closing spans restore their parent.
- Contract: logical scopes end at inline-run boundaries, so an unclosed span never colors later blocks.
- Contract: foreground tags preserve hard-line-break whitespace trimming without joining adjacent words.
- Contract: disabled rendering, inline code, hex swatches, and block HTML remain unchanged.
- Contract: Main UI sessions expose `textColors` to templates from the effective setting.
- Contract: headless and Child sessions never advertise terminal color guidance.
- Contract: live setting changes rebuild the Main prompt and Markdown presentation through existing owners.
- Owner: upstream `packages/tui/src/text/markdown/inline.ts#renderInline` owns span scopes and restoration.
- Owner: upstream `packages/tui/src/text/markdown/look.ts#setMarkdownLook` carries the host setting; `render.ts#withHostLook` applies it.
- Owner: MOMP adds `src/modes/settings.ts#cfgTuiTextColors` at the upstream settings owner.
- Owner: upstream `src/modes/interactive-mode.ts#syncTranscriptDisplaySettings` owns initial and live rendering configuration.
- Owner: `src/system-prompt.ts` and `src/sdk.ts` own render inputs and session-scoped prompt rebuilds.
- Owner: project-settings `SYSTEM.template.md` owns guidance inside `{{#if textColors}}`.
- Reason: upstream treats `<span>` as zero-width structure and has no opt-in foreground-span or model-guidance contract.
- Coverage: upstream v19.2.1 replaces the component Markdown renderer with Tern's `packages/tui/src/text/markdown/` renderer; MOMP re-implemented span scopes in its inline renderer.
- Verification gap: native (TSP) hosts render Markdown themselves and do not yet draw span colors.
- Required action: retain the minimal setting, renderer, and conditional-template closure at existing owners.
- Proof: span scope, restoration, line-break trimming, and disabled rendering in `packages/tui/test/markdown/text-colors.test.ts`.
- Proof: live Main UI and headless prompt cases in `test/system-prompt-templates.test.ts`.
- Proof: render both deployed template branches and interact with the actual TUI.

### Experiments and non-contract artifacts

Changelogs, formatting-only commits, test migrations, proposals, and experiments do not justify runtime retention.
Classify retained candidates during every full upgrade as `NICHT-CONTRACT-AKTIV` or `NICHT-CONTRACT-ENTFERNEN`.
`NICHT-CONTRACT-AKTIV` requires an operator workflow, release gate, performance decision, or regression investigation.
`NICHT-CONTRACT-ENTFERNEN` requires complete removal during the same full upgrade or authorized cleanup.
The closure includes scripts, prompts, workers, package commands, fixtures, generated output, and documentation.
NEVER retain experimental code because it might become useful later.

Issue-owned historical evidence belongs under `issues/evidence/issue-NNN/`, with links in the owning issue record.
Preserve measurements, diagnostic sources, captures, and contribution history while local investigation is paused.
These archives are not live fork deltas and do not require investigative reruns during upgrades.
Resume a paused investigation only after an explicit user request.

- `packages/coding-agent/scripts/inspect-tool-prompt-overrides.ts`: `NICHT-CONTRACT-AKTIV`.
  - Consumer: `project-momp-upgrader` operator proofs render managed overrides without a provider inspection surface.
  - Owner: the Source probe uses existing Tool description and Eval-topic owners; it never executes their operations.
  - Proof: `momp-upgrade prove` checks every divergent runtime override against the probe output.

- `packages/coding-agent/scripts/cache-probe.ts` (`probe:cache`): `NICHT-CONTRACT-AKTIV`.
  - Consumer: regression investigation of open Anthropic prompt-cache findings such as ISSUE-028; archived ISSUE-033 was its first user.
  - Owner: `scan` reuses `detectCacheInvalidation` and adds the idle gap and TTL class per miss.
    TTL expiry is therefore never blamed on a request change.
  - Owner: `probe` sends paired live requests on nonce-separated prefixes through the real provider path.
  - Proof: `bun --cwd=packages/coding-agent run probe:cache probe --reps 1` reports arm A `tools_same=no` with a partial R2 read.

- `.omp/ratchet/rename-title/` and `.omp/ratchet/rename-title-expanded/`: `NICHT-CONTRACT-AKTIV`.
  - Consumer: the recorded rename-title optimization workflow resumes its frozen baseline and expanded-case evaluator.
  - Owner: each flow's `_state.json` and harness retain cases, selection, source/config fingerprints, and results together.
  - Proof: the expanded collector consumes the original cases; fingerprint checks must pass before a resumed run.

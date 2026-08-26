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

- `UPSTREAM-GEDECKT`: current upstream fully satisfies the contract; remove the redundant fork delta.
- `UPSTREAM-INTEGRIERT`: upstream owns the capability, but MOMP still needs a minimal integration delta.
- `MOMP-EIGEN`: upstream has no equivalent contract; retain the smallest complete MOMP implementation.

Every classification MUST name the current upstream owner, required action, and behavioral proof.

### Current Active MOMP Contract Inventory

This section is the authoritative SSOT for active MOMP source behavior and its source-facing index.
A fork delta that cannot be assigned to an entry below is unqualified and MUST be investigated before retention.
`project-momp-upgrader` consumes this inventory.
It owns upgrade assessment, packaging, publishing, installation, and release smoke.
Source behavior changes MUST update this inventory in the same source change.
Upgrade workflow documentation and automation MUST reference entries instead of restating their contracts.
Keep this inventory current when adding, removing, upstreaming, or reclassifying a contract.

Each entry names its disposition, observable behavior, implementation owner, and focused proof.

#### `MOMP-PROMPT-MAIN` — Main prompt customization

- Disposition: `MOMP-EIGEN`.
- Contract: `SYSTEM.template.md` enables Handlebars rendering without changing raw `SYSTEM.md` semantics.
- Contract: raw `--system-prompt`, `SYSTEM.md`, `APPEND_SYSTEM.md`, and `--append-system-prompt` remain literal.
- Contract: precedence is explicit raw prompt, project raw, project template, user raw, user template, built-in base.
- Contract: raw and template siblings select raw and surface the suppression warning.
- Contract: selected unreadable, empty, or invalid templates fail instead of silently falling back.
- Contract: provider-facing base and project blocks remain separate and ordered.
- Contract: ACP sessions resolve prompt sources from the target workspace rather than the launch directory.
- Contract: runtime tool-registry rebuilds preserve the selected sources while refreshing dynamic tool state.
- Owner: `src/system-prompt.ts` owns source discovery, precedence, loading, and rendering.
- Owner: `src/main.ts` maps discovered sources into Main-session construction.
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
- Owner: `src/system-prompt.ts` owns base and wrapper discovery.
- Owner: `src/task/subagent-system-prompt.ts` owns wrapper rendering and provider-block insertion.
- Owner: `src/task/executor.ts#runSubprocess` is the shared fresh-Child construction seam.
- Proof: `test/task/subagent-system-template.test.ts`.
- Proof: `test/context-file-inheritance.test.ts`.

#### `MOMP-PROMPT-OVERRIDES` — Process-scoped Main overrides

- Disposition: `MOMP-EIGEN`.
- Contract: `--system-template <path>` selects an explicit Handlebars Main template for this process.
- Contract: `--agents-file <path>` replaces only user-level `AGENTS.md` while retaining project discovery.
- Contract: both flags support spaced and equals syntax, relative paths, `~`, and regular-file symlinks.
- Contract: explicit empty, missing, unreadable, and non-regular paths fail.
- Contract: `--system-template` and `--system-prompt` are mutually exclusive.
- Contract: overrides apply consistently to interactive, print, ACP, SDK, and Main inspection paths.
- Contract: overrides never persist into settings, session headers, resume, continue, or fresh Children.
- Contract: arbitrary `--agents-file` filenames remain semantically typed as AGENTS context.
- Contract: override changes invalidate inherited provider prompt-cache affinity.
- Owner: `src/cli/args.ts` and `src/cli/flag-tables.ts` own CLI parsing.
- Owner: `src/system-prompt.ts` owns strict path resolution and context replacement.
- Owner: `src/main.ts` and `src/sdk.ts` own process/session propagation.
- Proof: `test/cli-agents-file.test.ts`.
- Proof: `test/system-prompt-templates.test.ts`.

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
- Proof: `test/system-prompt-inspect.test.ts`.
- Proof: `test/system-prompt-templates.test.ts`.

#### `MOMP-TASK-POLICY` — Model-dependent delegation policy

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: a custom `SYSTEM.template.md` carries task policy because it replaces the built-in Main template.
- Contract: GPT-5.6 default mode requires user, `AGENTS.md`, or skill authorization before delegation.
- Contract: GPT-5.6 eager mode allows proactive delegation.
- Contract: other models retain current upstream eager/default delegation behavior.
- Contract: fan-out, concurrency, IRC, and Hub instructions render from current upstream template inputs.
- Contract: task `effort` maps `lo`, `med`, and `hi` to the target model's lowest, middle, and highest levels.
- Contract: omitting task `effort` preserves normal configured thinking selection; `task.maxEffort` remains the ceiling.
- Contract: model switches select the target model's policy even when model identity is hidden.
- Owner: upstream `src/task/prompt-policy.ts#usesCodexTaskPrompt` owns model classification.
- Owner: upstream `src/prompts/system/system-prompt.md#Delegation` owns bundled policy.
- Owner: the active project-settings `SYSTEM.template.md` owns the live policy text.
- Owner: upstream `src/prompts/tools/task.md` owns model-visible task-effort semantics.
- Owner: `src/system-prompt.ts` owns the render inputs and template selection.
- Proof: candidate prompt rendering through `momp system-prompt inspect`.
- Proof: `test/system-prompt-templates.test.ts`.
- Proof: effort-description cases in `test/task/task-schema.test.ts`.

#### `MOMP-EVAL-OUTPUT` — Large owner-result preservation

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: Eval keeps large raw tool results separate or passes handles instead of re-emitting them.
- Contract: Legitimate Eval aggregation, tool orchestration, shell, and subprocess capabilities remain unchanged.
- Owner: `src/prompts/tools/eval.md` owns model-visible result-handling guidance.
- Proof: result-handling description case in `test/tools/eval-description.test.ts`.

#### `MOMP-EVAL-ROUTING` — Context-safe Eval orchestration

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: native Read owns inspection unless Eval must compute over file contents.
- Contract: in-cell concurrency uses `parallel(thunks)` instead of user-created execution contexts.
- Contract: Eval treats tool results as unknown until their owner or inspected shape establishes a type.
- Contract: Eval uses only state established by successful cells in the current live kernel.
- Contract: ordinary `task` Children inherit Eval state, while Eval `agent()` Children use independent kernels.
- Owner: `src/prompts/tools/eval.md` owns model-visible Eval routing and failure guidance.
- Owner: upstream `src/task/structured-subagent.ts` and `src/eval/agent-bridge.ts` own the corresponding runtime split.
- Proof: routing-description cases in `test/tools/eval-description.test.ts`.
- Proof: runtime semantics in Eval workflow, bridge-policy, Python-prelude, and JavaScript-executor tests.
- Proof: isolation-policy cases in `test/eval/agent-bridge-policy.test.ts`.

#### `MOMP-READ-SKILL-COMPACT` — Compact skill-read display

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: `read skill://` calls collapse into the compact grouped read view like `xd://` device reads.
- Contract: collapsed skill loads stay expandable so their full resolved content remains visible.
- Contract: the full skill body still reaches the model; collapsing is display-only and never trims load-bearing content.
- Owner: `src/modes/components/read-tool-group.ts#readArgsCollapseIntoGroup` owns the collapse decision.
- Proof: `test/read-tool-group.test.ts`.

#### `MOMP-READ-BATCH-GUIDANCE` — Provider-roundtrip-efficient reads

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: before each Read, the model collects every bounded target already required for the current step.
- Contract: all independent known non-HTTP(S) targets use one semicolon-joined Read call.
- Contract: independent external HTTP(S) URLs use sibling Read calls in one turn and are never semicolon-joined.
- Contract: another Read is reserved for targets discovered by results or targets that failed or were truncated.
- Owner: `src/prompts/tools/read.md` owns model-visible batching guidance.
- Proof: batching-description cases in `test/tools/read-guidance.test.ts`.

#### `MOMP-WEB-SEARCH-PARALLEL` — Provider-roundtrip-efficient searches

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: before searching, the model collects all independent queries required for the current step.
- Contract: independent queries prefer parallel sibling `web_search` calls in one assistant turn.
- Contract: sequential searches are reserved for queries determined by prior results.
- Owner: `src/prompts/tools/web-search.md` owns model-visible search scheduling guidance.
- Owner: upstream `packages/agent/src/agent-loop.ts#executeToolCalls` owns shared sibling-tool concurrency.
- Proof: scheduling-description cases in `test/web/search/guidance.test.ts`.

#### `MOMP-TREE-COMPACT` — Token-efficient directory context

- Disposition: `MOMP-EIGEN`; compact Read metadata spacing and metadata-free prompt-tree rendering are designed for upstream.
- Contract: the system-prompt workspace tree omits size and mtime columns.
- Contract: Read directory trees retain file sizes and relative mtimes with single-space separators.
- Contract: both views retain names, hierarchy, ordering, depth, limits, and elision behavior.
- Owner: `packages/coding-agent/src/workspace-tree.ts` owns both render modes.
- Proof: `packages/coding-agent/test/workspace-tree.test.ts`.
- Fixture: `research/read-directory-preview/default-shortened-output.txt` owns repeatable format token comparisons.
- Upstream action: PR `#9062` covers compact Read spacing; PR `#9152` proposes metadata-free prompt-tree rendering.

#### `MOMP-ROUTINES` — User-defined sequential routines

- Disposition: `MOMP-EIGEN`.
- Contract: YAML routines discover as slash-style commands from the user routines directory.
- Contract: TUI, ACP, RPC, and SDK session paths advertise and execute routines consistently.
- Contract: names conflict-check against all built-in and discovered command namespaces.
- Contract: rejected ACP or RPC routine reloads retain the previous valid command registry.
- Contract: RPC clients surface reload rejection instead of silently accepting invalid candidate state.
- Contract: duplicate or conflicting routines fail before command advertisement.
- Contract: autocomplete shows the declared description without synthetic routine suffixes.
- Contract: execution serializes active routine work and reports progress.
- Contract: cancellation cleans routine lifecycle state.
- Contract: routines never weaken file-command or prompt-template precedence.
- Owner: `src/capability/routine.ts` owns the capability contract.
- Owner: `src/discovery/routines.ts` owns discovery.
- Owner: `src/extensibility/routines.ts` owns parsing, validation, planning, and progress formatting.
- Owner: `src/session/agent-session.ts` owns execution and lifecycle serialization.
- Proof: `test/routines.test.ts`.
- Proof: `test/agent-session-routine-lock.test.ts`.
- Proof: `test/input-controller-routine.test.ts`.
- Proof: `test/interactive-mode-routine-autocomplete.test.ts`.
- Proof: routine cases in `test/rpc.test.ts` and ACP tests.

#### `MOMP-COMMAND-UX` — Rename, argument completion, and slash-list display

- Disposition: `MOMP-EIGEN`.
- Contract: `/rename <title>` stores an explicit user-owned title.
- Contract: blank `/rename` generates a title from recent user and Assistant transcript context.
- Contract: generated title input omits tools, thinking, code fences, and irrelevant follow-up-question chatter.
- Contract: generated storage names carry `AUTO:` and remain replaceable; explicit titles remain user-owned.
- Contract: `/rename` arguments keep `@` and `#` literal.
- Contract: command-specific completion wins when it has a result.
- Contract: absent command-specific completion falls through unless the command declares exclusive completion.
- Contract: autocomplete and submission use one command-owned argument-completion mode.
- Contract: slash-command autocomplete rows never display emojis or type-indicator icons, regardless of theme or symbol preset.
- Owner: `src/utils/title-generator.ts` owns transcript title generation.
- Owner: `src/slash-commands/types.ts` owns argument-completion semantics.
- Owner: TUI, ACP, and RPC command routers own transport-specific invocation only.
- Owner: `src/modes/interactive-mode.ts#refreshSlashCommandState` clears icons before provider construction.
- Proof: `test/title-generator.test.ts`.
- Proof: `test/command-controller-rename.test.ts`.
- Proof: rename cases in `test/acp-builtins.test.ts` and `test/slash-commands/rename.test.ts`.
- Proof: `test/prompt-action-autocomplete.test.ts`.

#### `MOMP-CONVERSATION-SEARCH` — Persisted conversation lookup

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: `conversation_search` searches persisted Main conversations without model calls.
- Contract: omitted scope and window search the current project over the last 10 days.
- Contract: the active session, tool traffic, thinking, developer messages, and hidden synthetic inputs are excluded.
- Contract: only visible human user and Assistant text participates in matching and excerpts.
- Contract: all-term and phrase modes are deterministic and case-insensitive.
- Contract: bounded text and JSON output returns newest matches with explicit partial-coverage diagnostics.
- Contract: Children never receive the tool.
- Contract: the local benchmark fixes a guaranteed-miss query, warmup count, measured runs, and corpus fingerprint.
- Contract: incomplete coverage, changing files, changing visible-message counts, or unexpected matches invalidate a run.
- Usage: `bun --cwd packages/coding-agent run bench:conversation-search -- --cwd <workspace>`.
- Owner: `src/session/conversation-corpus.ts` owns visible transcript projection and journal discovery.
- Owner: `src/session/conversation-search.ts` owns lexical matching, windowing, ranking, and coverage accounting.
- Owner: `src/tools/conversation-search.ts` owns the tool boundary and Main-only exposure.
- Owner: `src/tools/conversation-search-format.ts` owns output variants.
- Owner: `scripts/bench-conversation-search.ts` owns the reproducible local evaluator and output.
- Proof: `test/conversation-search.test.ts`.
- Proof: `test/conversation-search-benchmark.test.ts`.

#### `MOMP-RUNTIME-AUDIT` — Repeatable local performance evidence

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: one local command captures CPU, heap lifecycle, test timing, and exact compiled-bundle evidence.
- Contract: CPU scenarios cover cold pre-paint boot, the smoke path, and complete prompt inspection without provider calls.
- Contract: the heap scenario repeatedly creates, fills, disposes, and garbage-collects real `AgentSession` instances.
- Contract: lifecycle timings use a fixed test set and repetition count so runs remain directly comparable.
- Contract: bundle evidence comes from the production compile owner with its plugins, defines, generated inputs, and externals.
- Contract: outputs default to an absolute reports path outside the source tree and support an explicit output directory.
- Contract: scenario failures stop the audit and retain captured stdout and stderr for diagnosis.
- Usage: `bun --cwd=packages/coding-agent run profile:runtime`.
- Owner: `packages/coding-agent/scripts/profile-runtime.ts` owns orchestration, parameters, manifest, and bundle summary.
- Owner: `packages/coding-agent/scripts/profile-runtime-heap-scenario.ts` owns deterministic retained-heap exercise and sampling.
- Owner: `packages/coding-agent/scripts/compile-binary.ts` owns optional exact bundle metadata collection.
- Owner: `packages/coding-agent/scripts/build-binary.ts` owns production-build metadata emission.
- Proof: run the usage command and verify every artifact named by `manifest.json` exists after successful completion.

#### `MOMP-CODEX-CACHE-PROBE` — Explicit breakpoint endpoint evidence

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: `omp bench <model> --codex-cache-breakpoint-probe --json` is a synthetic provider capability probe.
- Contract: the probe is not evidence of Main-session prompt-cache reuse.
- Contract: each pair uses distinct provider session IDs, one stable cache key, and independent SSE requests.
- Contract: the stable synthetic prefix remains identical while the variable suffix changes between requests.
- Contract: both requests carry explicit GPT-5.6 cache options and a latest-stable-message breakpoint.
- Contract: JSON reports endpoint acceptance, observed wire fields, cache usage, session distinctness, and failures.
- Contract: probe output never emits the stable prefix, cache key, or suffix payload.
- Owner: `packages/ai/src/providers/openai-shared.ts` owns shared Responses breakpoint placement.
- Owner: `packages/ai/src/providers/openai-codex-responses.ts` owns Codex request construction.
- Owner: `packages/coding-agent/src/cli/bench-cli.ts` owns probe execution and measurements.
- Owner: `packages/coding-agent/src/commands/bench.ts` owns CLI exposure and usage.
- Proof: `packages/ai/test/openai-codex-responses-lite.test.ts`.
- Proof: `packages/coding-agent/test/bench-cache.test.ts`.
- Usage: `omp bench openai-codex/gpt-5.6-luna --codex-cache-breakpoint-probe --json`.
- Upstream action: retain provider-neutral breakpoint construction when preparing an upstream change.

#### `MOMP-STATS-SUMMARY` — Multi-range CLI usage overview

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: `momp stats --summary` renders mobile-safe rolling 24h, 7d, and 30d usage blocks.
- Contract: each range shows requests, conversation tokens, cost, absolute errors, and error rate.
- Contract: 24h details show aligned token and performance metrics plus agent usage.
- Contract: overlong metric values continue on dedicated lines without truncation.
- Contract: model and folder summaries show the top five conversation-token consumers with exact omitted counts.
- Contract: model and folder ordering uses deterministic name tie-breakers.
- Contract: complete model and folder names render on dedicated sanitized lines without truncation.
- Contract: conversation tokens include uncached input, cache reads, cache writes, and output.
- Contract: `momp stats --summary` and `momp stats --json` keep sync diagnostics on stderr.
- Contract: the summary composer lives inside the published `@mikeei/momp` package.
- Contract: the standalone `omp-stats` binary keeps upstream behavior and is not fork-published.
- Owner: `packages/coding-agent/src/cli/stats-summary.ts` owns ranges, loading, ranking, sanitization, and rendering.
- Owner: `packages/coding-agent/src/cli/stats-cli.ts` owns MOMP command integration.
- Proof: `packages/coding-agent/test/stats-summary.test.ts`.
- Proof: `packages/coding-agent/test/stats-cli-output.test.ts`.
- Upstream action: retain provider-neutral `omp stats` behavior when preparing the upstream change.

#### `MOMP-SCROLLBACK` — Multiplexer scrollback exactness

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: unfinished Assistant live regions remain pinned inside recognized terminal multiplexers.
- Contract: finalized Assistant tails remain reachable while ordered retirement is blocked by active predecessors.
- Contract: with stable pane geometry, final Assistant content enters pane history exactly once.
- Contract: accepted terminal bytes remain immutable when later component state changes semantic rendering.
- Contract: global expansion, tool-visibility, and image-visibility changes preserve already accepted presentation.
- Contract: pre-existing pane history survives.
- Contract: multiplexer rendering never emits ED3 or invokes `clear-history`, including configured rebuilds.
- Contract: replay stale-cell clearing never scrolls the mutable viewport into preserved tmux history.
- Owner: current upstream `src/modes/components/transcript-container.ts` owns semantic retirement, replay, and acknowledgement.
- Owner: `src/modes/components/transcript-container.ts#markAcceptedTapeDrifted` owns global presentation-drift latching.
- Owner: current upstream `packages/tui/src/tui.ts#TUI.#emitPlanFrame` owns the sole physical history write.
- Required action: retain MOMP's minimal non-destructive reset and preserved-clear integration at that owner.
- Proof: `test/modes/components/transcript-container.test.ts`.
- Proof: `packages/tui/test/history-frame-plan.test.ts`.
- Proof: `test/tmux-scrollback-exactness.test.ts`.

#### `MOMP-TMUX-PAGEUP` — Tmux history access

- Disposition: `MOMP-EIGEN`.
- Contract: PageUp on a focused empty editor opens tmux copy mode one page up.
- Contract: drafts, overlays, non-tmux sessions, and failed tmux commands retain existing PageUp handling.
- Owner: `src/modes/controllers/input-controller.ts` owns the empty-editor PageUp bridge into tmux copy mode.
- Proof: PageUp cases in `test/input-controller-keybindings.test.ts`.
- Proof: the real tmux PageUp case in `test/tmux-scrollback-exactness.test.ts`.

#### `MOMP-MUX-RESIZE` — Native multiplexer resize preservation

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: mixed multiplexer geometry cycles never lose finalized transcript rows or pre-existing pane history.
- Contract: height-only `append` resizes never replay current-width application history.
- Contract: rebuild repairs replay at most the old screen's committed tail, never the complete application ledger.
- Contract: tmux-native mutable-row duplication is accepted when geometry changes; full application-ledger replay is not.
- Contract: the `MOMP-SCROLLBACK` exact-once guarantee applies only while mutable output retains stable pane geometry.
- Owner: current upstream `TUI.#beginResizeAltPaint` owns resize-burst geometry tracking and alternate-buffer borrowing.
- Owner: current upstream `TUI.#beginResizeAnchorProbe` and `TUI.#resolveResizeAnchor` own anchor recovery.
- Owner: current upstream `TUI.#doRender` owns fullscreen-exit anchor recovery.
- Owner: current upstream `TUI.#prepareResizeReplay` owns bounded multiplexer repair and width-sensitive replay policy.
- Required action: retain these upstream owners and never use ED3 or `clear-history` to repair native history.
- Proof: `packages/tui/test/history-frame-plan.test.ts`.
- Proof: `packages/tui/test/resize-multiplexer-anchor.test.ts`.
- Proof: resize cases in `test/tmux-scrollback-exactness.test.ts`.

#### `MOMP-PACKAGE-IDENTITY` — Side-by-side fork identity and update safety

- Disposition: `MOMP-EIGEN`.
- Contract: publish staging produces package `@mikeei/momp`, binary `momp`, and exact `MOMP_VERSION`.
- Contract: the published CLI executes `dist/cli.js`, which bundles the complete fork workspace closure.
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
- Proof: `test/update-cli.test.ts`.
- Proof: `test/extension-loader-self-import.test.ts`.
- Proof: publish and smoke gates owned by `project-momp-upgrader`.

#### `MOMP-SUBAGENT-LSP` — Child LSP capability

- Disposition: `MOMP-EIGEN`.
- Contract: bundled agent prompt definitions follow upstream; Scout retains the upstream read-only tool set.
- Contract: `task.enableLsp` applies only to agent definitions that declare LSP.
- Contract: parent capability and plan-mode restrictions still attenuate Child LSP.
- Owner: `src/task/subagent-runtime-config.ts` owns effective Child capabilities.
- Owner: `src/config/settings-schema.ts` owns the default and operator-facing setting.
- Proof: `test/task/subagent-lsp.test.ts`.
- Proof: `test/tools/task-agent-capabilities.test.ts`.

#### `MOMP-AGENT-CONTEXT` — AGENTS-first generated-agent context

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: generated-agent guidance consumes provided `AGENTS.md` and other supplied project context.
- Contract: the architect never assumes `CLAUDE.md` is the sole project-instruction owner.
- Owner: `src/prompts/system/agent-creation-architect.md`.
- Proof: render and inspect the agent-creation architect prompt.
- Upstream action: prefer provider-neutral wording when explicitly preparing an upstream change.

#### `MOMP-HUB-COMPACT` — Compact Hub guidance

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: Hub guidance preserves peer messaging, job delivery, and supervised-process semantics without repetition.
- Contract: Hub examples and schema hints disambiguate peer waiting, process defaults, and compound service readiness.
- Contract: a frozen real-model benchmark scores exact Hub calls for all four retained routing examples.
- Owner: `src/prompts/tools/hub.md` owns concise model-visible behavior guidance.
- Owner: `src/tools/hub/index.ts#HubTool.examples` owns the minimal routing examples.
- Owner: `scripts/bench-hub-routing.ts` owns benchmark models, prompts, scoring, safe execution, and output.
- Proof: `test/hub-routing-benchmark.test.ts` and `bun run bench:hub-routing`.
- Upstream action: retain provider-neutral wording when preparing the generic prompt compaction.

#### `MOMP-BASH-TOOL-CONTEXT` — Additional workstation utilities and timeout guidance

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: the Bash tool prompt advertises `base32` with the upstream-owned auxiliary utilities.
- Contract: the Bash tool prompt additionally advertises `duckdb`, `mlr`, `yq`, `jc`, `shellcheck`, and `shfmt`.
- Contract: the Bash tool prompt additionally advertises `diffoscope-safe`, `dust`, `procs`, and `glab`.
- Contract: every MOMP-only advertised executable MUST resolve on the supported workstation before publication.
- Contract: `timeout` controls the job deadline, while `bash.autoBackground.thresholdMs` caps foreground waiting.
- Contract: raising `timeout` never promises foreground execution beyond the configured auto-background threshold.
- Owner: current upstream `src/prompts/tools/bash.md` owns model-visible Bash capability guidance.
- Owner: current upstream `src/tools/bash.ts` owns the independent deadline and foreground-threshold runtime policy.
- Required action: retain the minimal utility-list delta at that owner.
- Required action: retain the minimal timeout-guidance delta until upstream integrates the contribution.
- Proof: resolve every MOMP-only advertised executable through the workstation command lookup.
- Proof: render the Bash tool prompt and verify the additional capability guidance.
- Proof: guidance cases in `test/tool-guidance-efficiency.test.ts`.
- Proof: threshold-saturation cases in `test/tools.test.ts`.

#### `MOMP-LSP` — Upstream-owned LSP extensions

- Disposition: `UPSTREAM-INTEGRIERT`.
- Contract: file-scoped symbol queries filter hierarchical and flat document-symbol results.
- Contract: rename previews show bounded positions and replacement text and report omitted edits.
- Contract: the historical private LSP subsystem remains retired.
- Owner: current upstream `src/lsp/tool.ts` and `src/lsp/utils.ts` own the behavior.
- Required action: retain only the minimal deltas until upstream integrates PRs `#8400` and `#8401`.
- Required action: after integration, remove their complete fork closure and restore `UPSTREAM-GEDECKT`.
- Proof: document-symbol query and rename-preview cases in `test/tools/lsp-regressions.test.ts`.

#### `MOMP-READ-SSH-GUIDANCE` — Current SSH route guidance

- Disposition: `UPSTREAM-GEDECKT`.
- Contract: Read guidance and SSH runtime errors name only provider-visible routes.
- Contract: remote text-file search uses `grep` and unsupported hosts use `bash` with a remote SSH command or `sshfs`.
- Contract: retired `search` and standalone `ssh` tool names never appear in model-visible SSH guidance or errors.
- Contract: `ssh://` read, write, and `grep` behavior remains unchanged.
- Owner: current upstream `packages/coding-agent/src/prompts/tools/read.md` and SSH path/error owners.
- Proof: `test/tools/read-guidance.test.ts`.
- Proof: SSH protocol, file-transfer, path-validation, and remote-directory error tests.
- Required action: keep the complete closure byte-identical to current upstream and never restore the redundant fork wording.

#### `MOMP-READ-BATCH` — Single-call complete retrieval

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: bounded known Read targets use one semicolon-delimited `path`.
- Contract: a known extent uses one call, split only across the 3,000-line target limit.
- Contract: an unknown extent permits one discovery call followed by one batch for every known missing range.
- Contract: failed or truncated targets make retrieval incomplete and only those targets are retried.
- Owner: upstream `packages/coding-agent/src/prompts/tools/read.md` owns model-visible retrieval guidance.
- Owner: upstream `packages/coding-agent/src/tools/read.ts` owns the model-visible `path` schema.
- Owner: upstream Read delimited-path and selector handling own the existing runtime behavior.
- Proof: render the Read description and schema, then inspect the complete-file batching contract.
- Proof: issue one Read call containing repeated same-file selectors and verify one complete tool result.
- Upstream action: retain provider-neutral wording when preparing the prompt correction.

#### `MOMP-READ-RAW` — Source-specific raw Read representations

- Disposition: `MOMP-EIGEN`, designed for upstream.
- Contract: `:raw` is a handler-specific representation, not universal byte access or converter bypass.
- Contract: Documents may still use PDF/Markit conversion under `:raw`.
- Contract: Notebooks return storage JSON, images retain decoded image-oriented output, and archives return decoded member text.
- Contract: URLs return the response body without JSON, feed, or HTML text shaping after binary handling.
- Owner: upstream `packages/coding-agent/src/prompts/tools/read.md` and source-kind Read handlers.
- Proof: `test/tools/read-guidance.test.ts` and source-kind raw behavior tests.
- Upstream action: submit the prompt-only correction without changing source dispatch or inventing byte semantics.

#### Non-contract artifacts

The following artifacts do not justify runtime retention by themselves:

- `project/PROPOSAL-DELEGATION-POLICY.draft.md` is a proposal, not active behavior.
- Changelog text records behavior but does not create a product contract.
- Formatting-only commits and test migrations are integration history, not product contracts.
- The agent-memory probe has no active contract and MUST NOT be restored without a new repeatable use.

When an artifact in this list is no longer actively needed, remove its complete closure instead of promoting it to a contract.

### Upstream and Rebase Semantics

`upstream` means the canonical `can1357/oh-my-pi` repository.
`origin` means the user-owned fork.
An upstream update preserves active MOMP contracts, not historical patch shapes.
When upstream moves an ownership boundary, reimplement the required contract at the new boundary.
NEVER force an obsolete hunk, wrapper, or file layout onto the new upstream structure.
Resolve semantic overlap in favor of upstream unless an active MOMP contract requires a remaining difference.

Fetching, merging, or rebasing upstream does not by itself remove obsolete fork behavior.
Judge the resulting delta against current upstream content and active contracts.
When the user asks to make a file "upstream", use the exact current `upstream/main` content for that file.
If the file participates in a fork-only dependency closure, either keep the active contract or remove the full closure.
NEVER create a partial upstream cutover that leaves broken imports, callers, tests, configuration, or documentation.
Prefer a surgical ownership-aligned cutover over reverting a broad integration commit.

### Fork Delta Lifecycle

Every fork delta MUST have one current owner and one observable reason to exist.
Removing a fork delta MUST remove or migrate its complete dependency closure.
The closure includes code, imports, exports, callers, prompts, tests, and configuration.
It also includes build wiring, generated artifacts, documentation, and changelog entries when applicable.
Delete obsolete compatibility aliases, shims, fallback paths, and fork-side copies during the cutover.
NEVER preserve an obsolete path solely to reduce the apparent size of the removal.

When upstream implements an equivalent contract:

1. Verify the upstream behavior against the MOMP contract.
2. Replace fork-owned call sites with the upstream owner.
3. Remove the redundant implementation and its complete closure.
4. Remove or migrate fork-specific tests that no longer defend a distinct contract.
5. Verify that upstream-owned files without remaining deltas match upstream.

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

### Experiments and Temporary Tooling

Probes, benchmarks, experiments, migration scaffolding, and diagnostic scripts MUST have a current repeatable contract.
That contract MUST support an active operator workflow, release gate, performance decision, or regression investigation.
A completed one-off investigation is not a permanent fork contract.
Remove temporary tooling when its decision is complete unless an active repeatable contract still consumes it.
Removal MUST include scripts, prompts, workers, package commands, fixtures, generated output, and documentation.
NEVER keep experimental code because it might become useful later.

### Source and Release Ownership

This repository owns MOMP source behavior and `MOMP_VERSION`.
`project-momp-upgrader` owns upgrade assessment, packaging, publishing, installation, and release smoke.
Do not duplicate the upgrader's procedural command contract in this file.
Route upgrade, publish, install, and deploy requests through the upgrader's current contract.

`MOMP_VERSION` is the source release-version fact.
Source behavior changes and release-version bumps MUST remain separate changes.
Complete and verify source behavior before changing `MOMP_VERSION`.
Keep `packages/coding-agent/package.json` close to upstream source metadata.
Fork package names, registry metadata, binary names, and publish versions belong to temporary publish staging.
NEVER hard-code publish-stage metadata into the source package merely to make a release artifact identify as MOMP.

Request semantics:

- A source-only change modifies and verifies `personal`; it does not imply a release or version bump.
- A source push publishes only the requested source commit; it does not imply package publication.
- An upgrade routes through upstream assessment and the full upgrader contract.
- Publish, install, and deploy requests route through the full upgrader contract and its smoke gates.

Fork-maintenance completion evidence:

- Name every affected fork contract and its disposition.
- Name the exact upstream or MOMP owner after the change.
- Report the focused behavioral proof for every retained or removed delta.
- Prove upstream restoration against current `upstream/main`, not memory or an old commit.
- NEVER report a cutover complete while orphaned closure elements remain.

## Fork & Upstream Contribution Intent

- Official upstream: [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi).
- This checkout is the [MikeeI/oh-my-pi](https://github.com/MikeeI/oh-my-pi) fork.
- `personal` owns fork-only agent context, the MOMP patchstack, and durable contribution tracking.
- Base clean upstream contribution branches on current `upstream/main`.
- Keep `AGENTS.md`, `FORMAT.md`, `ISSUES.md`, `issues/`, and other fork-only state out of upstream diffs.
- Support upstream with evidence-backed, high-ROI findings while preserving active MOMP contracts.
- Prioritize bounded corrections with meaningful user or maintainer value and limited regression and review cost.
- Prefer a pull request when a bounded verified fix is ready and no active implementation owns it.
- Otherwise comment when a thread owns the same problem or root cause and new evidence advances it.
- Otherwise open a new issue when durable maintainer discussion is useful.
- Otherwise keep the finding Investigating.
- Apply `skill-fork-contribution-tracking` for ledger, lifecycle, personal-branch, and upstream handoff work.
- Apply `skill-maintainer-communication` before external issues, pull requests, reviews, comments, or discussions.
- Apply `skill-semantic-compression-3-0` when authoring or restructuring tracking content.
- Apply `skill-git-commit-format` while respecting this repository's commit and contribution conventions.
- Never choose Authorized-Work on the user's behalf.
- Research-and-Reporting permits issues and comments but no source implementation.
- Pull-Request-Implementation authorizes only the scope recorded for the finding.
- Search existing work first, follow upstream templates and disclosure rules, and avoid duplicate or weak submissions.
- Reproduce claimed bugs against current upstream and run the narrowest conclusive verification.
- Publish one coherent root cause per issue, comment, or pull request.
- Discuss major features and broad architectural or behavior changes in upstream Discord before implementation.
- External publication follows `### External Publication Approval`; local tracking never authorizes an external write.

## Finding and Contribution Ledger

- Agents MUST read root `ISSUES.md` before repository work.
- `ISSUES.md` owns `Next-Finding-ID` and the compact cross-finding projection.
- Each `issues/ISSUE-NNN.md` owns one root cause, evidence, Next-Action, drafts, and archive record.
- `FORMAT.md` owns research, claim basis, lifecycle, drafting, implementation, and publication gates.
- Before allocating, search the index and relevant records for the same symptom and root cause.
- Allocate the current permanent `ISSUE-NNN`; create its record, add its index row, and advance the allocator together.
- Update the issue record and index together after any projected field, Next-Action, or Archive change.
- New findings start with `State: Investigating` and `Authorized-Work: Not-Selected`.
- They also start with `Publication-Target: Not-Selected` and `External-Reference: Not published.`.
- Label material claims `[O]`, `[S]`, or `[A]` according to `FORMAT.md`.
- Preserve unmeasured boundaries as prose or an explicit Measurement-Status field.
- Verify source claims against current upstream; reproduce user-visible bugs before claiming `[O]`.
- The user selects Authorized-Work; local research and tracking never select it.
- Research-and-Reporting MUST NOT implement the finding.
- Pull-Request-Implementation MAY implement only the recorded scope after research resolves failure boundaries.
- Pull-request work MUST be verified, committed, pushed, and PR-Ready before external publication.
- Run the bundled read-only ledger validator after every ledger mutation.
- Record the final external URL in `External-Reference` immediately after publication.

### External Publication Approval

- Only an external issue, comment, review, discussion, or pull request write is approval-gated.
- Local ledger creation and updates are not external publication.
- Before publication, read current upstream policy and show the exact Publication-Target and Publication-Draft.
- Publish only after the user explicitly approves that exact target and draft.
- Any target or draft change invalidates prior approval.
- Without that exact instruction, NEVER comment on GitHub or create a GitHub issue.

## Default Context

This repo contains multiple packages, but **`packages/coding-agent/`** is the primary focus. Unless otherwise specified, assume work refers to this package.

**Terminology**: When the user says "agent" or asks "why is agent doing X", they mean the **coding-agent package implementation**, not you (the assistant). The coding-agent is a CLI tool — questions about its behavior refer to code in `packages/coding-agent/`, not your current session.

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

**Catalog import convention**: code in this repo imports catalog _values_ (bundled models, model-thinking helpers, identity, descriptors, model manager/cache) from `@oh-my-pi/pi-catalog/<module>` — never via `@oh-my-pi/pi-ai`. The pi-ai barrel re-exports only the model/effort _types_ its own signatures use (`Model`, `Api`, `ThinkingConfig`, `Effort`, …); type-only imports of those from `@oh-my-pi/pi-ai` are fine.

## GitHub

`### External Publication Approval` is the sole contract for GitHub writes.

## Code Quality

- No `any` unless absolutely necessary.
- **NEVER use `ReturnType<>`** — use the actual type name.
- **NEVER use inline imports** — no `await import()`, no `import("pkg").Type` in type positions, no dynamic type imports. Always top-level.
- Check `node_modules` for external API types instead of guessing.
- **Barrel exports**: prefer `export * from "./module"` over named re-exports, including `export type { ... } from`. In pure `index.ts` barrels, use star re-exports even for single-specifier cases. If stars create ambiguity, remove the redundant export path; do not keep duplicates.
- **Class privacy**: use ES `#private` fields; leave externally accessible members bare. **No `private`/`protected`/`public` keyword on fields or methods**, except on **constructor parameter properties** where TypeScript requires it (e.g. `constructor(private readonly session: ToolSession)`).
- **Promises**: use `Promise.withResolvers()` instead of `new Promise((resolve, reject) => ...)`.
- **Prompts**: never build prompts in code (no inline strings, template literals, or concatenation). Prompts live in static `.md` files; use Handlebars for dynamic content. Import them via `import content from "./prompt.md" with { type: "text" }` — not `readFile`.
- **Worker scripts**: workers re-enter the CLI entrypoint; never spawn separate worker entry modules. `cli.ts` declares itself as the worker host at startup (`declareWorkerHostEntry()` from `@oh-my-pi/pi-utils/env`) and dispatches hidden argv selectors (`__omp_worker_stats_sync`, `__omp_worker_tab`, `__omp_worker_js_eval`, `__omp_worker_tiny_inference`) before loading the command registry. Spawn sites use:
  ```ts
  import { workerHostEntry } from "@oh-my-pi/pi-utils";
  const hostEntry = workerHostEntry();
  const worker = hostEntry
  	? new Worker(hostEntry, { type: "module", argv: ["__omp_worker_<name>"] })
  	: new Worker(new URL("./<worker>.ts", import.meta.url).href, { type: "module" });
  ```
  When the process was started from the omp CLI — source `cli.ts`, npm-bundle `dist/cli.js`, or compiled binary — `workerHostEntry()` is `Bun.main` and the worker re-enters the single entry module, so no per-worker `--compile` entrypoints or bundle entries exist. Outside a CLI host (`bun test`, SDK embedding, standalone `omp-stats`) it returns `null` and the direct-module fallback loads the worker source. New worker kinds MUST add their selector to the dispatch table in `cli.ts` and keep the fallback branch.
  History: `with { type: "file" }` only copied the entry as a raw asset (workers crashed silently in compiled binaries — issues #1011, #1027), and the later literal-path + extra-entrypoint pattern required keeping spawn literals and two build scripts in sync (issue #1150). The smoke probe below is the live validation of this contract.
  Validate any new worker with the dedicated smoke probe: `omp --smoke-test` spawns the stats sync worker and the tiny-model subprocess, pings them, and exits — it's wired into `ci:test:smoke` and `scripts/install-tests/run-ci.sh` so binary, source-link, and tarball installs all exercise it. Add a sibling smoke if the new worker is on a different module graph.

## Central Utilities

Before writing a helper, check whether one already exists — `packages/coding-agent/src/utils/`, `@oh-my-pi/pi-utils`, `@oh-my-pi/pi-tui`, and the domain modules next to your callsite. This applies to **everything**: VCS wrappers, formatting/truncation/path-display helpers, image handling, clipboard, streams, temp files, caching. The central versions carry hardening a fresh copy always loses (timeouts, output caps, non-interactive env, lock avoidance, caching, TUI sanitization).

- Search first: `grep` for the operation before implementing it. Two implementations of the same thing is a bug even when both work.
- Examples of the pattern: `src/utils/git.ts` and `src/utils/jj.ts` are the only sanctioned way to run git/jj (`import * as git from "../utils/git"` — never hand-spawn via `$`/`Bun.spawn`); rendering goes through the helpers in TUI Sanitization below (`replaceTabs`, `truncateToWidth`, `shortenPath`, `PREVIEW_LIMITS`) rather than ad-hoc string math.
- Missing capability? Extend the central helper (new option, new sub-function on the namespace) and call it — don't fork its logic locally.

## Bun Over Node

Use Bun APIs where they provide a cleaner alternative; fall back to `node:*` only for what Bun doesn't cover. **Never spawn shell commands for operations with proper APIs** (e.g., don't `Bun.spawnSync(["mkdir", "-p", dir])` — use `mkdirSync`).

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

Use `node:fs/promises` for directory ops (`fs.mkdir`, `fs.rm`, `fs.readdir`) — Bun has no native directory APIs. Avoid sync APIs in async flows; use sync only when forced by a synchronous interface.

**Anti-patterns:**

- `existsSync`/`readFileSync`/`writeFileSync` in async code → `Bun.file()` APIs.
- `mkdir(dirname(path), …)` before `Bun.write(path, …)` → redundant; `Bun.write` handles it.
- `if (await file.exists()) { await file.json() }` → two syscalls plus race. Use try-catch with `isEnoent`:
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

## Generated Files

**NEVER edit `packages/catalog/src/models.json` directly.** It is generated from upstream sources (stencil.so, provider catalog discovery, OpenCode docs) by `packages/catalog/scripts/generate-models.ts` and the descriptors/resolvers in `packages/catalog/src/provider-models/`. Hand-edits get overwritten on the next regen.

To change an entry, fix the source:

- **Resolution rules / per-id overrides** → relevant resolver in `packages/catalog/src/provider-models/openai-compat.ts` (e.g. `createOpenCodeApiResolution`'s id-override map).
- **Provider catalog entries** (default model, discovery factory/flags) → the `CATALOG_PROVIDERS` table in `packages/catalog/src/provider-models/descriptors.ts`.
- **Generator-level fixups** (premium multipliers, codex pricing fallback, fallback models, post-processing) → `packages/catalog/scripts/generate-models.ts`.
- **Thinking metadata / generated policies** → `packages/catalog/src/model-thinking.ts` (`applyGeneratedModelPolicies`); model-id classification (family/version parsing) lives in `packages/catalog/src/identity/classify.ts`.

Regenerate with `bun run gen:models` and commit `models.json` alongside the source change. Add a regression test against the **resolver/descriptor**, not the bundled JSON, so it survives upstream metadata shifts.

## Logging and CLI Output

Code that may run while the TUI, RPC, SDK, workers, or background runtimes are active MUST NOT use `console.log`/`error`/`warn`; it corrupts rendering or protocols. Use the centralized logger:

```typescript
import { logger } from "@oh-my-pi/pi-utils";

logger.error("MCP request failed", { url, method });
logger.warn("Theme file invalid, using fallback", { path });
logger.debug("LSP fallback triggered", { reason });
```

Logs go to `~/.omp/logs/omp.YYYY-MM-DD.log` with automatic rotation. Standalone CLI commands that exit without entering the TUI MAY use `console.*` or process streams for intentional user-facing output. Keep structured stdout clean. This exception is semantic, not filename-based; shared code must use `logger` or an explicit output sink.

## TUI Sanitization

All text displayed in tool renderers must be sanitized. Raw content (file contents, error messages, tool output) breaks terminal rendering: tabs → visual holes, long lines → overflow, paths → leak home directory.

**Rules:**

- **Tabs → spaces** via `replaceTabs()` (from `@oh-my-pi/pi-tui` or `../tools/render-utils`).
- **Truncate** lines with `truncateToWidth()` / `ui.truncate()`. Use `TRUNCATE_LENGTHS` constants.
- **Shorten paths** with `shortenPath()` (replaces home with `~`).
- **Preview limits** from `PREVIEW_LIMITS`. No ad-hoc numbers.

**Apply to every render path**, not just the happy one:

- Success output (file previews, command output, search results).
- **Error messages** — these often embed file content (e.g., patch failure messages include unmatched lines). If a message contains file content, it needs `replaceTabs()`.
- Diff content (added and removed).
- Streaming previews.

### Streaming tool previews

Tool-call previews can have **multiple render paths**. If you add preview-only fields or depend on partially streamed args, update every path — not only the final renderer. Streamed argument buffers decode into display args via `decodeStreamedToolArgs` / `ToolArgsRevealController` (`modes/controllers/tool-args-reveal.ts`); both the live event path and transcript rebuilds must go through them — never spread provider-parsed `arguments` next to a raw `__partialJson` (parsed args lag the stream by a throttled parse window).

For the bash tool specifically:

- The pending preview may need raw `partialJson`, not just parsed `arguments`. Parsed args lag until a JSON object closes, which makes inline env assignments appear only at the end.
- Preserve preview-only fields (e.g. `__partialJson`) through `event-controller.ts`, transcript rebuilds in `ui-helpers.ts`, and merged call/result rendering in `tool-execution.ts`. Missing one path causes inconsistent previews.
- `ToolExecutionComponent.#buildRenderContext()` for bash must work even before a result exists — the renderer uses call args plus render context to show the command preview while streaming.
- Verify both live streaming and rebuilt transcript paths after any bash preview change. A fix in one path does not fix the other.

## Commands

- NEVER commit unless asked.
- Never use `tsc`/`npx tsc` — always `bun check`.
- Never run `cargo test` directly for Rust tests — use `bun run test:rs`. It runs `cargo nextest run` (config: `.config/nextest.toml`) followed by a `cargo test --doc` pass, because nextest does not execute doctests. The doctest pass currently executes nothing (pi-natives is a `cdylib`, which rustdoc skips; pi-builtins' examples are `ignore`d vendored uutils docs) and exists so the first runnable doctest added to a lib crate is actually run.
- Merge commits (maintainer merges of PRs) follow: `Merge PR #<number>: <conventional PR subject> (@<author>)` — e.g. `Merge PR #6386: feat(catalog): add native Meta Model API provider (@eggpeat)`.
## Rust Build Profiles

Profiles live in the root `Cargo.toml`; `.cargo/config.toml` carries the settings Cargo.toml cannot express. Both are committed, so no local `~/.cargo/config.toml` is required.

| Profile | Use |
| --- | --- |
| `dev` | Default. Line tables for our crates, no debuginfo for deps, deps at `opt-level = 2`. |
| `release` | Shipping build: fat LTO, 1 codegen unit, stripped. |
| `local` | Fast local release iteration: thin LTO, 16 codegen units, incremental. |
| `profiling` | `release` codegen with symbols kept, for `perf`/`samply`/Instruments. |
| `ci` | Thin LTO, no debuginfo, stripped. |

**Never set `split-debuginfo = "off"` on a profile that has debuginfo.** On Mach-O the linker never merges DWARF into the executable — it writes a debug map (`N_OSO`) pointing at the `.o` files, and `"unpacked"` is what keeps those files. With `"off"` every backtrace frame in our own crates silently loses `file:line`; the `panicked at foo.rs:3` header still prints (that is `#[track_caller]`, not debuginfo), which makes the loss easy to miss. `ci` may use `"off"` only because it sets `debug = false`.

`embed-metadata = false` (in `.cargo/config.toml`) keeps crate metadata in `.rmeta` instead of duplicating it into every rlib — measured 196 MB → 130 MB on a reqwest-sized graph at identical build times. Its accepted spelling is toolchain-coupled; keep it in sync with `rust-toolchain.toml`.

Rejected, with measurements, so nobody re-litigates them: **sccache** (cannot cache incremental, bin, or proc-macro crates — measured slower than not using it), **mold** (ELF-only; no Mach-O support), and **`panic = "abort"` on `dev`** (Cargo ignores `panic` for the test profile, so the whole dep graph builds twice — 131 MB → 214 MB).

## Testing Guidance

Test the contract the system exposes — not the easiest internal detail to assert.

- Every new test must defend one **concrete, externally observable contract**: behavior, output shape, state transition, error mapping, or a regression-prone parsing boundary. If you cannot name the contract, do not add the test.

### Good vs. bad test filter

- **Name the failure mode.** Every test MUST state what a consumer observes if it regresses. Cannot name one? NEVER add it.
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
- Prefer contract-level tests over implementation details. Avoid asserting internal helper wiring, field assignment, singleton identity, incidental ordering, prompt boilerplate, or passthrough option forwarding unless another component depends on that exact detail.
- Don't duplicate coverage across abstraction levels. If an integration test already proves the behavior, drop the narrower unit test that restates it through mocks.
- Tests **must be full-suite safe**, not just file-local safe. No long-lived file-wide mutations of `Bun.*`, `process.platform`, `process.env`, or `Bun.env` when a narrower seam exists. Prefer per-test `vi.spyOn(...)` with `vi.restoreAllMocks()` in `afterEach`. A test that passes alone but poisons later files is broken.
- **Never use `mock.module()`**. Bun's `mock.module()` mutates the global module registry and leaks across files ([oven-sh/bun#12823](https://github.com/oven-sh/bun/issues/12823)). Use `spyOn` on the imported module object instead. For pass deps, import the pass and spy on `.run`. For package deps, namespace-import and spy on the exported function.
- For lifecycle/stateful code, prefer one test per invariant or transition over several tiny tests asserting one field each from the same transition.
- For error handling, trigger the real failure path and assert the surfaced contract — don't instantiate error classes directly or inspect internal metadata.
- Smoke tests are acceptable only when they catch a failure mode narrower tests would miss. "Package boots" or "command starts" alone is not enough.
- Assert exact strings, ordering, and formatting only when downstream code parses or depends on the exact bytes. Otherwise assert semantic content.
- Compile-time guarantees → type checks/type tests, not runtime placeholders.
- **Never source-grep.** A test that reads an implementation file (`.ts`/`.rs`/build script) and asserts on its _text_ — `expect(src).toContain("someCall()")`, `.toMatch(/import .../)`, `.not.toContain("oldName")`, or "comment must say X" — is banned. It tests how code _looks_, not what it _does_: it breaks on harmless refactors (comment reflow, rename, import reorder) and passes while the behavior is broken. Assert the observable contract instead (run the code, check output/state/error), use the runtime smoke probe for wiring you cannot exercise in-process, and enforce structural invariants (no value-import of X, no self-import) with a type test or a lint/biome rule — never a string scan of the source. (Reading a file your code _wrote_ — apply-patch result, generated bundle, temp fixture — and asserting on that output is fine; that is behavior, not a source grep.)
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
- Entries are one line, brief, and user-facing: lead with what the user will see or can now do. Root-cause narration and implementation detail belong in the commit/PR, not the changelog.
- Never modify already-released sections (e.g., `## [0.12.2]`) — they are immutable.
- Don't flag changelog section order or formatting in reviews or PRs — `bun run release` runs `fix-changelogs` which normalizes everything automatically.

**Attribution:**

- Internal (from issues): `Fixed foo bar ([#123](https://github.com/can1357/oh-my-pi/issues/123))`.
- External contributions: `Added feature X ([#456](https://github.com/can1357/oh-my-pi/pull/456) by [@username](https://github.com/username))`.

## Releasing

1. Ensure all changes since last release are in each affected package's `[Unreleased]` section.
2. Run `bun run release`.

The script handles version bump, CHANGELOG finalization, commit, tag, publish, and adding new `[Unreleased]` sections.

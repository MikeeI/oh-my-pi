# Repository Guidelines

## Project Overview

MOMP is an opinionated personal fork of Oh My Pi.
It adds deliberate workflow and behavior changes while staying as close as practical to `can1357/oh-my-pi`.
Keep fork-specific changes small and isolated so `personal` can be repeatedly rebased onto current upstream releases.
Align fork changes with upstream ownership boundaries to minimize rebase conflicts.
Prefer upstream behavior when it already satisfies the fork contract; NEVER duplicate functionality already owned upstream.
`main` mirrors `upstream/main` and MUST remain free of MOMP-only changes.
`personal` is the MOMP development and release branch; it carries the minimal fork patchstack.

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
Issue-owned historical evidence follows [its retention policy](CONTRACTS.md#experiments-and-non-contract-artifacts).

- `NICHT-CONTRACT-AKTIV`: A current repeatable consumer exists; name it and retain only the complete closure.
- `NICHT-CONTRACT-ENTFERNEN`: No current repeatable consumer exists; remove the complete closure during authorized cleanup.

Active-contract dispositions and non-contract states are disjoint.
NEVER place non-contract artifacts in the active inventory or use them to justify runtime retention.
Every classification MUST name the owner, required action, and behavioral proof or repeatable consumer.

### MOMP Contract Index

[`CONTRACTS.md`](CONTRACTS.md) is the authoritative SSOT for active MOMP source behavior.
This index only routes to it.
Before changing a listed owner path, read that contract's `CONTRACTS.md` section.
Before adding, removing, upstreaming, or reclassifying fork behavior, read the `CONTRACTS.md` inventory preamble.
Update `CONTRACTS.md` and this index in the same source change.
`project-momp-upgrader` rejects index rows whose IDs or dispositions differ from `CONTRACTS.md`.
Paths starting with `src/` or `scripts/` are relative to `packages/coding-agent/`.

| Contract | Disposition | Summary | Owner paths |
|---|---|---|---|
| `MOMP-PROMPT-MAIN` | `MOMP-EIGEN` | Main prompt customization | `src/system-prompt.ts`, `src/config.ts`, `src/discovery/builtin.ts`, `src/main.ts`, `src/capability/system-prompt.ts`, `docs/system-prompt-customization.md`, `docs/config-usage.md`, `docs/session-operations-export-share-fork-resume.md` |
| `MOMP-WORKSTATION-CONTEXT` | `UPSTREAM-INTEGRIERT` | Compact execution context | `src/system-prompt.ts` |
| `MOMP-PROMPT-CHILD` | `MOMP-EIGEN` | Fresh Child prompt composition | `src/system-prompt.ts`, `src/task/subagent-system-prompt.ts`, `src/task/executor.ts`, `src/task/subagent-runtime-config.ts`, `src/session/agent-session.ts` |
| `MOMP-PROMPT-OVERRIDES` | `MOMP-EIGEN` | Process-scoped Main overrides | `src/cli/args.ts`, `src/cli/flag-tables.ts`, `src/system-prompt.ts`, `src/main.ts`, `src/sdk.ts` |
| `MOMP-TOOL-PROMPT-OVERRIDES` | `MOMP-EIGEN` | Profile-scoped tool guidance | `src/prompts/tool-prompt-source.ts`, `src/tools/read.ts`, `src/tools/bash.ts`, `src/task/index.ts`, `src/lsp/tool.ts`, `src/tools/eval.ts`, `src/tools/eval-doc-topics.ts`, `src/internal-urls/xd-protocol.ts`, `src/web/search/index.ts`, `src/tools/glob.ts`, `src/tools/write.ts`, `src/tools/security-scan.ts`, `src/tools/memory-reflect.ts`, `src/edit/index.ts`, `src/task/isolation-runner.ts`, `src/task/structured-subagent.ts` |
| `MOMP-AST-GREP-PAGING` | `UPSTREAM-INTEGRIERT` | Actionable AST search pagination | `src/tools/ast-grep.ts`, `packages/tui/src/tools/ast-grep.ts` |
| `MOMP-AGENT-PROMPT-OVERRIDES` | `MOMP-EIGEN` | Profile-scoped agent templates | `src/prompts/user-prompt-source.ts`, `src/task/agents.ts`, `src/task/discovery.ts`, `src/task/index.ts`, `src/task/structured-subagent.ts`, `src/task/persisted-revive.ts`, `src/modes/agents-hub-deps.ts`, `src/slash-commands/builtin-marketplace.ts`, `src/task/command-templates.ts`, `src/session/model-mentions.ts`, `src/session/agent-session.ts`, `src/security/coordinator.ts` |
| `MOMP-PROMPT-INSPECT` | `MOMP-EIGEN` | Provider prompt inspection | `src/commands/system-prompt.ts`, `src/system-prompt.ts`, `src/task/subagent-system-prompt.ts`, `src/task/executor.ts`, `src/task/subagent-runtime-config.ts`, `packages/agent/src/agent-loop.ts`, `packages/agent/src/agent.ts`, `packages/agent/src/types.ts`, `src/sdk.ts` |
| `MOMP-TASK-POLICY` | `UPSTREAM-INTEGRIERT` | Profile delegation guidance | `src/task/index.ts`, `src/task/prompt-policy.ts`, `packages/catalog/src/compat/delegation.ts`, `src/prompts/system/system-prompt.md`, `src/prompts/tools/task.md`, `src/task/types.ts`, `src/system-prompt.ts`, `src/task/settings.ts`, `src/task/model-approval.ts`, `src/task/executor.ts` |
| `MOMP-EVAL-OUTPUT` | `UPSTREAM-INTEGRIERT` | Large owner-result preservation | Settings `prompts/tools/eval.md` |
| `MOMP-EVAL-ROUTING` | `UPSTREAM-INTEGRIERT` | Context-safe Eval orchestration | `src/session/agent-session.ts`, `src/eval/js/tool-bridge.ts` |
| `MOMP-READ-SKILL-COMPACT` | `UPSTREAM-INTEGRIERT` | Compact skill-read display | `src/internal-urls/skill-protocol.ts`, `packages/tui/src/chat/read-tool-group.ts` |
| `MOMP-READ-SCHEDULING` | `UPSTREAM-INTEGRIERT` | Provider-roundtrip-efficient reads | `packages/agent/src/agent-loop.ts` |
| `MOMP-READ-ARTIFACT-RECOVERY` | `UPSTREAM-INTEGRIERT` | Exact output-artifact recovery | `packages/tui/src/tools/output-meta.ts`, `packages/tui/src/tools/streaming-output.ts`, `src/tools/output-meta.ts` |
| `MOMP-READ-ARCHIVE-FRESHNESS` | `UPSTREAM-INTEGRIERT` | Fresh archive indexes across Read calls | `src/tools/read-archive.ts` |
| `MOMP-READ-USER-AGENTS` | `UPSTREAM-INTEGRIERT` | URL fetch identity fallback | `src/web/scrapers/types.ts` |
| `MOMP-WEB-SEARCH-PARALLEL` | `UPSTREAM-INTEGRIERT` | Provider-roundtrip-efficient searches | `packages/agent/src/agent-loop.ts` |
| `MOMP-TREE-COMPACT` | `UPSTREAM-INTEGRIERT` | Token-efficient directory context | `src/workspace-tree.ts` |
| `MOMP-PROJECT-CACHE-ANCHOR` | `UPSTREAM-INTEGRIERT` | Same-directory project-context cache reuse | `src/system-prompt.ts`, `packages/ai/src/providers/anthropic.ts` |
| `MOMP-ANTHROPIC-TOOL-PREDECLARE` | `UPSTREAM-INTEGRIERT` | Cache-neutral `/goal` activation | `packages/ai/src/providers/anthropic.ts`, `packages/ai/src/types.ts`, `packages/agent/src/sent-tool-definitions.ts`, `packages/agent/src/agent-loop.ts`, `packages/agent/src/agent.ts`, `packages/agent/src/types.ts`, `src/sdk.ts` |
| `MOMP-ROUTINES` | `MOMP-EIGEN` | User-defined sequential routines | `src/session/agent-session.ts`, `src/modes/rpc/rpc-prompt-results.ts`, `src/capability/routine.ts`, `src/discovery/routines.ts`, `src/discovery/helpers.ts`, `src/extensibility/routines.ts`, `src/task/command-templates.ts`, `src/modes/rpc/rpc-mode.ts`, `src/modes/rpc/wire/state.ts` |
| `MOMP-COMMAND-UX` | `UPSTREAM-INTEGRIERT` | Rename, argument completion, and slash-list display | `src/utils/title-generator.ts`, `src/session/agent-session.ts`, `src/prompts/system/title-transcript-system.md`, `src/slash-commands/types.ts`, `src/modes/interactive-mode.ts` |
| `MOMP-COMMAND-INVOCATION-DISPLAY` | `UPSTREAM-INTEGRIERT` | Typed file-command transcript rows | `packages/tui/src/chat/user-message.ts`, `packages/tui/src/theme/schema.ts`, `packages/tui/src/theme/schema-validation.ts`, `src/session/agent-session.ts`, `src/extensibility/slash-commands.ts`, `packages/ai/src/types.ts`, `packages/tui/src/chat/transcript-entry.ts`, `src/modes/rpc/wire/content.ts` |
| `MOMP-CONVERSATION-SEARCH` | `MOMP-EIGEN` | Persisted conversation lookup | `src/session/conversation-corpus.ts`, `src/tools/conversation-search.ts`, `src/session/session-listing.ts`, `src/session/conversation-search.ts`, `src/tools/conversation-search-format.ts`, `scripts/bench-conversation-search.ts` |
| `MOMP-SESSION-STREAM-PARSE` | `UPSTREAM-INTEGRIERT` | Decoded-text journal streaming | `src/session/session-loader.ts` |
| `MOMP-CACHE-MISS-COLOR` | `UPSTREAM-INTEGRIERT` | Prominent cache-miss foreground | `packages/tui/src/chat/cache-invalidation-marker.ts`, `packages/tui/src/theme/schema.ts`, `packages/tui/src/theme/color.ts`, `packages/tui/src/native/spans.ts`, `packages/tui/src/chrome/message-divider.ts` |
| `MOMP-RUNTIME-AUDIT` | `MOMP-EIGEN` | Repeatable local performance evidence | `scripts/profile-runtime.ts`, `scripts/profile-runtime-heap-scenario.ts`, `scripts/compile-binary.ts`, `scripts/build-binary.ts` |
| `MOMP-REMOTE-COMPACTION-TAKEOVER` | `UPSTREAM-INTEGRIERT` | Preserve running remote compaction | `src/session/session-maintenance.ts` |
| `MOMP-FALLBACK-DISCOVERY` | `UPSTREAM-INTEGRIERT` | Discovery-safe fallback warnings | `src/config/model-registry.ts`, `src/session/retry-fallback-chains.ts`, `src/session/agent-session.ts`, `src/session/turn-recovery.ts` |
| `MOMP-MODEL-STARTUP` | `UPSTREAM-INTEGRIERT` | Strict configured-default resolution | `src/sdk.ts` |
| `MOMP-MISTRAL-USAGE` | `UPSTREAM-INTEGRIERT` | Mistral Vibe budget reporting | `packages/ai/src/usage/mistral.ts`, `packages/ai/src/usage/registry.ts` |
| `MOMP-STATS-SUMMARY` | `MOMP-EIGEN` | Multi-range CLI usage overview | `src/cli/stats-summary.ts`, `src/cli/stats-cli.ts`, `packages/stats/src/rollup.ts`, `packages/stats/src/aggregator.ts` |
| `MOMP-SCROLLBACK` | `UPSTREAM-INTEGRIERT` | Accepted transcript and multiplexer history integrity | `packages/tui/src/chrome/transcript-container.ts`, `packages/tui/src/prompt/composer.ts`, `packages/tui/src/tui.ts`, `packages/tui/src/chat/assistant-message.ts`, `packages/tui/src/chrome/collab-qrcode.ts`, `packages/tui/src/chat/user-message.ts`, `packages/tui/src/render/terminal-row-reflow.ts`, `packages/tui/src/tmux.ts`, `packages/tui/src/terminal.ts` |
| `MOMP-TMUX-PAGEUP` | `MOMP-EIGEN` | Native tmux history access | `src/modes/controllers/input-controller.ts` |
| `MOMP-PACKAGE-IDENTITY` | `MOMP-EIGEN` | Side-by-side fork identity and update safety | `src/app-version.ts`, `src/task/isolation-runner.ts`, `src/tools/browser/relay/probe.ts`, `src/utils/resume-command.ts`, `src/main.ts`, `scripts/bundle-dist.ts`, `src/cli/update-cli.ts`, `src/commands/update.ts`, `src/cli/command-help.ts`, `src/commands/session.ts`, `src/cli/gallery-screenshot.ts`, `packages/tui/src/prompt/welcome.ts`, `src/extensibility/plugins/legacy-pi-compat.ts`, `src/daemon/client.ts`, `src/disasm/client.ts`, `src/tools/browser/shared-daemon.ts`, `src/cli/ps-cli.ts`, `src/commands/ps.ts` |
| `MOMP-LSP` | `UPSTREAM-INTEGRIERT` | Rename-preview, workspace-symbol, tsserver-fallback, and silent-load LSP extensions | `src/lsp/utils.ts`, `src/lsp/tool.ts`, `src/lsp/config.ts`, `src/lsp/client.ts` |
| `MOMP-READ-TOKEN-COUNT` | `UPSTREAM-INTEGRIERT` | Exact Read token totals | `packages/agent/src/tokenizer.ts`, `src/session/agent-session.ts`, `packages/tui/src/chat/read-tool-group.ts`, `packages/tui/src/tools/read-token.ts`, `packages/tui/src/tools/read.ts`, `packages/tui/src/tools/fetch.ts`, `packages/tui/src/tools/cfg-render.ts`, `packages/tui/src/tools/proc-render.ts` |
| `MOMP-TEXT-COLOR` | `UPSTREAM-INTEGRIERT` | Opt-in response foreground colors | `packages/tui/src/components/markdown.ts`, `packages/tui/src/theme/tui-adapters.ts`, `packages/tui/src/chat/assistant-message.ts`, `src/modes/settings.ts`, `src/modes/interactive-mode.ts`, `src/system-prompt.ts`, `src/sdk.ts` |

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
The existing on-demand `xd://` device catalog is the sole settled exception.
`tools.xdevDocs="builtins"` is the settled MOMP baseline; managed `config.yml` owns the value.
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

## Fork & Upstream Contribution Intent

- Identity: official upstream is [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi).
- Identity: this checkout is the [MikeeI/oh-my-pi](https://github.com/MikeeI/oh-my-pi) fork.
- Boundary: keep `AGENTS.md`, `CONTRACTS.md`, `FORMAT.md`, `ISSUES.md`, `issues/`, and other fork-only state out of upstream diffs.

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

## Branch Roles

- The canonical upstream branch is `main`; `main` mirrors `upstream/main` and stays free of MOMP-only changes.
- `personal` owns fork-only agent context, the MOMP patchstack, and durable contribution tracking.
- Upstream-ready source work uses separate `feat/issue-NNN`, `fix/issue-NNN`, or `chore/issue-NNN` branches off current `upstream/main`.
- Remotes: `origin` is the personal fork `MikeeI/oh-my-pi`; `upstream` is `can1357/oh-my-pi`.

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

|Package|Description|
|---|---|
|`packages/ai`|Multi-provider LLM client with streaming support|
|`packages/catalog`|Model catalog: bundled models.json, provider descriptors, model identity/classification|
|`packages/agent`|Agent runtime with tool calling and state management|
|`packages/coding-agent`|Main CLI application (primary focus)|
|`packages/tui`|Terminal UI library with differential rendering|
|`packages/natives`|Bindings for native text/image/grep operations|
|`packages/stats`|Local observability dashboard (`omp stats`)|
|`packages/omptype`|ArkType-compatible schema validation with a lazy JIT runtime|
|`packages/utils`|Shared utilities (logger, streams, temp files)|
|`crates/natives`|Rust crate for performance-critical text/grep ops|

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
- **Judge questions**: keep one `src/prompts/judge/<feature>.json` file per feature, mapping IDs to `{ instructions, criteria? }`.
  Load it with `judgeQuestions(file)` from `@oh-my-pi/pi-ai` and render Handlebars instructions with `renderQuestion(question, context)`.
  A list of criteria levels means score; omitted criteria or only `true`/`false` keys mean yes/no; other labels mean choice.
  Use `{}` when the caller supplies choice labels; JSON keys determine choice labels and answer types.
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

|Operation|Use|Not|
|---|---|---|
|File read/write|`Bun.file()`, `Bun.write()`|`readFileSync`, `writeFileSync`|
|Spawn process|`` $`cmd` ``, `Bun.spawn()`|`child_process`|
|Sleep|`Bun.sleep(ms)`|`setTimeout` promise|
|Binary lookup|`$which("git")` from `@oh-my-pi/pi-utils`|`spawnSync(["which", "git"])`|
|HTTP server|`Bun.serve()`|`http.createServer()`|
|SQLite|`bun:sqlite`|`better-sqlite3`|
|Hashing|`Bun.hash()`, `Bun.password.*`, WebCrypto|`node:crypto`|
|Path resolution|`import.meta.dir`, `import.meta.path`|`fileURLToPath` dance|
|JSON5|`Bun.JSON5.parse()` / `.stringify()`|`json5` package|
|JSONL|`Bun.JSONL.parse()` / `.parseChunk()`|`text.split("\n").map(JSON.parse)`|
|String width|`Bun.stringWidth()`|`get-east-asian-width`, custom|
|Text wrapping|`Bun.wrapAnsi()`|custom ANSI-aware wrappers|

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
`bun test` processes write their logs to a per-user `omp-test-logs-<uid>/` under the OS temp dir instead.
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

<essential-rule>
Apply `skill-update-context-cli` after changes to commands, flags, help, output contracts, or exit codes.
`docs/cli-reference.md` is the existing source CLI reference; keep executable identity and grammar current there.
Synchronize any referenced active domain skill in the same change when CLI context names one.
</essential-rule>

- NEVER commit unless asked.
- Never use `tsc`/`npx tsc` — always `bun check`.
- Never run `cargo test` directly for Rust tests; use `bun run test:rs`.
  It runs `cargo nextest run` with `.config/nextest.toml`, then `cargo test --doc` because nextest omits doctests.
  The doctest pass runs every runnable workspace library doctest, currently tree-sitter-go's one example.
  Rustdoc skips the omp-natives `cdylib`; omp-builtins' vendored uutils examples are marked `ignore`.
- The Rust half of `bun check` runs only after Rust-affecting changes since the merge base with `upstream/main` or `origin/main`, including uncommitted changes.
  Rust-affecting paths are `*.rs`, `crates/`, and Cargo/toolchain files.
  It always runs in GitHub Actions, when the change set cannot be determined, or with `OMP_FORCE_RUST_TASKS=1`.
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

# ISSUE-027 — Prompt discovery: user templates ignore `PI_CODING_AGENT_DIR`

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-10-24
Updated: 2026-10-24
Source: `upstream/main@0b5c27ab24719c86a5986b95ee55f4e75bc1aaa0`

## Root-Cause

Root-Cause [S]: MOMP's `discoverSystemPromptSources`, `discoverSubagentBaseSystemPromptTemplate`, and `discoverSubagentSystemPromptTemplate` resolve user-level `SYSTEM.md`, `SYSTEM.template.md`, and `SUBAGENT-SYSTEM.template.md` through `findConfigFileWithMeta`/`findConfigFile` with `project: false`.
That shared lookup builds the OMP user base as `path.join(os.homedir(), getConfigAgentDirName())`, which follows profiles and `PI_CONFIG_DIR` but never `PI_CODING_AGENT_DIR`.
Upstream's native owner resolves the same user scope from `getAgentDir()`, which honors that override for the default profile.

## Reach-and-Impact

Reach [S]: Default-profile processes whose `PI_CODING_AGENT_DIR` differs from `~/.omp/agent`; named profiles are unaffected because both paths derive the same profile directory.
Impact [O]: Such a process composes its Main and Child prompts from the home agent directory while Settings and tool and agent prompt overrides come from the overridden directory.
Impact [O]: A temp agent directory's `SYSTEM.template.md` and `SYSTEM.md` are both ignored, and the real `~/.omp/agent/SYSTEM.template.md` renders instead.
Impact [S]: Isolated test and sandbox runs that rely only on `PI_CODING_AGENT_DIR` leak the operator's real Main and Child templates.
Boundary [S]: `project-momp-upgrader` smoke sets `HOME` so its agent directory equals `$HOME/.omp/agent`; its prompt checks are unaffected.
Boundary: Upstream is not affected; this is a MOMP-only divergence inside `MOMP-PROMPT-MAIN` and `MOMP-PROMPT-CHILD`.

## Evidence

- [S] `packages/coding-agent/src/system-prompt.ts:288-293` — user `SYSTEM.md` and `SYSTEM.template.md` use `findConfigFileWithMeta(..., { project: false })`.
- [S] `packages/coding-agent/src/system-prompt.ts:305-323` — Child base and wrapper templates use the same user lookup.
- [S] `packages/coding-agent/src/config.ts:84-88` — `USER_CONFIG_BASES` joins `os.homedir()` with `getConfigAgentDirName()`.
- [S] `packages/utils/src/dirs.ts:334-337` — `getConfigAgentDirName()` returns `.omp/agent` or the profile path, never the override.
- [S] Upstream `packages/coding-agent/src/discovery/builtin.ts:294-295` at `0b5c27ab24` loads user `SYSTEM.md` and `SYSTEM_TEMPLATE.md` from `getAgentDir()`.
- [S] `docs/config-usage.md:74` documents that `getConfigDirs()`/`findConfigFile()` ignore `PI_CODING_AGENT_DIR`.
- [S] `docs/system-prompt-customization.md:72` states that `SYSTEM.md` discovery honors `PI_CODING_AGENT_DIR`; MOMP Main selection contradicts it.
- [S] `packages/coding-agent/src/prompts/user-prompt-source.ts:18` resolves tool and agent overrides from the caller's `agentDir`.

## Bug-Reproduction

Environment: MOMP source `personal@e4c4823b56` (`18.12.6-mikeei-2`), Bun 1.4.4, Ubuntu 24.04, default profile, real `~/.omp/agent/SYSTEM.template.md` present.
Reproduction: Create a temp agent directory with `SYSTEM.template.md` containing `TMP_USER_TEMPLATE` and a `settings.json`; run `PI_CODING_AGENT_DIR=<tmp>/agent ANTHROPIC_API_KEY=test-key bun packages/coding-agent/src/cli.ts system-prompt inspect --cwd <tmp>/project --provider --json`; repeat with `SYSTEM.md` containing `TMP_USER_RAW`.
Actual [O]: Block 0 starts with `# Role` from the real home template; neither marker appears.
Actual [O]: In the same configuration, a temp `prompts/tools/glob.md` override reaches the provider tool description (`test/system-prompt-inspect.test.ts`, provider JSON case).
Expected: The overridden agent directory supplies the user Main and Child prompt sources, matching upstream native discovery and the other profile-scoped prompt sources.

## Prior-Art

Coverage: `ISSUES.md`, `issues/`, and `issues/archive/` searched for `PI_CODING_AGENT_DIR`, agent-dir, and prompt-discovery findings; checked=2026-10-24.
Gaps: No upstream search is needed because upstream already resolves user prompt sources from `getAgentDir()`.

Contribution fit: None upstream; the correction belongs to the MOMP prompt-discovery delta.

## Proposed-Change

Proposal-Status: Not implemented.
[S] Resolve the user-level prompt sources in the three MOMP discovery functions from `getAgentDir()`, keeping existence and dangling-symlink selection.
[S] Keep project discovery unchanged, and keep `APPEND_SYSTEM.md` on upstream's shared lookup per `MOMP-PROMPT-MAIN`.
[A] Dropping the `.claude`/`.codex`/`.gemini` user bases from MOMP user selection is acceptable, because upstream's native owner reads only the agent directory for these files.

## Scope-and-Constraints

- Preserve: precedence, raw-over-template suppression, mandatory template failures, and dangling-symlink rejection.
- Preserve: named-profile behavior, which already matches.
- Exclude: `APPEND_SYSTEM.md` and `TITLE_SYSTEM.md`, which follow upstream's documented shared lookup.
- Adoption cost: one helper or option at the discovery owner plus doc alignment in `docs/system-prompt-customization.md`.

## Verification

- Rerun the reproduction → block 0 renders `TMP_USER_TEMPLATE`, and `TMP_USER_RAW` with a raw file present.
- Add the overridden-agent-dir case for Main and Child sources to `test/system-prompt-templates.test.ts`.

## Publication-Blockers

- Fork-only defect; no external publication applies.
- The user has not authorized the MOMP source fix.

## Next-Action

Summary: Await fork fix authorization
Action: Ask the user to authorize fixing user prompt discovery on `personal`.
Done-When: The user authorizes or declines the MOMP source fix.

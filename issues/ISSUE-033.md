# ISSUE-033 — Anthropic prompt cache: a tool activated mid-session re-writes the system and message cache

State: Submitted
Authorized-Work: Research-and-Reporting
Publication-Target: New-issue
External-Reference: https://github.com/can1357/oh-my-pi/issues/19826
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-11-20
Updated: 2026-11-20
Source: `upstream/main@57771ae562b9345e0579bceb2d68d585e3e6927e`

## Root-Cause

Root-Cause [S]: `planAnthropicToolControls` keeps earlier declarations and appends each newly active tool to the top-level `tools` array with `defer_loading`.
Root-Cause [O]: Anthropic still treats that appended declaration as part of the prefix for the system and message cache levels.
The appended tool sits after the tool breakpoint and before `system`, so only the tool level stays warm.
Everything after the tool level, including the full transcript, is written to the cache again.

## Reach-and-Impact

Reach [S]: Every Anthropic request that activates a tool absent from the transcript's earlier declaration.
Reach [S]: Known trigger: `/goal` adds `goal` through `setActiveToolsByName([...enabledTools, "goal"])`.
Reach [A]: Other activation paths that add a never-declared tool behave the same, including MCP, extension, vibe, and plan activations.
Impact [O]: The miss scales with context size; one 304K-token Opus 5.5 session re-wrote 313,290 tokens (about $2.44) on one `/goal` entry.
Boundary: The next turn reads the cache again, so the cost is one full re-write per activation.

## Evidence

- [S] `packages/ai/src/providers/anthropic.ts:4900` documents the "newly active tools appended with `defer_loading`" contract.
- [S] `packages/ai/src/providers/anthropic.ts:4942-4947` appends an undeclared active name to `declared` and to `deferred`.
- [S] `packages/ai/src/providers/anthropic.ts:4969` emits the appended tool with `deferLoading: true` after every earlier declaration.
- [S] `packages/ai/src/providers/anthropic.ts:4685` anchors the tool breakpoint on the last non-deferred tool, before the appended tool.
- [S] `packages/coding-agent/src/modes/interactive-mode.ts:6496` builds the `/goal` roster as `[...new Set([...enabledTools, "goal"])]`.
- [S] `packages/agent/src/sent-tool-definitions.ts` fills `inactiveTools` only from a recorded declaration, so no first request can declare an inactive tool.
- [O] Session `~/.omp/agent/sessions/-projects-project-product-sms-gateway/2026-11-19T22-01-50-275Z_01a1f5d4-8dc3-71ff-8ad8-f84b260e2347.jsonl`, `/goal` at 2026-11-19T23:03:46Z on `anthropic/claude-opus-5-5`.
  Request controls changed `declared` from 12 to 13 tools with `deferred: ["goal"]`.
  The journal holds a single `system-prompt-digest` entry, so the base system prompt did not change.
  Usage moved from `cacheRead 303560` to `cacheRead 14629`, `cacheWrite 313290`.
- [O] `bun --cwd=packages/coding-agent run probe:cache scan --days 15` (697 journals, 2026-11-20) lists each miss with idle gap and TTL class.
  5 of 6 Anthropic `goal` additions came within the 60-minute TTL (gaps 0.3–10.8 min) and missed below the tool level.
  3 of them read back exactly the tool level (13,945, 14,135, 14,629); 2 on omp 18.14.0 and 18.16.0 read 0.
  The 6th (2026-11-15, 177K→0) followed a 156.6-minute idle gap; that miss is TTL expiry, not this cause.
- [O] `goal` removals with byte-identical `tools` behave as expected: the one within the TTL (0.8 min) read 419,864 tokens.
  The three removal misses followed idle gaps of 178.7, 1004.7, and 1159.3 minutes, so all three are TTL expiry.
- [S] https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching states that deferred tools stay out of the prefix.
  The same page lists "Modifying tool definitions" as invalidating tools, system, and messages.

## Performance-Evidence

Workload: Live probes with `anthropic/claude-sonnet-5-5`, broker OAuth credential, about 19K-token nonce-separated prefixes, 2026-11-20.
Repeatable as `bun --cwd=packages/coding-agent run probe:cache probe`; a third run (1 rep) gave the same A/B/C split.
Each prefix had 8 tools, about 3.3K system tokens, and about 2K user tokens.
Baseline [O]: Provider path (`completeSimple`, `cacheRetention: "short"`, `reasoning: "low"`), arm A (R2 adds `goal` to `context.tools`).
It gave R1 `cw=19059` and R2 `cr=9221 cw=9945`, identical in 2/2 reps.
The `system` hash was equal, the `tools` hash differed, and `tool_addition` was the R2 tail.
Candidate [O]: Arm B (R1 already declares the same deferred `goal` wire object) gave R1 `cw=19158` and R2 `cr=19158 cw=14` in 2/2 reps.
Guard [O]: Arm C (no tool change) gave R1 `cw=19059` and R2 `cr=19059 cw=14` in 2/2 reps.
End-to-end [O]: Real `Agent` loop with the patch applied; R1, then R1b with `goal` inactive, then R2 after `setTools([...tools, goal])`.
Without `prospectiveTools` it gave R1b `cr=19054` and R2 `cr=9216 cw=9960`.
With `prospectiveTools: () => [goal]` it gave R1b `cr=19145` (declared `deferred: ["goal"]`) and R2 `cr=19160 cw=14`.
Boundary: Pre-declaring `goal` costs about 90 extra prefix tokens in the probe, written once.
The real `goal` schema size, the API-key path, and Opus models remain unmeasured.
End-to-end-Measurement: Measured

## Prior-Art

Coverage: upstream issues and pull requests searched for `defer_loading cache`, `goal mode cache miss`, `tool roster prompt cache anthropic`, `tool_addition deferred`, `mid-conversation tool changes`, and `deferred tool declaration system cache tool_addition`; checked=2026-11-20.
Gaps: Upstream Discord not searched.

- `https://github.com/can1357/oh-my-pi/issues/5992` — Related; a 2026-07-28 comment measured a `/goal` full miss on omp 17.1.5, before tool-change controls existed, and asked for miss attribution.
- `https://github.com/can1357/oh-my-pi/pull/4645` — Related, open; it keeps `goal` active from the start. Its review threads cover goal and plan semantics, not caching.
- `https://github.com/can1357/oh-my-pi/pull/11813` — Related, open; cache-miss attribution. It suppresses `tools` reasons for plane-carried adds because "the plane keeps the sent array stable", which this evidence contradicts.
- `https://github.com/can1357/oh-my-pi/pull/15233` — Related, merged; it changed the all-deferred guard in `planAnthropicToolControls` and assumes a tool-list change costs one miss.
- `https://github.com/can1357/oh-my-pi/pull/18520` — Distinct, open; the OpenAI Responses analogue, `additional_tools`, keeps the first declaration.
- `https://github.com/can1357/oh-my-pi/pull/11202` — Distinct, closed; it showed that the tool-changes beta header does not affect caching.
- `https://github.com/can1357/oh-my-pi/issues/18454` — Distinct; a WorkPool `yield` schema swap changes tool bytes, not the deferred-append path.

Contribution fit: New issue; no thread owns this provider root cause, and #5992 owns attribution.

## Proposed-Change

Declare activatable tools as deferred from the transcript's first Anthropic request, so a later activation only appends a `tool_addition` control.
Local patch [O]: `issues/evidence/issue-033/predeclare-prospective-tools.patch`, 8 files, +82/−8, applies cleanly to `personal@f7c6564e16`.

- `packages/ai`: without a recorded declaration, `planAnthropicToolControls` declares `context.inactiveTools` deferred after the active tools.
- `packages/agent`: `AgentOptions.prospectiveTools` is normalized like active tools and attached through `SentToolDefinitions` before the first record, then remembered.
- `packages/coding-agent`: `sdk.ts` supplies the registered `goal` tool.
- Fork delta [O]: applied on `personal` as `MOMP-ANTHROPIC-TOOL-PREDECLARE`, limited to Main sessions, with an agent-level regression case.
- Test: one case in `packages/ai/test/anthropic-control-state-stability.test.ts`.

## Scope-and-Constraints

- Preserve: the byte-stable later declarations, `tool_addition`/`tool_removal` replay, the all-deferred guard from #15233, and held system-prompt rosters on prefix-bound models.
- Exclude: miss attribution in the cache marker, which is owned by #5992 and #11813.
- Exclude: resumed transcripts recorded without the prospective tool, which keep today's append path.
- Cost: each pre-declared deferred tool adds its schema to the cached prefix once per session.

## Verification

- [O] `bun test` on the 4 Anthropic provider suites plus `sent-tool-definitions` and `output-budget` → 104 pass with the patch applied.
- [O] `bun --cwd=packages/{ai,agent,coding-agent} run check` → no type errors, format clean after `oxfmt`.
- [O] The end-to-end `Agent` probe in Performance-Evidence keeps the activation turn's full read.

## Publication-Blockers

None.

## Next-Action

Summary: Await maintainer decision
Action: Answer maintainer questions on #19826 with probe evidence; drop the fork delta once upstream ships an equivalent fix.
Done-When: Upstream fixes, declines, or closes #19826, and the fork delta is removed or reclassified.

## Publication-Draft

Target: New issue in `can1357/oh-my-pi` via the Bug Report form.
Title: `Anthropic: activating a tool mid-session (e.g. /goal) re-writes the system and message cache despite the deferred declaration`

Description:

````markdown
`planAnthropicToolControls` keeps the top-level tool list stable by appending a newly active tool with `defer_loading: true` and announcing it with a tail `tool_addition` ([anthropic.ts#L4942-L4969](https://github.com/can1357/oh-my-pi/blob/57771ae562b9345e0579bceb2d68d585e3e6927e/packages/ai/src/providers/anthropic.ts#L4942-L4969)). The appended entry still invalidates the system and message cache levels: the activation turn reads back only the tool breakpoint (the last non-deferred tool, [L4685](https://github.com/can1357/oh-my-pi/blob/57771ae562b9345e0579bceb2d68d585e3e6927e/packages/ai/src/providers/anthropic.ts#L4685)) and writes the system prompt and the whole transcript again.

`/goal` triggers this on every entry. In a 304K-token Opus 5.5 session, the request after `/goal` read 14,629 tokens and wrote 313,290; the system prompt did not change (one `system-prompt-digest` entry for the whole session). In my last 15 days of sessions, all 5 `goal` activations within the 1-hour cache TTL rewrote the system prompt and transcript (Opus 5.5 and Sonnet 5.5): 3 read back exactly the tool level (13,945–14,629 tokens), and 2 on older builds (18.14.0, 18.16.0) read nothing. A sixth activation came after a 157-minute idle gap, so I left it out as TTL expiry.

Declaring the same tool deferred from the first request avoids it: the activation turn then reads the full prefix.
````

Steps to Reproduce:

````markdown
Live probe against `anthropic/claude-sonnet-5-5` (OAuth), each arm with its own ~19K-token prefix (8 tools, ~3.3K system, ~2K user), `cacheRetention: "short"`. R1 is one user turn; R2 replays R1's reply plus a new user turn 3 s later.

1. Arm A (current path): R1 with tools `T`; R2 with tools `T + goal`. The provider appends `goal` with `defer_loading: true` and adds `tool_addition` at the tail.
2. Arm B: R1 already declares the identical deferred `goal` object; R2 is built exactly as in arm A.
3. Arm C (control): R2 changes nothing.

Same result in 2/2 repetitions per arm. The `system` block hashed identically in R1 and R2 in every arm.
````

Expected Behavior:

````markdown
Activating a tool only appends the `tool_addition` control, so the activation turn reads back the earlier prefix, as it does when the tool was declared from the first request (arm B).
````

Error Output:

````shell
arm  R1                  R2                    tools R1==R2
A    cr=0     cw=19059   cr=9221   cw=9945     no  (goal appended, deferred)
B    cr=0     cw=19158   cr=19158  cw=14       yes (goal declared deferred from R1)
C    cr=0     cw=19059   cr=19059  cw=14       yes (no change)
````

Platform: `Linux`
omp version: `19.0.1`
Bun version: `1.4.5`
Provider: `Anthropic (Claude Pro/Max)`
Area: `Other`

Additional context:

````markdown
Anthropic's [tool use with prompt caching](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching) page says deferred tools stay out of the prefix, but that holds for tools declared deferred from the start; adding a declaration later behaves like "Modifying tool definitions" for the system and message levels.

A possible direction, which I verified locally end to end (not opening a PR): before the transcript records a declaration, pass tools that may be activated later (here `goal`) through `Context.inactiveTools` and let `planAnthropicToolControls` declare them deferred after the active tools. With the real `Agent` loop, R1 → R1b (`goal` inactive, `deferred: ["goal"]`) → R2 (`goal` activated), R2 read 19,160 cached tokens and wrote 14, versus reading 9,216 and writing 9,960 without it. The cost is the deferred schema in every session's prefix, written once.

Related: #5992 (a comment there measured the `/goal` miss before tool-change controls existed; that thread is about attributing misses), #4645 (keeps `goal` always active, a different trade-off), #11813 (treats plane-carried adds as prefix-stable).

### Disclosure

Investigated thoroughly with Claude Opus 5.5 (high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
````

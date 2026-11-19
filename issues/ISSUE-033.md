# ISSUE-033 — Anthropic prompt cache: a tool activated mid-session re-writes the system and message cache

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
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
- [O] Session `~/.omp/agent/sessions/-projects-project-product-sms-gateway/2026-11-19T22-01-50-275Z_01a1f5d4-8dc3-71ff-8ad8-f84b260e2347.jsonl`, `/goal` at 2026-11-19T23:03:46Z on `anthropic/claude-opus-5-5`.
  Request controls changed `declared` from 12 to 13 tools with `deferred: ["goal"]`.
  The journal holds a single `system-prompt-digest` entry, so the base system prompt did not change.
  Usage moved from `cacheRead 303560` to `cacheRead 14629`, `cacheWrite 313290`.
- [O] Local journals from the last 14 days (604 files): all 6 Anthropic `goal` additions missed below the tool level.
  The 6 transitions were 280K→0, 275K→0, 241K→14K, 230K→14K, 177K→0, and 304K→14.6K cache reads on Opus 5.5 and Sonnet 5.5.
- [O] Removing `goal` with byte-identical `tools` missed once (113K→14K) and held once (419K→419K); this removal path has an unresolved cause.
- [S] https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching states that deferred tools stay out of the prefix.
  The same page lists "Modifying tool definitions" as invalidating tools, system, and messages.

## Performance-Evidence

Workload: Throwaway pi-ai probe with `anthropic/claude-sonnet-5-5`, broker OAuth credential, `cacheRetention: "short"`, `reasoning: "low"`, 2026-11-20.
Each arm used a nonce-separated prefix of 8 tools, about 3.3K system tokens, and about 2K user tokens (about 19K tokens in total).
R1 sends one user turn; R2, 3 s later, replays R1's reply and adds a user turn.
Baseline [O]: Arm A, the current provider path (R2 adds `goal` to `context.tools`), gave R1 `cw=19059` and R2 `cr=9221 cw=9945`, identical in 2/2 reps.
The `system` hash was equal, the `tools` hash differed, and `tool_addition` was the R2 tail.
Candidate [O]: Arm B (R1 already declares the same deferred `goal` wire object, R2 path unchanged) gave R1 `cw=19158` and R2 `cr=19158 cw=14`, identical in 2/2 reps.
The `tools` and `system` hashes were equal and the R2 tail was the same `tool_addition`.
Guard [O]: Arm C (no tool change) gave R1 `cw=19059` and R2 `cr=19059 cw=14` in 2/2 reps.
Boundary: Pre-declaring `goal` costs about 99 extra prefix tokens, written once.
The API-key path, Opus models, and real-session sizes remain unmeasured.
End-to-end-Measurement: Not measured

## Prior-Art

Coverage: upstream issues and pull requests searched for `defer_loading cache`, `goal mode cache miss`, `tool roster prompt cache anthropic`, `tool_addition deferred`, `mid-conversation tool changes`, and `deferred tool declaration system cache tool_addition`; checked=2026-11-20.
Gaps: Upstream Discord not searched.
The middle 607 lines of #4645 (review threads) and the open PRs #11813 and #18520 were not read.

- `https://github.com/can1357/oh-my-pi/issues/5992` — Related; a 2026-07-28 comment measured a `/goal` full miss on omp 17.1.5, before tool-change controls existed, and asked for miss attribution.
- `https://github.com/can1357/oh-my-pi/pull/4645` — Related, open; it keeps `goal` active from the start, which avoids this trigger by changing goal-tool availability rather than the provider.
- `https://github.com/can1357/oh-my-pi/pull/15233` — Related, merged; it changed the all-deferred guard in `planAnthropicToolControls` and assumes a tool-list change costs one miss.
- `https://github.com/can1357/oh-my-pi/pull/11202` — Distinct, closed; it showed that the tool-changes beta header does not affect caching.
- `https://github.com/can1357/oh-my-pi/issues/18454` — Distinct; a WorkPool `yield` schema swap changes tool bytes, not the deferred-append path.

Contribution fit: undecided between a new issue and a comment on #5992, which owns attribution rather than this provider root cause.

## Proposed-Change

Declare activatable tools as deferred from the transcript's first Anthropic request, so a later activation only appends a `tool_addition` control.
The coding agent would pass registered but inactive definitions, for example `goal`, through `Context.inactiveTools`.
`planAnthropicToolControls` would then include them in the first declaration as deferred.
Tools first registered after the first request keep today's append path.

## Scope-and-Constraints

- Preserve: the byte-stable later declarations, `tool_addition`/`tool_removal` replay, the all-deferred guard from #15233, and held system-prompt rosters on prefix-bound models.
- Exclude: miss attribution in the cache marker, which is owned by #5992.
- Exclude: the separate removal-path miss.
- Cost: each pre-declared deferred tool adds its schema to the cached prefix once per session.
- Open design: which inactive definitions the agent passes, and whether that set must stay stable across resume.

## Verification

- Re-run the arm A/B/C probe against the implemented provider path: activating `goal` must keep R2 `cacheRead` equal to R1's prefix.
- Add one provider-level regression in `packages/ai/test/anthropic-control-state-stability.test.ts`: a first request with an inactive `goal` definition declares it deferred, and the activation turn keeps `tools` byte-identical.

## Publication-Blockers

- Authorized-Work and Publication-Target are not selected.
- Prior art #4645 (middle section), #11813, and #18520 are not fully read.
- The source of the inactive definitions that the agent passes is undecided.

## Next-Action

Summary: Finish prior art and target
Action: Read #4645's elided review threads, #11813, and #18520, then record the target fit against #5992 and #4645.
Done-When: Prior-Art lists no unread plausible candidate and names a recommended Publication-Target.

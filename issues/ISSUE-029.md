# ISSUE-029 — Codex prompt cache: sibling affinity follows the session headers, so sharing `prompt_cache_key` has no effect

State: Submitted
Authorized-Work: Research-and-Reporting
Publication-Target: Existing-issue-comment
External-Reference: https://github.com/can1357/oh-my-pi/issues/16884#issuecomment-6387558727
Contribution-Priority: Low
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-10-24
Updated: 2026-10-24
Source: `upstream/main@0b5c27ab24719c86a5986b95ee55f4e75bc1aaa0`

## Root-Cause

Root-Cause [O]: The `openai-codex` backend routes prompt-cache affinity by the `session_id`/`conversation_id` headers, which carry `affinitySessionId ?? sessionId`; a shared `prompt_cache_key` alone does not route sibling requests to a common cache.
Root-Cause [S]: Task Children send their own session id and no `parentSessionId`, and the WebSocket prewarm opens each socket with headers that never carry an affinity id.

## Reach-and-Impact

Reach [S]: Every Codex Child spawn, and every upstream mechanism that shares only `prompt_cache_key`, including catalog `task-sibling-prompt-cache` and `--prompt-cache-key`.
Impact [O]: In real Task fan-outs, followers read their siblings' marker prefix in 1/20 cases today and in 24/24 with shared session headers on SSE or on WebSocket without prewarm.
Impact [A]: Shared session headers would save about 6 USD per month in API-equivalent prices, about 1 % of Child cost; Codex runs under ChatGPT Pro quota.

## Evidence

- [S] Upstream `packages/ai/src/providers/openai-shared.ts:524-527` sets `prompt_cache_key` to `promptCacheKey ?? sessionId`.
- [S] Upstream `packages/ai/src/providers/openai-codex-responses.ts:4882-4885` sets both session headers to `affinitySessionId ?? sessionId`, citing codex-rs `responses_session_id`.
- [S] Upstream `packages/ai/src/providers/openai-codex-responses.ts:1521` derives `affinitySessionId` only from `parentSessionId`.
- [S] Upstream `prewarmOpenAICodexResponses` (`openai-codex-responses.ts:3391`) builds WebSocket headers from `createCodexCompatibilityIdentity` (`:588-595`), which has no `affinitySessionId`.
- [O] Real Task fan-outs, 6 runs per variant: [`evidence/issue-029/fanout-2026-10-24.md`](evidence/issue-029/fanout-2026-10-24.md).
  - Current behavior: 1/20 (WebSocket), 2/24 (SSE); shared key only: 2/20 and 2/24.
  - Shared key as session headers: 1/16 with WebSocket prewarm, 24/24 on SSE, 24/24 on WebSocket without prewarm.
- [O] Separate-process and in-process experiments with the same direction: [`evidence/issue-029/CACHE.md`](evidence/issue-029/CACHE.md).

## Prior-Art

Coverage: `ISSUES.md`, `issues/`, and `issues/archive/` searched for cache key and session header; upstream issues searched for project-context cache; checked=2026-10-24.
- https://github.com/can1357/oh-my-pi/issues/16884 — open; asks to pin `prompt_cache_key` for per-prompt ACP sessions; shares the affinity question, and this evidence shows a pinned key alone does not help on `openai-codex`.
- Catalog `task-sibling-prompt-cache` — upstream sibling key `${parentKey}:${agent.name}`, enabled only for Muse-Code models; does not change Codex session headers.
Gaps: OpenAI does not document header-based affinity; the routing claim rests on local measurements.
Contribution fit: Existing-issue-comment on #16884.

## Proposed-Change

Proposal-Status: Not implemented; upstream proposal only, not a MOMP fork delta.
[S] Derive `affinitySessionId` from an explicit `promptCacheKey` that differs from `sessionId`, in request metadata and in the WebSocket prewarm headers.
[S] Enable `task-sibling-prompt-cache` for `openai-codex`, so same-type siblings share headers while keeping their own session ids.

## Scope-and-Constraints

- Preserve: per-Child `sessionId`, WebSocket session keys, and turn state.
- Risk: forks inheriting a parent key would bind to the parent's server; this behavior change is untested.
- Exclude: OpenAI Platform `openai-responses` routing, which was not measured.

## Verification

- Repeat the fan-out runs in the evidence file with the prewarm fix; followers should reach full hits on the default WebSocket path.

## Publication-Blockers

None.

## Next-Action

Summary: Await maintainer decision
Action: Re-read #16884 for a maintainer decision on deriving `affinitySessionId` from a pinned or sibling key.
Done-When: A maintainer accepts, rejects, or reshapes the proposal, or the issue closes.

## Publication-Draft

Target: can1357/oh-my-pi#16884
Title: Not applicable.

Body:

```markdown
Hi, thanks for documenting this.

I measured the affinity side on the `openai-codex` provider with real Task fan-outs, and two details matter for any pinned key:

- On the Codex backend, `prompt_cache_key` alone did not change sibling hits; the session headers did. [`openai-codex-responses.ts#L4882-L4885`](https://github.com/can1357/oh-my-pi/blob/0b5c27ab24719c86a5986b95ee55f4e75bc1aaa0/packages/ai/src/providers/openai-codex-responses.ts#L4882-L4885) sets `session_id` and `conversation_id` to `affinitySessionId ?? sessionId`, and [`#L1521`](https://github.com/can1357/oh-my-pi/blob/0b5c27ab24719c86a5986b95ee55f4e75bc1aaa0/packages/ai/src/providers/openai-codex-responses.ts#L1521) derives `affinitySessionId` only from `parentSessionId`.
- [`prewarmOpenAICodexResponses`](https://github.com/can1357/oh-my-pi/blob/0b5c27ab24719c86a5986b95ee55f4e75bc1aaa0/packages/ai/src/providers/openai-codex-responses.ts#L3391-L3458) opens the WebSocket with headers from `createCodexCompatibilityIdentity`, which has no `affinitySessionId`, and later requests reuse that socket. A fix that only touches request metadata therefore does nothing on the default WebSocket path.

Setup: `omp -p --model openai-codex/gpt-6-luna`; the main agent spawns one `task` child, waits, then spawns four in one call. Each child's first request carries about 20.4k prompt tokens. Each run puts a unique marker at the start of the system prompt, so only same-run siblings can share a cached prefix that extends past it. A full hit means a follower read 18,944 cached tokens instead of the ~6,400 tokens in front of the marker that every run shares. Six runs per variant, four followers each:

| Variant | Transport | Full hits |
|---|---|---|
| Current behavior | WebSocket with prewarm | 1/20 |
| Current behavior | SSE | 2/24 |
| Shared `prompt_cache_key` only (`task-sibling-prompt-cache #true`) | WebSocket without prewarm | 2/20 |
| Shared `prompt_cache_key` only | SSE | 2/24 |
| Shared key also used for `affinitySessionId` | WebSocket with prewarm | 1/16 |
| Shared key also used for `affinitySessionId` | SSE | 24/24 |
| Shared key also used for `affinitySessionId` | WebSocket without prewarm | 24/24 |

Excluded followers failed with `Codex is at capacity`, which also hit the unchanged variant; sharing the headers caused no request failures. I did not measure `openai-responses`.

This appears to share the issue's root cause because a pinned key without matching session headers keeps the per-session affinity this issue describes, at least on `openai-codex`.

Would it make sense for a pinned or sibling cache key to also set `affinitySessionId`, including in the prewarm headers? That would cover this issue's per-prompt sessions and same-type subagent siblings while each request keeps its own session id and turn state.

I checked the relevant discussion; this evidence is not already reported.

I am reporting this finding only and am not currently proposing a pull request.

### Disclosure

Investigated thoroughly with Claude Opus 5.5 (medium reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
```

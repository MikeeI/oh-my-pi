# Prompt cache miss reduction ideas

Status: Investigation complete; no source change is implemented.
This proposal does not create an active MOMP contract.

## Executive summary

`/new` couples a new conversation identity to a new provider prompt-cache identity.
The conversation must be new, but its cache identity can remain stable while the request shape stays compatible.
Rapid short sessions therefore repay the same large stable prefix and often end before amortizing the cold turn.

The recommended change is a session-family cache key that survives `/new` while provider state resets normally.
Existing invalidation logic should retire that key after a model, thinking, system-prompt, or tool-shape change.
Provider routing remains probabilistic, so the change can reduce client-induced misses but cannot guarantee a hit.

## Observed behavior

A tolerant 48-hour scan covered 18,605 session files and 2,631,466 JSONL records.
Nine Main sessions had one to five Assistant turns, and eight first turns reported no cache read.
Four short sessions began within 15 minutes of another session in the same repository.
Three of those four rapid sessions missed first and processed 118,249 uncached input tokens in total.

A strict scan of the four rapid-session files produced this sequence:

| Session | Assistant turns | First-turn input | First-turn cache read |
| --- | ---: | ---: | ---: |
| `01a0265a-eb4e-730a-9030-b52a59b3bb1e` | 4 | 949 | 38,656 |
| `01a0265b-5f10-73b2-b82e-d928582b102b` | 5 | 39,629 | 0 |
| `01a0265d-dadf-7400-9ac8-a147ee6f74fe` | 5 | 39,361 | 0 |
| `01a02666-06c6-70b5-aead-3ea6e3c9080d` | 1 | 39,259 | 0 |

The two cold sessions with later turns reported at least 38,656 cached tokens on their second turn.
The one-turn session processed 39,259 uncached tokens and never benefited from the prefix it warmed.
All four sessions used `openai-codex`, `gpt-5.6-luna`, the same repository, and the same credential pin.
Account rotation therefore does not explain these three misses.

## Prompt-shape evidence

Two offline `momp system-prompt inspect --codex-wire-hash` runs used the same model, CWD, and first message.
Both runs produced the same 177,253-byte input and this input SHA-256:
`bd3252f0d878c3487783e20867b3c9421d03457b5507b4759ac904e2696c6e71`.
They produced different `prompt_cache_key` hashes and different cache-relevant request hashes.

The stable prompt input is not the primary defect in this scenario.
Prompt compression could reduce unavoidable miss cost, but it would not remove the observed identity churn.

## Current ownership and root cause

`packages/coding-agent/src/slash-commands/builtin-lifecycle.ts` routes `/new` into the new-session lifecycle.
`packages/coding-agent/src/session/agent-session.ts#newSession` resets the transcript and closes provider sessions.
It asks `SessionManager` to mint a new session and clears an automatically inherited provider cache key.
`#syncAgentSessionId` then assigns the newly minted session ID to the agent.

`packages/ai/src/providers/openai-shared.ts#getOpenAIPromptCacheKey` resolves the wire key as follows:

```text
promptCacheKey ?? sessionId
```

A normal session has no independent `promptCacheKey`.
Every `/new` therefore changes `prompt_cache_key` with the session ID.
`packages/ai/src/providers/openai-codex-responses.ts` sends that value in the Codex Responses request.

This is the `/new` equivalent of the full-fork affinity defect fixed by upstream issue `#5035`.
That fix separated OMP session lineage from provider cache affinity for compatible full forks.
No matching upstream issue for `/new` was found during this investigation.

## Immediate workaround

The Main CLI already accepts an explicit provider cache key:

```shell
momp --prompt-cache-key momp-luna-medium-default
```

An explicit key survives `/new` because `Agent.reset()` does not clear `promptCacheKey`.
Using the same argument in a later process also preserves affinity across process restarts.

Use one stable key per compatible route and prompt profile.
A useful naming shape is `momp:<model-family>:<thinking>:<prompt-profile>`.
Do not substitute `--provider-session-id` because it also owns provider-session and transport identity.

## Recommended source design

Introduce an automatically inherited session-family cache key for `/new`.
Keep that key separate from the new conversation and provider session IDs.

The transition should perform these steps:

1. Capture the current effective prompt-cache key before resetting the agent.
2. Use the current session ID as the initial family key when no separate key exists.
3. Store the family key as `providerPromptCacheKey` in the new session header.
4. Mint a new OMP session ID and preserve normal session lineage.
5. Close WebSocket, incremental response, and provider-session state exactly as today.
6. Adopt the stored family key after the new session becomes authoritative.
7. Rebuild the base prompt and clear inherited affinity when its compatible shape changed.

The existing inherited-key owner should implement this policy instead of a parallel cache subsystem.
`SessionTools.#refreshBaseSystemPrompt` already compares prompt blocks and clears affinity after a real change.
Model, thinking, and tool mutation paths already clear inherited affinity at their current owners.

## Required invariants

- `/new` must always produce a new local session ID and an empty conversation transcript.
- `/new` must never preserve `previous_response_id`, WebSocket continuation, or provider conversation state.
- An explicit caller-owned `--prompt-cache-key` must remain authoritative and process-scoped.
- Automatic affinity may survive only while the provider request shape remains compatible.
- Model, thinking, system-prompt, and tool-shape changes must retire automatic affinity.
- Cache hits must remain optional and must never affect response correctness or retry policy.
- Provider usage accounting is the only accepted hit signal.
- A zero cache-write count must not be interpreted as proof that no provider write occurred.

## Expected impact

The measured warm prefix was 38,656 tokens.
Stable affinity could have converted up to 115,968 input tokens across the three cold starts into cache reads.
This value is an observed opportunity bound, not a guaranteed saving.
Provider routing, sharding, propagation, and eviction can still miss on identical requests.

Sessions with one to five turns have the highest return because their first-turn miss dominates input processing.
Long sessions already amortize the cold request after later turns begin reading the warm prefix.

## Rejected approaches

- Keeping WebSocket or provider conversation state across `/new` would violate new-session isolation.
- Reusing `previous_response_id` would continue provider lineage instead of creating a fresh session.
- Sending a dummy warm-up request would consume the same prefix processing and add latency.
- Adding explicit cache breakpoints would target unsupported ChatGPT Codex controls.
- Reordering stable prompt blocks would not repair cache-key churn and could create new invalidations.
- Treating every miss as retryable would duplicate requests without guaranteeing another provider shard.

## Verification plan

### Deterministic tests

- Verify that `/new` changes `agent.sessionId` but preserves automatic `agent.promptCacheKey` for an unchanged prompt.
- Verify that repeated `/new` operations preserve the original session-family key.
- Verify that an explicit caller key remains unchanged and is not persisted as an automatic override.
- Verify that a changed model, thinking level, base prompt, or tool signature clears automatic affinity.
- Verify that provider session state still closes and the new transcript remains empty.
- Verify that resume restores the persisted family key only for a compatible request shape.

### Live experiment

1. Fix the model, thinking level, credential, CWD, tool set, and first-message template.
2. Warm one sufficiently large first request.
3. Run ten rapid `/new` sessions with one request each.
4. Record usage, model, account pin, session ID, and prompt-cache key hash.
5. Compare first-turn hit rate and uncached input against the session-ID-per-key baseline.
6. Treat only positive `cacheRead` as a hit.

Report both hit rate and uncached tokens because a partial prefix hit still has value.
Retain provider nondeterminism as a limitation instead of claiming deterministic cache retention.

## Observability note

The active configuration enables `display.cacheMissMarker` and the `cache_hit` status segment.
OpenAI Codex uses implicit caching and usually reports `cacheWrite: 0`.
The current marker suppresses implicit-provider misses to avoid false positives from routing noise.
Use per-turn `cacheRead` and session analytics instead of relying on the marker alone.

## References

- Upstream full-fork cache-affinity issue: https://github.com/can1357/oh-my-pi/issues/5035
- Upstream cache-invalidation audit: https://github.com/can1357/oh-my-pi/issues/5992
- Local Codex provider investigation: `/root/projects/project-codex-fork/research/CACHE.md`.

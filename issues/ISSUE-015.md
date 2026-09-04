# ISSUE-015 — Cache marker: implicit-provider cache collapse is never reported

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: Medium
Finding-Category: UI
Created: 2026-08-28
Updated: 2026-08-28
Source: `upstream/main@cc14e04f075de82c5c0c0ccd2f9dfbce6f03fe9e`

## Root-Cause

Root-Cause [S]: The cache-invalidation detector requires a cold turn to report `cacheWrite > 0`.
Implicit best-effort providers report `cacheWrite: 0`, so the detector intentionally suppresses every such transition.
Usage alone cannot distinguish routine one-turn propagation noise from a persistent unexpected cache collapse.

## Reach-and-Impact

Reach [S]: The exclusion applies to implicit Google, OpenAI, and Fireworks cache accounting.
The marker is operator opt-in through `display.cacheMissMarker`, whose default remains `false`.
Impact [A]: A persistent collapse may force repeated prompt processing without any marker explaining the transition.
No controlled OpenAI trace proves that a persistent unexpected collapse currently occurs.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/cc14e04f075de82c5c0c0ccd2f9dfbce6f03fe9e/packages/coding-agent/src/modes/components/cache-invalidation-marker.ts#L40-L65` excludes implicit caches through the `cacheWrite <= 0` guard.
- [S] `https://github.com/can1357/oh-my-pi/blob/cc14e04f075de82c5c0c0ccd2f9dfbce6f03fe9e/packages/coding-agent/test/cache-invalidation-marker.test.ts#L54-L62` requires an OpenAI-like warm-to-cold transition to remain unmarked.
- [S] `https://github.com/can1357/oh-my-pi/commit/3c90f3bdd1` introduced the suppression to avoid implicit-cache propagation false positives.
- [S] `packages/coding-agent/src/modes/components/cache-invalidation-marker.ts#L70-L74` renders after usage arrives because completed rows may already be native history.
- [S] `AGENTS.md#MOMP-SCROLLBACK` requires accepted terminal rows to remain immutable after finalization.

## Prior-Art

Coverage: The complete internal ledger was searched for cache collapse, invalidation, cache miss, and `cacheRead` ownership on 2026-08-28.
No internal finding owns this root cause.
Gaps: Current upstream issues, pull requests, discussions, and provider documentation remain unchecked.
Contribution fit remains unresolved until live behavior and upstream ownership are verified.

## Proposed-Change

Proposal-Status: Unverified.
[A] Capture a controlled warm-to-cold-to-cold provider trace under unchanged cache-relevant request structure.
[A] If the persistent transition is real, use one session-owned tracker for live rendering and transcript rebuilds.
[A] Render confirmation on turn N+1 with a reference to turn N instead of mutating an accepted turn retroactively.
[A] Veto candidates after any model, reasoning, tool-registry, system-prompt, provider, credential, or cache-key change.
[A] Report provider cost only when current provider accounting defines the applicable input or cache price.

## Scope-and-Constraints

- Preserve the existing explicit-cache marker and `display.cacheMissMarker` opt-in behavior.
- Preserve the session-stable prompt cache key and provider-owned cache lifecycle.
- Preserve accepted scrollback immutability and live-versus-rebuild equivalence.
- Exclude one-turn alarms, cache management, forced cache writes, and provider-specific cost guesses.
- Cost [A]: One controlled probe, one attribution owner, tracker integration, and focused rendering coverage.

## Verification

- Record three comparable provider turns with a byte-stable cache-relevant prefix and exact usage fields.
- Prove warm-to-cold-to-warm emits no marker and warm-to-cold-to-cold emits one confirming marker.
- Prove every attributable request-shape change clears a pending candidate.
- Prove live rendering and transcript rebuild produce the same marker placement.
- Run the focused cache-marker tests and package typecheck after any implementation.

## Publication-Blockers

- A controlled current provider trace does not yet prove persistent unexpected cache collapse.
- The complete cache-relevant attribution boundary has not been identified in current request construction.
- Current upstream prior art and provider documentation remain unchecked.
- Authorized work and Publication target remain intentionally unselected.

## Next-Action

Summary: Measure implicit cache collapse
Action: Capture a controlled three-turn provider trace with unchanged cache-relevant request structure.
Done-When: The trace distinguishes self-healing noise from persistent collapse using exact wire and usage evidence.

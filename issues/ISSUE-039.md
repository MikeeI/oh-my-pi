# ISSUE-039 — Fallback chains: a known model of the wrong kind is reported only after discovery settles

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: Low
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-11-23
Updated: 2026-11-23
Source: `upstream/main@88295533e6`

## Root-Cause

Root-Cause [S]: `validateRetryFallbackChains` in `packages/coding-agent/src/session/retry-fallback-chains.ts` treats a kind-role selector that fails `resolvesForKindRole` as pending whenever its provider's discovery is pending.
It does not first ask whether the selector already resolves to a catalog model of an incompatible kind, which discovery cannot make compatible.

## Reach-and-Impact

Reach [S]: Kind roles (for example `web`) whose `retry.fallbackChains` entry names a cached or bundled model of another kind, while the provider's initial background refresh is in flight.
Impact [O]: The incompatibility warning is withheld at validation and appears only after the initial refresh settles.
Impact [S]: The warning is still reported once discovery settles, including on refresh failure; the harm is a delayed diagnostic, not a missing one or a wrong request.

## Evidence

- [S] `packages/coding-agent/src/session/retry-fallback-chains.ts:328-343` at `upstream/main@88295533e6`: `pending` depends only on `isDiscoveryPending(parsed.provider)`.
- [S] [#16061](https://github.com/can1357/oh-my-pi/pull/16061) introduced the deferral for unresolved selectors during the initial refresh.
- [O] Fork proof `never flashes web fallback warnings for a partial Codex cache and reports unresolved entries after discovery` (`test/agent-session-retry-fallback.test.ts`) fails on upstream only at its wrong-kind assertion (line 7817); its valid- and missing-selector assertions pass.
- [O] The fork's failed-refresh proof `reports unresolved fallback entries when initial background discovery fails` passes on upstream.

## Bug-Reproduction

Environment: `upstream/main@88295533e6` temporary worktree via `momp-upgrade reproduce-upstream --contract MOMP-FALLBACK-DISCOVERY`, Bun 1.4.5, Ubuntu 24.04.
Reproduction: Partial `openai-codex` cache containing `image-only-fallback` (`kind: image`); `retry.fallbackChains.web` lists a later-discovered model, a missing model, and `openai-codex/image-only-fallback`; start `refreshInBackground("offline")`, then `validateRetryFallbackChains()`.
Actual [O]: `expect(session.configWarnings.some(warning => warning.includes(wrongKindSelector))).toBe(true)` fails with `Received: false`.
Expected: The wrong-kind selector is reported immediately; the other two stay deferred.

## Prior-Art

Coverage: upstream issues and PRs searched for `fallback chain warning`, `discovery fallback warning`, `does not resolve to a compatible model`, `fallbackChains warning kind role`, and `unknown model warning startup`; checked=2026-11-23.
Gaps: None material.

- [#16061](https://github.com/can1357/oh-my-pi/pull/16061) — Merged deferral of spurious unknown-model warnings; owns the pending rule this finding narrows.
- [#13883](https://github.com/can1357/oh-my-pi/pull/13883) — Merged image-model classification; unrelated root cause.
- `MOMP-FALLBACK-DISCOVERY` in `CONTRACTS.md` — Active fork delta with this narrowing plus a no-discovery-state readiness rule.

Contribution fit: A focused PR is reviewable, but the delayed-warning impact may not justify maintainer time on its own.

## Proposed-Change

Before deferring a kind-role selector, resolve it against the full catalog; when it names a known model, report the incompatibility immediately instead of deferring.

## Scope-and-Constraints

- Preserve: deferral of unresolved selectors during the initial refresh, post-refresh reporting, and immediate reporting without a background refresh.
- Exclude: the fork's no-discovery-state readiness rule in `isProviderDiscoveryPending`; it has no upstream reproduction yet.
- Cost: one resolution call and one condition in `validateRetryFallbackChains`.

## Verification

- The partial-cache case above passes on the fix branch, including its wrong-kind assertion.
- Existing #16061 deferral cases stay green.

## Publication-Blockers

- Contribution value is unproven: the observed harm is a warning delayed until the initial refresh settles.
- The fork's no-discovery-state case is not reproduced on upstream, so this record does not claim it.
- Authorized-Work and Publication-Target are not selected.

## Next-Action

Summary: Decide contribution value
Action: Decide with the user whether an immediate wrong-kind warning justifies a focused PR or the delta stays fork-only.
Done-When: Authorized-Work and Publication-Target are recorded, or the record is archived as not pursued.

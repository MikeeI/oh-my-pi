# ISSUE-038 — Startup: a cold built-in account default starts on another provider when no local discovery provider is enabled

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-11-23
Updated: 2026-11-23
Source: `upstream/main@88295533e6`

## Root-Cause

Root-Cause [S]: `createAgentSessionScoped` in `packages/coding-agent/src/sdk.ts` awaits its cold-cache discovery pass (`modelRegistry.refresh("online-if-uncached")`) only when `modelRegistry.getDiscoverableProviders().length > 0`.
`getDiscoverableProviders()` lists only models.yml discovery providers and the implicit local providers (`ollama`, `llama.cpp`, `lm-studio`, and `apple` on macOS arm64); built-in account catalogs such as `openai-codex` are never in it.
When every listed provider is disabled, a configured default that exists only in a not-yet-cached built-in account catalog is never discovered before selection, so startup picks another authenticated provider's model.

## Reach-and-Impact

Reach [S]: No explicit `--model`, `modelRoles.default` names a built-in account-catalog model absent from the bundled and cached catalog (for example a model released after the bundled catalog), a cold discovery cache for that provider, and all implicit local discovery providers disabled without a models.yml discovery provider.
Reach [O]: The same case passes on upstream when the local providers stay enabled, because an unrelated discoverable provider happens to open the gate.
Impact [O]: The session starts on a different provider's model (`deepseek` in the reproduction) with only a fallback notice, so the first turns run and bill on a model the user did not configure.
Impact [A]: Cold caches recur after `omp update` changes the cache namespace (#10048) and on fresh machines; frequency for users who disable local providers was not measured.

## Evidence

- [S] `packages/coding-agent/src/sdk.ts:3858-3863` at `upstream/main@88295533e6`: the refresh is gated on `modelRegistry.getDiscoverableProviders().length > 0`.
- [S] `packages/coding-agent/src/config/model-registry.ts:2268-2336` (`#addImplicitDiscoverableProviders`) adds only local providers; `getDiscoverableProviders()` (4016) filters that list by `disabledProviders`.
- [S] The gate comment cites #6114/#6162, whose fix (#6233) targeted models.yml discovery providers.
- [O] Fork proof `awaits cold built-in default discovery instead of starting on another provider` (`test/sdk-model-selection.test.ts`) passes on `personal` and fails on upstream via `momp-upgrade reproduce-upstream --contract MOMP-MODEL-STARTUP` (2026-11-23).

## Bug-Reproduction

Environment: `upstream/main@88295533e6` detached worktree, Bun 1.4.5, Ubuntu 24.04; native addon copied from `personal`; fetch stubbed so Codex discovery returns the fixture model and every other discovery returns 404.
Reproduction: Copy the fork's `test/sdk-model-selection.test.ts` case above; settings `modelRoles.default: openai-codex/gpt-6.1-sol-cold-discovery-fixture:xhigh`, Codex and DeepSeek credentials, `disabledProviders: [ollama, lm-studio, llama.cpp]`, `retry.modelFallback: false`.
Actual [O]: `expect(session.model?.provider).toBe("openai-codex")` fails with `Received: "deepseek"`.
Expected: The configured Codex default after one cache-aware discovery pass; the same case passes on upstream with `disabledProviders: []` (1 pass) and on `personal` with the local providers disabled.

## Prior-Art

Coverage: upstream issues and PRs searched for `default model codex`, `cold cache default model`, `6114`, `6162`, `configured default model unresolved startup`, and `Default model not found Using`; checked=2026-11-23.
Gaps: None material.

- [#6162](https://github.com/can1357/oh-my-pi/issues/6162), [#6114](https://github.com/can1357/oh-my-pi/issues/6114), [#6278](https://github.com/can1357/oh-my-pi/issues/6278), [#6295](https://github.com/can1357/oh-my-pi/issues/6295) — Closed cold-cache default reports for models.yml or local discovery providers; same symptom, other provider class.
- [#6233](https://github.com/can1357/oh-my-pi/pull/6233) — Merged fix that introduced the awaited pass and the `getDiscoverableProviders()` gate this finding names.
- [#15781](https://github.com/can1357/oh-my-pi/pull/15781) — Merged default-role fallback-chain resolution; does not change the gate.
- [#8254](https://github.com/can1357/oh-my-pi/issues/8254) — Open: `resolveModelDiscoveryFallback` can hold startup 10 s on an unreachable implicit `llama.cpp`; constrains any widening of the awaited pass.
- `MOMP-MODEL-STARTUP` in `CONTRACTS.md` — Active fork delta that removes the gate and additionally rejects unresolved configured defaults.

Contribution fit: No open thread owns built-in account catalogs in this gate; a focused PR extending #6233's pass to them is the smallest unit.

## Proposed-Change

Open the awaited `online-if-uncached` pass whenever a configured default is unresolved, not only when `getDiscoverableProviders()` is non-empty.
Cached providers replay without network, so the extra wait applies only to cold built-in catalogs.

## Scope-and-Constraints

- Preserve: explicit `--model`, restored-session precedence, the resolved-default fast path, the default-role fallback chain, and the warning plus unrelated fallback when discovery still cannot resolve the default.
- Exclude: MOMP's rejection of a still-unresolved configured default; upstream deliberately warns and falls back (sdk.ts:3875-3892), so that policy stays fork-only unless maintainers ask.
- Cost: one condition in `createAgentSessionScoped` and one regression case; latency risk bounded by #8254's existing wait path.

## Verification

- `bun test packages/coding-agent/test/sdk-model-selection.test.ts -t "awaits cold built-in default discovery"` with local providers disabled → pass.
- Existing `test/sdk-default-role-discovery-config-provider.test.ts` stays green.

## Publication-Blockers

- Authorized-Work and Publication-Target are not selected.
- The latency effect of an always-open pass for unresolved defaults with cached catalogs is source-reasoned, not measured.

## Next-Action

Summary: Select contribution path
Action: Ask the user to select Authorized-Work and Publication-Target for a focused PR extending the cold-default pass to built-in account catalogs.
Done-When: Authorized-Work and Publication-Target are recorded.

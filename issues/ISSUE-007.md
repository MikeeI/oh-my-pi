# ISSUE-007 — Hub capability: disabled process supervision remains fully advertised

State: Hold
Mode: Undecided
Target: Undecided
Location: Not published.
Priority: High
Confidence: High
Type: correctness
Created: 2026-08-14
Updated: 2026-08-19
Source: `upstream/main@74bc1f442e7bb6adcb5797ca8802ef6684281411`

## Root

Root [S]: Hub consolidation retained the `launch.enabled` execution guard but removed the standalone launch capability gate from Hub registration and model-facing metadata.
With `launch.enabled=false`, Hub remains available for messaging and jobs while process operations, fields, examples, summaries, and Bash guidance remain advertised.

## Reach and impact

Reach [S]: Any normal session with Hub coordination active and process supervision disabled receives process-only operations and lifecycle guidance.
Impact [N]: Calls cannot bypass the runtime guard, but the model can spend tool or retry turns on guaranteed errors; frequency and context-token cost are unmeasured.

## Evidence

- [S] Current upstream `settings-schema.ts` retains the reachable `launch.enabled` setting and its launch-tool description.
- [S] Current upstream `tools/hub/index.ts:73-116` exposes process-only operations and fields unconditionally in `hubSchema`.
- [S] Current upstream `prompts/tools/hub.md:1-34` advertises process supervision and lifecycle guidance without a disabled-capability branch.
- [S] Current upstream `tools/hub/index.ts:154-236` exposes the process-capable summary and examples unconditionally.
- [S] Current upstream `tools/hub/index.ts:317-328` checks `launch.enabled` only when a process route executes and returns `Process supervision is disabled (launch.enabled=false).` before broker execution.
- [S] Current upstream `tools/index.ts:631-635` gates Hub on coordination and IRC state, not on `launch.enabled`.
- [S] Current upstream `tools/bash.ts` owns separate launch guidance, so Hub metadata and Bash capability rendering can diverge.
- [S] `https://github.com/can1357/oh-my-pi/commit/5ff277349cb1b1cda27cf1b3b4d946e160643906` consolidated launch into Hub while retaining enforcement without retaining the complete capability gate.

## Prior art

Coverage: issues(open+closed), PRs(open+closed+merged), source history; checked=2026-08-19.
Gaps [N]: Discussions and focused provider-metadata/runtime capture remain unchecked.

- `https://github.com/can1357/oh-my-pi/issues/5399` and `https://github.com/can1357/oh-my-pi/pull/5466` — disabled tools should be omitted from model context; related presentation precedent with a different owner.
- `https://github.com/can1357/oh-my-pi/issues/5305` — related allowlist and registration drift for a different tool.
- `https://github.com/can1357/oh-my-pi/issues/7061` — confirms Hub must remain for coordination but does not own this `launch.enabled` metadata drift.

Target fit: New capability-presentation candidate; no exact duplicate found.
Mode and external target remain user-unselected.

## Direction

Make Hub metadata capability-aware while preserving messaging and jobs.
Expose process-free schema, prompt, summary, and examples when disabled and full variants when enabled.
Fix Bash launch guidance to require both an active Hub and `launch.enabled`.
Retain the runtime guard for stale or direct calls.

## Bounds

- Preserve: Hub messaging and jobs, the runtime authorization guard, live rebuild behavior, and all process operations when enabled.
- Exclude: Removing Hub, removing the guard, restoring standalone launch, or redesigning broker and process supervision.
- Cost: Dynamic schema, prompt, summary, example, Bash predicate, setting-copy, and positive/negative coverage changes.

## Verification

- Build the real registry with `launch.enabled=false` and capture provider-facing Hub and Bash metadata.
- Require Hub coordination to remain available while process operations, fields, examples, and guidance disappear.
- Call every process route directly and require the exact disabled-setting `isError:true` result without broker execution.
- Use `launch.enabled=true` as the positive control and require the complete process surface.

## Missing

- [N] Focused provider-facing metadata and direct error-result reproduction on `upstream/main@74bc1f442e7bb6adcb5797ca8802ef6684281411`.
- [N] Live-setting refresh verification if runtime toggles are part of the intended contract.
- [N] Token measurement if quantified context impact is later claimed.
- Mode and external target remain intentionally unselected.

## Resume

Index: Reproduce disabled Hub metadata
Next: Build Hub and Bash through the real registry with `launch.enabled=false` and capture metadata plus direct process-route results.
Done when: Capture shows Hub coordination remains active, disabled process metadata is still present, and every process call returns the exact disabled-setting error without broker execution.

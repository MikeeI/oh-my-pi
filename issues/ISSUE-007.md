# ISSUE-007 — Hub capability: disabled process supervision remains fully advertised

State: Hold
Mode: Undecided
Target: Undecided
Location: Not published.
Priority: High
Confidence: High
Type: correctness
Created: 2026-08-14
Updated: 2026-08-14
Source: `upstream/main@ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472`

## Root

Root [S]: Before Hub consolidation, `launch.enabled` gated the whole standalone launch tool. Hub must remain available for messaging/jobs, so the execution guard was retained but the setting disappeared from Hub registration, schema, description, summary, examples, and Bash capability rendering. With `launch.enabled=false`, provider metadata still advertises process operations that deterministically return an error.

## Reach and impact

Reach [S]: Any normal session with Hub coordination active and process supervision disabled receives process-only operations, fields, examples, and mandatory Bash guidance.
Impact [N]: Calls cannot bypass the runtime guard, but the model can spend tool/retry turns on guaranteed errors and has no advertised valid route for long-running processes; frequency and context-token cost are unmeasured.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/config/settings-schema.ts#L3865-L3874` — reachable boolean setting still says “Enable the launch tool”.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/hub/index.ts#L73-L116` — process-only ops and fields are unconditional in Hub schema.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/prompts/tools/hub.md#L1-L34` — process capability and mandatory lifecycle guidance are unconditional.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/hub/index.ts#L154-L236` — summary and six process examples remain unconditional.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/hub/index.ts#L253-L328` — every process route reaches the disabled-setting guard and returns `isError:true` before broker execution.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/index.ts#L625-L629` — Hub availability follows coordination, not `launch.enabled`.
- [S] `https://github.com/can1357/oh-my-pi/commit/5ff277349cb1b1cda27cf1b3b4d946e160643906` — consolidation retained enforcement but lost the standalone capability gate.

## Prior art

Coverage: issues(open+closed), PRs(open+closed+merged), source history; checked=2026-08-14.
Gaps: Discussions and focused provider-metadata/runtime capture remain unchecked.

- `https://github.com/can1357/oh-my-pi/issues/5399` and `https://github.com/can1357/oh-my-pi/pull/5466` — Related precedent: disabled tools should be omitted from model context; different tool/root cause.
- `https://github.com/can1357/oh-my-pi/issues/5305` — Related allowlist/registration drift, different tool.
- `https://github.com/can1357/oh-my-pi/issues/7061` — Related Hub baseline semantics; confirms Hub must remain for coordination, but does not own `launch.enabled` metadata drift.

Target fit: New capability-presentation candidate; no exact duplicate found. Mode and external target remain user-unselected.

## Direction

Make Hub metadata capability-aware while preserving the tool for messaging/jobs: process-free schema, prompt, summary, and examples when disabled; full variants when enabled. Fix Bash’s `hasLaunch` predicate to require active Hub plus `launch.enabled`. Retain the runtime guard for stale or direct calls.

## Bounds

- Preserve: Hub messaging/jobs, runtime authorization guard, live rebuild behavior, and all process operations when enabled.
- Exclude: Removing Hub, removing the guard, restoring standalone launch, or redesigning broker/process supervision.
- Cost: Dynamic schema/prompt/example variants, Bash predicate, setting copy, and positive/negative coverage.

## Verification

- Build the real registry with `launch.enabled=false`; require Hub to remain for coordination while process ops/fields/text/examples disappear.
- Require Bash to omit mandatory `hub op:"start"` guidance.
- Call every process route directly; each must still return exact disabled-setting `isError:true` without broker execution.
- Positive control with `launch.enabled=true` must retain the complete process surface.

## Missing

- [O] Focused provider-facing metadata and direct error-result reproduction on the recorded revision.
- Live-setting refresh verification if runtime toggles are part of the intended contract.
- Token measurement only if quantified context impact is later claimed.
- Mode and external Target remain intentionally unselected.

## Resume

Index: Reproduce disabled Hub metadata
Next: Build Hub and Bash through the real registry with `launch.enabled=false` and capture metadata plus direct process-route results.
Done when: Hub remains active for coordination, process metadata is advertised, and every process call returns the exact disabled-setting error without broker execution.

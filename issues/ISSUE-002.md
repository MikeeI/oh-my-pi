# ISSUE-002 — Eval registry: disabling the last live backend re-advertises every language

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-08-14
Updated: 2026-08-21
Source: `upstream/main@ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472`

## Root-Cause

Root-Cause [S]: `EvalTool.parameters` maps both zero enabled languages and all enabled languages to the same full `py/js/rb/jl` schema. Fresh all-disabled startup correctly omits Eval, but live backend settings are read by the existing Eval instance without rebuilding the active tool registry, so the nonzero→zero transition leaves an advertised tool that rejects every offered language.

## Reach-and-Impact

Reach [S]: Running sessions can change four independent `eval.*` booleans to false; the retained Eval instance reads settings live for schema, summary, description, examples, and execution.
Impact: The provider can receive four guaranteed-failing language choices and spend retry turns; no live-session reproduction or frequency measurement exists yet.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/config/settings-schema.ts#L3565-L3608` — all four backend settings are independent booleans with no at-least-one constraint.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/eval.ts#L66-L83` — all false becomes `[]`, while the empty summary falls back to Python/JavaScript.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/eval.ts#L350-L383` — zero and all-enabled both return the full static schema; zero has no examples but retains the py/js summary.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/eval.ts#L220-L274` — dispatch rejects every disabled language.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/index.ts#L476-L529` and `#L591-L605` — fresh all-disabled construction omits Eval correctly.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/test/system-prompt-inventory.test.ts#L501-L519` — existing coverage proves only fresh all-disabled startup.
- [S] `https://github.com/can1357/oh-my-pi/commit/c926eb381dcc13ef9212b327ece17ddbf6d465b1` — intended invariant says disabled backends are never advertised, but introduces the zero→full fallback.
## Prior-Art


Coverage: issues(open+closed), PRs(open+closed+merged), source history; checked=2026-08-14.
Gaps: Discussions and a live settings-transition trace remain unchecked.

- `https://github.com/can1357/oh-my-pi/pull/4644` — Strongly related; establishes all-disabled omission and live guidance recomputation, but does not cover `eval.*` nonzero→zero.
- `https://github.com/can1357/oh-my-pi/pull/4169` — Related open backend extension; does not fix the zero transition.
- `https://github.com/can1357/oh-my-pi/issues/3252` — Related allowlist design, not the zero-state lifecycle.

Contribution fit: New contribution or focused follow-up candidate; no exact thread owns the `langs.length === 0` fallback and live transition. Authorized work and Publication target remain user-unselected.

## Proposed-Change

At the session tool-registry owner, translate `eval.*` changes atomically into active Eval registration and provider prompt/tool rebuilding: zero removes Eval; nonzero recreates the correct subset. If toggles are restart-only by design, stop reading them partially live and state that contract explicitly.

## Scope-and-Constraints

- Preserve: Fresh all-disabled omission, subset schemas, backend execution guards, and provider-boundary lazy schema reads.
- Exclude: Adding backends, empty-enum schema tricks, and settings-owned tool lifecycle policy.
- Cost: Registry lifecycle decision, live rebuild wiring, and transition-focused coverage.

## Verification

- Start with py/js enabled, create the real Eval tool, then set all four backend settings false on the same Settings/session instance.
- Require Eval to disappear from the provider-visible active toolset; no schema, summary, description, or examples may advertise it.
- Control: a fresh all-false session must continue to omit Eval; restoring one backend must restore only that language.

## Publication-Blockers

- [O] Real nonzero→zero transition capture on the recorded upstream revision.
- Owner decision: atomically rebuild/remove Eval versus explicitly restart-gate backend toggles.
- Re-check overlap with open PR #4169 before any implementation.
- Authorized work and Publication target remain intentionally unselected.

## Next-Action

Summary: Reproduce zero-backend transition
Action: Run the real `createTools` nonzero→zero transition with PI_* flags neutralized and retain fresh all-false as the control.
Done-When: Output captures the retained Eval tool, full language union, fallback summary, and disabled execution error after the last live backend is disabled.

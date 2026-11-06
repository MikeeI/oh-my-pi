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
Source: `upstream/main@76a294cb19bfded1e32e2111f1f729129595bf5e`

## Root-Cause

Root-Cause [S]: `createTools` decides native Eval availability only while constructing the session toolset.
The retained `EvalTool` later reads backend settings live without reconciling the active provider toolset.
`EvalTool.parameters` maps zero enabled languages and all enabled languages to the same full `py/js/rb/jl` schema.
Dispatch still rejects every disabled language.

## Reach-and-Impact

Reach [S]: A running TUI session can change four independent `eval.*` backend booleans.
The retained Eval instance reads those settings live for schema, summary, description, examples, and execution.
Impact [A]: A later provider request may receive four guaranteed-failing language choices and spend retry turns.
No provider-request trace, transition frequency, or measured retry impact exists.

## Bug-Reproduction

Environment: Linux x64; checkout `966d8a07b00e62e383e7d22f556021998754e272`.
The `PI_PY`, `PI_JS`, `PI_RB`, and `PI_JL` flags were absent.
Reproduction: Build Eval through real `createTools` on one mutable Settings/ToolSession instance.
Then disable all four backends before inspecting and executing the retained tool.
Actual [O]: Eval remains retained, advertises `py/js/rb/jl`, and summarizes Python/JavaScript.
It has zero examples and rejects JavaScript as disabled.
Control [O]: Fresh all-false `createTools` construction returns no Eval tool.
Expected: A running session must not expose an Eval contract with no executable backend.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/76a294cb19bfded1e32e2111f1f729129595bf5e/packages/coding-agent/src/tools/eval.ts` retains live backend reads and the zero-to-full schema fallback.
- [S] `https://github.com/can1357/oh-my-pi/blob/76a294cb19bfded1e32e2111f1f729129595bf5e/packages/coding-agent/src/tools/index.ts` retains startup-only Eval availability and fresh all-disabled omission.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/config/settings-schema.ts#L3565-L3608` — all four backend settings are independent booleans with no at-least-one constraint.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/eval.ts#L66-L83` — all false becomes `[]`, while the empty summary falls back to Python/JavaScript.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/eval.ts#L350-L383` — zero and all-enabled both return the full static schema.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/eval.ts#L220-L274` — dispatch rejects every disabled language.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/test/system-prompt-inventory.test.ts#L501-L519` — existing coverage proves only fresh all-disabled startup.
- [S] `https://github.com/can1357/oh-my-pi/commit/c926eb381dcc13ef9212b327ece17ddbf6d465b1` — the intended invariant says disabled backends are never advertised but introduces the zero-to-full fallback.
- [O] Reproduction output: initial tools `["eval"]`; zero-state languages `["py","js","rb","jl"]`.
- [O] Zero-state summary: `Execute Python or JavaScript code in an in-process eval backend`; examples `0`.
- [O] Fresh all-false tools: `[]`.
- [O] Disabled execution error: `Error: JavaScript backend is disabled (PI_JS=0 or eval.js = false).`

## Prior-Art

Coverage: issues and pull requests in all states plus source history; checked 2026-08-21.
Gaps: Discussions and the latest complete PR #4169 diff remain unchecked.

- `https://github.com/can1357/oh-my-pi/pull/4644` — Strongly related; establishes all-disabled omission and live guidance recomputation but not the live zero transition.
- `https://github.com/can1357/oh-my-pi/pull/4169` — Related open backend extension with substantial implementation overlap; it does not claim to fix the zero transition.
- `https://github.com/can1357/oh-my-pi/issues/3252` — Related allowlist design, not the zero-state lifecycle.

Contribution fit: A new contribution or focused follow-up remains possible, but no publication target is selected.

## Proposed-Change

Proposal-Status: Unverified.
[A] Preferred contract: Eval backend settings remain live.
[A] No later provider request starts with a dirty Eval contract.
[A] A backend change marks the Eval contract dirty and starts a serialized session-owned reconcile.
[A] The shared request-preparation owner waits for the reconcile before constructing the next provider request.
[A] Zero available backends remove native Eval; restoring one backend restores only that language.
Uncertainty: The exact shared pre-provider barrier, failure retry, and rollback owners have not been source-verified or tested.
Alternative: If no small shared barrier exists, make backend toggles restart-only and stop reading them partially live.

## Scope-and-Constraints

- Preserve fresh all-disabled omission, subset schemas, and live backend execution guards.
- Preserve explicit tool selection and Extension ownership.
- Exclude immutable backend snapshots, empty-enum schemas, and new backends.
- Exclude generic Settings event infrastructure and unverified SDK-wide live mutation.
- Cost [A]: Eval availability extraction, session reconciliation, one request barrier, and transition coverage.

## Verification

- Reproduce nonzero-to-zero against an exact current `upstream/main` checkout.
- Prove no provider request starts while the Eval contract is dirty.
- Require zero available backends to remove Eval from active provider tools and prompt guidance.
- Restore only JavaScript and require the wire schema to expose exactly `js`.
- Force reconcile failure before a request and require it to stop or retry instead of sending stale Eval metadata.
- Preserve fresh all-false omission, explicit exclusion, Extension overrides, and live execution guards.

## Publication-Blockers

- [A] The preferred live-reconcile contract and its shared pre-provider barrier are unverified.
- Decide live reconciliation versus an explicit restart-only contract after identifying the smallest real owner.
- Re-check the complete current overlap with open PR #4169 before implementation.
- Authorized work and Publication target remain intentionally unselected.

## Next-Action

Summary: Verify Eval commit boundary
Action: Identify the shared pre-provider request owner and test it with a pending Eval reconcile.
Done-When: Source evidence names the owner, failure behavior, and proof that stale Eval metadata cannot reach a request.

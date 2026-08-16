# ISSUE-003 — Todo schema: items is described as append-only despite flattened init

State: Hold
Mode: Undecided
Target: Undecided
Location: Not published.
Priority: Low
Confidence: High
Type: maintainability
Created: 2026-08-14
Updated: 2026-08-14
Source: `upstream/main@ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472`

## Root

Root [S]: The provider-visible `items` field description says only “tasks to append”, although the same schema field intentionally owns flattened single-phase `init`. Runtime, schema acceptance, and the main Todo prompt already support that branch; the residual defect is a contradictory field hint, not a validation failure.

## Reach and impact

Reach [S]: Native and default `xd://` tool surfaces expose the stale schema-local hint beside correct broader Todo guidance.
Impact [N]: A model may avoid or retry flattened `init` if it overweights schema-local descriptions, but no causal failed call or provider transcript is measured.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/prompts/tools/todo.md#L7-L17` — the prompt explicitly documents flattened `init` with `items`.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/todo.ts#L69-L93` — `items` accepts `string[]`, but its provider-visible description is append-only while adjacent rationale says init/append.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/todo.ts#L392-L429` — `initPhases` maps `items` into one phase by design.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/test/tools/todo.test.ts#L429-L460` — focused tests cover flattened init with implicit and explicit phase.
- [S] `https://github.com/can1357/oh-my-pi/commit/d6471c2244acea5ef727f0079500b91c44cd330b` — flattened init was added without updating the pre-existing append-only hint.

## Prior art

Coverage: issues(open+closed), PRs(open+closed+merged), source history; checked=2026-08-14.
Gaps: Discussions and provider transcripts remain unchecked.

- `https://github.com/can1357/oh-my-pi/issues/4461` and `https://github.com/can1357/oh-my-pi/pull/4465` — Related but distinct; whitespace in `op` rejected an otherwise flattened init call.
- `https://github.com/can1357/oh-my-pi/issues/1991` — Distinct/invalid report about phased-init validation.
- `https://github.com/can1357/oh-my-pi/issues/3241` — Distinct legacy array-string coercion.
- `https://github.com/can1357/oh-my-pi/issues/8121` — Distinct open Todo prompt mismatch for blocked-task promotion.

Target fit: Hold; no exact duplicate exists, but source wording alone does not justify maintainer attention without observed model impact.

## Direction

Do nothing until `[O]` impact exists. If observed, change only the authoritative schema hint to “tasks for flattened init or append”; optionally replace the redundant single-phase `list` example with a flattened `items` example rather than adding prompt tokens.

## Bounds

- Preserve: Phased init, flattened init, append, lenient recovery, and current runtime validation.
- Exclude: Discriminated per-op schema redesign, runtime changes, and removal of flattened init.
- Cost: One schema-description correction plus provider-wire assertion if promoted.

## Verification

- Capture the exact provider-visible Todo description and wire schema for the affected presentation mode.
- Validate and execute `{op:"init",items:["First","Second"]}`; require one `Tasks` phase and normal status promotion.
- Promotion gate: retain raw failed/retried model arguments proving the stale hint was causal.

## Missing

- [O] Raw provider request or transcript showing a wrong/retried Todo call caused by the append-only hint.
- Provider/model and presentation mode for that observation.
- Mode and external Target remain intentionally unselected.

## Resume

Index: Capture Todo provider miscall
Next: Resume only when a raw provider trace shows flattened init was avoided or retried because `items` appeared append-only.
Done when: Exact provider-visible metadata and failed/retried arguments establish causal behavior impact.

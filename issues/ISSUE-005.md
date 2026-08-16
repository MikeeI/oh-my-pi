# ISSUE-005 — Task prompt: restricted specialist defaults are called general-purpose workers

State: Hold
Mode: Undecided
Target: Undecided
Location: Not published.
Priority: Medium
Confidence: High
Type: correctness
Created: 2026-08-14
Updated: 2026-08-14
Source: `upstream/main@ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472`

## Root

Root [S]: Restrictive `spawns` policy intentionally uses the first allowed specialist as `defaultAgent`, but `task.md` labels every interpolated default “general-purpose worker” and “default worker”. The conditional `defaultAgentIsGeneric` presentation was removed as unused while Runtime and wire-schema default semantics remained policy-dependent.

## Reach and impact

Reach [S]: Bundled `reviewer` uses `spawns: scout`; custom agents can likewise set restrictive ordered spawn lists. Omitting `agent` then selects a read-only or otherwise specialized Child.
Impact [N]: A model can omit `agent` under a false general-purpose assumption and receive a read-only, blocking, schema-constrained, or otherwise unsuitable specialist; no provider misselection frequency is measured.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/prompts/tools/task.md#L13-L41` — the prompt unconditionally labels the policy default general-purpose/default worker.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/task/spawn-policy.ts#L18-L57` — restrictive policy uses `allowedAgents[0]`; only wildcard policy uses generic `task`.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/task/index.ts#L147-L180` — description interpolation receives `defaultAgent` but no `defaultAgentIsGeneric` or `allowedAgentsText`.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/task/types.ts#L187-L277` — both wire shapes materialize the policy default.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/prompts/agents/reviewer.md#L1-L6` — concrete bundled policy defaults to read-only Scout.
- [S] `https://github.com/can1357/oh-my-pi/commit/8e006a5c81f5ffbb0494b6181850a31f413dd983` — removed the generic-default condition as unused, introducing the current presentation regression.

## Prior art

Coverage: issues(open+closed), PRs(open+closed+merged), source history; checked=2026-08-14.
Gaps: Discussions and rendered-description/provider traces remain unchecked.

- `https://github.com/can1357/oh-my-pi/issues/3973` and `https://github.com/can1357/oh-my-pi/pull/3979` — Fixed close predecessor; restrictive policy previously advertised generic `task` as default and then rejected it. Current issue is the later wording regression after the runtime/schema fix.
- `https://github.com/can1357/oh-my-pi/issues/7313` and `https://github.com/can1357/oh-my-pi/pull/7344` — Related hard-coded Scout availability, different root cause.

Target fit: New narrow prompt-contract candidate; no exact duplicate found. Mode and external target remain user-unselected.

## Direction

Use policy-neutral wording: omitting `agent` selects the spawn-policy default and is correct only when that agent fits. Optionally restore a derived `defaultAgentIsGeneric` branch so “general-purpose” renders only for actual `task`.

## Bounds

- Preserve: First-allowed restrictive default established by #3973/#3979, schema defaults, Runtime enforcement, and filtered agent list.
- Exclude: Changing default order, forcing generic `task`, and restoring redundant allowed-agent prose without need.
- Cost: Prompt/render input correction plus restricted/generic semantic assertions.

## Verification

- Render TaskTool with `getSessionSpawns() === "scout"`.
- Require the description to identify Scout as the spawn-policy default and read-only specialist, never general-purpose.
- Parse omitted-agent batch and flat calls; both must still resolve to Scout.

## Missing

- [O] Rendered TaskTool description for a restrictive Scout policy on the recorded upstream revision.
- [O] Focused description/schema test output.
- Mode and external Target remain intentionally unselected.

## Resume

Index: Render restricted Task default
Next: Render TaskTool with `spawns: scout` and capture description plus omitted-agent schema resolution.
Done when: Output shows the current general-purpose contradiction and confirms Scout as the actual default.

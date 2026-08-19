# ISSUE-005 — Task prompt: restricted specialist defaults are called general-purpose workers

State: Published
Mode: Pull request
Target: New pull request
Location: https://github.com/can1357/oh-my-pi/pull/9046
Priority: Medium
Confidence: High
Type: correctness
Created: 2026-08-14
Updated: 2026-08-20
Source: `upstream/main@74bc1f442e7bb6adcb5797ca8802ef6684281411`

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

None.

## Implementation

Branch: `fix/task-default-guidance`
Base: `upstream/main@74bc1f442e7bb6adcb5797ca8802ef6684281411`
Scope: Correct the Task description of policy-dependent omitted-agent defaults and add focused coverage.
Commit: `86905b6246`
Push: `origin/fix/task-default-guidance`
Pull request: https://github.com/can1357/oh-my-pi/pull/9046
Checks:
- `bun test packages/coding-agent/test/task/task-batch.test.ts` → 19 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check` → Biome and type checks passed.

## Resume

Index: Monitor Task default guidance PR
Next: Monitor upstream pull request #9046 for review and merge.
Done when: Upstream merges or closes pull request #9046 and the disposition is recorded.

## Draft

Title: `fix(coding-agent): clarify task spawn-policy defaults`
Target: New pull request to `can1357/oh-my-pi:main` from `MikeeI:fix/task-default-guidance`.

```markdown
## What

Make the Task tool describe omitted `agent` values as the spawn-policy default instead of calling every default a general-purpose worker.

The focused test covers a restrictive `spawns: scout` policy and confirms that Scout remains identified as read-only.

## Why

The runtime resolves an omitted `agent` to the first allowed agent under restrictive policies, so a reviewer can default to read-only Scout rather than the generic `task` agent.

The prompt currently calls that selected default a general-purpose worker, which can encourage unsuitable omitted-agent calls.

## Scope

The change only corrects model-facing wording and adds focused coverage.

Spawn-policy resolution, schema defaults, and runtime enforcement remain unchanged.

## Testing

- `bun test packages/coding-agent/test/task/task-batch.test.ts` — 19 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check` — Biome and type checks pass.
- `I reviewed the full diff; this change only corrects the Task default description and leaves spawn-policy resolution unchanged.`

---

- [ ] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated (if user-facing)

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting their time or energy or discouraging their work.

Thank you for your work.
```

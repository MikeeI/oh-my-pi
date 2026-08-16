# ISSUE-004 — Bash prompt: timeout does not extend the auto-background cutoff

State: Ready
Mode: Pull request
Target: New pull request
Location: Not published.
Priority: Medium
Confidence: High
Type: correctness
Created: 2026-08-14
Updated: 2026-08-14
Source: `upstream/main@ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472`

## Root

Root [S]: With auto-background enabled, `bash.md` tells the model “Need inline? Raise timeout.” Runtime owns two independent limits: `timeout` is the job deadline, while `bash.autoBackground.thresholdMs` caps foreground waiting. Once the deadline exceeds threshold plus one second, raising `timeout` cannot extend inline waiting.

## Reach and impact

Reach [S]: The misleading line renders only when auto-background is enabled and applies when the non-PTY, managed-job path has capacity and no ACP terminal route wins.
Impact [N]: A model can raise a deadline from the 300-second default to 3,600 seconds, still receive a background result at the default 60-second threshold, and leave a hung job alive longer; frequency and provider behavior are unmeasured.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/prompts/tools/bash.md#L22` — model-facing guidance recommends raising timeout for inline completion.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/bash.ts#L57-L61` and `#L580-L621` — deadline and auto-background threshold are separate render/runtime inputs; default threshold is 60,000ms.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/bash.ts#L938-L943` — foreground wait is `max(0, min(thresholdMs, timeoutMs - 1000))`.
- [S] At the default threshold, timeout=61s, 300s, 3,600s, or 0 all yield at most 60,000ms foreground wait; only the job deadline changes.
- [S] `https://github.com/can1357/oh-my-pi/pull/7015` — introduced the current wording after correctly rejecting `async:true` as an inline solution, but did not account for threshold saturation.
- [O] Contribution commit `2291e7e8f96e6ec50a367cc37b19e39c82c9fb55` renders the configured threshold separately from the deadline and reproduces threshold saturation with `timeout:3600`.

## Prior art

Coverage: issues(open+closed), PRs(open+closed+merged), review comments, Discussions, and source history; checked=2026-08-14.
Gaps: None.

- `https://github.com/can1357/oh-my-pi/pull/7015` — Related origin, not duplicate; review claims only raising timeout keeps the call inline but misses the separate cutoff.
- `https://github.com/can1357/oh-my-pi/issues/5556` — Related model/job guidance, different control problem.
- `https://github.com/can1357/oh-my-pi/issues/7235` and `https://github.com/can1357/oh-my-pi/pull/7236` — Fixed different root cause: retained threshold timer delayed exit.
- `https://github.com/can1357/oh-my-pi/issues/4408` and `https://github.com/can1357/oh-my-pi/pull/4409` — Fixed timeout clamp/documentation drift, not auto-background saturation.

Target fit: User-selected new pull request; no exact issue, discussion, or active pull request owns the timeout/threshold conflation.

## Direction

Correct only `bash.md`: distinguish job deadline from maximum foreground wait and state that raising `timeout` cannot extend the auto-background threshold. Preserve the runtime policy; coupling threshold to model-selected deadlines would defeat responsiveness.

## Bounds

- Preserve: Deadline clamp, `timeout:0`, auto-background threshold, steering-triggered backgrounding, owner-routed completion, and PTY routing.
- Exclude: Runtime coupling, a new `inline` parameter, PTY workaround guidance, and background-job redesign.
- Cost: Prompt-only correction plus one semantic prompt assertion and one focused saturation regression.

## Verification

- With auto-background enabled and threshold=10ms, execute a 30ms command using `timeout:3600`.
- Require the initial result to be a running background job and later delivery to contain both output markers.
- Require the rendered prompt to distinguish deadline and threshold and omit “Need inline? Raise timeout.”

## Missing

None.

## Implementation

Branch: `fix/bash-auto-background-guidance`
Base: `upstream/main@ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472`
Scope: Correct Bash timeout/auto-background guidance and add focused prompt/runtime regression coverage.
Commit: `2291e7e8f96e6ec50a367cc37b19e39c82c9fb55`
Push: `origin/fix/bash-auto-background-guidance`
Checks:
- `bun test packages/coding-agent/test/tool-guidance-efficiency.test.ts` → 2 pass, 0 fail.
- `bun test packages/coding-agent/test/tools.test.ts -t "should auto-background at the threshold even with a longer timeout"` → 1 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check` → Biome checked 2,607 files; type check passed.
- `bun check` → all TypeScript and Rust workspace checks passed.

## Resume

Index: Approve Bash pull request
Next: Present the exact target and pull request draft for publication approval.
Done when: The user approves this exact draft and `can1357/oh-my-pi` new pull request target.

## Draft

Title: `fix(coding-agent): clarify bash auto-background timeout`
Target: New pull request to `can1357/oh-my-pi:main` from `MikeeI:fix/bash-auto-background-guidance`.

```markdown
## What

Correct Bash tool guidance to distinguish the configured foreground threshold from the job deadline.

When auto-backgrounding is enabled, the prompt now renders the threshold and states that raising `timeout` does not extend foreground waiting. Runtime behavior is unchanged.

## Why

The current “Need inline? Raise `timeout`” guidance conflates two independent controls. Runtime waits for `min(thresholdMs, timeoutMs - 1000)`, so a deadline above the threshold cannot keep the call inline longer.

PR #7015 introduced the wording; issues #4408, #5556, and #7235 cover related timeout or job behavior but not this threshold-saturation contract.

## Testing

- `bun test packages/coding-agent/test/tool-guidance-efficiency.test.ts` — 2 pass, 0 fail.
- `bun test packages/coding-agent/test/tools.test.ts -t "should auto-background at the threshold even with a longer timeout"` — 1 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check` — Biome and type checks pass.

I checked the relevant issues, comments, pull requests, and discussions; this pull request is not a duplicate.

---

- [x] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated (if user-facing)

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
```

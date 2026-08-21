# ISSUE-001 — Eval prompt: agent() children do not share the promised kernel state

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/9154
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-08-14
Updated: 2026-08-21
Source: `upstream/main@76a294cb19bfded1e32e2111f1f729129595bf5e`

## Root-Cause

Root-Cause [S]: `eval.md` says persistent kernel state survives across “subagents” and later defines Eval `agent()` as a subagent launcher, while `runEvalAgent` intentionally sets `shareEvalSession: false`; the 2026-07-28 prompt compression removed the earlier `task` qualifier without changing the deadlock-critical runtime isolation.

## Reach-and-Impact

Reach [S]: Every Eval-enabled session whose model follows the built-in `agent()` guidance can assume Parent globals and imports exist in the Child; normal `task` Children do inherit the Parent Eval session, but Eval-bridge Children do not.
Impact: The contract can produce missing-name errors, duplicated setup, or failed delegated analysis; no provider transcript or end-to-end marker failure is measured yet.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/prompts/tools/eval.md#L1-L24` — the prompt makes the unqualified persistence promise and calls Eval `agent()` a subagent.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/eval/agent-bridge.ts#L141-L160` — Eval `agent()` passes `shareEvalSession: false`.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/task/structured-subagent.ts#L106-L110` and `#L443-L449` — task Children share Eval state; Eval-bridge Children must not because the Parent kernel waits on the Child.
- [S] `https://github.com/can1357/oh-my-pi/commit/c057b0ef3394956b5d3283bccf387df5a750430f` — intentional isolation prevents a kernel deadlock.
- [S] `https://github.com/can1357/oh-my-pi/commit/af1832af1bd36070a814c3bb175c3655ee44e29f` — prompt compression changed “`task` subagents” to unqualified “subagents”.
- [O] PR head `dab8d0339d` gates isolation guidance, preserves `parentEvalSessionId === undefined`, and avoids exact prompt-wording coverage.

## Prior-Art

Coverage: issues(open+closed), PRs(open+closed+merged), Discussions, source history, and current Eval documentation; checked=2026-08-21.
Gaps: Provider transcripts remain unchecked; the pull request makes no provider-impact claim.

- `https://github.com/can1357/oh-my-pi/issues/3196` — Related; documents the no-inherited-session decision needed to avoid deadlock, not the later prompt regression.
- `https://github.com/can1357/oh-my-pi/pull/3205` — Related; implements Eval `agent()` without correcting the current persistence wording.
- `https://github.com/can1357/oh-my-pi/issues/5279` — Related architecture; preserves frontend-specific semantics.

Contribution fit: User-selected new pull request; no existing thread or implementation owns the current prompt/runtime contradiction.

## Proposed-Change

Restore the `task` qualifier and state that Children launched through Eval `agent()` use independent kernels. Preserve `shareEvalSession: false`; changing it would reintroduce the documented deadlock.

## Scope-and-Constraints

- Preserve: Eval state sharing across calls and normal `task` Children; Eval-bridge deadlock avoidance; file and artifact sharing.
- Exclude: Kernel-sharing redesign, task execution unification, and provider-specific prompt variants.
- Cost: Prompt correction plus guarded description and bridge-policy coverage.

## Verification

- Render with spawning enabled and require the `task`-sharing contract plus the Eval-`agent()` isolation exception.
- Render with spawning disabled and require every Eval `agent()` reference to be absent.
- Capture `runSubprocess` options from `runEvalAgent`; require `parentEvalSessionId === undefined`.

## Publication-Blockers

None.

## Pull-Request-Implementation

Branch: `fix/eval-agent-kernel-persistence`
Base: `upstream/main@76a294cb19bfded1e32e2111f1f729129595bf5e`
Scope: Correct Eval kernel-sharing guidance and preserve capability-gated prompt composition.
Commit: `dab8d0339d`
Push: `origin/fix/eval-agent-kernel-persistence`
Personal: `personal@409c39a20a`
Checks:
- `bun test packages/coding-agent/test/tools/eval-description.test.ts packages/coding-agent/test/eval/agent-bridge-policy.test.ts` → 48 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check` → Biome checked 2,672 files; type check passed.
- GitHub Actions run `32465176807` → every required build, smoke, and test job passed.
Review [O]: Both `COMMENTED` reviews target `343e21c9ef1a`; clean head `dab8d0339d0f` addresses their findings.

## Next-Action

Summary: Await Eval current-head review
Action: Monitor pull request #9154 for review of head `dab8d0339d0f` and the maintainer decision.
Done-When: A current-head review, requested follow-up, or terminal outcome is recorded.

## Publication-Draft

Title: `fix(coding-agent): clarify eval agent kernel isolation`
Target: New pull request to `can1357/oh-my-pi:main` from `MikeeI:fix/eval-agent-kernel-persistence`.

```markdown
## What

Clarify the Eval tool's kernel-state contract: state persists across calls and ordinary `task` subagents, while children launched through Eval `agent()` use independent kernels.
The focused tests also pin the existing bridge policy by asserting that `runEvalAgent` does not pass a Parent Eval session ID.

## Why

The current prompt says state persists across all subagents, but Eval `agent()` intentionally uses `shareEvalSession: false`.
Sharing that executor would reintroduce the deadlock avoided by the existing bridge design.
Issues #3196 and #5279 and PR #3205 describe related Eval isolation behavior, but none corrects this later prompt regression.

## Testing

- `bun test packages/coding-agent/test/tools/eval-description.test.ts packages/coding-agent/test/eval/agent-bridge-policy.test.ts` — 48 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check` — Biome and type checks pass.

I checked the relevant issues, comments, pull requests, and discussions; this pull request is not a duplicate.

---

- [x] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated (if user-facing)

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
```

## Submitted-Text

```markdown
## What

Clarify the Eval kernel-state contract.
State persists across calls and ordinary `task` subagents.
Children launched through Eval `agent()` use independent kernels.

The focused tests also pin the existing bridge policy.
They assert that `runEvalAgent` does not pass a Parent Eval session ID.

## Why

The current prompt says state persists across all subagents, but Eval `agent()` intentionally uses `shareEvalSession: false`.
Sharing that executor would reintroduce the deadlock avoided by the existing bridge design.

Issues #3196 and #5279 and PR #3205 describe related Eval isolation behavior.
None corrects this later prompt regression.

## Testing

- `bun test packages/coding-agent/test/tools/eval-description.test.ts packages/coding-agent/test/eval/agent-bridge-policy.test.ts` — 48 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check` — Biome and type checks pass.
- GitHub Actions run `32440357822` — all required jobs pass.

I checked the relevant issues, comments, pull requests, and discussions; this pull request is not a duplicate.

---

- [x] `bun --cwd=packages/coding-agent run check` passes
- [x] Focused tests pass
- [x] CHANGELOG updated

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
```

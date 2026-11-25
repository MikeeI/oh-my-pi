# ISSUE-034 — Compaction: the grace-cap pass aborts a running remote speculation and re-sends it

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/20201
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-11-22
Updated: 2026-11-25
Source: `upstream/main@88295533e6`

## Root-Cause

Root-Cause [S]: `SessionMaintenance#claimArmedSpeculation` aborts every unarmed in-flight speculation (`run.controller.abort(); return undefined;`) when a real automatic pass claims the slot.
Once context reaches the grace cap, `deferThresholdCompactionToSpeculation` returns `false`, so the blocking threshold pass discards a background remote compaction that is still running and starts the same compaction from scratch.

## Reach-and-Impact

Reach [S]: Automatic threshold compaction with async compaction enabled, the `remote` method selected, no `session_before_compact` handler, and a speculative remote run still unarmed when the grace cap is crossed.
Impact [S]: The user pays a second full blocking remote request although the first one was already partly done, and the larger replacement request may no longer fit the window.
Impact [A]: Independent measurements in [#19737](https://github.com/can1357/oh-my-pi/issues/19737) (median OpenAI remote stall 107 s main / 135 s subagent) indicate the cost of each restarted request; this record did not measure it.

## Evidence

- [S] `packages/coding-agent/src/session/session-maintenance.ts` `#claimArmedSpeculation` at `upstream/main@88295533e6` aborts unarmed runs; the call site in the automatic pass documents "an in-flight run is aborted (this real pass supersedes it)".
- [S] Upstream commits after the MOMP base (`c398b30162`, #20011 `f356b5aacb`, `ab2bb8644c`, `257f9187ea`) change latching, rollover, and branch summaries but not this abort.

## Bug-Reproduction

Environment: `upstream/main@88295533e6` detached worktree, Bun 1.4.5, Ubuntu 24.04; native addon copied from `personal` because this path is TypeScript-only.
Reproduction: Run the MOMP case `adopts a running remote compaction at the grace cap without losing the post-snapshot interval` from `packages/coding-agent/test/compaction-speculation.test.ts` against upstream.
Actual [O]: `expect(requestSignal?.aborted).toBe(false)` fails with `Received: true` once `auto_compaction_start` is emitted.
Expected: The pass adopts the running request; the same case passes on `personal` (1 pass, 14 expects).

## Prior-Art

Coverage: upstream issues and PRs searched for `speculative compaction`, `speculation abort remote compaction`, and `grace cap compaction`; checked=2026-11-22.
Gaps: None material.

- [#19737](https://github.com/can1357/oh-my-pi/issues/19737) — Point 2 reports this exact root cause and proposes awaiting the in-flight run; closed `NOT_PLANNED` by its author as unintended agent filing, without maintainer decision. It also bundles three unrelated proposals.
- [#20011](https://github.com/can1357/oh-my-pi/pull/20011), [#11637](https://github.com/can1357/oh-my-pi/pull/11637), [#13478](https://github.com/can1357/oh-my-pi/pull/13478) — Merged speculation fixes for other root causes.
- `MOMP-REMOTE-COMPACTION-TAKEOVER` in `CONTRACTS.md` — Active fork delta carrying this fix.

Contribution fit: No open thread or PR owns the correction; a focused PR implementing only #19737 point 2 is the smallest reviewable unit.

## Proposed-Change

In the automatic pass, when an eligible remote speculation is still running, emit the maintenance start event, then await that run under the maintenance controller instead of aborting it.
Charge the time already spent against `REMOTE_COMPACTION_TIMEOUT_MS`, keep provider deadlines, and link cancellation both ways.
Revalidate the snapshot after the wait; failure, deadline, or invalidation advance to the next configured method.

## Scope-and-Constraints

- Preserve: manual compaction, async opt-out, `session_before_compact` interceptors, bridge speculation, armed-result validation, and non-remote methods.
- Exclude: #19737 points 1, 3, and 4 (observer-hook logging, hook invocation on apply, lead-cap setting).
- Cost: one private wait helper, two `SpeculationRun` fields, and one eligibility branch in the automatic pass.

## Verification

- `bun test packages/coding-agent/test/compaction-speculation.test.ts` on the PR branch → 44 pass, 0 fail, 184 expects.
- New cases: grace-cap adoption without a second request, operator and snapshot cancellation without commit or restart, provider failure and remaining-deadline fallback to `soft`, and revalidation across a reset.
- `bun --cwd=packages/coding-agent check` → oxlint, oxfmt, and type check pass.

## Pull-Request-Implementation

Branch: `fix/issue-034`
Base: `upstream/main@76b7d843d5` (rebased 2026-11-25 from `upstream/main@88295533e6`)
Scope: Adopt an eligible running remote speculation at the grace cap instead of aborting it; bridge speculation keeps the abort; upstream's existing interval-preservation test stays unchanged.
Commit: `c6d6e6bce6`; attribution `d709f09d47`; review fix `ea8d5e5de1` (exclude `bridge` runs, await `speculationCompletion()` in tests); the CHANGELOG entry sits under `[Unreleased]` `### Fixed`.
Push: `MikeeI/oh-my-pi:fix/issue-034`
Checks:

- `bun test packages/coding-agent/test/compaction-speculation.test.ts` on `ea8d5e5de1` → 44 pass, 0 fail, 184 expects.
- `bun --cwd=packages/coding-agent check` on `ea8d5e5de1` → pass.

## Publication-Blockers

None.

## Next-Action

Summary: Await maintainer review
Action: Await maintainer review of PR #20201 and address requested changes.
Done-When: PR #20201 is merged, declined, or receives actionable review.

## Publication-Draft

Target: New pull request `MikeeI/oh-my-pi:fix/issue-034` → `can1357/oh-my-pi:main`.

Title:

```text
fix(coding-agent): adopt running remote speculation at the grace cap
```

Body:

```markdown
## What

When the automatic threshold pass reaches the grace cap while a background remote compaction is still running, it now waits for that run instead of aborting it and sending the same request again.
The wait runs under the maintenance controller after `auto_compaction_start`, so new input stays queued and Esc cancels it.
It only spends what is left of `REMOTE_COMPACTION_TIMEOUT_MS` since the speculative launch, and the snapshot is revalidated before it commits.
Cancellation commits nothing; provider failure or the deadline falls through to the next configured method.

Manual compaction, `asyncEnabled: false`, `session_before_compact` handlers, bridge speculation, and non-remote methods keep their current behavior.

## Why

`#claimArmedSpeculation` aborts any unarmed in-flight run when a real pass claims the slot.
At the grace cap that throws away a remote request that may be nearly done and pays the full blocking stall again, with a larger request that may no longer fit.
This is point 2 of #19737, which its author closed as unintended filing; this PR covers only that point.

## Testing

- `bun test packages/coding-agent/test/compaction-speculation.test.ts` — 44 pass.
  - New: grace-cap adoption issues exactly one `compact` call and keeps the request signal un-aborted; operator and snapshot cancellation commit nothing and do not restart; provider failure and the remaining-deadline timeout fall back to `soft`; a reset during the wait discards the stale snapshot.
  - Without the fix, the adoption case fails because the running request's signal is aborted.
- `bun --cwd=packages/coding-agent check` — passes.

---

- [x] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated with the required attribution (if user-facing; internal issue fixes use issue links, external contributions add the PR link and contributor credit after creation)

### Disclosure

Investigated and implemented with Claude Opus, using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
I reviewed the full diff and checked the claims against the cited code and test runs.

Thank you for your work.
```

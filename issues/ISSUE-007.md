# ISSUE-007 — Hub capability: disabled process supervision remains fully advertised

State: Implementing
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: Not published.
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-08-14
Updated: 2026-08-21
Source: `upstream/main@76a294cb1905c1b900eea9f0c83f86b36a03a45c`

## Root-Cause

Root-Cause [S]: Hub consolidation retained the `launch.enabled` execution guard but removed the standalone launch capability gate from Hub registration and model-facing metadata.
With `launch.enabled=false`, Hub remains available for messaging and jobs while process operations, fields, examples, summaries, and Bash guidance remain advertised.

## Reach-and-Impact

Reach [S]: Any normal session with Hub coordination active and process supervision disabled receives process-only operations and lifecycle guidance.
Impact: Calls cannot bypass the runtime guard, but the model can spend tool or retry turns on guaranteed errors; frequency and context-token cost are unmeasured.

## Evidence

- [S] Current upstream `settings-schema.ts` retains the reachable `launch.enabled` setting and its launch-tool description.
- [S] Current upstream `tools/hub/index.ts:73-116` exposes process-only operations and fields unconditionally in `hubSchema`.
- [S] Current upstream `prompts/tools/hub.md:1-34` advertises process supervision and lifecycle guidance without a disabled-capability branch.
- [S] Current upstream `tools/hub/index.ts:154-236` exposes the process-capable summary and examples unconditionally.
- [S] Current upstream `tools/hub/index.ts:317-328` checks `launch.enabled` only when a process route executes and returns `Process supervision is disabled (launch.enabled=false).` before broker execution.
- [S] Current upstream `tools/index.ts:631-635` gates Hub on coordination and IRC state, not on `launch.enabled`.
- [S] Current upstream `tools/bash.ts` owns separate launch guidance, so Hub metadata and Bash capability rendering can diverge.
- [S] `https://github.com/can1357/oh-my-pi/commit/5ff277349cb1b1cda27cf1b3b4d946e160643906` consolidated launch into Hub while retaining enforcement without retaining the complete capability gate.
- [O] Direct HubTool probe with `launch.enabled=false` retained the process-capable summary, schema fields, all process ops, and two process examples.
- [O] The same probe returned `isError:true` and the exact disabled-setting message for `start`, `ps`, `logs`, `stop`, `restart`, `describe`, Process `send`, and Process `wait`.
- [O] Real `createTools` registry probes with `launch.enabled=false` and `true` contained `hub` and `bash` in both cases; Hub summary, Process ops, fields, and five Process examples were identical.
- [O] With `launch.enabled=false`, Bash still rendered `Services, watchers, debuggers, and REPLs MUST use hub (op:"start").`; no provider-visible `search` or standalone `ssh` name appeared in the same registry.

## Prior-Art

Coverage: issues(open+closed), PRs(open+closed+merged), Discussions, source history, current prompts, and current documentation; checked=2026-08-21.
Gaps: Token impact remains unmeasured; the contribution makes no quantified impact claim.

- `https://github.com/can1357/oh-my-pi/issues/5399` and `https://github.com/can1357/oh-my-pi/pull/5466` — disabled tools should be omitted from model context; related presentation precedent with a different owner.
- `https://github.com/can1357/oh-my-pi/issues/5305` — related allowlist and registration drift for a different tool.
- `https://github.com/can1357/oh-my-pi/issues/7061` — confirms Hub must remain for coordination but does not own this `launch.enabled` metadata drift.

Contribution fit: Focused new pull request; no exact duplicate or active implementation found.
The user selected Pull-Request-Implementation and New-pull-request on 2026-08-21.

## Proposed-Change

Make Hub metadata capability-aware while preserving messaging and jobs.
Expose static process-free schema, prompt, summary, and example variants when disabled and full variants when enabled.
Fix Bash launch guidance to require both an active Hub and `launch.enabled`.
Retain the runtime guard for direct calls and calls that reach execution after a setting change.

## Scope-and-Constraints

- Preserve: Hub messaging and jobs, the runtime authorization guard, live setting behavior, and all process operations when enabled.
- Exclude: Removing Hub, removing the guard, restoring standalone launch, redesigning broker or process supervision, and documenting internal schema pruning.
- Cost: Two static schema and metadata variants, live selection, one Bash predicate, one setting-description correction, and focused positive/negative coverage.

## Verification

- Build the real registry with `launch.enabled=false` and require a functional coordination call.
- Require process operations, fields, rendered examples, and Hub/Bash guidance to disappear.
- Toggle the same live setting to `true` and require the complete process surface without rebuilding the tools.
- Call the three distinct Process dispatch routes directly and require the exact disabled-setting `isError:true` result without broker execution.

## Publication-Blockers

- Implementation and focused verification are pending.
- The upstream contribution policy requires a contributor-authored complete-diff review sentence.
- External publication requires approval of the exact current pull request target and draft.

## Pull-Request-Implementation

Branch: `fix/hub-disabled-process-metadata`
Base: `upstream/main@76a294cb1905c1b900eea9f0c83f86b36a03a45c`
Scope: Hide disabled Hub process metadata while preserving coordination, live setting behavior, and the runtime guard.
Commit: Pending.
Push: Pending.
Checks:
- Pending.

## Next-Action

Summary: Implement Hub capability gating
Action: Implement and verify the selected provider-metadata correction on the contribution branch.
Done-When: The focused behavior passes, the contribution diff is reviewed, committed, and pushed, and the exact pull request draft is ready for approval.

## Bug reproduction

Environment: Bun 1.3.14, Ubuntu 24.04.4 LTS x64, current personal checkout, real `createTools` registry, `launch.enabled=false` and `true`, and `enableIrc=true`.
Reproduction: Build the real registry with both launch-setting values and inspect Hub and Bash metadata.
Construct `HubTool` with `Settings.isolated({ "launch.enabled": false })` and execute every Process route directly, including named `send` and `wait` calls.
Actual [O]: Disabled and enabled registries both advertise the same Process surface, Bash retains the Hub start instruction when disabled, and every disabled Process route returns `isError:true` with `Process supervision is disabled (launch.enabled=false).`.
Expected: Hub remains available for coordination, but disabled Process metadata and guidance are absent while direct Process calls retain the guard error.

## Publication-Draft

Title: `fix(coding-agent): hide disabled Hub process operations`
Target: New pull request to `can1357/oh-my-pi:main` from `MikeeI:fix/hub-disabled-process-metadata`.

```markdown
## What

Hide Hub process operations from model-facing metadata when `launch.enabled=false`.
Peer messaging and background-job control remain available through Hub.
The full process surface returns immediately when process supervision is enabled.

## Why

Hub currently keeps process operations, fields, guidance, and examples visible after process supervision is disabled.
Those calls can only reach the existing `Process supervision is disabled` runtime guard.
Bash also continues directing long-running processes to the disabled Hub route.

## Testing

- Pending focused capability tests.
- Pending `bun run --cwd packages/coding-agent check`.
- Pending `bun check`.

[Required before publication: add one sentence written by the contributor, in their own words, confirming review of the complete diff and resulting behavior.]

---

- [ ] `bun check` passes
- [ ] Tested locally
- [x] CHANGELOG updated (if user-facing)

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
```

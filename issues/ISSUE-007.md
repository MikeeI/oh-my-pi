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

Root-Cause [S]: Hub consolidation retained the `launch.enabled` execution guard.
It removed the standalone launch capability gate from Hub registration and model-facing metadata.
With `launch.enabled=false`, Hub remains available for messaging and jobs.
Process operations, fields, examples, summaries, and Bash guidance remain advertised.

## Reach-and-Impact

Reach [S]: Normal sessions can receive process-only operations while Hub process supervision is disabled.
The same session receives process lifecycle guidance.
Impact: Calls cannot bypass the runtime guard, but the model can spend tool or retry turns on guaranteed errors.
Frequency and context-token cost are unmeasured.

## Evidence

- [S] Current upstream retains the reachable `launch.enabled` setting in `settings-schema.ts`.
- [S] `tools/hub/index.ts:73-116` exposes process operations and fields unconditionally in `hubSchema`.
- [S] `prompts/tools/hub.md:1-34` advertises process supervision without a disabled-capability branch.
- [S] `tools/hub/index.ts:154-236` exposes the process-capable summary and examples unconditionally.
- [S] `tools/hub/index.ts:317-328` checks `launch.enabled` only when a process route executes.
- [S] It returns `Process supervision is disabled (launch.enabled=false).` before broker execution.
- [S] `tools/index.ts:631-635` gates Hub on coordination and IRC state, not on `launch.enabled`.
- [S] `tools/bash.ts` owns separate launch guidance, so Hub and Bash capability rendering can diverge.
- [S] Commit `5ff277349cb1b1cda27cf1b3b4d946e160643906` consolidated launch into Hub.
- [S] That commit retained enforcement without retaining the complete capability gate.
- [O] A disabled direct HubTool probe retained the process summary, schema fields, operations, and two examples.
- [O] The probe returned the exact disabled-setting error for every process route.
- [O] Disabled and enabled real `createTools` probes both contained `hub` and `bash`.
- [O] Both probes exposed identical Hub summaries, process operations, fields, and five process examples.
- [O] Disabled Bash still rendered the Hub start instruction for services, watchers, debuggers, and REPLs.
- [O] The same registry exposed no provider-visible `search` or standalone `ssh` tool name.

## Prior-Art

Coverage: Issues, pull requests, Discussions, source history, prompts, and documentation were checked on 2026-08-21.
Gaps: Token impact remains unmeasured.
The contribution makes no quantified impact claim.

- `https://github.com/can1357/oh-my-pi/issues/5399` and `https://github.com/can1357/oh-my-pi/pull/5466` establish related presentation precedent for a different owner.
- `https://github.com/can1357/oh-my-pi/issues/5305` covers related allowlist and registration drift for a different tool.
- `https://github.com/can1357/oh-my-pi/issues/7061` confirms Hub must remain for coordination.
- That issue does not own this `launch.enabled` metadata drift.

Contribution fit: Focused new pull request; no exact duplicate or active implementation found.
The user selected Pull-Request-Implementation and New-pull-request on 2026-08-21.

## Proposed-Change

Make Hub metadata capability-aware while preserving messaging and jobs.
Expose static process-free schema, prompt, summary, and example variants when disabled and full variants when enabled.
Fix Bash launch guidance to require both an active Hub and `launch.enabled`.
Retain the runtime guard for direct calls and calls that reach execution after a setting change.

## Scope-and-Constraints

- Preserve Hub messaging, jobs, the runtime guard, live setting behavior, and all enabled process operations.
- Exclude removing Hub, removing the guard, restoring standalone launch, or redesigning process supervision.
- Exclude documentation of internal schema pruning.
- Cost includes two static metadata variants, live selection, one Bash predicate, and focused coverage.

## Verification

- Build the real registry with `launch.enabled=false` and require a functional coordination call.
- Require process operations, fields, rendered examples, and Hub/Bash guidance to disappear.
- Toggle the same live setting to `true` and require the complete process surface without rebuilding the tools.
- Call all three process dispatch routes directly and require the exact disabled-setting error before broker execution.

## Publication-Blockers

- Upstream policy requires one contributor-authored sentence confirming complete-diff and behavior review.
- External publication requires approval of the exact target and draft after that sentence is added.

## Pull-Request-Implementation

Branch: `fix/hub-disabled-process-metadata`
Base: `upstream/main@76a294cb1905c1b900eea9f0c83f86b36a03a45c`
Scope: Hide disabled Hub process metadata while preserving coordination, live setting behavior, and the runtime guard.
Commit: `d8983d1b82` (`fix(coding-agent): hide disabled Hub process operations`).
Push: `origin/fix/hub-disabled-process-metadata`.
Checks:
- `bun test packages/coding-agent/test/tools/hub-capability.test.ts` passed with 2 tests and 20 assertions.
- `bun --cwd=packages/coding-agent run check` passed.
- Workspace `bun check` passed.
- A manual real-registry scenario preserved coordination, restored the live-enabled surface, and retained the guard.
- The complete six-file contribution diff passed `git diff --check` and manual review.

## Next-Action

Summary: Approve reviewed Hub PR
Action: Add the contributor-authored review sentence, then approve the exact current target and draft.
Done-When: The required sentence exists and the user explicitly approves the exact target and draft.

## Bug reproduction

Environment: Bun 1.3.14 on Ubuntu 24.04.4 LTS x64 with a real `createTools` registry.
The probes used `launch.enabled=false` and `true` with `enableIrc=true`.
Reproduction: Build the real registry with both launch-setting values and inspect Hub and Bash metadata.
Construct a disabled `HubTool` and execute each process route directly, including named `send` and `wait`.
Actual [O]: Both registry variants advertise the same process surface.
Disabled Bash retains the Hub start instruction.
Every disabled process route returns the exact `Process supervision is disabled (launch.enabled=false).` error.
Expected: Hub remains available for coordination while disabled process metadata and guidance are absent.
Direct process calls retain the guard error.

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

- `bun test packages/coding-agent/test/tools/hub-capability.test.ts` passes with 2 tests and 20 assertions.
- `bun --cwd=packages/coding-agent run check` passes.
- `bun check` passes.
- A manual real-registry scenario kept `hub jobs` functional while disabled and hid process metadata.
- The same tools restored process metadata live when enabled and retained the direct-call guard.

[Required before publication: add one contributor-written review sentence.]
[It must confirm review of the complete diff and resulting behavior.]

---

- [x] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated (if user-facing)

### Disclosure

Investigated thoroughly with GPT-5.6, using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence.
It includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
```

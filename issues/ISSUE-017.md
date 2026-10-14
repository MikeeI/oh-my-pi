# ISSUE-017 — Session stats: aggregate messages through four full passes

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: Low
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-08-28
Updated: 2026-08-28
Source: `upstream/main@cc14e04f075de82c5c0c0ccd2f9dfbce6f03fe9e`

## Root-Cause

Root-Cause [S]: `getSessionStats` filters the complete message array three times before a fourth aggregation loop.
All four passes read the same immutable state snapshot and can share one role-directed traversal.
The three filters also allocate temporary arrays solely to read their lengths.

## Reach-and-Impact

Reach [S]: Turn lifecycle accounting, goal runtime, agent-hub projection, `/session`, and RPC stats request totals.
Each call scans every retained message in the active session.
Impact [A]: Long sessions may spend avoidable CPU and temporary allocation on repeated stats requests.
No call-frequency trace or representative benchmark establishes material end-to-end impact.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/cc14e04f075de82c5c0c0ccd2f9dfbce6f03fe9e/packages/coding-agent/src/session/session-stats.ts#L83-L126` performs three role filters and one subsequent aggregation loop.
- [S] `packages/coding-agent/src/session/agent-session.ts#L2785-L2789` reads complete stats at primary turn start.
- [S] `packages/coding-agent/src/session/agent-session.ts#L3017-L3021` reads complete stats again at agent end.
- [S] `packages/coding-agent/src/modes/components/agent-hub-projection.ts#L69-L72` reads stats for agent-hub projection.
- [S] `packages/coding-agent/src/modes/controllers/command-controller.ts#L297-L301` reads stats for the session command.
- [S] `packages/coding-agent/src/rpc/rpc-mode.ts#L1335-L1338` exposes the same aggregation through RPC.

## Prior-Art

Coverage: The complete internal ledger was searched for session stats, message passes, and aggregation ownership on 2026-08-28.
No internal finding owns this root cause.
Gaps: Current upstream issues, pull requests, discussions, history, and performance data remain unchecked.
Contribution fit remains unresolved until representative cost and review value are measured.

## Performance-Evidence

Workload: Not measured.
Baseline: Not measured.
Candidate: Not implemented.
Guard [S]: Existing consumers depend on identical message counts, usage totals, cost, premium requests, and context usage.
Boundary: Source proves redundant traversals and temporary arrays but does not prove meaningful latency or allocation impact.
End-to-end-Measurement: Not measured.

## Proposed-Change

Proposal-Status: Unverified.
[A] Initialize all role counts and usage totals before one traversal of `state.messages`.
[A] Count user and tool-result roles directly and count assistant messages before assistant-specific aggregation.
[A] Preserve task-tool child usage aggregation and assistant messages whose persisted form lacks usage metadata.

## Scope-and-Constraints

- Preserve every `SessionStats` field, task-child usage contribution, and missing-usage behavior.
- Preserve `getContextUsage` ownership and avoid combining unrelated context estimation into this pass.
- Exclude memoization, incremental counters, message-state hooks, and public API changes.
- Cost [A]: One local loop rewrite, behavior-equivalence checks, and a representative microbenchmark.

## Verification

- Benchmark repeated stats calls over a synthetic session with approximately 5,000 mixed messages.
- Compare wall time and allocations across repeated baseline and candidate runs.
- Require exact equality for message counts, tool calls, token categories, cost, premium requests, and context usage.
- Preserve persisted assistant messages without usage and task-tool child usage.
- Run the focused session-stats tests and package typecheck after implementation.

## Publication-Blockers

- Representative runtime and allocation measurements do not exist.
- Current call frequency in long real sessions is unmeasured.
- Current upstream prior art and source history remain unchecked.
- Authorized work and Publication target remain intentionally unselected.

## Next-Action

Summary: Benchmark session stats scans
Action: Measure repeated stats aggregation over approximately 5,000 mixed messages with allocation evidence.
Done-When: Baseline evidence establishes cost, variance, call frequency, and whether a one-pass change is worthwhile.

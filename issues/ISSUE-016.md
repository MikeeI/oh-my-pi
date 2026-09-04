# ISSUE-016 — RPC wait: every event wake rescans the complete turn history

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-08-28
Updated: 2026-08-28
Source: `upstream/main@cc14e04f075de82c5c0c0ccd2f9dfbce6f03fe9e`

## Root-Cause

Root-Cause [S]: `_wait_for_agent_end` snapshots and scans all retained turn events after every condition wake.
`_append_event` wakes the waiter after every appended event, so a long turn repeats growing tuple copies and scans.
The client already tracks scheduled and completed agent-run generations independently of event-history materialization.

## Reach-and-Impact

Reach [S]: `prompt_and_wait`, `wait_for_idle`, and `collect_events` all enter `_wait_for_agent_end`.
The repeated work occurs for every event appended during each synchronous wait lifecycle.
Impact [A]: CPU time and transient allocations may grow cumulatively with the square of events in a long run.
No representative benchmark establishes material wall-clock or CPU impact.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/cc14e04f075de82c5c0c0ccd2f9dfbce6f03fe9e/python/omp-rpc/src/omp_rpc/client.py#L1326-L1371` snapshots from `start_index` and scans for terminal `agent_end` before every wait.
- [S] `https://github.com/can1357/oh-my-pi/blob/cc14e04f075de82c5c0c0ccd2f9dfbce6f03fe9e/python/omp-rpc/src/omp_rpc/client.py#L2094-L2097` notifies every waiter after each event append.
- [S] `https://github.com/can1357/oh-my-pi/blob/cc14e04f075de82c5c0c0ccd2f9dfbce6f03fe9e/python/omp-rpc/src/omp_rpc/client.py#L1242-L1254` already owns scheduled and completed run counters under the same condition.
- [S] `https://github.com/can1357/oh-my-pi/blob/cc14e04f075de82c5c0c0ccd2f9dfbce6f03fe9e/python/omp-rpc/src/omp_rpc/client.py#L1190-L1228` routes all three synchronous public workflows through the waiter.

## Prior-Art

Coverage: The complete internal ledger was searched for RPC waits, terminal events, event rescans, and event history on 2026-08-28.
No internal finding owns this root cause.
Gaps: Current upstream issues, pull requests, discussions, history, and performance data remain unchecked.
Contribution fit remains unresolved until the cost and smallest completion-generation change are verified.

## Performance-Evidence

Workload: Not measured.
Baseline: Not measured.
Candidate: Not implemented.
Guard [S]: Public waiters currently return one retained event snapshot after terminal completion or surface existing failures.
Boundary: Source proves repeated growing copies and scans but does not prove material end-to-end impact.
End-to-end-Measurement: Not measured.

## Proposed-Change

Proposal-Status: Unverified.
[A] Capture the scheduled run's completion generation before the asynchronous command can finish.
[A] Check closed state, bounded-history offsets, asynchronous errors, and completion generation in O(1) after each wake.
[A] Materialize and parse the retained event snapshot once after the target generation completes.
[A] Reuse the existing scheduled and completed counters instead of adding a parallel terminal Boolean.

## Scope-and-Constraints

- Preserve timeouts, process-exit errors, asynchronous command errors, and history-overflow errors.
- Preserve terminal versus non-terminal `agent_end` semantics and compact terminal-message reconstruction.
- Preserve prompt lifecycle serialization and every public return type.
- Exclude protocol changes, event-history redesign, listener dispatch changes, and generic condition abstractions.
- Cost [A]: Completion-target propagation, focused concurrency coverage, and a reproducible local benchmark.

## API-and-Compatibility

Callers [S]: `prompt_and_wait`, `wait_for_idle`, and `collect_events` consume the private waiter.
Contract [S]: Each caller observes the same retained events or the same lifecycle error boundary.
Compatibility: Public signatures, returned `PromptTurn`, event ordering, timeouts, and bounded-history behavior remain unchanged.
Migration: None.

## Verification

- Benchmark a fixed long run with at least 10,000 events across repeated baseline and candidate runs.
- Verify the candidate materializes event history once while retaining identical returned events and messages.
- Verify a non-terminal `agent_end` does not complete the target run.
- Verify timeout, process exit, asynchronous error, malformed terminal event, and history overflow remain observable.
- Run the focused Python client tests after implementation.

## Publication-Blockers

- A representative baseline and candidate benchmark do not exist.
- The completion-target propagation and early-completion race have not been implemented or tested.
- Current upstream prior art and source history remain unchecked.
- Authorized work and Publication target remain intentionally unselected.

## Next-Action

Summary: Benchmark RPC completion wait
Action: Measure a fixed 10,000-event wait workload and record repeated CPU and wall-clock results.
Done-When: Baseline evidence establishes scaling, variance, and the exact correctness guard for a candidate.

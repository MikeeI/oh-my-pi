# ISSUE-025 — Task lifecycle: finished subagents stay fully live with only a time bound

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: High
Root-Cause-Confidence: Medium
Finding-Category: Performance
Created: 2026-10-19
Updated: 2026-10-19
Source: `upstream/main@61bc6d217efcfd6b4dd05717c20ecb3ad9fd3303`

## Root-Cause

Root-Cause [S]: Idle-Child retention is bounded only by `task.agentIdleTtlMs` (default 420000 ms), not by count or memory.
Each finished Child keeps its complete `AgentSession` live until its own timer parks it.
A burst of finished Children therefore keeps every Child from the last 7 minutes in memory at once.
Messaging a parked Child revives it from its full transcript and re-arms the same TTL.

## Reach-and-Impact

Reach [S]: Every Task, Eval `agent()`, and workpool Child that finalizes as `idle` passes through this adoption path.
Reach [S]: Upstream `ae29413e87` also makes killed and interrupted Children reopenable, widening revival paths.
Impact [O]: 80 small fake Children added about 285 MB RSS and 99 MB JS heap while live.
Impact [O]: After parking, the heap returned near the baseline, but RSS stayed about 90 MB higher.
Impact [A]: The real 3.9 GB session (5.7 GB peak, 167 Children) owes much of its peak to live Children.
That attribution is inferred from transcripts; no heap snapshot of that process exists.
Boundary: Retained Main tool results and the TUI observer registry are separate retention causes, not this finding.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/61bc6d217efcfd6b4dd05717c20ecb3ad9fd3303/packages/coding-agent/src/task/settings.ts#L383-L394` — default 420000 ms; `0` keeps idle Children live until exit.
- [S] `https://github.com/can1357/oh-my-pi/blob/61bc6d217efcfd6b4dd05717c20ecb3ad9fd3303/packages/coding-agent/src/registry/agent-lifecycle.ts#L157-L165` — `#adopted`, `#parks`, and `#revivals` are unbounded maps.
- [S] `https://github.com/can1357/oh-my-pi/blob/61bc6d217efcfd6b4dd05717c20ecb3ad9fd3303/packages/coding-agent/src/registry/agent-lifecycle.ts#L666-L673` — `#armTimer` is the only park trigger; no count or LRU eviction exists.
- [S] `https://github.com/can1357/oh-my-pi/blob/61bc6d217efcfd6b4dd05717c20ecb3ad9fd3303/packages/coding-agent/src/registry/agent-lifecycle.ts#L379-L419` — `ensureLive` revives parked and killed refs, then re-arms the timer.
- [S] `https://github.com/can1357/oh-my-pi/blob/61bc6d217efcfd6b4dd05717c20ecb3ad9fd3303/packages/coding-agent/src/task/executor.ts#L3510-L3620` — `finalizeSubagentLifecycle` adopts each finished Child with the TTL.
- [S] `https://github.com/can1357/oh-my-pi/blob/61bc6d217efcfd6b4dd05717c20ecb3ad9fd3303/packages/coding-agent/src/task/executor.ts#L4162` reads the TTL per Task run.
- [O] [measurements.md](evidence/issue-025/measurements.md) records the burst, TTL-30s, and control runs; momp 18.12.2-mikeei-1, Bun 1.4.3, Linux.
- [O] Default TTL: RSS 338 → 623 MB and heap 66 → 165 MB with 80 live Children; 474 MB and 72 MB after parking.
- [O] TTL 30000: heap 143 → 97 MB within 45 s after 80 Children; RSS 642 → 531 MB.
- [O] Controls: 450 tmux resizes and 200 ordinary turns did not reproduce burst-scale growth.

## Performance-Evidence

Workload: Source CLI, fake OpenAI-compatible provider, 20 bursts of 4 small Task Children (80 total).
Baseline [O]: Default TTL; one sample per point; RSS +285 MB live, +136 MB after parking; heap +99 MB live.
Candidate [O]: `task.agentIdleTtlMs: 30000`; one sample per point; heap fell 46 MB within 45 s of the burst.
Guard: Not measured; follow-up revive correctness under a short TTL was not exercised.
Boundary: Single runs without variance; small Children; real-size Child cost and allocator retention are unmeasured.
End-to-end-Measurement: Measured

## Prior-Art

Coverage: upstream issues and PRs searched for subagent memory, `agentIdleTtlMs`, RSS, parked and idle agents; checked=2026-10-19.
Gaps: Discussions, Discord, and maintainer intent for the 7-minute default remain unchecked.

- `https://github.com/can1357/oh-my-pi/pull/14037` — Related, open; lowers the default TTL to 5 s, same retention cause.
- `https://github.com/can1357/oh-my-pi/issues/12961` — Related, open; 24.7 GB overnight RSS with many concurrent processes.
- `https://github.com/can1357/oh-my-pi/issues/10815` — Related, open (`wontfix`); RSS tracks the high-water mark.
- `https://github.com/can1357/oh-my-pi/issues/11214` — Related, open; default TTL removes helpers from the live roster.
- `https://github.com/can1357/oh-my-pi/issues/15523` — Distinct; revive re-renders the prompt and breaks cache reuse.
- `https://github.com/can1357/oh-my-pi/pull/13624` — Fixed, merged; parked sessions no longer held by the reviver.

Contribution fit: PR #14037 owns the default-TTL change; new evidence could advance it as a comment.
A count cap or LRU on live idle Children is a distinct behavior change that needs maintainer discussion first.

## Proposed-Change

Proposal-Status: Unverified.
[A] Support PR #14037 with the 18.12.2 burst evidence instead of opening a duplicate TTL change.
[A] Separately, bound live idle Children by count and park the least recently used first, keeping the TTL.
[A] Local mitigation without a fork delta: set a short `task.agentIdleTtlMs` in managed `config.yml`.

## Scope-and-Constraints

- Preserve: `history://` and `agent://` reads, automatic revival on message, and kill and release semantics.
- Preserve: in-flight Children are never parked; only `idle` adopted Children are eligible.
- Exclude: tool-result retention, observer-registry retention, prompt sharing, and allocator tuning.
- Exclude: any MOMP fork delta; the mitigation is configuration.
- Cost: Shorter retention causes more cold revives, each replaying a transcript and missing the prompt cache (#15523).

## Verification

- Repeat the 80-Child burst at least three times per TTL to establish variance → bounded live Children and heap.
- Measure one representative Child with a 1–4 MB transcript live versus parked → per-Child live cost.
- Message a parked Child after a short TTL → revival returns the correct transcript and a response.

## Publication-Blockers

- Single-run measurements without variance.
- Real-size per-Child cost is extrapolated, not measured.
- Authorized-Work and Publication-Target remain unselected.

## Next-Action

Summary: Measure representative live Child cost
Action: Measure heap and RSS for one 1–4 MB-transcript Child live and parked on current upstream.
Done-When: Repeated samples give per-Child live and parked cost with variance.

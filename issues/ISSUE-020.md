# ISSUE-020 — Read: internal-first mixed batches do not split

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/10578
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-09-02
Updated: 2026-09-05
Source: `upstream/main@39cf639c7bb6b5014a1cc8ea8175558cccb23905`

## Root-Cause

Root-Cause [S]: Read accepts semicolon-delimited scalar targets.
Internal-first batches split only when every part is an internal URI.
A mixed internal and local batch therefore depends on target order even though each target is independently readable.
The model-visible prompt only recommends parallel reads and does not expose the established single-call grammar.

## Reach-and-Impact

Reach [S]: Every Main session using Read receives the generic guidance and scalar `path` schema.
Impact [O]: One five-file batch returned all 3,422 selected Read tokens in 22 ms through one tool call.
The following continuation processed 212,450 tokens, including 207,616 cached tokens, at a $0.1139344 API price proxy.
Impact [A]: Four extra cache replays would add at least $0.3321856 under the same prefix assumption.
Five serial Reads are estimated at $0.46–$0.49 versus $0.1139 for the measured batch.
Dollar values represent provider-work and quota proxies because ChatGPT Pro covers the actual usage.

## Evidence

- [S] `packages/coding-agent/src/prompts/tools/read.md` only says to parallelize independent reads.
- [S] `path-utils.ts#splitDelimitedPathEntry` requires every split part to satisfy the internal-URL predicate.
- [S] `read.ts#tryReadDelimitedPaths` combines split results while preserving scalar Read behavior.
- [O] `TEMP-CACHE-READ-COSTS.md` records the five-file measurement, calculation, and boundaries.
- [O] The upstream Read regression suite exposed an exact MCP resource whose literal semicolon must retain scalar ownership.
- [S] https://github.com/can1357/oh-my-pi/pull/10465 is the withdrawn broad scalar-batching attempt.
- [S] https://github.com/can1357/oh-my-pi/pull/7000 is an open native-array proposal with a substantially larger API and consumer closure.

## Prior-Art

Coverage: Current upstream source, Read batching PRs in all states, the archived record, and source history.
Checked: 2026-09-02.
Gaps: None.

- https://github.com/can1357/oh-my-pi/pull/10465 — Related; its broader scalar expansion was withdrawn.
- https://github.com/can1357/oh-my-pi/pull/7000 — Related; it changes the public API and 27 consumer files.

Contribution fit: Preserve the scalar API and serial execution while fixing mixed-target order dependence.
It can also expose the already-supported grammar without reviving the withdrawn implementation closure.

## Proposed-Change

Require one semicolon-delimited Read call for bounded known local paths and internal URIs.
Keep independent HTTP(S) URLs as separate sibling calls in the same assistant turn.
Use an explicit internal-semicolon mode so both mixed target orders share existing execution.
Preserve `%3B` for authored internal URI data and exact advertised MCP resource spellings.

## Scope-and-Constraints

- Preserve: Scalar `path`, selectors, result order, per-target handling, partial errors, and serial internal execution.
- Preserve: HTTP(S), SQLite, archive, conflict, literal-path, and existing delimiter-recovery ownership.
- Exclude: Native arrays, concurrency changes, renderer redesign, token-total behavior, and raw Read semantics.
- Cost: Current Read splitter, dispatcher, MCP catalog, prompt, changelog, and focused regression owners.

## Verification

- Mixed internal and local targets passed in both orders.
- An encoded internal URI semicolon remained one target.
- An exact MCP resource retained its literal semicolon and scalar ownership.
- The final ten-file Read suite passed 221 tests with 728 assertions.
- The rendered Read prompt preserved every scheduling and delimiter rule.
- The complete workspace check passed.
- `git diff --check` passed.
- Current-head CI run `33664445011` passed all applicable jobs.
- Current-head OMP Nix run `33664445012` passed.
- Every concrete automated correctness finding through the prior reviewed commit was addressed.
- The remaining uncapped mandatory-batch concern is a maintainer policy decision constrained by the approved prompt wording.

## Publication-Blockers

- None.

## Pull-Request-Implementation

Branch: `fix/read-batch-roundtrips`
Base: `upstream/main@39cf639c7bb6b5014a1cc8ea8175558cccb23905`
Scope: Expose existing scalar batching and make mixed internal and local targets order-independent.
Commit: `609dbf39677eea97cf4503bb9bb3f4491b6da4c3`
Push: `MikeeI/fix/read-batch-roundtrips`
Checks:

- Focused ten-file Read suite → 221 passed with 728 assertions.
- `bun check` → passed.
- `git diff --check` → passed.
- Upstream CI run `33664445011` → passed.
- Upstream OMP Nix run `33664445012` → passed.

## Publication-Draft

Title:

```text
perf(read): batch known targets to cut round trips
```

Body:

```markdown
## What

- Require one semicolon-delimited Read call for bounded known local paths and internal resources.
- Make mixed internal and local batches work in either target order through the existing scalar batch owner.
- Keep HTTP(S) URLs separate and preserve ambiguous literal semicolons as target data.
- Preserve exact MCP resource URIs containing literal semicolons.

## Why

Local file access is cheap, but every additional Read decision can trigger another expensive Main continuation.
The current prompt only recommends parallel reads and does not expose the existing single-call grammar.

### Measured impact

- One observed five-file Read returned 3,422 selected tokens in 22 ms.
- Its following Main continuation processed 212,450 tokens, including 207,616 cached tokens.
- That continuation carried a $0.1139344 API price proxy; ChatGPT Pro covered the actual usage.
- Four serial cache replays would add at least $0.3321856 under the same fixed-prefix assumption.
- The estimated five-Read proxy is $0.46–$0.49 versus $0.1139 batched, saving about $0.35–$0.38.

The serial figures are a conservative counterfactual, not an observed control run.
Batching preserves the same selected file content; it removes four intermediate model decisions.

## Scope

This preserves the scalar `path` API and existing serial target execution.
It does not add native arrays, internal concurrency, renderer changes, or structured-selector heuristics.
PR #10465 attempted that broader scalar expansion and was withdrawn.
PR #7000 proposes a substantially larger native-array API and consumer closure.

## Testing

- Focused Read suite: 172 tests passed with 605 assertions.
- Final mixed-batch and MCP regression rerun: 30 tests passed with 72 assertions.
- Coding-agent and complete workspace checks passed.
- Rendered Read prompt and final diff inspected.

---

- [x] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated
```

## Reassessment

- [O] MOMP 18.1.10 combined three skill Reads and elided 213 middle lines above the configured result limit.
- [O] Three separate same-turn Reads returned all 111, 246, and 225 lines without recovery reads.
- [S] `packages/agent/src/agent-loop.ts#executeToolCalls` already runs independent sibling tool calls concurrently.
- [S] Existing performance evidence compares semicolon batching with serial Main turns.
- [S] Existing performance evidence does not compare batching with native same-turn sibling calls.
- [S] `upstream/main@e3106be68f778635da3a17106835ce2e0e6992af` already recommends parallel independent Reads.
- [S] The submitted implementation is no longer the recommended MOMP scheduling strategy.

## Next-Action

Summary: Reassess Read PR direction
Action: Decide whether PR #10578 should remain open, be revised, or be withdrawn.
Done-When: The selected disposition and its evidence are recorded.

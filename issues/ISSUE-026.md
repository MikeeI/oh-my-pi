# ISSUE-026 — Output notices: middle-elided sink output names the wrong shown line ranges

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-10-20
Updated: 2026-10-20
Source: `upstream/main@53a0377db6845e0dae606146130766ec92d407fd`

## Root-Cause

Root-Cause [S]: `OutputMetaBuilder.truncationFromSummary` splits the kept sink lines evenly between head and tail.
The sink fills its head by a byte budget and its tail by the remaining budget, so the two windows rarely hold equal line counts.
`OutputSummary` carries no head or tail line counts, so the mapper cannot know the real split.
Both windows can also cut inside a line, which the even split ignores.

## Reach-and-Impact

Reach [S]: Every head-retaining `OutputSink` that elides its middle, including bash output, maps through this path.
Impact [O]: On v18.12.3, 200 rows with a 64-byte head and 128-byte budget report `Showing lines 1-10 and 192-201`.
The output actually shows rows 1–10 plus part of row 11, then rows 193–200.
Impact [A]: A model that trusts the notice reads the wrong artifact lines when it tries to recover the elided middle.
Boundary: Upstream links only the whole artifact, so no upstream selector points at wrong lines; the notice itself misleads.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/53a0377db6845e0dae606146130766ec92d407fd/packages/coding-agent/src/tools/output-meta.ts#L213-L233` — `keptLines` split by `Math.ceil(keptLines / 2)`.
- [S] `https://github.com/can1357/oh-my-pi/blob/53a0377db6845e0dae606146130766ec92d407fd/packages/tui/src/tools/streaming-output.ts#L1554-L1599` — `#composeBody` knows exact head and tail line counts but does not return them.
- [O] Throwaway probe on a clean v18.12.3 worktree, Bun 1.4.3, Linux; notice and shown rows as quoted under Reach-and-Impact.
- [O] MOMP fixed the same root cause in `c440b69a47` because its exact recovery selector inherited the wrong ranges.

## Prior-Art

Coverage: upstream issues and PRs searched for middle-elision ranges and sink head/tail line counts; checked=2026-10-20.
Gaps: Discussions and Discord remain unchecked.

- `https://github.com/can1357/oh-my-pi/issues/16277` — Distinct, closed; removed Read page middle elision, not sink ranges.
- `https://github.com/can1357/oh-my-pi/issues/10774` — Distinct, open; Read artifact partial-line marking.

Contribution fit: A bounded upstream PR could return exact counts from the sink and map them without the even split.

## Proposed-Change

Proposal-Status: Verified locally in MOMP.
[O] Return exact head and tail line counts from `OutputSink.dump()` and map them directly in `truncationFromSummary`.
[A] Upstream needs only the count fix; the MOMP elided-range selector is a separate fork contract.

## Scope-and-Constraints

- Preserve: the elision marker, byte budgets, and artifact contents.
- Preserve: substituted inline chunks must not claim artifact line coordinates.
- Exclude: the MOMP recovery selector from `MOMP-READ-ARTIFACT-RECOVERY`.

## Verification

- Reproduce the probe on current upstream → the notice disagrees with the shown rows.
- Apply the count fix → the notice matches the shown rows, including a partly shown boundary line.

## Publication-Blockers

- No upstream branch or test exists yet.
- Authorized-Work and Publication-Target remain unselected.

## Next-Action

Summary: Draft upstream sink count fix
Action: Prepare a clean `upstream/main` branch that returns exact sink head and tail line counts.
Done-When: A focused upstream test shows notices matching the shown rows.

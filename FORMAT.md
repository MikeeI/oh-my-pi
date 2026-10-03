# Issue, Comment, and Pull Request Format

## Authority

`AGENTS.md` owns project identity, fork intent, branch roles, repository rules, and approval scope.
`ISSUES.md` owns `Next finding ID` and provides the compact overview of every finding.
Each `issues/ISSUE-NNN.md` is authoritative for that finding's complete current state and evidence.
`skill-fork-contribution-tracking` owns the workflow connecting these files and upstream contribution work.
`skill-maintainer-communication` owns external research quality, tone, disclosure, and publication checks.
`skill-semantic-compression-3-0` owns meaning-preserving compression of tracking content.
Current upstream contribution guides, forms, and templates override the generic external shapes below.

- Investigate before drafting or implementing.
- Let the user choose `Authorized-Work`.
- `Research-and-Reporting` permits issues and comments but no source implementation.
- `Pull-Request-Implementation` authorizes only the implementation scope recorded for the finding.
- Apply the contribution decision tree below; never treat its order as publication authorization.
- Show the exact current publication draft and target before publication.
- Publish externally only after the user approves that exact draft and target.
- Verify source claims against the current canonical upstream branch.
- Keep fork-only tracking content out of upstream contribution diffs.

## Claim basis

Use claim-basis labels at the claim they qualify:

- `[O]` Observed: reproduced behavior with command, version, environment, and result.
- `[S]` Source-proven: current control flow, API ownership, or deterministic data flow proves the claim.
- `[A]` Assumed: an unverified premise is required by the claim.

These labels are evidence origins, not an ordered confidence scale.
Never use one entry-wide label to upgrade weaker claims.
Never convert `[S]` behavior into `[O]` impact.
Preserve exact paths, URLs, IDs, hashes, revisions, commands, outputs, versions, dates, and external drafts.

## Finding IDs and duplicate prevention

- IDs use `ISSUE-NNN`, start at `ISSUE-001`, have at least three digits, and remain permanent.
- `Next finding ID: ISSUE-NNN` in `ISSUES.md` is the only allocator.
- Re-read the complete current `ISSUES.md` immediately before allocating.
- Search IDs, titles, symptoms, root causes, symbols, external references, and proposed owners across `issues/`.
- Read every plausible matching issue record completely.
- Update the existing record when it already owns the root cause.
- Allocate the current ID, create its issue file, add its index row, and increment the allocator in one change.
- Never reuse, renumber, or create subsystem-, status-, session-, or contribution-specific sequences.
- External numbers and URLs belong in `External-Reference`; they never replace the internal ID.

Issue headings and filenames use:

```text
issues/ISSUE-NNN.md
# ISSUE-NNN — <area>: <specific problem>
```

## `ISSUES.md` projection

`ISSUES.md` provides overview, not the complete research record.
Open rows project ID, title, State, Authorized-Work, Publication-Target, Contribution-Priority.
They also project `Next-Action/Summary` and External-Reference.
Archived rows project ID, title, Authorized-Work, Publication-Target, and Contribution-Priority.
They also project Archive-Reason and External-Reference.

The issue file is authoritative when a row disagrees with it.
Correct both in the same task; never leave a known projection mismatch.
Move archived findings to the archived table without changing their ID or file.

## Issue record contract

Every issue file contains these fields in this order:

```text
State: Investigating | Draft-Ready | Implementing | PR-Ready | Submitted | Archived
Authorized-Work: Research-and-Reporting | Pull-Request-Implementation | Not-Selected
Publication-Target: New-issue | Existing-issue-comment | New-pull-request | Existing-pull-request-comment | Not-Selected
External-Reference: <exact external URL or identifier | Not published.>
Contribution-Priority: High | Medium | Low
Root-Cause-Confidence: High | Medium | Low
Finding-Category: Correctness | Reliability | Performance | Maintainability | API | UI | Build | Test | Other
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Source: `upstream/<branch>@<commit>`
```

Every issue file contains these sections:

- `Root-Cause`: one cause and the behavior it owns.
- `Reach-and-Impact`: affected callers, users, states, frequency, and honest impact boundary.
- `Evidence`: exact source, reproduction, history, command, result, contract, or external evidence.
- `Prior-Art`: search coverage, relevant candidates, classifications, gaps, and target fit.
- `Proposed-Change`: smallest complete correction or ownership change.
- `Scope-and-Constraints`: preserved behavior, excluded scope, compatibility, and adoption cost.
- `Verification`: narrowest checks that prove the proposed or implemented contract.
- `Publication-Blockers`: unresolved publication evidence, or `None.`.
- `Next-Action`: one bounded action and one observable completion condition.

Use conditional sections only when applicable:

- `Bug-Reproduction` for an observed user-visible bug.
- `Performance-Evidence` for latency, throughput, allocation, I/O, or resource claims.
- `Shared-Change-Pressure` for duplication or ownership findings.
- `API-and-Compatibility` for public, persisted, protocol, or migration boundaries.
- `Pull-Request-Implementation` while authorized implementation exists.
- `Publication-Draft` when an exact external issue, comment, or pull request draft exists.
- `Submitted-Text` when submitted text differs from the approved publication draft.
- `Archive` only when State is Archived.

## Lifecycle states

### Investigating

Use Investigating while required publication evidence, Authorized-Work, Publication-Target, or direction is unresolved.
`Publication-Blockers` names every unresolved prerequisite.
`Next-Action` names the single bounded action that advances it.

### Draft-Ready

Use Draft-Ready only after research, Authorized-Work, Publication-Target, and the exact Publication-Draft are complete.
Draft-Ready does not authorize publication.
Research-and-Reporting normally moves from Draft-Ready to Submitted after approved publication.
Pull-Request-Implementation normally moves from Draft-Ready to Implementing.

### Implementing

Use Implementing only for user-authorized Pull-Request-Implementation while the bounded source change is in progress.
Record branch, base revision, scope, commit state, push state, and focused checks under Pull-Request-Implementation.

### PR-Ready

Use PR-Ready when the source change is complete, verified, committed, pushed, and ready for an upstream pull request.
The exact Publication-Draft and New-pull-request target must already exist.
PR-Ready does not authorize publication.

### Submitted

Use Submitted only after an observable external issue, comment, or pull request exists.
Record its exact URL in External-Reference immediately.
Preserve the exact Submitted-Text when it differs from the approved Publication-Draft.

### Archived

Use Archived only when no current action remains and a recorded Archive-Reason exists.
Archive may represent success, an external outcome, an invalidated finding, or a decision not to pursue the work.
Preserve the ID, history, exact External-Reference, Submitted-Text, and archive evidence.

## Required research

Before drafting or implementing:

1. Read `AGENTS.md`, `FORMAT.md`, the complete current `ISSUES.md`, and the selected issue record.
2. Confirm that no issue record owns the same observable problem or root cause.
3. Apply the complete current research contract from `skill-maintainer-communication`.
4. Record canonical upstream revision, search coverage, gaps, material candidates, classification, and target fit.
5. Verify source claims against canonical upstream, not only a personal or contribution branch.
6. Reproduce user-visible bugs before claiming `[O]` behavior.
7. Measure representative workloads before claiming meaningful performance value.
8. Inspect callers, compatibility, persistence, lifecycle, failure modes, and verification seams.
9. Label every material claim `[O]`, `[S]`, or `[A]` at its point of use.
10. Apply the contribution decision tree within the user's selected Authorized-Work.

A search result is only a candidate target.
A matching symbol, subsystem, or symptom does not establish common ownership.
Sibling-project behavior is a research lead and never proves target-project behavior.
Unread or unavailable plausible prior art keeps the finding Investigating.

## Finding quality gates

A finding survives only when all applicable gates pass:

- Current pain, risk, inconsistency, or repeated maintenance pressure is evidence-backed.
- One coherent root cause explains the reported behavior.
- Affected callers, users, states, or workflows are bounded and reachable.
- Existing capability does not already solve the problem.
- The proposed direction is smaller than the work, risk, or ambiguity it removes.
- Compatibility, migration, persistence, lifecycle, and verification costs are explicit.
- One focused observable check can verify the proposed contract.
- Source evidence is not inflated into observed user harm.

Reject findings based only on aesthetics, names, comments, TODOs, clone output, or generic best practice.
Reject broad cleanup, architecture campaigns, unmeasured performance claims, and speculative future use.
Use one issue record per independent root cause.

## Conditional evidence

### Bug reproduction

Observed bug claims require:

```text
Environment: <version, platform, deployment, relevant configuration>
Reproduction: <minimal deterministic steps>
Actual [O]: <observed result>
Expected: <contract-backed expected result>
```

Do not use a bug form for source-only maintainability concerns without reproduced behavior.

### Performance-Evidence

Meaningful performance claims require:

```text
Workload: <representative input and environment>
Baseline [O]: <command, measurements, and variance>
Candidate [O]: <command, measurements, and variance>
Guard [O]: <correctness-equivalence result>
Boundary: <end-to-end impact and what remains unmeasured>
End-to-end-Measurement: Measured | Not measured | Not applicable
```

No representative measurement means no meaningful performance claim.

### Shared-Change-Pressure

Duplication or ownership findings require:

```text
Copies [S]: <count and exact live owners>
Drift-Evidence: <[O] observed divergence | [S] source-proven divergence | None found.>
Owner: <smallest coherent proposed owner>
Cost: <coupling and abstraction boundary>
```

Clone detectors, AST matches, text similarity, and shared names produce candidates only.
Framework wiring, DTO mirrors, provider boundaries, fixtures, migrations, generated code, and idioms are not findings by default.
Consolidation must be simpler than synchronized explicit code.

### API-and-Compatibility

Public, persisted, protocol, or migration changes require:

```text
Callers [S]: <affected consumers>
Contract [S|O]: <current invariant>
Compatibility: <behavior that must remain>
Migration: <required action or None.>
```

## Contribution-Decision-and-Publication-Target-Selection

Apply this decision tree:

1. Recommend a focused pull request when its implementation gate passes.
2. Otherwise recommend a comment when an existing thread owns the same problem or root cause.
3. Otherwise recommend a new issue when durable maintainer discussion is useful.
4. Otherwise keep the finding Investigating until the decision is evidence-backed.

The decision recommends a shape; the user still selects Authorized-Work and approves publication.

### Focused pull request

The implementation gate requires:

- Pull-Request-Implementation selected by the user;
- verified root cause, callers, failure modes, compatibility boundary, and bounded fix;
- no active implementation already owning the correction;
- focused checks covering every changed contract; and
- a contribution diff without fork-only tracking content.

A pull request may resolve or materially advance an existing issue without a duplicate issue.

### Existing-Issue-Comment

Comment only when the thread owns the same problem or root cause and new evidence advances diagnosis or resolution.
A useful comment adds a fact, reproduction, source anchor, measurement, verified fix, or necessary scoped question.
Similar symptoms alone do not justify a comment.
Use a distinct record for a distinct root cause.

### Existing-Pull-Request-Comment

Comment only when the current diff changes the exact lifecycle, function, invariant, or owner involved.
Add actionable evidence and state when it does not request scope expansion.
Never redirect an unrelated pull request.

### New-Issue

Open a new issue only when no thread owns the same problem or root cause and durable discussion is useful.
Use one issue per independent root cause.

### Investigating Without Publication

Keep Investigating while currentness, reach, prior art, impact, target, or correction value remains unresolved.
State the exact gap in Publication-Blockers and the next bounded action in Next-Action.

## Next-Action-Contract

Every open record contains one compact projection and one current continuation action:

```text
Summary: <2–6 word action summary>
Action: <single bounded action>
Done-When: <observable evidence that completes it>
```

`ISSUES.md/Next-Action` must equal `Next-Action/Summary` exactly.
Replace Next-Action after completing the action; do not accumulate a task log.
Re-check the source and Publication-Target before relying on a stale action.
Archived records use `Summary: —`, `Action: None.`, and `Done-When: None.`.
## Publication-Draft-Contract

Apply the upstream form or template first and map the generic content below into its fields.
Apply `skill-maintainer-communication` to every external draft.
Keep exact drafts literal; semantic compression applies only to their supporting ledger context.
Any Publication-Draft or Publication-Target change requires showing both again before publication.
### New-Issue

```markdown
## Summary

<One concise paragraph describing one root cause and affected behavior.>

## Evidence

- `<stable source link or path:line>`: <specific evidence>.
- <Reproduction, command result, history, or relevant external link>.

## Impact

<Observed impact or an explicit source-proven or not-measured boundary.>

## Proposed direction

<Smallest complete correction without unrelated cleanup.>

## Risks and boundaries

<Behavior to preserve and material compatibility or adoption constraints.>

## Verification

- <Focused existing test, reproduction, benchmark, or observable check>.

## Question

<One concrete maintainer decision or confirmation request.>

I checked the relevant issues, comments, pull requests, and discussions; this report is not a duplicate.

## Involvement

I am reporting this finding only and am not currently proposing a pull request.
```

### New-Pull-Request

```markdown
## Summary

<Root cause and scoped correction.>

## Evidence

- `<stable source link or path:line>`: <source or reproduced behavior establishing the problem>.
- <Relevant issue, pull request, benchmark, command result, or API contract>.

## Changes

- <Concrete behavior or ownership change>.
- <Important behavior intentionally left unchanged>.

## Risks and boundaries

- <Compatibility, persistence, lifecycle, UI, or provider boundary>.
- <Why this avoids broader cleanup or abstraction>.

## Verification

- `<focused command or scenario>` — <observed result>.

I checked the relevant issues, comments, pull requests, and discussions; this pull request is not a duplicate.
```

### Existing-Issue-Comment

```markdown
Hi, thanks for documenting this.

I noticed one additional detail in the current implementation:

- `<stable source link or path:line>`: <specific evidence>.
- <Observed or source-proven consequence>.

This appears to share the issue's root cause because <precise ownership link>.

Would it make sense to <one scoped question or direction>?

I checked the relevant discussion; this evidence is not already reported.

I am reporting this finding only and am not currently proposing a pull request.
```

### Existing-Pull-Request-Comment

```markdown
Hi, thanks for working on this.

I noticed one edge in the current diff:

- `<stable source link or diff hunk>`: <specific evidence>.
- <Observed or source-proven consequence>.

This does not require expanding the current scope unless it is part of the same invariant.

Would it make sense to <one concrete question>?

I checked the relevant discussion; this evidence is not already reported.
```


## Pull-Request-Implementation-Contract

Pull-Request-Implementation records use:
Branch: <contribution branch>
Base: `upstream/<branch>@<commit>`
Scope: <authorized source change>
Commit: <SHA | Pending.>
Push: <fork branch | Pending.>
Checks:
- `<focused command>` → <observed result>
```

Record durable results, not raw work logs.
Every listed check must prove a changed observable contract.
PR-Ready requires no pending implementation, commit, push, verification, or Publication-Draft item.

## Archive-Contract

Archived records use:

```text
Archive-Reason: Merged | Fixed-Elsewhere | Duplicate | Upstream-Declined | Superseded | Finding-Invalidated | Not-Worth-Pursuing | Withdrawn | Other
Detail: <exact reason when Archive-Reason is Other | None.>
Evidence: <external URL, commit, release, maintainer statement, or internal proof>
Checked: <YYYY-MM-DD>
```

Do not infer an archive outcome from inactivity or branch deletion.
Read the final thread and linked work before archiving an externally submitted contribution.

- Store project-wide facts once in `AGENTS.md`.
- Store workflow definitions once in `FORMAT.md`.
- Store complete finding-specific facts once in its issue record.
- Keep `ISSUES.md` to the allocator and compact projection.
- Use stable labels and ordering; avoid aliases beyond the defined evidence markers.
- Use fragments only when agency, scope, condition, and evidence remain unambiguous.
- Remove raw search output, repeated summaries, activity logs, and duplicated conclusions.
- Preserve exact source anchors, commands, results, URLs, revisions, dates, external forms, drafts, and Submitted-Text.
- Omit inapplicable conditional sections; never omit applicable evidence required by a gate.
- Compression never resolves a contradiction or upgrades evidence.

## Ledger validation

Run the read-only validator bundled with `skill-fork-contribution-tracking` after every ledger mutation.
It checks allocator continuity, unique IDs, index-to-record links, projection equality, and lifecycle-required sections.
It also rejects year-based IDs, stale Next-Action projections, missing submitted URLs, and misplaced archived records.
It never edits files or claims that evidence, prior art, target fit, or publication value is true.

## Publication gate

Before publishing, verify every item:

- The permanent ID and issue file exist.
- `ISSUES.md` matches every projected issue-record field.
- The user selected Authorized-Work.
- Current upstream still contains the relevant behavior.
- Every plausible prior-art candidate was read fully.
- The selected Publication-Target owns the same root cause.
- Claim-basis labels match the actual proof.
- Claims preserve observed, source-proven, assumed, and unmeasured boundaries.
- The Publication-Draft contains one root cause and follows the current upstream form.
- Pull-Request-Implementation is PR-Ready and its diff excludes fork-only tracking files.
- The duplicate-search statement is truthful.
- The user approved the exact current Publication-Draft and Publication-Target.
- External-Reference and State will be updated immediately after publication.

## Prohibited actions

- Never publish without approval of the exact current Publication-Draft and Publication-Target.
- Never choose Authorized-Work for the user.
- Never implement without Pull-Request-Implementation authorization.
- Never publish a pull request before PR-Ready.
- Never treat source text, clone output, a TODO, or a search hit as sufficient evidence.
- Never inflate maintenance risk or source invariants into observed user harm.
- Never split one root cause across multiple IDs.
- Never combine independent root causes in one contribution.
- Never expose internal Contribution-Priority, Root-Cause-Confidence, local paths, or adversarial notes externally.
- Never include `AGENTS.md`, `FORMAT.md`, `ISSUES.md`, or `issues/` in an upstream contribution diff.

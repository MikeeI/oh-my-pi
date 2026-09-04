# ISSUE-006 — Task prompt: same-file edits are not guaranteed to auto-resolve

State: Archived
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/9047
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-08-14
Updated: 2026-08-21
Source: `upstream/main@74bc1f442e7bb6adcb5797ca8802ef6684281411`

## Root-Cause

Root-Cause [S]: `task.md` guarantees that concurrent edits to the same files auto-resolve and forbids shrinking or serializing batches for overlap. No universal merge owner implements that guarantee: default non-isolated Children share one CWD, whole-file `write` is unguarded last-writer-wins, Hashline only remaps provably unchanged anchors, and isolated branch/patch owners explicitly fail real conflicts.

## Reach-and-Impact

Reach [S]: The default isolation mode is `none`; all parallel mutating Child tools can touch shared paths. Opt-in branch and patch isolation also expose explicit conflict failures.
Impact: Existing focused tests reproduce genuine branch and patch conflicts as failed/manual rather than auto-resolved. Shared-CWD whole-file lost update remains source-proven but not observed in a controlled barrier test.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/prompts/tools/task.md#L13-L19` — unconditional auto-resolve guarantee and prohibition on overlap-based serialization.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/config/settings-schema.ts#L4450-L4474` — default isolation is `none`.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/write.ts#L1259-L1313` — whole-file writes have no snapshot or compare-and-swap guard.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/hashline/src/recovery.ts#L1-L8` — Hashline fails closed for changed, deleted, split, or ambiguous targets.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/task/worktree.ts#L859-L930` — branch merge aborts on the first genuine conflict.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/task/isolation-runner.ts#L306-L400` — branch and patch conflicts remain failed/manual.
- [O] `bun test test/task/worktree.test.ts -t "still aborts on genuine cherry-pick conflicts"` → 1 pass, 0 fail; current source/test files are byte-identical to the recorded upstream revision.
- [O] `bun test test/task/isolation-runner.test.ts -t "rejects patch-mode conflicts without dirtying the worktree"` → 1 pass, 0 fail; current source/test files are byte-identical to the recorded upstream revision.
- [S] `https://github.com/can1357/oh-my-pi/commit/e7bb0556a8e82f304b4dfa23eafe0797c273165d` — introduced the guarantee as prompt-only text without Runtime or regression-test closure.
- [O] Contribution commit `57c18c4f9763e66416c5520e0508285330f17d16` renders coordination and integration ownership guidance with no universal same-file merge promise.
## Prior-Art


Coverage: issues(open+closed), PRs(open+closed+merged), Discussions, and source history; checked=2026-08-14.
Gaps: A controlled shared-CWD lost-update trace remains unchecked; the bounded prompt correction relies on source ownership plus observed branch and patch conflicts.

- `https://github.com/can1357/oh-my-pi/issues/2471` — Related earlier design; explicitly requires sibling coordination before overlapping edits.
- `https://github.com/can1357/oh-my-pi/issues/4175` and `https://github.com/can1357/oh-my-pi/pull/4176` — Fixed dirty-index cleanup after conflict, not content auto-resolution.
- `https://github.com/can1357/oh-my-pi/issues/4135`, `https://github.com/can1357/oh-my-pi/issues/4136`, and `https://github.com/can1357/oh-my-pi/issues/4621` — Related concrete merge/isolation conflicts; no universal resolution owner.
- `https://github.com/can1357/oh-my-pi/issues/5387` — Related architecture; confirms non-isolated Children share the Parent CWD without an enforced write boundary, but requests write-root enforcement rather than correcting this prompt guarantee.

Contribution fit: The user selected a focused new pull request; no existing issue, discussion, or active pull request owned the false universal merge guarantee.

## Proposed-Change

Remove the universal guarantee and absolute anti-serialization rule. State the actual policy: parallelize independent ownership; coordinate same-file work through Hub; name one integration owner; serialize only the irreducibly shared mutation boundary. Do not invent a universal merger.

## Scope-and-Constraints

- Preserve: Safe parallel fan-out, Hashline remapping for unchanged anchors, non-conflicting Git merges, explicit isolation artifacts, and coordination advice.
- Exclude: Central file ownership, semantic merge subsystem, write CAS redesign, and backend-specific conflict fixes.
- Cost: Prompt correction plus semantic assertion; optional shared-CWD lost-update regression.

## Verification

- Render TaskTool and require conditional `hub` coordination, one integration owner, and no universal auto-resolve claim.
- Keep the two existing genuine-conflict tests passing.
- Preserve runtime isolation and merge behavior unchanged.

## Publication-Blockers

None.

## Pull-Request-Implementation

Branch: `fix/task-overlap-guidance`
Base: `upstream/main@74bc1f442e7bb6adcb5797ca8802ef6684281411`
Scope: Replace the universal same-file auto-merge claim with ownership-aligned coordination guidance and focused coverage.
Commit: `f3b9b5b7e9e684450b47ca5495cabdf1f03161d8`
Push: `origin/fix/task-overlap-guidance`
Pull request: https://github.com/can1357/oh-my-pi/pull/9047
Current-upstream verification: `git merge-tree --write-tree upstream/main HEAD` returned no conflicts.
Checks:
- `bun test packages/coding-agent/test/task/task-batch.test.ts -t "requires coordination instead of promising same-file auto-resolution"` → 1 pass, 0 fail.
- `bun test packages/coding-agent/test/task/worktree.test.ts -t "still aborts on genuine cherry-pick conflicts"` → 1 pass, 0 fail.
- `bun test packages/coding-agent/test/task/isolation-runner.test.ts -t "rejects patch-mode conflicts without dirtying the worktree"` → 1 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check` → Biome and type checks passed.

## Next-Action

Summary: —
Action: None.
Done-When: None.

## Bug reproduction

Environment: `@oh-my-pi/pi-coding-agent` source 17.3.2 at the recorded revision; Bun 1.3.14; Ubuntu 24.04.4 LTS; x86_64.
Reproduction: Run the two focused existing branch/patch conflict tests listed under Evidence.
Actual [O]: Both tests pass by asserting conflicts are failed, aborted, or left unapplied for manual handling.
Expected: Model-facing guidance must not guarantee automatic resolution for paths whose Runtime owners deliberately expose conflict failure.

## Publication-Draft

Title: `fix(coding-agent): correct task overlap guidance`
Target: New pull request to `can1357/oh-my-pi:main` from `MikeeI:fix/task-overlap-guidance`.

```markdown
## What

Replace Task tool's universal same-file auto-resolution promise with the behavior the runtime can support: parallelize independent ownership, coordinate shared-file work through `hub`, name one integration owner, and serialize only the irreducibly shared mutation boundary.

No isolation, merge, or editor runtime behavior changes.

## Why

The current prompt guarantees that concurrent same-file edits auto-resolve, but non-isolated children share one working directory and branch or patch isolation deliberately surfaces genuine conflicts.

Issue #5387 documents the missing write boundary for non-isolated tasks; issues #4135, #4136, #4175, and #4621 cover related conflict paths. None owns the prompt's universal guarantee.

## Testing

- `bun test packages/coding-agent/test/task/task-batch.test.ts -t "requires coordination instead of promising same-file auto-resolution"` — 1 pass, 0 fail.
- `bun test packages/coding-agent/test/task/worktree.test.ts -t "still aborts on genuine cherry-pick conflicts"` — 1 pass, 0 fail.
- `bun test packages/coding-agent/test/task/isolation-runner.test.ts -t "rejects patch-mode conflicts without dirtying the worktree"` — 1 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check` — Biome and type checks pass.
- `I reviewed the full diff; this change corrects the Task prompt without changing isolation or merge behavior.`

---

- [ ] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated (if user-facing)

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting their time or energy or discouraging their work.

Thank you for your work.
```

## Archive

Archive-Reason: Merged
Detail: None.
Evidence: Pull request #9047 merged as `557c2e75a55194781b989ec2e89cf6acd2000c61` on 2026-08-20.
Checked: 2026-08-21

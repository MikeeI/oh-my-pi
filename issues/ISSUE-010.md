# ISSUE-010 — LSP prompt: raw requests omit multi-server routing guidance

State: Implementing
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-08-15
Updated: 2026-08-21
Source: `upstream/main@ffd53ff92a6f575d499730475a73460dd7cc2eea`

## Root-Cause

Root-Cause [S]: The model-visible LSP prompt explains raw `request` parameters but omits server-selection semantics.
The documented runtime chooses the first configured non-custom server unless `file` identifies a primary server.

## Reach-and-Impact

Reach [S]: The gap affects raw requests in workspaces with multiple configured non-custom language servers.
A concrete `file` selects its primary server even when an explicit `payload` supplies workspace-level parameters.
Impact [O]: In `project-paperless-classifier`, a file-less `workspace/symbol` request reached clangd and returned `[]`.
The same query through the gopls workspace-symbol path returned 28 `ClassificationService` symbols.
Impact: Frequency across agent sessions and providers is unmeasured.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/ffd53ff92a6f575d499730475a73460dd7cc2eea/packages/coding-agent/src/prompts/tools/lsp.md#L3-L12` — raw-request guidance omits server selection.
- [S] `https://github.com/can1357/oh-my-pi/blob/ffd53ff92a6f575d499730475a73460dd7cc2eea/docs/tools/lsp.md#L231-L243` — full documentation defines file-scoped routing and first-server fallback.
- [S] `https://github.com/can1357/oh-my-pi/blob/ffd53ff92a6f575d499730475a73460dd7cc2eea/packages/coding-agent/src/lsp/tool.ts#L849-L900` — `request` selects `all[0]` without a concrete file and uses payload verbatim.
- [O] OMP LSP in `/root/projects/project-paperless-classifier`: `request(query:"workspace/symbol")` without `file` returned `clangd ← workspace/symbol: []`.
- [O] The same workspace exposed gopls and returned 28 matches for `ClassificationService` through `symbols(file:"*")`.

## Prior-Art

Coverage: upstream issues and pull requests in all states, Discussions search, release notes, source history, and current docs; checked 2026-08-15.
Gaps: None.

- `https://github.com/can1357/oh-my-pi/issues/8387` — Related LSP workspace-symbol failure reporting; different action path and root cause.
- `https://github.com/can1357/oh-my-pi/issues/3044` — Fixed server-to-client request handling; unrelated to client-side server selection.
- No issue, pull request, discussion, release note, or active implementation found for the model-visible routing omission.

Contribution fit: The user selected a focused new pull request; runtime behavior remains unchanged.

## Proposed-Change

Extend the static LSP tool prompt at its existing `request` owner.
Tell the model that a concrete `file` selects its server, including for workspace methods with explicit payloads.
Preserve the documented first-server fallback when `file` is omitted or `"*"`.

## Scope-and-Constraints

- Preserve: Tool schema, runtime routing, payload precedence, read/write approval, and single-server behavior.
- Exclude: A `server` parameter, multi-server broadcast, ambiguous-request rejection, and workspace-root changes.
- Cost: One prompt line, an Unreleased changelog entry, focused prompt verification, and package typecheck.

## Verification

- Rendered LSP guidance distinguishes concrete-file routing from omitted-`file` and `"*"` fallback.
- `bun test packages/coding-agent/test/tools/lsp-regressions.test.ts -t "request action"`: 2 passed, 94 filtered.
- `bun test packages/coding-agent/test/tool-guidance-efficiency.test.ts`: 1 passed.
- `bun run --cwd packages/coding-agent check`: passed.
- `bun check`: passed across the workspace TypeScript and Rust checks.
- `git diff --check`: passed; the upstream diff contains only the prompt and changelog files.

## Publication-Blockers

- The upstream pull request template requires a contributor-authored complete-diff review sentence before publication.
- Commit and push remain outside the user-selected local-only preparation scope.

## Pull-Request-Implementation

Branch: `fix/lsp-raw-request-routing-guidance`
Base: `upstream/main@ffd53ff92a6f575d499730475a73460dd7cc2eea`
Scope: Clarify model-visible raw-request server routing without changing runtime behavior.
Commit: Not created.
Push: Not pushed.
Checks: Focused tests, package check, workspace check, rendered-prompt inspection, and diff hygiene passed.

## Next-Action

Summary: Review local LSP prompt PR
Action: Present the exact local diff and pull request draft; await an explicit commit, push, or publication instruction.
Done-When: The user supplies the required human-authored review sentence and explicitly authorizes the next Git action.


## Publication-Draft

Title: `fix(coding-agent): clarify raw LSP request routing`
Target: New pull request to `can1357/oh-my-pi:main` from `MikeeI:fix/lsp-raw-request-routing-guidance`.

```markdown
## What

Clarify how raw LSP requests select a language server.

The model-facing tool guidance now states that a concrete `file` selects its primary server, including for
workspace methods with explicit payloads.
Runtime behavior is unchanged.

## Why

The full LSP documentation defines the routing contract, but the prompt only describes method and payload
construction.
In a workspace with clangd and gopls, a file-less `workspace/symbol` request therefore reached the documented
first server, clangd, and returned an empty result instead of querying gopls.

Issue #8387 concerns failure reporting in the first-class workspace-symbol action, not this model-visible
raw-request routing omission.

## Testing

- `bun test packages/coding-agent/test/tools/lsp-regressions.test.ts -t "request action"` (2 passed)
- `bun test packages/coding-agent/test/tool-guidance-efficiency.test.ts` (1 passed)
- `bun run --cwd packages/coding-agent check`
- `bun check`
- Rendered LSP tool description inspected for the concrete-file routing instruction.

[Required before publication: add one sentence written by the contributor, in their own words, confirming review of the complete diff.]

---

- [x] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated (if user-facing)

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
```

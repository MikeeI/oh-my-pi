# ISSUE-019 — GitHub errors omit structured and request context

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/10581
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@984a4f2dc9e50f6645b8fe04a91570876f8d3c83`

## Root-Cause

Root-Cause [O]: GitHub JSON failures surface `stderr || stdout` instead of combining both diagnostic channels.
Generic non-empty `gh` stderr therefore suppresses structured REST diagnostics emitted on stdout.
Operation owners also pass generic failures through without the request context needed for efficient recovery.

## Reach-and-Impact

Reach [S]: Every GitHub operation using `github.json()` shares the structured-diagnostic failure boundary.
Search operations reach it through `executeSearchIssues`, `executeSearchPrs`, and the other search owners.
File reads additionally lose the requested repository, revision, and path at `executeFileRead`.
Impact [O]: A qualifier-only PR query exposed HTTP 422 without the API explanation required for correction.
The following turn used a broader author search that did not prove the original branch condition.
Impact [O]: 52 GitHub file-read 404s occurred across 38 session files during August and September 2026.

## Evidence

- [S] https://github.com/can1357/oh-my-pi/blob/18781d829586fff77af98b222728b5b29bcaba41/packages/coding-agent/src/utils/github.ts#L59-L73 selects non-empty stderr before stdout.
- [S] https://github.com/can1357/oh-my-pi/blob/18781d829586fff77af98b222728b5b29bcaba41/packages/coding-agent/src/utils/github.ts#L123-L132 maps every nonzero JSON command through that formatter.
- [S] https://github.com/can1357/oh-my-pi/blob/18781d829586fff77af98b222728b5b29bcaba41/packages/coding-agent/src/tools/gh-search.ts#L437-L452 sends PR searches through `github.json()`.
- [O] Session `01a061ad-db7b-736b-a7bf-673a94047c0f` recorded the failed call at `2026-09-02T12:15:48.351Z`.
- [O] GitHub returned `errors[].message` on stdout and only `gh: Validation Failed (HTTP 422)` on stderr.
- [O] A REST 404 returned a top-level `message` on stdout and the same useful summary on stderr.
- [O] A GraphQL validation failure returned `errors[].message` on stdout and the same detailed message on stderr.
- [S] https://github.com/can1357/oh-my-pi/blob/18781d829586fff77af98b222728b5b29bcaba41/packages/coding-agent/src/tools/gh.ts#L259-L295 passes file-read failures through without request context.
- [O] Session `01a06269-fc85-7018-a2ff-646528437524` recorded `openai/codex@main:Cargo.toml` as a generic 404.
- [O] The next file read succeeded at `openai/codex@main:codex-rs/Cargo.toml`.
- [O] A missing-query request returned `{resource:"Search",field:"q",code:"missing"}` without an item message.

## Bug-Reproduction

Environment: MOMP 18.1.2-mikeei-2, GitHub CLI authenticated against github.com, Linux x64.
Reproduction: Run the following read-only request through `gh api` or `github.search_prs`.

```text
repo:codellm-devkit/codeanalyzer-typescript is:pr head:MikeeI:fix/issue-008 OR head:MikeeI:fix/issue-009
```

Actual [O]: The GitHub tool exposed only `gh: Validation Failed (HTTP 422)`.
Expected: The tool also exposes GitHub's explanation that Boolean operators apply to text rather than qualifiers.
Reproduction: Call `github.file_read` for `openai/codex@main:Cargo.toml`.
Actual [O]: The tool exposed only `gh: Not Found (HTTP 404)`.
Expected: The failure also identifies `openai/codex@main:Cargo.toml` without claiming which segment is absent.

## Prior-Art

Coverage: Issues, pull requests, Discussions, source history, release notes, formatter symbols, and error strings were checked on 2026-09-02.
All-state issue searches by symptom and error text found no owner for this GitHub tool boundary.
Exact pull-request and commit searches for `formatGhFailure` found no candidate implementation.
Discussion search returned #5345, which concerns plugin installation and has a distinct root cause.
Current release notes contain no equivalent correction.
Contribution fit: Focused new pull request; no exact duplicate or active implementation was found.
The user selected Pull-Request-Implementation and New-pull-request on 2026-09-02.

## Proposed-Change

Proposal-Status: Implemented, verified, committed, and pushed on a clean upstream contribution branch.
[S] Keep the current authentication, repository-context, timeout, and non-JSON failure mappings.
[A] At the `github.json()` failure boundary, decode structured stdout as untrusted JSON.
[A] Append unique top-level, item-message, or resource-field-code diagnostics not already visible in stderr.
[A] Add repository, revision, and path context at the file-read owner without rewriting GitHub's 404 meaning.
[A] Document the observed Boolean-operator boundary in the GitHub tool prompt.
[A] Fall back byte-for-byte to the existing formatted error when stdout is absent, malformed, or unsupported.

## Scope-and-Constraints

- Preserve every successful JSON response and every existing nonzero-exit fallback.
- Preserve `github.text()` behavior.
- Preserve GitHub's ambiguity between a missing repository, revision, and path.
- Exclude local GitHub query parsing or duplication of GitHub's qualifier grammar.
- Cost [A]: Two bounded error projections, focused regression tests, one prompt rule, and one changelog entry.

## API-and-Compatibility

Callers [S]: GitHub repository, search, pull-request, issue, Actions, and file-read operations consume these boundaries.
Contract [O]: Failed operations surface a `ToolError` that the model uses for recovery.
Compatibility: Existing concise errors remain first and successful return types remain unchanged.
Migration: None.

## Verification

- Focused command-runner and file-read cases passed with 6 tests and 6 assertions.
- `bun --cwd=packages/coding-agent run check` passed.
- A live source-runner reproduction exposed the HTTP 422 summary and GitHub's Boolean-operator explanation.
- The complete five-file contribution diff passed `git diff --check` and manual review.
- Successful JSON responses, `github.text()`, translated authentication failures, and ambiguous 404 meaning remain unchanged.

## Publication-Blockers

- None.

## Pull-Request-Implementation

Branch: `fix/github-actionable-errors`
Base: `upstream/main@984a4f2dc9e50f6645b8fe04a91570876f8d3c83`
Scope: Preserve structured GitHub API diagnostics and add failed file-read context without guessing 404 causes.
Commit: `a05690f503` (`fix(github): preserve actionable API diagnostics`).
Push: `origin/fix/github-actionable-errors`.
Checks:
- `bun test packages/coding-agent/test/tools/gh.test.ts --test-name-pattern 'GitHub command runner|adds repository, revision, and path context'` passed with 6 tests and 6 assertions.
- `bun --cwd=packages/coding-agent run check` passed.
- A live source-runner HTTP 422 reproduction exposed the generic summary and the structured Boolean-operator explanation.
- The complete five-file contribution diff passed `git diff --check` and manual review.

## Next-Action

Summary: Await GitHub diagnostics review
Action: Monitor PR #10581 for maintainer review, CI results, and requested changes.
Done-When: The pull request receives a review, merge, closure, or actionable CI result.

## Publication-Draft

Title: `fix(github): preserve actionable API diagnostics`
Target: New pull request to `can1357/oh-my-pi:main` from `MikeeI:fix/github-actionable-errors`.

```markdown
## What

Preserve structured GitHub API diagnostics when `gh` writes a generic summary to stderr and useful details to stdout.
Add repository, revision, and path context to failed `file_read` operations without guessing which Contents API segment failed.
Clarify that GitHub Boolean operators combine text terms rather than qualifiers.

## Why

`github.json()` previously selected `stderr || stdout`.
An HTTP 422 could therefore expose only `gh: Validation Failed` while hiding the API explanation needed to correct the request.
Contents API errors also omitted the repository, revision, and path needed to recover from a generic 404.
Successful JSON responses, text commands, authentication translation, and GitHub's ambiguous 404 meaning remain unchanged.
The complete five-file diff was reviewed, and the real HTTP 422 path plus focused regression cases were exercised.

## Testing

- `bun test packages/coding-agent/test/tools/gh.test.ts --test-name-pattern 'GitHub command runner|adds repository, revision, and path context'` — 6 passed.
- `bun --cwd=packages/coding-agent run check` — passed.
- Live source-runner HTTP 422 reproduction — retained the concise summary and appended the Boolean-operator explanation.

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

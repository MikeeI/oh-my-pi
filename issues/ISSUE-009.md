# ISSUE-009 — Read SSH guidance: retired search and ssh tool names remain model-visible

State: Closed
Mode: Pull request
Target: New pull request
Location: https://github.com/can1357/oh-my-pi/pull/9045
Priority: Medium
Confidence: High
Type: correctness
Created: 2026-08-14
Updated: 2026-08-21
Source: `upstream/main@74bc1f442e7bb6adcb5797ca8802ef6684281411`

## Root

Root [S]: Read guidance and several SSH-related runtime errors still route users or models to retired `search` and standalone `ssh` tool names.
`search` was renamed to provider-visible `grep`, and the standalone SSH AgentTool was removed while `ssh://` protocol handling remained.
The stale guidance therefore spans the prompt, SSH transfer errors, internal-URL errors, path validation, and Grep errors.

## Reach and impact

Reach [S]: Read-enabled models see unavailable SSH routes, and special, binary, Windows, or path-validation failures can emit the retired names.
Impact [N]: Models can emit unavailable tool calls or miss working `grep ssh://file`, causing avoidable not-found or retry turns; provider frequency is unmeasured and SSH I/O remains functional.

## Evidence

- [S] Current upstream `prompts/tools/read.md:22-23` names `write`, `search`, and a standalone `ssh` fallback.
- [S] Current upstream `tools/builtin-names.ts:1-43` exposes `grep` and only retains `search` as a legacy normalization alias; provider-visible `search` and standalone `ssh` are absent.
- [S] Current upstream `ssh/file-transfer.ts:23-39` recommends the removed `ssh` tool for Windows hosts and hosts without a verified POSIX shell.
- [S] Current upstream `internal-urls/ssh-protocol.ts:290-308` recommends the removed `ssh` tool for special, binary, or non-UTF-8 files.
- [S] Current upstream `tools/path-utils.ts:1479-1482` recommends the retired `search` tool for remote `ssh://` paths.
- [S] Current upstream `tools/grep.ts:810-813` still says `search` cannot recurse a remote directory listing.
- [S] Current upstream `test/tools/grep-internal-urls.test.ts:613-645` confirms the current `grep` owner searches `ssh://` files and rejects only unsupported directory-listing recursion.
- [S] `https://github.com/can1357/oh-my-pi/commit/ae1650d689aa17dc7e72b0e8e9139c2cd2c0e363` renamed `search` and `find` to `grep` and `glob` across the stack.
- [S] `https://github.com/can1357/oh-my-pi/commit/5ff277349cb1b1cda27cf1b3b4d946e160643906` removed the standalone SSH AgentTool while retaining `ssh://` protocol support.
- [O] Live `ReadTool.description` still advertises that SSH handling is `search`-able.
- [O] Windows, special-file, binary-file, remote-file, and remote-directory probes emitted the retired `ssh` or `search` names in their exact runtime errors.
- [O] A mocked remote-file `grep ssh://` fixture succeeded with output `*1|needle here` and no error.
- [O] The complete real `createTools` registry contained `grep` but neither provider-visible `search` nor standalone `ssh`; the stale names remain in Read guidance rather than the canonical registry.

## Prior art

Coverage: issues(open+closed), PRs(open+closed+merged), source history; checked=2026-08-19.
Gaps [N]: Discussions, maintainer fallback choice, and open PR #3921 review remain unchecked.

- `https://github.com/can1357/oh-my-pi/pull/3553` — historical SSH URL owner from when the old tool names were valid.
- `https://github.com/can1357/oh-my-pi/pull/3609` — related rename fallout in stale expectations.
- `https://github.com/can1357/oh-my-pi/pull/7015` — confirms `grep` supports SSH URLs but does not fix Read guidance.
- `https://github.com/can1357/oh-my-pi/pull/3921` — open future SSH capability work; not a current owner and out of scope.

Target fit: New model-facing migration-closure candidate; no exact duplicate found.
Mode and target selected: Pull request mode, new pull request against canonical upstream `main`.

## Direction

Replace `search` with `grep` and replace or remove the invented standalone-SSH fallback using current truthful routes.
Correct matching user-visible names in `ssh/file-transfer.ts`, `internal-urls/ssh-protocol.ts`, `tools/path-utils.ts`, and `tools/grep.ts`.
Do not restore retired aliases or alter SSH protocol behavior.

## Bounds

- Preserve: `read`, `write`, and `grep` support for `ssh://`, POSIX capability gates, configured-host management, and Bash or system-SSH routing where appropriate.
- Exclude: Reviving standalone SSH, broad internal renames, SSHFS dead code, and open PR #3921 scope.
- Cost: Prompt correction, four runtime guidance owners, and focused registry and error assertions.

## Verification

- Render Read guidance and enumerate provider-visible canonical tools; no named route may be absent.
- Exercise `grep` against an `ssh://` file through the existing protocol fixture.
- Trigger Windows, no-shell, special-file, binary-file, path-validation, and remote-directory errors; require only current tool names.

## Missing

None.

## Resume

Index: —
Next: None.
Done when: None.

## Bug reproduction

Environment: Bun 1.3.14, Ubuntu 24.04.4 LTS x64, current personal checkout, real `createTools` registry, controlled SSH protocol fixtures, and mocked remote host `icaro`.
Reproduction: Inspect the live Read description and enumerate the provider-visible registry.
Trigger Windows, special-file, binary-file, remote-file, and remote-directory SSH paths.
Run `grep` against a mocked remote `ssh://` file.
Actual [O]: The registry contains `grep` but no `search` or standalone `ssh`, while runtime guidance still emits retired names and the canonical `grep ssh://` file route succeeds with `*1|needle here`.
Expected: Errors and prompt guidance name only current routes, and working `grep ssh://` behavior remains unchanged.
## Implementation

Branch: `fix/read-ssh-guidance`
Base: `upstream/main@74bc1f442e7bb6adcb5797ca8802ef6684281411`
Scope: Replace stale model-visible `search` and standalone `ssh` routes with `grep`, `bash` with a remote SSH command, and `sshfs`; preserve SSH URL behavior.
Commit: `bee9144db5c7c4736cbf70c8280ad2eb5c84ab83`
Push: `origin/fix/read-ssh-guidance` | Pushed.
Checks:
- `bun test packages/coding-agent/test/tools/read-guidance.test.ts packages/coding-agent/test/internal-urls/ssh-protocol.test.ts packages/coding-agent/test/ssh/file-transfer-posix-guard.test.ts packages/coding-agent/test/tools/grep-internal-urls.test.ts packages/coding-agent/test/tools/ssh-url-ungated-tools.test.ts` → 68 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check` → Biome passed; unrelated existing `tsgo` errors remain in `src/modes/theme/tui-adapters.ts:257,272` for missing `SettingsListTheme.warning`.

## Draft

Target: `can1357/oh-my-pi`, base `main`, head `MikeeI:fix/read-ssh-guidance`.
Title: `fix(tools): correct SSH guidance tool names`
Body:

## What

Replace stale model-facing SSH route names with the current provider-visible tools and document truthful fallbacks.

- Use `grep` for specific remote files instead of retired `search`.
- Use `bash` with a remote SSH command or `sshfs` where `ssh://` cannot operate.
- Preserve SSH URL read, write, and `grep` behavior without restoring retired tools.

## Why

Read guidance and SSH runtime errors recommend `search` and a standalone `ssh` tool that are absent from the provider-visible registry.
Models can therefore produce unavailable tool calls or miss the supported `grep ssh://file` route.

## Testing

- Focused SSH/Grep regression tests pass: 68 tests, 0 failures.
- `bun --cwd=packages/coding-agent run check` passes Biome.
- The package type check reports pre-existing `SettingsListTheme.warning` errors in `src/modes/theme/tui-adapters.ts:257,272`.
- `packages/coding-agent/CHANGELOG.md` contains the Unreleased fix entry.

---

- [ ] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated (if user-facing)

I checked the relevant issues, comments, pull requests, and discussions; this pull request is not a duplicate.

### Disclosure

Investigated thoroughly with openrouter/openai/gpt-5.6-luna (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.

## Disposition

Outcome: Merged
Evidence: Pull request #9045 merged as `a3d4e827c0e75b0b310a0f69bdf9e0b128b2e109` on 2026-08-20.
Checked: 2026-08-21

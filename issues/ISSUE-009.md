# ISSUE-009 — Read SSH guidance: retired search and ssh tool names remain model-visible

State: Hold
Mode: Undecided
Target: Undecided
Location: Not published.
Priority: Medium
Confidence: High
Type: correctness
Created: 2026-08-14
Updated: 2026-08-14
Source: `upstream/main@ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472`

## Root

Root [S]: Read’s SSH guidance still routes the model to `search` and a standalone `ssh` tool. `search` was renamed to provider-visible `grep`; the standalone SSH AgentTool was deliberately removed while `ssh://` protocol handling remained. The same stale names survive in runtime error guidance, so the complete user/model-visible closure drifted across both migrations.

## Reach and impact

Reach [S]: Every Read-enabled model sees the stale SSH routes; special/binary remote failures can emit the stale standalone-SSH recommendation, and another ToolError still says `search`.
Impact [N]: Models can emit unavailable tool calls or miss working `grep ssh://file`, causing avoidable not-found/retry turns; no provider trace is measured and SSH I/O itself remains correct.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/prompts/tools/read.md#L21-L23` — prompt names `write`/`search` and “else `ssh` tool”.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/builtin-names.ts#L1-L48` — canonical built-ins include `grep`, not provider-callable `search` or `ssh`.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/internal-urls/ssh-protocol.ts#L257-L317` — `SshProtocolHandler` owns remote UTF-8 read/list/write; its error guidance still names the removed tool.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/test/tools/grep-internal-urls.test.ts#L613-L645` — current `grep` owner searches `ssh://` files.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/path-utils.ts#L1400-L1403` — user-visible error still names `search`.
- [S] `https://github.com/can1357/oh-my-pi/commit/ae1650d689aa17dc7e72b0e8e9139c2cd2c0e363` — canonical `search`/`find` rename to `grep`/`glob`.
- [S] `https://github.com/can1357/oh-my-pi/commit/5ff277349cb1b1cda27cf1b3b4d946e160643906` — removed the standalone SSH AgentTool while retaining `ssh://` protocol support.

## Prior art

Coverage: issues(open+closed), PRs(open+closed+merged), source history; checked=2026-08-14.
Gaps: Discussions, rendered registry comparison, and current full error strings remain unchecked.

- `https://github.com/can1357/oh-my-pi/pull/3553` — Related historical owner; introduced SSH URL support when old tool names were valid.
- `https://github.com/can1357/oh-my-pi/pull/3609` — Related rename fallout in stale expectations, different files.
- `https://github.com/can1357/oh-my-pi/pull/7015` — Related prompt-alignment precedent; confirms `grep` supports SSH URLs but does not fix Read guidance.
- `https://github.com/can1357/oh-my-pi/pull/3921` — Open future SSH capability work; not merged and not a current owner.

Target fit: New model-facing migration-closure candidate; no exact duplicate found. Mode and external target remain user-unselected.

## Direction

Replace `search` with `grep`; replace or remove the invented standalone-SSH fallback using current truthful routes. Correct matching user-visible names in `ssh-protocol.ts` and `path-utils.ts`. Do not restore retired aliases or alter SSH protocol behavior.

## Bounds

- Preserve: `read`/`write`/`grep` support for `ssh://`, POSIX capability gates, configured-host management, and Bash/system-SSH routing where appropriate.
- Exclude: Reviving standalone SSH, broad internal renames, SSHFS dead code, and open PR #3921 scope.
- Cost: Prompt plus two error-guidance owners and focused registry/error assertions.

## Verification

- Render Read guidance and enumerate provider-visible canonical tools; no named route may be absent.
- Exercise `grep` against an `ssh://` file through the existing protocol fixture.
- Trigger special/binary SSH rejection and path-validation errors; require only current tool names.

## Missing

- [O] Rendered description versus actual provider-visible registry capture.
- [O] Full current error strings for special/binary SSH rejection and stale path guidance.
- Maintainer decision for the exact unsupported-SSH fallback.
- Re-check open PR #3921 before any implementation.
- Mode and external Target remain intentionally unselected.

## Resume

Index: Reproduce retired Read routes
Next: Render Read against the live built-in registry and capture both stale runtime error paths.
Done when: Output proves `search` and standalone `ssh` are unavailable while current `grep` and `ssh://` owners remain functional.

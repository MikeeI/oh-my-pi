# ISSUE-031 — Prompt cache: a role edit in one instance rewrites every live session's task tool description

State: Submitted
Authorized-Work: Research-and-Reporting
Publication-Target: New-issue
External-Reference: https://github.com/can1357/oh-my-pi/issues/18716
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-11-10
Updated: 2026-11-10
Source: `upstream/main@1379127c078f978c9908059d31f6dc6c16efbe53`

## Root-Cause

Root-Cause [S]: With `task.perCallModel` on, the Task description getter renders every configured role value from live settings.
Every instance hot-reloads the global `config.yml`, so a role assignment persisted by one instance changes the next wire prompt of every other live session.
Introduced by upstream #12229 (`0e1b1fa57b`, `7dc6c49608`), first released in v18.14.2.
Before #12229 the same reload changed only later spawn routing, never live prompt bytes.

## Reach-and-Impact

Reach [S]: every live session in every instance sharing the global `config.yml`, while `task.perCallModel` is `on` or `eval`.
Reach [S]: upstream default is `off`, so only opted-in operators are affected; MOMP enables it in `project-settings-omp/data/sync/agent/config.yml:118`.
Impact [O]: session `01a1c597` on `claude-opus-5-5` read 37,491 and wrote 75,454 cache tokens on the first request after the edit; tool-schema tokens 13,167 → 13,191.
Impact [O]: the preceding request read 0 and wrote 110,495 with 16 `thinking_dropped`/`prefix_binding_mismatch` drops from `messages.0.content.1`.
Boundary [A]: attributing that 0-read request to the 13:29:39.573Z Default assignment rests on timing; the intermediate persisted value is not logged.
Boundary [O]: similar tool-schema changes with large writes appear in other sessions since 2026-11-01; their individual triggers are not attributed.

## Evidence

- [S] `packages/coding-agent/src/prompts/tools/task.md:25` renders `Approved: … (role)`.
- [S] `packages/coding-agent/src/task/model-approval.ts:231-259` builds roles from `configuredRoleGrantPatterns`, cached by settings revision.
- [S] `packages/coding-agent/src/task/index.ts:956-980` renders the description per access.
- [S] `packages/coding-agent/src/config/settings.ts:163,1443` watches config directories and reloads after 200 ms.
- [S] `packages/coding-agent/src/modes/controllers/selector-controller.ts:953-956` persists hub role assignments globally unless `modelRoleStorage` is `project`.
- [O] Throwaway repro on an `upstream/main@1379127c07` worktree: a separate `bun -e` writer changed the live Task `Approved:` default from `anthropic/claude-opus-4-6` to `anthropic/claude-sonnet-4-6`; `description changed: true (4144 -> 4146 chars)`.
- [O] Control with `perCallModel: "off"`: `description changed: false (3382 -> 3382 chars)`.
- [O] Repro script and exact draft: [`evidence/issue-031/issue-body.md`](evidence/issue-031/issue-body.md).
- [O] Session `-projects-project-twitter-cli` logged `model_change` `anthropic/claude-sonnet-5-5` `role: default` at 13:29:39.573Z and 13:30:07.788Z; `config.yml` mtime 13:30:07.908Z.
- [O] `~/.omp/logs/omp.2026-11-10.1684666.log`: `dropped thinking block after conversation prefix changed`, `count: 16`, at 14:29:41+01:00.

## Prior-Art

Coverage: `ISSUES.md` and `issues/` searched for perCallModel, modelRoles, config watch, Approved, prefix_binding; upstream issues, PRs, and discussions searched for perCallModel, per-call model cache, prompt cache tool description, cache miss settings reload, config.yml reload cache, prefix_binding_mismatch, modelRoles cache, live config reload, settings watcher prompt, default model role other sessions, advertise approved per-call models; checked=2026-11-10.
- https://github.com/can1357/oh-my-pi/pull/18400 — merged; same class (live MCP roster entering a bound prefix), different input; precedent for holding prompt inputs.
- https://github.com/can1357/oh-my-pi/issues/14443 — open; prefix-binding drops from a speculative-compaction side request; distinct trigger.
- https://github.com/can1357/oh-my-pi/pull/12571 — open; keeps `drop_block`-dropped thinking on the wire; distinct.
- https://github.com/can1357/oh-my-pi/pull/18416 — open; hides Task `model` while per-call selection is off; unrelated to cache stability.
- https://github.com/can1357/oh-my-pi/issues/8574 and https://github.com/can1357/oh-my-pi/issues/6458 — open feature requests for cross-instance sync; not in conflict.
Gaps: none; no thread owns this root cause.
Contribution fit: New-issue.

## Proposed-Change

[S] Hold the per-call advertisement per session and refresh it only at cache-cold boundaries (compaction, idle past TTL, the session's own model change), mirroring #18400's held roster.
[S] Alternative for maintainers: keep role values out of the tool description and resolve them at dispatch.

## Scope-and-Constraints

- Preserve: cross-instance propagation of role values for routing and new sessions.
- Preserve: operator-only grant authority and dispatch-time approval checks.
- Exclude: other live getter inputs (`task.disabledAgents`, isolation, effort), mentioned only as context.

## Verification

- Repro script in the draft prints `description changed: false` after the fix while a new session sees the new role value.
- Live: role assignment in instance B leaves instance A's next `cache_read_input_tokens` at the full prior prefix.

## Publication-Blockers

None.

## Next-Action

Summary: Await maintainer decision
Action: Re-read #18716 for a maintainer decision on holding the advertisement per session versus resolving roles at dispatch.
Done-When: A maintainer accepts, rejects, or reshapes the proposal, or the issue closes.

## Publication-Draft

Target: can1357/oh-my-pi, New-issue, template `bug_report.yml`; the `bug` label was not applied at submission.
Title: Role edit in one omp instance rewrites the task tool description of every running session and busts its prompt cache (task.perCallModel)

Body: [`evidence/issue-031/issue-body.md`](evidence/issue-031/issue-body.md); it lives outside this record because its literal placeholders read as unresolved to the ledger validator.

# Issue and Pull Request Tracking

Read this index at the start of every agent session before repository work.
`FORMAT.md` owns research, lifecycle, drafting, implementation, and publication rules.
Each linked `issues/ISSUE-NNN.md` is the complete authoritative record for one root cause.
This file owns `Next-Finding-ID` and projects current issue-file state.
`Next-Action` is the 2–6 word `Next-Action/Summary` projection from the issue record.
When a row disagrees with its issue file, correct the row from the issue file in the same task.

Next finding ID: ISSUE-013

## Open-Findings

| ID | Finding | State | Authorized-Work | Publication-Target | Contribution-Priority | Next-Action | External-Reference |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ISSUE-001](issues/ISSUE-001.md) | Eval prompt: agent() children do not share the promised kernel state | PR-Ready | Pull-Request-Implementation | New-pull-request | Medium | Approve Eval pull request | Not published. |
| [ISSUE-002](issues/ISSUE-002.md) | Eval registry: disabling the last live backend re-advertises every language | Investigating | Not-Selected | Not-Selected | High | Reproduce zero-backend transition | Not published. |
| [ISSUE-003](issues/ISSUE-003.md) | Todo schema: items is described as append-only despite flattened init | Investigating | Not-Selected | Not-Selected | Low | Capture Todo provider miscall | Not published. |
| [ISSUE-004](issues/ISSUE-004.md) | Bash prompt: timeout does not extend the auto-background cutoff | PR-Ready | Pull-Request-Implementation | New-pull-request | Medium | Approve Bash pull request | Not published. |
| [ISSUE-007](issues/ISSUE-007.md) | Hub capability: disabled process supervision remains fully advertised | Investigating | Not-Selected | Not-Selected | High | Select Hub gating scope | Not published. |
| [ISSUE-010](issues/ISSUE-010.md) | LSP prompt: raw requests omit multi-server routing guidance | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Review local LSP prompt PR | Not published. |
| [ISSUE-011](issues/ISSUE-011.md) | Read: compact directory metadata spacing | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Monitor maintainer feedback | https://github.com/can1357/oh-my-pi/pull/9062 |
| [ISSUE-012](issues/ISSUE-012.md) | Prompt: metadata-free workspace tree | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Monitor workspace-tree PR | https://github.com/can1357/oh-my-pi/pull/9152 |

## Archived-Findings

| ID | Finding | Authorized-Work | Publication-Target | Contribution-Priority | Archive-Reason | External-Reference |
| --- | --- | --- | --- | --- | --- | --- |
| [ISSUE-005](issues/archive/ISSUE-005.md) | Task prompt: restricted specialist defaults are called general-purpose workers | Pull-Request-Implementation | New-pull-request | Medium | Merged | https://github.com/can1357/oh-my-pi/pull/9046 |
| [ISSUE-006](issues/archive/ISSUE-006.md) | Task prompt: same-file edits are not guaranteed to auto-resolve | Pull-Request-Implementation | New-pull-request | High | Merged | https://github.com/can1357/oh-my-pi/pull/9047 |
| [ISSUE-008](issues/archive/ISSUE-008.md) | Read prompt: raw is not a universal converter or byte bypass | Not-Selected | Not-Selected | Medium | Fixed-Elsewhere | Not published. |
| [ISSUE-009](issues/archive/ISSUE-009.md) | Read SSH guidance: retired search and ssh tool names remain model-visible | Pull-Request-Implementation | New-pull-request | Medium | Merged | https://github.com/can1357/oh-my-pi/pull/9045 |

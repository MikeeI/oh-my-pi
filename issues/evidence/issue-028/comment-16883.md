Hi, thanks for documenting this.

I noticed three additional details in the current implementation:

- [`project-prompt.md#L32-L38`](https://github.com/can1357/oh-my-pi/blob/0b5c27ab24719c86a5986b95ee55f4e75bc1aaa0/packages/coding-agent/src/prompts/system/project-prompt.md#L32-L38): `<project-context>` also renders `<workspace-tree>`, which orders entries by newest mtime. Any write in the directory changes those bytes, so an anchor on the current block would rarely match across sessions, even with a fixed cwd.
- Ordinary interactive sessions pay the same write, not only per-prompt ACP sessions. Over 7 days of local Anthropic usage, the first request of 100 new main sessions read a median of 34,652 cache tokens and wrote 26,682. The written median covers the project block plus the first user message; I did not measure the split per block.
- A first request always leaves the idle slot from the triage comment: the date/cwd reminder shares the single user message, so the message pass places one breakpoint.

This appears to share the issue's root cause because all three follow from the missing breakpoint behind the [volatile-suffix anchor](https://github.com/can1357/oh-my-pi/blob/0b5c27ab24719c86a5986b95ee55f4e75bc1aaa0/packages/ai/src/providers/anthropic.ts#L4748).

Would it make sense to take the option-1 variant (anchor `<project-context>` only with a breakpoint left idle after message anchoring) together with moving the workspace tree, workspace roots, and active-repository context into a trailing block behind `<project-context>`? That keeps the tool breakpoint, never competes with the second trailing message, and makes the anchored block byte-stable per directory.

I checked the relevant discussion; this evidence is not already reported.

I am reporting this finding only and am not currently proposing a pull request.

### Disclosure

Investigated thoroughly with Claude Opus 5.5 (medium reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.

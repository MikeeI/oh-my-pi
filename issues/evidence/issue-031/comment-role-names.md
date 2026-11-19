Thanks for confirming the reproduction. One consideration for the decision between the two options:

**Holding only the advertisement lets it drift from authorization.** Dispatch approval reads live operator settings: [`perCallModelGrantPatterns`](https://github.com/can1357/oh-my-pi/blob/1379127c078f978c9908059d31f6dc6c16efbe53/packages/coding-agent/src/task/model-approval.ts#L272-L288) calls `grants.settings.grantAuthority()` on every check. If the description is held but approval stays live, a session can still show `anthropic/claude-opus-5-5 (default)` after another instance has moved Default to Sonnet. The model then picks the advertised selector, and preflight refuses it because that ID is no longer granted. That trades a cache miss for refused spawns. Avoiding the refusal would mean holding the grants per session as well, which moves a security-relevant check onto stale state.

**Advertising role names instead of resolved IDs avoids both problems.** If `model` accepted a configured role name such as `"smol"` and resolved it at dispatch:

- the description lists only role names, so it stays byte-stable when a role's value changes;
- "use smol" follows the role's current value automatically;
- authorization stays live and consistent with what was advertised.

This conflicts with the current "no roles" rule in `prompts/tools/task.md:25`, so it is your call whether role names are acceptable as per-call selectors. Exact IDs could stay accepted beside role names; only the advertisement would need to stop listing resolved values.

For context, on my own setup per-call selection appeared in 3 of 92 `task` calls over ten days, so I have switched `task.perCallModel` off as a workaround for now.

### Disclosure

Investigated thoroughly with Claude Opus 5.5 (high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

I thoroughly reviewed this contribution with Claude Opus 5.5 (high reasoning effort).

This report is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.

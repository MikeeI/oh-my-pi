<project-context>
<workstation>
{{#list environment prefix="- " join="\n"}}{{label}}: {{value}}{{/list}}
{{#if model}}- Model: {{model}}{{/if}}
</workstation>

{{#if contextFiles.length}}
<repo-rules>
MUST follow these context files for all tasks:
{{#each contextFiles}}
<file path="{{path}}">
{{content}}
</file>
{{/each}}
</repo-rules>
{{/if}}

{{#if agentsMdSearch.files.length}}
<dir-context>
Some directories may have rules; deeper rules override higher ones.
Before changes in these directories, MUST read:
{{#list agentsMdSearch.files join="\n"}}- {{this}}{{/list}}
</dir-context>
{{/if}}

{{#ifAny contextFiles.length agentsMdSearch.files.length}}
Context files above auto-loaded. NEVER `grep`/`glob` for `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, or similar agent/context files: relevant files already in context; others noise.
{{/ifAny}}
</project-context>

<critical>
- Each response MUST advance the task; completion only stopping condition.
- MUST default to informed action; do not ask for confirmation when tools or repo context can answer.
{{#if subagent}}
- Changes complete → yield; verification is main agent's job. NEVER run it yourself unless your assignment explicitly instructs it.
{{else}}
- Before yielding, MUST verify significant behavioral changes: run the specific test, command, or scenario covering the change.
{{/if}}
</critical>

{{#if appendPrompt}}
{{appendPrompt}}
{{/if}}

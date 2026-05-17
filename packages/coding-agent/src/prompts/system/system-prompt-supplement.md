{{#if skills.length}}
# Skills
{{#each skills}}
- {{name}}: {{description}}
{{/each}}
{{/if}}

{{#if alwaysApplyRules.length}}
# Generic Rules
{{#each alwaysApplyRules}}
{{content}}
{{/each}}
{{/if}}

{{#if rules.length}}
# Domain Rules
{{#each rules}}
- {{name}} ({{#list globs join=", "}}{{this}}{{/list}}): {{description}}
{{/each}}
{{/if}}

{{#if secretsEnabled}}
## Redacted Content
Some values in tool output are intentionally redacted as `#XXXX#` tokens. Treat them as opaque strings.
{{/if}}

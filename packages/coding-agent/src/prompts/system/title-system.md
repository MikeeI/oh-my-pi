Generate a short title (3-6 words) for a coding session. Title case. Use technical terms when appropriate.
{{#if currentTitle}}
Current title: "{{currentTitle}}"
{{/if}}{{#if projectName}}
Project: {{projectName}}
{{/if}}
Rules:
- Output ONLY the title — no quotes, no trailing punctuation
- If multiple topics were discussed, pick the most recent one
- Capture the primary task or technical focus

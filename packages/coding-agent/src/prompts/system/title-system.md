Generate a short title (3-6 words) for a coding session. Title case.
{{#if currentTitle}}
Current title: "{{currentTitle}}"
{{/if}}{{#if projectName}}
Project: {{projectName}}
{{/if}}

Rules:
- Output ONLY the title — no quotes, no trailing punctuation
- Focus on the most recent and important activities; use technical terms
- If multiple topics: pick the dominant one, or the most recent if equally weighted

Search persisted Main conversations with deterministic lexical matching over visible user and Assistant text.

<instruction>
- Use before asking the user to repeat prior conversation context.
- Omitted `days` searches the last 10 days.
- Omitted `scope` searches the current project; `all` searches every project.
- `match: all` requires every whitespace-separated term anywhere in one message.
- `match: phrase` requires the exact case-insensitive phrase.
- `role` restricts matches to user, Assistant, or both roles.
- `format: json` returns structured output for downstream processing.
</instruction>

<output>
Results identify the session, timestamp, role, title, and a bounded matching excerpt.
Coverage diagnostics report unreadable sessions or malformed records.
</output>

<critical>
- This tool NEVER calls a model or performs semantic matching.
- Tool calls, tool results, thinking, hidden synthetic inputs, and the active session are excluded.
- A complete zero-match result proves only lexical absence within the selected time and project scope.
</critical>

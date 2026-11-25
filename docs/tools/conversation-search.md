# conversation_search

> Search persisted Main conversations with deterministic lexical matching over visible user and Assistant text.

## Source

- Entry: `packages/coding-agent/src/tools/conversation-search.ts`
- Model-facing prompt: `packages/coding-agent/src/prompts/tools/conversation-search.md`
- Search engine: `packages/coding-agent/src/session/conversation-search.ts`
- Corpus loader: `packages/coding-agent/src/session/conversation-corpus.ts`
- Output formatter: `packages/coding-agent/src/tools/conversation-search-format.ts`

## Input and availability

| Field | Type | Default | Meaning |
|---|---|---|---|
| `query` | string | required | Non-empty literal text or whitespace-separated terms |
| `days` | integer 1–3650 | `10` | Lookback window by session modification time |
| `scope` | `project` \| `all` | `project` | Current project or every project |
| `role` | `user` \| `assistant` \| `both` | `both` | Message roles to search |
| `match` | `all` \| `phrase` | `all` | Every term anywhere in one message, or the exact case-insensitive phrase |
| `format` | `text` \| `json` | `text` | Output format |
| `limit` | integer 1–50 | `12` | Maximum returned matches |

The tool is read-approved and discoverable.
It is available only to the top-level session (`taskDepth` 0); subagents never receive it.

## Behavior

- Matching is lexical and deterministic; the tool never calls a model.
- Only visible user and Assistant text is indexed.
  Tool calls, tool results, thinking, hidden synthetic inputs, and the active session are excluded.
- File-command invocations match their typed text, not their hidden expansion.
- Results name the session, timestamp, role, title, and a bounded excerpt around the match.
- Coverage diagnostics report unreadable sessions and malformed records instead of silently skipping them.
- A complete zero-match result proves only lexical absence within the selected window and scope.

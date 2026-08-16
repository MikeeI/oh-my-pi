# conversation_search

> Search persisted Main conversations without model calls.

## Source

- Entry: `packages/coding-agent/src/tools/conversation-search.ts`.
- Corpus: `packages/coding-agent/src/session/conversation-corpus.ts`.
- Lexical engine: `packages/coding-agent/src/session/conversation-search.ts`.
- Output formats: `packages/coding-agent/src/tools/conversation-search-format.ts`.
- Model-facing prompt: `packages/coding-agent/src/prompts/tools/conversation-search.md`.

## Inputs

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `query` | `string` | Yes | Literal text or whitespace-separated terms. |
| `days` | `integer` | No | Lookback window from 1 to 3650 days; defaults to 10. |
| `scope` | `project \| all` | No | Searches the current project by default. |
| `role` | `user \| assistant \| both` | No | Searches both visible roles by default. |
| `match` | `all \| phrase` | No | Requires all terms by default or one exact case-insensitive phrase. |
| `format` | `text \| json` | No | Returns compact text by default or structured JSON. |
| `limit` | `integer` | No | Returns at most 1 to 50 matches; defaults to 12. |

## Behavior

The tool reads persisted session JSONL files and searches only visible human user and Assistant text blocks.
It excludes tool calls, tool results, thinking, developer messages, hidden synthetic inputs, and the active session.
Project scope derives from the active session directory and does not mutate session storage.
The lexical engine scans at most four session files concurrently and returns the newest matches first.
Unreadable sessions and malformed JSONL records make the result explicitly incomplete.
The tool is available only in top-level Main sessions.

## Side Effects

The tool reads session metadata and JSONL files.
It performs no model, network, database, workspace-write, or session-write operation.

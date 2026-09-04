# Temporary Cache and Read Cost Analysis

## Status

This document records a temporary measurement snapshot for local `read` calls and multi-file Read batching.
It is analytical evidence, not a permanent runtime contract or billing statement.

## Executive Summary

Local file I/O is cheap, while every additional Main-model continuation can be expensive in a large session.
A five-file semicolon-delimited Read completed its tool work in 22 ms and returned 3,422 Read tokens.
The following Main continuation processed 212,450 tokens and carried an API price proxy of $0.1139344.
The dominant component was 207,616 cached tokens, whose price proxy was $0.0830464.
Batching five known files into one Read avoids four model decisions without reducing the file content returned.
Under a fixed-prefix lower-bound calculation, those four avoided cache replays represent about $0.3322.
The corresponding five-Read serial total is estimated at $0.46–$0.49 versus $0.1139 for the measured batch.
ChatGPT Pro covers the actual usage, so every dollar figure below is a quota and provider-work proxy only.

## Scope

The analysis covers local filesystem reads handled by the `read` tool.
It includes single-file reads and semicolon-delimited multi-file reads.
It excludes network retrieval and web research.
It evaluates tool latency, returned Read tokens, Main-continuation latency, and runtime price proxies.

## Measurement Source

The aggregate snapshot used strict JSONL ingestion over today's OMP sessions.
The governed runner was `$HOME/projects/project-settings-omp/scripts/omp-session-duckdb.sh`.
The database was in-memory DuckDB v1.5.2.
The source contained 22 session files and 10,238 JSONL records at measurement time.
The normalized sample contained 802 completed local Read calls.
Exact Read-token metadata was available for 797 calls.
A following Assistant message was available for 772 calls.
Active session files can grow after this snapshot without changing their filenames.

## Definitions

### Local Read tool time

Tool time is the interval from the persisted Assistant `read` call to its matching `toolResult` timestamp.
It includes Read dispatch, file handling, selector processing, result formatting, and persistence timing.
It is not a pure filesystem syscall benchmark.

### Read tokens

Read tokens are the exact native-token count stored in `message.details.readTextTokens`.
The count covers final sanitized text returned by the Read call.

### Main continuation

Continuation time is the interval from a Read `toolResult` to its directly following Assistant message.
It includes provider preparation, model latency, reasoning, tool-call generation or prose generation, and persistence.
It must not be interpreted as network latency alone.

### API price proxy

The runtime computes `message.usage.cost.total` from catalog token rates.
This value estimates equivalent API work and is not a charge against the user's ChatGPT Pro subscription.

## Aggregate Local Read Measurements

| Metric | Count | Average | Median | P90 | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool time | 802 | 101 ms | 7 ms | 35 ms | 14,771 ms |
| Returned Read tokens | 797 | 2,134 | 1,459 | 5,060 | 11,998 |
| Main-continuation time | 772 | 12,329 ms | 6,206 ms | 26,766 ms | 163,447 ms |
| Main-continuation price proxy | 772 | $0.0437 | $0.0395 | $0.1023 | Not projected |

The 7 ms median shows that ordinary local file access is not the primary latency cost.
The 6.2-second continuation median is almost three orders of magnitude larger than the Read median.
The broad continuation tail reflects different projects, models, context sizes, reasoning, and generated outputs.
The aggregate price distribution mixes these contexts and must not replace the exact batch measurement below.

## Exact Five-File Batch

The measured call used one semicolon-delimited `read` invocation with five bounded targets:

```text
packages/coding-agent/src/prompts/tools/web-search.md
packages/coding-agent/src/prompts/system/web-search.md
packages/coding-agent/src/web/search/providers/base.ts:1-100
packages/coding-agent/src/web/search/types.ts:92-178
packages/coding-agent/src/web/search/provider.ts:192-249
```

The Read tool interpreted these values as five paths and returned all five results in one `toolResult`.

| Measurement | Value |
| --- | ---: |
| Read call time | 22 ms |
| Exact returned Read tokens | 3,422 |
| Main-continuation time | 21,918 ms |
| Main uncached input | 4,112 tokens |
| Main cache read | 207,616 tokens |
| Main output | 722 tokens |
| Main total | 212,450 tokens |
| Runtime API price proxy | $0.1139344 |

Evidence identity:

```text
Session: 01a06266-5690-75d4-b489-ca0fe379bc9a
Call: call_8tGqV1N0wBLenNZQN79nNdyy|fc_0153aa9fe7d99599016a98396537e887d2a8937acce98618f1
Timestamp: 2026-09-02 16:57:43.335 +02
```

## Exact Batch Price Calculation

The Main model was `openai-codex/gpt-5.6-sol` below its 272,000-token long-context threshold.
The applicable catalog rates per one million tokens were $4 input, $20 output, and $0.40 cache read.

```text
Cache read: 207,616 × $0.40 / 1,000,000 = $0.0830464
Input:        4,112 × $4.00 / 1,000,000 = $0.0164480
Output:         722 × $20.0 / 1,000,000 = $0.0144400
                                                    -----------
Total                                               $0.1139344
```

The cache replay contributed about 72.9% of the measured proxy.
The uncached input contributed about 14.4%.
The generated output contributed about 12.7%.

## Five Sequential Reads Counterfactual

The five-file serial case was not executed because doing so would intentionally incur the waste being measured.
Its exact cost cannot be known without fixing every intermediate model output, cache boundary, and provider response.
The following calculation is therefore a conservative counterfactual, not an observed result.

A serial workflow requires four extra Main decisions before the same final continuation.
Using the measured 207,616-token cached prefix for each extra decision gives this replay-only lower bound:

```text
4 × 207,616 × $0.40 / 1,000,000 = $0.3321856
```

Adding that lower bound to the measured batch continuation gives:

```text
Measured batch proxy                         $0.1139344
Minimum four extra cache replays             $0.3321856
                                                     -----------
Replay-only serial lower-bound proxy         $0.4461200
```

A real serial run would additionally pay for four intermediate Assistant outputs and their request overhead.
The same 3,422 file-content tokens would arrive across five results instead of one combined result.
The resulting practical estimate is $0.46–$0.49 for five serial Reads in this session state.
The estimated saving is therefore $0.35–$0.38 in API price proxy.
The user's actual monetary charge remains zero under the active ChatGPT Pro usage model.

## Latency Interpretation

The measured Read work took 22 ms, while the following Main continuation took 21,918 ms.
The continuation was roughly 996 times longer than the complete five-target Read call.
The exact continuation included substantial reasoning and must not be generalized as a fixed model latency.

Using the 6,206 ms corpus median only as an illustrative central value, four extra decisions add about 24.8 seconds.
This multiplication is not a prediction because continuation latency varies widely with model work and context.
The exact five-file batch already proves the ownership boundary: Read I/O was negligible beside model continuation.

## What Batching Saves

Batching known independent local files saves:

- Four Assistant decision requests in the five-file example.
- Four repeated cache-prefix reads in the counterfactual workflow.
- Four intermediate tool-call outputs and their provider processing.
- Model latency between otherwise independent file reads.

Batching does not save:

- The 3,422 file-content tokens required by the selected ranges.
- Parsing, sanitization, formatting, or persistence for each selected target.
- Context space occupied by the combined final Read result.

The highest-value optimization is therefore fewer Main roundtrips, not fewer local filesystem operations.

## Current Multi-Target Read Behavior

A semicolon-delimited Read already creates one tool call and one combined tool result.
The current implementation processes its targets in a `for` loop with an awaited recursive Read per target.
This means the internal file operations are serial even though the model-facing operation is batched.

For ordinary local files, the 7 ms median makes internal I/O parallelism a secondary optimization.
Changing the loop to bounded concurrency would reduce tool time from the sum toward the slowest target.
Such a change must preserve input ordering, partial-error messages, image and text block ordering, and cancellation.
It would not eliminate any additional Main roundtrip because semicolon batching already owns that benefit.

## Operational Guidance

- Collect every independent local target needed for the current reasoning step before calling `read`.
- Put known local paths and internal resources into one semicolon-delimited Read call.
- Keep dependent reads sequential when one file determines the next target or selector.
- Select bounded ranges before batching to avoid transferring irrelevant context.
- Treat exact Read tokens as content cost and Assistant usage as roundtrip cost.
- Do not infer actual billing from the runtime price proxy.

## Reproduction Outline

Materialize session rows with strict ingestion:

```sql
CREATE OR REPLACE TEMP TABLE session_rows AS
SELECT *
FROM omp_session_rows('/root/.omp/agent/sessions/*/2026-09-02*.jsonl', false);
```

Create canonical Read calls:

```sql
CREATE OR REPLACE TEMP TABLE calls AS
SELECT *
FROM omp_tool_calls('session_rows', 'read');
```

Join each call to its `toolResult` by `filename` and `call_id`.
Join the result to its directly following Assistant message by `filename` and `parentId`.
Classify local Reads by excluding arguments whose `path` begins with an HTTP scheme.
Project only timestamps, `readTextTokens`, usage tokens, and `usage.cost.total`.
Use `quantile_cont(value, 0.5)` for medians and `quantile_cont(value, 0.9)` for P90 values.

## Limitations

- The aggregate snapshot combines projects, models, context sizes, and reasoning workloads.
- Session filenames encode creation time and can receive later events after resume.
- The active session may grow after the measurement without changing its filename.
- Persisted timestamps include more than pure transport or execution time.
- Price proxies depend on the selected model catalog and context tier.
- Cache behavior can change with prompt mutations, provider state, and append eligibility.
- The sequential five-Read figure is a bounded estimate rather than an executed control run.
- A valid future comparison must freeze files, ranges, model, context, cache state, and output contract.

## Conclusion

The measured five-file batch cost $0.1139344 in API price proxy and completed Read work in 22 ms.
The primary cost was replaying 207,616 cached Main-context tokens, not reading the five files.
Five serial Reads would conservatively exceed $0.4461 under the same cached-prefix assumption.
Semicolon batching is therefore already the correct optimization for independent local Read targets.
Internal Read parallelism may improve tool latency, but roundtrip elimination owns the material saving.

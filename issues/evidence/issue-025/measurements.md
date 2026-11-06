# ISSUE-025 measurements

Measured on 2026-10-19 on Linux 6.8.0-107-generic with Bun 1.4.3.
Build: installed `@mikeei/momp` 18.12.2-mikeei-1 bundle, and the `personal` source CLI.
Profile: isolated `PI_CODING_AGENT_DIR` built with `cp -rL` and a fake OpenAI-compatible provider.

## Tools

- `tools/fake-server.ts`: local chat-completions SSE provider on port 18777, plus a `/stats` request counter.
- `tools/fake-server.ts` with `FAKE_MODE=task`: "starte worker" makes the parent issue one `task` call with 4 tasks.
- Each fake Child reads a large file once and then yields `{"data":{"ok":true}}`.
- `tools/preload.ts`: Bun `--preload` hook; on SIGUSR2 it runs `Bun.gc(true)` and writes `bun:jsc` heap stats.
- `tools/drive.sh`: sends prompts through tmux and waits until the fake provider is idle.
- `tools/analyze.ts` and `tools/retainers.ts`: V8-format heap-snapshot type totals and GC-root retainer paths.

## Subagent burst, source CLI, default `task.agentIdleTtlMs: 420000`

The values below are logged live samples.
`samples/source-cli-stats-*.json` holds the post-`Bun.gc(true)` samples, which read slightly different values.

| Point | RSS | JS heap | Objects |
| --- | --- | --- | --- |
| Baseline | 338 MB | 66 MB | 794,549 |
| 80 finished Children still live, 364 requests | 623 MB | 165 MB | 1,406,659 |
| 8 minutes later, all Children parked | 474 MB | 72 MB | 864,927 |
| Later idle `VmRSS` | 424 MB | — | — |

The JS heap returned to near the baseline after parking; RSS stayed about 90 MB above it.

## Subagent burst, source CLI, `task.agentIdleTtlMs: 30000`

| Point | RSS | JS heap | Objects |
| --- | --- | --- | --- |
| Baseline | 409 MB | 69 MB | 862,724 |
| 80 more Children finished | 642 MB | 143 MB | 1,143,115 |
| 45 seconds later | 531 MB | 97 MB | 940,035 |

## Controls

- Resuming a fresh copy of a 20 MB real session: about 400 MB RSS with a 106 MB JS heap.
- 450 tmux resizes: RSS 384 → 393 MB, with no further growth.
- 200 ordinary turns with large tool outputs (`samples/bundle-200-turns.txt`): RSS 348 → 482 MB.

## Real host session (not reproduced in isolation)

- One long-lived interactive momp session held 3.9 GB, with a recorded 5.7 GB high-water mark.
- Its transcript directory held 167 Child transcripts totalling 199 MB, plus about 900 legacy `hub` calls.
- The host ran 57 concurrent momp instances, about 36 GB in total, with much of the older sessions' memory swapped out.

## Boundaries

- The fake Children were small; the live cost of a Child with a 1–4 MB transcript is extrapolated, not measured.
- Attributing the real session's peak to live Children is an inference from its transcripts, not a heap snapshot.
- Allocator retention after parking was observed in RSS but not traced inside Bun or mimalloc.
- Heap snapshots (up to 210 MB) were not retained.

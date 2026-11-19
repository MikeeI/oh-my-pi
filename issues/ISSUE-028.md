# ISSUE-028 — Anthropic prompt cache: every new session re-writes the unanchored `<project-context>` block

State: Submitted
Authorized-Work: Research-and-Reporting
Publication-Target: Existing-issue-comment
External-Reference: https://github.com/can1357/oh-my-pi/issues/16883#issuecomment-6387558568
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-10-24
Updated: 2026-10-24
Source: `upstream/main@0b5c27ab24719c86a5986b95ee55f4e75bc1aaa0`

## Root-Cause

Root-Cause [S]: `applyHeadCaching` anchors only the last tool and the last block before the first `<project-context>` or `<memories>` block, so the project block has no breakpoint of its own.
Anthropic writes cache entries only at breakpoints, so the first request of every session writes the project block at the first message breakpoint, and no later session can read it.
The project block also carries the mtime-ordered workspace tree, so even a dedicated anchor on the whole block would rarely match across sessions.

## Reach-and-Impact

Reach [S]: Every Anthropic Main session and every Child spawn whose prompt carries the coding agent's `<project-context>` block.
Impact [O]: Anthropic Main first requests over 7 days (n=100) read a median of 34652 cache tokens and wrote a median of 26682, totalling 4943935 written tokens.
Boundary [A]: The written median approximates the project block plus the first user message; the split per block is not measured.
Boundary [S]: A first request whose interior message carries a per-call mark spends both message slots in `applyPromptCaching`, so the project block gets no breakpoint.
Boundary [O]: Anthropic carried 70M of 1.4B conversation tokens in the measured 24 hours, so the absolute saving is small next to Codex traffic.

## Evidence

- [S] Upstream `packages/ai/src/providers/anthropic.ts:4748` defines `VOLATILE_SYSTEM_SEGMENT_MARKERS = ["<memories>", "<project-context>"]`.
- [S] Upstream `packages/coding-agent/src/prompts/system/project-prompt.md:32-38` renders `<workspace-tree>` inside `<project-context>`.
- [S] The Anthropic cache docs state that the lookback "only finds entries that earlier requests wrote at their own breakpoints": https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- [O] Query over `~/.omp/stats.db` `messages`, first request per `session_file`, `provider='anthropic'`, 7 days: see Reach-and-Impact.
- [O] `system-prompt inspect --model anthropic/claude-opus-4-5 --first-message "hallo" --breakdown --json` → one `user` message holding the date/cwd reminder and the prompt as two content blocks, so the first request uses one message breakpoint.
- [O] Child fan-out measurements in [`issues/evidence/issue-029/CACHE.md`](evidence/issue-029/CACHE.md): Child `<project-context>` carries 688 o200k tokens; parallel Anthropic spawns within 5 s hit the cache in 34 % of 67 cases.

## Performance-Evidence

Workload: Real MOMP Anthropic sessions on AX101-1, 7-day window ending 2026-10-24.
Baseline [O]: Median first-request cache write 26682 tokens, read 34652 tokens (n=100 Main sessions).
Candidate [O]: Not measured; requires deployed sessions with the fork delta.
Guard [O]: `bun test packages/ai/test/anthropic-head-caching.test.ts` → 23 pass; the idle-slot case asserts system anchors `[0, 1]` and a kept tool anchor on a first request, and `[0]` with 4 breakpoints on a later turn.
Boundary: Savings apply only to sessions starting within the cache TTL of an earlier session in the same directory.
End-to-end-Measurement: Not measured

## Prior-Art

Coverage: `ISSUES.md`, `issues/`, and `issues/archive/` searched for cache_control, project-context, and breakpoint; upstream issues and pull requests searched for project-context cache and cache breakpoint project-context; checked=2026-10-24.
- https://github.com/can1357/oh-my-pi/issues/16883 — open; owns the same root cause, observed via per-prompt ACP sessions.
  - Maintainer-bot comment: the placement is deliberate; it proposes anchoring the volatile suffix when the message pass leaves a slot free and asks whether that anchor ranks above the second trailing message.
  - "No implementation until one of these is accepted."
- https://github.com/can1357/oh-my-pi/issues/16884 — open; related OpenAI `prompt_cache_key` per-session affinity; distinct root cause.
- https://github.com/can1357/oh-my-pi/pull/7326 — merged; introduced the stable-prefix anchor before the cwd footer.
Gaps: None for upstream ownership; #16883 owns the root cause.
Contribution fit: Existing-issue-comment on #16883 with the workspace-tree volatility, the first-request measurement, and the idle-slot variant, if the user selects it.

## Proposed-Change

Proposal-Status: Implemented on `personal` as `MOMP-PROJECT-CACHE-ANCHOR`, uncommitted.
[S] Move `<workspace-tree>`, `<workspace-roots>`, and active repository context into a trailing `workspace-prompt.md` block opening with `<workspace-context>`, omitted when empty.
[S] Keep the upstream head anchors and spend a breakpoint left idle after message anchoring on the `<project-context>` block that opens the volatile suffix.

## Scope-and-Constraints

- Preserve: static-head sharing across directories and worktrees, OAuth identity-block anchor move, tail anchoring when every block is cwd-specific.
- Boundary: sessions starting after the TTL, or with a per-call mark on their first request, keep today's write.
- Exclude: Bedrock and OpenAI-compatible Anthropic-format routes, which own separate cache policies.

## Verification

- `bun test test/anthropic-head-caching.test.ts` in `packages/ai` → 23 pass; `bun run check:types` → clean.
- `bun test test/system-prompt-templates.test.ts test/system-prompt-inspect.test.ts test/system-prompt-dedup.test.ts` in `packages/coding-agent` → pass.
- After deployment, rerun the first-request median query; the written median should drop by about the project-block size for sessions within the TTL.

## Publication-Blockers

None.

## Next-Action

Summary: Await maintainer decision
Action: Re-read #16883 for a maintainer decision on the idle-slot variant and the workspace-block split.
Done-When: A maintainer accepts, rejects, or reshapes the proposal, or the issue closes.

## Publication-Draft

Target: can1357/oh-my-pi#16883
Title: Not applicable.

Body: the exact posted text is [`evidence/issue-028/comment-16883.md`](evidence/issue-028/comment-16883.md); it lives outside this record because its literal tags read as unresolved placeholders to the ledger validator.

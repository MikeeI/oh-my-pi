# ISSUE-003 — Todo schema: items is described as append-only despite flattened init

State: Archived
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/can1357/oh-my-pi/pull/9159
Contribution-Priority: Low
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-08-14
Updated: 2026-08-23
Source: `upstream/main@de5ffc4201c4941992402daea355adc1aad3a8db`

## Root-Cause

Root-Cause [S]: The provider-visible `items` field says only “tasks to append”.
The same schema field intentionally owns single-phase `init`.
Runtime, schema acceptance, prompt guidance, and full documentation support both operations.
The residual defect is contradictory provider metadata, not a validation failure.

## Reach-and-Impact

Reach [S]: Native provider schemas and default `xd://` docs expose the stale field hint beside correct Todo guidance.
Impact: A model may avoid or retry single-phase `init`, but frequency and causal provider behavior remain unmeasured.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/de5ffc4201c4941992402daea355adc1aad3a8db/packages/coding-agent/src/prompts/tools/todo.md#L7-L17` documents single-phase `init` with `items`.
- [S] `https://github.com/can1357/oh-my-pi/blob/de5ffc4201c4941992402daea355adc1aad3a8db/packages/coding-agent/src/tools/todo.ts#L69-L93` exposes the append-only hint while its rationale names `init` and `append`.
- [S] `https://github.com/can1357/oh-my-pi/blob/de5ffc4201c4941992402daea355adc1aad3a8db/packages/coding-agent/src/tools/todo.ts#L392-L429` maps flat `items` into one phase.
- [S] `https://github.com/can1357/oh-my-pi/blob/de5ffc4201c4941992402daea355adc1aad3a8db/packages/coding-agent/test/tools/todo.test.ts#L429-L460` covers implicit and explicit single-phase init.
- [S] `https://github.com/can1357/oh-my-pi/blob/de5ffc4201c4941992402daea355adc1aad3a8db/docs/tools/todo.md` defines `items` for `append` or flat `init`.
- [S] `https://github.com/can1357/oh-my-pi/commit/d6471c2244acea5ef727f0079500b91c44cd330b` added flattened init for Gemini calls without updating the field hint.
- [O] On 2026-08-21, `toolWireSchema` and `read xd://todo` both rendered `items` as “tasks to append”.
- [O] `bun test packages/coding-agent/test/tools/todo.test.ts -t "TodoTool lenient init shapes"` passed 3 tests.

## Prior-Art

Coverage: issues and pull requests in all states, source history, current documentation, and web discussion search.
Checked: 2026-08-21.
Gaps: Discussion-search completeness is unproven, and provider-transcript impact remains unmeasured.

- `https://github.com/can1357/oh-my-pi/issues/4461` and `https://github.com/can1357/oh-my-pi/pull/4465` are related but distinct; whitespace in `op` rejected a flattened init call.
- `https://github.com/can1357/oh-my-pi/issues/1991` is a distinct invalid report about phased-init validation.
- `https://github.com/can1357/oh-my-pi/issues/3241` concerns distinct legacy array-string coercion.
- `https://github.com/can1357/oh-my-pi/issues/8121` concerns blocked-task promotion, not schema field semantics.
- No exact issue, pull request, or active implementation owns the append-only `items` hint.

Contribution fit: A focused pull request corrects a source-proven provider contract without claiming measured model impact.

## Proposed-Change

Change only the authoritative `items` hint to “tasks for single-phase init or append”.
Add a provider-wire assertion that preserves both operation names without duplicating runtime behavior coverage.
Keep prompt guidance, documentation, runtime validation, and field names unchanged.

## Scope-and-Constraints

- Preserve: Phased init, single-phase init, append, lenient recovery, and current runtime validation.
- Exclude: Per-op schema redesign, runtime changes, field renames, and prompt or documentation edits.
- Cost: One schema-description correction, one provider-wire test, and one Unreleased changelog entry.

## Verification

- [O] Provider wire inspection returned `tasks for single-phase init or append`.
- [O] `{op:"init",items:["First","Second"]}` produced one `Tasks` phase with `in_progress` then `pending`.
- `bun test packages/coding-agent/test/tools/todo.test.ts` → 73 pass, 0 fail.
- `bun run --cwd packages/coding-agent check` → Biome checked 2,672 files; type check passed.
- `bun check` → all TypeScript and Rust workspace checks passed.
- `git diff --check` → passed.

## Publication-Blockers

None.

## Pull-Request-Implementation

Branch: `fix/todo-items-schema-guidance`
Base: `upstream/main@de5ffc4201c4941992402daea355adc1aad3a8db`
Scope: Correct provider-visible Todo `items` semantics without changing runtime behavior.
Commit: `4034d19c07`
Push: `origin/fix/todo-items-schema-guidance`
Checks:
- `bun test packages/coding-agent/test/tools/todo.test.ts` → 73 pass, 0 fail.
- `bun run --cwd packages/coding-agent check` → Biome and type checks passed.
- `bun check` → all TypeScript and Rust workspace checks passed.
- Provider wire and single-phase init scenarios passed.
- Diff hygiene passed.
- GitHub Actions run `32438460968` → every required build, smoke, and test job passed.
Review [O]: Head `4034d19c07ac` is clean and has a `COMMENTED` P0 review with no findings.

## Next-Action

Summary: —
Action: None.
Done-When: None.

## Publication-Draft

Title: `fix(coding-agent): clarify Todo items schema`
Target: New pull request to `can1357/oh-my-pi:main` from `MikeeI:fix/todo-items-schema-guidance`.

```markdown
## What

Clarify the Todo tool's provider-facing `items` schema description.
It now identifies `items` as valid for single-phase `init` and `append`.
Runtime behavior is unchanged.

## Why

Single-phase init was added for common Gemini Todo calls and is documented in the model prompt and full tool docs.
The schema-local description still says only “tasks to append”.
Providers and `xd://` docs expose that hint directly to models, where it contradicts the accepted `init` shape.

## Testing

- `bun test packages/coding-agent/test/tools/todo.test.ts` — 73 pass, 0 fail.
- `bun run --cwd packages/coding-agent check`
- `bun check`
- Provider wire inspection returned `tasks for single-phase init or append`.
- `{op:"init",items:["First","Second"]}` produced `Tasks` with `First` active and `Second` pending.

Just a little fix for coherence.

---

- [x] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated (if user-facing)

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
```

## Archive
Archive-Reason: Merged
Detail: None.
Evidence: `https://github.com/can1357/oh-my-pi/pull/9159` — upstream PR state `MERGED`; final thread and linked review outcome checked 2026-08-23.
Checked: 2026-08-23

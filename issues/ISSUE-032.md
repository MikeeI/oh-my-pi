# ISSUE-032 — Usage: Mistral Vibe Code budget is not reported

State: Implementing
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: API
Created: 2026-11-10
Updated: 2026-11-10
Source: `upstream/main@1379127c078f978c9908059d31f6dc6c16efbe53`

## Root-Cause

Root-Cause [S]: `DEFAULT_USAGE_PROVIDERS` in `packages/ai/src/usage/registry.ts` has no `mistral` entry.
`omp usage` therefore shows nothing for Mistral, including Vibe sign-in keys that bill a monthly Vibe Code allowance.

## Reach-and-Impact

Reach [S]: Every `mistral` api-key credential, including `/login mistral` Vibe keys (#17672).
Impact [O]: `momp usage` on a broker client with a stored Vibe key lists Anthropic, Codex, and OpenCode Go but no Mistral section (2026-11-10).
Boundary: Display and usage cache only; no ranking strategy, request routing, or billing classification change.

## Evidence

- [S] `packages/ai/src/usage/registry.ts` — no Mistral usage provider is registered.
- [S] `mistralai/mistral-vibe` `vibe/app_server/_billing.py` — the Vibe CLI reads `GET {api_base}/billing/budget` and `/billing/subscription`.
- [S] Same file: 403 is a member without `see_org_inference_usage`; 404 is a platform without billing; both are non-errors.
- [S] `mistralai/mistral-vibe` `vibe/cli-rust/src/usage_gauge.rs` and `ui/footer_gauge.rs` — the footer gauge renders `vibe_budget.usage_percentage` and PAYG.
- [O] `GET https://api.mistral.ai/v1/billing/budget` with the broker's Vibe key → 200 `{"vibe_budget":{"usage_percentage":15.35…,"initial_budget":255.0,"currency":"EUR","reset_at":"2026-12-01T00:00:00Z","payg_enabled":false},"api_budget":{…,"initial_budget":25.5,…}}` (2026-11-10).
- [O] `GET https://api.mistral.ai/v1/billing/subscription` → 200 `{"plan_name":"INDIVIDUAL","payg_enabled":false,"vibe_payg_enabled":false,"enterprise":false}` (2026-11-10).

## Prior-Art

Coverage: upstream issues and PRs searched for `mistral usage` and `mistral vibe usage`; checked=2026-11-10.
Gaps: Upstream Discord not searched.

- `https://github.com/can1357/oh-my-pi/pull/17672` — Related; adds Vibe sign-in, no usage reporting.
- `https://github.com/can1357/oh-my-pi/pull/13875` — Related; older open sign-in revision, no usage reporting.
- `https://github.com/can1357/oh-my-pi/issues/18374` — Distinct; billing-class display, fixed by #18378.

Contribution fit: New pull request; no open issue or pull request owns Mistral usage reporting.
The user requested a submittable pull request on 2026-11-10.

## Proposed-Change

Add `packages/ai/src/usage/mistral.ts`, registered in `DEFAULT_USAGE_PROVIDERS`.
It reads `{baseUrl}/billing/budget` and maps `vibe_budget` and `api_budget` to monthly percent limits with reset time and budget notes.
A 401 throws `ProviderHttpError` for credential health checks; 403, 404, other failures, and budget-less payloads return `null`.

## Scope-and-Constraints

- Preserve: existing providers, usage cache, and `/billing/subscription` remain unread.
- Exclude: credential ranking, plan-name metadata, and status-line gauges.
- Boundary [S]: broker clients receive usage from the broker host, which needs the new version.
- Cost: one new provider file, one registry line, one focused test, one changelog line.

## Verification

- `bun test packages/ai/test/mistral-usage.test.ts` → 3 pass.
- Source CLI `omp usage` with an isolated agent dir and the Vibe key in `MISTRAL_API_KEY` → Mistral section with `Vibe Code Monthly 15.5% used · resets in 20d9h`, `Monthly budget: 255 EUR`, and `API Monthly 0.0%`.

## Publication-Blockers

- Upstream policy requires one contributor-authored sentence explaining the change in the user's own words.
- External publication requires approval of the exact target and draft after that sentence is added.

## Next-Action

Summary: Approve Mistral usage PR
Action: Add the contributor-authored sentence, then approve the exact target and draft.
Done-When: The sentence exists and the user explicitly approves the exact target and draft.

## Pull-Request-Implementation

Branch: `feat/issue-032`
Base: `upstream/main@1379127c078f978c9908059d31f6dc6c16efbe53`
Scope: Mistral usage provider for the Vibe Code and API monthly budgets.
Commit: `5a53aeaa4deed01c03ffdd4ceb85b28d5970c286` (`feat(ai): report Mistral Vibe Code and API budgets in usage`).
Push: `origin/feat/issue-032`.
Checks:

- `bun test packages/ai/test/mistral-usage.test.ts` → 3 pass, 6 assertions.
- `bun --cwd=packages/ai run check` → no type errors.
- `oxfmt` and `oxlint` on the changed files → clean.
- Source CLI `omp usage` end to end with the live Vibe key → both budgets rendered with reset and capacity.

## Publication-Draft

Target: New pull request to `can1357/oh-my-pi:main` from `MikeeI:feat/issue-032`.
Title: `feat(ai): report Mistral Vibe Code and API budgets in usage`

Body:

````markdown
## What

[Required before publication: one sentence in the contributor's own words.]

Adds a `mistral` usage provider. It reads `GET /v1/billing/budget`, the endpoint the Vibe Code CLI uses for its footer usage gauge ([`vibe/app_server/_billing.py`](https://github.com/mistralai/mistral-vibe/blob/main/vibe/app_server/_billing.py)), and maps `vibe_budget` and `api_budget` to monthly percent limits with their reset date and budget amount.

## Why

Since #17672, `/login mistral` stores a Vibe key that bills the plan's monthly Vibe Code allowance, but `omp usage` shows nothing for Mistral, so the remaining allowance is only visible in the Vibe CLI or the console.

Error handling follows the Vibe CLI: a 403 (workspace member without the `see_org_inference_usage` permission) or 404 (deployment without billing) reports no usage instead of marking the key invalid; only a 401 does.

## Testing

- `bun test packages/ai/test/mistral-usage.test.ts`: payload mapping, absent budget, PAYG overage, and 401 vs 403.
- Ran `omp usage` from source with a Vibe sign-in key:

```
Mistral — 1 account
  ● account 1
      ● Vibe Code Monthly  ████░░░░░░░░░░░░░░░░░░░░░░░░  15.5% used · resets in 20d9h
        Monthly budget: 255 EUR
      ● API Monthly        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0.0% used · resets in 20d9h
        Monthly budget: 25.5 EUR
  capacity: Vibe Code Monthly → 0.16/1 account used (0.84× quota left) · API Monthly → 0.00/1 account used (1.00× quota left)
```

---

- [x] `bun check` passes
- [x] Tested locally
- [x] CHANGELOG updated with the required attribution (if user-facing; internal issue fixes use issue links, external contributions add the PR link and contributor credit after creation)

### Disclosure

I thoroughly reviewed this contribution with Claude Opus 5.5 (low reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This contribution is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence and a live end-to-end run.

If contributions like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
````

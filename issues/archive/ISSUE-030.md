# ISSUE-030 — Status line: Mistral Vibe login keys bill a subscription but render as metered spend

State: Archived
Authorized-Work: Research-and-Reporting
Publication-Target: New-issue
External-Reference: https://github.com/can1357/oh-my-pi/issues/18374
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: UI
Created: 2026-11-07
Updated: 2026-11-08
Source: `upstream/main@f2b795ba747b23d42052184d822b41e3d01357cc`

## Root-Cause

Root-Cause [S]: Every billing-class decision uses `AuthCredentialPool.hasOAuth(provider)`, which is true only for `type: "oauth"` credentials.
`/login mistral` stores the Vibe-minted key as `{ type: "api_key", source: "login" }`, so a subscription-billed credential is classified as metered.

## Reach-and-Impact

Reach [S]: Every `mistral` model while the provider's credentials come from the Vibe browser sign-in; `MISTRAL_API_KEY` and pasted keys are correctly metered.
Impact [S]: The cost segment never shows the subscription marker for Vibe; it shows catalog list-price dollars as if pay-as-you-go spend.
Impact [O]: For catalog rows with zero cost, and before the first priced turn, the cost segment disappears entirely (see Bug-Reproduction).
Impact [O]: The operator's Vibe sessions persist list-price costs (`zai-glm-5-3` ≈ $0.037–0.042 per turn; `deepseek-v4-1-flash-1017` ≈ $0.001–0.004 per turn).
Impact [O]: The local Mistral catalog cache lists zero-cost rows including `mistral-vibe-cli-latest`, `mistral-vibe-cli-fast`, `mistral-vibe-cli-with-tools`, and `mistral-medium-3-5`.
Impact [S]: Advisor spend on Mistral is attributed as metered (`session-advisors.ts:857`, `:1949`, `:2947`).
Boundary: Display and attribution only; persisted `usage.cost` and request routing are unaffected.
Boundary: Reproduced on MOMP, whose pre-fix billing path matched upstream; not yet rendered from an upstream build.

## Evidence

- [S] `packages/ai/src/auth/pool.ts:662` — `hasOAuth` returns `credentials(provider).some(c => c.type === "oauth")`.
- [S] `packages/coding-agent/src/config/model-registry.ts:3783` — `isUsingOAuth(model)` delegates to `credentials.hasOAuth(model.provider)`.
- [S] `packages/tui/src/status-line/footer.ts:201`, `:305` and `segments.ts:807` — `usingSubscription` is `isUsingOAuth(state.model)`.
- [S] `packages/tui/src/status-line/metrics.ts:63-72` — no cost, no subscription, and no premium requests render no billing segment.
- [S] `packages/catalog/src/compat/rules/auth/mistral.kdl:6` — the only Mistral login is `login "custom" hook="mistral-vibe-sign-in"`, so `source: "login"` identifies a Vibe key.
- [S] `packages/ai/src/registry/oauth/mistral-vibe.ts:9` and `packages/ai/CHANGELOG.md:40` — the minted key is billed against the Vibe Code quota, not pay-as-you-go credits.
- [S] `packages/ai/src/auth/sqlite-credential-store.ts:142`, `:173` — `source: "login"` is persisted and restored.
- [S] `packages/ai/src/auth-broker/wire-schemas.ts:101` — the broker wire schema carries `source?: 'login'`.
- [O] Broker-host `agent.db` row: `mistral | api_key | login` (2026-11-07).
- [O] On a broker client (MOMP `personal@a421341b45`), `discoverAuthStorage().credentials.list("mistral")` returns `{ type: "api_key", source: "login" }` and `hasOAuth("mistral")` is `false` (2026-11-07).

## Prior-Art

Coverage: upstream issues and PRs searched for `mistral subscription`, `vibe quota`, `mistral login`, `isUsingOAuth`, and `subscription cost footer api key`; local `ISSUES.md` and `issues/` searched for subscription, vibe, and `isUsingOAuth`; checked=2026-11-07.
- #17672 (merged) adds Vibe sign-in and states the key bills the Vibe quota; it does not change billing-class display. Origin of the gap, not an owner of the fix.
- #13875 (open, stale) is the earlier revision of #17672; same classification.
- #8247 (open) requests splitting session cost into subscription and direct totals. Related, distinct root cause: it needs a per-message billing class, while this finding misclassifies a credential. Its fix would consume the same predicate.
- #5114 (closed) renamed the OAuth billing marker; no credential classification change.
- #10131 (merged) removed a per-frame catalog scan in the cost segment; constrains the fix to a cheap per-render predicate.
Gaps: Upstream Discord not searched.

Contribution fit: A focused upstream pull request; no existing thread owns credential billing classification.

## Bug-Reproduction

Environment: installed MOMP `18.18.0-mikeei-1` (upstream `18.18.0` base, no fork delta in the billing path), auth broker client, `mistral` credential `{ type: "api_key", source: "login" }`, default status line.
Reproduction: `momp --model mistral/zai-glm-5-3` in a 160×40 tmux pane; capture the status line before sending a prompt.
Actual [O]: `╭── ⬢ GLM-5.3 · ◑ med   🗑 /tmp   ◫ 5.5%/450K ⟲ ───…╮` — no billing segment.
Expected: The subscription marker, as for OAuth plans: `… ⟲   (sub) ───…╮`.
Fix [O]: The MOMP interim patch renders `╭── ⬢ GLM-5.3 · ◑ med   🗑 /tmp   ◫ 5.5%/450K ⟲   (sub) ───…╮` in the same setup (source CLI, 2026-11-07).

## Proposed-Change

Proposal-Status: Not implemented.
- [S] Add auth axis `login-subscription #true` to `auth/mistral.kdl`, compiled to `CompiledAuthProvider.loginSubscription` beside `orgScopedIdentity`.
- [S] Add `credentials.hasSubscription(provider)`: any OAuth credential, or an `api_key` with `source: "login"` when the provider declares `login-subscription`.
- [S] Expose it through the thread auth RPC (`auth-protocol.ts`, `auth.ts`, `auth-remote.ts`) for worker sessions.
- [S] Use it for billing decisions only: status line cost (`footer.ts`, `segments.ts`, startup cache), and advisor attribution.
- [S] Keep `hasOAuth` for OAuth semantics: `/provider` auth mode, Anthropic OAuth cache tier (`agent-session.ts:6226`), and Gemini web search.
- Upstream (issue with proposed fix, selected 2026-11-07): report the defect and link the verified reference implementation; no pull request.
- Fork interim (contract `MOMP-SUBSCRIPTION-BILLING`) was removed once upstream v18.18.1 shipped the same classification.

## Scope-and-Constraints

- Preserve: OAuth providers keep their current subscription display; env and pasted Mistral keys stay metered.
- Preserve: per-render cost stays a map lookup plus credential scan, per #10131.
- Exclude: per-message billing-class totals (#8247), Vibe quota usage display, and zero-cost catalog pricing.
- Boundary [S]: a pool mixing a Vibe key and a console key reports subscription, matching current OAuth `some()` semantics.
- Adoption cost: no credential schema, broker, or migration change; existing Vibe logins already carry `source: "login"`.

## API-and-Compatibility

Callers [S]: `ModelRegistry.isUsingOAuth` consumers in `tui/src/status-line/*`, `coding-agent` interactive mode, and `session-advisors.ts`; `AuthStorage.credentials` consumers through the thread auth RPC.
Contract [S]: `hasOAuth` means a stored OAuth credential exists.
Compatibility: `hasOAuth` keeps its meaning; the new predicate is additive.
Migration: None.

## Verification

- `bun run gen:compat`, then `packages/catalog/test/compat-compile.test.ts` covers the new axis.
- `packages/ai/test/auth-storage-subscription.test.ts` (fork): Vibe login key subscribes; console key and login keys on unflagged providers stay metered.
- `packages/coding-agent/test/advisor-toggle.test.ts`: restored advisor attribution follows `hasSubscription`.
- Live [O]: a broker-client TUI on `mistral/zai-glm-5-3` renders `(sub)` (Bug-Reproduction).
- Reference implementation: `MikeeI/oh-my-pi@ad6dda05cd650508e0932ebd071b08605029755c` (`fix/issue-030`, base `f2b795ba74`, 15 files, +91/−12, no fork-only files).
- [O] Clean `f2b795ba74` source CLI, same setup → `◫ 4.5%/450K ⟲ ───` (no billing segment); `ad6dda05cd` → `◫ 4.5%/450K ⟲   (sub) ───`.
- [O] On `ad6dda05cd`: `bun run check:ts` exit 0; 94 tests across `auth-storage-subscription`, `advisor-toggle`, `compat-compile`, `status-line-cost-segment`, `auth-hooks-registry` pass.

## Publication-Draft

Target: `can1357/oh-my-pi`, Bug Report form.
Title: `Mistral Vibe sign-in usage renders as pay-as-you-go spend, or no cost segment, instead of subscription`

Description:

```markdown
`/login mistral` (Mistral Vibe browser sign-in, #17672) stores the minted key as a plain `api_key` with `source: "login"`. As #17672 states, usage of that key "is billed against the plan's Vibe Code quota, not pay-as-you-go API credits".

The status line disagrees. Every billing-class decision asks `credentials.hasOAuth(provider)`, which only accepts `type: "oauth"`:

- [`pool.ts#L662`](https://github.com/can1357/oh-my-pi/blob/f2b795ba747b23d42052184d822b41e3d01357cc/packages/ai/src/auth/pool.ts#L662): `hasOAuth` is `type === "oauth"`.
- [`model-registry.ts#L3783`](https://github.com/can1357/oh-my-pi/blob/f2b795ba747b23d42052184d822b41e3d01357cc/packages/coding-agent/src/config/model-registry.ts#L3783): `isUsingOAuth(model)` delegates to it.
- [`footer.ts#L201`](https://github.com/can1357/oh-my-pi/blob/f2b795ba747b23d42052184d822b41e3d01357cc/packages/tui/src/status-line/footer.ts#L201), [`segments.ts#L807`](https://github.com/can1357/oh-my-pi/blob/f2b795ba747b23d42052184d822b41e3d01357cc/packages/tui/src/status-line/segments.ts#L807): `usingSubscription` comes from `isUsingOAuth`.
- [`metrics.ts#L63-L72`](https://github.com/can1357/oh-my-pi/blob/f2b795ba747b23d42052184d822b41e3d01357cc/packages/tui/src/status-line/metrics.ts#L63-L72): no cost and no subscription render no billing segment.

So Vibe usage shows catalog list prices as if it were metered spend. When the cost is zero (before the first priced turn, or on a zero-priced catalog row) the billing segment disappears entirely. Advisor spend on Mistral is attributed as metered too ([`session-advisors.ts#L857`](https://github.com/can1357/oh-my-pi/blob/f2b795ba747b23d42052184d822b41e3d01357cc/packages/coding-agent/src/session/session-advisors.ts#L857)).
```

Steps to Reproduce:

```markdown
1. `/login mistral` and complete the Mistral Vibe browser sign-in.
2. Start `omp --model mistral/zai-glm-5-3` (a source build at `f2b795ba74` reproduces it).
3. Look at the status line before sending a prompt:
   `╭── ⬢ GLM-5.3 · ◑ med   🗑 /tmp   ◫ 4.5%/450K ⟲ ───…╮` (no billing segment)
```

Expected Behavior:

```markdown
The subscription marker, as for OAuth plans:
`╭── ⬢ GLM-5.3 · ◑ med   🗑 /tmp   ◫ 4.5%/450K ⟲   (sub) ───…╮`

`MISTRAL_API_KEY` and pasted Mistral keys should stay metered.
```

Platform: `Linux`
omp version: `18.18.0 (source build at f2b795ba74)`
Bun version: `1.4.4`
Provider: `Other`
Area: `TUI / Display`

Additional context:

```markdown
## Proposed fix

The credential already carries the needed signal (`source: "login"`), and it already survives SQLite and the auth broker (`wire-schemas.ts` carries `source?: 'login'`), so no schema, broker, or migration change is needed:

- Add an auth axis `login-subscription #true` to `auth/mistral.kdl`, compiled to `CompiledAuthProvider.loginSubscription` next to `orgScopedIdentity`. Only the Vibe sign-in stores `source: "login"` for `mistral`.
- Add `credentials.hasSubscription(provider)`: any OAuth credential, or an `api_key` with `source: "login"` on a `login-subscription` provider. Expose it through the thread auth RPC for worker sessions.
- Use it for billing decisions only: `ModelRegistry.isUsingOAuth` (status line, live advisors) and restored advisor attribution. Keep `hasOAuth` OAuth-only for `/provider`, Gemini search, and the Anthropic cache tier.
- Optionally rename `isUsingOAuth` to `isUsingSubscription`; I left it out to keep the change small.

A verified reference implementation is on my fork: https://github.com/MikeeI/oh-my-pi/commit/ad6dda05cd650508e0932ebd071b08605029755c (15 files, +91/−12, based on `f2b795ba74`). With it, the same reproduction renders `(sub)`; `bun run check:ts` passes, and the focused tests (`auth-storage-subscription`, `advisor-toggle`, `compat-compile`, `status-line-cost-segment`, `auth-hooks-registry`) pass, including a new regression test for the credential classification.

Related but distinct: #8247 asks for per-message subscription/direct cost totals; this issue is only about how a credential is classified.

I checked the relevant issues, pull requests, and #17672; this report is not a duplicate.

I am reporting this finding only and am not currently proposing a pull request.

### Disclosure

Investigated thoroughly with Claude Opus 5.5 (medium reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.

This report is not generic or unreviewed AI-generated output. Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.

If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones. My intent is to help without wasting maintainer time or energy or discouraging their work.

Thank you for your work.
```

## Publication-Blockers

None.

## Next-Action

Summary: —
Action: None.
Done-When: None.

## Archive

Archive-Reason: Fixed-Elsewhere
Detail: None.
Evidence: https://github.com/can1357/oh-my-pi/pull/18378 — PR state `MERGED` at 2026-11-07T12:19:26Z; #18374 closed at 2026-11-07T12:19:28Z; present in v18.18.1 as `AuthCredentialPool.hasSubscription`, `login-subscription #true` and `ModelRegistry.isUsingSubscription`; the fork interim was removed during the 18.18.1 upgrade.
Checked: 2026-11-08

# ISSUE-030 — Status line: Mistral Vibe login keys bill a subscription but render as metered spend

State: Investigating
Authorized-Work: Not-Selected
Publication-Target: Not-Selected
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: UI
Created: 2026-11-07
Updated: 2026-11-07
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
- Upstream PR: rename `ModelRegistry.isUsingOAuth` to `isUsingSubscription` across callers and fixtures.
- Fork interim (implemented on `personal`, contract `MOMP-SUBSCRIPTION-BILLING`): all of the above, keeping the `isUsingOAuth` name.

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

## Publication-Blockers

- Footer not yet rendered from an upstream build; the MOMP reproduction stands in for it.
- The user has not selected Authorized-Work or Publication-Target.
- Current upstream contribution guide and PR template not yet read for this finding.

## Next-Action

Summary: Await upstream contribution decision
Action: Ask the user to select Authorized-Work and Publication-Target for the upstream fix.
Done-When: The user selects both or declines upstream contribution.

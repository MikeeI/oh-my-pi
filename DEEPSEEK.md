# DEEPSEEK.md — Unexpected Cache-Collapse Detection

Vorschlag und Design für MOMP: Erkennung von **unerwarteten** Prompt-Cache-Kollapsen, sichtbar live und retrospektiv.
Zweck: Der Operator sieht, wann der Provider-Cache massiv kalt wurde, ohne dass er selbst eine cache-wirksame Änderung ausgelöst hat.

## 1. Ziel und Abgrenzung

- Detektieren: Ein Turn liest einen großen warmen Prefix, der Folgeturn bricht auf `cacheRead: 0` zusammen und bleibt kalt.
- Alarm nur, wenn **keine** cache-wirksame Änderung (Reasoning, Modell, Tool-Set, System-Prompt) vorliegt.
- Alarm nur bestätigt (deferred): Der Marker erscheint erst, wenn der Folgeturn den Kollaps bestätigt.
- Nicht alarmen: erster Turn, Tiny-Kontext, erwartbare Invalidierung (Reasoning/Modell/Tools/System geändert), TTL-Idle-Expiry.
- Nicht alarmen: Anthropic/Bedrock-explicite Neuschreibung (schon gedeckt) und das dokumentierte OpenAI-Ein-Turn-Rauschen.

## 2. Ist-Lage (Befund, mit Evidenz)

Das Feature existiert bereits teilweise upstream, ist aber für den Zielprovider (OpenAI) bewusst tot.

- `packages/coding-agent/src/modes/components/cache-invalidation-marker.ts` implementiert `detectCacheInvalidation` + `CacheInvalidationMarkerComponent`.
- `packages/coding-agent/src/config/settings-schema.ts:1035` `display.cacheMissMarker`, Default `false`.
- Der Guard `if (current.cacheWrite <= 0) return undefined` (Zeile 58–62) schließt OpenAI/Google/Fireworks aus.
- Commit `3c90f3bdd1` führt den Guard explizit ein („ignored cache invalidation false positives for implicit providers").
- `packages/coding-agent/test/cache-invalidation-marker.test.ts:54` beweist, dass ein OpenAI-artiger Fall (warm 40.8k, cold 43.1k, `cacheWrite: 0`) nicht geflaggt wird.
- Grund: Implicit caches melden `cacheWrite: 0` und `cacheRead: 0` intermittierend als Propagation-Rauschen, das sich im nächsten Turn selbst heilt.
- Der bestehende Detektor ist rein usage-basiert und hat keine Attibutions-Dimension.

Das Kernproblem: Auf OpenAI ist ein echter Kollaps usage-mäßig identisch mit dem Ein-Turn-Rauschen.
Ein erwartbarer Reasoning-Miss heilt sich im Folgeturn ebenfalls selbst.
Usage allein kann die Fälle nicht trennen — deshalb hat upstream OpenAI komplett rausgeworfen.

## 3. Vorgeschlagene Lösung

Ersetze die reine Paar-Heuristik durch einen zustandsbehafteten Tracker mit Deferred-Confirmation.
Der Persistenzcheck über den Folgeturn trennt echtes Verlust-Event von Rauschen und erwartbarem Einzel-Miss.

### 3.1 Algorithmus (Kern)

Zustand pro Session: letzter warmer Turn (`lastWarmCacheRead`), ein offener Kandidat (`pending`).

- **Kandidat (Turn N):** `lastWarmCacheRead >= MIN`, `u.cacheRead == 0`, kein Attibutionswechsel.
  `reprocessed = u.cacheWrite + u.input >= MIN` => Kandidat `{ start: N, accumulated: reprocessed }` öffnen.
- **Bestätigung (Turn N+1):**
  - `u.cacheRead > 0` => selbstgeheilt, Kandidat verwerfen (Rauschen oder erwartbarer Einzel-Miss). Kein Alarm.
  - Attibutionswechsel in N+1 => Kandidat verwerfen (attribuierbare Neu-Invalidierung). Kein Alarm.
  - `u.cacheRead == 0`, kein Attibutionswechsel => bestätigt. Marker auf Turn N, `reprocessed = N + N+1`.
  - trivialer N+1 (reprocessed < MIN) => nicht bestätigbar, Kandidat verwerfen (konservativ, kein False-Positive).

Der Tracker konsumiert pro Turn: `feed(turnIndex, usage, attributionChanged)`.
Er emittiert nur bestätigte Kollapse als `{ turnIndex, reprocessedTokens, coldTurns }`.

### 3.2 Attributions-Veto

Reasoning-/Modell-Wechsel (und damit cache-wirksame Änderungen) verwenden bereits `clearInheritedProviderPromptCacheKey` in `model-controls.ts:508/538` und `agent-session.ts:7384`.
Diese Seams rufen zusätzlich `tracker.noteAttributableInvalidation()` auf, was einen offenen Kandidaten verwirft.
Damit wird der „unerwartete"-Anspruch erzwungen, ohne den ganzen Request zu fingerabdrücken.

### 3.3 Nutzeroberfläche

Marker nur nach Bestätigung, retroaktiv auf Turn N gesetzt: `⊘ unexpected cache loss · N tokens`.
Live erscheint er im Moment der Bestätigung (Folgeturn), nicht am kalten Turn selbst.
Beim Transcript-Rebuild wird der Tracker über alle Turns in Reihenfolge gefahren; bestätigte Markers erscheinen dort.
Zusätzlich `reprocessedTokens` × Cache/Input-Preis als Kosten-Verlust ausgeben (handelbare Information).

## 4. Betroffene Dateien und Änderungen

- `cache-invalidation-marker.ts` — Tracker-Klasse erweitern (`CacheCollapseTracker`), `detectCacheInvalidation` beibehalten oder ablösen; `MIN_CACHE_FOOTPRINT` wiederverwenden.
- `event-controller.ts:1286` — Live-Pfad: Tracker füttern, bestätigte Events auf `streamingComponent` setzen.
- `chat-transcript-builder.ts:334` — Rebuild-Pfad: Tracker über alle Turns fahren.
- `ui-helpers.ts:471` — Rebuild/Rebuild-Fallback: Tracker fahren, `cacheMissExplainedAt`-De-Dup beibehalten.
- `model-controls.ts` / `agent-session.ts` — bei Reasoning-/Modell-Wechsel `noteAttributableInvalidation()` aufrufen.
- `settings-schema.ts:1035` — `display.cacheMissMarker` Default prüfen (bleibt `false`; Operator opt-in).
- `test/cache-invalidation-marker.test.ts` — Tracker-Semantik testen (Bestätigung, Selbstheilung, Attibutions-Veto, trivialer Folgeturn).

## 5. Observable Contract (für AGENTS.md-Inventar)

- Disposition: MOMP-eigen, designed für upstream.
- Ein bestätigter unerwarteter Kollaps rendert `⊘ unexpected cache loss · N tokens` auf dem ersten kalten Turn.
- Ein selbstgeheilter Folgeturn rendert nie einen Marker (Rauschen/erwartbarer Einzel-Miss).
- Ein Attibutionswechsel im Fenster rendert nie einen Marker.
- Ein trivialer Folgeturn bestätigt keinen Marker.
- Erst-Turn, Tiny-Kontext und TTL-Idle-Expiry alarmieren nicht.

## 6. Non-Goals

- Kein Alarm auf erwartbare Invalidierung (Reasoning/Modell/Tools/System geändert).
- Kein Ein-Turn-Frühalarm (nur bestätigt, deferred).
- Kein eigener Cache-Verwaltungspfad; der Cache bleibt Provider-Sache.
- Kein Ändern des `prompt_cache_key` (session-stabil bleiben).

## 7. Risiken und Unsicherheiten

- Es ist eine Erweiterung eines upstream-owned Moduls; als minimaler Fork-Delta und potenziell upstreamable halten.
- OpenAI-`cacheWrite: 0`-Annahme stammt aus Code-Kommentar, nicht aus eigener Live-Messung.
  Vor dem Freigeben gegen aktuelle OpenAI-Responses-Payloads verifizieren.
- Ob das intermittierende `cacheRead: 0` auch auf OpenAI (nicht nur Gemini/Fireworks) auftritt, ist offen.
  Die Persistenz-Bestätigung entschärft diese Unsicherheit bei Ihrem Verhalten.
- Wiederholte Reasoning-Wechsel Turn-auf-Turn werden durch das Attibutions-Veto abgefangen.

## 8. Verifikation vor Abschluss

- `bun test cache-invalidation-marker.test.ts` — Tracker-Semantik grün.
- `bun check` — Typen der betroffenen Pakete sauber.
- Manuell: warm->kalt->kalt zeigt Marker; warm->kalt->warm zeigt keinen; Reasoning-Wechsel zeigt keinen.

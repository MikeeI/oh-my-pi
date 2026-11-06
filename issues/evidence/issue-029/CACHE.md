# Prompt-Caching bei Subagents

Archive copy of root `CACHE.md` from 2026-10-24, owned by [ISSUE-029](../../ISSUE-029.md) and cited by [ISSUE-028](../../ISSUE-028.md).
Lines about the Child prompt layout, Anthropic anchoring, and unapplied patch drafts describe the state before `MOMP-PROJECT-CACHE-ANCHOR`.

Stand: 2026-10-24, Branch `personal`, Modelle `openai-codex/gpt-6-luna` und Anthropic Claude.
Untersucht wurde, ob nacheinander oder parallel gestartete Task-Children vom Prompt-Cache ihrer Geschwister profitieren.

## Ergebnis

- Caching passiert bei Anthropic und Codex automatisch; keine Einstellung ist nötig.
- Anthropic ist gezielt auf geteilte Child-Präfixe ausgelegt; offen bleibt nur der Projekt-Kontext mit etwa 690 Tokens.
- Codex verteilt Cache-Affinität über den `session_id`-Header, nicht über `prompt_cache_key`.
- Jedes Child sendet heute seine eigene Session-ID, daher treffen Geschwister nur zufällig.
- Ein geteilter Session-Header hebt die Trefferquote nach einem ersten Geschwister auf 92–97 %, auch bei parallelen Children.
- Die realistische Ersparnis beträgt etwa 6 $ pro Monat in API-Preisen, rund 1 % der Child-Kosten.
- Der Codex-Patch ist als Upstream-Beitrag sinnvoll, als dauerhafter MOMP-Fork-Patch nicht.
- Der Anthropic-Patch für den Projekt-Kontext lohnt sich nicht.

## Aufbau des Child-Prompts

Gemessen mit `momp system-prompt inspect --subagent <name> --breakdown --json` in diesem Repository (o200k-Tokens):

| Teil | `task` | `scout` | Für Geschwister gleich |
|---|---|---|---|
| Statischer Basis-Prompt (Block 0) | 12.702 | 9.283 | ja |
| Tool-Beschreibungen und Schemas | 6.813 | 2.506 | ja, je Agent-Typ |
| `<project-context>`: Workstation, Dir-Context, Workspace-Tree | 688 | 688 | ja, bei gleichem cwd |
| Child-Wrapper (`SUBAGENT-SYSTEM.template.md`) | 741 | 1.025 | nein, pro Spawn |

- Children erhalten keine AGENTS.md; der Projekt-Kontext ist deshalb klein.
- Rund 95 % des Child-Prompts sind für Geschwister desselben Agent-Typs identisch.
- Datum und cwd stehen nicht im System-Prompt, sondern in der ersten User-Nachricht (`DateCwdReminderInjector` in `src/sdk.ts`).
- Verschiedene Agent-Typen haben verschiedene Tool-Sets und teilen daher kein Präfix.

## Anthropic

- `applyHeadCaching` in `packages/ai/src/providers/anthropic.ts` setzt `cache_control` auf das letzte Tool und den letzten stabilen System-Block.
- Blöcke, die mit `<project-context>` oder `<memories>` beginnen, gelten als volatil; der System-Anker liegt direkt davor.
- `applyPromptCaching` verteilt die restlichen Breakpoints auf das Nachrichtenende und Dezimations-Checkpoints, maximal vier insgesamt.
- Der Child-Wrapper steht hinter Basis-Prompt und Projekt-Kontext (`src/task/subagent-system-prompt.ts`), damit das gemeinsame Präfix stabil bleibt.
- `providers.cacheRetention: auto` ergibt 1 h bei OAuth-Abo und 5 min bei API-Key; der verwaltete `config.yml` setzt keinen Wert.
- Children laufen mit `cacheWarming: false`; für den Cache zwischen Geschwistern spielt das keine Rolle.
- Geteilt werden Tools und statischer System-Prompt; Projekt-Kontext, Wrapper und Aufgabe werden pro Child neu berechnet.
- Parallel gestartete Children können den Cache-Eintrag ihrer Geschwister nicht nutzen, solange noch keine Antwort begonnen hat.
- Im OAuth-Modus steht vor dem Anker ein Billing-Header mit pro Request wechselndem `cch=`-Hash.
- Annahme, nicht verifiziert: Anthropic ignoriert diesen Block beim Cache-Abgleich wie bei Claude Code; drei nacheinander gestartete Children trafen mit 73–84 %.

## Codex

- `getOpenAIPromptCacheKey` sendet `prompt_cache_key = promptCacheKey ?? sessionId`.
- Die Header `session_id` und `conversation_id` erhalten `parentSessionId ?? sessionId` (`openai-codex-responses.ts`, Request-Header-Aufbau).
- Children setzen weder `parentSessionId` noch einen gemeinsamen Key; jedes Child nutzt seine eigene `providerSessionId` (`src/sdk.ts`).
- Der Katalog-Mechanismus `task-sibling-prompt-cache` teilt nur den Key `${parentKey}:${agent.name}` und ist nur für Muse-Code-Modelle aktiviert.
- Für Codex wäre dieser Mechanismus in der heutigen Form wirkungslos, weil er den Session-Header nicht ändert.
- WebSocket-Verbindungen sind pro `sessionId` getrennt (`getCodexWebSocketSessionKey`); Children teilen keine Verbindung.

## Experimente

Alle Experimente verwenden den echten `task`-Child-Prompt mit einer eindeutigen Markierung am Anfang, damit kein früherer Cache mitzählt.
Gemessen wurde `cacheRead` der Folge-Requests nach einem ersten Request.

### Experiment 1: CLI, separate Prozesse

Aufbau: `momp -p --mode json --no-session --no-tools`, 17,3k Tokens Prompt, 8 Gruppen mit je einem ersten Request und 4 Folge-Requests nacheinander.

| Variante | Treffer |
|---|---|
| Eigene Session (heutiges Verhalten) | 3/32 und 2/32 |
| Nur `--prompt-cache-key` geteilt | 3/32 |
| `--provider-session-id` geteilt | 32/32, 99,7 % des Prompts gecacht |

### Experiment 2: im Prozess, Patch-Form

Aufbau: `completeSimple` mit eigener `sessionId` pro Request und geteiltem `parentSessionId`, 13k Tokens Prompt, 9 Gruppen mit je 4 Folge-Requests.

| Variante | Treffer | Fehler |
|---|---|---|
| Header geteilt, erster Request, danach 4 nacheinander | 35/36 (97 %) | 0 |
| Header geteilt, erster Request, danach 4 parallel | 33/36 (92 %) | 0 |
| Header geteilt, 4 parallel ohne ersten Request | 15/36 (42 %) | 0 |
| Eigene Session, erster Request, danach 4 parallel | 2/36 (6 %) | 0 |

- Ein geteilter Header bei getrennten Session-IDs verursachte keine Konflikte mit Turn-State, keine Ablehnungen und keine Rate-Limit-Fehler.
- Auch eine parallele Welle ohne vorherigen Request trifft teilweise; das Backend nutzt offenbar ein gerade berechnetes Präfix auf demselben Server.
- Grenze: Das waren separate API-Aufrufe, keine echten Task-Children.

## Auswertung der Session-Logs

Grundlage: 2036 Child-Sessions der letzten 21 Tage unter `~/.omp/agent/sessions/*/*/`, jeweils der erste Request mit Usage.

| Provider | Abstand zum vorherigen Geschwister | n | Treffer | Mittlerer gecachter Anteil |
|---|---|---|---|---|
| openai-codex | < 5 s (parallel) | 1281 | 42 % | 0,33 |
| openai-codex | 5 s – 5 min | 94 | 48 % | 0,37 |
| openai-codex | 5 min – 1 h | 245 | 43 % | 0,34 |
| openai-codex | > 1 h | 75 | 20 % | 0,14 |
| anthropic | < 5 s (parallel) | 67 | 34 % | 0,28 |
| anthropic | nacheinander | 3 | 100 % | ≈ 0,8 |

Die Codex-Treffer hängen von der Nutzung desselben Modells in den zehn Minuten davor ab, nicht von vorherigen Geschwistern:

| Gleiches Modell zuvor, andere Eltern-Sessions | Ohne Geschwister davor | Mit Geschwister davor |
|---|---|---|
| 0 | 18 % | 23 % |
| 1–5 | 42 % | 45 % |
| 6+ | 56 % | 68 % |

- Deutung, nicht von OpenAI bestätigt: Ohne Session-Bindung wird zufällig verteilt, und ein häufig genutztes Präfix liegt auf vielen Servern.
- Das erklärt die Lücke zwischen 42 % in den Logs und etwa 6 % im Experiment mit eindeutigem Präfix.
- Eine Header-Bindung verliert diesen Effekt nicht; nur Geschwister nach dem ersten Child werden gezielt geroutet.
- Grenzen: Zeitstempel sind die der ersten Antwort, und Agent-Typen sind gemischt.

## Ersparnis

Zeitraum 20,8 Tage; Preise aus den Logs, zum Beispiel `gpt-6-luna` 0,10 $/M Input und 0,01 $/M Cache-Read.
Bei ChatGPT Pro sind API-Preise nur ein Maß für das Kontingent.

| Änderung | Requests | Treffer heute | Treffer neu | Ersparnis pro Monat |
|---|---|---|---|---|
| Codex, Geschwister nacheinander | 414 | 40 % | ≈ 95 % | ≈ 3,10 $ |
| Codex, Geschwister in paralleler Welle | 1.281 | 42 % | ≈ 66 % geschätzt | ≈ 2,80 $ |
| Anthropic, Breakpoint nach Projekt-Kontext | 70 | – | – | ≈ 0,27 $ |

- Die Codex-Summe von etwa 6 $ pro Monat entspricht gut 1 % der Child-Kosten von etwa 590 $ pro Monat.
- Der Wellen-Wert kombiniert 42 % Popularität und 42 % Wellen-Treffer unter Unabhängigkeitsannahme.
- Die Ersparnis betrifft nur den ersten Request eines Childs; spätere Requests treffen bereits den eigenen Cache.
- Pro getroffenem Child entfallen 13–17k Tokens Prefill; die Latenz wurde nicht gemessen.

## Patch-Entwürfe

Keiner der Entwürfe ist angewendet.

### Codex: Cache-Key auch als Session-Header

```diff
--- packages/ai/src/providers/openai-codex-responses.ts
@@ createCodexRequestContext
-		affinitySessionId: normalizeOpenAIPromptCacheKey(options?.parentSessionId),
+		// The backend routes cache affinity by session headers, not `prompt_cache_key`
+		// (measured: shared key 3/32 hits, shared session header 32/32).
+		affinitySessionId: normalizeOpenAIPromptCacheKey(
+			options?.parentSessionId ??
+				(options?.promptCacheKey !== options?.sessionId ? options?.promptCacheKey : undefined),
+		),
--- packages/catalog/src/compat/rules/providers/openai-codex.kdl
+	task-sibling-prompt-cache #true
```

- Children behalten ihre eigene `sessionId`; WebSocket- und Turn-State bleiben getrennt.
- Forks mit geerbtem Key würden ebenfalls an den Server der Eltern-Session gebunden; das ist erwünscht, aber eine zu testende Verhaltensänderung.
- Empfehlung: als Upstream-Beitrag vorschlagen, zusammen mit dem Befund, dass der Key-Mechanismus bei Codex wirkungslos ist.

### Anthropic: Breakpoint nach dem Projekt-Kontext

```diff
--- packages/ai/src/providers/anthropic.ts
@@ function applyHeadCaching(
 	cacheControl?: AnthropicCacheControl,
+	freshSession = false,
 ): void {
@@
 			anchor.cache_control = cloneAnthropicCacheControl(cacheControl);
 		}
+		// Same-cwd siblings share <project-context>; a first request has idle message budget.
+		const contextEnd = freshSession ? lastProjectContextBlock(systemBlocks, suffixStart) : -1;
+		if (contextEnd > anchorIndex) systemBlocks[contextEnd].cache_control = cloneAnthropicCacheControl(cacheControl);
```

- Empfehlung: nicht umsetzen; die Ersparnis rechtfertigt keinen Fork-Patch.

## Praktische Hinweise

- Bei vielen Children desselben Typs zuerst eines starten und den Rest danach parallel; bei Anthropic zahlt sonst jeder Child sein eigenes Cache-Write.
- Gleiche Agent-Typen bündeln; verschiedene Typen teilen kein Präfix.

## Offene Punkte

- Echter Task-Fan-out mit dem Codex-Patch in einem Worktree.
- Latenzgewinn der ersten Antwort in Sekunden.
- Auswirkung der Header-Bindung auf Forks und `/tan`-Klone.
- Verifikation, dass der OAuth-Billing-Header den Anthropic-System-Cache nicht bricht.

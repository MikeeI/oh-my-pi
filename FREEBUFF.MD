# PERFORMANCE-ANALYSE

Analysierte Dateien: 30 · Gefundene Optimierungen: 3

Repo: MOMP / oh-my-pi Fork (can1357/oh-my-pi). Fokus: `packages/coding-agent/`, `python/omp-rpc`, `python/robomp`, `packages/catalog`.

Hinweis zur Gesamtlage: Die heißen Pfade des Repos sind bereits außergewöhnlich gut optimiert — Signatur-gegateter System-Prompt-Rebuild, koaleszierende Streaming-Renderer, stat-identity-gecachte Session-Listings, Memoization der Token-Berechnungen, gebundene Event-Historien, parallelisierte Conversation-Suche und ein in Threads ausgelagertes Dashboard. Die folgenden Befunde sind die einzigen strukturellen Redundanzen, die die Validierung (Reachability, Frequenz, Kostenmodell, verhaltenserhaltender Fix) überstanden haben.

# MITTEL

## # P1: Unabhängige GitHub-Thread-Fetches im robomp-Task-Setup parallelisieren

- Ort: `python/robomp/src/tasks.py:104-183`
- Schweregrad: Mittel
- Kategorie: Parallelisieren
- Hot Path: pro Task-Setup (`triage_issue`, `handle_comment`, `handle_review`, `review_pr`; Aufrufer unter `tasks.py:196,489,542,571,815-817`)
- Kostenmodell: 2-4 unabhängige HTTP-Calls à 100-500ms addieren sich seriell auf dem kritischen Pfad vor dem Agent-Start.
- Auswirkung:
    - Task-Setup-Latenz sinkt von der Summe auf das Maximum der Thread-Calls.
    - Bei einem PR mit Comments + Reviews spart `_fetch_thread` etwa 200-1500ms pro Task.
- Muster:
    - Die vier Endpoints hängen nur von `(repo, number)` ab und können parallel laufen.
    - `get_issue`, `list_comments`, `list_review_comments`, `list_pr_reviews` laufen aktuell strikt sequenziell.
- Beleg:
    - `_fetch_thread` ruft die Calls nacheinander auf (`tasks.py:121`, `136`, `151`, `166`).
    - Kein Call konsumiert das Ergebnis eines vorherigen; alle Ergebnisse werden erst am Ende sortiert.
    - Jeder Call ist bereits einzeln in `try/except` isoliert — die Fehlersemantik ist pro Endpoint droppbar.
- Fix:
    - Starte die vier Fetches via `asyncio.gather(..., return_exceptions=True)` (bzw. separate Tasks) und behalte die bestehende per-Endpoint-Fehlerbehandlung bei.
    - Sortiere weiterhin nach `created_at`; die Ausgabe bleibt byte-identisch.
- Prüfung:
    - Messe die `_fetch_thread`-Dauer vor/nach mit einem PR, der Comments + Reviews hat.
    - Prüfe, dass ein einzelner fehlschlagender Endpoint weiterhin nur sich selbst droppt und der Rest läuft.

## # P2: O(N²)-Event-Rescan in RPC `_wait_for_agent_end` durch Terminal-Flag ersetzen

- Ort: `python/omp-rpc/src/omp_rpc/client.py:1326-1372`
- Schweregrad: Mittel
- Kategorie: Kurzschließen
- Hot Path: pro Event einer jeden `prompt_and_wait`/`wait_for_idle`/`collect_events`-Runde
- Kostenmodell: jeder Event-Append weckt den Waiter; jeder Wakeup kopiert und scannt alle Events seit `start_index` → O(N²) pro Turn, bei `max_event_history=50_000` (robomp) ~1,25 Mrd. Elemente.
- Auswirkung:
    - CPU-Last wächst quadratisch mit der Event-Zahl langer Agent-Runs.
    - Bei langen Tasks (50k Events) entsteht ~1-3s reine Kopier-/Scan-Arbeit über die Rundzeit verteilt; bei interaktiven Turns mit wenigen hundert Events vernachlässigbar.
- Muster:
    - Ein O(1)-Bool „terminales `agent_end` gesehen" ersetzt den teuren Snapshot+Scan bei jedem Wakeup.
    - `_wait_for_agent_end` kopiert aktuell bei jedem Notify `self._events.snapshot_from(start_index)` und scannt es mit `any(...)`.
- Beleg:
    - `_append_event` ruft bei jedem Event `self._event_condition.notify_all()` auf (`client.py:2097`).
    - Der Waiter führt `snapshot_from(start_index)` + `any(...)` bei jedem Wakeup aus (`client.py:1354-1358`).
    - `_BoundedHistory.snapshot_from` baut eine komplette Tuple-Kopie der akkumulierten Events.
- Fix:
    - Setze ein `_saw_terminal_agent_end`-Flag (gleiches Prädikat wie `_mark_agent_run_completed`) und prüfe es O(1) vor dem Snapshot.
    - Nur wenn das Flag gesetzt ist, Snapshot+Parse einmalig ausführen — Verhalten bleibt identisch, da der terminale `agent_end` das Flag setzt.
- Prüfung:
    - Messe die CPU-Zeit eines langen Runs (z.B. 10k+ Events) vor/nach.
    - Prüfe, dass `prompt_and_wait` weiterhin exakt dasselbe `PromptTurn` (Events + Messages) liefert.

# NIEDRIG

## # P3: Vier Message-Passes in `getSessionStats` zu einem zusammenfassen

- Ort: `packages/coding-agent/src/session/session-stats.ts:53-110`
- Schweregrad: Niedrig
- Kategorie: Vorberechnen
- Hot Path: pro Turn (`agent-session.ts:2627` turn_start, `:2861` agent_end) sowie `/session`, Goal-Runtime und Agent-Hub-Projektion
- Kostenmodell: 4×O(N) Array-Passes über `state.messages` (N = Nachrichten, potenziell tausende große Objekte) pro Aufruf.
- Auswirkung:
    - 3 redundante `.filter(...)`-Pässe entfallen pro `getSessionStats`-Aufruf.
    - Bei mehreren Aufrufen pro Turn und langen Sessions spart das messbar CPU auf dem Per-Turn-Pfad.
- Muster:
    - Ein einziger Pass zählt alle vier Rollen und akkumuliert die Token-Summen gleichzeitig.
    - `userMessages`/`assistantMessages`/`toolResults` werden aktuell je einzeln per `.filter(...).length` berechnet, danach folgt ein weiterer voller Loop.
- Beleg:
    - Drei `.filter(...)`-Zähler (`session-stats.ts:55-57`) plus der nachfolgende `for (const message of state.messages)`-Loop.
    - Alle vier lesen dieselbe `state.messages`-Referenz ohne Zwischenabhängigkeit.
- Fix:
    - In einem einzigen `for`-Loop über `state.messages` die drei Rollenzähler mitführen und parallel die Usage-Akkumulation ausführen.
- Prüfung:
    - Assert, dass `getSessionStats().userMessages/assistantMessages/toolCalls/toolResults/tokens` vor/nach identisch sind.
    - Optional: Mikro-Benchmark mit einer synthetischen Session von ~5k Messages.

---

# DEEP INVESTIGATION: RAM bei einer reinen Text-Chat-Session

Frage: Warum braucht omp in einem Text-Chat so viel RAM, obwohl „nur Text" anfällt und nicht alles geladen sein müsste?

## Kernbefund: Die Konversation wird in einer Live-Session in **mehreren redundanten Formen gleichzeitig** im Speicher gehalten — und nichts davon wird während der Session verworfen.

### 1. `AgentState.messages` — die vollständige Konversation (Modell-Sicht)

- Ort: `packages/agent/src/types.ts:671`, Append-only-Log in `packages/agent/src/append-only-context.ts`
- Der Agent-State hält **alle** Messages inkl. Tool-Calls/-Results für die gesamte Session. Freigegeben wird erst in `dispose()` (`agent-session.ts:4144` `#releaseRetainedSessionMemory`).
- Kein Per-Turn-Trim: `AppendOnlyLog` wächst strikt append-only, außer bei Kompaktion.
- Das ist teils nötig (Modell braucht den Kontext pro Turn), aber es ist die **erste** vollständige Kopie.

### 2. `AppendOnlyContextManager` — eine **zweite** vollständige Kopie der Konversation

- Ort: `packages/agent/src/append-only-context.ts:93-222`, `AppendOnlyLog.#entries`
- Bei `provider.appendOnlyContext` (Default `auto`, für DeepSeek & Co. aktiv) wird jede Konversation zusätzlich **auf Provider-Ebene (`Message[]`)** in `AppendOnlyLog.#entries` dupliziert — inkl. separater `#messageDigests`-Liste pro Message.
- Ergebnis: Die Konversation existiert bei DeepSeek-Nutzern **doppelt** im RAM (AgentMessage[]-Ebene + Message[]-Ebene).

### 3. `TranscriptContainer` — das gerenderte Transkript wird nie virtualisiert

- Ort: `packages/coding-agent/src/modes/components/transcript-container.ts`
- `#lines` (Zeile 181) hält die **komplette gerenderte ANSI-Ausgabe** der ganzen Session als persistente, monoton wachsende Zeichenkette.
- `#segments` (Zeile 182) hält pro Message/Block ein `BlockSegment` (rawRef + contribution + Geometrie).
- Alle Child-Komponenten bleiben für die gesamte Session bestehen. Es gibt **kein Off-Screen-Pruning / keine Virtualisierung** — nur `clear()` (explizites `/clear`, `interactive-mode.ts:1921`) oder `dispose()` räumen auf.
- ANSI-gerenderte Zeilen sind typischerweise 3-5× so groß wie der Rohtext (Escape-Sequenzen, Styles).

### 4. Pro-Message-`Markdown`-Komponenten — mehrere Darstellungen je Nachricht

- Ort: `packages/tui/src/components/markdown.ts:1485-1550`
- Jede Message hält **gleichzeitig**: `#text` (Roh-Markdown), `#cachedLines` (gerenderte ANSI-Zeilen), `#streamPrefixTokens` (Token-Baum), `#streamPrefixLineCache` + `#streamingDiffLineCache`, `#lockedTableLayouts`.
- Für einen langen Text-Chat ist das der dominante per-Message-Wachstumsfaktor in der TUI.

### 5. `RawSseDebugBuffer` — **immer aktiv**, obwohl reines Debug-Material

- Ort: `packages/coding-agent/src/debug/raw-sse-buffer.ts`
- Jedes SSE-Event wird **standardmäßig** in den Buffer aufgenommen (`agent-session.ts:1196-1211`), nicht nur im Debug-Modus.
- Limit: 1.000 Events / 512k Zeichen. **Kritisch:** Jeder getrimmte Record hält einen `slice()` des Eltern-SSE-Frames — unter JSC bleibt dadurch der **ganze mehrfach-MB-Frame** am Leben (Kommentar in `raw-sse-buffer.ts`).
- Bei langen Streams (große Tool-Results über SSE) kann das deutlich mehr als die 512k-Zeichen-Budgetgrenze an echtem Speicher binden.
- Reines Debug-Material — für einen normalen Text-Chat unnötig.

## Was NICHT die Ursache ist (geprüft & entlastet)

- **Session-Persistenz:** Append-basiert (`#appendToSessionFile`, `appendSync` pro Zeile); Voll-Rewrite (`#fileBody()`) nur bei Fehler/Kompaktion. Kein O(Session) pro Message.
- **Session-Laden:** Streaming ab 8MiB (`session-loader.ts` `shouldStreamEntries`); kein Voll-Load großer Dateien.
- **Session-Manager-Entries:** Referenzieren dieselben Message-Objekte wie der Agent-State — keine Duplikate.
- **Caches/Leaks:** Keine unbegrenzt wachsenden Maps/Sets gefunden — Event-Controller pro Turn gecleart, Markdown-LRU begrenzt, SSE-Buffer begrenzt.
- **`snapcompact`:** Default aus (`settings-schema.ts`); keine riesigen base64-PNGs im Normalbetrieb.
- **Tool-Outputs:** Auf 50KB gedeckelt.

## Rangfolge der RAM-Treiber für einen Text-Chat

1. **Bun/JSC-Baseline** — der Bun-Runtime + alle geladenen Module (Tool-Registry, Catalog, TUI, Prompts) haben einen festen Grundbedarf von typischerweise ~100-200MB RSS, unabhängig von der Konversation. Das ist der größte Einzelposten bei „kurzem Chat, viel RAM".
2. **Transkript-Haltung (3+4)** — wächst linear mit der Chat-Länge; gerenderte ANSI + Token-Bäume + Rohtext pro Message.
3. **Doppelte Konversation (1+2)** — `AgentState.messages` + `AppendOnlyLog` bei Prefix-Cache-Providern.
4. **SSE-Debug-Buffer (5)** — konstant begrenzt, aber bei langen Streams durch Frame-Pinning überproportional; immer aktiv.

## Empfohlene Fixes (verhaltenserhaltend)

### R1: `RawSseDebugBuffer` hinter ein Debug-Flag legen

- Der Buffer wird nur vom Debug-Viewer/Report konsumiert (`debug/index.ts`, `debug/raw-sse.ts`). Im Normalbetrieb ist die Aufnahme reines Speicher-Overhead.
- Fix: Aufnahme nur, wenn ein Debug-Viewer abonniert hat oder ein Debug-Flag gesetzt ist; `recordResponse`/`recordEvent` sonst no-op.
- Prüfung: Debug-Report (`/debug`-Bundle) weiterhin identisch, wenn aktiviert; normaler Chat hält keine SSE-Frames mehr.

### R2: Transkript-Virtualisierung / Off-Screen-Prune

- `TranscriptContainer` hält `#lines` + `#segments` + alle Komponenten der ganzen Session. Für sehr lange Chats wächst das ungebremst.
- Fix (Design-Entscheidung, MOMP-SCROLLBACK-Contract beachten): Blöcke, die vollständig im nativen Scrollback committed sind, könnten ihren `rawRef`/`contribution` freigeben (die Zeilen stehen bereits im Terminal-History) und nur noch als Platzhalter weiterleben.
- Prüfung: `MOMP-SCROLLBACK`-Exactness-Tests (`test/tmux-scrollback-exactness.test.ts`) bleiben grün; lange Session zeigt messbar niedrigeren RSS.

### R3: Doppelte Konversation in `AppendOnlyLog` vermeiden

- `AppendOnlyLog.#entries` dupliziert die Konversation auf Provider-Ebene für Prefix-Cache-Provider.
- Fix (vorsichtig): Statt `Message[]`-Kopien nur die Provider-Referenzen bzw. ein Delta seit dem letzten Sync zu halten — die Byte-Stabilität für den Prompt-Cache ist über `#messageDigests` bereits abgedeckt.
- Prüfung: Prefix-Cache-Hit-Rate (DeepSeek) bleibt gleich; `test/append-only-context`-Fälle grün.

---

Erstellt von Buffy (Codebuff) am 17. August 2026.

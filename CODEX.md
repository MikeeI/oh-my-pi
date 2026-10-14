# MOMP-Review, AI-Effizienz und Verbesserungsvorschläge

Aktuelle Arbeitsliste mit sieben Effizienzbefunden, acht MOMP-Befunden und 26 Verbesserungsvorschlägen. Die Befunde unterscheiden nachgewiesene Fehler, Optimierungsmöglichkeiten und noch festzulegende Produktregeln. Die Vorschläge sind keine bereits beschlossenen Implementierungen.

Im MOMP-Review liegt der größte ROI bei verlässlichen Routine-Ergebnissen, konsistenter Prompt-Auswahl und besserer Diagnose. Für deine mobile Nutzung ist außerdem ein konkreter Resize-Pfad relevant, dessen Aufwand mit dem gesamten Gesprächsverlauf wächst. Neue Funktionen würde ich vor allem auf Routinen, Gesprächssuche und deinem bestehenden Prompt-Inspector aufbauen.

## Prüfstand und Grenzen

Stand: 2. Oktober 2026, Source-Revision `3176d04131`, Upgrader-Revision `2993e3f`. Alle 15 Befunde und 26 Vorschläge wurden gegen ihre aktuellen Implementierungsstellen abgeglichen. Die beschriebenen Verhaltensweisen bestehen weiter; die Prompt-/Profil-Befunde belegen unterschiedliche Auswahlregeln, keinen allgemeinen Defekt aller Profile. Der Todo-Workflowbefund bleibt ein historisch belegtes Beispiel, keine Messung des heutigen Agent-Verhaltens.

Neun gezielte Offline-Prüfungen mit aktuellen Originalfunktionen bestätigen die Befunde zu Todo-Dopplung, Compaction-Isolationsoptionen, wiederholter History-Zusammenfassung, verworfenen Judge-Teilantworten, Datum-Remindern, Routine-Abschlussmeldungen, Such-Vollständigkeit, Phrasensuche und Titelprojektion. Abhängigkeiten beziehungsweise Provider-Antworten wurden dabei simuliert. Für Routinen wurden sowohl Abbruch als auch Providerfehler geprüft. Es gab keine Provider-Netzwerkaufrufe.

Der belegte Todo-Sitzungsausschnitt wurde erneut gelesen. Die Token-Korpusmessung vom 1. Oktober wurde nicht wiederholt; ihre Zahlen bleiben ausdrücklich historische Messwerte. Der frühere Transport-Replay-Nachweis wurde diesmal anhand der aktuellen Aufrufpfade und des Optionsverlusts geprüft, nicht erneut als vollständiger Transportversuch ausgeführt.

Keiner der 26 Vorschläge ist als beschriebene Gesamtfunktion umgesetzt. Vorhandene Grundlagen sind ausdrücklich benannt: insbesondere Child-Quellen und Wire-Hashes bei K1, kompakte Rename-Details bei K7, Release-Prüfgruppen bei K10 und der interne Routine-Plan bei M4. K11 ist eine kleine Robustheitsidee mit niedriger Priorität, kein belegter großer Effizienzgewinn. L1 bis L4 bleiben bedingte Entwürfe.

Das Inventar enthält 32 aktive MOMP-Verträge. Das ursprüngliche Fork-Review bezog sich auf 30 Verträge gegenüber `v18.4.9`; die inzwischen committierten Verträge `MOMP-FALLBACK-DISCOVERY` und `MOMP-TEXT-COLOR` sind durch diese Aktualisierung nicht vollständig neu auditiert. Der Abgleich bewertet die lokale Implementierung, nicht einen neu abgefragten Upstream-Head.

Eine vollständige Test-/Buildprüfung, aktuelle Provider-Kostenmessung und Termius/iOS-Abnahme waren nicht Teil dieser Dokumentaktualisierung. Insbesondere ist die tatsächliche mobile Verzögerung im Resize-Tail ungemessen. Anwendungscode wurde nicht geändert.

## Effizienz der AI-Interaktion

### Reine Todo-Abschlussrunden bündeln

In einem [Sitzungsausschnitt](/root/.omp/agent/sessions/-projects-project-oh-my-pi-fork/2026-09-24T23-09-19-848Z_01a0d5ae-3868-77d4-b4ab-4f80faa84567.jsonl:307)
folgen drei erfolgreiche `todo done`-Calls aufeinander, ohne Sacharbeit oder
User-Eingabe dazwischen. Dafür laufen drei Modellrunden mit zusammen 29,8
Sekunden Modellzeit und jeweils ungefähr 147.000 gecachten Kontexttokens.

Die drei bereits feststehenden Abschlüsse könnten in einer Runde ausgegeben
werden; `TodoTool.concurrency = "exclusive"` erhält dabei die Ausführungsreihenfolge.
Der aktuelle Todo-Prompt verbietet alleinstehende Calls bereits. Hier fehlt also
keine weitere identische Promptregel. Das Beispiel belegt vermeidbare Runden;
es belegt nicht, dass jeder einzelne Todo-Aufruf vermeidbar wäre.

### Todo-Ergebnisse zählen dieselben Aufgaben zweimal auf

[todo.ts:658](/root/projects/project-oh-my-pi-fork/packages/coding-agent/src/tools/todo.ts:658)
erzeugt zuerst `Remaining items`, anschließend nochmals die vollständige
Phasenliste. Für 358 Ergebnisse aus dem damaligen Siebentagefenster ergab die Offline-Messung
`81.460 -> 57.088` Texttokens, wenn ausschließlich die zusätzliche
`Remaining items`-Aufzählung entfällt: ungefähr 30 Prozent weniger.

Die aktuelle Formatter-Prüfung bestätigt: Eine offene Aufgabe erscheint zweimal,
eine blockierte Aufgabe nur in der Phasenliste. Beim Entfernen des zusätzlichen
Blocks müssen Status, Phasen, Blockierungsgründe, Zähler und TUI-Daten erhalten bleiben. Diese
Dopplung belastet auch nachfolgende Requests und Compaction. Gemessen wurde mit
`o200k_base`; daraus folgt keine identische prozentuale Ersparnis auf der
Provider-Rechnung.

Das Zeitfenster endet am `2026-10-01T03:25:16.287Z`. Die Textmessung vergleicht
den zusammengefügten Korpus der 358 Todo-Ergebnisse vor und nach Entfernung des
zusätzlichen Blocks; sie ist keine Messung der tatsächlichen Provider-Abrechnung.

### Native Codex-Hintergrundkompaktierung verliert ihre Transport-Isolation

Die spekulative Compaction verlangt eine eigene Sessionkennung und deaktivierte
WebSockets.
[session-maintenance.ts:3432](/root/projects/project-oh-my-pi-fork/packages/coding-agent/src/session/session-maintenance.ts:3432)
überschreibt beides anschließend mit den Live-Werten. Die aktuelle isolierte
Prüfung bestätigt `sessionId: "live"` und `preferWebsockets: true` trotz
übergebener eigener Kennung und `false`.

Entscheidend ist der Transportpfad: Normale Codex-Summary-Requests mit
`codexCompaction` erhalten bereits einen separaten Transportzustand.
[openCodexCompactionEventStream](/root/projects/project-oh-my-pi-fork/packages/ai/src/providers/openai-codex-responses.ts:1675)
verwendet für native V2-Compaction dagegen `isolateCompactionTransport: false`.
Bei überlappender spekulativer V2-Compaction kann deshalb derselbe Socket betroffen
sein; ein Transport-Fallback kann ihn schließen.

Im ursprünglichen Offline-Versuch mit echten Provider-Funktionen und simulierten Transporten:
derselbe Live-Request startet zweimal, zusätzlich läuft die Compaction über
HTTP. Kleinster Fix: die ausdrücklich übergebenen Isolationsoptionen erhalten.
Relevant für überlappende native Codex-V2-Hintergrundkompaktierung und WebSockets;
tatsächliche Backend-Abrechnung wurde nicht gemessen.

### Ein Fehler der Kurzfassung verwirft fertige Zusammenfassungsarbeit

Lokale Compaction erzeugt erst die große History-Summary, danach eine kurze
Anzeige-Zusammenfassung. Im Auto-Compaction-Pfad ist der innere Retry bewusst
deaktiviert (`oneshotRetry: false`). Scheitert die Kurzfassung mit einem vom
äußeren Retry akzeptierten Fehler, wiederholt dieser den gesamten Vorgang.
Mit aktuellem `compact()` und simuliertem Provider erneut reproduziert:
`history -> short(error) -> history -> short(success)`.

Dadurch entstehen pro entsprechendem Retry eine, bei geteilten Turns bis zu
zwei zusätzliche große Zusammenfassungen. Owner:
[compaction.ts:2006](/root/projects/project-oh-my-pi-fork/packages/agent/src/compaction/compaction.ts:2006).

Fix: erfolgreiche Stufen innerhalb derselben unveränderten Vorbereitung behalten
und nur die fehlgeschlagene Stufe wiederholen, mit einem gemeinsamen
Retry-Budget. Erfolgreiche native Remote-Compaction ist davon ausgenommen;
auch ist nicht jeder Kurzfassungsfehler automatisch retryfähig.

### Judge-Korrekturen vergessen bereits gültige Teilantworten

[TextJudge:289](/root/projects/project-oh-my-pi-fork/packages/ai/src/judgment/text.ts:289)
beginnt bei jedem Format-Retry mit leeren Antworten und fordert sämtliche
Fragen erneut an. Erneut offline bestätigt: Versuch eins liefert gültiges `alpha`, Versuch zwei
gültiges `beta`; trotzdem wird ein dritter Call nötig. Bei weiter wechselnden
Teilantworten endet es sogar als Fehler. Der Vertrag erklärt die Fragen
ausdrücklich für unabhängig.

Fix: gültige Antworten im Aufruf behalten, sämtliche Antwortzeilen prüfen und
nur offene Fragen korrigieren. Zusätzlich meldet das Tool-Ergebnis derzeit nur
den Verbrauch des letzten Versuchs; das Session-Journal erfasst dagegen alle.
Die reale Format-Retry-Häufigkeit ist bislang unbekannt.

### Datum- und Verzeichniswechsel können historische Cache-Präfixe umschreiben

Der [Reminder-Injector:60](/root/projects/project-oh-my-pi-fork/packages/coding-agent/src/session/date-cwd-reminder.ts:60)
erkennt die Historie anhand der Objektidentität der ersten User-Nachricht.
Redaction und Context-Extensions können davon bei jedem Request neue Kopien
erzeugen. Treffen solche Kopien mit einem Datum- oder Verzeichniswechsel zusammen,
setzt der Injector seine Anker zurück und schreibt den neuen Reminder in die
erste historische Nachricht.

Die aktuelle Injector-Prüfung bestätigt die Änderung der ersten historischen
Nachricht bei geklonter Eingabe und Tageswechsel. Der ursprüngliche Offline-Versuch
verfolgte diese Änderung bis zum tatsächlichen Codex-Request, bei stabilem
Systemprompt und Cache-Key. Das unterbricht
WebSocket-Append und kann den Conversation-Cache ab dieser Stelle verlieren.
Fix: stabile Nachrichtenprovenienz verwenden und neue Reminder ausschließlich
anhängen. Tatsächliche Provider-Cache-Hits und Abrechnung wurden nicht gemessen.

### Find bewertet bei einer einzelnen Datei unnötig deren Dateinamen

[cascade.ts:195](/root/projects/project-oh-my-pi-fork/packages/coding-agent/src/tools/jfind/cascade.ts:195)
startet eine eigene Filename-Judge-Welle, obwohl die einzige Datei anschließend
unabhängig vom Ergebnis untersucht wird. Offline liefern Namensbewertungen
`0` und `1` dieselben inhaltlichen Treffer. Modell und TUI verwenden diesen
Namensscore nicht.

Bei einer für Find zugelassenen Einzeldatei (`root.type === "file"`) lässt sich
die Filename-Judge-Anfrage samt serieller Wartephase entfernen.
Der aktuelle Auswahlpfad bestätigt die Unabhängigkeit
vom Namensscore. Die produktive Häufigkeit solcher File-Scope-Aufrufe wurde
nicht neu erhoben; der Kandidat bleibt deshalb niedrig priorisiert.

## Befunde aus dem MOMP-Review

### Routinen können Fehler und Abbruch als Erfolg melden

In [AgentSession.runRoutineInvocation](packages/coding-agent/src/session/agent-session.ts) bedeutet `waitForIdle()` lediglich, dass der Agent nicht mehr arbeitet. Providerfehler werden im Agent-Zustand beziehungsweise in Abschlussnachrichten abgelegt und müssen nicht als Exception weitergereicht werden.

Die Routine prüft den Abbruch außerdem nur vor einem Schritt. Wird der letzte Schritt abgebrochen, folgt trotzdem `complete`.

Isoliert reproduziert:

- Abbruch im letzten Schritt: `running → complete`.
- Terminaler Providerfehler: `running → complete`, obwohl `agent.state.error` gesetzt ist.

Hier braucht jeder Schritt ein eindeutiges Abschlussresultat: erfolgreich, fehlgeschlagen, abgebrochen oder gar nicht gestartet. Zusätzlich sollte die Routine die vorhandene `throwOnDrop`-Option verwenden. Erst danach sind zuverlässige Wiederaufnahme oder abhängige Schritte sinnvoll.

### Gesprächssuche kann unvollständige Erfassung als vollständig ausgeben

Die vorgeschaltete [Session-Erfassung](packages/coding-agent/src/session/session-listing.ts) verwandelt Verzeichnisfehler in `[]`. Fehlerhafte oder nicht lesbare Session-Dateien können bereits bei dieser Erfassung verschwinden.

Die Suche berechnet ihre Vollständigkeit anschließend nur aus den Sessions, die sie tatsächlich erhalten hat.

Isoliert reproduziert: Verzeichniserfassung schlägt fehl, Ergebnis meldet trotzdem `complete: true`, `failedSessions: 0`.

Die Erfassung muss übersprungene Dateien und Erfassungsfehler mitliefern. Die Suche muss zwischen „kein Treffer“ und „Korpus nicht vollständig durchsuchbar“ unterscheiden.

### Exakte Phrasensuche normalisiert nur die Anfrage

In [conversation-search.ts](packages/coding-agent/src/session/conversation-search.ts) wird mehrfacher Whitespace in der Anfrage zusammengezogen. Der Nachrichtentext bleibt unverändert.

Deshalb findet die Anfrage `alpha  beta` den identischen Text `alpha  beta` nicht: Gesucht wird intern `alpha beta`.

Für den beworbenen Modus „exact phrase“ würde ich den internen Whitespace erhalten. Falls normalisierte Phrasen gewünscht sind, müssen beide Seiten dieselbe Normalisierung verwenden; die Ausschnittpositionen müssen dabei korrekt bleiben.

### Prompt-Discovery verhält sich in Unterverzeichnissen anders

Die MOMP-Auswahl in [discoverSystemPromptSources](packages/coding-agent/src/system-prompt.ts) verwendet Konfigurationspfade direkt unter `cwd`. Diese [Pfadauflösung](packages/coding-agent/src/config.ts) läuft nicht durch die Elternverzeichnisse.

Beispiel: Start unter `/repo/packages/foo`, Template unter `/repo/.omp/SYSTEM.template.md`. Das Projekt-Template wird von dieser Auswahl nicht gefunden; ein User-Template kann gewinnen.

Die Quellprüfung belegt diese Auswahlregel. Ob Projekt-Templates aus Elternverzeichnissen gelten sollen, muss als gewünschtes Verhalten ausdrücklich festgelegt werden. Falls diese Vererbung gewünscht ist, besitzt Upstream bereits eine Suche nach dem nächsten Projekt-Konfigurationsverzeichnis, die am bestehenden MOMP-Auswahlpunkt wiederverwendet werden kann. Main und frische Children brauchen einen explizit getesteten Umgang mit Unterverzeichnissen.

### Direkter SDK-Start und explizite SDK-Profile können andere Quellen verwenden

Zwei zusammenhängende Unterschiede:

- Der normale [SDK-Promptaufbau](packages/coding-agent/src/sdk.ts) übernimmt `options.systemPromptTemplate`, führt aber die automatische Auswahl von `SYSTEM.template.md` nicht selbst durch. CLI-Start und direkter SDK-Start können deshalb unterschiedliche Defaults erhalten.
- Tool- und Agent-Overrides verwenden das Session-Profil. [Routinen](packages/coding-agent/src/discovery/routines.ts) und Teile der Main-/Child-Template-Discovery greifen weiterhin auf das prozessweit konfigurierte Agent-Verzeichnis zu. Relevant ist insbesondere ein explizites SDK-`agentDir`, das davon abweicht.

Der Befund bedeutet nicht, dass normale CLI-Profile grundsätzlich falsch aufgelöst werden. Explizite Prompt-Overrides werden bereits weitergegeben. Eine gemeinsame Quellenauflösung mit explizitem `cwd` und `agentDir` am bestehenden Owner könnte die Einstiegspunkte vereinheitlichen; welche automatische Discovery das SDK leisten soll, ist dabei ausdrücklich festzulegen.

### Titelgenerierung filtert die Urheberschaft nicht ausreichend

[selectRecentTitleMessages](packages/coding-agent/src/utils/title-generator.ts) prüft die Rolle, aber nicht die Agent-Attribution einer `user`-Nachricht.

Isoliert reproduziert: Eine `user`-Nachricht mit `attribution: "agent"` landet im Titelkontext.

Aktuelle synthetische `developer`-Nachrichten werden korrekt ausgeschlossen. Der Befund betrifft also ausdrücklich Agent-attribuierte Nachrichten mit Rolle `user`. Die Gesprächssuche besitzt bereits die passendere Sichtbarkeitsregel; diese Regel sollte für Titel ebenfalls gelten.

### Resize-Tail rendert nach Drift den gesamten akzeptierten Verlauf

[TranscriptContainer.renderTail](packages/tui/src/chrome/transcript-container.ts) arbeitet im normalen Pfad vom Ende her und beendet die Arbeit nach genügend sichtbaren Zeilen.

Nach erkanntem Drift ruft es dagegen `#renderAcceptedTape(width)` für das gesamte akzeptierte Tape auf und schneidet erst anschließend den benötigten Ausschnitt heraus.

Das ist strukturell ein Aufwand proportional zum gesamten Verlauf pro Resize-Ereignis. Bei langen Gesprächen und deinen üblichen Resize-Bursts ist das ein konkreter Optimierungskandidat.

Die Änderung sollte auch in diesem Pfad nur die benötigten letzten Zeilen sammeln und die Regeln für akzeptierte physische Zeilen erhalten. Eine gemessene Verzögerung auf Termius/iOS behaupte ich hier nicht.

### Update-Hilfe verspricht Verhalten, das MOMP deaktiviert hat

Die [Update-Hilfe](packages/coding-agent/src/cli/update-cli.ts) bewirbt Installation, Force-Reinstall und Channel-Wechsel. Der MOMP-Pfad verweist dagegen auf manuelle Installation; `--check` führt dort keine tatsächliche Prüfung einer neuen Version aus.

Die Hilfe muss anhand der bestehenden Paketidentität das tatsächliche Fork-Verhalten beschreiben. Das ist eine kleine, klar begrenzte Korrektur.

## Bewertung der bestehenden Änderungen

| Bereich | Meine Einschätzung |
|---|---|
| Main-/Child-Templates und Prozess-Overrides | Die unterschiedlichen MOMP-Verträge rechtfertigen die Erweiterung. Offene Punkte sind die Auswahlregeln in Unterverzeichnissen, beim direkten SDK-Start und bei einem abweichenden SDK-`agentDir`. |
| Tool-/Agent-Overrides | Strikte Datei-Prüfung, fehlende Datei als einziger Fallback und Behandlung defekter Symlinks sind sinnvoll. Diesen gemeinsamen Dateirand beibehalten. |
| Prompt-Inspector und Cache-Probe | Hoher praktischer Wert. Offline-Request-Inspektion und synthetischer Endpoint-Probe sind bereits sauber getrennte Aussagen. Nächster Nutzen: Herkunft und Änderungen erklären. |
| Task-/Eval-Policy, Child-Kontext und LSP | Die gemeinsamen Runtime-Seams vermeiden parallele Konstruktion. Neue Diagnose sollte erklären, weshalb ein Child eine Fähigkeit erhält. |
| Read, AST-Paging, Web-Scheduling und Workspace-Tree | Überwiegend kleine, gezielte Änderungen am jeweiligen Owner. Hier sehe ich keinen Grund für einen größeren Umbau. |
| Routinen und Command-UX | Die Registry-Validierung und transportübergreifende Einbindung sind vorhanden. Der schwächste Punkt ist die Auswertung der tatsächlichen Schrittergebnisse. |
| Gesprächssuche | Die Trennung zwischen sichtbarem Korpus, Matching und Tool ist sinnvoll. Vollständigkeit und Phrase-Semantik brauchen Korrekturen. |
| Runtime-Audit, Stats, Modellkatalog und Paketidentität | Bestehende Infrastruktur ausbauen. Besonders hilfreich wären vergleichbare Audit-Metadaten und vollständiger zugeordnete Release-Nachweise. |
| Scrollback und tmux-Integration | Höchste laufende Wartungskosten, aber ein reales Nutzerproblem. Optimierungen und Architekturänderungen brauchen den Nachweis fortgesetzter Interaktion nach Resize. |

## Kleinere Änderungen

`Ausbau` bezeichnet eine gezielte Ergänzung einer vorhandenen Funktion. `Neu` bezeichnet eine heute fehlende Nutzerfunktion; interne Grundlagen können bereits existieren. Die IDs bleiben stabil. Die Aufwandseinteilung ist grob: Vollständige Template-Zweigvalidierung bei K2 und versionsgebundene Rename-Artefakte bei K7 können mittleren Aufwand erreichen.

| ID | Vorschlag | Konkreter Nutzen |
|---|---|---|
| K1 · Ausbau | Prompt-Inspector ergänzt die vorhandenen Child-Quellen und Wire-Hashes um ein zusammenhängendes Herkunftsmanifest mit Quellpfad, Profil, Auswahlgrund, unterdrückten Quellen und Content-Hash. | Du erkennst sofort, weshalb ein bestimmter Prompt geladen wurde. |
| K2 · Neu | Offline-Profilvalidierung für Main, Child, alle Tool- und Agent-Overrides, einschließlich relevanter Template-Zweige. | Ein kaputtes Profil fällt vor der nächsten echten Anfrage auf. Vorhandene Loader und Renderer verwenden. |
| K3 · Ausbau | Reload-Ausgabe nennt geänderte Prompt-Quellen und deren Wirksamkeit: sofort, nach Neustart oder nur für neue Children. | Verhindert falsche Erwartungen an bereits laufende Children und gespeicherte Prompt-Bytes. |
| K4 · Ausbau | Runtime-Audit-Manifest enthält Source-Revision, Upstream-Basis, relevante Settings-/Prompt-Fingerprints sowie CPU-/Kernel-Daten. | Messunterschiede lassen sich einer konkreten Umgebung und Revision zuordnen. |
| K5 · Neu | Vergleich zweier vorhandener Audit-Manifeste mit Prüfung gleicher Parameter. | Boot-, Heap- und Bundle-Änderungen werden nachvollziehbar, ohne einen zweiten Audit-Workflow einzuführen. |
| K6 · Ausbau | Gesprächssuche gibt bei erreichtem Maximum von 50 Treffern brauchbare Hinweise. | Heute fordert sie weiterhin „increase limit“. Dann sollten engere Queries, Zeitfenster oder Scope empfohlen werden. |
| K7 · Ausbau | Die vorhandene begrenzte LSP-Rename-Vorschau um ein vollständiges Artefakt mit Dokumentversion und betroffenen Dateien ergänzen. | Textedit-Details und `INCOMPLETE preview` existieren bereits. Es fehlt die vollständige prüfbare Vorschau; vor Umsetzung mit [ISSUE-014](issues/ISSUE-014.md) abgleichen. |
| K8 · Ausbau | URL-Fetch-Diagnose zeigt verwendete Identität und Gründe für Fallbacks. | Chrome-/Googlebot-/curl-Probleme werden erklärbar, ohne die Fetch-Policy zu ändern. |
| K9 · Ausbau | `stats --summary --json` bildet ebenfalls die Bereiche 24 Stunden, 7 Tage und 30 Tage ab. | Maschinenlesbare Ausgabe entspricht der menschlichen Zusammenfassung. Heute gewinnt der allgemeine JSON-Zweig. |
| K10 · Ausbau | Upgrader berichtet für jeden aktiven Vertrag den zugeordneten Nachweis und die Art des Nachweises. | Bestehende Release-Gates werden überprüfbar vervollständigt. Zum Prüfstand sind sieben explizite Gruppen plus Prompt-Prüfungen verdrahtet; eine vollständige Zuordnung aller 32 aktiven Verträge fehlt. |
| K11 · Ausbau | Cache-Probe zählt Wire-Felder strukturell statt mit einem exakten Regex über `JSON.stringify(input)`. | Niedrige Priorität: Der heutige Serializer vereinheitlicht Whitespace bereits. Strukturprüfung wäre robuster bei zusätzlichen Markerfeldern; für den heutigen Producer ist kein Zählfehler nachgewiesen. |
| K12 · Ausbau | Zusätzliche Such-Benchmark-Fälle für bekannte Treffer, viele Treffer und lange Nachrichten. | Der bestehende Guaranteed-Miss-Benchmark bleibt erhalten; Verbesserungen werden auch für reale Trefferpfade geprüft. |

Meine Favoriten aus dieser Gruppe sind K1, K2, K4 und K10. Sie reduzieren wiederkehrende Fehlersuche und Upgrade-Arbeit.

## Mittlere Änderungen

| ID | Vorschlag | Nutzen und Eingriffsgrenze |
|---|---|---|
| M1 · Ausbau | Eine gemeinsame Quellenauflösung für CLI, SDK, ACP und Inspection, mit explizitem Profil und Arbeitsverzeichnis. | Vereinheitlicht die ausdrücklich festgelegten Discovery-Regeln zwischen Einstiegspunkten und bei abweichendem SDK-`agentDir`. Main und Child behalten ihre unterschiedlichen Auswahlregeln und Lebenszyklen. |
| M2 · Neu | Offline-Prompt-Diff zwischen zwei Inspector-Snapshots. | Zeigt veränderte Provider-Blöcke, Toolschemas und den ersten geänderten Bereich des stabilen Präfixes. Baut auf deinem Inspector auf. |
| M3 · Ausbau | Optionale Diagnose aufeinanderfolgender tatsächlicher Main-Requests anhand von Hashes und berichteter Cache-Nutzung. | Erklärt Unterschiede zwischen Offline-Inspektion, synthetischem Probe und laufender Session. Backend-interne Cache-Gründe bleiben ausdrücklich unbekannt. |
| M4 · Neu | Routine-Vorschau mit vollständig aufgelösten Schritten, Argumenten und Command-Quellen auf Basis des vorhandenen internen Ausführungsplans. | Du siehst vor dem Start den tatsächlichen Ausführungsplan, besonders bei langen Review-Routinen. |
| M5 · Neu | Routine-Schrittergebnisse im bestehenden Session-Journal speichern. | Abgebrochene Läufe werden nachvollziehbar. Eine spätere Wiederaufnahme darf Änderungen nur bei ausdrücklich geeigneten Schritten überspringen oder wiederholen. |
| M6 · Neu | Routine-Verifikation mit eindeutig ausgewertetem Ergebnis. | Ein fehlgeschlagener Check stoppt abhängige Schritte. Bestehende Tool-Ausführung verwenden; keinen zweiten Shell-Runner bauen. |
| M7 · Neu | Einen Suchtreffer gezielt um wenige sichtbare Nachbarnachrichten erweitern. | `history://` erschließt bereits Agent-Historien und den aktuellen Branch. Es fehlt der begrenzte Ausschnitt um eine Treffer-ID in beliebigen gespeicherten Main-Gesprächen. Vorhandene Loader und die sichtbare Korpusprojektion verwenden; keine automatische Child-Vererbung. |
| M8 · Ausbau | Optional nach Conversation gruppierte Treffer und Ausschnitte für mehrere Suchbegriffe. | Eine lange Session verdrängt weniger andere relevante Gespräche; Ausschnitte machen den Treffer besser nachvollziehbar. |
| M9 · Ausbau | Vorhandene exakte Read-Tokenzahlen in Nutzungsstatistiken auswerten. | Zeigt große Reads und wiederholtes Einlesen. Bereits berechnete Metadaten nutzen; nicht erneut tokenisieren oder mit Provider-Abrechnung gleichsetzen. |
| M10 · Ausbau | Runtime-Audit um eine lange aktive TUI-Session mit Streaming, Expansion und Resize ergänzen. | Prüft andere Belastungen als das vorhandene Erzeugen und Entsorgen von AgentSessions. Erst messen, dann Speicher- oder Renderstrukturen ändern. |

M2 hat besonders guten Nutzen für dein Prompt- und Cache-Thema. M4 bis M6 machen Routinen zu einem verlässlicheren Arbeitswerkzeug. M7 ist eine praktische neue Funktion mit überschaubarem Umfang.

## Größere Änderungen

### L1 · Abgeleiteter Suchindex für sichtbare Gespräche

Die Suche liest heute die passenden Journale erneut. Ein persistenter, vollständig rekonstruierbarer Index ist erst gerechtfertigt, wenn wiederholtes Scannen bei deinem tatsächlichen Korpus und Suchverhalten einen relevanten Engpass zeigt.

Ich würde den bestehenden sichtbaren Korpus als einzige fachliche Projektion behalten und SQLite als abgeleitete Beschleunigung verwenden. Journal-Append, Kürzung, Austausch und Kompaktierung müssen die Aktualisierung korrekt steuern.

Ein gewöhnlicher Wortindex ersetzt dein heutiges Substring-Matching nicht gleichwertig. FTS5 bietet einen Trigram-Tokenizer; kurze Begriffe brauchen weiterhin einen passenden Fallback. Der bestehende Matcher sollte die Kandidaten abschließend prüfen. [SQLite-FTS5-Dokumentation](https://www.sqlite.org/fts5.html#the_trigram_tokenizer)

ROI: potenziell hoch bei großem Korpus und häufiger Suche; bislang nicht gemessen. Vorher Vollständigkeit und Phrasensemantik korrigieren sowie Trefferpfade mit K12 messen.

### L2 · Terminal-Zustandsübergänge vereinfachen

Falls die Resize-Replays weiterhin widersprüchliche Zustände zeigen, würde ich die betroffenen Übergänge am bestehenden TUI-Owner expliziter modellieren: angebotene History, akzeptierte History, Resize-Generation, CPR-Antwort und ausstehender Replay.

Vorher sollten echte mobile Ereignissequenzen in die vorhandenen Regression-Harnesses übernommen werden. Der Nachweis muss weitere Eingabe, Streaming und Scrollen nach Resize einschließen.

ROI: potenziell sehr hoch für dich. Rebase-Kosten: hoch, weil dieser Bereich upstream aktiv verändert wird. Deshalb gezielte Vereinfachung anhand reproduzierter Zustandsfehler.

### L3 · Routinen mit Abhängigkeiten und ausdrücklich konfigurierter Parallelität

Eine Review-Routine könnte unabhängige Analysen parallel ausführen, Ergebnisse zusammenführen und erst danach eine abhängige Prüfung starten.

Dafür würde ich vorhandene Task-/Workpool-Mechanismen nutzen und Routinen um Abhängigkeiten ergänzen. Das erweitert den derzeit ausdrücklich sequenziellen `MOMP-ROUTINES`-Vertrag und ist eine neue Produktentscheidung. Ein zusätzlicher Job-Scheduler wäre unnötig. Bestehende Delegationsregeln müssen erhalten bleiben.

ROI: hoch, wenn deine langen Routinen häufig unabhängige Schritte enthalten. Voraussetzung sind die korrekten Abschlussresultate und gespeicherten Schrittergebnisse.

### L4 · Zusammenhängende Diagnose eines vollständigen Laufs

Die vorhandenen Audits, Stats und Prompt-Inspektionen beantworten einzelne Fragen. Eine korrelierte Sicht auf `Main → Child → Eval → Tool → Provider` könnte Wartezeiten und Kosten eines konkreten Laufs erklären.

Dazu gehören gemeinsame Korrelations-IDs und vorhandene Ereignisse: Queue-Wartezeit, Promptaufbau, Tool-Laufzeit, Provider-Anfrage und erste Ausgabe. Die bestehenden Diagnose- und Journal-Owner erweitern.

ROI: hoch bei regelmäßig schwer erklärbaren langsamen oder teuren Läufen. Aufwand und Eingriff in gemeinsam genutzte Runtime-Codepfade sind erheblich.

Für die erste Runde würde ich den Optionsverlust der spekulativen Compaction sowie die reproduzierten Routine-, Such- und Titelprobleme korrigieren. Danach folgen Todo-Dopplung, unnötige Summary-/Judge-Wiederholungen und stabile Reminder-Provenienz. Prompt-Herkunft und Release-Nachweise sind die bevorzugten Diagnose-Erweiterungen. Den Resize-Tail zuerst gezielt messen; Prompt-Diff, Routine-Vorschau und begrenzter Suchtreffer-Kontext bleiben die bevorzugten neuen Funktionen.

# RAM-Untersuchung

Stand: 2026-07-19. Die Messungen stammen vom laufenden Entwicklungsserver während 62 parallele
tmux-Panes aktiv waren. Sie beschreiben einen Zeitpunkt und sind keine Langzeitmessung;
Prozesszahlen und Speicherwerte ändern sich mit laufenden Agenten.

## Kurzbefund

Der Server hatte 125 GiB RAM, davon 61 GiB aktiv verwendet, 5,7 GiB frei und 64 GiB verfügbar. Die
63 GiB `buff/cache` sind größtenteils bei Bedarf freigebbar, deshalb bedeutet der niedrige
`free`-Wert keinen akuten Speichermangel. 13 GiB von 31 GiB Swap waren belegt; bei gleichzeitig 64
GiB verfügbarem RAM beweist das keinen aktuellen Druck, sondern kann von früher ausgelagerten und
seitdem kalten Seiten stammen.

Der ungewöhnliche Verbrauch entsteht primär durch viele gleichzeitig laufende OMP-Instanzen samt
Kindprozessen. tmux selbst belegt zusätzlich ungefähr 1,03 GiB, überwiegend für Terminalhistorien.
Es gibt keinen Beleg für einen einzelnen systemweiten Leak; der größte einzelne `momp`-Prozess mit
5,9 GiB ist jedoch auffällig und muss separat profiliert werden, bevor seine interne Ursache
belastbar benannt werden kann.

## Prozessverbrauch

Die nach Prozessnamen aggregierten RSS-Werte zeigten folgende Hauptverbraucher:

| Prozessname    |     RSS-Summe | Prozesse | Einordnung                                                      |
| -------------- | ------------: | -------: | --------------------------------------------------------------- |
| `bun`          |     33,61 GiB |       81 | überwiegend parallele `momp`-Instanzen und Worker               |
| `MainThread`   |     14,84 GiB |       74 | viele Node-/TypeScript-Language-Server- und `tsserver`-Prozesse |
| `python3`      |      2,70 GiB |        7 | Python-Prozesse außerhalb der tmux-Kernursache                  |
| `gopls`        |      1,34 GiB |        8 | separate Go-Language-Server                                     |
| `postgres`     |      1,21 GiB |       52 | Datenbankprozesse                                               |
| `tmux: server` | etwa 1,03 GiB |        1 | zentraler Server für alle tmux-Sessions                         |

RSS-Summen sind keine exakte physische Gesamtspeichermessung, weil gemeinsam genutzte Seiten in
mehreren Prozessen erscheinen können. Sie sind hier zur Rangfolge und Attribution geeignet, dürfen
aber nicht einfach addiert und mit `free` verglichen werden.

Der größte Einzelprozess war PID `3377266`, `bun /root/.bun/bin/momp`, mit 6.191.508 KiB RSS
beziehungsweise ungefähr 5,9 GiB. Er gehörte zur tmux-Session `academicsearch-cli-3`. Weitere
einzelne `momp`-Instanzen lagen ungefähr zwischen 0,8 und 1,2 GiB; mehrere TypeScript-Prozesse des
Workspaces `ce-ext-adblocker-ghostery` lagen jeweils zwischen ungefähr 0,85 und 1,55 GiB.

Der Prozessbaum bestätigte, dass die `MainThread`-Prozesse nicht Bestandteil des
tmux-Serverspeichers sind. Sie laufen als Kindprozesse von `momp`, darunter
`typescript-language-server` und je Instanz mehrere `tsserver`-Prozesse. Allein für
`ce-ext-adblocker-ghostery` existierten 15 parallele tmux-Sessions, wodurch derselbe Workspace
mehrfach eigene Agenten, Sprachserver, Worker und Sitzungszustände hielt.

## Warum tmux ungefähr 1 GiB benötigt

Der Prozess `tmux: server` mit PID `2154949` verwaltet alle Sessions gemeinsam. Seine Kommandozeile
enthält zwar den Namen der Session, mit der der Server ursprünglich gestartet wurde, diese Session
ist aber nicht Eigentümerin des gesamten Verbrauchs. `pstree` zeigte die Shells und OMP-Prozesse
aller Pane-Sessions unter demselben tmux-Server.

Die globale Einstellung war `history-limit 10000`. Dieses Limit gilt pro Pane, nicht für den
gesamten Server. Die 62 Panes hielten zusammen 327.537 Verlaufszeilen; `#{history_bytes}` meldete
dafür 871.918.879 Bytes beziehungsweise 831,5 MiB. `pmap -x 2154949` zeigte gleichzeitig ungefähr
1,03 GiB residenten Speicher, davon fast alles in einer großen anonymen, beschreibbaren
Speicherabbildung. Damit erklären die von tmux selbst gemeldeten Verlaufsdaten den Großteil des
tmux-RSS direkt; aktive Bildschirmraster, Verwaltungsdaten und Allokator-Overhead erklären den
verbleibenden Abstand plausibel.

Die teuersten einzelnen Historien lagen bei ungefähr 40 bis 43 MB, unter anderem
`ebook-peripherals-1`, `lib-go-tiktoken-2` und `settings-omp-1`. OMP erzeugt lange, breite und
formatierte Terminalausgabe. tmux speichert dafür nicht nur Klartext, sondern ein Terminalraster mit
Zell-, Stil- und Attributinformationen; dadurch kosten 10.000 formatierte Zeilen deutlich mehr als
eine Textdatei mit 10.000 Zeilen.

## Ursachenmodell

Der dominante Faktor ist Prozessmultiplikation: Jede offene OMP-Session hält einen eigenen
Bun-Prozess und kann zusätzliche Worker, Python-Runner, LSP-Server und TypeScript-Server starten.
Mehrere Sessions für denselben Workspace duplizieren diese Ressourcen, obwohl sie weitgehend
dieselben Quelldateien analysieren. 62 gleichzeitig offene Panes erklären daher sowohl die 33,61 GiB
`bun`-RSS als auch einen großen Teil der 14,84 GiB `MainThread`-RSS.

Der zweite Faktor ist tmux-Scrollback. Ein Limit von 10.000 Zeilen wirkt pro Pane moderat, skaliert
bei 62 Panes aber auf bis zu 620.000 gespeicherte Zeilen. Zum Messzeitpunkt waren 327.537 Zeilen
belegt und verbrauchten laut tmux bereits 831,5 MiB. Das ist gebundener Prozessspeicher und kein
freigebbarer Linux-Dateicache.

Der dritte Faktor sind einzelne lang laufende oder stark gewachsene OMP-Instanzen. PID `3377266` lag
mit 5,9 GiB weit über den übrigen `momp`-Prozessen. Aus RSS und Prozessbaum allein lässt sich nicht
unterscheiden, ob dieser Speicher aus Gesprächszustand, Tool-Ausgaben, LSP-Daten, Workerzustand,
Bun-Heap, nativen Buffern oder nicht freigegebenen Ressourcen stammt; jede konkretere Aussage wäre
Spekulation.

## Maßnahmen

1. Nicht mehr benötigte tmux-Sessions schließen. Das gibt gleichzeitig deren Scrollback, `momp`,
   Worker, Runner und Sprachserver frei und hat deshalb den größten unmittelbaren Effekt.
2. Parallele Sessions pro Workspace begrenzen. Besonders die 15 Adblocker-Sessions duplizieren teure
   TypeScript-Analysen und sollten nur parallel bestehen, wenn sie aktiv gebraucht werden.
3. `history-limit` in der tmux-Konfiguration für neue Panes beispielsweise von 10.000 auf 2.000
   reduzieren. Das senkt den maximalen Scrollback-Anteil näherungsweise proportional, ersetzt aber
   nicht die Bereinigung unnötiger Sessions.
4. Für OMP eine speichersichtbare Diagnostik ergänzen: eigener RSS/PSS, Kindprozesse nach Rolle,
   Workspace, Sessionalter, letzter Aktivität und kumulierter Kindprozessspeicher. Ohne diese
   Attribution erscheint der Verbrauch fälschlich als undifferenzierter `bun`-/`MainThread`-Block.
5. Lebenszyklen von Language-Servern, Eval-Workern und Python-Runnern prüfen. Beim Beenden oder
   Ersetzen einer Session müssen alle zugehörigen Kindprozesse deterministisch beendet werden;
   verwaiste Ressourcen dürfen nicht bis zum tmux-Serverende weiterleben.
6. PID `3377266` separat mit Bun-/V8-Heap- und nativer Speicherdiagnostik untersuchen. Erst ein
   Vergleich aus Heap-Snapshot, Prozess-RSS/PSS, Kindprozessspeicher und einer kontrollierten
   Session-Reproduktion kann zwischen erwarteter großer Sitzung und echtem Wachstum ohne Freigabe
   unterscheiden.

## Reproduktionsbefehle

Systemzustand:

```bash
free -h
ps -eo pid=,rss=,%mem=,etime=,args= --sort=-rss
```

Nach Prozessnamen aggregieren; RSS steht absichtlich vor `comm`, weil Prozessnamen Leerzeichen
enthalten können:

```bash
ps -eo rss=,comm= | awk '{kb=$1; $1=""; sub(/^ +/, ""); rss[$0]+=kb; count[$0]++} END {for (name in rss) printf "%-20s %6.2f GiB %4d\n", name, rss[name]/1048576, count[name]}' | sort -k2,2nr
```

tmux-Sessions und Pane-Prozesse:

```bash
tmux list-panes -a -F 'session=#{session_name} pane=#{pane_index} pid=#{pane_pid} cmd=#{pane_current_command} dead=#{pane_dead}'
pstree -ap "$(pgrep -o tmux)"
```

tmux-Historie und Speicherabbildungen:

```bash
tmux show-options -g history-limit
tmux list-panes -a -F '#{session_name} width=#{pane_width} height=#{pane_height} history=#{history_size} bytes=#{history_bytes}'
tmux list-panes -a -F '#{history_bytes}' | awk '{bytes+=$1; panes++} END {printf "panes=%d history_bytes=%d history_MiB=%.1f\n", panes, bytes, bytes/1048576}'
pmap -x "$(pgrep -o tmux)"
```

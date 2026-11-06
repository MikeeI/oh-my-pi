# Rename-Titel: erster Messlauf

| round | variant | change | decision | train quality | test quality | train format | test format | train cost_usd | test cost_usd |
|---|---|---|---|---|---|---|---|---|---|
| 0 | baseline ★ | baseline | baseline | 0.965 ±0.041 | 0.875 ±0.182 | 0.944 ±0.079 | 0.958 ±0.061 | 0.0086 ±0.0020 | 0.0082 ±0.0015 |

## Ergebnis

Die unveränderte Baseline wurde mit 40 echten Gesprächen und drei Wiederholungen vollständig gemessen.
Alle 120 Titel stammen von GPT-6 Luna; alle 120 finalen Bewertungen stammen von GPT-6.1 Sol.
Es wurde kein Promptkandidat angewendet.

## Messgrenze

Der Trainingssatz enthält 24 Fälle, davon 21 mit perfektem Ausgangsscore.
Nur drei unabhängige Fallmittel können sich verbessern.
Die maximal mögliche gepaarte t-Statistik beträgt 1.813; erforderlich wären 2,069.
Damit kann keine Promptänderung die freigegebene Übernahmehürde erreichen, selbst wenn alle Titel inhaltlich besser werden.
Mehr Wiederholungen erzeugen dabei keine zusätzlichen unabhängigen Fälle.
Die Kriterien oder den eingefrorenen Split nachträglich zugunsten einer Änderung anzupassen wäre keine valide Optimierung.

## Fortsetzung

Der Nutzer hat einen neuen, größeren Prüfdatensatz mit bis zu 100 echten Gesprächen freigegeben.
Der unabhängige Folgeversuch liegt unter `../rename-title-expanded/`.
Die bisherigen Quellsitzungen und ihre Fork-Familien werden vom neuen Datensatz ausgeschlossen.
Modellpaar, Bewertungsmaßstab und Grenze von höchstens vier Promptkandidaten bleiben unverändert.
Dieser erste Flow bleibt mit der Baseline als bestem gemessenen Stand erhalten.

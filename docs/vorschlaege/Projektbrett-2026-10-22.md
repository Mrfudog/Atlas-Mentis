# Projektbrett: Nachtrag vom 22.10.2026

**Alle Aufgaben und Entscheidungen der Sitzung vom 22.10.2026**, auch die
erledigten, zusammengeführt. Diese Sitzung hat keinen Zugriff auf das
Projektbrett (ein GitHub-Projekt ausserhalb des Repos); die Liste ist zum
Übernehmen gedacht. Als Tabelle zum Einlesen:
[Projektbrett-2026-10-22.csv](Projektbrett-2026-10-22.csv), mit den
Spalten Nr, Typ, Titel, Status, Story, Feature, PR, Notiz.

## Was zusammengeführt ist

- **T-368 → T-370:** „Ecken gespeicherter Formen verschieben“ ist ein
  Teil von „Gesetzte Punkte ziehen“.
- **E-1, E-2, E-3** (erste Fassung von Spieltisch-als-Boards) → **E-136,
  E-137, E-138**. Die Nummern 1–3 gibt es nicht.
- **REQ-193 (Gebiete) → REQ-376 (Kartenbereiche):** Die Gebiete bleiben
  stehen; neue Arbeit geht über REQ-376.
- **docs/Werkzeuge.md im alten Repo Nebelwacht** → ersetzt durch den
  Vorschlag Leiste-und-Tasten (#353, T-387). Das alte Repo ist nicht mehr
  die Quelle.
- **Mehrere Aufgaben an REQ-131** (T-371, T-373, T-376) bleiben getrennt:
  Sie lassen sich unabhängig bauen und prüfen.
- **Entscheidungen, die heute im Bau fielen** (E-149 bis E-154), stehen als
  „entschieden, zur Bestätigung“ da. Umgesetzt sind sie; die Leitung
  bestätigt oder kippt sie. Im Decision Log heissen sie D75 bis D83.

## Die Liste

| Nr. | Titel | Status | Story | Feature | PR | Notiz |
|---|---|---|---|---|---|---|
| T-359 | Spielende sehen nur Karten im Spiel; Sichtbarkeitstests je Rolle | In Arbeit | REQ-372, REQ-359 | F-055, F-080 | Zweig feature/nur-karten-im-spiel | wartet auf E-139 |
| T-360 | Move to layer in der Werkbank | Offen | REQ-365 | F-016 |  |  |
| T-361 | Setting als Ebene; Gedankenwelt anlegen | Offen | REQ-100 | F-004 |  | nach E-141 |
| T-362 | Sorten als Listen | Offen | REQ-366 | F-003 |  | nach E-142 |
| T-363 | Seite Admin: Konten, Kampagnen, Inhalte je Konto | Offen | REQ-367, REQ-229 | F-010 |  | nach E-144 |
| T-364 | Immer laufende Kampagne oder Schreibebene; Spielstand in die Ebene der Sitzung | Offen | REQ-368 | F-004 |  |  |
| T-365 | Freigaben an der Figur (view/play/edit), Rahmen der Kampagne | Offen | REQ-369 | F-012 |  | E-137 entschieden |
| T-366 | Assets ohne Status, mit Migration | Offen | REQ-370 | F-062 |  | nach E-143 |
| T-367 | Instanz-Muster an der Art; Anzeige Template · in play · adapted | Offen | REQ-371 | F-005 |  | nach E-140 |
| T-368 | Ecken gespeicherter Formen verschieben | Zusammengeführt | REQ-142 | F-061 |  | → T-370 |
| T-369 | Zeigen als Popup, Keep on my board, Kachel Shown | Offen | REQ-363 | F-052 |  | E-138 entschieden |
| T-370 | Gesetzte Punkte ziehen (Entwurf und gespeicherte Formen, Wände, Fenster, Bereiche) | Offen | REQ-142 | F-061 |  | enthält T-368 |
| T-371 | Tools-Editor der Karte: ein Häkchen je Gruppe, Erzwungenes mit Grund | Offen | REQ-131 | F-055 |  | Fehler |
| T-372 | Werkzeugleiste mit Belegungen, Hilfe und Kürzeln | Offen | REQ-373 | F-054 | Vorschlag #353 | nach E-145 |
| T-373 | Verknüpfung auch von der tieferen Karte einstellen | Offen | REQ-131 | F-055 |  |  |
| T-374 | Tokens zwischen Kartenstufen je Verknüpfung | Offen | REQ-374 | F-056 |  | baut auf T-328 |
| T-375 | Übergang zwischen Stufen: Form der tieferen Karte, Umgebung, weicher Rand, Masken | Offen | REQ-375 | F-055 |  | nach E-146, mit E-121 |
| T-376 | Rand der Karte darüber als Vorgabe; Titel und Kante je Betrachter | Offen | REQ-131 | F-055 |  |  |
| T-377 | Kartenbereiche (Bezirk, Fraktionsgebiet, Biom, Suchgebiet; Verknüpfung als Art) | Offen | REQ-376, REQ-193 | F-059 |  | nach E-147 |
| T-378 | Massstäbe und Einheiten der Karte | Offen | REQ-377 | F-049 |  |  |
| T-379 | Anlegen nach Regeln: Stand je Art/Ebene, Felder der Schnellanlage | Offen | REQ-378 | F-022 |  | nach E-148 |
| T-380 | Bühne flackert nicht, wenn die Karte sie genau füllt | Erledigt | REQ-130 | F-055 | #352 |  |
| T-381 | Kartenbild über die Karte statt über das Asset freigeben | Erledigt | REQ-139 | F-057 | #352 | D75 |
| T-382 | Release setzt ready und campaign; Deckname geht auf die Instanz | Erledigt | REQ-131 | F-055 | #352 | D76 |
| T-383 | Deckname verdeckt ohne Information; Reveal name | Erledigt | REQ-178 | F-012 | #352 | D77 |
| T-384 | Sichtpolygon: Ausdünnen wirft keine Wände mehr weg | Erledigt | REQ-139 | F-057 | #355 |  |
| T-385 | Rahmen springen nicht während eines Werkzeugs; Link shape mit Ecken, Einrasten, Undo | Erledigt | REQ-131, REQ-142 | F-055, F-061 | #356 |  |
| T-386 | Hineinzoomen nur am Fokus; Zoomtiefe mit jetzigem Stand; keine Lupe mit der Maus; Wände zurücknehmen | Erledigt | REQ-131, REQ-142 | F-055, F-061 | #358 | D80, D81, D82 |
| T-387 | Vorschlag: Leiste und Tasten | Erledigt | REQ-373 | F-054 | #353 (offen) | ersetzt docs/Werkzeuge.md im alten Repo Nebelwacht |
| T-388 | Vorschlag und Stories: Spieltisch als drei Boards | Erledigt | REQ-362, REQ-363, REQ-364, REQ-119 | F-067, F-052, F-025 | #354 |  |
| T-389 | Konzepte und Aufstellung vom 22.10., Stories REQ-365 bis 378 | Erledigt | REQ-365–378 | — | #357 |  |
| E-136 | Spielende sehen nur Karten im Spiel, nie die Vorlage | Entschieden | REQ-372 | F-055 |  | D78 |
| E-137 | Kein Koordinator als Rolle; Freigaben an der Figur, Rahmen durch die Kampagne | Entschieden | REQ-369 | F-012 |  | D79; vorher „E-2“ |
| E-138 | Zeigen als Popup, auf das Spielerboard nehmen, Kachel auf dem Spielboard | Entschieden | REQ-363 | F-052 |  | D83; vorher „E-3“ |
| E-139 | Umgebung eines Spielstands für Spielende: Vorlage als Bild und Rahmen, nie als Artikel? | Offen | REQ-372 | F-055 |  |  |
| E-140 | Instanzierung als drei Muster (Fassung, Spielstand, Stück), Angabe an der Art | Offen | REQ-371 | F-005 |  |  |
| E-141 | Setting als Ebenenart setting (ersetzt world), modular über Fassungen | Offen | REQ-100 | F-004 |  |  |
| E-142 | Sorten als Listen-Registerzeilen mit extends, erweiterbar im Feld | Offen | REQ-366 | F-003 |  |  |
| E-143 | Assets ohne Vorbereitungsstand | Offen | REQ-370 | F-062 |  |  |
| E-144 | Inhalte je Konto freigeben (app_user_content), Vorgabe alles | Offen | REQ-367 | F-010 |  |  |
| E-145 | Tastenbild: Shift in Stufen, Alt frei, Ctrl weiter; Leiste im Karussell | Offen | REQ-373 | F-054 | #353 |  |
| E-146 | Übergang zwischen Stufen an der Kante insideMap, Masken als Form, Bild unverändert | Offen | REQ-375 | F-055 |  |  |
| E-147 | Kartenbereich als Kante mit Form; Verknüpfung als Art davon | Offen | REQ-376 | F-059 |  |  |
| E-148 | Vorgabe-Stand: Regel an der Kampagne mit Ebene als Bedingung | Offen | REQ-378 | F-022 |  |  |
| E-149 | Die Karte gibt ihr Bild frei, nicht das Asset | Entschieden (umgesetzt, zur Bestätigung) | REQ-139 | F-057 | #352 | D75 |
| E-150 | Freigeben heisst teilen: ready + campaign, hiddenFrom bleibt | Entschieden (umgesetzt, zur Bestätigung) | REQ-131 | F-055 | #352 | D76 |
| E-151 | Ein Deckname verdeckt auch ohne Information; Aliasse gehen mit | Entschieden (umgesetzt, zur Bestätigung) | REQ-178 | F-012 | #352 | D77 |
| E-152 | Hineinzoomen nur, wo Zeiger bzw. Mitte des Blicks liegt | Entschieden (umgesetzt, zur Bestätigung) | REQ-131 | F-055 | #358 | D80 |
| E-153 | Lupe nur für Finger und Stift, nicht für die Maus | Entschieden (umgesetzt, zur Bestätigung) | REQ-142 | F-061 | #358 | D81 |
| E-154 | Rückgängig auf der Karte nimmt nur Wände zurück, nicht die ganze Karte | Entschieden (umgesetzt, zur Bestätigung) | REQ-142 | F-061 | #358 | D82 |

## Woher

- Aufstellung aller Wünsche: [Aufstellung-2026-10-22.md](Aufstellung-2026-10-22.md)
- Konzepte: [Konzepte-2026-10-22.md](Konzepte-2026-10-22.md)
- Boards: [Spieltisch-als-Boards.md](Spieltisch-als-Boards.md)
- Leiste: [Leiste-und-Tasten.md](Leiste-und-Tasten.md) (#353)

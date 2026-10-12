# UI-Runde: Arbeitsplan

Was auf dem Design-Canvas (Runden 1–5, 12.10.2026) entschieden wurde und in
welchen Paketen es in den Prototyp kommt. Die Anforderungen sind
**REQ-204 bis REQ-223** in `VTT/Requirements.md`, die Entscheidungen der
Leitung **D52** im Decision Log. Was die Pakete am Modell entscheiden, kommt
als D53 ff. dazu — die Nummer steht beim Paket, damit zwei gleichzeitige
Zweige nicht dieselbe vergeben.

Der Canvas ist der Entwurf, nicht die Vorgabe für jedes Pixel: gebaut wird
im Prototyp mit seinen Layout-Elementen und Farben. Wo der Canvas Zahlen
oder Namen zeigt, die nicht im Bestand stehen, sind es Beispiele.

## 1. Was die Leitung festgelegt hat (D52)

| Thema | Festlegung |
|---|---|
| Diagonalen | 5-10-5, gezählt **je Kreatur und Zug, mit jedem Zug neu**; die Zählung läuft über Wegpunkte weiter |
| Tempo | eine **änderbare Zahl** für den Zug statt eines Spurt-Schalters; Klettern, Schwimmen, Spurt als Bonusaktion sind andere Zahlen |
| Rechenmodi | genauer Weg · grösste Reichweite von hier · aus; die SL darf übersteuern |
| Weg | **wählbar** über Wegpunkte; zwischen zwei Punkten der günstigste Weg |
| Zonen | tragen **eigene Regeln**; Eis und Feuer sind Beispiele |
| Aufdecken | von Hand, oder **beim Bestätigen einer Bewegung, entlang des Pfads**; von Hand zeigt das Token „sieht / wird gesehen von“ (Sichtlinie, passive Wahrnehmung gegen Heimlichkeit) |
| Karte, Initiative | je **Vollbild**, je mit **SL- und Spieleransicht** |
| Initiative | wie **Improved Initiative**: Init, RK, TP, Zustände je Zeile, Statblock aus der Zeile |
| Dauer | Zustände und Notizen mit **Runden, Anker (wessen Zug) und Zeitpunkt (Anfang/Ende)** |
| Spieler-Initiative | aufgedeckte oder beteiligte Kreaturen; ungekannte mit **Decknamen** |
| Inventar | nach **Basils Blatt**; Figur männlich/weiblich/neutral **an der Kreatur** gespeichert |
| Tragraster | Grundquadrat nach Grösse (Tiny 3, Small 4, Medium 5, Large 6), **Zusatzquadrat aus dem Statblock gerechnet** (wie ein Merkmal seinen Trefferbonus aus STR + Übung rechnet) |
| Zonen im Inventar | Basiszonen aus dem Blatt, änderbar, gespeichert in `Inventory.zones` |
| Behälter | **jeder Behälter gibt eine Ziehstufe dazu**, ausgehend davon, wo er selbst liegt |
| Ziehen | am Bogen je Aktionsart ein Eintrag „Ziehen“; Klick zeigt, was herauskommt, mit Dauer |
| Blaupausen | werden **gelernt**; kein fester Fundort, ungelernte zeigen „muss noch gelernt werden“ |
| Material | wird **beim Start gebunden** und kann nicht doppelt gebraucht werden |
| Zeitleisten | Kampagne **und** Weltgeschichte (ein Krieg, eine Dynastie …) als Spuren |

### Basils Blatt, ausgemessen

- **Tragraster** 11 × 6: links ein Quadrat 6 × 6, gestuft nach Grösse
  (Tiny 3 × 3, Small 4 × 4, Medium 5 × 5, Large 6 × 6); rechts ein Quadrat
  5 × 5, gestuft +1 … +5 (das Zusatzquadrat).
- **Zonen im Tragraster** nach Spalten: 0–1 Bonusaktion, 2–4 Aktion,
  5–8 Zug, 9–10 Runde (Werte der Zeile `DrawTime`).
- **Rucksack**: Form `.###..` / `######` × 3 / `.###..`; Zonen nach Spalten
  0–1 Aktion, 2–3 Zug, 4–5 Runde.
- **Bag of Holding**: 4 × 8, ohne Zonen auf dem Blatt.
- **Plätze**: Kopf, Schulter, Torso, rechte Hand, linke Hand (beide „*“:
  nimmt alles), Beine, Stiefel, Gurt mit zwei Holstern, Accessoires: Ringe
  rechte Hand (4), Ringe linke Hand (4), Halskette (4).

## 2. Pakete

Je Paket ein Zweig `feature/<anliegen>` von `preprod`, Pull Request nach
`preprod`, selbst mergen. Vor dem Pull Request `preprod` hereinholen und die
erzeugten Dateien (**`emit-seed`, `catalogue`, `anforderungen`**) neu laufen
lassen statt Konflikte darin von Hand zu lösen. Jedes Paket zieht
`docs/Datenmodell.md`, `docs/Begriffe.md` und „How it works“ nach, wo sich
das Modell ändert, und setzt die REQ-Zeilen in `anforderungen.mjs`.

| Paket | Anforderungen | Entscheidung | Inhalt |
|---|---|---|---|
| **U1 Initiative** | REQ-211, 212, 213 | D53 | Tabelle wie Improved Initiative, Statblock aus der Zeile, Zustände/Notizen mit Anker und Zeitpunkt, Spieleransicht mit Decknamen |
| **U2 Inventar** | REQ-214, 215, 216, 217 | D54 | Figur an der Kreatur, Plätze nach dem Blatt, Tragraster aus Grösse und Statblock, Behälter in Behältern (+1 Stufe), Ziehen am Bogen |
| **U3 Handwerk** | REQ-218, 219 | D55 | Blaupausen gelernt/ungelernt, Filter, Material beim Start gebunden |
| **U4 Karte** | REQ-206, 207, 208, 209, 210 | D56 | Tempo, Wegpunkte, Zonen mit Regeln, Aufdecken entlang des Pfads, SL- und Spieleransicht, Vollbild |
| **U5 Zeitleisten** | REQ-220 | D57 | Spuren der Weltgeschichte neben der Kampagne |

Offen und nicht in dieser Runde: REQ-204/205 (Schirm und Boards je
Geschichtsartikel), REQ-221 (Begegnungsbau), REQ-222 (Stufenaufstieg),
REQ-223 (Regelsysteme als Rahmen).

### U1 · Initiative (REQ-211–213, D53)

- Die Zeile liest **RK und TP-Maximum vom Statblock** des Teilnehmers (der
  Instanz, `statsOf`), nicht aus einer Abschrift; `participates.props.hp`
  bleibt der Stand im Kampf.
- **Statblock aus der Zeile**: ein Klick öffnet ihn neben der Tabelle
  (Ansicht `quick`), ohne die Seite zu verlassen.
- **Dauer**: die Einträge in `participates.props.conditions` bekommen
  `anchor` (wessen Zug: die Kante des Teilnehmers) und `at`
  (`start` | `end`); `rounds` zählt beim Anfang bzw. Ende des Zuges des
  Ankers herunter. Ohne Anker: der eigene Zug, Ende — so verhält sich der
  Bestand heute, er bleibt gültig. Eine **Notiz** ist ein Eintrag mit
  `text` statt `rule`.
- **Spieleransicht**: `revealed`, `involved`, `identified` an
  `participates.props`; gezeigt wird die Gruppe und jede Kreatur, die
  aufgedeckt oder beteiligt ist; ohne `identified` der Deckname
  (`Identity.cover`, REQ-178); TP von Gegnern als Wort (unverletzt,
  angeschlagen, am Boden). Zurückgehalten wird am Server bzw. in
  `redactEntity`, nicht nur in der Maske.

### U2 · Inventar (REQ-214–217, D54)

- `Creature.figure` (`male` · `female` · `neutral`, Liste am Feld, F1).
- **Plätze nach dem Blatt.** `holds.props.slot` bekommt, was fehlt
  (Schulter, zweites Holster, Ringe je Hand, Halskettenplätze). Was
  umbenannt wird, wandert mit einem Skript in `prototype/migration/`; was
  niemand mehr trägt, wird aufgezählt.
- **Tragraster**: hat das Inventar einer Kreatur kein eigenes `grid`, kommt
  seine Form aus der Grösse des Statblocks (Grundquadrat) und einer
  **Rechnung gegen den Statblock** (Zusatzquadrat, 0 … 5) — beim Lesen
  gerechnet (D8), mit `evalArith`, kein `eval`. Wo die Rechnung steht
  (Einstellung oder Feld am Inventar), entscheidet das Paket; ohne Angabe
  bleibt das heutige Rechteck.
- **Behälter in Behältern**: ein Inventar darf in einem anderen liegen
  (z. B. `holds` auch auf `Inventory`, oder ein Verweis vom Inventar auf
  seinen Gegenstand für die Form). Die Ziehstufe eines Stücks ist das
  Langsamere aus seiner Zone im Behälter und **der Stufe des Behälters
  selbst + 1**, die Kette hinauf. Ein Behälter auf einem Platz am Körper
  nimmt die Stufe des Platzes; welche das ist, steht als Einstellung, nicht
  im Code.
- **Basiszonen**: die Zonen aus dem Blatt als Vorgabe beim Anlegen
  (Tragraster, Rucksack), änderbar wie heute.
- **Ziehen am Bogen**: im Abschnitt Aktionen je Aktionsart ein Eintrag
  „Draw“; ein Klick zeigt die Stücke, die mit dieser Aktion herauskommen,
  mit ihrer Stufe und ihrem Weg („Bag of Holding im Aktionsbereich → Zug“).

### U3 · Handwerk (REQ-218, 219, D55)

- Alle Rezepte sichtbar (soweit `articleVisible`), ungelernte gestrichelt
  mit **„must still be learned“** — kein Fundort.
- Filter: kann der Charakter · alle; machbar · fast (1–2 fehlen); nach
  Material; nach Beruf (`Recipe.trade`, `Recipe.tool`).
- **Beim Start gebunden**: was das Rezept braucht, verlässt den Vorrat und
  steht am Vorgang (`crafting.props`); Abbruch und Misslingen nach
  `Recipe.onFailure`. Das Anhängen während des Gangs bleibt für Material,
  das erst unterwegs dazukommt, ist aber nicht mehr die Vorgabe.

### U4 · Karte (REQ-206–210, D56)

- Bewegungsrechner mit Diagonalen 5-10-5 je Zug (Parität im Suchzustand),
  Wänden (`blocksMove`), Kreaturen und Zonenkosten; Modi genau, grösste
  Reichweite, aus; **Tempo des Zuges** als Zahl am Teilnehmer bzw. am Token
  (Sitzungszustand, nicht am Artikel).
- **Wegpunkte**; Gefahren und Reichweite von Gegnern meiden.
- **Zonen mit Regeln**: eine Zonenart ist ein Regelartikel; die Karte
  rechnet Bewegungskosten, Licht, Sicht und „versteckt bis PP n“ und zeigt
  den Rest. Gemalt wird mit den Zeichenebenen, die die Karte schon hat.
- **Aufdecken** entlang des bestätigten Pfads (automatisch) oder von Hand
  mit „sieht / wird gesehen von“; dieselbe Sichtprüfung wie der Nebel.
- **SL- und Spieleransicht**, **Vollbild**; Spielende bewegen ihre eigenen
  Tokens.

### U5 · Zeitleisten (REQ-220, D57)

- Reiter Kampagne · Weltgeschichte. Eine **Spur** ist ein Ereignis mit
  Spanne; was darin liegt, sind Ereignisse mit `Time` innerhalb (Kante
  oder Zeitraum — das Paket entscheidet). Spuren ein- und ausblendbar; die
  Kampagne ist eine Spur der Weltgeschichte. Was Spielende nicht wissen,
  sehen sie nicht.

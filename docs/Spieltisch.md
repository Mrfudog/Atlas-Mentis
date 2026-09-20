# Der Spieltisch

Stand 2026-09-20. Was in einem Zug gebaut wurde, nachdem A und B standen:
Assets, Karten, Charakterbogen, Inventar, Handwerk, Boards, Begegnungen,
Würfel, Aufträge und Zeitleiste. Die REQ-Nummern stammen aus
[`Mrfudog/atlas-mentis`](https://github.com/Mrfudog/atlas-mentis).

---

## Was daran neu ist — und was nicht

**Nichts davon hat das Rückgrat angefasst.** Jeder Bereich besteht aus
denselben drei Sorten Zeile: Komponenten, Schnittstellen, Kantenarten. Dazu
kommt je ein **Layout-Element** — ein Stück Zeichencode, das die Ansicht
aufrufen kann. Eine neue Sorte Artikel ist weiterhin ein Einfügen; eine neue
Sorte *Darstellung* ist eine Funktion und ein Eintrag in einer Liste.

Das ist die Grenze, die sich in dieser Etappe gezeigt hat: **Daten sind
Zeilen, Darstellung ist Code.** Eine Karte, ein Charakterbogen und ein
Kachelraster lassen sich nicht aus Feldern zusammensetzen, ohne eine
Sprache zu erfinden, die niemand schreiben will. Das war die richtige
Stelle, um Code zu schreiben.

| Bereich | Zeilen | Element |
|---|---|---|
| Assets | `AssetInfo`, `Asset` | — (im Bildfeld) |
| Karten | `MapInfo`, `Map`, `mapOf` / `insideMap` / `marker` | `map` |
| Charakterbogen | `Vitals`, `Skills` | `sheet` |
| Inventar | `holds`-Eigenschaften | `inventory` |
| Handwerk | `RecipeInfo`, `Recipe`, `needs` / `yields` | `crafting` |
| Boards | `BoardInfo`, `Board`, `placed` | `board` |
| Begegnungen | `EncounterInfo`, `Encounter`, `participates` / `onMap` / `loot` | `initiative` |
| Aufträge | `QuestInfo.tasks` | `quests` |
| Zeitleiste | `WorldDate`, `Event`, `involves` | `timeline` |
| Zugang | `Access` | — (Filter vor der Darstellung) |
| Sitzung live | `SessionState` | `live` |
| Tabellen | `TableInfo`, `Table`, `entry` / `tableFor` | `table` |
| Vorbereitung | `Todos` | `prep` |
| Sicherung | — (Register + Artikel als eine Datei) | — (Registerreiter) |
| Regeln | `RuleInfo.autolink` | — (eigener Einstieg) |
| Decknamen | `Identity.cover` | — (im Namen selbst) |
| Punktreise | `Explored`, `TravelInfo`, `route` | `crawl` |

---

## Die fünf Entscheidungen, die sich wiederholen

### 1. Was auf etwas zeigt, ist eine Kante

Ein Token auf der Karte zeigt auf einen Artikel — also ist es eine Kante mit
Koordinaten, kein Feld mit Namen. Damit öffnet ein Klick den Artikel, und
„auf welchen Karten kommt der Baron vor?" ist ein Rückbezug wie jeder
andere. Dasselbe gilt für Platzierungen auf einem Board, Teilnehmer einer
Begegnung und Zutaten eines Rezepts.

**Die Gegenprobe:** ein Rechteck auf einem Board zeigt auf nichts. Es liegt
deshalb als Feld am Board, und das ist kein Rückfall, sondern dieselbe Regel
von der anderen Seite. Eine Aufgabe in einem Auftrag („bring das Fass
zurück") genauso.

### 2. Was von beiden Enden abhängt, gehört an die Kante

Dasselbe Seil liegt bei der einen Figur am Gürtel und bei der anderen unten
im Rucksack. Dasselbe Talg geht in das eine Rezept einmal und in das andere
zwölfmal ein. Ein Feld am Gegenstand könnte nur eine der beiden Wahrheiten
tragen — also steht es an der Verbindung.

### 3. Anteile, nicht Bildpunkte

Kartenkoordinaten stehen als 0 bis 1. Ein Bild darf ersetzt, verkleinert
oder neu ausgeschnitten werden, ohne dass jeder Marker wandert; dieselbe
Karte trägt auf dem Telefon und am Bildschirm dieselben Stellen. Nur das
Board rechnet in Bildpunkten, weil es kein Bild hat, auf das es sich
beziehen müsste.

### 4. Zwei Sorten Zahl

`StatblockInfo` sind die ruhigen Werte, `Vitals` ist der Stand am Tisch. In
einer Karte lägen sie im Weg: jede Änderung schriebe die andere mit, und das
Wissensmodell könnte sie nicht trennen. Dieselbe Trennung bei der Begegnung
(`EncounterInfo.round` / `turn` gegen die Teilnehmerkanten).

### 5. Eine Ansicht zeichnet überall gleich

Das ist der Einlöser für A4. `layoutOf` und `renderLayoutItem` zeichnen eine
Kachel auf dem Board genauso wie die Artikelseite. Ein neues Element steht
ohne Zutun auch auf dem Board, und eine Karte, die als Kachel liegt, ist
dieselbe Karte — nur ohne Werkzeugleiste, denn ein Zoomknopf dort änderte
den Zoom der grossen Karte nebenan.

---

## Wo das Wissensmodell nochmal trägt

**Rezepte.** Ein Rezept, das jemand kennt, ist eine Information mit
`knownBy` — kein Feld „bekannt von". Drei Zustände statt zwei: bekannt,
**teilweise** bekannt, unbekannt. „Du kennst das Rezept, aber nicht die
letzte Zutat" ist eine Lage, die am Tisch vorkommt.

**Aufträge.** Dasselbe: ein Auftrag, dessen Informationen du nicht kennst,
steht auf dem Brett als Gerücht, nicht als Zeile mit Belohnung.

Beides ohne eine Zeile neuen Wissenscode. Das war die Frage, für die es A6
gab.

---

## Die Kampagneneinstellungen

Sechster Registerteil, Schlüssel und Wert, kein Schema (REQ-043). Jeder
Bereich liest die Schlüssel, die er kennt:

| Schlüssel | Wer liest ihn |
|---|---|
| `gridSize`, `gridUnit` | Karten |
| `inventoryCols`, `inventoryRows` | Kachelraster |
| `skills` | Charakterbogen (Fertigkeit → Attribut) |
| `conditions` | Charakterbogen und Initiative |
| `calendar` | Zeitleiste |

Die Seite hat für `skills` und `conditions` denselben Satz als Rückfall,
damit sie auch ohne die Zeile rechnet. Eine Kampagne mit anderen
Fertigkeiten ist damit eine Einstellung und kein Schemawechsel.

---

## Zwei Kanäle, und sie tragen Verschiedenes

Das hat sich beim Bauen von REQ-116 gezeigt und gilt seither überall:

**Der Speicher ist der Kanal für alles, was bleibt.** `onSnapshot` liefert
jede Änderung an jedes offene Fenster — die Seite war mehrgerätefähig, seit
sie Daten lädt, ohne dass es jemand gesagt hätte. Runde, Zug, Trefferpunkte,
die laufende Szene: alles steht im Speicher und kommt von dort bei allen an,
auch bei dem, der zehn Minuten später dazukommt.

**Der Raum ist der Kanal für Augenblicke.** Ein Wurf und ein Zeigen auf die
Karte muss niemand nachlesen. Ginge der laufende Kampf über den Kanal, sähe
ihn niemand, der später dazukommt — und das merkte man erst am Tisch.

## Was noch fehlt

1. **Ein richtiger Login** (REQ-031, 032). Die Identität kommt heute von der
   Laufzeit des Artefakts; ein Passwort im Browser wäre keines. Wenn der
   echte Stapel kommt, tritt REQ-031 an diese Stelle — die Abfragen darunter
   bleiben unverändert.
2. ~~**Nebel des Krieges, Licht und Sicht** (REQ-139, 140).~~ Steht seit
   2026-09-20 — siehe den Nachtrag unten.
3. ~~**Ebenen und Stapelauflösung** (REQ-004 bis 007).~~ Steht seit
   2026-09-20 — siehe [Ebenen.md](Ebenen.md).
4. **Blockanker.** Wissen an Blöcken hängt an der Block-Id; `Block.anchor`
   ist vorgesehen, wird aber nicht vergeben.
5. ~~**Gebietsraster auf der Karte** (REQ-193) und **Kartenkacheln**
   (REQ-138).~~ Stehen seit 2026-09-20 — siehe den Nachtrag unten.
6. ~~**Ruf und Beziehungen** (REQ-030, 081).~~ Steht seit 2026-09-20 — siehe
   [Ruf.md](Ruf.md).
7. ~~**Handwerk mit Zeit** (REQ-184 zur Hälfte).~~ Steht seit 2026-09-20 —
   siehe den Nachtrag unten.

---

## Schaudaten

Alles, was hier steht, ist im Artefakt mit Daten belegt — sie sind erfunden
und zum Wegwerfen gedacht:

- **Zwei Karten**, erzeugt als SVG: der Nebeldistrikt als Übersicht, die
  Kerzengasse auf Kampfmassstab, die zweite als Unterkarte der ersten.
- **Rook Nebelfinger**, Schurke 5, mit Bogen, Fertigkeiten, zwölf
  Gegenständen mit Formen und einem gefüllten Kachelraster.
- **Die Nebelwacht** als Gruppe mit eigenem Beutel.
- **Drei Rezepte**, die aufeinander aufbauen; das Alchemierezept ist
  teilweise geheim und nur Rook kennt den Kniff.
- **Ein Vorbereitungsboard** für Sitzung 12 mit sieben Platzierungen in
  sechs verschiedenen Ansichten.
- **Eine Begegnung** am Gully mit vier Teilnehmern, Beute und Taktik.
- **Drei Aufträge** in drei Ständen und **drei Ereignisse** über dreihundert
  Jahre Weltzeit.
- **Sela Kerzendocht** als zweite Spielerfigur — am selben Rezept sieht die
  Spielleitung alles, Rook den Kniff, Sela weder noch.
- **Zwei Tabellen**, die eine in der anderen, mit einem Eintrag, der nur in
  der Kerzengasse vorkommt.
- **Sitzung 12** mit laufendem Kampf, Karte auf dem Tisch und drei offenen
  Punkten.
- **Unterwacht**, eine Punktreise aus fünf Knoten mit Sinneseindrücken an
  den Wegen — einer davon muss erst gefunden werden.

---

## Nachtrag 2026-09-20 — Nebel, Licht, Gebiete

Drei Dinge, die gern verwechselt werden, weil sie alle etwas zudecken. Die
Trennung steht schon im Register, und genau da muss sie halten:

| | Was es ist | Wo es liegt | Warum dort |
|---|---|---|---|
| **Nebel** (REQ-139) | Was die Gruppe noch nie gesehen hat | `MapInfo.reveal` — ein Feld | Es zeigt auf nichts, und es bleibt |
| **Licht** (REQ-140) | Was sie gerade sieht | `marker.light` / `marker.dim` — an der Kante | Derselbe Radius ist auf einer Stadtkarte eine Strasse und auf einer Kampfkarte ein Raum; er hängt an beiden Enden |
| **Gebiet** (REQ-193) | Wem etwas gehört | Kantenart `territory` | Es zeigt auf einen Artikel |

**Beleuchtetes wird nie gespeichert.** Es gibt kein Feld dafür — es wird bei
jeder Zeichnung neu gerechnet, wie jeder abgeleitete Wert (D8). Aufgedecktes
dagegen wird gespeichert, weil es bleibt. Das ist derselbe Schnitt wie
zwischen `StatblockInfo` und `Vitals`, nur eine Etage höher.

**Der Schatten wird gerechnet, nicht gemalt.** `visionPoly` schwenkt Strahlen
zu jeder Wandecke — knapp daneben auf beiden Seiten, sonst hätte der Schatten
keine Kante — und dazu einen Kranz für den runden Rand. Wände, die den
Lichtkreis nicht berühren, werden gar nicht erst geprüft. Ein Schatten, der
nur ungefähr stimmt, ist am Tisch eine Behauptung; deshalb misst der Prüflauf
ihn nach, statt das Bild anzusehen.

**Gezeichnet wird in Quadrateinheiten** (x von 0 bis 1, y von 0 bis
Seitenverhältnis). Sonst wäre jeder Lichtkreis auf einer breiten Karte ein Ei.
Die Bildgrösse kommt aus `AssetInfo.width`/`height` — ein Wert, der im
Register steht, muss nicht gemessen werden; gemessen wird nur, was von aussen
kommt. Solange sie unbekannt ist, deckt die Seite **alles** zu: ein Nebel, der
zu spät kommt, ist kein Nebel.

**Gerastert, nicht umrandet.** Ein Gebiet wird auf das Gitter gerundet —
gefüllt wird, welches Feld mit seiner Mitte in der Form liegt. Am Tisch zählt,
welche Quadrate unsere sind, nicht wo die Linie genau verläuft.

Für die Spielleitung ist Zugedecktes durchscheinend: sie muss sehen, was sie
zudeckt. Für alle anderen ist es zu.

---

## Nachtrag 2026-09-20 — Handwerk, das wirklich läuft

Bis hierher stand am Rezept, was es kostet, wie lange es dauert und gegen
welchen Wert man würfelt — **und niemand würfelte und niemand zählte.** Eine
Zeit, die nur dasteht, ist eine Notiz; eine Probe, die nur dasteht, ist eine
Behauptung.

Ein Gang hängt an **beiden** Enden: an dem, der arbeitet, und an dem Rezept.
Also steht er an einer Kante (`crafting`) — dieselbe Regel wie bei der
Tragestufe im Inventar und beim Lichtradius auf der Karte. Kein Artikel: ein
Gang ist vorbei, wenn er vorbei ist, und ein Artikel, den man anschliessend
löscht, war keiner.

**Das Material geht am Anfang hinein.** Das ist die Zeile `put` an der Kante,
und an ihr hängt alles Weitere: nur deshalb kann ein Gang scheitern und etwas
kosten, und nur deshalb ist `onFailure` mehr als eine Zeile im Register.

Gewürfelt wird **einmal am Ende**, mit demselben Würfelwerk wie alles andere,
gegen den Schwierigkeitsgrad des Rezepts. Der Übungsbonus kommt aus
`Skills.tools` — Rook ist in Alchemie geübt, die Gruppe als solche nicht — und
das Werkzeug muss dabei sein: es gehört zu **„was fehlt"**, in derselben
Spalte wie das Material. Es getrennt zu behandeln hiesse, dass die Matrix
„ja" sagt und das Anfangen „nein", und genau die Art Widerspruch verzeiht man
am Tisch der Software nicht mehr.

Der Wurf bleibt stehen: „Rezept: Rauchbombe: 17 vs DC 12 — made it, Rauchbombe
in the pack." Ein Ergebnis, das nicht nachlesbar ist, wird am Tisch neu
gewürfelt.

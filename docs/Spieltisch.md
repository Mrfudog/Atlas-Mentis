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

## Was noch fehlt

1. **Sitzungszustände und Echtzeit** (REQ-116, 117). `round` und `turn`
   liegen an der Begegnung; richtig wäre ein Zustandsobjekt je Sitzung mit
   einem Kanal, den mehrere Geräte sehen. Sie stehen absichtlich beieinander
   in einer Karte, damit der Umzug eine Karte betrifft und nicht ein Dutzend
   Felder. **Das Artefakt könnte das:** die Fähigkeit `room` liefert genau
   diesen Kanal.
2. **Spielerzugang** (REQ-031 bis 038). Ohne ihn bleibt `visibleFields`
   geprüft, aber ungenutzt, und der Spielerbogen ist eine Ansicht, die
   niemand aufruft.
3. **Nebel des Krieges, Licht und Sicht** (REQ-139, 140). Braucht eine
   Zeichenfläche statt Bildpunkten.
4. **Zufallstabellen und Beutetabellen** (REQ-125, 186). `loot` trägt heute
   eine Chance in Prozent, aber niemand würfelt sie aus.
5. **Ebenen und Stapelauflösung** (REQ-004 bis 007). Der Prototyp kennt eine
   Kampagne; die Ebenen sind der grösste Brocken, den das Rückgrat noch
   nicht trägt.
6. **Blockanker.** Wissen an Blöcken hängt an der Block-Id; `Block.anchor`
   ist vorgesehen, wird aber nicht vergeben.

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

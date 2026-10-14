# T-110 — die ersten Ansichten je Art (Bericht, 14.10.2026)

Schritt 7 von T-110 (REQ-256, E-030 b): die Arten durchgehen und wenige
sinnvolle Ansichten anlegen. Die Zeilen stehen in
`packages/registry/src/ansichten.ts` (für eine leere Datenbank) und in
`apps/server/migrations/051_ansichten_je_art.sql` (für dev und später
prod — nur, wo eine Art für die Ansicht noch nichts sagt); ein Test hält
beide gleich.

Alles ist eine **Anpassung** (`{ adjust }`), keine Abschrift: ändert die
Leitung die Ansicht im Register (Registry › Views), gilt die Anpassung über
dem Neuen. Ändern oder zurücknehmen geht auf der Typseite unter *Views*
(„As the view says").

## Was sich ändert

**Overview** (Listenzeile, Verweis) und **Full** (Artikelseite) bleiben,
wie sie sind — die Spalten im Kompendium und die Buchseiten standen schon
an den Arten (W2, W7).

**Quick** (Karte, Vorschau neben der Liste, Popup, Kachel): bisher stand
auf der Karte jeder Art nur Beschreibung und Absatz — beim Zauber nicht
einmal der Grad. Jetzt die zwei, drei Werte, an denen man die Sache
erkennt. Gezeigt wird, was der Artikel davon hat; ein leerer Wert fällt
weg. Masse sind nicht dabei: die Karte druckt Rohwerte („60" ohne Fuss).

| Art | vorher auf der Karte | nachher |
|---|---|---|
| Spell | — | Spell level, School, Concentration, Ritual (+ Rule kind) |
| Class | — | Hit die, Primary ability (+ Rule kind) |
| Ancestry | — | Size (+ Rule kind) |
| Feat | — | Prerequisite (+ Rule kind) |
| Rule Element | — | Rule kind |
| Item | — | Item type, Rarity, Requires attunement |
| Weapon | — | Category, Damage, Damage type + was Item zeigt |
| Armor | — | Armour type, Armour class + was Item zeigt |
| Creature (NSC, Spielerfigur …) | — | Species, Kind, Role, Attitude |
| Place | — | Place type, Environment |
| Faction | — | Kind, Goal |
| Deity | — | Pantheon, Alignment |
| Hazard | — | Kind, Threat |
| Scene / Encounter | — | Mode, Difficulty |
| Quest | — | Progress, Reward |

Der Statblock behält seine eigene Karte (alle Felder und Abschnitte).
„+ Rule kind" heisst: die Art erbt von *Rule Element* und damit dessen
Anpassung; bei den eingelesenen Artikeln ist das Feld meist leer und
erscheint dann nicht.

**Print** (neu, „Print" an der Artikelseite): Beschreibung, alle Felder
ausser dem Vorbereitungsstand, Prosa, Teile, Abschnitte. Statblock, Zauber
und Gegenstand (mit Waffe und Rüstung) setzen dazu ihr Buch-Element
obenan — der Statblock wie im Monster Manual, der Zauber wie im PHB:

| Art | vorher (Druck ohne Anpassung) | nachher |
|---|---|---|
| Spell | Feldtabelle, Text | **wie im Buch** (Casting Time … At Higher Levels), Rest als Zeilen |
| Statblock | Feldtabelle, Abschnitte | **wie im Buch**; die Abschnitte zeichnet der Statblock selbst (`drop: p-c`, sonst stünden sie doppelt) |
| Item | Feldtabelle, Text | **wie im Buch** (Art, Seltenheit kursiv; Werte) |

**Handout** (neu, eigene Ansicht): Beschreibung, Absatz, Vorlesetext —
keine Werte, keine Geheimnisse. Zu wählen beim Drucken („View") und auf
einer Kachel des Boards.

## Geprüft

Lokal mit der Ausfuhr von dev (24 296 Artikel), Playwright 1360 px: die
Karten von Thunderwave, +1 Amulet of the Devout, Whip, Breastplate of
Balance, Fighter, Harengon, Mage Slayer, Kol Korran, Russet Mold und der
Spielerfigur „Test" vor und nach der Migration; der Druck von Thunderwave,
Blagothkus und +3 Ammunition; der Handzettel einer Story. Bilder nicht im
Repo (5e.tools-Texte).

Gefunden: im Druck des Statblocks standen Aktionen und Merkmale doppelt
(Buch-Element und Abschnitte) — behoben, s. oben. Und: die Migration
setzte zuerst nur eine von zwei Ansichten einer Art (ein `UPDATE … FROM`
nimmt je Zeile nur einen Treffer) — jetzt je Art zusammengefasst.

## Offen

- Das Register auf **dev** weicht vom Seed ab: dort fehlen die
  `overview`-Spalten der Arten und die Buch-Anordnungen (`full` von
  Statblock und Zauber zeichnen auf dev als Feldtabelle), und `Layer.kind`
  kennt `book`/`adventure` nicht, obwohl Artikel es tragen. Der Seed
  schreibt nur in eine leere Datenbank. Als Entscheidung ins Brett
  gestellt (nachziehen oder so lassen).
- Karte und Kachel zeigen Rohwerte ohne Einheit und ohne Namen von
  Verweiszielen; die Artikelseite und der Druck rechnen sie um. Das ist
  älter als T-110 und betrifft jede Karte.

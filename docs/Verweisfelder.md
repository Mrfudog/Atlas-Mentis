# Felder, die Verweise sein sollten (T-078)

↑ [Modell](Themen/Modell.md) · [Einstieg](README.md)

Die Leitung (13.10.2026): „Es gibt noch viele Felder, die nicht richtig sind
und nicht den notwendigen Verweis machen.“ T-068 macht jedes Feld, das im
Register als Verweis erklärt ist (`format: 'link'` mit `target`), zur
Auswahl. Ein Feld, das auf einen Artikel zeigen *sollte*, aber als Text
erklärt ist, erfasst es nicht. Hier ist jedes solche Feld aufgezählt.

**Wie gezählt wurde:** alle Felder aller Arten aus `packages/registry`, gegen
einen frischen 5e.tools-Bestand (`import-5etools`, 21 457 Artikel). Je Wert
wurde nachgesehen, ob ein Artikel genau so heisst (ohne Gross- und
Kleinschreibung) und welcher Art er ist. Der Kampagnenbestand auf dev ist
darin **nicht** enthalten — Felder, die nur die Kampagne füllt (Kreatur,
Ort, Rezept), stehen mit 0 da; was dort steht, sieht erst die Leitung.

Was schon eine Kante ist, steht hier nicht: Fraktion (`memberOf`), Wohnort
(`livesIn`), Gottheit (`worships`), Klasse und Abstammung einer Spielerfigur
(`hasClass`, `hasAncestry`), Ort einer Geschichte (`happensAt`).

## Umgestellt (eindeutig)

Ziel klar, Werte lassen sich zuordnen. Register auf `format: 'link'` mit
`target`, gespeicherte Namen schreibt `apps/server/migrations/025_verweisfelder.sql`
in Ids um, der Importer schreibt Ids.

| Art.Feld | vorher | Artikel mit Wert | Beispielwerte | Ziel | zuordenbar |
|---|---|---|---|---|---|
| `Statblock.conditionImmunities` | Liste, `enumRef: 'Condition'` (Namen) | 1 450 | Poisoned, Charmed, Frightened, Exhaustion | `Condition` | 5 399 von 5 403 Werten; 4 × „Disease" ist kein Zustand → Notiz |
| `Weapon.ammoType` | Text, `suggest` | 27 | arrow, crossbow bolt, sling bullet, energy cell | `Item` (Munition) | 7 Wörter, 7 Gegenstände, je genau einer |

Was nicht genau einem Artikel der Zielart gehört (kein Treffer oder
mehrere), steht danach als Notiz am selben Artikel (`Notes.note`, Eintrag
`condition-immunities` bzw. `ammunition`) — nichts geht still verloren.

## An den Artikeln entschieden (T-099, E-020)

Die Leitung (14.10.): die Nachtarbeit geht die Artikel durch und
entscheidet je Feld anhand der Daten. Gezählt am **ganzen Bestand auf
dev** (24 296 Artikel, Stand 14.10.2026 abends). Die Regel: trifft der
überwiegende Teil der Werte genau einen Artikel und gibt es eine Zielart,
wird das Feld ein Verweis; fehlt die Zielart, kommt sie als Vorschlag ins
Brett und wird nicht angelegt.

Auf dev gibt es **keinen einzigen** Kampagnenartikel mit Kreatur, Rezept
oder Material — nur drei Testfiguren. Die Felder, die nur die Kampagne
füllt, stehen darum überall mit 0 da; entschieden wird dort aus der
Bedeutung und einem Ersatzmass.

| Art.Feld | Artikel mit Wert | Werte (verschieden) | trifft genau einen Artikel | Entscheid | Warum |
|---|---|---|---|---|---|
| `Deity.domains` | 470 | 778 (15) | 777 → `Subclass` | **Verweis auf `Subclass`** | „Knowledge" ist der Kurzname von „Knowledge Domain"; zugeordnet über Name, „… Domain", Kurzname — die erste Stufe, die trifft. „War" ist auch der Kurzname von „War Magic" (Magier), „War Domain" aber eindeutig. Rest: „Unknown" (Ezra) → Notiz `domains`. Migration `048_gottheit_domaenen.sql`, Importer schreibt Ids. |
| `Recipe.tool` | 0 | — | Werkzeuge sind 29 `Item`-Artikel | **Auswahl aus den Werkzeug-Artikeln, gespeichert als Name** (`enumRef: 'Item'`, `enumWhere` wie die Übungen) | Das Handwerk prüft das Werkzeug gegen die Werkzeugübung (`Proficiencies.proficient`), und die bleibt ein Name (siehe unten). Id hier und Name dort wären zwei Formen derselben Frage. Keine Migration: der Wert bleibt, was er war, und die Prüfung hält ihn nicht an der Liste fest (F12). |
| `Creature.species` | 0 | — | Ersatzmass: die Klammerzusätze humanoider Statblocks („humanoid (elf)") treffen zu 52 % eine Abstammung (894 von 1 715) | **bleibt Wort** | Die andere Hälfte sind Wesen ohne Abstammungsartikel (demon, devil, goblinoid, shapechanger, beholder). Eine NSC-Sorte ist oft keine spielbare Abstammung — eine Kante `hasAncestry` von jeder Kreatur verlangte für jeden Nebelgeist einen Abstammungsartikel. |
| `Language.script` | 98 | 98 (25) | 76 treffen eine Sprache | **bleibt Wort** | Eine Schrift ist keine Sprache: Elvish als Schrift von Sylvan zeigte auf die Sprache Elvish, nicht auf ihre Buchstaben; „Thorass" (16) hat kein Ziel. Eine Art „Schrift" wäre eine Zeile für ein Wort. |
| `Deity.plane` | 0 | — | — | **bleibt Wort** | Ebenen gibt es nicht als Orte; zu entscheiden, wenn sie welche werden. |
| `Deity.pantheon` | 494 | 494 (23) | 0 passende (die Treffer sind Sprachen und Abstammungen: „Elven", „Dwarven") | **bleibt Wort** — Zielart fehlt | Vorschlag **E-033** (eigene Art, Fraktion oder Wort). |
| `Statblock.creatureType`, `Ancestry.creatureType` | 3 829 / 23 | 211 / 6 | — | **bleibt Wort** — Zielart fehlt | 211 Werte, weil die Klammer mitsteht; 14 Grundtypen. Vorschlag **E-034** (Aufzählungszeile mit Zusatzfeld). |
| `Recipe.trade`, `Material.trades` | 0 / 0 | — | — | **bleibt Wort** — Zielart fehlt | Vorschlag **E-035** (eigene Art, Werkzeug oder Wort). |
| `Proficiencies.proficient`, `.expertise`, `ProficiencyChoice.chooseFrom`, `Class.multiclassProficient` | 3 150 / 1 061 / 0 / 11 | 9 678 / 1 546 / — / 35 | proficient: 8 935 (Skill 5 499, Language 3 382, Item 54), 23 ohne Treffer, Rest mehrdeutig; expertise: alle → Skill | **bleibt Name** (T-068 macht eine Auswahl daraus) | Das Feld mischt Artikel aus vier Arten **und** Wörter (`light`, `martial`, `simple`), und der Bogen rechnet Fertigkeiten über den Namen. Ids hiessen zwei Felder oder Mischwerte (E-020, Vorschlag der Zeile). |

## Kein Verweis

Sätze, die Verweise *enthalten* (`[[…]]` im Text), oder Wörter ohne Artikel:
`Feat.prerequisite`, `Statblock.acNote`, `Statblock.languageNote`,
`Language.typicalSpeakers`, `Quest.reward`, `Item.appliesTo` (Marken),
`Tags.tags`, `Class.subclassTitle`, `Subclass.shortName`,
`Feature.featureType`, `Creature.kind`/`role`, `Place.environment`,
`Story.kind`, `Event.kind`, `World.calendar`. `ZoneKind.damageType` ist
Text mit `suggest` und gehört an die Zeile `DamageType` — eine Aufzählung,
kein Verweis.

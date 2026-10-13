# Felder, die Verweise sein sollten (T-078)

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

## Unklar — zur Entscheidung (E-020)

| Art.Feld | heute | Artikel mit Wert | Beispielwerte | Vorschlag | Folgen |
|---|---|---|---|---|---|
| `Proficiencies.proficient`, `.expertise`, `ProficiencyChoice.chooseFrom`, `Class.multiclassProficient` | Liste, `enumRef` auf `Skill`, `Language`, `Item`, `Weapon` **und** die Wortlisten `Weapon.category`, `Armor.armorType` | 3 150 / 1 061 / 54 / 11 | Perception, Common, Thieves' Tools, martial, light | **bleibt Name** (T-068 macht schon eine Auswahl daraus) | Ein Feld mischt Artikel und Wörter („martial" hat keinen Artikel). Ids hiessen zwei Felder (Artikel, Wörter) oder Mischwerte; der Bogen und die Fertigkeitsrechnung lesen heute Namen. |
| `Creature.species` | Text, `suggest` | 0 (nur Kampagne) | — | Kante `hasAncestry` auch von `Creature` (heute nur Spielerfigur) | Eine Art für NSC wie Spielerfigur; freie Sorten („Nebelgeist") brauchten dann einen Abstammungsartikel. Werte auf dev unbekannt. |
| `Deity.domains` | Liste, Text | 470 | Knowledge, War, Trickery, Life | **bleibt Wort**, oder Verweis auf die Unterklasse „… Domain" | Namen weichen ab („Knowledge" ↔ „Knowledge Domain"), nicht jede Domäne hat eine Unterklasse. |
| `Deity.pantheon` | Text, `suggest` | 494 | Faerûnian, Dragonlance, Elven | **bleibt Wort** | Keine Art „Pantheon"; eine Fraktion wäre ein Umbau. |
| `Deity.plane` | Text, `suggest` | 0 | — | Verweis auf `Place` | Ebenen gibt es heute nicht als Orte. |
| `Language.script` | Text, `suggest` | 98 | Common, Dwarvish, Elvish, Thorass | **bleibt Wort** | 76 von 98 treffen eine Sprache, aber eine Schrift ist keine Sprache; „Thorass" hat kein Ziel. |
| `Recipe.tool` | Text, `suggest` | 0 (nur Kampagne) | — | Verweis auf `Item` | Werkzeuge sind Gegenstände; Werte auf dev unbekannt. |
| `Recipe.trade`, `Material.trades` | Text / Liste | 0 | — | **bleibt Wort** | Keine Art „Handwerk". |
| `Statblock.creatureType`, `Ancestry.creatureType` | Text, `suggest` | 3 829 / 23 | humanoid (human), beast, undead | **bleibt Wort** (später eine Aufzählungszeile) | Keine Art „Kreaturtyp"; Klammerzusätze („humanoid (elf)") sind Text. |

## Kein Verweis

Sätze, die Verweise *enthalten* (`[[…]]` im Text), oder Wörter ohne Artikel:
`Feat.prerequisite`, `Statblock.acNote`, `Statblock.languageNote`,
`Language.typicalSpeakers`, `Quest.reward`, `Item.appliesTo` (Marken),
`Tags.tags`, `Class.subclassTitle`, `Subclass.shortName`,
`Feature.featureType`, `Creature.kind`/`role`, `Place.environment`,
`Story.kind`, `Event.kind`, `World.calendar`. `ZoneKind.damageType` ist
Text mit `suggest` und gehört an die Zeile `DamageType` — eine Aufzählung,
kein Verweis.

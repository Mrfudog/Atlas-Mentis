# 5e.tools-Übernahme — Bericht

Erzeugt von `packages/import-5etools` (Paket P5, [5etools-Arbeitsplan.md](5etools-Arbeitsplan.md)). **Nicht von Hand ändern** — ein neuer Lauf schreibt die Datei neu.

- Datenstand: 5etools-src 8c026b8 2026-10-08
- Aufruf: `node packages/import-5etools/dist/cli.js <data> --out <datei> --bericht <datei>`
- **27’838 Artikel**, alle durch `validateEntity` mit `knownTypes`
- Gleichlautende Merkmale der Statblöcke (Arbeitsplan §2.5): 1’893 Aktionen und Merkmale stehen an mehr als einem Statblock; 5’705 Doppel wurden dadurch nicht angelegt

## Artikel je Art (unsere)

| Art | Artikel |
| --- | ---: |
| `Action` | 9’130 |
| `ActionType` | 7 |
| `Ancestry` | 227 |
| `Armor` | 76 |
| `Background` | 101 |
| `Class` | 16 |
| `Condition` | 23 |
| `Deity` | 494 |
| `Disease` | 22 |
| `Faction` | 30 |
| `Feat` | 108 |
| `Feature` | 8’204 |
| `Hazard` | 57 |
| `Item` | 1’638 |
| `ItemProperty` | 14 |
| `Language` | 150 |
| `Layer` | 1 |
| `Rule` | 624 |
| `Skill` | 18 |
| `Spell` | 525 |
| `Statblock` | 3’829 |
| `Subclass` | 124 |
| `Table` | 2’159 |
| `Weapon` | 261 |

## Je 5e.tools-Art

*Gelesen* ist jeder Eintrag der Liste, *Artikel* die daraus angelegten Hauptartikel (ohne die Aktionen und Merkmale, die ein Statblock oder eine Klasse dazu anlegt). Die Differenz steht unter *ausgeschlossen* und *Notizen*.

| 5e.tools | gelesen | Artikel | ausgeschlossen | Notizen |
| --- | ---: | ---: | ---: | --- |
| `action` | 48 | 30 Action | 18 | — |
| `adventure` | 101 | — | — | `weggelassen: Abenteuer-Metadaten: eine Systemebene statt einer je Buch (Arbeitsplan §1)` 101 |
| `artObjects` | 10 | 5 Table | 5 | — |
| `background` | 171 | 101 Background | 70 | — |
| `backgroundFluff` | 170 | — | — | — |
| `baseitem` | 230 | 56 Item, 54 Weapon, 14 Armor | 106 | — |
| `book` | 66 | — | — | `weggelassen: Buch-Metadaten: eine Systemebene statt einer je Buch (Arbeitsplan §1)` 66 |
| `boon` | 12 | 12 Rule | — | — |
| `card` | 765 | — | — | `weggelassen: später (E4)` 765 |
| `charoption` | 44 | 44 Rule | — | — |
| `charoptionFluff` | 5 | — | — | `weggelassen: nur Bilder (E5)` 5 |
| `class` | 30 | 16 Class | 14 | — |
| `classFeature` | 677 | 255 Feature | 325 | `mit gleichlautendem Eintrag vereint` 97 |
| `classFluff` | 30 | — | — | — |
| `condition` | 30 | 15 Condition | 15 | — |
| `conditionFluff` | 13 | — | — | `weggelassen: nur Bilder (E5)` 13 |
| `crochetPattern` | 20 | — | — | `weggelassen: Häkelmuster` 20 |
| `crochetPatternFluff` | 20 | — | — | `weggelassen: Häkelmuster` 20 |
| `cult` | 30 | 30 Faction | — | — |
| `deck` | 35 | — | — | `weggelassen: später (E4)` 35 |
| `deity` | 563 | 494 Deity | 69 | — |
| `disease` | 29 | 22 Disease | 7 | — |
| `dragon` | 4 | — | — | `weggelassen: Schatztabellen mit verschachtelten Würfen — noch nicht zugeordnet` 4 |
| `dragonMundaneItems` | 25 | — | — | `weggelassen: Schatztabellen mit verschachtelten Würfen — noch nicht zugeordnet` 25 |
| `encounter` | 42 | 40 Table | 2 | — |
| `facility` | 70 | — | — | `weggelassen: später (E4)` 70 |
| `facilityFluff` | 16 | — | — | `weggelassen: später (E4)` 16 |
| `feat` | 305 | 108 Feat | 197 | — |
| `featFluff` | 44 | — | — | `weggelassen: nur Bilder (E5)` 44 |
| `gems` | 12 | 6 Table | 6 | — |
| `hazard` | 73 | 28 Hazard | 45 | — |
| `hazardFluff` | 3 | — | — | `weggelassen: nur Bilder (E5)` 3 |
| `hoard` | 8 | — | — | `weggelassen: Schatztabellen mit verschachtelten Würfen — noch nicht zugeordnet` 8 |
| `individual` | 8 | — | — | `weggelassen: Schatztabellen mit verschachtelten Würfen — noch nicht zugeordnet` 8 |
| `item` | 2’512 | 1’393 Item, 59 Armor, 197 Weapon | 863 | — |
| `itemEntry` | 13 | — | — | `weggelassen: Textschablonen, beim Lesen eingesetzt` 13 |
| `itemFluff` | 980 | — | — | `weggelassen: nur Bilder (E5)` 980 |
| `itemGroup` | 119 | 60 Item, 3 Armor, 10 Weapon | 46 | `Mitglied hat schon einen Grundgegenstand` 50 |
| `itemMastery` | 8 | — | — | `weggelassen: Waffenmeisterschaft gibt es erst 2024` 8 |
| `itemProperty` | 27 | 14 ItemProperty | 13 | — |
| `itemType` | 67 | — | — | `weggelassen: eine Aufzählung am Feld Item.itemType, kein Artikel` 67 |
| `itemTypeAdditionalEntries` | 2 | — | — | `weggelassen: Textschablonen` 2 |
| `language` | 201 | 150 Language | 51 | — |
| `languageFluff` | 26 | — | — | `weggelassen: nur Bilder (E5)` 26 |
| `languageScript` | 6 | — | — | `weggelassen: die Schrift steht als Wort an Language.script` 6 |
| `legendaryGroup` | 188 | 144 Rule | 44 | — |
| `legendaryGroupTemplate` | 1 | — | — | `weggelassen: Schablone` 1 |
| `lifeBackground` | 13 | — | — | `weggelassen: Tabellen aus „This Is Your Life" — noch nicht zugeordnet` 13 |
| `lifeClass` | 12 | — | — | `weggelassen: Tabellen aus „This Is Your Life" — noch nicht zugeordnet` 12 |
| `magicItems` | 33 | 9 Table | 24 | — |
| `magicvariant` | 230 | 129 Item | 101 | `inherits.resist nicht übernommen` 16, `inherits.hasRefs nicht übernommen` 10, `inherits.bonusSpellDamage nicht übernommen` 8, `inherits.bonusWeaponAttack nicht übernommen` 3, `inherits.modifySpeed nicht übernommen` 3, `inherits.valueExpression nicht übernommen` 3, … (4 weitere) |
| `monster` | 4’560 | 3’809 Statblock | 751 | `Spielarten (_versions) nicht ausgeschrieben` 68, `_mod scalarAddProp an fehlendem save` 19, `_mod scalarAddProp an fehlendem skill` 13 |
| `monsterfeatures` | 25 | — | — | `keine Zuordnung` 25 |
| `monsterFluff` | 4’170 | — | — | — |
| `monsterTemplate` | 66 | 66 Rule | — | — |
| `name` | 10 | 10 Table | — | — |
| `object` | 37 | 20 Statblock | 17 | — |
| `objectFluff` | 11 | — | — | `weggelassen: nur Bilder (E5)` 11 |
| `optionalfeature` | 221 | 151 Feature | 70 | — |
| `optionalfeatureFluff` | 1 | — | — | `weggelassen: nur Bilder (E5)` 1 |
| `psionic` | 52 | — | — | `weggelassen: Unearthed Arcana, nie erschienen` 52 |
| `race` | 160 | 134 Ancestry | 26 | `Zauber zur Wahl (als Text belassen)` 1 |
| `raceFluff` | 223 | — | — | — |
| `recipe` | 316 | — | — | `weggelassen: Kochrezepte, kein Handwerk (Abgleich §2.5)` 316 |
| `recipeFluff` | 316 | — | — | `weggelassen: Kochrezepte` 316 |
| `reward` | 278 | 237 Rule | 41 | — |
| `sense` | 8 | 4 Rule | 4 | — |
| `skill` | 36 | 18 Skill | 18 | — |
| `spell` | 969 | 525 Spell | 444 | `Komponente R (2024)` 3, `mehrere Dauern (erste übernommen)` 3, `mehrere Wirkzeiten (erste übernommen)` 1 |
| `spellFluff` | 92 | — | — | `weggelassen: nur Bilder (E5)` 92 |
| `status` | 5 | 2 Condition | 3 | — |
| `subclass` | 330 | 124 Subclass | 206 | `Zauber zur Wahl (als Text belassen)` 80 |
| `subclassFeature` | 1’499 | 873 Feature | 619 | `mit gleichlautendem Eintrag vereint` 7 |
| `subclassFluff` | 164 | — | — | — |
| `subrace` | 98 | 93 Ancestry | — | `Zauber zur Wahl (als Text belassen)` 8, `Unterart ohne Namen (Spielart der Abstammung)` 5 |
| `table` | 2’381 | 1’910 Table | 471 | — |
| `tableGroup` | 22 | 17 Table | 5 | — |
| `trap` | 37 | 29 Hazard | 8 | `Gefahrgrad moderate` 2 |
| `trapFluff` | 5 | — | — | `weggelassen: nur Bilder (E5)` 5 |
| `variantrule` | 245 | 117 Rule | 128 | — |
| `vehicle` | 39 | — | — | `weggelassen: später (E4)` 39 |
| `vehicleFluff` | 36 | — | — | `weggelassen: später (E4)` 36 |
| `vehicleUpgrade` | 31 | — | — | `weggelassen: später (E4)` 31 |

## Ausgeschlossene Quellen

Nach Arbeitsplan §1, E2: 2014 als Basis. Je Grund die Quellen mit Anzahl Einträgen, über alle Arten.

- **2024-Kernbuch** (3’637): XPHB 1’704, XDMG 1’008, XMM 558, PHB 69, AU 66, FRHoF 64, XGE 43, RHW 42, TCE 41, PSA 14, SCAG 9, EGW 5, DMG 4, VRGR 3, DSotDQ 2, FTD 2, PSK 2, BGG 1
- **2024-Regeln (seit 2024-09)** (1’129): AU 243, RHW 211, EFA 185, FRHoF 185, FRAiF 128, WttHC 39, ABH 28, LFL 23, NF 22, AUD 21, XScreen 17, HotB 13, HBTD 6, TCE 4, DrDe-BD 1, RWG 1, UtHftLH 1, XScreenRHW 1
- **Unearthed Arcana** (66): UATheMysticClass 66

Quellen, die in keiner Bücher- oder Abenteuerliste stehen und hereinkamen (nicht nach Datum geprüft):

- TftYP 161, MFF 18, MCV2DC 12, EEPC 7, MisMV1 6, HAT-LMI 5, MCV3MC 5, ESK 4, RoTOS 4, DrDe 2, SADS 2, EET 1, VD 1

## Schlüssel, die kein Feld trägt

Je Art die 5e.tools-Schlüssel, die keine Zuordnung liest, mit der Zahl der Einträge, in denen sie stehen. Bewusst überall weggelassen und hier nicht aufgeführt: Fundstellen (`page`, `otherSources`, `referenceSources`, `reprintedAs`), Lizenzflaggen (in `Source.srd`), Bildflaggen (`hasToken`, `hasFluffImages`, E5) und die vorgerechneten Filterschlüssel (`*Tags`, Abgleich §3).

- **background:** `fromFeature` 15, `prerequisite` 4, `skillToolLanguageProficiencies` 1
- **baseitem:** `reload` 8, `group` 6, `bulletFirearm` 4, `arrow` 2, `bolt` 2, `bulletSling` 2, `needleBlowgun` 2, `cellEnergy` 1, `rapier` 1
- **boon:** `abilityEntry` 8, `signatureSpells` 8
- **class:** `preparedSpellsChange` 4, `spellsKnownProgressionFixedAllowLowerLevel` 1, `spellsKnownProgressionFixedByLevel` 1
- **classFeature:** `type` 3
- **cult:** `signatureSpells` 10
- **deity:** `reprintAlias` 22
- **feat:** `toolProficiencies` 5, `optionalfeatureProgression` 4, `resist` 4, `armorProficiencies` 3, `languageProficiencies` 3, `skillProficiencies` 3, `expertise` 2, `weaponProficiencies` 2, `_versions` 1, `bonusSenses` 1, `savingThrowProficiencies` 1, `skillToolLanguageProficiencies` 1
- **item:** `resist` 104, `optionalfeatures` 51, `ability` 43, `hasRefs` 40, `modifySpeed` 37, `bonusSpellSaveDc` 27, `detail1` 25, `vehSpeed` 25, `crew` 24, `seeAlsoVehicle` 24, `vehAc` 24, `vehHp` 24, `capCargo` 23, `vehDmgThresh` 21, `poisonTypes` 20, `conditionImmune` 19, `containerCapacity` 12, `spellScrollLevel` 10, `carryingCapacity` 9, `immune` 9, `speed` 9, `capPassenger` 8, `group` 6, `seeAlsoDeck` 6, `critThreshold` 5, `vulnerable` 4, `typeAlt` 3, `atomicPackContents` 2, `bonusAbilityCheck` 2, `bonusWeaponAttack` 2, … (9 weitere)
- **itemGroup:** `ability` 2, `resist` 2, `conditionImmune` 1, `itemsHidden` 1, `modifySpeed` 1
- **language:** `fonts` 1
- **monster:** `_versions` 68, `actionNote` 2, `reactionNote` 1, `sizeNote` 1
- **monsterTemplate:** `crMin` 27, `prerequisite` 1
- **object:** `token` 3
- **optionalfeature:** `senses` 2, `optionalfeatureProgression` 1, `skillProficiencies` 1
- **race:** `_versions` 8
- **spell:** `conditionImmune` 5
- **subclassFeature:** `type` 7
- **subrace:** `_versions` 6, `skillToolLanguageProficiencies` 3
- **table:** `isNameGenerator` 5, `colLabelRows` 3
- **trap:** `hauntBonus` 4

## Verweise ins Leere

Marken, deren Ziel nicht hereinkam — meist ein Eintrag aus einer ausgeschlossenen Quelle. Sie stehen als Text da.

| Marke | Verweise | verschiedene Ziele | häufigste |
| --- | ---: | ---: | --- |
| `@action` | 1 | 1 | `Magic\|XPHB` 1 |
| `@card` | 197 | 129 | `Aberration\|Deck of Many More Things` 2, `Balance\|Deck of Many More Things` 2, `Beast\|Deck of Many More Things` 2, `Book\|Deck of Many More Things` 2, `Bridge\|Deck of Many More Things` 2, … (124 weitere) |
| `@creature` | 7 | 4 | `` 3, `tree` 2, `flesh skaab\|MM` 1, `treant totem` 1 |
| `@deck` | 10 | 2 | `tarokka deck\|CoS` 6, `Tarokka Deck\|CoS` 4 |
| `@item` | 211 | 144 | `+1 scale mail` 6, `+1 shield` 5, `+1 shortsword` 5, `+1 leather armor` 4, `+2 leather armor` 4, … (139 weitere) |
| `@recipe` | 11 | 6 | `Ale and cheese pastry\|HFLotT` 2, `Brandied ham and carrots\|HFLotT` 2, `Corn and lentil soup\|HFLotT` 2, `Dragonfire mead\|HFLotT` 2, `Seared boar and potatoes\|HFLotT` 2, … (1 weitere) |
| `@spell` | 21 | 20 | `hex/curse#x` 2, `aarakocra armor` 1, `aarakocra armor\|` 1, `aarakocra hand` 1, `aarakocra hand\|` 1, … (15 weitere) |
| `@table` | 11 | 4 | `Treasure Hoard: Challenge 11—16\|DMG` 4, `Treasure Hoard: Challenge 17+\|DMG` 3, `Treasure Hoard: Challenge 5—10\|DMG` 3, `Treasure Hoard: Challenge 0—4\|DMG` 1 |
| `@variantrule` | 5 | 5 | `Armor Class\|XPHB` 1, `Heroic Inspiration\|XPHB` 1, `Long Rest\|XPHB` 1, `Short Rest\|XPHB` 1, `Temporary Hit Points\|XPHB` 1 |
| `@vehicle` | 50 | 32 | `Space galleon\|AAG` 4, `Bombard\|AAG` 2, `Damselfly ship\|AAG` 2, `Flying fish ship\|AAG` 2, `Hammerhead ship\|AAG` 2, … (27 weitere) |
| `@vehupgrade` | 23 | 22 | `Arcane Artillery\|GoS` 2, `Bones of Endless Toil\|GoS` 1, `Churning Hull\|GoS` 1, `Clockwork Oars\|GoS` 1, `Concussive Rounds\|GoS` 1, … (17 weitere) |

## Unbekannte Eintragsarten und Marken

- `Eintrag image (weggelassen)` 37

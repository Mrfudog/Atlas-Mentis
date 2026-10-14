# 5e.tools-Übernahme — Bericht

Erzeugt von `packages/import-5etools` (Paket P5, [5etools-Arbeitsplan.md](5etools-Arbeitsplan.md)). **Nicht von Hand ändern** — ein neuer Lauf schreibt die Datei neu.

- Datenstand: 5etools-src 8c026b8 2026-10-08
- Aufruf: `node packages/import-5etools/dist/cli.js <data> --out <datei> --bericht <datei>`
- **56’250 Artikel**, alle durch `validateEntity` mit `knownTypes`
- Gleichlautende Merkmale der Statblöcke (Arbeitsplan §2.5): 1’669 Aktionen und Merkmale stehen an mehr als einem Statblock; 11’560 Doppel wurden dadurch nicht angelegt
- Gleiche Merkmale an verschiedenen Trägern (`doppel.ts`): 528 Artikel mit einem gleichen vereint (528 Feature)
- Fassungen aus mehreren Büchern (`doppel.ts`): 635 Artikel sind Variante der geltenden Fassung und tragen ihr Buch im Namen (301 Statblock, 171 Deity, 49 Ancestry, 44 Language, 29 Table, 27 Rule, 7 Item, 4 Weapon, 2 Armor, 1 Hazard)
- Monstermerkmale mit Herkunft (`doppel.ts`): 113 zeigen mit `variantOf` auf das Volksmerkmal ihres Volks
- Angriffe der Statblöcke, einer für alle (D51, `arten/angriff.ts`): 5’685 Verwendungen auf 1’093 Angriffe (Bite 815, Claw 380, Dagger 223, Claws 189, Shortsword 188, Slam 182, Tail 167, Longsword 130 …); die Buchzahl steht an der Kante, wo sie nicht aus der Rechnung folgt — Treffer 394-mal, Schaden 505-mal; 311 Angriffe anders gebaut und als Text belassen

## Artikel je Art (unsere)

| Art | Artikel |
| --- | ---: |
| `Action` | 5’492 |
| `ActionType` | 7 |
| `Ancestry` | 227 |
| `Arc` | 589 |
| `Armor` | 76 |
| `Background` | 101 |
| `Chapter` | 290 |
| `Class` | 16 |
| `Condition` | 23 |
| `Deity` | 494 |
| `Disease` | 22 |
| `Embed` | 3’489 |
| `Encounter` | 2’160 |
| `Faction` | 30 |
| `Feat` | 108 |
| `Feature` | 5’459 |
| `Hazard` | 57 |
| `Heading` | 4’365 |
| `Item` | 1’638 |
| `ItemProperty` | 14 |
| `Language` | 150 |
| `Layer` | 153 |
| `Map` | 791 |
| `Paragraph` | 15’213 |
| `ReadAloudText` | 99 |
| `Rule` | 624 |
| `Scene` | 7’565 |
| `Skill` | 18 |
| `Spell` | 525 |
| `Statblock` | 3’829 |
| `Story` | 80 |
| `Subclass` | 124 |
| `Table` | 2’161 |
| `Weapon` | 261 |

## Je 5e.tools-Art

*Gelesen* ist jeder Eintrag der Liste, *Artikel* die daraus angelegten Hauptartikel (ohne die Aktionen und Merkmale, die ein Statblock oder eine Klasse dazu anlegt). Die Differenz steht unter *ausgeschlossen* und *Notizen*.

| 5e.tools | gelesen | Artikel | ausgeschlossen | Notizen |
| --- | ---: | ---: | ---: | --- |
| `action` | 48 | 30 Action | 18 | — |
| `adventure` | 101 | — | — | `weggelassen: Abenteuer-Metadaten: Name und Erscheinen der Ebene (T-082); der Text kommt aus adventure/` 101 |
| `adventureData` | 101 | 80 Story, 589 Arc, 7’565 Scene, 2’160 Encounter, 791 Map | 21 | `Kapitel weggelassen: Credits` 78 |
| `artObjects` | 10 | 5 Table | 5 | — |
| `background` | 171 | 101 Background | 70 | `Wahl mit Werten ohne Artikel (als Notiz an der Wahl)` 14, `Talente mit Alternativen (erste übernommen)` 2 |
| `backgroundFluff` | 170 | — | — | — |
| `baseitem` | 230 | 56 Item, 54 Weapon, 14 Armor | 106 | — |
| `book` | 66 | — | — | `weggelassen: Buch-Metadaten: eine Systemebene statt einer je Buch (Arbeitsplan §1)` 66 |
| `bookData` | 66 | 290 Chapter, 15’213 Paragraph, 4’365 Heading, 3’489 Embed, 99 ReadAloudText | 16 | `Bild im Buchtext (weggelassen, E5)` 1’659, `Kapitel weggelassen: Credits` 41 |
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
| `feat` | 305 | 108 Feat | 197 | `feste Übung eines Talents (im Text belassen)` 7 |
| `featFluff` | 44 | — | — | `weggelassen: nur Bilder (E5)` 44 |
| `gems` | 12 | 6 Table | 6 | — |
| `hazard` | 73 | 28 Hazard | 45 | — |
| `hazardFluff` | 3 | — | — | `weggelassen: nur Bilder (E5)` 3 |
| `hoard` | 8 | — | — | `weggelassen: Schatztabellen mit verschachtelten Würfen — noch nicht zugeordnet` 8 |
| `individual` | 8 | — | — | `weggelassen: Schatztabellen mit verschachtelten Würfen — noch nicht zugeordnet` 8 |
| `item` | 2’512 | 1’393 Item, 59 Armor, 197 Weapon | 863 | `Wirkung ability.choose nicht übernommen` 3, `Wirkung modifySpeed.multiply nicht übernommen` 2, `Wirkung ability.amount nicht übernommen` 1, `Wirkung ability.count nicht übernommen` 1, `Wirkung ability.from nicht übernommen` 1 |
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
| `magicvariant` | 230 | 129 Item | 101 | `inherits.hasRefs nicht übernommen` 10, `inherits.bonusSpellDamage nicht übernommen` 8, `inherits.bonusWeaponAttack nicht übernommen` 3, `inherits.valueExpression nicht übernommen` 3, `inherits.barding nicht übernommen` 1, `inherits.bonusWeaponDamage nicht übernommen` 1, … (2 weitere) |
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
| `race` | 160 | 134 Ancestry | 26 | `Wahl mit Werten ohne Artikel (als Notiz an der Wahl)` 1 |
| `raceFluff` | 223 | — | — | — |
| `recipe` | 316 | — | — | `weggelassen: Kochrezepte, kein Handwerk (Abgleich §2.5)` 316 |
| `recipeFluff` | 316 | — | — | `weggelassen: Kochrezepte` 316 |
| `reward` | 278 | 237 Rule | 41 | — |
| `sense` | 8 | 4 Rule | 4 | — |
| `skill` | 36 | 18 Skill | 18 | — |
| `spell` | 969 | 525 Spell | 444 | `Komponente R (2024)` 3, `mehrere Dauern (erste übernommen)` 3, `mehrere Wirkzeiten (erste übernommen)` 1 |
| `spellFluff` | 92 | — | — | `weggelassen: nur Bilder (E5)` 92 |
| `status` | 5 | 2 Condition | 3 | — |
| `subclass` | 330 | 124 Subclass | 206 | `Zauber ohne Wahl und ohne Namen (als Text belassen)` 62 |
| `subclassFeature` | 1’499 | 873 Feature | 619 | `mit gleichlautendem Eintrag vereint` 7 |
| `subclassFluff` | 164 | — | — | — |
| `subrace` | 98 | 93 Ancestry | — | `Unterart ohne Namen (Spielart der Abstammung)` 5 |
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

- **2024-Kernbuch** (3’273): XPHB 1’705, XDMG 1’009, XMM 559
- **2024-Regeln (seit 2024-09)** (1’150): AU 244, RHW 203, EFA 186, FRHoF 186, FRAiF 129, WttHC 40, ABH 29, LFL 24, NF 23, AUD 22, XScreen 18, HotB 14, HBTD 7, DrDe-BD 2, RWG 2, UtHftLH 2, XScreenRHW 2, BQDD 1, BQGT 1, CaBoMP 1, DrDe-ACfaS 1, DrDe-BtS 1, DrDe-DaS 1, DrDe-DotSC 1, DrDe-FWtVC 1, DrDe-SD 1, DrDe-TDoN 1, DrDe-TFV 1, DrDe-TWoO 1, FFotR 1, FRAiF-TLLoL 1, HFLotT 1, ScoEE 1, XSAC 1
- **Unearthed Arcana** (66): UATheMysticClass 66
- **hängt an einer Klasse oder Abstammung aus EFA (2024-Regeln (seit 2024-09))** (13): RHW 9, TCE 4
- **hängt an einer Klasse oder Abstammung aus XPHB (2024-Kernbuch)** (367): PHB 69, AU 66, FRHoF 64, XGE 43, RHW 42, TCE 41, PSA 14, SCAG 9, EGW 5, DMG 4, VRGR 3, DSotDQ 2, FTD 2, PSK 2, BGG 1

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
- **feat:** `optionalfeatureProgression` 4, `resist` 4, `expertise` 2, `_versions` 1, `bonusSenses` 1, `savingThrowProficiencies` 1, `skillToolLanguageProficiencies` 1
- **item:** `optionalfeatures` 51, `hasRefs` 40, `detail1` 25, `vehSpeed` 25, `crew` 24, `seeAlsoVehicle` 24, `vehAc` 24, `vehHp` 24, `capCargo` 23, `vehDmgThresh` 21, `poisonTypes` 20, `spellScrollLevel` 10, `speed` 9, `capPassenger` 8, `group` 6, `seeAlsoDeck` 6, `typeAlt` 3, `atomicPackContents` 2, `bonusAbilityCheck` 2, `bonusWeaponAttack` 2, `bonusProficiencyBonus` 1, `bonusSavingThrowConcentration` 1, `bonusWeaponDamage` 1, `crewMax` 1, `crewMin` 1, `dexterityMax` 1, `shippingCost` 1, `travelCost` 1, `weightNote` 1
- **itemGroup:** `itemsHidden` 1
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
| `@card` | 372 | 199 | `Dragon\|Deck of Many More Things` 5, `Balance\|Deck of Many More Things` 4, `Comet\|Deck of Many More Things` 4, `Donjon\|Deck of Many More Things` 4, `Euryale\|Deck of Many More Things` 4, … (194 weitere) |
| `@condition` | 1 | 1 | `Bluerot\|GoS` 1 |
| `@creature` | 340 | 169 | `Scions of Giants' Gods\|BGG` 6, `` 3, `Giants\|MM` 3, `Kobolds\|VGM` 3, `Yuan-ti\|VGM` 3, … (164 weitere) |
| `@deck` | 132 | 29 | `tarokka deck\|CoS` 16, `Tarokka Deck\|CoS` 15, `Elder Runes Deck\|WDMM` 14, `Secrets Deck\|WDMM` 12, `Fragments of Suffering\|CRCotN` 6, … (24 weitere) |
| `@deity` | 10 | 5 | `Bahgtru\|VGM` 2, `Ilneval\|VGM` 2, `Luthic\|VGM` 2, `Shargaas\|VGM` 2, `Yurtrus\|VGM` 2 |
| `@item` | 551 | 249 | `+1 shield` 19, `+1 dagger` 17, `+1 longsword` 17, `+1 shortsword` 14, `+1 battleaxe` 11, … (244 weitere) |
| `@race` | 27 | 9 | `Elf (Kaladesh; Bishatar and Tirahar)\|PSK` 3, `Elf (Kaladesh; Vahadar)\|PSK` 3, `Elf (Zendikar; Joraga Nation)\|PSZ` 3, `Elf (Zendikar; Mul Daya Nation)\|PSZ` 3, `Elf (Zendikar; Tajuru Nation)\|PSZ` 3, … (4 weitere) |
| `@recipe` | 643 | 357 | `Purple Grapemash No. 3\|HFFotM` 18, `Elverquisst\|HFFotM` 6, `Ruby Cordial\|HFFotM` 5, `Ale and cheese pastry\|HFLotT` 4, `Boar Hock Soup\|HFFotM` 4, … (352 weitere) |
| `@spell` | 21 | 20 | `hex/curse#x` 2, `aarakocra armor` 1, `aarakocra armor\|` 1, `aarakocra hand` 1, `aarakocra hand\|` 1, … (15 weitere) |
| `@table` | 18 | 4 | `Treasure Hoard: Challenge 0—4\|DMG` 5, `Treasure Hoard: Challenge 11—16\|DMG` 5, `Treasure Hoard: Challenge 5—10\|DMG` 5, `Treasure Hoard: Challenge 17+\|DMG` 3 |
| `@trap` | 1 | 1 | `quicksand\|dmg` 1 |
| `@variantrule` | 5 | 5 | `Armor Class\|XPHB` 1, `Heroic Inspiration\|XPHB` 1, `Long Rest\|XPHB` 1, `Short Rest\|XPHB` 1, `Temporary Hit Points\|XPHB` 1 |
| `@vehicle` | 293 | 69 | `battle balloon\|AI` 26, `Warship\|` 16, `Demon Grinder\|BGDIA` 14, `rowboat` 13, `Venatrix\|VEoR` 13, … (64 weitere) |
| `@vehupgrade` | 43 | 31 | `Gilded Death Armor\|BGDIA` 3, `Infernal Screamer\|BGDIA` 3, `Acidic Bile Sprayer\|BGDIA` 2, `Arcane Artillery\|GoS` 2, `Canian Armor\|BGDIA` 2, … (26 weitere) |

## Unbekannte Eintragsarten und Marken

- `Eintrag image (weggelassen)` 636, `Eintrag wrapper (weggelassen)` 68, `@5etoolsImg` 28, `Eintrag gallery (weggelassen)` 20, `@ability` 9, `@5etoolsAudio` 1, `@savingThrow` 1

# 5e.tools-Übernahme — Bericht

Erzeugt von `packages/import-5etools` (Paket P5, [5etools-Arbeitsplan.md](5etools-Arbeitsplan.md)). **Nicht von Hand ändern** — ein neuer Lauf schreibt die Datei neu.

- Datenstand: 5etools-src 8c026b8 2026-10-08
- Aufruf: `node packages/import-5etools/dist/cli.js <data> --out <datei> --bericht <datei>`
- **182’525 Artikel**, alle durch `validateEntity` mit `knownTypes`
- Gleichlautende Merkmale der Statblöcke (Arbeitsplan §2.5): 2’091 Aktionen und Merkmale stehen an mehr als einem Statblock; 13’249 Doppel wurden dadurch nicht angelegt
- Gleiche Merkmale an verschiedenen Trägern (`doppel.ts`): 756 Artikel mit einem gleichen vereint (756 Feature)
- Fassungen aus mehreren Büchern (`doppel.ts`): 3’158 Artikel sind Variante der geltenden Fassung und tragen ihr Buch im Namen (802 Statblock, 671 Item, 386 Spell, 334 Rule, 236 Deity, 161 Subclass, 156 Table, 98 Weapon, 90 Language, 71 Ancestry, 47 Feat, 43 Armor, 17 Condition, 17 Hazard, 13 Class, 13 Background, 3 Disease)
- Monstermerkmale mit Herkunft (`doppel.ts`): 115 zeigen mit `variantOf` auf das Volksmerkmal ihres Volks
- Angriffe der Statblöcke, einer für alle (D51, `arten/angriff.ts`): 6’001 Verwendungen auf 1’142 Angriffe (Bite 839, Claw 385, Dagger 262, Claws 200, Shortsword 198, Slam 191, Tail 172, Longsword 132 …); die Buchzahl steht an der Kante, wo sie nicht aus der Rechnung folgt — Treffer 486-mal, Schaden 563-mal; 1’415 Angriffe anders gebaut und als Text belassen

## Artikel je Art (unsere)

| Art | Artikel |
| --- | ---: |
| `Action` | 7’794 |
| `ActionType` | 7 |
| `Ancestry` | 315 |
| `Arc` | 662 |
| `Armor` | 180 |
| `Background` | 171 |
| `Chapter` | 1’041 |
| `Class` | 30 |
| `Condition` | 41 |
| `Deity` | 563 |
| `Disease` | 29 |
| `Embed` | 9’649 |
| `Encounter` | 2’240 |
| `Faction` | 30 |
| `Feat` | 314 |
| `Feature` | 7’569 |
| `Hazard` | 110 |
| `Heading` | 26’525 |
| `Item` | 2’613 |
| `ItemProperty` | 35 |
| `Language` | 201 |
| `Layer` | 191 |
| `Map` | 896 |
| `Paragraph` | 94’471 |
| `ReadAloudText` | 7’423 |
| `Rule` | 1’676 |
| `Scene` | 8’057 |
| `Skill` | 36 |
| `Spell` | 969 |
| `Statblock` | 4’927 |
| `Story` | 101 |
| `Subclass` | 330 |
| `Table` | 2’836 |
| `Weapon` | 493 |

## Artikel je Ebene

Jede Quelle ihre Ebene (T-081), nach Regelstand (T-087). *Neu* sind die Artikel, die nicht zum Grundstand gehören — 2024, Unearthed Arcana, Fahrzeuge, Decks, Bastionen, Waffenmeisterschaften; auf einem Server mit dem Grundstand legt `--only-new` sie an. Keine neue Ebene ist aufgeschaltet; in der Gruppe „D&D 5e (2014)" stehen nur die Ebenen des Grundstands.

| Regelstand | Ebenen | Artikel | davon neu |
| --- | ---: | ---: | ---: |
| 2014 | 143 | 153’274 | 1’703 |
| 2024 | 34 | 28’999 | 28’999 |
| UA | 1 | 61 | 61 |

| Ebene | Kürzel | Art | Regelstand | Artikel | davon neu |
| --- | --- | --- | --- | ---: | ---: |
| Waterdeep: Dungeon of the Mad Mage | `WDMM` | adventure | 2014 | 7’653 | 29 |
| Icewind Dale: Rime of the Frostmaiden | `IDRotF` | adventure | 2014 | 4’656 | — |
| Curse of Strahd | `CoS` | adventure | 2014 | 4’545 | 55 |
| Princes of the Apocalypse | `PotA` | adventure | 2014 | 4’421 | — |
| Tomb of Annihilation | `ToA` | adventure | 2014 | 4’108 | 10 |
| Out of the Abyss | `OotA` | adventure | 2014 | 4’076 | — |
| Storm King's Thunder | `SKT` | adventure | 2014 | 4’068 | 23 |
| Ghosts of Saltmarsh | `GoS` | adventure | 2014 | 3’647 | 28 |
| Waterdeep: Dragon Heist | `WDH` | adventure | 2014 | 3’531 | — |
| Dungeon Master's Guide (2014) | `DMG` | book | 2014 | 3’512 | 184 |
| Baldur's Gate: Descent Into Avernus | `BGDIA` | adventure | 2014 | 3’348 | 15 |
| Candlekeep Mysteries | `CM` | adventure | 2014 | 3’344 | — |
| Journeys through the Radiant Citadel | `JttRC` | adventure | 2014 | 3’284 | — |
| Eberron: Rising from the Last War | `ERLW` | book | 2014 | 3’272 | — |
| Vecna: Eve of Ruin | `VEoR` | adventure | 2014 | 3’238 | 1 |
| Quests from the Infinite Staircase | `QftIS` | adventure | 2014 | 3’164 | 21 |
| Player's Handbook (2014) | `PHB` | book | 2014 | 3’112 | 23 |
| Dragonlance: Shadow of the Dragon Queen | `DSotDQ` | adventure | 2014 | 2’993 | 131 |
| The Wild Beyond the Witchlight | `WBtW` | adventure | 2014 | 2’975 | 33 |
| Keys from the Golden Vault | `KftGV` | adventure | 2014 | 2’931 | — |
| Phandelver and Below: The Shattered Obelisk | `PaBTSO` | adventure | 2014 | 2’882 | — |
| Critical Role: Call of the Netherdeep | `CRCotN` | adventure | 2014 | 2’813 | 23 |
| Explorer's Guide to Wildemount | `EGW` | book | 2014 | 2’708 | 21 |
| Chains of Asmodeus | `CoA` | adventure | 2014 | 2’538 | 1 |
| Monster Manual (2014) | `MM` | book | 2014 | 2’454 | 188 |
| The Orrery of the Wanderer | `OoW` | adventure | 2014 | 2’084 | — |
| Van Richten's Guide to Ravenloft | `VRGR` | book | 2014 | 2’013 | 18 |
| Volo's Guide to Monsters | `VGM` | book | 2014 | 2’011 | 50 |
| Mordenkainen's Tome of Foes | `MTF` | book | 2014 | 1’968 | 31 |
| Hoard of the Dragon Queen | `HotDQ` | adventure | 2014 | 1’954 | — |
| Fizban's Treasury of Dragons | `FTD` | book | 2014 | 1’921 | 76 |
| The Book of Many Things | `BMT` | book | 2014 | 1’903 | 124 |
| Rise of Tiamat | `RoT` | adventure | 2014 | 1’892 | — |
| Guildmasters' Guide to Ravnica | `GGR` | book | 2014 | 1’707 | 6 |
| Sword Coast Adventurer's Guide | `SCAG` | book | 2014 | 1’604 | — |
| Mordenkainen Presents: Monsters of the Multiverse | `MPMM` | book | 2014 | 1’586 | 61 |
| Tasha's Cauldron of Everything | `TCE` | book | 2014 | 1’496 | 70 |
| Tales from the Yawning Portal: Dead in Thay | `TftYP-DiT` | adventure | 2014 | 1’476 | — |
| Turn of Fortune's Wheel | `ToFW` | adventure | 2014 | 1’417 | — |
| Bigby Presents: Glory of the Giants | `BGG` | book | 2014 | 1’385 | 6 |
| Mythic Odysseys of Theros | `MOT` | book | 2014 | 1’381 | — |
| Tales from the Yawning Portal: Against the Giants | `TftYP-AtG` | adventure | 2014 | 1’340 | — |
| Essentials Kit: Dragon of Icespire Peak | `DIP` | adventure | 2014 | 1’263 | 53 |
| Lost Mine of Phandelver | `LMoP` | adventure | 2014 | 1’256 | — |
| Xanathar's Guide to Everything | `XGE` | book | 2014 | 1’220 | 63 |
| Infernal Machine Rebuild | `IMR` | adventure | 2014 | 1’181 | — |
| Minsc and Boo's Journal of Villainy | `MaBJoV` | book | 2014 | 925 | — |
| Acquisitions Incorporated | `AI` | book | 2014 | 914 | 4 |
| Sigil and the Outlands | `SatO` | book | 2014 | 907 | — |
| Strixhaven: A Curriculum of Chaos | `SCC` | book | 2014 | 900 | — |
| Tales from the Yawning Portal: The Hidden Shrine of Tamoachan | `TftYP-THSoT` | adventure | 2014 | 892 | — |
| The Lost Dungeon of Rickedness: Big Rick Energy | `RMBRE` | adventure | 2014 | 889 | — |
| Essentials Kit: Storm Lord's Wrath | `SLW` | adventure | 2014 | 869 | — |
| Light of Xaryxis | `LoX` | adventure | 2014 | 861 | — |
| Essentials Kit: Divine Contention | `DC` | adventure | 2014 | 855 | — |
| Tales from the Yawning Portal: The Forge of Fury | `TftYP-TFoF` | adventure | 2014 | 822 | — |
| Tales from the Yawning Portal: The Sunless Citadel | `TftYP-TSC` | adventure | 2014 | 812 | — |
| Essentials Kit: Sleeping Dragon's Wake | `SDW` | adventure | 2014 | 736 | — |
| Lost Laboratory of Kwalish | `LLK` | adventure | 2014 | 701 | 24 |
| Dungeons & Dragons vs. Rick and Morty: Basic Rules | `RMR` | book | 2014 | 695 | — |
| Spelljammer Academy | `SjA` | adventure | 2014 | 677 | — |
| Return to the Glory | `RtG` | adventure | 2014 | 676 | — |
| Dragons of Stormwreck Isle | `DoSI` | adventure | 2014 | 660 | — |
| Tales from the Yawning Portal: Tomb of Horrors | `TftYP-ToH` | adventure | 2014 | 580 | — |
| The Deck of Many Things: Card Reference Guide | `DMTCRG` | book | 2014 | 538 | 70 |
| Morte's Planar Parade | `MPP` | book | 2014 | 521 | 3 |
| Strixhaven: Campus Kerfuffle | `SCC-CK` | adventure | 2014 | 520 | — |
| Sage Advice Compendium (2014) | `SAC` | book | 2014 | 465 | — |
| Strixhaven: The Magister's Masquerade | `SCC-TMM` | adventure | 2014 | 440 | — |
| Ravenloft: The House of Lament | `HoL` | adventure | 2014 | 430 | — |
| Tales from the Yawning Portal: White Plume Mountain | `TftYP-WPM` | adventure | 2014 | 415 | — |
| The Tortle Package | `TTP` | adventure | 2014 | 414 | — |
| Heroes' Feast | `HF` | book | 2014 | 410 | — |
| Boo's Astral Menagerie | `BAM` | book | 2014 | 408 | 4 |
| Puncheons and Flagons | `PaF` | book | 2014 | 396 | — |
| Strixhaven: Hunt for Mage Tower | `SCC-HfMT` | adventure | 2014 | 390 | — |
| Wildemount: Frozen Sick | `FS` | adventure | 2014 | 378 | — |
| Plane Shift: Ixalan | `PSX` | book | 2014 | 375 | — |
| Strixhaven: A Reckoning in Ruins | `SCC-ARiR` | adventure | 2014 | 363 | — |
| Plane Shift: Innistrad | `PSI` | book | 2014 | 335 | 55 |
| Wildemount: Dangerous Designs | `DD` | adventure | 2014 | 334 | 1 |
| Astral Adventurer's Guide | `AAG` | book | 2014 | 318 | 16 |
| Heroes' Feast Flavors of the Multiverse | `HFFotM` | book | 2014 | 305 | — |
| Tarot Deck | `TD` | book | 2014 | 302 | 79 |
| TftYP | `TftYP` | book | 2014 | 301 | — |
| Wildemount: Unwelcome Spirits | `US` | adventure | 2014 | 297 | — |
| Locathah Rising | `LR` | adventure | 2014 | 289 | — |
| Red Dragon's Tale: A LEGO Adventure | `LRDT` | adventure | 2014 | 289 | — |
| Wildemount: Tide of Retribution | `ToR` | adventure | 2014 | 260 | — |
| Peril in Pinebrook | `PiP` | adventure | 2014 | 251 | — |
| Eberron: Forgotten Relics | `EFR` | adventure | 2014 | 246 | — |
| Adventures in the Forgotten Realms: The Hidden Page | `AitFR-THP` | adventure | 2014 | 244 | — |
| Adventures in the Forgotten Realms: In Scarlet Flames | `AitFR-ISF` | adventure | 2014 | 221 | — |
| Descent into the Lost Caverns of Tsojcanth | `DitLCoT` | adventure | 2014 | 211 | 1 |
| X Marks the Spot | `XMtS` | adventure | 2014 | 206 | — |
| Plane Shift: Zendikar | `PSZ` | book | 2014 | 196 | — |
| Plane Shift: Dominaria | `PSD` | book | 2014 | 192 | — |
| Adventures in the Forgotten Realms: Deepest Night | `AitFR-DN` | adventure | 2014 | 187 | — |
| Plane Shift: Kaladesh | `PSK` | book | 2014 | 186 | 5 |
| Adventures in the Forgotten Realms: From Cyan Depths | `AitFR-FCD` | adventure | 2014 | 182 | — |
| Plane Shift: Amonkhet | `PSA` | book | 2014 | 176 | — |
| Krenko's Way | `KKW` | adventure | 2014 | 172 | — |
| Domains of Delight | `DoD` | book | 2014 | 170 | — |
| Adventures in the Forgotten Realms: A Verdant Tomb | `AitFR-AVT` | adventure | 2014 | 162 | — |
| Hunt for the Thessalhydra | `HftT` | adventure | 2014 | 162 | — |
| Heroes' Feast: Saving the Children's Menu | `HFStCM` | adventure | 2014 | 155 | — |
| Adventure Atlas: The Mortuary | `AATM` | book | 2014 | 151 | — |
| Giants of the Star Forge | `GotSF` | adventure | 2014 | 149 | — |
| Dungeon Master's Screen: Dungeon Kit | `ScreenDungeonKit` | book | 2014 | 145 | 67 |
| A Zib for Your Thoughts | `AZfyT` | adventure | 2014 | 142 | — |
| Monstrous Compendium Volume 4: Eldraine Creatures | `MCV4EC` | book | 2014 | 140 | — |
| NERDS Restoring Harmony: Adventure Together | `NRH-AT` | adventure | 2014 | 140 | — |
| Vecna: Nest of the Eldritch Eye | `VNotEE` | adventure | 2014 | 136 | — |
| NERDS Restoring Harmony: The Candy Mountain Caper | `NRH-TCMC` | adventure | 2014 | 132 | — |
| Adventure with Muk | `AWM` | book | 2014 | 126 | — |
| Lightning Keep | `LK` | adventure | 2014 | 122 | — |
| The Lost Kenku | `TLK` | adventure | 2014 | 122 | — |
| NERDS Restoring Harmony: The Lost Tomb | `NRH-TLT` | adventure | 2014 | 118 | — |
| NERDS Restoring Harmony: Circus of Illusion | `NRH-CoI` | adventure | 2014 | 116 | — |
| NERDS Restoring Harmony: A Voice in the Wilderness | `NRH-AVitW` | adventure | 2014 | 112 | — |
| NERDS Restoring Harmony: A Sticky Situation | `NRH-ASS` | adventure | 2014 | 103 | — |
| Muk's Guide to Everything He Learned From Tasha | `MGELFT` | book | 2014 | 97 | — |
| Adventurers League | `AL` | book | 2014 | 96 | — |
| MCV2DC | `MCV2DC` | book | 2014 | 72 | — |
| NERDS Restoring Harmony: A Web of Lies | `NRH-AWoL` | adventure | 2014 | 72 | — |
| MFF | `MFF` | book | 2014 | 68 | — |
| Thieves' Gallery | `HAT-TG` | book | 2014 | 65 | — |
| Monstrous Compendium Volume 1: Spelljammer Creatures | `MCV1SC` | book | 2014 | 62 | — |
| Dungeon Master's Screen: Wilderness Kit | `ScreenWildernessKit` | book | 2014 | 55 | — |
| One Grung Above | `OGA` | book | 2014 | 36 | — |
| ESK | `ESK` | book | 2014 | 35 | 27 |
| MisMV1 | `MisMV1` | book | 2014 | 35 | — |
| MCV3MC | `MCV3MC` | book | 2014 | 24 | — |
| Dungeon Master's Screen | `Screen` | book | 2014 | 23 | — |
| EEPC | `EEPC` | book | 2014 | 17 | — |
| SADS | `SADS` | book | 2014 | 13 | 3 |
| Dungeon Master's Screen: Spelljammer | `ScreenSpelljammer` | book | 2014 | 9 | — |
| VD | `VD` | book | 2014 | 8 | — |
| D&D 5e (2014) — no book given | — | system | 2014 | 7 | — |
| HAT-LMI | `HAT-LMI` | book | 2014 | 5 | — |
| RoTOS | `RoTOS` | book | 2014 | 4 | — |
| DrDe | `DrDe` | book | 2014 | 2 | — |
| EET | `EET` | book | 2014 | 1 | — |
| Dungeon Master's Guide (2024) | `XDMG` | book | 2024 | 4’005 | 4’005 |
| Player's Handbook (2024) | `XPHB` | book | 2024 | 3’500 | 3’500 |
| Monster Manual (2025) | `XMM` | book | 2024 | 3’078 | 3’078 |
| Forgotten Realms: Adventures in Faerûn | `FRAiF` | book | 2024 | 2’790 | 2’790 |
| Ravenloft: The Horrors Within | `RHW` | book | 2024 | 2’063 | 2’063 |
| Arcana Unleashed: Deadfall | `AUD` | adventure | 2024 | 1’965 | 1’965 |
| Heroes of the Borderlands | `HotB` | adventure | 2024 | 1’414 | 1’414 |
| Arcana Unleashed | `AU` | book | 2024 | 1’355 | 1’355 |
| Forgotten Realms: Heroes of Faerûn | `FRHoF` | book | 2024 | 1’323 | 1’323 |
| Eberron: Forge of the Artificer | `EFA` | book | 2024 | 1’034 | 1’034 |
| Stranger Things: Welcome to the Hellfire Club | `WttHC` | adventure | 2024 | 842 | 842 |
| Netheril's Fall | `NF` | book | 2024 | 431 | 431 |
| Red Wizards' Gambit | `RWG` | adventure | 2024 | 414 | 414 |
| Dragon Delves: The Forbidden Vale | `DrDe-TFV` | adventure | 2024 | 392 | 392 |
| Lorwyn: First Light | `LFL` | book | 2024 | 370 | 370 |
| Dragon Delves: The Dragon of Najkir | `DrDe-TDoN` | adventure | 2024 | 347 | 347 |
| Sage Advice Compendium (2025) | `XSAC` | book | 2024 | 322 | 322 |
| Dragon Delves: Baker's Doesn't | `DrDe-BD` | adventure | 2024 | 300 | 300 |
| Dragon Delves: A Copper for a Song | `DrDe-ACfaS` | adventure | 2024 | 273 | 273 |
| Dragon Delves: The Will of Orcus | `DrDe-TWoO` | adventure | 2024 | 268 | 268 |
| Astarion's Book of Hungers | `ABH` | book | 2024 | 267 | 267 |
| Dragon Delves: For Whom the Void Calls | `DrDe-FWtVC` | adventure | 2024 | 261 | 261 |
| Scions of Elemental Evil | `ScoEE` | adventure | 2024 | 245 | 245 |
| Dragon Delves: Dragons of the Sandstone City | `DrDe-DotSC` | adventure | 2024 | 243 | 243 |
| Uni and the Hunt for the Lost Horn | `UtHftLH` | adventure | 2024 | 236 | 236 |
| Dragon Delves: Death at Sunset | `DrDe-DaS` | adventure | 2024 | 228 | 228 |
| Dragon Delves: Shivering Death | `DrDe-SD` | adventure | 2024 | 225 | 225 |
| Dragon Delves: Before the Storm | `DrDe-BtS` | adventure | 2024 | 214 | 214 |
| Hold Back The Dead | `HBTD` | adventure | 2024 | 151 | 151 |
| Borderlands Quest: Goblin Trouble | `BQGT` | adventure | 2024 | 128 | 128 |
| Borderlands Quest: Dagger Danger! | `BQDD` | adventure | 2024 | 120 | 120 |
| Fated Flight of the Recluse | `FFotR` | adventure | 2024 | 101 | 101 |
| Dungeon Master's Screen (2024) | `XScreen` | book | 2024 | 58 | 58 |
| Dungeon Master's Screen; Ravenloft: The Horrors Within | `XScreenRHW` | book | 2024 | 36 | 36 |
| UATheMysticClass | `UATheMysticClass` | book | UA | 61 | 61 |

## Je 5e.tools-Art

*Gelesen* ist jeder Eintrag der Liste, *Artikel* die daraus angelegten Hauptartikel (ohne die Aktionen und Merkmale, die ein Statblock oder eine Klasse dazu anlegt). Die Differenz steht unter *ausgeschlossen* und *Notizen*.

| 5e.tools | gelesen | Artikel | ausgeschlossen | Notizen |
| --- | ---: | ---: | ---: | --- |
| `action` | 48 | 48 Action | — | — |
| `adventure` | 101 | — | — | `weggelassen: Abenteuer-Metadaten: Name und Erscheinen der Ebene (T-082); der Text kommt aus adventure/` 101 |
| `adventureData` | 101 | 101 Story, 662 Arc, 662 Chapter, 8’057 Scene, 65’594 Paragraph, 20’357 Heading, 7’251 ReadAloudText, 896 Map, 3’482 Embed, 2’240 Encounter | — | `Kapitel weggelassen: Credits` 93 |
| `artObjects` | 10 | 10 Table | — | — |
| `background` | 171 | 171 Background | — | `Attributswahl mit Alternativen (erste als Wahl, Rest als Notiz)` 70, `Wahl mit Werten ohne Artikel (als Notiz an der Wahl)` 14, `Talente mit Alternativen (erste übernommen)` 4 |
| `backgroundFluff` | 170 | — | — | — |
| `baseitem` | 230 | 101 Item, 102 Weapon, 27 Armor | — | — |
| `book` | 66 | — | — | `weggelassen: Buch-Metadaten: eine Systemebene statt einer je Buch (Arbeitsplan §1)` 66 |
| `bookData` | 66 | 379 Chapter, 28’877 Paragraph, 6’168 Heading, 6’167 Embed, 172 ReadAloudText | 2 | `Bild im Buchtext (weggelassen, E5)` 2’986, `Kapitel weggelassen: Credits` 52 |
| `boon` | 12 | 12 Rule | — | — |
| `card` | 765 | 713 Rule | 52 | — |
| `charoption` | 44 | 44 Rule | — | — |
| `charoptionFluff` | 5 | — | — | `weggelassen: nur Bilder (E5)` 5 |
| `class` | 30 | 30 Class | — | — |
| `classFeature` | 677 | 516 Feature | — | `mit gleichlautendem Eintrag vereint` 161 |
| `classFluff` | 30 | — | — | — |
| `condition` | 30 | 30 Condition | — | `Erschöpfung ohne Stufentabelle` 1 |
| `conditionFluff` | 13 | — | — | `weggelassen: nur Bilder (E5)` 13 |
| `crochetPattern` | 20 | — | — | `weggelassen: Häkelmuster` 20 |
| `crochetPatternFluff` | 20 | — | — | `weggelassen: Häkelmuster` 20 |
| `cult` | 30 | 30 Faction | — | — |
| `deck` | 35 | 34 Table | 1 | `Legemuster (spreads) nicht übernommen` 4 |
| `deity` | 563 | 563 Deity | — | — |
| `disease` | 29 | 29 Disease | — | — |
| `dragon` | 4 | 4 Table | — | — |
| `dragonMundaneItems` | 25 | 1 Table | — | — |
| `encounter` | 42 | 42 Table | — | — |
| `facility` | 70 | 70 Rule | — | — |
| `facilityFluff` | 16 | — | — | — |
| `feat` | 305 | 314 Feat | — | `feste Übung eines Talents (im Text belassen)` 19, `Spielart (_versions) ausgeschrieben` 9, `Attributswahl mit Alternativen (erste als Wahl, Rest als Notiz)` 1 |
| `featFluff` | 44 | — | — | `weggelassen: nur Bilder (E5)` 44 |
| `gems` | 12 | 12 Table | — | — |
| `hazard` | 73 | 73 Hazard | — | `Gefahrgrad nuisance` 12 |
| `hazardFluff` | 3 | — | — | `weggelassen: nur Bilder (E5)` 3 |
| `hoard` | 8 | 8 Table | — | — |
| `individual` | 8 | 8 Table | — | — |
| `item` | 2’512 | 2’173 Item, 80 Armor, 259 Weapon | — | `Wirkung ability.choose nicht übernommen` 4, `Wirkung modifySpeed.multiply nicht übernommen` 3, `Wirkung ability.amount nicht übernommen` 2, `Wirkung ability.count nicht übernommen` 2, `Wirkung ability.from nicht übernommen` 2 |
| `itemEntry` | 13 | — | — | `weggelassen: Textschablonen, beim Lesen eingesetzt` 13 |
| `itemFluff` | 980 | — | — | `weggelassen: nur Bilder (E5)` 980 |
| `itemGroup` | 119 | 100 Item, 5 Armor, 14 Weapon | — | `Mitglied hat schon einen Grundgegenstand` 72 |
| `itemMastery` | 8 | 8 ItemProperty | — | — |
| `itemProperty` | 27 | 27 ItemProperty | — | — |
| `itemType` | 67 | — | — | `weggelassen: eine Aufzählung am Feld Item.itemType, kein Artikel` 67 |
| `itemTypeAdditionalEntries` | 2 | — | — | `weggelassen: Textschablonen` 2 |
| `language` | 201 | 201 Language | — | — |
| `languageFluff` | 26 | — | — | `weggelassen: nur Bilder (E5)` 26 |
| `languageScript` | 6 | — | — | `weggelassen: die Schrift steht als Wort an Language.script` 6 |
| `legendaryGroup` | 188 | 209 Rule | — | `Spielart (_versions) ausgeschrieben` 21 |
| `legendaryGroupTemplate` | 1 | — | — | `weggelassen: Schablone` 1 |
| `lifeBackground` | 13 | 13 Table | — | — |
| `lifeClass` | 12 | 12 Table | — | — |
| `magicItems` | 33 | 33 Table | — | — |
| `magicvariant` | 230 | 230 Item | — | `inherits.spellScrollLevel nicht übernommen` 18, `inherits.classFeatures nicht übernommen` 12, `inherits.propertyAdd nicht übernommen` 8, `inherits.valueExpression nicht übernommen` 3, `inherits.otherSources nicht übernommen` 2, `inherits.barding nicht übernommen` 1, … (1 weitere) |
| `monster` | 4’560 | 4’851 Statblock | — | `Spielart (_versions) ausgeschrieben` 291, `_mod scalarAddProp an fehlendem save` 19, `_mod scalarAddProp an fehlendem skill` 13, `Zustandsimmunität mit Bedingung (Bedingung entfällt)` 2 |
| `monsterfeatures` | 25 | — | — | `keine Zuordnung` 25 |
| `monsterFluff` | 4’170 | — | — | — |
| `monsterTemplate` | 66 | 66 Rule | — | — |
| `name` | 10 | 10 Table | — | — |
| `object` | 37 | 37 Statblock | — | — |
| `objectFluff` | 11 | — | — | `weggelassen: nur Bilder (E5)` 11 |
| `optionalfeature` | 221 | 221 Feature | — | — |
| `optionalfeatureFluff` | 1 | — | — | `weggelassen: nur Bilder (E5)` 1 |
| `psionic` | 52 | — | — | `weggelassen: Unearthed Arcana, nie erschienen` 52 |
| `race` | 160 | 222 Ancestry | — | `Spielart (_versions) ausgeschrieben` 62, `Wahl mit Werten ohne Artikel (als Notiz an der Wahl)` 1 |
| `raceFluff` | 223 | — | — | — |
| `recipe` | 316 | — | — | `weggelassen: Kochrezepte, kein Handwerk (Abgleich §2.5)` 316 |
| `recipeFluff` | 316 | — | — | `weggelassen: Kochrezepte` 316 |
| `reward` | 278 | 278 Rule | — | — |
| `sense` | 8 | 8 Rule | — | — |
| `skill` | 36 | 36 Skill | — | — |
| `spell` | 969 | 969 Spell | — | `Komponente R (2024)` 3, `mehrere Dauern (erste übernommen)` 3, `mehrere Wirkzeiten (erste übernommen)` 2 |
| `spellFluff` | 92 | — | — | `weggelassen: nur Bilder (E5)` 92 |
| `status` | 5 | 5 Condition | — | — |
| `subclass` | 330 | 330 Subclass | — | `Zauber ohne Wahl und ohne Namen (als Text belassen)` 139 |
| `subclassFeature` | 1’499 | 1’492 Feature | — | `mit gleichlautendem Eintrag vereint` 7 |
| `subclassFluff` | 164 | — | — | — |
| `subrace` | 98 | 93 Ancestry | — | `Spielart einer Unterart (ändert das Volk, nicht ausgeschrieben)` 14, `Unterart ohne Namen (Spielart der Abstammung)` 5 |
| `table` | 2’381 | 2’381 Table | — | — |
| `tableGroup` | 22 | 22 Table | — | — |
| `trap` | 37 | 37 Hazard | — | `Gefahrgrad nuisance` 3, `Gefahrgrad moderate` 2 |
| `trapFluff` | 5 | — | — | `weggelassen: nur Bilder (E5)` 5 |
| `variantrule` | 245 | 245 Rule | — | — |
| `vehicle` | 39 | 39 Statblock | — | — |
| `vehicleFluff` | 36 | — | — | — |
| `vehicleUpgrade` | 31 | 31 Rule | — | — |

## Ausgeschlossene Quellen

Seit T-087 siebt nicht mehr der Regelstand, nur noch die Auswahl des Laufs (`--sources`, `--srd`, `--only-2014`) und was keine Art ist: Kochbücher und Häkelmuster. Je Grund die Quellen mit Anzahl Einträgen, über alle Arten.

- **Häkelmuster (Crochet: A Book of Many Patterns)** (1): CaBoMP 1
- **Kochbuch (Heroes' Feast Legends of the Table)** (1): HFLotT 1
- **Kochrezepte als Karten (Deck of Many Morsels)** (53): HFDoMM 53

Quellen, die in keiner Bücher- oder Abenteuerliste stehen und hereinkamen (nicht nach Datum geprüft):

- TftYP 161, UATheMysticClass 66, ESK 31, MFF 18, MCV2DC 12, EEPC 7, MisMV1 6, HAT-LMI 5, MCV3MC 5, RoTOS 4, SADS 3, DrDe 2, EET 1, VD 1

## Schlüssel, die kein Feld trägt

Je Art die 5e.tools-Schlüssel, die keine Zuordnung liest, mit der Zahl der Einträge, in denen sie stehen. Bewusst überall weggelassen und hier nicht aufgeführt: Fundstellen (`page`, `otherSources`, `referenceSources`, `reprintedAs`), Lizenzflaggen (in `Source.srd`), Bildflaggen (`hasToken`, `hasFluffImages`, E5) und die vorgerechneten Filterschlüssel (`*Tags`, Abgleich §3).

- **background:** `fromFeature` 15, `prerequisite` 4, `skillToolLanguageProficiencies` 1
- **baseitem:** `reload` 16, `group` 12, `valueRarity` 8, `bulletFirearm` 6, `arrow` 4, `bolt` 4, `bulletSling` 4, `needleBlowgun` 4, `cellEnergy` 2, `rapier` 2
- **class:** `preparedSpellsChange` 13, `spellsKnownProgressionFixedAllowLowerLevel` 2, `spellsKnownProgressionFixedByLevel` 2
- **classFeature:** `type` 3
- **deity:** `reprintAlias` 22
- **disease:** `type` 7
- **feat:** `resist` 11, `expertise` 7, `optionalfeatureProgression` 4, `senses` 4, `conditionImmune` 2, `immune` 2, `savingThrowProficiencies` 2, `skillToolLanguageProficiencies` 2, `bonusSenses` 1
- **item:** `optionalfeatures` 100, `detail1` 59, `classFeatures` 43, `poisonTypes` 38, `vehSpeed` 36, `crew` 35, `vehAc` 35, `vehHp` 35, `capCargo` 32, `seeAlsoVehicle` 31, `vehDmgThresh` 30, `spellScrollLevel` 29, `capPassenger` 18, `speed` 17, `detail2` 14, `group` 11, `seeAlsoDeck` 8, `typeAlt` 4, `barDimensions` 3, `valueRarity` 3, `atomicPackContents` 2, `weightNote` 2, `crewMax` 1, `crewMin` 1, `dexterityMax` 1, `shippingCost` 1, `travelCost` 1
- **itemGroup:** `itemsHidden` 12, `classFeatures` 1
- **language:** `fonts` 1
- **legendaryGroup:** `_templates` 21
- **monster:** `actionNote` 2, `reactionNote` 1, `sizeNote` 1
- **monsterTemplate:** `crMin` 27, `prerequisite` 1
- **object:** `token` 3
- **optionalfeature:** `senses` 3, `featProgression` 1, `optionalfeatureProgression` 1, `skillProficiencies` 1
- **race:** `sizeEntry` 55
- **reward:** `seeAlsoFacility` 29
- **spell:** `conditionImmune` 12
- **subclass:** `preparedSpellsChange` 3, `preparedSpellsProgression` 3, `featProgression` 1
- **subclassFeature:** `type` 7
- **subrace:** `skillToolLanguageProficiencies` 3
- **table:** `data` 12, `isNameGenerator` 12, `colLabelRows` 10
- **trap:** `hauntBonus` 4

## Verweise ins Leere

Marken, deren Ziel nicht hereinkam — meist ein Eintrag aus einer ausgeschlossenen Quelle. Sie stehen als Text da. Artikel des Grundstands (ausser Buch- und Abenteuertext) finden nur den Grundstand (T-087): ihr Text bleibt, wie er ohne 2024 war — darum stehen ihre Verweise auf Fahrzeuge und Karten weiter hier.

| Marke | Verweise | verschiedene Ziele | häufigste |
| --- | ---: | ---: | --- |
| `@action` | 1 | 1 | `Magic\|XPHB` 1 |
| `@card` | 197 | 129 | `Aberration\|Deck of Many More Things` 2, `Balance\|Deck of Many More Things` 2, `Beast\|Deck of Many More Things` 2, `Book\|Deck of Many More Things` 2, `Bridge\|Deck of Many More Things` 2, … (124 weitere) |
| `@condition` | 1 | 1 | `Bluerot\|GoS` 1 |
| `@creature` | 555 | 270 | `Scions of Giants' Gods\|BGG` 12, `Giants\|MM` 4, `Kobolds\|VGM` 4, `Yuan-ti\|VGM` 4, `` 3, … (265 weitere) |
| `@deck` | 10 | 2 | `tarokka deck\|CoS` 6, `Tarokka Deck\|CoS` 4 |
| `@deity` | 10 | 5 | `Bahgtru\|VGM` 2, `Ilneval\|VGM` 2, `Luthic\|VGM` 2, `Shargaas\|VGM` 2, `Yurtrus\|VGM` 2 |
| `@feat` | 4 | 3 | `magic initiate; druid\|xphb` 2, `magic initiate; cleric\|xphb` 1, `magic initiate; wizard\|xphb` 1 |
| `@item` | 245 | 163 | `+1 scale mail` 6, `+1 Shield\|XDMG` 6, `+2 Shield\|XDMG` 6, `+1 shield` 5, `+1 shortsword` 5, … (158 weitere) |
| `@race` | 27 | 9 | `Elf (Kaladesh; Bishatar and Tirahar)\|PSK` 3, `Elf (Kaladesh; Vahadar)\|PSK` 3, `Elf (Zendikar; Joraga Nation)\|PSZ` 3, `Elf (Zendikar; Mul Daya Nation)\|PSZ` 3, `Elf (Zendikar; Tajuru Nation)\|PSZ` 3, … (4 weitere) |
| `@recipe` | 633 | 357 | `Purple Grapemash No. 3\|HFFotM` 18, `Elverquisst\|HFFotM` 6, `Ruby Cordial\|HFFotM` 5, `Boar Hock Soup\|HFFotM` 4, `Cat's Cradle\|PaF` 4, … (352 weitere) |
| `@spell` | 24 | 23 | `hex/curse#x` 2, `aarakocra armor` 1, `aarakocra armor\|` 1, `aarakocra hand` 1, `aarakocra hand\|` 1, … (18 weitere) |
| `@subclass` | 39 | 20 | `Alchemist\|EFA` 2, `Arcana Domain (Cleric)\|AU` 2, `Arcane Archer (Fighter)\|AU` 2, `Armorer\|EFA` 2, `Artillerist\|EFA` 2, … (15 weitere) |
| `@table` | 224 | 8 | `Random Magic Items - Armaments\|XDMG` 67, `Random Magic Items - Arcana\|XDMG` 57, `Random Magic Items - Relics\|XDMG` 53, `Random Magic Items - Implements\|XDMG` 36, `Treasure Hoard: Challenge 11—16\|DMG` 4, … (3 weitere) |
| `@trap` | 1 | 1 | `quicksand\|dmg` 1 |
| `@variantrule` | 5 | 5 | `Armor Class\|XPHB` 1, `Heroic Inspiration\|XPHB` 1, `Long Rest\|XPHB` 1, `Short Rest\|XPHB` 1, `Temporary Hit Points\|XPHB` 1 |
| `@vehicle` | 50 | 32 | `Space galleon\|AAG` 4, `Bombard\|AAG` 2, `Damselfly ship\|AAG` 2, `Flying fish ship\|AAG` 2, `Hammerhead ship\|AAG` 2, … (27 weitere) |
| `@vehupgrade` | 23 | 22 | `Arcane Artillery\|GoS` 2, `Bones of Endless Toil\|GoS` 1, `Churning Hull\|GoS` 1, `Clockwork Oars\|GoS` 1, `Concussive Rounds\|GoS` 1, … (17 weitere) |

## Unbekannte Eintragsarten und Marken

- `Eintrag image (weggelassen)` 344, `Eintrag wrapper (weggelassen)` 68, `@5etoolsImg` 53, `@ability` 8, `@creatureFluff` 2, `Eintrag refFeat` 2, `@5etoolsAudio` 1, `@savingThrow` 1

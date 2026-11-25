# Sichtprüfung 14.10.2026 (T-090)

Jede Artikelart in den vier Ansichten (`overview` als Listenzeile,
`quick` als Kurzansicht, `full` als Artikelseite, `print` als Blatt) und
im Bearbeiten, bei **1360 px** und **390 px**, dazu die Seiten
Kompendium, Bereiche, Register, Boards (Liste und Leinwand), Kampagne,
Klassen (Liste und Druide), Leseansicht, Figur anlegen, Werkbank, Konto.
Sitzung: https://claude.ai/code/session_016MN2uDRM8DHpT79JJ8xn7c

Bildschirmfotos liegen nicht im Repository (Nachtregel); der Bericht nennt
je Befund Seite, Art, Artikel-Id und was zu sehen war.

## Wie geprüft

- **Lesend gegen dev** (24 297 Artikel, Konto `werkbank`, Verwaltung):
  Playwright mit Chromium, jede Anfrage über das Prüfgerüst; **jede
  schreibende Anfrage wurde im Browser abgefangen** (403), „Edit“ wurde
  nur geöffnet, nie gespeichert. Auf dev wurde kein Artikel geändert —
  darum steht in `docs/Nachtarbeit/2026-10-14.md` für T-090 nichts.
- **Lokal** (frische Postgres, Seed, Prüfartikel) für die 22 anlegbaren
  Arten, die auf dev keinen Artikel haben (Arc, Chapter, Creature,
  Encounter, Event, Map, Place, Quest, Scene, World …): je ein einfacher
  Artikel und einer mit langem Namen, langen Texten (Markdown, Verweis,
  Würfel) und je einer Kante jeder erlaubten Art.
- Je Art drei Beispiele: **einfach** (kleinste Karte), **gross**
  (grösste Karte), **viele Kanten** (meiste Kanten hin und her, ohne
  `inLayer`).
- Automatisch je Aufnahme: seitliches Scrollen, Text über den Rand oder
  abgeschnitten, rohe Ids im sichtbaren Text, `undefined`/`NaN`/
  `[object Object]`/`[[…]]`/`{{…}}`, leere Abschnitte, kaputte Bilder,
  Konsolenfehler und HTTP-Fehler. Dazu Durchsicht der Aufnahmen von Hand
  (Kontaktbögen je Art).
- **Ladezeiten** am Server direkt gemessen (`curl`, zweimal je Route),
  weil das Prüfgerüst jede Anfrage durch einen Umweg schickt und eigene
  Zeiten nicht aussagekräftig wären.
- Zwei Durchgänge: der erste fand die Befunde, der zweite lief nach dem
  Ausrollen der Korrekturen (055–057, Web-PRs) und zeigt den Stand danach.

Umfang: rund 2 250 Aufnahmen (zwei Durchgänge auf dev, einer lokal),
30 Arten auf dev und 22 lokal; je Art die Beispiele unten.

## Ergebnis in einem Satz

Die meisten Befunde hatten **eine Ursache**: Änderungen an den Startzeilen
(`packages/registry`) ohne Migration kamen auf bestehenden Datenbanken nie
an. Auf dev fehlten darum der Bogen für Statblock, Zauber und Gegenstand,
die Spalten im Kompendium, und Verweisfelder zeigten rohe Ids. Das ist mit
den Migrationen 055–057 nachgezogen und auf dev nachgeprüft; dass es nicht
wieder passiert, ist **T-123**.

## Befunde, nach Schwere

Stand: zweiter Durchgang nach dem Ausrollen (14.10., ~13:00 Z).
„Behoben" heisst: PR nach `preprod` gemergt und auf dev angesehen.

### Schwer

| # | Seite · Art | Artikel | Befund | Stand |
|---|---|---|---|---|
| 1 | Artikelseite, Kurzansicht, Druck · Statblock | Lich `e5_972745a96c73`, Marilith `e5_9421e74c44e5` | „Condition immunities: e5_1ceeff2ed43f, e5_154cc036dba7, …" — rohe Ids an **jedem** Statblock mit Zustandsimmunitäten (5 399 Werte). 025 hatte die Werte zu Ids gemacht, die Registerzeile aber nicht. | behoben, #111 (Migration 055) |
| 2 | dto. · Waffe | Blasrohr `e5_40cbaf0511d5` | „Ammunition: e5_d26088f61fc8" (27 Waffen) | behoben, #111 |
| 3 | dto. · Gottheit | Kossuth `e5_a7b86cebc68e`, Heliod `e5_5117f9e005c6`, Lolth `e5_0dfffa054260` | Domänen als Ids (aus 048, T-099) | behoben, #111 |
| 4 | Artikelseite, Kurzansicht · Statblock | Marilith `e5_9421e74c44e5` | Kein Bogen wie im Buch, sondern die erste Anordnung (Feldtabelle „STR 18" als Zelle, Teile darunter) — W2/T-011 kam nie auf dev | behoben, #116 (Migration 056) |
| 5 | Artikelseite · Zauber, Gegenstand | Prismatic Wall `e5_f50b1fd76781`, Infernal Machine `e5_05492b8c2951` | Keine eigene `full`, also kein Buchstil (T-012) | behoben, #116 |
| 6 | Kompendium · alle Arten | — | **Keine Spalten je Art** (`/api/list` → `columns: []`) und keine Vorschaubilder (T-017, 053) | behoben, #116 |
| 7 | Statblock · Abschnitte | Marilith `e5_9421e74c44e5` | „Parry" (Aktionsart Reaction) unter einer **zweiten „Actions"** statt „Reactions" — gilt für jede Reaktion, Bonusaktion, legendäre Aktion | behoben, #119 |
| 8 | Kreatur · Artikelseite | lokal | Die Kreatur zeichnet **ihren Statblock nicht** (Element `linked`), und ohne Statblock fehlen „anlegen"/„aus einer Vorlage" | **T-125** |

### Mittel

| # | Seite · Art | Artikel | Befund | Stand |
|---|---|---|---|---|
| 9 | Bearbeiten · jede Art | Sitzung `e_13320e503ea4` | `Identity · ID` war eine Eingabe, obwohl `readOnly` (die Nummer liess sich ändern) | behoben, #112 |
| 10 | Bearbeiten · 390 px | Sitzung `e_13320e503ea4` | Kantenzeile ohne Umbruch: langes Ziel („D&D 5e (2014) — no book given") schob die Seite auf 450 px | behoben, #112 |
| 11 | Artikelseite · 390 px · Tabelle | Wilderness Encounters (ToA) `e5_bd6c2d0e90aa` | Erste Spalte **Zeichen für Zeichen** untereinander („5 / 9 / f"), weil `overflow-wrap: anywhere` in die Tabelle vererbt wurde | behoben, #117 |
| 12 | Kompendium · Talent | Spalte „Prerequisite" | Rohe Verweise `[[feat-0088\|initiate of high sorcery (nuitari)]]` in der Zelle (sichtbar, seit 056 die Spalten bringt) | behoben, #122 |
| 13 | Register · Kanten | — | `partOf` ohne `Board`/`Encounter`, `activates` ohne `mode`/`areas`/`types` und mit „runs on", `Recipe.tool` ohne Auswahl; `Campaign` **ohne Schema** (Sprachen, Talente, Vergleichsebenen fehlten) | behoben, #111 und #118 (055, 057) |
| 14 | Tabelle · erste Spalte | 7 Tabellen, u. a. `e5_bd6c2d0e90aa`, `e5_c8710c5de6d3` | Schlüssel „59f", „5a0" statt Kreaturen; 12 Tabellen ohne Spaltenköpfe | **T-124** (Importer) |
| 15 | Artikelseite · Rüstung | Dragon Scale Mail `e5_30e67339bd0a`, Armor of Vulnerability | Magische Rüstung ganz ohne Text | **T-124** |
| 16 | Werkbank, Kampagne | — | `/api/checks` 1,7–2,0 s; `/api/campaigns/:c/layers` 1,05 s; erste Liste nach dem Start 1,6 s (danach 0,26 s) | T-007 (messen), Zahlen hier |

### Klein

| # | Seite · Art | Artikel | Befund | Stand |
|---|---|---|---|---|
| 17 | Artikelseite, Druck · Statblock, Fraktion, Karte | lokal | „Caption"/„Alt text" als lose Felder, wo die Ansicht kein Bild zeichnet | behoben, #112 |
| 18 | Action · Text | Eye Rays `e5_ee64aa93b91c` | Listenpunkt mitten im Satz geteilt („must succeed on a" ⏎ „DC 15 …") | **T-124** |
| 19 | Hintergrund · Wahlen | Far Traveler `e5_f26830a4b338` | „Choose 1 from Gaming Set (1 any standard language of your choice)" — Sprachwahl als Notiz der Werkzeugwahl | **T-124** |
| 20 | Feldtabelle · Ort, Fraktion, Klasse, Arc | lokal; Druide `e5_c7d5bbf1f6b4` | Lange Einzeltexte (`On arrival`, `Goal`, `Starting equipment`, `Hook`) in Akzentfarbe und kleiner Schrift | **T-126** |
| 21 | Feldtabelle · Ereignis, Arc, Quest, Szene | lokal | „Sortable value", „Sortable value of the end" — interne Sortierwerte sichtbar | **T-126** |
| 22 | Bearbeiten · jede Art | — | „Identity · Name" ist eine Eingabe; CLAUDE.md sagt, der Name bleibe draussen | **T-126** (Frage an die Leitung) |
| 23 | Board · „Linked, not on the board" | Board „Aus Nebel wacht…" `e_b9ea8e0a9466` | „Battleaxe", „Morningstar" je zweimal, nicht unterscheidbar | **T-126** |
| 24 | Kopf · 390 px | alle Seiten | Seit dem Live-Punkt (T-116) rutscht „Sign out" in eine zweite Zeile | **T-126**, Hinweis an T-116 |
| 25 | Leseansicht | `/read/e5_book_phb`, `/read/e5_book_lmop` | „Nothing to read here … GM only, or the book is not turned on" — auch für die Verwaltung bei aufgeschaltetem Buch; der Grund ist, dass auf dev kein Buchtext eingelesen ist | **T-126**, gehört zu T-091 |
| 26 | Gegenstandsblock | lokal | Gewicht „3lb" ohne Leerzeichen und ohne Umrechnung; in der Feldtabelle „45 lb (20.4 kg)" | **T-126** |
| 27 | Artikelseite · Statblock-Aktion | Bite `e5_a3dfe7bf6e4a` | Rückbezüge 451 KB (773 Kanten) — am Telefon spürbar | Hinweis für T-007 |

### Kein Befund

- **Kein seitliches Scrollen** auf irgendeiner Seite bei 390 px nach #112
  und #117 (vorher: Bearbeiten mit langem Kantenziel).
- **Keine kaputten Bilder**, keine `undefined`/`NaN`/`[object Object]`
  im sichtbaren Text (der Treffer in der Werkbank ist die Beschreibung der
  Prüfung „[object Object] in text").
- `/api/tokens` antwortet dem Prüfkonto mit 403 — das ist richtig: ein
  API-Token verwaltet keine Tokens.
- Die übrigen Antwortzeiten liegen bei 0,2–0,4 s (Artikel, Liste,
  Register, Klasse, Rückbezüge).
- **Karte** (T-115, im Bau): nur angesehen, nichts geändert. Die
  Kartenseite selbst ist im zweiten Durchgang nicht dabei — auf dev gibt
  es noch keinen Kartenartikel; die lokale Karte (Stand vor T-115) zeigte
  nur Felder.
- **Initiative**: im Web noch nicht vorhanden (T-022).
- **Offen, nicht bestätigt:** Bei 390 px liess sich „Edit“ an einzelnen
  Artikeln (Ancestry, Board, Campaign, Class) im Prüfgerüst wiederholt
  nicht anklicken (Zeitüberschreitung nach 30 s), im Einzeltest derselben
  Artikel aber sofort; einmal fehlte der Knopf ganz. Vermutlich zeichnet
  die Knopfleiste neu, während die Seite nachlädt (Sitzung, Fassungsziele).
  Wer am Telefon auf „Edit“ tippt und nichts passiert: hier anknüpfen.

## Wie es dazu kam

Der Seed schreibt Arten, Kanten und Ansichten nur in eine **leere**
Datenbank (`seedRegistryInto`), danach nur die Reihenfolge der Felder.
Eine Änderung in `packages/registry` erreicht dev und prod also nur über
eine Migration. Für Werte (Wörter → Ids) gab es sie (025, 048), für die
Zeilen selbst nicht; für die Ansichten aus W2 und T-017 gar keine. Die
Tests sehen das nicht, weil sie mit dem Seed beginnen, und der Durchstich
auch nicht, weil er mit einer frischen Datenbank beginnt.

Abgleich dev ↔ `seedRegistry` nach 055–057: inhaltlich gleich, bis auf
Vorgaben, die der Server beim Lesen setzt (`owned: false`, `aliases: []`),
die Reihenfolge der Werte von `Layer.kind`, `Weapon.ammoType.suggest`
und `Abilities.PassiveInsight` (ein Feld, das es nur auf dev gibt — bleibt).

## Beispiele je Art

„einfach" = kleinste Karte, „gross" = grösste Karte, „viele Kanten" =
meiste Kanten hin und her (ohne `inLayer`). Arten ohne Artikel auf dev
lokal mit Prüfartikeln.

| Art | Bestand | einfach | gross | viele Kanten |
|---|---|---|---|---|
| AbilityMethod | lokal | „Simple AbilityMethod“ | — | „Linked AbilityMethod …“ (mit je einer Kante jeder erlaubten Art) |
| Action | dev | `e5_36db8b3b4319` Attack | `e5_ee64aa93b91c` Eye Rays | `e5_a3dfe7bf6e4a` Bite |
| ActionType | dev | `e5_109198d4110e` Action | `e5_cde9738c22e4` Reaction | `e5_cde9738c22e4` Reaction |
| Ancestry | dev | `e5_4f3e70e2139c` Elf (Kaladesh) (Vahadar) | `e5_8bd84bd643e5` Gnome (Deep/Svirfneblin) | `e5_79c132076341` Tiefling |
| Arc | lokal | „Simple Arc“ | — | „Linked Arc …“ (mit je einer Kante jeder erlaubten Art) |
| Armor | dev | `e5_30e67339bd0a` Dragon Scale Mail | `e5_3e9f2ee38508` Powered Armor (LLK) | `e5_540d85cd91e6` Plate Armor |
| Article | lokal | „Simple Article“ | — | „Linked Article …“ (mit je einer Kante jeder erlaubten Art) |
| Background | dev | `e5_7e2adff49a5e` Custom Background | `e5_f26830a4b338` Far Traveler | `e5_22ae1ace368d` Criminal |
| Board | dev | `e_3c5cc897398f` Rules | `e_b9ea8e0a9466` Aus Nebel wacht... | `e_3c5cc897398f` Rules |
| Campaign | dev | `65a86a59-6560-4911-9982-269621a89961` Aus Nebel wacht... | `65a86a59-6560-4911-9982-269621a89961` Aus Nebel wacht... | `65a86a59-6560-4911-9982-269621a89961` Aus Nebel wacht... |
| Chapter | lokal | „Simple Chapter“ | — | „Linked Chapter …“ (mit je einer Kante jeder erlaubten Art) |
| Class | dev | `e5_d41def8a8dee` Warrior Sidekick | `e5_c7d5bbf1f6b4` Druid | `e5_712ba361cfea` Cleric |
| Condition | dev | `e5_43e40fee45f8` Exhaustion 6 | `e5_00533721ec5d` Concentration | `e5_1ceeff2ed43f` Charmed |
| Creature | lokal | „Simple Creature“ | — | „Linked Creature …“ (mit je einer Kante jeder erlaubten Art) |
| Deity | dev | `e5_a7b86cebc68e` Kossuth | `e5_5117f9e005c6` Heliod | `e5_0dfffa054260` Lolth |
| Disease | dev | `e5_716170979df2` Flesh Rot | `e5_9305daa549af` Saprophytic Plague | `e5_61d2be8bd063` Blinding Sickness |
| Encounter | lokal | „Simple Encounter“ | — | „Linked Encounter …“ (mit je einer Kante jeder erlaubten Art) |
| EquipmentMethod | lokal | „Simple EquipmentMethod“ | — | „Linked EquipmentMethod …“ (mit je einer Kante jeder erlaubten Art) |
| Event | lokal | „Simple Event“ | — | „Linked Event …“ (mit je einer Kante jeder erlaubten Art) |
| Faction | dev | `e5_6dff097beff0` Cult of Demogorgon | `e5_b43db3b16ee8` Cult of the Howling Hatred | `e5_da0f6824ca2e` Cult of the Black Earth |
| Feat | dev | `e5_293b28c9431b` Skilled | `e5_eb2dda59d4b6` Strixhaven Initiate | `e5_202e06eb6e2c` Rune Shaper |
| Feature | dev | `e5_3c061fdeacc1` Amphibious | `e5_9236154ff57a` Wild Magic Surge | `e5_2042a7b12266` Magic Resistance |
| Hazard | dev | `e5_988856e20c20` Slippery Ice | `e5_8440bc8c943f` Malfunctioning Phase Transfe | `e5_3ac5ff4b7289` Avalanche (IDRotF) |
| Heading | lokal | „Simple Heading“ | — | „Linked Heading …“ (mit je einer Kante jeder erlaubten Art) |
| Information | lokal | „Simple Information“ | — | „Linked Information …“ (mit je einer Kante jeder erlaubten Art) |
| Inventory | lokal | „Simple Inventory“ | — | „Linked Inventory …“ (mit je einer Kante jeder erlaubten Art) |
| Item | dev | `e5_fb4c7b5a538f` Gaming Set | `e5_05492b8c2951` The Infernal Machine of Lum  | `e5_05492b8c2951` The Infernal Machine of Lum  |
| ItemProperty | dev | `e5_7eae2eb2262f` special | `e5_174769221296` Ammunition | `e5_d6a0dd67234b` Versatile |
| Knowledge | lokal | „Simple Knowledge“ | — | „Linked Knowledge …“ (mit je einer Kante jeder erlaubten Art) |
| Language | dev | `e5_5dfd11dfb1b0` Olman | `e5_063ad5eb653b` Qualith | `e5_4515886cac1b` Common |
| Layer | dev | `e5_unsourced_2014` D&D 5e (2014) — no book give | `e5_group_nonstandard` Non-standard | `e5_367c46d7f4ff` D&D 5e (2014) |
| Map | lokal | „Simple Map“ | — | „Linked Map …“ (mit je einer Kante jeder erlaubten Art) |
| Material | lokal | „Simple Material“ | — | „Linked Material …“ (mit je einer Kante jeder erlaubten Art) |
| Paragraph | lokal | „Simple Paragraph“ | — | „Linked Paragraph …“ (mit je einer Kante jeder erlaubten Art) |
| Party | dev | `pt_65a86a59-6560-4911-9982-269621a89961` Aus Nebel wacht... party | `pt_65a86a59-6560-4911-9982-269621a89961` Aus Nebel wacht... party | `pt_65a86a59-6560-4911-9982-269621a89961` Aus Nebel wacht... party |
| Place | lokal | „Simple Place“ | — | „Linked Place …“ (mit je einer Kante jeder erlaubten Art) |
| PlayerCharacter | dev | `e_0a1cc2523a44` Test 2 | `e_dead7e08e4e4` Test | `e_b689227e6630` Hi |
| Quest | lokal | „Simple Quest“ | — | „Linked Quest …“ (mit je einer Kante jeder erlaubten Art) |
| ReadAloudText | lokal | „Simple ReadAloudText“ | — | „Linked ReadAloudText …“ (mit je einer Kante jeder erlaubten Art) |
| Recipe | lokal | „Simple Recipe“ | — | „Linked Recipe …“ (mit je einer Kante jeder erlaubten Art) |
| Rule | dev | `e5_94883d3bed5e` Boon of Fortitude | `e5_1f1369243b82` Tool Proficiencies | `e5_a0be88c32ec3` Ship Stat Blocks |
| Scene | lokal | „Simple Scene“ | — | „Linked Scene …“ (mit je einer Kante jeder erlaubten Art) |
| Session | dev | `e_13320e503ea4` Session 0 | `e_13320e503ea4` Session 0 | `e_13320e503ea4` Session 0 |
| Skill | dev | `e5_5a3ab4acf548` Medicine | `e5_e7f3e21b78d9` Athletics | `e5_af5214504f80` Acrobatics |
| Spell | dev | `e5_16a45c9d6872` Misty Step | `e5_f50b1fd76781` Prismatic Wall | `e5_0b84459e177f` Mage Hand |
| Statblock | dev | `e_393d9afdba4a` Hi | `e5_9421e74c44e5` Marilith | `e5_a4b76e585e24` Archmage |
| Story | dev | `e_82bb3d6d2a51` Neue Freunde | `e_82bb3d6d2a51` Neue Freunde | `e_82bb3d6d2a51` Neue Freunde |
| Subclass | dev | `e5_e4bf3707b07c` Thief | `e5_c8c7fb83c48b` Arcane Archer | `e5_ad35fe81c80f` Circle of the Land |
| Table | dev | `e5_ba54dfe76bcb` Shields | `e5_bd6c2d0e90aa` Wilderness Encounters (ToA) | `e5_180d7c422fee` Spells |
| Weapon | dev | `e5_0108d4b75ba0` Whip | `e5_5dd744aabfcb` Blackstaff | `e5_22093bcb7cbc` Dagger |
| World | lokal | „Simple World“ | — | „Linked World …“ (mit je einer Kante jeder erlaubten Art) |
| ZoneKind | lokal | „Simple ZoneKind“ | — | „Linked ZoneKind …“ (mit je einer Kante jeder erlaubten Art) |
Nicht geprüft: `Asset` (eigene Seite T-119, parallel im Bau), `Embed`
(braucht ein Ziel; erscheint nur in Kapiteln, und auf dev gibt es keine).

## Pull Requests

| PR | Was |
|---|---|
| [#111](https://github.com/Mrfudog/Atlas-Mentis/pull/111) | Migration 055: Verweisfelder und `Campaign` im Register nachziehen |
| [#112](https://github.com/Mrfudog/Atlas-Mentis/pull/112) | ID nur lesen, Kantenzeile am Telefon, Bildfelder nur beim Bild |
| [#116](https://github.com/Mrfudog/Atlas-Mentis/pull/116) | Migration 056: Ansichten je Art (Bogen, Kompendium-Spalten) |
| [#117](https://github.com/Mrfudog/Atlas-Mentis/pull/117) | Tabellen am Telefon |
| [#118](https://github.com/Mrfudog/Atlas-Mentis/pull/118) | Migration 057: `partOf`, `activates`, `Recipe.tool` |
| [#119](https://github.com/Mrfudog/Atlas-Mentis/pull/119) | „Reactions" im Statblock |
| [#122](https://github.com/Mrfudog/Atlas-Mentis/pull/122) | Verweise in Listenzellen als Namen |

Neue Aufgaben im Brett: T-123 (Register-Abgleich), T-124 (Importer),
T-125 (Statblock an der Kreatur), T-126 (Feinschliff).

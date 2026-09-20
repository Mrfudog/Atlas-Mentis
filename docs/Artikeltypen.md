# Artikeltypen — zum Durchgehen

<!-- Erzeugt aus `packages/registry`. Nicht von Hand ändern:
     `pnpm --filter @nw/registry catalogue` schreibt die Datei neu. -->

Stand 2026-09-20. 55 Schnittstellen, 41 Kantenarten.

Je Art vier Fragen: **welche Felder sie selbst trägt**, **welche sie
erbt**, **welche Kanten** sie trägt und **wie sie gezeichnet wird**. Geerbtes
steht kursiv dabei — ohne das liest man bei `NPC` „verlangt nichts" und
übersieht, dass sie über `Creature` die halbe Kampagne trägt.

---

## World

*Wer und was es gibt.* — 14 Arten.

### Armor

`Armor` · erbt von `Item` ← `Identity`

**Eigene Felder**

- `ac` *number*, `armorType` *string*

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `weight` *number*, `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Kanten von hier**

- `hasProperty` → Rule — „has property"
- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Inventory — `holds` → „held in"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Recipe — `needs` → „used in"
- Recipe — `yields` → „made by"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Article

`Article` · erbt von `Identity`

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+lore` `+secret` `+poem` `+song`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- * — `describedIn` → „describes"
- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Companion

`Companion` · erbt von `Creature` ← `Identity`

**Geerbte Felder**

- *`Creature`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `memberOfParty` → Party — „in the party"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `atLevel` → KnowledgeLevel — „knows as"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | NPC | PlayerCharacter | Party | Faction — „regards"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story — `features` → „appears in"
- Information — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | NPC | PlayerCharacter | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Creature`): `sheet`, Reiter:
  - **Overview** — `image`, `description`, `fields` (ohne StatblockInfo, Vitals, Skills), `blocks`
  - **Combat** — `composed`
  - **Gear** — `inventory`
  - **Craft** — `crafting`
  - **Ties** — `standing`, `relations`

### Consumable

`Consumable` · erbt von `Item` ← `Identity`

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `weight` *number*, `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Kanten von hier**

- `hasProperty` → Rule — „has property"
- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Inventory — `holds` → „held in"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Recipe — `needs` → „used in"
- Recipe — `yields` → „made by"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Creature — *abstrakt*

`Creature` · erbt von `Identity`

**Eigene Felder**

- `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+appearance` `+personality` `+lore` `+fact` `+secret` `+readaloud`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `memberOfParty` → Party — „in the party"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `atLevel` → KnowledgeLevel — „knows as"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | NPC | PlayerCharacter | Party | Faction — „regards"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story — `features` → „appears in"
- Information — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | NPC | PlayerCharacter | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Creature`): `sheet`, Reiter:
  - **Overview** — `image`, `description`, `fields` (ohne StatblockInfo, Vitals, Skills), `blocks`
  - **Combat** — `composed`
  - **Gear** — `inventory`
  - **Craft** — `crafting`
  - **Ties** — `standing`, `relations`

### Faction

`Faction` · erbt von `Identity`

**Eigene Felder**

- `kind` *string*, `color` *string*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+lore` `+secret`

**Kanten von hier**

- `controls` → Place — „controls"
- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `regards` → Creature | NPC | PlayerCharacter | Party | Faction — „regards"

**Kanten hierher**

- NPC — `memberOf` → „members"
- PlayerCharacter — `playedBy` → „plays"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story — `features` → „appears in"
- Information — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | NPC | PlayerCharacter | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Item

`Item` · erbt von `Identity`

**Eigene Felder**

- `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `weight` *number*, `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+lore` `+secret` `+fact`

**Kanten von hier**

- `hasProperty` → Rule — „has property"
- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Inventory — `holds` → „held in"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Recipe — `needs` → „used in"
- Recipe — `yields` → „made by"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Material

`Material` · erbt von `Item` ← `Identity`

**Eigene Felder**

- `materialType` *string*, `trades` *array*

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `weight` *number*, `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Kanten von hier**

- `hasProperty` → Rule — „has property"
- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Inventory — `holds` → „held in"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Recipe — `needs` → „used in"
- Recipe — `yields` → „made by"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### NPC

`NPC` · erbt von `Creature` ← `Identity`

**Geerbte Felder**

- *`Creature`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Kanten von hier**

- `owes` → NPC — „owes"
- `memberOf` → Faction — „member of"
- `livesIn` → Place — „lives in"
- `describedIn` → Article — „described in"
- `memberOfParty` → Party — „in the party"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `atLevel` → KnowledgeLevel — „knows as"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | NPC | PlayerCharacter | Party | Faction — „regards"

**Kanten hierher**

- Statblock — `belongsTo` → „statblock of"
- NPC — `owes` → „creditor of"
- PlayerCharacter — `playedBy` → „plays"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story — `features` → „appears in"
- Information — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | NPC | PlayerCharacter | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Creature`): `sheet`, Reiter:
  - **Overview** — `image`, `description`, `fields` (ohne StatblockInfo, Vitals, Skills), `blocks`
  - **Combat** — `composed`
  - **Gear** — `inventory`
  - **Craft** — `crafting`
  - **Ties** — `standing`, `relations`

### Party

`Party` · erbt von `Identity`

**Eigene Felder**

- `level` *number*, `motto` *string*, `at` *link*, `day` *number*, `watch` *number*, `sinceRation` *number*, `sinceLight` *number*, `actions` *object*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+lore` `+note`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `atLevel` → KnowledgeLevel — „knows as"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | NPC | PlayerCharacter | Party | Faction — „regards"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Creature — `memberOfParty` → „members"
- Quest — `questAbout` → „concerned by"
- Information — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | NPC | PlayerCharacter | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Party`): `description`, `fields`, `inventory`, `crafting`, `relations`

### Place

`Place` · erbt von `Identity`

**Eigene Felder**

- `kind` *Reich | Stadt | Distrikt | Gasse | Gebäude | Raum | Wildnis*, `environment` *string*, `settlementType` *string*, `state` *hidden | discovered | explored*, `since` *string*, `arrival` *long*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+lore` `+readaloud` `+secret`

**Kanten von hier**

- `partOf` → Place | Story — „part of"
- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `tableFor` → Table — „rolls on"
- `route` → Place — „leads to"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- NPC — `livesIn` → „residents"
- Place | Story | Quest — `partOf` → „contains"
- Faction — `controls` → „controlled by"
- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Story — `happensAt` → „scenes here"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Place — `route` → „reached from"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Place`): `image`, `description`, `fields`, `blocks`, `crawl`, `table`, `relations`

### Player character

`PlayerCharacter` · erbt von `Creature` ← `Identity`

**Eigene Felder**

- `player` *string*, `ancestry` *string*, `class` *string*, `level` *number*, `proficiency` *gerechnet*

**Geerbte Felder**

- *`Creature`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+backstory`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `playedBy` → * — „played by"
- `memberOfParty` → Party — „in the party"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `atLevel` → KnowledgeLevel — „knows as"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | NPC | PlayerCharacter | Party | Faction — „regards"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story — `features` → „appears in"
- Information — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | NPC | PlayerCharacter | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Creature`): `sheet`, Reiter:
  - **Overview** — `image`, `description`, `fields` (ohne StatblockInfo, Vitals, Skills), `blocks`
  - **Combat** — `composed`
  - **Gear** — `inventory`
  - **Craft** — `crafting`
  - **Ties** — `standing`, `relations`

### Retainer

`Retainer` · erbt von `Creature` ← `Identity`

**Geerbte Felder**

- *`Creature`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `memberOfParty` → Party — „in the party"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `atLevel` → KnowledgeLevel — „knows as"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | NPC | PlayerCharacter | Party | Faction — „regards"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story — `features` → „appears in"
- Information — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | NPC | PlayerCharacter | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Creature`): `sheet`, Reiter:
  - **Overview** — `image`, `description`, `fields` (ohne StatblockInfo, Vitals, Skills), `blocks`
  - **Combat** — `composed`
  - **Gear** — `inventory`
  - **Craft** — `crafting`
  - **Ties** — `standing`, `relations`

### Weapon

`Weapon` · erbt von `Item` ← `Identity`

**Eigene Felder**

- `damage` *string*, `damageType` *string*, `range` *measure*, `Properties` *string*

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `weight` *number*, `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Kanten von hier**

- `hasProperty` → Rule — „has property"
- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Inventory — `holds` → „held in"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Recipe — `needs` → „used in"
- Recipe — `yields` → „made by"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

---

## Play

*Worauf man während der Sitzung schaut.* — 4 Arten.

### Board

`Board` · erbt von `Identity`

**Eigene Felder**

- `width` *number*, `height` *number*, `snap` *number*, `background` *asset*, `rules` *object*, `shapes` *array*, `anchors` *array*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+note`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `placed` → * — „on the board"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Board`): `board`, `fields` (ohne Board.shapes, Board.anchors)

### Encounter

`Encounter` · erbt von `Identity`

**Eigene Felder**

- `difficulty` *trivial | easy | medium | hard | deadly*, `xpBudget` *number*, `state` *planned | running | done | skipped*, `round` *number*, `turn` *number*, `surprise` *string*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+tactics` `+readaloud` `+note` `+secret`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `participates` → Creature | Statblock | Party — „in the fight"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Encounter`): `initiative`, `description`, `fields`, `blocks`

### Group

`Group` · erbt von `Identity`

**Eigene Felder**

- `purpose` *string*, `kind` *players | table | guests | crew*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+note`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Information — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Map

`Map` · erbt von `Identity`

**Eigene Felder**

- `image` *asset*, `sheets` *array*, `baseHidden` *boolean*, `baseGmOnly` *boolean*, `kind` *world | region | settlement | district | building | battle*, `gridShape` *none | square | hex*, `gridSize` *number*, `gridOffsetX` *number*, `gridOffsetY` *number*, `scale` *measure*, `lighting` *bright | dim | dark*, `fog` *boolean*, `reveal` *array*, `walls` *array*, `tiles` *string*, `tileCols` *number*, `tileRows` *number*, `tileSize` *number*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+note` `+secret` `+readaloud`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `mapOf` → Place | Story — „map of"
- `insideMap` → Map — „inside"
- `marker` → * — „marker"
- `territory` → * — „territory"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `insideMap` → „zoom into"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter | Story — `onMap` → „fights here"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Map`): `map`, `description`, `fields`

---

## Ohne Bereich

*Abstrakte Oberbegriffe — sie tragen keine Artikel.* — 17 Arten.

### Access — *abstrakt*

`Access`

**Eigene Felder**

- `userIds` *array*, `role` *player | co-gm | spectator*, `note` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Asset

`Asset` · erbt von `Identity`

**Eigene Felder**

- `backend` *app | nas | external*, `ref` **Pflicht** *string*, `mime` *string*, `width` *number*, `height` *number*, `bytes` *number*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Description — *abstrakt*

`Description`

**Eigene Felder**

- `description` *long*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Identity — *abstrakt*

`Identity`

**Eigene Felder**

- `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `paragraph` `note`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Image — *abstrakt*

`Image`

**Eigene Felder**

- `image` *asset*, `url` *string*, `caption` *string*, `alt` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Imported — *abstrakt*

`Imported`

**Eigene Felder**

- `text` *long*, `format` *obsidian | markdown | json | plain*, `at` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Layer

`Layer` · erbt von `Identity`

**Eigene Felder**

- `kind` *system | expansion | world | pack | campaign | overrides*, `order` *number*, `version` *string*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Blöcke** `+note`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `inLayer` → „brings"
- Campaign — `activates` → „used by"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Skills — *abstrakt*

`Skills`

**Eigene Felder**

- `proficient` *array*, `expertise` *array*, `saves` *array*, `languages` *array*, `tools` *array*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Source — *abstrakt*

`Source`

**Eigene Felder**

- `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Statblock numbers — *abstrakt*

`StatblockInfo`

**Eigene Felder**

- `system` *string*, `size` *winzig | klein | mittel | gross | riesig | gewaltig*, `kind` *string*, `alignment` *string*, `ac` *number*, `acNote` *string*, `hp` *number*, `hpFormula` *string*, `speed` *measure*, `cr` *string*, `prof` *number*, `combatRole` *string*, `str` *number*, `strMod` *gerechnet*, `dex` *number*, `dexMod` *gerechnet*, `con` *number*, `conMod` *gerechnet*, `int` *number*, `intMod` *gerechnet*, `wis` *number*, `wisMod` *gerechnet*, `cha` *number*, `chaMod` *gerechnet*, `initiative` *gerechnet*, `passivePerception` *gerechnet*, `senses` *string*, `languages` *string*, `saves` *string*, `skills` *string*, `resistances` *string*, `vulnerabilities` *string*, `immunities` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Status — *abstrakt*

`Status`

**Eigene Felder**

- `status` *idea | planned | used | discarded*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Tags — *abstrakt*

`Tags`

**Eigene Felder**

- `tags` *tags*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Time — *abstrakt*

`Time`

**Eigene Felder**

- `sort` *number*, `display` *date*, `untilSort` *number*, `until` *date*, `calendar` *string*, `duration` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Todos — *abstrakt*

`Todos`

**Eigene Felder**

- `items` *array*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Variables — *abstrakt*

`Vars`

**Eigene Felder**

- `bindings` *object*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Visibility — *abstrakt*

`Visibility`

**Eigene Felder**

- `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Vitals — *abstrakt*

`Vitals`

**Eigene Felder**

- `hp` *number*, `hpTemp` *number*, `hitDiceLeft` *number*, `deathSuccess` *number*, `deathFail` *number*, `inspiration` *boolean*, `exhaustion` *number*, `conditions` *array*, `nat1` *number*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`


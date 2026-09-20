# Artikeltypen — zum Durchgehen

<!-- Erzeugt aus `packages/registry`. Nicht von Hand ändern:
     `pnpm --filter @nw/registry catalogue` schreibt die Datei neu. -->

Stand 2026-09-20. 43 Schnittstellen, 41 Kantenarten.

Je Art vier Fragen: **welche Felder sie selbst trägt**, **welche sie
erbt**, **welche Kanten** sie trägt und **wie sie gezeichnet wird**. Geerbtes
steht kursiv dabei — ohne das liest man bei `NPC` „verlangt nichts" und
übersieht, dass sie über `Creature` die halbe Kampagne trägt.

---

## Story

*Was passiert und passiert ist.* — 8 Arten.

### Arc

`Arc` · erbt von `Story` ← `Base`

**Geerbte Felder**

- *`Story`* — `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Kanten von hier**

- `partOf` → Place | Story — „part of"
- `describedIn` → Article — „described in"
- `followsFrom` → Story — „follows"
- `happensAt` → Place — „happens at"
- `features` → Creature | NPC | Statblock | Faction — „features"
- `knowledge` → Information — „knowledge about it"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Place | Story | Quest — `partOf` → „contains"
- PlayerCharacter — `playedBy` → „plays"
- Story — `followsFrom` → „followed by"
- Quest — `questAbout` → „concerned by"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Campaign

`Campaign` · erbt von `Story` ← `Base`

**Geerbte Felder**

- *`Story`* — `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Kanten von hier**

- `partOf` → Place | Story — „part of"
- `describedIn` → Article — „described in"
- `followsFrom` → Story — „follows"
- `happensAt` → Place — „happens at"
- `features` → Creature | NPC | Statblock | Faction — „features"
- `knowledge` → Information — „knowledge about it"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `activates` → Layer — „runs on"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Place | Story | Quest — `partOf` → „contains"
- PlayerCharacter — `playedBy` → „plays"
- Story — `followsFrom` → „followed by"
- Quest — `questAbout` → „concerned by"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Campaign`): `description`, `fields`, `stack`, `quests`, `timeline`, `prep`, `blocks`, `relations`

### Chapter

`Chapter` · erbt von `Story` ← `Base`

**Geerbte Felder**

- *`Story`* — `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Kanten von hier**

- `partOf` → Place | Story — „part of"
- `describedIn` → Article — „described in"
- `followsFrom` → Story — „follows"
- `happensAt` → Place — „happens at"
- `features` → Creature | NPC | Statblock | Faction — „features"
- `knowledge` → Information — „knowledge about it"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Place | Story | Quest — `partOf` → „contains"
- PlayerCharacter — `playedBy` → „plays"
- Story — `followsFrom` → „followed by"
- Quest — `questAbout` → „concerned by"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Event

`Event` · erbt von `Base`

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Blöcke** `+lore` `+secret` `+readaloud`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `involves` → * — „involves"
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

### Quest

`Quest` · erbt von `Base`

**Eigene Felder**

- `state` *rumoured | offered | accepted | done | failed | abandoned*, `reward` *string*, `deadline` *string*, `restriction` *string*, `tasks` *array*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Blöcke** `+lore` `+secret`

**Kanten von hier**

- `partOf` → Place | Story — „part of"
- `describedIn` → Article — „described in"
- `questGiver` → Creature | Faction — „given by"
- `questAbout` → * — „concerns"
- `knowledge` → Information — „knowledge about it"
- `loot` → Item | Information | Feat | Skill — „loot"
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

**Gezeichnet** (aus `Quest`): `quests`, `description`, `fields` (ohne Quest.tasks), `blocks`, `relations`

### Scene / Encounter

`Scene` · erbt von `Story` ← `Base`

**Eigene Felder**

- `mode` *roleplay | encounter | exploration | downtime*, `difficulty` *string*, `readaloud` *long*

**Geerbte Felder**

- *`Story`* — `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Blöcke** `+tactics`

**Kanten von hier**

- `partOf` → Place | Story — „part of"
- `describedIn` → Article — „described in"
- `followsFrom` → Story — „follows"
- `happensAt` → Place — „happens at"
- `features` → Creature | NPC | Statblock | Faction — „features"
- `knowledge` → Information — „knowledge about it"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Place | Story | Quest — `partOf` → „contains"
- PlayerCharacter — `playedBy` → „plays"
- Story — `followsFrom` → „followed by"
- Quest — `questAbout` → „concerned by"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Session

`Session` · erbt von `Story` ← `Base`

**Eigene Felder**

- `activeScene` *link*, `activeEncounter` *link*, `activeMap` *link*, `nowPlaying` *string*, `partyNote` *long*, `stewardship` *gm | table*

**Geerbte Felder**

- *`Story`* — `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Blöcke** `+recap`

**Kanten von hier**

- `partOf` → Place | Story — „part of"
- `describedIn` → Article — „described in"
- `followsFrom` → Story — „follows"
- `happensAt` → Place — „happens at"
- `features` → Creature | NPC | Statblock | Faction — „features"
- `knowledge` → Information — „knowledge about it"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Place | Story | Quest — `partOf` → „contains"
- PlayerCharacter — `playedBy` → „plays"
- Story — `followsFrom` → „followed by"
- Quest — `questAbout` → „concerned by"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Session`): `live`, `prep`, `description`, `fields`, `blocks`, `relations`

### Story — *abstrakt*

`Story` · erbt von `Base`

**Eigene Felder**

- `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Blöcke** `+lore` `+secret` `+readaloud` `+note`

**Kanten von hier**

- `partOf` → Place | Story — „part of"
- `describedIn` → Article — „described in"
- `followsFrom` → Story — „follows"
- `happensAt` → Place — „happens at"
- `features` → Creature | NPC | Statblock | Faction — „features"
- `knowledge` → Information — „knowledge about it"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Place | Story | Quest — `partOf` → „contains"
- PlayerCharacter — `playedBy` → „plays"
- Story — `followsFrom` → „followed by"
- Quest — `questAbout` → „concerned by"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

---

## World

*Wer und was es gibt.* — 16 Arten.

### Armor

`Armor` · erbt von `Item` ← `Base`

**Eigene Felder**

- `ac` *number*, `armorType` *string*

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`Article` · erbt von `Base`

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`Companion` · erbt von `Creature` ← `Base`

**Geerbte Felder**

- *`Creature`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`Consumable` · erbt von `Item` ← `Base`

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`Creature` · erbt von `Base`

**Eigene Felder**

- `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`Faction` · erbt von `Base`

**Eigene Felder**

- `kind` *string*, `color` *string*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

### Inventory

`Inventory` · erbt von `Base`

**Eigene Felder**

- `capacity` *number*, `copper` *number*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Blöcke** `+note`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `holds` → Item — „holds"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Creature | Party — `carries` → „carried by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Inventory`): `inventory`, `description`, `fields` (ohne Inventory), `relations`

### Item

`Item` · erbt von `Base`

**Eigene Felder**

- `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`Material` · erbt von `Item` ← `Base`

**Eigene Felder**

- `materialType` *string*, `trades` *array*

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`NPC` · erbt von `Creature` ← `Base`

**Geerbte Felder**

- *`Creature`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`Party` · erbt von `Base`

**Eigene Felder**

- `level` *number*, `motto` *string*, `at` *link*, `day` *number*, `watch` *number*, `sinceRation` *number*, `sinceLight` *number*, `actions` *object*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`Place` · erbt von `Base`

**Eigene Felder**

- `kind` *Reich | Stadt | Distrikt | Gasse | Gebäude | Raum | Wildnis*, `environment` *string*, `settlementType` *string*, `state` *hidden | discovered | explored*, `since` *string*, `arrival` *long*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`PlayerCharacter` · erbt von `Creature` ← `Base`

**Eigene Felder**

- `player` *string*, `ancestry` *string*, `class` *string*, `level` *number*, `proficiency` *gerechnet*

**Geerbte Felder**

- *`Creature`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`Retainer` · erbt von `Creature` ← `Base`

**Geerbte Felder**

- *`Creature`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

### Statblock

`Statblock` · erbt von `Base`

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Blöcke** `+tactics`

**Kanten von hier**

- `composedOf` → Rule — „composed of"
- `belongsTo` → NPC — „belongs to"
- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Story — `features` → „appears in"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Statblock`): `fields`, `composed`, `blocks`, `relations`

### Weapon

`Weapon` · erbt von `Item` ← `Base`

**Eigene Felder**

- `damage` *string*, `damageType` *string*, `range` *string*, `Properties` *string*

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

## Game

*Woran man sich hält.* — 10 Arten.

### Asset

`Asset` · erbt von `Base`

**Eigene Felder**

- `backend` *app | nas | external*, `ref` **Pflicht** *string*, `mime` *string*, `width` *number*, `height` *number*, `bytes` *number*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

### Feat

`Feat` · erbt von `Rule` ← `Base`

**Eigene Felder**

- `prerequisite` *string*, `repeatable` *boolean*

**Geerbte Felder**

- *`Rule`* — `kind` **Pflicht** *action | bonus | reaction | feature | trait | condition | legendary | lair | feat | skill*, `uses` *string*, `autolink` *boolean*, `recharge` *string*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Weapon | Item | Armor — `hasProperty` → „property of"
- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Group

`Group` · erbt von `Base`

**Eigene Felder**

- `purpose` *string*, `kind` *players | table | guests | crew*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

### Information

`Information` · erbt von `Base`

**Eigene Felder**

- `fields` *array*, `blocks` *array*, `tier` *open | rumour | secret*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Blöcke** `+secret` `+fact`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `knownBy` → Creature | Party | Faction | KnowledgeLevel | Group — „known by"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- * — `knowledge` → „about"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Knowledge level

`KnowledgeLevel` · erbt von `Base`

**Eigene Felder**

- `scope` *common | group | personal*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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
- Creature | Party — `atLevel` → „known to"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Layer

`Layer` · erbt von `Base`

**Eigene Felder**

- `kind` *system | expansion | world | pack | campaign | overrides*, `order` *number*, `version` *string*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

### Recipe

`Recipe` · erbt von `Base`

**Eigene Felder**

- `trade` *string*, `tool` *string*, `ability` *str | dex | con | int | wis | cha*, `dc` *number*, `time` *string*, `days` *number*, `yieldCount` *number*, `onFailure` *materialsLost | halfLost | nothingLost*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Blöcke** `+note` `+secret` `+lore`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `needs` → Item — „needs"
- `yields` → Item — „yields"
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
- Creature | NPC | PlayerCharacter | Party — `crafting` → „worked on by"

**Gezeichnet** (aus `Recipe`): `crafting`, `description`, `fields`, `blocks`, `relations`

### Rule Element

`Rule` · erbt von `Base`

**Eigene Felder**

- `kind` **Pflicht** *action | bonus | reaction | feature | trait | condition | legendary | lair | feat | skill*, `uses` *string*, `autolink` *boolean*, `recharge` *string*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Weapon | Item | Armor — `hasProperty` → „property of"
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

### Skill

`Skill` · erbt von `Rule` ← `Base`

**Eigene Felder**

- `ability` *str | dex | con | int | wis | cha*, `tool` *boolean*

**Geerbte Felder**

- *`Rule`* — `kind` **Pflicht** *action | bonus | reaction | feature | trait | condition | legendary | lair | feat | skill*, `uses` *string*, `autolink` *boolean*, `recharge` *string*
- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Weapon | Item | Armor — `hasProperty` → „property of"
- PlayerCharacter — `playedBy` → „plays"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `blocks`, `composed`, `standing`, `relations`

### Table

`Table` · erbt von `Base`

**Eigene Felder**

- `kind` *loot | encounter | name | shop | event | generic*, `die` *string*, `rows` *array*, `note` *string*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

**Blöcke** `+note` `+secret`

**Kanten von hier**

- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `entry` → * — „entry"
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
- Place | Story | Encounter — `tableFor` → „used at"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Table`): `table`, `description`, `fields` (ohne Table.rows), `blocks`

---

## Play

*Worauf man während der Sitzung schaut.* — 3 Arten.

### Board

`Board` · erbt von `Base`

**Eigene Felder**

- `width` *number*, `height` *number*, `snap` *number*, `background` *asset*, `rules` *object*, `shapes` *array*, `anchors` *array*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

`Encounter` · erbt von `Base`

**Eigene Felder**

- `difficulty` *trivial | easy | medium | hard | deadly*, `xpBudget` *number*, `state` *planned | running | done | skipped*, `round` *number*, `turn` *number*, `surprise` *string*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

### Map

`Map` · erbt von `Base`

**Eigene Felder**

- `image` *asset*, `sheets` *array*, `baseHidden` *boolean*, `baseGmOnly` *boolean*, `kind` *world | region | settlement | district | building | battle*, `gridShape` *none | square | hex*, `gridSize` *number*, `gridOffsetX` *number*, `gridOffsetY` *number*, `scale` *string*, `lighting` *bright | dim | dark*, `fog` *boolean*, `reveal` *array*, `walls` *array*, `tiles` *string*, `tileCols` *number*, `tileRows` *number*, `tileSize` *number*

**Geerbte Felder**

- *`Base`* — `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

*Abstrakte Oberbegriffe — sie tragen keine Artikel.* — 6 Arten.

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

### Base — *abstrakt*

`Base`

**Eigene Felder**

- `text` **Pflicht** *string*, `key` **Pflicht** *string*, `aliases` *array*, `cover` *string*, `value` *idea | planned | used | discarded*, `raw` *long*, `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*, `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*, `imported` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*, `items` *array*, `publication` *string*, `page` *string*, `anchor` *string*, `sourceUrl` *string*, `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*

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

### Statblock numbers — *abstrakt*

`StatblockInfo`

**Eigene Felder**

- `system` *string*, `size` *winzig | klein | mittel | gross | riesig | gewaltig*, `kind` *string*, `alignment` *string*, `ac` *number*, `acNote` *string*, `hp` *number*, `hpFormula` *string*, `speed` *string*, `cr` *string*, `prof` *number*, `combatRole` *string*, `str` *number*, `strMod` *gerechnet*, `dex` *number*, `dexMod` *gerechnet*, `con` *number*, `conMod` *gerechnet*, `int` *number*, `intMod` *gerechnet*, `wis` *number*, `wisMod` *gerechnet*, `cha` *number*, `chaMod` *gerechnet*, `initiative` *gerechnet*, `passivePerception` *gerechnet*, `senses` *string*, `languages` *string*, `saves` *string*, `skills` *string*, `resistances` *string*, `vulnerabilities` *string*, `immunities` *string*

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


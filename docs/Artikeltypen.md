# Artikeltypen — zum Durchgehen

<!-- Erzeugt aus `packages/registry`. Nicht von Hand ändern:
     `pnpm --filter @nw/registry catalogue` schreibt die Datei neu. -->

Stand 2026-09-20. 38 Schnittstellen, 45 Komponenten, 41 Kantenarten.

Je Art vier Fragen: **was sie verlangt**, **was sie erlauben darf**,
**welche Kanten** sie trägt und **wie sie gezeichnet wird**. Geerbtes
steht kursiv dabei — ohne das liest man bei `NPC` „verlangt nichts" und
übersieht, dass sie über `Creature` die halbe Kampagne trägt.

---

## Story

*Was passiert und passiert ist.* — 8 Arten.

### Arc

`Arc` · erbt von `Story` ← `Base`

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`StoryInfo`* — `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`StoryInfo`* — `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`StoryInfo`* — `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `WorldDate` — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `QuestInfo` — `state` *rumoured | offered | accepted | done | failed | abandoned*, `reward` *string*, `deadline` *string*, `restriction` *string*, `tasks` *array*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Gezeichnet** (aus `Quest`): `quests`, `description`, `fields` (ohne QuestInfo.tasks), `blocks`, `relations`

### Scene / Encounter

`Scene` · erbt von `Story` ← `Base`

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `SceneInfo` — `mode` *roleplay | encounter | exploration | downtime*, `difficulty` *string*, `readaloud` *long*
- *`StoryInfo`* — `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `SessionState` — `activeScene` *link*, `activeEncounter` *link*, `activeMap` *link*, `nowPlaying` *string*, `partyNote` *long*, `stewardship` *gm | table*
- *`StoryInfo`* — `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `StoryInfo` — `kind` *campaign | arc | chapter | session | scene*, `played` *string*, `state` *planned | running | played | dropped*, `summary` *long*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `ArmorInfo` — `ac` *number*, `armorType` *string*
- *`ItemInfo`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*
- *`Footprint`* — `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`CreatureInfo`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Vars`* — `bindings` *object*
- *`StatblockInfo`* — `system` *string*, `size` *winzig | klein | mittel | gross | riesig | gewaltig*, `kind` *string*, `alignment` *string*, `ac` *number*, `acNote` *string*, `hp` *number*, `hpFormula` *string*, `speed` *string*, `cr` *string*, `prof` *number*, `combatRole` *string*, `str` *number*, `strMod` *gerechnet*, `dex` *number*, `dexMod` *gerechnet*, `con` *number*, `conMod` *gerechnet*, `int` *number*, `intMod` *gerechnet*, `wis` *number*, `wisMod` *gerechnet*, `cha` *number*, `chaMod` *gerechnet*, `initiative` *gerechnet*, `passivePerception` *gerechnet*, `senses` *string*, `languages` *string*, `saves` *string*, `skills` *string*, `resistances` *string*, `vulnerabilities` *string*, `immunities` *string*
- *`Vitals`* — `hp` *number*, `hpTemp` *number*, `hitDiceLeft` *number*, `deathSuccess` *number*, `deathFail` *number*, `inspiration` *boolean*, `exhaustion` *number*, `conditions` *array*, `nat1` *number*
- *`Skills`* — `proficient` *array*, `expertise` *array*, `saves` *array*, `languages` *array*, `tools` *array*
- *`Access`* — `userIds` *array*, `role` *player | co-gm | spectator*, `note` *string*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`ItemInfo`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*
- *`Footprint`* — `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `CreatureInfo` — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- `Vars` — `bindings` *object*
- `StatblockInfo` — `system` *string*, `size` *winzig | klein | mittel | gross | riesig | gewaltig*, `kind` *string*, `alignment` *string*, `ac` *number*, `acNote` *string*, `hp` *number*, `hpFormula` *string*, `speed` *string*, `cr` *string*, `prof` *number*, `combatRole` *string*, `str` *number*, `strMod` *gerechnet*, `dex` *number*, `dexMod` *gerechnet*, `con` *number*, `conMod` *gerechnet*, `int` *number*, `intMod` *gerechnet*, `wis` *number*, `wisMod` *gerechnet*, `cha` *number*, `chaMod` *gerechnet*, `initiative` *gerechnet*, `passivePerception` *gerechnet*, `senses` *string*, `languages` *string*, `saves` *string*, `skills` *string*, `resistances` *string*, `vulnerabilities` *string*, `immunities` *string*
- `Vitals` — `hp` *number*, `hpTemp` *number*, `hitDiceLeft` *number*, `deathSuccess` *number*, `deathFail` *number*, `inspiration` *boolean*, `exhaustion` *number*, `conditions` *array*, `nat1` *number*
- `Skills` — `proficient` *array*, `expertise` *array*, `saves` *array*, `languages` *array*, `tools` *array*
- `Access` — `userIds` *array*, `role` *player | co-gm | spectator*, `note` *string*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `FactionInfo` — `kind` *string*, `color` *string*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `InventoryInfo` — `capacity` *number*, `copper` *number*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Gezeichnet** (aus `Inventory`): `inventory`, `description`, `fields` (ohne InventoryInfo), `relations`

### Item

`Item` · erbt von `Base`

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `ItemInfo` — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*
- `Footprint` — `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `MaterialInfo` — `materialType` *string*, `trades` *array*
- *`ItemInfo`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*
- *`Footprint`* — `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`CreatureInfo`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Vars`* — `bindings` *object*
- *`StatblockInfo`* — `system` *string*, `size` *winzig | klein | mittel | gross | riesig | gewaltig*, `kind` *string*, `alignment` *string*, `ac` *number*, `acNote` *string*, `hp` *number*, `hpFormula` *string*, `speed` *string*, `cr` *string*, `prof` *number*, `combatRole` *string*, `str` *number*, `strMod` *gerechnet*, `dex` *number*, `dexMod` *gerechnet*, `con` *number*, `conMod` *gerechnet*, `int` *number*, `intMod` *gerechnet*, `wis` *number*, `wisMod` *gerechnet*, `cha` *number*, `chaMod` *gerechnet*, `initiative` *gerechnet*, `passivePerception` *gerechnet*, `senses` *string*, `languages` *string*, `saves` *string*, `skills` *string*, `resistances` *string*, `vulnerabilities` *string*, `immunities` *string*
- *`Vitals`* — `hp` *number*, `hpTemp` *number*, `hitDiceLeft` *number*, `deathSuccess` *number*, `deathFail` *number*, `inspiration` *boolean*, `exhaustion` *number*, `conditions` *array*, `nat1` *number*
- *`Skills`* — `proficient` *array*, `expertise` *array*, `saves` *array*, `languages` *array*, `tools` *array*
- *`Access`* — `userIds` *array*, `role` *player | co-gm | spectator*, `note` *string*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `PartyInfo` — `level` *number*, `motto` *string*
- `Access` — `userIds` *array*, `role` *player | co-gm | spectator*, `note` *string*
- `TravelInfo` — `at` *link*, `day` *number*, `watch` *number*, `sinceRation` *number*, `sinceLight` *number*, `actions` *object*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `LocationInfo` — `kind` *Reich | Stadt | Distrikt | Gasse | Gebäude | Raum | Wildnis*, `environment` *string*, `settlementType` *string*
- `Explored` — `state` *hidden | discovered | explored*, `since` *string*, `arrival` *long*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `CharacterInfo` — `player` *string*, `ancestry` *string*, `class` *string*, `level` *number*, `proficiency` *gerechnet*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`CreatureInfo`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Vars`* — `bindings` *object*
- *`StatblockInfo`* — `system` *string*, `size` *winzig | klein | mittel | gross | riesig | gewaltig*, `kind` *string*, `alignment` *string*, `ac` *number*, `acNote` *string*, `hp` *number*, `hpFormula` *string*, `speed` *string*, `cr` *string*, `prof` *number*, `combatRole` *string*, `str` *number*, `strMod` *gerechnet*, `dex` *number*, `dexMod` *gerechnet*, `con` *number*, `conMod` *gerechnet*, `int` *number*, `intMod` *gerechnet*, `wis` *number*, `wisMod` *gerechnet*, `cha` *number*, `chaMod` *gerechnet*, `initiative` *gerechnet*, `passivePerception` *gerechnet*, `senses` *string*, `languages` *string*, `saves` *string*, `skills` *string*, `resistances` *string*, `vulnerabilities` *string*, `immunities` *string*
- *`Vitals`* — `hp` *number*, `hpTemp` *number*, `hitDiceLeft` *number*, `deathSuccess` *number*, `deathFail` *number*, `inspiration` *boolean*, `exhaustion` *number*, `conditions` *array*, `nat1` *number*
- *`Skills`* — `proficient` *array*, `expertise` *array*, `saves` *array*, `languages` *array*, `tools` *array*
- *`Access`* — `userIds` *array*, `role` *player | co-gm | spectator*, `note` *string*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`CreatureInfo`* — `species` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Vars`* — `bindings` *object*
- *`StatblockInfo`* — `system` *string*, `size` *winzig | klein | mittel | gross | riesig | gewaltig*, `kind` *string*, `alignment` *string*, `ac` *number*, `acNote` *string*, `hp` *number*, `hpFormula` *string*, `speed` *string*, `cr` *string*, `prof` *number*, `combatRole` *string*, `str` *number*, `strMod` *gerechnet*, `dex` *number*, `dexMod` *gerechnet*, `con` *number*, `conMod` *gerechnet*, `int` *number*, `intMod` *gerechnet*, `wis` *number*, `wisMod` *gerechnet*, `cha` *number*, `chaMod` *gerechnet*, `initiative` *gerechnet*, `passivePerception` *gerechnet*, `senses` *string*, `languages` *string*, `saves` *string*, `skills` *string*, `resistances` *string*, `vulnerabilities` *string*, `immunities` *string*
- *`Vitals`* — `hp` *number*, `hpTemp` *number*, `hitDiceLeft` *number*, `deathSuccess` *number*, `deathFail` *number*, `inspiration` *boolean*, `exhaustion` *number*, `conditions` *array*, `nat1` *number*
- *`Skills`* — `proficient` *array*, `expertise` *array*, `saves` *array*, `languages` *array*, `tools` *array*
- *`Access`* — `userIds` *array*, `role` *player | co-gm | spectator*, `note` *string*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `StatblockInfo` — `system` *string*, `size` *winzig | klein | mittel | gross | riesig | gewaltig*, `kind` *string*, `alignment` *string*, `ac` *number*, `acNote` *string*, `hp` *number*, `hpFormula` *string*, `speed` *string*, `cr` *string*, `prof` *number*, `combatRole` *string*, `str` *number*, `strMod` *gerechnet*, `dex` *number*, `dexMod` *gerechnet*, `con` *number*, `conMod` *gerechnet*, `int` *number*, `intMod` *gerechnet*, `wis` *number*, `wisMod` *gerechnet*, `cha` *number*, `chaMod` *gerechnet*, `initiative` *gerechnet*, `passivePerception` *gerechnet*, `senses` *string*, `languages` *string*, `saves` *string*, `skills` *string*, `resistances` *string*, `vulnerabilities` *string*, `immunities` *string*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `Vars` — `bindings` *object*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `WeaponInfo` — `damage` *string*, `damageType` *string*, `range` *string*, `Properties` *string*
- *`ItemInfo`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*
- *`Footprint`* — `rows` *array*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `AssetInfo` — `backend` *app | nas | external*, `ref` *string*, `mime` *string*, `width` *number*, `height` *number*, `bytes` *number*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `SourceRef` — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`RuleInfo`* — `kind` *action | bonus | reaction | feature | trait | condition | legendary | lair | feat | skill*, `uses` *string*, `autolink` *boolean*, `recharge` *string*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `FeatInfo` — `prerequisite` *string*, `repeatable` *boolean*
- *`Vars`* — `bindings` *object*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `GroupInfo` — `purpose` *string*, `kind` *players | table | guests | crew*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `Info` — `fields` *array*, `blocks` *array*, `tier` *open | rumour | secret*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `KnowledgeInfo` — `scope` *common | group | personal*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `LayerInfo` — `kind` *system | expansion | world | pack | campaign | overrides*, `order` *number*, `version` *string*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `RecipeInfo` — `trade` *string*, `tool` *string*, `ability` *str | dex | con | int | wis | cha*, `dc` *number*, `time` *string*, `days` *number*, `yieldCount` *number*, `onFailure` *materialsLost | halfLost | nothingLost*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `RuleInfo` — `kind` *action | bonus | reaction | feature | trait | condition | legendary | lair | feat | skill*, `uses` *string*, `autolink` *boolean*, `recharge` *string*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `Vars` — `bindings` *object*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- *`RuleInfo`* — `kind` *action | bonus | reaction | feature | trait | condition | legendary | lair | feat | skill*, `uses` *string*, `autolink` *boolean*, `recharge` *string*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- `SkillInfo` — `ability` *str | dex | con | int | wis | cha*, `tool` *boolean*
- *`Vars`* — `bindings` *object*
- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `TableInfo` — `kind` *loot | encounter | name | shop | event | generic*, `die` *string*, `rows` *array*, `note` *string*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Gezeichnet** (aus `Table`): `table`, `description`, `fields` (ohne TableInfo.rows), `blocks`

---

## Play

*Worauf man während der Sitzung schaut.* — 3 Arten.

### Board

`Board` · erbt von `Base`

**Verlangt**

- `BoardInfo` — `width` *number*, `height` *number*, `snap` *number*, `background` *asset*, `rules` *object*, `shapes` *array*, `anchors` *array*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Gezeichnet** (aus `Board`): `board`, `fields` (ohne BoardInfo.shapes, BoardInfo.anchors)

### Encounter

`Encounter` · erbt von `Base`

**Verlangt**

- `EncounterInfo` — `difficulty` *trivial | easy | medium | hard | deadly*, `xpBudget` *number*, `state` *planned | running | done | skipped*, `round` *number*, `turn` *number*, `surprise` *string*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

**Verlangt**

- `MapInfo` — `image` *asset*, `sheets` *array*, `baseHidden` *boolean*, `baseGmOnly` *boolean*, `kind` *world | region | settlement | district | building | battle*, `gridShape` *none | square | hex*, `gridSize` *number*, `gridOffsetX` *number*, `gridOffsetY` *number*, `scale` *string*, `lighting` *bright | dim | dark*, `fog` *boolean*, `reveal` *array*, `walls` *array*, `tiles` *string*, `tileCols` *number*, `tileRows` *number*, `tileSize` *number*
- *`Name`* — `text` *string*
- *`Identity`* — `key` *string*, `aliases` *array*, `cover` *string*
- *`Status`* — `value` *idea | planned | used | discarded*

**Erlaubt**

- *`Description`* — `raw` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Image`* — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- *`RawContent`* — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- *`SourceRef`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`WorldDate`* — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- *`Todos`* — `items` *array*

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

*Abstrakte Oberbegriffe — sie tragen keine Artikel.* — 1 Arten.

### Base — *abstrakt*

`Base`

**Verlangt**

- `Name` — `text` *string*
- `Identity` — `key` *string*, `aliases` *array*, `cover` *string*
- `Status` — `value` *idea | planned | used | discarded*

**Erlaubt**

- `Description` — `raw` *long*
- `Visibility` — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- `Image` — `ref` *asset*, `url` *string*, `caption` *string*, `alt` *string*
- `RawContent` — `raw` *long*, `format` *obsidian | markdown | json | plain*, `importedAt` *string*
- `SourceRef` — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- `WorldDate` — `sort` *number*, `display` *date*, `calendar` *string*, `duration` *string*
- `Todos` — `items` *array*

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


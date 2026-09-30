# Artikeltypen — zum Durchgehen

<!-- Erzeugt aus `packages/registry`. Nicht von Hand ändern:
     `pnpm --filter @nw/registry catalogue` schreibt die Datei neu. -->

Stand 2026-09-30. 59 Schnittstellen, 41 Kantenarten.

Je Art vier Fragen: **welche Felder sie selbst trägt**, **welche sie
erbt**, **welche Kanten** sie trägt und **wie sie gezeichnet wird**. Geerbtes
steht kursiv dabei — ohne das liest man bei `Consumable` „verlangt
nichts" und übersieht, dass er über `Item` die halbe Kampagne trägt.

---

## World

*Wer und was es gibt.* — 11 Arten.

### Armor

`Armor` · erbt von `Item` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Lore` ← `Secrets` ← `Facts`

**Eigene Felder**

- `ac` *number*, `armorType` *string*

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `weight` *number in lb*, `rows` *grid*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`Facts`* — `fact` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Article

`Article` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Todos` ← `Lore` ← `Secrets`

**Eigene Felder**

- `poem` *long*, `song` *long*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`Todos`* — `items` *array*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Consumable

`Consumable` · erbt von `Item` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Lore` ← `Secrets` ← `Facts`

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `weight` *number in lb*, `rows` *grid*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`Facts`* — `fact` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Creature

`Creature` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Vars` ← `Access` ← `Vitals` ← `Proficiencies` ← `Lore` ← `Facts` ← `Secrets` ← `ReadAloud`

**Eigene Felder**

- `appearance` *long*, `personality` *long*, `species` *string*, `kind` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`Vars`* — `bindings` *object*
- *`Access`* — `userIds` *array*, `role` *player | co-gm | spectator*
- *`Vitals`* — `hp` *number*, `hpTemp` *number*, `hitDiceLeft` *number*, `deathSuccess` *number*, `deathFail` *number*, `inspiration` *boolean*, `exhaustion` *number*, `conditions` *array*, `nat1` *number*
- *`Proficiencies`* — `proficient` *Skill + Tool + Language + WeaponTraining + ArmorTraining + KnowledgeField: 35 words*, `expertise` *Skill + Tool + Language + WeaponTraining + ArmorTraining + KnowledgeField: 35 words*, `saves` *Ability: str | dex | con | int | wis | cha*
- *`Lore`* — `lore` *long*
- *`Facts`* — `fact` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*

**Kanten von hier**

- `owes` → Creature — „owes"
- `memberOf` → Faction — „member of"
- `livesIn` → Place — „lives in"
- `describedIn` → Article — „described in"
- `memberOfParty` → Party — „in the party"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | PlayerCharacter | Party | Faction — „regards"

**Kanten hierher**

- Statblock — `belongsTo` → „statblock of"
- Creature — `owes` → „creditor of"
- PlayerCharacter — `playedBy` → „plays"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story — `features` → „appears in"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | PlayerCharacter | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Creature`): `sheet`, Reiter:
  - **Overview** — `image`, `description`, `linked` (ohne Inventory), `fields` (ohne Vitals, Proficiencies), `prose`
  - **Combat** — `composed`
  - **Gear** — `inventory`
  - **Craft** — `crafting`
  - **Ties** — `standing`, `relations`

### Faction

`Faction` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Lore` ← `Secrets`

**Eigene Felder**

- `kind` *string*, `color` *color*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*

**Kanten von hier**

- `controls` → Place — „controls"
- `describedIn` → Article — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `regards` → Creature | PlayerCharacter | Party | Faction — „regards"

**Kanten hierher**

- Creature — `memberOf` → „members"
- PlayerCharacter — `playedBy` → „plays"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story — `features` → „appears in"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | PlayerCharacter | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Item

`Item` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Lore` ← `Secrets` ← `Facts`

**Eigene Felder**

- `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `weight` *number in lb*, `rows` *grid*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`Facts`* — `fact` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Material

`Material` · erbt von `Item` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Lore` ← `Secrets` ← `Facts`

**Eigene Felder**

- `materialType` *string*, `trades` *array*

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `weight` *number in lb*, `rows` *grid*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`Facts`* — `fact` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Party

`Party` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Access` ← `Lore` ← `Notes`

**Eigene Felder**

- `level` *number*, `motto` *string*, `at` *link → Place*, `day` *number*, `watch` *number*, `sinceRation` *number*, `sinceLight` *number*, `actions` *object*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Access`* — `userIds` *array*, `role` *player | co-gm | spectator*
- *`Lore`* — `lore` *long*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `describedIn` → Article — „described in"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | PlayerCharacter | Party | Faction — „regards"

**Kanten hierher**

- PlayerCharacter — `playedBy` → „plays"
- Creature — `memberOfParty` → „members"
- Quest — `questAbout` → „concerned by"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | PlayerCharacter | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Party`): `description`, `fields`, `inventory`, `crafting`, `relations`

### Place

`Place` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Lore` ← `ReadAloud` ← `Secrets`

**Eigene Felder**

- `kind` *Reich | Stadt | Distrikt | Gasse | Gebäude | Raum | Wildnis*, `environment` *string*, `state` *hidden | discovered | explored*, `arrival` *long*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Lore`* — `lore` *long*
- *`ReadAloud`* — `readaloud` *long*
- *`Secrets`* — `secret` *long*

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

- Creature — `livesIn` → „residents"
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

**Gezeichnet** (aus `Place`): `image`, `description`, `fields`, `prose`, `crawl`, `table`, `relations`

### Player character

`PlayerCharacter` · erbt von `Creature` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Vars` ← `Access` ← `Vitals` ← `Proficiencies` ← `Lore` ← `Facts` ← `Secrets` ← `ReadAloud`

**Eigene Felder**

- `backstory` *long*, `player` *string*, `ancestry` *string*, `class` *string*, `level` *number*, `proficiency` *gerechnet*

**Geerbte Felder**

- *`Creature`* — `appearance` *long*, `personality` *long*, `species` *string*, `kind` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`Vars`* — `bindings` *object*
- *`Access`* — `userIds` *array*, `role` *player | co-gm | spectator*
- *`Vitals`* — `hp` *number*, `hpTemp` *number*, `hitDiceLeft` *number*, `deathSuccess` *number*, `deathFail` *number*, `inspiration` *boolean*, `exhaustion` *number*, `conditions` *array*, `nat1` *number*
- *`Proficiencies`* — `proficient` *Skill + Tool + Language + WeaponTraining + ArmorTraining + KnowledgeField: 35 words*, `expertise` *Skill + Tool + Language + WeaponTraining + ArmorTraining + KnowledgeField: 35 words*, `saves` *Ability: str | dex | con | int | wis | cha*
- *`Lore`* — `lore` *long*
- *`Facts`* — `fact` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*

**Kanten von hier**

- `owes` → Creature — „owes"
- `memberOf` → Faction — „member of"
- `livesIn` → Place — „lives in"
- `describedIn` → Article — „described in"
- `playedBy` → * — „played by"
- `memberOfParty` → Party — „in the party"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | PlayerCharacter | Party | Faction — „regards"

**Kanten hierher**

- Statblock — `belongsTo` → „statblock of"
- Creature — `owes` → „creditor of"
- PlayerCharacter — `playedBy` → „plays"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story — `features` → „appears in"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | PlayerCharacter | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Creature`): `sheet`, Reiter:
  - **Overview** — `image`, `description`, `linked` (ohne Inventory), `fields` (ohne Vitals, Proficiencies), `prose`
  - **Combat** — `composed`
  - **Gear** — `inventory`
  - **Craft** — `crafting`
  - **Ties** — `standing`, `relations`

### Weapon

`Weapon` · erbt von `Item` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Lore` ← `Secrets` ← `Facts`

**Eigene Felder**

- `damage` *string*, `damageType` *string*, `range` *measure in ft*

**Geerbte Felder**

- *`Item`* — `itemType` *string*, `rarity` *gewöhnlich | ungewöhnlich | selten | sehr selten | legendär | artefakt*, `availability` *string*, `copperPrice` *number*, `stackSize` *number*, `weight` *number in lb*, `rows` *grid*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`Facts`* — `fact` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

---

## Play

*Worauf man während der Sitzung schaut.* — 3 Arten.

### Board

`Board` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Notes`

**Eigene Felder**

- `width` *number*, `height` *number*, `snap` *number*, `background` *asset*, `rules` *object*, `shapes` *array*, `anchors` *array*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Notes`* — `note` *long*

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

`Encounter` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Todos` ← `Tactics` ← `ReadAloud` ← `Notes` ← `Secrets` ← `Difficulty`

**Eigene Felder**

- `xpBudget` *number*, `phase` *planned | running | done | skipped*, `round` *number*, `turn` *number*, `surprise` *string*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Todos`* — `items` *array*
- *`Tactics`* — `tactics` *long*
- *`ReadAloud`* — `readaloud` *long*
- *`Notes`* — `note` *long*
- *`Secrets`* — `secret` *long*
- *`Difficulty`* — `difficulty` *1…20*

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

**Gezeichnet** (aus `Encounter`): `initiative`, `description`, `fields`, `prose`

### Map

`Map` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Notes` ← `Secrets` ← `ReadAloud`

**Eigene Felder**

- `sheets` *array*, `baseHidden` *boolean*, `baseGmOnly` *boolean*, `kind` *world | region | settlement | district | building | battle*, `gridShape` *none | square | hex*, `gridSize` *number*, `gridOffsetX` *number*, `gridOffsetY` *number*, `scale` *measure in m*, `lighting` *bright | dim | dark*, `fog` *boolean*, `reveal` *array*, `walls` *array*, `tiles` *string*, `tileCols` *number*, `tileRows` *number*, `tileSize` *number*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Notes`* — `note` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*

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

*Abstrakte Oberbegriffe — sie tragen keine Artikel.* — 24 Arten.

### Abilities — *abstrakt*

`Abilities`

**Eigene Felder**

- `str` *number*, `strMod` *gerechnet*, `dex` *number*, `dexMod` *gerechnet*, `con` *number*, `conMod` *gerechnet*, `int` *number*, `intMod` *gerechnet*, `wis` *number*, `wisMod` *gerechnet*, `cha` *number*, `chaMod` *gerechnet*, `initiative` *gerechnet*, `passivePerception` *gerechnet*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Access — *abstrakt*

`Access`

**Eigene Felder**

- `userIds` *array*, `role` *player | co-gm | spectator*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Asset

`Asset` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source`

**Eigene Felder**

- `backend` *app | nas | external*, `ref` **Pflicht** *string*, `mime` *string*, `width` *number*, `height` *number*, `bytes` *number*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Difficulty — *abstrakt*

`Difficulty`

**Eigene Felder**

- `difficulty` *1…20*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Facts — *abstrakt*

`Facts`

**Eigene Felder**

- `fact` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Identity — *abstrakt*

`Identity`

**Eigene Felder**

- `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Image — *abstrakt*

`Image`

**Eigene Felder**

- `image` *asset*, `caption` *string*, `alt` *string*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Layer

`Layer` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Notes`

**Eigene Felder**

- `kind` *system | expansion | world | pack | campaign | overrides*, `order` *number*, `version` *string*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *gm | campaign | players | public*, `scope` *string*, `revealedTo` *array*, `hiddenFrom` *array*, `sharedUsers` *array*, `inherit` *boolean*
- *`Tags`* — `tags` *tags*
- *`Notes`* — `note` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Lore — *abstrakt*

`Lore`

**Eigene Felder**

- `lore` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Notes — *abstrakt*

`Notes`

**Eigene Felder**

- `note` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Proficiencies — *abstrakt*

`Proficiencies`

**Eigene Felder**

- `proficient` *Skill + Tool + Language + WeaponTraining + ArmorTraining + KnowledgeField: 35 words*, `expertise` *Skill + Tool + Language + WeaponTraining + ArmorTraining + KnowledgeField: 35 words*, `saves` *Ability: str | dex | con | int | wis | cha*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Text — *abstrakt*

`Prose`

**Eigene Felder**

- `paragraph` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Read aloud — *abstrakt*

`ReadAloud`

**Eigene Felder**

- `readaloud` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Secrets — *abstrakt*

`Secrets`

**Eigene Felder**

- `secret` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Status — *abstrakt*

`Status`

**Eigene Felder**

- `status` *State: idea | prepared | ready*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

### Tactics — *abstrakt*

`Tactics`

**Eigene Felder**

- `tactics` *long*

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`

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

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `composed`, `standing`, `relations`


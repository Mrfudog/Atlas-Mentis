# Artikeltypen — zum Durchgehen

<!-- Erzeugt aus `packages/registry`. Nicht von Hand ändern:
     `pnpm --filter @nw/registry catalogue` schreibt die Datei neu. -->

Stand 2026-10-21. 86 Schnittstellen, 70 Kantenarten.

Je Art vier Fragen: **welche Felder sie selbst trägt**, **welche sie
erbt**, **welche Kanten** sie trägt und **wie sie gezeichnet wird**. Geerbtes
steht kursiv dabei — ohne das liest man bei `Weapon` drei Waffenfelder
und übersieht, dass sie über `Item` die halbe Kampagne trägt.

---

## World

*Wer und was es gibt.* — 15 Arten.

### Armor

`Armor` · erbt von `Item` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Lore` ← `Secrets` ← `Facts` ← `Effects`

**Eigene Felder**

- `ac` *number*, `armorType` *light | medium | heavy | shield*, `strength` *1…30*, `stealthDisadvantage` *boolean*

**Geerbte Felder**

- *`Item`* — `itemType` *adventuring gear | ammunition | artisan tools | explosive | food and drink | gaming set | instrument | tool | tack and harness | light armor | medium armor | heavy armor | shield | melee weapon | ranged weapon | potion | scroll | ring | rod | staff | wand | wondrous item | spellcasting focus | mount | vehicle | trade good | treasure | art object | gemstone | coinage | other*, `rarity` *none | common | uncommon | rare | very rare | legendary | artifact | varies | unknown*, `tier` *minor | major*, `attunement` *boolean*, `attunementNote` *string*, `charges` *0…∞*, `recharge` *dawn | dusk | midnight | shortRest | longRest | special*, `rechargeAmount` *string*, `bonusWeapon` *signed*, `bonusAc` *signed*, `bonusSpellAttack` *signed*, `bonusSave` *signed*, `appliesTo` *array*, `namePrefix` *string*, `nameSuffix` *string*, `priceAdd` *0…∞*, `priceMult` *0…∞*, `availability` *string*, `copperPrice` *number*, `priceNote` *string*, `stackSize` *number*, `weight` *number in lb*, `lightBright` *measure in ft*, `lightDim` *measure in ft*, `rows` *grid*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`Facts`* — `fact` *long*
- *`Effects`* — `effects` *array*

**Kanten von hier**

- `casts` → Spell — „casts"
- `hasProperty` → ItemProperty — „has property"
- `enchantedWith` → Item — „enhanced with"
- `describedIn` → Article | Story | BookPart — „described in"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `instanceOf` → same — „instance of"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `equips` → „equipped by"
- GlossaryTerm — `explains` → „explained by"
- Item — `enchantedWith` → „enhances"
- Shop — `sells` → „sold at"
- Inventory — `holds` → „held in"
- Session — `leftBehind` → „left behind at"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Recipe — `needs` → „used in"
- Recipe — `yields` → „made by"
- Campaign | Party | Creature — `craftsWith` → „crafted differently by"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- Statblock | Item | CraftingOrder | Map | Encounter — `instanceOf` → „instances"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Item`): `image`, `item`, `description`, `fields` (ohne Item, Weapon, Armor, Material), `linked`, `prose`, `composed`, `crafting`, `usedBy`, `standing`, `relations`

### Article

`Article` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Todos` ← `Lore` ← `Secrets`

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Todos`* — `items` *array*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- * — `describedIn` → „describes"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Creature

`Creature` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Vars` ← `Vitals` ← `Lore` ← `Facts` ← `Secrets` ← `ReadAloud`

**Eigene Felder**

- `appearance` *long*, `personality` *long*, `species` *string*, `kind` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*, `figure` *male | female | neutral*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*
- *`Vitals`* — `hp` *number*, `hpTemp` *number*, `hitDiceLeft` *number*, `deathSuccess` *number*, `deathFail` *number*, `inspiration` *boolean*, `conditions` *link → Condition*, `nat1` *number*, `slotsUsed` *array*, `concentration` *link → Spell*, `durations` *object*, `hidden` *boolean*, `turnUsed` *action | bonus | reaction*
- *`Lore`* — `lore` *long*
- *`Facts`* — `fact` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*

**Kanten von hier**

- `worships` → Deity — „worships"
- `owes` → Creature — „owes"
- `memberOf` → Faction — „member of"
- `livesIn` → Place — „lives in"
- `discount` → Creature | Party | Faction — „discount for"
- `describedIn` → Article | Story | BookPart — „described in"
- `memberOfParty` → Party — „in the party"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `craftsWith` → Recipe | Item — „crafts with"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | Party | Faction — „regards"

**Kanten hierher**

- Statblock — `belongsTo` → „statblock of"
- GlossaryTerm — `explains` → „explained by"
- Creature — `owes` → „creditor of"
- Shop | Faction | Creature — `discount` → „discount from"
- Shop — `shopkeeper` → „keeps shop"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story | Encounter — `features` → „appears in"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Creature`): `sheet`, Reiter:
  - **Overview** — `image`, `token`, `description`, `linked` (ohne Inventory), `fields` (ohne Vitals), `prose`
  - **Combat** — `turn`, `composed`
  - **Spells** — `spells`
  - **Gear** — `inventory`
  - **Crafting** — `crafting`
  - **Campaign** — `campaign`
  - **Ties** — `standing`, `relations`

### Deity

`Deity` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Lore` ← `Secrets`

**Eigene Felder**

- `pantheon` *string*, `title` *string*, `alignment` *string*, `domains` *link → Subclass*, `symbol` *string*, `province` *string*, `plane` *string*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Creature | Faction — `worships` → „worshipped by"
- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Event

`Event` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Time` ← `Lore` ← `Secrets` ← `ReadAloud`

**Eigene Felder**

- `kind` *string*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Time`* — `sort` *number*, `display` *date*, `untilSort` *number*, `until` *date*, `duration` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `involves` → * — „involves"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Faction

`Faction` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Lore` ← `Secrets`

**Eigene Felder**

- `kind` *string*, `color` *color*, `ranks` *array*, `goal` *long*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*

**Kanten von hier**

- `worships` → Deity — „worships"
- `casts` → Spell — „casts"
- `controls` → Place — „controls"
- `discount` → Creature | Party | Faction — „discount for"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `regards` → Creature | Party | Faction — „regards"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Creature — `memberOf` → „members"
- Shop | Faction | Creature — `discount` → „discount from"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story | Encounter — `features` → „appears in"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Hazard

`Hazard` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Secrets`

**Eigene Felder**

- `kind` *trap | hazard*, `category` *MECH | MAG | WTH | ENV | WLD*, `tier` *1…20*, `threat` *setback | dangerous | deadly*, `trigger` *long*, `duration` *string*, `effect` *long*, `countermeasures` *long*, `initiative` *number*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Secrets`* — `secret` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Story | Encounter — `features` → „appears in"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Item

`Item` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Lore` ← `Secrets` ← `Facts` ← `Effects`

**Eigene Felder**

- `itemType` *adventuring gear | ammunition | artisan tools | explosive | food and drink | gaming set | instrument | tool | tack and harness | light armor | medium armor | heavy armor | shield | melee weapon | ranged weapon | potion | scroll | ring | rod | staff | wand | wondrous item | spellcasting focus | mount | vehicle | trade good | treasure | art object | gemstone | coinage | other*, `rarity` *none | common | uncommon | rare | very rare | legendary | artifact | varies | unknown*, `tier` *minor | major*, `attunement` *boolean*, `attunementNote` *string*, `charges` *0…∞*, `recharge` *dawn | dusk | midnight | shortRest | longRest | special*, `rechargeAmount` *string*, `bonusWeapon` *signed*, `bonusAc` *signed*, `bonusSpellAttack` *signed*, `bonusSave` *signed*, `appliesTo` *array*, `namePrefix` *string*, `nameSuffix` *string*, `priceAdd` *0…∞*, `priceMult` *0…∞*, `availability` *string*, `copperPrice` *number*, `priceNote` *string*, `stackSize` *number*, `weight` *number in lb*, `lightBright` *measure in ft*, `lightDim` *measure in ft*, `rows` *grid*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`Facts`* — `fact` *long*
- *`Effects`* — `effects` *array*

**Kanten von hier**

- `casts` → Spell — „casts"
- `hasProperty` → ItemProperty — „has property"
- `enchantedWith` → Item — „enhanced with"
- `describedIn` → Article | Story | BookPart — „described in"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `instanceOf` → same — „instance of"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `equips` → „equipped by"
- GlossaryTerm — `explains` → „explained by"
- Item — `enchantedWith` → „enhances"
- Shop — `sells` → „sold at"
- Inventory — `holds` → „held in"
- Session — `leftBehind` → „left behind at"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Recipe — `needs` → „used in"
- Recipe — `yields` → „made by"
- Campaign | Party | Creature — `craftsWith` → „crafted differently by"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- Statblock | Item | CraftingOrder | Map | Encounter — `instanceOf` → „instances"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Item`): `image`, `item`, `description`, `fields` (ohne Item, Weapon, Armor, Material), `linked`, `prose`, `composed`, `crafting`, `usedBy`, `standing`, `relations`

### Material

`Material` · erbt von `Item` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Lore` ← `Secrets` ← `Facts` ← `Effects`

**Eigene Felder**

- `materialType` *string*, `trades` *array*

**Geerbte Felder**

- *`Item`* — `itemType` *adventuring gear | ammunition | artisan tools | explosive | food and drink | gaming set | instrument | tool | tack and harness | light armor | medium armor | heavy armor | shield | melee weapon | ranged weapon | potion | scroll | ring | rod | staff | wand | wondrous item | spellcasting focus | mount | vehicle | trade good | treasure | art object | gemstone | coinage | other*, `rarity` *none | common | uncommon | rare | very rare | legendary | artifact | varies | unknown*, `tier` *minor | major*, `attunement` *boolean*, `attunementNote` *string*, `charges` *0…∞*, `recharge` *dawn | dusk | midnight | shortRest | longRest | special*, `rechargeAmount` *string*, `bonusWeapon` *signed*, `bonusAc` *signed*, `bonusSpellAttack` *signed*, `bonusSave` *signed*, `appliesTo` *array*, `namePrefix` *string*, `nameSuffix` *string*, `priceAdd` *0…∞*, `priceMult` *0…∞*, `availability` *string*, `copperPrice` *number*, `priceNote` *string*, `stackSize` *number*, `weight` *number in lb*, `lightBright` *measure in ft*, `lightDim` *measure in ft*, `rows` *grid*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`Facts`* — `fact` *long*
- *`Effects`* — `effects` *array*

**Kanten von hier**

- `casts` → Spell — „casts"
- `hasProperty` → ItemProperty — „has property"
- `enchantedWith` → Item — „enhanced with"
- `describedIn` → Article | Story | BookPart — „described in"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `instanceOf` → same — „instance of"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `equips` → „equipped by"
- GlossaryTerm — `explains` → „explained by"
- Item — `enchantedWith` → „enhances"
- Shop — `sells` → „sold at"
- Inventory — `holds` → „held in"
- Session — `leftBehind` → „left behind at"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Recipe — `needs` → „used in"
- Recipe — `yields` → „made by"
- Campaign | Party | Creature — `craftsWith` → „crafted differently by"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- Statblock | Item | CraftingOrder | Map | Encounter — `instanceOf` → „instances"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Item`): `image`, `item`, `description`, `fields` (ohne Item, Weapon, Armor, Material), `linked`, `prose`, `composed`, `crafting`, `usedBy`, `standing`, `relations`

### Party

`Party` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Lore` ← `Notes`

**Eigene Felder**

- `level` *number*, `motto` *string*, `day` *number*, `watch` *number*, `sinceRation` *number*, `sinceLight` *number*, `actions` *object*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Lore`* — `lore` *long*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `abilityPool` → AbilityMethod — „rolled ability pool"
- `describedIn` → Article | Story | BookPart — „described in"
- `partyOf` → Campaign — „party of"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `craftsWith` → Recipe | Item — „crafts with"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | Party | Faction — „regards"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Shop | Faction | Creature — `discount` → „discount from"
- Creature — `memberOfParty` → „members"
- Quest — `questAbout` → „concerned by"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Party`): `image`, `description`, `fields`, `inventory`, `crafting`, `relations`

### Place

`Place` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Lore` ← `ReadAloud` ← `Secrets` ← `Source`

**Eigene Felder**

- `kind` *Reich | Stadt | Distrikt | Gasse | Gebäude | Raum | Wildnis*, `environment` *string*, `state` *hidden | discovered | explored*, `arrival` *long*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Lore`* — `lore` *long*
- *`ReadAloud`* — `readaloud` *long*
- *`Secrets`* — `secret` *long*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `tableFor` → Table — „rolls on"
- `route` → Place — „leads to"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Creature — `livesIn` → „residents"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Faction — `controls` → „controlled by"
- Quest — `questAbout` → „concerned by"
- Story — `happensAt` → „scenes here"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Place — `route` → „reached from"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Place`): `image`, `description`, `fields`, `prose`, `crawl`, `table`, `relations`

### Player character

`PlayerCharacter` · erbt von `Creature` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Vars` ← `Vitals` ← `Lore` ← `Facts` ← `Secrets` ← `ReadAloud`

**Eigene Felder**

- `backstory` *long*, `level` *gerechnet*, `proficiency` *gerechnet*

**Geerbte Felder**

- *`Creature`* — `appearance` *long*, `personality` *long*, `species` *string*, `kind` *string*, `role` *string*, `attitude` *freundlich | neutral | feindlich | unbekannt*, `figure` *male | female | neutral*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*
- *`Vitals`* — `hp` *number*, `hpTemp` *number*, `hitDiceLeft` *number*, `deathSuccess` *number*, `deathFail` *number*, `inspiration` *boolean*, `conditions` *link → Condition*, `nat1` *number*, `slotsUsed` *array*, `concentration` *link → Spell*, `durations` *object*, `hidden` *boolean*, `turnUsed` *action | bonus | reaction*
- *`Lore`* — `lore` *long*
- *`Facts`* — `fact` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*

**Kanten von hier**

- `worships` → Deity — „worships"
- `casts` → Spell — „casts"
- `hasClass` → Class — „class"
- `hasAncestry` → Ancestry — „ancestry"
- `hasBackground` → Background — „background"
- `chose` → Choices — „chose"
- `owes` → Creature — „owes"
- `memberOf` → Faction — „member of"
- `livesIn` → Place — „lives in"
- `discount` → Creature | Party | Faction — „discount for"
- `describedIn` → Article | Story | BookPart — „described in"
- `memberOfParty` → Party — „in the party"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `craftsWith` → Recipe | Item — „crafts with"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"
- `crafting` → Recipe — „working on"
- `regards` → Creature | Party | Faction — „regards"

**Kanten hierher**

- Statblock — `belongsTo` → „statblock of"
- GlossaryTerm — `explains` → „explained by"
- Creature — `owes` → „creditor of"
- Shop | Faction | Creature — `discount` → „discount from"
- Shop — `shopkeeper` → „keeps shop"
- Quest — `questGiver` → „gives"
- Quest — `questAbout` → „concerned by"
- Story | Encounter — `features` → „appears in"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | Party | Faction — `regards` → „judged by"

**Gezeichnet** (aus `Creature`): `sheet`, Reiter:
  - **Overview** — `image`, `token`, `description`, `linked` (ohne Inventory), `fields` (ohne Vitals), `prose`
  - **Combat** — `turn`, `composed`
  - **Spells** — `spells`
  - **Gear** — `inventory`
  - **Crafting** — `crafting`
  - **Campaign** — `campaign`
  - **Ties** — `standing`, `relations`

### Shop

`Shop` · erbt von `Place` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Lore` ← `ReadAloud` ← `Secrets` ← `Source`

**Eigene Felder**

- `priceMod` *string*

**Geerbte Felder**

- *`Place`* — `kind` *Reich | Stadt | Distrikt | Gasse | Gebäude | Raum | Wildnis*, `environment` *string*, `state` *hidden | discovered | explored*, `arrival` *long*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Lore`* — `lore` *long*
- *`ReadAloud`* — `readaloud` *long*
- *`Secrets`* — `secret` *long*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `sells` → Item — „sells"
- `discount` → Creature | Party | Faction — „discount for"
- `shopkeeper` → Creature — „shopkeeper"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `tableFor` → Table — „rolls on"
- `route` → Place — „leads to"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Creature — `livesIn` → „residents"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Faction — `controls` → „controlled by"
- Quest — `questAbout` → „concerned by"
- Story — `happensAt` → „scenes here"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Place — `route` → „reached from"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Shop (angepasst)`): `image`, `description`, `fields`, `wares`, `prose`, `crawl`, `table`, `relations`

### Weapon

`Weapon` · erbt von `Item` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source` ← `Lore` ← `Secrets` ← `Facts` ← `Effects`

**Eigene Felder**

- `category` *simple | martial*, `damage` *string*, `damage2` *string*, `damageType` *DamageType: acid | bludgeoning | cold | fire | force | lightning | necrotic | piercing | poison | psychic | radiant | slashing | thunder*, `range` *measure in ft*, `ammoType` *link → Item*

**Geerbte Felder**

- *`Item`* — `itemType` *adventuring gear | ammunition | artisan tools | explosive | food and drink | gaming set | instrument | tool | tack and harness | light armor | medium armor | heavy armor | shield | melee weapon | ranged weapon | potion | scroll | ring | rod | staff | wand | wondrous item | spellcasting focus | mount | vehicle | trade good | treasure | art object | gemstone | coinage | other*, `rarity` *none | common | uncommon | rare | very rare | legendary | artifact | varies | unknown*, `tier` *minor | major*, `attunement` *boolean*, `attunementNote` *string*, `charges` *0…∞*, `recharge` *dawn | dusk | midnight | shortRest | longRest | special*, `rechargeAmount` *string*, `bonusWeapon` *signed*, `bonusAc` *signed*, `bonusSpellAttack` *signed*, `bonusSave` *signed*, `appliesTo` *array*, `namePrefix` *string*, `nameSuffix` *string*, `priceAdd` *0…∞*, `priceMult` *0…∞*, `availability` *string*, `copperPrice` *number*, `priceNote` *string*, `stackSize` *number*, `weight` *number in lb*, `lightBright` *measure in ft*, `lightDim` *measure in ft*, `rows` *grid*, `width` *gerechnet*, `height` *gerechnet*, `cells` *gerechnet*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`Facts`* — `fact` *long*
- *`Effects`* — `effects` *array*

**Kanten von hier**

- `casts` → Spell — „casts"
- `hasProperty` → ItemProperty — „has property"
- `enchantedWith` → Item — „enhanced with"
- `describedIn` → Article | Story | BookPart — „described in"
- `carries` → Inventory — „carries"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `instanceOf` → same — „instance of"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `equips` → „equipped by"
- GlossaryTerm — `explains` → „explained by"
- Item — `enchantedWith` → „enhances"
- Shop — `sells` → „sold at"
- Inventory — `holds` → „held in"
- Session — `leftBehind` → „left behind at"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Recipe — `needs` → „used in"
- Recipe — `yields` → „made by"
- Campaign | Party | Creature — `craftsWith` → „crafted differently by"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- Statblock | Item | CraftingOrder | Map | Encounter — `instanceOf` → „instances"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Item`): `image`, `item`, `description`, `fields` (ohne Item, Weapon, Armor, Material), `linked`, `prose`, `composed`, `crafting`, `usedBy`, `standing`, `relations`

### World

`World` · erbt von `Identity` ← `Prose` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Lore` ← `Notes`

**Eigene Felder**

- `calendar` *string*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Lore`* — `lore` *long*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `inWorld` → „campaigns"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

---

## story

6 Arten.

### Arc

`Arc` · erbt von `Story` ← `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Todos` ← `Time` ← `Lore` ← `Secrets` ← `ReadAloud` ← `Notes`

**Eigene Felder**

- `levelFrom` *1…20*, `levelTo` *1…20*, `hook` *long*, `outcome` *long*

**Geerbte Felder**

- *`Story`* — `kind` *string*, `played` *string*, `summary` *long*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Todos`* — `items` *array*
- *`Time`* — `sort` *number*, `display` *date*, `untilSort` *number*, `until` *date*, `duration` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `happensAt` → Place — „happens at"
- `features` → Creature | Statblock | Faction | Hazard — „features"
- `knowledge` → Information — „knowledge about it"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Chapter — `chapterOf` → „read as chapter"
- * — `describedIn` → „describes"
- Quest — `questAbout` → „concerned by"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Campaign

`Campaign` · erbt von `Story` ← `VisibilityRules` ← `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Todos` ← `Time` ← `Lore` ← `Secrets` ← `ReadAloud` ← `Notes`

**Eigene Felder**

- `compareFor` *gm | players*, `languages` *Language articles*, `feats` *boolean*, `hitPoints` *either | average | roll*, `inventory` *grid | weight | slots*, `itemPricing` *combined | base | none*, `enhancementsBy` *gm | players*, `stowing` *anytime | bySessionEnd | immediately*, `craftFailure` *noProgress | progressLost | materialsLost | halfLost | nothingLost | custom*, `craftCritSuccess` *asSuccess | double*, `craftCritFailure` *asFailure | progressLost | materialsLost*, `craftConfirm` *gm | player*, `craftLearning` *all | taught | rarity*, `craftLearnRarity` *none | common | uncommon | rare | very rare | legendary*, `playerRolls` *table | gm*, `ruleGraphs` *off | on*, `combat` *on | off*, `initNames` *cover | real*, `initHealth` *none | coarse | exact*, `initEffects` *all | party | none*, `initActions` *hidden | shown*, `initColumns` *init | ac | hp | effects | actions*, `initQuickActions` *damage | heal | effect | delay | reroll | remove*, `fog` *party | player*, `moves` *free | confirm*, `tokenMove` *none | own | party | allies | all*, `revealOnMove` *boolean*, `doors` *players | gm*, `tokenSizes` *rules | tinyHalf*, `mapTools` *object*

**Geerbte Felder**

- *`Story`* — `kind` *string*, `played` *string*, `summary` *long*
- *`VisibilityRules`* — `visibilityRules` *array*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Todos`* — `items` *array*
- *`Time`* — `sort` *number*, `display` *date*, `untilSort` *number*, `until` *date*, `duration` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `allowsMethod` → AbilityMethod — „allows ability method"
- `allowsSubstitution` → Substitution — „allows substitution"
- `allowsEquipment` → EquipmentMethod — „allows equipment method"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `happensAt` → Place — „happens at"
- `features` → Creature | Statblock | Faction | Hazard — „features"
- `knowledge` → Information — „knowledge about it"
- `craftsWith` → Recipe | Item — „crafts with"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `inWorld` → World — „in the world"
- `activates` → Layer — „Layers in play"
- `layerRule` → Layer — „Type rule for"
- `enables` → * — „Extra content"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Chapter — `chapterOf` → „read as chapter"
- * — `describedIn` → „describes"
- Party — `partyOf` → „parties"
- Quest — `questAbout` → „concerned by"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Campaign`): `description`, `rules`, `fields`, `stack`, `members`, `quests`, `timeline`, `prep`, `prose`, `relations`

### Quest

`Quest` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Todos` ← `Time` ← `Lore` ← `Secrets`

**Eigene Felder**

- `progress` *rumoured | offered | accepted | done | failed | abandoned*, `reward` *string*, `deadline` *string*, `restriction` *string*, `tasks` *array*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Todos`* — `items` *array*
- *`Time`* — `sort` *number*, `display` *date*, `untilSort` *number*, `until` *date*, `duration` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `questGiver` → Creature | Faction — „given by"
- `questAbout` → * — „concerns"
- `knowledge` → Information — „knowledge about it"
- `loot` → Item | Information | Feat | Skill — „loot"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Quest`): `quests`, `description`, `fields` (ohne Quest.tasks), `prose`, `relations`

### Scene / Encounter

`Scene` · erbt von `Story` ← `Tactics` ← `Difficulty` ← `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Todos` ← `Time` ← `Lore` ← `Secrets` ← `ReadAloud` ← `Notes`

**Eigene Felder**

- `mode` *roleplay | encounter | exploration | downtime*

**Geerbte Felder**

- *`Story`* — `kind` *string*, `played` *string*, `summary` *long*
- *`Tactics`* — `tactics` *long*
- *`Difficulty`* — `difficulty` *1…20*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Todos`* — `items` *array*
- *`Time`* — `sort` *number*, `display` *date*, `untilSort` *number*, `until` *date*, `duration` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `happensAt` → Place — „happens at"
- `features` → Creature | Statblock | Faction | Hazard — „features"
- `knowledge` → Information — „knowledge about it"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Chapter — `chapterOf` → „read as chapter"
- * — `describedIn` → „describes"
- Quest — `questAbout` → „concerned by"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Session

`Session` · erbt von `Story` ← `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Todos` ← `Time` ← `Lore` ← `Secrets` ← `ReadAloud` ← `Notes`

**Eigene Felder**

- `activeScene` *link → Scene*, `activeEncounter` *link → Encounter*, `activeMap` *link → Map*, `mapNavigation` *boolean*, `nowPlaying` *string*, `moves` *array*, `log` *array*, `partyNote` *long*, `stewardship` *gm | table*

**Geerbte Felder**

- *`Story`* — `kind` *string*, `played` *string*, `summary` *long*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Todos`* — `items` *array*
- *`Time`* — `sort` *number*, `display` *date*, `untilSort` *number*, `until` *date*, `duration` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `leftBehind` → Item — „left behind"
- `happensAt` → Place — „happens at"
- `features` → Creature | Statblock | Faction | Hazard — „features"
- `knowledge` → Information — „knowledge about it"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Chapter — `chapterOf` → „read as chapter"
- * — `describedIn` → „describes"
- Quest — `questAbout` → „concerned by"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Session`): `live`, `prep`, `description`, `fields`, `prose`, `relations`

### Story

`Story` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Todos` ← `Time` ← `Lore` ← `Secrets` ← `ReadAloud` ← `Notes`

**Eigene Felder**

- `kind` *string*, `played` *string*, `summary` *long*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Todos`* — `items` *array*
- *`Time`* — `sort` *number*, `display` *date*, `untilSort` *number*, `until` *date*, `duration` *string*
- *`Lore`* — `lore` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `happensAt` → Place — „happens at"
- `features` → Creature | Statblock | Faction | Hazard — „features"
- `knowledge` → Information — „knowledge about it"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Chapter — `chapterOf` → „read as chapter"
- * — `describedIn` → „describes"
- Quest — `questAbout` → „concerned by"
- Map — `mapOf` → „maps"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

---

## Rules

*Woran man sich hält.* — 28 Arten.

### Ability score method

`AbilityMethod` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `method` **Pflicht** *array | pointBuy | roll*, `scores` *array*, `budget` *0…∞*, `costs` *object*, `dice` *string*, `count` *1…12*, `scope` *character | party*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- Campaign — `allowsMethod` → „allowed in"
- GlossaryTerm — `explains` → „explained by"
- Party — `abilityPool` → „pool of"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Action

`Action` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `actionType` **Pflicht** *link → ActionType*, `recharge` *string*, `uses` *string*, `attack` *melee weapon | ranged weapon | melee spell | ranged spell*, `ability` *str | dex | con | int | wis | cha | finesse | spell*, `toHitBonus` *signed*, `reach` *number in ft*, `range` *measure in ft*, `target` *string*, `damageDice` *string*, `damageBonus` *signed*, `damageType` *DamageType: acid | bludgeoning | cold | fire | force | lightning | necrotic | piercing | poison | psychic | radiant | slashing | thunder*, `extraDamageDice` *string*, `extraDamageType` *DamageType: acid | bludgeoning | cold | fire | force | lightning | necrotic | piercing | poison | psychic | radiant | slashing | thunder*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Action type

`ActionType` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `per` *turn | round*, `count` *1…∞*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Ancestry

`Ancestry` · erbt von `Rule` ← `Proficiencies` ← `Choices` ← `Lore` ← `Image` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `size` *Size: tiny | small | medium | large | huge | gargantuan*, `speed` *measure in ft*, `abilityBonus` *object*, `abilityNote` *string*, `age` *string*, `darkvision` *number in ft*, `creatureType` *string*, `resistances` *DamageType: acid | bludgeoning | cold | fire | force | lightning | necrotic | piercing | poison | psychic | radiant | slashing | thunder*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Proficiencies`* — `proficient` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `expertise` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `saves` *Ability: str | dex | con | int | wis | cha*
- *`Choices`* — `choices` *array*
- *`Lore`* — `lore` *long*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `subraceOf` → Ancestry — „subrace of"
- `grants` → Rule — „grants"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- Ancestry — `subraceOf` → „subraces"
- PlayerCharacter — `hasAncestry` → „ancestry of"
- GlossaryTerm — `explains` → „explained by"
- PlayerCharacter — `chose` → „chosen by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Ancestry (angepasst)`): `image`, `description`, `originOverview`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Background

`Background` · erbt von `Rule` ← `Proficiencies` ← `Choices` ← `Lore` ← `Image` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `startingEquipment` *long*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Proficiencies`* — `proficient` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `expertise` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `saves` *Ability: str | dex | con | int | wis | cha*
- *`Choices`* — `choices` *array*
- *`Lore`* — `lore` *long*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `grants` → Rule — „grants"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- PlayerCharacter — `hasBackground` → „background of"
- GlossaryTerm — `explains` → „explained by"
- PlayerCharacter — `chose` → „chosen by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Background (angepasst)`): `image`, `description`, `originOverview`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Class

`Class` · erbt von `Rule` ← `Proficiencies` ← `Choices` ← `Lore` ← `Image` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `hitDie` *4…12*, `primaryAbility` *Ability: str | dex | con | int | wis | cha*, `startingEquipment` *long*, `startingGold` *string*, `multiclassRequirement` *string*, `multiclassProficient` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `subclassTitle` *string*, `casterProgression` *full | half | third | pact | artificer*, `spellAbility` *Ability: str | dex | con | int | wis | cha*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Proficiencies`* — `proficient` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `expertise` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `saves` *Ability: str | dex | con | int | wis | cha*
- *`Choices`* — `choices` *array*
- *`Lore`* — `lore` *long*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `spellList` → Spell — „spell list"
- `grants` → Rule — „grants"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- Subclass — `subclassOf` → „subclasses"
- PlayerCharacter — `hasClass` → „taken by"
- GlossaryTerm — `explains` → „explained by"
- PlayerCharacter — `chose` → „chosen by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Class (angepasst)`): `image`, `description`, `classOverview`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Condition

`Condition` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `kind` *condition | status*, `stage` *1…∞*, `recovery` *none | shortRest | longRest | longRestStep | save | special*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `stageOf` → Condition — „stage of"
- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Condition — `stageOf` → „has stages"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Disease

`Disease` · erbt von `Condition` ← `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `kind` *string*, `save` *Ability: str | dex | con | int | wis | cha*, `dc` *1…30*, `incubation` *string*, `transmission` *string*

**Geerbte Felder**

- *`Condition`* — `kind` *condition | status*, `stage` *1…∞*, `recovery` *none | shortRest | longRest | longRestStep | save | special*
- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `stageOf` → Condition — „stage of"
- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Condition — `stageOf` → „has stages"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Starting equipment method

`EquipmentMethod` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `method` **Pflicht** *rules | gold | free*, `gold` *string*, `budget` *0…∞*, `magic` *object*, `itemTypes` *Item.itemType*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Campaign — `allowsEquipment` → „allowed in"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Feat

`Feat` · erbt von `Rule` ← `Choices` ← `Effects` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `prerequisite` *string*, `repeatable` *boolean*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Choices`* — `choices` *array*
- *`Effects`* — `effects` *array*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `grants` → Rule — „grants"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- PlayerCharacter — `chose` → „chosen by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Feature

`Feature` · erbt von `Rule` ← `Choices` ← `Effects` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `featureType` *string*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Choices`* — `choices` *array*
- *`Effects`* — `effects` *array*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- PlayerCharacter — `chose` → „chosen by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Glossary term

`GlossaryTerm` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `sort` *app | rule | condition | property | action | other*, `effect` *long*, `example` *long*, `translations` *array*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `explains` → * — „explains"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Information

`Information` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Secrets` ← `Facts`

**Eigene Felder**

- `fields` *array*, `applies` *object*, `tier` *open | rumour | secret*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Secrets`* — `secret` *long*
- *`Facts`* — `fact` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `knownBy` → Creature | Party | Faction | Ancestry | Background | Class | Subclass | Feat — „known by"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- * — `knowledge` → „about"
- Knowledge — `includes` → „part of"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Inventory

`Inventory` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Notes`

**Eigene Felder**

- `capacity` *number*, `copper` *number*, `grid` *grid*, `zones` *DrawTime: free action | bonus action | action | turn | round*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `holds` → Item — „holds"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Creature | Party | Item — `carries` → „carried by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Inventory`): `inventory`, `description`, `fields` (ohne Inventory.copper), `relations`

### Item property

`ItemProperty` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `abbreviation` *string*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Weapon | Item | Armor — `hasProperty` → „property of"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Knowledge

`Knowledge` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags`

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `knownBy` → Creature | Party | Faction | Ancestry | Background | Class | Subclass | Feat — „known by"
- `includes` → Information — „includes"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Knowledge (angepasst)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`, `knowledgeContents`

### Language

`Language` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `languageType` *standard | exotic | rare | secret*, `script` *string*, `typicalSpeakers` *string*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Material group

`MaterialGroup` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `materialTypes` *array*, `rarityMin` *Item.rarity*, `rarityMax` *Item.rarity*, `tags` *array*, `items` *Item articles*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Recipe — `needs` → „used in"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Recipe

`Recipe` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Notes` ← `Secrets` ← `Lore`

**Eigene Felder**

- `trade` *Trade articles*, `tool` *Item articles*, `ability` *Ability: str | dex | con | int | wis | cha*, `dc` *number*, `time` *string*, `days` *number*, `checks` *1…∞*, `yieldCount` *number*, `onFailure` *string*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Notes`* — `note` *long*
- *`Secrets`* — `secret` *long*
- *`Lore`* — `lore` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `needs` → Item | MaterialGroup — „needs"
- `yields` → Item — „yields"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Campaign | Party | Creature — `craftsWith` → „crafted differently by"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | PlayerCharacter | Party — `crafting` → „worked on by"

**Gezeichnet** (aus `Recipe`): `crafting`, `description`, `fields`, `prose`, `relations`

### Rule Element

`Rule` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Skill

`Skill` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `ability` *Ability: str | dex | con | int | wis | cha*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter | Story | Quest — `loot` → „found in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Spell

`Spell` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `level` *0…9*, `school` *abjuration | conjuration | divination | enchantment | evocation | illusion | necromancy | transmutation*, `castingTime` *1…∞*, `castingAction` *link → ActionType*, `castingUnit` *minute | hour*, `castingCondition` *string*, `rangeKind` *point | touch | self | sight | unlimited | special | radius | sphere | cone | line | cube | cylinder | hemisphere | emanation*, `range` *number in ft*, `components` *v | s | m*, `material` *string*, `materialCost` *0…∞*, `materialConsumed` *boolean*, `duration` *instant | timed | permanent | special*, `durationAmount` *1…∞*, `durationUnit` *round | minute | hour | day*, `concentration` *boolean*, `ritual` *boolean*, `higherLevels` *long*, `save` *Ability: str | dex | con | int | wis | cha*, `attack` *melee | ranged*, `damageTypes` *DamageType: acid | bludgeoning | cold | fire | force | lightning | necrotic | piercing | poison | psychic | radiant | slashing | thunder*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- Statblock | PlayerCharacter | Item | Subclass | Ancestry | Feat | Faction | Rule — `casts` → „cast by"
- Class | Subclass — `spellList` → „on the spell list of"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Spell`): `spell`, `fields` (ohne Spell), `prose` (ohne Prose.paragraph), `composed`, `usedBy`, `relations`

### Statblock

`Statblock` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Abilities` ← `Proficiencies` ← `Vars` ← `Tactics` ← `Lore` ← `Image`

**Eigene Felder**

- `system` *string*, `size` *Size: tiny | small | medium | large | huge | gargantuan*, `creatureType` *string*, `alignment` *string*, `ac` *number*, `acNote` *string*, `hp` *number*, `hpFormula` *string*, `speed` *measure in ft*, `cr` *string*, `prof` *number*, `carryExtra` *gerechnet*, `combatRole` *string*, `senses` *string*, `languageNote` *string*, `resistances` *string*, `vulnerabilities` *string*, `immunities` *string*, `conditionImmunities` *link → Condition*, `legendaryActions` *1…∞*, `bonuses` *object*, `token` *asset*, `spellAbility` *Ability: str | dex | con | int | wis | cha*, `casterLevel` *1…20*, `spellSlots` *array*, `spellDc` *gerechnet*, `spellAttack` *gerechnet*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Abilities`* — `str` *number*, `strMod` *gerechnet*, `dex` *number*, `dexMod` *gerechnet*, `con` *number*, `conMod` *gerechnet*, `int` *number*, `intMod` *gerechnet*, `wis` *number*, `wisMod` *gerechnet*, `cha` *number*, `chaMod` *gerechnet*, `initiative` *gerechnet*, `passivePerception` *gerechnet*
- *`Proficiencies`* — `proficient` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `expertise` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `saves` *Ability: str | dex | con | int | wis | cha*
- *`Vars`* — `bindings` *object*
- *`Tactics`* — `tactics` *long*
- *`Lore`* — `lore` *long*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*

**Kanten von hier**

- `composedOf` → Rule — „composed of"
- `belongsTo` → Creature — „belongs to"
- `casts` → Spell — „casts"
- `equips` → Item — „equips"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `instanceOf` → same — „instance of"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Story | Encounter — `features` → „appears in"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter — `participates` → „fights in"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- Statblock | Item | CraftingOrder | Map | Encounter — `instanceOf` → „instances"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Statblock`): `image`, `token`, `statblock`, `fields` (ohne Statblock, Abilities, Proficiencies), `prose`, `usedBy`, `relations`

### Subclass

`Subclass` · erbt von `Rule` ← `Proficiencies` ← `Choices` ← `Lore` ← `Image` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `shortName` *string*, `casterProgression` *full | half | third | pact | artificer*, `spellAbility` *Ability: str | dex | con | int | wis | cha*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Proficiencies`* — `proficient` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `expertise` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `saves` *Ability: str | dex | con | int | wis | cha*
- *`Choices`* — `choices` *array*
- *`Lore`* — `lore` *long*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `spellList` → Spell — „spell list"
- `subclassOf` → Class — „subclass of"
- `grants` → Rule — „grants"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- PlayerCharacter — `chose` → „chosen by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Information | Knowledge — `knownBy` → „knows"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Material substitution

`Substitution` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `replaces` *array*, `with` *array*, `withTags` *array*, `rarity` *same | atLeast | any*, `ratio` *1…∞*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- Campaign — `allowsSubstitution` → „allowed in"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Table

`Table` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Notes` ← `Secrets`

**Eigene Felder**

- `kind` *loot | encounter | name | shop | event | generic | deck*, `die` *string*, `columns` *array*, `rows` *array*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Notes`* — `note` *long*
- *`Secrets`* — `secret` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `entry` → * — „entry"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Place | Story | Encounter | Class | Subclass | Ancestry | Background — `tableFor` → „used at"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Table`): `table`, `description`, `fields` (ohne Table.rows), `prose`

### Trade

`Trade` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `tools` *Item articles*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Trade (angepasst)`): `image`, `description`, `crafting`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Zone kind

`ZoneKind` · erbt von `Rule` ← `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Vars`

**Eigene Felder**

- `moveCost` *1…10*, `light` *bright | dim | dark*, `obscured` *none | light | heavy*, `hiddenUntil` *1…30*, `damage` *string*, `damageType` *string*, `save` *Ability: str | dex | con | int | wis | cha*, `saveDC` *1…30*, `condition` *link → Condition*, `trigger` *enter | start | end*

**Geerbte Felder**

- *`Rule`* — `kind` *RuleKind: rule | travel | sense | reward | boon | option | upgrade | facility | card | system*, `autolink` *boolean*, `key` *string*, `graph` *object*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Vars`* — `bindings` *object*

**Kanten von hier**

- `affects` → Rule — „affects"
- `casts` → Spell — „casts"
- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- Statblock — `composedOf` → „used in"
- Rule — `affects` → „affected by"
- GlossaryTerm — `explains` → „explained by"
- Class | Subclass | Ancestry | Background | Feat — `grants` → „granted by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `zone` → „lies on"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

---

## Play

*Worauf man während der Sitzung schaut.* — 4 Arten.

### Board

`Board` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Notes`

**Eigene Felder**

- `width` *number*, `height` *number*, `snap` *number*, `background` *asset*, `rules` *object*, `shapes` *array*, `anchors` *array*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `placed` → * — „on the board"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Board`): `board`, `fields` (ohne Board.shapes, Board.anchors)

### Crafting order

`CraftingOrder` · erbt von `Recipe` ← `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Notes` ← `Secrets` ← `Lore`

**Eigene Felder**

- `progress` *0…∞*, `outcome` *open | succeeded | failed | aborted*, `started` *string*, `checks` *array*

**Geerbte Felder**

- *`Recipe`* — `trade` *Trade articles*, `tool` *Item articles*, `ability` *Ability: str | dex | con | int | wis | cha*, `dc` *number*, `time` *string*, `days` *number*, `checks` *1…∞*, `yieldCount` *number*, `onFailure` *string*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Notes`* — `note` *long*
- *`Secrets`* — `secret` *long*
- *`Lore`* — `lore` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `needs` → Item | MaterialGroup — „needs"
- `yields` → Item — „yields"
- `inLayer` → Layer — „from"
- `instanceOf` → same — „instance of"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Campaign | Party | Creature — `craftsWith` → „crafted differently by"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- Statblock | Item | CraftingOrder | Map | Encounter — `instanceOf` → „instances"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"
- Creature | PlayerCharacter | Party — `crafting` → „worked on by"

**Gezeichnet** (aus `CraftingOrder`): `crafting`, `fields`, `prose`, `relations`

### Encounter

`Encounter` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Todos` ← `Tactics` ← `ReadAloud` ← `Notes` ← `Secrets` ← `Difficulty` ← `Played`

**Eigene Felder**

- `kind` *EncounterKind: combat | social | puzzle | exploration | hazard | trap | resource | story*, `xpBudget` *number*, `phase` *planned | running | done | skipped*, `round` *number*, `turn` *number*, `surprise` *string*, `solution` *long*, `hint` *long*, `goal` *long*, `check` *string*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Todos`* — `items` *array*
- *`Tactics`* — `tactics` *long*
- *`ReadAloud`* — `readaloud` *long*
- *`Notes`* — `note` *long*
- *`Secrets`* — `secret` *long*
- *`Difficulty`* — `difficulty` *1…20*
- *`Played`* — `playedAt` *string*, `playedIn` *link → Session*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `features` → Creature | Statblock | Faction | Hazard — „features"
- `knowledge` → Information — „knowledge about it"
- `participates` → Creature | Statblock | Party — „in the fight"
- `onMap` → Map — „fought on"
- `loot` → Item | Information | Feat | Skill — „loot"
- `tableFor` → Table — „rolls on"
- `inLayer` → Layer — „from"
- `instanceOf` → same — „instance of"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- Statblock | Item | CraftingOrder | Map | Encounter — `instanceOf` → „instances"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Encounter`): `initiative`, `description`, `prose`, `fields`, `prose`, `fields`, `fields`, `fields`, `prose`

### Map

`Map` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Notes` ← `Secrets` ← `ReadAloud` ← `Played`

**Eigene Felder**

- `sheets` *array*, `floors` *array*, `floorReveal` *object*, `floorReleased` *object*, `baseHidden` *boolean*, `baseGmOnly` *boolean*, `kind` *world | region | settlement | district | building | battle*, `gridShape` *none | square | hex*, `gridSize` *number*, `gridOffsetX` *number*, `gridOffsetY` *number*, `gridColor` *color*, `gridOpacity` *0…1*, `gridHidden` *boolean*, `snapTokens` *boolean*, `scale` *measure in m*, `lighting` *bright | dim | dark*, `fog` *boolean*, `released` *boolean*, `reveal` *array*, `revealOnMove` *boolean*, `walls` *array*, `tiles` *string*, `tileCols` *number*, `tileRows` *number*, `tileSize` *number*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Notes`* — `note` *long*
- *`Secrets`* — `secret` *long*
- *`ReadAloud`* — `readaloud` *long*
- *`Played`* — `playedAt` *string*, `playedIn` *link → Session*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `mapOf` → Place | Story — „map of"
- `insideMap` → Map — „inside"
- `marker` → * — „marker"
- `zone` → ZoneKind — „zone"
- `territory` → * — „territory"
- `inLayer` → Layer — „from"
- `instanceOf` → same — „instance of"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `insideMap` → „zoom into"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Encounter | Story — `onMap` → „fights here"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- Statblock | Item | CraftingOrder | Map | Encounter — `instanceOf` → „instances"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Map`): `map`, `description`, `fields`

---

## Ohne Bereich

*Abstrakte Oberbegriffe — sie tragen keine Artikel.* — 33 Arten.

### Abilities — *abstrakt*

`Abilities`

**Eigene Felder**

- `str` *number*, `strMod` *gerechnet*, `dex` *number*, `dexMod` *gerechnet*, `con` *number*, `conMod` *gerechnet*, `int` *number*, `intMod` *gerechnet*, `wis` *number*, `wisMod` *gerechnet*, `cha` *number*, `chaMod` *gerechnet*, `initiative` *gerechnet*, `passivePerception` *gerechnet*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Asset

`Asset` · erbt von `Identity` ← `Prose` ← `Notes` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Image` ← `Source`

**Eigene Felder**

- `backend` *app | nas | external*, `ref` **Pflicht** *string*, `kind` *image | map | token | prop*, `mime` *string*, `width` *number*, `height` *number*, `bytes` *number*, `round` *boolean*, `frame` *object*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Notes`* — `note` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Image`* — `image` *asset*, `caption` *string*, `alt` *string*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Book part — *abstrakt*

`BookPart` · erbt von `Identity` ← `Visibility` ← `Tags` ← `Source` ← `Notes`

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- * — `describedIn` → „describes"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Chapter

`Chapter` · erbt von `Identity` ← `Prose` ← `Description` ← `Visibility` ← `Tags` ← `Source` ← `Notes`

**Eigene Felder**

- `ordinal` *string*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `chapterOf` → Story — „chapter of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Choices — *abstrakt*

`Choices`

**Eigene Felder**

- `choices` *array*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- PlayerCharacter — `chose` → „chosen by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Description — *abstrakt*

`Description`

**Eigene Felder**

- `description` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Difficulty — *abstrakt*

`Difficulty`

**Eigene Felder**

- `difficulty` *1…20*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Effects — *abstrakt*

`Effects`

**Eigene Felder**

- `effects` *array*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Embedded article

`Embed` · erbt von `BookPart` ← `Identity` ← `Visibility` ← `Tags` ← `Source` ← `Notes`

**Eigene Felder**

- `target` **Pflicht** *link → Identity*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- * — `describedIn` → „describes"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Facts — *abstrakt*

`Facts`

**Eigene Felder**

- `fact` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Heading

`Heading` · erbt von `BookPart` ← `Identity` ← `Visibility` ← `Tags` ← `Source` ← `Notes`

**Eigene Felder**

- `level` *1…6*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- * — `describedIn` → „describes"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Identity — *abstrakt*

`Identity`

**Eigene Felder**

- `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Image — *abstrakt*

`Image`

**Eigene Felder**

- `image` *asset*, `caption` *string*, `alt` *string*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Layer

`Layer` · erbt von `Identity` ← `Prose` ← `Status` ← `Description` ← `Visibility` ← `Tags` ← `Notes`

**Eigene Felder**

- `kind` *system | expansion | book | adventure | world | pack | campaign | player | test | overrides | group*, `order` *number*, `abbreviation` *string*, `published` *string*, `author` *string*, `version` *string*, `levels` *string*, `storyline` *string*, `groupBy` *category | publisher*, `defaultAudience` *Audience: public | campaign | players | gm*

**Geerbte Felder**

- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Prose`* — `paragraph` *long*
- *`Status`* — `status` *State: idea | prepared | ready*
- *`Description`* — `description` *long*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Place | Story | Quest | Event | Board | Encounter | Layer | Chapter | BookPart | Rule — `partOf` → „contains"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- * — `inLayer` → „brings"
- Campaign — `activates` → „In play in"
- Campaign — `layerRule` → „Type rule in"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `Layer (angepasst)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`, `contents`, `reader`

### Lore — *abstrakt*

`Lore`

**Eigene Felder**

- `lore` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Notes — *abstrakt*

`Notes`

**Eigene Felder**

- `note` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Paragraph

`Paragraph` · erbt von `BookPart` ← `Prose` ← `Identity` ← `Visibility` ← `Tags` ← `Source` ← `Notes`

**Eigene Felder**

- `kind` *text | list | table | sidebar | quote*

**Geerbte Felder**

- *`Prose`* — `paragraph` *long*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- * — `describedIn` → „describes"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Played — *abstrakt*

`Played`

**Eigene Felder**

- `playedAt` *string*, `playedIn` *link → Session*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Proficiencies — *abstrakt*

`Proficiencies`

**Eigene Felder**

- `proficient` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `expertise` *Skill articles + Language articles + Item articles + Weapon articles + Weapon.category + Armor.armorType*, `saves` *Ability: str | dex | con | int | wis | cha*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Text — *abstrakt*

`Prose`

**Eigene Felder**

- `paragraph` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Read aloud — *abstrakt*

`ReadAloud`

**Eigene Felder**

- `readaloud` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Read-aloud text

`ReadAloudText` · erbt von `BookPart` ← `ReadAloud` ← `Identity` ← `Visibility` ← `Tags` ← `Source` ← `Notes`

**Geerbte Felder**

- *`ReadAloud`* — `readaloud` *long*
- *`Identity`* — `name` **Pflicht** *string*, `id` **Pflicht** *string*, `aliases` *array*, `cover` *string*
- *`Visibility`* — `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*
- *`Tags`* — `tags` *tags*
- *`Source`* — `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*
- *`Notes`* — `note` *long*

**Kanten von hier**

- `partOf` → Place | Story | Event | Layer | Chapter | Rule — „part of"
- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- * — `describedIn` → „describes"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Secrets — *abstrakt*

`Secrets`

**Eigene Felder**

- `secret` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Source — *abstrakt*

`Source`

**Eigene Felder**

- `publication` *string*, `page` *string*, `anchor` *string*, `url` *string*, `srd` *boolean*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Status — *abstrakt*

`Status`

**Eigene Felder**

- `status` *State: idea | prepared | ready*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Tactics — *abstrakt*

`Tactics`

**Eigene Felder**

- `tactics` *long*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Tags — *abstrakt*

`Tags`

**Eigene Felder**

- `tags` *tags*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Time — *abstrakt*

`Time`

**Eigene Felder**

- `sort` *number*, `display` *date*, `untilSort` *number*, `until` *date*, `duration` *string*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Todos — *abstrakt*

`Todos`

**Eigene Felder**

- `items` *array*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Variables — *abstrakt*

`Vars`

**Eigene Felder**

- `bindings` *object*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Visibility — *abstrakt*

`Visibility`

**Eigene Felder**

- `audience` *Audience: public | campaign | players | gm*, `revealedTo` *link → Creature | Party | Faction*, `hiddenFrom` *link → Creature | Party | Faction*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Visibility by group — *abstrakt*

`VisibilityRules`

**Eigene Felder**

- `visibilityRules` *array*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`

### Vitals — *abstrakt*

`Vitals`

**Eigene Felder**

- `hp` *number*, `hpTemp` *number*, `hitDiceLeft` *number*, `deathSuccess` *number*, `deathFail` *number*, `inspiration` *boolean*, `conditions` *link → Condition*, `nat1` *number*, `slotsUsed` *array*, `concentration` *link → Spell*, `durations` *object*, `hidden` *boolean*, `turnUsed` *action | bonus | reaction*

**Kanten von hier**

- `describedIn` → Article | Story | BookPart — „described in"
- `knowledge` → Information — „knowledge about it"
- `inLayer` → Layer — „from"
- `variantOf` → * — „variant of"
- `overrides` → * — „replaces"

**Kanten hierher**

- GlossaryTerm — `explains` → „explained by"
- Quest — `questAbout` → „concerned by"
- Map — `marker` → „on the map"
- Map — `territory` → „holds ground on"
- Board — `placed` → „lies on"
- Event — `involves` → „took part in"
- Table — `entry` → „rolled on"
- Campaign — `enables` → „Enabled in"
- * — `variantOf` → „has variants"
- * — `overrides` → „replaced by"

**Gezeichnet** (aus `(Vorgabe)`): `image`, `description`, `fields`, `linked`, `prose`, `parts`, `composed`, `usedBy`, `standing`, `relations`


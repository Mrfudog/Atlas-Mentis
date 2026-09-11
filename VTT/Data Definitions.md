---
tags: [vtt, data, registry]
status: living
version: 0.7
updated: 2026-09-05
supersedes: 30_Data_Architecture §2 (vocabulary), §5 (compositions); 32_Data_Definitions v0.3; v0.4 §0/§7 (entity_type/props-bag model → compound model)
---

# Data Definitions Registry

Single source of truth for every defined data element. Extend this file whenever a new entity, property type, relation, composition, projection, engine or event is introduced; record it in [[#10. Changelog]]. Origin column: **M** = named in the requirements sessions, **A** = added because a web platform needs it. Mechanisms and rationale: [[Backbone Concept]]. Terms: [[Glossary]].

Jump: [[#0a. Compound model]] · [[#0. Terminology]] · [[#1. Property Types]] · [[#2. Relation Types]] · [[#3. Entity Types]] · [[#4. Compositions (aggregates)]] · [[#5. Projections (read models)]] · [[#5a. Renderers & display]] · [[#6. Engines and Events]] · [[#7. Storage model]] · [[#8. Open questions]] · [[#9. Still to define]] · [[#10. Changelog]]

## 0a. Compound model (decided 2026-09-02)

The storage model of v0.4 (typed `entity` rows with a JSONB props bag per entity type) is superseded by the **compound model** — same concepts, finer grain:

- **Entity = peg.** A bare row with an immutable ID and nothing else. Every fact is a **component** ("card") hung on the peg — one per component type, absent when not needed. Connections are **relations** ("strings") with a type and optional properties.
- **The registry is data, not code.** `component_def` (one row per card label: name, optional `engine` documentation, JSON Schema), `interface` (one row per kind of thing: `extends`, `requires`, `allows`, `block_types`, allowed relations), `relation_def` (the few global strings any peg may have), `projection_def`, `renderer_def`, `event_def`. Extending the system = inserting rows; no migration.
- **`Typed` card asserts interface membership** (D5, proposal); Validation reads it and checks: required cards present, only allowed cards, each payload valid against its schema, strings go to permitted targets. Whether `allows` is strict or open per layer is D2 (open; leading: strict + `expertMode` per layer + `universal` per component).
- **Statblock is an entity again** (D4): shareable, versionable, layerable; `hasStatblock` string from Creature, mechanics card on the statblock peg, rule elements via `composedOf`. The earlier flattening was an error and is reversed.
- **Entry carries `pinned: true`** instead of a version id (D6): unpinned = "this peg and whatever succeeds it", pinned = "exactly this peg". Resolution: collect the peg and its successors; the peg whose best Entry has the highest layer priority wins; tie within one layer → newest successor. Direct placement into a higher-priority layer replaces pin mechanics; per-entity priority is ruled out; bulk-placing a layer's content is a UI operation writing ordinary Entries. Override vs successor is a user choice at write time.
- **IDs stay opaque** (D15, REQ-163): no pack/type/version in the identifier; provenance via `source_pack` / `source_version` metadata; copying only as explicit fork (`forkedFrom`).

Full schemas (all components, 40 interfaces, projections, events, decisions D0–D10): [[Schemas]]. The v0.4 sections below remain the content inventory (which components, relations, interfaces, projections exist); read their storage vocabulary through this section.

## 0. Terminology

| Term | Definition | Pattern equivalent |
|---|---|---|
| **Tier** | Architecture stratum: data · composition · engine · view. | — |
| **Entity** | Bare peg: immutable ID only; every fact is a component. | ECS entity |
| **Component** | Labelled property bundle ("card") on a peg; at most one per type; defined by a `component_def` row (schema, optional `engine` documentation — D1). | ECS component |
| **Interface** | Registry row declaring a kind of thing: `requires` / `allows` / block types / allowed relations; membership asserted via the `Typed` card, verified by Validation (D5). Supersedes *Entity Type*. | trait / content type |
| **Entity Type** | *Superseded by Interface (2026-09-02).* | — |
| **Property Type** | *Superseded:* value definitions are `component_def` rows (§1 lists them). | JSON schema `$ref` |
| **Dimension** | Glossary shorthand only (D1): the engine-owned components (Visibility, KnowledgeRequirement, TemporalValidity, Status, Reputation). No longer a field — every component is optional and sparse. | — |
| **Relation** | Typed, directed, ID-based link; may carry its own properties. | property-graph edge |
| **Layer** | Content container of type system · expansion · world · pack · campaign · override-set; includes other layers by `dependsOn` with priority. Nothing is copied. | git branch (overlay) |
| **Entry** | The `partOf` relation between an entity and a layer, carrying mode (adds/overrides/removes), time, author, optional `pinned: true` (D6). | commit membership |
| **Stack** | Ordered set of activated layers forming a campaign's read context; specificity precedence. | checkout |
| **Composition** | Structural definition of a complex object: root entity, owned properties, owned sub-entities (lifecycle-bound), referenced entities (lifecycle-independent). | DDD aggregate |
| **Projection** | Read-side selection across compositions for a purpose. Adds no data. Carries a ViewConfig incl. **section layout** (which block types are primary / secondary / collapsed / hidden). | CQRS projection |
| **Block type** | Kind of a ContentBlock: paragraph, readaloud, fact, secret, tactics, appearance, personality, lore, poem, song, review, … Entity types declare which block types they accept. | — |
| **Engine** | Processing unit: transforms, validates, reacts, computes, resolves. Only place behaviour lives. | ECS system / domain service |
| **View** | Rendered output of the Rendering engine for a projection, governed by a View Config. | UI |
| **Board / Widget** | User-owned configurable view (pages + widgets); a widget is a projection bound to entities or session state. Boards additionally carry a free **canvas** (REQ-157): placements, type rules, viewpoint anchors. | dashboard / Figma canvas |
| **Facet (Darstellungsstufe)** | System-wide display level/form of an entity: `short` · `description` · `full` · `image` · `token` · `map` · `link` (D14, REQ-164). Requested by any context (board, sheet, statblock, note); zoom depth maps onto facets. | LOD |
| **Renderer** | `renderer_def` registry row (D11): reads components, delivers facets with a drawing template, applicable per interface. Not an engine — read-only, no events. | — |
| **Placement** | Entry in a board's canvas ViewConfig, one of four kinds (D16): entity · asset · shape (inline, no peg) · widget/tool; geometry + optional facet/renderer override (D12). Not a layer Entry. | — |
| **Viewpoint anchor** | Named canvas viewport: position, zoom depth, optional target facet and visible layers (REQ-159). | Figma frame |
| **Event** | Notification emitted on data change or engine result; engines subscribe. | domain event |
| **Constraint** | Rule evaluated by the Validation engine (or a per-system rule engine). | invariant |
| **Registry** | Index over IDs, aliases, translations for name → ID resolution. | — |

Ownership rule: an entity *owned* by a composition is deleted with it; a *referenced* entity is not. Every entity belongs to exactly one composition as root or owned member; it may be referenced by any number of others.

## 1. Component definitions (former property types)

Each row is (or maps onto) a `component_def` in the compound model; "structured" shapes are the JSON Schemas in [[Schemas]].

| Property Type | O | Kind | Shape / values | Constraints / notes |
|---|---|---|---|---|
| `Identity` | M | structured | id, successorId?, key, aliases[] | id immutable; successorId → same entity type; authorship in the change chain |
| `LocalizedText` | M | structured | key + {lang: text}; fallback DE → EN → key; `engineBinding?` (future) | at least one language present |
| `RawContent` | M | text | original form of imported content: Markdown, OCR, JSON | kept next to structured data |
| `BlockType` | M | enum, open | paragraph · readaloud · fact · secret · tactics · appearance · personality · lore · poem · song · review · note | on ContentBlock; entity types whitelist accepted values |
| `Status` | M | dimension, enum | idea · planned · used · discarded | — |
| `Visibility` | M | dimension, structured | scope, audience, allowed/denied roles, revealedTo[], hiddenFrom[], sharedUsers[] | stored in full; v1 evaluates gm_only / campaign only |
| `KnowledgeRequirement` | M | dimension, structured | requiredTags[], mode (all/any) | tags must exist |
| `TemporalValidity` | M | dimension, structured | from?: WorldDate, until?: WorldDate, afterTag?: Tag | evaluated by Knowledge engine |
| `ReputationTag` | M | dimension, structured (hook) | tag, weight, since | on relations Creature/Faction/Location; propagation later |
| `Rarity` | M | enum | gewöhnlich · ungewöhnlich · selten · mythisch · legendär | — |
| `DiceExpression` | M | primitive | validated string `NdM+K`, tables `d100` | parseable |
| `Effect` | M | structured, open list | type (grant_* / constraint / …), payload, `manual?` | unknown types ignored |
| `SourceRef` | M | structured | layerId, publication, page?, assetId?, anchor? | layerId must resolve |
| `WorldDate` | M | structured | canonical:int (sortable), display:string, calendarId? | sortable without CalendarSystem |
| `Timestamp` | A | structured | real datetime | — |
| `Owner` | A | structured | userId, editGrants[] | user must exist |
| `Coordinates` | A | structured | mapId, x, y, rotation?, size? | map must exist |
| `GridConfig` | M | structured | size, offsetX, offsetY, shape (square/hex) | on Map |
| `AnchorRegion` | M | structured | polygon/rect in parent-map coordinates, threshold | on `childOf` |
| `StorageBackend` | A | enum | app · nas · external | on Asset |
| `ViewConfig` | M | structured | mode (raw/structured/hybrid), fields[], resolutionPriority, statusFilter, language, **sectionLayout** {blockType → primary/secondary/collapsed/hidden}, **statblockProminence** (full/compact/hidden), **selection** — `components` (list or `*`), `blocks` (list, `*`, or rule with `except`), `relations` (which strings, how deep); boards add **canvas** (placements, typeRules, anchors — §5a) | three levels: projection default → board/widget ViewConfig → per-instance tweak; selection can only narrow, filtering (Access/Knowledge) runs before layout |
| `Darstellungsprofil` | M | structured | entries[]: {context? (board/sheet/statblock/note/`*`), facet, rendererRef?, priority} | component on an entity or interface default; a *proposal* with priority, resolved per D13 |
| `Facet` | M | enum, open | short · description · full · image · token · map · link | system-wide (D14); requested by contexts, delivered by renderers |
| `Quantity` | A | primitive | integer ≥ 0 | on `carries` |
| `Order` | A | primitive | integer | on `contains` / `attachedTo` |
| `Priority` / `Effort` | M | enum | 1–5 / Fibonacci | project meta only |

## 2. Relation Types

| Relation | O | From → To | Family | Relation properties |
|---|---|---|---|---|
| `successorOf` | M | Entity → same type | version | — |
| `changed` | M | ChangeEntry → Entity | version | previousEntryId (change chain) |
| `specializes` | M | Entity type → Entity type | version | — |
| `variantOf` | M | any → same type | version | diff? |
| `forkedFrom` | M | any → any (source) | version | explicit copy across packs/worlds (D15); new peg, provenance retained |
| `overrides` | M | any → any | version | scope layer — precedence **deferred (AD-14)** |
| `partOf` (Entry) | M | any entity → Layer | membership | mode (adds/overrides/removes), addedAt, addedBy, **pinned?** — replaces `pinnedVersion` (D6) |
| `dependsOn` | M | Layer → Layer | version | priority |
| `sourcedFrom` | M | content entity → Layer | reference | SourceRef payload |
| `rules` | M | Spell / Item / any → RuleElement | reference | layer-scoped via its own Entry |
| `hasStatblock` | M | Creature → Statblock | reference | statblock independently shareable/versionable/layerable (D4) |
| `composedOf` | M | Statblock → RuleElement | reference | — |
| `knows` | M | Statblock → Spell | reference | — |
| `carries` | M | Creature → Item | reference | Quantity, section (coins/attuned/worn/carried/stored/deeds) |
| `companionOf` | M | Creature → Creature | reference | — |
| `memberOf` | M | Creature → Faction | membership | role text, ReputationTag[] |
| `relatedTo` | M | Creature → Creature / Faction / Location | reference | type text, ReputationTag[] |
| `hasBlock` | M | Creature / Item / Location / Faction / LoreArticle / Statblock → ContentBlock | structure (owned) | Order (generalizes hasFact / hasSecret / contains for blocks) |
| `contains` | M | Container → Container, Location → Location, Party → PC | structure (owned except Party) | Order |
| `attachedTo` | M | Encounter/Note/Quest/ContentBlock/Sound/Handout → NarrativeContainer | structure | Order, diceTable? |
| `attached` | M | Campaign → CampaignSettings / KnowledgeState / WorldDate | structure (owned) | — |
| `defines` | M | Layer → Tag | structure (owned) | — |
| `requires` | M | ContentBlock → Tag | reference | — |
| `holds` | A | KnowledgeState → Tag | reference | holderId (party/PC), since |
| `grants` | A | Class/Species/Background → RuleElement | reference | atLevel? |
| `hasClass` / `hasSpecies` / `hasBackground` | A | PC → Class/Species/Background | reference | level |
| `uses` / `loot` / `map` / `notes` | M | Encounter → NPC / LootTable / Map / Note | reference | count? |
| `yields` | M | LootTable → Item | reference | weight, range |
| `involves` | M | Quest → Creature | reference | role |
| `hasMap` | M | Location → Map | reference | — |
| `childOf` | M | Map → Map | structure | AnchorRegion |
| `placedOn` | M | Token → Map | structure | Coordinates |
| `represents` | M | Token → Creature / Location / Quest | reference | — |
| `describedBy` | M | Location/Faction → LoreArticle | reference | — |
| `file` | A | Map/Sound/Handout/Creature → Asset | reference | role (portrait/icon/source/…) |
| `logs` | A | SessionLog → NarrativeContainer | structure (owned) | — |
| `recordedIn` | A | DiceRoll / StateEvent → SessionLog | structure (owned) | — |
| `stateOf` | M | SessionState → session or Campaign | structure (owned) | kind |
| `steward` | M | Stewardship → User | membership | gmOverride |
| `shows` | M | Widget → Entity / SessionState | reference | query? |
| `pins` | M | Bookmark → RuleElement | reference | context |
| `user` / `role` / `scope` | A | Membership → User / Role / Campaign|World|Layer | membership | — |
| `grantedTo` | A | EditGrant → User | membership | fieldGroup? |
| `has` (EditGrant) | A | PC/Note/… → EditGrant | membership (owned) | — |
| `inWorld` | A | Campaign → World | membership | — |
| `usesCalendar` | A | World → CalendarSystem | reference | — |
| `aliasOf` | M | Term → Entity | reference | — |
| `linksTo` | M | any → any | reference | derived from Registry; backlinks computed |

## 3. Entity Types

Columns: origin · property types · composition membership (R = root, O:X = owned by X) · dimensions · accepted block types.

### Content
| Entity | O | Property types | Composition | Dimensions | Block types | Notes |
|---|---|---|---|---|---|---|
| Creature | M | Identity, LocalizedText, RawContent, SourceRef | R | Visibility, Status | appearance, personality, lore, fact, secret, readaloud, note | may lack a Statblock |
| PC | M | + Owner | R (specializes Creature) | — | + player-authored: note, poem, song | player-edited |
| NPC | M | — | R (specializes Creature) | — | as Creature | quick-add |
| Item | M | Identity, LocalizedText, Rarity, Effect, SourceRef | R | Visibility, Status | lore, secret, fact | |
| Location | M | Identity, LocalizedText, RawContent, Coordinates | R | Visibility | paragraph, lore, readaloud, secret; player: poem, song, review | nests |
| Faction | M | Identity, LocalizedText, RawContent | R | Visibility | paragraph, lore, secret | |
| LoreArticle | M | Identity, LocalizedText, RawContent, SourceRef, category | R | Visibility | paragraph, lore, secret; player: whitelisted per view | body = ContentBlocks |
| ContentBlock | M | Identity, RawContent, BlockType | O: any content or container composition | Visibility, KnowledgeRequirement, TemporalValidity, Status | — | unit of time and divergence |
| Readaloud | M | — | O (specializes ContentBlock) | — | — | behaviour in Knowledge engine |
| Layer | M | Identity, LocalizedText, type, priority | R | — | — | |
| Tag | M | Identity, LocalizedText | O: Layer | — | — | |
| Term | M | Identity, LocalizedText | R | — | — | translations & aliases |
| ChangeEntry | M | Identity, Timestamp, summary, diffRef? | O: the changed entity | — | — | chained |

### Rules & builder
| Entity | O | Property types | Composition | Dimensions | Block types | Notes |
|---|---|---|---|---|---|---|
| Statblock | M | Identity, DiceExpression, Effect, RawContent, fightingtype, system? | R (D4) | Visibility | tactics, note | independent peg, referenced via `hasStatblock`; raw and/or composed of RuleElements; tactics live here, not on Creature |
| RuleElement | M | Identity, LocalizedText, Effect, SourceRef, RawContent | R | Visibility | paragraph, note | variant-capable |
| Spell | M | Identity, LocalizedText, DiceExpression, SourceRef, components | R | Visibility | paragraph, note | data only; meaning via `rules` |
| Class | A | Identity, LocalizedText, SourceRef | R | — | paragraph | subclass via specializes |
| Species | A | Identity, LocalizedText, SourceRef | R | — | paragraph | |
| Background | A | Identity, LocalizedText, SourceRef | R | — | paragraph | |
| Bookmark | M | Identity | O: User | — | — | pinned rule + context |

### Narrative / campaign
| Entity | O | Property types | Composition | Dimensions | Block types | Notes |
|---|---|---|---|---|---|---|
| NarrativeContainer | M | Identity, LocalizedText, RawContent, WorldDate, Timestamp, containerType | R | Visibility, Status | paragraph, readaloud, note, secret | Campaign/Arc/Session/Scene |
| Campaign | M | Identity | R (specializes NarrativeContainer) | — | — | also a Layer of type campaign |
| CampaignSettings | M | Identity, settings (key-value) | O: Campaign | — | — | |
| KnowledgeState | A | Identity, Timestamp | O: Campaign | — | — | |
| Party | A | Identity, LocalizedText | O: Campaign | — | note | |
| WorldDate (entity form) | M | WorldDate | O: NarrativeContainer | — | — | |
| CalendarSystem | M | Identity, LocalizedText, months, eras, moons, dayNames | O: World | — | — | empty until calendar module |
| Event | M | Identity, LocalizedText, WorldDate, RawContent | R | Visibility, KnowledgeRequirement | paragraph, lore | timeline item |
| Quest | M | Identity, LocalizedText, Owner | R | Visibility, Status | paragraph, note | player-creatable |
| Note | M | Identity, RawContent, Owner | R | Visibility, Status | — | |

### Play & media
| Entity | O | Property types | Composition | Dimensions | Block types | Notes |
|---|---|---|---|---|---|---|
| Encounter | M | Identity, LocalizedText, DiceExpression | R | Visibility, Status | tactics, readaloud, note | |
| LootTable | M | Identity, DiceExpression, SourceRef | R | — | — | |
| Map | M | Identity, LocalizedText, GridConfig, scale | R | Visibility | — | nested via `childOf` |
| Token | M | Identity, kind, lifecycle (static/play) | O: Map (static) · O: SessionState or Campaign (play) | Visibility | — | |
| Asset | A | Identity, StorageBackend, path/url, mime, derived[] | R | — | — | every file |
| Sound | M | Identity, LocalizedText | R | — | — | references Asset |
| Handout | A | Identity | R | Visibility, KnowledgeRequirement | — | references Asset |
| SessionState | M | Identity, kind, payload, version | O: session or Campaign | — | — | realtime; persisted as events |
| Stewardship | M | Identity | O: SessionState | — | — | |
| SessionLog | A | Identity, Timestamp | O: Session | — | — | |
| StateEvent | M | Identity, Timestamp, actor, target, delta | O: SessionLog | — | — | statistics source |
| DiceRoll | A | Identity, DiceExpression, Timestamp | O: SessionLog | — | — | |

### Access, users, views
| Entity | O | Property types | Composition | Dimensions | Notes |
|---|---|---|---|---|---|
| User | M | Identity | R | — | |
| Role | M | Identity, LocalizedText | R | — | GM, Player; Co-GM, Spectator later |
| World | A | Identity, LocalizedText | R | — | also a Layer of type world |
| Membership | A | Identity | O: World, Campaign or Layer | — | scope–role–user |
| EditGrant | A | Identity | O: the granted entity | — | |
| UserPreferences | A | Identity | O: User | — | |
| Board | M | Identity, LocalizedText, device? | O: User | — | |
| Widget | M | Identity, type, ViewConfig | O: Board | — | bound via `shows` |

## 4. Compositions (aggregates)

| Composition | Root | Owned sub-entities | Referenced entities | Invariants |
|---|---|---|---|---|
| **CreatureComposition** | Creature (PC/NPC) | ContentBlocks, EditGrants, ChangeEntries | **Statblock** (D4; → its own tactics blocks), Items, Factions, Layers, Class/Species/Background, Assets | at most one `hasStatblock` |
| **ItemComposition** | Item | ContentBlocks | Layer, RuleElements | — |
| **LocationComposition** | Location | child Locations, ContentBlocks | Maps, LoreArticles | no cycles |
| **LoreArticleComposition** | LoreArticle | ContentBlocks | linked entities | — |
| **RuleElementComposition** | RuleElement | ContentBlocks | parent (variantOf), Layer | variant chain acyclic |
| **SpellComposition** | Spell | — | RuleElements, Layer | — |
| **LayerComposition** | Layer | Tags, Entries | included Layers, member entities | dependency graph acyclic |
| **CampaignComposition** | Campaign | CampaignSettings, KnowledgeState, Party, Memberships, child containers → WorldDates, SessionStates → Stewardships, SessionLogs → StateEvents/DiceRolls | World, Layers (stack), Encounters, Quests, Notes, Users, PCs | consider splitting container subtree |
| **EncounterComposition** | Encounter | ContentBlocks | NPCs, LootTables, Maps, Notes, Sounds | — |
| **QuestComposition** | Quest | EditGrants, ContentBlocks | Creatures, containers | — |
| **NoteComposition** | Note | EditGrants | any | — |
| **WorldComposition** | World | CalendarSystems, Memberships | Campaigns, its Layer | — |
| **MapComposition** | Map | static Tokens, child Maps | Asset, Location, play Tokens | anchors inside parent bounds |
| **UserComposition** | User | UserPreferences, Boards → Widgets, Bookmarks | Memberships, EditGrants | — |
| **MediaComposition** | Asset / Sound / Handout | derived variants | containers | — |

## 5. Projections (read models)

| Projection | Reads | Purpose | Section layout (ViewConfig) |
|---|---|---|---|
| CharacterSheet | Creature, Item | player view, phone-first | statblock full; appearance/personality secondary; lore collapsed; secret hidden |
| Kreaturansicht | Creature | DM reference, everything | statblock full; tactics primary; lore/fact/secret secondary; readaloud secondary |
| CombatView | Creature, Encounter, SessionState | at-the-table creature card | statblock full; tactics primary; appearance collapsed; lore/personality hidden |
| CreatureWiki / NPCDirectory | Creature, Faction, Location | lore-first, player-facing after resolution | lore/appearance/personality primary; fact secondary; statblock compact; tactics/secret hidden |
| CharacterBuilder | Creature, RuleElement, Class/Species/Background | assemble Statblock | structured |
| SessionPrep | Campaign, Encounter, Quest, Note | DM prep cockpit | statusFilter = planning; readaloud/tactics primary |
| IdeaInbox | Campaign, Encounter, Quest, Note | Status = idea | statusFilter = idea |
| WikiArticle | LoreArticle, Location, Faction | read-up with backlinks via stack | raw-first; paragraph/lore primary |
| EncounterRunner | Encounter, Creature, LootTable, Map | live play | CombatView per creature |
| InitiativeTracker | SessionState, Creature | turn order, damage attribution | — |
| ScopeInspector | Layer, any entity | layer stack behind an entity | — |
| LayerView | Layer | manage entries, tags, includes | — |
| KnowledgeOverview | Campaign | who knows what | — |
| MapView | Map, Token, Location | nested zoom, overlays | — |
| PlayStatistics | Campaign (SessionLogs) | kills, damage, records | — |

Rule: a projection never filters by entity — it filters by block type, dimension and prominence. Adding a block type to an interface never breaks an existing projection (unknown block types render as collapsed).

**Three levels of configuration (2026-09-02, REQ-161-adjacent):** *a projection defines what can be read; a ViewConfig defines what is shown.* 1. `projection_def` = system default, never user-edited. 2. ViewConfig on a board/widget = user override (explicit `components` / `blocks` / `relations` selection; unmentioned keys fall back). 3. Per-instance tweak on a single widget, same shape. Selection can only narrow, never widen — Access and Knowledge filter before layout.

## 5a. Renderers & display (2026-09-04)

How a selected entity is *drawn* in a context. Requirements REQ-157 … REQ-164; decisions D11–D15.

**`renderer_def` (registry row, D11).** Analogous to `projection_def`: `appliesTo` (interfaces), `reads` (component defs), `facets` delivered (each with a drawing template / source), `defaultPriority`. Renderers are not engines: they read and draw, emit no events, never call each other.

**Facets (D14, REQ-164).** System-wide open enum `short` · `description` · `full` · `image` · `token` · `map` · `link`. Contexts request a facet; the same `description` of a Location appears on a board, a character sheet or a session note; `short` of a weapon inside a statblock. Semantic zoom (REQ-162): the current zoom depth or active anchor maps onto a facet.

**Board canvas (REQ-157, D12).** Part of the board ViewConfig, not the layer system:
- `placements[]` — **kind** `entity` | `asset` | `shape` | `widget` (D16): peg reference, file reference, inline geometry/icon primitive (no peg), or an interactive tool instance (creature creator, generators, forms — the existing Widget mechanism embedded on the canvas); plus geometry (x, y, w, h, rotation?, zIndex?), optional `facetOverride` / `rendererOverride` / `priorityOverride`, optional `anchorRef`. Schema: [[Schemas]] `component/CanvasConfig`
- `typeRules[]` — selector (interface or component attribute value) → facet/renderer + priority, e.g. "all maps as link/popup"
- `anchors[]` — id, name, position, zoom, optional target facet and visible layers (REQ-159); quick navigation between anchors (REQ-160)

**Print & export (D17, REQ-167).** The same facet/renderer resolution drives output generation: a `medium` parameter (screen · print · pdf · image) selects the template variant inside the `renderer_def`; the **Export engine** renders the resolved facet to PDF or PNG — item cards, creature cards, character sheets, map prints. Page assembly (n cards per sheet, margins) is export configuration, not part of the renderer.

**Resolution (D13, REQ-161).** For entity E in context K: 1. explicit placement override → take it. 2. Otherwise collect matching board typeRules and the entity's Darstellungsprofil entries (context match) → highest priority wins. 3. Tie → board rule beats entity profile (local context beats global preference). 4. Nothing → `renderer_def` default of the best-matching interface. Works purely board-driven with no per-placement config.

## 6. Engines and Events

| Engine | O | Subscribes to | Emits / does |
|---|---|---|---|
| Validation | M | `entity.written` | reads `Typed`, checks the interface (required present, allowed only per D2 policy, payloads valid against `component_def` schemas, relation targets permitted); `validation.failed` |
| Resolution | M | any read | **Stack** per D6: peg + successors → highest-priority Entry wins, tie → newest successor, `pinned` stops the chain; `partOf.mode`; language fallback; visibility incl. `inherit` (D7/REQ-156) |
| Knowledge | M | `session.ended`, `gm.*`, time events, WorldDate changes | `knowledge.granted`, `block.revealed`; evaluates TemporalValidity |
| Calculation | M | `entity.written`, `variant.created` | `derived.updated` |
| Registry / Linking | M | `text.written` | `link.ambiguous` |
| Rendering | M | user request | applies ViewConfig incl. sectionLayout |
| Idea/Status | M | `status.changed` | — |
| Access | M | any read/write | `access.denied` |
| Logging | A | `entity.written`, `gm.*`, `knowledge.*`, `state.*`, `dice.rolled`, `status.changed` | writes ChangeEntries, SessionLog |
| Realtime | A | `state.changed` | fan-out per session; enforces Stewardship |
| Asset | A | `asset.uploaded` | `asset.derived`; resolves Asset → URL |
| Export | A | user request | renders facets via `renderer_def` (medium print/pdf/image) to PDF/PNG; card-sheet assembly; emits `asset.derived` (D17, REQ-167) |
| Rules (per system) | M | `entity.written`, builder requests | `constraint.violated` — future |
| Reputation | M | `relation.tagged` | propagated tags — future |

Event catalogue: `entity.written`, `entity.deleted`, `variant.created`, `entry.added`, `entry.overridden`, `layer.activated`, `status.changed`, `session.ended`, `gm.grantKnowledge`, `gm.revealBlock`, `gm.encounterOccurred`, `knowledge.granted`, `block.revealed`, `derived.updated`, `validation.failed`, `link.ambiguous`, `access.denied`, `dice.rolled`, `state.changed`, `state.stewardshipChanged`, `asset.uploaded`, `asset.derived`, `relation.tagged`.

## 7. Storage model

Resolution of AD-01, confirmed 2026-09-02 (D0): **three generic tables plus the registry as rows; Postgres; no Directus.** Optional SQL views per interface are added when convenient (read-only).

```sql
-- the rulebook: extending the system is inserting rows, not migrations
create table component_def (
  name    text primary key,          -- 'Name', 'Visibility', 'Statblock-Mechanik', …
  engine  text,                      -- owning engine or null — documentation only (D1)
  schema  jsonb not null             -- JSON Schema 2020-12
);
create table interface (
  name        text primary key,      -- 'Creature', 'Item', 'Layer', …
  extends     text[] not null default '{}',
  requires    text[] not null default '{}',
  allows      text[] not null default '{}',   -- policy: D2 (strict / expertMode / universal)
  block_types text[] not null default '{}',
  relations   jsonb  not null default '{}'
);
create table relation_def (
  name        text primary key,      -- 'partOf', 'successorOf', 'linksTo', 'forkedFrom', …
  from_ifaces text[] not null,       -- '*' allowed
  to_ifaces   text[] not null,
  owned       bool not null default false,
  props       jsonb not null default '{}'
);
create table projection_def (
  name        text primary key,
  reads       jsonb not null,
  view_config jsonb not null         -- sectionLayout, selection defaults, …
);
create table renderer_def (
  name             text primary key, -- D11
  applies_to       text[] not null,  -- interfaces
  reads            text[] not null,  -- component defs
  facets           jsonb not null,   -- {short: {...}, full: {...}, token: {...}, …}
  default_priority int  not null default 0
);
create table event_def (
  name    text primary key,
  schema  jsonb not null
);

-- storage: pegs, cards, strings, log
create table entity (
  id          uuid primary key,      -- v7 (D10), opaque (D15/REQ-163)
  created_at  timestamptz not null default now()
);
create table component (
  entity_id  uuid not null references entity(id) on delete cascade,
  type       text not null references component_def(name),
  payload    jsonb not null,
  primary key (entity_id, type)
);
create index on component using gin (payload jsonb_path_ops);
create table relation (
  id       uuid primary key,
  from_id  uuid not null references entity(id) on delete cascade,
  to_id    uuid not null references entity(id) on delete cascade,
  type     text not null references relation_def(name),
  props    jsonb not null default '{}',   -- Entry: mode, addedAt, addedBy, pinned?
  ord      int
);
create index on relation (from_id, type);
create index on relation (to_id, type);    -- backlinks
create table event_log (
  id       uuid primary key,         -- v7
  name     text not null,
  actor    uuid,
  subject  uuid,
  payload  jsonb not null default '{}',
  at       timestamptz not null default now()
);
```

How it behaves:
- **Adding a kind of thing** = one `interface` row (plus `component_def` rows if new cards are needed). Forms are generated from the same schemas.
- **Validation** = reads the `Typed` card, loads the interface, checks required/allowed/schemas/relation targets on write (policy per D2).
- **Owned vs referenced** = `owned` flag on `relation_def`; cascade of owned sub-entities is done in the API layer (D9), the DB only cascades relation rows.
- **Stack resolution** = per D6 over `relation where type='partOf'`; computed once per read context and cached. Session state stays in memory; StateEvents are `event_log` rows, rebuilt on restart.
- **SQL views per interface** are an optional read convenience generated from the `interface` table, added when needed.

## 8. Open questions
1. Precedence `variantOf` vs `overrides` (AD-14); final stack conflict model beyond D6 (AD-13).
2. Versioning of component definitions themselves.
3. May projections relabel components, or only select, group and set prominence?
4. ~~Visibility inheritance container → children~~ → now **REQ-156** with D7 as the proposed rule (`inherit: true`, evaluated by Resolution).
5. Parent layer stack settings inheriting into included layers.
6. Split of the CampaignComposition container subtree.
7. ~~Single entity table vs one table per root type~~ → **decided** (D0: three tables + optional views).
8. D2: `allows` strict vs open (leading: strict + `expertMode` per layer + `universal` per component).
9. D5 / D7 / D8 / D9 / D10 as listed in [[Decision Log#Data-model decisions (D-series)]].

## 9. Still to define

What the data architecture needs before it is "good for now". Status 2026-09-04: items 1 (D0), 2, 3, 8 and 9 are covered by [[Schemas]] (complete schemas, 40 interfaces, event payloads, decisions D0–D10); item 4 is fixed conceptually by D6; item 10 is proposed in D10. Remaining open: 5, 6, 7 and confirming the D-proposals.

| # | Gap | Why it blocks | Size |
|---|---|---|---|
| 1 | **AD-01 persistence decided** (single-table vs per-type, SQLite vs Postgres, Directus yes/no) | everything below depends on it | decision |
| 2 | **JSON Schemas for the v1 entity types** (Creature, Statblock, Item, ContentBlock, NarrativeContainer, Layer, Tag, User, Membership) and their property types | first real test that the metamodel holds | medium |
| 3 | **Relation type registry** with owned/referenced flag, cardinality, allowed from/to pairs | needed for cascade and validation | small |
| 4 | **Stack resolution algorithm** as pseudocode: campaign → ordered layers → per-entity winner | core of every read; settles AD-13/14 defaults | medium |
| 5 | **Visibility evaluation for v1** (gm_only / campaign) as a function signature, plus the inheritance answer (Q4) | every projection calls it | small |
| 6 | **Identity resolution rules**: how `key` + aliases are generated on import, uniqueness scope (per layer? global?) | Obsidian import and Registry depend on it | small |
| 7 | **Import contract** for Obsidian: which frontmatter fields map to which properties / dimensions, what stays RawContent | first content in the system comes from there | medium |
| 8 | **Event payload shapes** for the v1 events (`entity.written`, `knowledge.granted`, `status.changed`, `state.changed`) | engines can be built independently once fixed | small |
| 9 | **ViewConfig schema** finalised incl. sectionLayout defaults per projection | Rendering engine + Angular components | small |
| 10 | **ID and key conventions** (UUID v7 for sortability; key format `creature/rina-von-immerwald`) | must be fixed before any data exists | tiny |

Not needed now: CalendarSystem internals, Reputation propagation, Board/Widget schema, Map anchor math, Rules-engine effect interpreter — all have their shape reserved.

## 10. Changelog
- **0.7** (2026-09-05): Print & export via facets/media (D17, REQ-167): medium parameter on renderers, Export engine.
- **0.6** (2026-09-05): Placement kinds entity/asset/shape/widget (D16, REQ-165); board-first v1 (AD-19). [[Schemas]] recovered and updated to v1.1 (`meta/renderer`, `value/Facet`, `component/DisplayProfile`, `component/CanvasConfig`).
- **0.5** (2026-09-04): Compound model merged (§0a; entity = peg, components as cards, interfaces replace entity types, registry rows; D0–D6 outcomes of 2026-09-02): Statblock back to entity (D4), Entry `pinned` flag (D6), `forkedFrom` relation and opaque IDs (D15/REQ-163). §7 rewritten to the three-table model incl. `renderer_def` (D0/D11). New §5a Renderers & display: facets, board canvas (placements, typeRules, anchors), priority-based resolution (D11–D14, REQ-157…164). ViewConfig gains selection fields (three-level configuration). Open questions updated (Q4 → REQ-156, Q7 decided).
- **0.4** (2026-08-31): Merged v0.3 (requirements chat, AD-16) as base. Added `BlockType` property type and accepted-block-types column per entity type; tactics live on Statblock. `hasBlock` generalizes hasFact/hasSecret. `ViewConfig.sectionLayout` + `statblockProminence`; projections CombatView and CreatureWiki/NPCDirectory with explicit section layouts. §7 rewritten as a concrete relational + JSONB storage model with type registry tables. §9 "Still to define" added. Open question 7.
- **0.3** (2026-08-31): Naming reconciliation (AD-16): Tier; Layer/Entry/Stack; Asset; WorldDate/CalendarSystem; SourceRef; ChangeEntry; dimensions; new entities, relations, engines, projections.
- **0.2** (2026-08-29): Composition (aggregate) vs Projection (read model) split; Quantity, Order; Logging engine; event catalogue.
- **0.1** (2026-08-29): Initial vocabulary in 30_Data_Architecture.md.

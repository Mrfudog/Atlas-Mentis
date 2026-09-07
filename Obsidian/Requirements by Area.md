---
tags: [vtt, requirements, view]
status: derived
updated: 2026-09-05
---

# Requirements by Area

Derived view over [[Requirements]] — regenerate rather than edit. Sorted by priority, then effort. Jump: [[#Content Backbone]] · [[#Platform & Access]] · [[#Creatures & Characters]] · [[#Player Experience]] · [[#Campaign & Sessions]] · [[#World & Lore]] · [[#Rules & Reference]] · [[#Live Play]] · [[#Maps]] · [[#Media & Assets]] · [[#Cross-cutting]]

## Content Backbone

42 requirements · 167 points · area definition: [[Areas#Content Backbone]]

| ID          | Requirement                                                                                                                               | Prio | Effort | Phase | Prep cost | Status  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ | ----- | --------- | ------- |
| **REQ-163** | Opaque IDs: no semantics in peg IDs; provenance via source metadata; copying only as explicit fork (`forkedFrom`)                         | 1    | 1      | both  | none      | defined |
| **REQ-002** | Successor chain: successorId, resolution to head so old links stay valid                                                                  | 1    | 2      | both  | none      | defined |
| **REQ-008** | Variant mechanism: copy with variantOf link                                                                                               | 1    | 2      | prep  | none      | defined |
| **REQ-018** | Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types                                    | 1    | 2      | both  | none      | defined |
| **REQ-019** | RawContent coexistence: every import keeps its raw form (markdown, OCR, JSON) next to structured data                                     | 1    | 2      | prep  | none      | defined |
| **REQ-020** | SourceRef provenance: publication, page, optional file + page anchor                                                                      | 1    | 2      | both  | none      | defined |
| **REQ-024** | WorldDate property type: canonical sortable value + display string + CalendarSystem reference                                             | 1    | 2      | both  | none      | defined |
| **REQ-089** | RuleElement reference objects: structured text, tags, optional effects/constraints, rawContent                                            | 1    | 2      | both  | none      | defined |
| **REQ-003** | Change chain: every change as entry (who/when/what) along the version chain, git-log style                                                | 1    | 3      | both  | none      | defined |
| **REQ-004** | Layer entity: types system/expansion/world/pack/campaign/override-set, dependsOn, nesting by link with priority                           | 1    | 3      | prep  | none      | defined |
| **REQ-005** | Entry relation: entity→layer with mode adds/overrides/removes, addedAt/addedBy, optional version pin                                      | 1    | 3      | prep  | none      | defined |
| **REQ-010** | Dimensions: optional, sparsely stored property bundles (Visibility, TemporalValidity, KnowledgeRequirement, Reputation…)                  | 1    | 3      | both  | none      | defined |
| **REQ-016** | Term / translation layer: pseudoname key, LocalizedText, fallback chain DE → EN → key                                                     | 1    | 3      | both  | none      | defined |
| **REQ-021** | Asset entity contract: backend app/nas/external, consumers resolve URLs via asset service                                                 | 1    | 3      | both  | none      | defined |
| **REQ-026** | View config format: mode raw/structured/hybrid, field list, resolution priority per view                                                  | 1    | 3      | both  | none      | defined |
| **REQ-001** | Core entity model: entity types, shared property types, typed relations, immutable IDs                                                    | 1    | 5      | both  | none      | defined |
| **REQ-006** | Stack resolution: campaign-activated ordered layers, specificity precedence (campaign > pack > world > system)                            | 1    | 5      | both  | none      | defined |
| **REQ-011** | ContentBlock primitive: text + visibility + knowledge requirement + scope + temporal validity + pack membership                           | 1    | 5      | both  | none      | defined |
| **REQ-013** | Reference registry & auto-linking: ID-based links, alias matching, auto-link when unambiguous, suggest when ambiguous                     | 1    | 5      | prep  | none      | defined |
| **REQ-023** | Status dimension: idea / planned / used / discarded                                                                                       | 2    | 1      | prep  | none      | defined |
| **REQ-030** | Reputation hooks: weighted tags on relations, propagation rule slot reserved                                                              | 2    | 1      | play  | none      | defined |
| **REQ-012** | Block types: paragraph, readaloud, fact, secret, poem/song/review… extensible list                                                        | 2    | 2      | prep  | none      | defined |
| **REQ-156** | Visibility inheritance container → children: `inherit: true` on Visibility, evaluated by Resolution                                       | 2    | 2      | both  | none      | defined |
| **REQ-164** | Facets (Darstellungsstufen): system-wide short/description/full/image/token/map/link; `renderer_def` analogous to `projection_def`        | 2    | 3      | both  | none      | defined |
| **REQ-009** | Override mechanism: explicit overrides relation with scope                                                                                | 2    | 3      | prep  | none      | defined |
| **REQ-085** | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics                           | 2    | 3      | prep  | none      | defined |
| **REQ-094** | Entity ↔ rule attachment as layer-scoped relation                                                                                         | 2    | 3      | prep  | none      | defined |
| **REQ-044** | Scope inspector sidebar, slim: effective source layer per block/property                                                                  | 2    | 5      | both  | none      | defined |
| **REQ-102** | Contextual article rendering per stack: knowledge, time, scope resolved at read time                                                      | 2    | 5      | both  | none      | defined |
| **REQ-116** | Session state objects (initiative, now-playing, active scene, party note) + realtime channel per session                                  | 2    | 8      | play  | none      | defined |
| **REQ-014** | Backlinks view                                                                                                                            | 3    | 2      | both  | none      | defined |
| **REQ-028** | Full-text search across content                                                                                                           | 3    | 3      | both  | none      | defined |
| **REQ-029** | Serializable schema / export (future file or git backing)                                                                                 | 3    | 3      | prep  | none      | defined |
| **REQ-007** | Stack expert settings: layer priority, per-entry pick, disable single override, flatten into independent layer                            | 3    | 5      | prep  | none      | defined |
| **REQ-161** | Display resolution as priority system: entity profile proposes, board rules decide, user overrides                                        | 2    | 5      | both  | none      | defined |
| **REQ-167** | Print & export outputs: facet-based item/creature cards, character sheets (PDF), maps (image/print); card-sheet assembly as export config | 3    | 5      | prep  | low       | defined |
| **REQ-045** | Scope inspector sidebar, full: layer actions (override here, create variant, move to pack, pick entry)                                    | 3    | 8      | prep  | none      | defined |
| **REQ-015** | Graph view                                                                                                                                | 4    | 5      | prep  | none      | defined |
| **REQ-017** | Term engine bindings: system-specific semantic evaluation of rule terms                                                                   | 4    | 5      | play  | none      | defined |
| **REQ-027** | Generic template engine & Template Manager UI (generalize hardcoded types)                                                                | 4    | 13     | prep  | none      | defined |
| **REQ-062** | Multi-system statblock extension point (system reference on composition)                                                                  | 5    | 8      | prep  | none      | idea    |
| **REQ-093** | Rule engine per system evaluating rules against entity data (constraints, terms)                                                          | 5    | 13     | play  | none      | idea    |

## Platform & Access

20 requirements · 66 points · area definition: [[Areas#Platform & Access]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-036** | Roles GM / Player (Admin global) | 1 | 1 | both | none | defined |
| **REQ-031** | Authentication: password hash check behind an auth interface | 1 | 2 | both | none | defined |
| **REQ-033** | User accounts & profile | 1 | 2 | both | none | defined |
| **REQ-038** | Visibility evaluation, simple: gm_only vs campaign | 1 | 2 | both | none | defined |
| **REQ-100** | World as scope and layer (members, owns content, activated by campaigns) | 1 | 2 | prep | none | defined |
| **REQ-035** | Membership triples: user + scope (campaign/world/layer) + role | 1 | 3 | both | none | defined |
| **REQ-034** | Simplest onboarding: GM-created accounts or plain invite link, whichever is cheaper | 2 | 2 | prep | none | defined |
| **REQ-043** | Campaign configuration store: key-value, each area interprets its keys | 2 | 2 | prep | none | defined |
| **REQ-040** | Knowledge tags & KnowledgeState per campaign (grants, holders, since) | 2 | 3 | play | none | defined |
| **REQ-156** | Visibility inheritance container → children: `inherit: true` on Visibility, evaluated by Resolution | 2 | 2 | both | none | defined |
| **REQ-041** | Per-document edit permissions: owner, GM-default (overridable), co-editors / wardship / open | 2 | 3 | both | none | defined |
| **REQ-044** | Scope inspector sidebar, slim: effective source layer per block/property | 2 | 5 | both | none | defined |
| **REQ-037** | Roles Co-GM / Spectator | 3 | 2 | both | none | defined |
| **REQ-088** | Bulk actions: knowledge / permission assignment | 3 | 3 | prep | none | defined |
| **REQ-109** | Player-authored ContentBlocks with per-view block-type whitelist | 3 | 3 | both | none | defined |
| **REQ-117** | Stewardship: write permission on a state object per user, GM override configurable | 3 | 3 | play | none | defined |
| **REQ-039** | Visibility evaluation, full: scope, allowed/denied roles, knowledgeTags, requiresTags, sharedUsers | 3 | 8 | both | none | defined |
| **REQ-045** | Scope inspector sidebar, full: layer actions (override here, create variant, move to pack, pick entry) | 3 | 8 | prep | none | defined |
| **REQ-032** | Nextcloud / OIDC SSO behind the auth interface | 4 | 5 | prep | none | defined |
| **REQ-042** | Field-group edit granularity (e.g. vitals editable, abilities locked) | 4 | 5 | play | none | defined |

## Creatures & Characters

20 requirements · 89 points · area definition: [[Areas#Creatures & Characters]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-046** | Creature / Statblock split with PC and NPC specializations | 1 | 3 | both | none | defined |
| **REQ-054** | Fightingtype field (MCDM roles) on statblock | 2 | 1 | prep | none | defined |
| **REQ-049** | Quick add: name-only NPC or statblock-only mob in one field | 2 | 2 | play | none | defined |
| **REQ-061** | Creature relations (creature ↔ creature / faction) with relation type | 2 | 2 | prep | none | defined |
| **REQ-048** | Minimal edit form for core creature fields | 2 | 3 | prep | none | defined |
| **REQ-050** | Simple creature viewer: social / description / combat sections | 2 | 3 | play | none | defined |
| **REQ-051** | Quick changes: HP, temp HP, conditions, rest, inspiration | 2 | 3 | play | none | defined |
| **REQ-047** | Import-first entry: 5e.tools JSON, Improved Initiative JSON, markdown paste from Obsidian | 2 | 5 | prep | none | defined |
| **REQ-053** | Statblock as composition of RuleElement references (traits, feats, actions) | 2 | 5 | prep | none | defined |
| **REQ-060** | Companions / summons as regular creatures via companionOf + overrides | 3 | 2 | both | none | defined |
| **REQ-105** | NPC directory as filtered view over creatures with relations | 3 | 2 | both | none | defined |
| **REQ-052** | Detailed statblock viewer | 3 | 3 | play | none | defined |
| **REQ-055** | Inline trait reuse & variant creation while typing | 3 | 3 | prep | none | defined |
| **REQ-059** | Creature knowledge facts: gated ContentBlocks on type / species / faction | 3 | 3 | play | low | defined |
| **REQ-057** | Point-buy ability setting | 4 | 2 | prep | none | defined |
| **REQ-095** | Effects interpreter for grants (first consumer: creature builder) | 4 | 8 | prep | none | defined |
| **REQ-056** | Creature builder with suggestions (origin + fightingtype filter, grants applied via effects) | 4 | 13 | prep | none | defined |
| **REQ-058** | Monster scaling | 5 | 5 | prep | none | idea |
| **REQ-062** | Multi-system statblock extension point (system reference on composition) | 5 | 8 | prep | none | idea |
| **REQ-152** | OCR / PDF import to structured content with editable raw output (MonsterBox-style) | 5 | 13 | prep | none | idea |

## Player Experience

17 requirements · 57 points · area definition: [[Areas#Player Experience]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-069** | Phone-first responsive layout for all player-facing views | 1 | 3 | play | none | defined |
| **REQ-070** | Local dice roller (selector, modifiers, results) | 2 | 2 | play | none | defined |
| **REQ-072** | Player notes as owned documents | 2 | 2 | both | none | defined |
| **REQ-051** | Quick changes: HP, temp HP, conditions, rest, inspiration | 2 | 3 | play | none | defined |
| **REQ-064** | Inventory as list: coins / attuned / worn / carried / stored / deeds | 2 | 3 | play | none | defined |
| **REQ-063** | Character sheet: General tab (HP, temp, hit dice, death saves, AC, conditions, resources, rest) | 2 | 5 | play | none | defined |
| **REQ-074** | Quicklinks: campaign, quests, party, session | 3 | 1 | play | none | defined |
| **REQ-083** | Player-created quests and personal goals | 3 | 1 | play | none | defined |
| **REQ-060** | Companions / summons as regular creatures via companionOf + overrides | 3 | 2 | both | none | defined |
| **REQ-119** | Player boards | 3 | 3 | play | none | defined |
| **REQ-128** | Combat player view: own initiative, conditions, health comments | 3 | 3 | play | none | defined |
| **REQ-066** | Character sheet: Combat tab (initiative, actions, companions) | 3 | 5 | play | none | defined |
| **REQ-067** | Character sheet: Spellcasting tab (slots/points, concentration, active spells, list) | 3 | 5 | play | none | defined |
| **REQ-068** | Character sheet: Freeplay tab | 4 | 3 | play | none | defined |
| **REQ-071** | Shared rolls & roll log per session | 4 | 3 | play | none | defined |
| **REQ-073** | Custom / reorderable sheet layout | 4 | 5 | play | none | defined |
| **REQ-065** | Tile-based visual inventory (alternative view over same data) | 4 | 8 | play | low | defined |

## Campaign & Sessions

17 requirements · 62 points · area definition: [[40_Areas#Campaign & Sessions]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-075** | Campaign as root NarrativeContainer with attached CampaignSettings, WorldDate, KnowledgeState | 1 | 3 | both | none | defined |
| **REQ-076** | NarrativeContainer hierarchy with DM-definable container types (Arc, Session, Scene, Kapitel…) | 1 | 3 | prep | none | defined |
| **REQ-023** | Status dimension: idea / planned / used / discarded | 2 | 1 | prep | none | defined |
| **REQ-043** | Campaign configuration store: key-value, each area interprets its keys | 2 | 2 | prep | none | defined |
| **REQ-040** | Knowledge tags & KnowledgeState per campaign (grants, holders, since) | 2 | 3 | play | none | defined |
| **REQ-077** | Session documents with planned vs occurred encounters and reports | 2 | 3 | both | none | defined |
| **REQ-079** | DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap | 2 | 3 | play | none | defined |
| **REQ-085** | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | 2 | 3 | prep | none | defined |
| **REQ-078** | Session prep cockpit: container view aggregating scenes, quests, storylines, encounters, notes | 2 | 5 | prep | none | defined |
| **REQ-083** | Player-created quests and personal goals | 3 | 1 | play | none | defined |
| **REQ-080** | Readaloud blocks unlocking for players after session (time/event-based grant) | 3 | 2 | play | none | defined |
| **REQ-082** | Quests with tasks, rewards, restrictions; player-facing quest board with gated GM parts | 3 | 3 | both | none | defined |
| **REQ-084** | Ideas inbox per campaign/player and clean vs planning view toggle | 3 | 3 | prep | none | defined |
| **REQ-086** | Party view: passive perception, feats, inventory overview | 3 | 3 | play | none | defined |
| **REQ-088** | Bulk actions: knowledge / permission assignment | 3 | 3 | prep | none | defined |
| **REQ-081** | Reputation & relationship system: interaction tags propagate NPC → faction → city with renown thresholds and status | 4 | 8 | play | none | defined |
| **REQ-087** | Calendar module: months, moons, holidays, time-of-day widget with triggers, lore coupling | 5 | 13 | both | high | idea |

## World & Lore

20 requirements · 81 points · area definition: [[40_Areas#World & Lore]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-024** | WorldDate property type: canonical sortable value + display string + CalendarSystem reference | 1 | 2 | both | none | defined |
| **REQ-100** | World as scope and layer (members, owns content, activated by campaigns) | 1 | 2 | prep | none | defined |
| **REQ-030** | Reputation hooks: weighted tags on relations, propagation rule slot reserved | 2 | 1 | play | none | defined |
| **REQ-061** | Creature relations (creature ↔ creature / faction) with relation type | 2 | 2 | prep | none | defined |
| **REQ-103** | Locations: hierarchy via parent, type, biome | 2 | 2 | prep | none | defined |
| **REQ-104** | Factions: type/subtype taxonomy, relations | 2 | 2 | prep | none | defined |
| **REQ-101** | Lore articles: categories, composed of ContentBlocks | 2 | 3 | prep | none | defined |
| **REQ-102** | Contextual article rendering per stack: knowledge, time, scope resolved at read time | 2 | 5 | both | none | defined |
| **REQ-105** | NPC directory as filtered view over creatures with relations | 3 | 2 | both | none | defined |
| **REQ-059** | Creature knowledge facts: gated ContentBlocks on type / species / faction | 3 | 3 | play | low | defined |
| **REQ-106** | Events & timelines sorted by WorldDate | 3 | 3 | prep | none | defined |
| **REQ-108** | Campaign-specific lore divergence via campaign-scoped blocks and overrides | 3 | 3 | prep | none | defined |
| **REQ-109** | Player-authored ContentBlocks with per-view block-type whitelist | 3 | 3 | both | none | defined |
| **REQ-025** | CalendarSystem definition: months, eras, moons, configurable per world/system | 3 | 5 | prep | low | defined |
| **REQ-107** | Pantheons / deities as article subtype | 4 | 1 | prep | none | defined |
| **REQ-137** | Overlays: query-driven highlights (faction locations, biomes, routes) | 4 | 5 | both | none | defined |
| **REQ-081** | Reputation & relationship system: interaction tags propagate NPC → faction → city with renown thresholds and status | 4 | 8 | play | none | defined |
| **REQ-096** | Constraint interpreter (first consumer: settlement / building validation) | 5 | 8 | prep | none | idea |
| **REQ-110** | Bibliothek von Tan'Jit: illustrated navigation presentation layer over articles | 5 | 8 | play | high | idea |
| **REQ-087** | Calendar module: months, moons, holidays, time-of-day widget with triggers, lore coupling | 5 | 13 | both | high | idea |

## Rules & Reference

16 requirements · 70 points · area definition: [[40_Areas#Rules & Reference]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-018** | Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types | 1 | 2 | both | none | defined |
| **REQ-089** | RuleElement reference objects: structured text, tags, optional effects/constraints, rawContent | 1 | 2 | both | none | defined |
| **REQ-098** | Sub-5-second rule lookup during play | 2 | 2 | play | none | defined |
| **REQ-090** | Rule import from Obsidian markdown and 5e.tools data | 2 | 3 | prep | none | defined |
| **REQ-092** | Spell entities with layer-scoped attached rule sets (5e 2014 / 2024 / homebrew) | 2 | 3 | both | none | defined |
| **REQ-094** | Entity ↔ rule attachment as layer-scoped relation | 2 | 3 | prep | none | defined |
| **REQ-053** | Statblock as composition of RuleElement references (traits, feats, actions) | 2 | 5 | prep | none | defined |
| **REQ-091** | Rules browser: filtered, grouped, searchable, with layer origin in scope sidebar | 2 | 5 | both | none | defined |
| **REQ-099** | Pinnable rules: bookmark object (user + context + rule) | 3 | 1 | play | none | defined |
| **REQ-097** | Spell lists as relations (class ↔ spell) | 3 | 2 | prep | none | defined |
| **REQ-055** | Inline trait reuse & variant creation while typing | 3 | 3 | prep | none | defined |
| **REQ-017** | Term engine bindings: system-specific semantic evaluation of rule terms | 4 | 5 | play | none | defined |
| **REQ-149** | PDF viewer with page-anchor jump from SourceRef | 4 | 5 | both | none | defined |
| **REQ-095** | Effects interpreter for grants (first consumer: creature builder) | 4 | 8 | prep | none | defined |
| **REQ-096** | Constraint interpreter (first consumer: settlement / building validation) | 5 | 8 | prep | none | idea |
| **REQ-093** | Rule engine per system evaluating rules against entity data (constraints, terms) | 5 | 13 | play | none | idea |

## Live Play

39 requirements · 147 points · area definition: [[40_Areas#Live Play]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-049** | Quick add: name-only NPC or statblock-only mob in one field | 2 | 2 | play | none | defined |
| **REQ-070** | Local dice roller (selector, modifiers, results) | 2 | 2 | play | none | defined |
| **REQ-098** | Sub-5-second rule lookup during play | 2 | 2 | play | none | defined |
| **REQ-113** | Widget: notes | 2 | 2 | play | none | defined |
| **REQ-164** | Facets (Darstellungsstufen): system-wide short/description/full/image/token/map/link, reusable across views | 2 | 3 | both | none | defined |
| **REQ-165** | Board placements beyond content entities: assets, shapes, tool objects (creature creator, generators) | 2 | 3 | both | none | defined |
| **REQ-166** | Board-first authoring: create entities on the canvas, choose facet and place in one flow | 2 | 2 | both | none | defined |
| **REQ-079** | DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap | 2 | 3 | play | none | defined |
| **REQ-085** | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | 2 | 3 | prep | none | defined |
| **REQ-112** | Widget: reference box holding multiple open articles with inner tabs | 2 | 3 | play | none | defined |
| **REQ-114** | Widget: quick-create (creates entries in the campaign layer inline) | 2 | 3 | play | none | defined |
| **REQ-044** | Scope inspector sidebar, slim: effective source layer per block/property | 2 | 5 | both | none | defined |
| **REQ-115** | Widget: initiative tracker — session-aware, conditions with durations, damage attributed to current actor by default | 2 | 5 | play | none | defined |
| **REQ-111** | Boards: user-owned configurable views with tabs/pages and widgets; DM and player boards share the mechanism | 2 | 8 | both | low | defined |
| **REQ-116** | Session state objects (initiative, now-playing, active scene, party note) + realtime channel per session | 2 | 8 | play | none | defined |
| **REQ-099** | Pinnable rules: bookmark object (user + context + rule) | 3 | 1 | play | none | defined |
| **REQ-123** | Widget: timers | 3 | 1 | play | none | defined |
| **REQ-160** | Anchor quick navigation: jump between anchors (list, hotkeys) without leaving the board | 3 | 2 | play | none | defined |
| **REQ-122** | Widget: party overview | 3 | 2 | play | none | defined |
| **REQ-124** | Widget: quest board | 3 | 2 | play | none | defined |
| **REQ-086** | Party view: passive perception, feats, inventory overview | 3 | 3 | play | none | defined |
| **REQ-117** | Stewardship: write permission on a state object per user, GM override configurable | 3 | 3 | play | none | defined |
| **REQ-119** | Player boards | 3 | 3 | play | none | defined |
| **REQ-120** | Play log: persist state events (actor, target, delta) | 3 | 3 | play | none | defined |
| **REQ-128** | Combat player view: own initiative, conditions, health comments | 3 | 3 | play | none | defined |
| **REQ-158** | Placement rendering: placements resolve to a facet/renderer; per-placement override wins | 2 | 3 | both | none | defined |
| **REQ-159** | Frames / viewpoint anchors: named canvas viewports with depth, persisted in the board config | 3 | 3 | both | low | defined |
| **REQ-161** | Display resolution as priority system: entity profile proposes, board rules decide, user overrides | 2 | 5 | both | none | defined |
| **REQ-118** | Widget: encounter runner — instantiate participants, roll random entries, raw statblocks trackable | 3 | 5 | play | none | defined |
| **REQ-125** | Widget: random tables & generators (names, shops, loot, cities) | 3 | 5 | play | low | defined |
| **REQ-135** | Play tokens: session- or campaign-scoped state objects (combat positions, temporary changes) | 3 | 5 | play | none | defined |
| **REQ-157** | Canvas boards: free placement, scaling and arrangement (Figma/Canva-style) beyond the widget grid | 2 | 8 | both | low | defined |
| **REQ-126** | Widget: sound — embed/link external tool, native now-playing state only | 4 | 2 | play | high | defined |
| **REQ-144** | Initiative indicator on battlemap (current / next) | 4 | 2 | play | none | defined |
| **REQ-162** | Semantic zoom: zoom depth maps onto facets; anchors may store a target facet | 4 | 5 | play | none | defined |
| **REQ-071** | Shared rolls & roll log per session | 4 | 3 | play | none | defined |
| **REQ-121** | Statistics widget: kills, damage per character, monsters faced, records | 4 | 3 | play | none | defined |
| **REQ-129** | Chatbot: rules Q&A, facts, quick edit | 5 | 8 | play | none | idea |
| **REQ-127** | Native soundboard / music engine | 5 | 13 | play | high | idea |

## Maps

15 requirements · 86 points · area definition: [[40_Areas#Maps]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-132** | Level lock: pin current map level while zooming | 3 | 1 | play | none | defined |
| **REQ-130** | Map entity: image asset, scale, grid config (size, offset, square/hex), link to Location | 3 | 2 | prep | low | defined |
| **REQ-136** | Party and quest markers on region maps (campaign-scoped play tokens) | 3 | 2 | play | none | defined |
| **REQ-133** | Static tokens: reference markers linked to entities (pin opens article) | 3 | 3 | prep | low | defined |
| **REQ-135** | Play tokens: session- or campaign-scoped state objects (combat positions, temporary changes) | 3 | 5 | play | none | defined |
| **REQ-131** | Nested maps: parent + anchor region, zoom-through transitions world → region → city → district → battlemap | 3 | 8 | both | high | defined |
| **REQ-144** | Initiative indicator on battlemap (current / next) | 4 | 2 | play | none | defined |
| **REQ-134** | Static tokens: scenery / props as part of prepared map state | 4 | 3 | prep | low | defined |
| **REQ-137** | Overlays: query-driven highlights (faction locations, biomes, routes) | 4 | 5 | both | none | defined |
| **REQ-138** | Map tiling for smooth zoom (derived asset) | 4 | 5 | play | none | defined |
| **REQ-139** | Fog of war | 4 | 8 | play | high | defined |
| **REQ-141** | Map effects & animations (conditions, weather) | 5 | 8 | play | high | idea |
| **REQ-142** | Drawing, stamps, brushes, layers on maps | 5 | 8 | both | high | idea |
| **REQ-140** | Light & line of sight with walls | 5 | 13 | play | high | idea |
| **REQ-143** | Map editor / full map creation | 5 | 13 | prep | high | idea |

## Media & Assets

16 requirements · 77 points · area definition: [[40_Areas#Media & Assets]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-020** | SourceRef provenance: publication, page, optional file + page anchor | 1 | 2 | both | none | defined |
| **REQ-021** | Asset entity contract: backend app/nas/external, consumers resolve URLs via asset service | 1 | 3 | both | none | defined |
| **REQ-145** | Asset service implementation: app-managed storage (icons, portraits, thumbnails) | 1 | 3 | both | none | defined |
| **REQ-147** | Image upload, portraits, icons | 2 | 2 | prep | none | defined |
| **REQ-165** | Board placements beyond content entities: assets, shapes, tool objects (creature creator, generators) | 2 | 3 | both | none | defined |
| **REQ-146** | NAS / Nextcloud backend for large assets (mount vs WebDAV → AD-15) | 2 | 5 | prep | none | defined |
| **REQ-148** | External URL assets | 3 | 1 | prep | none | defined |
| **REQ-167** | Print & export outputs: facet-based item/creature cards, character sheets (PDF), maps (image/print); card-sheet assembly as export config | 3 | 5 | prep | low | defined |
| **REQ-022** | Derived asset variants: thumbnails, map tiles, PDF page renders, stored app-side | 3 | 5 | prep | none | defined |
| **REQ-126** | Widget: sound — embed/link external tool, native now-playing state only | 4 | 2 | play | high | defined |
| **REQ-138** | Map tiling for smooth zoom (derived asset) | 4 | 5 | play | none | defined |
| **REQ-149** | PDF viewer with page-anchor jump from SourceRef | 4 | 5 | both | none | defined |
| **REQ-150** | Audio asset storage | 5 | 2 | prep | none | idea |
| **REQ-151** | 3D file viewer / repository | 5 | 8 | prep | none | idea |
| **REQ-127** | Native soundboard / music engine | 5 | 13 | play | high | idea |
| **REQ-152** | OCR / PDF import to structured content with editable raw output (MonsterBox-style) | 5 | 13 | prep | none | idea |

## Cross-cutting

4 requirements · 10 points · area definition: [[40_Areas#Cross-cutting]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-069** | Phone-first responsive layout for all player-facing views | 1 | 3 | play | none | defined |
| **REQ-154** | Deployment: container(s) on NAS, reverse proxy, TLS, remote player access | 1 | 3 | both | none | defined |
| **REQ-153** | German UI output with i18n-ready string handling | 2 | 2 | both | none | defined |
| **REQ-155** | Backups of database and app-managed assets | 2 | 2 | both | none | defined |

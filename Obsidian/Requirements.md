---
tags: [vtt, requirements, registry]
status: living
version: 0.6
updated: 2026-09-05
---

# Requirements Registry

Single source of truth for all requirements. **IDs are immutable**: sequential, never reused, never renumbered, carrying no meaning (areas may move; IDs never do). Dropped requirements stay with status `dropped`.

Per-area views are derived: see [[Requirements by Area]]. Definitions of the areas: [[40_Areas]]. Terms: [[Glossary]].

## Scales
- **Priority** 1 backbone-critical · 2 first table use · 3 full v1.0 · 4 expansion · 5 idea parking
- **Effort** Fibonacci points: 1 ≈ one evening · 2 · 3 ≈ two evening-weeks · 5 · 8 ≈ a month+ · 13 = split before starting
- **Phase** prep · play · both — **Value** enables (new capability) · efficiency (saves time) — **Prep cost** none · low · high (how much prep the feature *demands* to deliver its play value)
- **Status** idea · defined · planned · in progress · done · dropped
- **v1** depth for priority 1–2 items: full · minimal (reduced shape, same contract) · stub (shape exists, trivial implementation) · later (excluded from v1). **v1 pts** = effort at that depth. Details and rationale: [[Scope v1]].

## Summary

| Priority | Count | Effort points |
|---|---|---|
| 1 | 31 | 86 |
| 2 | 51 | 166 |
| 3 | 47 | 151 |
| 4 | 23 | 122 |
| 5 | 15 | 141 |
| **Total** | **167** | **666** |

Effort per area (a requirement spanning several areas counts in each): Content Backbone 167, Platform & Access 66, Creatures & Characters 89, Player Experience 57, Campaign & Sessions 62, World & Lore 81, Rules & Reference 70, Live Play 147, Maps 86, Media & Assets 77, Cross-cutting 10.

## Registry

| ID | Requirement | Prio | Effort | v1 | v1 pts | Areas | Phase | Value | Prep cost | Depends on | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **REQ-001** | Core entity model: entity types, shared property types, typed relations, immutable IDs | 1 | 5 | minimal | 4 | Content Backbone | both | enables | none | – | defined | Hardcoded core entity set first; generic engine later (→REQ-027). See [[33_Backbone_Concept#Entities, properties, relations]] |
| **REQ-002** | Successor chain: successorId, resolution to head so old links stay valid | 1 | 2 | stub | 1 | Content Backbone | both | enables | none | REQ-001 | defined | Chains, not trees |
| **REQ-003** | Change chain: every change as entry (who/when/what) along the version chain, git-log style | 1 | 3 | stub | 1 | Content Backbone | both | enables | none | REQ-002 | defined | Replaces denormalized authors[]; authorship is a query |
| **REQ-004** | Layer entity: types system/expansion/world/pack/campaign/override-set, dependsOn, nesting by link with priority | 1 | 3 | minimal | 2 | Content Backbone | prep | enables | none | REQ-001 | defined | Unifies Source, LorePack and scope packaging |
| **REQ-005** | Entry relation: entity→layer with mode adds/overrides/removes, addedAt/addedBy, optional version pin | 1 | 3 | minimal | 2 | Content Backbone | prep | enables | none | REQ-004 | defined | Membership is its own record, sparse |
| **REQ-006** | Stack resolution: campaign-activated ordered layers, specificity precedence (campaign > pack > world > system) | 1 | 5 | minimal | 2 | Content Backbone | both | enables | none | REQ-005 | defined | Read-time overlay, no copies |
| **REQ-007** | Stack expert settings: layer priority, per-entry pick, disable single override, flatten into independent layer | 3 | 5 | – |  | Content Backbone | prep | enables | none | REQ-006 | defined | Final conflict model deferred (AD-13) |
| **REQ-008** | Variant mechanism: copy with variantOf link | 1 | 2 | stub | 1 | Content Backbone | prep | enables | none | REQ-001 | defined |  |
| **REQ-009** | Override mechanism: explicit overrides relation with scope | 2 | 3 | stub | 1 | Content Backbone | prep | enables | none | REQ-006 | defined | Both variant and override planned; precedence rule AD-14 |
| **REQ-010** | Dimensions: optional, sparsely stored property bundles (Visibility, TemporalValidity, KnowledgeRequirement, Reputation…) | 1 | 3 | minimal | 2 | Content Backbone | both | enables | none | REQ-001 | defined | No empty cells on root entities |
| **REQ-011** | ContentBlock primitive: text + visibility + knowledge requirement + scope + temporal validity + pack membership | 1 | 5 | minimal | 3 | Content Backbone | both | enables | none | REQ-010 | defined | Unit of time and divergence |
| **REQ-012** | Block types: paragraph, readaloud, fact, secret, poem/song/review… extensible list | 2 | 2 | minimal | 1 | Content Backbone | prep | enables | none | REQ-011 | defined |  |
| **REQ-013** | Reference registry & auto-linking: ID-based links, alias matching, auto-link when unambiguous, suggest when ambiguous | 1 | 5 | minimal | 3 | Content Backbone | prep | efficiency | none | REQ-001 | defined |  |
| **REQ-014** | Backlinks view | 3 | 2 | – |  | Content Backbone | both | efficiency | none | REQ-013 | defined |  |
| **REQ-015** | Graph view | 4 | 5 | – |  | Content Backbone | prep | efficiency | none | REQ-014 | defined |  |
| **REQ-016** | Term / translation layer: pseudoname key, LocalizedText, fallback chain DE → EN → key | 1 | 3 | minimal | 2 | Content Backbone | both | enables | none | REQ-001 | defined | Output single-language per view |
| **REQ-017** | Term engine bindings: system-specific semantic evaluation of rule terms | 4 | 5 | – |  | Content Backbone, Rules & Reference | play | enables | none | REQ-016 | defined | Multi-system enabler |
| **REQ-018** | Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types | 1 | 2 | stub | 1 | Content Backbone, Rules & Reference | both | enables | none | REQ-001 | defined |  |
| **REQ-019** | RawContent coexistence: every import keeps its raw form (markdown, OCR, JSON) next to structured data | 1 | 2 | full | 2 | Content Backbone | prep | enables | none | REQ-001 | defined | Obsidian bridge |
| **REQ-020** | SourceRef provenance: publication, page, optional file + page anchor | 1 | 2 | minimal | 1 | Content Backbone, Media & Assets | both | enables | none | REQ-001 | defined |  |
| **REQ-021** | Asset entity contract: backend app/nas/external, consumers resolve URLs via asset service | 1 | 3 | minimal | 2 | Content Backbone, Media & Assets | both | enables | none | REQ-001 | defined | Designed early; viewers later |
| **REQ-022** | Derived asset variants: thumbnails, map tiles, PDF page renders, stored app-side | 3 | 5 | – |  | Media & Assets | prep | efficiency | none | REQ-021 | defined |  |
| **REQ-023** | Status dimension: idea / planned / used / discarded | 2 | 1 | full | 1 | Content Backbone, Campaign & Sessions | prep | efficiency | none | REQ-010 | defined |  |
| **REQ-024** | WorldDate property type: canonical sortable value + display string + CalendarSystem reference | 1 | 2 | minimal | 1 | Content Backbone, World & Lore | both | enables | none | REQ-001 | defined |  |
| **REQ-025** | CalendarSystem definition: months, eras, moons, configurable per world/system | 3 | 5 | – |  | World & Lore | prep | enables | low | REQ-024 | defined |  |
| **REQ-026** | View config format: mode raw/structured/hybrid, field list, resolution priority per view | 1 | 3 | stub | 1 | Content Backbone | both | enables | none | REQ-001 | defined | Seed of the later Template Manager |
| **REQ-027** | Generic template engine & Template Manager UI (generalize hardcoded types) | 4 | 13 | – |  | Content Backbone | prep | enables | none | REQ-026 | defined |  |
| **REQ-028** | Full-text search across content | 3 | 3 | – |  | Content Backbone | both | efficiency | none | REQ-001 | defined |  |
| **REQ-029** | Serializable schema / export (future file or git backing) | 3 | 3 | – |  | Content Backbone | prep | enables | none | REQ-001 | defined |  |
| **REQ-030** | Reputation hooks: weighted tags on relations, propagation rule slot reserved | 2 | 1 | stub | 1 | Content Backbone, World & Lore | play | enables | none | REQ-001 | defined | Hook only; system is REQ-081 |
| **REQ-031** | Authentication: password hash check behind an auth interface | 1 | 2 | full | 2 | Platform & Access | both | enables | none | – | defined |  |
| **REQ-032** | Nextcloud / OIDC SSO behind the auth interface | 4 | 5 | – |  | Platform & Access | prep | efficiency | none | REQ-031 | defined |  |
| **REQ-033** | User accounts & profile | 1 | 2 | full | 2 | Platform & Access | both | enables | none | REQ-031 | defined |  |
| **REQ-034** | Simplest onboarding: GM-created accounts or plain invite link, whichever is cheaper | 2 | 2 | full | 2 | Platform & Access | prep | efficiency | none | REQ-033 | defined | Low security bar accepted initially |
| **REQ-035** | Membership triples: user + scope (campaign/world/layer) + role | 1 | 3 | minimal | 2 | Platform & Access | both | enables | none | REQ-033, REQ-004 | defined | Multi-author worlds |
| **REQ-036** | Roles GM / Player (Admin global) | 1 | 1 | full | 1 | Platform & Access | both | enables | none | REQ-035 | defined |  |
| **REQ-037** | Roles Co-GM / Spectator | 3 | 2 | – |  | Platform & Access | both | enables | none | REQ-036 | defined |  |
| **REQ-038** | Visibility evaluation, simple: gm_only vs campaign | 1 | 2 | full | 2 | Platform & Access | both | enables | none | REQ-010 | defined | Full schema stored from day one |
| **REQ-039** | Visibility evaluation, full: scope, allowed/denied roles, knowledgeTags, requiresTags, sharedUsers | 3 | 8 | – |  | Platform & Access | both | enables | none | REQ-038 | defined |  |
| **REQ-040** | Knowledge tags & KnowledgeState per campaign (grants, holders, since) | 2 | 3 | minimal | 2 | Platform & Access, Campaign & Sessions | play | enables | none | REQ-038 | defined |  |
| **REQ-041** | Per-document edit permissions: owner, GM-default (overridable), co-editors / wardship / open | 2 | 3 | minimal | 2 | Platform & Access | both | enables | none | REQ-035 | defined |  |
| **REQ-042** | Field-group edit granularity (e.g. vitals editable, abilities locked) | 4 | 5 | – |  | Platform & Access | play | enables | none | REQ-041 | defined |  |
| **REQ-043** | Campaign configuration store: key-value, each area interprets its keys | 2 | 2 | minimal | 1 | Platform & Access, Campaign & Sessions | prep | enables | none | REQ-035 | defined |  |
| **REQ-044** | Scope inspector sidebar, slim: effective source layer per block/property | 2 | 5 | minimal | 3 | Platform & Access, Content Backbone, Live Play | both | efficiency | none | REQ-006 | defined | Priority 1–2, not polish |
| **REQ-045** | Scope inspector sidebar, full: layer actions (override here, create variant, move to pack, pick entry) | 3 | 8 | – |  | Platform & Access, Content Backbone | prep | enables | none | REQ-044, REQ-007 | defined |  |
| **REQ-046** | Creature / Statblock split with PC and NPC specializations | 1 | 3 | full | 3 | Creatures & Characters | both | enables | none | REQ-001 | defined | Creature without statblock and statblock without creature both valid |
| **REQ-047** | Import-first entry: 5e.tools JSON, Improved Initiative JSON, markdown paste from Obsidian | 2 | 5 | minimal | 3 | Creatures & Characters | prep | efficiency | none | REQ-046, REQ-019 | defined |  |
| **REQ-048** | Minimal edit form for core creature fields | 2 | 3 | full | 3 | Creatures & Characters | prep | enables | none | REQ-046 | defined |  |
| **REQ-049** | Quick add: name-only NPC or statblock-only mob in one field | 2 | 2 | full | 2 | Creatures & Characters, Live Play | play | efficiency | none | REQ-046 | defined |  |
| **REQ-050** | Simple creature viewer: social / description / combat sections | 2 | 3 | full | 3 | Creatures & Characters | play | enables | none | REQ-046, REQ-026 | defined | Leads over detailed view |
| **REQ-051** | Quick changes: HP, temp HP, conditions, rest, inspiration | 2 | 3 | full | 3 | Creatures & Characters, Player Experience | play | enables | none | REQ-050 | defined |  |
| **REQ-052** | Detailed statblock viewer | 3 | 3 | – |  | Creatures & Characters | play | enables | none | REQ-050 | defined |  |
| **REQ-053** | Statblock as composition of RuleElement references (traits, feats, actions) | 2 | 5 | later |  | Creatures & Characters, Rules & Reference | prep | enables | none | REQ-046, REQ-089 | defined |  |
| **REQ-054** | Fightingtype field (MCDM roles) on statblock | 2 | 1 | full | 1 | Creatures & Characters | prep | enables | none | REQ-046 | defined | Term layer provides German role names |
| **REQ-055** | Inline trait reuse & variant creation while typing | 3 | 3 | – |  | Creatures & Characters, Rules & Reference | prep | efficiency | none | REQ-053, REQ-008 | defined |  |
| **REQ-056** | Creature builder with suggestions (origin + fightingtype filter, grants applied via effects) | 4 | 13 | – |  | Creatures & Characters | prep | enables | none | REQ-053, REQ-095 | defined |  |
| **REQ-057** | Point-buy ability setting | 4 | 2 | – |  | Creatures & Characters | prep | efficiency | none | REQ-056 | defined |  |
| **REQ-058** | Monster scaling | 5 | 5 | – |  | Creatures & Characters | prep | enables | none | REQ-056 | idea |  |
| **REQ-059** | Creature knowledge facts: gated ContentBlocks on type / species / faction | 3 | 3 | – |  | Creatures & Characters, World & Lore | play | enables | low | REQ-011, REQ-040 | defined | Lore reusable, unlock state per campaign |
| **REQ-060** | Companions / summons as regular creatures via companionOf + overrides | 3 | 2 | – |  | Creatures & Characters, Player Experience | both | enables | none | REQ-046, REQ-009 | defined |  |
| **REQ-061** | Creature relations (creature ↔ creature / faction) with relation type | 2 | 2 | minimal | 1 | Creatures & Characters, World & Lore | prep | enables | none | REQ-046 | defined |  |
| **REQ-062** | Multi-system statblock extension point (system reference on composition) | 5 | 8 | – |  | Creatures & Characters, Content Backbone | prep | enables | none | REQ-053 | idea | Long-term only |
| **REQ-063** | Character sheet: General tab (HP, temp, hit dice, death saves, AC, conditions, resources, rest) | 2 | 5 | full | 5 | Player Experience | play | enables | none | REQ-046, REQ-026 | defined |  |
| **REQ-064** | Inventory as list: coins / attuned / worn / carried / stored / deeds | 2 | 3 | full | 3 | Player Experience | play | enables | none | REQ-046 | defined |  |
| **REQ-065** | Tile-based visual inventory (alternative view over same data) | 4 | 8 | – |  | Player Experience | play | enables | low | REQ-064 | defined | Uses the existing icon library |
| **REQ-066** | Character sheet: Combat tab (initiative, actions, companions) | 3 | 5 | – |  | Player Experience | play | enables | none | REQ-063, REQ-060 | defined |  |
| **REQ-067** | Character sheet: Spellcasting tab (slots/points, concentration, active spells, list) | 3 | 5 | – |  | Player Experience | play | enables | none | REQ-063, REQ-092 | defined |  |
| **REQ-068** | Character sheet: Freeplay tab | 4 | 3 | – |  | Player Experience | play | enables | none | REQ-063 | defined |  |
| **REQ-069** | Phone-first responsive layout for all player-facing views | 1 | 3 | full | 3 | Player Experience, Cross-cutting | play | enables | none | – | defined | Hard criterion for component library (AD-04) |
| **REQ-070** | Local dice roller (selector, modifiers, results) | 2 | 2 | full | 2 | Player Experience, Live Play | play | enables | none | – | defined |  |
| **REQ-071** | Shared rolls & roll log per session | 4 | 3 | – |  | Player Experience, Live Play | play | enables | none | REQ-070, REQ-116 | defined |  |
| **REQ-072** | Player notes as owned documents | 2 | 2 | full | 2 | Player Experience | both | enables | none | REQ-041 | defined |  |
| **REQ-073** | Custom / reorderable sheet layout | 4 | 5 | – |  | Player Experience | play | efficiency | none | REQ-063 | defined |  |
| **REQ-074** | Quicklinks: campaign, quests, party, session | 3 | 1 | – |  | Player Experience | play | efficiency | none | REQ-075 | defined |  |
| **REQ-075** | Campaign as root NarrativeContainer with attached CampaignSettings, WorldDate, KnowledgeState | 1 | 3 | minimal | 2 | Campaign & Sessions | both | enables | none | REQ-001, REQ-024 | defined | Composition = aggregate; complexity divided into attached objects |
| **REQ-076** | NarrativeContainer hierarchy with DM-definable container types (Arc, Session, Scene, Kapitel…) | 1 | 3 | minimal | 1 | Campaign & Sessions | prep | enables | none | REQ-075 | defined |  |
| **REQ-077** | Session documents with planned vs occurred encounters and reports | 2 | 3 | minimal | 2 | Campaign & Sessions | both | enables | none | REQ-076, REQ-085 | defined |  |
| **REQ-078** | Session prep cockpit: container view aggregating scenes, quests, storylines, encounters, notes | 2 | 5 | minimal | 2 | Campaign & Sessions | prep | efficiency | none | REQ-077 | defined | Strongest prep-time value of the area |
| **REQ-079** | DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap | 2 | 3 | minimal | 2 | Campaign & Sessions, Live Play | play | efficiency | none | REQ-040, REQ-078 | defined |  |
| **REQ-080** | Readaloud blocks unlocking for players after session (time/event-based grant) | 3 | 2 | – |  | Campaign & Sessions | play | enables | none | REQ-012, REQ-040 | defined |  |
| **REQ-081** | Reputation & relationship system: interaction tags propagate NPC → faction → city with renown thresholds and status | 4 | 8 | – |  | World & Lore, Campaign & Sessions | play | enables | none | REQ-030 | defined |  |
| **REQ-082** | Quests with tasks, rewards, restrictions; player-facing quest board with gated GM parts | 3 | 3 | – |  | Campaign & Sessions | both | efficiency | none | REQ-011 | defined | Deliberately non-crucial |
| **REQ-083** | Player-created quests and personal goals | 3 | 1 | – |  | Campaign & Sessions, Player Experience | play | enables | none | REQ-082, REQ-041 | defined |  |
| **REQ-084** | Ideas inbox per campaign/player and clean vs planning view toggle | 3 | 3 | – |  | Campaign & Sessions | prep | efficiency | none | REQ-023, REQ-026 | defined |  |
| **REQ-085** | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | 2 | 3 | minimal | 2 | Content Backbone, Campaign & Sessions, Live Play | prep | enables | none | REQ-001, REQ-076 | defined | Backbone core set |
| **REQ-086** | Party view: passive perception, feats, inventory overview | 3 | 3 | – |  | Campaign & Sessions, Live Play | play | efficiency | none | REQ-064 | defined |  |
| **REQ-087** | Calendar module: months, moons, holidays, time-of-day widget with triggers, lore coupling | 5 | 13 | – |  | Campaign & Sessions, World & Lore | both | enables | high | REQ-025 | idea | Parked |
| **REQ-088** | Bulk actions: knowledge / permission assignment | 3 | 3 | – |  | Campaign & Sessions, Platform & Access | prep | efficiency | none | REQ-040 | defined |  |
| **REQ-089** | RuleElement reference objects: structured text, tags, optional effects/constraints, rawContent | 1 | 2 | full | 2 | Rules & Reference, Content Backbone | both | enables | none | REQ-018, REQ-019 | defined |  |
| **REQ-090** | Rule import from Obsidian markdown and 5e.tools data | 2 | 3 | full | 3 | Rules & Reference | prep | efficiency | none | REQ-089 | defined |  |
| **REQ-091** | Rules browser: filtered, grouped, searchable, with layer origin in scope sidebar | 2 | 5 | minimal | 3 | Rules & Reference | both | efficiency | none | REQ-089, REQ-044 | defined | 5e.tools is the benchmark |
| **REQ-092** | Spell entities with layer-scoped attached rule sets (5e 2014 / 2024 / homebrew) | 2 | 3 | minimal | 1 | Rules & Reference | both | enables | none | REQ-089, REQ-094 | defined | Data on entity, meaning in rule |
| **REQ-093** | Rule engine per system evaluating rules against entity data (constraints, terms) | 5 | 13 | – |  | Rules & Reference, Content Backbone | play | enables | none | REQ-017, REQ-095 | idea | Multi-system |
| **REQ-094** | Entity ↔ rule attachment as layer-scoped relation | 2 | 3 | later |  | Rules & Reference, Content Backbone | prep | enables | none | REQ-005, REQ-089 | defined |  |
| **REQ-095** | Effects interpreter for grants (first consumer: creature builder) | 4 | 8 | – |  | Rules & Reference, Creatures & Characters | prep | enables | none | REQ-018 | defined |  |
| **REQ-096** | Constraint interpreter (first consumer: settlement / building validation) | 5 | 8 | – |  | Rules & Reference, World & Lore | prep | enables | none | REQ-018 | idea |  |
| **REQ-097** | Spell lists as relations (class ↔ spell) | 3 | 2 | – |  | Rules & Reference | prep | enables | none | REQ-092 | defined |  |
| **REQ-098** | Sub-5-second rule lookup during play | 2 | 2 | full | 2 | Rules & Reference, Live Play | play | efficiency | none | REQ-091 | defined | The requirement that justifies the area |
| **REQ-099** | Pinnable rules: bookmark object (user + context + rule) | 3 | 1 | – |  | Rules & Reference, Live Play | play | efficiency | none | REQ-091 | defined |  |
| **REQ-100** | World as scope and layer (members, owns content, activated by campaigns) | 1 | 2 | minimal | 1 | World & Lore, Platform & Access | prep | enables | none | REQ-004, REQ-035 | defined |  |
| **REQ-101** | Lore articles: categories, composed of ContentBlocks | 2 | 3 | minimal | 2 | World & Lore | prep | enables | none | REQ-011 | defined |  |
| **REQ-102** | Contextual article rendering per stack: knowledge, time, scope resolved at read time | 2 | 5 | minimal | 2 | World & Lore, Content Backbone | both | enables | none | REQ-006, REQ-011 | defined | Player wiki grows automatically |
| **REQ-103** | Locations: hierarchy via parent, type, biome | 2 | 2 | minimal | 1 | World & Lore | prep | enables | none | REQ-001 | defined |  |
| **REQ-104** | Factions: type/subtype taxonomy, relations | 2 | 2 | minimal | 1 | World & Lore | prep | enables | none | REQ-001 | defined |  |
| **REQ-105** | NPC directory as filtered view over creatures with relations | 3 | 2 | – |  | World & Lore, Creatures & Characters | both | efficiency | none | REQ-061 | defined |  |
| **REQ-106** | Events & timelines sorted by WorldDate | 3 | 3 | – |  | World & Lore | prep | enables | none | REQ-024 | defined |  |
| **REQ-107** | Pantheons / deities as article subtype | 4 | 1 | – |  | World & Lore | prep | enables | none | REQ-101 | defined |  |
| **REQ-108** | Campaign-specific lore divergence via campaign-scoped blocks and overrides | 3 | 3 | – |  | World & Lore | prep | enables | none | REQ-102, REQ-009 | defined | Likely trigger for AD-14 |
| **REQ-109** | Player-authored ContentBlocks with per-view block-type whitelist | 3 | 3 | – |  | World & Lore, Platform & Access | both | enables | none | REQ-011, REQ-041 | defined | City page: poems, songs, reviews |
| **REQ-110** | Bibliothek von Tan'Jit: illustrated navigation presentation layer over articles | 5 | 8 | – |  | World & Lore | play | enables | high | REQ-101 | idea |  |
| **REQ-111** | Boards: user-owned configurable views with tabs/pages and widgets; DM and player boards share the mechanism | 2 | 8 | minimal | 4 | Live Play | both | enables | low | REQ-026 | defined | Multi-monitor = multiple windows on board pages. v1: one board per user, no pages (AD-19 board-first) |
| **REQ-112** | Widget: reference box holding multiple open articles with inner tabs | 2 | 3 | later |  | Live Play | play | efficiency | none | REQ-111 | defined |  |
| **REQ-113** | Widget: notes | 2 | 2 | later |  | Live Play | play | efficiency | none | REQ-111 | defined |  |
| **REQ-114** | Widget: quick-create (creates entries in the campaign layer inline) | 2 | 3 | later |  | Live Play | play | efficiency | none | REQ-111, REQ-049 | defined |  |
| **REQ-115** | Widget: initiative tracker — session-aware, conditions with durations, damage attributed to current actor by default | 2 | 5 | minimal | 3 | Live Play | play | enables | none | REQ-111, REQ-116 | defined | Smart defaults, quiet overrides |
| **REQ-116** | Session state objects (initiative, now-playing, active scene, party note) + realtime channel per session | 2 | 8 | later |  | Live Play, Content Backbone | play | enables | none | REQ-001 | defined | Resolves AD-11; multi-tab per user falls out |
| **REQ-117** | Stewardship: write permission on a state object per user, GM override configurable | 3 | 3 | – |  | Live Play, Platform & Access | play | efficiency | none | REQ-116 | defined |  |
| **REQ-118** | Widget: encounter runner — instantiate participants, roll random entries, raw statblocks trackable | 3 | 5 | – |  | Live Play | play | enables | none | REQ-115, REQ-085 | defined | Improved Initiative as benchmark |
| **REQ-119** | Player boards | 3 | 3 | – |  | Live Play, Player Experience | play | enables | none | REQ-111 | defined |  |
| **REQ-120** | Play log: persist state events (actor, target, delta) | 3 | 3 | – |  | Live Play | play | enables | none | REQ-116 | defined |  |
| **REQ-121** | Statistics widget: kills, damage per character, monsters faced, records | 4 | 3 | – |  | Live Play | play | enables | none | REQ-120 | defined |  |
| **REQ-122** | Widget: party overview | 3 | 2 | – |  | Live Play | play | efficiency | none | REQ-086 | defined |  |
| **REQ-123** | Widget: timers | 3 | 1 | – |  | Live Play | play | efficiency | none | REQ-111 | defined |  |
| **REQ-124** | Widget: quest board | 3 | 2 | – |  | Live Play | play | efficiency | none | REQ-082 | defined |  |
| **REQ-125** | Widget: random tables & generators (names, shops, loot, cities) | 3 | 5 | – |  | Live Play | play | efficiency | low | REQ-111 | defined |  |
| **REQ-126** | Widget: sound — embed/link external tool, native now-playing state only | 4 | 2 | – |  | Live Play, Media & Assets | play | enables | high | REQ-116 | defined | Soundtale as reference |
| **REQ-127** | Native soundboard / music engine | 5 | 13 | – |  | Live Play, Media & Assets | play | enables | high | REQ-126 | idea | Late feature |
| **REQ-128** | Combat player view: own initiative, conditions, health comments | 3 | 3 | – |  | Live Play, Player Experience | play | enables | none | REQ-115 | defined |  |
| **REQ-129** | Chatbot: rules Q&A, facts, quick edit | 5 | 8 | – |  | Live Play | play | efficiency | none | REQ-028 | idea |  |
| **REQ-130** | Map entity: image asset, scale, grid config (size, offset, square/hex), link to Location | 3 | 2 | – |  | Maps | prep | enables | low | REQ-021 | defined |  |
| **REQ-131** | Nested maps: parent + anchor region, zoom-through transitions world → region → city → district → battlemap | 3 | 8 | – |  | Maps | both | enables | high | REQ-130 | defined |  |
| **REQ-132** | Level lock: pin current map level while zooming | 3 | 1 | – |  | Maps | play | efficiency | none | REQ-131 | defined |  |
| **REQ-133** | Static tokens: reference markers linked to entities (pin opens article) | 3 | 3 | – |  | Maps | prep | enables | low | REQ-130, REQ-013 | defined |  |
| **REQ-134** | Static tokens: scenery / props as part of prepared map state | 4 | 3 | – |  | Maps | prep | enables | low | REQ-133 | defined |  |
| **REQ-135** | Play tokens: session- or campaign-scoped state objects (combat positions, temporary changes) | 3 | 5 | – |  | Maps, Live Play | play | enables | none | REQ-116, REQ-130 | defined |  |
| **REQ-136** | Party and quest markers on region maps (campaign-scoped play tokens) | 3 | 2 | – |  | Maps | play | enables | none | REQ-135 | defined |  |
| **REQ-137** | Overlays: query-driven highlights (faction locations, biomes, routes) | 4 | 5 | – |  | Maps, World & Lore | both | efficiency | none | REQ-131 | defined |  |
| **REQ-138** | Map tiling for smooth zoom (derived asset) | 4 | 5 | – |  | Maps, Media & Assets | play | efficiency | none | REQ-022 | defined |  |
| **REQ-139** | Fog of war | 4 | 8 | – |  | Maps | play | enables | high | REQ-135 | defined |  |
| **REQ-140** | Light & line of sight with walls | 5 | 13 | – |  | Maps | play | enables | high | REQ-139 | idea | Hardest single feature |
| **REQ-141** | Map effects & animations (conditions, weather) | 5 | 8 | – |  | Maps | play | enables | high | REQ-135 | idea |  |
| **REQ-142** | Drawing, stamps, brushes, layers on maps | 5 | 8 | – |  | Maps | both | enables | high | REQ-130 | idea |  |
| **REQ-143** | Map editor / full map creation | 5 | 13 | – |  | Maps | prep | enables | high | REQ-142 | idea |  |
| **REQ-144** | Initiative indicator on battlemap (current / next) | 4 | 2 | – |  | Maps, Live Play | play | efficiency | none | REQ-115, REQ-135 | defined |  |
| **REQ-145** | Asset service implementation: app-managed storage (icons, portraits, thumbnails) | 1 | 3 | minimal | 2 | Media & Assets | both | enables | none | REQ-021 | defined |  |
| **REQ-146** | NAS / Nextcloud backend for large assets (mount vs WebDAV → AD-15) | 2 | 5 | later |  | Media & Assets | prep | enables | none | REQ-021 | defined |  |
| **REQ-147** | Image upload, portraits, icons | 2 | 2 | full | 2 | Media & Assets | prep | enables | none | REQ-145 | defined |  |
| **REQ-148** | External URL assets | 3 | 1 | – |  | Media & Assets | prep | enables | none | REQ-021 | defined |  |
| **REQ-149** | PDF viewer with page-anchor jump from SourceRef | 4 | 5 | – |  | Media & Assets, Rules & Reference | both | efficiency | none | REQ-020, REQ-146 | defined |  |
| **REQ-150** | Audio asset storage | 5 | 2 | – |  | Media & Assets | prep | enables | none | REQ-146 | idea |  |
| **REQ-151** | 3D file viewer / repository | 5 | 8 | – |  | Media & Assets | prep | enables | none | REQ-146 | idea |  |
| **REQ-152** | OCR / PDF import to structured content with editable raw output (MonsterBox-style) | 5 | 13 | – |  | Media & Assets, Creatures & Characters | prep | efficiency | none | REQ-019, REQ-149 | idea |  |
| **REQ-153** | German UI output with i18n-ready string handling | 2 | 2 | full | 2 | Cross-cutting | both | enables | none | REQ-016 | defined |  |
| **REQ-154** | Deployment: container(s) on NAS, reverse proxy, TLS, remote player access | 1 | 3 | full | 3 | Cross-cutting | both | enables | none | – | defined | AD-12 |
| **REQ-155** | Backups of database and app-managed assets | 2 | 2 | full | 2 | Cross-cutting | both | enables | none | REQ-154 | defined |  |
| **REQ-156** | Visibility inheritance container → children: `inherit: true` on Visibility, evaluated by Resolution | 2 | 2 | minimal | 1 | Platform & Access, Content Backbone | both | enables | none | REQ-038 | defined | Closes registry open question 4; rule model = D7 |
| **REQ-157** | Canvas boards: free positioning, scaling and arrangement of entity placements on a board (Figma/Canva-style), beyond the widget grid | 2 | 8 | minimal | 4 | Live Play | both | enables | low | REQ-111 | defined | Placements live in the board ViewConfig, not the layer system (D12) |
| **REQ-158** | Placement rendering: each placement resolves to a facet/renderer via the display resolution; explicit per-placement override always wins | 2 | 3 | minimal | 2 | Live Play | both | enables | none | REQ-157, REQ-164 | defined |  |
| **REQ-159** | Frames / viewpoint anchors: named canvas viewports (position, zoom depth, target facet, visible layers), persisted in the board config | 3 | 3 | – |  | Live Play | both | enables | low | REQ-157 | defined |  |
| **REQ-160** | Anchor quick navigation: jump between anchors (list, hotkeys) — session notes → map → house rules without leaving the board | 3 | 2 | – |  | Live Play | play | efficiency | none | REQ-159 | defined |  |
| **REQ-161** | Display resolution as priority system: entity profile proposes, board rules (per interface / attribute value) decide, user overrides; placement override wins; ties → board rule; works board-only | 2 | 5 | stub | 1 | Live Play, Content Backbone | both | enables | none | REQ-164, REQ-026 | defined | Smart defaults, quiet overrides, three levels (D13) |
| **REQ-162** | Semantic zoom: zoom depth maps onto facets (compact list of weapon properties → full detail on zoom-in); anchors may store a target facet | 4 | 5 | – |  | Live Play | play | enables | none | REQ-159, REQ-161 | defined | Later feature |
| **REQ-163** | Opaque IDs: no semantics (pack/type/version) in peg IDs; provenance via source metadata (`source_pack`, `source_version`); copying only as explicit fork with `forkedFrom` | 1 | 1 | full | 1 | Content Backbone | both | enables | none | REQ-001 | defined | Convention that guards the layer mechanics (D15) |
| **REQ-164** | Facets (Darstellungsstufen): system-wide set short/description/full/image/token/map/link, reusable across boards, sheets, statblocks, notes; `renderer_def` analogous to `projection_def` | 2 | 3 | minimal | 2 | Content Backbone, Live Play | both | enables | none | REQ-026 | defined | D11/D14. v1: short/full/image/token |
| **REQ-165** | Board placements beyond content entities: assets (images, icons), geometric/mathematical shapes as inline canvas objects, and tool objects (interactive widgets such as creature creator or generators) on the canvas | 2 | 3 | minimal | 2 | Live Play, Media & Assets | both | enables | none | REQ-157, REQ-145 | defined | Placement kinds entity/asset/shape/widget (D16); v1 = assets + basic shapes, tool placements later |
| **REQ-166** | Board-first authoring: create entities directly on the canvas (into the campaign layer), choose their facet and place them in one flow | 2 | 2 | minimal | 2 | Live Play | both | enables | none | REQ-157, REQ-049 | defined | Canvas counterpart of quick-create (REQ-114); AD-19 |
| **REQ-167** | Print & export outputs: item cards, creature cards, character sheets (PDF), maps (image/print) rendered from facets — the facet defines *what* appears, the medium (screen/print/pdf/image) *how*; card-sheet assembly (n cards per page) as export config | 3 | 5 | – |  | Media & Assets, Content Backbone | prep | enables | low | REQ-164, REQ-021 | defined | Renderer templates per medium; Export engine renders via `renderer_def` (D17) |

## Changelog
- **0.6** (2026-09-05): REQ-167 print & export outputs (facet-based item/creature cards, PDF character sheets, map images; D17). 167 requirements · 666 points.
- **0.5** (2026-09-05): Board-first v1 (AD-19): REQ-157/158/161 reprioritized 3 → 2 and given v1 depths; REQ-111 and REQ-164 pulled into v1 (minimal). New REQ-165 (asset/shape/tool placements, D16) and REQ-166 (create-on-canvas). 166 requirements · 661 points.
- **0.4** (2026-09-04): Added REQ-156 (visibility inheritance, closes open question 4) and REQ-157 … REQ-164 (canvas boards, frames/anchors, display resolution as priority system, facets, opaque IDs) from the boards/display session. Summary and area totals recounted (164 requirements · 656 points).
- **0.3** (2026-08-31): Added v1 depth and v1 points columns (AD-18).
- **0.2** (2026-08-31): Full rewrite as immutable-ID registry with numeric priority/effort, area tags, time lens. Supersedes 10_Requirements_Catalog.md (MoSCoW version, IDs P-xx/C-xx… retired).
- **0.1** (2026-08-28): Initial MoSCoW catalog.

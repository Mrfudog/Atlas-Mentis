---
tags: [vtt, requirements, view]
status: derived
updated: 2026-10-07
---

# Requirements by Area

Derived view over [[Requirements]] — regenerate rather than edit. Sorted by priority, then effort. Jump: [[#Content Backbone]] · [[#Platform & Access]] · [[#Creatures & Characters]] · [[#Player Experience]] · [[#Campaign & Sessions]] · [[#World & Lore]] · [[#Rules & Reference]] · [[#Live Play]] · [[#Maps]] · [[#Media & Assets]] · [[#Cross-cutting]]

## Content Backbone

48 requirements · 183 points · area definition: [[Areas#Content Backbone]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-163** | Opaque IDs: no semantics (pack/type/version) in peg IDs; provenance via source metadata (`source_pack`, `source_version`); copying only as explicit fork with `forkedFrom` | 1 | 1 | both | none | done |
| **REQ-002** | Successor chain: successorId, resolution to head so old links stay valid | 1 | 2 | both | none | dropped |
| **REQ-008** | Variant mechanism: copy with variantOf link | 1 | 2 | prep | none | in progress |
| **REQ-018** | Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types | 1 | 2 | both | none | defined |
| **REQ-019** | RawContent coexistence: every import keeps its raw form (markdown, OCR, JSON) next to structured data | 1 | 2 | prep | none | dropped |
| **REQ-020** | SourceRef provenance: publication, page, optional file + page anchor | 1 | 2 | both | none | done |
| **REQ-024** | WorldDate property type: canonical sortable value + display string + CalendarSystem reference | 1 | 2 | both | none | done |
| **REQ-089** | RuleElement reference objects: structured text, tags, optional effects/constraints, rawContent | 1 | 2 | both | none | done |
| **REQ-003** | Change chain: every change as entry (who/when/what) along the version chain, git-log style | 1 | 3 | both | none | in progress |
| **REQ-004** | Layer entity: types system/expansion/world/pack/campaign/override-set, dependsOn, nesting by link with priority | 1 | 3 | prep | none | done |
| **REQ-005** | Entry relation: entity→layer with mode adds/overrides/removes, addedAt/addedBy, optional version pin | 1 | 3 | prep | none | done |
| **REQ-010** | Dimensions: optional, sparsely stored property bundles (Visibility, TemporalValidity, KnowledgeRequirement, Reputation…) | 1 | 3 | both | none | done |
| **REQ-016** | Term / translation layer: pseudoname key, LocalizedText, fallback chain DE → EN → key | 1 | 3 | both | none | dropped |
| **REQ-021** | Asset entity contract: backend app/nas/external, consumers resolve URLs via asset service | 1 | 3 | both | none | done |
| **REQ-026** | View config format: mode raw/structured/hybrid, field list, resolution priority per view | 1 | 3 | both | none | done |
| **REQ-001** | Core entity model: entity types, shared property types, typed relations, immutable IDs | 1 | 5 | both | none | done |
| **REQ-006** | Stack resolution: campaign-activated ordered layers, specificity precedence (campaign > pack > world > system) | 1 | 5 | both | none | in progress |
| **REQ-011** | ContentBlock primitive: text + visibility + knowledge requirement + scope + temporal validity + pack membership | 1 | 5 | both | none | dropped |
| **REQ-013** | Reference registry & auto-linking: ID-based links, alias matching, auto-link when unambiguous, suggest when ambiguous | 1 | 5 | prep | none | in progress |
| **REQ-023** | Status dimension: idea / planned / used / discarded | 2 | 1 | prep | none | dropped |
| **REQ-030** | Reputation hooks: weighted tags on relations, propagation rule slot reserved | 2 | 1 | play | none | dropped |
| **REQ-182** | Relation inverse labels in `relation_def`, so one stored edge renders correctly from both ends | 2 | 1 | both | none | done |
| **REQ-012** | Block types: paragraph, readaloud, fact, secret, poem/song/review… extensible list | 2 | 2 | prep | none | done |
| **REQ-156** | Visibility inheritance container → children: `inherit: true` on Visibility, evaluated by Resolution | 2 | 2 | both | none | dropped |
| **REQ-009** | Override mechanism: explicit overrides relation with scope | 2 | 3 | prep | none | done |
| **REQ-085** | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | 2 | 3 | prep | none | done |
| **REQ-094** | Entity ↔ rule attachment as layer-scoped relation | 2 | 3 | prep | none | done |
| **REQ-164** | Facets (Darstellungsstufen): system-wide set short/description/full/image/token/map/link, reusable across boards, sheets, statblocks, notes; `renderer_def` analogous to `projection_def` | 2 | 3 | both | none | dropped |
| **REQ-174** | Parameterised rule templates: `{VAR}` placeholders in RuleElement text, bound per reference; resolution order reference → entity → campaign register | 2 | 3 | prep | none | done |
| **REQ-181** | Ad-hoc fields on a single entity, promotable into the interface definition | 2 | 3 | prep | none | done |
| **REQ-044** | Scope inspector sidebar, slim: effective source layer per block/property | 2 | 5 | both | none | done |
| **REQ-102** | Contextual article rendering per stack: knowledge, time, scope resolved at read time | 2 | 5 | both | none | in progress |
| **REQ-161** | Display resolution as priority system: entity profile proposes, board rules (per interface / attribute value) decide, user overrides; placement override wins; ties → board rule; works board-only | 2 | 5 | both | none | done |
| **REQ-116** | Session state objects (initiative, now-playing, active scene, party note) + realtime channel per session | 2 | 8 | play | none | done |
| **REQ-014** | Backlinks view | 3 | 2 | both | none | done |
| **REQ-028** | Full-text search across content | 3 | 3 | both | none | in progress |
| **REQ-029** | Serializable schema / export (future file or git backing) | 3 | 3 | prep | none | done |
| **REQ-169** | Exploration state ladder per map feature (verborgen → entdeckt → erkundet) with cascade: exploring a node reveals its edges as discovered | 3 | 3 | play | none | done |
| **REQ-176** | Similarity suggestions on create: fuzzy name/text matching proposes existing entities before a duplicate is made; promote-to-reference in one action | 3 | 3 | prep | none | in progress |
| **REQ-201** | Aus einer Stelle im Chat wird Kampagneninhalt: eine Nachricht (oder ein markierter Abschnitt) wird zur Idee, zum Todo, zum Faden oder zu einem ContentBlock an einem Artikel, mit Rückverweis auf die Stelle | 3 | 3 | both | none | idea |
| **REQ-007** | Stack expert settings: layer priority, per-entry pick, disable single override, flatten into independent layer | 3 | 5 | prep | none | defined |
| **REQ-167** | Print & export outputs: item cards, creature cards, character sheets (PDF), maps (image/print) rendered from facets — the facet defines *what* appears, the medium (screen/print/pdf/image) *how*; card-sheet assembly (n cards per page) as export config | 3 | 5 | prep | low | defined |
| **REQ-045** | Scope inspector sidebar, full: layer actions (override here, create variant, move to pack, pick entry) | 3 | 8 | prep | none | defined |
| **REQ-015** | Graph view | 4 | 5 | prep | none | defined |
| **REQ-017** | Term engine bindings: system-specific semantic evaluation of rule terms | 4 | 5 | play | none | defined |
| **REQ-027** | Generic template engine & Template Manager UI (generalize hardcoded types) | 4 | 13 | prep | none | done |
| **REQ-062** | Multi-system statblock extension point (system reference on composition) | 5 | 8 | prep | none | idea |
| **REQ-093** | Rule engine per system evaluating rules against entity data (constraints, terms) | 5 | 13 | play | none | idea |

## Platform & Access

27 requirements · 83 points · area definition: [[Areas#Platform & Access]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-036** | Roles GM / Player (Admin global) | 1 | 1 | both | none | done |
| **REQ-031** | Authentication: password hash check behind an auth interface | 1 | 2 | both | none | done |
| **REQ-033** | User accounts & profile | 1 | 2 | both | none | done |
| **REQ-038** | Visibility evaluation, simple: gm_only vs campaign | 1 | 2 | both | none | done |
| **REQ-100** | World as scope and layer (members, owns content, activated by campaigns) | 1 | 2 | prep | none | in progress |
| **REQ-035** | Membership triples: user + scope (campaign/world/layer) + role | 1 | 3 | both | none | done |
| **REQ-034** | Simplest onboarding: GM-created accounts or plain invite link, whichever is cheaper | 2 | 2 | prep | none | done |
| **REQ-043** | Campaign configuration store: key-value, each area interprets its keys | 2 | 2 | prep | none | done |
| **REQ-156** | Visibility inheritance container → children: `inherit: true` on Visibility, evaluated by Resolution | 2 | 2 | both | none | dropped |
| **REQ-202** | Chats stehen ausserhalb von Abzug, Ausfuhr und Recap: ein Faden zwischen zwei Spielern gehört weder in den Prod-nach-preprod-Abzug noch in eine Kampagnenausfuhr, und die SL liest nicht mit | 2 | 2 | both | none | idea |
| **REQ-203** | Fraktionen mit Rängen: `Faction.ranks` als Leiter (niedrigster zuerst), der Rang eines Mitglieds an der Kante `memberOf`, und eine Wissenszuteilung an die Fraktion darf einen Mindestrang nennen — was der Zirkel weiss, weiss der Novize noch nicht | 2 | 2 | both | none | done |
| **REQ-040** | Knowledge tags & KnowledgeState per campaign (grants, holders, since) | 2 | 3 | play | none | done |
| **REQ-041** | Per-document edit permissions: owner, GM-default (overridable), co-editors / wardship / open | 2 | 3 | both | none | in progress |
| **REQ-177** | Field-level knowledge gating: grant individual components or fields of an entity, not only ContentBlocks | 2 | 3 | both | none | done |
| **REQ-192** | Optimistic concurrency for non-realtime edits: per-entity revision check; the second writer is rejected with a merge prompt rather than silently winning | 2 | 3 | both | none | in progress |
| **REQ-044** | Scope inspector sidebar, slim: effective source layer per block/property | 2 | 5 | both | none | done |
| **REQ-178** | Cover names: an entity may carry a player-facing alias shown while its identity is ungranted | 3 | 1 | play | none | done |
| **REQ-037** | Roles Co-GM / Spectator | 3 | 2 | both | none | done |
| **REQ-088** | Bulk actions: knowledge / permission assignment | 3 | 3 | prep | none | in progress |
| **REQ-109** | Player-authored ContentBlocks with per-view block-type whitelist | 3 | 3 | both | none | in progress |
| **REQ-117** | Stewardship: write permission on a state object per user, GM override configurable | 3 | 3 | play | none | done |
| **REQ-200** | Chat: Fäden zwischen SL und einzelnen Spielern und zwischen Spielern untereinander, an der Kampagne und nicht an einer Sitzung | 3 | 5 | both | none | idea |
| **REQ-039** | Visibility evaluation, full: scope, allowed/denied roles, knowledgeTags, requiresTags, sharedUsers | 3 | 8 | both | none | dropped |
| **REQ-045** | Scope inspector sidebar, full: layer actions (override here, create variant, move to pack, pick entry) | 3 | 8 | prep | none | defined |
| **REQ-179** | Known-unknowns disclosure: a gated view may reveal the count of withheld facts without revealing them | 4 | 1 | play | none | done |
| **REQ-032** | Nextcloud / OIDC SSO behind the auth interface | 4 | 5 | prep | none | dropped |
| **REQ-042** | Field-group edit granularity (e.g. vitals editable, abilities locked) | 4 | 5 | play | none | defined |

## Creatures & Characters

20 requirements · 89 points · area definition: [[Areas#Creatures & Characters]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-046** | Creature / Statblock split with PC and NPC specializations | 1 | 3 | both | none | done |
| **REQ-054** | Fightingtype field (MCDM roles) on statblock | 2 | 1 | prep | none | done |
| **REQ-049** | Quick add: name-only NPC or statblock-only mob in one field | 2 | 2 | play | none | done |
| **REQ-061** | Creature relations (creature ↔ creature / faction) with relation type | 2 | 2 | prep | none | done |
| **REQ-048** | Minimal edit form for core creature fields | 2 | 3 | prep | none | done |
| **REQ-050** | Simple creature viewer: social / description / combat sections | 2 | 3 | play | none | done |
| **REQ-051** | Quick changes: HP, temp HP, conditions, rest, inspiration | 2 | 3 | play | none | done |
| **REQ-047** | Import-first entry: 5e.tools JSON, Improved Initiative JSON, markdown paste from Obsidian | 2 | 5 | prep | none | dropped |
| **REQ-053** | Statblock as composition of RuleElement references (traits, feats, actions) | 2 | 5 | prep | none | done |
| **REQ-060** | Companions / summons as regular creatures via companionOf + overrides | 3 | 2 | both | none | in progress |
| **REQ-105** | NPC directory as filtered view over creatures with relations | 3 | 2 | both | none | done |
| **REQ-052** | Detailed statblock viewer | 3 | 3 | play | none | done |
| **REQ-055** | Inline trait reuse & variant creation while typing | 3 | 3 | prep | none | defined |
| **REQ-059** | Creature knowledge facts: gated ContentBlocks on type / species / faction | 3 | 3 | play | low | done |
| **REQ-057** | Point-buy ability setting | 4 | 2 | prep | none | defined |
| **REQ-095** | Effects interpreter for grants (first consumer: creature builder) | 4 | 8 | prep | none | defined |
| **REQ-056** | Creature builder with suggestions (origin + fightingtype filter, grants applied via effects) | 4 | 13 | prep | none | defined |
| **REQ-058** | Monster scaling | 5 | 5 | prep | none | idea |
| **REQ-062** | Multi-system statblock extension point (system reference on composition) | 5 | 8 | prep | none | idea |
| **REQ-152** | OCR / PDF import to structured content with editable raw output (MonsterBox-style) | 5 | 13 | prep | none | idea |

## Player Experience

20 requirements · 69 points · area definition: [[Areas#Player Experience]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-069** | Phone-first responsive layout for all player-facing views | 1 | 3 | play | none | in progress |
| **REQ-070** | Local dice roller (selector, modifiers, results) | 2 | 2 | play | none | done |
| **REQ-072** | Player notes as owned documents | 2 | 2 | both | none | defined |
| **REQ-051** | Quick changes: HP, temp HP, conditions, rest, inspiration | 2 | 3 | play | none | done |
| **REQ-064** | Inventory as list: coins / attuned / worn / carried / stored / deeds | 2 | 3 | play | none | done |
| **REQ-063** | Character sheet: General tab (HP, temp, hit dice, death saves, AC, conditions, resources, rest) | 2 | 5 | play | none | done |
| **REQ-074** | Quicklinks: campaign, quests, party, session | 3 | 1 | play | none | in progress |
| **REQ-083** | Player-created quests and personal goals | 3 | 1 | play | none | defined |
| **REQ-060** | Companions / summons as regular creatures via companionOf + overrides | 3 | 2 | both | none | in progress |
| **REQ-183** | Party-owned inventory as a shared container distinct from character inventories | 3 | 2 | both | none | done |
| **REQ-119** | Player boards | 3 | 3 | play | none | defined |
| **REQ-128** | Combat player view: own initiative, conditions, health comments | 3 | 3 | play | none | in progress |
| **REQ-066** | Character sheet: Combat tab (initiative, actions, companions) | 3 | 5 | play | none | done |
| **REQ-067** | Character sheet: Spellcasting tab (slots/points, concentration, active spells, list) | 3 | 5 | play | none | defined |
| **REQ-200** | Chat: Fäden zwischen SL und einzelnen Spielern und zwischen Spielern untereinander, an der Kampagne und nicht an einer Sitzung | 3 | 5 | both | none | idea |
| **REQ-068** | Character sheet: Freeplay tab | 4 | 3 | play | none | defined |
| **REQ-071** | Shared rolls & roll log per session | 4 | 3 | play | none | done |
| **REQ-073** | Custom / reorderable sheet layout | 4 | 5 | play | none | dropped |
| **REQ-184** | Crafting: recipes with material inputs, skill checks and DC, time, and output; consumption on completion | 4 | 5 | both | none | done |
| **REQ-065** | Tile-based visual inventory (alternative view over same data) | 4 | 8 | play | low | done |

## Campaign & Sessions

27 requirements · 101 points · area definition: [[Areas#Campaign & Sessions]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-075** | Campaign as root NarrativeContainer with attached CampaignSettings, WorldDate, KnowledgeState | 1 | 3 | both | none | done |
| **REQ-076** | NarrativeContainer hierarchy with DM-definable container types (Arc, Session, Scene, Kapitel…) | 1 | 3 | prep | none | done |
| **REQ-023** | Status dimension: idea / planned / used / discarded | 2 | 1 | prep | none | dropped |
| **REQ-043** | Campaign configuration store: key-value, each area interprets its keys | 2 | 2 | prep | none | done |
| **REQ-040** | Knowledge tags & KnowledgeState per campaign (grants, holders, since) | 2 | 3 | play | none | done |
| **REQ-077** | Session documents with planned vs occurred encounters and reports | 2 | 3 | both | none | done |
| **REQ-079** | DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap | 2 | 3 | play | none | in progress |
| **REQ-085** | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | 2 | 3 | prep | none | done |
| **REQ-078** | Session prep cockpit: container view aggregating scenes, quests, storylines, encounters, notes | 2 | 5 | prep | none | done |
| **REQ-083** | Player-created quests and personal goals | 3 | 1 | play | none | defined |
| **REQ-080** | Readaloud blocks unlocking for players after session (time/event-based grant) | 3 | 2 | play | none | defined |
| **REQ-188** | Cross-type "unfinished" overview: everything at status idea/planned across all interfaces, with jump-to and bulk status change | 3 | 2 | prep | none | done |
| **REQ-189** | Aggregated todo list across containers and entities (campaign, arc, session, quest, NPC) | 3 | 2 | prep | none | done |
| **REQ-082** | Quests with tasks, rewards, restrictions; player-facing quest board with gated GM parts | 3 | 3 | both | none | done |
| **REQ-084** | Ideas inbox per campaign/player and clean vs planning view toggle | 3 | 3 | prep | none | done |
| **REQ-086** | Party view: passive perception, feats, inventory overview | 3 | 3 | play | none | in progress |
| **REQ-088** | Bulk actions: knowledge / permission assignment | 3 | 3 | prep | none | in progress |
| **REQ-172** | Weighted encounter tables per region, with per-location type constraints and safety states that restrict the pool | 3 | 3 | both | none | done |
| **REQ-180** | Narrative seeds: planted threads with category (Backstory · Geheimnis · Faden · Idee · Versprechen · Konsequenz) and status (offen · gepflanzt · aufgegangen · verworfen), bound to a character and the session planted in | 3 | 3 | both | none | idea |
| **REQ-201** | Aus einer Stelle im Chat wird Kampagneninhalt: eine Nachricht (oder ein markierter Abschnitt) wird zur Idee, zum Todo, zum Faden oder zu einem ContentBlock an einem Artikel, mit Rückverweis auf die Stelle | 3 | 3 | both | none | idea |
| **REQ-200** | Chat: Fäden zwischen SL und einzelnen Spielern und zwischen Spielern untereinander, an der Kampagne und nicht an einer Sitzung | 3 | 5 | both | none | idea |
| **REQ-173** | World-state decay between sessions: roll to degrade secured locations, weighted by adjacency to faction territory | 4 | 3 | prep | none | idea |
| **REQ-196** | Sitzungsmitschnitt: Audio einer Sitzung aufnehmen oder eine fertige Aufnahme anhängen, als Asset am Sitzungs-Container, mit Startzeit und Kapitelmarken | 4 | 5 | play | none | idea |
| **REQ-081** | Reputation & relationship system: interaction tags propagate NPC → faction → city with renown thresholds and status | 4 | 8 | play | none | dropped |
| **REQ-197** | Transkription und Recap-Entwurf: Mitschnitt transkribieren, am Sitzungsverlauf ausrichten und daraus einen Recap-Entwurf erzeugen, den die SL bearbeitet | 4 | 8 | prep | none | idea |
| **REQ-198** | Sprecherzuordnung im Transkript: Abschnitte einer Figur oder der SL zuordnen, damit „was hat meine Figur mitbekommen“ beantwortbar wird | 5 | 5 | prep | low | idea |
| **REQ-087** | Calendar module: months, moons, holidays, time-of-day widget with triggers, lore coupling | 5 | 13 | both | high | idea |

## World & Lore

24 requirements · 91 points · area definition: [[Areas#World & Lore]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-024** | WorldDate property type: canonical sortable value + display string + CalendarSystem reference | 1 | 2 | both | none | done |
| **REQ-100** | World as scope and layer (members, owns content, activated by campaigns) | 1 | 2 | prep | none | in progress |
| **REQ-030** | Reputation hooks: weighted tags on relations, propagation rule slot reserved | 2 | 1 | play | none | dropped |
| **REQ-061** | Creature relations (creature ↔ creature / faction) with relation type | 2 | 2 | prep | none | done |
| **REQ-103** | Locations: hierarchy via parent, type, biome | 2 | 2 | prep | none | done |
| **REQ-104** | Factions: type/subtype taxonomy, relations | 2 | 2 | prep | none | done |
| **REQ-203** | Fraktionen mit Rängen: `Faction.ranks` als Leiter (niedrigster zuerst), der Rang eines Mitglieds an der Kante `memberOf`, und eine Wissenszuteilung an die Fraktion darf einen Mindestrang nennen — was der Zirkel weiss, weiss der Novize noch nicht | 2 | 2 | both | none | done |
| **REQ-101** | Lore articles: categories, composed of ContentBlocks | 2 | 3 | prep | none | done |
| **REQ-102** | Contextual article rendering per stack: knowledge, time, scope resolved at read time | 2 | 5 | both | none | in progress |
| **REQ-178** | Cover names: an entity may carry a player-facing alias shown while its identity is ungranted | 3 | 1 | play | none | done |
| **REQ-105** | NPC directory as filtered view over creatures with relations | 3 | 2 | both | none | done |
| **REQ-059** | Creature knowledge facts: gated ContentBlocks on type / species / faction | 3 | 3 | play | low | done |
| **REQ-106** | Events & timelines sorted by WorldDate | 3 | 3 | prep | none | done |
| **REQ-108** | Campaign-specific lore divergence via campaign-scoped blocks and overrides | 3 | 3 | prep | none | done |
| **REQ-109** | Player-authored ContentBlocks with per-view block-type whitelist | 3 | 3 | both | none | in progress |
| **REQ-025** | CalendarSystem definition: months, eras, moons, configurable per world/system | 3 | 5 | prep | low | defined |
| **REQ-168** | Point-crawl travel: node/edge graph attached to a Location, with per-edge sensory read-aloud text and per-node arrival state | 3 | 5 | both | none | done |
| **REQ-107** | Pantheons / deities as article subtype | 4 | 1 | prep | none | defined |
| **REQ-137** | Overlays: query-driven highlights (faction locations, biomes, routes) | 4 | 5 | both | none | in progress |
| **REQ-081** | Reputation & relationship system: interaction tags propagate NPC → faction → city with renown thresholds and status | 4 | 8 | play | none | dropped |
| **REQ-185** | Non-coin economies: barter and alternative currency ladders per region | 5 | 2 | play | none | idea |
| **REQ-096** | Constraint interpreter (first consumer: settlement / building validation) | 5 | 8 | prep | none | idea |
| **REQ-110** | Bibliothek von Tan'Jit: illustrated navigation presentation layer over articles | 5 | 8 | play | high | idea |
| **REQ-087** | Calendar module: months, moons, holidays, time-of-day widget with triggers, lore coupling | 5 | 13 | both | high | idea |

## Rules & Reference

20 requirements · 82 points · area definition: [[Areas#Rules & Reference]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-018** | Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types | 1 | 2 | both | none | defined |
| **REQ-089** | RuleElement reference objects: structured text, tags, optional effects/constraints, rawContent | 1 | 2 | both | none | done |
| **REQ-098** | Sub-5-second rule lookup during play | 2 | 2 | play | none | done |
| **REQ-090** | Rule import from Obsidian markdown and 5e.tools data | 2 | 3 | prep | none | dropped |
| **REQ-092** | Spell entities with layer-scoped attached rule sets (5e 2014 / 2024 / homebrew) | 2 | 3 | both | none | defined |
| **REQ-094** | Entity ↔ rule attachment as layer-scoped relation | 2 | 3 | prep | none | done |
| **REQ-174** | Parameterised rule templates: `{VAR}` placeholders in RuleElement text, bound per reference; resolution order reference → entity → campaign register | 2 | 3 | prep | none | done |
| **REQ-053** | Statblock as composition of RuleElement references (traits, feats, actions) | 2 | 5 | prep | none | done |
| **REQ-091** | Rules browser: filtered, grouped, searchable, with layer origin in scope sidebar | 2 | 5 | both | none | done |
| **REQ-099** | Pinnable rules: bookmark object (user + context + rule) | 3 | 1 | play | none | done |
| **REQ-097** | Spell lists as relations (class ↔ spell) | 3 | 2 | prep | none | defined |
| **REQ-175** | Inline rule reference panel: text scanned against RuleElement names and aliases, matches shown as an expandable block in the view | 3 | 2 | play | none | done |
| **REQ-055** | Inline trait reuse & variant creation while typing | 3 | 3 | prep | none | defined |
| **REQ-195** | Statblock export back to Obsidian markdown, preserving `{VAR}` placeholders unresolved | 4 | 2 | prep | none | idea |
| **REQ-017** | Term engine bindings: system-specific semantic evaluation of rule terms | 4 | 5 | play | none | defined |
| **REQ-149** | PDF viewer with page-anchor jump from SourceRef | 4 | 5 | both | none | defined |
| **REQ-184** | Crafting: recipes with material inputs, skill checks and DC, time, and output; consumption on completion | 4 | 5 | both | none | done |
| **REQ-095** | Effects interpreter for grants (first consumer: creature builder) | 4 | 8 | prep | none | defined |
| **REQ-096** | Constraint interpreter (first consumer: settlement / building validation) | 5 | 8 | prep | none | idea |
| **REQ-093** | Rule engine per system evaluating rules against entity data (constraints, terms) | 5 | 13 | play | none | idea |

## Live Play

45 requirements · 161 points · area definition: [[Areas#Live Play]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-049** | Quick add: name-only NPC or statblock-only mob in one field | 2 | 2 | play | none | done |
| **REQ-070** | Local dice roller (selector, modifiers, results) | 2 | 2 | play | none | done |
| **REQ-098** | Sub-5-second rule lookup during play | 2 | 2 | play | none | done |
| **REQ-113** | Widget: notes | 2 | 2 | play | none | defined |
| **REQ-166** | Board-first authoring: create entities directly on the canvas (into the campaign layer), choose their facet and place them in one flow | 2 | 2 | both | none | in progress |
| **REQ-079** | DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap | 2 | 3 | play | none | in progress |
| **REQ-085** | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | 2 | 3 | prep | none | done |
| **REQ-112** | Widget: reference box holding multiple open articles with inner tabs | 2 | 3 | play | none | dropped |
| **REQ-114** | Widget: quick-create (creates entries in the campaign layer inline) | 2 | 3 | play | none | in progress |
| **REQ-158** | Placement rendering: each placement resolves to a facet/renderer via the display resolution; explicit per-placement override always wins | 2 | 3 | both | none | done |
| **REQ-164** | Facets (Darstellungsstufen): system-wide set short/description/full/image/token/map/link, reusable across boards, sheets, statblocks, notes; `renderer_def` analogous to `projection_def` | 2 | 3 | both | none | dropped |
| **REQ-165** | Board placements beyond content entities: assets (images, icons), geometric/mathematical shapes as inline canvas objects, and tool objects (interactive widgets such as creature creator or generators) on the canvas | 2 | 3 | both | none | done |
| **REQ-044** | Scope inspector sidebar, slim: effective source layer per block/property | 2 | 5 | both | none | done |
| **REQ-115** | Widget: initiative tracker — session-aware, conditions with durations, damage attributed to current actor by default | 2 | 5 | play | none | done |
| **REQ-161** | Display resolution as priority system: entity profile proposes, board rules (per interface / attribute value) decide, user overrides; placement override wins; ties → board rule; works board-only | 2 | 5 | both | none | done |
| **REQ-111** | Boards: user-owned configurable views with tabs/pages and widgets; DM and player boards share the mechanism | 2 | 8 | both | low | done |
| **REQ-116** | Session state objects (initiative, now-playing, active scene, party note) + realtime channel per session | 2 | 8 | play | none | done |
| **REQ-157** | Canvas boards: free positioning, scaling and arrangement of entity placements on a board (Figma/Canva-style), beyond the widget grid | 2 | 8 | both | low | done |
| **REQ-099** | Pinnable rules: bookmark object (user + context + rule) | 3 | 1 | play | none | done |
| **REQ-123** | Widget: timers | 3 | 1 | play | none | defined |
| **REQ-122** | Widget: party overview | 3 | 2 | play | none | done |
| **REQ-124** | Widget: quest board | 3 | 2 | play | none | done |
| **REQ-160** | Anchor quick navigation: jump between anchors (list, hotkeys) — session notes → map → house rules without leaving the board | 3 | 2 | play | none | in progress |
| **REQ-186** | Nested loot tables: a table entry may reference another table, with cycle protection | 3 | 2 | both | none | done |
| **REQ-187** | Table display mode: a shared read-only presentation view for a screen at the table, distinct from per-player accounts | 3 | 2 | play | none | idea |
| **REQ-190** | Quick capture during play: one field that files a seed, todo or idea against the current session without leaving the view | 3 | 2 | play | none | done |
| **REQ-086** | Party view: passive perception, feats, inventory overview | 3 | 3 | play | none | in progress |
| **REQ-117** | Stewardship: write permission on a state object per user, GM override configurable | 3 | 3 | play | none | done |
| **REQ-119** | Player boards | 3 | 3 | play | none | defined |
| **REQ-120** | Play log: persist state events (actor, target, delta) | 3 | 3 | play | none | in progress |
| **REQ-128** | Combat player view: own initiative, conditions, health comments | 3 | 3 | play | none | in progress |
| **REQ-159** | Frames / viewpoint anchors: named canvas viewports (position, zoom depth, target facet, visible layers), persisted in the board config | 3 | 3 | both | low | done |
| **REQ-172** | Weighted encounter tables per region, with per-location type constraints and safety states that restrict the pool | 3 | 3 | both | none | done |
| **REQ-118** | Widget: encounter runner — instantiate participants, roll random entries, raw statblocks trackable | 3 | 5 | play | none | done |
| **REQ-125** | Widget: random tables & generators (names, shops, loot, cities) | 3 | 5 | play | low | done |
| **REQ-135** | Play tokens: session- or campaign-scoped state objects (combat positions, temporary changes) | 3 | 5 | play | none | in progress |
| **REQ-126** | Widget: sound — embed/link external tool, native now-playing state only | 4 | 2 | play | high | in progress |
| **REQ-144** | Initiative indicator on battlemap (current / next) | 4 | 2 | play | none | done |
| **REQ-170** | Travel resource cadence: consumables consumed every N nodes or watches, configurable per travel ruleset | 4 | 2 | play | none | done |
| **REQ-071** | Shared rolls & roll log per session | 4 | 3 | play | none | done |
| **REQ-121** | Statistics widget: kills, damage per character, monsters faced, records | 4 | 3 | play | none | defined |
| **REQ-171** | Per-node action budget: one action per character per node from a configurable list (sneak, craft, forage, rest) | 4 | 3 | play | none | done |
| **REQ-162** | Semantic zoom: zoom depth maps onto facets (compact list of weapon properties → full detail on zoom-in); anchors may store a target facet | 4 | 5 | play | none | defined |
| **REQ-129** | Chatbot: rules Q&A, facts, quick edit | 5 | 8 | play | none | idea |
| **REQ-127** | Native soundboard / music engine | 5 | 13 | play | high | idea |

## Maps

18 requirements · 97 points · area definition: [[Areas#Maps]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-132** | Level lock: pin current map level while zooming | 3 | 1 | play | none | defined |
| **REQ-130** | Map entity: image asset, scale, grid config (size, offset, square/hex), link to Location | 3 | 2 | prep | low | done |
| **REQ-136** | Party and quest markers on region maps (campaign-scoped play tokens) | 3 | 2 | play | none | done |
| **REQ-133** | Static tokens: reference markers linked to entities (pin opens article) | 3 | 3 | prep | low | done |
| **REQ-169** | Exploration state ladder per map feature (verborgen → entdeckt → erkundet) with cascade: exploring a node reveals its edges as discovered | 3 | 3 | play | none | done |
| **REQ-135** | Play tokens: session- or campaign-scoped state objects (combat positions, temporary changes) | 3 | 5 | play | none | in progress |
| **REQ-168** | Point-crawl travel: node/edge graph attached to a Location, with per-edge sensory read-aloud text and per-node arrival state | 3 | 5 | both | none | done |
| **REQ-131** | Nested maps: parent + anchor region, zoom-through transitions world → region → city → district → battlemap | 3 | 8 | both | high | done |
| **REQ-144** | Initiative indicator on battlemap (current / next) | 4 | 2 | play | none | done |
| **REQ-134** | Static tokens: scenery / props as part of prepared map state | 4 | 3 | prep | low | done |
| **REQ-193** | Territory overlays rasterised onto the map grid from shapes (rect, circle, ellipse, polygon) | 4 | 3 | both | none | done |
| **REQ-137** | Overlays: query-driven highlights (faction locations, biomes, routes) | 4 | 5 | both | none | in progress |
| **REQ-138** | Map tiling for smooth zoom (derived asset) | 4 | 5 | play | none | done |
| **REQ-139** | Fog of war | 4 | 8 | play | high | done |
| **REQ-141** | Map effects & animations (conditions, weather) | 5 | 8 | play | high | idea |
| **REQ-142** | Drawing, stamps, brushes, layers on maps | 5 | 8 | both | high | idea |
| **REQ-140** | Light & line of sight with walls | 5 | 13 | play | high | done |
| **REQ-143** | Map editor / full map creation | 5 | 13 | prep | high | idea |

## Media & Assets

18 requirements · 84 points · area definition: [[Areas#Media & Assets]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-020** | SourceRef provenance: publication, page, optional file + page anchor | 1 | 2 | both | none | done |
| **REQ-021** | Asset entity contract: backend app/nas/external, consumers resolve URLs via asset service | 1 | 3 | both | none | done |
| **REQ-145** | Asset service implementation: app-managed storage (icons, portraits, thumbnails) | 1 | 3 | both | none | in progress |
| **REQ-147** | Image upload, portraits, icons | 2 | 2 | prep | none | in progress |
| **REQ-165** | Board placements beyond content entities: assets (images, icons), geometric/mathematical shapes as inline canvas objects, and tool objects (interactive widgets such as creature creator or generators) on the canvas | 2 | 3 | both | none | done |
| **REQ-146** | NAS / Nextcloud backend for large assets (mount vs WebDAV → AD-15) | 2 | 5 | prep | none | defined |
| **REQ-148** | External URL assets | 3 | 1 | prep | none | done |
| **REQ-022** | Derived asset variants: thumbnails, map tiles, PDF page renders, stored app-side | 3 | 5 | prep | none | defined |
| **REQ-167** | Print & export outputs: item cards, creature cards, character sheets (PDF), maps (image/print) rendered from facets — the facet defines *what* appears, the medium (screen/print/pdf/image) *how*; card-sheet assembly (n cards per page) as export config | 3 | 5 | prep | low | defined |
| **REQ-126** | Widget: sound — embed/link external tool, native now-playing state only | 4 | 2 | play | high | in progress |
| **REQ-195** | Statblock export back to Obsidian markdown, preserving `{VAR}` placeholders unresolved | 4 | 2 | prep | none | idea |
| **REQ-138** | Map tiling for smooth zoom (derived asset) | 4 | 5 | play | none | done |
| **REQ-149** | PDF viewer with page-anchor jump from SourceRef | 4 | 5 | both | none | defined |
| **REQ-196** | Sitzungsmitschnitt: Audio einer Sitzung aufnehmen oder eine fertige Aufnahme anhängen, als Asset am Sitzungs-Container, mit Startzeit und Kapitelmarken | 4 | 5 | play | none | idea |
| **REQ-150** | Audio asset storage | 5 | 2 | prep | none | idea |
| **REQ-151** | 3D file viewer / repository | 5 | 8 | prep | none | idea |
| **REQ-127** | Native soundboard / music engine | 5 | 13 | play | high | idea |
| **REQ-152** | OCR / PDF import to structured content with editable raw output (MonsterBox-style) | 5 | 13 | prep | none | idea |

## Cross-cutting

10 requirements · 23 points · area definition: [[Areas#Cross-cutting]]

| ID | Requirement | Prio | Effort | Phase | Prep cost | Status |
|---|---|---|---|---|---|---|
| **REQ-191** | Fail-closed persistence: a failed load or migration must never be overwritten by a later autosave; the unreadable state is preserved and downloadable | 1 | 2 | both | none | done |
| **REQ-069** | Phone-first responsive layout for all player-facing views | 1 | 3 | play | none | in progress |
| **REQ-154** | Deployment: container(s) on NAS, reverse proxy, TLS, remote player access | 1 | 3 | both | none | done |
| **REQ-153** | German UI output with i18n-ready string handling | 2 | 2 | both | none | dropped |
| **REQ-155** | Backups of database and app-managed assets | 2 | 2 | both | none | done |
| **REQ-202** | Chats stehen ausserhalb von Abzug, Ausfuhr und Recap: ein Faden zwischen zwei Spielern gehört weder in den Prod-nach-preprod-Abzug noch in eine Kampagnenausfuhr, und die SL liest nicht mit | 2 | 2 | both | none | idea |
| **REQ-192** | Optimistic concurrency for non-realtime edits: per-entity revision check; the second writer is rejected with a merge prompt rather than silently winning | 2 | 3 | both | none | in progress |
| **REQ-187** | Table display mode: a shared read-only presentation view for a screen at the table, distinct from per-player accounts | 3 | 2 | play | none | idea |
| **REQ-199** | Produktionsdaten nach preprod spiegeln: regelmässiger Abzug aus der Prod-Datenbank in die Testinstanz, damit gegen echte Inhalte getestet wird | 3 | 3 | prep | none | done |
| **REQ-194** | Mobile navigation: the user chooses which entries occupy the phone bottom bar | 4 | 1 | both | none | idea |

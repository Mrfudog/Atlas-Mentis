---
tags: [vtt, scope, v1]
status: draft
version: 0.3
updated: 2026-09-05
---

# v1 Scope

Derived from [[Requirements]] (columns *v1* / *v1 pts*, AD-18). v1 = the smallest system that runs a real session from the platform while every backbone contract already has its final shape. Depth levels: **full** as specified · **minimal** reduced shape, same contract · **stub** shape exists, trivial implementation · **later** excluded.

Goal test for v1: create a board, create session notes, a map and house rules directly on the canvas and place them with a chosen facet; import a monster library and your PCs; run one session with the initiative tracker, players use their phone sheet, the DM grants knowledge and players read the unlocked lore afterwards.

## Numbers

- v1: **75 requirements · 150 points** (priority 1–2 at full depth would be 252 points; whole registry 661)
- At one evening per point: roughly **131 evenings** — 43 weeks at three evenings, 65 weeks at two.
- Deferred from priority 1–2: 7 items (REQ-053, REQ-094, REQ-112, REQ-113, REQ-114, REQ-116, REQ-146)

## What v1 deliberately is not
- No realtime channel: the initiative tracker is a GM-only page, players refresh their sheet. **Boards are in (AD-19, board-first)** — one canvas board per user as the entry surface — but without pages/tabs, anchors, semantic zoom, board typeRules, entity DisplayProfiles or tool placements; the display resolution is a stub (placement override → renderer default). Live Play proper (realtime, widgets, anchors) is the first post-v1 area.
- No statblock composition: statblocks are raw markup plus flat structured fields; RuleElement composition and effects interpretation follow.
- No temporal validity, no packs beyond one world layer, no NAS asset backend.
- Every deferred item keeps its data shape reserved (dimension slots, effect schema, layer types), so adding it later touches no existing entity.

## v1 by area

### Content Backbone
26 items · 45 points

| ID | Requirement | Depth | Pts | v1 note |
|---|---|---|---|---|
| **REQ-001** | Core entity model: entity types, shared property types, typed relations, immutable IDs | minimal | 4 | only the entity types v1 needs |
| **REQ-011** | ContentBlock primitive: text + visibility + knowledge requirement + scope + temporal validity + pack membership | minimal | 3 | text + visibility + knowledge tag; no temporal/pack |
| **REQ-013** | Reference registry & auto-linking: ID-based links, alias matching, auto-link when unambiguous, suggest when ambiguous | minimal | 3 | exact + alias match, plain suggestion list |
| **REQ-004** | Layer entity: types system/expansion/world/pack/campaign/override-set, dependsOn, nesting by link with priority | minimal | 2 | types + dependsOn, no priority UI |
| **REQ-005** | Entry relation: entity→layer with mode adds/overrides/removes, addedAt/addedBy, optional version pin | minimal | 2 | mode adds only |
| **REQ-006** | Stack resolution: campaign-activated ordered layers, specificity precedence (campaign > pack > world > system) | minimal | 2 | one campaign over one world; specificity |
| **REQ-010** | Dimensions: optional, sparsely stored property bundles (Visibility, TemporalValidity, KnowledgeRequirement, Reputation…) | minimal | 2 | Visibility + Status only |
| **REQ-016** | Term / translation layer: pseudoname key, LocalizedText, fallback chain DE → EN → key | minimal | 2 | key + DE, fallback to key |
| **REQ-019** | RawContent coexistence: every import keeps its raw form (markdown, OCR, JSON) next to structured data | full | 2 |  |
| **REQ-021** | Asset entity contract: backend app/nas/external, consumers resolve URLs via asset service | minimal | 2 | app backend only |
| **REQ-089** | RuleElement reference objects: structured text, tags, optional effects/constraints, rawContent | full | 2 |  |
| **REQ-002** | Successor chain: successorId, resolution to head so old links stay valid | stub | 1 | pointer + resolve, no UI |
| **REQ-003** | Change chain: every change as entry (who/when/what) along the version chain, git-log style | stub | 1 | append-only log, not yet displayed |
| **REQ-008** | Variant mechanism: copy with variantOf link | stub | 1 | copy with link, no diff |
| **REQ-018** | Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types | stub | 1 | schema documented, nothing interprets |
| **REQ-020** | SourceRef provenance: publication, page, optional file + page anchor | minimal | 1 | publication + page as text |
| **REQ-024** | WorldDate property type: canonical sortable value + display string + CalendarSystem reference | minimal | 1 | numeric + display string |
| **REQ-026** | View config format: mode raw/structured/hybrid, field list, resolution priority per view | stub | 1 | hardcoded per view; format written down |
| **REQ-044** | Scope inspector sidebar, slim: effective source layer per block/property | minimal | 3 | shows originating layer per block, read-only |
| **REQ-085** | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | minimal | 2 | participants + notes; no loot tables |
| **REQ-102** | Contextual article rendering per stack: knowledge, time, scope resolved at read time | minimal | 2 | visibility + knowledge; no temporal |
| **REQ-009** | Override mechanism: explicit overrides relation with scope | stub | 1 | flag on entry, honoured by resolution, no UI |
| **REQ-012** | Block types: paragraph, readaloud, fact, secret, poem/song/review… extensible list | minimal | 1 | paragraph, readaloud, fact |
| **REQ-023** | Status dimension: idea / planned / used / discarded | full | 1 |  |
| **REQ-030** | Reputation hooks: weighted tags on relations, propagation rule slot reserved | stub | 1 | tag slot on relation, unused |
| **REQ-163** | Opaque IDs: no semantics in peg IDs; provenance via source metadata; copying only as explicit fork | full | 1 | convention, enforced from the first row |

### Platform & Access
12 items · 21 points

| ID | Requirement | Depth | Pts | v1 note |
|---|---|---|---|---|
| **REQ-031** | Authentication: password hash check behind an auth interface | full | 2 |  |
| **REQ-033** | User accounts & profile | full | 2 |  |
| **REQ-035** | Membership triples: user + scope (campaign/world/layer) + role | minimal | 2 | campaign scope only |
| **REQ-038** | Visibility evaluation, simple: gm_only vs campaign | full | 2 |  |
| **REQ-036** | Roles GM / Player (Admin global) | full | 1 |  |
| **REQ-100** | World as scope and layer (members, owns content, activated by campaigns) | minimal | 1 | one world layer, created by hand |
| **REQ-044** | Scope inspector sidebar, slim: effective source layer per block/property | minimal | 3 | shows originating layer per block, read-only |
| **REQ-034** | Simplest onboarding: GM-created accounts or plain invite link, whichever is cheaper | full | 2 |  |
| **REQ-040** | Knowledge tags & KnowledgeState per campaign (grants, holders, since) | minimal | 2 | grant/revoke per party, no holders detail |
| **REQ-041** | Per-document edit permissions: owner, GM-default (overridable), co-editors / wardship / open | minimal | 2 | owner + GM only |
| **REQ-043** | Campaign configuration store: key-value, each area interprets its keys | minimal | 1 | a few keys, no UI |
| **REQ-156** | Visibility inheritance container → children: `inherit: true` on Visibility, evaluated by Resolution | minimal | 1 | fixed rule (inherit on), no per-entity toggle UI |

### Creatures & Characters
8 items · 19 points

| ID          | Requirement                                                                               | Depth   | Pts | v1 note                        |
| ----------- | ----------------------------------------------------------------------------------------- | ------- | --- | ------------------------------ |
| **REQ-046** | Creature / Statblock split with PC and NPC specializations                                | full    | 3   |                                |
| **REQ-047** | Import-first entry: 5e.tools JSON, Improved Initiative JSON, markdown paste from Obsidian | minimal | 3   | 5e.tools JSON + markdown paste |
| **REQ-048** | Minimal edit form for core creature fields                                                | full    | 3   |                                |
| **REQ-050** | Simple creature viewer: social / description / combat sections                            | full    | 3   |                                |
| **REQ-051** | Quick changes: HP, temp HP, conditions, rest, inspiration                                 | full    | 3   |                                |
| **REQ-049** | Quick add: name-only NPC or statblock-only mob in one field                               | full    | 2   |                                |
| **REQ-054** | Fightingtype field (MCDM roles) on statblock                                              | full    | 1   |                                |
| **REQ-061** | Creature relations (creature ↔ creature / faction) with relation type                     | minimal | 1   | free relation type text        |

### Player Experience
6 items · 18 points

| ID | Requirement | Depth | Pts | v1 note |
|---|---|---|---|---|
| **REQ-069** | Phone-first responsive layout for all player-facing views | full | 3 |  |
| **REQ-063** | Character sheet: General tab (HP, temp, hit dice, death saves, AC, conditions, resources, rest) | full | 5 |  |
| **REQ-051** | Quick changes: HP, temp HP, conditions, rest, inspiration | full | 3 |  |
| **REQ-064** | Inventory as list: coins / attuned / worn / carried / stored / deeds | full | 3 |  |
| **REQ-070** | Local dice roller (selector, modifiers, results) | full | 2 |  |
| **REQ-072** | Player notes as owned documents | full | 2 |  |

### Campaign & Sessions
9 items · 15 points

| ID | Requirement | Depth | Pts | v1 note |
|---|---|---|---|---|
| **REQ-075** | Campaign as root NarrativeContainer with attached CampaignSettings, WorldDate, KnowledgeState | minimal | 2 | settings + knowledge state; WorldDate optional |
| **REQ-076** | NarrativeContainer hierarchy with DM-definable container types (Arc, Session, Scene, Kapitel…) | minimal | 1 | Campaign + Session, fixed types |
| **REQ-040** | Knowledge tags & KnowledgeState per campaign (grants, holders, since) | minimal | 2 | grant/revoke per party, no holders detail |
| **REQ-077** | Session documents with planned vs occurred encounters and reports | minimal | 2 | report + linked encounters |
| **REQ-078** | Session prep cockpit: container view aggregating scenes, quests, storylines, encounters, notes | minimal | 2 | session lists its encounters and notes |
| **REQ-079** | DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap | minimal | 2 | grant knowledge, reveal block |
| **REQ-085** | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | minimal | 2 | participants + notes; no loot tables |
| **REQ-023** | Status dimension: idea / planned / used / discarded | full | 1 |  |
| **REQ-043** | Campaign configuration store: key-value, each area interprets its keys | minimal | 1 | a few keys, no UI |
| **REQ-156** | Visibility inheritance container → children: `inherit: true` on Visibility, evaluated by Resolution | minimal | 1 | fixed rule (inherit on), no per-entity toggle UI |

### World & Lore
8 items · 10 points

| ID | Requirement | Depth | Pts | v1 note |
|---|---|---|---|---|
| **REQ-024** | WorldDate property type: canonical sortable value + display string + CalendarSystem reference | minimal | 1 | numeric + display string |
| **REQ-100** | World as scope and layer (members, owns content, activated by campaigns) | minimal | 1 | one world layer, created by hand |
| **REQ-101** | Lore articles: categories, composed of ContentBlocks | minimal | 2 | category + blocks |
| **REQ-102** | Contextual article rendering per stack: knowledge, time, scope resolved at read time | minimal | 2 | visibility + knowledge; no temporal |
| **REQ-030** | Reputation hooks: weighted tags on relations, propagation rule slot reserved | stub | 1 | tag slot on relation, unused |
| **REQ-163** | Opaque IDs: no semantics in peg IDs; provenance via source metadata; copying only as explicit fork | full | 1 | convention, enforced from the first row |
| **REQ-061** | Creature relations (creature ↔ creature / faction) with relation type | minimal | 1 | free relation type text |
| **REQ-103** | Locations: hierarchy via parent, type, biome | minimal | 1 | parent + type |
| **REQ-104** | Factions: type/subtype taxonomy, relations | minimal | 1 | type only |

### Rules & Reference
6 items · 12 points

| ID | Requirement | Depth | Pts | v1 note |
|---|---|---|---|---|
| **REQ-089** | RuleElement reference objects: structured text, tags, optional effects/constraints, rawContent | full | 2 |  |
| **REQ-018** | Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types | stub | 1 | schema documented, nothing interprets |
| **REQ-090** | Rule import from Obsidian markdown and 5e.tools data | full | 3 |  |
| **REQ-091** | Rules browser: filtered, grouped, searchable, with layer origin in scope sidebar | minimal | 3 | filter + search; no grouping config |
| **REQ-098** | Sub-5-second rule lookup during play | full | 2 |  |
| **REQ-092** | Spell entities with layer-scoped attached rule sets (5e 2014 / 2024 / homebrew) | minimal | 1 | spells imported as reference entities |

### Live Play
7 items · 16 points

| ID | Requirement | Depth | Pts | v1 note |
|---|---|---|---|---|
| **REQ-044** | Scope inspector sidebar, slim: effective source layer per block/property | minimal | 3 | shows originating layer per block, read-only |
| **REQ-115** | Widget: initiative tracker — session-aware, conditions with durations, damage attributed to current actor by default | minimal | 3 | GM-only page, no realtime, damage attribution kept |
| **REQ-049** | Quick add: name-only NPC or statblock-only mob in one field | full | 2 |  |
| **REQ-070** | Local dice roller (selector, modifiers, results) | full | 2 |  |
| **REQ-079** | DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap | minimal | 2 | grant knowledge, reveal block |
| **REQ-085** | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | minimal | 2 | participants + notes; no loot tables |
| **REQ-098** | Sub-5-second rule lookup during play | full | 2 |  |

### Media & Assets
4 items · 7 points

| ID | Requirement | Depth | Pts | v1 note |
|---|---|---|---|---|
| **REQ-021** | Asset entity contract: backend app/nas/external, consumers resolve URLs via asset service | minimal | 2 | app backend only |
| **REQ-145** | Asset service implementation: app-managed storage (icons, portraits, thumbnails) | minimal | 2 | local disk, no derived variants |
| **REQ-020** | SourceRef provenance: publication, page, optional file + page anchor | minimal | 1 | publication + page as text |
| **REQ-147** | Image upload, portraits, icons | full | 2 |  |

### Cross-cutting
4 items · 10 points

| ID | Requirement | Depth | Pts | v1 note |
|---|---|---|---|---|
| **REQ-069** | Phone-first responsive layout for all player-facing views | full | 3 |  |
| **REQ-154** | Deployment: container(s) on NAS, reverse proxy, TLS, remote player access | full | 3 |  |
| **REQ-153** | German UI output with i18n-ready string handling | full | 2 |  |
| **REQ-155** | Backups of database and app-managed assets | full | 2 |  |

### Live Play (board-first, AD-19)
7 items · 17 points

| ID | Requirement | Depth | Pts | v1 note |
|---|---|---|---|---|
| **REQ-157** | Canvas boards: free positioning, scaling and arrangement of placements | minimal | 4 | position + size; no rotation/z-order UI |
| **REQ-158** | Placement rendering: placements resolve to a facet/renderer | minimal | 2 | facet chosen at placement, no board rules |
| **REQ-164** | Facets: system-wide display levels; renderer_def analogous to projection_def | minimal | 2 | short/full/image/token; hardcoded renderers |
| **REQ-165** | Placements beyond entities: assets, shapes, tool objects | minimal | 2 | assets + basic shapes; tool placements later |
| **REQ-166** | Board-first authoring: create entities on the canvas, choose facet, place | minimal | 2 | create into the campaign layer, one flow |
| **REQ-161** | Display resolution as priority system | stub | 1 | placement override → renderer default only; typeRules/DisplayProfiles reserved |

## Deferred from priority 1–2

| ID | Requirement | Prio | Effort | Why not in v1 |
|---|---|---|---|---|
| **REQ-053** | Statblock as composition of RuleElement references (traits, feats, actions) | 2 | 5 | v1 keeps raw + flat structured fields |
| **REQ-094** | Entity ↔ rule attachment as layer-scoped relation | 2 | 3 | needs REQ-053 first |
| **REQ-112** | Widget: reference box holding multiple open articles with inner tabs | 2 | 3 | canvas placements cover v1 reference needs |
| **REQ-113** | Widget: notes | 2 | 2 | needs boards |
| **REQ-114** | Widget: quick-create (creates entries in the campaign layer inline) | 2 | 3 | quick add (REQ-049) covers v1 |
| **REQ-116** | Session state objects (initiative, now-playing, active scene, party note) + realtime channel per session | 2 | 8 | v1 initiative is GM-only; players refresh |
| **REQ-146** | NAS / Nextcloud backend for large assets (mount vs WebDAV → AD-15) | 2 | 5 | portraits/maps app-side until needed |

## Suggested build order inside v1 (board-first, AD-19)
1. **Skeleton** (deploy, auth, users, membership, core entities, one world + one campaign layer, stack with specificity, visibility flag) — the framework's shape becomes real.
2. **Board canvas** (create a board; create notes, maps and rules directly on the canvas into the campaign layer; choose a facet and place; assets and basic shapes; hardcoded renderers for short/full/image/token) — the surface every later step lands on, and the first table-usable slice.
3. **Creatures** (import, raw content, minimal form, quick add, simple viewer, quick changes, portraits) — statblock cards become placeable.
4. **Player sheet** (General tab, inventory list, dice, notes, phone-first).
5. **Campaign** (sessions, encounters, knowledge grants, quick actions, ContentBlocks with fact/readaloud).
6. **Rules** (import, browser, sub-5s lookup, spells as references).
7. **Initiative** (GM-only page with damage attribution) and the slim scope inspector.

Steps 3–7 are independent after step 2; order by mood.

## Changelog
- **0.3** (2026-09-05): Board-first restructure (AD-19): new Live Play v1 section (REQ-111, 157, 158, 161, 164, 165, 166 — 17 points); REQ-111/164 out of the deferred list; build order starts with the board canvas after the skeleton; goal test extended. 75 requirements · 150 points. (Also fixes the 0.2 arithmetic: priority 1–2 full depth is 252, not 227.)
- **0.2** (2026-09-04): REQ-163 (opaque IDs, full) and REQ-156 (visibility inheritance, minimal) added to v1; REQ-164 (facets) deferred with the boards block. 68 requirements · 133 points.
- **0.1** (2026-08-31): Initial v1 cut.
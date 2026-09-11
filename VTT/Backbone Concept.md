---
tags: [vtt, architecture, backbone, concept]
status: draft
version: 0.3
updated: 2026-09-05
---
# Backbone Concept

The contract every area builds on. Complements [[30_Data_Architecture]] (tiers, vocabulary) and [[Data Definitions]] (living registry); this note explains the *mechanisms* and why they exist. Vocabulary follows [[Glossary]]. Requirements: [[Requirements by Area#Content Backbone]].

Jump: [[#Principles]] · [[#Entities, properties, relations]] · [[#Identity and history]] · [[#Layers, entries, stacks]] · [[#Dimensions]] · [[#ContentBlocks]] · [[#References and terms]] · [[#Entities vs rules]] · [[#Views and engines]] · [[#Assets]] · [[#Session state]] · [[#Extension points]]

## Principles
1. **Framework first, features by mood.** The backbone is defined thoroughly; areas are implemented independently whenever interest strikes. No area may require a backbone change to exist.
2. **Ignore what you don't know.** Every consumer (engine, view, importer) ignores entity types, properties, effect types and dimensions it doesn't understand. This is what makes incremental growth safe.
3. **Sparse by default.** Optional information lives in attached objects, never as empty columns on the root entity.
4. **Data stores, composition selects, engines act, views show.** Behaviour never lives in data. (From [[30_Data_Architecture]].)
5. **Store IDs, never text.** Every reference is an immutable ID; names are translations.
6. **Raw and structured coexist.** Imports keep their original form next to the structured result; structuring happens when a consumer needs it.
7. **Smart defaults, quiet overrides.** If the standard path works 95 % of the time, the exception stays reachable but out of the way.
8. **D&D first, systems later.** The model targets 5e + homebrew; system-specific meaning lives in rules and engines, not in the data, so other systems remain possible.

## Entities, properties, relations
- **Compound model (2026-09-02).** An entity is a bare **peg** (immutable ID only); every fact is a **component** ("card", one per type, absent when not needed); connections are typed **relations** ("strings"). **Interfaces** replace entity types: registry rows with `requires` / `allows` / block types / allowed relations; a peg asserts membership with the `Typed` card, Validation verifies. Component, interface, relation, projection and renderer definitions are all rows (`component_def`, `interface`, `relation_def`, `projection_def`, `renderer_def`) — extending the system is inserting rows, not migrating. IDs stay opaque (REQ-163): provenance via source metadata, copying only as explicit fork (`forkedFrom`).
- **Entity** — a stored, identifiable thing; its declared shape lives in the interface it claims. Core content types: Creature (PC, NPC), Statblock, Item, Location, Faction, Spell, RuleElement, LoreArticle, Quest, Encounter, ContentBlock, Map, Token, Asset, Layer. Meta types: User, Membership, NarrativeContainer, CampaignSettings, KnowledgeState, WorldDate, CalendarSystem, Note, Term, Tag, SessionState, SessionLog, Board.
- **Property Types** are shared definitions (LocalizedText, Status, Visibility, DiceExpression, Effect, …) referenced by entity types, never copied.
- **Relations** are typed, directed, ID-based edges that may carry their own properties (`carries.quantity`, `partOf.mode`). Backlinks and the graph view are queries over the relation table.
- Hardcoded core set first; the generic template engine (REQ-027) generalizes it later without changing these semantics.

## Identity and history
- `id` — immutable, never reused.
- `key` — language-neutral pseudoname, translation anchor.
- `aliases[]` — alternative names feeding the Registry.
- `successorId` — optional pointer to a newer version. The Resolution engine follows chains to the head, so old links reach the current version. Chains, not trees: variants branch (`variantOf`), successors don't.
- **Change chain** — every change is an entry (who, when, what) along the version chain. Authorship is derived from the chain, never stored on entities; a later view can cherry-pick individual changes.

## Layers, entries, stacks
Replaces the earlier Source / LorePack / module ideas with one concept.
- **Layer** — a container of content contributions with a `type` (`system`, `expansion`, `world`, `pack`, `campaign`, `override-set`) and `dependsOn` links carrying a priority. Nesting is inclusion by link: a layer includes another layer's entries, nothing is copied. Flattening into an independent layer is an explicit expert action.
- **Entry** — the `partOf` relation between an entity and a layer, with `mode` (`adds` / `overrides` / `removes`), `addedAt`, `addedBy`, optional `pinned: true` (default: follow the newest successor visible in the stack; pinned = exactly this peg). Membership is a record of its own; both directions are queries.
- **Resolution rule (D6, 2026-09-02).** Collect the peg and its successors; the peg whose best Entry has the highest layer priority wins; tie within one layer → newest successor. Direct placement into a higher-priority layer replaces pin mechanics for "use this one here"; per-entity priority is deliberately absent — organize via packs. Bulk-placing a layer's content into another layer is a UI operation writing ordinary Entries (a dependent layer achieves the same and stays modular). Whether a new version is a successor or an override is a user choice at write time.
- **Stack** — the resolution context: a campaign activates an ordered set of layers (its own plus dependencies). Reads resolve through the stack at read time. Default precedence: **specificity wins** — campaign › pack › world › expansion › system — with explicit override flags for exceptions. Expert settings (layer priority, per-entry pick, disabling one override) and the final conflict model are deferred → [[20_Decision_Log#AD-13]].
- Git mapping for intuition: layer ≈ branch, entry ≈ commit membership, stack ≈ checkout, adopting another layer's entry ≈ cherry-pick, change chain ≈ log. Unlike git, campaigns never fork content; they overlay it, so there is no merge problem.
- **Variant** (`variantOf`) copies; **override** (`overrides`) replaces within a scope. Both are planned; the precedence between them is decided when the first real case appears → [[20_Decision_Log#AD-14]].

## Dimensions
Optional, sparsely stored property bundles attached to entities or blocks, each with its own rules and engine: Visibility, KnowledgeRequirement, TemporalValidity, Status, Reputation (hook), Provenance. Entity types declare which dimensions they support. New dimensions join without touching existing entities.

## ContentBlocks
The universal primitive for gated, authored content and the **unit of time and divergence**. A block carries text (typed: paragraph, readaloud, fact, secret, poem, song, review, …) plus its dimensions: visibility, knowledge requirement, scope layer, temporal validity, pack membership. An article, a creature's facts, a session's readalouds, an item's secret are all block compositions. Rendering always happens *in a context* (campaign, position in time, unlocked knowledge): the engine gathers blocks from the stack, filters by unlock and validity, and resolves conflicts by precedence. Two campaigns read different articles from the same source. "Event X has happened here" is a campaign-scoped knowledge tag, so temporal unlocks reuse the knowledge mechanism; blocks can additionally gate on a WorldDate threshold.

## References and terms
- The **Registry** matches names and aliases while writing: unambiguous → auto-link, ambiguous → suggestion. Links are `linksTo` relations by ID.
- **Term** entries translate keys per output language with fallback DE → EN → key; untranslated terms (DC, …) pass through. Output is single-language per view. Later, terms carry engine-specific semantic bindings so rule terms evaluate per system.

## Entities vs rules
An entity holds **data** (a spell's level, range, V/S/M components); a **RuleElement** holds **meaning** (how components work, a constraint's condition); an **engine** evaluates rules against data. The rule attachment to an entity is a layer-scoped relation, so 5e 2014 vs 2024 vs homebrew resolve through the stack. RuleElements are reference objects (text, tags, rawContent, SourceRef) with optional `effects[]`: **grants** (`grant_feature`, `add_proficiency`, `modify_stat`, …) and **constraints** (declarative conditions). Effect types are an open list; a rule too complex to express declaratively carries `manual: true` and stays reference. Statblocks are compositions of RuleElement references; traits are reusable and variant-able inline.

## Views and engines
- **View config** per form/view: mode (raw / structured / hybrid), fields, resolution priority when both exist. Hardcoded first; seed of the later Template Manager.
- **Boards** are user-owned configurable views (tabs, widgets); DM screen and player screen are the same mechanism with different defaults. Widgets are projections bound to entities or session state.
- **Three-level ViewConfig (2026-09-02):** a projection defines what *can* be read; a ViewConfig defines what *is* shown. `projection_def` default → board/widget ViewConfig (explicit selection of components, block types, relations) → per-instance tweak. Selection can only narrow; Access and Knowledge filter before layout.
- **Canvas boards & display (2026-09-04, REQ-157…164):** boards additionally carry a free canvas — placements of four kinds (D16: content entities, assets, inline shapes/icons, and interactive tool widgets such as the creature creator), board-level type rules, named viewpoint anchors with depth and quick navigation. Board-first (AD-19): the canvas is v1's entry surface — the DM creates entities on the board, chooses their facet and places them. How something is drawn is a priority negotiation (D13): the entity proposes (Darstellungsprofil), the board rules (per interface/attribute), the user overrides; explicit placement override always wins. Facets (`short` … `full`, `image`, `token`, `map`, `link`) are system-wide and reused on sheets, statblocks and notes; zoom depth maps onto facets (semantic zoom). Renderers are `renderer_def` registry rows, analogous to projections; a `media` parameter (screen/print/pdf/image) lets the same facets drive **print & export** — item cards, creature cards, PDF character sheets, map prints — via the Export engine (D17, REQ-167). Details: [[Data Definitions#5a. Renderers & display (2026-09-04)]].
- **Scope inspector** — a toggleable sidebar on every entity view showing the layer stack behind what is displayed, later with layer actions. Priority 1–2: it is what keeps layering understandable.
- Engines (validation, resolution, knowledge, calculation, registry, rendering, access, logging) subscribe to events; see [[Data Definitions]].

## Assets
One **Asset** entity for every file — maps, portraits, icons, PDFs, audio, 3D — with `backend` (`app` managed small/hot files, `nas` Nextcloud/filesystem path for large files, `external` URL). Consumers ask the asset service for a URL and never care where bytes live. Derived variants (thumbnails, map tiles, PDF page renders) are generated once and stored app-side. **SourceRef** points from content to publication + page + optional asset page anchor. Nextcloud access mode → [[20_Decision_Log#AD-15]].

## Session state
Live, shared objects per session (initiative, now-playing, active scene, party note, play tokens) stored server-side and pushed over one realtime channel; every widget subscribes. **Stewardship** = write permission per state object with configurable GM override. Every mutation is an event (actor, target, delta); persisting them yields the **play log** and its statistics. Play tokens are session- or campaign-scoped (party marker) — same mechanism, longer lifetime.

## Extension points (reserved, not built)
- Multi-system statblock compositions (`system` reference) and per-system rule engines
- Reputation propagation over relation tags
- CalendarSystem behind WorldDate
- Generic template engine over the hardcoded core set
- File/git export via serializable schema
- Field-group edit permissions
- Cherry-picking along the change chain

## Changelog
- **0.3** (2026-09-05): Placement kinds (D16), board-first v1 note (AD-19), print & export via facets (D17).
- **0.2** (2026-09-04): Compound model (peg/card/string, interfaces, `Typed`), Entry `pinned` flag and the D6 resolution rule, three-level ViewConfig, canvas boards with anchors and the facet/renderer display system, opaque IDs.
- **0.1** (2026-08-31): Initial concept consolidating the requirements sessions of 2026-08-28 … 31.
- 
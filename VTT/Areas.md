---
tags: [vtt, areas, requirements]
status: draft
version: 0.3
updated: 2026-09-05
---

# Areas

Functional areas of the platform. Each area is implementable independently on top of the [[33_Backbone_Concept|backbone]]; pick one by mood. Requirements per area: [[Requirements by Area]]. Each section is a transclusion-friendly heading.

Jump: [[#Content Backbone]] · [[#Platform & Access]] · [[#Creatures & Characters]] · [[#Player Experience]] · [[#Campaign & Sessions]] · [[#World & Lore]] · [[#Rules & Reference]] · [[#Live Play]] · [[#Maps]] · [[#Media & Assets]] · [[#Cross-cutting]]

## Content Backbone
**Scope.** Structures and stores content for D&D 5e + homebrew: entity model, identity and history, layers/entries/stacks, dimensions, ContentBlocks, references and terms, rule effects, view configs, the asset contract. No generic TTRPG engine, but nothing that prevents one.
**Prep.** Everything authored lands here; import-first with raw content preserved (Obsidian markdown, 5e.tools JSON, OCR).
**Play.** Resolution — what a given user sees in a given campaign at a given moment — is a backbone concern, not a view concern.
**Key concepts.** Layer, Entry, Stack, ContentBlock, Dimension, Change chain, Registry, Term, SourceRef, Asset.
**Depends on.** — (root). **Feeds.** every other area.
**Status.** Conceptually defined ([[33_Backbone_Concept]]); registry in [[Data Definitions]].

## Platform & Access
**Scope.** Who you are and what you may see or change: authentication, users, membership triples (user + scope + role), visibility evaluation, edit permissions, campaign configuration, scope inspector.
**Prep.** Onboarding players, assigning roles per campaign or world, granting co-editors, configuring house rules.
**Play.** Knowledge grants and visibility resolution must be one-tap fast.
**Decisions.** Password-hash auth behind an interface (OIDC later); roles GM/Player first; full visibility schema stored from day one, only `gm_only`/`campaign` evaluated initially; GM-edits-everything as an overridable default; several people may build one world.
**Depends on.** Backbone (dimensions, layers).

## Creatures & Characters
**Scope.** Creature (identity, description, relations) and Statblock (mechanics as a composition of RuleElements) with PC/NPC specializations; import, quick add, viewers, quick changes, builder, companions, creature knowledge.
**Prep.** Import from 5e.tools / Improved Initiative / Obsidian; minimal edit form; later a builder that suggests traits from origin + MCDM fighting type. Traits are reusable and variant-able inline.
**Play.** Simple viewer (social / description / combat) leads; quick changes (HP, temp, conditions, rest, inspiration); name-only NPC or statblock-only mob in seconds.
**Concepts.** A creature without statblock and a statblock without creature are both valid; several NPCs may share one statblock; raw statblocks are viewable and initiative-trackable before being structured; creature facts are gated blocks on type/species/faction, reusable across campaigns with per-campaign unlock state.
**Depends on.** Backbone, Platform (edit permissions: owner, GM, wardship), Rules (RuleElements).

## Player Experience
**Scope.** The player's own surface: character sheet (General + Inventory first; Combat, Spells, Freeplay later), list inventory (tiles later), local dice, personal notes, quicklinks.
**Design.** Phone-first at the table; the sheet is a view config over Creature + Statblock, not its own data model. Players own their characters; wardship/open editing grantable.
**Play.** Everything here is play-time; prep cost none.
**Decisions.** Dice local first; shared rolls arrive with Live Play's realtime.
**Depends on.** Creatures & Characters, Platform, Live Play (for shared state).

## Campaign & Sessions
**Scope.** The campaign as root NarrativeContainer with attached CampaignSettings, WorldDate, KnowledgeState; DM-definable container hierarchy (Arc, Session, Scene, …); sessions with planned/occurred encounters; readalouds that unlock; quests and personal goals; ideas inbox; bulk actions.
**Prep.** The container view is the DM's prep cockpit: scenes, quests, storylines, encounters, notes in one place. Ideas (status idea/planned/used/discarded) consolidate per campaign or player; a view toggle switches planning vs clean view.
**Play.** DM quick actions: grant knowledge, reveal block, mark encounter occurred — one tap each.
**Decisions.** Encounter is a backbone entity attachable at any container level (campaign-level random encounters); quests deliberately non-crucial and player-creatable; calendar parked (priority 5) because of its lore coupling.
**Depends on.** Backbone (containers, blocks, status), Platform (knowledge state).

## World & Lore
**Scope.** World as scope + layer; articles composed of ContentBlocks and rendered contextually per stack; locations, factions, NPC directory, events/timelines, pantheons; campaign-specific divergence; player-authored blocks; the Bibliothek von Tan'Jit presentation layer; reputation system (future).
**Prep.** Author once at world level; several campaigns consume with independent time position and unlock state. Divergence costs one campaign-scoped block, never a copy.
**Play.** The player wiki grows automatically as knowledge is granted; players contribute whitelisted block types (poems, songs, reviews) so the world becomes a product of many.
**Concepts.** WorldDate (sortable canonical value + CalendarSystem reference) from day one; reputation tags propagating NPC → faction → city with status — hooks now, system later.
**Depends on.** Backbone (layers, blocks, WorldDate), Platform (memberships), Creatures (NPCs).

## Rules & Reference
**Scope.** RuleElements as reference objects; import from Obsidian and 5e.tools; the rules browser with layer origin visible; spells as entities with layer-scoped rule sets; spell lists; pinnable rules; later effect and constraint interpreters and per-system engines.
**Prep.** Structuring rules is optional and incremental; reference value exists from the first import.
**Play.** Contract: any rule found in under five seconds. Term integration matters most here (Plänkler, mythisch, …).
**Concepts.** Data on the entity, meaning in the rule, evaluation in the engine; rule attachment is layer-scoped (2014 vs 2024 vs homebrew).
**Depends on.** Backbone (effects format, terms, layers).

## Live Play
**Scope.** Boards (user-owned configurable views with tabs and widgets; additionally a free canvas with placements of four kinds — entities, assets, inline shapes, tool widgets like the creature creator —, frames/viewpoint anchors, semantic zoom and the facet/renderer display system, REQ-157…166; v1 entry surface per AD-19), session state objects with a realtime channel, stewardship, initiative tracker, encounter runner, quick-create, reference box, notes, timers, party, quest board, generators, sound (embedded first), play log and statistics, combat player view.
**Prep.** Configure boards once; soundboard is the one high-prep-cost widget (integrate first).
**Play.** All of it. Session-aware widgets pull PCs from campaign membership and encounters from the session container. Damage attribution defaults to the current actor, changeable quietly. Multiple tabs/windows per user are natural because state lives once on the server.
**Decisions.** Improved Initiative as benchmark for the tracker, Soundtale for sound; music native at priority 5.
**Depends on.** Backbone (session state, containers), Platform (stewardship), Creatures, Campaign & Sessions.

## Maps
**Scope.** Map entity with grid config; nested maps with anchor regions and zoom-through transitions (world → region → city → district → battlemap) with level lock; static tokens (reference markers, scenery) and play tokens (session- or campaign-scoped, e.g. party marker); overlays; fog of war, light/LoS, effects, drawing, editor later.
**Prep.** High: every map is image work before it earns anything. Nested anchors add setup.
**Play.** Static nested viewer with party marker is the first table-usable step; play tokens follow Live Play's state objects.
**Concepts.** Token = what it is (marker / prop / creature) × lifecycle (static / play). Map hierarchy and location hierarchy are parallel but independent.
**Depends on.** Media & Assets (image asset, tiling), Live Play (state objects), World & Lore (locations).

## Media & Assets
**Scope.** Asset service implementation for the dual storage: app-managed (icons, portraits, thumbnails) and NAS/Nextcloud (3D, audio, source PDFs, large maps), plus external URLs; derived variants; PDF viewer with page-anchor jumps; audio and 3D later; OCR import (MonsterBox-style) later. Print & export outputs (item/creature cards, PDF character sheets, map prints) rendered from facets via the Export engine (REQ-167).
**Prep.** Uploading and organizing assets; provenance to rulebook pages.
**Play.** Jumping from a statblock to page 213 of the source book.
**Decisions.** Designed early (contract at priority 1), viewers late.
**Depends on.** Backbone (Asset entity, SourceRef).

## Cross-cutting
German UI output with i18n-ready strings; phone-first responsive design as a hard criterion for the component library; deployment as container(s) on the NAS with reverse proxy, TLS and remote access; backups. Principle for every UI: smart defaults, quiet overrides.

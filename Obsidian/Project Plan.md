---
tags: [vtt, project, meta]
status: living
version: 0.5
updated: 2026-09-05
---

# VTT Project Plan

Goal: a self-hosted, web-based platform (working title **TTRPG Platform**) for worldbuilding, campaign management, characters/creatures and live-play tooling, running on a self-hosted server. D&D 5e + homebrew first, built as an expandable framework.

## Guiding principles
- **Framework first, features by mood.** The backbone ([[33_Backbone_Concept]]) is defined thoroughly; each area ([[40_Areas]]) is implemented independently, whenever interest strikes, without touching the backbone.
- **Table-usable ASAP** inside that frame: each area's first slice must be usable at the table.
- **Smart defaults, quiet overrides.**
- **Ignore what you don't know** — consumers skip unknown types, properties, effects, dimensions.
- **Sparse by default**, **store IDs never text**, **raw and structured coexist**.
- **DM-first, phone-first** for players.

## Constraints
- < 5 hrs/week, evenings. 1 effort point ≈ one evening. Priority 1–2 at full depth is 225 points; the v1 cut ([[Scope v1]]) brings it to 131 by building backbone contracts at stub/minimal depth. Still ~130 evenings — v1 is a year of evenings, not a season; each step delivers something table-usable along the way.
- Solo development; multi-author *content* is a feature, multi-author *code* is not assumed.

## Vault structure (this project)
| File | Purpose | Status |
|---|---|---|
| [[00_Project_Plan]] | This note: principles, phases, working mode | living |
| [[Requirements]] | Global registry, immutable IDs, priority/effort/lens | living |
| [[Requirements by Area]] | Derived per-area views | derived |
| [[20_Decision_Log]] | ADR-light decisions | living |
| [[30_Data_Architecture]] | Tiers and vocabulary (from the data-architecture session) | draft |
| [[31_Data_Model_Graph]] | Interactive entity graph (HTML) | draft |
| [[Data Definitions]] | Living registry v0.5 — compound model (pegs/cards/strings, interfaces), components, relations, entities, compositions, projections, renderers, engines, events | living |
| [[Schemas]] | Complete schemas v1.1: all components, interfaces, global relations, projections, renderers/facets/canvas, decisions D0–D16 | living |
| [[35_Data_Architecture_Overview]] | Mobile interactive architecture overview (HTML) with three use-case walkthroughs; registry tier incl. renderer_def | present |
| [[33_Backbone_Concept]] | Mechanisms of the backbone and why | draft |
| [[40_Areas]] | Area definitions | draft |
| [[Scope v1]] | v1 cut with depth levels and build order | draft |
| [[Glossary]] | Terms, descriptions, mentions | living |
| Requirements.md, Overview.md, Services.md, … | Original notes — source material, superseded where covered above | archive |

## Phases
### Phase 0 — Concept (done 2026-08-31)
Requirements per area, backbone concept, decisions, naming reconciled (AD-16), v1 cut (AD-18). Persistence confirmed 2026-09-02 (AD-01/D0: three tables, Postgres, no Directus).

### Phase 1 — Architecture
- Registry v0.5 in place (compound model, renderers/facets); data-model proposals D2, D5, D7–D10 to confirm
- Decide AD-03/04/05/12 (frontend, library, backend shape, deployment)
- Service & API design; realtime channel design; asset service; view config format
- Diagrams (Mermaid): entity/relation map, tiers, engines & events, service/deployment view

### Phase 2 — v1 (150 points, [[Scope v1]], board-first per AD-19)
Step 1 skeleton (deploy, auth, membership, core entities, one world + one campaign layer, stack, visibility flag), then **step 2 board canvas** (create a board, create entities on it, choose facet, place; assets and basic shapes; minimal renderers) as the surface everything else lands on — then Creatures, Player sheet, Campaign, Rules, GM-only initiative, independent and by mood.

### Phase 3+ — Areas by mood
First post-v1 area: Live Play proper (boards, realtime session state, stewardship). Then Rules depth (composition, effects), World & Lore depth (temporal validity, packs), Maps, Media viewers.

## Working mode
1. Sessions are chat-driven, one topic at a time; when Basil says **stop**, Claude writes decisions and changes back into the vault files (registry: append changelog entries, never restate).
2. Requirements: add with the next free ID, never renumber; drop by status.
3. Every new term goes into [[Glossary]] with its mentions.
4. Priorities and efforts are re-estimated per area when that area is picked up.
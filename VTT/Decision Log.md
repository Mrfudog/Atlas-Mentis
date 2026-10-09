---
tags: [vtt, decisions, architecture]
status: living
version: 0.6
updated: 2026-10-07
---

# Decision Log

Lightweight ADR format: context, options, decision or recommendation, status (`open` · `decided` · `deferred`). Entries are never deleted; superseded ones get a note. IDs are immutable.

## Framing decisions (2026-08-31)
| ID | Decision | Status |
|---|---|---|
| AD-00a | Time budget < 5 hrs/week; effort scale calibrated to evenings (see [[Requirements#Scales]]) | decided |
| AD-00b | Philosophy: table-usable ASAP **within** a thoroughly defined backbone; areas implemented by mood, independently | decided |
| AD-00c | Requirements defined per area before architecture; numeric priority 1–5, Fibonacci effort, prep/play/prep-cost lens | decided |
| AD-00d | Principle: smart defaults, quiet overrides | decided |

## AD-01 · Data storage strategy
**Context.** Early notes proposed MongoDB over yaml/json files.
**Decision.** Conceptual model as in [[33_Backbone_Concept]]; persist as relational core (Postgres, SQLite while single-user) + JSONB property bags + one relation table; optionally fronted by Directus. Schema kept serializable for later file/git export (REQ-029). Recommendation from the data-architecture session; confirm when the walking skeleton starts.
**Tech confirmation (2026-09-02, D0).** Three generic tables (`entity` · `component` · `relation`) plus the registry rows (`component_def`, `interface`, `relation_def`, `projection_def`, `event_def`) and an append-only `event_log`; optional SQL views per interface added when needed; **Postgres; no Directus**.
**Status.** decided

## AD-02 · Git-based branching of content
**Decision.** Not needed. Layers + entries + stack resolution give overlay semantics without forks or merges ([[33_Backbone_Concept#Layers, entries, stacks]]). Git remains an export option only.
**Status.** decided — superseded by AD-13/AD-14 for the remaining conflict questions

## AD-03 · Frontend: microfrontends vs modular monolith
**Recommendation.** One Angular app with lazy-loaded feature modules per area.
**Status.** open

## AD-04 · Framework and component library
**Context.** Angular; phone-first is a hard requirement (REQ-069); DM boards need a grid/widget system (REQ-111).
**Recommendation.** Angular 20+ with signals and standalone components; pick a component library with solid mobile behaviour and theme it later; evaluate angular-gridster2 / gridstack for boards (was AD-07).
**Status.** open

## AD-05 · Backend granularity
**Recommendation.** Modular monolith exposing one API, with a realtime channel for session state (REQ-116) as the first candidate for a separate process later.
**Status.** open

## AD-06 · Authentication
**Decision.** Password-hash check behind an auth interface; OIDC/Nextcloud SSO later (REQ-032). Onboarding: GM-created accounts or plain invite link, whichever is cheaper; low security bar accepted initially.
**Status.** decided

## AD-07 · DM screen technology
Merged into AD-04.
**Status.** merged

## AD-08 · Build vs integrate (sound, battlemaps)
**Decision.** Integrate first. Sound widget embeds/links external tools with only now-playing state native; native music engine priority 5. Maps stay small: static nested viewer first, battlemap features 4–5.
**Status.** decided

## AD-09 · Visibility model
**Decision.** Store the full Access_Visibility schema as a sparse dimension from day one; evaluate only `gm_only`/`campaign` initially; field-level secrets are separate gated ContentBlocks, not per-field ACLs. GM-edits-everything is an overridable default.
**Status.** decided

## AD-10 · Language strategy
**Decision.** Language-neutral keys (pseudonames) with Term translations; output single-language per view; German first, untranslated terms pass through; UI German with i18n-ready strings.
**Status.** decided

## AD-11 · Realtime
**Decision.** Content reads stay request/response. Session state objects travel over one realtime channel per session (websocket). Introduced with Live Play, not before.
**Status.** decided

## AD-12 · Hosting & deployment
**Question.** Docker on NAS, reverse proxy/TLS, remote player access, DB backups.
**Status.** open (REQ-154, REQ-155)

## AD-13 · Stack conflict resolution
**Context.** Layers nest by link with priority; entries may override.
**Decision so far.** Layer priority first; per-entry manual pick and disabling a single override as expert settings; flattening into an independent layer is explicit. Whether a parent layer's stack settings inherit into included layers is open. Final model when the first real conflict appears.
**Status.** deferred

## AD-14 · Variant vs override precedence
**Decision so far.** Both mechanisms exist (`variantOf`, `overrides`). Default precedence is specificity: campaign › pack › world › expansion › system; explicit override flag for exceptions. Expected trigger: campaign-specific lore divergence (REQ-108).
**Status.** deferred

## AD-15 · Nextcloud access for NAS assets
**Options.** Mounted filesystem path vs WebDAV API.
**Status.** open (REQ-146)

## AD-16 · Naming reconciliation with the data-architecture registry
**Context.** Terms coined in the requirements sessions diverge from [[Data Definitions]].
**Proposed renames.** Architecture strata (data / composition / engine / view) → **tiers**, so **Layer** is free for content layers · `Source` and `LorePack` → **Layer** types `system`/`expansion` and `pack` · `Attachment` → **Asset** (avoids clash with `attachedTo`) · `Date` → **WorldDate**, plus new **CalendarSystem** · `Provenance` value → **SourceRef** (relation stays `sourcedFrom`) · new: **Entry** (`partOf` relation with properties), **Dimension**, **SessionState**, **Stewardship**, **Board**, **Token**, **Change chain** (replaces `createdBy` on Identity).
**Decision.** Confirmed 2026-08-31. Merged into [[Data Definitions]] v0.3 (single file).
**Status.** decided

## AD-17 · Requirements storage format in the vault
**Options.** One table in [[Requirements]] (current; simple, greppable) vs one note per requirement (Dataview-queryable, 155 files) vs table + CSV read via DataviewJS.
**Status.** open — start with the table; revisit when Dataview views are wanted

## AD-18 · v1 scope and depth levels
**Context.** Priority 1–2 at full depth is 225 points; the backbone must be *defined* fully but *built* only as deep as v1 needs.
**Decision.** Every priority-1/2 requirement gets a v1 depth (full · minimal · stub · later) and v1 points; v1 = 131 points across 66 items ([[Scope v1]]). Deferred: statblock composition and rule attachment (REQ-053/094), boards and their widgets (REQ-111–114), realtime session state (REQ-116), NAS asset backend (REQ-146). v1 initiative tracker is a GM-only page. All deferred items keep their data shape reserved.
**Status.** decided

## AD-19 · Board-first v1
**Context.** AD-18 deferred boards entirely; v1's entry surface was a fixed GM page. Decision of 2026-09-05: the board canvas is the better spine for v1 — a DM creates a board, creates entities directly on it, chooses their facet and places them; everything else (viewers, sheets, trackers) hangs off that surface.
**Decision.** v1 starts with the board UI after the walking skeleton. Pulled into v1 at reduced depth: REQ-111 (one board per user, no pages), REQ-157 (canvas), REQ-158 (placement rendering), REQ-161 (resolution as stub: placement override + renderer default only), REQ-164 (facets short/full/image/token), REQ-165 (asset + basic shape placements; tool placements later), REQ-166 (create-on-canvas). Still post-v1: anchors/quick navigation (REQ-159/160), semantic zoom (REQ-162), board typeRules and entity DisplayProfiles (full REQ-161), realtime (REQ-116), widget set REQ-112–114.
**Status.** decided (amends AD-18; [[Scope v1]] v0.3)

## Data-model decisions (D-series)

Fine-grained decisions of the compound data model. Source and schemas: [[Schemas]] (decisions table D0–D10); walkthrough of 2026-09-02; boards/display session of 2026-09-04. Same rules as AD entries: IDs immutable, superseded entries get a note.

| # | Question | Decision / current proposal | Status |
|---|---|---|---|
| D0 | Persistence (= AD-01 tech) | three tables → SQL views per interface when needed; Postgres; no Directus | **decided** 2026-09-02 |
| D1 | core/dimension `kind` on components | dropped; `engine` on `component_def` is optional documentation only; "dimension" stays as glossary shorthand for engine-owned components | **decided** 2026-09-02 |
| D2 | `allows` strict vs open | leading proposal (hybrid): strict by default; `expertMode: true` per layer opens it for experiments; `universal: true` per component (Visibility, Status, notes) attachable regardless of `allows` | open |
| D3 | key uniqueness | per layer (follows from D6) | **decided** 2026-09-02 |
| D4 | statblock rule elements | Statblock is an **entity** (peg), not a component — shareable, versionable, layerable; mechanics as a card on the statblock peg; rule elements hang off it via `composedOf` strings; the earlier flattening was an error and is reversed | **decided** 2026-09-02 |
| D5 | interface membership | asserted via `Typed` card, verified by Validation | open (proposal) |
| D6 | stack resolution rule | collect the peg **and its successors**; winner = the peg whose best Entry has the highest layer priority; tie within one layer → newest successor; Entry modes adds/overrides/removes; `pinned: true` on an Entry = "exactly this peg, not its successors" (replaces `pinnedVersion`); **direct placement** of an entity into a layer replaces pin mechanics; **no per-entity priority** — organization via packs/layers; bulk-placing a layer's content = UI bulk operation writing ordinary Entries (a dependent layer achieves the same and stays modular); override vs successor is a **user choice at write time** | **decided** 2026-09-02 |
| D7 | visibility inheritance | `inherit: true` on Visibility, evaluated by Resolution → requirement REQ-156 | open (proposal) |
| D8 | derived values | computed on read by Calculation; not stored | open (proposal) |
| D9 | ownership cascade | API layer, driven by `owned: true` in the registry; no DB triggers | open (proposal) |
| D10 | id and key conventions | UUID v7; key = `type/slug` lowercase | open (proposal) |
| D11 | display as definition row | `renderer_def` analogous to `projection_def`: reads components, delivers facets with a drawing template, applicable per interface; renderers are not engines (read-only, no events, no mutual calls) | **decided** 2026-09-04 |
| D12 | placements | placements live in the **board ViewConfig**, not the layer system; if boards should later be shareable/versionable, the **board itself** becomes an entity while placements stay a config blob inside it — no promotion of placements to entries | **decided** 2026-09-04 |
| D13 | display resolution | priority negotiation: entity proposes (Darstellungsprofil with priority, optionally per context), board decides (typeRules per interface/attribute with priority), user overrides (board rule or per placement; explicit placement override always wins); tie → board rule beats entity profile; fallback `renderer_def` default; works board-only without per-placement config | **decided** 2026-09-04 |
| D14 | facets | Darstellungsstufen (`short` · `description` · `full` · `image` · `token` · `map` · `link`) are a **system-wide, extensible** value set, reused across boards, character sheets, statblocks, session notes; zoom depth / ViewPoints map onto facets (semantic zoom) | **decided** 2026-09-04 |
| D15 | ID semantics | peg IDs stay **opaque** — no pack/world/type/version encoded (rejected: `pack-world-entityType-number`); provenance via metadata (`source_pack`, `source_version`, `imported_from`); version freezing via `pinned: true`; copying only as explicit **fork** (new peg + `forkedFrom` relation). Rationale: semantic IDs couple identity to mutable properties and force renumbering, which breaks relations; copy-on-import bypasses the Stack/Entry overlay | **decided** 2026-09-04 |
| D16 | placement kinds | a canvas placement is one of `entity` (peg reference) · `asset` (file reference) · `shape` (inline geometry/icon primitive — no peg, lives only in the CanvasConfig) · `widget` (interactive tool instance on the canvas: creature creator, generators, forms). Shapes deliberately create no entities; tools reuse the existing Widget mechanism embedded on the canvas | **decided** 2026-09-05 |
| D17 | print & export | output generation reuses the display system: the **facet** defines what appears (item card = e.g. `short`+`image`, character sheet = `full`), an additional **medium** parameter on `renderer_def` (screen · print · pdf · image) defines how it is drawn; an **Export engine** renders facets through renderer templates to PDF/PNG; page assembly (n cards per sheet, margins, bleed) is export configuration, not a renderer concern | **decided** 2026-09-05 |


## Modellentscheidungen aus dem Bau (2026-09-19 bis 2026-10-07)

Seit dem Prototyp werden Modellentscheidungen dort festgehalten, wo das Modell steht: [Datenmodell.md](../docs/Datenmodell.md) (die Regel), [Begriffe.md](../docs/Begriffe.md) (das Warum), [Durchgang.md](../docs/Durchgang.md) (der Abgleich A1–A16 mit diesem Konzept). Die wichtigsten, damit dieses Log vollständig bleibt:

| ID | Topic | Decision | Status |
|---|---|---|---|
| D25 | Prototyp vor Stack | Artikel-Engine zuerst als Artefakt, dann Angular + Fastify + Postgres (AD-26) | **decided** 2026-09-19 |
| D27 | Komponenten | keine Komponenten neben Typen: eine Art trägt ihre Felder, Geteiltes wohnt in einem Obertyp, `extends` ist ein Array; `requires`/`allows` entfallen (ersetzt D2, D5) | **decided** 2026-09-20 |
| D28 | Register steht einmal | `packages/registry` ist die einzige Quelle; `emit-seed` schreibt den Prototyp | **decided** 2026-09-20 |
| D29 | Textblöcke | ein Block ist ein Feld mit `many` + `long`; die Wissensfreigabe hängt an der Eintrags-Id | **decided** 2026-09-21 |
| D30 | Bezeichner | `Identity.id` = Typ-Nummer, beim Anlegen vergeben, danach unverändert (präzisiert D10/D15) | **decided** 2026-09-21 |
| D31 | Sichtbarkeit | drei Felder (`audience`, `revealedTo`, `hiddenFrom`), `public` als Vorgabe, keine Vererbung (ersetzt D7/REQ-156 bis auf Weiteres) | **decided** 2026-09-30 |
| D32 | Rollen | die Rolle am Tisch steht am Konto je Kampagne (`campaign_member`), nie im Artikel; wem ein Artikel gehört, sagt die Ebene | **decided** 2026-10-01 |
| D33 | Statblock | ohne Statblock keine Zahlen; Vorlage und Instanz: eine Instanz je Kreatur speichert nur Abweichungen (`instanceOf`, `resolveInstance`) | **decided** 2026-10-01 |
| D34 | Betrieb | `preprod` → dev, `main` → prod auf Hetzner; nur CI baut das Abbild; Durchstich gegen Postgres | **decided** 2026-10-01 |
| D35 | A1 Spieler am Konto | `PlayerCharacter.player` und `playedBy` entfallen; wer eine Figur führt, steht in `app_user_actor` | **decided** 2026-10-07 |
| D36 | A5 Wörter statt Zeilen | `Arc`, `Chapter` → `Story.kind`; `Era`, `Cataclysm`, `Milestone` → `Event.kind`; `Consumable` → `Item.itemType` | **decided** 2026-10-07 |
| D37 | A3 Regelartikel | Zustände und Reisehandlungen sind `Rule`-Artikel (`kind` condition / travel), keine Einstellung | **decided** 2026-10-07 |
| D38 | A6 Das Token | wo die Gruppe ist, sagt ihr Token auf der feinsten Karte; gröbere Karten bilden es durch den Rahmen ab; `Party.at` entfällt | **decided** 2026-10-07 |
| D39 | A7 Fraktionsränge | eine Fraktion weiss nichts, ihre Mitglieder wissen: `Faction.ranks`, `memberOf.rank`, Mindestrang an `knownBy` (REQ-203) | **decided** 2026-10-07 |
| D40 | A10/A12 | `Statblock.kind` heisst `creatureType`; `regards` ohne `PlayerCharacter` | **decided** 2026-10-07 |
| D41 | Arbeitsweise | ein Zweig je Anliegen, Pull Request nach `preprod` (automatisch gemergt), nach `main` nur mit Freigabe; kleine Commits; Doku im selben Commit | **decided** 2026-10-07 |
| D42 | Ein Repo, eine Richtung | Code und Vault in `Mrfudog/atlas-mentis`; Nebelwacht wird archiviert. Kein generisches VTT, sondern die Seite für eine Leitung und ihre Gruppen: Anforderungen aus Nebelwacht haben Vorrang vor den generischen; einschneidende Änderungen entscheidet die Verwaltung | **decided** 2026-10-07 |
| D43 | A8 Party statt Group | `Group` ist weg; die Gruppe ist das Figurengefüge einer Runde (`Party`, `partyOf` → `Campaign`, `memberOfParty`); Träger sind Creature, Party, Faction | **decided** 2026-10-07 |
| D44 | A11 Welt mit Kalender | neue Art `World` mit `calendar`, Kante `inWorld` (Campaign → World); `Time.calendar` und die Einstellung `calendar` entfallen | **decided** 2026-10-07 |
| D45 | A2 Stapel im Modell | `packages/model/src/stack.ts`; der Server siebt mit `inPlay` vor der Sichtbarkeit, für jeden | **decided** 2026-10-07 |
| D46 | A4, A14, A15 | F1 ergänzt (gepflegte Wortlisten dürfen Zeilen sein); `Session.recap`, `Article.poem`/`song`, `followsFrom` entfallen; A9 Regeltypen später, A13 bestätigt | **decided** 2026-10-07 |
| D47 | 5e.tools als Grundlage des Bestands | Alles auf 2014-Basis (ohne XPHB/XMM/XDMG, ohne Bücher auf 2024-Regeln, ohne UA); einmal übernommen als Artikel unserer Typen, nichts zeigt zurück auf 5e.tools; Seite nur mit Anmeldung, spätere Demo nur SRD (`Source.srd`); alles englisch, Mike übersetzt danach selbst (P8); eine Systemebene; Vehikel/Bastionen/Decks und Bilder später — `docs/5etools-Arbeitsplan.md` | **decided** 2026-10-08 |
| D48 | Regeltypen | Messlatte: eine Regelart wird ein Typ, wenn ein Feld oder eine Kante sie als Art verlangt oder sie eigene Felder trägt. Neu: `Condition` (Stufen über `stage`/`stageOf`, Erschöpfung als sechs Zustände, `Vitals.exhaustion` fällt weg), `Disease` erbt `Condition`, `ActionType`, `Action` (ohne Angriffsfelder), `Feature`, `ItemProperty`; Kante `affects` für Wirkungen zwischen Regeln (bewirkt, verbietet, Vor-/Nachteil), vorerst nur Daten; `Rule.kind` wird Zeile `RuleKind`, nicht mehr Pflicht — Arbeitsplan §2. Dazu aus Paket P2: `Hazard`, `Deity`, `Faction.goal`, `Table.columns`, `Source.srd`, `overrides` nur innerhalb einer Art. `Spell` kommt mit P3, `featureOf` mit P4 | **decided** 2026-10-09 |
| D49 | Zauber und Gegenstände (P3) | `Spell` erbt `Rule`; die Wirkzeit zeigt bei Aktion, Bonusaktion, Reaktion auf den `ActionType`; welche Zustände ein Zauber bewirkt, ist die Kante `affects` (imposes) und kein Feld `conditions`; wer ihn wirkt, die Kante `casts` mit `mode`/`uses`/`level`/`charges`. Zauberwirken am Statblock, SG und Angriff gerechnet — dafür löst eine Rechnung nach der eigenen Karte gegen die übrigen Karten des Artikels auf (`modOf`). `Item.itemType` und `rarity` englische Aufzählungen **am Feld** (eine Zeile erst mit dem zweiten Nutzer, F1); `instanceOf` und `carries` auch am Gegenstand, die Instanz in der Art ihrer Vorlage (`same`) | **decided** 2026-10-09 |

## Changelog
- **0.9** (2026-10-09): D49 entschieden (Zauber und Gegenstände, Paket P3).
- **0.8** (2026-10-09): D48 entschieden (Regeltypen, Paket P2).
- **0.7** (2026-10-08): D47 entschieden (5e.tools auf 2014-Basis), D48 vorgeschlagen (Regeltypen).
- **0.6** (2026-10-07): D25–D46 aus dem Bau nachgetragen; Modellentscheidungen leben seither in diesem Repo.
- **0.5** (2026-09-05): AD-19 board-first v1; D16 placement kinds; D17 print & export via facets/media.
- **0.4** (2026-09-04): AD-01 tech confirmed via D0. New D-series section consolidating the data-model decisions D0–D10 ([[Schemas]]) with post-walkthrough statuses (D1/D3/D4/D6 decided) and D11–D15 from the boards/display session.
- **0.3** (2026-08-31): AD-16 decided, AD-18 added.
- **0.2** (2026-08-31): Resolved AD-01/02/06/08/09/10/11, merged AD-07, added AD-00, AD-13 … AD-17.
- **0.1** (2026-08-28): Initial twelve questions.
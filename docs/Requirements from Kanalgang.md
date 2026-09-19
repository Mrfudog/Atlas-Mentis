---
tags: [vtt, requirements, harvest, kanalgang]
status: draft
version: 0.2
updated: 2026-09-19
related: "[[Requirements]], [[Requirements by Area]], [[Scope v1]], [[Decision Log]]"
---

# Requirements from Kanalgang

Harvested from the "Aus Nebel wacht" session tracker (`Mrfudog/Nebelwacht`, `src/App.jsx`) — the tool that actually ran eight sessions. Its **data is not being ported**; its *experience* is. These are mechanics that proved useful at the table and that [[Requirements]] does not currently cover.

IDs continue the immutable numbering from REQ-167 ("add with the next free ID, never renumber"). All carry status `idea` until you triage them.

Scales follow [[Requirements]]: **Prio** 1 backbone-critical · 2 first table use · 3 full v1.0 · 4 expansion · 5 idea parking. **Effort** Fibonacci, 1 point ≈ one evening.

**Totals if fully adopted: 31 requirements · 84 points.** Priority 1–2 subset: 7 requirements · 18 points. (28 geerntet, 3 im Gespräch entstanden.)

## Reuse and composition

These serve the stated goal — *"there should be reuse where possible, therefore rules, traits, feats etc. should come from a pool"* — most directly.

| ID | Requirement | Prio | Eff | Areas | Phase | Value | Depends on | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| REQ-174 | Parameterised rule templates: `{VAR}` placeholders in RuleElement text, bound per reference; resolution order reference → entity → campaign register | 2 | 3 | Rules & Reference, Content Backbone | prep | efficiency | REQ-089 | idea | Without it, `composedOf` (REQ-053) only reuses rules needing no variation — which is almost none. One "Weapon Attack" rule, bound differently by every statblock |
| REQ-181 | Ad-hoc fields on a single entity, promotable into the interface definition | 2 | 3 | Content Backbone | prep | efficiency | REQ-001 | idea | **Conflicts with D2** (`allows` strict). Suggested resolution: unpromoted fields live in a reserved component; promotion is an explicit action that writes the `interface` row |
| REQ-182 | Relation inverse labels in `relation_def`, so one stored edge renders correctly from both ends | 2 | 1 | Content Backbone | both | enables | REQ-001 | idea | Schema gap in `meta/relation`. Gläubiger ↔ Schuldner, Anführer ↔ Untergebene/r. Cheap now, painful once data exists |
| REQ-176 | Similarity suggestions on create: fuzzy name/text matching proposes existing entities before a duplicate is made; promote-to-reference in one action | 3 | 3 | Content Backbone | prep | efficiency | REQ-013 | idea | REQ-013 matches names and aliases; near-misses are what actually cause duplicates |
| REQ-175 | Inline rule reference panel: text scanned against RuleElement names and aliases, matches shown as an expandable block in the view | 3 | 2 | Rules & Reference | play | efficiency | REQ-013, REQ-089 | idea | Serves REQ-098's sub-5-second lookup without anyone having to author links |

## Knowledge and revelation

| ID | Requirement | Prio | Eff | Areas | Phase | Value | Depends on | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| REQ-177 | Field-level knowledge gating: grant individual components or fields of an entity, not only ContentBlocks | 2 | 3 | Platform & Access | both | enables | REQ-040 | idea | `KnowledgeRequirement` currently attaches only to ContentBlock. The old app gates per field and uses it constantly |
| REQ-178 | Cover names: an entity may carry a player-facing alias shown while its identity is ungranted | 3 | 1 | World & Lore, Platform & Access | play | enables | REQ-177 | idea | Cheap, and it is what makes partial revelation playable rather than just hiding things |
| REQ-179 | Known-unknowns disclosure: a gated view may reveal the count of withheld facts without revealing them | 4 | 1 | Platform & Access | play | enables | REQ-059 | idea | "…und 3 weitere Eigenheiten". Tells players there is more to learn, which drives investigation |

## Exploration and travel

No requirement in [[Requirements]] covers a point-crawl. The Maps area (REQ-130–144) is entirely battlemap and region imagery; a crawl is a graph, not a picture.

| ID | Requirement | Prio | Eff | Areas | Phase | Value | Depends on | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| REQ-168 | Point-crawl travel: node/edge graph attached to a Location, with per-edge sensory read-aloud text and per-node arrival state | 3 | 5 | Maps, World & Lore | both | enables | REQ-103 | idea | The per-edge "signal" text is the part that makes it run at the table — what the party perceives before choosing a direction |
| REQ-169 | Exploration state ladder per map feature (verborgen → entdeckt → erkundet) with cascade: exploring a node reveals its edges as discovered | 3 | 3 | Maps, Content Backbone | play | enables | REQ-168, REQ-010 | idea | A progressive-disclosure dimension, adjacent to Visibility but not the same thing |
| REQ-170 | Travel resource cadence: consumables consumed every N nodes or watches, configurable per travel ruleset | 4 | 2 | Live Play | play | enables | REQ-168 | idea | |
| REQ-171 | Per-node action budget: one action per character per node from a configurable list (sneak, craft, forage, rest) | 4 | 3 | Live Play | play | enables | REQ-168 | idea | |
| REQ-193 | Territory overlays rasterised onto the map grid from shapes (rect, circle, ellipse, polygon) | 4 | 3 | Maps | both | efficiency | REQ-130 | idea | Refines REQ-137, which is query-driven highlights rather than authored areas |

## Encounters, tables and world state

| ID | Requirement | Prio | Eff | Areas | Phase | Value | Depends on | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| REQ-172 | Weighted encounter tables per region, with per-location type constraints and safety states that restrict the pool | 3 | 3 | Campaign & Sessions, Live Play | both | efficiency | REQ-085 | idea | Makes REQ-085's "dice-table semantics" concrete. Weights per region across encounter kinds; a location may allow only some kinds; a secured location rolls nothing |
| REQ-173 | World-state decay between sessions: roll to degrade secured locations, weighted by adjacency to faction territory | 4 | 3 | Campaign & Sessions | prep | enables | REQ-172 | idea | The old app's "Zeitsprung". The map changes without the DM authoring the change |
| REQ-186 | Nested loot tables: a table entry may reference another table, with cycle protection | 3 | 2 | Live Play | both | efficiency | REQ-085 | idea | `LootTable.yields → Item {weight, range}` is currently flat |

## Prep and flow

| ID | Requirement | Prio | Eff | Areas | Phase | Value | Depends on | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| REQ-180 | Narrative seeds: planted threads with category (Backstory · Geheimnis · Faden · Idee · Versprechen · Konsequenz) and status (offen · gepflanzt · aufgegangen · verworfen), bound to a character and the session planted in | 3 | 3 | Campaign & Sessions | both | enables | REQ-023 | idea | Distinct from REQ-084 ideas inbox and REQ-023 status: this tracks *payoff*, per player. The single most-used prep feature of the old app |
| REQ-188 | Cross-type "unfinished" overview: everything at status idea/planned across all interfaces, with jump-to and bulk status change | 3 | 2 | Campaign & Sessions | prep | efficiency | REQ-023, REQ-088 | idea | |
| REQ-189 | Aggregated todo list across containers and entities (campaign, arc, session, quest, NPC) | 3 | 2 | Campaign & Sessions | prep | efficiency | REQ-078 | idea | |
| REQ-190 | Quick capture during play: one field that files a seed, todo or idea against the current session without leaving the view | 3 | 2 | Live Play | play | efficiency | REQ-180 | idea | Narrower and cheaper than REQ-114's quick-create widget, and used far more often |

## Player-facing

| ID | Requirement | Prio | Eff | Areas | Phase | Value | Depends on | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| REQ-187 | Table display mode: a shared read-only presentation view for a screen at the table, distinct from per-player accounts | 3 | 2 | Live Play, Cross-cutting | play | enables | REQ-038 | idea | Every access requirement (REQ-031–036) assumes accounts; a beamer or table tablet has none |
| REQ-183 | Party-owned inventory as a shared container distinct from character inventories | 3 | 2 | Player Experience | both | enables | REQ-064 | idea | REQ-064 is per-character, REQ-086 is an overview — neither owns the party purse |
| REQ-194 | Mobile navigation: the user chooses which entries occupy the phone bottom bar | 4 | 1 | Cross-cutting | both | efficiency | REQ-069 | idea | Refines REQ-069 |

## Systems and safety

| ID | Requirement | Prio | Eff | Areas | Phase | Value | Depends on | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| REQ-191 | Fail-closed persistence: a failed load or migration must never be overwritten by a later autosave; the unreadable state is preserved and downloadable | 1 | 2 | Cross-cutting | both | enables | — | idea | The lesson that nearly cost the campaign. In the old app a load error installs defaults and the autosave then overwrites everything 700 ms later. Not covered by REQ-155 backups |
| REQ-192 | Optimistic concurrency for non-realtime edits: per-entity revision check; the second writer is rejected with a merge prompt rather than silently winning | 2 | 3 | Cross-cutting, Platform & Access | both | enables | REQ-001 | idea | REQ-116 covers realtime session state; ordinary two-device editing is unspecified |
| REQ-184 | Crafting: recipes with material inputs, skill checks and DC, time, and output; consumption on completion | 4 | 5 | Rules & Reference, Player Experience | both | enables | REQ-064, REQ-089 | idea | The campaign's essence/reagent/scrap economy. Currently a catalogue with no mechanic |
| REQ-185 | Non-coin economies: barter and alternative currency ladders per region | 5 | 2 | World & Lore | play | enables | — | idea | Unterwacht trades salt → hardtack → salted meat rather than coin |
| REQ-195 | Statblock export back to Obsidian markdown, preserving `{VAR}` placeholders unresolved | 4 | 2 | Rules & Reference, Media & Assets | prep | efficiency | REQ-174, REQ-029 | idea | Optional — sits against the decision that Obsidian is import-only. Listed because the old app's export resolves variables into literals, and that loss is permanent |

## Nicht geerntet — im Gespräch entstanden

Nicht aus der alten App, sondern neu. Hier festgehalten, damit die Nummern
weiterlaufen und nichts doppelt vergeben wird.

| ID | Requirement | Prio | Eff | Areas | Phase | Value | Prep | Depends on | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| REQ-196 | Sitzungsmitschnitt: Audio einer Sitzung aufnehmen oder eine fertige Aufnahme anhängen, als Asset am Sitzungs-Container, mit Startzeit und Kapitelmarken | 4 | 5 | Campaign & Sessions, Media & Assets | play | efficiency | none | REQ-021, REQ-077, REQ-145 | idea | Aufnahme im Browser oder Upload aus einem Recorder. Grosse Dateien gehören auf den NAS-Backend (REQ-146), nicht in die App-Ablage |
| REQ-197 | Transkription und Recap-Entwurf: Mitschnitt transkribieren, am Sitzungsverlauf ausrichten und daraus einen Recap-Entwurf erzeugen, den die SL bearbeitet | 4 | 8 | Campaign & Sessions | prep | efficiency | none | REQ-196, REQ-077 | idea | Der Entwurf ist nie das Ergebnis — die SL kürzt und färbt. Passagen sollen sich als ContentBlock herauslösen lassen (readaloud für Vorlesetext, fact für Festgestelltes), damit der Recap gleich Wissen freigeben kann (REQ-080) |
| REQ-198 | Sprecherzuordnung im Transkript: Abschnitte einer Figur oder der SL zuordnen, damit „was hat meine Figur mitbekommen“ beantwortbar wird | 5 | 5 | Campaign & Sessions | prep | efficiency | low | REQ-197, REQ-040 | idea | Erst sinnvoll, wenn die Wissensfreigabe steht — dann aber die eigentliche Auszahlung: der Recap weiss, wer dabei war |

| REQ-199 | Produktionsdaten nach preprod spiegeln: regelmässiger Abzug aus der Prod-Datenbank in die Testinstanz, damit gegen echte Inhalte getestet wird | 3 | 3 | Cross-cutting | prep | efficiency | none | REQ-154, REQ-155 | idea | Einrichtung: `pg_dump` aus prod, `pg_restore` nach preprod, nach Plan. Zwei Dinge daran sind Entscheidungen, keine Technik: preprod wird dabei **überschrieben** — was dort an Testständen liegt, ist weg, also muss der Zeitpunkt bekannt sein; und sobald Spielerzugänge (REQ-025-Token) oder Mitschnitte (REQ-196) existieren, gehören die **nicht** mitgespiegelt. Tokens sind Laufzeitzustand, keine Kampagnendaten, und liegen darum ohnehin ausserhalb der Datenbank; für alles andere braucht der Abzug eine Ausschlussliste |

Offene Fragen dazu, bevor das geplant werden kann: wo transkribiert wird (lokal
auf dem NAS gegen ein Modell, oder ausser Haus — bei einer Aufnahme, auf der
fünf Leute zu hören sind, ist das keine reine Technikfrage), wie lange
Mitschnitte aufbewahrt werden, und ob die Gruppe dem überhaupt zustimmt.
Aufnahme ohne Einverständnis aller am Tisch wäre in der Schweiz nicht bloss
unhöflich.

## Evidence for requirements that already exist

The old app does not add these; it argues for their depth.

- **REQ-040** — per-character *and* party knowledge holders are both used constantly. The v1 note ("grant/revoke per party, no holders detail") is probably too shallow.
- **REQ-059** — creature knowledge facts are gated per *entry*, one defence line at a time, not per block.
- **REQ-115** — timed conditions expiring on turn boundaries, with each effect bound to a participant, works well. The old design is worth copying directly rather than redesigning.
- **REQ-065** — the tile inventory's grid shapes already exist as authored data on every item.
- **REQ-157** — the free-positioned pinboard with live reference cards validates the canvas concept before it is built.

## Schema gaps found while reading the registry

Unrelated to the harvest, but worth fixing regardless — each is a contradiction between [[Schemas]] and [[Data Definitions]] or a requirement with no schema home:

1. **No `component/RawContent`**, although REQ-019 is priority 1 and v1 **full** ("Obsidian bridge") and [[Data Definitions]] §1 lists RawContent as a property type on nine interfaces. Raw survives only as `RichText.raw` and `Statblock.raw` — entity-level raw markdown has nowhere to go.
2. **`Visibility` does not store the full shape.** [[Schemas]] has `{audience, revealedTo, hiddenFrom, inherit}`; [[Data Definitions]] and REQ-039 also name `scope`, `allowedRoles`, `deniedRoles`, `sharedUsers`. The Platform area decision says "full visibility schema stored from day one".
3. **`AssetInfo.backend` omits `nas`** — `["app","external"]` in [[Schemas]] against `app · nas · external` in [[Data Definitions]] and REQ-021.
4. **`tactics` block type** is on `Creature.blockTypes` in [[Schemas]] but "tactics live here, not on Creature" in [[Data Definitions]] §3.
5. **Interface count is stale** — the docs say 40 in three places; [[Schemas]] §4 defines 49.
6. **Two v1 dependency breaks**: REQ-115 (v1 minimal) depends on REQ-116 (`later`); REQ-092 (v1 minimal) depends on REQ-094 (`later`).
7. **`Stewardship`** exists as an entity in [[Data Definitions]] §3–4 and in [[Glossary]], but has no interface in [[Schemas]] — it collapses to `SessionState.steward → User`.

## Changelog

- **0.2** (2026-09-19): REQ-196–198 ergänzt (Sitzungsmitschnitt, Transkription, Sprecherzuordnung) — nicht geerntet, im Gespräch entstanden.
- **0.1** (2026-09-19): Initial harvest from the Kanalgang session tracker. 28 requirements (REQ-168…195, 66 points), evidence notes for five existing requirements, seven schema gaps.

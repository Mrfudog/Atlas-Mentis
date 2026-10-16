---
id: "EP-03"
title: "Kreaturen & Figuren"
typ: "epic"
umfang: "Kreatur, Statblock (Vorlage und Instanz), Charakterbogen und Charaktermanager — alles, was eine Figur oder ein Monster beschreibt."
frueher: "Creatures & Characters"
arten: ["Creature", "PlayerCharacter", "Statblock", "Abilities", "Proficiencies", "Vitals", "Class", "Subclass", "Ancestry", "Background", "Feature", "Feat"]
kanten: ["belongsTo", "instanceOf", "hasClass", "hasAncestry", "hasBackground", "grants", "chose", "subclassOf"]
code: ["packages/model/src/abilities.ts", "packages/model/src/builder.ts", "packages/model/src/classes.ts", "packages/model/src/instance.ts", "packages/model/src/choices.ts", "apps/web/src/app/artikel/statblock.ts", "apps/web/src/app/figur", "apps/web/src/app/klassen"]
doku: ["docs/Datenmodell.md", "docs/Begriffe.md"]
tags: ["vtt", "epic"]
---
# EP-03 Kreaturen & Figuren

Kreatur, Statblock (Vorlage und Instanz), Charakterbogen und Charaktermanager — alles, was eine Figur oder ein Monster beschreibt.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-020 Kreatur]] — Die Artikelart Creature mit kind, Beziehungen, Begleitern. | 4 | 10 | 3 steht · 1 teils |
| [[F-021 Statblock]] — Die Zahlen einer Kreatur, aus Regeln zusammengesetzt; Vorlage und Instanz. | 7 | 28 | 4 steht · 3 offen |
| [[F-022 Schnellanlage]] — Kreatur und Statblock in einem Schritt anlegen. | 2 | 5 | 2 steht |
| [[F-023 Charakterbogen]] — Der Bogen einer Figur: Allgemein, Kampf, Zauber, Freispiel, schnelle Änderungen. | 8 | 32 | 5 steht · 1 teils · 1 offen · 1 ersetzt |
| [[F-024 Charaktermanager]] — Figur geführt erstellen und steigern: Klasse, Herkunft, Hintergrund, Wahlen, Attribute, Ausrüstung, Sprachen. | 8 | 47 | 4 steht · 4 offen |

### Wo es wohnt

**Arten:** [Creature](../../docs/Artikeltypen.md#creature), `PlayerCharacter`, [Statblock](../../docs/Artikeltypen.md#statblock), `Abilities`, `Proficiencies`, `Vitals`, [Class](../../docs/Artikeltypen.md#class), [Subclass](../../docs/Artikeltypen.md#subclass), [Ancestry](../../docs/Artikeltypen.md#ancestry), [Background](../../docs/Artikeltypen.md#background), [Feature](../../docs/Artikeltypen.md#feature), [Feat](../../docs/Artikeltypen.md#feat)

**Kanten:** `belongsTo`, `instanceOf`, `hasClass`, `hasAncestry`, `hasBackground`, `grants`, `chose`, `subclassOf`

**Code:** `packages/model/src/abilities.ts`, `packages/model/src/builder.ts`, `packages/model/src/classes.ts`, `packages/model/src/instance.ts`, `packages/model/src/choices.ts`, `apps/web/src/app/artikel/statblock.ts`, `apps/web/src/app/figur`, `apps/web/src/app/klassen`

**Erklärt in:** [Datenmodell.md](../../docs/Datenmodell.md), [Begriffe.md](../../docs/Begriffe.md)

**Offen mit Prio 1–3:** [[REQ-055]] Merkmale beim Tippen wiederverwenden (offen) · [[REQ-060]] Begleiter und Beschwörungen (teils) · [[REQ-274]] Charakter- und Kampagnenmanager jederzeit aufrufen (offen) · [[REQ-344]] Gesperrte Aktionen bleiben sichtbar, mit Grund (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Creatures & Characters. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Creatures & Characters

**Scope.** Creature (identity, description, relations) and Statblock (mechanics as a composition of RuleElements) with PC/NPC specializations; import, quick add, viewers, quick changes, builder, companions, creature knowledge.
**Prep.** Import from 5e.tools / Improved Initiative / Obsidian; minimal edit form; later a builder that suggests traits from origin + MCDM fighting type. Traits are reusable and variant-able inline.
**Play.** Simple viewer (social / description / combat) leads; quick changes (HP, temp, conditions, rest, inspiration); name-only NPC or statblock-only mob in seconds.
**Concepts.** A creature without statblock and a statblock without creature are both valid; several NPCs may share one statblock; raw statblocks are viewable and initiative-trackable before being structured; creature facts are gated blocks on type/species/faction, reusable across campaigns with per-campaign unlock state.
**Depends on.** Backbone, Platform (edit permissions: owner, GM, wardship), Rules (RuleElements).

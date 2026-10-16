---
id: "EP-07"
title: "Regeln & Nachschlagen"
typ: "epic"
umfang: "Bereich Rules und Kompendium, Bücher und Leseansicht, Klassen, Zauber, Zustände, Handwerk, Regelsysteme und die Auswertung von Regeln."
frueher: "Rules & Reference"
arten: ["Rule", "Condition", "Disease", "Spell", "Class", "Recipe", "Skill", "Language", "Action", "Table", "Chapter", "Heading", "Paragraph", "ReadAloudText", "Embed"]
kanten: ["casts", "affects", "stageOf", "grants", "needs", "yields", "craftsWith", "crafting", "tableFor", "entry", "describedIn", "chapterOf"]
code: ["packages/model/src/effects.ts", "packages/model/src/crafting.ts", "packages/model/src/book.ts", "packages/model/src/reading.ts", "apps/server/src/handwerk.ts", "apps/web/src/app/lesen", "apps/web/src/app/klassen", "apps/web/src/app/artikel/werkstatt.ts"]
doku: ["docs/Regelsysteme.md", "docs/Datenmodell.md"]
tags: ["vtt", "epic"]
---
# EP-07 Regeln & Nachschlagen

Bereich Rules und Kompendium, Bücher und Leseansicht, Klassen, Zauber, Zustände, Handwerk, Regelsysteme und die Auswertung von Regeln.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-042 Bereich Rules & Kompendium]] — Regelartikel, Nachschlagen in Sekunden, Merkzettel, Zustände. | 6 | 16 | 5 steht · 1 teils |
| [[F-043 Bücher & Leseansicht]] — Eine Ebene als Buch lesen, Kapitel aus Teilen. | 1 | 8 | 1 steht |
| [[F-044 Klassen]] — Klassenansicht mit Stufentabelle und Unterklassen. | 1 | 3 | 1 steht |
| [[F-045 Zauber]] — Zauber als Artikel, Zauberlisten. | 2 | 5 | 1 steht · 1 offen |
| [[F-046 Regelauswertung]] — Effekte, Bedingungen und Wechselwirkungen von Regeln auswerten. | 6 | 44 | 6 offen |
| [[F-047 Handwerk]] — Rezepte, Material, Fortschritt, Blaupausen lernen. | 4 | 12 | 4 steht |
| [[F-048 Regelsysteme & Module]] — Regelsysteme als Behälter mit Optionen je Kampagne; Homebrew-Regeln; Rahmen wie Taverne. | 4 | 21 | 4 offen |
| [[F-049 Masse & Einheiten]] — Masse beim Lesen umrechnen, auch im Fliesstext. | 1 | 2 | 1 offen |

### Wo es wohnt

**Arten:** `Rule`, [Condition](../../docs/Artikeltypen.md#condition), [Disease](../../docs/Artikeltypen.md#disease), [Spell](../../docs/Artikeltypen.md#spell), [Class](../../docs/Artikeltypen.md#class), [Recipe](../../docs/Artikeltypen.md#recipe), [Skill](../../docs/Artikeltypen.md#skill), [Language](../../docs/Artikeltypen.md#language), [Action](../../docs/Artikeltypen.md#action), [Table](../../docs/Artikeltypen.md#table), [Chapter](../../docs/Artikeltypen.md#chapter), [Heading](../../docs/Artikeltypen.md#heading), [Paragraph](../../docs/Artikeltypen.md#paragraph), `ReadAloudText`, `Embed`

**Kanten:** `casts`, `affects`, `stageOf`, `grants`, `needs`, `yields`, `craftsWith`, `crafting`, `tableFor`, `entry`, `describedIn`, `chapterOf`

**Code:** `packages/model/src/effects.ts`, `packages/model/src/crafting.ts`, `packages/model/src/book.ts`, `packages/model/src/reading.ts`, `apps/server/src/handwerk.ts`, `apps/web/src/app/lesen`, `apps/web/src/app/klassen`, `apps/web/src/app/artikel/werkstatt.ts`

**Erklärt in:** [Regelsysteme.md](../../docs/Regelsysteme.md), [Datenmodell.md](../../docs/Datenmodell.md)

**Offen mit Prio 1–3:** [[REQ-018]] Wirkungen von Regeln beschreiben (offen) · [[REQ-092]] Zauber als Artikel (offen) · [[REQ-227]] Masse im Fliesstext umrechnen (offen) · [[REQ-287]] Regelsysteme als Behälter mit Optionen (offen) · [[REQ-289]] Homebrew-Regeln erfassen (offen) · [[REQ-313]] Zustände als Artikel (teils) · [[REQ-319]] Inventarregeln als wählbares Modul (offen)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Rules & Reference. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Rules & Reference

**Scope.** RuleElements as reference objects; import from Obsidian and 5e.tools; the rules browser with layer origin visible; spells as entities with layer-scoped rule sets; spell lists; pinnable rules; later effect and constraint interpreters and per-system engines.
**Prep.** Structuring rules is optional and incremental; reference value exists from the first import.
**Play.** Contract: any rule found in under five seconds. Term integration matters most here (Plänkler, mythisch, …).
**Concepts.** Data on the entity, meaning in the rule, evaluation in the engine; rule attachment is layer-scoped (2014 vs 2024 vs homebrew).
**Depends on.** Backbone (effects format, terms, layers).

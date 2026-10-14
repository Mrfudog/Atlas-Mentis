---
id: "EP-07"
title: "Regeln & Nachschlagen"
typ: "epic"
umfang: "Bereich Rules und Kompendium, Bücher und Leseansicht, Klassen, Zauber, Zustände, Handwerk, Regelsysteme und die Auswertung von Regeln."
frueher: "Rules & Reference"
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
| [[F-045 Zauber]] — Zauber als Artikel, Zauberlisten. | 2 | 5 | 2 offen |
| [[F-046 Regelauswertung]] — Effekte, Bedingungen und Wechselwirkungen von Regeln auswerten. | 6 | 44 | 6 offen |
| [[F-047 Handwerk]] — Rezepte, Material, Fortschritt, Blaupausen lernen. | 3 | 9 | 3 steht |
| [[F-048 Regelsysteme & Module]] — Regelsysteme als Behälter mit Optionen je Kampagne; Homebrew-Regeln; Rahmen wie Taverne. | 3 | 16 | 3 offen |
| [[F-049 Masse & Einheiten]] — Masse beim Lesen umrechnen, auch im Fliesstext. | 1 | 2 | 1 offen |
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Rules & Reference. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Rules & Reference

**Scope.** RuleElements as reference objects; import from Obsidian and 5e.tools; the rules browser with layer origin visible; spells as entities with layer-scoped rule sets; spell lists; pinnable rules; later effect and constraint interpreters and per-system engines.
**Prep.** Structuring rules is optional and incremental; reference value exists from the first import.
**Play.** Contract: any rule found in under five seconds. Term integration matters most here (Plänkler, mythisch, …).
**Concepts.** Data on the entity, meaning in the rule, evaluation in the engine; rule attachment is layer-scoped (2014 vs 2024 vs homebrew).
**Depends on.** Backbone (effects format, terms, layers).

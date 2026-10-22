---
id: "EP-12"
title: "Import & Inhalte"
typ: "epic"
umfang: "5e.tools, Regelwerke anderer Verlage, Obsidian-Vault, Artikelprüfung und KI-erzeugte Inhalte — wie Inhalte hereinkommen und vollständig werden."
frueher: "Content Backbone, Rules & Reference"
arten: ["Source", "Layer"]
kanten: ["inLayer", "overrides"]
code: ["packages/import-5etools", "scripts/regelwerk.mjs", "apps/server/src/import.ts", "apps/server/src/ausfuhr.ts"]
doku: ["docs/5etools-Abgleich.md", "docs/5etools-Arbeitsplan.md", "docs/5etools-Bericht.md", "docs/Betrieb.md", "docs/Nachtarbeit"]
tags: ["vtt", "epic"]
---
# EP-12 Import & Inhalte

5e.tools, Regelwerke anderer Verlage, Obsidian-Vault, Artikelprüfung und KI-erzeugte Inhalte — wie Inhalte hereinkommen und vollständig werden.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-073 5e.tools-Import]] — Einmal einlesen, danach ergänzen; jede Quelle in ihre Ebene. | 5 | 22 | 3 steht · 2 verworfen |
| [[F-074 Regelwerke anderer Verlage]] — Pakete wie Kibbles’ Compendium über die API laden. | 2 | 13 | 1 teils · 1 offen |
| [[F-075 Obsidian-Vault]] — Notizen aus dem Vault einlesen. | 1 | 5 | 1 offen |
| [[F-076 Artikelprüfung & Nachtarbeit]] — Artikel nachts auf Vollständigkeit prüfen und ergänzen, mit Protokoll. | 2 | 4 | 2 steht |
| [[F-077 KI-Inhalte]] — Von Claude erzeugte Inhalte in eigener Ebene, z. B. Preise. | 1 | 3 | 1 teils |

### Wo es wohnt

**Arten:** `Source`, [Layer](../../docs/Artikeltypen.md#layer)

**Kanten:** `inLayer`, `overrides`

**Code:** `packages/import-5etools`, `scripts/regelwerk.mjs`, `apps/server/src/import.ts`, `apps/server/src/ausfuhr.ts`

**Erklärt in:** [5etools-Abgleich.md](../../docs/5etools-Abgleich.md), [5etools-Arbeitsplan.md](../../docs/5etools-Arbeitsplan.md), [5etools-Bericht.md](../../docs/5etools-Bericht.md), [Betrieb.md](../../docs/Betrieb.md), [Nachtarbeit](../../docs/Nachtarbeit)

**Offen mit Prio 1–3:** [[REQ-288]] Preise für jeden Gegenstand (teils) · [[REQ-308]] Obsidian-Vault einlesen (offen) · [[REQ-314]] Regelwerk eines Drittverlags laden (teils) · [[REQ-380]] Bücher über konfigurierbare Strukturen zerlegen (offen)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Content Backbone, Rules & Reference. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Content Backbone

**Scope.** Structures and stores content for D&D 5e + homebrew: entity model, identity and history, layers/entries/stacks, dimensions, ContentBlocks, references and terms, rule effects, view configs, the asset contract. No generic TTRPG engine, but nothing that prevents one.
**Prep.** Everything authored lands here; import-first with raw content preserved (Obsidian markdown, 5e.tools JSON, OCR).
**Play.** Resolution — what a given user sees in a given campaign at a given moment — is a backbone concern, not a view concern.
**Key concepts.** Layer, Entry, Stack, ContentBlock, Dimension, Change chain, Registry, Term, SourceRef, Asset.
**Depends on.** — (root). **Feeds.** every other area.
**Status.** Conceptually defined ([[33_Backbone_Concept]]); registry in [[Data Definitions]].

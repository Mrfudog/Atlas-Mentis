---
id: "EP-01"
title: "Inhaltsgerüst"
typ: "epic"
umfang: "Register, Arten, Felder, Kanten, Ebenen und Fassungen, Ansichten — das Modell, mit dem jeder Artikel beschrieben, gespeichert und gezeichnet wird."
frueher: "Content Backbone"
arten: ["Layer", "Identity", "Status", "Visibility", "Tags", "Source"]
kanten: ["inLayer", "activates", "partOf", "overrides", "variantOf", "instanceOf"]
code: ["packages/model/src/validate.ts", "packages/model/src/entity.ts", "packages/model/src/stack.ts", "packages/model/src/views.ts", "packages/model/src/inline.ts", "packages/model/src/versions.ts", "packages/registry/src", "apps/web/src/app/register"]
doku: ["docs/Datenmodell.md", "docs/Begriffe.md", "docs/Ebenen.md", "docs/Artikeltypen.md", "docs/Durchgang.md"]
tags: ["vtt", "epic"]
---
# EP-01 Inhaltsgerüst

Register, Arten, Felder, Kanten, Ebenen und Fassungen, Ansichten — das Modell, mit dem jeder Artikel beschrieben, gespeichert und gezeichnet wird.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-001 Artikelmodell]] — Peg, Karten je Art, Kanten, Bezeichner — wie ein Artikel gespeichert wird. | 9 | 25 | 5 steht · 2 ersetzt · 2 verworfen |
| [[F-002 Register]] — Die Seite /registry: Typen, Felder, Kanten, Listen und Ansichten anlegen und ändern, mit Zählung vorher. | 6 | 24 | 6 steht |
| [[F-003 Feldformen & Aufzählungen]] — Was ein Feld halten darf: Formen, Aufzählungszeilen, Spannen, Verweisziele, Vorgaben, freie Sorten. | 5 | 7 | 3 steht · 1 teils · 1 ersetzt |
| [[F-004 Ebenen & Stapel]] — Ebenen, Gruppen von Ebenen, Herausgeber, Aufschalten (auch teilweise) und was im Stapel einer Kampagne steht. | 13 | 52 | 6 steht · 4 teils · 3 offen |
| [[F-005 Fassungen & Varianten]] — Dieselbe Sache aus einer anderen Quelle (Fassung, Überschreibung) und eine verwandte Sache (Variante); Vergleichsebenen. | 5 | 14 | 3 steht · 2 teils |
| [[F-006 Ansichten & Anordnung]] — Overview, Quick, Full, Print, Search und eigene Ansichten; Anordnung am Typ, ohne Code. | 3 | 14 | 2 steht · 1 ersetzt |
| [[F-007 Verweise & Platzhalter]] — [[Verweise]] nach Nummer, Rückbezüge, {VAR}-Platzhalter, Regelverweise im Text. | 5 | 15 | 3 steht · 2 teils |
| [[F-008 Kanten verstehen]] — Was eine Kante bedeutet und bewirkt; Typdiagramm und Graph. | 2 | 10 | 1 steht · 1 offen |
| [[F-009 Verlauf & gleichzeitiges Schreiben]] — Änderungsverlauf, Revisionen, nichts still überschreiben. | 3 | 8 | 2 steht · 1 teils |

### Wo es wohnt

**Arten:** [Layer](../../docs/Artikeltypen.md#layer), `Identity`, `Status`, `Visibility`, `Tags`, `Source`

**Kanten:** `inLayer`, `activates`, `partOf`, `overrides`, `variantOf`, `instanceOf`

**Code:** `packages/model/src/validate.ts`, `packages/model/src/entity.ts`, `packages/model/src/stack.ts`, `packages/model/src/views.ts`, `packages/model/src/inline.ts`, `packages/model/src/versions.ts`, `packages/registry/src`, `apps/web/src/app/register`

**Erklärt in:** [Datenmodell.md](../../docs/Datenmodell.md), [Begriffe.md](../../docs/Begriffe.md), [Ebenen.md](../../docs/Ebenen.md), [Artikeltypen.md](../../docs/Artikeltypen.md), [Durchgang.md](../../docs/Durchgang.md)

**Offen mit Prio 1–3:** [[REQ-003]] Änderungsverlauf je Artikel (teils) · [[REQ-006]] Stapel: was in der Kampagne gilt (teils) · [[REQ-007]] Stapel für Fortgeschrittene (offen) · [[REQ-008]] Varianten einer Sache (teils) · [[REQ-013]] Verweise nach Nummer, getippt nach Name (teils) · [[REQ-045]] Ebenen-Aktionen am Artikel (offen) · [[REQ-100]] Welt als Ebene (teils) · [[REQ-102]] Artikel je Stapel und Wissen zeichnen (teils) · [[REQ-176]] Ähnliches vor dem Anlegen vorschlagen (teils) · [[REQ-249]] Ebenen nach Herausgeber (teils) · [[REQ-253]] Ebenen und Artikel kopieren (offen) · [[REQ-258]] Verweisfeld nennt, welche Artikel es annimmt (teils) · [[REQ-264]] Vergleichsebenen der Kampagne (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Content Backbone. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Content Backbone

**Scope.** Structures and stores content for D&D 5e + homebrew: entity model, identity and history, layers/entries/stacks, dimensions, ContentBlocks, references and terms, rule effects, view configs, the asset contract. No generic TTRPG engine, but nothing that prevents one.
**Prep.** Everything authored lands here; import-first with raw content preserved (Obsidian markdown, 5e.tools JSON, OCR).
**Play.** Resolution — what a given user sees in a given campaign at a given moment — is a backbone concern, not a view concern.
**Key concepts.** Layer, Entry, Stack, ContentBlock, Dimension, Change chain, Registry, Term, SourceRef, Asset.
**Depends on.** — (root). **Feeds.** every other area.
**Status.** Conceptually defined ([[33_Backbone_Concept]]); registry in [[Data Definitions]].

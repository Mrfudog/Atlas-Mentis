---
id: "EP-10"
title: "Medien & Assets"
typ: "epic"
umfang: "Bilder und Dateien: Ablage, Bildverwaltung und Bildklassen, Token-Werkstatt, Druck und Ausfuhr, PDF."
frueher: "Media & Assets"
arten: ["Asset", "Image"]
kanten: []
code: ["apps/server/src/bilder.ts", "apps/server/src/assets.ts", "packages/model/src/assets.ts", "apps/web/src/app/bilder", "apps/web/src/app/artikel/druck.ts"]
doku: ["docs/Betrieb.md", "docs/Datenmodell.md"]
tags: ["vtt", "epic"]
---
# EP-10 Medien & Assets

Bilder und Dateien: Ablage, Bildverwaltung und Bildklassen, Token-Werkstatt, Druck und Ausfuhr, PDF.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-062 Asset-Ablage]] — Wo Bilder und Dateien liegen und wie sie gefunden werden. | 9 | 31 | 3 steht · 1 teils · 5 offen |
| [[F-063 Bildverwaltung]] — Hochladen, Übersicht, Bildklassen, Ersetzen, Import der Bilder. | 5 | 13 | 2 teils · 3 offen |
| [[F-064 Token-Werkstatt]] — Bilder bearbeiten, Tokens zusammenstellen. | 3 | 11 | 3 offen |
| [[F-065 Druck & Ausfuhr]] — Ein Artikel auf einem Blatt, Karten und Bögen drucken, Ausfuhr nach Markdown. | 3 | 10 | 1 steht · 2 offen |
| [[F-066 PDF & OCR]] — PDF anzeigen, Seiten anspringen, Texte erkennen. | 2 | 18 | 2 offen |

### Wo es wohnt

**Arten:** [Asset](../../docs/Artikeltypen.md#asset), `Image`

**Code:** `apps/server/src/bilder.ts`, `apps/server/src/assets.ts`, `packages/model/src/assets.ts`, `apps/web/src/app/bilder`, `apps/web/src/app/artikel/druck.ts`

**Erklärt in:** [Betrieb.md](../../docs/Betrieb.md), [Datenmodell.md](../../docs/Datenmodell.md)

**Offen mit Prio 1–3:** [[REQ-022]] Vorschaubilder und Kacheln (offen) · [[REQ-145]] Ablage in der Seite (teils) · [[REQ-146]] Grosse Dateien auf dem NAS (offen) · [[REQ-147]] Bilder hochladen (teils) · [[REQ-167]] Drucken (offen) · [[REQ-295]] Bild ersetzen als Fassung oder neue Quelle (offen) · [[REQ-296]] Bildklassen (teils) · [[REQ-297]] Bilder aus 5e.tools einlesen und verknüpfen (offen) · [[REQ-329]] Bilder im Inventar (offen) · [[REQ-330]] Inventory image an einen Gegenstand binden (offen) · [[REQ-370]] Assets ohne Vorbereitungsstand (offen)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Media & Assets. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Media & Assets

**Scope.** Asset service implementation for the dual storage: app-managed (icons, portraits, thumbnails) and NAS/Nextcloud (3D, audio, source PDFs, large maps), plus external URLs; derived variants; PDF viewer with page-anchor jumps; audio and 3D later; OCR import (MonsterBox-style) later. Print & export outputs (item/creature cards, PDF character sheets, map prints) rendered from facets via the Export engine (REQ-167).
**Prep.** Uploading and organizing assets; provenance to rulebook pages.
**Play.** Jumping from a statblock to page 213 of the source book.
**Decisions.** Designed early (contract at priority 1), viewers late.
**Depends on.** Backbone (Asset entity, SourceRef).

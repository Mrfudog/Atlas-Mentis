---
id: "EP-10"
title: "Medien & Assets"
typ: "epic"
umfang: "Bilder und Dateien: Ablage, Bildverwaltung und Bildklassen, Token-Werkstatt, Druck und Ausfuhr, PDF."
frueher: "Media & Assets"
tags: ["vtt", "epic"]
---
# EP-10 Medien & Assets

Bilder und Dateien: Ablage, Bildverwaltung und Bildklassen, Token-Werkstatt, Druck und Ausfuhr, PDF.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-062 Asset-Ablage]] — Wo Bilder und Dateien liegen und wie sie gefunden werden. | 8 | 29 | 3 steht · 1 teils · 4 offen |
| [[F-063 Bildverwaltung]] — Hochladen, Übersicht, Bildklassen, Ersetzen, Import der Bilder. | 4 | 11 | 2 teils · 2 offen |
| [[F-064 Token-Werkstatt]] — Bilder bearbeiten, Tokens zusammenstellen. | 1 | 8 | 1 offen |
| [[F-065 Druck & Ausfuhr]] — Ein Artikel auf einem Blatt, Karten und Bögen drucken, Ausfuhr nach Markdown. | 3 | 10 | 1 steht · 2 offen |
| [[F-066 PDF & OCR]] — PDF anzeigen, Seiten anspringen, Texte erkennen. | 2 | 18 | 2 offen |
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Media & Assets. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Media & Assets

**Scope.** Asset service implementation for the dual storage: app-managed (icons, portraits, thumbnails) and NAS/Nextcloud (3D, audio, source PDFs, large maps), plus external URLs; derived variants; PDF viewer with page-anchor jumps; audio and 3D later; OCR import (MonsterBox-style) later. Print & export outputs (item/creature cards, PDF character sheets, map prints) rendered from facets via the Export engine (REQ-167).
**Prep.** Uploading and organizing assets; provenance to rulebook pages.
**Play.** Jumping from a statblock to page 213 of the source book.
**Decisions.** Designed early (contract at priority 1), viewers late.
**Depends on.** Backbone (Asset entity, SourceRef).

---
id: "EP-09"
title: "Karten"
typ: "epic"
umfang: "Karte und Kartenebenen, Tokens und Marker, Nebel, Licht und Sicht, Bewegung und Zonen, Gebiete, Reisen, Karteneditor."
frueher: "Maps"
tags: ["vtt", "epic"]
---
# EP-09 Karten

Karte und Kartenebenen, Tokens und Marker, Nebel, Licht und Sicht, Bewegung und Zonen, Gebiete, Reisen, Karteneditor.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-055 Karte & Kartenebenen]] — Karte mit Bild, Gitter, Massstab; Unterkarten zum Hineinzoomen. | 5 | 17 | 4 steht · 1 offen |
| [[F-056 Tokens & Marker]] — Marker, Kulisse, Spiel-Tokens, Gruppen-Token, Grösse. | 6 | 17 | 4 steht · 2 teils |
| [[F-057 Nebel, Licht & Sicht]] — Aufdecken, Licht und Sichtlinien. | 3 | 24 | 3 steht |
| [[F-058 Bewegung & Zonen]] — Bewegungsrechner, Pfad, Zonen, Vollbild und eigene Tokens bewegen. | 5 | 16 | 2 steht · 3 teils |
| [[F-059 Gebiete & Overlays]] — Gebiete und Hervorhebungen auf der Karte. | 2 | 8 | 1 steht · 1 teils |
| [[F-060 Reisen & Erkundung]] — Point-Crawl, Erkundungsstand, Vorräte und Aktionen je Knoten. | 4 | 13 | 4 steht |
| [[F-061 Karteneditor]] — Zeichnen, Assets platzieren, Effekte. | 3 | 29 | 3 offen |
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Maps. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Maps

**Scope.** Map entity with grid config; nested maps with anchor regions and zoom-through transitions (world → region → city → district → battlemap) with level lock; static tokens (reference markers, scenery) and play tokens (session- or campaign-scoped, e.g. party marker); overlays; fog of war, light/LoS, effects, drawing, editor later.
**Prep.** High: every map is image work before it earns anything. Nested anchors add setup.
**Play.** Static nested viewer with party marker is the first table-usable step; play tokens follow Live Play's state objects.
**Concepts.** Token = what it is (marker / prop / creature) × lifecycle (static / play). Map hierarchy and location hierarchy are parallel but independent.
**Depends on.** Media & Assets (image asset, tiling), Live Play (state objects), World & Lore (locations).

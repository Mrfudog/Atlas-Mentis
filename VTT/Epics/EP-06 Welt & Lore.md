---
id: "EP-06"
title: "Welt & Lore"
typ: "epic"
umfang: "Bereich World: Orte, Fraktionen, Gottheiten, Lore, Kalender und Zeitleisten, Beziehungen, Läden und Wirtschaft."
frueher: "World & Lore"
arten: ["World", "Place", "Faction", "Deity", "Event", "Article", "Shop", "Material"]
kanten: ["livesIn", "memberOf", "worships", "controls", "sells", "discount", "shopkeeper", "regards", "inWorld"]
code: ["packages/model/src/timeline.ts", "packages/model/src/shop.ts", "apps/server/src/laden.ts", "apps/web/src/app/artikel/laden.ts"]
doku: ["docs/Beziehungen.md", "docs/Datenmodell.md"]
tags: ["vtt", "epic"]
---
# EP-06 Welt & Lore

Bereich World: Orte, Fraktionen, Gottheiten, Lore, Kalender und Zeitleisten, Beziehungen, Läden und Wirtschaft.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-037 Bereich World]] — Orte, Fraktionen, Gottheiten, Lore-Artikel, Welt als Ebene, Kampagnenabweichungen. | 5 | 16 | 3 steht · 2 offen |
| [[F-038 Kalender & Zeitleisten]] — Weltdatum, Kalender an der Welt, Zeitleisten der Weltgeschichte und der Kampagne. | 5 | 26 | 3 steht · 2 offen |
| [[F-039 Beziehungen & Ruf]] — Beziehungen als Kanten mit Marken. | 3 | 11 | 1 steht · 2 ersetzt |
| [[F-040 Läden & Wirtschaft]] — Läden mit Waren und Preisen, Fraktionspreise, andere Währungen. | 3 | 7 | 1 steht · 1 teils · 1 offen |
| [[F-041 Namensgenerator]] — Namen für Figuren und Orte erzeugen. | 1 | 3 | 1 offen |

### Wo es wohnt

**Arten:** [World](../../docs/Artikeltypen.md#world), [Place](../../docs/Artikeltypen.md#place), [Faction](../../docs/Artikeltypen.md#faction), [Deity](../../docs/Artikeltypen.md#deity), [Event](../../docs/Artikeltypen.md#event), [Article](../../docs/Artikeltypen.md#article), [Shop](../../docs/Artikeltypen.md#shop), [Material](../../docs/Artikeltypen.md#material)

**Kanten:** `livesIn`, `memberOf`, `worships`, `controls`, `sells`, `discount`, `shopkeeper`, `regards`, `inWorld`

**Code:** `packages/model/src/timeline.ts`, `packages/model/src/shop.ts`, `apps/server/src/laden.ts`, `apps/web/src/app/artikel/laden.ts`

**Erklärt in:** [Beziehungen.md](../../docs/Beziehungen.md), [Datenmodell.md](../../docs/Datenmodell.md)

**Offen mit Prio 1–3:** [[REQ-025]] Kalender der Welt (offen) · [[REQ-285]] Fraktionspreise (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: World & Lore. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### World & Lore

**Scope.** World as scope + layer; articles composed of ContentBlocks and rendered contextually per stack; locations, factions, NPC directory, events/timelines, pantheons; campaign-specific divergence; player-authored blocks; the Bibliothek von Tan'Jit presentation layer; reputation system (future).
**Prep.** Author once at world level; several campaigns consume with independent time position and unlock state. Divergence costs one campaign-scoped block, never a copy.
**Play.** The player wiki grows automatically as knowledge is granted; players contribute whitelisted block types (poems, songs, reviews) so the world becomes a product of many.
**Concepts.** WorldDate (sortable canonical value + CalendarSystem reference) from day one; reputation tags propagating NPC → faction → city with status — hooks now, system later.
**Depends on.** Backbone (layers, blocks, WorldDate), Platform (memberships), Creatures (NPCs).

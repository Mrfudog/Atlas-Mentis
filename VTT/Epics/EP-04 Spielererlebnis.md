---
id: "EP-04"
title: "Spielererlebnis"
typ: "epic"
umfang: "Was Spielende sehen und tun: Spieleransicht und Telefon, eigene Figur und eigene Inhalte, Inventar, Chat."
frueher: "Player Experience"
tags: ["vtt", "epic"]
---
# EP-04 Spielererlebnis

Was Spielende sehen und tun: Spieleransicht und Telefon, eigene Figur und eigene Inhalte, Inventar, Chat.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-025 Spieleransicht & Telefon]] — Die Seite aus Sicht der Spielenden, auch am Telefon. | 4 | 10 | 3 teils · 1 offen |
| [[F-026 Inventar]] — Liste und Raster, Behälter und Zonen, Ausrüstungsfigur, Ziehen und Verstauen, Gruppeninventar, Gegenstände als Instanz. | 11 | 28 | 8 steht · 1 teils · 2 offen |
| [[F-027 Eigene Inhalte der Spielenden]] — Notizen, Ziele, Lore-Artikel, die Spielende selbst anlegen. | 3 | 6 | 1 teils · 2 offen |
| [[F-028 Chat]] — Fäden zwischen Leitung und Spielenden, daraus Kampagneninhalt. | 3 | 10 | 3 offen |
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Player Experience. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Player Experience

**Scope.** The player's own surface: character sheet (General + Inventory first; Combat, Spells, Freeplay later), list inventory (tiles later), local dice, personal notes, quicklinks.
**Design.** Phone-first at the table; the sheet is a view config over Creature + Statblock, not its own data model. Players own their characters; wardship/open editing grantable.
**Play.** Everything here is play-time; prep cost none.
**Decisions.** Dice local first; shared rolls arrive with Live Play's realtime.
**Depends on.** Creatures & Characters, Platform, Live Play (for shared state).

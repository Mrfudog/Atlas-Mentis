---
id: "EP-04"
title: "Spielererlebnis"
typ: "epic"
umfang: "Was Spielende sehen und tun: Spieleransicht und Telefon, eigene Figur und eigene Inhalte, Inventar, Chat."
frueher: "Player Experience"
arten: ["Inventory", "Item", "PlayerCharacter"]
kanten: ["carries", "holds", "leftBehind"]
code: ["packages/model/src/inventory.ts", "packages/model/src/slots.ts", "packages/model/src/stowing.ts", "apps/web/src/app/artikel/inventar.ts", "apps/server/src/stueck.ts", "apps/server/src/spielerebene.ts", "apps/web/src/app/kern/spieler.ts"]
doku: ["docs/Zugang.md", "docs/Spieltisch.md"]
tags: ["vtt", "epic"]
---
# EP-04 Spielererlebnis

Was Spielende sehen und tun: Spieleransicht und Telefon, eigene Figur und eigene Inhalte, Inventar, Chat.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-025 Spieleransicht & Telefon]] — Die Seite aus Sicht der Spielenden, auch am Telefon. | 5 | 13 | 4 teils · 1 offen |
| [[F-026 Inventar]] — Liste und Raster, Behälter und Zonen, Ausrüstungsfigur, Ziehen und Verstauen, Gruppeninventar, Gegenstände als Instanz. | 23 | 59 | 7 steht · 4 teils · 12 offen |
| [[F-027 Eigene Inhalte der Spielenden]] — Notizen, Ziele, Lore-Artikel, die Spielende selbst anlegen. | 3 | 6 | 1 teils · 2 offen |
| [[F-028 Chat]] — Fäden zwischen Leitung und Spielenden, daraus Kampagneninhalt. | 3 | 10 | 3 offen |
| [[F-078 Beute]] — Beute vorbereiten, während der Sitzung öffnen und von Spielenden nehmen lassen. | 1 | 3 | 1 offen |
| [[F-079 Tragplätze]] — Körperplan des Inventarmoduls, tragende Ausrüstung als Behälter mit eigenem kleinem Raster (Gürtel, Riemen, Scheide, Köcher, Laschen), Verbund-Zonen für Stücke über mehrere Zellen, Trageregeln am Gegenstand, alle möglichen Plätze mit Grund und Verdrängen. | 7 | 18 | 7 offen |

### Wo es wohnt

**Arten:** [Inventory](../../docs/Artikeltypen.md#inventory), [Item](../../docs/Artikeltypen.md#item), `PlayerCharacter`

**Kanten:** `carries`, `holds`, `leftBehind`

**Code:** `packages/model/src/inventory.ts`, `packages/model/src/slots.ts`, `packages/model/src/stowing.ts`, `apps/web/src/app/artikel/inventar.ts`, `apps/server/src/stueck.ts`, `apps/server/src/spielerebene.ts`, `apps/web/src/app/kern/spieler.ts`

**Erklärt in:** [Zugang.md](../../docs/Zugang.md), [Spieltisch.md](../../docs/Spieltisch.md)

**Offen mit Prio 1–3:** [[REQ-069]] Am Telefon spielen (teils) · [[REQ-072]] Eigene Notizen (offen) · [[REQ-074]] Schnellzugriffe (teils) · [[REQ-083]] Eigene Quests und Ziele (offen) · [[REQ-109]] Lore-Texte von Spielenden (teils) · [[REQ-200]] Chat mit der Leitung und unter Spielenden (offen) · [[REQ-201]] Aus dem Chat wird Inhalt (offen) · [[REQ-202]] Chats bleiben privat (offen) · [[REQ-215]] Tragraster aus Grösse und Stärke (teils) · [[REQ-216]] Behälter in Behältern (teils) · [[REQ-225]] Fallenlassen und Verstauen (teils) · [[REQ-275]] Erhaltene Gegenstände als Instanz (teils) · [[REQ-311]] Spieleransicht mit der eigenen Figur im Fokus (teils) · [[REQ-320]] Formen frei malen, auch nicht rechteckig (offen) · [[REQ-321]] Stapel im Raster (offen) · [[REQ-322]] Besondere Zonen mit eigenen Regeln (offen) · [[REQ-323]] Alle möglichen Plätze eines Gegenstands (offen) · [[REQ-324]] Hände als Plätze mit Regeln (offen) · [[REQ-325]] Gegenstandsartikel im Detailbereich (offen) · [[REQ-326]] Ziehen und Ablegen im Raster (offen) · [[REQ-327]] Packen am Telefon (offen) · [[REQ-328]] Ablage für nicht Verstautes (offen) · [[REQ-332]] Beute öffnen und nehmen (offen) · [[REQ-333]] Vorgaben für Formen und Stapel (offen) · [[REQ-334]] Tragende Ausrüstung als Behälter mit eigenem Raster (offen) · [[REQ-335]] Verbund: Zellen, die gemeinsam ein Stück tragen (offen) · [[REQ-336]] Festlegen, wo ein Gegenstand getragen werden darf (offen) · [[REQ-337]] Sehen, was weichen muss (offen) · [[REQ-338]] Körperplätze als Plan des Moduls (offen) · [[REQ-339]] Tragende Ausrüstung an der Figur (offen) · [[REQ-340]] Raster und Zonen eines Trägers in der Maske (offen) · [[REQ-346]] Was die Kampagne meiner Figur gezeigt hat (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Player Experience. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Player Experience

**Scope.** The player's own surface: character sheet (General + Inventory first; Combat, Spells, Freeplay later), list inventory (tiles later), local dice, personal notes, quicklinks.
**Design.** Phone-first at the table; the sheet is a view config over Creature + Statblock, not its own data model. Players own their characters; wardship/open editing grantable.
**Play.** Everything here is play-time; prep cost none.
**Decisions.** Dice local first; shared rolls arrive with Live Play's realtime.
**Depends on.** Creatures & Characters, Platform, Live Play (for shared state).

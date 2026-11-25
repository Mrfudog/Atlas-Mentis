---
id: "EP-08"
title: "Live-Spiel"
typ: "epic"
umfang: "Bereich Play: Spielleiter-Schirm, Initiative, Sitzungszustand und Live-Kanal, Würfel, Werkzeuge am Tisch."
frueher: "Live Play"
arten: ["Encounter", "Session", "Board"]
kanten: ["participates", "onMap"]
code: ["apps/server/src/live.ts", "packages/model/src/initiative.ts", "packages/model/src/dice.ts", "apps/web/src/app/kern/live.ts", "apps/web/src/app/karten/play.ts"]
doku: ["docs/Architektur.md", "docs/Spieltisch.md"]
tags: ["vtt", "epic"]
---
# EP-08 Live-Spiel

Bereich Play: Spielleiter-Schirm, Initiative, Sitzungszustand und Live-Kanal, Würfel, Werkzeuge am Tisch.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-050 Spielleiter-Schirm]] — Bereich Play: der Schirm mit seinen Boards über mehrere Fenster, Tischanzeige. | 3 | 10 | 1 teils · 2 offen |
| [[F-051 Initiative]] — Initiative für Leitung und Spielende, Zustände mit Dauer, Anzeige auf der Karte. | 12 | 39 | 6 steht · 1 teils · 5 offen |
| [[F-052 Sitzungszustand & Live-Kanal]] — Was gerade läuft, steht an der Sitzung und kommt live zu allen; Protokoll und Statistik. | 4 | 17 | 2 steht · 1 teils · 1 offen |
| [[F-053 Würfel]] — Würfeln für sich und für alle, mit Protokoll. | 2 | 5 | 2 steht |
| [[F-054 Werkzeuge am Tisch]] — Widgets: Notizen, Schnellanlage, Begegnung, Timer, Tabellen, Musik, Fragen. | 12 | 48 | 4 steht · 3 teils · 4 offen · 1 ersetzt |

### Wo es wohnt

**Arten:** [Encounter](../../docs/Artikeltypen.md#encounter), [Session](../../docs/Artikeltypen.md#session), [Board](../../docs/Artikeltypen.md#board)

**Kanten:** `participates`, `onMap`

**Code:** `apps/server/src/live.ts`, `packages/model/src/initiative.ts`, `packages/model/src/dice.ts`, `apps/web/src/app/kern/live.ts`, `apps/web/src/app/karten/play.ts`

**Erklärt in:** [Architektur.md](../../docs/Architektur.md), [Spieltisch.md](../../docs/Spieltisch.md)

**Offen mit Prio 1–3:** [[REQ-113]] Notiz-Widget (offen) · [[REQ-114]] Schnellanlage auf dem Schirm (teils) · [[REQ-120]] Spielprotokoll (teils) · [[REQ-123]] Timer (offen) · [[REQ-128]] Kampf aus Sicht der Spielenden (teils) · [[REQ-187]] Tischanzeige (offen) · [[REQ-204]] Spielleiter-Schirm (offen) · [[REQ-205]] Ein Board je Geschichtsartikel (teils) · [[REQ-292]] Neuen Artikel aus einer Auswahl anlegen (teils) · [[REQ-362]] Einträge im Tracker, die keine Kreatur sind: Umgebung, Lair, Menge und Homebrew-Quelle, mit eigener Initiative-Position (z. B. 20, verliert Gleichstand) oder ohne Position (nur in der Rundenübersicht) (offen) · [[REQ-363]] Auslöser je Option: Rundenbeginn, Rundenende, nach jedem Zug, nach Bewegung, bei Initiative X — mit Angebot an die Leitung (anzeigen, bestätigen, auslassen) (offen) · [[REQ-364]] Kontingente je Quelle und Frequenz als Check-Marks in einer Rundenübersicht für die Leitung, mit automatischem Zurücksetzen (Beginn des eigenen Zugs, Rundenbeginn) (offen) · [[REQ-365]] Spielende sehen von Rundenquellen und ihren Auslösungen nur, was die Leitung freigibt; die Rundenübersicht bleibt bei der Leitung (offen) · [[REQ-366]] Rundenoptionen aus Homebrew-Regelwerken (MCDM/Arcadis, z. B. Inspiration durch Spielende) kommen als Regelartikel ihrer Ebene herein, mit derselben Form wie Legendary und Lair (offen)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Live Play. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Live Play

**Scope.** Boards (user-owned configurable views with tabs and widgets; additionally a free canvas with placements of four kinds — entities, assets, inline shapes, tool widgets like the creature creator —, frames/viewpoint anchors, semantic zoom and the facet/renderer display system, REQ-157…166; v1 entry surface per AD-19), session state objects with a realtime channel, stewardship, initiative tracker, encounter runner, quick-create, reference box, notes, timers, party, quest board, generators, sound (embedded first), play log and statistics, combat player view.
**Prep.** Configure boards once; soundboard is the one high-prep-cost widget (integrate first).
**Play.** All of it. Session-aware widgets pull PCs from campaign membership and encounters from the session container. Damage attribution defaults to the current actor, changeable quietly. Multiple tabs/windows per user are natural because state lives once on the server.
**Decisions.** Improved Initiative as benchmark for the tracker, Soundtale for sound; music native at priority 5.
**Depends on.** Backbone (session state, containers), Platform (stewardship), Creatures, Campaign & Sessions.

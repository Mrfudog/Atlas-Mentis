---
id: "EP-05"
title: "Kampagne & Sitzungen"
typ: "epic"
umfang: "Kampagnenmanager, Bereich Story (Arcs, Quests, Szenen), Sitzungen und Vorbereitung, Begegnungen, Abenteuer übernehmen, Party, Ladebildschirm."
frueher: "Campaign & Sessions"
arten: ["Campaign", "Story", "Arc", "Quest", "Scene", "Session", "Encounter", "Party", "Board"]
kanten: ["partyOf", "memberOfParty", "questGiver", "questAbout", "happensAt", "participates", "involves", "placed", "chapterOf"]
code: ["packages/model/src/board.ts", "packages/model/src/parts.ts", "apps/web/src/app/boards", "apps/web/src/app/verwaltung", "apps/server/src/gruppe.ts"]
doku: ["docs/Datenmodell.md", "docs/Spieltisch.md"]
tags: ["vtt", "epic"]
---
# EP-05 Kampagne & Sitzungen

Kampagnenmanager, Bereich Story (Arcs, Quests, Szenen), Sitzungen und Vorbereitung, Begegnungen, Abenteuer übernehmen, Party, Ladebildschirm.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-029 Kampagne]] — Die Kampagne als Wurzel: Einstellungen, Kampagnenwerte, Anlegen mit Dialog, Bereiche als Seiten. | 5 | 12 | 3 steht · 1 teils · 1 offen |
| [[F-030 Bereich Story]] — Arcs, Kapitel, Quests, Szenen, Fäden — die Geschichte der Kampagne. | 4 | 11 | 2 steht · 2 offen |
| [[F-031 Sitzungen & Vorbereitung]] — Sitzungen, Vorbereitungsseite, Unfertiges und Todos, Schnellerfassung, Sitzungsansicht. | 9 | 25 | 6 steht · 2 teils · 1 offen |
| [[F-032 Begegnungen]] — Begegnungen bauen und vorbereiten, Begegnungstabellen, Weltzustand zwischen Sitzungen. | 4 | 12 | 2 steht · 2 offen |
| [[F-033 Abenteuer übernehmen]] — Vorgefertigte Abenteuer als Ebene, Kapitel und Szenen in die eigene Geschichte holen. | 2 | 18 | 2 steht |
| [[F-034 Party]] — Die Figurengruppe einer Kampagne mit ihrer Übersicht. | 3 | 7 | 2 steht · 1 teils |
| [[F-035 Ladebildschirm-Board]] — Ein öffentliches Board je Kampagne mit Widgets, das alle anpassen. | 1 | 3 | 1 offen |
| [[F-036 Sitzungsmitschnitt]] — Audio aufnehmen, transkribieren, Recap-Entwurf. | 4 | 26 | 4 offen |
| [[F-083 Quest-Generator]] — Ein Modul, das aus einem Wurf auf eine Quest- oder Encounter-Tabelle Quest, Questgegenstände und Kanten in einem Schritt anlegt. | 1 | 5 | 1 teils |

### Wo es wohnt

**Arten:** [Campaign](../../docs/Artikeltypen.md#campaign), [Story](../../docs/Artikeltypen.md#story), [Arc](../../docs/Artikeltypen.md#arc), [Quest](../../docs/Artikeltypen.md#quest), `Scene`, [Session](../../docs/Artikeltypen.md#session), [Encounter](../../docs/Artikeltypen.md#encounter), [Party](../../docs/Artikeltypen.md#party), [Board](../../docs/Artikeltypen.md#board)

**Kanten:** `partyOf`, `memberOfParty`, `questGiver`, `questAbout`, `happensAt`, `participates`, `involves`, `placed`, `chapterOf`

**Code:** `packages/model/src/board.ts`, `packages/model/src/parts.ts`, `apps/web/src/app/boards`, `apps/web/src/app/verwaltung`, `apps/server/src/gruppe.ts`

**Erklärt in:** [Datenmodell.md](../../docs/Datenmodell.md), [Spieltisch.md](../../docs/Spieltisch.md)

**Offen mit Prio 1–3:** [[REQ-079]] Schnelle Aktionen in der Sitzung (teils) · [[REQ-080]] Vorlesetexte nach der Sitzung freigeben (offen) · [[REQ-086]] Gruppenübersicht (teils) · [[REQ-180]] Gepflanzte Fäden (offen) · [[REQ-221]] Begegnungen bauen (offen) · [[REQ-236]] Kampagne mit Dialog anlegen (offen) · [[REQ-279]] Kampagnenwerte pflegen und in Texten nutzen (teils) · [[REQ-282]] Sitzungsansicht für das Spiel (teils) · [[REQ-283]] Kampagnen-Ladebildschirm (offen) · [[REQ-377]] Quest aus einer Tabelle würfeln (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Campaign & Sessions. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Campaign & Sessions

**Scope.** The campaign as root NarrativeContainer with attached CampaignSettings, WorldDate, KnowledgeState; DM-definable container hierarchy (Arc, Session, Scene, …); sessions with planned/occurred encounters; readalouds that unlock; quests and personal goals; ideas inbox; bulk actions.
**Prep.** The container view is the DM's prep cockpit: scenes, quests, storylines, encounters, notes in one place. Ideas (status idea/planned/used/discarded) consolidate per campaign or player; a view toggle switches planning vs clean view.
**Play.** DM quick actions: grant knowledge, reveal block, mark encounter occurred — one tap each.
**Decisions.** Encounter is a backbone entity attachable at any container level (campaign-level random encounters); quests deliberately non-crucial and player-creatable; calendar parked (priority 5) because of its lore coupling.
**Depends on.** Backbone (containers, blocks, status), Platform (knowledge state).

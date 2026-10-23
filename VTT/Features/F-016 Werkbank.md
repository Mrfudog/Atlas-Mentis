---
id: "F-016"
title: "Werkbank"
typ: "feature"
epic: "[[EP-02 Zugang & Betrieb]]"
beschreibung: "Prüfungen über den Bestand, Massenänderungen mit Vorschau und Rückgängig (/werkbank)."
tags: ["vtt", "feature"]
---
# F-016 Werkbank

Prüfungen über den Bestand, Massenänderungen mit Vorschau und Rückgängig (/werkbank).

Epic: [[EP-02 Zugang & Betrieb]]

## Stories

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
3 Stories · 13 Punkte · 1 steht · 1 teils · 1 offen

| Story | Rolle | Prio | Stand |
|---|---|---|---|
| [[REQ-088]] Massenänderungen an Wissen und Rechten | Spielleitung | 3 | teils |
| [[REQ-235]] Werkbank: Prüfungen und Massenänderungen | Spielleitung | 3 | steht |
| [[REQ-381]] Ein Rahmen für alle Werkbank-Seiten | Verwaltung | 2 | offen |
<!-- stories:ende -->

## Löschen aus der eigenen Ebene (T-381)

Seit T-381 löscht nicht nur die Werkbank: `POST /api/entities/delete` nimmt eine Auswahl und löscht davon, was in der Schreibebene des Kontos liegt und was es schreiben darf (`pickDeletable`, `packages/model/src/deletion.ts`). Der Rest wird abgewählt und mit Grund zurückgegeben (`other-layer`, `not-writable`, `not-found`, `protected`). Ausgeführt wird als Massenänderung `delete` — dieselben Folgen (Teile, Kanten, Instanzen) und dasselbe Undo; den eigenen Lauf nimmt auch eine Spielerin zurück, ohne `force`. Folgen an fremden Artikeln (eine Kante auf das Gelöschte) sperren das Löschen nicht. Galerie und Artikelseite nutzen es (`kern/loeschen.ts`). Siehe [[REQ-235]], D84, E-160.


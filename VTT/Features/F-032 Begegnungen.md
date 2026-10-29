---
id: "F-032"
title: "Begegnungen"
typ: "feature"
epic: "[[EP-05 Kampagne & Sitzungen]]"
beschreibung: "Begegnungen bauen und vorbereiten, Begegnungstabellen, Weltzustand zwischen Sitzungen."
tags: ["vtt", "feature"]
---
# F-032 Begegnungen

Begegnungen bauen und vorbereiten, Begegnungstabellen, Weltzustand zwischen Sitzungen.

Epic: [[EP-05 Kampagne & Sitzungen]]

## Stories

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
4 Stories · 12 Punkte · 2 steht · 2 offen

| Story | Rolle | Prio | Stand |
|---|---|---|---|
| [[REQ-085]] Begegnungen | Spielleitung | 2 | steht |
| [[REQ-172]] Begegnungstabellen je Gebiet | Spielleitung | 3 | steht |
| [[REQ-173]] Weltzustand zwischen Sitzungen | Spielleitung | 4 | offen |
| [[REQ-221]] Begegnungen bauen | Spielleitung | 3 | offen |
<!-- stories:ende -->

## Was eine Begegnung trägt (T-333)

Ort (`happensAt` → Ort, wie bei einer Szene), Karte (`onMap`) und Beute
(`loot` mit Menge und Chance) stehen auf der Seite der Begegnung als
Gruppen — im Ansichtsdesigner verschieb- und abschaltbar. Angelegt wird
unter „Edit" › Relations; die Auswahl bietet „Create … as …".

**Vier Goblins sind vier Kanten.** Im Tracker nimmt „Add a combatant"
eine Anzahl (×, höchstens 20): jeder bekommt seine eigene Zeile mit
eigener Initiative und eigenen Trefferpunkten, durchgezählt „Goblin 1"
bis „Goblin 4". Eine Anzahl *an* der Kante hätte vier Stände in einem
Feld geführt. Auch hier legt die Auswahl einen fehlenden Gegner gleich an.

```mermaid
flowchart LR
  E["Encounter"] -- happensAt --> O["Ort"]
  E -- onMap --> K["Karte"]
  E -- "loot · Menge, Chance" --> G["Gegenstand"]
  T["Tracker: Add ×3"] -. "drei participates-Kanten" .-> E
```

Offen: ob Szene („Scene / Encounter") und Begegnung eine Art werden
(E-118), und „Prepare on map" direkt an der Begegnung.

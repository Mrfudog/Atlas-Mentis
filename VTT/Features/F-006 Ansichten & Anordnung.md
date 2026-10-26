---
id: "F-006"
title: "Ansichten & Anordnung"
typ: "feature"
epic: "[[EP-01 Inhaltsgerüst]]"
beschreibung: "Overview, Quick, Full, Print, Search und eigene Ansichten; Anordnung am Typ, ohne Code."
tags: ["vtt", "feature"]
---
# F-006 Ansichten & Anordnung

Overview, Quick, Full, Print, Search und eigene Ansichten; Anordnung am Typ, ohne Code.

Epic: [[EP-01 Inhaltsgerüst]]

## Stories

## Collection (T-425, 26.10.2026)

Ein Artikel zeigt, was an ihm hängt, in der Ansicht **seiner Art**: die
Session ihre Szenen und Begegnungen als Kacheln, jede die Kurzansicht der
Szene. Das Element wählt die Ansicht, nicht die Kante (E-172); gesiebt hat
der Server; in einer Kachel zeichnet eine weitere Collection nichts.

```mermaid
flowchart LR
  S["Session · full"] --> C["Element collection<br/>path ← partOf, types, show, view, sort"]
  C --> R["Rückbezüge + Artikel<br/>(gesiebt am Server)"]
  R --> H["collectionHits / collectionGroups"]
  H --> K["je Treffer nw-vorschau<br/>Ansicht der Zielart (quick)"]
```

## Schichten (T-425, 26.10.2026)

Eine Ansicht lässt sich für alle, einen Typ, eine Bedingung (Feld, Kante)
oder einen Artikel **überlagern**, statt sie zu kopieren (E-168): eine
Ansichtszeile mit `adjust` (UI *overlay*) fügt hinzu, verschiebt, nimmt
weg; der Rest folgt der Ansicht. Elemente stehen nach Position (`pos`,
still 10, 20 … der Grundlage), gleich genau ordnet `priority`. Treffen
sich zwei Schichten, zeigt der Designer ⚠ und die Werkbank die Prüfung
„View conflicts“ (E-173). Der Designer speichert „nur dieser Artikel“ und
„mit Bedingung“ auf Wunsch als Schicht (`contributionFrom`).

```mermaid
flowchart LR
  T["Anordnung der Art"] --> G["alle"] --> Ty["Typ"] --> B["Bedingung"] --> A["Artikel"]
  A --> S["nach pos, Priorität, Genauigkeit"]
  S --> D["Designer: Herkunft, ⚠"]
  S --> W["Werkbank: View conflicts"]
```

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
5 Stories · 24 Punkte · 2 steht · 2 offen · 1 ersetzt

| Story | Rolle | Prio | Stand |
|---|---|---|---|
| [[REQ-026]] Ansichten festlegen | Spielleitung | 1 | steht |
| [[REQ-164]] Darstellungsstufen als eigenes System | – | 2 | ersetzt |
| [[REQ-256]] Ansichten ohne Code definieren | Spielleitung | 1 | steht |
| [[REQ-376]] Sammlungsansichten neben Artikelansichten | Spielleitung | 2 | offen |
| [[REQ-383]] Ansicht je Artikeltyp teilen, mit Vorschau als Spieler | Spielleitung | 2 | offen |
<!-- stories:ende -->

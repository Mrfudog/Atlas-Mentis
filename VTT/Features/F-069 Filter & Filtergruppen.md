---
id: "F-069"
title: "Filter & Filtergruppen"
typ: "feature"
epic: "[[EP-11 Oberfläche & Navigation]]"
beschreibung: "Filter einer Seite, gespeicherte Filtergruppen."
tags: ["vtt", "feature"]
---
# F-069 Filter & Filtergruppen

Filter einer Seite, gespeicherte Filtergruppen.

Epic: [[EP-11 Oberfläche & Navigation]]

## Stories

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
3 Stories · 7 Punkte · 3 steht

| Story | Rolle | Prio | Stand |
|---|---|---|---|
| [[REQ-302]] Der Filter gehört der Seite | Spielleitung | 3 | steht |
| [[REQ-303]] Filtergruppen je Seite | Spielleitung | 2 | steht |
| [[REQ-318]] Ein Ebenenfilter, global und speicherbar | Spielleitung | 2 | steht |
<!-- stories:ende -->

## Wann und von wem (T-382)

„When & who" in der Seitenleiste jeder Übersicht: **Added** und **Changed** (`today`, `7d`, `30d`, `von..bis`) lesen `created_at`/`updated_at` des Artikels, **Added by** liest `entity_creator` — eine Tabelle neben dem Konto, gesetzt beim Anlegen, Hochladen, bei Fassungen und beim Holen, nachgezogen aus `app_user_article` und `entity.created` (Migration 139). Die Wahl reist als Facette in `f=` (`@added:7d`, `@by:<konto>`), darum gilt sie in Adresse und Filtergruppen ohne eigenes Feld; „heute" rechnet der Server mit der Zeitzone des Browsers (`tz`, `parseTimeWindow`). Siehe [[REQ-303]], D85.

```mermaid
flowchart LR
  A[Seitenleiste: When & who] -->|f=@added:7d, @by:id| B[GET /api/list]
  B --> C[gesiebter Index]
  D[(entity: created_at, updated_at)] --> C
  E[(entity_creator)] --> C
  C -->|Fenster, Konto, Sortierung| F[Zeilen + Facette Added by]
```


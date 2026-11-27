---
id: "F-074"
title: "Regelwerke anderer Verlage"
typ: "feature"
epic: "[[EP-12 Import & Inhalte]]"
beschreibung: "Pakete wie Kibbles’ Compendium über die API laden."
tags: ["vtt", "feature"]
---
# F-074 Regelwerke anderer Verlage

Pakete wie Kibbles’ Compendium über die API laden.

Epic: [[EP-12 Import & Inhalte]]

## Stories

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
2 Stories · 13 Punkte · 1 teils · 1 offen

| Story | Rolle | Prio | Stand |
|---|---|---|---|
| [[REQ-314]] Regelwerk eines Drittverlags laden | Spielleitung | 3 | teils |
| [[REQ-380]] Bücher über konfigurierbare Strukturen zerlegen | Verwaltung | 3 | offen |
<!-- stories:ende -->

## Paketformat für MCDM-Formen (T-497, 27.11.2026)

Ein Paket füllt Gefolge, Stufenaktionen, Villain Actions und Minions mit
den Feldern und Kanten des Registers (`Statblock.pbFrom`, `Action.round`,
`composedOf.props.level`, `follows` …; Beispiel im Kopf von
`scripts/regelwerk/plan.mjs`). `check` prüft jetzt auch die Werte gegen
Aufzählung und Spanne (`valueProblem`) — ein `round: 0` hält den Lauf an,
bevor der Server ihn abweist. Als Nächstes: *Flee, Mortals!* und
*Strongholds & Followers* einlesen (eigener Auftrag, Inhalt nur auf dev).


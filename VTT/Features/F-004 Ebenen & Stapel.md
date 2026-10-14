---
id: "F-004"
title: "Ebenen & Stapel"
typ: "feature"
epic: "[[EP-01 Inhaltsgerüst]]"
beschreibung: "Ebenen, Gruppen von Ebenen, Herausgeber, Aufschalten (auch teilweise) und was im Stapel einer Kampagne steht."
tags: ["vtt", "feature"]
---
# F-004 Ebenen & Stapel

Ebenen, Gruppen von Ebenen, Herausgeber, Aufschalten (auch teilweise) und was im Stapel einer Kampagne steht.

Epic: [[EP-01 Inhaltsgerüst]]

## Stories

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
13 Stories · 52 Punkte · 6 steht · 4 teils · 3 offen

| Story | Rolle | Prio | Stand |
|---|---|---|---|
| [[REQ-004]] Layer entity: types system/expansion/world/pack/campaign/override-set, dependsOn, nesting by link with priority | – | 1 | steht |
| [[REQ-005]] Entry relation: entity→layer with mode adds/overrides/removes, addedAt/addedBy, optional version pin | – | 1 | steht |
| [[REQ-006]] Stack resolution: campaign-activated ordered layers, specificity precedence (campaign > pack > world > system) | – | 1 | teils |
| [[REQ-007]] Stack expert settings: layer priority, per-entry pick, disable single override, flatten into independent layer | – | 3 | offen |
| [[REQ-044]] Scope inspector sidebar, slim: effective source layer per block/property | – | 2 | steht |
| [[REQ-045]] Scope inspector sidebar, full: layer actions (override here, create variant, move to pack, pick entry) | – | 3 | offen |
| [[REQ-100]] World as scope and layer (members, owns content, activated by campaigns) | – | 1 | teils |
| [[REQ-102]] Contextual article rendering per stack: knowledge, time, scope resolved at read time | – | 2 | teils |
| [[REQ-244]] Ebenen gruppieren (Grundregeln, Ergänzungen, Settings, Abenteuer, Unearthed Arcana, 2024, Eigenes …), gruppenweise auf- und zuklappen und aufschalten | – | 2 | steht |
| [[REQ-245]] Ebenen beschreiben sich selbst: voller Titel, erklärte Abkürzung, Erscheinungsdatum, Regelstand (2014/2024), Gruppe, Inhalt je Art; Quellenkürzel an Artikeln zeigen überall den vollen Namen | – | 2 | steht |
| [[REQ-249]] Ebenen nach Herausgeber und Kategorie: offizielles D&D, Partner-Inhalte, Drittanbieter, Homebrew — dazu die Kategorien wie in 5e.tools (Utilities › Content Blocklist), damit die Auswahl leichtfällt | – | 2 | teils |
| [[REQ-253]] Ebenen und Artikel kopieren: eine ganze Ebene oder ausgewählte Artikel daraus in eine andere (eigene) Ebene kopieren, z. B. in der Werkbank | – | 3 | offen |
| [[REQ-255]] Ebenen teilweise aufschalten: aus einem Buch oder Abenteuer nur Regeln/Gegenstände nehmen, nicht dessen Orte, NSC und Begegnungen (Auswahl nach Bereich World/Rules/Story bzw. Art) | – | 2 | steht |
<!-- stories:ende -->

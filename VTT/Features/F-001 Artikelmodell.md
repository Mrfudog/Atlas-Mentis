---
id: "F-001"
title: "Artikelmodell"
typ: "feature"
epic: "[[EP-01 Inhaltsgerüst]]"
beschreibung: "Peg, Karten je Art, Kanten, Bezeichner — wie ein Artikel gespeichert wird."
tags: ["vtt", "feature"]
---
# F-001 Artikelmodell

Peg, Karten je Art, Kanten, Bezeichner — wie ein Artikel gespeichert wird.

Epic: [[EP-01 Inhaltsgerüst]]

## Stories

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
9 Stories · 25 Punkte · 5 steht · 2 ersetzt · 2 verworfen

| Story | Rolle | Prio | Stand |
|---|---|---|---|
| [[REQ-001]] Core entity model: entity types, shared property types, typed relations, immutable IDs | – | 1 | steht |
| [[REQ-002]] Successor chain: successorId, resolution to head so old links stay valid | – | 1 | ersetzt |
| [[REQ-010]] Dimensions: optional, sparsely stored property bundles (Visibility, TemporalValidity, KnowledgeRequirement, Reputation…) | – | 1 | steht |
| [[REQ-011]] ContentBlock primitive: text + visibility + knowledge requirement + scope + temporal validity + pack membership | – | 1 | ersetzt |
| [[REQ-016]] Term / translation layer: pseudoname key, LocalizedText, fallback chain DE → EN → key | – | 1 | verworfen |
| [[REQ-019]] RawContent coexistence: every import keeps its raw form (markdown, OCR, JSON) next to structured data | – | 1 | verworfen |
| [[REQ-163]] Opaque IDs: no semantics (pack/type/version) in peg IDs; provenance via source metadata (`source_pack`, `source_version`); copying only as explicit fork with `forkedFrom` | – | 1 | steht |
| [[REQ-181]] Ad-hoc fields on a single entity, promotable into the interface definition | – | 2 | steht |
| [[REQ-182]] Relation inverse labels in `relation_def`, so one stored edge renders correctly from both ends | – | 2 | steht |
<!-- stories:ende -->

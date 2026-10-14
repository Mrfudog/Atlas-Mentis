---
id: "F-012"
title: "Sichtbarkeit & Wissen"
typ: "feature"
epic: "[[EP-02 Zugang & Betrieb]]"
beschreibung: "Wer einen Artikel sieht (audience, revealedTo, hiddenFrom) und welche Felder darin (Information, Wissen, Deckname)."
tags: ["vtt", "feature"]
---
# F-012 Sichtbarkeit & Wissen

Wer einen Artikel sieht (audience, revealedTo, hiddenFrom) und welche Felder darin (Information, Wissen, Deckname).

Epic: [[EP-02 Zugang & Betrieb]]

## Stories

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
9 Stories · 25 Punkte · 7 steht · 1 ersetzt · 1 verworfen

| Story | Rolle | Prio | Stand |
|---|---|---|---|
| [[REQ-038]] Visibility evaluation, simple: gm_only vs campaign | – | 1 | steht |
| [[REQ-039]] Visibility evaluation, full: scope, allowed/denied roles, knowledgeTags, requiresTags, sharedUsers | – | 3 | ersetzt |
| [[REQ-040]] Knowledge tags & KnowledgeState per campaign (grants, holders, since) | – | 2 | steht |
| [[REQ-059]] Creature knowledge facts: gated ContentBlocks on type / species / faction | – | 3 | steht |
| [[REQ-156]] Visibility inheritance container → children: `inherit: true` on Visibility, evaluated by Resolution | – | 2 | verworfen |
| [[REQ-177]] Field-level knowledge gating: grant individual components or fields of an entity, not only ContentBlocks | – | 2 | steht |
| [[REQ-178]] Cover names: an entity may carry a player-facing alias shown while its identity is ungranted | – | 3 | steht |
| [[REQ-179]] Known-unknowns disclosure: a gated view may reveal the count of withheld facts without revealing them | – | 4 | steht |
| [[REQ-203]] Fraktionen mit Rängen: `Faction.ranks` als Leiter (niedrigster zuerst), der Rang eines Mitglieds an der Kante `memberOf`, und eine Wissenszuteilung an die Fraktion darf einen Mindestrang nennen — was der Zirkel weiss, weiss der Novize noch nicht | – | 2 | steht |
<!-- stories:ende -->

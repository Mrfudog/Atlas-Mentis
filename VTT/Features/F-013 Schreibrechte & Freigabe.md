---
id: "F-013"
title: "Schreibrechte & Freigabe"
typ: "feature"
epic: "[[EP-02 Zugang & Betrieb]]"
beschreibung: "Wer was schreibt (je Ebene, eigene Artikel), Status ready als Freigabe, gesperrte Felder."
tags: ["vtt", "feature"]
---
# F-013 Schreibrechte & Freigabe

Wer was schreibt (je Ebene, eigene Artikel), Status ready als Freigabe, gesperrte Felder.

Epic: [[EP-02 Zugang & Betrieb]]

## Stories

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
6 Stories · 23 Punkte · 2 steht · 2 teils · 2 offen

| Story | Rolle | Prio | Stand |
|---|---|---|---|
| [[REQ-041]] Wer was schreiben darf | Spielleitung | 2 | teils |
| [[REQ-042]] Schreibrecht je Feldgruppe | Spielleitung | 4 | offen |
| [[REQ-237]] Spielende legen Artikel an, die Leitung gibt frei | Spieler | 2 | steht |
| [[REQ-242]] Felder der eigenen Figur sperren | Spielleitung | 3 | offen |
| [[REQ-316]] Eigene Ebene je Spieler als Vorgabe | Spieler | 1 | steht |
| [[REQ-367]] Ebene eines Artikels im Bearbeiten ändern, als erstes Feld | Spielleitung | 2 | teils |
<!-- stories:ende -->

## Ebene im Bearbeiten (T-383)

Das erste Feld der Maske ist die Ebene. Gespeichert wird sie als Kante
`inLayer` (`withHomeLayer` in `packages/model/src/layermove.ts`), geprüft im
selben `PUT` wie alles andere: was dazukommt (`layerChange`), muss eine
Schreibebene des Kontos in der laufenden Kampagne sein (`zielEbenen`), aus
jeder Ebene heraus nimmt nur die Verwaltung. Was mitwandert, ist offen:
E-161. Story: [[REQ-367]].

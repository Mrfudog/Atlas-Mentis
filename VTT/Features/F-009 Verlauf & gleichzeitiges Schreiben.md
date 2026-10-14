---
id: "F-009"
title: "Verlauf & gleichzeitiges Schreiben"
typ: "feature"
epic: "[[EP-01 Inhaltsgerüst]]"
beschreibung: "Änderungsverlauf, Revisionen, nichts still überschreiben."
tags: ["vtt", "feature"]
---
# F-009 Verlauf & gleichzeitiges Schreiben

Änderungsverlauf, Revisionen, nichts still überschreiben.

Epic: [[EP-01 Inhaltsgerüst]]

## Stories

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
3 Stories · 8 Punkte · 2 steht · 1 teils

| Story | Rolle | Prio | Stand |
|---|---|---|---|
| [[REQ-003]] Change chain: every change as entry (who/when/what) along the version chain, git-log style | – | 1 | teils |
| [[REQ-191]] Fail-closed persistence: a failed load or migration must never be overwritten by a later autosave; the unreadable state is preserved and downloadable | – | 1 | steht |
| [[REQ-192]] Optimistic concurrency for non-realtime edits: per-entity revision check; the second writer is rejected with a merge prompt rather than silently winning | – | 2 | steht |
<!-- stories:ende -->

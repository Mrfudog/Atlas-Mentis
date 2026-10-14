---
id: "EP-02"
title: "Zugang & Betrieb"
typ: "epic"
umfang: "Konten, Rollen je Kampagne, Sichtbarkeit und Wissen, Schreibrechte, API-Tokens, Werkbank, Ausrollen, Sicherung, Übernahme zwischen dev und prod, Leistung."
frueher: "Platform & Access, Cross-cutting"
tags: ["vtt", "epic"]
---
# EP-02 Zugang & Betrieb

Konten, Rollen je Kampagne, Sichtbarkeit und Wissen, Schreibrechte, API-Tokens, Werkbank, Ausrollen, Sicherung, Übernahme zwischen dev und prod, Leistung.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-010 Anmeldung & Konten]] — Passwort je Konto, Einladungen, Kontoverwaltung in der Seite, Demo. | 7 | 17 | 3 steht · 3 offen · 1 verworfen |
| [[F-011 Rollen je Kampagne]] — gm, co-gm, player, spectator am Konto je Kampagne; Verwaltung der Installation. | 3 | 6 | 3 steht |
| [[F-012 Sichtbarkeit & Wissen]] — Wer einen Artikel sieht (audience, revealedTo, hiddenFrom) und welche Felder darin (Information, Wissen, Deckname). | 9 | 25 | 7 steht · 1 ersetzt · 1 verworfen |
| [[F-013 Schreibrechte & Freigabe]] — Wer was schreibt (je Ebene, eigene Artikel), Status ready als Freigabe, gesperrte Felder. | 4 | 18 | 1 steht · 1 teils · 2 offen |
| [[F-014 Sicht eines Spielers]] — Die Leitung sieht die Seite, wie ein bestimmtes Konto sie sieht. | 1 | 5 | 1 steht |
| [[F-015 API-Tokens & Werkzeugzugang]] — Tokens am Konto für Skripte und Claude-Sitzungen. | 2 | 3 | 1 steht · 1 teils |
| [[F-016 Werkbank]] — Prüfungen über den Bestand, Massenänderungen mit Vorschau und Rückgängig (/werkbank). | 2 | 8 | 1 steht · 1 teils |
| [[F-017 Ausrollen & Sicherung]] — CI/CD nach Hetzner, dev und prod, Sicherungen, Spiegelung, Netz. | 5 | 12 | 3 steht · 1 teils · 1 offen |
| [[F-018 Übernahme dev - prod]] — Artikel auf dev vorbereiten und nach prod übernehmen, Konflikte lösen. | 2 | 10 | 1 teils · 1 offen |
| [[F-019 Leistung & Laden]] — Listen am Server, schnelle Navigation, Ladeanzeige. | 2 | 10 | 2 steht |
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Platform & Access, Cross-cutting. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Platform & Access

**Scope.** Who you are and what you may see or change: authentication, users, membership triples (user + scope + role), visibility evaluation, edit permissions, campaign configuration, scope inspector.
**Prep.** Onboarding players, assigning roles per campaign or world, granting co-editors, configuring house rules.
**Play.** Knowledge grants and visibility resolution must be one-tap fast.
**Decisions.** Password-hash auth behind an interface (OIDC later); roles GM/Player first; full visibility schema stored from day one, only `gm_only`/`campaign` evaluated initially; GM-edits-everything as an overridable default; several people may build one world.
**Depends on.** Backbone (dimensions, layers).

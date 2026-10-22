---
id: "EP-02"
title: "Zugang & Betrieb"
typ: "epic"
umfang: "Konten, Rollen je Kampagne, Sichtbarkeit und Wissen, Schreibrechte, API-Tokens, Werkbank, Ausrollen, Sicherung, Übernahme zwischen dev und prod, Leistung."
frueher: "Platform & Access, Cross-cutting"
arten: ["Visibility", "Information", "Knowledge", "Faction", "Party"]
kanten: ["knownBy", "includes", "memberOf", "memberOfParty"]
code: ["apps/server/src/auth.ts", "apps/server/src/user.ts", "apps/server/src/ebenenrechte.ts", "apps/server/src/schreibebene.ts", "apps/server/src/uebernahme.ts", "packages/model/src/visibility.ts", "packages/model/src/knowledge.ts", "packages/model/src/checks.ts", "packages/model/src/bulk.ts", "apps/web/src/app/werkbank", "apps/web/src/app/konto"]
doku: ["docs/Zugang.md", "docs/Wissen.md", "docs/Betrieb.md", "docs/Architektur.md"]
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
| [[F-012 Sichtbarkeit & Wissen]] — Wer einen Artikel sieht (audience, revealedTo, hiddenFrom) und welche Felder darin (Information, Wissen, Deckname). | 16 | 50 | 11 steht · 3 offen · 1 ersetzt · 1 verworfen |
| [[F-013 Schreibrechte & Freigabe]] — Wer was schreibt (je Ebene, eigene Artikel), Status ready als Freigabe, gesperrte Felder. | 6 | 23 | 2 steht · 2 teils · 2 offen |
| [[F-014 Sicht eines Spielers]] — Die Leitung sieht die Seite, wie ein bestimmtes Konto sie sieht. | 1 | 5 | 1 steht |
| [[F-015 API-Tokens & Werkzeugzugang]] — Tokens am Konto für Skripte und Claude-Sitzungen. | 2 | 3 | 1 steht · 1 teils |
| [[F-016 Werkbank]] — Prüfungen über den Bestand, Massenänderungen mit Vorschau und Rückgängig (/werkbank). | 3 | 13 | 1 steht · 1 teils · 1 offen |
| [[F-017 Ausrollen & Sicherung]] — CI/CD nach Hetzner, dev und prod, Sicherungen, Spiegelung, Netz. | 5 | 12 | 3 steht · 1 teils · 1 offen |
| [[F-018 Übernahme dev - prod]] — Artikel auf dev vorbereiten und nach prod übernehmen, Konflikte lösen. | 2 | 10 | 1 teils · 1 offen |
| [[F-019 Leistung & Laden]] — Listen am Server, schnelle Navigation, Ladeanzeige. | 2 | 10 | 2 steht |
| [[F-080 Qualität & Tests]] — Drei Teststufen für jede Änderung — Unit, Integration, E2E im Browser — und wie das CI sie fährt. | 1 | 5 | 1 steht |
| [[F-084 Projektsteuerung & Vermittlung]] — Was die Seite kann, geplant hat und offen lässt, für die Leitung sichtbar machen: Featureseiten im Projektbrett, Demo-Video. | 2 | 8 | 1 teils · 1 offen |

### Wo es wohnt

**Arten:** `Visibility`, [Information](../../docs/Artikeltypen.md#information), [Knowledge](../../docs/Artikeltypen.md#knowledge), [Faction](../../docs/Artikeltypen.md#faction), [Party](../../docs/Artikeltypen.md#party)

**Kanten:** `knownBy`, `includes`, `memberOf`, `memberOfParty`

**Code:** `apps/server/src/auth.ts`, `apps/server/src/user.ts`, `apps/server/src/ebenenrechte.ts`, `apps/server/src/schreibebene.ts`, `apps/server/src/uebernahme.ts`, `packages/model/src/visibility.ts`, `packages/model/src/knowledge.ts`, `packages/model/src/checks.ts`, `packages/model/src/bulk.ts`, `apps/web/src/app/werkbank`, `apps/web/src/app/konto`

**Erklärt in:** [Zugang.md](../../docs/Zugang.md), [Wissen.md](../../docs/Wissen.md), [Betrieb.md](../../docs/Betrieb.md), [Architektur.md](../../docs/Architektur.md)

**Offen mit Prio 1–3:** [[REQ-041]] Wer was schreiben darf (teils) · [[REQ-088]] Massenänderungen an Wissen und Rechten (teils) · [[REQ-229]] Konten in der Seite verwalten (offen) · [[REQ-242]] Felder der eigenen Figur sperren (offen) · [[REQ-268]] Dev-Token aus der Werkbank erzeugen (teils) · [[REQ-269]] Ankündigen, wann produktiv gearbeitet werden kann (teils) · [[REQ-270]] Artikel von dev nach prod übernehmen (teils) · [[REQ-271]] Konflikte bei der Übernahme nebeneinander lösen (offen) · [[REQ-354]] Wissenspunkte bei eigener Herkunft und eigenem Hintergrund (offen) · [[REQ-367]] Ebene eines Artikels im Bearbeiten ändern, als erstes Feld (teils) · [[REQ-371]] Information aus Feld, Textteil oder Beziehung (offen) · [[REQ-372]] Regeln lernen, wenn sie vorkommen (offen) · [[REQ-381]] Ein Rahmen für alle Werkbank-Seiten (offen) · [[REQ-392]] Featureseiten im Projektbrett (offen) · [[REQ-393]] Demo-Video der Seite (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Platform & Access, Cross-cutting. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Platform & Access

**Scope.** Who you are and what you may see or change: authentication, users, membership triples (user + scope + role), visibility evaluation, edit permissions, campaign configuration, scope inspector.
**Prep.** Onboarding players, assigning roles per campaign or world, granting co-editors, configuring house rules.
**Play.** Knowledge grants and visibility resolution must be one-tap fast.
**Decisions.** Password-hash auth behind an interface (OIDC later); roles GM/Player first; full visibility schema stored from day one, only `gm_only`/`campaign` evaluated initially; GM-edits-everything as an overridable default; several people may build one world.
**Depends on.** Backbone (dimensions, layers).

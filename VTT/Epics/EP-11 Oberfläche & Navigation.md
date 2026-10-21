---
id: "EP-11"
title: "Oberfläche & Navigation"
typ: "epic"
umfang: "Boards, Suche, Filter und Filtergruppen, Navigation und Kurzansicht, Bearbeiten in der Ansicht, Design und Stilkonzept."
frueher: "Cross-cutting"
arten: ["Board"]
kanten: ["placed"]
code: ["apps/web/src/app/suche", "apps/web/src/app/kern", "apps/web/src/app/artikel/kurzpopup.ts", "apps/web/src/app/neues", "apps/server/src/filtergruppen.ts", "packages/model/src/views.ts", "packages/model/src/facets.ts"]
doku: ["docs/Architektur.md", "docs/UI-Arbeitsplan.md", "docs/Web-Arbeitsplan.md", "docs/design"]
tags: ["vtt", "epic"]
---
# EP-11 Oberfläche & Navigation

Boards, Suche, Filter und Filtergruppen, Navigation und Kurzansicht, Bearbeiten in der Ansicht, Design und Stilkonzept.

## Features

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
| Feature | Stories | Punkte | Stand |
|---|---|---|---|
| [[F-067 Boards]] — Leinwände mit Platzierungen, Ankern und Bereichen; Anlegen auf dem Board. | 13 | 61 | 8 steht · 2 teils · 3 offen |
| [[F-068 Suche]] — Übergreifende Suche beim Tippen, Volltext. | 2 | 6 | 1 steht · 1 teils |
| [[F-069 Filter & Filtergruppen]] — Filter einer Seite, gespeicherte Filtergruppen. | 3 | 7 | 3 steht |
| [[F-070 Navigation & Kurzansicht]] — Kopfleiste, Brotkrumen, Kurzansicht als Popup, Kampagne und Ebene sichtbar. | 6 | 19 | 5 steht · 1 teils |
| [[F-071 Bearbeiten in der Ansicht]] — Felder dort bearbeiten, wo sie stehen; optionale Felder; Löschen mit Rückfrage. | 2 | 3 | 2 steht |
| [[F-072 Design & Stilkonzept]] — Pergament wie die Bücher, Lesbarkeit, Stilkonzept, Sprache der Oberfläche. | 4 | 10 | 1 steht · 1 teils · 1 offen · 1 ersetzt |

### Wo es wohnt

**Arten:** [Board](../../docs/Artikeltypen.md#board)

**Kanten:** `placed`

**Code:** `apps/web/src/app/suche`, `apps/web/src/app/kern`, `apps/web/src/app/artikel/kurzpopup.ts`, `apps/web/src/app/neues`, `apps/server/src/filtergruppen.ts`, `packages/model/src/views.ts`, `packages/model/src/facets.ts`

**Erklärt in:** [Architektur.md](../../docs/Architektur.md), [UI-Arbeitsplan.md](../../docs/UI-Arbeitsplan.md), [Web-Arbeitsplan.md](../../docs/Web-Arbeitsplan.md), [design](../../docs/design)

**Offen mit Prio 1–3:** [[REQ-028]] Volltextsuche (teils) · [[REQ-119]] Boards der Spielenden (offen) · [[REQ-160]] Zwischen Ankern springen (teils) · [[REQ-166]] Auf dem Board anlegen (teils) · [[REQ-291]] Leseansicht auf dem Board (offen) · [[REQ-300]] Gestaltung wie die Bücher (teils) · [[REQ-345]] Schwebende Werkzeugleiste für eine Auswahl (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.
<!-- stories:ende -->

## Aus dem früheren Funktionsbereich

Früher: Cross-cutting. Der Text stammt aus `VTT/Areas.md` (Stand 2026-10-13) und ist ein Ausgangspunkt, kein Stand.

### Cross-cutting

German UI output with i18n-ready strings; phone-first responsive design as a hard criterion for the component library; deployment as container(s) on the NAS with reverse proxy, TLS and remote access; backups. Principle for every UI: smart defaults, quiet overrides.

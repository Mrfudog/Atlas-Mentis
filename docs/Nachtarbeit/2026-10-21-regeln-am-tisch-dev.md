# Regeln am Tisch auf dev — Protokoll (REQ-357, T-270)

21.10.2026, Sitzung https://claude.ai/code/session_01JUVBWPASruwK7U6SbFLpjE.
Nach PR #285 (Option „Rules from graphs“, `Campaign.ruleGraphs`,
Migration 112), auf preprod ausgerollt. Freigabe der Leitung am 20.10.
Konto `werkbank` (Verwaltung), gegen dev.ttrpg.fuchsbau.io. Keine
Buchebene wurde beschrieben.

## 1. Artikel für die Option

`node scripts/regeln-anlegen.mjs <plan.json> --state <journal> --only ruleGraphs`
(Plan und Journal ausserhalb des Repos). Neu ist der Schalter `--only`:
dev meldete 34 fehlende Regelartikel, fast alle aus Optionen anderer
Sitzungen (Items, Combat, Map tools …). Angelegt wurde nur, was zu dieser
Änderung gehört. Das Journal bekam vorher die neun Ids aus dem Protokoll
vom 20.10. (`2026-10-20-regeln-anlegen.md`), damit nichts doppelt entsteht.

Probe: 3 anzulegen. Lauf: **3 angelegt**, in „Table rules“
(`ly_8cfaa40f341d`), `partOf` auf „At the table“ bzw. die Regel.

| Schlüssel | Artikel | Name |
|---|---|---|
| `rule:ruleGraphs` | `e_59d852786de9` | Rules from graphs |
| `option:ruleGraphs:off` | `e_653ca9586f74` | Off |
| `option:ruleGraphs:on` | `e_54a98208df32` | At the table |

**Zurück:** `DELETE /api/entities/<id>` je Zeile.

## 2. Beispielgraphen nachgezogen

Die Graphen auf dev standen auf dem Stand vom 19.10. (Revision 2, nur
Text geändert); verglichen Knoten für Knoten mit den Beispielen, nur die
erwarteten Unterschiede. Geändert wurden nur diese Knoten, Stellung und
Drähte blieben, dazu der erste Satz der Beschreibung (aus dem Graphen
gerechnet); der übrige Text blieb.

| Regel | Artikel | Änderung |
|---|---|---|
| Hellish Rebuke | `e_c597b8c95c4b` | Auslöser `hit` → `damaged` |
| Snatch Punisher | `e_2f42c5770110` | `c1` → `sameSide not`, Reaktion mit `strike` |
| Opportunity attack | `e_dea70820bddb` | `c1` → `sameSide not`, Reaktion mit `strike` |
| Sentinel | `e_702a6b7bf148` | `c1` → `sameSide not`, Reaktion mit `strike` |

Ohne diese Änderung hätte die Option eine Gelegenheitsattacke gegen
Verbündete angeboten, und Annehmen hätte nicht angegriffen.

**Zurück:** im Regel-Builder die Knoten zurückstellen.

## 3. Reiseregel zusammengelegt

„Rations, light and watches“ (`e_9dda81fb70b4`, `rule-1742`, Schlüssel
`travel`, am System Travel) trägt jetzt Name, Text und Marken der
Hausregel „Travel Rations, Light and Watches“ (`e_420e1127705e`,
`rule-1714`, ohne Schlüssel, `kind: travel`). Die Hausregel ging per
Massenänderung `merge` (`mode: delete`, `keep: e_9dda81fb70b4`) in ihr
auf; auf sie zeigte nichts ausser dem ersetzten Verweis im Text.

**Zurück:** `node scripts/atlas.mjs undo 428ed2cb-6641-400c-85cb-2b8cd6419fa8`,
dann am bleibenden Artikel Name und Text zurück.

## Danach

`GET /api/campaigns/:id/rules` zeigt unter At the table „Rules from
graphs“ mit beiden Varianten (gesetzt: Off) und unter Travel „Travel
Rations, Light and Watches“; `missing` 34 (die Optionen anderer Sitzungen).

# Regelartikel für Token-Bewegung und Token-Grösse auf dev — Protokoll (T-270, T-290)

20.10.2026, Sitzung https://claude.ai/code/session_019BspjSpMPzBrFKZN6rKmvv.
Nach PR #278 (T-290: `Campaign.tokenMove`, Migration 109) und den
Kartenänderungen T-314/T-317 (`tokenSizes`), beide auf preprod
ausgerollt. Fortsetzung von [2026-10-18-T-270-regeln.md](2026-10-18-T-270-regeln.md).

**Lauf:** `node scripts/regeln-anlegen.mjs <plan.json> --state <journal>`
gegen dev.ttrpg.fuchsbau.io, Konto `werkbank` (Verwaltung). Plan und
Journal liegen ausserhalb des Repos. Der Plan nennt nur die Kampagne
„Testkampagne“ (die einzige auf dev) und die Vorgabe-Ebene „Table rules“
(`ly_8cfaa40f341d`); Einträge braucht er keine. Das Journal wurde aus dem
Protokoll vom 18.10. wiederhergestellt (95 Schlüssel, jede Id vorher auf
dev geprüft: alle vorhanden, `Rule.key` stimmt), damit nichts doppelt
angelegt wird.

- **Zuordnung (E-100):** Modul- und System-Ebenen gibt es auf dev noch
  nicht; die Regeln hängen wie bisher am System „Map“
  (`e_53e27c51ae3d`, `partOf`) in „Table rules“. Beide Regeln sind
  Tischoptionen der App wie „Player moves“ und „Fog of war“, keine
  Hausregel (Basil Homebrew System) und kein Buchinhalt. Bestehende
  Artikel zum Übernehmen gab es keine. **Keine Buchebene wurde
  beschrieben.**
- Probe (`--dry-run`): 9 anzulegen, 0 zu übernehmen, 95 schon da.
- Lauf: **9 angelegt, 0 übernommen, 95 schon da**; zweite Probe: 0
  angelegt, 104 schon da. Keine Massenänderung.
- Danach: `GET /api/campaigns/:id/rules` meldet `missing: 0`, Map zeigt
  „Who moves tokens“ und „Token sizes“ mit Artikel je Option;
  `GET /api/rule-articles` liefert 104 Artikel, 12 mit Graph, 15 Systeme
  für den Regel-Builder.

**Zurück:** `DELETE /api/entities/<id>` je Zeile unten.

| Schlüssel | | Artikel | Nummer | Name |
|---|---|---|---|---|
| `rule:tokenMove` | angelegt | `e_62134aec0463` | rule-1809 | Who moves tokens |
| `rule:tokenSizes` | angelegt | `e_a47f10e2dcc5` | rule-1810 | Token sizes |
| `option:tokenMove:none` | angelegt | `e_fb2c2b495201` | rule-1811 | Only the GM |
| `option:tokenMove:own` | angelegt | `e_578c562aaefc` | rule-1812 | Own characters |
| `option:tokenMove:party` | angelegt | `e_0343e59b5c3b` | rule-1813 | The party |
| `option:tokenMove:allies` | angelegt | `e_1672e02fcaad` | rule-1814 | Party and allies |
| `option:tokenMove:all` | angelegt | `e_bd95f93958ef` | rule-1815 | Every token |
| `option:tokenSizes:rules` | angelegt | `e_4406f5710abf` | rule-1816 | As the rules |
| `option:tokenSizes:tinyHalf` | angelegt | `e_7667393e8ed0` | rule-1817 | Tiny half a square |

Alle in „Table rules“ (`ly_8cfaa40f341d`), Status `ready`; die Regeln mit
`partOf` auf „Map“, die Optionen mit `partOf` auf ihre Regel.

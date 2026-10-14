# Mitarbeiten

## Zweige

```
feature/*  →  preprod  →  main
```

- **`main`** ist das, woran der Tisch spielt. Nichts landet hier, das nicht auf
  `preprod` gelaufen ist. Vorspulen statt zusammenführen.
- **`preprod`** ist die Testinstanz — eigener Port, eigene Datenbank, eigenes
  Volume. Ein Fehler hier kostet nichts. Jeder Push rollt nach `dev.atlas.…`
  aus, ein Push auf `main` nach der Produktion ([docs/Betrieb.md](docs/Betrieb.md)).
- **`feature/*`** trägt ein Anliegen, abgezweigt von `preprod`. Ein Pull
  Request nach `preprod`; wer ihn öffnet, merged ihn auch, sobald Tests,
  Lint und Doku stehen. Ein Pull Request nach `main` kommt, wenn ein Feature
  ganz steht oder eine Version reif ist — den merged die Verwaltung.

Ein Pull Request bleibt klein genug, dass man ihn in einem Zug liest. Lieber drei
Anliegen in drei Zweigen als eines, das alles anfasst — und ein Zweig, der
eine Woche lang alles sammelt, ist keiner.

Commits sind klein und sagen **warum**; ein Kommentar im Code nennt die
Anforderung (`REQ-…`) oder Entscheidung (`D…`, `A…`), die er umsetzt. Die
Dokumentation wird im selben Commit nachgezogen wie die Änderung.

## Vor dem Pull Request

```bash
pnpm lint
pnpm test
pnpm --filter @nw/model build && pnpm --filter @nw/registry build
pnpm --filter @nw/server build && pnpm --filter web build
# Wer eine Migration anfasst, zusätzlich gegen eine leere Postgres:
DATABASE_URL=postgres://… node apps/server/scripts/durchstich.mjs
```

Die Reihenfolge ist keine Willkür: `registry`, `server` und `web` übersetzen
gegen die von `model` erzeugten Typdateien, nicht gegen dessen Quelltext.

## Wo Anforderungen leben

**Im Vault**, der seit dem 7.10. in diesem Repo liegt, als **User Stories**
(T-154, E-048 a): je Story eine Notiz `VTT/Stories/REQ-nnn.md`. IDs werden
vergeben, nie neu nummeriert; Verworfenes bleibt mit Status `dropped` stehen.
`VTT/Requirements.md` ist seither eine erzeugte Übersicht.

### Anforderungen als User Stories

Drei Stufen, je eine Notiz mit Frontmatter (Obsidian-Eigenschaften):

| Stufe | Ist | Notiz | Kennung |
|---|---|---|---|
| **Epic** | ein Funktionsbereich mit seinem Umfang (E-049) | `VTT/Epics/EP-nn Name.md` | `EP-01` … |
| **Feature** | eine Funktion, eine Artikelart oder eine Ansicht — auch ein Bereich der App wie „Bereich World“ | `VTT/Features/F-nnn Name.md`, `epic: "[[EP-nn …]]"` | `F-001` … |
| **Story** | ein Wunsch einer Rolle, mit Nutzen und Akzeptanzkriterien | `VTT/Stories/REQ-nnn.md`, `feature: "[[F-nnn …]]"` | `REQ-001` … |

Eine Story sagt: **Als** ⟨Rolle⟩ **möchte ich** ⟨Ziel⟩, **damit** ⟨Nutzen⟩ —
Rolle ist eine von Spieler, Spielleitung, Mitleitung, Zuschauer, Verwaltung.
Darunter die **Akzeptanzkriterien** (woran man merkt, dass es steht), im
Frontmatter `prio`, `aufwand`, `v1`, `abhaengig`, `status`, `stand` und
`standNotiz` (was im Repo steht), `herkunft`. Eine Vorlage ist jede
bestehende Notiz; die Skalen stehen in `VTT/Requirements.md`.

**Der Ablauf, wenn sich etwas ändert:**

1. Ein **neuer Wunsch** wird zuerst eine Story — die nächste freie Nummer,
   an das passende Feature. Passt keines, ein neues Feature (nächste
   `F-nnn`) im passenden Epic; ein neues Epic entscheidet die Leitung.
2. Ein **geänderter Wunsch** ändert die bestehende Story (Satz, Kriterien,
   Prio). Fasst eine Story zu viel zusammen, wird sie geteilt: der Rest
   bekommt eine neue Nummer, beide nennen einander in `abhaengig`.
3. Ein **weggefallener oder doppelter Wunsch** wird nicht gelöscht: `status:
   dropped`, `stand: ersetzt` oder `verworfen`, und `ersetztDurch` nennt die
   Story, die ihn jetzt trägt (sonst sagt `standNotiz`, warum).
4. Danach `pnpm --filter @nw/registry anforderungen -- --umsetzung VTT/Umsetzung.md`
   — es schreibt die Übersichten neu und schlägt fehl, wenn eine Story ins
   Leere zeigt.
5. **Aufgaben hängen an Stories**: im Projektbrett nennt eine Aufgabe ihre
   REQ-Nummern; ein Commit oder Kommentar im Code nennt sie ebenso.

Zitate aus Gesprächen gehören **nicht** in die Notizen — die Story sagt
sachlich, was gewünscht ist; Zitate und Kampagneninhalt bleiben im
Projektbrett.

**Issues bilden ab, was gerade gebaut wird** — nicht den ganzen Katalog:

| Was | Wohin |
| --- | --- |
| Fehler | Issue, Label `fehler`. Braucht keine REQ-Nummer. |
| Anforderung, die jetzt gebaut wird | Issue mit REQ-Nummer im Titel, geschlossen durch den PR. |
| Anforderung, die noch niemand baut | Nur der Vault. Kein Issue. |
| Warum etwas so entschieden wurde | `VTT/Decision Log.md`, nicht der PR-Text. |

So gibt es nie 167 offene Issues, und die REQ-Nummer bleibt der gemeinsame
Bezugspunkt zwischen Vault, Issue, Zweig und Commit.

## Commits

Deutsch, Imperativ oder Nominalstil, erste Zeile unter ~72 Zeichen. Der Rumpf
sagt **warum**, nicht was — das Diff sagt bereits, was. Eine REQ-Nummer gehört
hinein, wenn es eine gibt.

## Register ändern

Schnittstellen, Komponenten, Verknüpfungsarten und Darstellungsstufen sind Daten.
Zwei Wege, und sie sind nicht gleichwertig:

- **`packages/registry`** ist die Startbelegung einer frischen Datenbank. Änderungen
  hier wirken nur auf Instanzen, deren Register noch leer ist.
- **`PUT /api/registry/:part`** ändert eine laufende Instanz. Das ist der normale
  Weg, sobald es Daten gibt.

Beides geht durch dieselbe Validierung. Wenn eine Registeränderung Artikel
ungültig macht — etwa weil eine Komponente aus `allows` verschwindet — sagt
`POST /api/validate` das vorher.

## Datenbank

Migrationen sind vorwärtsgerichtet und laufen je einmal, in einer Transaktion,
festgehalten in `schema_migrations`. Eine bereits gelaufene Datei wird nie
verändert — stattdessen kommt eine neue dazu. Auf `preprod` laufen sie zuerst.

Sicherungen sind `pg_dump` nach Plan, mit Aufbewahrung, plus die Änderungskette
in `event_log` (REQ-003) für den einzelnen verunglückten Schreibvorgang. Eine
Sicherung, die nie zurückgespielt wurde, ist keine.

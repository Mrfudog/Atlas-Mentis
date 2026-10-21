# Mitarbeiten

## Zweige

```
feature/*  →  preprod  →  main
```

- **`main`** ist das, woran der Tisch spielt. Nichts landet hier, das nicht auf
  `preprod` gelaufen ist. Der Vault wird auch vom Telefon aus direkt auf
  `main` geschrieben — darum wird `preprod` **gemerged und nicht
  vorgespult**, und ein Zweig von `preprod` merged vor einem Pull Request
  nach `main` erst `main` herein.
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
# Die Abläufe im Browser, gegen eine eigene Postgres (unten, E2E-Prüfungen):
DATABASE_URL=postgres://… pnpm e2e
```

Die Reihenfolge ist keine Willkür: `registry`, `server` und `web` übersetzen
gegen die von `model` erzeugten Typdateien, nicht gegen dessen Quelltext.

**Jede Änderung erfüllt die Grundanforderungen** aus
[CLAUDE.md › Grundanforderungen an jede Änderung](CLAUDE.md#grundanforderungen-an-jede-änderung):
- Tests auf drei Stufen: Unit, Integration (samt Durchstich mit Bestand),
  E2E unter `apps/web/e2e/`;
- nach dem Merge ein Blick auf dev;
- Feature-Notiz und Story im Vault, mit Diagramm, wo es hilft;
- Hilfestellungen (Hilfe, Handbuch, Glossar, Tooltip, What's new);
- keine stillen Grenzanhebungen.

Die PR-Vorlage fragt jeden Punkt ab.

## Handbuch und Glossar nachziehen

Das Handbuch (`/handbook`, T-242, T-225) ist die eine Stelle, an der die
Seite sich erklärt, und es hält nur Schritt, wenn jede Änderung es
mitnimmt — **im selben Pull Request**:

- **Neue Seite oder geänderte Bedienung** → Hilfetext in
  [`apps/web/src/help.json`](apps/web/src/help.json). Er ist das „?" der
  Seite und das Kapitel „Pages" des Handbuchs.
- **Neue Regeloption oder Variante** → ihr `does` in
  `packages/model/src/ruleOptions.ts`; das Kapitel „Rules & options" wird
  daraus erzeugt.
- **Neue anlegbare Art, neues Wort der App** → ein Eintrag in
  `packages/registry/src/glossar.ts` (`APP_TERMS`, mit deutscher
  Übersetzung).
- **Geänderter Ablauf** → Text in
  [`apps/web/src/handbook.json`](apps/web/src/handbook.json) („First
  steps", „Workflows").
- **Spielbegriffe** (Zustände, Eigenschaften, Aktionsarten …) nie ins
  Repo: sie sind `GlossaryTerm`-Artikel in der Ebene ihres Regelwerks,
  angelegt über die API mit Protokoll.

Was fehlt, sagen die Tests: `packages/registry/test/glossar.test.ts`
(Arten, Wörter aus `docs/Begriffe.md`, Regeloptionen),
`apps/web/test/hilfe.test.ts` (Routen) und `apps/web/test/glossar.test.ts`
(Kapitel). Sie nennen, was fehlt.

## What's new ergänzen

**Jeder Pull Request mit einer sichtbaren Änderung** trägt einen Eintrag in
[`apps/web/src/whats-new.json`](apps/web/src/whats-new.json) ein (T-157) —
oben, denn die Liste steht neueste zuerst. Die Seite „What's new" zeigt
ihn, und wer ihn noch nicht gesehen hat, sieht einen Punkt in der
Kopfleiste. Ein Konto sieht nur Einträge ab dem Tag seiner Anlage
(T-163) — `date` ist darum der Tag, an dem es auf `preprod` kam, nicht
der, an dem die Arbeit begann. Was dev zeigt, steht auf `preprod`, was die Produktion zeigt,
auf `main` — gepflegt wird nur die Datei.

```json
{
  "id": "2026-10-14-search",
  "date": "2026-10-14",
  "title": "Search from anywhere",
  "text": "Press Ctrl+K or / on any page: results appear while you type.",
  "area": "Navigation",
  "link": "/compendium"
}
```

- `id` beginnt mit dem Datum und wird nie geändert — gesehen wird je Id.
- `text`: ein, zwei Sätze auf Englisch, was man jetzt **tun** kann, nicht
  wie es gebaut ist. **Nur Funktionen**: keine Namen aus der Kampagne,
  keine Inhalte aus eingelesenen Regelwerken — das Repo ist öffentlich.
- `link` (und `query`) zeigt auf eine Route der Seite, wenn es eine Stelle
  gibt; `image` auf ein Bild unter `apps/web/public/`; `tour` auf einen
  Schritt der Starttour (T-158), sobald es sie gibt.
- Nicht nötig für Doku, Protokolle, Migrationen ohne sichtbare Folge und
  reine Korrekturen — dann im Pull Request „nicht nötig" ankreuzen.

`apps/web/test/neues.test.ts` prüft die Datei: eindeutige Ids, Reihenfolge,
und dass jeder `link` eine Route trifft.

**Die Hilfe je Seite** (T-205) zeigt unter dem „?“ der Kopfleiste die
Einträge, deren `link` auf die Seite zeigt, auf der man steht — ein guter
`link` macht den Eintrag also auch dort sichtbar. Ändert sich, wie eine
Seite bedient wird, zieht derselbe Pull Request ihren Text in
[`apps/web/src/help.json`](apps/web/src/help.json) nach: je Eintrag die
Routen (Pfade wie in `app.routes.ts`), ein Titel, Abschnitte mit kurzen
englischen Absätzen. Eine **neue Route** braucht dort einen Text oder
einen Eintrag unter `without` mit Grund — `apps/web/test/hilfe.test.ts`
prüft das.

## E2E-Prüfungen

Playwright unter `apps/web/e2e/` (T-356, [F-080](VTT/Features/F-080%20Qualit%C3%A4t%20%26%20Tests.md)):
der gebaute Server liefert die gebaute Oberfläche aus, wie im Abbild, und
die Specs spielen Abläufe als **Leitung** und als **Spielerin** durch, je
einmal als `desktop` (1360 × 900) und als `phone` (390 × 844). Im CI läuft
das als Job `e2e`.

**Lokal laufen lassen:**

```bash
pnpm --filter @nw/model build && pnpm --filter @nw/registry build
pnpm --filter @nw/server build && pnpm --filter web build
# Eine eigene Postgres — nie dev oder prod: der Aufbau legt Konten und
# Kampagnen an. In den Sitzungen: pg_ctlcluster 16 main start.
export DATABASE_URL=postgres://postgres:pg@localhost:5432/postgres
# In den Sitzungen liegt Chromium schon da; sonst einmal
# `pnpm exec playwright install chromium` und E2E_CHROMIUM weglassen.
export E2E_CHROMIUM=/opt/pw-browsers/chromium
pnpm e2e                       # alle Specs, beide Projekte
pnpm e2e --project=desktop     # nur 1360 px
pnpm e2e anmelden              # nur Specs, deren Datei so heisst
pnpm e2e --ui                  # zum Zuschauen und Nachstellen
```

Der Server startet von selbst auf Port 8091 (`E2E_PORT`) und nimmt einen
schon laufenden mit. Der Aufbau (`aufbau.ts`) legt die Konten
`e2e-verwaltung` (Admin), `e2e-leitung` (`gm`) und `e2e-spielerin`
(`player`) über `user add` an und je Lauf eine Kampagne `E2E <zeit>`; der
Abbau (`abbau.ts`) räumt sie wieder weg. Ein Fehler hinterlässt Spur und
Bild in `apps/web/e2e/.ergebnis/` (`pnpm exec playwright show-trace …`);
im CI hängen sie als Artefakt `e2e-spuren` am Lauf.

**Einen Spec schreiben:** eine Datei `apps/web/e2e/<ablauf>.spec.ts`,
Testtitel englisch, Kommentare deutsch, oben die Anforderung.

```ts
import { test, expect } from './hilfen';

test('a player does not see what the GM holds back', async ({ leitung, spielerin, api, eindeutig }) => {
  const ort = await api.anlegen('leitung', 'Place', eindeutig('Crypt'), {
    fields: { 'Visibility.audience': 'gm' },
  });
  await leitung.goto(`/artikel/${ort.id}`);
  await expect(leitung.getByRole('heading', { name: ort.name })).toBeVisible();
  await spielerin.goto(`/artikel/${ort.id}`);
  await expect(spielerin.getByRole('heading', { name: ort.name })).toHaveCount(0);
});
```

- `leitung` und `spielerin` sind zwei angemeldete Browser-Sitzungen, `page`
  ist eine ohne Rolle; `api.als(rolle)` und `api.anlegen(…)` gehen über
  dieselbe API wie die Oberfläche.
- Testdaten legt der Spec selbst an, **klein und mit `eindeutig(name)`** —
  die Specs laufen parallel und in beiden Projekten. Keine Inhalte aus
  5e.tools oder einer Kampagne.
- Gefunden wird über Rollen, Beschriftungen und Text (`getByRole`,
  `getByLabel`), nie über CSS-Klassen. **Kein `waitForTimeout`**: Playwright
  wartet von selbst auf das, was `expect` verlangt.
- Was am Telefon anders aussieht, prüft der Spec mit
  `test.info().project.name === 'phone'`, statt einen zweiten zu schreiben.
- Wo der Server siebt, laufen beide Rollen im selben Test.

**Integration** (eine Route über `app.inject`, ohne Browser) baut ihren
Tisch mit `apps/server/test/hilfen/tisch.ts`: Konten mit Rollen,
`t.als('Sela', 'GET', …)` — Beispiel in `apps/server/test/tisch.test.ts`.

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

**Ein Epic sagt, wo es wohnt** (T-156): `arten`, `kanten`, `code` und
`doku` im Frontmatter nennen die Artikelarten, Kantenarten, Code-Orte und
Seiten des Bereichs. `anforderungen` macht daraus in der Epic-Notiz und in
`docs/Anforderungen.md` den Abschnitt „Wo es wohnt“, samt den offenen
Stories mit Priorität 1–3 — der Weg vom Überblick bis in den Code. Ein Test
prüft, dass jede genannte Art, Kante und Datei existiert; wer eine Datei
umbenennt oder eine Art streicht, zieht die Angabe nach.

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

## Dokumentation

Der Weg durch die Dokumentation beginnt bei [docs/README.md](docs/README.md):
Einstieg mit Bestandsaufnahme → `docs/Themen/` → Detailseiten. Eine neue
Seite unter `docs/` kommt in die Bestandsaufnahme (ein Test prüft es, und
dass die Verweise der Einstiegs-, Übersichts- und Epic-Seiten nicht ins
Leere zeigen). Erzeugte Seiten — `Artikeltypen.md`, „Das Register heute“
in `Datenmodell.md`, `Anforderungen.md`, `5etools-Bericht.md` — ändert nur
ihr Skript.

**Bilder:** ein grosses Bild (Übersicht, Modell, Ablauf mit vielen Knoten)
ist eine Excalidraw-Zeichnung `docs/Bilder/Name.excalidraw.md`, gezeichnet
in Obsidian; das Plugin schreibt `Name.excalidraw.svg` daneben, und das
wird eingebunden. Ohne Obsidian legt `node scripts/excalidraw.mjs` eine an.
Mermaid nur für kleine Abläufe bis etwa zehn Knoten. Mehr:
[docs/README.md › Bilder](docs/README.md#bilder).

## Commits

Deutsch, Imperativ oder Nominalstil, erste Zeile unter ~72 Zeichen. Der Rumpf
sagt **warum**, nicht was — das Diff sagt bereits, was. Eine REQ-Nummer gehört
hinein, wenn es eine gibt.

## Register ändern

Typen, Kantenarten, Aufzählungen und Ansichten sind Daten — Zeilen, die
**einmal** stehen: in `packages/registry`. Wer eine Zeile ändert, ändert sie
dort, lässt `pnpm --filter @nw/registry emit-seed` und `catalogue` laufen
und schreibt eine **Migration**, die sie auf bestehenden Datenbanken
nachzieht — der Seed schreibt Arten nur in eine leere Datenbank (T-123).
`apps/server/scripts/register-abgleich.mjs` prüft im CI, ob die Migration
reicht. Eine laufende Installation ändert ihr Register daneben über die
Registerseite (`/registry`, `PUT /api/registry/:part`); was sie danach
anders hat als das Paket, zeigt die Werkbank (`registryDrift`). Beides geht
durch dieselbe Validierung; was eine Änderung trifft, zählt vorher
`GET /api/registry/usage`. Mehr: [CLAUDE.md › Bauen und prüfen](CLAUDE.md#bauen-und-prüfen).

## Datenbank

Migrationen sind vorwärtsgerichtet und laufen je einmal, in einer Transaktion,
festgehalten in `schema_migrations`. Eine bereits gelaufene Datei wird nie
verändert — stattdessen kommt eine neue dazu. Auf `preprod` laufen sie zuerst.

Sicherungen sind `pg_dump` nach Plan, mit Aufbewahrung, plus die Änderungskette
in `event_log` (REQ-003) für den einzelnen verunglückten Schreibvorgang. Eine
Sicherung, die nie zurückgespielt wurde, ist keine.

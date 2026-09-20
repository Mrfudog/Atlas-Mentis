# Nebelwacht — Hinweise für Claude

Kampagnenplattform für „Aus Nebel wacht“. Schweizer Rechtschreibung
(**ss statt ß**) in allem Deutschen.

**Sprache:** Code, Bezeichner, Registerzeilen und sichtbare Texte auf Englisch.
Kommentare und Commit-Nachrichten auf Deutsch. Die Oberfläche war bis
2026-09-19 deutsch; die Umstellung ist in `prototype/migration/rename-map.json`
festgehalten und auf Daten wie Code angewandt.

Zwei Ausnahmen, die bewusst deutsch bleiben: **Vault-Schlüssel**, die der
Importer *liest* (`Gegenstandstyp`, `Rarität`, `rüstungsklasse`, `grösse`,
`kreatur` …) — sie stehen so in den Notizen, und sie zu übersetzen hiesse, die
Notizen nicht mehr zu erkennen. Und **Aufzählungswerte**, die Kampagneninhalt
sind (`gewöhnlich`, `Gebäude`, `freundlich`): das sind Daten, keine Namen.

## Das Modell in fünf Sätzen

Eine Entität ist ein **Peg**: eine undurchsichtige ID und sonst nichts. Jede
Tatsache ist eine **Komponente** — höchstens eine je Typ, und abwesend, wenn
ungenutzt. Verbindungen sind typisierte, gerichtete **Kanten**, die eigene
Eigenschaften tragen dürfen, nur in einer Richtung gespeichert werden und deren
Gegenrichtung immer eine Abfrage ist. **Schnittstellen** ersetzen Entitätstypen:
Registerzeilen mit `requires` / `allows`, behauptet über `Typed`, geprüft von der
Validierung. Alles davon sind Zeilen — eine neue Artikelart anzulegen heisst
einfügen, nicht migrieren.

Vollständig in [`Mrfudog/atlas-mentis`](https://github.com/Mrfudog/atlas-mentis):
`Backbone Concept.md` erklärt die Mechanismen, `Schemas.md` hat die Schemata und
die Entscheidungen D0–D17, `Requirements.md` die REQ-Nummern.

## Wo was liegt

- `packages/model` — Typen, Validierung, `calc.ts` (abgeleitete Werte),
  `views.ts` (Feldauswahl je Darstellungsstufe), `inline.ts` (`[[Verweise]]`,
  `{VAR}`), `entity.ts` (Registerzugriff, Rückbezüge). **Kein Framework-Import.**
  Was hier liegt, gilt für Server und Oberfläche gleichermassen.
- `packages/registry` — die Startzeilen, und zwar **die einzige Quelle
  dafür**. `pnpm --filter @nw/registry emit-seed` schreibt sie als JSON in
  den Prüfaufbau des Prototyps; von Hand nachgezogen wird nichts mehr. Zeilen,
  die es nur dort gibt, bleiben stehen und werden aufgezählt — eine neue
  Artikelart im Prototyp anzulegen ist der Sinn der Sache und kein Fehler.
- `apps/server` — Fastify. Routen sprechen mit `Repository`, nie mit Postgres;
  deshalb sind sie ohne Datenbank testbar (`InMemoryRepository`).
- `apps/web` — Angular, bisher nur ein Gerüst.
- `legacy/` — die alte React-App. Nicht weiterentwickeln; sie läuft, bis die
  neue Karte und Initiative kann.

## Regeln, die hier gelten

- **Abgeleitete Werte werden beim Lesen berechnet, nie gespeichert** (D8). Eine
  Eigenschaft mit `derived` bekommt keine Eingabe und keine Spalte.
- **Das Rechenwerk ist kein `eval`.** Registerzeilen sind Daten, die jemand
  bearbeiten kann. `evalArith` ist ein Shunting-Yard-Auswerter; bei Unsinn gibt
  es `null`, nicht eine irreführende 0.
- **`{VAR}` wird nie in den gespeicherten Text eingesetzt.** Die Vorlage bleibt
  die Vorlage; die Bindung liegt an der Kante. Genau das ging in der alten App
  verloren, und der Verlust war endgültig.
- **Kanten nur vorwärts speichern.** Ein gespiegeltes Gegenstück verwaist.
- **Schreiben geht durch `validateEntity`**, auch wenn es umständlich scheint.
- **Das Register steht einmal.** Wer eine Zeile ändert, ändert sie in
  `packages/registry` und lässt `emit-seed` laufen. Zweimal dasselbe von Hand
  zu pflegen hält genau so lange, wie jemand daran denkt — und als es hier
  zuletzt auseinanderlief, standen deutsche Variablen im Paket und englische
  im Prototyp, und gemerkt hat es niemand, weil beide für sich stimmten.
- **Nicht auf `0.0.0.0` binden.** Die Anwendung hat keine Authentifizierung; der
  Reverse Proxy ist das, was nach aussen zeigt.

## Bauen und prüfen

```bash
pnpm install
pnpm --filter @nw/model build && pnpm --filter @nw/registry build   # zuerst
pnpm test && pnpm lint
pnpm --filter @nw/registry emit-seed   # nach jeder Registeränderung
```

Die Reihenfolge ist notwendig: die übrigen Pakete übersetzen gegen die von
`model` erzeugten `.d.ts`, nicht gegen dessen Quelltext. In `tsconfig.json` der
abhängigen Pakete gehört **kein** `paths`-Eintrag auf `../model/src` — das zieht
Quelltext über Paketgrenzen und bricht `rootDir`.

Vitest bildet `@nw/model` und `@nw/registry` auf den Quelltext ab (siehe
`vitest.config.ts`), damit Tests ohne vorherigen Build laufen.

## Arbeitsweise

Zweige `feature/*` → Pull Request nach `preprod` → `main` nur vorspulen.
Anforderungen leben im Vault, Issues bilden ab, was gerade gebaut wird. Siehe
[CONTRIBUTING.md](CONTRIBUTING.md).

# Technik — Pakete, Server, Oberfläche

Stand 2026-10-15. Zurück zum [Einstieg](../README.md).

Ein Monorepo mit pnpm. Das **Modell** (`packages/model`) ist reines
TypeScript ohne Framework und gilt für Server und Oberfläche gleichermassen;
das **Register** (`packages/registry`) ist die einzige Quelle der
Startzeilen. Der **Server** (`apps/server`, Fastify) spricht nur mit
`Repository`, nie direkt mit Postgres, und siebt alles, was hinausgeht, am
Server (`inPlay`, `articleVisible`, `redactEntity`). Die **Oberfläche**
(`apps/web`, Angular) hält keinen Bestand (W7) und zeichnet aus dem
Register, nicht aus einer Vorlage je Art. Ein Abbild trägt beides; es baut
nur CI.

![Was auf dem Server läuft](../Bilder/Server.excalidraw.svg)

## Wo welcher Code liegt

| Ort | Was | Erklärt in |
|---|---|---|
| `packages/model` | Typen, Validierung, `calc.ts`, `stack.ts`, `views.ts`, `inline.ts`, `entity.ts`, `map.ts`, `inventory.ts` | [Architektur §7](../Architektur.md#7-das-modellpaket), [Modell](Modell.md) |
| `packages/registry` | Startzeilen; Skripte `emit-seed`, `catalogue`, `anforderungen`, `typ.mjs` | [CLAUDE.md › Bauen und prüfen](../../CLAUDE.md#bauen-und-prüfen) |
| `apps/server/src` | Routen je Anliegen (`liste.ts`, `lesen.ts`, `live.ts`, `handwerk.ts`, `karten.ts`, `schreibebene.ts`, `spielerebene.ts`, `uebernahme.ts` …), `repo.ts` / `repo.pg.ts`, Migrationen | [Architektur §5](../Architektur.md#5-der-server) |
| `apps/web/src/app` | Bereiche je Ordner: `artikel/`, `boards/`, `karten/`, `klassen/`, `lesen/`, `suche/`, `werkbank/`, `register/`, `verwaltung/`, `konto/`, `neues/`, `kern/` | [Architektur §6](../Architektur.md#6-die-oberfläche) |
| `packages/import-5etools`, `scripts/regelwerk.mjs` | Einleser für Inhalte | [Inhalte](Inhalte.md) |
| `scripts/atlas.mjs` | Werkzeugzugang zur API | [Betrieb › Werkzeugzugang](../Betrieb.md#werkzeugzugang) |
| `scripts/excalidraw.mjs` | Zeichnungen für die Dokumentation anlegen | [Einstieg › Bilder](../README.md#bilder) |
| `prototype/` | Eingefroren seit D59, Vorlage für die Seite | [Web-Arbeitsplan.md](../Web-Arbeitsplan.md) |
| `legacy/` | Die alte React-App, läuft bis Karte und Initiative in der Seite stehen | — |

## Wo es tiefer weitergeht

- [Architektur.md](../Architektur.md) — Container, der Weg vom Push zum
  Server, Frameworks, Abhängigkeiten der Pakete, was beim Lesen eines
  Artikels passiert, der Live-Kanal, die Tabellen, die Oberfläche.
- [Karten.md](../Karten.md) — Zeichenebenen, Sperren, Unterkarten, die
  Karte in der Seite (T-115, T-117).
- [Spieltisch.md](../Spieltisch.md) — wie Karte, Bogen, Inventar,
  Handwerk, Boards im Prototyp entstanden (Herkunft; die Regeln gelten).
- [Web-Arbeitsplan.md](../Web-Arbeitsplan.md) und
  [UI-Arbeitsplan.md](../UI-Arbeitsplan.md) — der Port in die Seite und die
  UI-Runde; welche Pakete stehen, sagt das Projektbrett.
- [design/](../design/) — der Design-Canvas als Vorlage der Oberfläche.

## Stand

Was die Seite kann, zählt CLAUDE.md unter `apps/web` auf; was je Story
steht, [Anforderungen.md](../Anforderungen.md). Initiative, Nebel und Licht
fehlen in der Seite noch.

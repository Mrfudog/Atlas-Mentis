# Atlas Mentis

Kampagnenplattform. Gebaut für **„Aus Nebel wacht“** — Wasserfeste,
Nebeldistrikt, Unterwacht —, aber nicht an sie gebunden: was es an
Artikelarten gibt, ist eine Registerzeile und keine Codezeile.

Die Kampagne heisst Nebelwacht, die Plattform heisst Atlas Mentis. Das
Repository trägt noch den alten Namen.

Ein Artikel ist die Grundform für alles in der Welt: Geschöpfe, Orte, Fraktionen,
Regeln, Statblöcke, Wissensartikel. Er besteht aus **Komponenten** (typisierte
Felder), **Blöcken** (Fliesstext mit eigener Sichtbarkeit) und **Verknüpfungen**
(typisierte, gerichtete Kanten zu anderen Artikeln). Welche Artikelarten es gibt,
welche Felder sie tragen und wie sie dargestellt werden, steht im **Register** —
als Daten, nicht als Code. Eine neue Artikelart ist eine Zeile, keine Migration.

Die Architektur dahinter ist in [`Mrfudog/atlas-mentis`](https://github.com/Mrfudog/atlas-mentis)
ausgearbeitet: `Backbone Concept.md`, `Schemas.md`, `Data Definitions.md` und die
Anforderungen mit unveränderlichen REQ-Nummern. Dieses Repo setzt sie um.

## Aufbau

| Pfad | Was |
| --- | --- |
| `packages/model` | Das Rückgrat als TypeScript: Typen, Validierung, Rechenwerk, Ansichtsauflösung. Kein Framework. Wird von Front und Back geteilt. |
| `packages/registry` | Die Startzeilen des Registers: Komponenten, Schnittstellen, Verknüpfungsarten, Darstellungsstufen. |
| `apps/server` | Fastify + Postgres. Drei generische Tabellen plus Register (D0). |
| `apps/web` | Angular. |
| `legacy/` | Die alte React-App (Kanalgang). Eingefroren, weiter lauffähig, wird nicht mehr weiterentwickelt. |
| `prototype/` | Die Artikel-Engine v0 als eigenständige HTML-Seite — zum Ausprobieren des Modells. |
| `docs/` | Aus der alten App geerntete Anforderungen, für den Vault. |

## Entwickeln

```bash
pnpm install
pnpm --filter @nw/model build      # die Apps übersetzen gegen die erzeugten Typen
pnpm --filter @nw/registry build

pnpm test                          # Vitest über model, registry und die API
pnpm lint
pnpm dev:web                       # Angular auf :4200
pnpm dev:server                    # Fastify auf :8080
```

Node 22.12 oder neuer, pnpm 10.

## Betrieb

Ein Container, ein Postgres daneben:

```bash
cp .env.example .env               # Passwort setzen
docker compose up -d --build       # → 127.0.0.1:8080
```

Der Server bindet bewusst auf **loopback**. Davor gehört der Reverse Proxy mit
SSO — die Anwendung selbst hat noch keine Authentifizierung, und ohne Proxy wäre
sie offen. Migrationen laufen beim Start, vorwärts und je einmal.

Die Testinstanz liegt daneben, mit eigener Datenbank und eigenem Port:

```bash
docker compose -f docker-compose.preprod.yml up -d --build   # → 127.0.0.1:8081
```

## Zweige

| Zweig | Rolle |
| --- | --- |
| `main` | Woran der Tisch spielt. Wird nur aus einem grünen `preprod` vorgespult. |
| `preprod` | Integration und Test, eigene Instanz, eigene Datenbank. |
| `feature/*` | Ein Anliegen je Zweig → Pull Request nach `preprod`. |

Siehe [CONTRIBUTING.md](CONTRIBUTING.md).

## Stand

Das Rückgrat steht und ist geprüft: Modell, Register, Validierung, Rechenwerk,
Ansichtsauflösung, die HTTP-Oberfläche und das Datenbankschema. Die Angular-App
ist bisher ein Gerüst — das Kompendium darüber ist der nächste Schritt.

Karte, Initiative und Begegnungen laufen bis auf Weiteres in `legacy/`.

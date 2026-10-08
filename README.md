# Atlas Mentis

Die Seite für **„Aus Nebel wacht“** und die Runden, die daraus werden —
Wasserfeste, Nebeldistrikt, Unterwacht. Kein generisches VTT: was der Tisch
braucht, kommt zuerst; was ein beliebiger Tisch brauchen könnte, danach.
Trotzdem ist nichts an die Kampagne genagelt: was es an Artikelarten gibt,
ist eine Registerzeile und keine Codezeile.

Die Kampagne heisst Nebelwacht, die Plattform heisst Atlas Mentis. Die
Paketnamen (`@nw/*`) und die Datenbanknamen tragen die Kampagne im Namen,
und das dürfen sie.

Ein Artikel ist die Grundform für alles in der Welt: Geschöpfe, Orte, Fraktionen,
Regeln, Statblöcke, Wissensartikel. Er besteht aus **Komponenten** (typisierte
Felder), **Blöcken** (Fliesstext mit eigener Sichtbarkeit) und **Verknüpfungen**
(typisierte, gerichtete Kanten zu anderen Artikeln). Welche Artikelarten es gibt,
welche Felder sie tragen und wie sie dargestellt werden, steht im **Register** —
als Daten, nicht als Code. Eine neue Artikelart ist eine Zeile, keine Migration.

Was gilt, steht in [docs/Datenmodell.md](docs/Datenmodell.md); das
ursprüngliche Konzept (`VTT/Backbone Concept.md`, `Schemas.md`, `Data
Definitions.md`) ist überholt und bleibt als Herkunft stehen. Die
Anforderungen mit unveränderlichen REQ-Nummern: [`VTT/Requirements.md`](VTT/Requirements.md),
ihr Stand: [`VTT/Umsetzung.md`](VTT/Umsetzung.md).

## Aufbau

| Pfad | Was |
| --- | --- |
| `packages/model` | Das Rückgrat als TypeScript: Typen, Validierung, Rechenwerk, Ansichtsauflösung. Kein Framework. Wird von Front und Back geteilt. |
| `packages/registry` | Die Startzeilen des Registers: Komponenten, Schnittstellen, Verknüpfungsarten, Darstellungsstufen. |
| `apps/server` | Fastify + Postgres. Drei generische Tabellen plus Register (D0). |
| `apps/web` | Angular. |
| `legacy/` | Die alte React-App (Kanalgang). Eingefroren, weiter lauffähig, wird nicht mehr weiterentwickelt. |
| `prototype/` | Die Artikel-Engine v0 als eigenständige HTML-Seite — zum Ausprobieren des Modells. |
| `docs/` | Datenmodell, Begriffe, Betrieb, Abgleich — die geltende Erklärung. |
| `VTT/`, `Ideen/` | Der Obsidian-Vault: Anforderungen, Umsetzungsstand, Entscheidungslog, Notizen. |

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
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" > .env
docker compose up -d --build       # → 127.0.0.1:8080
```

Der Server bindet bewusst auf **loopback**; davor steht ein Reverse Proxy mit
TLS. Angemeldet wird mit einem Passwort je Konto ([docs/Zugang.md](docs/Zugang.md)),
das erste legt `user add <name> --admin` an. Migrationen laufen beim Start,
vorwärts und je einmal.

Die Testinstanz liegt daneben, mit eigener Datenbank und eigenem Port:

```bash
docker compose -f docker-compose.preprod.yml up -d --build   # → 127.0.0.1:8081
```

Wie beides auf Hetzner läuft — `preprod` nach `dev.…` bei jedem Push, `main`
nach der Produktion — steht in [docs/Betrieb.md](docs/Betrieb.md).

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

## Der Vault

Dieses Repository ist zugleich der Obsidian-Vault: `VTT/` trägt die
Anforderungen (`Requirements.md`, unveränderliche REQ-Nummern), den Stand
der Umsetzung (`Umsetzung.md`, aus dem Repo erzeugt) und das Entscheidungs-
log; `Ideen/` die losen Notizen. Code und Konzept wohnen seit dem 7.10.2026
in einem Repo — zwei waren eines zu viel.

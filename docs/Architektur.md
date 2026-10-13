# Architektur

Stand 2026-10-12 (preprod nach P5). Zeigt, **was läuft** (Container),
**womit** (Frameworks), **wo es liegt** (Repo) und **wie der Code
zusammenhängt** (Pakete, Server, Oberfläche). Das Datenmodell selbst —
Typen, Felder, Kanten — steht in [Datenmodell.md](Datenmodell.md);
Einrichtung und Betrieb in [Betrieb.md](Betrieb.md).

---

## 1. Was auf dem Server läuft

Eine Hetzner-Maschine, fünf Container. `prod` und `dev` sind vollständig
getrennt: eigenes Abbild, eigene Datenbank, eigenes Volume. Der einzige
Container mit offenem Port nach aussen ist Caddy.

```mermaid
flowchart TB
  user([Browser<br/>Spielleitung, Spielende])
  subgraph host["Hetzner CPX22 · Ubuntu 24.04 · Docker"]
    direction TB
    subgraph proxy["/srv/atlas/proxy"]
      caddy[caddy:2-alpine<br/>Reverse Proxy, TLS über Let's Encrypt<br/>network_mode: host · Ports 80, 443]
    end
    subgraph prod["/srv/atlas/prod · Zweig main"]
      appP[app<br/>ghcr.io/mrfudog/atlas-mentis:main-‹sha›<br/>Node 22 · Fastify + Angular-Build<br/>127.0.0.1:8080]
      dbP[(db<br/>postgres:17-alpine<br/>./daten/db)]
    end
    subgraph dev["/srv/atlas/dev · Zweig preprod"]
      appD[app<br/>ghcr.io/mrfudog/atlas-mentis:preprod-‹sha›<br/>127.0.0.1:8081]
      dbD[(db<br/>postgres:17-alpine<br/>./daten/db-preprod)]
    end
    cron[cron 03:17<br/>pg_dump je Wochentag]
  end
  user -- https://atlas.‹domain› --> caddy
  user -- https://dev.atlas.‹domain› --> caddy
  caddy -- 127.0.0.1:8080 --> appP
  caddy -->|"127.0.0.1:8081 · noindex"| appD
  appP -- DATABASE_URL --> dbP
  appD -- DATABASE_URL --> dbD
  cron -.-> dbP
  cron -.-> dbD
```

| Container | Abbild | Aufgabe | Daten |
|---|---|---|---|
| `caddy` | `caddy:2-alpine` | TLS, Weiterleitung nach Hostname | `proxy/daten/` (Zertifikate) |
| `app` (prod, dev) | aus CI, `ghcr.io/mrfudog/atlas-mentis` | API **und** Oberfläche aus einem Prozess; Migrationen beim Start | keine — zustandslos |
| `db` (prod, dev) | `postgres:17-alpine` | Register, Artikel, Kanten, Konten, Sitzungen | `daten/db`, `daten/db-preprod` |

**Ein App-Container, nicht zwei.** Das Angular-Build liegt im selben
Abbild und wird von Fastify als statische Dateien ausgeliefert
(`@fastify/static`, Ordner `public/`). Ein eigener Web-Container wäre
ein zweiter Prozess für ein paar HTML- und JS-Dateien.

Gesichert wird zweimal: `deploy.sh` macht vor jedem Wechsel des Abbilds
einen `pg_dump` (die letzten 20 bleiben), und `cron` sichert jede Nacht
je Wochentag (`backups/nacht/`).

---

## 2. Vom Push bis zum Server

Gebaut wird **nur** in CI. Auf dem Server wird nichts kompiliert; er holt
ein fertiges, geprüftes Abbild.

```mermaid
flowchart LR
  push[git push<br/>preprod oder main] --> check
  subgraph gha[GitHub Actions · ci.yml]
    check[check<br/>pnpm install, build,<br/>typecheck, lint, test]
    pg[postgres<br/>Durchstich gegen<br/>frische Postgres 17]
    image[image<br/>docker build, push nach GHCR<br/>Tag ‹zweig›-‹sha›]
    deploy[deploy<br/>nur wenn DEPLOY_ENABLED<br/>Umgebung dev bzw. prod]
    check --> image
    pg --> image
    image --> deploy
  end
  push --> pg
  image --> ghcr[(GHCR<br/>Container-Registry)]
  deploy -- scp compose.yml, deploy.sh,<br/>proxy/compose.yml, Caddyfile --> srv[Hetzner]
  deploy -- ssh: deploy.sh ‹abbild› --> srv
  srv -- docker compose pull --> ghcr
```

`deploy.sh` auf dem Server: Abbild holen → Datenbank sichern → Abbild in
`.env` eintragen → `docker compose up -d` → warten, bis `/api/health`
antwortet. Das vorige Abbild steht in `previous-image`, zurück ist ein
Befehl.

**5e.tools einlesen** ist ein eigener Lauf (`import-5etools.yml`, W8): von
Hand, oder aus `ci.yml` nach dem Ausrollen von dev, wenn sich
`packages/import-5etools` geändert hat. Prod nie von selbst.

```mermaid
flowchart LR
  ausl[von Hand: dev oder prod<br/>CI nach deploy: nur dev] --> job
  subgraph gha[GitHub Actions · import-5etools.yml]
    job[import<br/>model, registry, import-5etools bauen]
    src[(5etools-src/data<br/>zur Laufzeit geklont,<br/>nie im Repository)]
    src --> job
  end
  job -- scp import.sh,<br/>5etools-2014.json.gz --> srv[Hetzner]
  job -- ssh: import.sh … --replace-layer --> srv
  srv -- sichern, docker compose cp,<br/>exec import.js, Datei löschen --> app[app-Container]
```

---

## 3. Frameworks und Werkzeuge

| Schicht | Was | Version | Wofür |
|---|---|---|---|
| Laufzeit | Node.js | 22 (alpine) | Server, Werkzeuge, Build |
| Paketverwaltung | pnpm (Workspaces) | 10.33 | Monorepo, ein Lockfile |
| Sprache | TypeScript | 5.9 | überall ausser Prototyp und Legacy |
| Server | **Fastify** | 5.6 | HTTP-API, Cookies (`@fastify/cookie`), statische Dateien (`@fastify/static`) |
| Datenbank | PostgreSQL + `pg` | 17 / 8.16 | Register und Bestand in generischen Tabellen |
| Passwörter | `@node-rs/argon2` | 2.2 | Argon2id |
| Oberfläche | **Angular** | 21.2 | Standalone-Komponenten, Signals, Router mit Lazy Loading |
| | RxJS | 7.8 | HTTP-Aufrufe in `Api` |
| Modell | Zod | 4.1 | Schemaprüfung in `validateEntity` |
| Tests | Vitest | 4.0 | zwei Projekte: `node` (Modell, Register, Server, Importer) und `web` (jsdom + Angular) |
| | Playwright | 1.63 | Prüflauf des Prototyps |
| Qualität | ESLint 9 + typescript-eslint, Prettier | | `pnpm lint`, `pnpm format` |
| Betrieb | Docker Compose, Caddy 2, GitHub Actions, GHCR | | Abschnitte 1 und 2 |

---

## 4. Das Repository

Ein Repo für Code **und** Vault (D42). Was Obsidian liest, liegt in
`VTT/` und `Ideen/`; was gebaut wird, in `apps/` und `packages/`.

```text
atlas-mentis/
├── apps/
│   ├── server/          @nw/server   Fastify-API, Postgres, Befehle user/import/migrate
│   │   ├── src/                      app.ts (Routen), verwaltung.ts (Kampagnen, Mitglieder, Einladungen), auth.ts, repo.ts, repo.pg.ts, …
│   │   └── migrations/               001_backbone.sql … 009_blocks_are_fields.sql
│   └── web/             web          Angular-Oberfläche (Anmeldung, Liste, Artikel)
├── packages/
│   ├── model/           @nw/model    Typen, Prüfung, Rechnen, Sichtbarkeit — kein Framework
│   ├── registry/        @nw/registry die Registerzeilen (einzige Quelle) + Skripte
│   └── import-5etools/  @nw/import-5etools  Import aus 5e.tools (P5), läuft in der Pipeline (W8)
├── prototype/           Einzeldatei-Prototyp (Artefakt auf claude.ai), Prüfbestand, Migrationsskripte
├── legacy/              alte React-App (Vite + Express) — läuft, bis Karte und Initiative neu stehen
├── deploy/              bootstrap.sh, deploy.sh, import.sh, proxy/ (Caddy)
├── docs/                Datenmodell, Begriffe, Betrieb, Arbeitsplan, Bericht, diese Seite
├── VTT/  Ideen/  .obsidian/   der Obsidian-Vault (Anforderungen, Entscheidungen)
├── .github/workflows/   ci.yml, import-5etools.yml
├── Dockerfile           mehrstufig: Build (alles) → Laufzeit (nur Server + gebaute Oberfläche)
├── docker-compose.yml           prod  (main,    Port 8080)
└── docker-compose.preprod.yml   dev   (preprod, Port 8081)
```

### 4.1 Wer von wem abhängt

```mermaid
flowchart BT
  model["@nw/model<br/>Typen · validate · calc · views<br/>inline · markdown · dice · units<br/>instance · stack · visibility · knowledge"]
  registry["@nw/registry<br/>interfaces · fieldgroups · relations<br/>enums · views · units"]
  server["@nw/server<br/>Fastify"]
  web["web<br/>Angular"]
  imp["@nw/import-5etools"]
  proto["prototype/<br/>nebelwacht-artikel.html"]
  zod[zod] --> model
  model --> registry
  model --> server
  registry --> server
  model --> web
  model --> imp
  registry --> imp
  registry -. emit-seed schreibt JSON .-> proto
  imp -. Ausfuhrdatei .-> server
```

Die Regel dahinter: **`@nw/model` kennt kein Framework.** Was dort
steht — Prüfung, gerechnete Werte, Sichtbarkeit, Wissen — gilt für
Server und Oberfläche gleich. Die Oberfläche hängt nur am Modell, nicht
am Register: das Register holt sie zur Laufzeit von `/api/registry`.

---

## 5. Der Server

```mermaid
flowchart TB
  subgraph fastify[apps/server · Fastify]
    index[index.ts<br/>Konfiguration, migrate, seed, listen]
    hook[preHandler<br/>Anmeldung prüfen<br/>Schreibrechte]
    routes[app.ts · Routen]
    auth[auth.ts<br/>Argon2id, Sitzungs-Cookie,<br/>Fehlversuche]
    sieve[sieve<br/>Stapel → Instanz → Sichtbarkeit → Wissen]
    repoI{{Repository<br/>Schnittstelle}}
    pg[PgRepository<br/>repo.pg.ts]
    mem[InMemoryRepository<br/>repo.ts · für Tests]
    cli[Befehle<br/>user.ts · import.ts · migrate.ts]
  end
  model[["@nw/model<br/>inPlay · readInstance<br/>articleVisible · redactEntity<br/>validateEntity"]]
  db[(PostgreSQL)]
  index --> routes
  routes --> hook
  hook --> auth
  routes --> sieve
  sieve --> model
  routes -- schreiben --> model
  routes --> repoI
  cli --> repoI
  repoI --> pg --> db
  repoI --> mem
```

**Routen sprechen mit `Repository`, nie mit Postgres.** Deshalb laufen
alle Servertests ohne Datenbank gegen `InMemoryRepository`; nur der
Durchstich in CI prüft `PgRepository` gegen eine echte Postgres.

| Route | Was |
|---|---|
| `GET /api/health` | lebt der Prozess (für Docker und deploy.sh) |
| `POST /api/login` · `/api/register` · `/api/logout` · `/api/logout-everywhere` | Konto und Sitzung; Registrieren nur mit Einladung |
| `GET /api/me` | wer bin ich, welche Rollen, welche Figuren |
| `GET/POST/DELETE /api/invites` | Einladungen, mit Kampagne und Rolle; die Verwaltung alle, die Leitung in ihre Kampagne (`gm` legt an und widerruft, `co-gm` sieht) |
| `GET /api/campaigns` · `POST /api/campaigns` | die Kampagnen, an denen jemand leitet oder mitleitet (Verwaltung: alle); anlegen nur die Verwaltung |
| `GET /api/campaigns/:c/members` | Mitglieder mit Rolle und Figuren, dazu die Figuren, die diese Kampagne vergeben darf — `gm`, `co-gm`, Verwaltung |
| `POST /api/campaigns/:c/members` · `PUT`/`DELETE …/members/:user` | Konto beim Namen dazunehmen, Rolle setzen, herausnehmen — `gm` und Verwaltung, nie die eigene Rolle (ausser Verwaltung) |
| `PUT /api/campaigns/:c/members/:user/actors` | welche Figuren ein Mitglied führt (`app_user_actor`); keine Figur einer anderen Kampagne |
| `GET /api/users` | die Konten der Installation — nur die Verwaltung |
| `GET /api/registry` · `PUT /api/registry/:part` | das Register lesen; ändern die Verwaltung und die Leitung (`gm`) der laufenden Kampagne — `/api/me` sagt es mit `registry` |
| `GET /api/registry/usage` | was der Bestand an jeder Zeile trägt (`registryUsage`: je Art, Karte, Feld, Listenwert, Kante) — gezählt, bevor das Register etwas löscht; nur für wer es ändert |
| `GET /api/entities?ids=a,b,c` | diese Artikel ganz, gesiebt (höchstens 500) — die Teile eines Statblocks in einer Anfrage (W2) |
| `GET /api/list?area=&type=&of=&q=&layer=&nolayer=&parts=&sort=&offset=&limit=&f=` | **ein Blatt der Liste** mit Facetten (`{ total, columns, rows, facets }`) — Kompendium, Bereiche und jede Auswahl (W7) |
| `GET /api/entities` | der ganze Bestand, **gesiebt** — für Ausfuhr und Prüfungen, nicht für die Oberfläche |
| `GET /api/entities/:id` | ein Artikel, gesiebt, mit `refs`: die Namen seiner Kantenziele und die Treffer seiner `[[Verweise]]` (beim Ausliefern gerechnet, nie gespeichert) |
| `GET /api/entities/:id/backlinks` | wer auf den Artikel zeigt (Kurzfassung + Kante), gesiebt |
| `POST /api/entities` | **anlegen**: `{ type, name, fields? }` → Peg-Id, Nummer (`nextId`), Vorgaben aus dem Register, geprüft mit `validateEntity` |
| `GET /api/classes/:id` | eine Klasse samt Unterklassen, Stufentabellen und den Merkmalen, die eine davon gewährt oder einbettet (`classParts`), gesiebt — die Klassenansicht (W6) in einer Antwort |
| `PUT /api/entities/:id` · `DELETE /api/entities/:id` | schreiben, immer durch `validateEntity` |
| `POST /api/links` | `[[Name]]` → `[[nummer\|Name]]` (M11), über das, was der Schreibende sieht; liest nur, darf also jeder |
| `POST /api/validate` | prüfen ohne zu speichern |

Ohne Anmeldung offen sind nur Gesundheit, Anmelden, Registrieren,
Abmelden und `me`. Ein Server **ohne Konto und ohne Bestand** lässt
lesen; sobald ein Artikel da ist, nicht mehr (P5).

### 5.1 Was beim Lesen eines Artikels passiert

```mermaid
sequenceDiagram
  participant B as Browser
  participant F as Fastify
  participant R as Repository
  participant M as @nw/model
  B->>F: GET /api/entities (Cookie)
  F->>F: preHandler: Sitzung gültig?
  F->>R: listEntities(), getRegistry()
  R-->>F: alle Artikel, Register
  F->>M: inPlay(): steht der Artikel im Stapel der Kampagne?
  F->>M: readInstance(): Vorlage unter die Instanz legen
  F->>M: articleVisible(): darf diese Rolle ihn sehen?
  F->>M: redactEntity(): welche Felder davon?
  F-->>B: gesiebte Artikel
```

**Die Oberfläche hält keinen Bestand** (W7, 13.10.). Bis dahin lud sie
die Kurzfassung aller Artikel (`?as=summary`, 7,7 MB roh, 675 KB gepackt
bei den 24 157 aus 5e.tools) und rechnete Liste, Filter und Verweise
selbst — und weil Register und Kurzfassung in einem Zug kamen, wartete
sogar die Artikelseite auf die ganze Liste. Die Route ist weggefallen.
Jetzt:

- **Das Register** kommt allein und sofort (`Bestand.load`, ≈11 KB gepackt).
- **Ein Artikel** kommt beim Öffnen, gesiebt, mit `refs` (`names`: Id →
  Name für Kantenziele, Verweisfelder, Sichtbarkeitslisten; `links`: die
  Kandidaten jedes `[[ziel]]` nach `linkCandidates`). Die Artikelseite
  wartet auf Register und Artikel, auf nichts sonst. Die Rückbezüge kommen
  über `/backlinks`; gesiebt werden dort nur die Artikel, die auf ihn
  zeigen.
- **Listen und Auswahlen** fragen `/api/list`. Der Server baut dafür je
  **Bestand-Stempel** (`Repository.version()`: Anzahl und letzte Änderung),
  Register und Betrachter einmal einen **Index** (`apps/server/src/liste.ts`):
  je sichtbarem Artikel eine schmale Zeile mit Name, Art, Bereich, Ebenen,
  Quelle, Stand, Suchtext (Name, Aliasse, Deckname, Nummer), der Zahl der
  Abschnittskanten, die auf ihn zeigen, und den **Spalten seiner Art** —
  den Feldern ihrer `overview` (`listColumns`). Die Verwaltung teilt einen
  Index, ein Spieler hat seinen eigenen (das Sieb rechnet Wissen je
  Artikel); gehalten werden die letzten acht. Blättern, Suchen, Filtern
  laufen über die Zeilen, nicht über die Artikel.
- **Facetten** zählen über die Zeilen, die alle *anderen* Filter bestehen:
  Arten (mit Bereich, das Kompendium gruppiert danach), Ebenen, und bei
  einer gewählten Art je Spalte eine Aufzählung (`enum`/`enumRef` → Werte
  mit Zahl) oder eine Spanne (eine Zahl — oder ein Text, der fast überall
  eine Zahl ist wie der HG „1/4"). Im Code steht keine Spalte und kein
  Filter je Art.
- **Teile von Statblöcken**: ein Artikel, auf den genau einer über eine
  Abschnittskante (`RelationDef.section`, heute `composedOf`) zeigt, ist
  ein Teil davon und fehlt ohne `parts=1`; geteilte tragen die Zahl ihrer
  Nutzer (`users`). Gezählt wird über das, was der Betrachter sieht.

Gemessen mit dem vollen 5e.tools-Bestand (lokal, Postgres 16): ein Blatt
20–40 ms und 2 KB gepackt; der erste Aufruf nach einer Änderung baut den
Index neu (Verwaltung ≈300 ms samt Lesen aus Postgres, Spieler ≈370 ms).

Die Reihenfolge ist die Regel aus CLAUDE.md: erst ob überhaupt
(Stapel, Sichtbarkeit), dann was darin (Wissen). Zurückgehalten wird
**nur hier**; die Oberfläche zeigt, was ankommt.

### 5.2 Die Tabellen

Drei generische Tabellen tragen jeden Artikel, das Register steht als
Zeilen daneben. Eine neue Artikelart ist eine Zeile, keine Migration.

| Gruppe | Tabellen |
|---|---|
| Bestand | `entity` (die Id), `component` (eine Karte je Art und Artikel), `relation` (Kanten, vorwärts) |
| Register | `interface_def`, `component_def`, `relation_def`, `view_def`, `var_def`, `unit_def`, `enum_def`, `setting_def` |
| Zugang | `app_user`, `app_session`, `app_invite`, `login_attempt`, `campaign_member`, `app_user_actor` |
| Protokoll | `event_log` |

---

## 6. Die Oberfläche

```mermaid
flowchart TB
  subgraph angular[apps/web · Angular 21, Standalone, Signals]
    router[app.routes.ts<br/>/login · / · /artikel/:id · /campaign · /registry · /classes · /classes/:id]
    wache[kern/wache.ts<br/>Route-Guard: angemeldet?]
    subgraph seiten[Seiten, lazy geladen]
      login[login/login.ts]
      liste[artikel/kompendium.ts<br/>Kompendium und Bereiche]
      vorschau[artikel/vorschau.ts<br/>Vorschau quick]
      anlegen[artikel/anlegen.ts<br/>New article]
      wahl[artikel/wahl.ts<br/>Artikel suchen und wählen]
      artikel[artikel/artikel.ts<br/>Artikelansicht, Bearbeiten]
      felder[artikel/felder.ts<br/>Felder aus dem Register]
      text[artikel/text.ts<br/>Markdown, Verweise, Würfel]
      buch[artikel/statblock.ts · zauber.ts · gegenstand.ts · abschnitte.ts<br/>wie im Buch]
      register[register/register.ts<br/>Typen · Kanten · Listen]
      regtyp[register/typ.ts · feld.ts<br/>ein Typ auf einer Fläche]
      verwaltung[verwaltung/verwaltung.ts<br/>Mitglieder, Rollen, Einladungen]
      klassen[klassen/klasse.ts<br/>Klassenansicht: Tabelle, Merkmale je Stufe,<br/>Unterklassen filtern und vergleichen]
    end
    subgraph kern[kern/ · Dienste]
      api[api.ts<br/>HttpClient → /api]
      bestand[bestand.ts<br/>Register + geöffnete Artikel als Signal]
      session[session.ts<br/>wer ist angemeldet]
    end
  end
  model[["@nw/model<br/>views · calc · book · markdown · inline"]]
  router --> wache --> session
  router --> login & liste & artikel & verwaltung & register & klassen
  verwaltung --> api
  register --> regtyp --> bestand
  artikel --> felder & text & buch
  buch --> text
  liste --> vorschau & anlegen
  artikel & anlegen --> wahl --> api
  liste --> api
  vorschau & artikel --> bestand --> api
  klassen --> text
  klassen -->|"GET /api/classes/:id"| api
  login --> session --> api
  felder & text & buch --> model
  api -->|"/api · im Dev über proxy.conf.json"| srv[Fastify]
```

**Gezeichnet wird aus dem Register, nicht aus einer Vorlage je Art.**
`felder.ts` liest die Felder einer Art aus dem Register und das Modell
sagt, was in welcher Ansicht steht (`views`), was gerechnet wird
(`calc`) und wie Text aussieht (`markdown`, `inline`). Eine neue
Artikelart erscheint ohne Codeänderung. Die Artikelseite zeichnet die
Anordnung der Art (`layoutFor`); die Buch-Elemente `statblock`, `spell`
und `item` bauen ihre Zeilen in `book.ts` und holen die Teile eines
Statblocks über `Bestand.holen` (`?ids=`) in einer Anfrage.

**Das Register** (`/registry`, W5) bearbeitet dieselben Zeilen, aus
denen gezeichnet wird: Typen (eigene Felder offen, geerbte zugeklappt,
verlinkte und Kanten von hier), Kantenarten und Listen. Geschrieben wird
ein ganzer Teil über `PUT /api/registry/:part` und erst übernommen, wenn
der Server ihn nimmt (`register/arbeit.ts`). Was eine Änderung im Bestand
träfe — ein gelöschtes Feld, ein herausgenommener Typ, ein gestrichener
Listenwert —, wird vorher über `/api/registry/usage` gezählt und in der
Rückfrage gesagt; was der Bestand beim nächsten Speichern nicht mehr
bestünde (eine Karte ohne Typ, ein Typ mit Artikeln), lässt die Seite gar
nicht erst zu. Die reinen Regeln (Feldarten, Zyklen, Umbenennen samt aller
Nennungen) stehen in `register/regeln.ts`.

**Die Oberfläche hält keinen Bestand** (W7): das Register und die
geöffneten Artikel samt den Namen, die sie mitbrachten (`Bestand.namen`,
`Bestand.verweise`). Das Kompendium fragt je Blatt den Server
(`/api/list`); die Seitenzahl, die Feldfilter und die Vorschau stehen im
Filterzustand der Seite (`ListenFilter`, „der Filter gehört der Seite"),
die Art in der Adresse. Wer ein Kantenziel oder ein Verweisfeld wählt,
sucht über dieselbe Route (`nw-wahl`, `of=Art&q=…&limit=20`). Boards und Klassen fragen sie ebenso
(`Bestand.liste`): die Boards und die Geschichte mit `rel=partOf`, die
Namen der verbundenen Artikel mit `ids=`; die Zeilen liegen als schmale
Artikel in `Bestand.kurz`.

---

## 7. Das Modellpaket

`packages/model/src`, rund 3 900 Zeilen, ohne Framework:

| Modul | Aufgabe |
|---|---|
| `types.ts` | Registry, Entity, InterfaceDef, PropertySchema … |
| `validate.ts` | `validateEntity`: Pflicht, Spannen, Aufzählungen, Verweisziele, Stufen je Zustand |
| `entity.ts` | Registerzugriff: Typkette, Bereich, eigene Felder, Ids (`nextId`), Rückbezüge |
| `calc.ts` | gerechnete Werte (D8), `evalArith` als Shunting-Yard statt `eval` |
| `views.ts` | welche Felder in `overview`, `quick`, `full`; Anordnung je Typ |
| `inline.ts` · `markdown.ts` · `dice.ts` | Text: `[[id\|Anzeige]]`, `{VAR}`, `{{1d6+2}}`, Markdown |
| `units.ts` | Masse beim Lesen umrechnen |
| `instance.ts` | Vorlage und Instanz: `resolveInstance`, `thinInstance` |
| `stack.ts` | Ebenen: `inPlay`, `overriderOf` |
| `visibility.ts` | `articleVisible`: Rolle am Tisch, `audience`, `revealedTo`, `hiddenFrom` |
| `knowledge.ts` | `redactEntity`: welche Felder ein Träger kennt, Fraktionsränge |
| `usage.ts` | `registryUsage`: was der Bestand an jeder Registerzeile trägt — für das Register vor dem Löschen |
| `classes.ts` | die Klassenansicht (W6): Merkmale je Stufe aus `grants`, Übungsbonus, eingebettete Merkmale (ein Verweis allein im Absatz), Stufentabelle mit Zusatzspalten |

---

## 8. Neben dem Hauptweg

```mermaid
flowchart LR
  reg["packages/registry<br/>(Quelle)"] -- emit-seed --> seed[prototype/test<br/>Prüfaufbau]
  reg -- catalogue --> docs1[docs/Artikeltypen.md<br/>Datenmodell.md › Register heute]
  vault[VTT/Requirements.md] -- anforderungen --> docs2[docs/Anforderungen.md<br/>VTT/Umsetzung.md]
  ft[(5etools-src/data<br/>ausserhalb des Repos)] -- import-5etools --> datei[Ausfuhrdatei<br/>~35 MB, nicht eingecheckt]
  datei -->|"server import --replace-layer"| pg[(Postgres)]
  datei -->|"--sample"| seed
```

- **Prototyp** (`prototype/nebelwacht-artikel.html`): eine Datei, als
  Artefakt auf claude.ai, eigene Ablage. Dort entstehen neue Ansichten
  zuerst; was steht, wandert nach `apps/web`.
- **Legacy** (`legacy/`): React + Vite, Express mit Schlüssel-Wert-Ablage.
  Wird nicht weiterentwickelt.

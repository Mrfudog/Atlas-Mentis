# Betrieb — Hetzner, zwei Umgebungen

Ein Server, zwei Umgebungen, beide aus CI ausgerollt:

| Zweig | Umgebung | Adresse | Port auf dem Server | Verzeichnis |
| --- | --- | --- | --- | --- |
| `preprod` | `dev` | `dev.atlas.<domain>` | `127.0.0.1:8081` | `/srv/atlas/dev` |
| `main` | `prod` | `atlas.<domain>` | `127.0.0.1:8080` | `/srv/atlas/prod` |

Jede Umgebung hat ihre eigene Datenbank, ihr eigenes Volume und ihre eigenen
Konten. Davor steht Caddy als Container (`deploy/proxy/`, Host-Netz) und
macht TLS; auch er kommt aus dem Repository.

**Welche Umgebung antwortet, sagt `ATLAS_ENV`** (`dev` oder `prod`, gesetzt
in `docker-compose.preprod.yml` und `docker-compose.yml`). Der Server gibt
es in `/api/health` und `/api/me` mit; auf `dev` steht in der Oberfläche
oben ein schmales Band „DEV — Test environment", auf `prod` und ohne
Angabe keines (T-070). Wer auf dev pflegt, pflegt auf der Spielwiese:
was dort fehlt, wenn ausgerollt oder eingelesen wird, steht unten unter
[Was Daten löschen kann](#was-daten-löschen-kann).

> **Schalter:** der Job `deploy` läuft nur, wenn die Repo-Variable
> `DEPLOY_ENABLED` auf `true` steht (Settings › Secrets and variables ›
> Actions › Variables). Ohne ihn bleibt ein Push grün, auch wenn die
> Umgebungen noch keine Secrets haben.

## Artikel weg? — zuerst die Ebenen prüfen

Fehlen nach dem Anlegen einer Kampagne oder einem Einlesen auf einmal viele
Artikel (auf dev einmal alle aus 5e.tools), sind sie fast immer **nicht
gelöscht, sondern nicht aufgeschaltet**: sobald es eine Kampagne gibt, zeigt
der Server nur, was ihre aufgeschalteten Ebenen bringen, und Artikel ohne
Ebene (Datenmodell, E2a).

1. **Kompendium ansehen.** Steht über der Liste „… articles are hidden in
   layers that ‘…’ does not put in play", ist es das. Wer darf
   (Verwaltung, Leitung der Kampagne), drückt dort **Turn on**.
2. **Kampagnenseite** (`/campaign`, Kasten „Layers in play"): die Ebene
   anhaken, die Reihenfolge prüfen — oben gewinnt.
3. **Register:** je Art steht „N in play in ‘…’ · M stored". Weichen beide
   Zahlen ab, liegt der Rest in einer Ebene, die nicht aufgeschaltet ist.
4. Erst wenn auch „stored" zu klein ist, fehlt wirklich etwas — dann
   [Zurück](#zurück) oder [5e.tools laden](#5etools-laden).

Lesend von aussen, mit einem API-Token ([Werkzeugzugang](#werkzeugzugang)):
`curl -s -H "Authorization: Bearer $ATLAS_DEV_TOKEN" "$ATLAS_URL/api/list?limit=1"`
(in einer Cloud-Sitzung mit Network secret ohne `-H`)
— das Feld `unactivated` nennt Kampagne, Ebenen und Zahlen; fehlt es,
blendet keine Ebene etwas aus.

## Was bei einem Push passiert

```
push preprod ─┬─ check      lint, test, build (wie bisher)
              ├─ postgres   Durchstich gegen eine frische Postgres 17
              └─ image      Abbild bauen, nach GHCR: :preprod und :preprod-<sha>
                   └─ deploy   Environment „dev": SSH → deploy.sh :preprod-<sha>
                        └─ import-5etools   nur wenn packages/import-5etools sich
                                            geändert hat: 5e.tools neu einlesen
```

`main` läuft genauso und rollt nach `prod` aus — ohne `import-5etools`
(siehe [5e.tools laden](#5etools-laden)). Weil `main` nur aus `preprod`
vorgespult wird, ist es derselbe Commit, der auf dev schon lief.

**Gebaut wird nur in CI.** Der Server holt das fertige Abbild und startet es;
was dort läuft, ist genau das, was geprüft wurde. Ein `docker build` auf dem
Server wäre ein zweiter Bau, und der erste, der von CI abweicht, fällt erst
am Tisch auf.

**Der Durchstich** (`apps/server/scripts/durchstich.mjs`) startet den
gebauten Server gegen eine leere Postgres: alle Migrationen von der ersten
an, Konten über die Kommandozeile, Artikel schreiben und lesen, das Register
speichern, die Sichtbarkeit einer Leitung je Kampagne, löschen. Die übrigen
Tests laufen gegen `InMemoryRepository` — und zwei Migrationen (007, 013)
liefen auf einer leeren Datenbank nie durch, ohne dass es jemand gemerkt
hätte. Gemerkt hätte man es beim ersten Aufsetzen hier.

**`deploy/deploy.sh`** tut auf dem Server, in dieser Reihenfolge:

1. das neue Abbild holen — schlägt das fehl, läuft das alte unberührt weiter;
2. die Datenbank sichern (`backups/<zeit>.dump`, die letzten 20 bleiben);
3. das Verzeichnis der Bilder anlegen und dem Benutzer `node` im Abbild
   geben (`daten/bilder`, uid 1000) und neue Bilder nach `backups/bilder/`
   holen (`bilder-sichern.sh`, [Bilder](#bilder));
4. das laufende Abbild als `previous-image` merken;
5. `IMAGE=` in `.env` setzen und `docker compose up -d` — die Migrationen
   laufen beim Start;
6. warten, bis `/api/health` antwortet, sonst die letzten Logzeilen zeigen
   und mit Fehler enden.

## Den Server einrichten — Schritt für Schritt (einmal)

Alles, was auf dem Server liegt, kommt aus diesem Repository: die
Compose-Dateien der beiden Umgebungen, `deploy/deploy.sh`, und der Reverse
Proxy aus `deploy/proxy/` (Caddy als Container, Host-Netz, holt seine
Zertifikate selbst). Von Hand wird einmal die Maschine vorbereitet
(`deploy/bootstrap.sh`), danach rollt jeder Push aus.

### 1. Maschine bei Hetzner

- **Hetzner Cloud** → Server anlegen: Ubuntu 24.04 oder 26.04, Typ **CPX22**
  (2 vCPU AMD, 4 GB, 80 GB) — reicht für beide Umgebungen samt Proxy,
  gebaut wird nicht hier. CX23 (40 GB, ältere Intel-Generation) geht
  auch, ist aber bei Images, Dumps und Logs schneller voll.
  Standort nach Wahl; IPv4 **und** IPv6.
- Beim Anlegen deinen eigenen SSH-Schlüssel hinterlegen (damit du als
  `root` hineinkommst; Passwörter sind gleich abgeschaltet).
- **Firewall** (Hetzner Cloud → Firewalls) anlegen und dem Server zuweisen:
  eingehend TCP 22, 80, 443 von überall; sonst nichts. Port 22 muss offen
  bleiben, weil GitHubs Läufer von wechselnden Adressen kommen.
- Optional **Backups** der Maschine einschalten (20 % Aufpreis): ersetzt
  die Datenbanksicherung nicht, macht aber eine kaputte Maschine zu einem
  Klick.

### 2. DNS

Zwei Namen auf die Maschine, A- und AAAA-Eintrag, beim Anbieter der
Domain (oder in Hetzner DNS):

| Name | zeigt auf |
| --- | --- |
| `atlas.<domain>` | IPv4 und IPv6 des Servers |
| `dev.atlas.<domain>` | dieselben |

Erst wenn beide auflösen, bekommt Caddy Zertifikate. Prüfen:
`dig +short atlas.<domain>`.

### 3. Schlüssel für CI (auf deiner Maschine)

Ein eigener Schlüssel nur fürs Ausrollen:

```bash
ssh-keygen -t ed25519 -N "" -C "atlas-deploy" -f atlas-deploy
cat atlas-deploy.pub      # → Argument 4 von bootstrap.sh (Schritt 4)
cat atlas-deploy          # → GitHub-Secret DEPLOY_SSH_KEY (Schritt 5), danach lokal löschen
```

### 4. Server vorbereiten (als root, einmal)

```bash
ssh root@<server-ip>
curl -fsSL https://raw.githubusercontent.com/Mrfudog/atlas-mentis/preprod/deploy/bootstrap.sh -o bootstrap.sh
sh bootstrap.sh atlas.<domain> dev.atlas.<domain> <mail@domain> "$(cat <<'K'
ssh-ed25519 AAAA… atlas-deploy
K
)"
```

Das Skript installiert Docker und `unattended-upgrades`, schaltet
Passwort-Anmeldung und root-Login per SSH ab, legt den Benutzer `deploy`
an (in der Gruppe `docker` — auf dieser Maschine faktisch root, hingenommen,
weil sonst nichts darauf läuft), schreibt je Umgebung ein zufälliges
`POSTGRES_PASSWORD` nach `/srv/atlas/{prod,dev}/.env`, die beiden Namen
nach `/srv/atlas/proxy/.env`, und richtet die nächtliche Sicherung als
Cron für `deploy` ein. **Am Ende druckt es, was nach GitHub gehört**, samt
der `known_hosts`-Zeile. Den Fingerabdruck dort einmal mit der
Hetzner-Konsole vergleichen (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`):
ein fester Hostschlüssel ist der Grund, warum CI `StrictHostKeyChecking yes`
fährt — sonst rollte es auf die erste Maschine aus, die sich unter der
Adresse meldet.

Noch einmal laufen lassen ist ungefährlich: vorhandene Passwörter bleiben.

### 5. GitHub einrichten

**Settings → Environments**, zwei anlegen:

| Environment | Deployment branches | Secrets | Variables |
| --- | --- | --- | --- |
| `dev` | nur `preprod` | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` | `PUBLIC_URL` = `https://dev.atlas.<domain>` |
| `prod` | nur `main` | dieselben vier (gleicher Server, gleicher Schlüssel) | `PUBLIC_URL` = `https://atlas.<domain>` |

**Die Zweigregel ist der Schutz**, nicht der Workflow: ohne sie könnte ein
Lauf von einem anderen Zweig die Geheimnisse von `prod` lesen. Wer vor
dem Ausrollen nach `prod` noch einmal bestätigen will, setzt dort
*Required reviewers*.

**Settings → Secrets and variables → Actions → Variables** (Repository):
`DEPLOY_ENABLED` = `true`. Ohne diese Variable bleibt der Job `deploy`
absichtlich aus. **Als Repository-Variable**, nicht als Secret und nicht
im Environment: die Bedingung des Jobs wird geprüft, bevor das Environment
geladen ist, und sieht nur Variablen des Repositorys.

**Wann ausgerollt wird:** beim **Push** auf `preprod` bzw. `main` — also
beim Merge eines Pull Requests, nicht in seinem Lauf. Der Lauf eines Pull
Requests prüft nur; ungemergter Code kommt nie auf dev. Ohne neuen Merge:
*Actions → CI → Run workflow* auf dem Zweig. `DEPLOY_DIR` und `PROXY_DIR` überschreiben die
Verzeichnisse, wenn es nicht `/srv/atlas/…` sein soll.

**Settings → Actions → General**: *Workflow permissions* auf „Read and
write" ist **nicht** nötig — der Job `image` bringt `packages: write`
selbst mit. Das Paket `ghcr.io/mrfudog/atlas-mentis` entsteht beim ersten
Lauf und ist privat; `deploy.sh` meldet sich mit dem kurzlebigen
`GITHUB_TOKEN` des Laufs an (über stdin, nicht über die Befehlszeile).

### 6. Der erste Lauf

Ein Push auf `preprod` (oder *Re-run* des letzten Laufs unter *Actions*).
Reihenfolge, die man im Lauf sieht: `check` → `postgres` → `image` →
`deploy (dev)`. Beim ersten Mal:

1. `deploy` legt `/srv/atlas/dev/compose.yml`, `deploy.sh` und
   `/srv/atlas/proxy/{compose.yml,Caddyfile}` hin.
2. Der Proxy startet (`docker compose up -d` in `/srv/atlas/proxy`) und
   holt Zertifikate für beide Namen — dauert eine Minute, braucht DNS aus
   Schritt 2 und Port 80/443 aus Schritt 1.
3. `deploy.sh` holt das Abbild, startet Postgres und die Anwendung; die
   Migrationen laufen beim Start; `/api/health` muss innert 90 s antworten.

Prüfen: `https://dev.atlas.<domain>/api/health` antwortet, das Schloss
ist grün. Dann `main` über einen Pull Request von `preprod` nachziehen —
derselbe Commit landet auf `prod`.

Wenn etwas hängt, auf dem Server als `deploy`:

```bash
cd /srv/atlas/dev && docker compose ps && docker compose logs --tail 80 app
cd /srv/atlas/proxy && docker compose logs --tail 40 caddy     # Zertifikate, DNS
```

### 7. Das erste Konto

```bash
cd /srv/atlas/prod
docker compose exec app node apps/server/dist/user.js add <name> --admin
docker compose exec app node apps/server/dist/user.js role <name> <kampagnen-id> gm
```

Das Passwort wird erfragt, nie als Argument übergeben. `--admin` ist die
Verwaltung der Installation; die Leitung einer Kampagne ist eine Rolle je
Kampagne (`role`). Alles Weitere in [Zugang.md](Zugang.md).

## Sichern

Vor jedem Ausrollen sichert `deploy.sh`. Dazu gehört eine nächtliche
Sicherung, und eine Kopie **ausserhalb** der Maschine — eine Sicherung auf
derselben Platte hilft gegen einen Fehler und nicht gegen einen Verlust.

`bootstrap.sh` richtet sie als Cron für `deploy` ein (03:17, eine je
Wochentag, `backups/nacht/<1–7>.dump`); nachsehen mit `crontab -l` als
`deploy`. Eigenes Verzeichnis, weil `deploy.sh` in `backups/` nur die letzten 20
behält — nach einer Woche mit vielen Ausrollungen wäre sonst keine
nächtliche mehr da.

Für die Kopie nach aussen eignet sich eine Hetzner Storage Box
(`rsync -a /srv/atlas/prod/backups/ u…@u….your-storagebox.de:atlas/`).
Sie nimmt `backups/bilder/` mit; **ohne `--delete`**, sonst ginge ein Bild,
das am Tisch gelöscht wurde, auch draussen.

### Bilder

Hochgeladene Bilder (T-114) liegen als Dateien im Volume
`daten/bilder/` der Umgebung (im Container `/data/assets`, `ASSET_DIR`;
E-032 a), je zwei Zeichen ein Unterverzeichnis: `3f/3fa9….png` und die
Vorschau `3f/3fa9….png.thumb.webp`. Der Name ist der Hash des Inhalts —
**eine Datei ändert sich nie**, sie kommt dazu oder geht. Was darüber
bekannt ist (Name, Sichtbarkeit, Grösse), steht im `Asset`-Artikel in der
Datenbank; [Datenmodell › Bilder](Datenmodell.md#121-bilder-t-114-req-021-e-032).

**Gesichert** werden sie von `bilder-sichern.sh`: neue Dateien nach
`backups/bilder/` (ein harter Verweis, wo es geht, sonst eine Kopie), nie
überschrieben, nie gelöscht. Es läuft vor jedem Ausrollen (`deploy.sh`) und
nachts um 03:27 (Cron von `bootstrap.sh`). Ein am Tisch gelöschtes Bild
bleibt also in `backups/bilder/`; wer dort Platz braucht, räumt von Hand —
welche Dateien noch genannt sind, sagt die Ausfuhr (`files`).

**Wie gross:** `ASSET_MAX_MB` in `.env` (Vorgabe 40) begrenzt ein einzelnes
Bild; eine Karte ist 5–30 MB. Wie viel insgesamt liegt:
`du -sh /srv/atlas/prod/daten/bilder`. Wird die Platte knapp, ein Hetzner
Volume einhängen und `daten/bilder` dorthin verlegen (Dateien umkopieren,
Pfad im Compose) — an den Artikeln ändert sich nichts.

**Auf einem Server, der vor T-114 eingerichtet wurde**, fehlt der nächtliche
Cron für die Bilder; `bootstrap.sh` noch einmal laufen lassen (ungefährlich,
Passwörter bleiben) oder als `deploy` mit `crontab -e` diese Zeile dazu:

```
27 3 * * * cd /srv/atlas/prod && [ -x bilder-sichern.sh ] && ./bilder-sichern.sh >/dev/null
```

### Die eigene Ausfuhr

Unabhängig von den Sicherungen des Servers lädt die Leitung ihre Kampagne
jederzeit als Datei herunter (T-077): auf der Seite **Campaign** der Knopf
„Export campaign", oder `GET /api/export?campaign=<id>` (mit einem
Lesetoken auch aus einem Werkzeug). Die Datei heisst
`<kampagne>-<datum>.json` und hat das Format, das der Ladebefehl liest
(`format`, `registry`, `entities`).

Darin stehen das **Register** und die **Artikel der Kampagne**: was in
einer Kampagnenebene liegt (eine Ebene, die nur diese Kampagne aufschaltet
und kein Regelwerk ist — `Layer.kind` nicht `system`/`expansion`/`book`), was
keine Ebene hat, die Kampagne selbst und die Ebenen, die sie aufschaltet,
als Artikel. Gesiebt nach dem, was der Aufrufer sieht. **Nicht** darin:
Konten, Sitzungen, Tokens, Einladungen und die Rollen am Tisch (REQ-199),
und die Artikel aus 5e.tools oder einer geteilten Ebene. Die ganze Ausfuhr
mit allem holt nur die Verwaltung: `&layers=all`.

Wer sie ausführen darf: [Zugang.md › Wer was darf](Zugang.md#wer-was-darf).

## Zurück

### Aus der eigenen Ausfuhr

Die Datei kommt über den Ladebefehl zurück, wie jede Ausfuhrdatei:

```bash
docker compose exec app node apps/server/dist/import.js /pfad/nebelwacht-2026-10-13.json --dry-run
docker compose exec app node apps/server/dist/import.js /pfad/nebelwacht-2026-10-13.json
```

Ohne Schalter schreibt er die Artikel der Datei über den Bestand und
löscht nichts. Zeigt ein Artikel der Kampagne auf etwas aus 5e.tools (eine
Klasse, eine Vorlage), muss 5e.tools **vorher** da sein — sonst lehnt die
Prüfung die Datei ab (`dangling_relation`) und schreibt nichts. Auf einen
frischen Server also erst [5e.tools laden](#5etools-laden), dann die
Datei. Konten und Rollen kommen nicht mit; die legt die Verwaltung neu an
(`user add`, `user role`, oder die Seite **Campaign**).

### Aus der Sicherung des Servers

Migrationen laufen nur vorwärts. Wer auf das vorige Abbild zurück will,
nimmt die Datenbank von davor mit — die Sicherung, die `deploy.sh` vor dem
Wechsel geschrieben hat:

```bash
cd /srv/atlas/prod
docker compose stop app
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' < backups/<zeit>.dump
./deploy.sh "$(cat previous-image)"
```

### Die Bilder zurück

Die Bilder brauchen beim Zurückgehen auf eine ältere Datenbank nichts:
eine Datei, die ein älterer Stand nennt, liegt noch da, und eine, die er
nicht mehr nennt, stört nicht. Fehlen sie ganz (neue Maschine, verlorene
Platte), kommen sie aus der Sicherung — gleiche Namen, nichts
überschrieben:

```bash
cd /srv/atlas/prod
mkdir -p daten/bilder
cp -R -n backups/bilder/. daten/bilder/        # oder: rsync -a u…@u….your-storagebox.de:atlas/bilder/ daten/bilder/
./deploy.sh "$(sed -n 's/^IMAGE=//p' .env | tail -n 1)"   # gibt das Verzeichnis dem Benutzer node
```

Ob jede Datei da ist, die ein Artikel nennt: die Ausfuhr der Kampagne
listet sie (`files`, je Asset `ref`), `ls daten/bilder/*/<ref>` findet sie.

## Was Daten löschen kann

Diese Wege ersetzen oder löschen Bestand. Jeder hat einen Weg zurück —
aber nur, solange die Sicherung von davor noch liegt (`backups/`, die
letzten 20; nächtliche in `backups/nacht/`). **Auf dev** ist das Absicht:
dort wird ausprobiert, und was zählt, steht auf prod.

| Was | Was dabei verloren gehen kann | Sicherung davor | Zurück |
| --- | --- | --- | --- |
| **Ausrollen mit Migration** (Push auf `preprod`/`main`, `deploy.sh`) | Eine Migration baut Tabellen um; sie läuft nur vorwärts. Was sie falsch umbaut, ist danach so. Entfernt sie gespeicherte Werte, bricht der Start ohne Freigabe ab ([unten](#migrationen-und-seed-löschen-nie-still)). | ja, `backups/<zeit>.dump` | [Zurück](#zurück): App anhalten, Datenbank aus dieser Sicherung, `./deploy.sh "$(cat previous-image)"` |
| **Einlesen mit `--replace`** (`import.sh`, `import.js`) | **Alles**, was nicht in der Datei steht — auch die eigenen Kampagnenartikel. | ja, `backups/<zeit>-vor-import.dump` (nicht bei `--dry-run`) | wie [Zurück](#zurück), mit der Sicherung `…-vor-import.dump`; das Abbild bleibt, `deploy.sh` ist nicht nötig, nur `docker compose start app` |
| **Einlesen mit `--replace-layer`** (Pipeline „5e.tools einlesen", Art `replace-layer`, verlangt `confirm=ersetzen`) | Was die Ebene der Datei bringt und in der Datei fehlt, **und eigene Änderungen an ihren Artikeln**. | ja, wie oben | wie oben |
| **Massenänderung** (Werkbank › Bulk change, `POST /api/bulk`) | Felder, Marken, Kanten an vielen Artikeln; mit `merge` und `mode: delete` auch Artikel. | die alten Fassungen stehen im Lauf selbst | Werkbank › Undo (`POST /api/bulk/<id>/undo`). Wurde ein Artikel seither geändert, sagt es das (409) — mit `force` gewinnt die alte Fassung. |
| **Ein Bild löschen** (Asset-Artikel löschen) | Die Datei, wenn kein anderes Asset sie nennt (T-114). | ja, `backups/bilder/` hält jede Datei, die vor dem letzten Ausrollen oder der letzten Nacht da war | die Datei aus `backups/bilder/` zurückkopieren, den Artikel aus der Datenbanksicherung oder der Ausfuhr |
| **Übernahme** (Werkbank › Transfer, T-130) | Auf dem Ziel: Felder und Kanten der gewählten Artikel und Registerzeilen — nur, was die Vorschau zeigte, Konflikte nur wie gelöst. | ja, `backups/uebernahme/<zeit>-vor-uebernahme-von-….json`, und jede alte Fassung im Protokoll | Werkbank › Transfer › Undo (beide Seiten); sonst die Datei über `import.js` ([Übernahme › Zurück](#zurück-1)) |
| **Überklonen** (Werkbank › Transfer, nur auf dev) | Der ganze Bestand von dev (Register, Artikel); die Konten bleiben. | ja, `backups/uebernahme/<zeit>-vor-ueberklonen.json` (der ganze Bestand) | `import.js <datei> --replace` |
| **Wiederherstellen** einer Sicherung, auch [prod nach dev holen](#den-bestand-von-prod-nach-dev-holen) | Alles, was **nach** der Sicherung geschrieben wurde. Beim Holen von prod nach dev: der ganze Bestand von dev (die Konten bleiben). | nein — vorher von Hand sichern (unten) | die Sicherung, die man vorher gemacht hat |

**Vor einem Wiederherstellen selbst sichern**, denn dort sichert kein
Skript:

```bash
cd /srv/atlas/dev     # oder prod
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > backups/$(date -u +%Y%m%dT%H%M%SZ)-von-hand.dump
```

**Sicher** ist: `--only-new` (die Vorgabe der Pipeline, legt nur an, D71),
`--dry-run` und die Vorschau einer Massenänderung — sie schreiben nichts
oder nur Neues.

### Migrationen und Seed löschen nie still

Beim Start gehen gespeicherte Werte auf drei Wegen verloren, und keiner davon still
(T-076, REQ-191):

- **Eine Migration**, die Karten, Felder, Kanten oder Zeilen entfernt
  (`delete from`, `drop column`, `payload - '…'`). Sie nennt im Kopf ihre
  **Prüfabfrage** — je Zeile `-- verlust: select count(*) from …`, eine Zahl:
  wie viele gespeicherte Werte sie entfernt. Ein Test verlangt sie an jeder
  neuen Migration, die entfernt.
- **Der Seed beim Start**, wenn er einen Registerteil schreibt, der eine
  Art, ein Feld, einen Listenwert oder eine Kantenart nicht mehr hat, die
  der Bestand trägt (gezählt mit `registryUsage`). Heute füllt er nur nach
  und ordnet um; der Schutz gilt für den Tag, an dem er mehr tut.
- **Das Register von Hand** (`/registry`): dort zählt die Seite vorher und
  fragt. Das ist eine Entscheidung im Moment und kein Start.

Zählt eine Migration oder der Seed etwas, **bricht der Start ab**, und
zwar bevor sie etwas ändert — die Migration läuft in ihrer Transaktion
gar nicht erst an. Im Log steht, was betroffen ist und wie oft, und wie
man freigibt:

```
024_beispiel.sql würde gespeicherte Werte entfernen:
  - select count(*) from component where …: 12
Abgebrochen, nichts geändert. Freigeben für genau diesen Lauf mit ATLAS_ALLOW_DATA_LOSS=024_beispiel.sql …
```

Auf dem Server heisst das: `deploy.sh` meldet „Nicht gesund", der
Container startet immer wieder und bricht jedes Mal an derselben Stelle ab.
Dann entweder **freigeben** — für genau diesen Lauf, nicht in `.env`:

```bash
cd /srv/atlas/prod
ATLAS_ALLOW_DATA_LOSS=024_beispiel.sql ./deploy.sh "$(sed -n 's/^IMAGE=//p' .env)"
```

— der Start läuft dann und schreibt den Verlust als Warnung ins Log
(`024_beispiel.sql: freigegebener Verlust, 12 Werte — …`). Oder **zurück**
aufs vorige Abbild (unten). Die abgebrochene Migration hat nichts
geändert; Migrationen *davor* im selben Lauf aber schon — dann gehört die
Sicherung von davor mit zurück.

`ATLAS_ALLOW_DATA_LOSS` ist eine Liste mit Kommas: Dateinamen der
Migrationen (mit oder ohne `.sql`) und `seed`. Die Compose-Dateien reichen
die Variable aus der Shell durch; steht sie nicht da, ist nichts
freigegeben. Die Sicherung vor dem Ausrollen läuft ohnehin.

Wer eine Migration schreibt, die entfernt, prüft sie im Durchstich mit
einem Probeartikel: er hält ein Feld, die Migration bricht ohne Freigabe
ab, mit Freigabe läuft sie und zählt (`apps/server/scripts/durchstich.mjs`
tut es mit einer Probemigration vor).

## 5e.tools laden

Die Artikel aus 5e.tools stehen **je Buch in einer eigenen Ebene**
(T-081, E-017): „Player's Handbook", „Monster Manual", „Curse of Strahd" …
(`kind: book`, Id `e5_book_<kürzel>`, `inLayer` an jedem Artikel). Was kein
Buch nennt (die Aktionsarten), liegt in „D&D 5e (2014) — no book given"
(`e5_unsourced_2014`, unter Official). „D&D 5e (2014)" selbst ist seit
T-109 eine **Gruppe** aller offiziellen 2014-Bücher: aufgeschaltet bringt
sie alle, ein einzelnes Buch darin lässt sich abschalten.
Eine Kampagne schaltet auf der Kampagnenseite die Bücher auf, die sie
nutzt (Liste mit Häkchen, nach Grundregelwerk, Quellenbuch und Abenteuer
gruppiert). **Ein Abenteuer** (`kind: adventure`, T-082) bringt dabei
seine Kapitel, Abschnitte, Begegnungen und Karten mit; die Kapitel stehen
danach im Kasten „Story" der Kampagnenseite. **Jedes Buch bringt seinen
Text** (T-108): je Kapitel ein `Chapter` mit seinen Teilen (Überschriften,
Absätze, Kästen, Verweise auf Zauber, Monster, Tabellen, die schon
Artikel sind) — zu lesen unter „Read" an der Ebene. Ein Lauf `only-new`
legt die Kapitel bestehender Buchebenen dazu an, ohne einen Artikel
anzufassen (gut 29 000 Teile für die 2014er Bücher). **Ein Abenteuer**
ist seit T-108 zweimal da: je Kapitel ein Arc (Geschichte) und ein
Chapter (Lesen) über denselben Szenen, sein Text als Teile. Schon geladene
Abenteuer stellt die **Migration `046_abenteuer_kapitel.sql`** beim Start
um (gemessen an allen 2014er Abenteuern: 589 Kapitel, gut 14 600 Teile,
rund 45 Sekunden Start): der Text von Arc und Szene zieht in einen
`Paragraph` und je Vorlesetext ein `ReadAloudText`, nichts geht. Feiner
zerlegt (je Absatz ein Teil, Vorlesetexte an ihrer Stelle) wird ein
Abenteuer nur, wenn es neu geladen wird — **ein Teil kommt nur mit seinem
Ganzen**: `only-new` legt in einem Kapitel oder einer Szene, die schon
steht, keine Teile dazu und sagt, wie viele es übersprang. Ein frischer
Bestand aus 5e.tools hat damit gut 150 000 Artikel (ein Lauf `only-new`
über einen bestehenden mit 33 000 legt rund 29 000 dazu, gemessen 150 s).
Die Karten sind Adressen
auf die Bilder bei 5e.tools — die Bilder selbst liegen nicht bei uns. Ein
einzelnes Abenteuer ergänzt man mit `sources` (z. B. `LMoP`), `only-new`
wie immer. Eingelesen wird über eine **Pipeline**; die
Daten von 5e.tools kommen dabei nie ins Repository und bleiben nicht auf
dem Server liegen. Was hereinkommt und was nicht, sagt
[5etools-Bericht.md](5etools-Bericht.md). Zuerst auf `dev`, `prod` erst,
wenn dev angeschaut ist (P6).

### Einmal einlesen, danach nur ergänzen

Der Import ist **ein einmaliger Lauf, der die Basis bildet** (D71). Danach
legt die Leitung selbst Artikel an, oder es wird gezielt ergänzt — ein
Modul, ein Buch. Neu geladen wird nicht.

Darum ist `only-new` die Vorgabe (`import.js <datei> --only-new`):
angelegt wird nur, wessen Id es noch nicht gibt. Was schon steht, bleibt,
wie es ist — auch wenn die Leitung es seither geändert hat (Kampfrolle,
Marken, Text). Gelöscht wird nichts. Vom Register kommen nur Zeilen dazu,
die es noch nicht gibt; eine Art, die jemand am Server angepasst hat,
bleibt angepasst. Der Lauf sagt `Nur ergänzt: 120 neu, 23 880
übersprungen (gibt es schon).` — beim zweiten Lauf mit derselben Datei
also `0 neu`. Geprüft wird wie immer alles, bevor etwas geschrieben wird.
**Die Nummern der neuen Artikel gleicht der Lauf an** (T-087): ein Verweis
nennt die Nummer (`[[spell-0601|Fireball]]`), und ein Bestand aus einem
älteren Lauf trägt für denselben Artikel oft eine andere. Eine Nummer, die
im Bestand ein anderer trägt, wird eine neue, und jeder Verweis in den
neuen Artikeln nennt die Nummer, die sein Ziel im Bestand trägt; der
Bestand selbst bleibt. Die Zeile sagt `… davon mit angeglichener Nummer
oder angeglichenen Verweisen`.

**Nur die Neuzugänge** (`additions`, `--only-new --additions`, T-087):
die Datei nennt in `additions`, was nicht zum Grundstand gehört (2024,
UA, Fahrzeuge, Decks, Bastionen, Waffenmeisterschaften, mit ihren Ebenen
und Gruppen), und nur das wird angelegt — dazu, was ein Neuzugang über
eine Kante braucht und noch nirgends steht. Für einen Bestand aus einem
älteren Importer: dort tragen geteilte Aktionen und Merkmale oft eine
andere Peg-Id als in der Datei, und `only-new` allein legte sie ein
zweites Mal an (dev am 14.10.: rund 5 000 Aktionen und 3 000 Merkmale);
ausserdem brächte es Abenteuer und Buchtext des Grundstands mit, die über
die aufgeschaltete Gruppe „D&D 5e (2014)" sofort im Spiel wären. Ein
Verweis auf einen Artikel, der nicht mitkommt, wird ein Verweis nach
Namen. Probelauf: `dry-run` mit `confirm` = `neues`.

**Nicht während eines Ausrollens einlesen.** Der Import läuft im
App-Container; rollt in der Zeit ein Push auf `preprod` aus, startet der
Container neu und der Import endet mit Code 137, mitten im Schreiben (so
am 14.10. nach 8 506 von 29 547 Artikeln). Nichts ist kaputt — jeder
Artikel wird für sich geschrieben —, und derselbe Lauf noch einmal bringt
den Rest. Vorher unter Actions nachsehen, dass auf `preprod` keine CI
läuft.

**2024, Unearthed Arcana, Fahrzeuge, Decks, Bastionen** (T-087,
REQ-243): seit T-087 bringt ein Lauf alles, jede Quelle in ihre Ebene —
gut 29 000 Artikel mehr, je Ebene gezählt in
[5etools-Bericht.md](5etools-Bericht.md). **Keine neue Ebene ist
aufgeschaltet**, auch nicht über die Gruppe „D&D 5e (2014)": eine
Kampagne ändert sich durch den Lauf nicht. Wer 2024 vergleichen will,
trägt die Ebene (oder die Gruppe „2024 rules") auf der Kampagnenseite als
Vergleichsebene ein (T-092); wer damit spielen will, schaltet sie auf.
Neues in einer schon aufgeschalteten 2014-Ebene (die Schiffe aus Ghosts of
Saltmarsh, das Tarokka-Deck aus Curse of Strahd) ist dagegen gleich da,
wie jeder neue Artikel eines Buchs. Der Lauf braucht die **Migration
`051_neue_arten_5etools.sql`**: sie trägt die Listenwerte `card`,
`facility`, `upgrade` (`RuleKind`) und `deck` (`Table.kind`) an
bestehenden Registerzeilen nach, die `only-new` sonst stehen liesse,
und **`054_ebenenart_buch_abenteuer.sql`** die Ebenenarten `book` und
`adventure` an `Layer.kind` — die Buchebenen kamen per Migration an der
Prüfung vorbei, und der erste Probelauf mit 2024 scheiterte an ihnen. Ohne
2024: `node packages/import-5etools/dist/cli.js <data> --only-2014`.

**Ein Modul ergänzen:** Pipeline mit `mode` = `only-new` und `sources` =
dem Kürzel aus 5e.tools (z. B. `CoS`, oder `PHB,MM`); zuerst `dry-run`
mit denselben Angaben. Was das Modul an Bekanntem mitbringt (ein Monster
aus dem MM), steht schon und wird übersprungen. **Ein neues Buch bringt
eine neue Ebene, und die ist in keiner Kampagne aufgeschaltet** — nach dem
Lauf auf der Kampagnenseite das Häkchen setzen, sonst stehen seine
Artikel in keiner Liste (die Listen sagen es mit „Turn on").

**Vom Bestand mit einer Ebene zu einer je Buch** (Migration
`026_ebene_je_buch.sql`, T-081): beim Start hängt der Server jeden Artikel
der alten Ebene „D&D 5e (2014)" an die Ebene seines Buchs
(`Source.publication`, sonst die Fundstelle in den Notizen) — kein
Neueinlesen, Ids und eigene Änderungen bleiben. Jede Kampagne, die die
alte Ebene aufschaltete, schaltet danach alle Bücher auf, in die etwas
umzog, auf derselben Höhe: sie sieht genau, was sie vorher sah, und die
Leitung schaltet ab, was sie nicht braucht. Was keine Quelle trägt, bleibt
in der alten Ebene und steht im Startprotokoll (`Ohne Quelle in der alten
Ebene geblieben (n): …`). Ein Buch, das die Migration nicht beim Namen
kennt, heisst wie sein Kürzel, bis jemand die Ebene umbenennt.

**Gruppen und Beschreibung der Ebenen** (T-088, Migration
`034_ebenen_gruppen.sql`): beim Start legt der Server die Gruppen-Ebenen
an (Core rules, Supplements, Settings, Adventures, Unearthed Arcana, 2024
rules, Screens & other — nur die, in die ein Buch gehört), hängt jede
Buchebene an ihre Gruppe und trägt Kürzel und „XGE — Xanathar's Guide to
Everything" als Beschreibung ein, wo nichts steht. Erscheinen, Autor,
Stufen und Handlungsstrang kennt nur 5e.tools: dafür einmal die Pipeline
mit `mode` = `layers` (`import.js <datei> --layers`). Der Lauf liest aus
der Datei **nur die Ebenen**: neue (Gruppen) legt er an, an bestehenden
füllt er, was leer ist, und richtet ihre Gruppen des Importers
(`e5_group_*`) nach der Datei — eine Ebene, die die Migration zu den
Supplements legte, die aber ein Setting ist, wechselt dabei. Kein Artikel,
keine Registerzeile, keine Kampagne wird angefasst; was die Leitung an
einer Ebene geändert hat, bleibt.

**Herausgeber und Blocklist-Kategorien** (T-094, Migration
`037_ebenen_herausgeber.sql`): beim Start legt der Server die
Herausgeber-Gruppen „Official" und „Partnered" (`e5_publisher_*`,
`groupBy: 'publisher'`) und die Kategorien „Non-standard", „Comedy" und
„Outside the Forgotten Realms" an — wieder nur, wo ein Buch hineingehört —
und hängt jede Buchebene ein. Welches Buch wohin, steht in
[5etools-Abgleich › Herausgeber](5etools-Abgleich.md#herausgeber-und-blocklist-kategorien-t-094).
Ein Lauf mit `mode` = `layers` tut dasselbe aus der 5e.tools-Datei und ist
danach nur nötig, wenn 5e.tools neue Bücher bringt. Hat die Leitung ein
Buch an einen **eigenen** Herausgeber gehängt (eine eigene Gruppe mit
`groupBy: 'publisher'`, etwa „Third party"), bleibt es dort; an die
Gruppen des Importers hängt `layers` es nach der Datei zurück.

**Wann `replace-layer`:** nur, wenn die Ebene wirklich neu geladen werden
soll — etwa weil der Importer etwas an *bestehenden* Artikeln anders
schreibt und das überall ankommen soll. **Was es kostet:** jeder Artikel
der Ebene wird aus der Datei neu geschrieben, eigene Änderungen an
5e.tools-Artikeln (Werkbank, D70) gehen dabei verloren; was die Ebene
bringt und die Datei nicht mehr, wird gelöscht. Die Pipeline verlangt
dafür `confirm` = `ersetzen` und bricht sonst ab. Vor dem Lauf sichert
`import.sh` die Datenbank — das ist der Weg zurück.

### Ersetzen je Ebene

`replace-layer` **ersetzt die Ebene**, nicht den Bestand
(`import.js <datei> --replace-layer=<Id oder Name>`, W8). Seit es je Buch
eine Ebene gibt, bringt die Datei viele; welche ersetzt wird, sagt der
Name (`--replace-layer="Monster Manual"`), ohne ihn bricht der Lauf ab
und zählt die Ebenen auf. Gelöscht wird nur, was die Ebene
der Datei bringt — `inLayer` auf sie und auf keine andere — und in der
Datei fehlt. Eigene Artikel ohne Ebene oder in einer Kampagnenebene
bleiben, auch einer, der zusätzlich in der 5e-Ebene steht. Der Lauf sagt:

- wie viele Artikel geschrieben und gelöscht wurden, die gelöschten je Art
  (`3 gelöscht (Spell 2, Statblock 1)`);
- welche **Kanten aus bleibenden Artikeln** danach ins Leere zeigen
  (`Der Fall von Kanalgang (…) —involves→ Fireball (…)`) — sie bleiben
  stehen und sind dann ein `dangling_relation`; wer sie nicht will, löscht
  sie von Hand;
- welche **Instanzen** von einer gelöschten Vorlage gelöst wurden — sie
  tragen danach selbst, was sie von ihr lasen, wie beim Löschen über die
  Oberfläche;
- welche Figuren an einem Konto nicht mehr da sind (die Konten bleiben,
  REQ-199).

`--dry-run` sagt dasselbe und schreibt nichts. `--replace` (alles löschen,
was nicht in der Datei steht) gibt es weiter — für eine Sicherung, die den
ganzen Bestand ersetzen soll, nicht für 5e.tools: es nähme die eigenen
Kampagnenartikel mit. Die Ebene wählt `--replace-layer` selbst (die eine,
auf die die Artikel der Datei zeigen); `--replace-layer=<id oder Name>`
nennt sie ausdrücklich.

### Die Pipeline (der Normalweg)

**Actions › 5e.tools einlesen › Run workflow**:

| Eingabe | Werte |
| --- | --- |
| *Use workflow from* | `preprod` für dev, `main` für prod — die Zweigregel der Environments verlangt es, ein Lauf vom falschen Zweig bricht gleich ab |
| `environment` | `dev` oder `prod` |
| `mode` | `only-new` (Vorgabe): nur anlegen, was es noch nicht gibt · `additions`: wie `only-new`, nur die Neuzugänge seit T-087 · `dry-run`: nur sagen, was `only-new` täte (mit `confirm` = `ersetzen`: was `replace-layer` täte, mit `neues`: was `additions` täte) · `replace-layer`: Ebene neu laden, nur mit `confirm` = `ersetzen` · `add`: dazulegen und Bestehendes überschreiben · `layers`: nur die Ebenen — Gruppen und Herausgeber anlegen, Beschreibung nachtragen, kein Artikel (T-088, T-094) |
| `sources` | nur diese Quellen, z. B. `PHB,MM` oder ein Modulkürzel; leer heisst alles |
| `confirm` | `ersetzen` für `replace-layer`, sonst leer |
| `source-ref` | Stand von `5etools-src` (Zweig oder Tag); leer heisst der neueste |

Der Lauf klont `5etools-src` (nur `data`, nach `$RUNNER_TEMP`), baut
`model`, `registry` und `import-5etools`, erzeugt die Datei (jeder Artikel
geht durch `validateEntity`; besteht einer nicht, endet der Lauf hier),
legt sie gepackt mit `deploy/import.sh` in das Verzeichnis der Umgebung
und ruft dort `import.sh` auf. Das Skript **sichert die Datenbank**
(`backups/<zeit>-vor-import.dump`, ausser beim Probelauf), kopiert die
Datei in den laufenden `app`-Container, liest sie ein und löscht sie
danach — im Container und auf der Platte, auch wenn etwas scheitert. Die
Ausgabe des Imports steht im Log und in der Zusammenfassung des Laufs; der
Bericht hängt als Artefakt daran (30 Tage).

**Von selbst** läuft es nie (D71) — auch nicht, wenn sich
`packages/import-5etools` ändert: ein geänderter Importer ist kein Grund,
alles neu zu laden. Mit Ausrollen davor: **Actions › CI › Run workflow**
mit dem Häkchen „5e.tools danach einlesen" — auf `preprod` für dev, auf
`main` für prod; das liest mit `only-new` ein (Job `import-5etools`, mit
dem Abbild, das gerade gestartet ist).

Der Lauf braucht ein Verwaltungskonto auf der Umgebung (Schritt 7 oben):
ein Server ohne Konto liest ohne Anmeldung, solange sein Bestand leer ist
— mit einem Bestand nicht mehr. Und er braucht ein Abbild, das
die Schalter kennt (`--only-new`, `--replace-layer`, `--layers`, `--dry-run`);
`import.sh` prüft das und verweigert sonst, statt einen Probelauf schreiben
oder ein Ergänzen überschreiben zu lassen.

### Von Hand (Notlösung)

Wenn die Pipeline nicht geht — GitHub Actions gestört, oder die Datei soll
vor dem Laden lokal angeschaut werden.

**1. Daten holen** — ausserhalb des Repos (112 MB, nicht unsere Daten):

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/5etools-mirror-3/5etools-src.git ~/5etools-src
git -C ~/5etools-src sparse-checkout set data
```

**2. Die Datei erzeugen** — lokal:

```bash
pnpm --filter @nw/model build && pnpm --filter @nw/registry build && pnpm --filter @nw/import-5etools build
node packages/import-5etools/dist/cli.js ~/5etools-src/data --out 5etools-2014.json --bericht docs/5etools-Bericht.md
```

Die Datei (rund 35 MB, 24 000 Artikel) wird **nicht** eingecheckt, der
Bericht schon. `--srd` nimmt nur, was im SRD steht; `--sources PHB,MM` nur
diese Bücher. `--sample` schreibt einen Ausschnitt als Prüfbestand nach
`prototype/test/dbdump/entities` (das Register dazu: `emit-seed`) —
derselbe Ausschnitt geht ins Artefakt. Das Verzeichnis vorher leeren: der
Lauf schreibt hinzu und löscht nichts. Gleiche Merkmale und Fassungen aus
mehreren Büchern löst der Lauf selbst auf
([Arbeitsplan › Doppel](5etools-Arbeitsplan.md)).

**Ohne eigenen Rechner** gehen Schritt 1 und 2 auch auf dem Server, in
einem Wegwerf-Container (als `deploy`; nichts davon bleibt installiert):

```bash
mkdir -p ~/5e && cd ~/5e
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 -e NODE_OPTIONS=--max-old-space-size=3072 \
  -v "$PWD":/w -w /w node:22 bash -c '
    set -e
    [ -d atlas-mentis ] || git clone --depth 1 -b preprod https://github.com/Mrfudog/atlas-mentis.git
    [ -d 5etools-src ] || { git clone --depth 1 --filter=blob:none --sparse https://github.com/5etools-mirror-3/5etools-src.git && git -C 5etools-src sparse-checkout set data; }
    mkdir -p /tmp/bin && corepack enable --install-directory /tmp/bin && export PATH=/tmp/bin:$PATH
    cd atlas-mentis && pnpm install --frozen-lockfile
    pnpm --filter @nw/model build && pnpm --filter @nw/registry build && pnpm --filter @nw/import-5etools build
    node packages/import-5etools/dist/cli.js /w/5etools-src/data --out /w/5etools-2014.json'
gzip -9 5etools-2014.json && cp 5etools-2014.json.gz atlas-mentis/deploy/import.sh /srv/atlas/dev/
```

Nach dem Laden `rm -rf ~/5e` — die Daten gehören nicht auf die Platte.

**3. Laden** — dasselbe Skript wie die Pipeline, es sichert vorher und
räumt danach auf:

```bash
gzip -9 5etools-2014.json
scp 5etools-2014.json.gz deploy/import.sh deploy@<host>:/srv/atlas/dev/
ssh deploy@<host>
cd /srv/atlas/dev && chmod +x import.sh
./import.sh 5etools-2014.json.gz --only-new --dry-run   # erst ansehen (löscht die Datei danach)
./import.sh 5etools-2014.json.gz --only-new             # dann einlesen (Datei noch einmal hinlegen)
```

Lokal gegen die eigene Datenbank: `pnpm --filter @nw/server run import
<datei> [--only-new | --replace-layer | --replace] [--dry-run]` — mit `run`, denn `pnpm
import` ist ein eingebauter Befehl von pnpm und liefe sonst statt des
Skripts.

### Was beim Einlesen gilt

Geprüft wird alles, **bevor** etwas geschrieben wird — jeder Artikel gegen
das Register, und dass jede Kanten-Id im ganzen Bestand danach nur einmal
vorkommt; ein Fehler lässt den Bestand, wie er war. Dann wird zuerst
gelöscht, danach Artikel für Artikel geschrieben: bricht ein Lauf **beim
Schreiben** ab (Datenbank weg, Platte voll), steht ein Teil da. Dann
denselben Lauf noch einmal — er bringt den Rest. Die Sicherung von davor
liegt in `backups/` (Zurück: wie oben, mit dieser Sicherung).

Eine Datei mit `registry` und ohne `entities` bringt nur die
Registerzeilen. Die Ablage speichert `interfaces`, `relations`, `views`,
`units`, `vars`, `enums` und `settings` (die letzten beiden seit Migration
019; eine ältere Datenbank bekommt sie beim nächsten Start aus den
Startzeilen nachgefüllt, solange sie dort leer sind).

## Werkzeugzugang

Seit W9 (13.10.2026): eine Claude-Sitzung in der Cloud (oder ein anderes
Werkzeug) **prüft dev und ändert dort in grossen Zügen** — über die
Werkbank (`/api/checks`, `/api/bulk`) und das Skript `scripts/atlas.mjs`.
Angemeldet wird mit einem **API-Token** eines eigenen Kontos
([Zugang › API-Tokens](Zugang.md#api-tokens)). **Nur auf dev**, nie auf
prod: dort gibt es dieses Konto nicht, und das Skript zeigt ohne Angabe
auf dev.

Das Token kommt auf einem von **zwei Wegen** in die Sitzung (Schritt 3):

- **Weg A — Umgebungsvariable** `ATLAS_DEV_TOKEN`: das Skript setzt
  `Authorization: Bearer …` selbst. Geht überall, auch lokal; die Sitzung
  kann das Token aber lesen.
- **Weg B — Network secret** (seit 14.10.2026, T-106, so eingerichtet): der
  Proxy der Cloud-Umgebung hängt den Kopf an jede Anfrage an
  `dev.ttrpg.fuchsbau.io`. Die Sitzung sieht das Token nie, und der Host
  ist damit auch unter „Trusted" erreichbar. Das Skript braucht dann
  **kein** `ATLAS_DEV_TOKEN` und sendet ohne eigenen Kopf. Ein Kopf, den
  die Sitzung doch mitschickt, wird vom Proxy ersetzt — mit Weg B gilt
  immer das Secret.

### Einrichten (einmal, die Leitung)

**1. Das Konto auf dev anlegen** — als `deploy` auf dem Server:

```bash
cd /srv/atlas/dev
docker compose exec -e NW_PASSWORD="$(openssl rand -base64 24)" app \
  node apps/server/dist/user.js add werkbank --admin
```

Das Passwort ist zufällig und wird nirgends aufgeschrieben: das Konto
meldet sich nie über die Maske an, nur mit Token. **Warum `--admin`:** die
Leitung schreibt seit T-098 nur die Ebene ihrer Kampagne
([Zugang › Wer was darf](Zugang.md#wer-was-darf)); was in geteilten Ebenen
liegt (5e.tools) oder ohne Ebene ist, schreibt nur die Verwaltung. Soll die
Sitzung nur **prüfen** oder nur die Ebene der Kampagne ändern, reicht die
Leitungsrolle — dann ohne `--admin` anlegen und
`… user.js role werkbank <kampagnen-id> gm` setzen (in Schritt 2 ohne
`--write`, wenn sie nur prüft).

**2. Ein Token ausgeben** — es steht genau einmal da, also gleich kopieren.

In der Seite (seit T-112): auf dev **als das Konto, dem das Token gehören
soll**, in der Werkbank (oder unter Account) → *API tokens* → Name
(`claude-cloud`), Rechte *read and write*, Ablaufdatum → **Create token**.
Darunter stehen gleich die Werte für Schritt 3 (Host, Header, Präfix) und
ein Knopf, der `Bearer atm_…` kopiert. Ein Token gehört immer dem
angemeldeten Konto — für das Konto `werkbank`, das sich nie über die Maske
anmeldet, bleibt die Kommandozeile:

```bash
docker compose exec app node apps/server/dist/user.js token werkbank new claude-cloud --days 30 --write
```

Ausgabe: `Token tok_… (write, bis …)` und darunter `atm_…`. Ohne `--write`
darf es nur lesen (Prüfungen, Vorschauen). Höchstens 365 Tage; nach Ablauf
ein neues ausgeben und Schritt 3 wiederholen.

**3. Die Cloud-Umgebung einstellen** — in Claude Code (Web oder App): im
Titel der Sitzung das Menü der Cloud-Umgebung → **Edit**
([Anleitung](https://code.claude.com/docs/en/cloud-environments#network-access)):

| Einstellung | Wert |
| --- | --- |
| **Network access** | Stufe „Limited" (in älteren Apps „Custom") und unter **Allowed domains** `dev.ttrpg.fuchsbau.io` eintragen. Den Haken **Allow package managers** stehen lassen — sonst geht `pnpm install` nicht mehr. |
| **Network secret** (Weg B) | Host `dev.ttrpg.fuchsbau.io`, Header `Authorization`, Wert `Bearer atm_…` (das Token aus Schritt 2). Damit ist der Host auch ohne Eintrag unter „Allowed domains" erreichbar. |
| **Environment variables** (Weg A, statt B) | `ATLAS_DEV_TOKEN=atm_…` (das Token aus Schritt 2) |
| | `ATLAS_URL=https://dev.ttrpg.fuchsbau.io` (optional — das ist die Vorgabe des Skripts) |

Einer der beiden Wege reicht. Speichern. Eine **neue** Sitzung bekommt die
Einstellungen; eine laufende nicht. Das Token gehört in die Einstellungen der Umgebung und **nie** in
einen Chat, eine Datei im Repository oder eine Issue.

**4. Prüfen** — in einer neuen Sitzung:

```bash
node scripts/atlas.mjs me        # "name": "werkbank", "token": { "scope": "write", … }
node scripts/atlas.mjs checks    # die Zahlen je Prüfung
```

Ohne Skript, mit Weg B: `curl -s https://dev.ttrpg.fuchsbau.io/api/me` —
ohne eigenen Kopf, und die Antwort nennt das Konto. Am 14.10.2026 kam so
`werkbank` (Verwaltung) mit dem Token `claude-cloud` (`write`, bis
12.11.2026) zurück.

`403` beim Verbinden (`CONNECT tunnel failed`) heisst: die Domain ist in
Schritt 3 nicht freigegeben. `401` heisst mit Weg A: Token falsch,
abgelaufen oder widerrufen; mit Weg B: das Network secret fehlt, nennt
einen anderen Host, oder Header-Name (`Authorization`) oder Präfix
(`Bearer `) stimmen nicht — das Skript sagt, welcher Weg gemeint ist.
Läuft das Token ab, ein neues ausgeben (Schritt 2) und das Secret in den
Einstellungen ersetzen.

**Widerrufen**, wenn ein Token irgendwo liegt, wo es nicht hingehört —
das eigene in der Seite (*API tokens* → Revoke, die Liste nennt die letzte
Nutzung), das eines anderen Kontos von der Kommandozeile:

```bash
docker compose exec app node apps/server/dist/user.js token werkbank list
docker compose exec app node apps/server/dist/user.js token werkbank drop tok_…
```

Das Konto ganz sperren: `… user.js disable werkbank` — alle seine Tokens
gelten dann nicht mehr.

### Was das Skript kann

```bash
node scripts/atlas.mjs checks                          # Zahlen je Prüfung (unter 2 s über 21 000 Artikel)
node scripts/atlas.mjs checks duplicates --limit 20    # Treffer einer Prüfung
node scripts/atlas.mjs find Ogre --type Statblock      # Artikel suchen
node scripts/atlas.mjs get statblock-0042              # einen Artikel ganz (Peg-Id, Nummer oder Name)
node scripts/atlas.mjs bulk --dry-run auftrag.json     # Vorschau: Zahl, Beispiele, Ablehnungen
node scripts/atlas.mjs bulk auftrag.json               # schreiben — druckt die Id fürs Zurücknehmen
node scripts/atlas.mjs bulks                           # die letzten Massenänderungen
node scripts/atlas.mjs undo <id>                       # eine zurücknehmen
```

Eine **Massenänderung** steht in einer Datei, damit das Geschriebene genau
das Geprüfte ist. „Allen Statblöcken, deren Name auf Ogre endet, die
Kampfrolle Brute geben":

```json
{
  "select": { "types": ["Statblock"], "where": [{ "field": "name", "op": "endsWith", "value": "Ogre" }] },
  "ops": [{ "op": "set", "field": "Statblock.combatRole", "value": "Brute" }]
}
```

„Die gleichnamigen Merkmale Amphibious mit gleichem Text zusammenführen"
(einer bleibt, die anderen gehen, alles zeigt danach auf den bleibenden):

```json
{
  "select": { "types": ["Feature"], "where": [{ "field": "name", "op": "eq", "value": "Amphibious" }] },
  "ops": [{ "op": "merge", "mode": "delete", "by": "content" }]
}
```

Seit W1 vereint schon der Importer textgleiche Merkmale; auf dem heutigen
Bestand findet dieser Auftrag darum nichts (Vorschau: `0 geändert`) — von
64 „Amphibious" sind 6 geblieben, alle verschieden. Ähnliche führt man
gezielt zusammen: `checks duplicates` zeigt Gruppe und Ähnlichkeit, dann
`"select": { "ids": [ … ] }` und `"keep": "<die bleibt>"`.

| Teil | Was geht |
| --- | --- |
| `select.types` | Arten; ein Untertyp zählt mit (`Creature` trifft auch `PlayerCharacter`) |
| `select.layer` | eine Ebene (Peg-Id oder Nummer), über `inLayer` |
| `select.tag` | eine Marke |
| `select.ids` | Peg-Ids oder Nummern |
| `select.where` | `[{ field, op, value }]`, alle müssen gelten. `field`: `name`, `id` (Nummer), `type` oder `Karte.feld` (`Statblock.cr`). `op`: `eq`, `ne`, `contains`, `startsWith`, `endsWith`, `in` (Liste), `matches` (Regex), `empty`, `notEmpty` — gross/klein egal |
| `ops` | `set` / `unset` (`field`, `value`), `addTag` / `removeTag` (`tag`), `addRelation` (`type`, `to`, `props`), `removeRelation` (`type`, `to` optional), `merge` (`mode`: `variant` oder `delete`; `keep`: wer bleibt, sonst die kleinste Nummer; `by`: `name` oder `content`) — `merge` steht allein |
| `confirmDelete` | löscht ein Lauf mehr als einen Artikel, die Zahl aus der Vorschau (`--confirm-delete N`) |
| `skipRejected` | schreiben, was besteht, und die Abgelehnten liegen lassen (nie beim Löschen) |

Eine Auswahl ohne jede Bedingung lehnt der Server ab — sie träfe den ganzen
Bestand. Jeder geänderte Artikel geht durch `validateEntity`; besteht einer
nicht, wird **nichts** geschrieben. Wird die Kampfrolle eine Aufzählung,
lehnt die Prüfung ein Wort ausserhalb der Liste ab — die Vorschau sagt es.

**Rückgängig** setzt jede alte Fassung wieder hin und holt gelöschte
Artikel zurück. Hat jemand einen der Artikel seither anders geändert,
steht er als Konflikt da und es geschieht nichts; `undo <id> --force` lässt
die alte Fassung gewinnen.

**Was beim Neu-Einlesen passiert:** die Pipeline (oben, W8) schreibt jeden
Artikel der ersetzten Buchebene so, wie die Datei ihn bringt. Eine
Massenänderung an einem 5e.tools-Artikel — eine Kampfrolle, ein
zusammengeführtes Doppel — ist nach dem nächsten Lauf wieder weg (das
gelöschte Doppel steht wieder da). Was bleiben soll, gehört in den
Importer (Doppel: `packages/import-5etools/src/doppel.ts`) oder als
überschreibende Fassung in eine eigene Ebene.

## Ein Regelwerk eines Drittverlags laden

Für Bücher, die nicht aus 5e.tools kommen — das erste ist Kibbles’
Compendium of Craft and Creation (T-122). **Der Inhalt kommt nie ins
Repository**: das Repo ist öffentlich, das Buch gehört seinem Verlag.
Im Repo steht nur der Einleser (`scripts/regelwerk.mjs`, der rechnende
Teil in `scripts/regelwerk/plan.mjs`); das Paket mit dem Inhalt baut die
Leitung oder eine Sitzung aus dem eigenen Exemplar, **ausserhalb** des
Arbeitsbaums. Der Einleser verweigert eine Paketdatei im Repo.

```bash
node scripts/regelwerk.mjs ~/kibbles/paket.json --dry-run   # prüft gegen das Register von dev
node scripts/regelwerk.mjs ~/kibbles/paket.json             # schreibt nach dev
```

- **Das Paket** (`atlas-regelwerk/1`, Aufbau im Kopf von `plan.mjs`):
  die Ebene mit Kürzel, Autor, Erscheinen und Herausgeber-Gruppe, dazu
  die Artikel in der Sprache des Registers — Art, Name, Felder als
  `Typ.feld`, Kanten nach Schlüssel, nach Id oder beim Namen eines
  Artikels, den der Server schon kennt (ein Werkzeug aus dem
  Grundregelwerk; mehrdeutig oder fehlend wird gemeldet, nicht geraten).
- **Rezepte bekommen ihre Blaupause:** eine Information ohne Felder über
  `knowledge` — die lernt man (Datenmodell 9.5). `learnable: false`
  lässt sie weg.
- **Die Ebene** legt der Lauf über `POST /api/layers` an (das Konto
  besitzt sie), Art `book`, Spezifität 20; fehlt die Herausgeber-Gruppe,
  legt er sie an. **Aufgeschaltet wird nichts** — das tut die Leitung in
  der Kampagne. Artikel stehen auf `ready`, wenn das Paket nichts sagt.
- **Die Zustandsdatei** (`<paket>.state.json`, neben dem Paket) hält je
  Schlüssel die Server-Id und Revision. Sie ist das Gedächtnis des Laufs:
  was keine Kampagne aufschaltet, liest auch die Verwaltung nicht über die
  API (`inPlay`). Mit ihr legt ein zweiter Lauf nichts doppelt an und
  schreibt nur, was sich im Paket geändert hat; ein Artikel, den jemand
  am Server geändert hat, wird übersprungen und gemeldet. Geht sie
  verloren, legt der nächste Lauf alles neu an — dann vorher die alte
  Ebene löschen. Daneben liegt ein **Journal** (`….state.json.journal`):
  je angelegtem Artikel eine Zeile, sofort geschrieben, damit ein
  Abbruch mitten im Lauf nichts doppelt anlegen lässt.
- **Rollt dev während des Laufs aus**, antwortet der Proxy kurz mit
  502/503; der Lauf wartet und versucht es wieder (bis acht Mal, mit
  wachsender Pause). Andere Fehler, auch 504, halten ihn an — dann den
  Lauf einfach erneut starten.
- **Nur dev.** Die Ausgabe nennt Schlüssel, Arten und Zahlen, nie Text
  aus dem Paket, und darf ins Protokoll (`docs/Nachtarbeit/…`).

## Den Bestand von prod nach dev holen

Seit T-130 geht das auch in der Oberfläche, ohne Shell: Werkbank ›
Transfer › „Overwrite dev from prod" ([Überklonen](#überklonen-prod--dev-alles)).
Von Hand geht es weiter so:

**Ohne Konten** (REQ-199): ein `pg_dump` der ganzen Produktion trägt
`app_user`, Sitzungen und Rollen mit, und die gehören nicht nach dev. Also
nur die Artikel und das Register:

```bash
T="-t entity -t component -t relation -t interface_def -t relation_def -t view_def -t unit_def -t var_def"
cd /srv/atlas/prod
docker compose exec -T db sh -c "pg_dump -U \"\$POSTGRES_USER\" -Fc --data-only $T \"\$POSTGRES_DB\"" > /tmp/bestand.dump
cd /srv/atlas/dev
docker compose stop app
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "truncate entity, component, relation, interface_def, relation_def, view_def, unit_def, var_def"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --data-only --disable-triggers' < /tmp/bestand.dump
docker compose start app
rm /tmp/bestand.dump
```

Die Konten auf dev bleiben dabei, wie sie sind.

**Die Bilder** kommen nicht mit dem Dump — es sind Dateien. Ohne sie zeigt
dev an jedem Bild der Produktion eine Lücke; mit ihnen (nur dazu, nichts
überschrieben):

```bash
cp -R -n /srv/atlas/prod/daten/bilder/. /srv/atlas/dev/daten/bilder/
```

## Übernahme dev ↔ prod

Auf dev vorprüfen, auf prod nachziehen (T-130): in der **Werkbank ›
Transfer** auf dev wählt die Verwaltung Artikel aus — einzeln, nach Art,
eine Ebene samt Inhalt, nach Marke oder Feldbedingung, dazu Registerzeilen
— und sieht vor dem Schreiben, was neu ist, was sich ändert (je Feld) und
wo **beide Seiten** seit der letzten Übernahme etwas geändert haben
(Konflikt, nebeneinander wie in git). Geschrieben wird erst auf Knopfdruck,
genau das, was die Vorschau zeigte. Dieselbe Seite holt von prod nach dev
und **überklont** dev ganz. Die Regeln: [Datenmodell §12.2](Datenmodell.md#122-übernahme-zwischen-installationen-t-130-req-155).

### Einrichten (einmal, die Verwaltung)

Die Verbindung ist eine **Server-Einstellung** in `.env` — nie im Browser,
nie im Repository.

1. **Auf prod** ein Konto der Verwaltung anmelden, Seite „Account" › API
   tokens: ein Token **`write`** anlegen, Name z. B. `dev-uebernahme`
   (mit `read` gehen Vorschau, Holen und Überklonen, aber kein Schieben).
2. **Auf prod** in `/srv/atlas/prod/.env`:

   ```
   ATLAS_TRANSFER_ACCEPT=1
   ```

   Ohne diese Zeile liefert prod nur aus und nimmt nichts an
   (403 „nimmt keine Übernahmen an"). Wer gerade nicht übernimmt, nimmt sie
   wieder heraus (E-042).
3. **Auf dev** in `/srv/atlas/dev/.env`:

   ```
   ATLAS_PEER_URL=https://atlas.<domain>
   ATLAS_PEER_TOKEN=atm_…        # das Token aus Schritt 1
   ```

4. Beide neu starten, damit die Einstellung gilt:
   `./deploy.sh "$(sed -n 's/^IMAGE=//p' .env)"` (im jeweiligen Verzeichnis).
   `deploy.sh` legt dabei `backups/uebernahme/` an; dorthin schreibt der
   Server vor jedem Schreiben seine Sicherung (`ATLAS_BACKUP_DIR`,
   im Container `/data/backups`).

Ob es steht, zeigt die Werkbank auf dev (Kasten „Transfer": Gegenstelle,
Umgebung, „accepts transfers"), oder lesend:
`curl -s -H "Authorization: Bearer $ATLAS_DEV_TOKEN" https://dev…/api/transfer`.
Auf prod löst niemand aus — dort antwortet die Seite mit „prod ist die
Gegenstelle".

### Die erste Übernahme, gefahrlos

1. **Holen statt schieben:** auf dev „prod → dev", Auswahl ein einzelner
   Artikel (seine Nummer). Die Vorschau zeigt „unchanged", wenn dev aus
   prod geholt wurde — oder einen Konflikt je Feld, weil es noch keine
   Basis gibt. Nichts ist geschrieben.
2. **Einen neuen Probeartikel** auf dev anlegen (z. B. eine Regel
   „Transfer test" in der Kampagnenebene), „dev → prod", Vorschau: „new".
   „Transfer" schreibt ihn nach prod; die Liste darunter zeigt den Lauf.
3. **Rückgängig** am Lauf: der Artikel ist auf prod wieder weg, auf dev
   steht er wie vorher. Damit ist der ganze Weg einmal gegangen.

### Was eine Übernahme tut

| Schritt | Schieben (dev → prod) | Holen (prod → dev) |
| --- | --- | --- |
| Auswahl | auf dev | auf prod |
| Vorschau | neu · geändert · unverändert · Konflikt · nur auf prod geändert — je Feld und Kante, gruppiert nach Ebene, Art und Artikel | dasselbe, Quelle prod |
| Konflikt lösen | dev nehmen · prod behalten · von Hand | prod nehmen · dev behalten · von Hand |
| Nummern | prod vergibt; dev zieht nach, Verweise mit | dev weicht, wo prod dieselbe Nummer hat |
| Sicherung | prod: `backups/uebernahme/<zeit>-vor-uebernahme-von-dev.json` | dev: `…-vor-uebernahme-von-<prod>.json` |
| Protokoll | dev: `transfer`, prod: `transfer.in` (wer, wann, was, jede alte Fassung) | dev: `transfer` |
| Rückgängig | am Lauf: erst prod, dann dev | am Lauf |

**Nicht mit:** Konten, Rollen am Tisch, Figuren eines Kontos, wer was
angelegt hat, wer in welcher Ebene schreibt, Tokens (REQ-199). Gelöschtes
wird nicht übertragen: was auf dev gelöscht ist, bleibt auf prod stehen
und umgekehrt.

**Abhängigkeiten** (Häkchen „with dependencies"): Statblock, Instanz,
Inventar und Inhalt, Kapitelteile und die Vorlage ganz; Kantenziele und
Verweise (auch Bilder) einen Schritt. Was dabei mitkommt, steht in der
Vorschau und lässt sich abwählen; fehlt auf prod ein Kantenziel, lehnt die
Prüfung ab und nennt es.

### Überklonen (prod → dev, alles)

Bestückt dev **ganz** aus prod neu: Register, alle Artikel, die Bilder.
Was nur auf dev stand, ist danach weg; die Konten von dev bleiben. Vorher
schreibt dev seinen ganzen Bestand nach
`backups/uebernahme/<zeit>-vor-ueberklonen.json` — ohne
Sicherungsverzeichnis wird nicht überklont. In der Oberfläche erst „Dry
run" (zählt), dann `OVERWRITE` eintippen. Es ersetzt den Weg
[Den Bestand von prod nach dev holen](#den-bestand-von-prod-nach-dev-holen)
von Hand, der weiter geht.

### Zurück

- **Eine Übernahme:** Werkbank › Transfer › Lauf › „Undo". Hat seither
  jemand einen der Artikel geändert, sagt es das (409); „force" lässt die
  alte Fassung gewinnen.
- **Von Hand** aus der Sicherung (die Artikel, wie sie vorher standen):

  ```bash
  cd /srv/atlas/prod     # oder dev
  docker compose exec app node apps/server/dist/import.js /data/backups/<zeit>-vor-uebernahme-von-dev.json --dry-run
  docker compose exec app node apps/server/dist/import.js /data/backups/<zeit>-vor-uebernahme-von-dev.json
  ```

  Neu angelegte Artikel stehen nicht darin (es gab sie vorher nicht); die
  nimmt „Undo" weg oder die Massenänderung.
- **Überklonen zurück:** dieselbe Einfuhr mit `--replace` auf die Datei
  `…-vor-ueberklonen.json` — sie enthält Register und alle Artikel.

`backups/uebernahme/` wird nicht von selbst geleert; die Dateien sind
klein, ausser denen vom Überklonen.

## Wie schnell antwortet die Seite?

Gemessen wird am Server, bei jeder Antwort (T-086, REQ-246). Das Ziel:
ein Seitenwechsel unter einer Sekunde, der erste Aufruf nach einem
Neustart unter drei, und kein Einfrieren im Browser über 200 ms.

**Wo man es sieht:**

- **Im Browser:** jede Antwort trägt `Server-Timing: app;dur=<ms>` — in
  den Entwicklerwerkzeugen unter Network › eine Anfrage › Timing, als
  „Server Timing". Steht dort wenig und die Anfrage dauert trotzdem, liegt
  es am Netz oder am Browser, nicht am Server.
- **Auf dem Server:** je Anfrage an `/api/` eine Logzeile `dauer` mit
  `route` und `ms`; die langsamen findet man so:

  ```bash
  cd /srv/atlas/dev && docker compose logs --since 1h app | grep '"msg":"dauer"' \
    | grep -o '"route":"[^"]*","ms":[0-9]*' | awk -F'"ms":' '$2 > 500'
  ```

- **Nach einem Neustart** sagt die Zeile `Bestand gelesen`, wie lange das
  Vorlesen des ganzen Bestands dauerte (`artikel`, `ms`).

**Was die Seite tut, wenn es dauert:** oben unter der Kopfleiste steht
ein Banner, eine Stelle für alle Seiten, gespeist aus jeder Anfrage über
`kern/api.ts`:

- läuft eine Anfrage länger als 300 ms: „Loading … (registry / articles /
  list)" — was gerade geladen wird; es verschwindet von selbst;
- startet der Server gerade und liest seinen Bestand vor, antwortet er auf
  `/api/` mit **503** und der Zahl (`starting.articles`, `Retry-After: 1`),
  statt die Anfrage hängen zu lassen; das Banner sagt „Server is starting,
  reading N articles …", und die Seite fragt jede Sekunde nach. Anmelden
  und `/api/health` gehen schon vorher;
- kommt eine Leseanfrage nicht durch (Netz weg, 5xx): „Could not load … —
  Retry"; „Retry" schickt sie noch einmal, und die Seite bekommt die
  Antwort, als wäre nichts gewesen. Schreiben wird nie von selbst
  wiederholt;
- liefert der Server nach einem Deploy eine andere Oberfläche aus
  (`X-Atlas-Build`, ein Hash ihrer `index.html`): „New version available"
  mit „Reload" — die Seite lädt nicht still neu, damit niemand eine
  Eingabe verliert.

**Was am 13.10. eingefroren war:** mit dem ganzen 5e.tools-Bestand und
einer Kampagne, die ihre Bücher aufschaltet, suchte `inPlay` je Artikel
im ganzen Bestand nach Überschreibungen — jeder gegen jeden. Die Zählung
des Registers (`/api/registry/usage`) brauchte so bei jedem Öffnen rund
40 s, die erste Liste nach jeder Änderung am Bestand ebenso. Jetzt rechnet
`playStack` den Stapel einmal je Anfrage, und die Zählung wird je
Bestandsstand behalten. Ein Test (`apps/server/test/tempo.test.ts`) hält
die Liste über 20 000 Artikel unter einer Grenze.

**Selbst nachmessen** — lokal mit dem vollen Bestand (die Datei nie
einchecken): Postgres starten, Konto anlegen, die Datei aus
[5e.tools laden › Von Hand](#von-hand-notlösung) mit
`pnpm --filter @nw/server run import <datei> --only-new` einlesen, eine
Kampagne anlegen und ihre Bücher aufschalten, dann die Routen der Wege
Register, Kompendium, Artikel und Board je zweimal abrufen (kalt nach
einem Neustart, dann warm) und `Server-Timing` lesen.

## Der Live-Kanal hinter Caddy

`GET /api/live` (T-116) ist ein Strom aus Server-Sent Events, der offen
bleibt — Beamer, Laptop und Telefone hören darauf, was sich ändert
(was der Kanal trägt: [Architektur.md › Der Live-Kanal](Architektur.md#52-der-live-kanal)).
Damit er durchkommt, sagt `deploy/proxy/Caddyfile` (Schnipsel `atlas`, für
prod und dev gleich):

- **nicht packen**: `encode` gilt für alles ausser `/api/live` — ein
  Packer sammelt, bevor er schickt, und dann käme eine Änderung erst mit
  der nächsten;
- **sofort durchreichen**: `reverse_proxy … { flush_interval -1 }`;
- **kein Zeitlimit nötig**: Caddy setzt für Antworten keines. Die
  Anwendung schickt alle 25 s ein Lebenszeichen (`: ping`), damit kein
  Mobilfunknetz die stille Verbindung kappt, und schliesst nach 15 min
  selbst; der Browser kommt nach 3 s wieder und holt mit `Last-Event-ID`
  nach, was er verpasst hat.

Die Anwendung schickt dazu `Cache-Control: no-cache, no-transform` und
`X-Accel-Buffering: no` — falls je ein nginx davorsteht, puffert auch der
nicht. **Auf dem Server ist nichts von Hand zu ändern**: CI legt das
Caddyfile bei jedem Ausrollen hin und lädt Caddy neu.

Prüfen, ob der Strom durchkommt (angemeldet, Keks aus dem Browser):

```bash
curl -N -H 'Cookie: nw_session=…' https://dev.atlas.<domain>/api/live
# → retry: 3000, dann „event: hello", alle 25 s „: ping"
```

Steht der Punkt rechts in der Kopfleiste hohl, hört dieses Gerät gerade
nicht mit (es verbindet neu). Heute läuft **ein** Serverprozess je
Umgebung — die Quelle des Kanals ist sein Speicher. Mehrere Prozesse
hinter Caddy bräuchten zuerst die Umsetzung über Postgres
`LISTEN/NOTIFY` (Architektur.md, 5.2).

## Lokal durchspielen

Alles oben lief einmal ausserhalb von Hetzner durch (2026-10-01): Abbild
gebaut, in eine lokale Registry geschoben, `deploy.sh` zweimal (Sicherung,
`previous-image`), ein Konto im Container angelegt, angemeldet mit
`X-Forwarded-Proto: https` über die Docker-Brücke (Cookie `Secure`, Adresse
des Gastes statt der Brücke), zurückgerollt mit Wiederherstellung, und der
Bestand von einer Umgebung in die andere geholt, ohne ihre Konten.

## Was noch fehlt

- **Überwachung.** Ob die Seite antwortet, sagt heute niemand von selbst;
  ein externer Prüfer auf `/api/health` wäre der kleinste Schritt.
- **Alte Abbilder in GHCR** bleiben liegen. Bei einem Abbild je Push
  wächst das; aufräumen, wenn es stört.
- **Die Kopie der Sicherung nach aussen** (Storage Box) steht hier nur als
  Rezept; die nächtliche Sicherung selbst richtet `bootstrap.sh` ein — für
  die Datenbank und die Bilder.

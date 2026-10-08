# Betrieb — Hetzner, zwei Umgebungen

Ein Server, zwei Umgebungen, beide aus CI ausgerollt:

| Zweig | Umgebung | Adresse | Port auf dem Server | Verzeichnis |
| --- | --- | --- | --- | --- |
| `preprod` | `dev` | `dev.atlas.<domain>` | `127.0.0.1:8081` | `/srv/atlas/dev` |
| `main` | `prod` | `atlas.<domain>` | `127.0.0.1:8080` | `/srv/atlas/prod` |

Jede Umgebung hat ihre eigene Datenbank, ihr eigenes Volume und ihre eigenen
Konten. Davor steht Caddy als Container (`deploy/proxy/`, Host-Netz) und
macht TLS; auch er kommt aus dem Repository.

> **Schalter:** der Job `deploy` läuft nur, wenn die Repo-Variable
> `DEPLOY_ENABLED` auf `true` steht (Settings › Secrets and variables ›
> Actions › Variables). Ohne ihn bleibt ein Push grün, auch wenn die
> Umgebungen noch keine Secrets haben.

## Was bei einem Push passiert

```
push preprod ─┬─ check      lint, test, build (wie bisher)
              ├─ postgres   Durchstich gegen eine frische Postgres 17
              └─ image      Abbild bauen, nach GHCR: :preprod und :preprod-<sha>
                   └─ deploy   Environment „dev": SSH → deploy.sh :preprod-<sha>
```

`main` läuft genauso und rollt nach `prod` aus. Weil `main` nur aus `preprod`
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
3. das laufende Abbild als `previous-image` merken;
4. `IMAGE=` in `.env` setzen und `docker compose up -d` — die Migrationen
   laufen beim Start;
5. warten, bis `/api/health` antwortet, sonst die letzten Logzeilen zeigen
   und mit Fehler enden.

## Den Server einrichten — Schritt für Schritt (einmal)

Alles, was auf dem Server liegt, kommt aus diesem Repository: die
Compose-Dateien der beiden Umgebungen, `deploy/deploy.sh`, und der Reverse
Proxy aus `deploy/proxy/` (Caddy als Container, Host-Netz, holt seine
Zertifikate selbst). Von Hand wird einmal die Maschine vorbereitet
(`deploy/bootstrap.sh`), danach rollt jeder Push aus.

### 1. Maschine bei Hetzner

- **Hetzner Cloud** → Server anlegen: Ubuntu 24.04, Typ **CPX22**
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
absichtlich aus. `DEPLOY_DIR` und `PROXY_DIR` überschreiben die
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

## Zurück

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

## Den Bestand von prod nach dev holen

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
  Rezept; die nächtliche Sicherung selbst richtet `bootstrap.sh` ein.

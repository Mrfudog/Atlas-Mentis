# Betrieb — Hetzner, zwei Umgebungen

Ein Server, zwei Umgebungen, beide aus CI ausgerollt:

| Zweig | Umgebung | Adresse | Port auf dem Server | Verzeichnis |
| --- | --- | --- | --- | --- |
| `preprod` | `dev` | `dev.atlas.<domain>` | `127.0.0.1:8081` | `/srv/atlas/dev` |
| `main` | `prod` | `atlas.<domain>` | `127.0.0.1:8080` | `/srv/atlas/prod` |

Jede Umgebung hat ihre eigene Datenbank, ihr eigenes Volume und ihre eigenen
Konten. Davor steht Caddy und macht TLS.

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

## Den Server einrichten (einmal)

### Maschine

- **Hetzner Cloud**, eine kleine x86-Instanz mit 2 vCPU und 4 GB RAM reicht
  für beide Umgebungen; gebaut wird nicht hier. Standort nach Wahl
  (Falkenstein, Nürnberg, Helsinki).
- Ubuntu 24.04, beim Anlegen den eigenen SSH-Schlüssel hinterlegen.
- **Cloud Firewall:** eingehend 80 und 443 für alle, 22 für alle. Port 22
  muss offen sein, weil GitHubs Läufer von wechselnden Adressen kommen;
  dafür gibt es keine Passwortanmeldung (unten).
- Optional die Hetzner-Sicherung der ganzen Maschine einschalten — sie
  ersetzt die Datenbanksicherung nicht, macht aber eine kaputte Maschine zu
  einem Klick.

### System

```bash
# als root
apt update && apt -y upgrade
apt -y install unattended-upgrades
# Docker aus dem Docker-Repository (docs.docker.com/engine/install/ubuntu)
# Caddy aus dem Caddy-Repository (caddyserver.com/docs/install#debian-ubuntu-raspbian)

# Keine Passwortanmeldung, kein root über SSH
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/;
        s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl reload ssh

# Der Benutzer, mit dem CI ausrollt
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -o deploy -g deploy /srv/atlas /srv/atlas/prod /srv/atlas/dev
```

Wer in der Gruppe `docker` ist, ist auf dieser Maschine faktisch root. Das
ist hier hingenommen — ein Schlüssel nur für CI, nur für diesen Benutzer,
und auf der Maschine läuft sonst nichts.

### Schlüssel für CI

Ein eigener Schlüssel, nur für das Ausrollen, auf der eigenen Maschine
erzeugt:

```bash
ssh-keygen -t ed25519 -N "" -C "atlas-deploy" -f atlas-deploy
# atlas-deploy.pub → /home/deploy/.ssh/authorized_keys auf dem Server
# atlas-deploy     → GitHub-Secret DEPLOY_SSH_KEY (danach lokal löschen)
ssh-keyscan -t ed25519 <server-ip>   # → DEPLOY_KNOWN_HOSTS
```

Den Fingerabdruck aus `ssh-keyscan` einmal mit dem vergleichen, den die
Maschine selbst nennt (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`
in der Hetzner-Konsole). Ein fester Hostschlüssel ist der Grund, warum CI
`StrictHostKeyChecking yes` fährt: sonst rollte es auf die erste Maschine
aus, die sich unter der Adresse meldet.

### Je Umgebung

```bash
# als deploy, in /srv/atlas/prod und /srv/atlas/dev
umask 077
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" > .env
```

`compose.yml` und `deploy.sh` legt CI beim ersten Lauf selbst hin. Das
Passwort hat **keinen Vorgabewert** mehr: fehlt es, bricht Compose ab,
statt still mit `nebelwacht` zu starten.

### DNS und Caddy

- A- (und AAAA-)Einträge für `atlas.<domain>` und `dev.atlas.<domain>` auf
  die Maschine.
- [`deploy/Caddyfile.example`](../deploy/Caddyfile.example) nach
  `/etc/caddy/Caddyfile`, die Namen anpassen, `systemctl reload caddy`.
  Caddy holt die Zertifikate selbst.

Der Server im Container vertraut `X-Forwarded-*` nur von `loopback` und
den privaten Netzen (`TRUST_PROXY: loopback,uniquelocal` in Compose) — von
dort kommt Caddy über die Docker-Brücke. Ohne das bekäme das
Sitzungs-Cookie nie `Secure`, und die Anmeldebremse zählte die Fehlversuche
aller Gäste der einen Adresse des Proxys zu: acht Fehlversuche irgendwo, und
niemand käme mehr hinein. Nach aussen veröffentlicht ist nur
`127.0.0.1:<port>`; `HOST=0.0.0.0` gilt **nur im Container**.

### GitHub

Unter *Settings → Environments* zwei Umgebungen anlegen:

| Environment | Deployment branches | Secrets | Variables |
| --- | --- | --- | --- |
| `dev` | nur `preprod` | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` | `PUBLIC_URL` (`https://dev.atlas.<domain>`) |
| `prod` | nur `main` | dieselben vier | `PUBLIC_URL` (`https://atlas.<domain>`) |

**Die Zweigregel ist der Schutz**, nicht der Workflow: ohne sie könnte ein
Lauf von einem anderen Zweig die Geheimnisse von `prod` lesen. Wer vor dem
Ausrollen nach `prod` noch einmal bestätigen will, setzt dort *Required
reviewers*. `DEPLOY_DIR` als Variable überschreibt das Verzeichnis, wenn es
nicht `/srv/atlas/<env>` sein soll.

Das Abbild liegt unter `ghcr.io/<owner>/atlas-mentis` und ist privat. Der
Server meldet sich dafür nicht dauerhaft an: CI reicht seinen eigenen,
kurzlebigen `GITHUB_TOKEN` über stdin weiter (nicht über die Befehlszeile —
die stünde in der Prozessliste), `deploy.sh` meldet sich an, holt und meldet
sich wieder ab.

## Das erste Konto

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

```cron
# mkdir -p /srv/atlas/prod/backups/nacht; dann crontab -e als deploy:
# jede Nacht, eine je Wochentag
17 3 * * * cd /srv/atlas/prod && docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > backups/nacht/$(date +\%u).dump
```

Eigenes Verzeichnis, weil `deploy.sh` in `backups/` nur die letzten 20
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
- **Die nächtliche Sicherung** und die Kopie nach aussen stehen hier nur
  als Rezept, nicht als Datei im Repository.

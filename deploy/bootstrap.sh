#!/bin/sh
# Den Server einmal einrichten — als root auf einer frischen Ubuntu-24.04-
# Maschine bei Hetzner. Danach rollt CI aus; von Hand wird hier nichts mehr
# gebaut. Was das Skript tut, steht in docs/Betrieb.md Schritt für Schritt.
#
#   curl -fsSL https://raw.githubusercontent.com/Mrfudog/atlas-mentis/main/deploy/bootstrap.sh -o bootstrap.sh
#   sh bootstrap.sh atlas.example.ch dev.atlas.example.ch mail@example.ch "ssh-ed25519 AAAA… atlas-deploy"
#
# Argumente: Produktionsname, Testname, Mailadresse für Let's Encrypt, der
# öffentliche Schlüssel, mit dem CI ausrollt (docs/Betrieb.md, Schritt 4).
set -eu

PROD_HOST="${1:?Produktionsname fehlt, z. B. atlas.example.ch}"
DEV_HOST="${2:?Testname fehlt, z. B. dev.atlas.example.ch}"
ACME_EMAIL="${3:?Mailadresse für Let's Encrypt fehlt}"
DEPLOY_PUBKEY="${4:?öffentlicher Schlüssel für den Benutzer deploy fehlt}"
BASE="${ATLAS_BASE:-/srv/atlas}"

[ "$(id -u)" -eq 0 ] || { echo "als root ausführen" >&2; exit 1; }

echo "== System"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q upgrade
apt-get -y -q install ca-certificates curl unattended-upgrades openssl

echo "== Docker (aus dem Docker-Repository)"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get -y -q install docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
systemctl enable --now docker >/dev/null

echo "== SSH: keine Passwörter, kein root"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl reload ssh 2>/dev/null || systemctl reload sshd

echo "== Benutzer deploy"
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
grep -qF "$DEPLOY_PUBKEY" /home/deploy/.ssh/authorized_keys || echo "$DEPLOY_PUBKEY" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "== Verzeichnisse und Geheimnisse"
install -d -o deploy -g deploy "$BASE" "$BASE/prod" "$BASE/dev" "$BASE/proxy"
for env in prod dev; do
  f="$BASE/$env/.env"
  if [ ! -f "$f" ]; then
    # Ein Passwort je Umgebung, nie im Repository, nie auf der Befehlszeile.
    printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > "$f"
    chown deploy:deploy "$f"; chmod 600 "$f"
    echo "   $f geschrieben"
  else
    echo "   $f gibt es schon — unverändert"
  fi
done
f="$BASE/proxy/.env"
printf 'PROD_HOST=%s\nDEV_HOST=%s\nACME_EMAIL=%s\n' "$PROD_HOST" "$DEV_HOST" "$ACME_EMAIL" > "$f"
chown deploy:deploy "$f"; chmod 600 "$f"
install -d -o deploy -g deploy "$BASE/prod/backups/nacht"

echo "== Nächtliche Sicherung (als deploy, 03:17, eine je Wochentag)"
cron='17 3 * * * cd '"$BASE"'/prod && [ -f compose.yml ] && docker compose exec -T db sh -c '"'"'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"'"'"' > backups/nacht/$(date +\%u).dump'
( crontab -u deploy -l 2>/dev/null | grep -v 'backups/nacht' ; echo "$cron" ) | crontab -u deploy -

echo
echo "== Fertig. Das gehört jetzt nach GitHub (Settings › Secrets and variables › Actions):"
echo "   DEPLOY_HOST        = $(curl -fsS -4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo "   DEPLOY_USER        = deploy"
echo "   DEPLOY_SSH_KEY     = der private Schlüssel zu dem öffentlichen oben"
echo "   DEPLOY_KNOWN_HOSTS = die folgende Zeile:"
echo "   $(hostname -I | awk '{print $1}') $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
echo "   Variable DEPLOY_ENABLED = true"
echo
echo "Der Reverse Proxy kommt beim ersten Ausrollen aus CI (deploy/proxy)."
echo "DNS: $PROD_HOST und $DEV_HOST müssen auf diese Maschine zeigen."

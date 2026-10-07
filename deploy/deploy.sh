#!/bin/sh
# Eine Umgebung auf ein neues Abbild heben. Läuft auf dem Server, im
# Verzeichnis der Umgebung (/srv/atlas/prod oder /srv/atlas/dev), und wird
# von CI über SSH aufgerufen — von Hand geht es genauso:
#
#   ./deploy.sh ghcr.io/mrfudog/nebelwacht:main-<sha>
#   ./deploy.sh "$(cat previous-image)"        # zurück aufs vorige
#
# Vor dem Wechsel wird die Datenbank gesichert. Migrationen laufen nur
# vorwärts: wer nach einer Migration aufs vorige Abbild zurückgeht, spielt
# auch die Sicherung von davor zurück (docs/Betrieb.md, „Zurück").
set -eu
cd "$(dirname "$0")"

IMAGE="${1:?Abbild fehlt, z. B. ghcr.io/mrfudog/nebelwacht:main-abc1234}"
KEEP="${KEEP_BACKUPS:-20}"
[ -f .env ] || { echo ".env fehlt — siehe docs/Betrieb.md" >&2; exit 1; }
[ -f compose.yml ] || { echo "compose.yml fehlt" >&2; exit 1; }

# Ein kurzlebiger Zugang aus CI, wenn das Paket privat ist. Er gilt nur so
# lange wie der Lauf, der ihn mitbringt; auf dem Server bleibt nichts liegen.
if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-ci}" --password-stdin >/dev/null
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
fi

# Erst holen, dann sichern, dann wechseln: schlägt das Holen fehl, läuft das
# alte Abbild unberührt weiter.
IMAGE="$IMAGE" docker compose pull app

mkdir -p backups
if [ -n "$(docker compose ps -q db 2>/dev/null)" ]; then
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' \
    > "backups/$stamp.dump"
  echo "Gesichert: backups/$stamp.dump"
  # Die ältesten gehen, die letzten $KEEP bleiben.
  ls -1t backups/*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm --
fi

# Das laufende Abbild merken, damit „zurück" ein Befehl ist und keine Suche.
current="$(sed -n 's/^IMAGE=//p' .env | tail -n 1)"
[ -n "$current" ] && [ "$current" != "$IMAGE" ] && echo "$current" > previous-image

# IMAGE steht in .env, damit ein späteres `docker compose up` von Hand
# dasselbe Abbild startet und nicht still ein lokal gebautes.
grep -v '^IMAGE=' .env > .env.neu || true
echo "IMAGE=$IMAGE" >> .env.neu
mv .env.neu .env
chmod 600 .env

docker compose up -d --no-build --remove-orphans

# Gesund heisst: /api/health antwortet aus dem Container. Migrationen laufen
# beim Start, also kann das einen Moment dauern.
i=0
until docker compose exec -T app wget -qO- http://127.0.0.1:8080/api/health >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 45 ]; then
    echo "Nicht gesund nach 90 s — letzte Zeilen:" >&2
    docker compose logs --tail 80 app >&2
    exit 1
  fi
  sleep 2
done
echo "Läuft: $IMAGE"
docker image prune -f >/dev/null

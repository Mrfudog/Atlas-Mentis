#!/bin/sh
# Eine Ausfuhrdatei in die laufende Umgebung einlesen. Läuft auf dem Server,
# im Verzeichnis der Umgebung (/srv/atlas/prod oder /srv/atlas/dev), und
# wird von der Pipeline „5e.tools einlesen" über SSH aufgerufen
# (.github/workflows/import-5etools.yml) — von Hand geht es genauso:
#
#   ./import.sh 5etools-2014.json.gz --only-new                 # nur ergänzen (Vorgabe, D71)
#   ./import.sh 5etools-2014.json.gz --only-new --dry-run       # nur sagen, was geschähe
#   ./import.sh 5etools-2014.json.gz --only-new --new-layers    # nur neue Ebenen (T-087)
#   ./import.sh 5etools-2014.json.gz --replace-layer            # die Ebene der Datei ersetzen
#   ./import.sh 5etools-2014.json.gz --layers                   # nur Ebenen ergänzen (T-088)
#   ./import.sh 5etools-2014.json.gz                            # dazulegen und überschreiben
#
# Alles nach der Datei geht unverändert an apps/server/dist/import.js.
# Vor dem Einlesen wird die Datenbank gesichert (nicht bei --dry-run), wie
# vor jedem Ausrollen; die Datei wird danach gelöscht, auch im Container —
# die Daten von 5e.tools gehören nicht auf die Platte (docs/Betrieb.md).
set -eu
cd "$(dirname "$0")"

DATEI="${1:?Datei fehlt, z. B. 5etools-2014.json.gz}"
shift
[ -f "$DATEI" ] || { echo "$DATEI gibt es nicht" >&2; exit 1; }
[ -f compose.yml ] || { echo "compose.yml fehlt — zuerst ausrollen (deploy.sh)" >&2; exit 1; }
[ -n "$(docker compose ps -q app 2>/dev/null)" ] || { echo "Die Anwendung läuft nicht — zuerst ausrollen" >&2; exit 1; }

# Ein älteres Abbild kennt neuere Schalter nicht und übersähe sie still:
# aus einem Probelauf würde ein Lauf, der schreibt, und aus „nur ergänzen"
# einer, der überschreibt.
for a in "$@"; do
  case "$a" in
    --replace-layer*|--dry-run|--only-new|--new-layers|--layers)
      docker compose exec -T app grep -q -- "${a%%=*}" apps/server/dist/import.js \
        || { echo "Das laufende Abbild kennt $a noch nicht — zuerst ausrollen" >&2; exit 1; } ;;
  esac
done

IM_CONTAINER=/tmp/atlas-import.json
JSON="$DATEI"
aufraeumen() {
  # Als root: `docker compose cp` legt die Datei als root ab, und in /tmp
  # darf `node` fremde Dateien nicht löschen.
  docker compose exec -T -u root app rm -f "$IM_CONTAINER" >/dev/null 2>&1 || true
  rm -f "$DATEI"
  [ "$JSON" = "$DATEI" ] || rm -f "$JSON"
}
trap aufraeumen EXIT

case "$DATEI" in
  *.gz) JSON="${DATEI%.gz}"; gunzip -c "$DATEI" > "$JSON" ;;
esac

probe=false
for a in "$@"; do [ "$a" = "--dry-run" ] && probe=true; done

# Eine Sicherung vor jedem Lauf, der schreibt: sie ist der einzige Ort, an
# dem der alte Bestand danach noch steht. Dasselbe Verzeichnis wie deploy.sh,
# dieselbe Aufbewahrung (die letzten KEEP_BACKUPS).
if [ "$probe" = false ]; then
  mkdir -p backups
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' \
    > "backups/$stamp-vor-import.dump"
  echo "Gesichert: backups/$stamp-vor-import.dump"
  ls -1t backups/*.dump 2>/dev/null | tail -n +"$((${KEEP_BACKUPS:-20} + 1))" | xargs -r rm --
fi

docker compose cp "$JSON" "app:$IM_CONTAINER"
# 24 000 Artikel brauchen beim Prüfen etwa 400 MB — Nodes Vorgabe reicht.
docker compose exec -T app node apps/server/dist/import.js "$IM_CONTAINER" "$@"

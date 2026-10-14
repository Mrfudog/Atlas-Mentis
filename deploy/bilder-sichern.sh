#!/bin/sh
# Die Bilder sichern (T-114, E-032 a). Läuft im Verzeichnis der Umgebung
# (/srv/atlas/prod oder /srv/atlas/dev): aus deploy.sh vor jedem Wechsel
# und nachts aus dem Cron (bootstrap.sh).
#
# Ein Bild ändert sich nie — sein Name ist der Hash seines Inhalts. Also
# genügt es, **neue** Dateien nach backups/bilder/ zu holen; nichts wird
# überschrieben und nichts gelöscht. Ein Bild, das jemand am Tisch löscht,
# bleibt so in der Sicherung, bis es jemand von Hand wegräumt
# (docs/Betrieb.md › Bilder). Die Kopie nach aussen nimmt backups/ ohnehin
# mit (Storage Box).
set -eu
cd "$(dirname "$0")"

QUELLE=daten/bilder
ZIEL=backups/bilder
[ -d "$QUELLE" ] || exit 0
mkdir -p "$ZIEL"

neu=0
# Halbe Dateien (`*.tmp`) schreibt der Server gerade; die kommen beim nächsten Mal.
for f in $(cd "$QUELLE" && find . -type f ! -name '*.tmp' ! -name '.probe-*'); do
  [ -e "$ZIEL/$f" ] && continue
  mkdir -p "$ZIEL/$(dirname "$f")"
  # Ein harter Verweis kostet keinen Platz; geht er nicht (fremder
  # Eigentümer, andere Platte), eine Kopie.
  ln "$QUELLE/$f" "$ZIEL/$f" 2>/dev/null || cp -p "$QUELLE/$f" "$ZIEL/$f"
  neu=$((neu + 1))
done
echo "Bilder gesichert: $neu neu, $(find "$ZIEL" -type f | wc -l) in $ZIEL"

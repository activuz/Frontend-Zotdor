#!/usr/bin/env sh
# Nightly backup (NFR-08): database dump + media archive, kept BACKUP_KEEP_DAYS days,
# optionally copied to another server. Cron (root, 02:30 Tashkent):
#   30 21 * * * cd /opt/zotdor && sh deploy/backup.sh >> /var/log/zotdor-backup.log 2>&1
set -eu

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
. deploy/.env

COMPOSE="docker compose -f deploy/docker-compose.yml --env-file deploy/.env"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DIR="${BACKUP_DIR:-/var/backups/zotdor}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$DIR"

echo "[$STAMP] database"
$COMPOSE exec -T db pg_dump -U zotdor -Fc zotdor > "$DIR/db-$STAMP.dump"
# A dump that pg_restore cannot read is not a backup.
$COMPOSE exec -T db pg_restore --list < "$DIR/db-$STAMP.dump" > /dev/null

echo "[$STAMP] media"
$COMPOSE run --rm --no-deps -T -v "$DIR:/backup" --user root --entrypoint sh api \
  -c "tar -C /data -czf /backup/media-$STAMP.tar.gz media"

find "$DIR" -name 'db-*.dump' -mtime "+$KEEP" -delete
find "$DIR" -name 'media-*.tar.gz' -mtime "+$KEEP" -delete

if [ -n "${BACKUP_REMOTE:-}" ]; then
  echo "[$STAMP] rsync -> $BACKUP_REMOTE"
  rsync -a --delete "$DIR/" "$BACKUP_REMOTE"
fi
echo "[$STAMP] done"

#!/bin/bash
# Backs up the Khameleon Postgres database to a timestamped, gzipped dump.
# See SELF_HOSTING.md's "Backing up your data" section. Run from the repo
# root (where docker-compose.yml lives), or schedule it with cron there.
set -euo pipefail
cd "$(dirname "$0")"

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/khameleon-$TIMESTAMP.sql.gz"

docker compose exec -T postgres pg_dump --clean --if-exists -U khameleon khameleon | gzip > "$OUT_FILE"
echo "Backed up to $OUT_FILE"

# Keep the most recent 14 backups; remove anything older. Portable across
# GNU/BSD xargs (no -r/--no-run-if-empty, which BSD xargs doesn't have).
OLD_BACKUPS="$(ls -1t "$BACKUP_DIR"/khameleon-*.sql.gz 2>/dev/null | tail -n +15 || true)"
if [ -n "$OLD_BACKUPS" ]; then
  echo "$OLD_BACKUPS" | xargs rm --
fi

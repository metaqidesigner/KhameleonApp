#!/bin/bash
# Restores a Khameleon Postgres backup made by backup-postgres.sh.
# Usage: ./restore-postgres.sh backups/khameleon-20261001-030000.sql.gz
# WARNING: this overwrites the current database. Back up first if unsure.
set -euo pipefail
cd "$(dirname "$0")"

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>" >&2
  exit 1
fi

echo "This will overwrite the current database with the contents of $FILE."
read -r -p "Continue? [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 1
fi

gunzip -c "$FILE" | docker compose exec -T postgres psql -U khameleon khameleon
echo "Restore complete."

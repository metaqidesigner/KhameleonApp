#!/bin/sh
# Runs on every container start, not just the first one - drizzle-kit push
# is idempotent (only applies real schema diffs), so this safely covers both
# "fresh database, create all tables" and "already up to date, no-op" without
# needing a separate one-time-migration step to get wrong.
set -e

echo "Applying database schema..."
(cd lib/db && node_modules/.bin/drizzle-kit push --force --config drizzle.config.ts)

echo "Starting server..."
exec node --enable-source-maps dist/index.mjs

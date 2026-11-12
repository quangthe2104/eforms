#!/bin/bash
# Run on the cPanel host: backs up the live site + DB, unpacks ~/eforms-release.tar.gz into ~/eforms-staging.
set -euo pipefail

LIVE=~/public_html
STAGE=~/eforms-staging
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p ~/backups

envval() { grep -E "^$1=" "$LIVE/backend/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
DB_NAME=$(envval DB_DATABASE)
DB_USER=$(envval DB_USERNAME)
export MYSQL_PWD=$(envval DB_PASSWORD)

mysqldump --single-transaction --routines -u "$DB_USER" "$DB_NAME" 2>/dev/null | gzip > ~/backups/db-$TS.sql.gz
tar czf ~/backups/code-$TS.tar.gz -C ~ --exclude='public_html/backend/vendor' --exclude='public_html/frontend/node_modules' public_html
echo "BACKUP db=$(du -h ~/backups/db-$TS.sql.gz | cut -f1) code=$(du -h ~/backups/code-$TS.tar.gz | cut -f1) ts=$TS"

rm -rf "$STAGE" && mkdir -p "$STAGE"
tar xzf ~/eforms-release.tar.gz -C "$STAGE"

echo "--- env keys in new .env.example missing from live .env"
comm -23 <(grep -oE '^[A-Z_0-9]+' "$STAGE/backend/.env.example" | sort -u) <(grep -oE '^[A-Z_0-9]+' "$LIVE/backend/.env" | sort -u) || true
echo "--- live frontend env files"
ls -a "$LIVE/frontend" | grep -E '^\.env' || echo none
for f in "$LIVE"/frontend/.env*; do [ -f "$f" ] && { echo "# $f"; cat "$f"; }; done
echo "--- new frontend env examples"
ls -a "$STAGE/frontend" | grep -E '^\.env' || echo none
echo "--- new migrations not yet run"
cd "$LIVE/backend"
ran=$(php artisan migrate:status 2>/dev/null | grep -oE '[0-9]{4}_[0-9]{2}_[0-9]{2}_[0-9]{6}_[a-z0-9_]+' | sort -u)
ls "$STAGE/backend/database/migrations" | sed 's/\.php$//' | sort -u | comm -23 - <(echo "$ran")
echo "--- api base url in new frontend"
grep -rnE "baseURL|VITE_API" "$STAGE/frontend/src/services/api.js" | head -5
echo "--- tools"; which rsync || echo "no rsync"

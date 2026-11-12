#!/bin/bash
# Run on the cPanel host after stage.sh: builds ~/eforms-staging, then syncs it into ~/public_html.
# Live-only files (.env, storage, root and backend/public .htaccess) are never overwritten.
set -euo pipefail

LIVE=~/public_html
STAGE=~/eforms-staging
LOG=~/backups/release-$(date +%Y%m%d-%H%M%S).log

step() { echo "== $1"; }

step "frontend build"
cp "$LIVE/frontend/.env" "$STAGE/frontend/.env"
cd "$STAGE/frontend"
npm ci --no-audit --no-fund --loglevel=error >>"$LOG" 2>&1
npm run build >>"$LOG" 2>&1
ls dist/index.html >/dev/null

step "backend dependencies"
cd "$STAGE/backend"
composer install --no-dev --optimize-autoloader --no-interaction --quiet >>"$LOG" 2>&1

step "maintenance on"
cd "$LIVE/backend"
php artisan down --retry=30 >>"$LOG" 2>&1 || true

step "sync code"
RS="rsync -a --checksum"
for d in app bootstrap config database public resources routes vendor; do
  $RS --delete --exclude='cache/*.php' --exclude='/.htaccess' --exclude='/storage' "$STAGE/backend/$d/" "$LIVE/backend/$d/"
done
$RS "$STAGE/backend/artisan" "$STAGE/backend/composer.json" "$STAGE/backend/composer.lock" "$LIVE/backend/"
for d in dist src public; do
  $RS --delete "$STAGE/frontend/$d/" "$LIVE/frontend/$d/"
done
$RS "$STAGE/frontend/package.json" "$STAGE/frontend/package-lock.json" "$STAGE/frontend/index.html" "$STAGE/frontend/vite.config.js" "$LIVE/frontend/"
mkdir -p "$LIVE/backend/storage/framework/"{cache/data,sessions,views} "$LIVE/backend/storage/logs" "$LIVE/backend/storage/app/public"

step "migrate + cache"
php artisan migrate --force 2>&1 | tee -a "$LOG" | grep -E 'DONE|FAIL|ERROR|Nothing' || true
php artisan optimize:clear >>"$LOG" 2>&1
php artisan config:cache >>"$LOG" 2>&1
php artisan route:cache >>"$LOG" 2>&1 || echo "route:cache skipped (closures?)"
[ -e public/storage ] || php artisan storage:link >>"$LOG" 2>&1 || true

step "maintenance off"
php artisan up >>"$LOG" 2>&1

step "health"
for u in https://ksxh.vn/ https://ksxh.vn/api/me https://ksxh.vn/sanctum/csrf-cookie; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: application/json' "$u") $u"
done
echo "log: $LOG"

#!/bin/bash
# Run on the cPanel host: sets the Google OAuth Client ID in both .env files and rebuilds the frontend.
# Usage: bash enable-google.sh <client-id>.apps.googleusercontent.com
set -euo pipefail
CID="${1:?client id required}"
LIVE=~/public_html
STAGE=~/eforms-staging
TS=$(date +%Y%m%d-%H%M%S)

cp "$LIVE/backend/.env" ~/backups/backend-env-$TS
cp "$LIVE/frontend/.env" ~/backups/frontend-env-$TS
echo "BACKUP env ts=$TS"

setenv() { # file key value
  if grep -qE "^$2=" "$1"; then sed -i "s|^$2=.*|$2=$3|" "$1"; else printf '\n%s=%s\n' "$2" "$3" >> "$1"; fi
}
setenv "$LIVE/backend/.env" GOOGLE_CLIENT_ID "$CID"
setenv "$LIVE/frontend/.env" VITE_GOOGLE_CLIENT_ID "$CID"

cd "$LIVE/backend"
php artisan config:cache >/dev/null
php -r 'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); echo "backend client_id set: " . (config("services.google.client_id") ? "yes" : "NO") . "\n";'

cp "$LIVE/frontend/.env" "$STAGE/frontend/.env"
cd "$STAGE/frontend"
npm run build > ~/backups/build-google-$TS.log 2>&1
grep -lq "$CID" dist/assets/*.js && echo "frontend bundle contains client id: yes" || { echo "frontend bundle contains client id: NO"; exit 1; }
rsync -a --delete dist/ "$LIVE/frontend/dist/"
echo "bundle $(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$LIVE/frontend/dist/index.html")"

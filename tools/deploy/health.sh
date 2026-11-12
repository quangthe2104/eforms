#!/bin/bash
# Run on the cPanel host: post-release smoke checks for https://ksxh.vn.
cd ~/public_html/backend
php artisan route:list --path=api 2>&1 | grep -E 'auth|me|user' | head -8
for u in https://ksxh.vn/api/me https://ksxh.vn/api/forms https://ksxh.vn/login; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: application/json' "$u") $u"
done
echo "--- today's log errors"
grep -E '^\[2026-11-12 2[3]' storage/logs/laravel.log 2>/dev/null | grep -E 'ERROR' | cut -c1-200 | tail -3 || echo none
echo "--- bundle"
grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' ~/public_html/frontend/dist/index.html

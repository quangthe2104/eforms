#!/bin/bash
# Run on the cPanel host: post-release smoke checks for https://ksxh.vn.
cd ~/public_html/backend
SLUG=$(php artisan tinker --execute='echo App\Models\Form::where("status","published")->value("slug");' 2>/dev/null | tail -1)
code() { curl -s -o /dev/null -w '%{http_code}' -H 'Accept: application/json' "https://ksxh.vn$1"; }
echo "/api/me x5: $(for i in 1 2 3 4 5; do printf '%s ' "$(code /api/me)"; done)"
for u in /api/forms /login "/f/$SLUG" "/api/forms/public/$SLUG"; do
  echo "$(code "$u") ${u:0:60}"
done
echo "--- last log entries"
grep -E '^\[20' storage/logs/laravel.log 2>/dev/null | tail -3 | cut -c1-300
echo "--- bundle"
grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' ~/public_html/frontend/dist/index.html

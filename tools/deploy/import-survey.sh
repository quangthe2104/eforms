#!/bin/bash
# Run on the cPanel host: creates the 12.11.26 history survey (draft) for the user with the given email.
# Usage: bash import-survey.sh someone@example.com
set -euo pipefail
EMAIL="${1:?email required}"
cd ~/public_html/backend
envval() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
export MYSQL_PWD=$(envval DB_PASSWORD)
DB="mariadb -u $(envval DB_USERNAME) $(envval DB_DATABASE) -N -B"

ROW=$($DB -e "SELECT id, name FROM users WHERE LOWER(email)=LOWER('${EMAIL//\'/}') LIMIT 1")
[ -n "$ROW" ] || { echo "NO_USER $EMAIL"; $DB -e "SELECT email FROM users"; exit 2; }
UID_=$(echo "$ROW" | cut -f1)
echo "USER id=$UID_ name=$(echo "$ROW" | cut -f2)"
echo "EXISTING imports: $($DB -e "SELECT COUNT(*) FROM forms WHERE user_id=$UID_ AND deleted_at IS NULL AND JSON_UNQUOTE(JSON_EXTRACT(settings,'$.imported_from'))='survey-1211'")"
php artisan survey:import-1211 --user="$UID_"
$DB -e "SELECT id, status, slug, (SELECT COUNT(*) FROM form_fields f WHERE f.form_id=forms.id) FROM forms WHERE user_id=$UID_ ORDER BY id DESC LIMIT 1"

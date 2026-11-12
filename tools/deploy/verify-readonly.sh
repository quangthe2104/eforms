#!/bin/bash
# Run on the cPanel host: read-only verification of the live release (no DB writes).
cd ~/public_html/backend
envval() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
export MYSQL_PWD=$(envval DB_PASSWORD)
DB="mariadb -u $(envval DB_USERNAME) $(envval DB_DATABASE) -N -B"

echo "--- counts"
$DB -e "SELECT 'users',COUNT(*) FROM users UNION ALL SELECT 'forms',COUNT(*) FROM forms UNION ALL SELECT 'fields',COUNT(*) FROM form_fields UNION ALL SELECT 'responses',COUNT(*) FROM form_responses UNION ALL SELECT 'collaborators',COUNT(*) FROM form_collaborators"
echo "--- forms (id, status, slug-ish columns)"
$DB -e "SHOW COLUMNS FROM forms" | cut -f1 | tr '\n' ' '; echo
$DB -e "SELECT id, status, COALESCE(slug,''), LEFT(title,40) FROM forms" 2>&1 | head
echo "--- public api routes"
php artisan route:list --path=api 2>/dev/null | grep -vE 'auth:sanctum' | grep -iE 'public|slug|respond|submit|view' | head -10
echo "--- tables engines"
$DB -e "SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()" | tr '\t' '=' | tr '\n' ' '; echo

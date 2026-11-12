#!/bin/bash
# Run on the cPanel host after stage.sh: sanity-checks the DB backup and env/dependency differences.
cd ~
f=$(ls -t backups/db-*.sql.gz | head -1)
echo "DUMP $f tables=$(zcat "$f" | grep -c 'CREATE TABLE')"
zcat "$f" | grep -oE 'INSERT INTO `[a-z_]+`' | sort | uniq -c

cd ~/eforms-staging/backend
grep -rhoE "env\('[A-Z_0-9]+'" config app routes 2>/dev/null | grep -oE "'[A-Z_0-9]+'" | tr -d "'" | sort -u > /tmp/need.txt
grep -oE '^[A-Z_0-9]+' ~/public_html/backend/.env | sort -u > /tmp/have.txt
echo "--- env used by new code, absent in live .env:"
comm -23 /tmp/need.txt /tmp/have.txt | tr '\n' ' '; echo
echo "--- composer.json diff"
diff ~/public_html/backend/composer.json composer.json | head -20
echo "--- package.json diff"
diff ~/public_html/frontend/package.json ../frontend/package.json | head -20
echo "--- vite base"
grep -nE "base|outDir" ../frontend/vite.config.js | head

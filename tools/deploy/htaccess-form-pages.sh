#!/bin/bash
# Run on the cPanel host: adds rules to the live root .htaccess (after the sanctum rule) so Laravel serves
#   /f/<slug>                  — form page with the form's title and Open Graph tags (FormPageController)
#   /storage/thumbnails/<file> — form thumbnails kept in backend/storage/thumbnails, unless the file exists on disk
# Backs up the file first; safe to re-run.
set -euo pipefail
F=~/public_html/.htaccess
FORM_RULE='RewriteRule ^f/[A-Za-z0-9_-]+/?$ /backend/public/index.php [L]'
THUMB_COND='RewriteCond %{DOCUMENT_ROOT}/storage/thumbnails/$1 !-f'
THUMB_RULE='RewriteRule ^storage/thumbnails/([A-Za-z0-9._-]+)$ /backend/public/index.php [L]'

cp "$F" ~/backups/htaccess-$(date +%Y%m%d-%H%M%S)

add() { # add <marker-rule> <lines...>: inserts the lines after the sanctum rule unless the marker is present
  local marker=$1; shift
  if grep -qF "$marker" "$F"; then echo "present: $marker"; return; fi
  BLOCK="$(printf '%s\n' "$@")" awk '{ print } /^[[:space:]]*RewriteRule \^sanctum\// && !done { n = split(ENVIRON["BLOCK"], l, "\n"); for (i = 1; i <= n; i++) if (l[i] != "") print "    " l[i]; done = 1 }' "$F" > "$F.tmp"
  if grep -qF "$marker" "$F.tmp"; then mv "$F.tmp" "$F"; echo "added: $marker"; else rm -f "$F.tmp"; echo "anchor not found, unchanged"; exit 1; fi
}

add "$FORM_RULE" '# Form pages: title + Open Graph tags for link previews' "$FORM_RULE"
add "$THUMB_RULE" '# Form thumbnails live in backend/storage/thumbnails' "$THUMB_COND" "$THUMB_RULE"
sed -n '/RewriteRule \^sanctum/,/^[[:space:]]*$/p' "$F"

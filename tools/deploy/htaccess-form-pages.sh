#!/bin/bash
# Run on the cPanel host once: routes /f/<slug> in the live root .htaccess to Laravel (FormPageController),
# so link previews get the form's title and Open Graph tags. Backs up the file; safe to re-run.
set -euo pipefail
F=~/public_html/.htaccess
RULE='RewriteRule ^f/[A-Za-z0-9_-]+/?$ /backend/public/index.php [L]'

if grep -qF "$RULE" "$F"; then
  echo "already present"
else
  cp "$F" ~/backups/htaccess-$(date +%Y%m%d-%H%M%S)
  awk -v rule="$RULE" '{ print } /^[[:space:]]*RewriteRule \^sanctum\// && !done { print "    # Form pages: title + Open Graph tags for link previews"; print "    " rule; done = 1 }' "$F" > "$F.tmp"
  grep -qF "$RULE" "$F.tmp" && mv "$F.tmp" "$F" && echo "added" || { rm -f "$F.tmp"; echo "anchor not found, unchanged"; exit 1; }
fi
grep -n -B2 -A1 -F "$RULE" "$F"

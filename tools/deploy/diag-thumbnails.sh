#!/bin/bash
# Run on the cPanel host: locates form thumbnail files and checks how /storage/thumbnails/* is served.
cd ~/public_html
for d in storage storage/thumbnails backend/storage/thumbnails backend/storage/app/public/thumbnails backend/public/storage; do
  printf '%-42s ' "$d"; if [ -L "$d" ]; then echo "symlink -> $(readlink "$d")"; elif [ -d "$d" ]; then echo "dir, $(ls "$d" | wc -l) entries"; else echo missing; fi
done
f=$(ls backend/storage/thumbnails 2>/dev/null | head -1)
[ -n "$f" ] && for u in "/storage/thumbnails/$f" "/backend/public/storage/thumbnails/$f"; do
  echo "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "https://ksxh.vn$u") $u"
done
find ~/public_html -name 'l2RgsFu8GX86JDBCBzpPMlYPB9DYwXA1KHwLSpH9.jpg' 2>/dev/null
ls -la storage | head -5

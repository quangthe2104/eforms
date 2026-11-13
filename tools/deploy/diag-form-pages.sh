#!/bin/bash
# Run on the cPanel host: shows whether /f/<slug> reaches Laravel and which forms are public.
cd ~/public_html/backend
echo "--- headers /f/khong-ton-tai"
curl -sI https://ksxh.vn/f/khong-ton-tai | grep -iE '^(HTTP|cache-control|set-cookie|content-type|x-)'
echo "--- forms"
php artisan tinker --execute='foreach (App\Models\Form::all(["id","slug","status","is_public"]) as $f) echo $f->id, " ", $f->status, " pub=", (int) $f->is_public, " ", $f->slug, PHP_EOL;' 2>&1 | tail -12
echo "--- frontend index"
ls -l ~/public_html/frontend/dist/index.html
echo "--- direct php"
php -r 'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $k = $app->make(Illuminate\Contracts\Http\Kernel::class); $r = $k->handle(Illuminate\Http\Request::create("/f/khong-ton-tai")); echo $r->getStatusCode(), " ", $r->headers->get("cache-control"), PHP_EOL;'
tail -c 800 storage/logs/laravel.log | grep -E '^\[2026-11-13' | cut -c1-300

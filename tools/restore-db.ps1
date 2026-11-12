# Recreates the local eforms_db from a mysqldump file, then runs pending migrations.
# Usage: powershell -File tools/restore-db.ps1 -Dump backend/storage/app/backup-before-phase2.sql
param([Parameter(Mandatory)][string]$Dump)
$ErrorActionPreference = 'Stop'
$mysql = 'D:\wamp64\bin\mysql\mysql9.1.0\bin\mysql.exe'
$php = 'D:\wamp64\bin\php\php8.3.14\php.exe'
$root = Split-Path $PSScriptRoot -Parent
$dumpPath = (Resolve-Path (Join-Path $root $Dump)).Path

& $mysql -u root -e 'DROP DATABASE IF EXISTS eforms_db; CREATE DATABASE eforms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
if ($LASTEXITCODE) { throw 'drop/create failed' }
cmd /c "`"$mysql`" -u root eforms_db < `"$dumpPath`""
if ($LASTEXITCODE) { throw 'import failed' }
Set-Location (Join-Path $root 'backend')
& $php artisan config:clear -q
& $php artisan migrate --force

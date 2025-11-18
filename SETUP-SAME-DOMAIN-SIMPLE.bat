@echo off
echo ========================================
echo SETUP SAME DOMAIN - SIMPLE WAY
echo ========================================
echo.
echo Frontend: http://eforms.test:5173 (Vite)
echo Backend:  http://eforms.test (Apache)
echo.

cd /d D:\wamp64\www\eforms\frontend

echo Step 1: Update vite.config.js
echo ========================================

(
echo import { defineConfig } from 'vite'
echo import react from '@vitejs/plugin-react'
echo.
echo export default defineConfig^({
echo   plugins: [react^(^)],
echo   server: {
echo     host: 'eforms.test',
echo     port: 5173,
echo   }
echo }^)
) > vite.config.js

echo ✅ vite.config.js created
echo.

echo Step 2: Update frontend .env
echo ========================================

(
echo VITE_API_URL=http://eforms.test/api
) > .env

echo ✅ frontend .env updated
echo.

echo Step 3: Update backend .env
echo ========================================

cd /d D:\wamp64\www\eforms\backend

powershell -Command "(Get-Content .env) -replace 'SANCTUM_STATEFUL_DOMAINS=.*', 'SANCTUM_STATEFUL_DOMAINS=eforms.test:5173,eforms.test' | Set-Content .env"
powershell -Command "(Get-Content .env) -replace 'SESSION_DOMAIN=.*', 'SESSION_DOMAIN=.eforms.test' | Set-Content .env"

echo ✅ backend .env updated
echo.

echo Current backend config:
findstr /C:"SANCTUM" .env | findstr "STATEFUL"
findstr /C:"SESSION_DOMAIN" .env
echo.

echo Step 4: Clear backend cache
echo ========================================
D:\wamp64\bin\php\php8.3.14\php.exe artisan config:clear
D:\wamp64\bin\php\php8.3.14\php.exe artisan cache:clear

echo ✅ Cache cleared
echo.

echo Step 5: Kill old frontend
echo ========================================
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo ✅ Old frontend stopped
echo.

echo Step 6: Clear Vite cache
echo ========================================
cd /d D:\wamp64\www\eforms\frontend
if exist node_modules\.vite (
    rmdir /s /q node_modules\.vite
    echo ✅ Vite cache cleared
)
echo.

echo ========================================
echo ✅ CONFIGURATION COMPLETE!
echo ========================================
echo.
echo ACCESS URLS:
echo ========================================
echo Frontend: http://eforms.test:5173
echo Backend:  http://eforms.test/api
echo.
echo HOW IT WORKS:
echo ========================================
echo - Same domain: eforms.test
echo - Different ports: 5173 (frontend) vs 80 (backend)
echo - Cookies domain: .eforms.test (shared!)
echo - No CORS issues!
echo.
echo ========================================
echo STARTING FRONTEND...
echo ========================================
echo.
echo ⚠️  KEEP THIS WINDOW OPEN!
echo.
echo After frontend starts, open browser:
echo    http://eforms.test:5173
echo.
echo ========================================
echo.

npm run dev


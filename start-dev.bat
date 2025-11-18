@echo off
echo ========================================
echo STARTING EFORMS DEVELOPMENT
echo ========================================
echo.

echo Frontend: http://eforms.test:5173
echo Backend:  http://eforms.test
echo.

cd /d D:\wamp64\www\eforms\frontend

echo Starting frontend...
echo.
echo ⚠️  KEEP THIS WINDOW OPEN!
echo.

npm run dev


@echo off
echo ========================================
echo Building Frontend for Production
echo ========================================
echo.

cd D:\wamp64\www\eforms\frontend

echo Step 1: Updating .env for production...
echo.

REM Backup current .env
if exist .env copy .env .env.dev.backup

REM Create production .env
(
echo VITE_API_URL=https://yourdomain.com/api
echo VITE_APP_NAME=eForms
) > .env.production

echo Created .env.production
echo Please update VITE_API_URL with your actual domain!
echo.

echo Step 2: Building frontend...
echo This will take a few minutes...
echo.

npm run build

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build Successful!
echo ========================================
echo.
echo Output folder: frontend\dist\
echo.
echo Next steps:
echo 1. Upload dist\ folder to your server
echo 2. Configure web server (see DEPLOY-GUIDE.md)
echo 3. Update API URL in production
echo.
echo Files to upload:
dir dist /b
echo.
pause


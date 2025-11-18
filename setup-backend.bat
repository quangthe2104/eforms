@echo off
echo ========================================
echo eForms Backend Setup
echo ========================================
echo.

cd D:\wamp64\www\eforms\backend

echo Step 1: Installing Composer dependencies...
echo.

REM Check if composer.phar exists
if exist composer.phar (
    echo Using local composer.phar...
    D:\wamp64\bin\php\php8.3.14\php.exe composer.phar install
) else (
    echo Composer not found. Please run install-composer.bat first!
    echo.
    echo Or download Composer from: https://getcomposer.org/Composer-Setup.exe
    pause
    exit /b 1
)

echo.
echo Step 2: Generating application key...
D:\wamp64\bin\php\php8.3.14\php.exe artisan key:generate

echo.
echo Step 3: Running database migrations...
D:\wamp64\bin\php\php8.3.14\php.exe artisan migrate

echo.
echo Step 4: Creating storage link...
D:\wamp64\bin\php\php8.3.14\php.exe artisan storage:link

echo.
echo ========================================
echo Backend setup completed!
echo ========================================
echo.
echo Next steps:
echo 1. Make sure WAMP is running
echo 2. Access: http://eforms.test/api
echo 3. Setup frontend (run setup-frontend.bat)
echo.
pause


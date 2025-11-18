@echo off
echo ========================================
echo eForms Frontend Setup
echo ========================================
echo.

cd D:\wamp64\www\eforms\frontend

echo Step 1: Installing npm dependencies...
echo This may take a few minutes...
echo.

call npm install

echo.
echo Step 2: Starting development server...
echo.
echo Frontend will run at: http://localhost:5173
echo Backend API: http://eforms.test/api
echo.
echo Press Ctrl+C to stop the server
echo.

call npm run dev

pause


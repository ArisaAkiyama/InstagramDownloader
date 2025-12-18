@echo off
echo ========================================
echo  InstaDown - Stop Server
echo ========================================
echo.

echo Stopping all Node.js processes...
taskkill /f /im node.exe 2>nul

if %errorlevel% == 0 (
    echo Server stopped successfully.
) else (
    echo No server was running.
)

echo.
pause

@echo off
:: InstaDown Server - Run Hidden in Background
:: This script starts the server without showing a window

cd /d "%~dp0"
start /min cmd /c "node server.js"

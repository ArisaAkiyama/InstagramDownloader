@echo off
echo ========================================
echo  InstaDown - Auto Start Setup
echo ========================================
echo.

:: Get the startup folder path
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SCRIPT_DIR=%~dp0"
set "VBS_PATH=%SCRIPT_DIR%start-silent.vbs"

:: Create the VBS file first
echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_PATH%"
echo WshShell.CurrentDirectory = "%SCRIPT_DIR%" >> "%VBS_PATH%"
echo WshShell.Run "cmd /c cd /d %SCRIPT_DIR% && node server.js", 0, False >> "%VBS_PATH%"
echo Set WshShell = Nothing >> "%VBS_PATH%"

:: Create shortcut in startup folder
echo Creating startup shortcut...

powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%STARTUP%\InstaDown Server.lnk'); $Shortcut.TargetPath = 'wscript.exe'; $Shortcut.Arguments = '\"%VBS_PATH%\"'; $Shortcut.WorkingDirectory = '%SCRIPT_DIR%'; $Shortcut.Description = 'InstaDown Instagram Downloader Server'; $Shortcut.Save()"

if exist "%STARTUP%\InstaDown Server.lnk" (
    echo.
    echo ========================================
    echo  SUCCESS! Auto-start telah diaktifkan
    echo ========================================
    echo.
    
    :: Start server now
    echo Starting server sekarang...
    start "" wscript.exe "%VBS_PATH%"
    
    timeout /t 3 /nobreak >nul
    
    echo.
    echo Server sudah berjalan di background!
    echo Extension siap digunakan.
    echo.
    echo Untuk STOP server: jalankan stop-server.bat
    echo Untuk DISABLE auto-start: jalankan remove-autostart.bat
) else (
    echo.
    echo ERROR: Gagal membuat shortcut.
)

echo.
pause

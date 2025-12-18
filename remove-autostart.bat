@echo off
echo ========================================
echo  InstaDown - Remove Auto Start
echo ========================================
echo.

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

if exist "%STARTUP%\InstaDown Server.lnk" (
    del "%STARTUP%\InstaDown Server.lnk"
    echo Auto-start telah dinonaktifkan.
    echo Server tidak akan jalan otomatis saat Windows boot.
) else (
    echo Auto-start tidak aktif atau sudah dihapus.
)

echo.
pause

@echo off
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 goto nopython

start "Ashen Reach server" cmd /k "python -m http.server 8123 --bind 127.0.0.1"
ping 127.0.0.1 -n 3 >nul
start "" "http://127.0.0.1:8123"
goto :eof

:nopython
echo Python not found. Opening index.html directly...
start "" "index.html"

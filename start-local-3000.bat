@echo off
setlocal
cd /d "%~dp0"
set "PYTHON=C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

echo Starting TaskFlow at http://localhost:3000
echo Keep this window open while using the app.
echo Press Ctrl+C to stop.
echo.
"%PYTHON%" -m http.server 3000 --bind 127.0.0.1
pause

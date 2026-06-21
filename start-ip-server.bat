@echo off
setlocal
cd /d "%~dp0"
set "PYTHON=C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

echo Starting TaskFlow local web server...
echo.
echo Open on this computer:
echo   http://127.0.0.1:8080/task-manager.html
echo.
echo Open from another device on the same Wi-Fi using this computer's IPv4 address:
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
  for /f "tokens=* delims= " %%B in ("%%A") do echo   http://%%B:8080/task-manager.html
)
echo.
echo Keep this window open while using the app.
echo Press Ctrl+C to stop the server.
echo.
"%PYTHON%" -m http.server 8080 --bind 0.0.0.0
pause

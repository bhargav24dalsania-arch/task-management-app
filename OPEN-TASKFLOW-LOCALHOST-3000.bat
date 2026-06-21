@echo off
setlocal
set "OUTDIR=%~dp0"
set "NODE=C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "PYTHON=C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

echo Starting TaskFlow on http://localhost:3000
echo Also available at http://127.0.0.1:3000
echo.
echo This window must stay open while using the app.
echo Wait until you see "TaskFlow running at http://127.0.0.1:3000"
echo Then open http://127.0.0.1:3000 in the browser.
echo.

if exist "%NODE%" (
  cd /d "%OUTDIR%"
  "%NODE%" "%OUTDIR%start-local-3000.js"
  echo.
  echo Server stopped or failed. Please send this window text to Codex.
  pause
) else if exist "%PYTHON%" (
  cd /d "%OUTDIR%"
  "%PYTHON%" -m http.server 3000 --bind 0.0.0.0
  echo.
  echo Server stopped or failed. Please send this window text to Codex.
  pause
) else (
  echo Could not find bundled Node.js or Python.
  echo Install Node.js from https://nodejs.org/ and run npm for the Next.js app.
  pause
  exit /b 1
)

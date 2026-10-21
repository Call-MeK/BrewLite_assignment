@echo off
curl.exe -fsS --max-time 2 http://127.0.0.1:3000/ >nul 2>&1
if not errorlevel 1 (
  echo BrewLite frontend is already running at http://localhost:3000.
  exit /b 0
)
set "PATH=%~dp0.tools\node-v22.16.0-win-x64;%PATH%"
set "TEMP=%~dp0.tools\tmp"
set "TMP=%TEMP%"
cd /d "%~dp0frontend"
call npm.cmd run dev

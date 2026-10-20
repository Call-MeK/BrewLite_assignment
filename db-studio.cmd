@echo off
set "PATH=%~dp0.tools\node-v22.16.0-win-x64;%PATH%"
set "TEMP=%~dp0.tools\tmp"
set "TMP=%TEMP%"
cd /d "%~dp0backend"
call npm.cmd run prisma:studio

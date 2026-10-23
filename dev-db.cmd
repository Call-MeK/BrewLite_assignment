@echo off
set "PG_BIN=%~dp0.tools\postgresql-16.15\pgsql\bin"
"%PG_BIN%\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
if not errorlevel 1 (
  echo PostgreSQL is already running.
  exit /b 0
)
"%PG_BIN%\pg_ctl.exe" -D "%~dp0.tools\pgdata" -l "%~dp0.tools\postgres.log" -o "-p 5432 -h 127.0.0.1" start

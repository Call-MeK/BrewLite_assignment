@echo off
"%~dp0.tools\postgresql-16.15\pgsql\bin\pg_ctl.exe" -D "%~dp0.tools\pgdata" stop

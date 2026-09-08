@echo off
setlocal
set "HERE=%~dp0"
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%HERE%real-host-smoke.ps1" %*
exit /b %ERRORLEVEL%

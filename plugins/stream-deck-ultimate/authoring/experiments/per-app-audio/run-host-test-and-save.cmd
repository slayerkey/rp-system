@echo off
setlocal
set "HERE=%~dp0"
pushd "%HERE%"
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%HERE%real-host-smoke.ps1" -OutputPath "host-test-result.json" %*
set "CODE=%ERRORLEVEL%"
if exist "%HERE%host-test-result.json" echo.
if exist "%HERE%host-test-result.json" echo Saved machine-readable result: %HERE%host-test-result.json
popd
exit /b %CODE%

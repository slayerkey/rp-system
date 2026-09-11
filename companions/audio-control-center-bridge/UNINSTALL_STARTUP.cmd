@echo off
setlocal
set "DEST=%LOCALAPPDATA%\PackRat\AudioBridge"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

taskkill /IM PackRat.AudioBridge.exe /F >nul 2>&1
del /Q "%STARTUP%\PackRat Audio Bridge.cmd" >nul 2>&1
cd /d "%TEMP%"
if exist "%DEST%" rmdir /S /Q "%DEST%"

echo.
echo PackRat Audio Bridge startup install removed for this Windows user.
echo.
if "%PACKRAT_AUDIO_BRIDGE_TEST%"=="1" exit /b 0
pause
exit /b 0

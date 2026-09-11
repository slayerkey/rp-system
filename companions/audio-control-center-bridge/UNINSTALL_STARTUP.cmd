@echo off
setlocal
set "DEST=%LOCALAPPDATA%\PackRat\AudioBridge"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

if /I "%~dp0"=="%DEST%\" goto :installed

taskkill /IM PackRat.AudioBridge.exe /F >nul 2>&1
del /Q "%STARTUP%\PackRat Audio Bridge.cmd" >nul 2>&1
if exist "%DEST%" rmdir /S /Q "%DEST%"

echo.
echo PackRat Audio Bridge startup install removed for this Windows user.
echo.
if "%PACKRAT_AUDIO_BRIDGE_TEST%"=="1" exit /b 0
pause
exit /b 0

:installed
start "" /b "%ComSpec%" /d /c "timeout /t 1 /nobreak >nul 2>&1 & taskkill /IM PackRat.AudioBridge.exe /F >nul 2>&1 & del /Q ""%STARTUP%\PackRat Audio Bridge.cmd"" >nul 2>&1 & rmdir /S /Q ""%DEST%"""
echo.
echo PackRat Audio Bridge uninstall scheduled. The installed folder and Startup entry will be removed now.
echo.
if "%PACKRAT_AUDIO_BRIDGE_TEST%"=="1" exit /b 0
pause
exit /b 0

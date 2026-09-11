@echo off
setlocal
set "ROOT=%LOCALAPPDATA%\PackRat"
set "DEST=%ROOT%\AudioBridge"
set "UNINSTALLER=%ROOT%\UNINSTALL_AUDIO_BRIDGE.cmd"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SELF=%~f0"

taskkill /IM PackRat.AudioBridge.exe /F >nul 2>&1
del /Q "%STARTUP%\PackRat Audio Bridge.cmd" >nul 2>&1

for /L %%I in (1,1,10) do (
  if exist "%DEST%" rmdir /S /Q "%DEST%" >nul 2>&1
  if not exist "%DEST%" goto :removed
  timeout /t 1 /nobreak >nul 2>&1
)

echo.
echo PackRat Audio Bridge uninstall could not remove the installed bridge folder.
echo Close any process using %DEST% and run this uninstaller again.
echo.
if "%PACKRAT_AUDIO_BRIDGE_TEST%"=="1" exit /b 1
pause
exit /b 1

:removed
echo.
echo PackRat Audio Bridge startup install removed for this Windows user.
echo.
if "%PACKRAT_AUDIO_BRIDGE_TEST%"=="1" goto :finish
pause

:finish
if /I "%SELF%"=="%UNINSTALLER%" del /Q "%SELF%" >nul 2>&1 & exit /b 0
exit /b 0

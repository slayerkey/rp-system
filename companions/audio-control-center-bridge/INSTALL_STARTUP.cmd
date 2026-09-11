@echo off
setlocal
set "DEST=%LOCALAPPDATA%\PackRat\AudioBridge"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

if not exist "%DEST%" mkdir "%DEST%"
if errorlevel 1 goto :fail
if not exist "%STARTUP%" mkdir "%STARTUP%"
if errorlevel 1 goto :fail

copy /Y "%~dp0PackRat.AudioBridge.exe" "%DEST%\PackRat.AudioBridge.exe" >nul
if errorlevel 1 goto :fail
copy /Y "%~dp0README.md" "%DEST%\README.md" >nul
copy /Y "%~dp0SECURITY.md" "%DEST%\SECURITY.md" >nul

> "%STARTUP%\PackRat Audio Bridge.cmd" echo @echo off
>> "%STARTUP%\PackRat Audio Bridge.cmd" echo start "" /min "%DEST%\PackRat.AudioBridge.exe"

start "" /min "%DEST%\PackRat.AudioBridge.exe"
echo.
echo PackRat Audio Bridge installed for this Windows user.
echo It will start automatically when you sign in.
echo No administrator permission or Windows service was added.
echo.
pause
exit /b 0

:fail
echo.
echo PackRat Audio Bridge install failed.
echo Extract the ZIP to a normal folder and run INSTALL_STARTUP.cmd again.
echo.
pause
exit /b 1

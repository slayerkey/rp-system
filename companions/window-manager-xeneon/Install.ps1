$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'PackRat.WindowBridge.exe'
if (-not (Test-Path $source)) {
    throw "PackRat.WindowBridge.exe was not found beside this installer."
}

$targetDir = Join-Path $env:LOCALAPPDATA 'PackRat\WindowBridge'
$targetExe = Join-Path $targetDir 'PackRat.WindowBridge.exe'
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'PackRat Window Bridge.lnk'

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

Get-Process -Name 'PackRat.WindowBridge' -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue

Copy-Item $source $targetExe -Force

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetExe
$shortcut.Arguments = '--no-browser'
$shortcut.WorkingDirectory = $targetDir
$shortcut.Description = 'PackRat Window Bridge for XENEON Edge'
$shortcut.Save()

Start-Process $targetExe

Write-Host ''
Write-Host 'PackRat Window Bridge installed for this Windows user.'
Write-Host "Location: $targetDir"
Write-Host 'The local pairing page should open automatically.'

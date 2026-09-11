$ErrorActionPreference = 'Stop'

$targetDir = Join-Path $env:LOCALAPPDATA 'PackRat\WindowBridge'
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'PackRat Window Bridge.lnk'

Get-Process -Name 'PackRat.WindowBridge' -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue

Remove-Item $shortcutPath -Force -ErrorAction SilentlyContinue
Remove-Item $targetDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host 'PackRat Window Bridge removed for this Windows user.'

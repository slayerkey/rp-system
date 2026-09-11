$ErrorActionPreference = 'Stop'

$targetDir = Join-Path $env:LOCALAPPDATA 'PackRat\ClipboardShelf'
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runValue = 'PackRatClipboardShelfBridge'

Get-Process -Name 'PackRat.ClipboardShelfBridge' -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue

Remove-ItemProperty -Path $runKey -Name $runValue -ErrorAction SilentlyContinue
Remove-Item $targetDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host 'PackRat Clipboard Shelf Bridge and its local encrypted clipboard history were removed for this Windows user.'

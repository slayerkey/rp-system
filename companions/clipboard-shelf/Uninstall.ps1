$ErrorActionPreference = 'Stop'

$targetDir = Join-Path $env:LOCALAPPDATA 'PackRat\ClipboardShelf'
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runValue = 'PackRatClipboardShelfBridge'

$processes = @(Get-Process -Name 'PackRat.ClipboardShelfBridge' -ErrorAction SilentlyContinue)
foreach ($process in $processes) {
    try { $process.Kill() } catch {}
}
foreach ($process in $processes) {
    try { $process.WaitForExit(5000) | Out-Null } catch {}
}

Remove-ItemProperty -Path $runKey -Name $runValue -ErrorAction SilentlyContinue

for ($attempt = 0; $attempt -lt 40; $attempt++) {
    if (-not (Test-Path $targetDir)) { break }
    try {
        Remove-Item $targetDir -Recurse -Force -ErrorAction Stop
    }
    catch {
        if ($attempt -eq 39) { throw }
        Start-Sleep -Milliseconds 250
    }
}

if (Test-Path $targetDir) {
    throw "Could not completely remove Clipboard Shelf local data from $targetDir"
}

Write-Host 'PackRat Clipboard Shelf Bridge and its local encrypted clipboard history were removed for this Windows user.'

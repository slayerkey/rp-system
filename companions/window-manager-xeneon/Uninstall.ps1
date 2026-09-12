$ErrorActionPreference = 'Stop'

$targetDir = Join-Path $env:LOCALAPPDATA 'PackRat\WindowBridge'
$targetExe = Join-Path $targetDir 'PackRat.WindowBridge.exe'
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'PackRat Window Bridge.lnk'

function Get-InstalledBridgeProcesses {
    @(Get-Process -Name 'PackRat.WindowBridge' -ErrorAction SilentlyContinue | Where-Object {
        try {
            [string]::Equals($_.Path, $targetExe, [System.StringComparison]::OrdinalIgnoreCase)
        } catch {
            $false
        }
    })
}

$processes = @(Get-InstalledBridgeProcesses)
foreach ($process in $processes) {
    Stop-Process -Id $process.Id -Force -ErrorAction Stop
}

foreach ($process in $processes) {
    try {
        Wait-Process -Id $process.Id -Timeout 10 -ErrorAction Stop
    } catch {
        if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
            throw "PackRat Window Bridge process $($process.Id) did not exit during uninstall."
        }
    }
}

if (@(Get-InstalledBridgeProcesses).Count -ne 0) {
    throw 'PackRat Window Bridge is still running from the install directory.'
}

if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force -ErrorAction Stop
}
if (Test-Path $shortcutPath) {
    throw 'PackRat Window Bridge startup shortcut could not be removed.'
}

if (Test-Path $targetDir) {
    $removed = $false
    for ($attempt = 1; $attempt -le 6; $attempt++) {
        try {
            Remove-Item $targetDir -Recurse -Force -ErrorAction Stop
            $removed = -not (Test-Path $targetDir)
        } catch {
            $removed = $false
        }

        if ($removed) { break }
        Start-Sleep -Milliseconds (250 * $attempt)
    }

    if (Test-Path $targetDir) {
        throw "PackRat Window Bridge install directory remains after uninstall: $targetDir"
    }
}

Write-Host 'PackRat Window Bridge removed for this Windows user.'

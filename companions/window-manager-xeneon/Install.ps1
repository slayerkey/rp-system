$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'PackRat.WindowBridge.exe'
if (-not (Test-Path $source)) {
    throw "PackRat.WindowBridge.exe was not found beside this installer."
}

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

function Stop-InstalledBridge {
    $processes = @(Get-InstalledBridgeProcesses)
    foreach ($process in $processes) {
        Stop-Process -Id $process.Id -Force -ErrorAction Stop
    }

    foreach ($process in $processes) {
        try {
            Wait-Process -Id $process.Id -Timeout 10 -ErrorAction Stop
        } catch {
            if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
                throw "PackRat Window Bridge process $($process.Id) did not exit before update."
            }
        }
    }

    if (@(Get-InstalledBridgeProcesses).Count -ne 0) {
        throw 'PackRat Window Bridge is still running from the install directory.'
    }
}

Stop-InstalledBridge
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item $source $targetExe -Force -ErrorAction Stop

if (-not (Test-Path $targetExe)) {
    throw 'PackRat Window Bridge executable was not copied to the install directory.'
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetExe
$shortcut.Arguments = '--no-browser'
$shortcut.WorkingDirectory = $targetDir
$shortcut.Description = 'PackRat Window Bridge for XENEON Edge'
$shortcut.Save()

if (-not (Test-Path $shortcutPath)) {
    throw 'PackRat Window Bridge startup shortcut was not created.'
}

$process = Start-Process $targetExe -PassThru
Start-Sleep -Milliseconds 400
if ($process.HasExited) {
    throw "PackRat Window Bridge exited immediately with code $($process.ExitCode)."
}

Write-Host ''
Write-Host 'PackRat Window Bridge installed for this Windows user.'
Write-Host "Location: $targetDir"
Write-Host 'The local pairing page should open automatically.'

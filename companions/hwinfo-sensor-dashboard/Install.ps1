$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'PackRat.HWiNFOBridge.exe'
if (-not (Test-Path $source)) { throw "PackRat.HWiNFOBridge.exe was not found beside this installer." }

$targetDir = Join-Path $env:LOCALAPPDATA 'PackRat\HWiNFOBridge'
$targetExe = Join-Path $targetDir 'PackRat.HWiNFOBridge.exe'
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'PackRat HWiNFO Bridge.lnk'

function Get-InstalledProcesses {
  @(Get-Process -Name 'PackRat.HWiNFOBridge' -ErrorAction SilentlyContinue | Where-Object {
    try { [string]::Equals($_.Path, $targetExe, [System.StringComparison]::OrdinalIgnoreCase) } catch { $false }
  })
}

function Stop-InstalledBridge {
  $processes = @(Get-InstalledProcesses)
  foreach ($process in $processes) { Stop-Process -Id $process.Id -Force -ErrorAction Stop }
  foreach ($process in $processes) {
    try { Wait-Process -Id $process.Id -Timeout 10 -ErrorAction Stop }
    catch { if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) { throw "PackRat HWiNFO Bridge process $($process.Id) did not exit before update." } }
  }
  if (@(Get-InstalledProcesses).Count -ne 0) { throw 'PackRat HWiNFO Bridge is still running from the install directory.' }
}

Stop-InstalledBridge
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item $source $targetExe -Force -ErrorAction Stop
if (-not (Test-Path $targetExe)) { throw 'PackRat HWiNFO Bridge executable was not copied to the install directory.' }

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetExe
$shortcut.Arguments = '--no-browser'
$shortcut.WorkingDirectory = $targetDir
$shortcut.Description = 'PackRat HWiNFO Bridge for XENEON Edge'
$shortcut.Save()
if (-not (Test-Path $shortcutPath)) { throw 'PackRat HWiNFO Bridge startup shortcut was not created.' }

$launchArgs = if ($env:PACKRAT_BRIDGE_NO_BROWSER -eq '1') { '--no-browser' } else { '' }
$process = Start-Process $targetExe -ArgumentList $launchArgs -PassThru
Start-Sleep -Milliseconds 500
if ($process.HasExited) { throw "PackRat HWiNFO Bridge exited immediately with code $($process.ExitCode)." }

if ($env:PACKRAT_BRIDGE_NO_BROWSER -ne '1') { Start-Process "http://127.0.0.1:17489/" | Out-Null }
Write-Host ''
Write-Host 'PackRat HWiNFO Bridge installed for this Windows user.'
Write-Host "Location: $targetDir"
Write-Host 'The local setup page should now be open.'

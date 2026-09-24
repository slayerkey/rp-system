$ErrorActionPreference = 'Stop'

$targetDir = Join-Path $env:LOCALAPPDATA 'PackRat\HWiNFOBridge'
$targetExe = Join-Path $targetDir 'PackRat.HWiNFOBridge.exe'
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'PackRat HWiNFO Bridge.lnk'

function Get-InstalledProcesses {
  @(Get-Process -Name 'PackRat.HWiNFOBridge' -ErrorAction SilentlyContinue | Where-Object {
    try { [string]::Equals($_.Path, $targetExe, [System.StringComparison]::OrdinalIgnoreCase) } catch { $false }
  })
}

# Remove autostart first so no external Startup-folder observer can race the shutdown.
if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force -ErrorAction Stop }
if (Test-Path $shortcutPath) { throw 'PackRat HWiNFO Bridge startup shortcut could not be removed.' }

# Drain exact installed processes with a bounded retry loop. A second pass handles
# short-lived process replacement races during update/uninstall without killing
# unrelated copies or similarly named processes elsewhere on the machine.
for ($attempt=1; $attempt -le 40; $attempt++) {
  $processes = @(Get-InstalledProcesses)
  if ($processes.Count -eq 0) {
    Start-Sleep -Milliseconds 150
    if (@(Get-InstalledProcesses).Count -eq 0) { break }
  } else {
    foreach ($process in $processes) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 250
  }
}
if (@(Get-InstalledProcesses).Count -ne 0) {
  throw 'PackRat HWiNFO Bridge is still running from the install directory after the bounded shutdown window.'
}

if (Test-Path $targetDir) {
  for ($attempt=1; $attempt -le 8; $attempt++) {
    try { Remove-Item $targetDir -Recurse -Force -ErrorAction Stop } catch {}
    if (-not (Test-Path $targetDir)) { break }
    Start-Sleep -Milliseconds (250 * $attempt)
  }
  if (Test-Path $targetDir) { throw "PackRat HWiNFO Bridge install directory remains after uninstall: $targetDir" }
}
Write-Host 'PackRat HWiNFO Bridge removed for this Windows user.'

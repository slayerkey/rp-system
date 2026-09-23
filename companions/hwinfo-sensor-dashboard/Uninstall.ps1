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

$processes = @(Get-InstalledProcesses)
foreach ($process in $processes) { Stop-Process -Id $process.Id -Force -ErrorAction Stop }
foreach ($process in $processes) {
  try { Wait-Process -Id $process.Id -Timeout 10 -ErrorAction Stop }
  catch { if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) { throw "PackRat HWiNFO Bridge process $($process.Id) did not exit during uninstall." } }
}
if (@(Get-InstalledProcesses).Count -ne 0) { throw 'PackRat HWiNFO Bridge is still running from the install directory.' }

if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force -ErrorAction Stop }
if (Test-Path $shortcutPath) { throw 'PackRat HWiNFO Bridge startup shortcut could not be removed.' }

if (Test-Path $targetDir) {
  for ($attempt=1; $attempt -le 6; $attempt++) {
    try { Remove-Item $targetDir -Recurse -Force -ErrorAction Stop } catch {}
    if (-not (Test-Path $targetDir)) { break }
    Start-Sleep -Milliseconds (250 * $attempt)
  }
  if (Test-Path $targetDir) { throw "PackRat HWiNFO Bridge install directory remains after uninstall: $targetDir" }
}
Write-Host 'PackRat HWiNFO Bridge removed for this Windows user.'

param([switch]$StaticOnly)
$ErrorActionPreference="Stop"
$Root=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$lite=Join-Path $Root "com.packrat.wireless-device-manager.sdPlugin"
$pro=Join-Path $Root "com.packrat.wireless-device-manager-pro.sdPlugin"
foreach($plugin in @($lite,$pro)){
  if(-not(Test-Path (Join-Path $plugin "manifest.json"))){throw "Missing manifest: $plugin"}
  if(-not(Test-Path (Join-Path $plugin "bin\plugin.js"))){throw "Missing built plugin.js: $plugin"}
  if(-not(Test-Path (Join-Path $plugin "bin\wireless-device-bridge-x64.exe"))){throw "Missing x64 bridge: $plugin"}
  if(-not(Test-Path (Join-Path $plugin "bin\wireless-device-bridge-arm64.exe"))){throw "Missing ARM64 bridge: $plugin"}
  $profiles=@(Get-ChildItem (Join-Path $plugin "profiles") -Filter *.streamDeckProfile -File)
  if($profiles.Count -ne 5){throw "Expected five bundled profiles in $plugin; found $($profiles.Count)"}
}
Write-Host "Wireless Device Manager static host audit PASS."
if($StaticOnly){return}
$bridge=Join-Path $lite "bin\wireless-device-bridge-x64.exe"
$json=& $bridge snapshot
if($LASTEXITCODE -notin @(0,2)){throw "Wireless bridge snapshot failed: $json"}
$result=$json|ConvertFrom-Json
Write-Host ("Bluetooth adapter available: {0}" -f $result.adapterAvailable)
Write-Host ("Detected paired devices: {0}" -f @($result.devices).Count)
foreach($d in @($result.devices)){
  $caps=@()
  $caps+="STATUS"
  if($null -ne $d.batteryPercent){$caps+="BATTERY"}
  if($null -ne $d.charging){$caps+="CHARGING"}
  if($d.control.connect){$caps+="CONNECT"}
  if($d.control.disconnect){$caps+="DISCONNECT"}
  Write-Host ("- {0}: connected={1}, present={2}, battery={3}, charging={4}, caps={5}" -f $d.name,$d.connected,$d.present,$d.batteryPercent,$d.charging,($caps -join ","))
}
Write-Host "Read-only wireless host probe PASS. Run QA.md physical control steps manually before READY_TO_SHIP."

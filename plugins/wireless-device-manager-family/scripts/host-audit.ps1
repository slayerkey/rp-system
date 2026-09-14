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
Write-Host "Live wireless battery samples (fresh bridge reads):"
for($sampleIndex=1;$sampleIndex -le 3;$sampleIndex++){
  $json=& $bridge snapshot
  if($LASTEXITCODE -notin @(0,2)){throw "Wireless bridge snapshot failed: $json"}
  $result=$json|ConvertFrom-Json
  if($sampleIndex -eq 1){
    Write-Host ("Bluetooth adapter available: {0}" -f $result.adapterAvailable)
    Write-Host ("USB/HID scan available: {0}" -f $result.hidAvailable)
    Write-Host ("Detected wireless devices: {0}" -f @($result.devices).Count)
  }
  foreach($d in @($result.devices)){
    $caps=@()
    $caps+="STATUS"
    if($null -ne $d.batteryPercent){$caps+="BATTERY"}
    if($null -ne $d.charging){$caps+="CHARGING"}
    if($d.control.connect){$caps+="CONNECT"}
    if($d.control.disconnect){$caps+="DISCONNECT"}
    $observed=if($null -ne $d.batteryObservedAt){
      [DateTimeOffset]::FromUnixTimeMilliseconds([long]$d.batteryObservedAt).ToLocalTime().ToString("HH:mm:ss.fff")
    }else{"n/a"}
    Write-Host ("Sample {0} - {1}: transport={2}, kind={3}, battery={4}, charging={5}, source={6}, observed={7}, caps={8}" -f $sampleIndex,$d.name,$d.transport,$d.kind,$d.batteryPercent,$d.charging,$d.batterySource,$observed,($caps -join ","))
  }
  if($sampleIndex -lt 3){Start-Sleep -Seconds 2}
}
Write-Host "Each sample above is a new hardware bridge request; identical values mean the device reported the same value again."
Write-Host "Read-only wireless host probe PASS. Run QA.md physical control steps manually before READY_TO_SHIP."

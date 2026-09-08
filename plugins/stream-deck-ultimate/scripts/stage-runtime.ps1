param(
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
$ProductRoot = Split-Path -Parent $PSScriptRoot
$Authoring = Join-Path $ProductRoot "authoring"
$Prototype = Join-Path $Authoring "prototype"
$Experiment = Join-Path $Authoring "experiments\per-app-audio"
$PrototypePlugin = Join-Path $Prototype "com.packrat.stream-deck-ultimate-bundle.sdPlugin"
$FinalManifest = Join-Path $ProductRoot "release\manifest-v1.0.0.json"

if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $ProductRoot ".stage" }
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$Plugin = Join-Path $OutputRoot "com.packrat.stream-deck-ultimate-bundle.sdPlugin"

foreach ($required in @($PrototypePlugin, $Experiment, $FinalManifest)) {
  if (-not (Test-Path -LiteralPath $required)) { throw "Recovered Ultimate source input missing: $required" }
}

if (Test-Path -LiteralPath $OutputRoot) { Remove-Item -Recurse -Force -LiteralPath $OutputRoot }
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
Copy-Item -Recurse -Force -LiteralPath $PrototypePlugin -Destination $Plugin

$buildJson = & (Join-Path $Experiment "build-helper.ps1")
$build = $buildJson | ConvertFrom-Json
if (-not $build.ok -or -not (Test-Path -LiteralPath $build.path)) { throw "App Volume helper build failed: $buildJson" }

$appAudio = Join-Path $Plugin "bin\app-audio"
New-Item -ItemType Directory -Force -Path $appAudio | Out-Null
foreach ($name in @(
  "action-spec.js",
  "settings-model.js",
  "session-model.js",
  "app-audio-service.js",
  "streamdeck-surface-model.js",
  "streamdeck-controller.js",
  "worker-client.js",
  "runtime-factory.js",
  "streamdeck-bridge.js",
  "app-audio-worker.ps1"
)) {
  Copy-Item -Force -LiteralPath (Join-Path $Experiment $name) -Destination (Join-Path $appAudio $name)
}
Copy-Item -Force -LiteralPath (Join-Path $Experiment "v08-app-audio-adapter.js") -Destination (Join-Path $Plugin "bin\lib-v08-app-audio.js")
Copy-Item -Force -LiteralPath (Join-Path $Experiment "plugin-v08-shadow.cjs") -Destination (Join-Path $Plugin "bin\plugin-v08.cjs")
Copy-Item -Force -LiteralPath (Join-Path $Experiment "property-inspector.html") -Destination (Join-Path $Plugin "ui\property-inspector-app-volume.html")
Copy-Item -Force -LiteralPath $build.path -Destination (Join-Path $appAudio "PackRatAppAudio.dll")

python (Join-Path $ProductRoot "scripts\apply_hardware_acceptance.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "exact hardware-acceptance payload restore failed" }
Copy-Item -Force -LiteralPath $FinalManifest -Destination (Join-Path $Plugin "manifest.json")
python (Join-Path $ProductRoot "scripts\verify_hardware_fixes.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "hardware acceptance F1-F7 regression contract failed" }

$manifest = Get-Content -LiteralPath (Join-Path $Plugin "manifest.json") -Raw | ConvertFrom-Json
if ($manifest.Name -ne "Stream Deck Ultimate" -or $manifest.Version -ne "1.0.0.0" -or $manifest.SDKVersion -ne 3 -or @($manifest.Actions).Count -ne 16) {
  throw "staged v1.0 manifest contract drifted"
}

[pscustomobject]@{
  ok = $true
  sourceCommit = "fc314e6f42fbe3e16da82a3af7aca75bda288e4f"
  plugin = $Plugin
  version = $manifest.Version
  actions = @($manifest.Actions).Count
  hardwareFixes = "F1-F7 PASS"
  helperSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $appAudio "PackRatAppAudio.dll")).Hash.ToLowerInvariant()
} | ConvertTo-Json -Compress

param(
  [string]$AssemblyPath = "",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
$pluginUuid = "com.packrat.stream-deck-ultimate-bundle"
$actionUuid = "$pluginUuid.app-audio"
$acceptedDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\prototype\com.packrat.stream-deck-ultimate-bundle.sdPlugin"))
if ([string]::IsNullOrWhiteSpace($AssemblyPath)) { $AssemblyPath = Join-Path $PSScriptRoot "build\PackRatAppAudio.dll" }
if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $PSScriptRoot "v08-candidate-dist" }
if (-not [IO.Path]::IsPathRooted($AssemblyPath)) { $AssemblyPath = Join-Path (Get-Location) $AssemblyPath }
if (-not [IO.Path]::IsPathRooted($OutputRoot)) { $OutputRoot = Join-Path (Get-Location) $OutputRoot }
$AssemblyPath = [IO.Path]::GetFullPath($AssemblyPath)
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
if (-not (Test-Path -LiteralPath $acceptedDir)) { throw "Accepted v0.7.1 plugin directory missing: $acceptedDir" }
if (-not (Test-Path -LiteralPath $AssemblyPath)) { throw "Precompiled App Volume helper missing: $AssemblyPath" }

$acceptedManifestPath = Join-Path $acceptedDir "manifest.json"
$acceptedManifestHashBefore = (Get-FileHash -Algorithm SHA256 -LiteralPath $acceptedManifestPath).Hash.ToLowerInvariant()
if (Test-Path -LiteralPath $OutputRoot) { Remove-Item -Recurse -Force -LiteralPath $OutputRoot }
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$candidateDir = Join-Path $OutputRoot "$pluginUuid.sdPlugin"
Copy-Item -Recurse -Force -LiteralPath $acceptedDir -Destination $candidateDir

$appAudioDir = Join-Path $candidateDir "bin\app-audio"
New-Item -ItemType Directory -Force -Path $appAudioDir | Out-Null
$runtimeFiles = @(
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
)
foreach ($name in $runtimeFiles) {
  $source = Join-Path $PSScriptRoot $name
  if (-not (Test-Path -LiteralPath $source)) { throw "v0.8 candidate input missing: $name" }
  Copy-Item -LiteralPath $source -Destination (Join-Path $appAudioDir $name) -Force
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "v08-app-audio-adapter.js") -Destination (Join-Path $candidateDir "bin\lib-v08-app-audio.js") -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "plugin-v08-shadow.cjs") -Destination (Join-Path $candidateDir "bin\plugin-v08.cjs") -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "property-inspector.html") -Destination (Join-Path $candidateDir "ui\property-inspector-app-volume.html") -Force
Copy-Item -LiteralPath $AssemblyPath -Destination (Join-Path $appAudioDir "PackRatAppAudio.dll") -Force

$candidateManifestPath = Join-Path $candidateDir "manifest.json"
$manifest = Get-Content -LiteralPath $candidateManifestPath -Raw | ConvertFrom-Json
if ($manifest.UUID -ne $pluginUuid) { throw "Unexpected accepted plugin UUID: $($manifest.UUID)" }
if ($manifest.Version -ne "0.7.1.0") { throw "v0.8 candidate must stage from accepted v0.7.1.0, saw $($manifest.Version)" }
if (@($manifest.Actions | Where-Object { $_.UUID -eq $actionUuid }).Count -ne 0) { throw "Accepted v0.7.1 already contains App Volume; refusing duplicate promotion" }

$appAction = [pscustomobject][ordered]@{
  Controllers = @("Keypad","Encoder")
  Icon = "imgs/actions/audio/icon"
  Name = "App Volume"
  PropertyInspectorPath = "ui/property-inspector-app-volume.html"
  States = @([pscustomobject][ordered]@{
    Image = "imgs/actions/audio/key"
    ShowTitle = $true
    TitleAlignment = "middle"
    FontSize = 12
  })
  Tooltip = "Control the foreground app or a specific app's Windows audio-session volume with live volume and mute feedback."
  UserTitleEnabled = $false
  Encoder = [pscustomobject][ordered]@{
    Icon = "imgs/actions/audio/key"
    layout = '$B1'
    TriggerDescription = [pscustomobject][ordered]@{
      Push = "Mute or unmute app"
      Rotate = "Adjust app volume"
      Touch = "App volume"
    }
  }
  UUID = $actionUuid
}
$manifest.Actions = @($manifest.Actions) + @($appAction)
$manifest.CodePath = "bin/plugin-v08.cjs"
$manifest.Version = "0.8.0.0"
$manifest.Description = "A ready-to-use Windows control system for apps, adaptive context controls, workspaces, windows, clipboard, per-app audio, audio devices, microphone, routines, capture, media and everyday system controls, with privacy-safe diagnostics for support."
[IO.File]::WriteAllText($candidateManifestPath,($manifest | ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))

$helperPath = Join-Path $appAudioDir "PackRatAppAudio.dll"
$helperHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $helperPath).Hash.ToLowerInvariant()
$acceptedManifestHashAfter = (Get-FileHash -Algorithm SHA256 -LiteralPath $acceptedManifestPath).Hash.ToLowerInvariant()
if ($acceptedManifestHashAfter -ne $acceptedManifestHashBefore) { throw "Accepted v0.7.1 manifest changed while staging v0.8 candidate" }
$sourceFiles = @(Get-ChildItem -Recurse -File -LiteralPath $candidateDir | Where-Object { $_.Extension -eq '.cs' })
if ($sourceFiles.Count -ne 0) { throw "v0.8 candidate must not package C# source" }

$info = [ordered]@{
  schema = 1
  prepromotionOnly = $true
  installBeforeHardwareApproval = $false
  acceptedPluginUuid = $pluginUuid
  acceptedVersion = "0.7.1.0"
  candidateVersion = "0.8.0.0"
  actionUuid = $actionUuid
  codePath = "bin/plugin-v08.cjs"
  lazyWorker = $true
  acceptedSourceManifestSha256 = $acceptedManifestHashBefore
  helperSha256 = $helperHash
  sourceCommit = [string]$env:GITHUB_SHA
  acceptedSourceChanged = $false
}
[IO.File]::WriteAllText((Join-Path $candidateDir "V08_CANDIDATE_INFO.json"),($info | ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))

[pscustomobject]@{
  ok = $true
  candidateDir = $candidateDir
  pluginUuid = $pluginUuid
  actionUuid = $actionUuid
  version = "0.8.0.0"
  helperSha256 = $helperHash
  acceptedManifestSha256 = $acceptedManifestHashBefore
  fileCount = @(Get-ChildItem -Recurse -File -LiteralPath $candidateDir).Count
} | ConvertTo-Json -Compress

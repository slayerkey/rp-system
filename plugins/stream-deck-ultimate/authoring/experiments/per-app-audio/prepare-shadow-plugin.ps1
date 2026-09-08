param(
  [string]$AssemblyPath = "",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
$pluginUuid = "com.packrat.stream-deck-ultimate-app-volume-lab"
$actionUuid = "$pluginUuid.app-audio"
$acceptedActionUuid = "com.packrat.stream-deck-ultimate-bundle.app-audio"
if ([string]::IsNullOrWhiteSpace($AssemblyPath)) { $AssemblyPath = Join-Path $PSScriptRoot "build\PackRatAppAudio.dll" }
if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $PSScriptRoot "shadow-plugin-dist" }
if (-not [IO.Path]::IsPathRooted($AssemblyPath)) { $AssemblyPath = Join-Path (Get-Location) $AssemblyPath }
if (-not [IO.Path]::IsPathRooted($OutputRoot)) { $OutputRoot = Join-Path (Get-Location) $OutputRoot }
$AssemblyPath = [IO.Path]::GetFullPath($AssemblyPath)
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
if (-not (Test-Path -LiteralPath $AssemblyPath)) { throw "Precompiled helper missing: $AssemblyPath" }

if (Test-Path -LiteralPath $OutputRoot) { Remove-Item -Recurse -Force -LiteralPath $OutputRoot }
$pluginDir = Join-Path $OutputRoot "$pluginUuid.sdPlugin"
foreach ($dir in @(
  $pluginDir,
  (Join-Path $pluginDir "bin"),
  (Join-Path $pluginDir "ui"),
  (Join-Path $pluginDir "imgs\plugin"),
  (Join-Path $pluginDir "imgs\actions\app-audio")
)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

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
  if (-not (Test-Path -LiteralPath $source)) { throw "Shadow plugin input missing: $name" }
  Copy-Item -LiteralPath $source -Destination (Join-Path $pluginDir "bin\$name") -Force
}
# The shared experiment spec intentionally uses the future Ultimate action UUID. Rewrite only
# the staged lab copy so the co-installable test artifact contains no dormant accepted-product UUID.
$stagedActionSpec = Join-Path $pluginDir "bin\action-spec.js"
$actionSpecText = [IO.File]::ReadAllText($stagedActionSpec)
if (-not $actionSpecText.Contains($acceptedActionUuid)) { throw "Expected shared action UUID was not found in staged action-spec.js" }
$actionSpecText = $actionSpecText.Replace($acceptedActionUuid,$actionUuid)
[IO.File]::WriteAllText($stagedActionSpec,$actionSpecText,[Text.UTF8Encoding]::new($false))

Copy-Item -LiteralPath (Join-Path $PSScriptRoot "shadow-plugin-entry.cjs") -Destination (Join-Path $pluginDir "bin\plugin.cjs") -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "property-inspector.html") -Destination (Join-Path $pluginDir "ui\property-inspector.html") -Force
Copy-Item -LiteralPath $AssemblyPath -Destination (Join-Path $pluginDir "bin\PackRatAppAudio.dll") -Force

$package = [ordered]@{
  private = $true
  name = "packrat-ultimate-app-volume-lab"
  version = "0.8.0"
  dependencies = [ordered]@{ ws = "8.18.3" }
}
[IO.File]::WriteAllText((Join-Path $pluginDir "package.json"),($package | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))

$manifest = [ordered]@{
  '$schema' = "https://schemas.elgato.com/streamdeck/plugins/manifest.json"
  Actions = @(
    [ordered]@{
      Controllers = @("Keypad","Encoder")
      Icon = "imgs/actions/app-audio/icon"
      Name = "App Volume Lab"
      States = @([ordered]@{ Image = "imgs/actions/app-audio/key"; TitleAlignment = "middle"; FontSize = 12 })
      Tooltip = "Experimental PackRat App Volume: control the foreground app or a specific Windows audio app with live volume and mute feedback."
      Encoder = [ordered]@{
        Icon = "imgs/actions/app-audio/key"
        layout = '$B1'
        TriggerDescription = [ordered]@{
          Push = "Mute or unmute app"
          Rotate = "Adjust app volume"
          Touch = "App volume"
        }
      }
      UUID = $actionUuid
    }
  )
  Author = "Packrat"
  Category = "PackRat Labs"
  CategoryIcon = "imgs/plugin/category"
  CodePath = "bin/plugin.cjs"
  Description = "Isolated Windows App Volume hardware test for Stream Deck Ultimate. Installs beside the accepted Ultimate build and does not replace it."
  Icon = "imgs/plugin/marketplace"
  Name = "Ultimate App Volume Lab"
  Nodejs = [ordered]@{ Version = "20" }
  OS = @([ordered]@{ Platform = "windows"; MinimumVersion = "10" })
  PropertyInspectorPath = "ui/property-inspector.html"
  SDKVersion = 2
  Software = [ordered]@{ MinimumVersion = "6.6" }
  UUID = $pluginUuid
  Version = "0.8.0.1"
}
[IO.File]::WriteAllText((Join-Path $pluginDir "manifest.json"),($manifest | ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))

Add-Type -AssemblyName System.Drawing
function New-LabIcon([string]$Path,[int]$Size,[string]$Text,[bool]$Transparent = $false) {
  $bitmap = [System.Drawing.Bitmap]::new($Size,$Size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    if ($Transparent) { $g.Clear([System.Drawing.Color]::Transparent) }
    else { $g.Clear([System.Drawing.Color]::FromArgb(255,24,27,31)) }
    $pad = [Math]::Max(2,[int]($Size * 0.08))
    $penWidth = [Math]::Max(1,[single]($Size * 0.045))
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255,69,226,124),[single]$penWidth)
    try { $g.DrawEllipse($pen,$pad,$pad,$Size-(2*$pad)-1,$Size-(2*$pad)-1) } finally { $pen.Dispose() }
    $fontSize = [Math]::Max(6,[single]($Size * 0.25))
    $font = [System.Drawing.Font]::new("Segoe UI",[single]$fontSize,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $format = [System.Drawing.StringFormat]::new()
    try {
      $format.Alignment = [System.Drawing.StringAlignment]::Center
      $format.LineAlignment = [System.Drawing.StringAlignment]::Center
      $rect = [System.Drawing.RectangleF]::new([single]0,[single]0,[single]$Size,[single]$Size)
      $g.DrawString($Text,$font,$brush,$rect,$format)
    } finally {
      $format.Dispose(); $brush.Dispose(); $font.Dispose()
    }
    $bitmap.Save($Path,[System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $g.Dispose(); $bitmap.Dispose() }
}

New-LabIcon (Join-Path $pluginDir "imgs\plugin\marketplace.png") 256 "AV"
New-LabIcon (Join-Path $pluginDir "imgs\plugin\marketplace@2x.png") 512 "AV"
New-LabIcon (Join-Path $pluginDir "imgs\plugin\category.png") 28 "A"
New-LabIcon (Join-Path $pluginDir "imgs\plugin\category@2x.png") 56 "A"
New-LabIcon (Join-Path $pluginDir "imgs\actions\app-audio\icon.png") 20 "A" $true
New-LabIcon (Join-Path $pluginDir "imgs\actions\app-audio\icon@2x.png") 40 "A" $true
New-LabIcon (Join-Path $pluginDir "imgs\actions\app-audio\key.png") 72 "AV"
New-LabIcon (Join-Path $pluginDir "imgs\actions\app-audio\key@2x.png") 144 "AV"

$helperHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $pluginDir "bin\PackRatAppAudio.dll")).Hash.ToLowerInvariant()
$info = [ordered]@{
  schema = 1
  experimental = $true
  acceptedPluginChanged = $false
  sourceCommit = [string]$env:GITHUB_SHA
  pluginUuid = $pluginUuid
  actionUuid = $actionUuid
  helperSha256 = $helperHash
  runtimeFiles = $runtimeFiles.Count + 1
}
[IO.File]::WriteAllText((Join-Path $pluginDir "LAB_INFO.json"),($info | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))

[pscustomobject]@{
  ok = $true
  outputRoot = $OutputRoot
  pluginDir = $pluginDir
  pluginUuid = $pluginUuid
  actionUuid = $actionUuid
  helperSha256 = $helperHash
  fileCount = @(Get-ChildItem -Recurse -File -LiteralPath $pluginDir).Count
} | ConvertTo-Json -Compress

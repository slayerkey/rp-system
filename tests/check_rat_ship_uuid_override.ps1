$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $repo "tools\ship\streamdeck-marketplace-uuid.ps1")

$configPath = Join-Path $repo "tools\ship\streamdeck-marketplace-uuid-overrides.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json

$expected = @{
    "internet-health-pro" = "com.packrat.internet-health-pro2"
    "monitor-manager-lite" = "com.packrat.monitormanagerlite2"
    "monitor-manager-pro" = "com.packrat.monitormanagerpro2"
    "windows-settings-manager-lite" = "com.packrat.windows-settings-manager-lite2"
    "windows-settings-manager-pro" = "com.packrat.windows-settings-manager-pro2"
    "macro-recorder-lite" = "com.packrat.macro-recorder-lite2"
    "macro-recorder-pro" = "com.packrat.macro-recorder-pro2"
    "text-expander" = "com.packrat.textexpanderlite2"
    "text-expander-pro" = "com.packrat.textexpanderpro2"
    "wireless-device-manager" = "com.packrat.wireless-device-manager-lite2"
    "wireless-device-manager-pro" = "com.packrat.wireless-device-manager-pro2"
    "audio-manager-pro" = "com.packrat.audio-manager-pro2"
    "performance-grapher-streamdeck" = "com.packrat.performance-grapher2"
}
foreach ($slug in $expected.Keys) {
    $actual = Get-RatStreamDeckMarketplaceUuidOverride -RepoRoot $repo -PluginSlug $slug
    if ($actual -ne $expected[$slug]) { throw "UUID override mismatch for ${slug}: $actual" }
}
if ($config.products.PSObject.Properties["window-manager-pro"]) {
    throw "Window Manager Pro must not receive a fresh UUID because it updates an existing published Marketplace product."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$work = Join-Path ([System.IO.Path]::GetTempPath()) ("PackRat\uuid-test-" + [guid]::NewGuid().ToString("N"))
$plugin = Join-Path $work "com.packrat.fixture.sdPlugin"
New-Item -ItemType Directory -Force -Path (Join-Path $plugin "bin") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $plugin "profiles") | Out-Null
try {
    Set-Content -Path (Join-Path $plugin "manifest.json") -Encoding UTF8 -Value @'
{
  "UUID": "com.packrat.fixture",
  "Name": "Fixture",
  "Version": "1.0.0.0",
  "Actions": [
    { "UUID": "com.packrat.fixture.action", "Name": "Action", "States": [] }
  ]
}
'@
    Set-Content -Path (Join-Path $plugin "bin\plugin.js") -Encoding UTF8 -Value 'const ACTION="com.packrat.fixture.action";'

    $profileSource = Join-Path $work "profile-src"
    New-Item -ItemType Directory -Force -Path $profileSource | Out-Null
    Set-Content -Path (Join-Path $profileSource "manifest.json") -Encoding UTF8 -Value '{"UUID":"com.packrat.fixture.action"}'
    $profile = Join-Path $plugin "profiles\fixture.streamDeckProfile"
    [System.IO.Compression.ZipFile]::CreateFromDirectory($profileSource, $profile)

    $rewritten = Convert-RatStreamDeckPluginIdentity -PluginDirectory $plugin -NewUuid "com.packrat.fixture2"
    if ((Split-Path $rewritten -Leaf) -ne "com.packrat.fixture2.sdPlugin") { throw "Plugin folder was not renamed." }

    $manifest = Get-Content (Join-Path $rewritten "manifest.json") -Raw | ConvertFrom-Json
    if ($manifest.UUID -ne "com.packrat.fixture2") { throw "Plugin UUID was not rewritten." }
    if ($manifest.Actions[0].UUID -ne "com.packrat.fixture2.action") { throw "Action UUID was not rewritten." }

    $runtime = Get-Content (Join-Path $rewritten "bin\plugin.js") -Raw
    if ($runtime -notmatch 'com\.packrat\.fixture2\.action' -or $runtime -match 'com\.packrat\.fixture\.action') {
        throw "Runtime action UUID was not rewritten."
    }

    $profileOut = Join-Path $work "profile-out"
    [System.IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $rewritten "profiles\fixture.streamDeckProfile"), $profileOut)
    $profileJson = Get-Content (Join-Path $profileOut "manifest.json") -Raw
    if ($profileJson -notmatch 'com\.packrat\.fixture2\.action' -or $profileJson -match 'com\.packrat\.fixture\.action') {
        throw "Bundled profile action UUID was not rewritten."
    }
}
finally {
    if (Test-Path $work) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
}
Write-Host "STREAM DECK MARKETPLACE UUID REWRITE PASS"

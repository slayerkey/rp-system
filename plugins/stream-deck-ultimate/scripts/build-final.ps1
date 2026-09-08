param(
  [string]$OutputRoot = "",
  [switch]$SkipOfficialValidate
)

$ErrorActionPreference = "Stop"
$ProductRoot = Split-Path -Parent $PSScriptRoot
$Prototype = Join-Path $ProductRoot "authoring\prototype"
if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $ProductRoot ".build" }
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$Plugin = Join-Path $OutputRoot "com.packrat.stream-deck-ultimate-bundle.sdPlugin"
$Dist = Join-Path $ProductRoot "dist"

$stageLines = @(& (Join-Path $PSScriptRoot "stage-runtime.ps1") -OutputRoot $OutputRoot)
$stage = $stageLines[-1] | ConvertFrom-Json
if (-not $stage.ok -or $stage.hardwareFixes -ne "F1-F7 PASS") { throw "native recovery stage failed: $($stageLines -join [Environment]::NewLine)" }

python -m pip install -r (Join-Path $Prototype "requirements.txt") --disable-pip-version-check --quiet
if ($LASTEXITCODE -ne 0) { throw "prototype Python dependency install failed" }
python (Join-Path $Prototype "tools\generate_prototype_assets_v71.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "asset/profile generation failed" }
python (Join-Path $Prototype "tools\polish_context_art_v7.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "context art polish failed" }
python (Join-Path $PSScriptRoot "polish_icons.py") (Join-Path $Plugin "imgs\keys") --apply
if ($LASTEXITCODE -ne 0) { throw "accepted key-art polish failed" }

python (Join-Path $PSScriptRoot "apply_accepted_immutable.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "accepted immutable release restore failed" }
python (Join-Path $PSScriptRoot "whiten_manifest_icons.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "Elgato white app-list icon pass failed" }

python (Join-Path $PSScriptRoot "verify_hardware_fixes.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "hardware acceptance F1-F7 contract failed" }
python (Join-Path $PSScriptRoot "verify_accepted_immutable.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "accepted immutable release contract failed" }
python (Join-Path $PSScriptRoot "verify_key_art_contract.py") (Join-Path $Plugin "imgs\keys")
if ($LASTEXITCODE -ne 0) { throw "accepted key-art contract failed" }
python (Join-Path $PSScriptRoot "verify_white_icons.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "Elgato white icon contract failed" }

Push-Location $Plugin
try {
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "locked runtime dependency install failed" }
} finally { Pop-Location }

$m = Get-Content -LiteralPath (Join-Path $Plugin "manifest.json") -Raw | ConvertFrom-Json
if ($m.Name -ne "Stream Deck Ultimate" -or $m.Version -ne "1.0.0.0" -or $m.SDKVersion -ne 3 -or @($m.Actions).Count -ne 16) { throw "final v1.0 manifest contract drifted" }

if (-not $SkipOfficialValidate) {
  if (-not (Get-Command streamdeck -ErrorAction SilentlyContinue)) { throw "Elgato Stream Deck CLI is required" }
  streamdeck validate $Plugin --force-update-check
  if ($LASTEXITCODE -ne 0) { throw "streamdeck validate failed" }
  if (Test-Path -LiteralPath $Dist) { Remove-Item -Recurse -Force -LiteralPath $Dist }
  New-Item -ItemType Directory -Force -Path $Dist | Out-Null
  streamdeck pack $Plugin --output $Dist --force --no-file-list
  if ($LASTEXITCODE -ne 0) { throw "streamdeck pack failed" }
}

[pscustomobject]@{
  ok=$true
  sourceCommit="fc314e6f42fbe3e16da82a3af7aca75bda288e4f"
  plugin=$Plugin
  version=$m.Version
  actions=@($m.Actions).Count
  hardwareFixes="F1-F7 PASS"
  immutable="16 exact files PASS"
  keyArt="accepted pixel contract PASS"
  whiteIcons="32 assets PASS"
  validated=(-not $SkipOfficialValidate)
  dist=$Dist
} | ConvertTo-Json -Compress

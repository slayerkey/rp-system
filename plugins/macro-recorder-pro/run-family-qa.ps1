param(
  [switch]$SkipAudit,
  [switch]$SkipArt,
  [switch]$ReleaseCandidate
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $Root

Write-Host "== Macro Recorder local release QA ==" -ForegroundColor Cyan

if ($ReleaseCandidate -and ($SkipAudit -or $SkipArt)) {
  throw "-ReleaseCandidate cannot be combined with -SkipAudit or -SkipArt."
}

if ($ReleaseCandidate) {
  $GatePath = Join-Path $Root "docs\MACRO_RECORDER_NATIVE_GATE.json"
  if (-not (Test-Path $GatePath)) { throw "Missing native release gate: $GatePath" }
  $Gate = Get-Content $GatePath -Raw | ConvertFrom-Json
  $Open = @($Gate.blockers.PSObject.Properties | Where-Object { -not [bool]$_.Value } | ForEach-Object { $_.Name })
  if (-not $Gate.ready -or $Open.Count -gt 0) {
    $Reason = if ($Open.Count -gt 0) { $Open -join ", " } else { "ready=false" }
    throw "Release candidate blocked by native gates: $Reason"
  }
}

foreach ($cmd in @("dotnet","node","npm")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd is required." }
}
$NodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($NodeMajor -lt 24) { throw "Node 24+ is required." }

Write-Host "[1/8] Build exact Windows input host"
node "shared\windows-input\build-host.mjs" --force
$HelperExe = Join-Path $Root "artifacts\input-host\PackRat.InputHost.exe"
$HelperStamp = Join-Path $Root "artifacts\input-host\source.sha256"
if (-not (Test-Path $HelperExe)) { throw "PackRat.InputHost.exe was not produced." }
if (-not (Test-Path $HelperStamp)) { throw "Input-host source hash stamp was not produced." }

Write-Host "[2/8] Native helper self-test + daemon ping"
$SelfTest = & $HelperExe --selftest
if (($SelfTest -join "") -notmatch '"ok":true') { throw "Input host self-test failed: $SelfTest" }
$Ping = '{"id":"localqa","command":"ping"}' | & $HelperExe --daemon
if (($Ping -join "") -notmatch '"ok":true') { throw "Input host daemon ping failed: $Ping" }

function Test-ExactPackage {
  param(
    [Parameter(Mandatory=$true)][System.IO.FileInfo]$Package,
    [Parameter(Mandatory=$true)][string]$Slug
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $Archive = [System.IO.Compression.ZipFile]::OpenRead($Package.FullName)
  try {
    $EntryNames = @($Archive.Entries | ForEach-Object { $_.FullName.Replace([char]92, "/") })
    foreach ($Suffix in @(
      "/manifest.json",
      "/bin/plugin.js",
      "/helpers/PackRat.InputHost.exe",
      "/ui/inspector.html",
      "/THIRD_PARTY_NOTICES.txt",
      "/DOTNET_LICENSE.txt",
      "/DOTNET_THIRD_PARTY_NOTICES.txt"
    )) {
      if (-not ($EntryNames | Where-Object { $_.EndsWith($Suffix) })) {
        throw "$Slug exact package is missing $Suffix"
      }
    }

    $PackedProfiles = @($EntryNames | Where-Object { $_ -match "/profiles/.*\.streamDeckProfile$" })
    if ($PackedProfiles.Count -ne 5) {
      throw "$Slug exact package expected five profiles; found $($PackedProfiles.Count)."
    }
    if ($EntryNames | Where-Object { $_ -match "\.profile-map\.json$" }) {
      throw "$Slug exact package contains internal profile QA maps."
    }
  }
  finally {
    $Archive.Dispose()
  }
}

function Test-Plugin {
  param([Parameter(Mandatory=$true)][string]$Slug)

  $PluginRoot = Join-Path $Root "plugins\$Slug"
  Push-Location $PluginRoot
  try {
    Write-Host "[$Slug] npm ci"
    npm ci --no-fund --no-audit

    if (-not $SkipAudit) {
      Write-Host "[$Slug] production dependency audit"
      npm audit --omit=dev --audit-level=high
    }

    Write-Host "[$Slug] tests"
    npm test

    Write-Host "[$Slug] build"
    npm run build

    $BundleRoot = Join-Path $PluginRoot "com.packrat.$Slug.sdPlugin"
    $EmbeddedHelper = Join-Path $BundleRoot "helpers\PackRat.InputHost.exe"
    if (-not (Test-Path $EmbeddedHelper)) { throw "$Slug build did not embed PackRat.InputHost.exe." }
    if ((Get-Item $EmbeddedHelper).Length -le 0) { throw "$Slug embedded input host is empty." }

    foreach ($Notice in @("THIRD_PARTY_NOTICES.txt","DOTNET_LICENSE.txt","DOTNET_THIRD_PARTY_NOTICES.txt")) {
      $NoticePath = Join-Path $BundleRoot $Notice
      if (-not (Test-Path $NoticePath)) { throw "$Slug build is missing runtime notice $Notice." }
      if ((Get-Item $NoticePath).Length -le 0) { throw "$Slug runtime notice is empty: $Notice." }
    }

    $ProfileRoot = Join-Path $BundleRoot "profiles"
    $Profiles = @(Get-ChildItem $ProfileRoot -Filter *.streamDeckProfile -File)
    if ($Profiles.Count -ne 5) {
      throw "$Slug expected five bundled profiles (MK.2, Mini, XL, Plus, Neo); found $($Profiles.Count)."
    }
    foreach ($Suffix in @("mk2","mini","xl","plus","neo")) {
      $ProfileName = "$Slug-starter-$Suffix.streamDeckProfile"
      if (-not (Test-Path (Join-Path $ProfileRoot $ProfileName))) {
        throw "$Slug missing starter profile $ProfileName."
      }
      $Map = Join-Path $Root "artifacts\profile-maps\$Slug-starter-$Suffix.profile-map.json"
      if (-not (Test-Path $Map)) { throw "$Slug missing external profile QA map for $Suffix." }
    }
    if (@(Get-ChildItem $ProfileRoot -Filter *.profile-map.json -File -ErrorAction SilentlyContinue).Count -ne 0) {
      throw "$Slug must not ship internal profile-map JSON."
    }

    Write-Host "[$Slug] official Elgato validation"
    npm run validate

    Write-Host "[$Slug] official package"
    npm run pack

    $Packages = @(Get-ChildItem (Join-Path $PluginRoot "dist") -Filter *.streamDeckPlugin -File)
    if ($Packages.Count -ne 1) {
      throw "$Slug expected exactly one .streamDeckPlugin package; found $($Packages.Count)."
    }
    Test-ExactPackage -Package $Packages[0] -Slug $Slug

    Write-Host "[$Slug] SHA256"
    Get-FileHash $Packages[0].FullName -Algorithm SHA256 | Format-Table -AutoSize
  }
  finally {
    Pop-Location
  }
}

Write-Host "[3/8] Lite QA"
Test-Plugin -Slug "macro-recorder-lite"

Write-Host "[4/8] Pro QA"
Test-Plugin -Slug "macro-recorder-pro"

Write-Host "[5/8] Verify catalog-driven Lite upsell"
$Catalog = Get-Content (Join-Path $Root "products\lite-pro-map.json") -Raw | ConvertFrom-Json
$Pair = @($Catalog.pairs | Where-Object { $_.lite_id -eq "macro-recorder-lite" }) | Select-Object -First 1
if ($null -eq $Pair -or $Pair.pro_id -ne "macro-recorder-pro") {
  throw "Macro Recorder Lite/Pro canonical catalog pair is missing."
}
$CanonicalProUrl = [string]$Pair.pro_marketplace_url
$BuiltLiteInspector = Get-Content (Join-Path $Root "plugins\macro-recorder-lite\com.packrat.macro-recorder-lite.sdPlugin\ui\inspector.html") -Raw
$ExpectedAttribute = 'data-pro-url="' + $CanonicalProUrl + '"'
if ($BuiltLiteInspector -notlike "*$ExpectedAttribute*") {
  throw "Built Lite inspector Pro URL does not match products/lite-pro-map.json."
}
$LiteProduct = Get-Content (Join-Path $Root "products\macro-recorder-lite.json") -Raw | ConvertFrom-Json
if ($LiteProduct.workflow_state -eq "READY_TO_SHIP" -and [string]::IsNullOrWhiteSpace($CanonicalProUrl)) {
  throw "Macro Recorder Lite cannot be READY_TO_SHIP without a verified direct Pro Marketplace URL."
}

if (-not $SkipArt) {
  Write-Host "[6/8] Marketplace art + Rat Ship adapters"
  if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python is required unless -SkipArt is used." }
  python -c "import PIL" 2>$null
  if ($LASTEXITCODE -ne 0) {
    python -m pip install --disable-pip-version-check pillow
    if ($LASTEXITCODE -ne 0) { throw "Pillow installation failed." }
  }

  foreach ($Slug in @("macro-recorder-lite","macro-recorder-pro")) {
    $SourceMedia = Join-Path $Root "artifacts\marketplace\$Slug"
    New-Item -ItemType Directory -Force -Path $SourceMedia | Out-Null
    python "tools\art\macro_recorder_art.py" --slug $Slug --out (Join-Path $SourceMedia "01-hero.png")
    if ($LASTEXITCODE -ne 0) { throw "$Slug Marketplace art render failed." }

    $ShipMedia = Join-Path $Root "artifacts\ship-media\$Slug"
    & (Join-Path $Root "plugins\$Slug\rat-art.ps1") -Destination $ShipMedia
    $Expected = @(
      "01_search_icon.png",
      "02_cover.png",
      "03_gallery_01.png",
      "04_gallery_02.png",
      "05_gallery_03.png",
      "06_gallery_04.png"
    )
    foreach ($Name in $Expected) {
      if (-not (Test-Path (Join-Path $ShipMedia $Name) -PathType Leaf)) {
        throw "$Slug Rat Ship media is missing $Name."
      }
    }
  }
}
else {
  Write-Host "[6/8] Marketplace art skipped"
}

Write-Host "[7/8] Verify release outputs"
foreach ($Path in @(
  "plugins\macro-recorder-lite\dist",
  "plugins\macro-recorder-pro\dist",
  "artifacts\input-host\PackRat.InputHost.exe",
  "artifacts\input-host\source.sha256"
)) {
  if (-not (Test-Path (Join-Path $Root $Path))) { throw "Missing expected output: $Path" }
}

$HelperMb = [math]::Round((Get-Item $HelperExe).Length / 1MB, 2)
Write-Host "Native helper size: $HelperMb MB"
foreach ($Slug in @("macro-recorder-lite","macro-recorder-pro")) {
  $Package = @(Get-ChildItem (Join-Path $Root "plugins\$Slug\dist") -Filter *.streamDeckPlugin -File)
  if ($Package.Count -eq 1) {
    $PackageMb = [math]::Round($Package[0].Length / 1MB, 2)
    Write-Host "$Slug package size: $PackageMb MB"
  }
}

Write-Host "[8/8] Automated local QA complete" -ForegroundColor Green
if ($ReleaseCandidate) { Write-Host "Native release gate is marked ready." -ForegroundColor Green }
Write-Host ""
Write-Host "Still required before READY_TO_SHIP:" -ForegroundColor Yellow
Write-Host "  - every false condition in docs\MACRO_RECORDER_NATIVE_GATE.json resolved"
Write-Host "  - real recording/playback smoke on Windows"
Write-Host "  - modifiers, extended/right-side keys, and Windows key"
Write-Host "  - Pro click/drag/wheel"
Write-Host "  - multi-monitor + 100/125/150% DPI"
Write-Host "  - Stop and Ctrl+Shift+F12 interruption"
Write-Host "  - Lite/Pro coexistence and shared journal ownership"
Write-Host "  - helper/process restart + held-input recovery"
Write-Host "  - Pro loop cancellation + corrupt library recovery"
Write-Host "  - verified exact Pro Marketplace URL before public Lite launch"
Write-Host ""
Write-Host "Do not ship until those checks pass."

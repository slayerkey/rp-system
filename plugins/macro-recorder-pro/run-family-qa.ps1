param(
  [switch]$SkipAudit,
  [switch]$SkipArt,
  [switch]$ReleaseCandidate
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

Write-Host "== Macro Recorder local release QA ==" -ForegroundColor Cyan

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw "dotnet 8 SDK is required." }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is required." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is required." }

$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 24) { throw "Node 24+ is required for the packaged Stream Deck runtime/build." }

$HelperOut = Join-Path $Root "artifacts\input-host"
New-Item -ItemType Directory -Force -Path $HelperOut | Out-Null

Write-Host "[1/7] Publishing Windows input host"
dotnet publish "shared\windows-input\PackRat.InputHost\PackRat.InputHost.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:DebugType=None -p:DebugSymbols=false -o $HelperOut

$HelperExe = Join-Path $HelperOut "PackRat.InputHost.exe"
if (-not (Test-Path $HelperExe)) { throw "PackRat.InputHost.exe was not produced." }

Write-Host "[2/7] Native helper self-test + daemon ping"
$SelfTest = & $HelperExe --selftest
if (($SelfTest -join "") -notmatch '"ok":true') { throw "Input host self-test failed: $SelfTest" }
$Ping = '{"id":"localqa","command":"ping"}' | & $HelperExe --daemon
if (($Ping -join "") -notmatch '"ok":true') { throw "Input host daemon ping failed: $Ping" }

function Test-Plugin {
  param([Parameter(Mandatory=$true)][string]$Slug)

  $PluginRoot = Join-Path $Root "plugins\$Slug"
  Push-Location $PluginRoot
  try {
    Write-Host "[$Slug] npm ci"
    npm ci --no-fund --no-audit

    if (-not $SkipAudit) {
      Write-Host "[$Slug] dependency audit"
      npm audit --omit=dev --audit-level=high
    }

    Write-Host "[$Slug] unit tests"
    npm test

    Write-Host "[$Slug] build"
    npm run build

    $EmbeddedHelper = Join-Path $PluginRoot "com.packrat.$Slug.sdPlugin\helpers\PackRat.InputHost.exe"
    if (-not (Test-Path $EmbeddedHelper)) { throw "$Slug build did not embed PackRat.InputHost.exe." }
    if ((Get-Item $EmbeddedHelper).Length -le 0) { throw "$Slug embedded input host is empty." }

    Write-Host "[$Slug] Elgato validation"
    npm run validate

    Write-Host "[$Slug] package"
    npm run pack

    $Packages = @(Get-ChildItem (Join-Path $PluginRoot "dist") -Filter *.streamDeckPlugin -File)
    if ($Packages.Count -ne 1) { throw "$Slug expected exactly one .streamDeckPlugin package; found $($Packages.Count)." }

    $Profiles = @(Get-ChildItem (Join-Path $PluginRoot "com.packrat.$Slug.sdPlugin\profiles") -Filter *.streamDeckProfile -File)
    if ($Profiles.Count -ne 1) { throw "$Slug expected exactly one bundled .streamDeckProfile; found $($Profiles.Count)." }

    Write-Host "[$Slug] package SHA256"
    Get-FileHash $Packages[0].FullName -Algorithm SHA256 | Format-Table -AutoSize
  }
  finally {
    Pop-Location
  }
}

Write-Host "[3/7] Lite QA"
Test-Plugin -Slug "macro-recorder-lite"

Write-Host "[4/7] Pro QA"
Test-Plugin -Slug "macro-recorder-pro"

if (-not $SkipArt) {
  Write-Host "[5/7] Marketplace art"
  if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python is required unless -SkipArt is used." }
  python -c "import PIL" 2>$null
  if ($LASTEXITCODE -ne 0) { python -m pip install --disable-pip-version-check pillow }
  python "tools\art\macro_recorder_art.py" --slug macro-recorder-lite --out "artifacts\marketplace\macro-recorder-lite\01-hero.png"
  python "tools\art\macro_recorder_art.py" --slug macro-recorder-pro --out "artifacts\marketplace\macro-recorder-pro\01-hero.png"
} else {
  Write-Host "[5/7] Marketplace art skipped"
}

Write-Host "[6/7] Verify release outputs"
$Expected = @(
  "plugins\macro-recorder-lite\dist",
  "plugins\macro-recorder-pro\dist",
  "artifacts\input-host\PackRat.InputHost.exe"
)
foreach ($Path in $Expected) {
  if (-not (Test-Path (Join-Path $Root $Path))) { throw "Missing expected output: $Path" }
}

if (-not $SkipArt) {
  foreach ($Slug in @("macro-recorder-lite","macro-recorder-pro")) {
    $AppIcon = Join-Path $Root "artifacts\marketplace\$Slug\00-app-icon.png"
    if (-not (Test-Path $AppIcon)) { throw "Missing 288x288 Marketplace app icon: $AppIcon" }
  }
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

if ($ReleaseCandidate) {
  $GatePath = Join-Path $Root "docs\MACRO_RECORDER_NATIVE_GATE.json"
  if (-not (Test-Path $GatePath)) { throw "Missing native release gate: $GatePath" }
  $Gate = Get-Content $GatePath -Raw | ConvertFrom-Json
  if (-not $Gate.ready) {
    $Open = @($Gate.blockers.PSObject.Properties | Where-Object { -not [bool]$_.Value } | ForEach-Object { $_.Name })
    throw "Release candidate blocked by native gates: $($Open -join ', ')"
  }
}

Write-Host "[7/7] Automated local QA complete" -ForegroundColor Green
if ($ReleaseCandidate) { Write-Host "Native release gate is marked ready." -ForegroundColor Green }
Write-Host ""
Write-Host "Still required before READY_TO_SHIP:" -ForegroundColor Yellow
Write-Host "  - real recording/playback smoke on Windows"
Write-Host "  - modifiers and Windows key"
Write-Host "  - Pro click/drag/wheel"
Write-Host "  - multi-monitor + 100/125/150% DPI"
Write-Host "  - interrupt playback with Stop and Ctrl+Shift+F12"
Write-Host "  - kill helper during held modifier, restart, confirm recovery"
Write-Host "  - Stream Deck restart persistence"
Write-Host "  - Pro loop cancellation + corrupt library recovery"
Write-Host ""
Write-Host "Do not ship until those host/device checks pass."
Write-Host ""
Write-Host "For the final release-candidate gate after native fixes:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File .\plugins\macro-recorder-pro\run-family-qa.ps1 -ReleaseCandidate"

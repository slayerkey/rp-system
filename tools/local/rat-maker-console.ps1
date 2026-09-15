param(
    [Parameter(Mandatory = $true)]
    [string]$Slug,

    [Parameter(Mandatory = $true)]
    [string]$Kit,

    [switch]$Submit
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ShipToolRoot = Join-Path $RepoRoot "tools\ship"
$MakerProfile = Join-Path $env:LOCALAPPDATA "PackRat\maker-console-profile"

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $Hint"
    }
}

function Ensure-MakerConsoleRuntime {
    Require-Command "node" "Install Node.js first."
    Require-Command "npm" "Install Node.js first."

    $playwrightModule = Join-Path $ShipToolRoot "node_modules\playwright"
    Push-Location $ShipToolRoot
    try {
        if (-not (Test-Path $playwrightModule)) {
            Write-Host "Installing the Rat Ship browser runtime once..." -ForegroundColor Cyan
            & npm install --no-fund --no-audit | Out-Host
            if ($LASTEXITCODE -ne 0) {
                throw "Could not install the Rat Ship browser runtime."
            }
        }

        & node -e "import('playwright').then(({chromium})=>process.exit(require('fs').existsSync(chromium.executablePath())?0:2)).catch(()=>process.exit(3))" *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Installing Chromium for the Rat Ship browser runtime once..." -ForegroundColor Cyan
            & npx playwright install chromium | Out-Host
            if ($LASTEXITCODE -ne 0) {
                throw "Could not install Chromium for Rat Ship."
            }
        }
    }
    finally {
        Pop-Location
    }
}

function Open-RecoveryLog {
    $logZip = Join-Path $Kit "log.zip"
    $logDir = Join-Path $Kit "log"
    if (Test-Path $logZip) {
        Write-Host "Opening Rat Ship recovery ZIP for easy sharing:`n$logZip" -ForegroundColor Yellow
        Start-Process explorer.exe -ArgumentList "/select,`"$logZip`""
        return
    }
    if (Test-Path $logDir) {
        Write-Host "Opening Rat Ship recovery log folder:`n$logDir" -ForegroundColor Yellow
        Start-Process explorer.exe $logDir
    }
}

if (-not (Test-Path $Kit)) {
    throw "Rat Ship kit not found: $Kit"
}
$submissionPath = Join-Path $Kit "submission.json"
if (-not (Test-Path $submissionPath)) {
    throw "Rat Ship kit is missing submission.json: $Kit"
}
$submission = Get-Content $submissionPath -Raw | ConvertFrom-Json
if ($submission.slug -ne $Slug) {
    throw "Rat Ship kit submission slug '$($submission.slug)' does not match requested '$Slug'."
}
if ($null -eq $submission.price_usd) {
    throw "Marketplace price has not been explicitly approved for '$Slug'. Set submission.price_usd before rat stage or rat ship creates a Maker Console product. rat kit remains available without a price."
}

Ensure-MakerConsoleRuntime
$driver = Join-Path $ShipToolRoot "maker_console.mjs"
if (-not (Test-Path $driver)) {
    throw "Maker Console driver not found: $driver"
}

$noRetry = Join-Path $Kit "log\NO_RETRY.txt"

Write-Host "Launching Maker Console for '$Slug'..." -ForegroundColor Cyan
Write-Host "Your local Maker Console login is reused automatically. If Elgato asks you to sign in, complete it once in the opened browser and Rat Ship will continue." -ForegroundColor Yellow

$nodeArgs = @($driver, $Slug, "--kit=$Kit", "--profile=$MakerProfile")
if ($Submit) { $nodeArgs += "--submit" }

Push-Location $RepoRoot
try {
    & node @nodeArgs | Out-Host
    $code = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($code -eq 0) {
    if ($Submit) {
        Write-Host "Rat Ship submitted '$Slug' to Maker Console." -ForegroundColor Green
    }
    else {
        Write-Host "Rat Ship staged '$Slug' in Maker Console without submitting." -ForegroundColor Green
    }
    exit 0
}

if (Test-Path $noRetry) {
    $reason = (Get-Content $noRetry -Raw).Trim()
    Write-Host "Rat Ship found a draft state that is unsafe to retry automatically." -ForegroundColor Red
    if ($reason) { Write-Host $reason -ForegroundColor Yellow }
}
else {
    Write-Host "Maker Console failed for '$Slug'. Rat Ship will NOT reopen or resume the same draft automatically." -ForegroundColor Red
}

Open-RecoveryLog
$logDir = Join-Path $Kit "log"
throw "Maker Console failed. The ship kit is still safe at $Kit. Recovery screenshots, error text, state, and log.zip are in $logDir"

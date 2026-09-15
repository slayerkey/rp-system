param(
    [Parameter(Mandatory = $true)]
    [string]$Slug,

    [string]$OutputRoot
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $OutputRoot) {
    $OutputRoot = Join-Path $RepoRoot "out\art-preview"
}
if (-not [System.IO.Path]::IsPathRooted($OutputRoot)) {
    $OutputRoot = Join-Path $RepoRoot $OutputRoot
}

if ($Slug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
    throw "Invalid Stream Deck product slug: $Slug"
}

$productPath = Join-Path $RepoRoot "products\$Slug.json"
if (-not (Test-Path $productPath -PathType Leaf)) {
    throw "Product registry entry not found: $productPath"
}
$product = Get-Content $productPath -Raw | ConvertFrom-Json
if ($product.type -ne "plugin") {
    throw "Rat Art preview currently supports Stream Deck plugin products; '$Slug' is '$($product.type)'."
}
if (-not $product.source) {
    throw "Product '$Slug' does not declare a source path."
}

$sourceDir = Join-Path $RepoRoot ([string]$product.source -replace '/', '\')
if (-not (Test-Path $sourceDir -PathType Container)) {
    throw "Product source directory is missing: $sourceDir"
}

$submissionPath = $null
if ($product.submission_metadata) {
    $submissionPath = Join-Path $RepoRoot ([string]$product.submission_metadata -replace '/', '\')
}
else {
    $submissionPath = Join-Path $sourceDir "submission.json"
}
if (-not (Test-Path $submissionPath -PathType Leaf)) {
    throw "Product submission metadata is missing: $submissionPath"
}

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $Hint"
    }
}

Require-Command "python" "Install Python 3.12 or newer."
Require-Command "node" "Install Node.js."
Require-Command "npm" "Install Node.js."

$destination = Join-Path $OutputRoot $Slug
if (Test-Path $destination) {
    Remove-Item $destination -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $destination | Out-Null

# Build first when the product owns a build step so generated plugin bundles,
# manifests, profiles, and runtime art are current before we render marketing.
$packageJson = Join-Path $sourceDir "package.json"
if (Test-Path $packageJson -PathType Leaf) {
    Push-Location $sourceDir
    try {
        $packageLock = Join-Path $sourceDir "package-lock.json"
        if (Test-Path $packageLock -PathType Leaf) {
            & npm ci --no-fund --no-audit | Out-Host
        }
        else {
            & npm install --no-fund --no-audit | Out-Host
        }
        if ($LASTEXITCODE -ne 0) {
            throw "Dependency install failed for '$Slug'."
        }

        $pkg = Get-Content $packageJson -Raw | ConvertFrom-Json
        if ($pkg.scripts -and $pkg.scripts.build) {
            & npm run build | Out-Host
            if ($LASTEXITCODE -ne 0) {
                throw "Build failed for '$Slug'."
            }
        }
    }
    finally {
        Pop-Location
    }
}

$pluginDir = $null
if ($product.ship_plugin_dir) {
    $pluginDir = Join-Path $sourceDir ([string]$product.ship_plugin_dir -replace '/', '\')
}
if (-not $pluginDir -or -not (Test-Path $pluginDir -PathType Container)) {
    if ($product.plugin_uuid) {
        $candidate = Join-Path $sourceDir "$($product.plugin_uuid).sdPlugin"
        if (Test-Path $candidate -PathType Container) {
            $pluginDir = $candidate
        }
    }
}
if (-not $pluginDir -or -not (Test-Path $pluginDir -PathType Container)) {
    $matches = @(Get-ChildItem -Path $sourceDir -Directory -Recurse -Filter "*.sdPlugin" |
        Where-Object { Test-Path (Join-Path $_.FullName "manifest.json") })
    if ($product.plugin_uuid) {
        $exact = @($matches | Where-Object { $_.Name -eq "$($product.plugin_uuid).sdPlugin" })
        if ($exact.Count -eq 1) {
            $pluginDir = $exact[0].FullName
        }
    }
    if (-not $pluginDir -and $matches.Count -eq 1) {
        $pluginDir = $matches[0].FullName
    }
}
if (-not $pluginDir -or -not (Test-Path (Join-Path $pluginDir "manifest.json") -PathType Leaf)) {
    throw "Could not resolve the built Stream Deck plugin directory for '$Slug'."
}

$artScript = Join-Path $sourceDir "rat-art.ps1"
if (-not (Test-Path $artScript -PathType Leaf)) {
    throw "Product Rat Art entry point is missing: $artScript"
}

Write-Host "Rat Art preview: render product-local gallery..." -ForegroundColor Cyan
& $artScript -Destination $destination | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw "Product Rat Art failed for '$Slug'."
}

# This is the critical parity step: preview uses the same final hero renderer and
# the same key-source precedence as Rat Ship before the artifact is reviewed.
$renderer = Join-Path $RepoRoot "tools\art\render_streamdeck_ship_hero.py"
$hero = Join-Path $destination "02_cover.png"
$keysDir = Join-Path $destination "rat-art-keys"
$keyFixtures = Join-Path $destination "rat-art-key-fixtures.json"

$heroArgs = @(
    $renderer,
    "--product", $Slug,
    "--plugin-dir", $pluginDir,
    "--submission", $submissionPath,
    "--out", $hero
)
$needsSvgRuntime = $false
if (Test-Path $keysDir -PathType Container) {
    $heroArgs += @("--keys-dir", $keysDir)
}
elseif (Test-Path $keyFixtures -PathType Leaf) {
    $heroArgs += @("--key-fixtures", $keyFixtures)
    $needsSvgRuntime = $true
}
else {
    $needsSvgRuntime = $true
}

if ($needsSvgRuntime) {
    $toolsRoot = Join-Path $RepoRoot "tools"
    $playwrightModule = Join-Path $toolsRoot "node_modules\playwright"
    if (-not (Test-Path $playwrightModule -PathType Container)) {
        & npm install --prefix $toolsRoot --no-save --package-lock=false --no-fund --no-audit "playwright@1.62.1" | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "Could not install canonical Playwright runtime for '$Slug'."
        }
    }

    Push-Location $toolsRoot
    try {
        & node -e "import('playwright').then(({chromium})=>process.exit(require('fs').existsSync(chromium.executablePath())?0:2)).catch(()=>process.exit(3))" *> $null
        if ($LASTEXITCODE -ne 0) {
            & npx playwright install chromium | Out-Host
            if ($LASTEXITCODE -ne 0) {
                throw "Could not install canonical Chromium runtime for '$Slug'."
            }
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host "Rat Art preview: apply canonical final Rat Ship hero..." -ForegroundColor Cyan
& python @heroArgs | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw "Canonical final Stream Deck hero failed for '$Slug'."
}

$required = @(
    "02_cover.png",
    "03_gallery_01.png",
    "04_gallery_02.png",
    "05_gallery_03.png",
    "06_gallery_04.png"
)
$missing = @($required | Where-Object { -not (Test-Path (Join-Path $destination $_) -PathType Leaf) })
if ($missing.Count) {
    throw "Final art preview is incomplete: $($missing -join ', ')"
}

$sheet = Join-Path $destination "review-contact-sheet.png"
$sheetBuilder = Join-Path $RepoRoot "tools\art\build_marketplace_contact_sheet.py"
& python $sheetBuilder --input $destination --output $sheet | Out-Host
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $sheet -PathType Leaf)) {
    throw "Marketplace contact sheet generation failed for '$Slug'."
}

Write-Host ""
Write-Host "Rat Art preview ready." -ForegroundColor Green
Write-Host "  product: $Slug"
Write-Host "  source:  $sourceDir"
Write-Host "  plugin:  $pluginDir"
Write-Host "  media:   $destination"
Write-Host "  sheet:   $sheet"
Write-Host "  Maker Console: NOT TOUCHED" -ForegroundColor DarkGray

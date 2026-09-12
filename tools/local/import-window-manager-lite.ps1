param(
    [string]$LegacyRepo = "C:\Users\Key\Videos\Claude Projects\ratpack-projects",
    [string]$CanonicalRepo = "",
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $CanonicalRepo) {
    $CanonicalRepo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$LegacyRepo = [IO.Path]::GetFullPath($LegacyRepo)
$CanonicalRepo = [IO.Path]::GetFullPath($CanonicalRepo)
$registryPath = Join-Path $LegacyRepo "registry.json"

if (-not (Test-Path -LiteralPath $registryPath -PathType Leaf)) {
    throw "Legacy registry not found: $registryPath"
}

$registry = Get-Content -LiteralPath $registryPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $registry.products) {
    throw "Legacy registry does not contain a products object."
}

$product = $registry.products.'window-manager'
if (-not $product) {
    throw "Legacy registry does not contain products['window-manager']."
}
if (-not $product.paths -or -not $product.paths.dir) {
    throw "Window Manager Lite registry entry does not contain paths.dir."
}

$sourceDir = Join-Path $LegacyRepo ([string]$product.paths.dir)
$sourceDir = [IO.Path]::GetFullPath($sourceDir)
if (-not (Test-Path -LiteralPath $sourceDir -PathType Container)) {
    throw "Window Manager Lite source directory from registry does not exist: $sourceDir"
}

$destination = Join-Path $CanonicalRepo "plugins\window-manager"
$baselineDir = Join-Path $CanonicalRepo "docs\baselines\window-manager-lite"
$baselineManifest = Join-Path $baselineDir "manifest-before-xeneon.json"
$baselineActions = Join-Path $baselineDir "visible-actions-before-xeneon.json"
$baselineMeta = Join-Path $baselineDir "baseline.json"
$proUrl = "https://marketplace.elgato.com/product/window-manager-pro-f3ed6217-0282-419d-a71d-4b1548147b11"

$manifestCandidates = @(
    Get-ChildItem -LiteralPath $sourceDir -Recurse -File -Filter manifest.json |
        Where-Object { $_.Directory.Name -like "*.sdPlugin" }
)
if ($manifestCandidates.Count -ne 1) {
    $paths = ($manifestCandidates | ForEach-Object FullName) -join [Environment]::NewLine
    throw "Expected exactly one Stream Deck plugin manifest under Window Manager Lite, found $($manifestCandidates.Count).$([Environment]::NewLine)$paths"
}

$manifestPath = $manifestCandidates[0].FullName
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $manifest.Actions -or @($manifest.Actions).Count -eq 0) {
    throw "Window Manager Lite baseline manifest has no Actions."
}

$visibleActions = @(
    foreach ($action in @($manifest.Actions)) {
        $visible = $true
        if ($null -ne $action.VisibleInActionsList) {
            $visible = [bool]$action.VisibleInActionsList
        }
        if ($visible) {
            [ordered]@{
                UUID = [string]$action.UUID
                Name = [string]$action.Name
            }
        }
    }
) | Sort-Object UUID, Name

if ($visibleActions.Count -eq 0) {
    throw "Window Manager Lite baseline has zero visible actions."
}

$textExtensions = @(".html",".htm",".js",".mjs",".cjs",".ts",".tsx",".json",".md",".txt")
$proHits = @()
foreach ($file in Get-ChildItem -LiteralPath $sourceDir -Recurse -File) {
    if ($textExtensions -notcontains $file.Extension.ToLowerInvariant()) { continue }
    if ($file.FullName -match "[\\/]node_modules[\\/]") { continue }
    try {
        $raw = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
        if ($raw.Contains($proUrl)) {
            $proHits += $file.FullName.Substring($sourceDir.Length).TrimStart("\","/")
        }
    } catch {}
}

if ($proHits.Count -eq 0) {
    throw "Could not find the current Window Manager Pro Marketplace URL in the Lite source. Refusing to migrate without an upsell baseline."
}

if (Test-Path -LiteralPath $destination) {
    if (-not $Force) {
        throw "Canonical destination already exists: $destination. Re-run with -Force only if you intentionally want to replace the migrated copy."
    }
    Remove-Item -LiteralPath $destination -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $destination | Out-Null
New-Item -ItemType Directory -Force -Path $baselineDir | Out-Null

$excludeDirs = @("node_modules",".git","__pycache__",".pytest_cache",".mypy_cache")
$robocopyArgs = @(
    $sourceDir,
    $destination,
    "/E",
    "/COPY:DAT",
    "/DCOPY:DAT",
    "/R:2",
    "/W:1",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/NP",
    "/XD"
) + $excludeDirs

& robocopy @robocopyArgs | Out-Null
$robocopyExit = $LASTEXITCODE
if ($robocopyExit -gt 7) {
    throw "robocopy failed with exit code $robocopyExit"
}

Copy-Item -LiteralPath $manifestPath -Destination $baselineManifest -Force
$visibleActions | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $baselineActions -Encoding UTF8

$relativeManifest = $manifestPath.Substring($sourceDir.Length).TrimStart("\","/")
$baseline = [ordered]@{
    captured_at_utc = [DateTime]::UtcNow.ToString("o")
    legacy_repo = $LegacyRepo
    legacy_registry_product = "window-manager"
    legacy_source_relative = [string]$product.paths.dir
    source_manifest_relative = $relativeManifest
    source_version = [string]$manifest.Version
    source_name = [string]$manifest.Name
    source_uuid = [string]$manifest.UUID
    visible_action_count = $visibleActions.Count
    visible_actions = $visibleActions
    pro_marketplace_url = $proUrl
    pro_upsell_source_files = @($proHits | Sort-Object -Unique)
    canonical_destination = "plugins/window-manager"
    integration_status = "baseline_only_not_yet_modified"
}
$baseline | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $baselineMeta -Encoding UTF8

$copiedManifest = Join-Path $destination $relativeManifest
if (-not (Test-Path -LiteralPath $copiedManifest -PathType Leaf)) {
    throw "Copied Lite manifest missing from canonical destination: $copiedManifest"
}

& node (Join-Path $CanonicalRepo "tools\qa\window-manager-lite-conversion-guard.mjs") $baselineManifest $copiedManifest $destination
if ($LASTEXITCODE -ne 0) {
    throw "Window Manager Lite conversion baseline guard failed immediately after import."
}

Write-Host ""
Write-Host "Window Manager Lite source imported and baselined." -ForegroundColor Green
Write-Host "Legacy source: $sourceDir"
Write-Host "Canonical source: $destination"
Write-Host "Manifest: $relativeManifest"
Write-Host "Version: $($manifest.Version)"
Write-Host "Visible Lite actions: $($visibleActions.Count)"
Write-Host "Pro upsell baseline: preserved"
Write-Host ""
Write-Host "No Lite feature code was changed by this importer."
Write-Host "Next canonical step: inspect plugins/window-manager, integrate shared/window-manager-xeneon-service, then rerun the conversion guard."

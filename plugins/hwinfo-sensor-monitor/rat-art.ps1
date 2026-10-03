param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$renderer = Join-Path $source "scripts\rat-art.py"
if (-not (Test-Path $renderer -PathType Leaf)) {
    throw "HWiNFO product gallery renderer is missing: $renderer"
}

& python -c "import PIL,sys;sys.exit(0 if PIL.__version__ == '12.3.0' else 1)" *> $null
if ($LASTEXITCODE -ne 0) {
    & python -m pip install --disable-pip-version-check "Pillow==12.3.0"
    if ($LASTEXITCODE -ne 0) { throw "Could not install pinned Pillow runtime for HWiNFO Marketplace art." }
}

# Build product-specific gallery images and 15 representative key faces.
# The shared Rat Ship pipeline applies the campaign and final canonical hero once.
& python $renderer --out $Destination --skip-hero --skip-campaign
if ($LASTEXITCODE -ne 0) {
    throw "HWiNFO product Marketplace art generation failed with exit code $LASTEXITCODE."
}
$icon = Join-Path $Destination "01_icon.png"
if (-not (Test-Path $icon -PathType Leaf)) { throw "Missing generated HWiNFO Marketplace icon." }
Copy-Item $icon (Join-Path $Destination "01_search_icon.png") -Force

foreach ($file in @("01_search_icon.png","03_gallery_01.png","04_gallery_02.png","05_gallery_03.png","06_gallery_04.png")) {
    if (-not (Test-Path (Join-Path $Destination $file) -PathType Leaf)) {
        throw "Missing HWiNFO Marketplace art output: $file"
    }
}
Write-Host "HWiNFO product Rat Art complete. Canonical gallery campaign and hero follow." -ForegroundColor Green

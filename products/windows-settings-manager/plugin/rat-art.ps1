param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python is required for Windows Settings Manager Rat Art."
}
& python -c "import PIL,sys; sys.exit(0 if PIL.__version__ == '12.3.0' else 1)" *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Windows Settings Manager Rat Art: installing deterministic Pillow 12.3.0..." -ForegroundColor DarkGray
    & python -m pip install --disable-pip-version-check Pillow==12.3.0
    if ($LASTEXITCODE -ne 0) {
        throw "Could not install deterministic Pillow 12.3.0 for Windows Settings Manager Rat Art."
    }
}
$leaf = Split-Path -Leaf $Destination
$flavor = switch ($leaf) {
    "windows-settings-manager-lite" { "lite" }
    "windows-settings-manager-pro" { "pro" }
    default { throw "Windows Settings Manager Rat Art cannot infer edition from destination '$Destination'." }
}
python (Join-Path $Root "scripts\rat-art.py") --flavor $flavor --output $Destination
if ($LASTEXITCODE -ne 0) { throw "Windows Settings Manager Rat Art failed." }

$required = @(
    "01_search_icon.png",
    "02_cover.png",
    "03_gallery_01.png",
    "04_gallery_02.png",
    "05_gallery_03.png",
    "06_gallery_04.png"
)

Add-Type -AssemblyName System.Drawing
foreach ($file in $required) {
    $path = Join-Path $Destination $file
    if (-not (Test-Path $path -PathType Leaf)) {
        throw "Windows Settings Manager Rat Art output missing: $file"
    }

    $image = [System.Drawing.Image]::FromFile($path)
    try {
        $expectedWidth = if ($file -eq "01_search_icon.png") { 288 } else { 1920 }
        $expectedHeight = if ($file -eq "01_search_icon.png") { 288 } else { 960 }
        if ($image.Width -ne $expectedWidth -or $image.Height -ne $expectedHeight) {
            throw "Windows Settings Manager Rat Art wrong dimensions for ${file}: $($image.Width)x$($image.Height)"
        }
    }
    finally {
        $image.Dispose()
    }
}

Write-Host "Windows Settings Manager Rat Art complete: $Destination" -ForegroundColor Green

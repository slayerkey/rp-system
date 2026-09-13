param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$PluginRoot = $PSScriptRoot
$RepoRoot = (Resolve-Path (Join-Path $PluginRoot "..\..")).Path
$Renderer = Join-Path $RepoRoot "tools\art\macro_recorder_art.py"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python is required to generate macro-recorder-lite Rat Art."
}
if (-not (Test-Path $Renderer -PathType Leaf)) {
    throw "Macro Recorder Rat Art renderer not found: $Renderer"
}

python -c "import PIL" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Macro Recorder Rat Art: installing Pillow..." -ForegroundColor DarkGray
    python -m pip install --disable-pip-version-check pillow
    if ($LASTEXITCODE -ne 0) { throw "Pillow is required for Macro Recorder Rat Art." }
}

$Work = Join-Path ([System.IO.Path]::GetTempPath()) ("packrat-macro-recorder-lite-art-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $Work | Out-Null
try {
    $Cover = Join-Path $Work "02_cover.png"
    Write-Host "Macro Recorder Rat Art: rendering macro-recorder-lite Marketplace media..." -ForegroundColor DarkGray
    python $Renderer --slug macro-recorder-lite --out $Cover
    if ($LASTEXITCODE -ne 0) { throw "Macro Recorder Rat Art renderer failed with exit code $LASTEXITCODE." }

    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    $mapping = [ordered]@{
        "00-app-icon.png" = "01_search_icon.png"
        "02_cover.png"    = "02_cover.png"
        "02-capture.png" = "03_gallery_01.png"
        "03-edit.png" = "04_gallery_02.png"
        "04-safety.png" = "05_gallery_03.png"
        "05-profiles.png" = "06_gallery_04.png"
    }

    foreach ($sourceName in $mapping.Keys) {
        $source = Join-Path $Work $sourceName
        if (-not (Test-Path $source -PathType Leaf)) {
            throw "Macro Recorder Rat Art output missing: $source"
        }
        Copy-Item $source (Join-Path $Destination $mapping[$sourceName]) -Force
    }
}
finally {
    if (Test-Path $Work) { Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host "Macro Recorder Rat Art: Marketplace media copied to $Destination" -ForegroundColor Green

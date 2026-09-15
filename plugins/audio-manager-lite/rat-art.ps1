param(
    [Parameter(Mandatory=$true)]
    [string]$Destination
)
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
python (Join-Path $Here "scripts\rat-art.py") --destination $Destination
if ($LASTEXITCODE -ne 0) { throw "Audio Manager Lite Rat Art failed with exit code $LASTEXITCODE." }
foreach ($file in @("01_search_icon.png","02_cover.png","03_gallery_01.png","04_gallery_02.png","05_gallery_03.png","06_gallery_04.png")) {
    if (-not (Test-Path (Join-Path $Destination $file) -PathType Leaf)) {
        throw "Audio Manager Lite Rat Art output missing: $file"
    }
}
Write-Host "Audio Manager Lite Rat Art complete: $Destination" -ForegroundColor Green

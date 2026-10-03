param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = (Resolve-Path (Join-Path $Root '../..')).Path
if (-not (Test-Path (Join-Path $Repo 'tools/ship/render_svg_icon.mjs'))) {
    throw 'Canonical PackRat SVG renderer missing; run from the complete rp-system checkout.'
}
if (-not (Test-Path (Join-Path $Repo 'tools/art/assets/ratpack-icon-transparent.png'))) {
    throw 'Approved PackRat brand mark missing; never generate replacement branding.'
}
$Tools = Join-Path $Repo 'tools'
$PlaywrightDir = Join-Path $Tools 'node_modules/playwright'
$PlaywrightExe = Join-Path $Tools 'node_modules/.bin/playwright.cmd'
if (-not (Test-Path $PlaywrightDir)) {
    & npm install --prefix $Tools --no-save --package-lock=false --no-fund --no-audit 'playwright@1.62.1'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot install canonical SVG renderer runtime.' }
}
Push-Location $Tools
try {
    & node -e "import('playwright').then(({chromium})=>process.exit(require('fs').existsSync(chromium.executablePath())?0:2)).catch(()=>process.exit(3))" *> $null
    if ($LASTEXITCODE -ne 0) {
        & $PlaywrightExe install chromium
        if ($LASTEXITCODE -ne 0) { throw 'Cannot install canonical Chromium.' }
    }
} finally { Pop-Location }
$KeyDir = Join-Path $Destination 'rat-art-keys'
& node (Join-Path $Root 'scripts/export-rat-art-keys.mjs') $KeyDir
if ($LASTEXITCODE -ne 0) { throw 'Runtime key export failed.' }
& python (Join-Path $Root 'scripts/rat_art.py') --out $Destination --keys $KeyDir
if ($LASTEXITCODE -ne 0) { throw 'Product-specific Rat Art failed.' }
foreach ($Name in @('01_search_icon.png','03_gallery_01.png','04_gallery_02.png','05_gallery_03.png','06_gallery_04.png')) {
    if (-not (Test-Path (Join-Path $Destination $Name))) { throw "Missing product Rat Art output: $Name" }
}
# Rat Ship applies the canonical shared gallery campaign, then overwrites 02_cover.png last.
Write-Host 'Home Assistant product Rat Art ready for canonical Rat Ship cover/gallery pipeline.'

param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference="Stop"
$Root=Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot=(Resolve-Path (Join-Path $Root "..\..")).Path
$ToolsRoot=Join-Path $RepoRoot "tools"
$PlaywrightModule=Join-Path $ToolsRoot "node_modules\playwright"
$PlaywrightCmd=Join-Path $ToolsRoot "node_modules\.bin\playwright.cmd"

# Candidate art uses the same SVG rasterizer as canonical Rat Ship so gallery
# proof and the final cover share one source of truth for product key faces.
if(-not(Test-Path $PlaywrightModule)-or -not(Test-Path $PlaywrightCmd)){
  Write-Host "Preparing canonical Stream Deck SVG renderer..." -ForegroundColor DarkGray
  & npm install --prefix $ToolsRoot --no-save --package-lock=false --no-fund --no-audit "playwright@1.62.1" | Out-Host
  if($LASTEXITCODE -ne 0){throw "Could not install canonical Playwright renderer for Monitor Manager Pro Rat Art."}
}
Push-Location $ToolsRoot
try{
  & node -e "import('playwright').then(({chromium})=>process.exit(require('fs').existsSync(chromium.executablePath())?0:2)).catch(()=>process.exit(3))" *> $null
  if($LASTEXITCODE -ne 0){
    Write-Host "Preparing canonical Chromium runtime..." -ForegroundColor DarkGray
    & $PlaywrightCmd install chromium | Out-Host
    if($LASTEXITCODE -ne 0){throw "Could not install canonical Chromium runtime for Monitor Manager Pro Rat Art."}
  }
}
finally{Pop-Location}

python (Join-Path $Root "scripts\rat_art.py") --out $Destination
if($LASTEXITCODE -ne 0){throw "Monitor Manager Pro Rat Art failed."}
foreach($file in @("01_search_icon.png","02_cover.png","03_gallery_01.png","04_gallery_02.png","05_gallery_03.png","06_gallery_04.png")){
  if(-not(Test-Path(Join-Path $Destination $file))){throw "Rat Art output missing: $file"}
}
Write-Host "Monitor Manager Pro Rat Art complete: $Destination" -ForegroundColor Green

param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference="Stop"
$Root=Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot=(Resolve-Path (Join-Path $Root "..\..")).Path
$ToolsRoot=Join-Path $RepoRoot "tools"
$PlaywrightCmd=Join-Path $ToolsRoot "node_modules\.bin\playwright.cmd"
if(-not(Test-Path (Join-Path $ToolsRoot "node_modules\playwright"))){
 & npm install --prefix $ToolsRoot --no-save --package-lock=false --no-fund --no-audit "playwright@1.62.1" | Out-Host
 if($LASTEXITCODE -ne 0){throw "Cannot install canonical SVG renderer"}
}
Push-Location $ToolsRoot
try{
 & node -e "import('playwright').then(({chromium})=>process.exit(require('fs').existsSync(chromium.executablePath())?0:2)).catch(()=>process.exit(3))" *> $null
 if($LASTEXITCODE -ne 0){& $PlaywrightCmd install chromium | Out-Host;if($LASTEXITCODE -ne 0){throw "Cannot install canonical Chromium"}}
}finally{Pop-Location}
$Source=Join-Path $Root "art-source-keys"
$Keys=Join-Path $Destination "rat-art-keys"
if(Test-Path $Keys){Remove-Item $Keys -Recurse -Force}
New-Item -ItemType Directory -Force -Path $Keys | Out-Null
$Icons=@(Get-ChildItem $Source -Filter "*.svg" | Sort-Object Name)
if($Icons.Count -ne 15){throw "Expected 15 exact runtime SVGs, got $($Icons.Count)"}
foreach($Icon in $Icons){
 $Png=Join-Path $Keys ($Icon.BaseName+".png")
 & node (Join-Path $RepoRoot "tools\ship\render_svg_icon.mjs") $Icon.FullName $Png | Out-Host
 if($LASTEXITCODE -ne 0){throw "Canonical runtime key rasterization failed: $($Icon.Name)"}
}
& python (Join-Path $Root "scripts\rat_art.py") --out $Destination | Out-Host
if($LASTEXITCODE -ne 0){throw "Smart Lighting Rat Art failed"}
foreach($Name in @("01_search_icon.png","02_cover.png","03_gallery_01.png","04_gallery_02.png","05_gallery_03.png","06_gallery_04.png")){
 if(-not(Test-Path (Join-Path $Destination $Name))){throw "Missing marketplace artwork $Name"}
}

param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference="Stop"
$Root=Split-Path -Parent $MyInvocation.MyCommand.Path
python (Join-Path $Root "scripts\rat_art.py") --out $Destination
if($LASTEXITCODE -ne 0){throw "Monitor Manager Lite Rat Art failed."}
foreach($file in @("01_search_icon.png","02_cover.png","03_gallery_01.png","04_gallery_02.png","05_gallery_03.png","06_gallery_04.png")){
  if(-not(Test-Path(Join-Path $Destination $file))){throw "Rat Art output missing: $file"}
}
Write-Host "Monitor Manager Lite Rat Art complete: $Destination" -ForegroundColor Green

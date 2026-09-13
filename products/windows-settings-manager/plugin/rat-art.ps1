param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$flavor = if ($Destination -match 'lite') { 'lite' } else { 'pro' }
python (Join-Path $Root "scripts\rat-art.py") --flavor $flavor --output $Destination
if ($LASTEXITCODE -ne 0) { throw "Windows Settings Manager Rat Art failed." }

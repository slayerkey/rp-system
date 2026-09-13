param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script = Join-Path $Here "scripts\rat-art-release.py"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python is required for Wireless Device Manager Rat Art." }
$leaf = Split-Path -Leaf ($Destination.TrimEnd('\','/'))
$edition = if ($leaf -like '*-pro') { 'pro' } else { 'lite' }
python $Script --destination $Destination --edition $edition
if ($LASTEXITCODE -ne 0) { throw "Wireless Device Manager Rat Art failed with exit code $LASTEXITCODE." }

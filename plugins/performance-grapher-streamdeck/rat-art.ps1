param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script = Join-Path $Here "scripts\rat-art-release.py"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python is required for Performance Grapher Rat Art."
}
python $Script --destination $Destination
if ($LASTEXITCODE -ne 0) { throw "Performance Grapher Rat Art failed with exit code $LASTEXITCODE." }

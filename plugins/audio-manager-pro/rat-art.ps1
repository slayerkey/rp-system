param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
python (Join-Path $Here "scripts\rat-art.py") --destination $Destination
if ($LASTEXITCODE -ne 0) { throw "Audio Manager Pro Rat Art failed with exit code $LASTEXITCODE." }

param(
    [Parameter(Mandatory = $true)]
    [string]$Destination,
    [ValidateSet("lite","pro")]
    [string]$Edition
)

$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script = Join-Path $Here "scripts\rat-art.py"

if (-not $Edition) {
    $leaf = Split-Path -Leaf ($Destination.TrimEnd("\","/"))
    $Edition = if ($leaf -match "pro") { "pro" } else { "lite" }
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python is required for Text Expander Rat Art."
}

python $Script --destination $Destination --edition $Edition
if ($LASTEXITCODE -ne 0) {
    throw "Text Expander Rat Art failed with exit code $LASTEXITCODE."
}

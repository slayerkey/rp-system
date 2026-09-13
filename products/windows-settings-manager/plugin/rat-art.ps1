param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$leaf = Split-Path -Leaf $Destination
$flavor = switch ($leaf) {
    "windows-settings-manager-lite" { "lite" }
    "windows-settings-manager-pro" { "pro" }
    default { throw "Windows Settings Manager Rat Art cannot infer edition from destination '$Destination'." }
}
python (Join-Path $Root "scripts\rat-art.py") --flavor $flavor --output $Destination
if ($LASTEXITCODE -ne 0) { throw "Windows Settings Manager Rat Art failed." }

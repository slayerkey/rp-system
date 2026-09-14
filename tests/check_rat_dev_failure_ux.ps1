$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ratCmdPath = Join-Path $repoRoot "rat.cmd"
$bootstrapPath = Join-Path $repoRoot "tools\local\rat-bootstrap.ps1"
$raw = Get-Content $ratCmdPath -Raw
$bootstrapRaw = Get-Content $bootstrapPath -Raw

if ($raw -match "Opening the local development folder for inspection only") {
    throw "rat dev still auto-opens Explorer after a failed development build."
}

if ($raw -notmatch "Rat Dev failed\. No new validated development build was activated\.") {
    throw "rat dev failure summary is missing."
}

if ($raw -notmatch "Explorer was not opened") {
    throw "rat dev failure output must make the no-auto-open behavior explicit."
}

if ($raw -notmatch "If you want to inspect it manually, run: rat dev-open %~2") {
    throw "rat dev failure output must point to the explicit rat dev-open command."
}

if ($raw -notmatch 'if /I "%~1"=="dev-open"') {
    throw "Explicit rat dev-open command was accidentally removed."
}

if ($bootstrapRaw -notmatch "Assert-RatCommandLayerSyntax") {
    throw "Rat bootstrap must validate the refreshed local PowerShell command layer before activation."
}

if ($bootstrapRaw -notmatch "Parser.*ParseFile") {
    throw "Rat bootstrap must use the PowerShell parser for command-layer validation."
}

if ($bootstrapRaw -notmatch "previousMainCommit") {
    throw "Rat bootstrap must remember the previous main commit before self-update."
}

if ($bootstrapRaw -notmatch 'reset", "--hard", \$previousMainCommit') {
    throw "Rat bootstrap must roll back to the previous main commit when refreshed PowerShell is invalid."
}

if ($bootstrapRaw -notmatch "previous working command layer was restored") {
    throw "Rat bootstrap rollback must clearly explain that the previous working command layer was restored."
}

Write-Host "Rat Dev failure UX and command-layer rollback checks passed."

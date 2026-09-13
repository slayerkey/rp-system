$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ratCmdPath = Join-Path $repoRoot "rat.cmd"
$raw = Get-Content $ratCmdPath -Raw

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

Write-Host "Rat Dev failure UX checks passed."

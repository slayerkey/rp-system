$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ratPath = Join-Path $root "tools\local\rat.ps1"
$standalonePath = Join-Path $root "tools\local\rat-maker-console.ps1"

$rat = Get-Content $ratPath -Raw
$standalone = Get-Content $standalonePath -Raw

$start = $rat.IndexOf("function Run-MakerConsole {")
$end = $rat.IndexOf("function Run-Kit {", $start)
if ($start -lt 0 -or $end -lt 0) {
    throw "Could not isolate Run-MakerConsole in rat.ps1"
}
$runMaker = $rat.Substring($start, $end - $start)

if ($runMaker -match 'for\s*\(\$attempt') {
    throw "rat ship must not retry Maker Console automatically"
}
if ($runMaker -match '\-Resume') {
    throw "rat ship must not pass --resume after a Maker Console failure"
}
if ($runMaker -notmatch 'will NOT reopen or resume the same draft automatically') {
    throw "rat ship single-attempt failure message is missing"
}
if ($rat -notmatch 'Continuing the remaining queue') {
    throw "rat ship batch must keep its per-product failure isolation"
}

if ($standalone -match 'for\s*\(\$attempt') {
    throw "standalone Maker Console helper must not retry automatically"
}
if ($standalone -match '\$resume\s*=|--resume') {
    throw "standalone Maker Console helper must not auto-resume drafts"
}
if ($standalone -notmatch 'will NOT reopen or resume the same draft automatically') {
    throw "standalone single-attempt failure message is missing"
}

Write-Host "RAT SHIP MAKER CONSOLE SINGLE-ATTEMPT PASS"

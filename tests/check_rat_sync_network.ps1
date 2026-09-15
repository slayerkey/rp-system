$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ratPath = Join-Path $root "tools\local\rat.ps1"
$bootstrapPath = Join-Path $root "tools\local\rat-bootstrap.ps1"

$rat = Get-Content $ratPath -Raw
$bootstrap = Get-Content $bootstrapPath -Raw

if ($rat -notmatch 'function Invoke-GitNetworkCommand') {
    throw "rat.ps1 is missing bounded Git network retry support"
}
if ($rat -notmatch 'fetch", "--prune", "origin"') {
    throw "rat.ps1 Sync-Main must still refresh origin"
}
if ($rat -match 'pull", "--ff-only", "origin", "main"') {
    throw "Rat Ship must not make a redundant second network request with git pull after fetch"
}
if ($rat -notmatch 'merge", "--ff-only", "origin/main"') {
    throw "Rat Ship must fast-forward main from the already-fetched origin/main ref"
}

if ($bootstrap -notmatch 'function Invoke-GitNetwork') {
    throw "rat-bootstrap.ps1 is missing bounded Git network retry support"
}
if ($bootstrap -notmatch 'Invoke-GitNetwork -Arguments @\("fetch", "--prune", "origin"') {
    throw "Rat bootstrap main fetch must use bounded network retry"
}
if ($bootstrap -notmatch 'merge", "--ff-only", "refs/remotes/origin/main"') {
    throw "Rat bootstrap must fast-forward from the fetched remote-tracking ref"
}

Write-Host "RAT SYNC NETWORK RESILIENCE PASS"

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $repoRoot "tools\local\rat-dev-processes.ps1")

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("packrat-ratdev-lock-" + [guid]::NewGuid().ToString("N"))
$pluginRoot = Join-Path $tempRoot "plugin"
$inside = Join-Path $pluginRoot "com.packrat.test.sdPlugin\native\helper.exe"
$sibling = Join-Path $tempRoot "plugin-other\helper.exe"

if (-not (Test-RatDevPathInsideRoot -Root $pluginRoot -Candidate $inside)) {
    throw "Rat Dev build-lock path matcher rejected a process inside the plugin root."
}
if (Test-RatDevPathInsideRoot -Root $pluginRoot -Candidate $sibling) {
    throw "Rat Dev build-lock path matcher accepted a sibling prefix outside the plugin root."
}

$ratDevPath = Join-Path $repoRoot "tools\local\rat-dev.ps1"
$ratDev = Get-Content $ratDevPath -Raw

if ($ratDev -notmatch 'rat-dev-processes\.ps1') {
    throw "rat-dev.ps1 is not loading the native build-lock helper."
}
if ($ratDev -notmatch 'function Release-RatDevBuildLocks') {
    throw "rat-dev.ps1 is missing Release-RatDevBuildLocks."
}
if ($ratDev -notmatch 'Invoke-StreamDeckBestEffort -Arguments @\("stop", \$PreviousUuid\)') {
    throw "Rat Dev must stop the owning Stream Deck plugin before killing build-owned native helpers."
}
if ($ratDev -notmatch 'Stop-RatDevBuildOwnedProcesses -PluginRoot \$PluginRoot') {
    throw "Rat Dev does not release surviving build-owned native helper processes."
}

$releaseAt = $ratDev.LastIndexOf('Release-RatDevBuildLocks -PluginRoot $pluginRoot')
$buildAt = $ratDev.LastIndexOf('Build-And-TestPlugin -PluginRoot $pluginRoot')
if ($releaseAt -lt 0 -or $buildAt -lt 0 -or $releaseAt -gt $buildAt) {
    throw "Rat Dev must release native helper locks before the plugin build begins."
}

$preflight = Get-Content (Join-Path $repoRoot "tools\local\rat-dev-preflight.ps1") -Raw
if ($preflight -notmatch 'Native helpers will be paused automatically if Windows has them locked') {
    throw "Rat Dev preflight does not explain native helper lock handling."
}
if ($preflight -match 'Keeping the current plugin live during the update') {
    throw "Rat Dev preflight still makes the incorrect always-live promise."
}

Write-Host "Rat Dev native build-lock checks passed."

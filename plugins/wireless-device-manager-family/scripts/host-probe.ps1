param()
$ErrorActionPreference = "Continue"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Uuid = "com.packrat.wireless-device-manager-pro"
$Plugin = Join-Path $Root "$Uuid.sdPlugin"
$ManifestPath = Join-Path $Plugin "manifest.json"
$PluginJs = Join-Path $Plugin "bin\plugin.js"
$Bridge = Join-Path $Plugin "bin\wireless-device-bridge-x64.exe"

function Section([string]$Title) {
    Write-Host ""
    Write-Host ("=== {0} ===" -f $Title) -ForegroundColor Cyan
}

Section "Wireless deep host probe"
Write-Host ("Timestamp: {0}" -f [DateTime]::Now.ToString("o"))
Write-Host ("Product root: {0}" -f $Root)
Write-Host ("Plugin path:  {0}" -f $Plugin)

Section "Manifest launch contract"
if (Test-Path $ManifestPath) {
    $manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
    Write-Host ("UUID: {0}" -f $manifest.UUID)
    Write-Host ("Version: {0}" -f $manifest.Version)
    Write-Host ("CodePath: {0}" -f $manifest.CodePath)
    Write-Host ("Node version: {0}" -f $manifest.Nodejs.Version)
    $debugValue = if ($manifest.Nodejs.PSObject.Properties.Name -contains "Debug") { [string]$manifest.Nodejs.Debug } else { "<absent>" }
    Write-Host ("Node Debug: {0}" -f $debugValue)
} else {
    Write-Host "Manifest missing." -ForegroundColor Red
}

Section "Built payload"
foreach ($path in @($PluginJs, $Bridge)) {
    if (Test-Path $path -PathType Leaf) {
        $item = Get-Item $path
        $hash = (Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
        Write-Host ("{0}" -f $path)
        Write-Host ("  bytes={0} sha256={1}" -f $item.Length,$hash)
    } else {
        Write-Host ("MISSING: {0}" -f $path) -ForegroundColor Red
    }
}

Section "Direct Pro bridge snapshot"
if (Test-Path $Bridge -PathType Leaf) {
    $bridgeJson = & $Bridge snapshot 2>&1
    Write-Host ($bridgeJson | Out-String)
} else {
    Write-Host "Pro bridge executable missing." -ForegroundColor Red
}

Section "Linked Stream Deck plugin"
$installed = if ($env:APPDATA) { Join-Path $env:APPDATA "Elgato\StreamDeck\Plugins\$Uuid.sdPlugin" } else { $null }
if ($installed -and (Test-Path $installed)) {
    $item = Get-Item $installed -Force
    Write-Host ("Installed path: {0}" -f $installed)
    Write-Host ("LinkType: {0}" -f $item.LinkType)
    Write-Host ("Target: {0}" -f (($item.Target | ForEach-Object { [string]$_ }) -join "; "))
    $installedJs = Join-Path $installed "bin\plugin.js"
    if (Test-Path $installedJs -PathType Leaf) {
        $installedHash = (Get-FileHash $installedJs -Algorithm SHA256).Hash.ToLowerInvariant()
        $builtHash = if (Test-Path $PluginJs -PathType Leaf) { (Get-FileHash $PluginJs -Algorithm SHA256).Hash.ToLowerInvariant() } else { "" }
        Write-Host ("Linked plugin.js sha256: {0}" -f $installedHash)
        Write-Host ("Matches Rat Dev build: {0}" -f ($installedHash -eq $builtHash))
    }
} else {
    Write-Host "No linked plugin directory found under Stream Deck Plugins." -ForegroundColor Yellow
}

Section "Running processes"
$processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    ([string]$_.CommandLine -match [regex]::Escape($Uuid)) -or
    ([string]$_.CommandLine -match "wireless-device-bridge")
})
if ($processes.Count) {
    foreach ($proc in $processes) {
        Write-Host ("PID={0} NAME={1}" -f $proc.ProcessId,$proc.Name)
        Write-Host ("  {0}" -f $proc.CommandLine)
    }
} else {
    Write-Host "No Wireless plugin/bridge process was found by command line." -ForegroundColor Yellow
}

Section "Plugin logs"
$logRoots = @($Plugin)
if ($installed) { $logRoots += $installed }
$logs = @()
foreach ($logRoot in ($logRoots | Select-Object -Unique)) {
    if (Test-Path $logRoot) {
        $logs += Get-ChildItem $logRoot -Recurse -File -Filter "*.log" -ErrorAction SilentlyContinue
    }
}
$logs = @($logs | Sort-Object LastWriteTime -Descending | Select-Object -First 4)
if ($logs.Count) {
    foreach ($log in $logs) {
        Write-Host ("--- {0} ({1}) ---" -f $log.FullName,$log.LastWriteTime)
        Get-Content $log.FullName -Tail 160 -ErrorAction SilentlyContinue | Out-Host
    }
} else {
    Write-Host "No plugin-local log files found." -ForegroundColor Yellow
}

Section "Stream Deck host log"
$sdLog = if ($env:APPDATA) { Join-Path $env:APPDATA "Elgato\StreamDeck\logs\StreamDeck0.log" } else { $null }
if ($sdLog -and (Test-Path $sdLog -PathType Leaf)) {
    Write-Host ("Host log: {0}" -f $sdLog)
    $matches = Get-Content $sdLog -Tail 3000 -ErrorAction SilentlyContinue |
        Select-String -Pattern @($Uuid,"wireless-device-manager","plugin.js","Node","disabled") -SimpleMatch
    if ($matches) {
        $matches | Select-Object -Last 160 | ForEach-Object { Write-Host $_.Line }
    } else {
        Write-Host "No recent matching host-log lines." -ForegroundColor Yellow
    }
} else {
    Write-Host "Stream Deck host log not found." -ForegroundColor Yellow
}

Section "Property Inspector debugger"
try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:23654/" -TimeoutSec 2
    Write-Host ("Remote debugger reachable: HTTP {0}" -f $response.StatusCode)
} catch {
    Write-Host ("Remote debugger not reachable: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
    Write-Host "Keep the Property Inspector visible and ensure Stream Deck developer mode is enabled."
}

Write-Host ""
Write-Host "Wireless deep host probe complete. Paste this entire output back into the debugging chat." -ForegroundColor Green

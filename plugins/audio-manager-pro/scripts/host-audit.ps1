param(
    [switch]$StaticOnly,
    [switch]$Json
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PluginDir = Join-Path $Root "com.packrat.audio-manager-pro.sdPlugin"
$ManifestPath = Join-Path $PluginDir "manifest.json"
$HelperPath = Join-Path $PluginDir "native\win-x64\PackRat.AudioManager.Helper.exe"
$ReportPath = Join-Path $Root "HOST_AUDIT_LATEST.txt"
$script:results = @()

function Add-Check {
    param(
        [string]$Name,
        [ValidateSet("PASS","WARN","FAIL")]
        [string]$Status,
        [string]$Detail
    )
    $script:results += [PSCustomObject]@{ name = $Name; status = $Status; detail = $Detail }
}

function Get-GitValue {
    param([string[]]$Arguments)
    try {
        $text = (& git -C $Root @Arguments 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -eq 0) { return $text }
    }
    catch { }
    return "unknown"
}

function Get-ProcessVersion {
    param([System.Diagnostics.Process[]]$Processes)
    foreach ($process in @($Processes)) {
        try {
            $info = $process.MainModule.FileVersionInfo
            $version = [string]$info.ProductVersion
            if (-not $version) { $version = [string]$info.FileVersion }
            if ($version) { return $version.Trim() }
        }
        catch { }
    }
    return $null
}

function Find-LatestFile {
    param([string[]]$Directories, [string]$Filter)
    $files = @()
    foreach ($dir in $Directories) {
        if ($dir -and (Test-Path $dir -PathType Container)) {
            $files += Get-ChildItem $dir -Filter $Filter -File -ErrorAction SilentlyContinue
        }
    }
    return $files | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

function Endpoint-Name {
    param($Snapshot, [string]$Id, [string]$Kind)
    if ([string]::IsNullOrWhiteSpace($Id)) { return "(none)" }
    $list = if ($Kind -eq "output") { @($Snapshot.outputs) } else { @($Snapshot.inputs) }
    $match = $list | Where-Object { [string]$_.id -eq $Id } | Select-Object -First 1
    if ($match) { return [string]$match.name }
    return "(id not found in active endpoint list)"
}

if (-not (Test-Path $ManifestPath -PathType Leaf)) {
    throw "Audio Manager Pro manifest not found: $ManifestPath"
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$commit = Get-GitValue @("rev-parse", "HEAD")
$branch = Get-GitValue @("branch", "--show-current")
if (-not $branch) { $branch = "detached" }

Add-Check "manifest UUID" $(if ($manifest.UUID -eq "com.packrat.audio-manager-pro") { "PASS" } else { "FAIL" }) ([string]$manifest.UUID)
Add-Check "manifest version" $(if ($manifest.Version -eq "1.0.0.0") { "PASS" } else { "WARN" }) ([string]$manifest.Version)
Add-Check "action count" $(if (@($manifest.Actions).Count -eq 7) { "PASS" } else { "FAIL" }) ("{0} actions" -f @($manifest.Actions).Count)
Add-Check "built runtime" $(if (Test-Path (Join-Path $PluginDir "bin\plugin.js") -PathType Leaf) { "PASS" } else { "FAIL" }) (Join-Path $PluginDir "bin\plugin.js")
Add-Check "native helper" $(if (Test-Path $HelperPath -PathType Leaf) { "PASS" } else { "FAIL" }) $HelperPath

foreach ($piFile in @("ui\inspector.html", "ui\inspector.js", "ui\inspector.css")) {
    $path = Join-Path $PluginDir $piFile
    Add-Check ("property inspector {0}" -f (Split-Path $piFile -Leaf)) $(if (Test-Path $path -PathType Leaf) { "PASS" } else { "FAIL" }) $path
}

$environment = [ordered]@{
    windows = $null
    stream_deck = $null
}
$snapshot = $null

if (-not $StaticOnly) {
    if ($env:OS -ne "Windows_NT") {
        Add-Check "Windows runtime" "FAIL" "Audio Manager Pro host audit must run on Windows."
    }
    else {
        try {
            $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
            $environment.windows = ("{0} {1} (build {2})" -f ([string]$os.Caption).Trim(), ([string]$os.Version).Trim(), ([string]$os.BuildNumber).Trim()).Trim()
        }
        catch {
            $environment.windows = [System.Environment]::OSVersion.VersionString
        }
        Add-Check "Windows version" "PASS" ([string]$environment.windows)

        $streamDeck = @(Get-Process -Name StreamDeck -ErrorAction SilentlyContinue)
        Add-Check "Stream Deck process" $(if ($streamDeck.Count) { "PASS" } else { "FAIL" }) $(if ($streamDeck.Count) { "StreamDeck.exe running" } else { "StreamDeck.exe not running" })
        if ($streamDeck.Count) {
            $environment.stream_deck = Get-ProcessVersion $streamDeck
            Add-Check "Stream Deck version" $(if ($environment.stream_deck) { "PASS" } else { "WARN" }) $(if ($environment.stream_deck) { [string]$environment.stream_deck } else { "Stream Deck is running, but its executable version could not be read." })
        }

        if (Test-Path $HelperPath -PathType Leaf) {
            try {
                $response = '{"id":"host-audit","command":"snapshot"}' | & $HelperPath | Select-Object -First 1
                if (-not $response) { throw "helper returned no response" }
                $jsonResponse = $response | ConvertFrom-Json
                if ([string]$jsonResponse.id -ne "host-audit") { throw "helper response id mismatch" }
                if ($null -eq $jsonResponse.snapshot) { throw "helper returned no snapshot" }
                $snapshot = $jsonResponse.snapshot

                Add-Check "helper snapshot protocol" "PASS" ("status={0}" -f [string]$jsonResponse.status)
                if ($snapshot.error) {
                    Add-Check "Windows Core Audio snapshot" "FAIL" ([string]$snapshot.error)
                }
                else {
                    Add-Check "Windows Core Audio snapshot" "PASS" ("{0} outputs · {1} inputs" -f @($snapshot.outputs).Count, @($snapshot.inputs).Count)
                }

                Add-Check "default-device switching capability" $(if ($snapshot.defaultDeviceSwitching) { "PASS" } else { "WARN" }) $(if ($snapshot.defaultDeviceSwitching) { "PolicyConfig switching available" } else { "Default-device switching probe is unavailable on this host" })

                $outConsole = [string]$snapshot.defaultOutputId
                $outMulti = [string]$snapshot.multimediaOutputId
                $outComm = [string]$snapshot.communicationsOutputId
                $inConsole = [string]$snapshot.defaultInputId
                $inMulti = [string]$snapshot.multimediaInputId
                $inComm = [string]$snapshot.communicationsInputId

                Add-Check "Default output role alignment" $(if ($outConsole -eq $outMulti) { "PASS" } else { "WARN" }) ("Console={0} · Multimedia={1}" -f (Endpoint-Name $snapshot $outConsole "output"), (Endpoint-Name $snapshot $outMulti "output"))
                Add-Check "Default input role alignment" $(if ($inConsole -eq $inMulti) { "PASS" } else { "WARN" }) ("Console={0} · Multimedia={1}" -f (Endpoint-Name $snapshot $inConsole "input"), (Endpoint-Name $snapshot $inMulti "input"))
                Add-Check "Communications output" $(if ($outComm) { "PASS" } else { "WARN" }) (Endpoint-Name $snapshot $outComm "output")
                Add-Check "Communications input" $(if ($inComm) { "PASS" } else { "WARN" }) (Endpoint-Name $snapshot $inComm "input")

                $outputIds = @($snapshot.outputs | ForEach-Object { [string]$_.id })
                $inputIds = @($snapshot.inputs | ForEach-Object { [string]$_.id })
                $missingRoleIds = @()
                foreach ($pair in @(
                    @("Default output", $outConsole, $outputIds),
                    @("Multimedia output", $outMulti, $outputIds),
                    @("Communications output", $outComm, $outputIds),
                    @("Default input", $inConsole, $inputIds),
                    @("Multimedia input", $inMulti, $inputIds),
                    @("Communications input", $inComm, $inputIds)
                )) {
                    $label = [string]$pair[0]
                    $id = [string]$pair[1]
                    $ids = @($pair[2])
                    if ($id -and $ids -notcontains $id) { $missingRoleIds += $label }
                }
                Add-Check "role endpoints are active" $(if ($missingRoleIds.Count) { "FAIL" } else { "PASS" }) $(if ($missingRoleIds.Count) { "Missing from active endpoint lists: $($missingRoleIds -join ', ')" } else { "All non-empty role IDs resolve to active endpoints" })
            }
            catch {
                Add-Check "helper snapshot protocol" "FAIL" $_.Exception.Message
            }
        }

        $devLogDir = Join-Path $PluginDir "logs"
        $installedLogDir = if ($env:APPDATA) { Join-Path $env:APPDATA "Elgato\StreamDeck\Plugins\com.packrat.audio-manager-pro.sdPlugin\logs" } else { $null }
        $pluginLog = Find-LatestFile @($devLogDir, $installedLogDir) "com.packrat.audio-manager-pro*.log"
        if ($pluginLog) {
            $tail = @(Get-Content $pluginLog.FullName -Tail 400 -ErrorAction SilentlyContinue)
            $errorLines = @($tail | Where-Object { $_ -match '(?i)\b(ERROR|FATAL)\b|uncaught|unhandled|EPIPE|ETIMEDOUT|Audio helper' })
            Add-Check "Audio Manager plugin log" "PASS" $pluginLog.FullName
            Add-Check "recent plugin errors" $(if ($errorLines.Count) { "WARN" } else { "PASS" }) $(if ($errorLines.Count) { "{0} matching lines in latest 400" -f $errorLines.Count } else { "No matching failure lines in latest 400" })
        }
        else {
            Add-Check "Audio Manager plugin log" "WARN" "No plugin log found yet. Start/restart Audio Manager Pro in Stream Deck first."
        }

        $streamDeckLogDir = if ($env:APPDATA) { Join-Path $env:APPDATA "Elgato\StreamDeck\logs" } else { $null }
        $hostLog = Find-LatestFile @($streamDeckLogDir) "StreamDeck*.log"
        if ($hostLog) {
            $hostTail = @(Get-Content $hostLog.FullName -Tail 2500 -ErrorAction SilentlyContinue)
            $mentions = @($hostTail | Where-Object { $_ -match 'com\.packrat\.audio-manager-pro' })
            Add-Check "Stream Deck host log" "PASS" $hostLog.FullName
            Add-Check "host sees Audio Manager Pro" $(if ($mentions.Count) { "PASS" } else { "WARN" }) $(if ($mentions.Count) { "{0} recent references" -f $mentions.Count } else { "No recent UUID reference in Stream Deck host log tail" })
        }
        else {
            Add-Check "Stream Deck host log" "WARN" "No Stream Deck host log found at %APPDATA%\Elgato\StreamDeck\logs."
        }
    }
}

$failed = @($script:results | Where-Object status -eq "FAIL")
$warned = @($script:results | Where-Object status -eq "WARN")
$overall = if ($failed.Count) { "FAIL" } elseif ($warned.Count) { "WARN" } else { "PASS" }
$manualEvidence = if ($StaticOnly) { @() } else { @(
    "Apply one real Audio Profile and verify all configured Windows roles changed as intended.",
    "Disconnect one configured USB or Bluetooth endpoint and confirm PARTIAL / rebind behavior.",
    "Run the Stream Deck + rotate / press / touch smoke if a Stream Deck + is available.",
    "Put Windows to sleep and wake it, then confirm action and Property Inspector events still arrive."
) }

$report = [PSCustomObject]@{
    product = "Audio Manager Pro"
    generated_at = [DateTime]::Now.ToString("o")
    overall = $overall
    static_only = [bool]$StaticOnly
    commit = $commit
    branch = $branch
    plugin_uuid = [string]$manifest.UUID
    version = [string]$manifest.Version
    environment = [PSCustomObject]$environment
    snapshot = $snapshot
    checks = @($script:results | ForEach-Object { $_ })
    manual_evidence = $manualEvidence
}

if ($Json) {
    $report | ConvertTo-Json -Depth 8
}
else {
    $lines = @(
        "PACKRAT AUDIO MANAGER PRO HOST AUDIT",
        "Overall: $overall",
        "Time: $($report.generated_at)",
        "Commit: $commit",
        "Branch: $branch",
        "UUID: $($report.plugin_uuid)",
        "Version: $($report.version)"
    )
    if (-not $StaticOnly) {
        $lines += "Windows: $($report.environment.windows)"
        $lines += "Stream Deck: $($report.environment.stream_deck)"
    }
    $lines += ""
    foreach ($check in $script:results) {
        $lines += ("[{0}] {1}: {2}" -f $check.status, $check.name, $check.detail)
    }
    if (-not $StaticOnly) {
        $lines += ""
        $lines += "MANUAL EVIDENCE STILL REQUIRED"
        foreach ($item in $report.manual_evidence) { $lines += "[ ] $item" }
        $lines += ""
        $lines += "This audit is read-only. It never changes Windows audio state."
    }

    $text = $lines -join [Environment]::NewLine
    $text | Write-Host
    if (-not $StaticOnly) {
        Set-Content -Path $ReportPath -Value $text -Encoding UTF8
        Write-Host "`nSaved shareable report: $ReportPath" -ForegroundColor Cyan
    }
}

if ($failed.Count) { exit 1 }
exit 0

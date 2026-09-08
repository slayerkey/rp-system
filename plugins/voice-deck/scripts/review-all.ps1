param(
    [int]$ObserveSeconds = 8,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Continue"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Desktop = [Environment]::GetFolderPath("Desktop")
if (-not $Desktop) { $Desktop = $Root }
$Report = Join-Path $Desktop "VoiceDeck-Discord-Review-$Timestamp.txt"

$buildCode = 0
$auditCode = 0
$matrixCode = 0

function Section([string]$Title) {
    Write-Host ""
    Write-Host ("=" * 72) -ForegroundColor DarkGray
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("=" * 72) -ForegroundColor DarkGray
}

function Get-DiscordPipes {
    try {
        return @(Get-ChildItem "\\.\pipe\" -ErrorAction Stop |
            Where-Object { $_.Name -match '^discord-ipc-\d+$' } |
            Select-Object -ExpandProperty Name |
            Sort-Object)
    }
    catch {
        return @()
    }
}

function Get-DiscordProcesses([string[]]$Names) {
    $items = @()
    foreach ($name in $Names) {
        $items += @(Get-Process -Name $name -ErrorAction SilentlyContinue)
    }
    return @($items)
}

function Find-DiscordExecutable([string]$InstallName) {
    if (-not $env:LOCALAPPDATA) { return $null }
    $dir = Join-Path $env:LOCALAPPDATA $InstallName
    if (-not (Test-Path $dir -PathType Container)) { return $null }

    $latest = @(Get-ChildItem $dir -Directory -ErrorAction SilentlyContinue |
        Where-Object Name -match '^app-' |
        Sort-Object Name -Descending |
        Select-Object -First 1)

    if ($latest.Count) {
        $exe = Join-Path $latest[0].FullName "$InstallName.exe"
        if (Test-Path $exe -PathType Leaf) { return $exe }

        $fallback = @(Get-ChildItem $latest[0].FullName -Filter "Discord*.exe" -File -ErrorAction SilentlyContinue |
            Select-Object -First 1)
        if ($fallback.Count) { return $fallback[0].FullName }
    }

    return $null
}

try {
    Start-Transcript -Path $Report -Force | Out-Null

    Section "VOICE DECK FULL DISCORD REVIEW TEST"
    Write-Host "Plugin root: $Root"
    Write-Host "Report:      $Report"
    Write-Host "Time:        $([DateTime]::Now.ToString('o'))"

    if ($env:OS -ne "Windows_NT") {
        Write-Host "FAIL: This review test must run on Windows." -ForegroundColor Red
        exit 1
    }

    Section "1. TOOLCHAIN"
    $node = Get-Command node -ErrorAction SilentlyContinue
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    Write-Host ("Node: {0}" -f $(if ($node) { (& node --version) } else { "NOT FOUND" }))
    Write-Host ("npm:  {0}" -f $(if ($npm) { (& npm --version) } else { "NOT FOUND" }))
    if (-not $node -or -not $npm) {
        Write-Host "FAIL: Node/npm is required." -ForegroundColor Red
        exit 1
    }

    Section "2. DISCORD INSTALL + PROCESS SCAN"
    $local = $env:LOCALAPPDATA
    $installNames = @("Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment")
    $installed = @()
    foreach ($name in $installNames) {
        $dir = if ($local) { Join-Path $local $name } else { $null }
        if ($dir -and (Test-Path $dir -PathType Container)) {
            $updates = @(Get-ChildItem $dir -Directory -ErrorAction SilentlyContinue | Where-Object Name -match '^app-' | Sort-Object Name -Descending)
            $latest = $updates | Select-Object -First 1
            $installed += $name
            Write-Host ("[FOUND] {0,-20} {1}" -f $name, $(if ($latest) { $latest.FullName } else { $dir })) -ForegroundColor Green
        } else {
            Write-Host ("[-----] {0,-20} not installed in LocalAppData" -f $name)
        }
    }

    $running = Get-DiscordProcesses $installNames
    if (-not $running.Count -and $installed.Count) {
        $launchName = $installed[0]
        $launchExe = Find-DiscordExecutable $launchName
        if ($launchExe) {
            Write-Host ""
            Write-Host "No Discord client is running. Launching $launchName automatically..." -ForegroundColor Yellow
            try {
                Start-Process -FilePath $launchExe | Out-Null
            }
            catch {
                Write-Host "Automatic Discord launch failed: $($_.Exception.Message)" -ForegroundColor Yellow
            }

            Write-Host "Waiting for Discord process and IPC pipe..." -ForegroundColor Yellow
            $deadline = (Get-Date).AddSeconds(25)
            do {
                Start-Sleep -Milliseconds 500
                $running = Get-DiscordProcesses $installNames
                $pipesNow = Get-DiscordPipes
                if ($running.Count -and $pipesNow.Count) { break }
            } while ((Get-Date) -lt $deadline)
        }
    }

    if ($running.Count) {
        Write-Host ""
        Write-Host "Running Discord clients:" -ForegroundColor Green
        $running | Sort-Object ProcessName, Id | ForEach-Object {
            $path = ""
            try { $path = $_.Path } catch {}
            Write-Host ("  {0,-20} PID {1,-8} {2}" -f $_.ProcessName, $_.Id, $path)
        }
        $readyPipes = Get-DiscordPipes
        if ($readyPipes.Count) {
            Write-Host "Discord IPC pipes ready: $($readyPipes -join ', ')" -ForegroundColor Green
        } else {
            Write-Host "Discord process is running, but no IPC pipe appeared within the launch window." -ForegroundColor Yellow
        }
    } else {
        Write-Host ""
        if ($installed.Count) {
            Write-Host "WARNING: Discord is installed but could not be started automatically." -ForegroundColor Yellow
        } else {
            Write-Host "WARNING: No supported Discord Desktop installation was found." -ForegroundColor Yellow
        }
        Write-Host "Open Discord Stable/PTB/Canary, join a voice channel, then rerun this same command."
    }

    Section "3. DEPENDENCIES + BUILD + AUTOMATED TESTS"
    Push-Location $Root
    try {
        if (-not (Test-Path (Join-Path $Root "node_modules"))) {
            Write-Host "node_modules missing. Running npm ci..."
            & npm ci --no-fund --no-audit
            if ($LASTEXITCODE -ne 0) { $buildCode = $LASTEXITCODE }
        }

        if (-not $SkipBuild -and $buildCode -eq 0) {
            & npm run check
            $buildCode = $LASTEXITCODE
        } elseif ($SkipBuild) {
            Write-Host "Build/tests skipped by request."
        }
    } finally {
        Pop-Location
    }
    Write-Host ("Build/test result: {0}" -f $(if ($buildCode -eq 0) { "PASS" } else { "FAIL ($buildCode)" })) -ForegroundColor $(if ($buildCode -eq 0) { "Green" } else { "Red" })

    Section "4. WINDOWS HOST AUDIT"
    $audit = Join-Path $PSScriptRoot "host-audit.ps1"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $audit
    $auditCode = $LASTEXITCODE
    Write-Host ("Host audit result: {0}" -f $(if ($auditCode -eq 0) { "PASS" } else { "FAIL/WARN ($auditCode)" })) -ForegroundColor $(if ($auditCode -eq 0) { "Green" } else { "Yellow" })

    Section "5. DISCORD STABLE / PTB / CANARY IPC MATRIX + AUTH + VOICE"
    Write-Host "This tests every live discord-ipc-* pipe independently."
    Write-Host "Discord may show its normal authorization modal. Approve it if prompted."
    Write-Host "For the full PASS, be connected to a Discord voice channel."
    $matrix = Join-Path $PSScriptRoot "discord-client-matrix.ps1"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $matrix -Authorize -ObserveSeconds $ObserveSeconds
    $matrixCode = $LASTEXITCODE
    Write-Host ("Discord matrix result: {0}" -f $(if ($matrixCode -eq 0) { "PASS" } else { "FAIL ($matrixCode)" })) -ForegroundColor $(if ($matrixCode -eq 0) { "Green" } else { "Red" })

    Section "FINAL RESULT"
    Write-Host "Build/tests : $(if ($buildCode -eq 0) { 'PASS' } else { "FAIL ($buildCode)" })"
    Write-Host "Host audit  : $(if ($auditCode -eq 0) { 'PASS' } else { "FAIL/WARN ($auditCode)" })"
    Write-Host "Discord IPC : $(if ($matrixCode -eq 0) { 'PASS' } else { "FAIL ($matrixCode)" })"
    Write-Host ""
    Write-Host "Shareable report saved to:" -ForegroundColor Cyan
    Write-Host $Report

    if ($buildCode -eq 0 -and $matrixCode -eq 0) {
        Write-Host ""
        Write-Host "VOICE DECK DISCORD REVIEW TEST PASSED." -ForegroundColor Green
        exit 0
    }

    Write-Host ""
    Write-Host "VOICE DECK REVIEW TEST FOUND A FAILURE. Send the report above for diagnosis." -ForegroundColor Red
    exit 1
}
finally {
    try { Stop-Transcript | Out-Null } catch {}
}

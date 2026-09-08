param(
    [switch]$Authorize,
    [int]$ObserveSeconds = 5
)

$ErrorActionPreference = "Continue"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Probe = Join-Path $PSScriptRoot "discord-probe.mjs"

Write-Host ""
Write-Host "VOICE DECK DISCORD CLIENT MATRIX" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host ""

$knownNames = @("Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment")
$processes = @()
foreach ($name in $knownNames) {
    $processes += @(Get-Process -Name $name -ErrorAction SilentlyContinue)
}

if ($processes.Count) {
    Write-Host "Discord processes:" -ForegroundColor Green
    $processes | Sort-Object ProcessName, Id | ForEach-Object {
        $path = ""
        try { $path = $_.Path } catch {}
        Write-Host ("  {0,-20} PID {1,-8} {2}" -f $_.ProcessName, $_.Id, $path)
    }
} else {
    Write-Host "No known Discord Desktop process is currently running." -ForegroundColor Yellow
}

Write-Host ""
$pipes = @()
try {
    $pipes = @(Get-ChildItem "\\.\pipe\" -ErrorAction Stop |
        Where-Object { $_.Name -match '^discord-ipc-(\d+)$' } |
        ForEach-Object {
            [PSCustomObject]@{
                Name = $_.Name
                Index = [int]([regex]::Match($_.Name, '(\d+)$').Groups[1].Value)
            }
        } |
        Sort-Object Index)
} catch {}

if (-not $pipes.Count) {
    Write-Host "No discord-ipc-* named pipes were found." -ForegroundColor Red
    Write-Host "Open Discord Desktop completely, then run this again."
    exit 1
}

Write-Host "Discord IPC pipes:" -ForegroundColor Green
$pipes | ForEach-Object { Write-Host ("  {0}" -f $_.Name) }
Write-Host ""

$results = @()
foreach ($pipe in $pipes) {
    Write-Host ("Testing {0} ..." -f $pipe.Name) -ForegroundColor Cyan
    $output = & node $Probe "--instance=$($pipe.Index)" --connect-only --observe=0 2>&1
    $code = $LASTEXITCODE
    $text = ($output | Out-String).Trim()
    Write-Host $text
    $results += [PSCustomObject]@{
        Pipe = $pipe.Name
        ExitCode = $code
        Status = if ($code -eq 0) { "PASS" } else { "FAIL" }
    }
    Write-Host ""
}

Write-Host "IPC matrix summary:" -ForegroundColor Cyan
$results | Format-Table -AutoSize

$passed = @($results | Where-Object Status -eq "PASS")
if (-not $passed.Count) {
    Write-Host "No Discord instance completed the RPC READY handshake." -ForegroundColor Red
    exit 1
}

if ($Authorize) {
    $selected = $passed[0]
    $index = [int]([regex]::Match($selected.Pipe, '(\d+)$').Groups[1].Value)
    Write-Host ""
    Write-Host ("Running full authorization + voice probe against {0}." -f $selected.Pipe) -ForegroundColor Cyan
    Write-Host "Discord may show its normal authorization modal."

    $authOutput = & node $Probe "--instance=$index" --require-voice "--observe=$ObserveSeconds" 2>&1
    $authCode = $LASTEXITCODE
    $authText = ($authOutput | Out-String).Trim()
    Write-Host $authText

    if ($authCode -ne 0 -and $authText -match 'not currently in a voice channel') {
        Write-Host ""
        Write-Host "Discord connection and authorization PASS. Voice channel is the only missing step." -ForegroundColor Yellow
        Read-Host "Join any Discord voice channel now, then press Enter to retry the voice probe"
        Write-Host ""
        Write-Host "Retrying full voice probe..." -ForegroundColor Cyan
        & node $Probe "--instance=$index" --require-voice "--observe=$ObserveSeconds"
        exit $LASTEXITCODE
    }

    exit $authCode
}

Write-Host ""
Write-Host "Connection layer PASS on at least one Discord client." -ForegroundColor Green
Write-Host "For a full authorization + voice test, rerun:" -ForegroundColor Cyan
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\discord-client-matrix.ps1 -Authorize"
exit 0

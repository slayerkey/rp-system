$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Invoke-Git {
    param([string[]]$Arguments)

    # Windows PowerShell can surface normal native stderr such as Git fetch progress
    # as NativeCommandError while ErrorActionPreference=Stop. Capture the process
    # output with native errors temporarily non-terminating, then trust the exit code.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & git -C $RepoRoot @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    if ($output) { $output | ForEach-Object { Write-Host ([string]$_) } }
    if ($code -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $code"
    }
}

function Get-GitText {
    param([string[]]$Arguments)

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & git -C $RepoRoot @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    if ($code -ne 0) {
        throw "git $($Arguments -join ' ') failed: $($output -join ' ')"
    }
    return (($output -join "`n").Trim())
}


function Assert-RatCommandLayerSyntax {
    $failures = @()
    foreach ($script in @(Get-ChildItem -Path (Join-Path $RepoRoot "tools\local") -Filter "*.ps1" -File -ErrorAction Stop)) {
        $tokens = $null
        $errors = $null
        [System.Management.Automation.Language.Parser]::ParseFile($script.FullName, [ref]$tokens, [ref]$errors) | Out-Null
        if ($errors.Count) {
            foreach ($error in @($errors)) {
                Write-Host ("{0}:{1} {2}" -f $script.FullName, $error.Extent.StartLineNumber, $error.Message) -ForegroundColor Red
            }
            $failures += $script.FullName
        }
    }
    if ($failures.Count) {
        throw "RatPack command-layer PowerShell syntax validation failed: $($failures -join ', ')"
    }
}


function Remove-KnownGeneratedArtifacts {
    $widgetsRoot = Join-Path $RepoRoot "widgets"
    if (-not (Test-Path $widgetsRoot)) { return }

    Get-ChildItem -Path $widgetsRoot -Filter *.icuewidget -File -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue

    Get-ChildItem -Path $widgetsRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne "_src" -and $_.Name -notlike "_*" } |
        ForEach-Object {
            $index = Join-Path $_.FullName "index.html"
            if (Test-Path $index) {
                $relative = "widgets/$($_.Name)/index.html"
                $tracked = (& git -C $RepoRoot ls-files -- $relative 2>$null | Select-Object -First 1)
                if (-not $tracked) {
                    Remove-Item $index -Force -ErrorAction SilentlyContinue
                }
            }
        }
}

function Recover-LegacyDiscordBridgeShipResidue {
    # Older local Rat Ship builds could fail in rat-art.ps1 after building the
    # Discord Bridge directly inside canonical main. That exact failure leaves
    # only a modified generated manifest plus untracked bin/ and imgs/ output.
    # Recover that known residue before the self-update cleanliness gate so the
    # machine can pull the permanent ship-pipeline fixes. Any other local edit
    # remains protected and will still stop bootstrap below.
    $statusRaw = Get-GitText -Arguments @("status", "--porcelain", "--untracked-files=all")
    if (-not $statusRaw) { return }

    $manifest = "plugins/discord-bridge/com.packrat.discord-bridge.sdPlugin/manifest.json"
    $binPrefix = "plugins/discord-bridge/com.packrat.discord-bridge.sdPlugin/bin/"
    $imgsPrefix = "plugins/discord-bridge/com.packrat.discord-bridge.sdPlugin/imgs/"

    $paths = @()
    foreach ($line in @($statusRaw -split "`r?`n")) {
        if (-not $line) { continue }
        $normalized = $line.TrimStart()
        if ($normalized.Length -lt 3) { return }
        $path = $normalized.Substring(2).Trim()
        $paths += $path
    }

    if (-not $paths.Count) { return }
    $hasGeneratedOutput = $false
    foreach ($path in $paths) {
        $known = $path -eq $manifest -or $path.StartsWith($binPrefix, [System.StringComparison]::Ordinal) -or $path.StartsWith($imgsPrefix, [System.StringComparison]::Ordinal)
        if (-not $known) { return }
        if ($path.StartsWith($binPrefix, [System.StringComparison]::Ordinal) -or $path.StartsWith($imgsPrefix, [System.StringComparison]::Ordinal)) {
            $hasGeneratedOutput = $true
        }
    }
    if (-not $hasGeneratedOutput) { return }

    Write-Host "Recovering stale Discord Bridge Rat Ship build output..." -ForegroundColor Yellow
    & git -C $RepoRoot restore -- $manifest *> $null
    if ($LASTEXITCODE -ne 0) { throw "Could not restore stale Discord Bridge manifest output." }
    & git -C $RepoRoot clean -fd -- "plugins/discord-bridge/com.packrat.discord-bridge.sdPlugin/bin" "plugins/discord-bridge/com.packrat.discord-bridge.sdPlugin/imgs" *> $null
    if ($LASTEXITCODE -ne 0) { throw "Could not remove stale Discord Bridge generated output." }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is required for RatPack commands."
}

# Local XENEON build/package outputs are disposable and must never block a
# self-updating Rat command. Only known generated paths are cleaned here.
Remove-KnownGeneratedArtifacts
Recover-LegacyDiscordBridgeShipResidue

$dirty = Get-GitText -Arguments @("status", "--porcelain")
if ($dirty) {
    throw "The canonical RatPack checkout has local changes. Commit or stash them before running a self-updating Rat command.`n$dirty"
}

Write-Host "Refreshing RatPack command layer..." -ForegroundColor DarkGray
# Fetch main explicitly instead of relying on whatever remote refspec happens to be configured on
# this machine. This prevents a successful fetch from leaving origin/main stale.
Invoke-Git -Arguments @("fetch", "--prune", "origin", "+refs/heads/main:refs/remotes/origin/main")

$branch = Get-GitText -Arguments @("branch", "--show-current")
if ($branch -ne "main") {
    Invoke-Git -Arguments @("switch", "main")
}

$previousMainCommit = Get-GitText -Arguments @("rev-parse", "HEAD")
Invoke-Git -Arguments @("merge", "--ff-only", "refs/remotes/origin/main")

$localCommit = Get-GitText -Arguments @("rev-parse", "HEAD")
$remoteCommit = Get-GitText -Arguments @("rev-parse", "refs/remotes/origin/main")
if ($localCommit -ne $remoteCommit) {
    throw "RatPack bootstrap did not land on canonical origin/main. Local: $localCommit Remote: $remoteCommit"
}

try {
    Assert-RatCommandLayerSyntax
}
catch {
    $failedCommit = Get-GitText -Arguments @("rev-parse", "HEAD")
    if ($previousMainCommit -and $failedCommit -ne $previousMainCommit) {
        Write-Host "The refreshed RatPack command layer is invalid. Restoring the previous working main checkout..." -ForegroundColor Yellow
        Invoke-Git -Arguments @("reset", "--hard", $previousMainCommit)
    }
    throw "RatPack refused command-layer update $failedCommit because its local PowerShell does not parse. The previous working command layer was restored. Retry after canonical main is repaired. $($_.Exception.Message)"
}

$commit = Get-GitText -Arguments @("log", "-1", "--pretty=format:%h")
Write-Host "RatPack command layer is current at $commit." -ForegroundColor DarkGray

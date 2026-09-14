param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Slug
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Worktree = Join-Path $RepoRoot "out\dev\worktrees\$Slug"
. (Join-Path $PSScriptRoot "rat-dev-source.ps1")

function Get-StreamDeckCli {
    $cmd = Get-Command "streamdeck.cmd" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $exe = Get-Command "streamdeck.exe" -ErrorAction SilentlyContinue
    if ($exe) { return $exe.Source }

    $generic = Get-Command "streamdeck" -ErrorAction SilentlyContinue
    if ($generic) { return $generic.Source }

    return $null
}

function Invoke-StreamDeckCli {
    param(
        [string]$Cli,
        [string[]]$Arguments
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $Cli @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    return [PSCustomObject]@{
        Code = $code
        Output = @($output | ForEach-Object { [string]$_ })
    }
}

function Read-JsonFromGitObject {
    param([string]$Object)

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $raw = & git -C $RepoRoot show $Object 2>$null
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    if ($code -ne 0 -or -not $raw) { return $null }

    try {
        return (($raw -join "`n") | ConvertFrom-Json)
    }
    catch {
        throw "Invalid Rat Dev registration at $Object"
    }
}

function Get-Registration {
    $source = Resolve-RatDevInternalProductSource -RepoRoot $RepoRoot -Slug $Slug
    if ($source -and $source.Kind -eq "ratpack") {
        $productObject = "$($source.Ref):plugins/$Slug/rat-dev.json"
        $config = Read-RatDevJsonFromGitObject -RepoRoot $RepoRoot -Object $productObject
        if ($config) { return $config }
    }

    return (Read-RatDevJsonFromGitObject -RepoRoot $RepoRoot -Object "origin/main:plugins/$Slug/rat-dev.json")
}

function Test-ReusableCheckout {
    param($Config)

    if (-not (Test-Path $Worktree -PathType Container)) { return $false }

    if ($Config -and $Config.plugin_dir) {
        $manifestPath = Join-Path (Join-Path $Worktree ([string]$Config.plugin_dir)) "manifest.json"
        if (-not (Test-Path $manifestPath -PathType Leaf)) { return $false }
    }

    $gitMarker = Join-Path $Worktree ".git"
    if ($Config -and $Config.repository) {
        if (-not (Test-Path $gitMarker -PathType Container)) { return $false }

        $previous = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $remote = (& git -C $Worktree remote get-url origin 2>$null | Select-Object -First 1)
            $remoteCode = $LASTEXITCODE
            & git -C $Worktree rev-parse --is-inside-work-tree *> $null
            $worktreeCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previous
        }

        return ($remoteCode -eq 0 -and $worktreeCode -eq 0 -and [string]$remote -eq [string]$Config.repository)
    }

    if (-not (Test-Path $gitMarker -PathType Leaf)) { return $false }

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git -C $Worktree rev-parse --is-inside-work-tree *> $null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

function Remove-StaleCheckout {
    param(
        [string]$Cli,
        [string]$Uuid
    )

    if (-not (Test-Path $Worktree)) { return }

    Write-Host "Rat Dev found a stale local checkout. Releasing it before rebuilding..." -ForegroundColor Yellow

    if ($Cli -and $Uuid) {
        [void](Invoke-StreamDeckCli -Cli $Cli -Arguments @("stop", $Uuid))
        [void](Invoke-StreamDeckCli -Cli $Cli -Arguments @("unlink", "-d", $Uuid))
    }

    $lastError = $null
    for ($attempt = 1; $attempt -le 8; $attempt++) {
        Start-Sleep -Milliseconds (500 + (250 * $attempt))
        try {
            Remove-Item $Worktree -Recurse -Force -ErrorAction Stop
            $lastError = $null
            break
        }
        catch {
            $lastError = $_
            if ($attempt -lt 8) {
                Write-Host "Windows is still releasing the old development folder. Retrying..." -ForegroundColor DarkGray
                if ($Cli -and $Uuid) {
                    [void](Invoke-StreamDeckCli -Cli $cli -Arguments @("stop", $Uuid))
                    [void](Invoke-StreamDeckCli -Cli $cli -Arguments @("unlink", "-d", $Uuid))
                }
            }
        }
    }

    if ($lastError -and (Test-Path $Worktree)) {
        $deck = Get-Process -Name "StreamDeck" -ErrorAction SilentlyContinue | Select-Object -First 1
        $deckPath = $null
        if ($deck) {
            try { $deckPath = $deck.Path } catch { $deckPath = $null }
            Write-Host "The stale plugin is still locked. Restarting the Stream Deck app once to release it..." -ForegroundColor Yellow
            try {
                Stop-Process -Id $deck.Id -Force -ErrorAction Stop
                Start-Sleep -Seconds 2
                Remove-Item $Worktree -Recurse -Force -ErrorAction Stop
                $lastError = $null
            }
            catch {
                $lastError = $_
            }
            finally {
                if ($deckPath -and (Test-Path $deckPath)) {
                    Start-Process $deckPath
                    Start-Sleep -Seconds 2
                }
            }
        }
    }

    if ($lastError -and (Test-Path $Worktree)) {
        throw "Could not release the stale Rat Dev folder for '$Slug'. Close Stream Deck and any Explorer window opened inside '$Worktree', then retry: rat dev $Slug"
    }

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git -C $RepoRoot worktree prune *> $null
    }
    finally {
        $ErrorActionPreference = $previous
    }

    Write-Host "Stale Rat Dev checkout cleared." -ForegroundColor DarkGray
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is required for rat dev."
}

# Refresh refs so a first ever Rat Dev run can resolve external registrations
# and product metadata before the local development checkout exists. Git writes
# normal fetch progress to stderr, so capture only the actual process exit code
# while ErrorActionPreference is relaxed.
$previous = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    & git -C $RepoRoot fetch --prune origin 1>$null 2>$null
    $fetchCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previous
}
if ($fetchCode -ne 0) {
    throw "Could not fetch canonical RatPack refs before Rat Dev preflight."
}

$config = Get-Registration

if (-not (Test-Path $Worktree)) {
    Write-Host "Preparing Stream Deck development copy..." -ForegroundColor DarkGray
    exit 0
}

# A healthy checkout may currently be the directory Stream Deck is running from.
# Reuse it in place. rat-dev.ps1 keeps ordinary plugins live, but if a plugin owns
# a running native executable inside this checkout it will pause that plugin just
# before the build so Windows can release the executable file lock.
if (Test-ReusableCheckout -Config $config) {
    Write-Host "Existing Rat Dev checkout is reusable. Continuing without stale-checkout cleanup." -ForegroundColor DarkGray
    exit 0
}

$uuid = if ($config -and $config.plugin_uuid) { [string]$config.plugin_uuid } else { $null }
$cli = Get-StreamDeckCli
Remove-StaleCheckout -Cli $cli -Uuid $uuid
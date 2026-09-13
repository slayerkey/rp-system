param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Slug
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$DevRoot = Join-Path $RepoRoot "out\dev"
$WorktreeRoot = Join-Path $DevRoot "worktrees"
$Worktree = Join-Path $WorktreeRoot $Slug
. (Join-Path $PSScriptRoot "rat-dev-dependencies.ps1")
. (Join-Path $PSScriptRoot "rat-dev-source.ps1")

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $Hint"
    }
}

function Invoke-Checked {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$Failure
    )
    & $Command @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "$Failure (exit code $LASTEXITCODE)"
    }
}

function Test-GitRef {
    param([string]$Ref)
    & git -C $RepoRoot rev-parse --verify --quiet $Ref *> $null
    return $LASTEXITCODE -eq 0
}

function Test-GitObject {
    param([string]$Object)

    # Missing candidate paths are expected while Rat Dev probes product layouts.
    # Windows PowerShell can promote native stderr to a terminating error while
    # the script-wide ErrorActionPreference is Stop, so temporarily relax it.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git -C $RepoRoot cat-file -e $Object 2>$null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

function Ensure-StreamDeckCli {
    Require-Command "node" "Install Node.js 24 or newer."
    Require-Command "npm" "Install Node.js 24 or newer."

    $majorText = (& node -p "process.versions.node.split('.')[0]" 2>$null | Select-Object -First 1)
    $major = 0
    [void][int]::TryParse([string]$majorText, [ref]$major)
    if ($major -lt 24) {
        throw "Stream Deck CLI requires Node.js 24 or newer. Current Node major version: $majorText"
    }

    if (-not (Get-Command streamdeck -ErrorAction SilentlyContinue)) {
        Write-Host "Installing the official Stream Deck CLI once..." -ForegroundColor Cyan
        Invoke-Checked -Command "npm" -Arguments @("install", "-g", "@elgato/cli@latest") -Failure "Could not install @elgato/cli"
    }

    Require-Command "streamdeck" "Install with: npm install -g @elgato/cli@latest"
}

function Ensure-XeneonTools {
    Require-Command "python" "Install Python 3.13 or newer."
    Require-Command "node" "Install Node.js 24 or newer."
    Require-Command "npm" "Install Node.js 24 or newer."
}

function Read-OriginMainRegistration {
    return (Read-RatDevJsonFromGitObject -RepoRoot $RepoRoot -Object "origin/main:plugins/$Slug/rat-dev.json")
}

function Resolve-Source {
    Write-Host "Fetching canonical RatPack source..." -ForegroundColor Cyan
    Invoke-Checked -Command "git" -Arguments @("-C", $RepoRoot, "fetch", "--prune", "origin") -Failure "Git fetch failed"

    $productSource = Resolve-RatDevInternalProductSource -RepoRoot $RepoRoot -Slug $Slug
    if ($productSource) {
        return $productSource
    }

    $registration = Read-OriginMainRegistration
    if ($registration -and $registration.repository) {
        $externalRef = if ($registration.ref) { [string]$registration.ref } else { "product/$Slug" }
        $sourceRoot = if ($registration.source_root) { [string]$registration.source_root } else { "." }
        return [PSCustomObject]@{
            Kind = "external"
            Repository = [string]$registration.repository
            Ref = $externalRef
            Config = $registration
            SourceRoot = $sourceRoot
            Display = "$($registration.repository) @ $externalRef"
        }
    }

    $mainWidget = "origin/main:widgets/_src/$Slug"
    if (Test-GitObject $mainWidget) {
        return [PSCustomObject]@{
            Kind = "xeneon"
            Ref = "origin/main"
            Config = $null
            SourceRoot = "widgets\_src\$Slug"
            Display = "origin/main"
        }
    }

    $mainPlugin = "origin/main:plugins/$Slug"
    if (Test-GitObject $mainPlugin) {
        return [PSCustomObject]@{
            Kind = "ratpack"
            Ref = "origin/main"
            Config = $null
            SourceRoot = "plugins\$Slug"
            Display = "origin/main"
        }
    }

    throw "Could not find $Slug as a RatPack Stream Deck plugin, XENEON widget, or external Rat Dev registration."
}

function Remove-ExistingCheckout {
    if (Test-Path $Worktree) {
        Write-Host "Clearing stale local development checkout..." -ForegroundColor DarkGray
        Remove-Item $Worktree -Recurse -Force
    }

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git -C $RepoRoot worktree prune *> $null
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

function Sync-RatPackWorktree {
    param([string]$Ref)

    New-Item -ItemType Directory -Force -Path $WorktreeRoot | Out-Null

    $gitMarker = Join-Path $Worktree ".git"
    if ((Test-Path $Worktree) -and (Test-Path $gitMarker -PathType Leaf)) {
        Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "reset", "--hard", $Ref) -Failure "Could not update development worktree"
        Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "clean", "-fd") -Failure "Could not clean development worktree"
        return
    }

    if (Test-Path $Worktree) {
        Remove-ExistingCheckout
    }

    Invoke-Checked -Command "git" -Arguments @("-C", $RepoRoot, "worktree", "add", "--force", "--detach", $Worktree, $Ref) -Failure "Could not create development worktree"
}

function Resolve-ExternalTarget {
    param([string]$Ref)

    $remoteTarget = "origin/$Ref"
    & git -C $Worktree rev-parse --verify --quiet $remoteTarget *> $null
    if ($LASTEXITCODE -eq 0) {
        return $remoteTarget
    }

    & git -C $Worktree rev-parse --verify --quiet $Ref *> $null
    if ($LASTEXITCODE -eq 0) {
        return $Ref
    }

    throw "Could not resolve external development ref '$Ref' for $Slug."
}

function Test-ExternalCheckout {
    if (-not (Test-Path $Worktree -PathType Container)) { return $false }
    $gitDir = Join-Path $Worktree ".git"
    if (-not (Test-Path $gitDir -PathType Container)) { return $false }

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

function Sync-ExternalCheckout {
    param($Source)

    New-Item -ItemType Directory -Force -Path $WorktreeRoot | Out-Null
    $canReuse = Test-ExternalCheckout

    if ($canReuse) {
        # The slug owns this checkout path. Reuse a healthy Git checkout in place even when
        # Windows/Stream Deck currently has the .sdPlugin directory open. Deleting the checkout
        # while the linked plugin is running causes the exact access-denied failure Rat Dev is
        # designed to avoid. Reconcile origin to the canonical registration instead.
        $remoteUrl = (& git -C $Worktree remote get-url origin 2>$null | Select-Object -First 1)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$remoteUrl)) {
            Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "remote", "add", "origin", [string]$Source.Repository) -Failure "Could not configure external product origin"
        }
        elseif ([string]$remoteUrl -ne [string]$Source.Repository) {
            Write-Host "Reconciling external product origin..." -ForegroundColor DarkGray
            Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "remote", "set-url", "origin", [string]$Source.Repository) -Failure "Could not update external product origin"
        }
        Write-Host "Reusing external product checkout in place..." -ForegroundColor DarkGray
    }
    else {
        if (Test-Path $Worktree) {
            Remove-ExistingCheckout
        }
        Write-Host "Cloning external product source..." -ForegroundColor Cyan
        Invoke-Checked -Command "git" -Arguments @("clone", "--no-checkout", [string]$Source.Repository, $Worktree) -Failure "Could not clone external development repository"
    }

    Write-Host "Fetching external product updates..." -ForegroundColor Cyan
    Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "fetch", "--prune", "origin") -Failure "External product fetch failed"
    $target = Resolve-ExternalTarget ([string]$Source.Ref)
    Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "reset", "--hard", $target) -Failure "Could not update external development checkout"
    Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "clean", "-fd") -Failure "Could not clean external development checkout"
}

function Get-PluginRoot {
    param($Source)
    return (Join-Path $Worktree ([string]$Source.SourceRoot))
}

function Get-ExistingPluginUuid {
    param($Source)

    if ($Source.Config -and $Source.Config.plugin_uuid) {
        return [string]$Source.Config.plugin_uuid
    }
    if (-not (Test-Path $Worktree)) { return $null }

    $root = Get-PluginRoot $Source
    if (-not (Test-Path $root)) { return $null }

    $config = $Source.Config
    if (-not $config) {
        $configPath = Join-Path $root "rat-dev.json"
        if (Test-Path $configPath) {
            try { $config = Get-Content $configPath -Raw | ConvertFrom-Json } catch { }
        }
    }

    $pluginDir = $null
    if ($config -and $config.plugin_dir) {
        $pluginDir = Join-Path $root ([string]$config.plugin_dir)
    }
    if (-not $pluginDir) {
        $candidate = Get-ChildItem $root -Directory -Filter "*.sdPlugin" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($candidate) { $pluginDir = $candidate.FullName }
    }
    if (-not $pluginDir) { return $null }

    $manifestPath = Join-Path $pluginDir "manifest.json"
    if (-not (Test-Path $manifestPath)) { return $null }
    try {
        $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
        return [string]$manifest.UUID
    }
    catch {
        return $null
    }
}

function Build-And-TestPlugin {
    param(
        [string]$PluginRoot,
        $RegistrationConfig
    )

    if (-not (Test-Path $PluginRoot)) {
        throw "Plugin source not found after sync: $PluginRoot"
    }

    $config = $RegistrationConfig
    if (-not $config) {
        $configPath = Join-Path $PluginRoot "rat-dev.json"
        if (Test-Path $configPath) {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json
        }
    }
    if ($config -and $config.type -and [string]$config.type -ne "streamdeck-plugin") {
        throw "Rat Dev expected a streamdeck-plugin product. $Slug declares type '$($config.type)'."
    }

    $packagePath = Join-Path $PluginRoot "package.json"
    if (Test-Path $packagePath) {
        $package = Get-Content $packagePath -Raw | ConvertFrom-Json
        Assert-RatDevBuildPrerequisites -PluginRoot $PluginRoot -Slug $Slug
        $nodeModules = Join-Path $PluginRoot "node_modules"
        $lockPath = Join-Path $PluginRoot "package-lock.json"
        Push-Location $PluginRoot
        try {
            if (Test-Path $lockPath -PathType Leaf) {
                $dependencyState = Get-RatDevDependencyState -PluginRoot $PluginRoot
                if (-not $dependencyState.Current) {
                    if (Test-Path $nodeModules -PathType Container) {
                        Write-Host "Plugin dependencies changed. Refreshing locked install..." -ForegroundColor Cyan
                    }
                    else {
                        Write-Host "Installing plugin dependencies..." -ForegroundColor Cyan
                    }
                    Invoke-Checked -Command "npm" -Arguments @("ci", "--no-fund", "--no-audit") -Failure "npm ci failed"
                    Set-RatDevDependencyState -PluginRoot $PluginRoot
                }
            }
            elseif (-not (Test-Path $nodeModules) -and $package.dependencies) {
                Write-Host "Installing plugin dependencies..." -ForegroundColor Cyan
                Invoke-Checked -Command "npm" -Arguments @("install", "--no-fund", "--no-audit") -Failure "npm install failed"
            }

            if ($package.scripts.build) {
                Write-Host "Building $Slug..." -ForegroundColor Cyan
                Invoke-Checked -Command "npm" -Arguments @("run", "build") -Failure "Plugin build failed"
            }
            if ($package.scripts.test) {
                Write-Host "Testing $Slug..." -ForegroundColor Cyan
                Invoke-Checked -Command "npm" -Arguments @("test") -Failure "Plugin tests failed"
            }
        }
        finally {
            Pop-Location
        }
    }

    $pluginDir = $null
    if ($config -and $config.plugin_dir) {
        $pluginDir = Join-Path $PluginRoot ([string]$config.plugin_dir)
    }
    else {
        $candidate = Get-ChildItem $PluginRoot -Directory -Filter "*.sdPlugin" | Select-Object -First 1
        if ($candidate) { $pluginDir = $candidate.FullName }
    }

    if (-not $pluginDir -or -not (Test-Path $pluginDir)) {
        throw "Could not locate the built .sdPlugin directory under $PluginRoot"
    }

    $manifestPath = Join-Path $pluginDir "manifest.json"
    if (-not (Test-Path $manifestPath)) {
        throw "Stream Deck manifest not found: $manifestPath"
    }
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    if (-not $manifest.UUID) {
        throw "Stream Deck manifest is missing UUID."
    }

    Write-Host "Validating with the official Stream Deck CLI..." -ForegroundColor Cyan
    Invoke-Checked -Command "streamdeck" -Arguments @("validate", $pluginDir) -Failure "Stream Deck validation failed"

    return [PSCustomObject]@{
        Root = $PluginRoot
        PluginDir = $pluginDir
        Uuid = [string]$manifest.UUID
        Version = [string]$manifest.Version
        OpenUrl = if ($config -and $config.open_url) { [string]$config.open_url } else { $null }
    }
}

function Install-DevPlugin {
    param(
        $Plugin,
        [string]$PreviousUuid
    )

    Write-Host "Enabling Stream Deck developer mode..." -ForegroundColor DarkGray
    & streamdeck dev *> $null

    # Keep the currently linked plugin alive while source sync, build, tests, and validation run.
    # Only switch the link after the replacement has passed every local gate. This prevents a
    # failed Rat Dev update from turning an existing profile into unresolved question-mark keys.
    Write-Host "Switching $($Plugin.Uuid) to the validated development build..." -ForegroundColor Cyan
    if ($PreviousUuid -and $PreviousUuid -ne $Plugin.Uuid) {
        & streamdeck stop $PreviousUuid *> $null
        & streamdeck unlink -d $PreviousUuid *> $null
    }
    & streamdeck stop $Plugin.Uuid *> $null
    & streamdeck unlink -d $Plugin.Uuid *> $null
    Invoke-Checked -Command "streamdeck" -Arguments @("link", $Plugin.PluginDir) -Failure "Stream Deck link failed"
    Invoke-Checked -Command "streamdeck" -Arguments @("restart", $Plugin.Uuid) -Failure "Stream Deck restart failed"

    Write-Host ""
    Write-Host "Rat Dev updated $Slug." -ForegroundColor Green
    Write-Host "Version: $($Plugin.Version)"
    Write-Host "Source:  $($Plugin.Root)"
    Write-Host "Plugin:  $($Plugin.PluginDir)"

    if ($Plugin.OpenUrl) {
        Start-Sleep -Seconds 2
        Write-Host "Opening local status page: $($Plugin.OpenUrl)" -ForegroundColor DarkGray
        Start-Process $Plugin.OpenUrl
    }
}

function Build-XeneonWidget {
    Ensure-XeneonTools
    $sourcePath = Join-Path $Worktree "widgets\_src\$Slug"
    if (-not (Test-Path $sourcePath)) {
        throw "XENEON widget source not found after sync: $sourcePath"
    }

    Push-Location $Worktree
    try {
        $verify = Join-Path $sourcePath "verify.mjs"
        if (Test-Path $verify) {
            Write-Host "Running $Slug widget regression suite..." -ForegroundColor Cyan
            Invoke-Checked -Command "node" -Arguments @($verify, $Worktree) -Failure "XENEON widget regression suite failed"
        }

        Write-Host "Building canonical XENEON widget..." -ForegroundColor Cyan
        Invoke-Checked -Command "python" -Arguments @("tools\xeneon\inline.py", $Slug) -Failure "XENEON inline build failed"

        $shipping = Join-Path $Worktree "widgets\$Slug"
        if (-not (Test-Path $shipping)) {
            throw "XENEON shipping directory was not created: $shipping"
        }

        Write-Host "Validating with the official CORSAIR CLI..." -ForegroundColor Cyan
        Invoke-Checked -Command "npx" -Arguments @("--yes", "icuewidget-cli@0.4.47", "validate", $shipping) -Failure "Official CORSAIR validation failed"

        Get-ChildItem -Path (Join-Path $Worktree "widgets") -Filter "*.icuewidget" -File -ErrorAction SilentlyContinue | Remove-Item -Force
        Write-Host "Packaging with the official CORSAIR CLI..." -ForegroundColor Cyan
        Invoke-Checked -Command "npx" -Arguments @("--yes", "icuewidget-cli@0.4.47", "package", $shipping) -Failure "Official CORSAIR package failed"

        $package = Get-ChildItem -Path (Join-Path $Worktree "widgets") -Filter "*.icuewidget" -File |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if (-not $package) {
            throw "Official CORSAIR CLI completed without creating an .icuewidget package."
        }

        $destDir = Join-Path $DevRoot "packages\$Slug"
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        $dest = Join-Path $destDir "$Slug.icuewidget"
        Copy-Item $package.FullName $dest -Force

        Write-Host ""
        Write-Host "Rat Dev built $Slug for XENEON Edge." -ForegroundColor Green
        Write-Host "Source:  $sourcePath"
        Write-Host "Package: $dest"
        Write-Host "Opening the widget package for iCUE import..." -ForegroundColor DarkGray
        Start-Process $dest
        return $dest
    }
    finally {
        Pop-Location
    }
}

Require-Command "git" "Install Git for Windows first."
$source = Resolve-Source
Write-Host "Using $($source.Display)" -ForegroundColor DarkGray

if ($source.Kind -eq "xeneon") {
    Sync-RatPackWorktree ([string]$source.Ref)
    Build-XeneonWidget | Out-Null
    exit 0
}

Ensure-StreamDeckCli
$oldUuid = Get-ExistingPluginUuid $source

if ($source.Kind -eq "external") {
    Sync-ExternalCheckout $source
}
else {
    Sync-RatPackWorktree ([string]$source.Ref)
}

$pluginRoot = Get-PluginRoot $source
$plugin = Build-And-TestPlugin -PluginRoot $pluginRoot -RegistrationConfig $source.Config
Install-DevPlugin -Plugin $plugin -PreviousUuid $oldUuid
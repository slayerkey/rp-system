param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Slug,
    [Parameter(Position = 1)]
    [string]$Mode = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Worktree = Join-Path $RepoRoot "out\dev\worktrees\$Slug"
$StatePath = Join-Path $RepoRoot "out\dev\state\$Slug.json"
$RegistrationPath = Join-Path $RepoRoot "plugins\$Slug\rat-dev.json"
$Probe = [string]::Equals($Mode, "--probe", [System.StringComparison]::OrdinalIgnoreCase)

if ($Mode -and -not $Probe) {
    throw "Unknown Rat Audit option '$Mode'. Supported option: --probe"
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path $Path -PathType Leaf)) { return $null }
    try { return (Get-Content $Path -Raw | ConvertFrom-Json) }
    catch { throw "Invalid JSON file: $Path" }
}

function Find-AuditScript {
    param(
        [string]$SearchRoot,
        [string]$PreferredRoot
    )

    $preferred = @()
    if ($PreferredRoot) { $preferred += (Join-Path $PreferredRoot "scripts\host-audit.ps1") }
    $preferred += (Join-Path $SearchRoot "scripts\host-audit.ps1")
    foreach ($path in $preferred | Select-Object -Unique) {
        if (Test-Path $path -PathType Leaf) { return (Resolve-Path $path).Path }
    }

    $matches = @(Get-ChildItem $SearchRoot -Filter "host-audit.ps1" -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '[\\/](node_modules|\.git)[\\/]' } |
        Sort-Object { $_.FullName.Length })
    if ($matches.Count -eq 1) { return $matches[0].FullName }
    if ($matches.Count -gt 1) {
        $paths = ($matches | Select-Object -ExpandProperty FullName) -join [Environment]::NewLine
        throw "Multiple host audit scripts were found for '$Slug'. Rat Audit will not guess:`n$paths"
    }
    throw "'$Slug' does not expose scripts/host-audit.ps1 in its active Rat Dev source. This product does not support 'rat audit' yet."
}

function Resolve-InternalProductRoot {
    $metadataPath = Join-Path $Worktree "products\$Slug.json"
    $metadata = Read-JsonFile $metadataPath
    if (-not $metadata -or [string]$metadata.type -ne "plugin" -or -not $metadata.source) {
        return $null
    }

    $relativeSource = ([string]$metadata.source).Replace("/", "\")
    $candidate = Join-Path $Worktree $relativeSource
    if (-not (Test-Path $candidate -PathType Container)) {
        throw "Rat Audit product metadata for '$Slug' points to a missing source directory: $relativeSource"
    }

    $trimChars = [char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $resolvedWorktree = (Resolve-Path $Worktree).Path.TrimEnd($trimChars)
    $resolvedCandidate = (Resolve-Path $candidate).Path
    $prefix = $resolvedWorktree + [IO.Path]::DirectorySeparatorChar
    if (
        $resolvedCandidate -ne $resolvedWorktree -and
        -not $resolvedCandidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)
    ) {
        throw "Rat Audit refused source outside the active worktree for '$Slug': $resolvedCandidate"
    }

    return $resolvedCandidate
}

function Get-InternalGitValue {
    param([string[]]$Arguments)
    $gitMarker = Join-Path $Worktree ".git"
    if (-not (Test-Path $gitMarker)) { return "unknown" }

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $value = (& git -C $Worktree @Arguments 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -eq 0 -and $value) { return $value }
    }
    finally {
        $ErrorActionPreference = $previous
    }
    return "unknown"
}

function Resolve-AuditTarget {
    $registration = Read-JsonFile $RegistrationPath
    $isExternal = $registration -and [bool]$registration.repository -and [string]$registration.type -eq "streamdeck-plugin"

    if ($isExternal) {
        $state = Read-JsonFile $StatePath
        if (-not $state -or -not $state.plugin_path) {
            throw "No successful active Rat Dev deployment state exists for external product '$Slug'. Run 'rat dev $Slug' first."
        }
        $pluginPath = [string]$state.plugin_path
        if (-not (Test-Path $pluginPath -PathType Container)) {
            throw "The recorded active Rat Dev plugin path no longer exists for '$Slug': $pluginPath. Run 'rat dev $Slug' to create a fresh validated deployment."
        }
        $productRoot = Split-Path $pluginPath -Parent
        $auditPath = Find-AuditScript -SearchRoot $productRoot -PreferredRoot $productRoot
        return [PSCustomObject]@{
            AuditPath = $auditPath
            ProductRoot = $productRoot
            Commit = if ($state.commit) { [string]$state.commit } else { "unknown" }
            Branch = if ($state.ref) { [string]$state.ref } else { "unknown" }
            SourceKind = "external active build"
            PluginPath = $pluginPath
        }
    }

    if (-not (Test-Path $Worktree -PathType Container)) {
        throw "No Rat Dev worktree exists for '$Slug'. Run 'rat dev $Slug' first, then rerun 'rat audit $Slug'."
    }
    $metadataRoot = Resolve-InternalProductRoot
    if ($metadataRoot) {
        # Shared product families can intentionally use a source directory that
        # differs from the product slug. Once canonical product metadata names
        # that root, audit only inside it rather than scanning unrelated plugins.
        $preferredRoot = $metadataRoot
        $auditPath = Find-AuditScript -SearchRoot $metadataRoot -PreferredRoot $metadataRoot
        $productRoot = $metadataRoot
    }
    else {
        $preferredRoot = Join-Path $Worktree "plugins\$Slug"
        $auditPath = Find-AuditScript -SearchRoot $Worktree -PreferredRoot $preferredRoot
        $productRoot = Split-Path (Split-Path $auditPath -Parent) -Parent
    }
    $commit = Get-InternalGitValue @("rev-parse", "HEAD")
    $branch = Get-InternalGitValue @("branch", "--show-current")
    if ($branch -eq "unknown" -or [string]::IsNullOrWhiteSpace($branch)) { $branch = "detached" }
    return [PSCustomObject]@{
        AuditPath = $auditPath
        ProductRoot = $productRoot
        Commit = $commit
        Branch = $branch
        SourceKind = "RatPack worktree"
        PluginPath = $null
    }
}

function Invoke-ChildPowerShell {
    param([string]$ScriptPath)
    $engine = (Get-Process -Id $PID).Path
    $arguments = @("-NoLogo", "-NoProfile")
    if ($IsWindows -or $env:OS -eq "Windows_NT") {
        $arguments += @("-ExecutionPolicy", "Bypass")
    }
    $arguments += @("-File", $ScriptPath)
    & $engine @arguments
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        throw "Host audit failed for '$Slug' (exit code $code). Keep the audit output and product logs intact before changing or reinstalling anything."
    }
}

$target = Resolve-AuditTarget

Write-Host "Rat Audit: $Slug" -ForegroundColor Cyan
Write-Host "Source kind:   $($target.SourceKind)"
Write-Host "Source commit: $($target.Commit)"
Write-Host "Source branch: $($target.Branch)"
Write-Host "Product root:  $($target.ProductRoot)"
if ($target.PluginPath) { Write-Host "Active plugin: $($target.PluginPath)" }
Write-Host "Audit script:  $($target.AuditPath)"
Write-Host ""

Invoke-ChildPowerShell $target.AuditPath

if ($Probe) {
    $packagePath = Join-Path $target.ProductRoot "package.json"
    if (-not (Test-Path $packagePath -PathType Leaf)) {
        throw "'$Slug' passed its host audit but has no package.json for the optional probe."
    }
    $package = Get-Content $packagePath -Raw | ConvertFrom-Json
    if (-not $package.scripts -or -not $package.scripts.'host:probe') {
        throw "'$Slug' passed its host audit but does not define an npm 'host:probe' script."
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm is required for '$Slug' host:probe. Install Node.js/npm and retry."
    }

    Write-Host ""
    Write-Host "Running $Slug deep host probe..." -ForegroundColor Cyan
    Push-Location $target.ProductRoot
    try {
        & npm run host:probe
        if ($LASTEXITCODE -ne 0) {
            throw "Deep host probe failed for '$Slug' (exit code $LASTEXITCODE). Keep the output and product logs intact before changing or reinstalling anything."
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Rat Audit completed for $Slug." -ForegroundColor Green
if (-not $Probe) {
    Write-Host "For a deeper product transport probe when supported: rat audit $Slug --probe" -ForegroundColor DarkGray
}

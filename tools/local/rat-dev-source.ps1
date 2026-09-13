function Test-RatDevGitRef {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Ref
    )

    $previous = $ErrorActionPreference
    $previousExitCode = $global:LASTEXITCODE
    $ErrorActionPreference = "Continue"
    try {
        & git -C $RepoRoot rev-parse --verify --quiet $Ref *> $null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previous
        $global:LASTEXITCODE = $previousExitCode
    }
}

function Test-RatDevGitObject {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Object
    )

    $previous = $ErrorActionPreference
    $previousExitCode = $global:LASTEXITCODE
    $ErrorActionPreference = "Continue"
    try {
        & git -C $RepoRoot cat-file -e $Object 2>$null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previous
        $global:LASTEXITCODE = $previousExitCode
    }
}

function Read-RatDevJsonFromGitObject {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Object
    )

    $previous = $ErrorActionPreference
    $previousExitCode = $global:LASTEXITCODE
    $ErrorActionPreference = "Continue"
    try {
        $raw = & git -C $RepoRoot show $Object 2>$null
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
        $global:LASTEXITCODE = $previousExitCode
    }

    if ($code -ne 0 -or -not $raw) { return $null }

    try {
        return (($raw -join "`n") | ConvertFrom-Json)
    }
    catch {
        throw "Invalid Rat Dev JSON object: $Object"
    }
}


function Resolve-RatDevProductMetadataSource {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Ref,
        [Parameter(Mandatory = $true)][string]$Slug
    )

    $metadata = Read-RatDevJsonFromGitObject -RepoRoot $RepoRoot -Object "${Ref}:products/$Slug.json"
    if (-not $metadata) { return $null }
    if ([string]$metadata.type -ne "plugin") { return $null }
    if (-not $metadata.source) { return $null }

    $sourcePath = [string]$metadata.source
    if (-not (Test-RatDevGitObject -RepoRoot $RepoRoot -Object "${Ref}:$sourcePath")) {
        return $null
    }

    $config = [PSCustomObject]@{
        type = "streamdeck-plugin"
        plugin_dir = if ($metadata.ship_plugin_dir) { [string]$metadata.ship_plugin_dir } else { $null }
        plugin_uuid = if ($metadata.plugin_uuid) { [string]$metadata.plugin_uuid } else { $null }
    }

    return [PSCustomObject]@{
        Kind = "ratpack"
        Ref = $Ref
        Config = $config
        SourceRoot = $sourcePath.Replace("/", "\")
        Display = "$Ref via products/$Slug.json"
    }
}

function Get-RatDevProductRefs {
    param([Parameter(Mandatory = $true)][string]$RepoRoot)

    $previous = $ErrorActionPreference
    $previousExitCode = $global:LASTEXITCODE
    $ErrorActionPreference = "Continue"
    try {
        $refs = & git -C $RepoRoot for-each-ref "--format=%(refname:short)" "refs/remotes/origin/product" 2>$null
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
        $global:LASTEXITCODE = $previousExitCode
    }

    if ($code -ne 0) { return @() }
    return @($refs | ForEach-Object { [string]$_ } | Where-Object { $_ -and $_ -ne "origin/product/HEAD" } | Sort-Object -Unique)
}

function Resolve-RatDevInternalProductSource {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Slug
    )

    $exact = "origin/product/$Slug"

    # An exact product/<slug> branch is authoritative when it actually owns the
    # requested product. If it is absent or does not contain the product, fall
    # back to discovery across every other product branch.
    if (Test-RatDevGitRef -RepoRoot $RepoRoot -Ref $exact) {
        $metadataMatch = Resolve-RatDevProductMetadataSource -RepoRoot $RepoRoot -Ref $exact -Slug $Slug
        if ($metadataMatch) {
            return $metadataMatch
        }

        $pluginObject = "${exact}:plugins/$Slug"
        $widgetObject = "${exact}:widgets/_src/$Slug"
        $hasPlugin = Test-RatDevGitObject -RepoRoot $RepoRoot -Object $pluginObject
        $hasWidget = Test-RatDevGitObject -RepoRoot $RepoRoot -Object $widgetObject

        if ($hasPlugin -and $hasWidget) {
            throw "Rat Dev found both plugin and XENEON sources for '$Slug' on $exact."
        }

        if ($hasPlugin -or $hasWidget) {
            return [PSCustomObject]@{
                Kind = if ($hasPlugin) { "ratpack" } else { "xeneon" }
                Ref = $exact
                Config = $null
                SourceRoot = if ($hasPlugin) { "plugins\\$Slug" } else { "widgets\\_src\\$Slug" }
                Display = $exact
            }
        }
    }

    $matches = @()
    $allRefs = Get-RatDevProductRefs -RepoRoot $RepoRoot

    foreach ($ref in $allRefs) {
        if ($ref -eq $exact) { continue }
        if (-not (Test-RatDevGitRef -RepoRoot $RepoRoot -Ref $ref)) { continue }

        # Canonical product metadata can point multiple SKUs at one shared source
        # directory, e.g. Lite + Pro editions under plugins/<family>.
        $metadataMatch = Resolve-RatDevProductMetadataSource -RepoRoot $RepoRoot -Ref $ref -Slug $Slug
        if ($metadataMatch) {
            $matches += $metadataMatch
            continue
        }

        $pluginObject = "${ref}:plugins/$Slug"
        $widgetObject = "${ref}:widgets/_src/$Slug"
        $hasPlugin = Test-RatDevGitObject -RepoRoot $RepoRoot -Object $pluginObject
        $hasWidget = Test-RatDevGitObject -RepoRoot $RepoRoot -Object $widgetObject

        if ($hasPlugin -and $hasWidget) {
            throw "Rat Dev found both plugin and XENEON sources for '$Slug' on $ref."
        }

        if ($hasPlugin -or $hasWidget) {
            $matches += [PSCustomObject]@{
                Kind = if ($hasPlugin) { "ratpack" } else { "xeneon" }
                Ref = $ref
                Config = $null
                SourceRoot = if ($hasPlugin) { "plugins\\$Slug" } else { "widgets\\_src\\$Slug" }
                Display = $ref
            }
        }
    }

    if ($matches.Count -eq 1) {
        return $matches[0]
    }

    if ($matches.Count -gt 1) {
        $refs = ($matches | ForEach-Object { $_.Ref }) -join ", "
        throw "Rat Dev found '$Slug' on multiple product branches: $refs. Keep one owning family branch, or add an exact product/$Slug branch."
    }

    return $null
}

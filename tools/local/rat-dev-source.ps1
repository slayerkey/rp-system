function Test-RatDevGitRef {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Ref
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git -C $RepoRoot rev-parse --verify --quiet $Ref *> $null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

function Test-RatDevGitObject {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Object
    )

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

function Read-RatDevJsonFromGitObject {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Object
    )

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
        throw "Invalid Rat Dev JSON object: $Object"
    }
}

function Get-RatDevProductRefs {
    param([Parameter(Mandatory = $true)][string]$RepoRoot)

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $refs = & git -C $RepoRoot for-each-ref "--format=%(refname:short)" "refs/remotes/origin/product" 2>$null
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
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
    $familySlug = $Slug -replace '-(lite|pro)$', ''
    $preferred = @($exact)
    if ($familySlug -ne $Slug) {
        $preferred += "origin/product/$familySlug"
    }

    $allRefs = Get-RatDevProductRefs -RepoRoot $RepoRoot
    $orderedRefs = @($preferred + $allRefs | Select-Object -Unique)
    $matches = @()

    foreach ($ref in $orderedRefs) {
        if (-not (Test-RatDevGitRef -RepoRoot $RepoRoot -Ref $ref)) { continue }

        $pluginObject = "${ref}:plugins/$Slug"
        $widgetObject = "${ref}:widgets/_src/$Slug"
        $hasPlugin = Test-RatDevGitObject -RepoRoot $RepoRoot -Object $pluginObject
        $hasWidget = Test-RatDevGitObject -RepoRoot $RepoRoot -Object $widgetObject

        if ($hasPlugin -and $hasWidget) {
            throw "Rat Dev found both plugin and XENEON sources for '$Slug' on $ref."
        }

        if ($hasPlugin -or $hasWidget) {
            $match = [PSCustomObject]@{
                Kind = if ($hasPlugin) { "ratpack" } else { "xeneon" }
                Ref = $ref
                Config = $null
                SourceRoot = if ($hasPlugin) { "plugins\$Slug" } else { "widgets\_src\$Slug" }
                Display = $ref
            }

            if ($ref -eq $exact -or ($familySlug -ne $Slug -and $ref -eq "origin/product/$familySlug")) {
                return $match
            }

            $matches += $match
        }
    }

    if ($matches.Count -eq 1) {
        return $matches[0]
    }

    if ($matches.Count -gt 1) {
        $refs = ($matches | ForEach-Object { $_.Ref }) -join ", "
        throw "Rat Dev found '$Slug' on multiple product branches: $refs. Use an exact product/<slug> or family branch name."
    }

    return $null
}

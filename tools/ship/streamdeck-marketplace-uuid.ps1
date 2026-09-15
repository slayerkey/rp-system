$ErrorActionPreference = "Stop"

function Get-RatStreamDeckMarketplaceUuidOverride {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$PluginSlug
    )

    $path = Join-Path $RepoRoot "tools\ship\streamdeck-marketplace-uuid-overrides.json"
    if (-not (Test-Path $path -PathType Leaf)) { return $null }

    $config = Get-Content $path -Raw | ConvertFrom-Json
    $property = $config.products.PSObject.Properties[$PluginSlug]
    if ($null -eq $property) { return $null }

    $uuid = ([string]$property.Value).Trim()
    if ([string]::IsNullOrWhiteSpace($uuid)) { return $null }
    if ($uuid -notmatch '^[a-z0-9]+(?:[.-][a-z0-9-]+)*$') {
        throw "Invalid Stream Deck Marketplace UUID override for '$PluginSlug': $uuid"
    }
    return $uuid
}

function Update-RatStreamDeckProfileUuid {
    param(
        [Parameter(Mandatory = $true)][string]$ProfilePath,
        [Parameter(Mandatory = $true)][string]$OldUuid,
        [Parameter(Mandatory = $true)][string]$NewUuid
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $work = Join-Path ([System.IO.Path]::GetTempPath()) ("PackRat\profile-uuid-" + [guid]::NewGuid().ToString("N"))
    $extract = Join-Path $work "extract"
    New-Item -ItemType Directory -Force -Path $extract | Out-Null
    try {
        [System.IO.Compression.ZipFile]::ExtractToDirectory($ProfilePath, $extract)
        foreach ($file in Get-ChildItem -Path $extract -Recurse -File -Filter *.json) {
            $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
            if ($text.Contains($OldUuid)) {
                [System.IO.File]::WriteAllText(
                    $file.FullName,
                    $text.Replace($OldUuid, $NewUuid),
                    (New-Object System.Text.UTF8Encoding($false))
                )
            }
        }

        Remove-Item $ProfilePath -Force
        [System.IO.Compression.ZipFile]::CreateFromDirectory(
            $extract,
            $ProfilePath,
            [System.IO.Compression.CompressionLevel]::Optimal,
            $false
        )
    }
    finally {
        if (Test-Path $work) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
    }
}

function Convert-RatStreamDeckPluginIdentity {
    param(
        [Parameter(Mandatory = $true)][string]$PluginDirectory,
        [Parameter(Mandatory = $true)][string]$NewUuid
    )

    $manifestPath = Join-Path $PluginDirectory "manifest.json"
    if (-not (Test-Path $manifestPath -PathType Leaf)) {
        throw "Cannot rewrite Stream Deck UUID because manifest.json is missing: $manifestPath"
    }

    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $oldUuid = ([string]$manifest.UUID).Trim()
    if ([string]::IsNullOrWhiteSpace($oldUuid)) {
        throw "Cannot rewrite Stream Deck UUID because manifest UUID is empty: $manifestPath"
    }
    if ($oldUuid -eq $NewUuid) { return (Resolve-Path $PluginDirectory).Path }

    $textExtensions = @(".json", ".js", ".mjs", ".cjs", ".html", ".css", ".txt")
    foreach ($file in Get-ChildItem -Path $PluginDirectory -Recurse -File) {
        if ($file.Extension -in $textExtensions) {
            $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
            if ($text.Contains($oldUuid)) {
                [System.IO.File]::WriteAllText(
                    $file.FullName,
                    $text.Replace($oldUuid, $NewUuid),
                    (New-Object System.Text.UTF8Encoding($false))
                )
            }
        }
    }

    foreach ($profile in Get-ChildItem -Path $PluginDirectory -Recurse -File -Filter *.streamDeckProfile) {
        Update-RatStreamDeckProfileUuid -ProfilePath $profile.FullName -OldUuid $oldUuid -NewUuid $NewUuid
    }

    $rewrittenManifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    if ([string]$rewrittenManifest.UUID -ne $NewUuid) {
        throw "Stream Deck UUID rewrite failed: manifest still reports '$($rewrittenManifest.UUID)' instead of '$NewUuid'."
    }
    foreach ($action in @($rewrittenManifest.Actions)) {
        $actionUuid = ([string]$action.UUID).Trim()
        if (-not $actionUuid.StartsWith("$NewUuid.", [System.StringComparison]::Ordinal)) {
            throw "Stream Deck action UUID '$actionUuid' is not prefixed by rewritten plugin UUID '$NewUuid'."
        }
    }

    $oldNamespacePattern = [regex]::Escape($oldUuid) + '(?=$|[^a-z0-9-])'
    foreach ($file in Get-ChildItem -Path $PluginDirectory -Recurse -File) {
        if ($file.Extension -in $textExtensions) {
            $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
            if ($text -match $oldNamespacePattern) {
                throw "Old Stream Deck plugin UUID '$oldUuid' remains after rewrite in $($file.FullName)."
            }
        }
    }

    $parent = Split-Path $PluginDirectory -Parent
    $target = Join-Path $parent "$NewUuid.sdPlugin"
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    Move-Item $PluginDirectory $target
    return (Resolve-Path $target).Path
}

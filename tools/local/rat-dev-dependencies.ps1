function Get-RatDevDependencyFingerprint {
    param([string]$PluginRoot)

    $packagePath = Join-Path $PluginRoot "package.json"
    $lockPath = Join-Path $PluginRoot "package-lock.json"
    if (-not (Test-Path $packagePath -PathType Leaf) -or -not (Test-Path $lockPath -PathType Leaf)) {
        return $null
    }

    $packageHash = (Get-FileHash -Path $packagePath -Algorithm SHA256).Hash
    $lockHash = (Get-FileHash -Path $lockPath -Algorithm SHA256).Hash
    return "$packageHash|$lockHash"
}

function Get-RatDevDependencyState {
    param([string]$PluginRoot)

    $fingerprint = Get-RatDevDependencyFingerprint -PluginRoot $PluginRoot
    $nodeModules = Join-Path $PluginRoot "node_modules"
    $markerPath = Join-Path $nodeModules ".ratpack-dependency-fingerprint"

    if (-not $fingerprint) {
        return [PSCustomObject]@{
            Locked = $false
            Current = $false
            Fingerprint = $null
            MarkerPath = $markerPath
        }
    }

    $installedFingerprint = $null
    if (Test-Path $markerPath -PathType Leaf) {
        $installedFingerprint = ([string](Get-Content $markerPath -Raw)).Trim()
    }

    return [PSCustomObject]@{
        Locked = $true
        Current = (Test-Path $nodeModules -PathType Container) -and $installedFingerprint -eq $fingerprint
        Fingerprint = $fingerprint
        MarkerPath = $markerPath
    }
}

function Set-RatDevDependencyState {
    param([string]$PluginRoot)

    $state = Get-RatDevDependencyState -PluginRoot $PluginRoot
    if (-not $state.Locked -or -not $state.Fingerprint) {
        throw "Cannot record Rat Dev dependency state without package.json and package-lock.json."
    }

    $nodeModules = Join-Path $PluginRoot "node_modules"
    if (-not (Test-Path $nodeModules -PathType Container)) {
        throw "Cannot record Rat Dev dependency state before node_modules exists."
    }

    Set-Content -Path $state.MarkerPath -Value $state.Fingerprint -NoNewline -Encoding ascii
}

function Get-RatDevDotNetSdkVersions {
    if (-not (Get-Command "dotnet" -ErrorAction SilentlyContinue)) {
        return @()
    }

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $lines = @(& dotnet --list-sdks 2>$null)
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    if ($code -ne 0) { return @() }

    return @(
        $lines |
            ForEach-Object {
                $text = ([string]$_).Trim()
                if ($text -match '^([0-9]+(?:\.[0-9]+){1,3})\s') {
                    $matches[1]
                }
            } |
            Where-Object { $_ }
    )
}

function Assert-RatDevBuildPrerequisites {
    param(
        [string]$PluginRoot,
        [string]$Slug
    )

    $projects = @(
        Get-ChildItem -Path $PluginRoot -Recurse -Filter *.csproj -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.FullName -notmatch '[\\/](?:node_modules|bin|obj)[\\/]'
            }
    )
    if (-not $projects.Count) { return }

    $sdkVersions = @(Get-RatDevDotNetSdkVersions)
    $hasModernSdk = $false
    foreach ($version in $sdkVersions) {
        $majorText = ([string]$version).Split('.')[0]
        $major = 0
        if ([int]::TryParse($majorText, [ref]$major) -and $major -ge 8) {
            $hasModernSdk = $true
            break
        }
    }

    if ($hasModernSdk) { return }

    $product = if ($Slug) { "'$Slug'" } else { "this plugin" }
    throw @"
Rat Dev cannot build $product because its source includes a .NET project, but this PC does not have a .NET 8+ SDK.
A .NET runtime by itself is not enough.

Install the SDK once:
  winget install --id Microsoft.DotNet.SDK.8 -e --source winget

Then rerun:
  rat dev $Slug
"@.Trim()
}


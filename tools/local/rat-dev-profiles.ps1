function Get-RatDevProfileFingerprint {
    param([Parameter(Mandatory = $true)][string]$ProfilePath)
    if (-not (Test-Path $ProfilePath -PathType Leaf)) {
        throw "Profile file not found: $ProfilePath"
    }
    return ((Get-FileHash -Path $ProfilePath -Algorithm SHA256).Hash).ToLowerInvariant()
}

function Get-RatDevBundledProfileName {
    param([Parameter(Mandatory = $true)][string]$ProfilePath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ProfilePath)
    try {
        $entry = $archive.Entries |
            Where-Object { $_.FullName -match '\.sdProfile/manifest\.json$' -and $_.FullName -notmatch '/Profiles/' } |
            Select-Object -First 1
        if (-not $entry) { return $null }

        $reader = New-Object System.IO.StreamReader($entry.Open())
        try {
            $manifest = ($reader.ReadToEnd() | ConvertFrom-Json)
            if ($manifest.Name) { return [string]$manifest.Name }
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $archive.Dispose()
    }
    return $null
}

function Get-RatDevInstalledProfileRoots {
    param([string[]]$OverrideRoots)

    if ($OverrideRoots) { return @($OverrideRoots) }
    if ($env:OS -ne "Windows_NT" -or [string]::IsNullOrWhiteSpace($env:APPDATA)) { return @() }

    return @(
        (Join-Path $env:APPDATA "Elgato\StreamDeck\ProfilesV3"),
        (Join-Path $env:APPDATA "Elgato\StreamDeck\ProfilesV2")
    )
}

function Find-RatDevInstalledProfile {
    param(
        [Parameter(Mandatory = $true)][string]$ProfileName,
        [string[]]$InstalledRoots
    )

    foreach ($root in @(Get-RatDevInstalledProfileRoots -OverrideRoots $InstalledRoots)) {
        if (-not (Test-Path $root -PathType Container)) { continue }

        foreach ($dir in @(Get-ChildItem -Path $root -Directory -Filter "*.sdProfile" -ErrorAction SilentlyContinue)) {
            $manifestPath = Join-Path $dir.FullName "manifest.json"
            if (-not (Test-Path $manifestPath -PathType Leaf)) { continue }
            try {
                $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
                if ([string]$manifest.Name -eq $ProfileName) {
                    return [PSCustomObject]@{
                        Found = $true
                        Name = [string]$manifest.Name
                        Path = $dir.FullName
                    }
                }
            }
            catch { }
        }
    }

    return [PSCustomObject]@{ Found = $false; Name = $ProfileName; Path = $null }
}

function Get-RatDevProfileStatePath {
    param(
        [Parameter(Mandatory = $true)][string]$StateRoot,
        [Parameter(Mandatory = $true)][string]$Slug
    )
    return (Join-Path $StateRoot ("profiles\" + $Slug + ".json"))
}

function Read-RatDevProfileState {
    param(
        [Parameter(Mandatory = $true)][string]$StateRoot,
        [Parameter(Mandatory = $true)][string]$Slug
    )

    $path = Get-RatDevProfileStatePath -StateRoot $StateRoot -Slug $Slug
    if (-not (Test-Path $path -PathType Leaf)) { return $null }
    try { return (Get-Content $path -Raw | ConvertFrom-Json) } catch { return $null }
}

function Write-RatDevProfileState {
    param(
        [Parameter(Mandatory = $true)][string]$StateRoot,
        [Parameter(Mandatory = $true)][string]$Slug,
        [Parameter(Mandatory = $true)][string]$ProfilePath,
        [Parameter(Mandatory = $true)][string]$Fingerprint,
        [string]$ProfileName
    )

    $path = Get-RatDevProfileStatePath -StateRoot $StateRoot -Slug $Slug
    New-Item -ItemType Directory -Force -Path (Split-Path $path -Parent) | Out-Null
    [PSCustomObject]@{
        state_version = 2
        slug = $Slug
        profile_path = $ProfilePath
        profile_name = $ProfileName
        sha256 = $Fingerprint
        updated_utc = [DateTime]::UtcNow.ToString("o")
    } | ConvertTo-Json | Set-Content -Path $path -Encoding UTF8
}

function Get-RatDevProfileOpenDecision {
    param(
        [Parameter(Mandatory = $true)][string]$ProfilePath,
        [Parameter(Mandatory = $true)][string]$StateRoot,
        [Parameter(Mandatory = $true)][string]$Slug,
        [string[]]$InstalledRoots
    )

    $fingerprint = Get-RatDevProfileFingerprint -ProfilePath $ProfilePath
    $profileName = Get-RatDevBundledProfileName -ProfilePath $ProfilePath
    $state = Read-RatDevProfileState -StateRoot $StateRoot -Slug $Slug
    $installed = if ($profileName) {
        Find-RatDevInstalledProfile -ProfileName $profileName -InstalledRoots $InstalledRoots
    }
    else {
        [PSCustomObject]@{ Found = $false; Name = $null; Path = $null }
    }

    # Stream Deck does not expose a supported in-place profile replacement command
    # to Rat Dev. Never open another bundle while a same-named installed profile is
    # unverified, because Stream Deck may create a duplicate instead of replacing it.
    if (-not $state -and $installed.Found) {
        return [PSCustomObject]@{ Open=$false; ManualRefresh=$true; Adopt=$false; Reason="existing-installed-untracked"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path }
    }

    $stateVersion = if ($state -and $state.state_version) { [int]$state.state_version } else { 0 }
    if ($state -and $stateVersion -lt 2 -and $installed.Found) {
        return [PSCustomObject]@{ Open=$false; ManualRefresh=$true; Adopt=$false; Reason="profile-state-upgrade"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path }
    }

    if ($state -and [string]$state.sha256 -eq $fingerprint -and $installed.Found) {
        return [PSCustomObject]@{ Open=$false; ManualRefresh=$false; Adopt=$false; Reason="unchanged-installed"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path }
    }

    if ($state -and [string]$state.sha256 -eq $fingerprint -and -not $installed.Found) {
        return [PSCustomObject]@{ Open=$true; ManualRefresh=$false; Adopt=$false; Reason="installed-profile-missing"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$null }
    }

    if ($state -and [string]$state.sha256 -ne $fingerprint -and $installed.Found) {
        return [PSCustomObject]@{ Open=$false; ManualRefresh=$true; Adopt=$false; Reason="profile-changed"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path }
    }

    if ($state -and [string]$state.sha256 -ne $fingerprint) {
        return [PSCustomObject]@{ Open=$true; ManualRefresh=$false; Adopt=$false; Reason="profile-changed"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$null }
    }

    return [PSCustomObject]@{ Open=$true; ManualRefresh=$false; Adopt=$false; Reason="first-import"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path }
}

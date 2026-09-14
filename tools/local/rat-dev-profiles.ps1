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

    $matches = @()
    foreach ($root in @(Get-RatDevInstalledProfileRoots -OverrideRoots $InstalledRoots)) {
        if (-not (Test-Path $root -PathType Container)) { continue }

        foreach ($dir in @(Get-ChildItem -Path $root -Directory -Filter "*.sdProfile" -ErrorAction SilentlyContinue)) {
            $manifestPath = Join-Path $dir.FullName "manifest.json"
            if (-not (Test-Path $manifestPath -PathType Leaf)) { continue }
            try {
                $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
                if ([string]$manifest.Name -eq $ProfileName) {
                    $matches += [PSCustomObject]@{
                        Name = [string]$manifest.Name
                        Path = $dir.FullName
                    }
                }
            }
            catch { }
        }
    }

    if ($matches.Count) {
        return [PSCustomObject]@{
            Found = $true
            Name = $ProfileName
            Path = [string]$matches[0].Path
            Paths = @($matches | ForEach-Object { [string]$_.Path })
            Count = $matches.Count
        }
    }

    return [PSCustomObject]@{ Found = $false; Name = $ProfileName; Path = $null; Paths = @(); Count = 0 }
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
        state_version = 3
        slug = $Slug
        profile_path = $ProfilePath
        profile_name = $ProfileName
        sha256 = $Fingerprint
        updated_utc = [DateTime]::UtcNow.ToString("o")
    } | ConvertTo-Json | Set-Content -Path $path -Encoding UTF8
}



function Get-RatDevProfileActionIdsFromArchive {
    param([Parameter(Mandatory = $true)][string]$ProfilePath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ProfilePath)
    $values = @()
    try {
        foreach ($entry in @($archive.Entries | Where-Object { $_.FullName -match '/Profiles/.+/manifest\.json    param([Parameter(Mandatory = $true)][string]$ProfileRoot)
    $values = @()
    foreach ($manifestPath in @(Get-ChildItem -Path $ProfileRoot -Recurse -File -Filter "manifest.json" -ErrorAction SilentlyContinue)) {
        try {
            $manifest = Get-Content $manifestPath.FullName -Raw | ConvertFrom-Json
            if ($manifest.Actions) {
                foreach ($property in $manifest.Actions.PSObject.Properties) {
                    if ($property.Value.UUID) { $values += [string]$property.Value.UUID }
                }
            }
            foreach ($controller in @($manifest.Controllers)) {
                if (-not $controller.Actions) { continue }
                foreach ($property in $controller.Actions.PSObject.Properties) {
                    if ($property.Value.UUID) { $values += [string]$property.Value.UUID }
                }
            }
        }
        catch { }
    }
    return @($values | Sort-Object)
}

function Test-RatDevProfileRoot {
    param(
        [Parameter(Mandatory = $true)][string]$ProfileRoot,
        [string]$ExpectedName,
        [string[]]$ExpectedActionUuids
    )
    $manifestPath = Join-Path $ProfileRoot "manifest.json"
    if (-not (Test-Path $manifestPath -PathType Leaf)) {
        throw "Installed Stream Deck profile is missing manifest.json: $ProfileRoot"
    }
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    if ($ExpectedName -and [string]$manifest.Name -ne $ExpectedName) {
        throw "Installed profile name mismatch after refresh. Expected '$ExpectedName', got '$($manifest.Name)'."
    }
    if ($manifest.Pages -and @($manifest.Pages.Pages).Count) {
        $pageRoot = Join-Path $ProfileRoot "Profiles"
        if (-not (Test-Path $pageRoot -PathType Container)) {
            throw "Installed Stream Deck profile is missing its Profiles page directory."
        }
        $pageManifests = @(Get-ChildItem -Path $pageRoot -Recurse -File -Filter "manifest.json" -ErrorAction SilentlyContinue)
        if ($pageManifests.Count -lt @($manifest.Pages.Pages).Count) {
            throw "Installed Stream Deck profile page count is incomplete after refresh."
        }
    }
    if ($ExpectedActionUuids) {
        $actual = @(Get-RatDevProfileActionUuids -ProfileRoot $ProfileRoot)
        $expected = @($ExpectedActionUuids | Sort-Object)
        if (@(Compare-Object -ReferenceObject $expected -DifferenceObject $actual).Count) {
            throw "Installed Stream Deck profile action UUIDs do not match the validated bundled profile."
        }
    }
    return $manifest
}

function Expand-RatDevProfileBundle {
    param(
        [Parameter(Mandatory = $true)][string]$ProfilePath,
        [Parameter(Mandatory = $true)][string]$Destination
    )
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ProfilePath, $Destination)
    $roots = @(Get-ChildItem -Path $Destination -Directory -Filter "*.sdProfile" -ErrorAction SilentlyContinue)
    if ($roots.Count -ne 1) {
        throw "Expected exactly one .sdProfile root inside '$ProfilePath'; found $($roots.Count)."
    }
    return $roots[0].FullName
}

function Stop-RatDevStreamDeckForProfileSwap {
    $running = @(Get-Process -Name "StreamDeck" -ErrorAction SilentlyContinue)
    if (-not $running.Count) {
        return [PSCustomObject]@{ WasRunning=$false; Executable=$null }
    }
    $executable = $null
    foreach ($process in $running) {
        if (-not $executable) {
            try { $executable = [string]$process.Path } catch { }
        }
        try { Stop-Process -Id $process.Id -Force -ErrorAction Stop } catch { }
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(8)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (-not (Get-Process -Name "StreamDeck" -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 150
    }
    if (Get-Process -Name "StreamDeck" -ErrorAction SilentlyContinue) {
        throw "Could not stop Stream Deck long enough to refresh the installed development profile safely."
    }
    return [PSCustomObject]@{ WasRunning=$true; Executable=$executable }
}

function Start-RatDevStreamDeckAfterProfileSwap {
    param($HostState)
    if (-not $HostState -or -not $HostState.WasRunning) { return }
    if ($HostState.Executable -and (Test-Path $HostState.Executable -PathType Leaf)) {
        Start-Process -FilePath $HostState.Executable
        return
    }
    $fallbacks = @()
    if ($env:ProgramFiles) { $fallbacks += (Join-Path $env:ProgramFiles "Elgato\StreamDeck\StreamDeck.exe") }
    $programFilesX86 = [Environment]::GetFolderPath("ProgramFilesX86")
    if ($programFilesX86) { $fallbacks += (Join-Path $programFilesX86 "Elgato\StreamDeck\StreamDeck.exe") }
    foreach ($candidate in $fallbacks) {
        if (Test-Path $candidate -PathType Leaf) {
            Start-Process -FilePath $candidate
            return
        }
    }
    Write-Host "Stream Deck profile was refreshed, but Rat Dev could not find StreamDeck.exe to relaunch it automatically." -ForegroundColor Yellow
}

function Replace-RatDevInstalledProfile {
    param(
        [Parameter(Mandatory = $true)][string]$ProfilePath,
        [Parameter(Mandatory = $true)][string]$InstalledPath,
        [Parameter(Mandatory = $true)][string]$StateRoot,
        [Parameter(Mandatory = $true)][string]$Slug,
        [string]$ExpectedName,
        [switch]$SkipStreamDeckProcessControl
    )
    if (-not (Test-Path $InstalledPath -PathType Container)) {
        throw "Installed Stream Deck profile was not found for replacement: $InstalledPath"
    }

    $operationId = [guid]::NewGuid().ToString("N")
    $stagingRoot = Join-Path $StateRoot ("profile-staging\" + $Slug + "-" + $operationId)
    $parent = Split-Path $InstalledPath -Parent
    $leaf = Split-Path $InstalledPath -Leaf
    $newSibling = Join-Path $parent ($leaf + ".ratdev-new-" + $operationId)
    $oldSibling = Join-Path $parent ($leaf + ".ratdev-old-" + $operationId)
    $backupRoot = Join-Path $StateRoot ("profile-backups\" + $Slug)
    $backupPath = Join-Path $backupRoot ((Get-Date -Format "yyyyMMdd-HHmmss") + "-" + $operationId + "-" + $leaf)
    $hostState = $null

    try {
        $sourceRoot = Expand-RatDevProfileBundle -ProfilePath $ProfilePath -Destination $stagingRoot
        $sourceManifestPath = Join-Path $sourceRoot "manifest.json"
        $sourceManifest = Get-Content $sourceManifestPath -Raw | ConvertFrom-Json
        if ($ExpectedName -and [string]$sourceManifest.Name -ne $ExpectedName) {
            throw "Bundled profile name changed unexpectedly before replacement."
        }

        $installedManifest = Get-Content (Join-Path $InstalledPath "manifest.json") -Raw | ConvertFrom-Json
        if ($installedManifest.PSObject.Properties.Name -contains "Device") {
            $sourceManifest | Add-Member -NotePropertyName "Device" -NotePropertyValue $installedManifest.Device -Force
        }
        if (($installedManifest.PSObject.Properties.Name -contains "AppIdentifier") -and
            -not ($sourceManifest.PSObject.Properties.Name -contains "AppIdentifier")) {
            $sourceManifest | Add-Member -NotePropertyName "AppIdentifier" -NotePropertyValue $installedManifest.AppIdentifier -Force
        }
        if ($sourceManifest.Pages -and $installedManifest.Pages -and $installedManifest.Pages.Current) {
            $incomingPages = @($sourceManifest.Pages.Pages)
            if ($incomingPages -contains [string]$installedManifest.Pages.Current) {
                $sourceManifest.Pages.Current = [string]$installedManifest.Pages.Current
            }
        }
        $sourceManifest | ConvertTo-Json -Depth 100 | Set-Content -Path $sourceManifestPath -Encoding UTF8

        $expectedActions = @(Get-RatDevProfileActionUuids -ProfileRoot $sourceRoot)
        [void](Test-RatDevProfileRoot -ProfileRoot $sourceRoot -ExpectedName $ExpectedName -ExpectedActionUuids $expectedActions)

        if (-not $SkipStreamDeckProcessControl) {
            $hostState = Stop-RatDevStreamDeckForProfileSwap
        }

        New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
        Copy-Item -LiteralPath $InstalledPath -Destination $backupPath -Recurse -Force

        New-Item -ItemType Directory -Force -Path $newSibling | Out-Null
        Get-ChildItem -Path $sourceRoot -Force | Copy-Item -Destination $newSibling -Recurse -Force
        [void](Test-RatDevProfileRoot -ProfileRoot $newSibling -ExpectedName $ExpectedName -ExpectedActionUuids $expectedActions)

        Move-Item -LiteralPath $InstalledPath -Destination $oldSibling
        Move-Item -LiteralPath $newSibling -Destination $InstalledPath
        [void](Test-RatDevProfileRoot -ProfileRoot $InstalledPath -ExpectedName $ExpectedName -ExpectedActionUuids $expectedActions)
        Remove-Item -LiteralPath $oldSibling -Recurse -Force

        return [PSCustomObject]@{
            Replaced = $true
            InstalledPath = $InstalledPath
            BackupPath = $backupPath
            ActionCount = $expectedActions.Count
        }
    }
    catch {
        if (Test-Path $oldSibling -PathType Container) {
            if (Test-Path $InstalledPath -PathType Container) {
                Remove-Item -LiteralPath $InstalledPath -Recurse -Force -ErrorAction SilentlyContinue
            }
            Move-Item -LiteralPath $oldSibling -Destination $InstalledPath -Force
        }
        throw
    }
    finally {
        Remove-Item -LiteralPath $newSibling -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
        if (-not $SkipStreamDeckProcessControl) {
            Start-RatDevStreamDeckAfterProfileSwap -HostState $hostState
        }
    }
}


function ConvertTo-RatDevCanonicalValue {
    param($Value)

    if ($null -eq $Value) { return $null }

    if ($Value -is [string] -or $Value -is [ValueType]) {
        return $Value
    }

    if ($Value -is [System.Collections.IDictionary]) {
        $ordered = [ordered]@{}
        foreach ($key in @($Value.Keys | ForEach-Object { [string]$_ } | Sort-Object)) {
            $ordered[$key] = ConvertTo-RatDevCanonicalValue -Value $Value[$key]
        }
        return $ordered
    }

    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        $items = @()
        foreach ($item in $Value) {
            $items += ,(ConvertTo-RatDevCanonicalValue -Value $item)
        }
        return $items
    }

    $properties = @($Value.PSObject.Properties | Where-Object { $_.MemberType -in @("NoteProperty","Property") } | Sort-Object Name)
    if ($properties.Count) {
        $ordered = [ordered]@{}
        foreach ($property in $properties) {
            $ordered[$property.Name] = ConvertTo-RatDevCanonicalValue -Value $property.Value
        }
        return $ordered
    }

    return [string]$Value
}

function Get-RatDevProfileSemanticSignature {
    param([Parameter(Mandatory = $true)][string]$ProfileRoot)

    $rootFull = [System.IO.Path]::GetFullPath($ProfileRoot).TrimEnd("\","/")
    $entries = @()

    foreach ($manifestPath in @(Get-ChildItem -Path $ProfileRoot -Recurse -File -Filter "manifest.json" -ErrorAction Stop)) {
        $relative = $manifestPath.FullName.Substring($rootFull.Length).TrimStart("\","/").Replace("\","/")
        $manifest = Get-Content $manifestPath.FullName -Raw | ConvertFrom-Json

        if ($relative -eq "manifest.json") {
            foreach ($hostOwned in @("Device","AppIdentifier")) {
                if ($manifest.PSObject.Properties.Name -contains $hostOwned) {
                    $manifest.PSObject.Properties.Remove($hostOwned)
                }
            }
            if ($manifest.Pages -and ($manifest.Pages.PSObject.Properties.Name -contains "Current")) {
                $manifest.Pages.PSObject.Properties.Remove("Current")
            }
        }

        $canonical = ConvertTo-RatDevCanonicalValue -Value $manifest
        $json = $canonical | ConvertTo-Json -Depth 100 -Compress
        $entries += ($relative + "|" + $json)
    }

    return (@($entries | Sort-Object) -join [Environment]::NewLine)
}

function Test-RatDevInstalledProfileMatchesBundle {
    param(
        [Parameter(Mandatory = $true)][string]$ProfilePath,
        [Parameter(Mandatory = $true)][string]$InstalledPath,
        [Parameter(Mandatory = $true)][string]$StateRoot,
        [Parameter(Mandatory = $true)][string]$Slug
    )

    if (-not (Test-Path $InstalledPath -PathType Container)) { return $false }

    $compareRoot = Join-Path $StateRoot ("profile-compare\" + $Slug + "-" + [guid]::NewGuid().ToString("N"))
    try {
        $sourceRoot = Expand-RatDevProfileBundle -ProfilePath $ProfilePath -Destination $compareRoot
        $sourceSignature = Get-RatDevProfileSemanticSignature -ProfileRoot $sourceRoot
        $installedSignature = Get-RatDevProfileSemanticSignature -ProfileRoot $InstalledPath
        return $sourceSignature -eq $installedSignature
    }
    catch {
        return $false
    }
    finally {
        Remove-Item -LiteralPath $compareRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
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
        [PSCustomObject]@{ Found = $false; Name = $null; Path = $null; Paths = @(); Count = 0 }
    }

    if (-not $state -and $installed.Found) {
        return [PSCustomObject]@{ Open=$false; Replace=$true; Adopt=$false; Reason="existing-installed-untracked"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path; InstalledPaths=@($installed.Paths) }
    }

    $stateVersion = if ($state -and $state.state_version) { [int]$state.state_version } else { 0 }
    if ($state -and $stateVersion -lt 3 -and $installed.Found) {
        return [PSCustomObject]@{ Open=$false; Replace=$true; Adopt=$false; Reason="profile-state-upgrade"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path; InstalledPaths=@($installed.Paths) }
    }

    if ($state -and [string]$state.sha256 -eq $fingerprint -and $installed.Found) {
        $installedMatches = $true
        foreach ($installedPath in @($installed.Paths)) {
            if (-not (Test-RatDevInstalledProfileMatchesBundle -ProfilePath $ProfilePath -InstalledPath $installedPath -StateRoot $StateRoot -Slug $Slug)) {
                $installedMatches = $false
                break
            }
        }
        if ($installedMatches) {
            return [PSCustomObject]@{ Open=$false; Replace=$false; Adopt=$false; Reason="unchanged-installed"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path; InstalledPaths=@($installed.Paths) }
        }
        return [PSCustomObject]@{ Open=$false; Replace=$true; Adopt=$false; Reason="installed-profile-drift"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path; InstalledPaths=@($installed.Paths) }
    }

    if ($state -and [string]$state.sha256 -eq $fingerprint -and -not $installed.Found) {
        return [PSCustomObject]@{ Open=$true; Replace=$false; Adopt=$false; Reason="installed-profile-missing"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$null }
    }

    if ($state -and [string]$state.sha256 -ne $fingerprint -and $installed.Found) {
        return [PSCustomObject]@{ Open=$false; Replace=$true; Adopt=$false; Reason="profile-changed"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path; InstalledPaths=@($installed.Paths) }
    }

    if ($state -and [string]$state.sha256 -ne $fingerprint) {
        return [PSCustomObject]@{ Open=$true; Replace=$false; Adopt=$false; Reason="profile-changed"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$null }
    }

    return [PSCustomObject]@{ Open=$true; Replace=$false; Adopt=$false; Reason="first-import"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path }
}
 })) {
            $reader = New-Object System.IO.StreamReader($entry.Open())
            try {
                $manifest = ($reader.ReadToEnd() | ConvertFrom-Json)
                foreach ($controller in @($manifest.Controllers)) {
                    if (-not $controller.Actions) { continue }
                    foreach ($property in $controller.Actions.PSObject.Properties) {
                        $action = $property.Value
                        if ($action.ActionID) {
                            $values += [PSCustomObject]@{
                                ActionID = [string]$action.ActionID
                                Position = [string]$property.Name
                                Entry = [string]$entry.FullName
                                Profile = [string]$ProfilePath
                            }
                        }
                    }
                }
            }
            finally {
                $reader.Dispose()
            }
        }
    }
    finally {
        $archive.Dispose()
    }
    return @($values)
}

function Assert-RatDevBundledProfileActionIdsUnique {
    param([Parameter(Mandatory = $true)][string[]]$ProfilePaths)

    $seen = @{}
    foreach ($profilePath in @($ProfilePaths)) {
        foreach ($item in @(Get-RatDevProfileActionIdsFromArchive -ProfilePath $profilePath)) {
            $id = [string]$item.ActionID
            if ([string]::IsNullOrWhiteSpace($id)) { continue }
            if ($seen.ContainsKey($id)) {
                $first = $seen[$id]
                throw ("Bundled Stream Deck profiles reuse ActionID '{0}'. First: {1} [{2}] {3}; duplicate: {4} [{5}] {6}. Generated action instance IDs must be unique across all device variants." -f
                    $id,
                    $first.Profile,
                    $first.Entry,
                    $first.Position,
                    $item.Profile,
                    $item.Entry,
                    $item.Position)
            }
            $seen[$id] = $item
        }
    }
    return $true
}

function Get-RatDevProfileActionUuids {
    param([Parameter(Mandatory = $true)][string]$ProfileRoot)
    $values = @()
    foreach ($manifestPath in @(Get-ChildItem -Path $ProfileRoot -Recurse -File -Filter "manifest.json" -ErrorAction SilentlyContinue)) {
        try {
            $manifest = Get-Content $manifestPath.FullName -Raw | ConvertFrom-Json
            if ($manifest.Actions) {
                foreach ($property in $manifest.Actions.PSObject.Properties) {
                    if ($property.Value.UUID) { $values += [string]$property.Value.UUID }
                }
            }
            foreach ($controller in @($manifest.Controllers)) {
                if (-not $controller.Actions) { continue }
                foreach ($property in $controller.Actions.PSObject.Properties) {
                    if ($property.Value.UUID) { $values += [string]$property.Value.UUID }
                }
            }
        }
        catch { }
    }
    return @($values | Sort-Object)
}

function Test-RatDevProfileRoot {
    param(
        [Parameter(Mandatory = $true)][string]$ProfileRoot,
        [string]$ExpectedName,
        [string[]]$ExpectedActionUuids
    )
    $manifestPath = Join-Path $ProfileRoot "manifest.json"
    if (-not (Test-Path $manifestPath -PathType Leaf)) {
        throw "Installed Stream Deck profile is missing manifest.json: $ProfileRoot"
    }
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    if ($ExpectedName -and [string]$manifest.Name -ne $ExpectedName) {
        throw "Installed profile name mismatch after refresh. Expected '$ExpectedName', got '$($manifest.Name)'."
    }
    if ($manifest.Pages -and @($manifest.Pages.Pages).Count) {
        $pageRoot = Join-Path $ProfileRoot "Profiles"
        if (-not (Test-Path $pageRoot -PathType Container)) {
            throw "Installed Stream Deck profile is missing its Profiles page directory."
        }
        $pageManifests = @(Get-ChildItem -Path $pageRoot -Recurse -File -Filter "manifest.json" -ErrorAction SilentlyContinue)
        if ($pageManifests.Count -lt @($manifest.Pages.Pages).Count) {
            throw "Installed Stream Deck profile page count is incomplete after refresh."
        }
    }
    if ($ExpectedActionUuids) {
        $actual = @(Get-RatDevProfileActionUuids -ProfileRoot $ProfileRoot)
        $expected = @($ExpectedActionUuids | Sort-Object)
        if (@(Compare-Object -ReferenceObject $expected -DifferenceObject $actual).Count) {
            throw "Installed Stream Deck profile action UUIDs do not match the validated bundled profile."
        }
    }
    return $manifest
}

function Expand-RatDevProfileBundle {
    param(
        [Parameter(Mandatory = $true)][string]$ProfilePath,
        [Parameter(Mandatory = $true)][string]$Destination
    )
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ProfilePath, $Destination)
    $roots = @(Get-ChildItem -Path $Destination -Directory -Filter "*.sdProfile" -ErrorAction SilentlyContinue)
    if ($roots.Count -ne 1) {
        throw "Expected exactly one .sdProfile root inside '$ProfilePath'; found $($roots.Count)."
    }
    return $roots[0].FullName
}

function Stop-RatDevStreamDeckForProfileSwap {
    $running = @(Get-Process -Name "StreamDeck" -ErrorAction SilentlyContinue)
    if (-not $running.Count) {
        return [PSCustomObject]@{ WasRunning=$false; Executable=$null }
    }
    $executable = $null
    foreach ($process in $running) {
        if (-not $executable) {
            try { $executable = [string]$process.Path } catch { }
        }
        try { Stop-Process -Id $process.Id -Force -ErrorAction Stop } catch { }
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(8)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (-not (Get-Process -Name "StreamDeck" -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 150
    }
    if (Get-Process -Name "StreamDeck" -ErrorAction SilentlyContinue) {
        throw "Could not stop Stream Deck long enough to refresh the installed development profile safely."
    }
    return [PSCustomObject]@{ WasRunning=$true; Executable=$executable }
}

function Start-RatDevStreamDeckAfterProfileSwap {
    param($HostState)
    if (-not $HostState -or -not $HostState.WasRunning) { return }
    if ($HostState.Executable -and (Test-Path $HostState.Executable -PathType Leaf)) {
        Start-Process -FilePath $HostState.Executable
        return
    }
    $fallbacks = @()
    if ($env:ProgramFiles) { $fallbacks += (Join-Path $env:ProgramFiles "Elgato\StreamDeck\StreamDeck.exe") }
    $programFilesX86 = [Environment]::GetFolderPath("ProgramFilesX86")
    if ($programFilesX86) { $fallbacks += (Join-Path $programFilesX86 "Elgato\StreamDeck\StreamDeck.exe") }
    foreach ($candidate in $fallbacks) {
        if (Test-Path $candidate -PathType Leaf) {
            Start-Process -FilePath $candidate
            return
        }
    }
    Write-Host "Stream Deck profile was refreshed, but Rat Dev could not find StreamDeck.exe to relaunch it automatically." -ForegroundColor Yellow
}

function Replace-RatDevInstalledProfile {
    param(
        [Parameter(Mandatory = $true)][string]$ProfilePath,
        [Parameter(Mandatory = $true)][string]$InstalledPath,
        [Parameter(Mandatory = $true)][string]$StateRoot,
        [Parameter(Mandatory = $true)][string]$Slug,
        [string]$ExpectedName,
        [switch]$SkipStreamDeckProcessControl
    )
    if (-not (Test-Path $InstalledPath -PathType Container)) {
        throw "Installed Stream Deck profile was not found for replacement: $InstalledPath"
    }

    $operationId = [guid]::NewGuid().ToString("N")
    $stagingRoot = Join-Path $StateRoot ("profile-staging\" + $Slug + "-" + $operationId)
    $parent = Split-Path $InstalledPath -Parent
    $leaf = Split-Path $InstalledPath -Leaf
    $newSibling = Join-Path $parent ($leaf + ".ratdev-new-" + $operationId)
    $oldSibling = Join-Path $parent ($leaf + ".ratdev-old-" + $operationId)
    $backupRoot = Join-Path $StateRoot ("profile-backups\" + $Slug)
    $backupPath = Join-Path $backupRoot ((Get-Date -Format "yyyyMMdd-HHmmss") + "-" + $operationId + "-" + $leaf)
    $hostState = $null

    try {
        $sourceRoot = Expand-RatDevProfileBundle -ProfilePath $ProfilePath -Destination $stagingRoot
        $sourceManifestPath = Join-Path $sourceRoot "manifest.json"
        $sourceManifest = Get-Content $sourceManifestPath -Raw | ConvertFrom-Json
        if ($ExpectedName -and [string]$sourceManifest.Name -ne $ExpectedName) {
            throw "Bundled profile name changed unexpectedly before replacement."
        }

        $installedManifest = Get-Content (Join-Path $InstalledPath "manifest.json") -Raw | ConvertFrom-Json
        if ($installedManifest.PSObject.Properties.Name -contains "Device") {
            $sourceManifest | Add-Member -NotePropertyName "Device" -NotePropertyValue $installedManifest.Device -Force
        }
        if (($installedManifest.PSObject.Properties.Name -contains "AppIdentifier") -and
            -not ($sourceManifest.PSObject.Properties.Name -contains "AppIdentifier")) {
            $sourceManifest | Add-Member -NotePropertyName "AppIdentifier" -NotePropertyValue $installedManifest.AppIdentifier -Force
        }
        if ($sourceManifest.Pages -and $installedManifest.Pages -and $installedManifest.Pages.Current) {
            $incomingPages = @($sourceManifest.Pages.Pages)
            if ($incomingPages -contains [string]$installedManifest.Pages.Current) {
                $sourceManifest.Pages.Current = [string]$installedManifest.Pages.Current
            }
        }
        $sourceManifest | ConvertTo-Json -Depth 100 | Set-Content -Path $sourceManifestPath -Encoding UTF8

        $expectedActions = @(Get-RatDevProfileActionUuids -ProfileRoot $sourceRoot)
        [void](Test-RatDevProfileRoot -ProfileRoot $sourceRoot -ExpectedName $ExpectedName -ExpectedActionUuids $expectedActions)

        if (-not $SkipStreamDeckProcessControl) {
            $hostState = Stop-RatDevStreamDeckForProfileSwap
        }

        New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
        Copy-Item -LiteralPath $InstalledPath -Destination $backupPath -Recurse -Force

        New-Item -ItemType Directory -Force -Path $newSibling | Out-Null
        Get-ChildItem -Path $sourceRoot -Force | Copy-Item -Destination $newSibling -Recurse -Force
        [void](Test-RatDevProfileRoot -ProfileRoot $newSibling -ExpectedName $ExpectedName -ExpectedActionUuids $expectedActions)

        Move-Item -LiteralPath $InstalledPath -Destination $oldSibling
        Move-Item -LiteralPath $newSibling -Destination $InstalledPath
        [void](Test-RatDevProfileRoot -ProfileRoot $InstalledPath -ExpectedName $ExpectedName -ExpectedActionUuids $expectedActions)
        Remove-Item -LiteralPath $oldSibling -Recurse -Force

        return [PSCustomObject]@{
            Replaced = $true
            InstalledPath = $InstalledPath
            BackupPath = $backupPath
            ActionCount = $expectedActions.Count
        }
    }
    catch {
        if (Test-Path $oldSibling -PathType Container) {
            if (Test-Path $InstalledPath -PathType Container) {
                Remove-Item -LiteralPath $InstalledPath -Recurse -Force -ErrorAction SilentlyContinue
            }
            Move-Item -LiteralPath $oldSibling -Destination $InstalledPath -Force
        }
        throw
    }
    finally {
        Remove-Item -LiteralPath $newSibling -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
        if (-not $SkipStreamDeckProcessControl) {
            Start-RatDevStreamDeckAfterProfileSwap -HostState $hostState
        }
    }
}


function ConvertTo-RatDevCanonicalValue {
    param($Value)

    if ($null -eq $Value) { return $null }

    if ($Value -is [string] -or $Value -is [ValueType]) {
        return $Value
    }

    if ($Value -is [System.Collections.IDictionary]) {
        $ordered = [ordered]@{}
        foreach ($key in @($Value.Keys | ForEach-Object { [string]$_ } | Sort-Object)) {
            $ordered[$key] = ConvertTo-RatDevCanonicalValue -Value $Value[$key]
        }
        return $ordered
    }

    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        $items = @()
        foreach ($item in $Value) {
            $items += ,(ConvertTo-RatDevCanonicalValue -Value $item)
        }
        return $items
    }

    $properties = @($Value.PSObject.Properties | Where-Object { $_.MemberType -in @("NoteProperty","Property") } | Sort-Object Name)
    if ($properties.Count) {
        $ordered = [ordered]@{}
        foreach ($property in $properties) {
            $ordered[$property.Name] = ConvertTo-RatDevCanonicalValue -Value $property.Value
        }
        return $ordered
    }

    return [string]$Value
}

function Get-RatDevProfileSemanticSignature {
    param([Parameter(Mandatory = $true)][string]$ProfileRoot)

    $rootFull = [System.IO.Path]::GetFullPath($ProfileRoot).TrimEnd("\","/")
    $entries = @()

    foreach ($manifestPath in @(Get-ChildItem -Path $ProfileRoot -Recurse -File -Filter "manifest.json" -ErrorAction Stop)) {
        $relative = $manifestPath.FullName.Substring($rootFull.Length).TrimStart("\","/").Replace("\","/")
        $manifest = Get-Content $manifestPath.FullName -Raw | ConvertFrom-Json

        if ($relative -eq "manifest.json") {
            foreach ($hostOwned in @("Device","AppIdentifier")) {
                if ($manifest.PSObject.Properties.Name -contains $hostOwned) {
                    $manifest.PSObject.Properties.Remove($hostOwned)
                }
            }
            if ($manifest.Pages -and ($manifest.Pages.PSObject.Properties.Name -contains "Current")) {
                $manifest.Pages.PSObject.Properties.Remove("Current")
            }
        }

        $canonical = ConvertTo-RatDevCanonicalValue -Value $manifest
        $json = $canonical | ConvertTo-Json -Depth 100 -Compress
        $entries += ($relative + "|" + $json)
    }

    return (@($entries | Sort-Object) -join [Environment]::NewLine)
}

function Test-RatDevInstalledProfileMatchesBundle {
    param(
        [Parameter(Mandatory = $true)][string]$ProfilePath,
        [Parameter(Mandatory = $true)][string]$InstalledPath,
        [Parameter(Mandatory = $true)][string]$StateRoot,
        [Parameter(Mandatory = $true)][string]$Slug
    )

    if (-not (Test-Path $InstalledPath -PathType Container)) { return $false }

    $compareRoot = Join-Path $StateRoot ("profile-compare\" + $Slug + "-" + [guid]::NewGuid().ToString("N"))
    try {
        $sourceRoot = Expand-RatDevProfileBundle -ProfilePath $ProfilePath -Destination $compareRoot
        $sourceSignature = Get-RatDevProfileSemanticSignature -ProfileRoot $sourceRoot
        $installedSignature = Get-RatDevProfileSemanticSignature -ProfileRoot $InstalledPath
        return $sourceSignature -eq $installedSignature
    }
    catch {
        return $false
    }
    finally {
        Remove-Item -LiteralPath $compareRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
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
        [PSCustomObject]@{ Found = $false; Name = $null; Path = $null; Paths = @(); Count = 0 }
    }

    if (-not $state -and $installed.Found) {
        return [PSCustomObject]@{ Open=$false; Replace=$true; Adopt=$false; Reason="existing-installed-untracked"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path; InstalledPaths=@($installed.Paths) }
    }

    $stateVersion = if ($state -and $state.state_version) { [int]$state.state_version } else { 0 }
    if ($state -and $stateVersion -lt 3 -and $installed.Found) {
        return [PSCustomObject]@{ Open=$false; Replace=$true; Adopt=$false; Reason="profile-state-upgrade"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path; InstalledPaths=@($installed.Paths) }
    }

    if ($state -and [string]$state.sha256 -eq $fingerprint -and $installed.Found) {
        $installedMatches = $true
        foreach ($installedPath in @($installed.Paths)) {
            if (-not (Test-RatDevInstalledProfileMatchesBundle -ProfilePath $ProfilePath -InstalledPath $installedPath -StateRoot $StateRoot -Slug $Slug)) {
                $installedMatches = $false
                break
            }
        }
        if ($installedMatches) {
            return [PSCustomObject]@{ Open=$false; Replace=$false; Adopt=$false; Reason="unchanged-installed"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path; InstalledPaths=@($installed.Paths) }
        }
        return [PSCustomObject]@{ Open=$false; Replace=$true; Adopt=$false; Reason="installed-profile-drift"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path; InstalledPaths=@($installed.Paths) }
    }

    if ($state -and [string]$state.sha256 -eq $fingerprint -and -not $installed.Found) {
        return [PSCustomObject]@{ Open=$true; Replace=$false; Adopt=$false; Reason="installed-profile-missing"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$null }
    }

    if ($state -and [string]$state.sha256 -ne $fingerprint -and $installed.Found) {
        return [PSCustomObject]@{ Open=$false; Replace=$true; Adopt=$false; Reason="profile-changed"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path; InstalledPaths=@($installed.Paths) }
    }

    if ($state -and [string]$state.sha256 -ne $fingerprint) {
        return [PSCustomObject]@{ Open=$true; Replace=$false; Adopt=$false; Reason="profile-changed"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$null }
    }

    return [PSCustomObject]@{ Open=$true; Replace=$false; Adopt=$false; Reason="first-import"; Fingerprint=$fingerprint; ProfileName=$profileName; InstalledPath=$installed.Path }
}

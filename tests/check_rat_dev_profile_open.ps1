$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $RepoRoot "tools\local\rat-dev-profiles.ps1")

function Assert-Equal {
    param($Actual, $Expected, [string]$Message)
    if ([string]$Actual -ne [string]$Expected) {
        throw "$Message Expected '$Expected', got '$Actual'."
    }
}

$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("packrat-ratdev-profile-" + [guid]::NewGuid().ToString("N"))
$SourceRoot = Join-Path $TempRoot "source"
$InstalledRoot = Join-Path $TempRoot "ProfilesV2"
$StateRoot = Join-Path $TempRoot "state"
New-Item -ItemType Directory -Force -Path $SourceRoot,$InstalledRoot,$StateRoot | Out-Null

try {
    $bundleRoot = Join-Path $SourceRoot "profile-root.sdProfile"
    New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null
    [PSCustomObject]@{
        Name = "Rat Dev Test Profile"
        Pages = [PSCustomObject]@{ Current = "page-1"; Pages = @("page-1") }
        Version = "2.0"
    } | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $bundleRoot "manifest.json") -Encoding UTF8

    $profilePath = Join-Path $TempRoot "rat-dev-test.streamDeckProfile"
    Compress-Archive -Path $bundleRoot -DestinationPath $profilePath

    $installed = Join-Path $InstalledRoot "installed.sdProfile"
    New-Item -ItemType Directory -Force -Path $installed | Out-Null
    [PSCustomObject]@{ Name = "Rat Dev Test Profile" } | ConvertTo-Json | Set-Content (Join-Path $installed "manifest.json") -Encoding UTF8

    $existing = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $existing.Open $false "An installed profile with no Rat Dev provenance should not create a duplicate import."
    Assert-Equal $existing.ManualRefresh $true "An unverified installed profile should require manual refresh."
    Assert-Equal $existing.Adopt $false "Rat Dev must not silently adopt an unverified installed profile."
    Assert-Equal $existing.Reason "existing-installed-untracked" "Unexpected untracked installed profile decision."

    # Simulate a legacy state written by the old adoption behavior.
    $legacyStatePath = Get-RatDevProfileStatePath -StateRoot $StateRoot -Slug "test-plugin"
    New-Item -ItemType Directory -Force -Path (Split-Path $legacyStatePath -Parent) | Out-Null
    [PSCustomObject]@{
        slug = "test-plugin"
        profile_path = $profilePath
        profile_name = $existing.ProfileName
        sha256 = $existing.Fingerprint
        updated_utc = [DateTime]::UtcNow.ToString("o")
    } | ConvertTo-Json | Set-Content -Path $legacyStatePath -Encoding UTF8

    $legacy = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $legacy.Open $false "Legacy adopted profile state should not trigger a duplicate import."
    Assert-Equal $legacy.ManualRefresh $true "Legacy profile state should require manual refresh."
    Assert-Equal $legacy.Reason "profile-state-upgrade" "Unexpected legacy profile state decision."

    Write-RatDevProfileState -StateRoot $StateRoot -Slug "test-plugin" -ProfilePath $profilePath -Fingerprint $existing.Fingerprint -ProfileName $existing.ProfileName

    $unchanged = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $unchanged.Open $false "Unchanged installed profile should not be imported again."
    Assert-Equal $unchanged.ManualRefresh $false "Unchanged profile should not require manual refresh."
    Assert-Equal $unchanged.Reason "unchanged-installed" "Unexpected unchanged profile decision."

    Remove-Item $installed -Recurse -Force
    $missing = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $missing.Open $true "Deleted installed profile should reopen."
    Assert-Equal $missing.Reason "installed-profile-missing" "Unexpected missing profile decision."

    New-Item -ItemType Directory -Force -Path $installed | Out-Null
    [PSCustomObject]@{ Name = "Rat Dev Test Profile" } | ConvertTo-Json | Set-Content (Join-Path $installed "manifest.json") -Encoding UTF8

    Remove-Item $profilePath -Force
    Set-Content (Join-Path $bundleRoot "changed.txt") "new profile revision"
    Compress-Archive -Path $bundleRoot -DestinationPath $profilePath
    $changed = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $changed.Open $false "Changed profile bundle should not open while the same named profile remains installed."
    Assert-Equal $changed.ManualRefresh $true "Changed installed profile should require manual refresh."
    Assert-Equal $changed.Reason "profile-changed" "Unexpected changed profile decision."

    Remove-Item $installed -Recurse -Force
    $changedAfterDelete = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $changedAfterDelete.Open $true "Changed profile should open after the old installed profile is removed."
    Assert-Equal $changedAfterDelete.ManualRefresh $false "Removed profile should clear the manual refresh blocker."
    Assert-Equal $changedAfterDelete.Reason "profile-changed" "Unexpected changed-after-delete profile decision."

    Write-Host "PASS: Rat Dev profile import deduplication" -ForegroundColor Green
}
finally {
    Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

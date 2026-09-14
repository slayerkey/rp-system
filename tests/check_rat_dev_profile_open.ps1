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
    Assert-Equal $existing.Open $false "Existing installed profile should not be imported again."
    Assert-Equal $existing.Adopt $true "Existing installed profile should seed Rat Dev state."

    Write-RatDevProfileState -StateRoot $StateRoot -Slug "test-plugin" -ProfilePath $profilePath -Fingerprint $existing.Fingerprint -ProfileName $existing.ProfileName

    $unchanged = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $unchanged.Open $false "Unchanged installed profile should not be imported again."
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
    Assert-Equal $changed.Open $true "Changed profile bundle should open the newest revision."
    Assert-Equal $changed.Reason "profile-changed" "Unexpected changed profile decision."

    Write-Host "PASS: Rat Dev profile import deduplication" -ForegroundColor Green
}
finally {
    Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

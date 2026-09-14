$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$profileHelpers = Get-Content (Join-Path $RepoRoot "tools\local\rat-dev-profiles.ps1") -Raw
$ratDev = Get-Content (Join-Path $RepoRoot "tools\local\rat-dev.ps1") -Raw
if ($profileHelpers -notmatch 'Assert-RatDevBundledProfileActionIdsUnique') {
    throw "Rat Dev profile helpers must expose the cross-profile ActionID uniqueness guard."
}
if ($profileHelpers -notmatch 'Generated action instance IDs must be unique across all device variants') {
    throw "Rat Dev duplicate ActionID failure must explain the cross-device collision."
}
if ($ratDev -notmatch 'Checking bundled profile ActionID uniqueness') {
    throw "Rat Dev must run the profile ActionID uniqueness guard before activation."
}
. (Join-Path $RepoRoot "tools\local\rat-dev-profiles.ps1")

function Assert-Equal {
    param($Actual, $Expected, [string]$Message)
    if ([string]$Actual -ne [string]$Expected) {
        throw "$Message Expected '$Expected', got '$Actual'."
    }
}

$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("packrat-ratdev-profile-" + [guid]::NewGuid().ToString("N"))
$SourceRoot = Join-Path $TempRoot "source"
$InstalledRoot = Join-Path $TempRoot "ProfilesV3"
$StateRoot = Join-Path $TempRoot "state"
New-Item -ItemType Directory -Force -Path $SourceRoot,$InstalledRoot,$StateRoot | Out-Null

try {
    $bundleRoot = Join-Path $SourceRoot "11111111-1111-4111-8111-111111111111.sdProfile"
    $pageRoot = Join-Path $bundleRoot "Profiles\PAGEONE"
    New-Item -ItemType Directory -Force -Path $pageRoot | Out-Null
    [PSCustomObject]@{
        Name = "Rat Dev Test Profile"
        Pages = [PSCustomObject]@{ Current = "page-new"; Pages = @("page-new") }
        Version = "2.0"
    } | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $bundleRoot "manifest.json") -Encoding UTF8
    [PSCustomObject]@{
        Controllers = @(
            [PSCustomObject]@{
                Type = "Keypad"
                Actions = [PSCustomObject]@{
                    "0,0" = [PSCustomObject]@{
                        UUID = "com.packrat.test.action"
                        ActionID = "11111111-2222-4333-8444-555555555555"
                        Settings = [PSCustomObject]@{ revision = 1 }
                    }
                }
            }
        )
    } | ConvertTo-Json -Depth 12 | Set-Content (Join-Path $pageRoot "manifest.json") -Encoding UTF8
    Set-Content (Join-Path $bundleRoot "new-only.txt") "new profile"

    $profilePath = Join-Path $TempRoot "rat-dev-test.streamDeckProfile"
    Compress-Archive -Path $bundleRoot -DestinationPath $profilePath

    if (-not (Assert-RatDevBundledProfileActionIdsUnique -ProfilePaths @($profilePath))) {
        throw "A single bundled profile should pass ActionID uniqueness validation."
    }

    $duplicateProfilePath = Join-Path $TempRoot "rat-dev-test-duplicate.streamDeckProfile"
    Copy-Item -LiteralPath $profilePath -Destination $duplicateProfilePath -Force
    $duplicateRejected = $false
    try {
        [void](Assert-RatDevBundledProfileActionIdsUnique -ProfilePaths @($profilePath,$duplicateProfilePath))
    }
    catch {
        $duplicateRejected = $_.Exception.Message -match "Generated action instance IDs must be unique across all device variants"
    }
    if (-not $duplicateRejected) {
        throw "Duplicate bundled profile ActionIDs must fail the Rat Dev pre-activation guard."
    }
    Remove-Item $duplicateProfilePath -Force

    $installed = Join-Path $InstalledRoot "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE.sdProfile"
    New-Item -ItemType Directory -Force -Path $installed | Out-Null
    [PSCustomObject]@{
        Name = "Rat Dev Test Profile"
        Device = [PSCustomObject]@{ Model = "20GAA9901"; UUID = "@(1)[TEST-DECK]" }
        Pages = [PSCustomObject]@{ Current = "old-page"; Pages = @("old-page") }
        Version = "2.0"
    } | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $installed "manifest.json") -Encoding UTF8
    Set-Content (Join-Path $installed "old-only.txt") "old profile"

    $existing = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $existing.Open $false "Existing installed profile should not import a duplicate."
    Assert-Equal $existing.Replace $true "Untracked installed profile should refresh in place."
    Assert-Equal $existing.Reason "existing-installed-untracked" "Unexpected existing profile decision."

    $replaceResult = Replace-RatDevInstalledProfile -ProfilePath $profilePath -InstalledPath $installed -StateRoot $StateRoot -Slug "test-plugin" -ExpectedName $existing.ProfileName -SkipStreamDeckProcessControl
    Assert-Equal $replaceResult.Replaced $true "Profile replacement should succeed."
    Assert-Equal $replaceResult.InstalledPath $installed "Replacement must preserve the installed profile path."
    if (-not (Test-Path (Join-Path $installed "new-only.txt") -PathType Leaf)) { throw "New profile content was not installed." }
    if (Test-Path (Join-Path $installed "old-only.txt")) { throw "Old profile-only content survived replacement." }

    $installedManifest = Get-Content (Join-Path $installed "manifest.json") -Raw | ConvertFrom-Json
    Assert-Equal $installedManifest.Device.UUID "@(1)[TEST-DECK]" "Installed device binding must survive replacement."
    Assert-Equal $installedManifest.Pages.Current "page-new" "Invalid old page selection must fall back to the new bundle current page."
    if (-not (Test-Path $replaceResult.BackupPath -PathType Container)) { throw "Replacement backup was not created." }
    if (-not (Test-Path (Join-Path $replaceResult.BackupPath "old-only.txt") -PathType Leaf)) { throw "Replacement backup does not contain previous profile content." }

    $actions = @(Get-RatDevProfileActionUuids -ProfileRoot $installed)
    Assert-Equal $actions.Count 1 "Expected one installed action after replacement."
    Assert-Equal $actions[0] "com.packrat.test.action" "Installed action UUID did not match the bundle."

    Write-RatDevProfileState -StateRoot $StateRoot -Slug "test-plugin" -ProfilePath $profilePath -Fingerprint $existing.Fingerprint -ProfileName $existing.ProfileName
    $state = Read-RatDevProfileState -StateRoot $StateRoot -Slug "test-plugin"
    Assert-Equal $state.state_version 3 "Profile state version should record the replacement-aware lifecycle."

    $unchanged = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $unchanged.Open $false "Unchanged installed profile should not reopen."
    Assert-Equal $unchanged.Replace $false "Unchanged installed profile should not be replaced."
    Assert-Equal $unchanged.Reason "unchanged-installed" "Unexpected unchanged profile decision."

    $installedPagePath = Join-Path $installed "Profiles\PAGEONE\manifest.json"
    $installedPage = Get-Content $installedPagePath -Raw | ConvertFrom-Json
    $installedPage.Controllers[0].Actions.'0,0'.Settings.revision = 999
    $installedPage | ConvertTo-Json -Depth 20 | Set-Content $installedPagePath -Encoding UTF8

    $drift = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $drift.Open $false "Drifted installed profile should not import a duplicate."
    Assert-Equal $drift.Replace $true "Drifted installed profile should be replaced even when the bundle SHA is unchanged."
    Assert-Equal $drift.Reason "installed-profile-drift" "Unexpected installed profile drift decision."

    [void](Replace-RatDevInstalledProfile -ProfilePath $profilePath -InstalledPath $installed -StateRoot $StateRoot -Slug "test-plugin" -ExpectedName $existing.ProfileName -SkipStreamDeckProcessControl)
    $healed = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $healed.Replace $false "Replaced installed profile should match the bundle again."
    Assert-Equal $healed.Reason "unchanged-installed" "Unexpected healed profile decision."

    $duplicate = Join-Path $InstalledRoot "FFFFFFFF-EEEE-4DDD-8CCC-BBBBBBBBBBBB.sdProfile"
    Copy-Item -LiteralPath $installed -Destination $duplicate -Recurse -Force
    $duplicatePagePath = Join-Path $duplicate "Profiles\PAGEONE\manifest.json"
    $duplicatePage = Get-Content $duplicatePagePath -Raw | ConvertFrom-Json
    $duplicatePage.Controllers[0].Actions.'0,0'.Settings.revision = 777
    $duplicatePage | ConvertTo-Json -Depth 20 | Set-Content $duplicatePagePath -Encoding UTF8

    $duplicateDrift = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $duplicateDrift.Replace $true "A stale same-name duplicate should force an in-place refresh."
    Assert-Equal $duplicateDrift.Reason "installed-profile-drift" "Unexpected duplicate drift decision."
    Assert-Equal @($duplicateDrift.InstalledPaths).Count 2 "Rat Dev should discover every same-name installed profile copy."

    foreach ($installedCopy in @($duplicateDrift.InstalledPaths)) {
        [void](Replace-RatDevInstalledProfile -ProfilePath $profilePath -InstalledPath $installedCopy -StateRoot $StateRoot -Slug "test-plugin" -ExpectedName $existing.ProfileName -SkipStreamDeckProcessControl)
    }
    $duplicatesHealed = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $duplicatesHealed.Replace $false "All same-name profile copies should match after refresh."
    Assert-Equal @($duplicatesHealed.InstalledPaths).Count 2 "Both installed copies should remain tracked after refresh."

    Remove-Item $duplicate -Recurse -Force
    Remove-Item $profilePath -Force
    Set-Content (Join-Path $bundleRoot "revision-two.txt") "changed"
    Compress-Archive -Path $bundleRoot -DestinationPath $profilePath

    $changed = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $changed.Open $false "Changed installed profile should not import a duplicate."
    Assert-Equal $changed.Replace $true "Changed installed profile should refresh in place."
    Assert-Equal $changed.Reason "profile-changed" "Unexpected changed profile decision."

    Remove-Item $installed -Recurse -Force
    $missing = Get-RatDevProfileOpenDecision -ProfilePath $profilePath -StateRoot $StateRoot -Slug "test-plugin" -InstalledRoots @($InstalledRoot)
    Assert-Equal $missing.Open $true "Missing installed profile should use normal first/import reopening."
    Assert-Equal $missing.Replace $false "Missing profile cannot be replaced in place."

    Write-Host "PASS: Rat Dev seamless profile replacement, backup, binding preservation and deduplication" -ForegroundColor Green
}
finally {
    Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

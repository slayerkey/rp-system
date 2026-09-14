$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$AuditHelper = Join-Path $RepoRoot "tools\local\rat-audit.ps1"
$RatCmd = Join-Path $RepoRoot "rat.cmd"

$Slug = "rat-audit-fixture"
$Worktree = Join-Path $RepoRoot "out\dev\worktrees\$Slug"
$ProductRoot = Join-Path $Worktree "plugins\$Slug"
$Scripts = Join-Path $ProductRoot "scripts"

$ExternalSlug = "rat-audit-external-fixture"
$ExternalRegistrationRoot = Join-Path $RepoRoot "plugins\$ExternalSlug"
$ExternalBuildBase = Join-Path $RepoRoot "out\dev\builds\$ExternalSlug"
$ExternalProductRoot = Join-Path $ExternalBuildBase "fixture-build\product"
$ExternalPluginPath = Join-Path $ExternalProductRoot "com.example.rat-audit-fixture.sdPlugin"
$ExternalScripts = Join-Path $ExternalProductRoot "scripts"
$StateRoot = Join-Path $RepoRoot "out\dev\state"
$ExternalStatePath = Join-Path $StateRoot "$ExternalSlug.json"

$FamilySlug = "rat-audit-family-pro"
$FamilyWorktree = Join-Path $RepoRoot "out\dev\worktrees\$FamilySlug"
$FamilyProductRoot = Join-Path $FamilyWorktree "plugins\rat-audit-family"
$FamilyScripts = Join-Path $FamilyProductRoot "scripts"
$FamilyOtherScripts = Join-Path $FamilyWorktree "plugins\unrelated-product\scripts"
$FamilyProducts = Join-Path $FamilyWorktree "products"

try {
    if (Test-Path $Worktree) { Remove-Item $Worktree -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $Scripts | Out-Null

    @'
Write-Output "AUDIT_FIXTURE_PASS"
exit 0
'@ | Set-Content (Join-Path $Scripts "host-audit.ps1") -Encoding UTF8

    $output = (& $AuditHelper $Slug 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Rat Audit fixture returned exit code $LASTEXITCODE.`n$output"
    }
    if ($output -notmatch "AUDIT_FIXTURE_PASS") {
        throw "Rat Audit did not execute the internal product host audit.`n$output"
    }

    if (Test-Path $FamilyWorktree) { Remove-Item $FamilyWorktree -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $FamilyScripts, $FamilyOtherScripts, $FamilyProducts | Out-Null

    @{
        id = $FamilySlug
        type = "plugin"
        source = "plugins/rat-audit-family"
    } | ConvertTo-Json | Set-Content (Join-Path $FamilyProducts "$FamilySlug.json") -Encoding UTF8

    @'
Write-Output "FAMILY_AUDIT_FIXTURE_PASS"
exit 0
'@ | Set-Content (Join-Path $FamilyScripts "host-audit.ps1") -Encoding UTF8

    @'
Write-Output "WRONG_UNRELATED_AUDIT"
exit 0
'@ | Set-Content (Join-Path $FamilyOtherScripts "host-audit.ps1") -Encoding UTF8

    @{
        name = "rat-audit-family-fixture"
        private = $true
        scripts = @{
            "host:probe" = "node -e `"console.log('FAMILY_PROBE_FIXTURE_PASS')`""
        }
    } | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $FamilyProductRoot "package.json") -Encoding UTF8

    $familyOutput = (& $AuditHelper $FamilySlug 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Shared-family Rat Audit fixture returned exit code $LASTEXITCODE.`n$familyOutput"
    }
    if ($familyOutput -notmatch "FAMILY_AUDIT_FIXTURE_PASS") {
        throw "Rat Audit did not execute the product-metadata source host audit.`n$familyOutput"
    }
    if ($familyOutput -match "WRONG_UNRELATED_AUDIT") {
        throw "Rat Audit scanned an unrelated plugin despite canonical product metadata.`n$familyOutput"
    }

    $familyProbeOutput = (& $AuditHelper $FamilySlug "--probe" 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Shared-family Rat Audit --probe fixture returned exit code $LASTEXITCODE.`n$familyProbeOutput"
    }
    if ($familyProbeOutput -notmatch "FAMILY_AUDIT_FIXTURE_PASS") {
        throw "Rat Audit --probe did not run the shared-family host audit before probing.`n$familyProbeOutput"
    }
    if ($familyProbeOutput -notmatch "FAMILY_PROBE_FIXTURE_PASS") {
        throw "Rat Audit --probe did not execute the product host:probe script.`n$familyProbeOutput"
    }
    if ($familyProbeOutput -match "WRONG_UNRELATED_AUDIT") {
        throw "Rat Audit --probe scanned an unrelated product despite canonical product metadata.`n$familyProbeOutput"
    }

    if (Test-Path $ExternalRegistrationRoot) { Remove-Item $ExternalRegistrationRoot -Recurse -Force }
    if (Test-Path $ExternalBuildBase) { Remove-Item $ExternalBuildBase -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $ExternalRegistrationRoot, $ExternalPluginPath, $ExternalScripts, $StateRoot | Out-Null

    @{
        type = "streamdeck-plugin"
        repository = "https://example.invalid/rat-audit-fixture.git"
        ref = "product/rat-audit-external-fixture"
    } | ConvertTo-Json | Set-Content (Join-Path $ExternalRegistrationRoot "rat-dev.json") -Encoding UTF8

    @{
        slug = $ExternalSlug
        repository = "https://example.invalid/rat-audit-fixture.git"
        ref = "product/rat-audit-external-fixture"
        commit = "0123456789abcdef0123456789abcdef01234567"
        plugin_uuid = "com.example.rat-audit-fixture"
        plugin_version = "1.0.0.0"
        plugin_path = $ExternalPluginPath
    } | ConvertTo-Json | Set-Content $ExternalStatePath -Encoding UTF8

    @'
Write-Output "EXTERNAL_AUDIT_FIXTURE_PASS"
exit 0
'@ | Set-Content (Join-Path $ExternalScripts "host-audit.ps1") -Encoding UTF8

    $externalOutput = (& $AuditHelper $ExternalSlug 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "External Rat Audit fixture returned exit code $LASTEXITCODE.`n$externalOutput"
    }
    if ($externalOutput -notmatch "EXTERNAL_AUDIT_FIXTURE_PASS") {
        throw "Rat Audit did not execute the active external build host audit.`n$externalOutput"
    }

    $missingFailed = $false
    try {
        & $AuditHelper "rat-audit-missing-fixture" *> $null
    }
    catch {
        $missingFailed = $_.Exception.Message -match "Run 'rat dev rat-audit-missing-fixture' first"
    }
    if (-not $missingFailed) {
        throw "Rat Audit must fail clearly when no Rat Dev worktree exists."
    }

    $unknownModeFailed = $false
    try {
        & $AuditHelper $Slug "--not-a-real-mode" *> $null
    }
    catch {
        $unknownModeFailed = $_.Exception.Message -match "Unknown Rat Audit option"
    }
    if (-not $unknownModeFailed) {
        throw "Rat Audit must fail closed on unknown options."
    }

    $cmd = Get-Content $RatCmd -Raw
    if ($cmd -notmatch 'for %%A in \(dev ship submit stage kit ship-cloud kit-cloud\)') {
        throw "rat.cmd bootstrap command set changed unexpectedly."
    }
    if ($cmd -match 'for %%A in \([^\r\n]*\baudit\b') {
        throw "rat audit must remain read-only and must not require canonical checkout bootstrap."
    }
    if ($cmd -notmatch 'if /I "%~1"=="audit"') {
        throw "rat.cmd does not route the audit command."
    }
    if ($cmd -notmatch 'rat-audit\.ps1') {
        throw "rat.cmd does not invoke rat-audit.ps1."
    }

    Write-Host "RAT AUDIT REGRESSION PASS"
}
finally {
    if (Test-Path $Worktree) { Remove-Item $Worktree -Recurse -Force }
    if (Test-Path $FamilyWorktree) { Remove-Item $FamilyWorktree -Recurse -Force }
    if (Test-Path $ExternalRegistrationRoot) { Remove-Item $ExternalRegistrationRoot -Recurse -Force }
    if (Test-Path $ExternalBuildBase) { Remove-Item $ExternalBuildBase -Recurse -Force }
    if (Test-Path $ExternalStatePath) { Remove-Item $ExternalStatePath -Force }
}

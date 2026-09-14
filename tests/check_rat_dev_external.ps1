$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Require-Text {
    param([string]$Text, [string]$Needle, [string]$Message)
    if (-not $Text.Contains($Needle)) { throw $Message }
}

$bootstrap = Get-Content (Join-Path $root "tools\local\rat-bootstrap.ps1") -Raw
$preflight = Get-Content (Join-Path $root "tools\local\rat-dev-preflight.ps1") -Raw
$external = Get-Content (Join-Path $root "tools\local\rat-dev-external.ps1") -Raw
$dispatch = Get-Content (Join-Path $root "tools\local\rat-dev-dispatch.ps1") -Raw
$legacy = Get-Content (Join-Path $root "tools\local\rat-dev.ps1") -Raw
$cmd = Get-Content (Join-Path $root "rat.cmd") -Raw

# Bootstrap and dispatch.
Require-Text $bootstrap "+refs/heads/main:refs/remotes/origin/main" "Rat bootstrap must explicitly refresh canonical origin/main."
Require-Text $bootstrap 'if ($localCommit -ne $remoteCommit)' "Rat bootstrap must verify local HEAD equals origin/main."
Require-Text $bootstrap '$ErrorActionPreference = "Continue"' "Rat bootstrap must tolerate normal native stderr and trust Git exit codes."
Require-Text $dispatch 'rat-dev-external.ps1' "Rat Dev dispatcher must route registered external Stream Deck plugins to isolated builds."
Require-Text $dispatch 'rat-dev.ps1' "Rat Dev dispatcher must preserve the internal/XENEON path."
Require-Text $cmd 'rat-dev-dispatch.ps1' "rat.cmd must use the Rat Dev dispatcher."

# Fresh and repeated external checkout behavior.
Require-Text $external 'git" -Arguments @("clone", "--branch", $sourceRef, "--single-branch"' "Fresh external Rat Dev must clone the registered source ref."
Require-Text $external 'remote", "get-url", "origin"' "Existing external checkouts must verify their Git origin."
Require-Text $external 'Rat Dev controller origin mismatch' "A bad external origin must fail closed with a clear diagnostic."
Require-Text $external '+refs/heads/${sourceRef}:refs/remotes/origin/${sourceRef}' "Existing external checkouts must explicitly fetch the registered branch."
Require-Text $external '$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmssfff")' "Repeated Rat Dev runs must use distinct isolated candidate paths."
Require-Text $external 'worktree", "add", "--force", "--detach"' "External Rat Dev must create an isolated Git worktree for each candidate build."
Require-Text $external 'Stream Deck manifest not found' "A candidate with a missing manifest must fail before activation."

# Build/test/validator failures all happen before activation because Invoke-Native throws and the
# activation marker is later in the script.
Require-Text $external 'npm ci failed' "Dependency failure must be explicit."
Require-Text $external 'Plugin type check failed' "Typecheck failure must be explicit."
Require-Text $external 'Plugin build failed' "Build failure must be explicit."
Require-Text $external 'Plugin tests failed' "Test failure must be explicit."
Require-Text $external 'Stream Deck validation failed' "Validator failure must be explicit."
Require-Text $external 'Validate with official Stream Deck CLI' "External Rat Dev must validate before activation."
Require-Text $external 'Switch Stream Deck to validated build' "External Rat Dev must have an explicit activation stage."

$typecheckIndex = $external.IndexOf('Type check $Slug')
$buildIndex = $external.IndexOf('Build $Slug')
if ($typecheckIndex -lt 0 -or $buildIndex -lt 0 -or $typecheckIndex -ge $buildIndex) {
    throw "External Rat Dev must run a declared product typecheck before building."
}

# Activation and rollback.
Require-Text $external 'Stream Deck link failed' "Link failure must be explicit."
Require-Text $external 'Stream Deck restart failed' "Restart failure must be explicit."
Require-Text $external 'Attempting rollback' "External Rat Dev must attempt rollback if activation fails."
Require-Text $external 'Previous development build restored.' "Successful rollback must be reported."
Require-Text $external 'Previous files were not deleted' "Failed rollback must preserve and report the previous build path."

# Reusable checkouts skip destructive stale-folder cleanup. External Rat Dev still performs
# isolated candidate builds, while internal native-helper builds may release their own process locks.
Require-Text $preflight 'Existing Rat Dev checkout is reusable. Continuing without stale-checkout cleanup.' "Healthy preflight must reuse the checkout without destructive cleanup."
Require-Text $preflight 'Windows is still releasing the old development folder. Retrying...' "Stale preflight must retry Windows file locks."
Require-Text $preflight 'Restarting the Stream Deck app once to release it' "Stale preflight must have a final Stream Deck lock recovery path."

# Existing internal products still use the established internal worktree path.
Require-Text $legacy 'Sync-RatPackWorktree' "Internal Rat Dev must retain its canonical RatPack worktree sync path."
Require-Text $legacy 'Build-And-TestPlugin' "Internal Stream Deck products must still build and test before link."
Require-Text $legacy 'Release-RatDevBuildLocks' "Internal Rat Dev must release build-owned native helper locks before an in-place rebuild."

# Success identity and profile diagnostics.
Require-Text $external 'Source commit:' "Rat Dev success output must print exact source commit."
Require-Text $external 'Source repository:' "Rat Dev success output must print source repository."
Require-Text $external 'Source branch:' "Rat Dev success output must print source branch."
Require-Text $external 'Plugin UUID:' "Rat Dev success output must print plugin UUID."
Require-Text $external 'Plugin path:' "Rat Dev success output must print the exact activated plugin path."
Require-Text $external 'Link:              verified' "Rat Dev success output must report link success."
Require-Text $external 'Restart:           verified' "Rat Dev success output must report restart success."
Require-Text $external 'Bundled profiles:' "Rat Dev must surface bundled profile names when present."
Require-Text $external 'Dev links do not guarantee Marketplace-style profile auto-install' "Rat Dev must distinguish dev linking from packaged profile installation."

if ($external.Contains('reset", "--hard"') -or $external.Contains('clean", "-fd')) {
    throw "External Rat Dev must never mutate the controller working tree with reset/clean while it may still be the live plugin directory."
}

$validateIndex = $external.IndexOf('Validate with official Stream Deck CLI')
$switchIndex = $external.IndexOf('Switch Stream Deck to validated build')
if ($validateIndex -lt 0 -or $switchIndex -lt 0 -or $validateIndex -ge $switchIndex) {
    throw "External Rat Dev must finish validation before stopping/unlinking the current plugin."
}

# All paths are passed as PowerShell argument-array elements instead of assembled command strings.
# This is the structural requirement that keeps paths such as
# C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub safe.
Require-Text $external '"-C", $ControllerRoot' "Git controller paths must be passed as argument-array elements so spaces are preserved."
Require-Text $external '"link", $pluginDir' "Stream Deck plugin paths must be passed as argument-array elements so spaces are preserved."

$parserFailures = @()
foreach ($relative in @(
    "tools\local\rat-bootstrap.ps1",
    "tools\local\rat-dev-preflight.ps1",
    "tools\local\rat-dev-dispatch.ps1",
    "tools\local\rat-dev-external.ps1"
)) {
    $path = Join-Path $root $relative
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count) {
        $parserFailures += $relative
        $errors | ForEach-Object { Write-Host "${relative}:$($_.Extent.StartLineNumber) $($_.Message)" }
    }
}
if ($parserFailures.Count) {
    throw "PowerShell syntax failures: $($parserFailures -join ', ')"
}

Write-Host "Rat Dev external lifecycle contract PASS"

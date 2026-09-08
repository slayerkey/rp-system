param(
  [Parameter(Mandatory = $true)][string]$ApprovalPath,
  [string]$AssemblyPath = "",
  [string]$OutputRoot = "",
  [string]$CanonicalDir = "",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
$pluginUuid = "com.packrat.stream-deck-ultimate-bundle"
$expectedAcceptedVersion = "0.7.1.0"
$expectedTargetVersion = "0.8.0.0"
$expectedPrepromotionCommit = "15cc99c96bf243dfccb0b18774e859882c97684b"
$expectedPackedSha = "a3790e672ce18bc9887d1b8b2f0175c663c548a4d4bad19c287f1cf2003d9497"
$defaultCanonicalDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\prototype\com.packrat.stream-deck-ultimate-bundle.sdPlugin"))
if ([string]::IsNullOrWhiteSpace($CanonicalDir)) {
  $acceptedDir = $defaultCanonicalDir
} else {
  if (-not [IO.Path]::IsPathRooted($CanonicalDir)) { $CanonicalDir = Join-Path (Get-Location) $CanonicalDir }
  $acceptedDir = [IO.Path]::GetFullPath($CanonicalDir)
}
$usingCanonicalOverride = ($acceptedDir -ne $defaultCanonicalDir)
$repoRoot = (& git -C $PSScriptRoot rev-parse --show-toplevel 2>$null).Trim()
if ([string]::IsNullOrWhiteSpace($repoRoot)) { throw "Could not resolve ratpack-system git root" }
$repoRoot = [IO.Path]::GetFullPath($repoRoot)
if (-not [IO.Path]::IsPathRooted($ApprovalPath)) { $ApprovalPath = Join-Path (Get-Location) $ApprovalPath }
$ApprovalPath = [IO.Path]::GetFullPath($ApprovalPath)
if (-not (Test-Path -LiteralPath $ApprovalPath)) { throw "Hardware approval file missing: $ApprovalPath" }

function Require-True([object]$Value, [string]$Name) {
  if ($Value -ne $true) { throw "Hardware approval gate not passed: $Name" }
}
function Require-Equal([object]$Actual, [object]$Expected, [string]$Name) {
  if ([string]$Actual -ne [string]$Expected) { throw "Approval mismatch for $Name. Expected '$Expected', saw '$Actual'" }
}

$approval = Get-Content -LiteralPath $ApprovalPath -Raw | ConvertFrom-Json
Require-Equal $approval.schema 1 "schema"
Require-Equal $approval.productUuid $pluginUuid "productUuid"
Require-Equal $approval.acceptedVersion $expectedAcceptedVersion "acceptedVersion"
Require-Equal $approval.targetVersion $expectedTargetVersion "targetVersion"
Require-Equal $approval.prepromotionSourceCommit $expectedPrepromotionCommit "prepromotionSourceCommit"
Require-Equal $approval.prepromotionPackedPluginSha256 $expectedPackedSha "prepromotionPackedPluginSha256"
Require-Equal $approval.hostTest.result "pass" "hostTest.result"
Require-True $approval.hostTest.writeAndRestorePass "hostTest.writeAndRestorePass"
Require-Equal $approval.labTest.result "pass" "labTest.result"
foreach ($gate in @(
  "currentAppFollowsForeground",
  "specificAppTargetsSelectedProcess",
  "keypadMuteToggle",
  "dialVolume",
  "dialPushMuteToggle",
  "waitingStateSafe",
  "audioOffStateSafe",
  "focusChangeDoesNotRetargetBurst",
  "propertyInspectorAppList",
  "manualProcessName",
  "labRemovalLeavesV071Unaffected"
)) {
  Require-True $approval.labTest.$gate "labTest.$gate"
}
Require-True $approval.allowProductionPromotion "allowProductionPromotion"
if ([string]::IsNullOrWhiteSpace([string]$approval.approvedAt)) { throw "approvedAt must be populated before production promotion" }

# Hardware approval is tied to the exact production-relevant source that produced the
# green prepromotion candidate. Test/docs changes may advance HEAD, but runtime inputs may not.
$criticalPaths = @(
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/PackRatAppAudio.cs",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/PackRatForeground.cs",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/action-spec.js",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/settings-model.js",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/session-model.js",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/app-audio-service.js",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/streamdeck-surface-model.js",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/streamdeck-controller.js",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/worker-client.js",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/runtime-factory.js",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/streamdeck-bridge.js",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/app-audio-worker.ps1",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/v08-app-audio-adapter.js",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/plugin-v08-shadow.cjs",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/property-inspector.html",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/build-helper.ps1",
  "products/stream-deck-ultimate-bundle/experiments/per-app-audio/prepare-v08-candidate.ps1"
)
Push-Location $repoRoot
try {
  & git diff --quiet $expectedPrepromotionCommit HEAD -- @criticalPaths
  if ($LASTEXITCODE -ne 0) {
    throw "Production-relevant v0.8 source changed after the approved prepromotion candidate. Build and hardware-test a new candidate before promotion."
  }
  & git diff --quiet -- $criticalPaths
  if ($LASTEXITCODE -ne 0) { throw "Uncommitted production-relevant v0.8 source changes exist; refusing promotion" }
} finally { Pop-Location }

$acceptedManifestPath = Join-Path $acceptedDir "manifest.json"
if (-not (Test-Path -LiteralPath $acceptedManifestPath)) { throw "Canonical accepted plugin missing: $acceptedDir" }
$acceptedManifest = Get-Content -LiteralPath $acceptedManifestPath -Raw | ConvertFrom-Json
Require-Equal $acceptedManifest.UUID $pluginUuid "canonical UUID"
Require-Equal $acceptedManifest.Version $expectedAcceptedVersion "canonical version"
Require-Equal $acceptedManifest.CodePath "bin/plugin-v071.cjs" "canonical CodePath"
if (@($acceptedManifest.Actions | Where-Object { $_.UUID -eq "$pluginUuid.app-audio" }).Count -ne 0) {
  throw "Canonical v0.7.1 already contains App Volume; promotion state is ambiguous"
}

$plan = [ordered]@{
  ok = $true
  mode = $(if ($Apply) { "apply" } else { "plan" })
  approval = $ApprovalPath
  acceptedDir = $acceptedDir
  canonicalOverride = $usingCanonicalOverride
  acceptedVersion = $expectedAcceptedVersion
  targetVersion = $expectedTargetVersion
  prepromotionSourceCommit = $expectedPrepromotionCommit
  prepromotionPackedPluginSha256 = $expectedPackedSha
  sourceStillMatchesApprovedCandidate = $true
  hardwareGatesPassed = $true
}
if (-not $Apply) {
  $plan | ConvertTo-Json -Depth 6
  exit 0
}

if ([string]::IsNullOrWhiteSpace($AssemblyPath)) {
  $buildJson = & (Join-Path $PSScriptRoot "build-helper.ps1")
  $build = $buildJson | ConvertFrom-Json
  if (-not $build.ok) { throw "App Volume helper build did not report success" }
  $AssemblyPath = [string]$build.path
}
if (-not [IO.Path]::IsPathRooted($AssemblyPath)) { $AssemblyPath = Join-Path (Get-Location) $AssemblyPath }
$AssemblyPath = [IO.Path]::GetFullPath($AssemblyPath)
if (-not (Test-Path -LiteralPath $AssemblyPath)) { throw "Promotion helper DLL missing: $AssemblyPath" }

if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $PSScriptRoot "promotion-v08-dist" }
if (-not [IO.Path]::IsPathRooted($OutputRoot)) { $OutputRoot = Join-Path (Get-Location) $OutputRoot }
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$stageJson = & (Join-Path $PSScriptRoot "prepare-v08-candidate.ps1") -AssemblyPath $AssemblyPath -OutputRoot $OutputRoot
$stage = $stageJson | ConvertFrom-Json
if (-not $stage.ok) { throw "v0.8 promotion staging did not report success" }
$candidateDir = [IO.Path]::GetFullPath([string]$stage.candidateDir)
$candidateManifest = Get-Content -LiteralPath (Join-Path $candidateDir "manifest.json") -Raw | ConvertFrom-Json
Require-Equal $candidateManifest.UUID $pluginUuid "staged UUID"
Require-Equal $candidateManifest.Version $expectedTargetVersion "staged version"
Require-Equal $candidateManifest.CodePath "bin/plugin-v08.cjs" "staged CodePath"
if (@($candidateManifest.Actions | Where-Object { $_.UUID -eq "$pluginUuid.app-audio" }).Count -ne 1) { throw "Staged candidate does not contain exactly one App Volume action" }
$prepromotionInfo = Join-Path $candidateDir "V08_CANDIDATE_INFO.json"
if (Test-Path -LiteralPath $prepromotionInfo) { Remove-Item -Force -LiteralPath $prepromotionInfo }

$backupDir = "$acceptedDir.promotion-backup-$PID"
if (Test-Path -LiteralPath $backupDir) { Remove-Item -Recurse -Force -LiteralPath $backupDir }
Copy-Item -Recurse -Force -LiteralPath $acceptedDir -Destination $backupDir
try {
  # Overlay the staged candidate onto canonical source. Historical unused runtime files are
  # intentionally retained just as earlier accepted versions retain their predecessor files.
  Copy-Item -Recurse -Force -Path (Join-Path $candidateDir "*") -Destination $acceptedDir
  $promoted = Get-Content -LiteralPath $acceptedManifestPath -Raw | ConvertFrom-Json
  Require-Equal $promoted.UUID $pluginUuid "promoted UUID"
  Require-Equal $promoted.Version $expectedTargetVersion "promoted version"
  Require-Equal $promoted.CodePath "bin/plugin-v08.cjs" "promoted CodePath"
  if (@($promoted.Actions | Where-Object { $_.UUID -eq "$pluginUuid.app-audio" }).Count -ne 1) { throw "Promoted canonical manifest lost App Volume" }
  if (-not (Test-Path -LiteralPath (Join-Path $acceptedDir "bin\app-audio\PackRatAppAudio.dll"))) { throw "Promoted canonical source is missing App Volume helper" }
} catch {
  Remove-Item -Recurse -Force -LiteralPath $acceptedDir
  Copy-Item -Recurse -Force -LiteralPath $backupDir -Destination $acceptedDir
  throw
} finally {
  if (Test-Path -LiteralPath $backupDir) { Remove-Item -Recurse -Force -LiteralPath $backupDir }
}

$plan.canonicalPromoted = $true
$plan.helperSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $acceptedDir "bin\app-audio\PackRatAppAudio.dll")).Hash.ToLowerInvariant()
$plan.nextRequiredGate = "Run full production CI, official validate/pack, and upgrade regression before ship"
$plan | ConvertTo-Json -Depth 6

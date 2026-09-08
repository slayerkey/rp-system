param(
  [string]$AssemblyPath = "",
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($AssemblyPath)) { $AssemblyPath = Join-Path $PSScriptRoot "build\PackRatAppAudio.dll" }
if ([string]::IsNullOrWhiteSpace($OutputDir)) { $OutputDir = Join-Path $PSScriptRoot "host-test-dist" }
if (-not [IO.Path]::IsPathRooted($AssemblyPath)) { $AssemblyPath = Join-Path (Get-Location) $AssemblyPath }
if (-not [IO.Path]::IsPathRooted($OutputDir)) { $OutputDir = Join-Path (Get-Location) $OutputDir }
$AssemblyPath = [IO.Path]::GetFullPath($AssemblyPath)
$OutputDir = [IO.Path]::GetFullPath($OutputDir)
if (-not (Test-Path -LiteralPath $AssemblyPath)) { throw "Precompiled helper missing: $AssemblyPath" }

if (Test-Path -LiteralPath $OutputDir) { Remove-Item -Recurse -Force -LiteralPath $OutputDir }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

foreach ($name in @("HOST_TEST.md","run-host-test.cmd","run-host-test-and-save.cmd","real-host-smoke.ps1","app-audio.ps1")) {
  $source = Join-Path $PSScriptRoot $name
  if (-not (Test-Path -LiteralPath $source)) { throw "Host bundle input missing: $name" }
  Copy-Item -LiteralPath $source -Destination (Join-Path $OutputDir $name) -Force
}

$dllOut = Join-Path $OutputDir "PackRatAppAudio.dll"
Copy-Item -LiteralPath $AssemblyPath -Destination $dllOut -Force
$assembly = [Reflection.Assembly]::LoadFrom($dllOut)
$coreType = $assembly.GetType("PackRatAppAudio.Core", $false)
$foregroundType = $assembly.GetType("PackRatAppAudio.Foreground", $false)
if ($null -eq $coreType) { throw "Staged helper does not contain PackRatAppAudio.Core" }
if ($null -eq $foregroundType) { throw "Staged helper does not contain PackRatAppAudio.Foreground" }
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $dllOut).Hash.ToLowerInvariant()
$manifest = [ordered]@{
  schema = 1
  experimental = $true
  acceptedPluginChanged = $false
  generatedAt = [DateTime]::UtcNow.ToString('o')
  sourceCommit = [string]$env:GITHUB_SHA
  helper = [ordered]@{
    file = "PackRatAppAudio.dll"
    sizeBytes = (Get-Item -LiteralPath $dllOut).Length
    sha256 = $hash
    type = $coreType.FullName
    foregroundType = $foregroundType.FullName
  }
  entrypoint = "run-host-test-and-save.cmd"
  legacyEntrypoint = "run-host-test.cmd"
  resultFile = "host-test-result.json"
}
[IO.File]::WriteAllText((Join-Path $OutputDir "BUNDLE_INFO.json"),($manifest | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))

[pscustomobject]@{
  ok = $true
  outputDir = $OutputDir
  fileCount = @(Get-ChildItem -File -LiteralPath $OutputDir).Count
  helperSha256 = $hash
  foregroundType = $foregroundType.FullName
  entrypoint = "run-host-test-and-save.cmd"
  resultFile = "host-test-result.json"
} | ConvertTo-Json -Compress

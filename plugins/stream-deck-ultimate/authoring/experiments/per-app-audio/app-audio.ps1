param(
  [ValidateSet("List","Find","SetVolume","AdjustVolume","Mute","Unmute","ToggleMute","Compile")]
  [string]$Action = "List",
  [string]$Match = "",
  [int]$Value = 0,
  [string]$AssemblyPath = ""
)

$ErrorActionPreference = "Stop"
$backend = "existing"
$loadedPath = ""

if (-not ("PackRatAppAudio.Core" -as [type])) {
  $candidateAssemblies = @()
  if (-not [string]::IsNullOrWhiteSpace($AssemblyPath)) {
    if (-not [IO.Path]::IsPathRooted($AssemblyPath)) { $AssemblyPath = Join-Path (Get-Location) $AssemblyPath }
    $candidateAssemblies += [IO.Path]::GetFullPath($AssemblyPath)
  } else {
    $candidateAssemblies += (Join-Path $PSScriptRoot "PackRatAppAudio.dll")
    $candidateAssemblies += (Join-Path $PSScriptRoot "build\PackRatAppAudio.dll")
  }
  $precompiled = $candidateAssemblies | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($precompiled) {
    Add-Type -Path $precompiled
    $backend = "assembly"
    $loadedPath = [IO.Path]::GetFullPath($precompiled)
  } else {
    $source = Join-Path $PSScriptRoot "PackRatAppAudio.cs"
    if (-not (Test-Path -LiteralPath $source)) { throw "PackRatAppAudio helper source and precompiled assembly are both missing" }
    Add-Type -Path $source
    $backend = "source"
    $loadedPath = [IO.Path]::GetFullPath($source)
  }
}

if (-not ("PackRatAppAudio.Core" -as [type])) { throw "PackRatAppAudio.Core failed to load" }

if ($Action -eq "Compile") {
  [pscustomobject]@{ ok = $true; type = "PackRatAppAudio.Core"; backend = $backend; path = $loadedPath } | ConvertTo-Json -Compress
  exit 0
}

switch ($Action) {
  "List" {
    [PackRatAppAudio.Core]::List() | ConvertTo-Json -Compress -Depth 5
  }
  "Find" {
    if (-not $Match) { throw "Match is required" }
    [PackRatAppAudio.Core]::Find($Match) | ConvertTo-Json -Compress -Depth 5
  }
  "SetVolume" {
    if (-not $Match) { throw "Match is required" }
    [pscustomobject]@{ changed = [PackRatAppAudio.Core]::SetVolume($Match, $Value); match = $Match; volume = [Math]::Max(0,[Math]::Min(100,$Value)) } | ConvertTo-Json -Compress
  }
  "AdjustVolume" {
    if (-not $Match) { throw "Match is required" }
    [pscustomobject]@{ changed = [PackRatAppAudio.Core]::AdjustVolume($Match, $Value); match = $Match; delta = $Value } | ConvertTo-Json -Compress
  }
  "Mute" {
    if (-not $Match) { throw "Match is required" }
    [pscustomobject]@{ changed = [PackRatAppAudio.Core]::SetMute($Match, $true); match = $Match; muted = $true } | ConvertTo-Json -Compress
  }
  "Unmute" {
    if (-not $Match) { throw "Match is required" }
    [pscustomobject]@{ changed = [PackRatAppAudio.Core]::SetMute($Match, $false); match = $Match; muted = $false } | ConvertTo-Json -Compress
  }
  "ToggleMute" {
    if (-not $Match) { throw "Match is required" }
    [pscustomobject]@{ changed = [PackRatAppAudio.Core]::ToggleMute($Match); match = $Match } | ConvertTo-Json -Compress
  }
}

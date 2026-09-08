param(
  [string]$Process = "",
  [Alias("Pid")]
  [int]$TargetPid = 0,
  [switch]$Exercise,
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$audio = Join-Path $PSScriptRoot "app-audio.ps1"

function Normalize-Process([string]$value) {
  $s = [IO.Path]::GetFileName(($value -replace '/', '\'))
  if ($s.EndsWith('.exe',[StringComparison]::OrdinalIgnoreCase)) { $s = $s.Substring(0,$s.Length-4) }
  return $s.ToLowerInvariant()
}

function Helper-Evidence {
  $dll = @(
    (Join-Path $PSScriptRoot "PackRatAppAudio.dll"),
    (Join-Path $PSScriptRoot "build\PackRatAppAudio.dll")
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($dll) {
    return [ordered]@{
      backend = 'assembly'
      file = [IO.Path]::GetFileName($dll)
      sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $dll).Hash.ToLowerInvariant()
    }
  }
  $source = Join-Path $PSScriptRoot "PackRatAppAudio.cs"
  return [ordered]@{
    backend = 'source'
    file = if (Test-Path -LiteralPath $source) { [IO.Path]::GetFileName($source) } else { '' }
    sha256 = if (Test-Path -LiteralPath $source) { (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash.ToLowerInvariant() } else { '' }
  }
}

function Read-Sessions {
  # app-audio.ps1 is another PowerShell script, not a native executable. Exceptions propagate
  # through ErrorActionPreference=Stop; LASTEXITCODE is intentionally not used here because a
  # clean cmd -> powershell launch can leave it null after a successful script invocation.
  $raw = & $audio -Action List
  if ([string]::IsNullOrWhiteSpace([string]$raw)) { return @() }
  $parsed = $raw | ConvertFrom-Json
  return @($parsed)
}

function Public-Session([object]$s) {
  [pscustomobject]@{
    pid = [int]$s.pid
    process = [string]$s.process
    volume = [int]$s.volume
    muted = [bool]$s.muted
    state = [string]$s.state
  }
}

$report = [ordered]@{
  schema = 1
  generatedAt = [DateTime]::UtcNow.ToString('o')
  host = [ordered]@{
    os = [Environment]::OSVersion.VersionString
    powershell = $PSVersionTable.PSVersion.ToString()
  }
  helper = Helper-Evidence
  requested = [ordered]@{ process = $Process; pid = $TargetPid; exercise = [bool]$Exercise }
  endpointAvailable = $false
  sessionCount = 0
  sessions = @()
  target = $null
  exercise = $null
  status = 'unknown'
  error = $null
}

$exitCode = 0
try {
  $sessions = @(Read-Sessions)
  $report.endpointAvailable = $true
  $report.sessionCount = $sessions.Count
  $report.sessions = @($sessions | ForEach-Object { Public-Session $_ })

  if ($TargetPid -le 0 -and [string]::IsNullOrWhiteSpace($Process)) {
    $report.status = 'audit-only-needs-target'
  } else {
    $key = Normalize-Process $Process
    $matches = @($sessions | Where-Object {
      if ($TargetPid -gt 0) { [int]$_.pid -eq $TargetPid }
      else { (Normalize-Process ([string]$_.process)) -eq $key }
    })
    $pids = @($matches | ForEach-Object { [int]$_.pid } | Where-Object { $_ -gt 0 } | Select-Object -Unique)
    $volumes = @($matches | ForEach-Object { [int]$_.volume } | Select-Object -Unique)
    $mutes = @($matches | ForEach-Object { [bool]$_.muted } | Select-Object -Unique)
    $report.target = [ordered]@{
      found = ($matches.Count -gt 0)
      process = if ($matches.Count) { [string]$matches[0].process } else { $key }
      sessionCount = $matches.Count
      pids = $pids
      mixedVolume = ($volumes.Count -gt 1)
      mixedMute = ($mutes.Count -gt 1)
      volume = if ($volumes.Count -eq 1) { $volumes[0] } else { $null }
      muted = if ($mutes.Count -eq 1) { $mutes[0] } else { $null }
    }

    if ($matches.Count -eq 0) {
      $report.status = 'waiting-no-session'
    } elseif (-not $Exercise) {
      $report.status = 'read-only-pass'
    } elseif ($pids.Count -ne 1) {
      $report.status = 'exercise-refused-multiple-pids'
      $report.exercise = [ordered]@{ attempted = $false; reason = 'Specify -Pid so a write test cannot affect multiple app processes.' }
      $exitCode = 2
    } elseif ($volumes.Count -ne 1) {
      $report.status = 'exercise-refused-mixed-volume'
      $report.exercise = [ordered]@{ attempted = $false; reason = 'Target PID has mixed session volumes; refusing to flatten them for a test.' }
      $exitCode = 2
    } else {
      $testPid = [int]$pids[0]
      $original = [int]$volumes[0]
      $delta = if ($original -ge 100) { -1 } else { 1 }
      $expected = [Math]::Max(0,[Math]::Min(100,$original + $delta))
      $report.exercise = [ordered]@{
        attempted = $true
        pid = $testPid
        originalVolume = $original
        delta = $delta
        expectedVolume = $expected
        changedCount = 0
        observedVolume = $null
        restoredVolume = $null
        changedVerified = $false
        restoreVerified = $false
      }
      try {
        $changeJson = & $audio -Action AdjustVolume -Match ([string]$testPid) -Value $delta
        $change = $changeJson | ConvertFrom-Json
        $report.exercise.changedCount = [int]$change.changed
        Start-Sleep -Milliseconds 250
        $after = @(Read-Sessions | Where-Object { [int]$_.pid -eq $testPid })
        $afterVolumes = @($after | ForEach-Object { [int]$_.volume } | Select-Object -Unique)
        if ($afterVolumes.Count -eq 1) { $report.exercise.observedVolume = $afterVolumes[0] }
        $report.exercise.changedVerified = ($afterVolumes.Count -eq 1 -and [int]$afterVolumes[0] -eq $expected)
      } finally {
        & $audio -Action SetVolume -Match ([string]$testPid) -Value $original | Out-Null
        Start-Sleep -Milliseconds 250
        $restored = @(Read-Sessions | Where-Object { [int]$_.pid -eq $testPid })
        $restoredVolumes = @($restored | ForEach-Object { [int]$_.volume } | Select-Object -Unique)
        if ($restoredVolumes.Count -eq 1) { $report.exercise.restoredVolume = $restoredVolumes[0] }
        $report.exercise.restoreVerified = ($restoredVolumes.Count -eq 1 -and [int]$restoredVolumes[0] -eq $original)
      }
      if ($report.exercise.changedVerified -and $report.exercise.restoreVerified) {
        $report.status = 'write-and-restore-pass'
      } else {
        $report.status = 'write-or-restore-failed'
        $exitCode = 1
      }
    }
  }
} catch {
  $report.status = 'audio-endpoint-unavailable-or-error'
  $report.error = [string]$_.Exception.Message
  $exitCode = if ($Exercise) { 1 } else { 0 }
}

$json = $report | ConvertTo-Json -Depth 8
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
  $parent = Split-Path -Parent $OutputPath
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  [IO.File]::WriteAllText((Join-Path (Get-Location) $OutputPath),$json,[Text.UTF8Encoding]::new($false))
}
$json
exit $exitCode

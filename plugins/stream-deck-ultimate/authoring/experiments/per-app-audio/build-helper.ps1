param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$sources = @(
  (Join-Path $PSScriptRoot "PackRatAppAudio.cs"),
  (Join-Path $PSScriptRoot "PackRatForeground.cs")
)
foreach ($source in $sources) { if (-not (Test-Path -LiteralPath $source)) { throw "Helper source missing: $source" } }
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $PSScriptRoot "build\PackRatAppAudio.dll" }
if (-not [IO.Path]::IsPathRooted($OutputPath)) { $OutputPath = Join-Path (Get-Location) $OutputPath }
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
$dir = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $dir | Out-Null
if (Test-Path $OutputPath) { Remove-Item -Force $OutputPath }

$candidates = @(
  (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
  (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
)
$csc = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) { throw "Compatible .NET Framework C# compiler not found" }

& $csc /nologo /target:library /optimize+ "/out:$OutputPath" @sources
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $OutputPath)) { throw "C# helper compilation failed with exit code $LASTEXITCODE" }

$assembly = [Reflection.Assembly]::LoadFrom($OutputPath)
$coreType = $assembly.GetType("PackRatAppAudio.Core", $false)
$foregroundType = $assembly.GetType("PackRatAppAudio.Foreground", $false)
if ($null -eq $coreType) { throw "Compiled assembly does not contain PackRatAppAudio.Core" }
if ($null -eq $foregroundType) { throw "Compiled assembly does not contain PackRatAppAudio.Foreground" }
$sha = (Get-FileHash -Algorithm SHA256 -LiteralPath $OutputPath).Hash.ToLowerInvariant()
[pscustomobject]@{
  ok = $true
  path = $OutputPath
  sizeBytes = (Get-Item -LiteralPath $OutputPath).Length
  sha256 = $sha
  type = $coreType.FullName
  foregroundType = $foregroundType.FullName
  compiler = $csc
} | ConvertTo-Json -Compress

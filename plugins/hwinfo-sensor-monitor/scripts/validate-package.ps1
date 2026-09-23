param([string]$Dist = "dist")
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packages = @(Get-ChildItem -Path $Dist -Filter *.streamDeckPlugin -File)
if ($packages.Count -ne 1) { throw "Expected exactly one .streamDeckPlugin in $Dist; found $($packages.Count)" }
$pkg = $packages[0]
$zip = [System.IO.Compression.ZipFile]::OpenRead($pkg.FullName)
try {
  $names = @($zip.Entries | ForEach-Object { $_.FullName.Replace("\","/") })
  $manifests = @($zip.Entries | Where-Object { $_.FullName.Replace("\","/") -match "(^|/)manifest\.json$" })
  if ($manifests.Count -ne 1) { throw "Expected exactly one plugin manifest; found $($manifests.Count)" }
  $profiles = @($names | Where-Object { $_ -match "\.streamDeckProfile$" })
  if ($profiles.Count -ne 4) { throw "Expected exactly four bundled profiles; found $($profiles.Count)" }
  $native = @($names | Where-Object { $_ -match "(?i)hwinfo.*\.(exe|dll|msi|zip)$" })
  $badNative = @($native | Where-Object { $_ -notmatch "(?i)PackRat\.HWiNFOReader\.exe$" })
  if ($badNative.Count -gt 0) { throw "HWiNFO binary-like files must not be bundled: $($badNative -join ', ')" }
  if (-not ($names | Where-Object { $_ -match "(?i)PackRat\.HWiNFOReader\.exe$" })) { throw "PackRat native HWiNFO reader missing from package" }
  if (-not ($names | Where-Object { $_ -match "(^|/)THIRD_PARTY_NOTICES\.md$" })) { throw "THIRD_PARTY_NOTICES.md missing from package" }
  $entry = $manifests[0]
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { $manifest = ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
  if ($manifest.UUID -ne "com.packrat.hwinfo-sensor-monitor") { throw "Packaged UUID mismatch: $($manifest.UUID)" }
  if ($manifest.Version -ne "1.0.0.0") { throw "Packaged version mismatch: $($manifest.Version)" }
  if (@($manifest.Actions).Count -ne 4) { throw "Packaged action count mismatch" }
  $dashboard = @($manifest.Actions | Where-Object { $_.UUID -eq "com.packrat.hwinfo-sensor-monitor.dashboard" })[0]
  if (-not $dashboard -or -not (@($dashboard.Controllers) -contains "Encoder")) { throw "Packaged dashboard Encoder support missing" }
  $hash=(Get-FileHash $pkg.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $report=[ordered]@{
    schema_version=1; package=$pkg.Name; bytes=$pkg.Length; sha256=$hash; uuid=$manifest.UUID;
    version=$manifest.Version; entries=$names.Count; profiles=$profiles; manifest_count=$manifests.Count;
    hwinfobinaries_bundled=$false; packrat_reader_bundled=$true; status="PASS"
  }
  $json=$report | ConvertTo-Json -Depth 8
  $json | Set-Content -Path (Join-Path $Dist "package-validation.json") -Encoding UTF8
  Write-Host $json
} finally { $zip.Dispose() }

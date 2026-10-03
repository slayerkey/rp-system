param([string]$Dist = "dist",[string]$SourceSha = "")
$ErrorActionPreference = "Stop"
$version = "1.0.0.0"
$kit = Join-Path $Dist "SHIP_KIT\hwinfo-sensor-monitor-$version"
if (Test-Path $kit) { Remove-Item $kit -Recurse -Force }
New-Item -ItemType Directory -Path $kit | Out-Null
New-Item -ItemType Directory -Path (Join-Path $kit "marketplace") | Out-Null
$packages = @(Get-ChildItem -Path $Dist -Filter *.streamDeckPlugin -File)
if ($packages.Count -ne 1) { throw "Expected exactly one package before SHIP_KIT build" }
Copy-Item $packages[0].FullName (Join-Path $kit $packages[0].Name)
Copy-Item "submission.json" (Join-Path $kit "submission.json")
Copy-Item "THIRD_PARTY_NOTICES.md" (Join-Path $kit "THIRD_PARTY_NOTICES.md")
Copy-Item (Join-Path $Dist "package-validation.json") (Join-Path $kit "package-validation.json")
Copy-Item (Join-Path $Dist "marketplace\*") (Join-Path $kit "marketplace") -Recurse

$qa=@"
# HWiNFO Sensor Monitor — Release QA

Status: READY_TO_SHIP automated release gates passed
Source SHA: $SourceSha
Version: $version
UUID: com.packrat.hwinfo-sensor-monitor
Price: 9.99 USD

Passed release gates:
- Node 24 unit and stress tests
- deterministic HWiNFO Shared Memory fixtures for AMD, Intel, NVIDIA, Unicode, duplicate labels, missing units, extreme values, 1600 sensors, and DEAD/expired state
- one shared reader/service architecture and bounded history tests
- PackRat Stream Deck plugin design audit
- PackRat key/profile visual audit with MK.2, XL, Stream Deck +, and Neo coverage
- official Elgato CLI validate
- official Elgato CLI pack
- exact packaged ZIP/profile/native-binary validation
- deterministic current PackRat Marketplace media generation

Dependency behavior:
- HWiNFO is customer-installed and is not bundled or redistributed.
- HWiNFO64 Free Shared Memory expiry is surfaced as an unavailable source and is never bypassed or auto-re-enabled.
- No PackRat cloud, account, analytics, or telemetry.

Physical note:
- Hosted release QA cannot prove a user's specific physical Stream Deck or HWiNFO hardware inventory. Runtime states and all supported layouts are covered deterministically; final Marketplace submission should preserve this exact validated package.
"@
$qa | Set-Content -Path (Join-Path $kit "QA_REPORT.md") -Encoding UTF8

$files=Get-ChildItem $kit -Recurse -File | Sort-Object FullName
$checksums=@()
foreach($file in $files){
  $rel=[IO.Path]::GetRelativePath($kit,$file.FullName).Replace("\","/")
  $hash=(Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $checksums += "$hash  $rel"
}
$checksums -join [Environment]::NewLine | Set-Content -Path (Join-Path $kit "SHA256SUMS.txt") -Encoding ASCII

$manifest=[ordered]@{
  schema_version=1
  product="HWiNFO Sensor Monitor"
  slug="hwinfo-sensor-monitor"
  uuid="com.packrat.hwinfo-sensor-monitor"
  version=$version
  price_usd=9.99
  source_sha=$SourceSha
  package=$packages[0].Name
  package_sha256=(Get-FileHash $packages[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  media=@("01_icon.png","02_cover.png","03_gallery_01.png","04_gallery_02.png","05_gallery_03.png","06_gallery_04.png")
  status="READY_TO_SHIP"
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $kit "SHIP_MANIFEST.json") -Encoding UTF8
Write-Host "SHIP_KIT PASS: $kit"

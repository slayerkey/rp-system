$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$path = Join-Path $repo "tools\local\rat-ship-plugin.ps1"
$source = Get-Content $path -Raw

$localArt = $source.LastIndexOf('Invoke-RatArtUtf8Safe -ArtScript $artScript')
$globalHero = $source.LastIndexOf('Invoke-CanonicalStreamDeckHero -ProductSlug $PluginSlug')
$preflight = $source.LastIndexOf('$requiredMedia = @("01_search_icon.png", "02_cover.png"')

if ($localArt -lt 0) { throw "Rat Ship no longer invokes product-local Rat Art." }
if ($globalHero -lt 0) { throw "Rat Ship does not invoke the global Stream Deck hero." }
if ($preflight -lt 0) { throw "Rat Ship Marketplace media preflight was not found." }
if (-not ($localArt -lt $globalHero -and $globalHero -lt $preflight)) {
    throw "Global Stream Deck hero must run after product-local art and before Marketplace media preflight."
}

if ($source -notmatch 'Canonical Stream Deck photo hero applied to 02_cover\.png only') {
    throw "Rat Ship no longer documents that only the cover slot is replaced."
}

if ($source -notmatch 'render_streamdeck_ship_hero\.py') {
    throw "Rat Ship is not wired to the canonical global hero wrapper."
}

Write-Host "RAT SHIP STREAM DECK HERO ROUTING TEST PASS"

param(
    [Parameter(Mandatory = $true)]
    [string]$PluginSlug,

    [Parameter(Mandatory = $true)]
    [string]$Destination,

    [switch]$IsolatedBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not [System.IO.Path]::IsPathRooted($Destination)) {
    $Destination = Join-Path $RepoRoot $Destination
}

# Public entry point: canonical main is control-plane only. The actual plugin build,
# tests, validation, packaging, and Rat Art run inside a disposable detached worktree.
if (-not $IsolatedBuild) {
    $worktreeTools = Join-Path $PSScriptRoot "rat-worktree.ps1"
    if (-not (Test-Path $worktreeTools)) { throw "Rat worktree helper missing: $worktreeTools" }
    . $worktreeTools

    $canonicalRoot = $RepoRoot
    $worktree = New-RatDisposableWorktree -RepoRoot $canonicalRoot -Label "ship-plugin-$PluginSlug"
    try {
        $helper = Join-Path $worktree "tools\local\rat-ship-plugin.ps1"
        if (-not (Test-Path $helper)) { throw "Isolated Stream Deck ship helper missing: $helper" }
        & $helper -PluginSlug $PluginSlug -Destination $Destination -IsolatedBuild
        if ($LASTEXITCODE -ne 0) {
            throw "Isolated Stream Deck Rat Ship failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Remove-RatDisposableWorktree -RepoRoot $canonicalRoot -WorktreeRoot $worktree
        Assert-RatCanonicalClean -RepoRoot $canonicalRoot -Context "Stream Deck Rat Ship"
    }
    return
}

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required for local Stream Deck Rat Ship. $Hint"
    }
}

function Invoke-Step {
    param([string]$Label, [scriptblock]$Command)
    Write-Host "Local Rat Ship plugin: $Label..." -ForegroundColor DarkGray
    & $Command | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Local Rat Ship plugin failed during '$Label' with exit code $LASTEXITCODE."
    }
}

function Invoke-RatArtUtf8Safe {
    param(
        [string]$ArtScript,
        [string]$ArtDestination,
        [string]$SourceDirectory
    )

    $runtimeArtScript = Join-Path $SourceDirectory ".rat-art-runtime.ps1"
    $utf8Bom = New-Object System.Text.UTF8Encoding($true)
    $artText = [System.IO.File]::ReadAllText($ArtScript, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($runtimeArtScript, $artText, $utf8Bom)

    try {
        & $runtimeArtScript -Destination $ArtDestination
        if ($LASTEXITCODE -ne 0) {
            throw "Product Rat Art failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        if (Test-Path $runtimeArtScript) {
            Remove-Item $runtimeArtScript -Force
        }
    }
}

function Resolve-ProductPath {
    param([string]$RelativePath)
    if ([string]::IsNullOrWhiteSpace($RelativePath)) { return $null }
    $normalized = $RelativePath -replace '/', '\'
    return Join-Path $RepoRoot $normalized
}

function Resolve-PluginDirectory {
    param(
        [object]$Product,
        [string]$SourceDir
    )

    # Multi-flavor products build deterministic bundles under out/. Select the exact
    # shipping flavor after the build so Rat Ship never guesses between Pro and Lite.
    if ($null -ne $Product.ship_plugin_dir -and ([string]$Product.ship_plugin_dir).Trim()) {
        $relative = ([string]$Product.ship_plugin_dir).Trim() -replace '/', '\'
        $candidate = Join-Path $SourceDir $relative
        if (-not (Test-Path $candidate -PathType Container)) {
            throw "Configured ship_plugin_dir for '$PluginSlug' does not exist after build: $candidate"
        }
        if ([System.IO.Path]::GetFileName($candidate) -notlike '*.sdPlugin') {
            throw "Configured ship_plugin_dir for '$PluginSlug' must resolve to a *.sdPlugin directory: $candidate"
        }
        return (Resolve-Path $candidate).Path
    }

    # Generic products may declare a stable plugin_dir. Resolve it after build as well,
    # which supports both checked-in bundles and generated output directories.
    if ($null -ne $Product.plugin_dir -and ([string]$Product.plugin_dir).Trim()) {
        $relative = ([string]$Product.plugin_dir).Trim() -replace '/', '\'
        $candidate = Join-Path $SourceDir $relative
        if (-not (Test-Path $candidate -PathType Container)) {
            throw "Declared plugin_dir does not exist after build: $candidate"
        }
        if ([System.IO.Path]::GetFileName($candidate) -notlike '*.sdPlugin') {
            throw "Declared plugin_dir must resolve to a *.sdPlugin directory: $candidate"
        }
        return (Resolve-Path $candidate).Path
    }

    $manifestDirs = @(Get-ChildItem -Path $SourceDir -Directory -Filter *.sdPlugin)
    if ($manifestDirs.Count -ne 1) {
        throw "Expected exactly one top-level *.sdPlugin directory under $SourceDir; found $($manifestDirs.Count). Multi-flavor products must declare ship_plugin_dir in products/$PluginSlug.json."
    }
    return $manifestDirs[0].FullName
}

function Copy-SubmissionFiles {
    param(
        [object]$Submission,
        [string]$SubmissionPath,
        [string]$Target
    )

    Copy-Item $SubmissionPath (Join-Path $Target "submission.json") -Force
    Set-Content -Path (Join-Path $Target "PASTE_description.txt") -Value ([string]$Submission.description).Trim() -Encoding UTF8
    Set-Content -Path (Join-Path $Target "PASTE_release_notes.txt") -Value ([string]$Submission.release_notes).Trim() -Encoding UTF8
}

function Copy-ValidatedArtifactMedia {
    param(
        [object]$Artifact,
        [string]$ArtifactRoot,
        [string]$Target
    )

    if ($null -eq $Artifact.media) {
        throw "Validated external artifact metadata is missing the media mapping."
    }

    $mapping = @(
        [PSCustomObject]@{ Source = [string]$Artifact.media.search_icon; Target = "01_search_icon.png" },
        [PSCustomObject]@{ Source = [string]$Artifact.media.cover; Target = "02_cover.png" }
    )

    $gallery = @($Artifact.media.gallery)
    if ($gallery.Count -ne 4) {
        throw "Validated external artifact must declare exactly four Marketplace gallery images; found $($gallery.Count)."
    }
    for ($i = 0; $i -lt 4; $i++) {
        $mapping += [PSCustomObject]@{
            Source = [string]$gallery[$i]
            Target = ("{0:D2}_gallery_{1:D2}.png" -f ($i + 3), ($i + 1))
        }
    }

    foreach ($item in $mapping) {
        if ([string]::IsNullOrWhiteSpace($item.Source)) {
            throw "Validated external artifact media mapping contains an empty source for $($item.Target)."
        }
        $source = Join-Path $ArtifactRoot ($item.Source -replace '/', '\')
        if (-not (Test-Path $source -PathType Leaf)) {
            throw "Validated external artifact is missing Marketplace media '$($item.Source)'."
        }
        Copy-Item $source (Join-Path $Target $item.Target) -Force
    }
}

function Build-FromValidatedExternalArtifact {
    param(
        [object]$Product,
        [object]$Submission,
        [string]$SubmissionPath,
        [string]$Target
    )

    $artifact = $Product.release_artifact
    if ($null -eq $artifact) { throw "External artifact configuration missing." }

    foreach ($field in @("repository", "run_id", "name", "commit", "package_path", "package_sha256")) {
        if ($null -eq $artifact.$field -or [string]::IsNullOrWhiteSpace([string]$artifact.$field)) {
            throw "Validated external artifact metadata is missing '$field'."
        }
    }

    Require-Command "git" "Install Git for Windows."
    Require-Command "gh" "Install GitHub CLI and authenticate it once with 'gh auth login'."

    if ($Product.source_repository -and $Product.source_ref) {
        Write-Host "Local Rat Ship plugin: verify external source ref..." -ForegroundColor DarkGray
        $remoteLines = @(& git ls-remote ([string]$Product.source_repository) ([string]$Product.source_ref) 2>$null)
        if ($LASTEXITCODE -ne 0 -or -not $remoteLines.Count) {
            throw "Could not resolve external source ref '$($Product.source_ref)' from '$($Product.source_repository)'."
        }
        $remoteCommit = (($remoteLines | Select-Object -First 1) -split '\s+')[0].Trim()
        if ($remoteCommit -ne [string]$artifact.commit) {
            throw "External source ref moved after validation. Expected $($artifact.commit), current ref resolves to $remoteCommit. Refuse to ship an unvalidated commit."
        }
    }

    if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $Target | Out-Null

    $artifactRoot = Join-Path $RepoRoot ("out\ship-artifacts\{0}-{1}" -f $PluginSlug, $PID)
    if (Test-Path $artifactRoot) { Remove-Item $artifactRoot -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

    try {
        Write-Host "Local Rat Ship plugin: download exact validated GitHub Actions artifact..." -ForegroundColor DarkGray
        & gh run download ([string]$artifact.run_id) --repo ([string]$artifact.repository) --name ([string]$artifact.name) --dir $artifactRoot | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "Could not download validated artifact '$($artifact.name)' from run $($artifact.run_id)."
        }

        $packageSource = Join-Path $artifactRoot (([string]$artifact.package_path) -replace '/', '\')
        if (-not (Test-Path $packageSource -PathType Leaf)) {
            throw "Validated artifact is missing package '$($artifact.package_path)'."
        }

        $actualHash = (Get-FileHash -Algorithm SHA256 -Path $packageSource).Hash.ToLowerInvariant()
        $expectedHash = ([string]$artifact.package_sha256).ToLowerInvariant()
        if ($actualHash -ne $expectedHash) {
            throw "Validated package SHA256 mismatch. Expected $expectedHash, got $actualHash."
        }

        Copy-Item $packageSource (Join-Path $Target "$PluginSlug.streamDeckPlugin") -Force
        Copy-SubmissionFiles -Submission $Submission -SubmissionPath $SubmissionPath -Target $Target
        Copy-ValidatedArtifactMedia -Artifact $artifact -ArtifactRoot $artifactRoot -Target $Target

        $requiredMedia = @("01_search_icon.png", "02_cover.png", "03_gallery_01.png", "04_gallery_02.png", "05_gallery_03.png", "06_gallery_04.png")
        $missingMedia = @($requiredMedia | Where-Object { -not (Test-Path (Join-Path $Target $_) -PathType Leaf) })
        if ($missingMedia.Count) {
            throw "Validated artifact kit media is incomplete: $($missingMedia -join ', ')"
        }

        Write-Host "Validated external release artifact verified." -ForegroundColor Green
        Write-Host "  repository: $($artifact.repository)" -ForegroundColor DarkGray
        Write-Host "  commit:     $($artifact.commit)" -ForegroundColor DarkGray
        Write-Host "  run:        $($artifact.run_id)" -ForegroundColor DarkGray
        Write-Host "  package:    $expectedHash" -ForegroundColor DarkGray
    }
    finally {
        if (Test-Path $artifactRoot) {
            Remove-Item $artifactRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Host "Stream Deck plugin ship kit ready at:`n$Target" -ForegroundColor Green
}

if ($PluginSlug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
    throw "Invalid Stream Deck plugin slug: $PluginSlug"
}

$productPath = Join-Path $RepoRoot "products\$PluginSlug.json"
if (-not (Test-Path $productPath)) {
    throw "Canonical product registry entry not found in isolated candidate: $productPath"
}
$product = Get-Content $productPath -Raw | ConvertFrom-Json
if ($product.type -ne "plugin") {
    throw "Product '$PluginSlug' is '$($product.type)', not a Stream Deck plugin."
}

$submissionPath = $null
if ($product.submission_metadata) {
    $submissionPath = Resolve-ProductPath ([string]$product.submission_metadata)
}
elseif ($product.source) {
    $sourceForSubmission = Resolve-ProductPath ([string]$product.source)
    $submissionPath = Join-Path $sourceForSubmission "submission.json"
}
if (-not $submissionPath -or -not (Test-Path $submissionPath -PathType Leaf)) {
    throw "Stream Deck Rat Ship cannot find submission metadata for '$PluginSlug'."
}
$submission = Get-Content $submissionPath -Raw | ConvertFrom-Json
if ($submission.type -ne "plugin" -or $submission.slug -ne $PluginSlug) {
    throw "submission.json does not match Stream Deck plugin '$PluginSlug'."
}
if ($null -ne $product.price_usd -and $null -ne $submission.price_usd -and [decimal]$submission.price_usd -ne [decimal]$product.price_usd) {
    throw "submission.json price_usd ($($submission.price_usd)) does not match products/$PluginSlug.json ($($product.price_usd))."
}
if ($product.version -and $submission.version -and ([string]$submission.version) -ne ([string]$product.version)) {
    throw "submission.json version ($($submission.version)) does not match products/$PluginSlug.json ($($product.version))."
}

# Some external plugins are released from an exact already-validated GitHub Actions
# artifact rather than copied into RatPack. This preserves repository isolation and
# guarantees Maker Console receives the same package/media that passed the release gate.
if ($null -ne $product.release_artifact) {
    Build-FromValidatedExternalArtifact -Product $product -Submission $submission -SubmissionPath $submissionPath -Target $Destination
    return
}

if (-not $product.source) {
    throw "Product '$PluginSlug' does not declare a canonical source path."
}
$sourceRelative = ([string]$product.source -replace '/', '\')
$sourceDir = Join-Path $RepoRoot $sourceRelative
$packageJson = Join-Path $sourceDir "package.json"
$packageLock = Join-Path $sourceDir "package-lock.json"
if (-not (Test-Path $sourceDir) -or -not (Test-Path $packageJson)) {
    throw "Stream Deck Rat Ship cannot find source and package.json for '$PluginSlug' in the isolated candidate."
}

Require-Command "node" "Install Node.js 24 or newer."
Require-Command "npm" "Install Node.js 24 or newer."
Require-Command "npx" "Install Node.js 24 or newer."

if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$packageOut = Join-Path $Destination "package"
New-Item -ItemType Directory -Force -Path $packageOut | Out-Null

Push-Location $sourceDir
try {
    if (Test-Path $packageLock) {
        Invoke-Step "install locked dependencies" { & npm ci --no-fund --no-audit }
    }
    else {
        Invoke-Step "install dependencies" { & npm install --no-fund --no-audit }
    }
    Invoke-Step "build plugin and bundled assets" { & npm run build }
    Invoke-Step "run plugin tests" { & npm test }

    $pluginDir = Resolve-PluginDirectory -Product $product -SourceDir $sourceDir
    Write-Host "Local Rat Ship plugin: selected bundle $pluginDir" -ForegroundColor DarkGray
    Invoke-Step "official Elgato validation" { & npx streamdeck validate $pluginDir --no-update-check }
    Invoke-Step "official Elgato package" { & npx streamdeck pack $pluginDir --output $packageOut --force --no-update-check --no-file-list }
}
finally {
    Pop-Location
}

$pluginPackages = @(Get-ChildItem -Path $packageOut -File -Filter *.streamDeckPlugin)
if ($pluginPackages.Count -ne 1) {
    throw "Official Elgato package command completed but expected exactly one .streamDeckPlugin file; found $($pluginPackages.Count)."
}
$canonicalPackage = Join-Path $Destination "$PluginSlug.streamDeckPlugin"
Copy-Item $pluginPackages[0].FullName $canonicalPackage -Force
Remove-Item $packageOut -Recurse -Force

Copy-SubmissionFiles -Submission $submission -SubmissionPath $submissionPath -Target $Destination

$artScript = Join-Path $sourceDir "rat-art.ps1"
if (Test-Path $artScript) {
    Invoke-RatArtUtf8Safe -ArtScript $artScript -ArtDestination $Destination -SourceDirectory $sourceDir
}
else {
    Write-Host "Local Rat Ship plugin: no product rat-art.ps1 yet; package kit created without Marketplace media." -ForegroundColor Yellow
}

$requiredMedia = @("01_search_icon.png", "02_cover.png", "03_gallery_01.png", "04_gallery_02.png", "05_gallery_03.png", "06_gallery_04.png")
$missingMedia = @($requiredMedia | Where-Object { -not (Test-Path (Join-Path $Destination $_)) })
if ($missingMedia.Count) {
    Write-Host "Plugin kit package is valid, but Marketplace media is incomplete: $($missingMedia -join ', ')" -ForegroundColor Yellow
}
else {
    Write-Host "Plugin kit media preflight passed." -ForegroundColor Green
}

if ($null -eq $submission.price_usd) {
    Write-Host "Plugin kit is ready, but Maker Console staging/submission is intentionally blocked until submission.price_usd is explicitly set." -ForegroundColor Yellow
}

Write-Host "Stream Deck plugin ship kit ready at:`n$Destination" -ForegroundColor Green

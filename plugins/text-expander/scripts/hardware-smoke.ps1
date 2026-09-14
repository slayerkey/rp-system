param(
    [ValidateSet("lite", "pro", "both")]
    [string]$Edition = "both",
    [switch]$OpenChecklist
)

$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginRoot = (Resolve-Path (Join-Path $Here "..")).Path
$RepoRoot = (Resolve-Path (Join-Path $PluginRoot "..\..")).Path
$ReportDir = Join-Path $RepoRoot "out\host-smoke\text-expander"
$ReportPath = Join-Path $ReportDir "HOST_SMOKE_PREP_LATEST.txt"

function Require-Command {
    param([string]$Name, [string]$Message)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw $Message
    }
}

function Invoke-Checked {
    param(
        [scriptblock]$Script,
        [string]$Failure
    )
    & $Script
    if ($LASTEXITCODE -ne 0) {
        throw "$Failure (exit $LASTEXITCODE)"
    }
}

function Invoke-StreamDeckCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    if (Get-Command streamdeck -ErrorAction SilentlyContinue) {
        & streamdeck @Arguments
    }
    else {
        & npx --yes @elgato/cli@1.9.0 @Arguments
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Stream Deck CLI failed: $($Arguments -join ' ')"
    }
}

function Invoke-StreamDeckCliBestEffort {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    try {
        if (Get-Command streamdeck -ErrorAction SilentlyContinue) {
            & streamdeck @Arguments *> $null
        }
        else {
            & npx --yes @elgato/cli@1.9.0 @Arguments *> $null
        }
    }
    catch { }
}

function Get-DirectoryContentDigest {
    param([string]$Path)

    $records = foreach ($file in Get-ChildItem -Path $Path -File -Recurse -Force | Sort-Object FullName) {
        $relative = $file.FullName.Substring($Path.Length).TrimStart("\\", "/").Replace("\\", "/")
        $hash = (Get-FileHash -Algorithm SHA256 -Path $file.FullName).Hash.ToLowerInvariant()
        "$relative$([char]9)$hash"
    }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($records -join [char]10))
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Get-OfficialPackagedContentDigest {
    param([string]$Path)

    # Hash the exact file set produced by the official Elgato packer rather
    # than approximating package exclusions from the build directory. ZIP
    # timestamps may vary between pack operations, but extracted file bytes
    # and relative paths are the stable shipping identity we care about.
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("packrat-text-expander-pack-" + [guid]::NewGuid().ToString("N"))
    $packRoot = Join-Path $tempRoot "package"
    $unpackRoot = Join-Path $tempRoot "unpacked"
    New-Item -ItemType Directory -Force -Path $packRoot,$unpackRoot | Out-Null

    try {
        Invoke-StreamDeckCli pack $Path --output $packRoot --force --no-update-check --no-file-list
        $package = Get-ChildItem -Path $packRoot -Filter "*.streamDeckPlugin" -File | Select-Object -First 1
        if (-not $package) {
            throw "Official Stream Deck pack did not produce a .streamDeckPlugin for $Path."
        }

        # Expand-Archive keys off extension, so copy the ZIP-compatible package
        # to a temporary .zip name before extracting it.
        $zipPath = Join-Path $tempRoot "candidate.zip"
        Copy-Item $package.FullName $zipPath -Force
        Expand-Archive -Path $zipPath -DestinationPath $unpackRoot -Force

        $pluginRoots = @(Get-ChildItem -Path $unpackRoot -Directory | Where-Object { $_.Name.EndsWith(".sdPlugin", [System.StringComparison]::OrdinalIgnoreCase) })
        if ($pluginRoots.Count -ne 1) {
            throw "Expected exactly one .sdPlugin root in the official package, found $($pluginRoots.Count)."
        }

        return Get-DirectoryContentDigest $pluginRoots[0].FullName
    }
    finally {
        Remove-Item $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if ($env:OS -ne "Windows_NT") {
    throw "Text Expander hardware smoke must run on Windows."
}

Require-Command "node" "Install Node.js 24 or newer."
Require-Command "npm" "Install Node.js 24 or newer."
Require-Command "npx" "Install Node.js 24 or newer."
Require-Command "git" "Install Git for Windows."

$dirty = @(& git -C $RepoRoot status --porcelain 2>$null)
if ($LASTEXITCODE -ne 0) {
    throw "Could not read Git working-tree state."
}
if ($dirty.Count) {
    throw "Refusing hardware QA from a dirty working tree. Commit/stash/revert local changes first so the tested source is reproducible."
}

$streamDeckProcess = Get-Process -Name StreamDeck -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $streamDeckProcess) {
    $candidate = Join-Path $env:ProgramFiles "Elgato\StreamDeck\StreamDeck.exe"
    if (Test-Path $candidate) {
        Start-Process $candidate
        Start-Sleep -Seconds 3
        $streamDeckProcess = Get-Process -Name StreamDeck -ErrorAction SilentlyContinue | Select-Object -First 1
    }
}
if (-not $streamDeckProcess) {
    throw "Stream Deck software is not running. Start Stream Deck and rerun this script."
}

$targets = @()
if ($Edition -in @("lite", "both")) {
    $targets += [PSCustomObject]@{
        Name = "Text Expander Lite"
        Uuid = "com.packrat.textexpanderlite"
        Dir = Join-Path $PluginRoot "dist\com.packrat.textexpanderlite.sdPlugin"
        ProductMetadata = Join-Path $RepoRoot "products\text-expander.json"
        ExpectedDigestField = "lite_unpacked_content_sha256"
    }
}
if ($Edition -in @("pro", "both")) {
    $targets += [PSCustomObject]@{
        Name = "Text Expander Pro"
        Uuid = "com.packrat.textexpanderpro"
        Dir = Join-Path $PluginRoot "dist\com.packrat.textexpanderpro.sdPlugin"
        ProductMetadata = Join-Path $RepoRoot "products\text-expander-pro.json"
        ExpectedDigestField = "pro_unpacked_content_sha256"
    }
}

Push-Location $PluginRoot
try {
    Write-Host "Installing locked Text Expander dependencies..." -ForegroundColor Cyan
    Invoke-Checked { npm ci --no-fund --no-audit } "npm ci failed"

    Write-Host "Running the exact family build + automated QA..." -ForegroundColor Cyan
    Invoke-Checked { npm run qa } "Text Expander QA failed"

    Write-Host "Enabling Stream Deck developer mode..." -ForegroundColor Cyan
    Invoke-StreamDeckCli dev

    foreach ($target in $targets) {
        if (-not (Test-Path $target.Dir -PathType Container)) {
            throw "Built plugin directory is missing: $($target.Dir)"
        }

        $productMetadata = Get-Content $target.ProductMetadata -Raw | ConvertFrom-Json
        $evidence = $productMetadata.automated_release_evidence
        $digestProperty = $evidence.PSObject.Properties[$target.ExpectedDigestField]
        $expectedDigest = if ($null -ne $digestProperty) { [string]$digestProperty.Value } else { "" }
        if ([string]::IsNullOrWhiteSpace($expectedDigest)) {
            throw "Missing validated unpacked content digest for $($target.Name)."
        }
        $actualDigest = Get-OfficialPackagedContentDigest $target.Dir
        if ($actualDigest -ne $expectedDigest.ToLowerInvariant()) {
            throw "$($target.Name) content digest mismatch. Expected $expectedDigest, got $actualDigest."
        }
        $target | Add-Member -NotePropertyName VerifiedContentDigest -NotePropertyValue $actualDigest

        Write-Host "Validating $($target.Name)..." -ForegroundColor Cyan
        Invoke-StreamDeckCli validate $target.Dir --no-update-check

        Write-Host "Linking $($target.Name) into Stream Deck..." -ForegroundColor Cyan
        Invoke-StreamDeckCliBestEffort stop $target.Uuid
        Invoke-StreamDeckCliBestEffort unlink -d $target.Uuid
        Invoke-StreamDeckCli link $target.Dir
        Invoke-StreamDeckCli restart $target.Uuid
    }
}
finally {
    Pop-Location
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$windows = Get-CimInstance Win32_OperatingSystem
$commit = (& git -C $RepoRoot rev-parse HEAD 2>$null | Select-Object -First 1)
$branch = (& git -C $RepoRoot branch --show-current 2>$null | Select-Object -First 1)
$streamDeckVersion = ""
try {
    $streamDeckVersion = $streamDeckProcess.MainModule.FileVersionInfo.FileVersion
}
catch {
    $streamDeckVersion = "unknown"
}

$report = New-Object System.Collections.Generic.List[string]
$report.Add("Text Expander hardware smoke preparation")
$report.Add("Prepared: $(Get-Date -Format o)")
$report.Add("Repository commit: $commit")
$report.Add("Repository branch: $branch")
$report.Add("Windows: $($windows.Caption) $($windows.Version) build $($windows.BuildNumber)")
$report.Add("Stream Deck software: $streamDeckVersion")
$report.Add("Node: $(& node --version)")
try { $report.Add("Stream Deck CLI: $(& streamdeck --version 2>$null)") } catch { $report.Add("Stream Deck CLI: @elgato/cli@1.9.0 via npx") }
$report.Add("")

foreach ($target in $targets) {
    $manifest = Get-Content (Join-Path $target.Dir "manifest.json") -Raw | ConvertFrom-Json
    $digest = [string]$target.VerifiedContentDigest
    $report.Add("$($target.Name):")
    $report.Add("  UUID: $($target.Uuid)")
    $report.Add("  Version: $($manifest.Version)")
    $report.Add("  Linked source: $($target.Dir)")
    $report.Add("  Validated unpacked content SHA256: $digest")
    $report.Add("")
}

$report.Add("Automated preparation: PASS")
$report.Add("Physical smoke: PENDING")
$report.Add("Checklist: $(Join-Path $PluginRoot 'REAL_WINDOWS_SMOKE.md')")
$report | Set-Content -Path $ReportPath -Encoding UTF8

Write-Host ""
Write-Host "Text Expander hardware-smoke preparation passed." -ForegroundColor Green
Write-Host "Both requested editions are linked from the validated source tree." -ForegroundColor Green
Write-Host "Environment report: $ReportPath"
Write-Host "Physical checklist: $(Join-Path $PluginRoot 'REAL_WINDOWS_SMOKE.md')" -ForegroundColor Yellow
Write-Host ""
Write-Host "Do not mark READY_TO_SHIP until the physical checklist is PASS." -ForegroundColor Yellow

if ($OpenChecklist) {
    Start-Process notepad.exe (Join-Path $PluginRoot "REAL_WINDOWS_SMOKE.md")
}

param(
    [Parameter(Mandatory = $true)]
    [string]$WidgetSlug,

    [Parameter(Mandatory = $true)]
    [string]$Destination,

    [switch]$IsolatedBuild,

    [string]$DependencyToolsRoot
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not [System.IO.Path]::IsPathRooted($Destination)) {
    $Destination = Join-Path $RepoRoot $Destination
}

# Public entry point: canonical main is control-plane only. The real XENEON
# build/validate/package/art pipeline runs in a disposable detached worktree.
if (-not $IsolatedBuild) {
    $worktreeTools = Join-Path $PSScriptRoot "rat-worktree.ps1"
    if (-not (Test-Path $worktreeTools)) { throw "Rat worktree helper missing: $worktreeTools" }
    . $worktreeTools

    $canonicalRoot = $RepoRoot
    $sharedTools = Join-Path $canonicalRoot "tools"
    $worktree = New-RatDisposableWorktree -RepoRoot $canonicalRoot -Label "ship-xeneon-$WidgetSlug"
    try {
        $helper = Join-Path $worktree "tools\local\rat-ship-local.ps1"
        if (-not (Test-Path $helper)) { throw "Isolated XENEON ship helper missing: $helper" }
        & $helper -WidgetSlug $WidgetSlug -Destination $Destination -IsolatedBuild -DependencyToolsRoot $sharedTools
    }
    finally {
        Remove-RatDisposableWorktree -RepoRoot $canonicalRoot -WorktreeRoot $worktree
        Assert-RatCanonicalClean -RepoRoot $canonicalRoot -Context "XENEON Rat Ship"
    }
    return
}

$ToolsRoot = Join-Path $RepoRoot "tools"
if (-not $DependencyToolsRoot) { $DependencyToolsRoot = $ToolsRoot }
$ShipToolRoot = Join-Path $ToolsRoot "ship"
$WorkRoot = Join-Path $RepoRoot "out\ship-local\$WidgetSlug"
$PlaywrightModule = Join-Path $DependencyToolsRoot "node_modules\playwright"
$PlaywrightCmd = Join-Path $DependencyToolsRoot "node_modules\.bin\playwright.cmd"
$LocalIcueWidgetCliCmd = Join-Path $DependencyToolsRoot "node_modules\.bin\icuewidget.cmd"
$IcueWidgetCliCmd = $null

function Require-LocalCommand {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required for local Rat Ship. $Hint"
    }
}

function Invoke-LocalStep {
    param(
        [string]$Label,
        [scriptblock]$Command
    )
    Write-Host "Local Rat Ship: $Label..." -ForegroundColor DarkGray
    & $Command | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Local Rat Ship failed during '$Label' with exit code $LASTEXITCODE."
    }
}

function Resolve-IcueWidgetCli {
    if (Test-Path $LocalIcueWidgetCliCmd) {
        $script:IcueWidgetCliCmd = $LocalIcueWidgetCliCmd
        return
    }

    $systemIcue = Get-Command icuewidget -ErrorAction SilentlyContinue
    if ($systemIcue) {
        $script:IcueWidgetCliCmd = $systemIcue.Source
        return
    }

    $script:IcueWidgetCliCmd = $null
}

function Invoke-IcueWidgetCliUtf8 {
    param([string[]]$Arguments)

    $oldConsoleEncoding = [Console]::OutputEncoding
    $oldCodePage = $null
    $exitCode = 0
    try {
        if ($env:OS -eq "Windows_NT") {
            $codePageText = (& chcp.com 2>$null | Out-String)
            if ($codePageText -match '(\d+)\s*$') {
                $oldCodePage = [int]$Matches[1]
            }
            & chcp.com 65001 *> $null
        }

        [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
        & $IcueWidgetCliCmd @Arguments
        $exitCode = $LASTEXITCODE
    }
    finally {
        [Console]::OutputEncoding = $oldConsoleEncoding
        if ($oldCodePage) {
            & chcp.com $oldCodePage *> $null
        }
    }

    if ($exitCode -ne 0) {
        throw "CORSAIR iCUE widget CLI failed with exit code $exitCode."
    }
}

function Ensure-LocalDependencies {
    if ($env:RATPACK_LOCAL_SHIP_DEPS_READY -eq "1") {
        Resolve-IcueWidgetCli
        if (-not $IcueWidgetCliCmd) {
            throw "Rat Ship dependency cache said ready, but the CORSAIR iCUE widget CLI is no longer available."
        }
        Write-Host "Local Rat Ship: dependency preflight already passed for this queue." -ForegroundColor DarkGray
        return
    }

    Require-LocalCommand "python" "Install Python 3.13 or a compatible Python 3 release."
    Require-LocalCommand "node" "Install Node.js."
    Require-LocalCommand "npm" "Install Node.js."

    & python -c "import PIL,sys; sys.exit(0 if PIL.__version__ == '12.3.0' else 1)" *> $null
    if ($LASTEXITCODE -ne 0) {
        Invoke-LocalStep "install Pillow 12.3.0" { & python -m pip install --disable-pip-version-check Pillow==12.3.0 }
    }

    $packages = @()
    if (-not (Test-Path $PlaywrightModule) -or -not (Test-Path $PlaywrightCmd)) {
        $packages += "playwright@1.62.1"
    }

    if (-not (Test-Path $LocalIcueWidgetCliCmd)) {
        $packages += "icuewidget-cli@0.4.47"
    }

    if ($packages.Count) {
        Invoke-LocalStep "install missing shared Rat Ship Node tools" {
            & npm install --prefix $DependencyToolsRoot --no-save --package-lock=false --no-fund --no-audit @packages
        }
    }

    if (-not (Test-Path $PlaywrightModule) -or -not (Test-Path $PlaywrightCmd)) {
        throw "Playwright installed without its expected module/command under $DependencyToolsRoot"
    }

    Resolve-IcueWidgetCli
    if (-not $IcueWidgetCliCmd) {
        throw "CORSAIR iCUE widget CLI is unavailable after dependency setup. Expected $LocalIcueWidgetCliCmd or an installed 'icuewidget' command."
    }

    if ($IcueWidgetCliCmd -eq $LocalIcueWidgetCliCmd) {
        Write-Host "Local Rat Ship: using cached CORSAIR CLI 0.4.47 at $LocalIcueWidgetCliCmd" -ForegroundColor DarkGray
    }
    else {
        Write-Host "Local Rat Ship: using installed CORSAIR CLI at $IcueWidgetCliCmd" -ForegroundColor DarkGray
    }

    Push-Location $DependencyToolsRoot
    try {
        & node -e "import('playwright').then(({chromium})=>process.exit(require('fs').existsSync(chromium.executablePath())?0:2)).catch(()=>process.exit(3))" *> $null
        if ($LASTEXITCODE -ne 0) {
            Invoke-LocalStep "install Chromium runtime" { & $PlaywrightCmd install chromium }
        }
    }
    finally {
        Pop-Location
    }

    $env:RATPACK_LOCAL_SHIP_DEPS_READY = "1"
    Write-Host "Local Rat Ship: shared Pillow, Playwright, Chromium, and CORSAIR CLI are ready for the rest of this queue." -ForegroundColor DarkGray
}

function Connect-SharedNodeDependencies {
    if ((Resolve-Path $DependencyToolsRoot).Path -eq (Resolve-Path $ToolsRoot).Path) { return }

    $sharedNodeModules = Join-Path $DependencyToolsRoot "node_modules"
    if (-not (Test-Path $sharedNodeModules)) {
        throw "Shared Rat Ship node_modules cache is missing after dependency setup: $sharedNodeModules"
    }

    $worktreeTools = Join-Path $PSScriptRoot "rat-worktree.ps1"
    . $worktreeTools
    Add-RatSharedNodeModulesJunction -WorktreeRoot $RepoRoot -SharedNodeModules $sharedNodeModules | Out-Null
}

function Remove-GeneratedWidgetOutputs {
    $widgetsRoot = Join-Path $RepoRoot "widgets"
    $generatedIndex = Join-Path $shippingDir "index.html"
    if (Test-Path $generatedIndex) {
        $relativeIndex = "widgets/$WidgetSlug/index.html"
        $trackedIndex = (& git -C $RepoRoot ls-files -- $relativeIndex 2>$null | Select-Object -First 1)
        if (-not $trackedIndex) {
            Remove-Item $generatedIndex -Force -ErrorAction SilentlyContinue
        }
    }

    Get-ChildItem -Path $widgetsRoot -Filter *.icuewidget -File -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

function Write-LocalFailureRecovery {
    param([System.Management.Automation.ErrorRecord]$Failure)

    $logDir = Join-Path $Destination "log"
    $logZip = Join-Path $Destination "log.zip"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    $message = $Failure | Out-String
    Set-Content -Path (Join-Path $logDir "local-pipeline-error.txt") -Value $message -Encoding UTF8
    Set-Content -Path (Join-Path $logDir "local-pipeline-context.txt") -Value @(
        "slug=$WidgetSlug",
        "destination=$Destination",
        "isolated_repo=$RepoRoot",
        "time=$([DateTime]::Now.ToString('o'))",
        "icuewidget=$IcueWidgetCliCmd"
    ) -Encoding UTF8

    if (Test-Path $logZip) { Remove-Item $logZip -Force -ErrorAction SilentlyContinue }
    Compress-Archive -Path (Join-Path $logDir "*") -DestinationPath $logZip -Force
    if (Test-Path $logZip) {
        Write-Host "Opening Rat Ship local recovery ZIP for easy sharing:`n$logZip" -ForegroundColor Yellow
        Start-Process explorer.exe -ArgumentList "/select,`"$logZip`"" -ErrorAction SilentlyContinue
    }
}

if ($WidgetSlug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
    throw "Invalid XENEON widget slug: $WidgetSlug"
}

$sourceDir = Join-Path $RepoRoot "widgets\_src\$WidgetSlug"
$shippingDir = Join-Path $RepoRoot "widgets\$WidgetSlug"
$submissionSource = Join-Path $sourceDir "submission.json"
if (-not (Test-Path $sourceDir) -or -not (Test-Path $shippingDir) -or -not (Test-Path $submissionSource)) {
    throw "Local Rat Ship cannot find the isolated source/shipping files for '$WidgetSlug'."
}

try {
    Ensure-LocalDependencies
    Connect-SharedNodeDependencies
    Remove-GeneratedWidgetOutputs

    if (Test-Path $WorkRoot) { Remove-Item $WorkRoot -Recurse -Force }
    if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $WorkRoot | Out-Null
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null

    $shots = Join-Path $WorkRoot "shots"
    $review = Join-Path $WorkRoot "review"
    $packageDir = Join-Path $WorkRoot "package"
    New-Item -ItemType Directory -Force -Path $packageDir | Out-Null

    Push-Location $RepoRoot
    try {
        Invoke-LocalStep "build isolated canonical shipping widget" { & python tools/xeneon/inline.py $WidgetSlug }

        $trackedDrift = (& git -C $RepoRoot diff --name-only -- "widgets/$WidgetSlug" 2>$null)
        if ($trackedDrift) {
            throw "Canonical generated widget output is stale for '$WidgetSlug'. Commit the generated shipping output before Rat Ship; the isolated candidate detected tracked drift."
        }

        Invoke-LocalStep "official CORSAIR validation" { Invoke-IcueWidgetCliUtf8 @("validate", "widgets/$WidgetSlug") }

        $packageStarted = Get-Date
        Invoke-LocalStep "official CORSAIR package" { Invoke-IcueWidgetCliUtf8 @("package", "widgets/$WidgetSlug") }
        $pkg = Get-ChildItem -Path (Join-Path $RepoRoot "widgets") -Filter *.icuewidget -File |
            Where-Object { $_.LastWriteTime -ge $packageStarted.AddSeconds(-2) } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if (-not $pkg) {
            throw "Official CORSAIR package command completed but no fresh .icuewidget package was found."
        }
        $canonicalPackage = Join-Path $packageDir "$WidgetSlug.icuewidget"
        Copy-Item $pkg.FullName $canonicalPackage -Force

        Invoke-LocalStep "capture real widget for Rat Art" { & node tools/art/capture_xeneon.mjs $WidgetSlug $shots }

        $oldFont = $env:RATPACK_ART_FONT
        $oldFontBold = $env:RATPACK_ART_FONT_BOLD
        try {
            $env:RATPACK_ART_FONT = Join-Path $env:WINDIR "Fonts\segoeui.ttf"
            $env:RATPACK_ART_FONT_BOLD = Join-Path $env:WINDIR "Fonts\segoeuib.ttf"
            Invoke-LocalStep "render deterministic Rat Art" { & python tools/art/rat_art.py xeneon $WidgetSlug --shots $shots --out $review }
        }
        finally {
            $env:RATPACK_ART_FONT = $oldFont
            $env:RATPACK_ART_FONT_BOLD = $oldFontBold
        }

        Invoke-LocalStep "render canonical search icon" { & node tools/ship/render_svg_icon.mjs "widgets/$WidgetSlug/resources/icon.svg" (Join-Path $review "icon-288x288.png") }

        Invoke-LocalStep "build Maker Console SHIP_KIT" { & python tools/ship/make_xeneon_kit.py $WidgetSlug --package $canonicalPackage --art $review --out $Destination }

        $companionProject = Join-Path $RepoRoot "companions\$WidgetSlug\PackRat.SmartLighting.Companion.csproj"
        if (Test-Path $companionProject) {
            Require-LocalCommand "dotnet" "Install the .NET 8 SDK to package this product's Windows companion."
            $companionOut = Join-Path $WorkRoot "companion"
            New-Item -ItemType Directory -Force -Path $companionOut | Out-Null
            Invoke-LocalStep "run companion deterministic self-tests" { & dotnet run --project $companionProject -c Release -- --self-test }
            Invoke-LocalStep "publish Windows companion" {
                & dotnet publish $companionProject -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $companionOut
            }
            $companionExe = Get-ChildItem $companionOut -Filter *.exe -File | Select-Object -First 1
            if (-not $companionExe) { throw "Companion publish completed but no Windows executable was produced." }
            $companionZip = Join-Path $Destination "PackRat-Lighting-Companion-win-x64.zip"
            Compress-Archive -Path $companionExe.FullName -DestinationPath $companionZip -Force
            if (-not (Test-Path $companionZip)) { throw "Local SHIP_KIT is missing the Windows companion archive." }
        }

        Invoke-LocalStep "Playwright driver kit preflight" { & node tools/ship/maker_console.mjs $WidgetSlug "--kit=$Destination" --check-kit }

        $source = Get-Content $submissionSource -Raw | ConvertFrom-Json
        $subPath = Join-Path $Destination "submission.json"
        if (-not (Test-Path $subPath)) { throw "Local SHIP_KIT is missing submission.json" }
        $sub = Get-Content $subPath -Raw | ConvertFrom-Json
        if ($source.type -ne 'widget' -or $sub.type -ne 'widget') { throw "Local SHIP_KIT submission type must be widget" }
        if ($sub.slug -ne $WidgetSlug) { throw "Local SHIP_KIT submission slug mismatch" }
        if ($sub.name -ne $source.name) { throw "Local SHIP_KIT submission name mismatch" }
        if ([decimal]$sub.price_usd -ne [decimal]$source.price_usd) { throw "Local SHIP_KIT submission price mismatch" }
        if ($sub.version -ne $source.version) { throw "Local SHIP_KIT submission version mismatch" }

        if (-not (Test-Path (Join-Path $Destination "$WidgetSlug.icuewidget"))) {
            throw "Local SHIP_KIT is missing the official widget package"
        }
        foreach ($file in @('01_search_icon.png','02_cover.png','03_gallery_01.png','04_gallery_02.png','05_gallery_03.png','06_gallery_04.png')) {
            if (-not (Test-Path (Join-Path $Destination $file))) {
                throw "Local SHIP_KIT is missing $file"
            }
        }
    }
    finally {
        Remove-GeneratedWidgetOutputs
        Pop-Location
    }

    Write-Host "Local Rat Ship kit is ready at:`n$Destination" -ForegroundColor Green
}
catch {
    Write-LocalFailureRecovery -Failure $_
    throw
}

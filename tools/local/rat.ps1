param(
    [Parameter(Position = 0)]
    [string]$Action = "status",

    [Parameter(Position = 1)]
    [string]$Slug = "now-playing",

    [Parameter(Position = 2, ValueFromRemainingArguments = $true)]
    [string[]]$AdditionalSlugs = @()
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ShipToolRoot = Join-Path $RepoRoot "tools\ship"
$MakerProfile = Join-Path $env:LOCALAPPDATA "PackRat\maker-console-profile"
$RunnerUnavailablePrefix = "[RATSHIP_RUNNER_UNAVAILABLE]"
$script:ForceLocalShip = -not ($Action.ToLowerInvariant() -in @("ship-cloud", "kit-cloud"))

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $Hint"
    }
}

function Invoke-GitCommand {
    param([string[]]$GitArgs)
    & git @GitArgs | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-GitText {
    param([string[]]$GitArgs)
    $output = & git @GitArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed: $($output -join ' ')"
    }
    return (($output -join "`n").Trim())
}

function Invoke-GhCommand {
    param([string[]]$GhArgs)
    Push-Location $RepoRoot
    try {
        & gh @GhArgs | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "gh $($GhArgs -join ' ') failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Assert-CleanWorktree {
    $dirty = Get-GitText -GitArgs @("status", "--porcelain")
    if ($dirty) {
        throw "The RatPack checkout has local changes. Commit or stash them before syncing so nothing gets overwritten.`n$dirty"
    }
}

function Assert-GitHubAuth {
    Require-Command "gh" "Run setup-windows.ps1 once, or install GitHub CLI with: winget install --id GitHub.cli -e"
    & gh auth status *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "GitHub CLI needs a one-time login. Opening the browser login flow..." -ForegroundColor Yellow
        & gh auth login --web
        if ($LASTEXITCODE -ne 0) {
            throw "GitHub CLI login did not complete."
        }
    }
}

function Sync-CurrentBranch {
    Require-Command "git" "Install Git for Windows first."
    Push-Location $RepoRoot
    try {
        Assert-CleanWorktree
        Invoke-GitCommand -GitArgs @("fetch", "--prune", "origin")
        $branch = Get-GitText -GitArgs @("branch", "--show-current")
        if (-not $branch) {
            throw "The checkout is in detached HEAD state. Run: rat main"
        }
        & git rev-parse --abbrev-ref "${branch}@{upstream}" *> $null
        if ($LASTEXITCODE -eq 0) {
            Invoke-GitCommand -GitArgs @("pull", "--ff-only")
        }
        elseif ($branch -eq "main") {
            Invoke-GitCommand -GitArgs @("pull", "--ff-only", "origin", "main")
        }
        else {
            Write-Host "Fetched origin. Branch '$branch' has no upstream, so it was not changed." -ForegroundColor Yellow
        }
        Write-Host "RatPack is synced on $branch." -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Sync-Main {
    Require-Command "git" "Install Git for Windows first."
    Push-Location $RepoRoot
    try {
        Assert-CleanWorktree
        Invoke-GitCommand -GitArgs @("fetch", "--prune", "origin")
        Invoke-GitCommand -GitArgs @("switch", "main")
        Invoke-GitCommand -GitArgs @("pull", "--ff-only", "origin", "main")
        Write-Host "RatPack main is current." -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Show-Status {
    Require-Command "git" "Install Git for Windows first."
    Push-Location $RepoRoot
    try {
        $branch = Get-GitText -GitArgs @("branch", "--show-current")
        $commit = Get-GitText -GitArgs @("log", "-1", "--pretty=format:%h %cs %s")
        $dirty = Get-GitText -GitArgs @("status", "--porcelain")
        Write-Host "Repo:   $RepoRoot"
        Write-Host "Branch: $branch"
        Write-Host "Commit: $commit"
        if ($dirty) {
            Write-Host "State:  local changes present" -ForegroundColor Yellow
            Write-Host $dirty
        }
        else {
            Write-Host "State:  clean" -ForegroundColor Green
        }
    }
    finally {
        Pop-Location
    }
}

function Show-Help {
    Write-Host "RatPack cheat sheet" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "NORMAL" -ForegroundColor Green
    Write-Host "  rat ship <slug> [slug...]    Sync main once, build/validate/package/Rat Art locally, then fill Maker Console and submit."
    Write-Host "  rat dev <slug>               Build, validate, and activate a real local development candidate."
    Write-Host "  rat audit <slug>             Audit the exact active Rat Dev build against the real host environment."
    Write-Host "  rat audit <slug> --probe     Run the deeper product transport probe when that product supports one."
    Write-Host "  rat status                   Show the local repo branch, commit, and whether local files changed."
    Write-Host "  rat help                     Show this cheat sheet."
    Write-Host ""
    Write-Host "BATCH EXAMPLE" -ForegroundColor Green
    Write-Host "  rat ship weather-timeline-pro weather-timeline snake desk-notes"
    Write-Host "  Batch mode syncs canonical main once, then processes products sequentially on this PC."
    Write-Host "  Existing Python, Node, Playwright, Chromium, and cached CLI dependencies are reused; missing runtime pieces are installed only when needed."
    Write-Host ""
    Write-Host "OPTIONAL" -ForegroundColor DarkGray
    Write-Host "  rat ship-cloud <slug> [...]  Use the old clean GitHub Actions build, download the kit, then submit locally."
    Write-Host "  rat kit-cloud <slug> [...]   Use the clean GitHub Actions build and download the kit only."
    Write-Host "  rat kit <slug> [slug...]     Build fresh ship kits locally without opening Maker Console."
    Write-Host "  rat stage <slug> [slug...]   Build locally and fill Maker Console, but stop before final Submit."
    Write-Host "  rat submit <slug> [slug...]  Alias for local rat ship."
    Write-Host "  rat update                   Pull the latest changes for the current branch."
    Write-Host "  rat main                     Switch to main and pull the latest canonical RatPack."
    Write-Host "  rat open                     Open the RatPack repo in Explorer."
    Write-Host "  rat doctor                   Check Git, Python, Node, npm, GitHub CLI, GitHub login, and repo state."
    Write-Host ""
    Write-Host "Maker Console login persists at: $MakerProfile"
    Write-Host "Full reference: $RepoRoot\RAT-COMMANDS.md"
}

function Get-NewShipRun {
    param([string]$WidgetSlug)
    Assert-GitHubAuth
    Push-Location $RepoRoot
    try {
        $started = (Get-Date).ToUniversalTime().AddSeconds(-10)
        Write-Host "Triggering Rat Ship for '$WidgetSlug' on GitHub Actions..." -ForegroundColor Cyan
        Invoke-GhCommand -GhArgs @("workflow", "run", "rat-ship-xeneon.yml", "--ref", "main", "-f", "slug=$WidgetSlug")

        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 2
            $json = & gh run list --workflow rat-ship-xeneon.yml --branch main --event workflow_dispatch --limit 10 --json databaseId,createdAt,status,conclusion 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "Could not list GitHub Actions runs: $($json -join ' ')"
            }
            $runs = $json | ConvertFrom-Json
            $run = $runs |
                Where-Object { ([DateTime]::Parse($_.createdAt)).ToUniversalTime() -ge $started } |
                Sort-Object { [DateTime]::Parse($_.createdAt) } -Descending |
                Select-Object -First 1
            if ($run) {
                return [string]$run.databaseId
            }
        }
        throw "GitHub accepted the workflow request, but RatPack could not find the new run. Check GitHub Actions."
    }
    finally {
        Pop-Location
    }
}

function Wait-RatShipRun {
    param([string]$RunId)

    Push-Location $RepoRoot
    try {
        $lastLabel = $null
        while ($true) {
            $json = & gh run view $RunId --json status,conclusion,jobs 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "Could not read Rat Ship run ${RunId}: $($json -join ' ')"
            }

            $run = $json | ConvertFrom-Json
            if ($run.status -eq "completed") {
                if ($run.conclusion -eq "success") {
                    Write-Host "Rat Ship workflow completed successfully." -ForegroundColor Green
                    return
                }

                $stepCount = 0
                foreach ($job in @($run.jobs)) {
                    if ($null -ne $job.steps) {
                        $stepCount += @($job.steps).Count
                    }
                }
                if ($stepCount -eq 0) {
                    throw "$RunnerUnavailablePrefix GitHub Actions ended before any runner step executed for run $RunId. This is a hosted-runner/account-usage failure, not a product validation failure."
                }

                Write-Host "Rat Ship workflow failed. Showing failed logs..." -ForegroundColor Red
                & gh run view $RunId --log-failed | Out-Host
                throw "Rat Ship run $RunId finished with conclusion '$($run.conclusion)'."
            }

            $label = "Waiting for GitHub runner"
            $activeJob = $run.jobs | Where-Object { $_.status -eq "in_progress" } | Select-Object -Last 1
            if ($activeJob) {
                $activeStep = $activeJob.steps | Where-Object { $_.status -eq "in_progress" } | Select-Object -Last 1
                if ($activeStep) {
                    $label = $activeStep.name
                }
                else {
                    $label = $activeJob.name
                }
            }

            if ($label -ne $lastLabel) {
                Write-Host "Rat Ship: $label..." -ForegroundColor DarkGray
                $lastLabel = $label
            }
            Start-Sleep -Seconds 4
        }
    }
    finally {
        Pop-Location
    }
}

function Build-ShipKitLocally {
    param([string]$WidgetSlug)

    $dest = Join-Path $RepoRoot "out\ship\$WidgetSlug"
    $helper = Join-Path $PSScriptRoot "rat-ship-local.ps1"
    if (-not (Test-Path $helper)) {
        throw "Local Rat Ship helper not found: $helper"
    }

    Write-Host "Using local Rat Ship pipeline for '$WidgetSlug'." -ForegroundColor Yellow
    & $helper -WidgetSlug $WidgetSlug -Destination $dest
    return $dest
}

function Download-ShipKit {
    param([string]$WidgetSlug)

    if ($script:ForceLocalShip) {
        return Build-ShipKitLocally $WidgetSlug
    }

    try {
        Assert-GitHubAuth
        $runId = Get-NewShipRun $WidgetSlug
        Write-Host "Watching Rat Ship run $runId..." -ForegroundColor Cyan
        Wait-RatShipRun -RunId $runId

        $dest = Join-Path $RepoRoot "out\ship\$WidgetSlug"
        if (Test-Path $dest) {
            Remove-Item $dest -Recurse -Force
        }
        New-Item -ItemType Directory -Force -Path $dest | Out-Null
        Invoke-GhCommand -GhArgs @("run", "download", $runId, "--name", "rat-ship-$WidgetSlug", "--dir", $dest)

        $submission = Join-Path $dest "submission.json"
        $widgetPackage = Get-ChildItem -Path $dest -Filter *.icuewidget -File | Select-Object -First 1
        if (-not (Test-Path $submission) -or -not $widgetPackage) {
            throw "Rat Ship completed but the expected marketplace kit is incomplete in $dest"
        }

        Write-Host "Rat Ship kit is ready at:`n$dest" -ForegroundColor Green
        return $dest
    }
    catch {
        $message = $_.Exception.Message
        if ($message.StartsWith($RunnerUnavailablePrefix, [System.StringComparison]::Ordinal)) {
            $script:ForceLocalShip = $true
            Write-Host "GitHub did not execute a single workflow step. Switching this product and the remainder of the queue to local canonical Rat Ship." -ForegroundColor Yellow
            Write-Host "This avoids repeatedly creating doomed Actions runs while preserving CORSAIR validate/package, Rat Art, SHIP_KIT invariants, and Maker Console automation." -ForegroundColor DarkGray
            return Build-ShipKitLocally $WidgetSlug
        }
        throw
    }
}

function Ensure-MakerConsoleRuntime {
    Require-Command "node" "Install Node.js first."
    Require-Command "npm" "Install Node.js first."

    $playwrightModule = Join-Path $ShipToolRoot "node_modules\playwright"
    Push-Location $ShipToolRoot
    try {
        if (-not (Test-Path $playwrightModule)) {
            Write-Host "Installing the Rat Ship browser runtime once..." -ForegroundColor Cyan
            & npm install --no-fund --no-audit | Out-Host
            if ($LASTEXITCODE -ne 0) {
                throw "Could not install the Rat Ship browser runtime."
            }
        }

        & node -e "import('playwright').then(({chromium})=>process.exit(require('fs').existsSync(chromium.executablePath())?0:2)).catch(()=>process.exit(3))" *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Installing Chromium for the Rat Ship browser runtime once..." -ForegroundColor Cyan
            & npx playwright install chromium | Out-Host
            if ($LASTEXITCODE -ne 0) {
                throw "Could not install Chromium for Rat Ship."
            }
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-MakerConsoleBridge {
    param(
        [string]$WidgetSlug,
        [string]$Kit,
        [switch]$Submit,
        [switch]$Resume
    )

    Ensure-MakerConsoleRuntime
    $driver = Join-Path $ShipToolRoot "maker_console.mjs"
    if (-not (Test-Path $driver)) {
        throw "Maker Console driver not found: $driver"
    }

    $nodeArgs = @($driver, $WidgetSlug, "--kit=$Kit", "--profile=$MakerProfile")
    if ($Resume) { $nodeArgs += "--resume" }
    if ($Submit) { $nodeArgs += "--submit" }

    Push-Location $RepoRoot
    try {
        & node @nodeArgs | Out-Host
        return $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}

function Open-RecoveryLog {
    param([string]$Kit)
    $logZip = Join-Path $Kit "log.zip"
    $logDir = Join-Path $Kit "log"
    if (Test-Path $logZip) {
        Write-Host "Opening Rat Ship recovery ZIP for easy sharing:`n$logZip" -ForegroundColor Yellow
        Start-Process explorer.exe -ArgumentList "/select,`"$logZip`""
        return
    }
    if (Test-Path $logDir) {
        Write-Host "Opening Rat Ship recovery log folder:`n$logDir" -ForegroundColor Yellow
        Start-Process explorer.exe $logDir
    }
}

function Run-MakerConsole {
    param(
        [string]$WidgetSlug,
        [string]$Kit,
        [switch]$Submit
    )

    $noRetry = Join-Path $Kit "log\NO_RETRY.txt"
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $resume = $attempt -gt 1
        if ($attempt -eq 1) {
            Write-Host "Launching Maker Console for '$WidgetSlug'..." -ForegroundColor Cyan
            Write-Host "Your local Maker Console login is reused automatically. If Elgato asks you to sign in, complete it once in the opened browser and Rat Ship will continue." -ForegroundColor Yellow
        }
        else {
            Write-Host "Maker Console attempt $($attempt - 1) stopped unexpectedly. Restarting the browser and resuming the same draft..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }

        $code = Invoke-MakerConsoleBridge -WidgetSlug $WidgetSlug -Kit $Kit -Submit:$Submit -Resume:$resume
        if ($code -eq 0) {
            if ($Submit) {
                Write-Host "Rat Ship submitted '$WidgetSlug' to Maker Console." -ForegroundColor Green
            }
            else {
                Write-Host "Rat Ship staged '$WidgetSlug' in Maker Console without submitting." -ForegroundColor Green
            }
            return
        }

        if (Test-Path $noRetry) {
            $reason = (Get-Content $noRetry -Raw).Trim()
            Write-Host "Rat Ship found a draft state that is unsafe to retry automatically." -ForegroundColor Red
            if ($reason) { Write-Host $reason -ForegroundColor Yellow }
            break
        }
    }

    Open-RecoveryLog -Kit $Kit
    $logDir = Join-Path $Kit "log"
    throw "Maker Console failed. The ship kit is still safe at $Kit. Recovery screenshots, error text, state, and log.zip are in $logDir"
}

function Run-Kit {
    param([string]$WidgetSlug)
    $dest = Download-ShipKit $WidgetSlug
    Start-Process explorer.exe $dest
}

function Run-Ship {
    param([string]$WidgetSlug)
    $dest = Download-ShipKit $WidgetSlug
    Run-MakerConsole -WidgetSlug $WidgetSlug -Kit $dest -Submit
}

function Run-Stage {
    param([string]$WidgetSlug)
    $dest = Download-ShipKit $WidgetSlug
    Run-MakerConsole -WidgetSlug $WidgetSlug -Kit $dest
}

function Invoke-SlugBatch {
    param(
        [ValidateSet("ship","submit","stage","kit")]
        [string]$Mode,
        [string[]]$Slugs
    )

    $queue = @($Slugs | ForEach-Object { if ($_ -and $_.Trim()) { $_.Trim() } })
    if (-not $queue.Count) {
        throw "Rat $Mode needs at least one product slug."
    }

    Sync-Main

    Write-Host "Rat $Mode queue: $($queue -join ', ')" -ForegroundColor Cyan
    $failures = @()
    $completed = @()

    for ($i = 0; $i -lt $queue.Count; $i++) {
        $item = $queue[$i]
        Write-Host ""
        Write-Host "[$($i + 1)/$($queue.Count)] $Mode $item" -ForegroundColor Cyan
        try {
            switch ($Mode) {
                "ship"   { Run-Ship $item }
                "submit" { Run-Ship $item }
                "stage"  { Run-Stage $item }
                "kit"    { Run-Kit $item }
            }
            $completed += $item
        }
        catch {
            $failures += [PSCustomObject]@{ Slug = $item; Message = $_.Exception.Message }
            Write-Host "Rat $Mode failed for '$item'. Continuing the remaining queue." -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Write-Host "Rat $Mode queue finished." -ForegroundColor Cyan
    if ($completed.Count) {
        Write-Host "Completed: $($completed -join ', ')" -ForegroundColor Green
    }
    if ($failures.Count) {
        Write-Host "Failed:" -ForegroundColor Red
        foreach ($failure in $failures) {
            Write-Host "  $($failure.Slug): $($failure.Message)" -ForegroundColor Red
        }
        throw "Rat $Mode finished with $($failures.Count) failed product(s)."
    }
}

function Run-Doctor {
    Write-Host "RatPack local doctor" -ForegroundColor Cyan
    Write-Host "Repo: $RepoRoot"
    foreach ($cmd in @("git", "python", "node", "npm", "gh")) {
        $found = Get-Command $cmd -ErrorAction SilentlyContinue
        if ($found) {
            Write-Host ("{0,-7} OK  {1}" -f $cmd, $found.Source) -ForegroundColor Green
        }
        else {
            Write-Host ("{0,-7} MISSING" -f $cmd) -ForegroundColor Red
        }
    }
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        & gh auth status
    }
    if (Test-Path (Join-Path $RepoRoot ".git")) {
        Show-Status
    }
    else {
        Write-Host "Git checkout not found." -ForegroundColor Red
    }
    Write-Host "Maker Console profile: $MakerProfile"
    if (Test-Path $MakerProfile) {
        Write-Host "Maker Console profile exists." -ForegroundColor Green
    }
    else {
        Write-Host "Maker Console profile has not been created yet. The first rat ship run will create it." -ForegroundColor Yellow
    }
}

$RequestedSlugs = @($Slug) + @($AdditionalSlugs)

switch ($Action.ToLowerInvariant()) {
    "status" { Show-Status }
    "help" { Show-Help }
    "commands" { Show-Help }
    "update" { Sync-CurrentBranch }
    "main" { Sync-Main }
    "ship" { Invoke-SlugBatch -Mode "ship" -Slugs $RequestedSlugs }
    "ship-cloud" { Invoke-SlugBatch -Mode "ship" -Slugs $RequestedSlugs }
    "submit" { Invoke-SlugBatch -Mode "submit" -Slugs $RequestedSlugs }
    "kit" { Invoke-SlugBatch -Mode "kit" -Slugs $RequestedSlugs }
    "kit-cloud" { Invoke-SlugBatch -Mode "kit" -Slugs $RequestedSlugs }
    "stage" { Invoke-SlugBatch -Mode "stage" -Slugs $RequestedSlugs }
    "open" { Start-Process explorer.exe $RepoRoot }
    "doctor" { Run-Doctor }
    default {
        Show-Help
        exit 2
    }
}

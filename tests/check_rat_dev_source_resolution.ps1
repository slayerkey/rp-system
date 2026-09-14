$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $RepoRoot "tools\local\rat-dev-source.ps1")

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string[]]$Args
    )
    & git -C $Root @Args *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Assert-Equal {
    param($Actual, $Expected, [string]$Message)
    if ([string]$Actual -ne [string]$Expected) {
        throw "$Message Expected '$Expected', got '$Actual'."
    }
}

$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("packrat-ratdev-source-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

try {
    Invoke-Git -Root $TempRoot -Args @("init")
    Invoke-Git -Root $TempRoot -Args @("config","user.email","ratdev-test@packrat.local")
    Invoke-Git -Root $TempRoot -Args @("config","user.name","PackRat Rat Dev Test")

    Set-Content (Join-Path $TempRoot "README.md") "base"
    Invoke-Git -Root $TempRoot -Args @("add","README.md")
    Invoke-Git -Root $TempRoot -Args @("commit","-m","base")
    $base = (& git -C $TempRoot rev-parse HEAD).Trim()

    # Family branch contains both family products, but its branch name is not the Pro slug.
    New-Item -ItemType Directory -Force -Path (Join-Path $TempRoot "plugins\macro-recorder-pro") | Out-Null
    Set-Content (Join-Path $TempRoot "plugins\macro-recorder-pro\marker.txt") "family"
    New-Item -ItemType Directory -Force -Path (Join-Path $TempRoot "plugins\macro-recorder-lite") | Out-Null
    Set-Content (Join-Path $TempRoot "plugins\macro-recorder-lite\marker.txt") "family"
    Invoke-Git -Root $TempRoot -Args @("add","plugins")
    Invoke-Git -Root $TempRoot -Args @("commit","-m","family")
    $family = (& git -C $TempRoot rev-parse HEAD).Trim()
    Invoke-Git -Root $TempRoot -Args @("update-ref","refs/remotes/origin/product/macro-recorder",$family)

    $proFamily = Resolve-RatDevInternalProductSource -RepoRoot $TempRoot -Slug "macro-recorder-pro"
    Assert-Equal $proFamily.Ref "origin/product/macro-recorder" "Pro should resolve from family branch."
    Assert-Equal $proFamily.SourceRoot "plugins\macro-recorder-pro" "Pro source root mismatch."

    $liteFamily = Resolve-RatDevInternalProductSource -RepoRoot $TempRoot -Slug "macro-recorder-lite"
    Assert-Equal $liteFamily.Ref "origin/product/macro-recorder" "Lite should resolve from family branch."

    # Shared-source Lite/Pro products use canonical product metadata to select the exact
    # generated plugin directory instead of guessing among family build outputs.
    Invoke-Git -Root $TempRoot -Args @("reset","--hard",$base)
    $sharedRoot = Join-Path $TempRoot "plugins\text-expander"
    $litePluginDir = Join-Path $sharedRoot "dist\com.packrat.textexpanderlite.sdPlugin"
    $proPluginDir = Join-Path $sharedRoot "dist\com.packrat.textexpanderpro.sdPlugin"
    New-Item -ItemType Directory -Force -Path $litePluginDir | Out-Null
    New-Item -ItemType Directory -Force -Path $proPluginDir | Out-Null
    Set-Content (Join-Path $litePluginDir "marker.txt") "lite"
    Set-Content (Join-Path $proPluginDir "marker.txt") "pro"

    $productsDir = Join-Path $TempRoot "products"
    New-Item -ItemType Directory -Force -Path $productsDir | Out-Null
    [PSCustomObject]@{
        id = "text-expander"
        type = "plugin"
        source = "plugins/text-expander"
        ship_plugin_dir = "dist/com.packrat.textexpanderlite.sdPlugin"
    } | ConvertTo-Json | Set-Content (Join-Path $productsDir "text-expander.json")
    [PSCustomObject]@{
        id = "text-expander-pro"
        type = "plugin"
        source = "plugins/text-expander"
        ship_plugin_dir = "dist/com.packrat.textexpanderpro.sdPlugin"
        dev_profile = "profiles/text-expander-pro-standard.streamDeckProfile"
    } | ConvertTo-Json | Set-Content (Join-Path $productsDir "text-expander-pro.json")

    Invoke-Git -Root $TempRoot -Args @("add","plugins","products")
    Invoke-Git -Root $TempRoot -Args @("commit","-m","shared-source-family")
    $sharedFamily = (& git -C $TempRoot rev-parse HEAD).Trim()
    Invoke-Git -Root $TempRoot -Args @("update-ref","refs/remotes/origin/product/text-expander",$sharedFamily)

    $liteShared = Resolve-RatDevInternalProductSource -RepoRoot $TempRoot -Slug "text-expander"
    $proShared = Resolve-RatDevInternalProductSource -RepoRoot $TempRoot -Slug "text-expander-pro"

    Assert-Equal $liteShared.Ref "origin/product/text-expander" "Shared Lite should resolve from the family branch."
    Assert-Equal $proShared.Ref "origin/product/text-expander" "Shared Pro should resolve from the family branch."
    Assert-Equal $liteShared.SourceRoot "plugins\text-expander" "Shared Lite source root mismatch."
    Assert-Equal $proShared.SourceRoot "plugins\text-expander" "Shared Pro source root mismatch."
    Assert-Equal $liteShared.Config.plugin_dir "dist/com.packrat.textexpanderlite.sdPlugin" "Shared Lite plugin_dir mismatch."
    Assert-Equal $proShared.Config.plugin_dir "dist/com.packrat.textexpanderpro.sdPlugin" "Shared Pro plugin_dir mismatch."
    Assert-Equal $proShared.Config.open_dev_profile "profiles/text-expander-pro-standard.streamDeckProfile" "Shared Pro dev profile mismatch."

    $resolvedLiteDir = Resolve-RatDevPluginDirectory -PluginRoot $sharedRoot -Config $liteShared.Config
    $resolvedProDir = Resolve-RatDevPluginDirectory -PluginRoot $sharedRoot -Config $proShared.Config
    Assert-Equal $resolvedLiteDir ([System.IO.Path]::GetFullPath($litePluginDir)) "Shared Lite resolved the wrong build output."
    Assert-Equal $resolvedProDir ([System.IO.Path]::GetFullPath($proPluginDir)) "Shared Pro resolved the wrong build output."

    # Unregistered multi-output roots must fail closed rather than linking an arbitrary edition.
    $ambiguousPluginRoot = Join-Path $TempRoot "plugins\multi-output"
    New-Item -ItemType Directory -Force -Path (Join-Path $ambiguousPluginRoot "one.sdPlugin") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $ambiguousPluginRoot "two.sdPlugin") | Out-Null
    $ambiguousDirThrew = $false
    try {
        Resolve-RatDevPluginDirectory -PluginRoot $ambiguousPluginRoot -Config $null | Out-Null
    }
    catch {
        $ambiguousDirThrew = $true
        if ($_.Exception.Message -notmatch "multiple \.sdPlugin directories") { throw }
    }
    if (-not $ambiguousDirThrew) {
        throw "Rat Dev should refuse to guess between multiple unregistered .sdPlugin directories."
    }

    # A derived family branch is not privileged over another discovered owner.
    # Without an exact product/<slug> branch, duplicate ownership must fail closed.
    Invoke-Git -Root $TempRoot -Args @("reset","--hard",$base)
    New-Item -ItemType Directory -Force -Path (Join-Path $TempRoot "plugins\macro-recorder-pro") | Out-Null
    Set-Content (Join-Path $TempRoot "plugins\macro-recorder-pro\marker.txt") "duplicate"
    Invoke-Git -Root $TempRoot -Args @("add","plugins")
    Invoke-Git -Root $TempRoot -Args @("commit","-m","duplicate-family-owner")
    $duplicate = (& git -C $TempRoot rev-parse HEAD).Trim()
    Invoke-Git -Root $TempRoot -Args @("update-ref","refs/remotes/origin/product/other-family",$duplicate)

    $familyAmbiguous = $false
    try {
        Resolve-RatDevInternalProductSource -RepoRoot $TempRoot -Slug "macro-recorder-pro" | Out-Null
    }
    catch {
        $familyAmbiguous = $true
        if ($_.Exception.Message -notmatch "multiple product branches") {
            throw
        }
    }
    if (-not $familyAmbiguous) {
        throw "Family branch resolution should fail closed when another branch owns the same slug."
    }

    # Exact product/<slug> takes precedence over every discovered family branch.
    Invoke-Git -Root $TempRoot -Args @("reset","--hard",$base)
    New-Item -ItemType Directory -Force -Path (Join-Path $TempRoot "plugins\macro-recorder-pro") | Out-Null
    Set-Content (Join-Path $TempRoot "plugins\macro-recorder-pro\marker.txt") "exact"
    Invoke-Git -Root $TempRoot -Args @("add","plugins")
    Invoke-Git -Root $TempRoot -Args @("commit","-m","exact")
    $exact = (& git -C $TempRoot rev-parse HEAD).Trim()
    Invoke-Git -Root $TempRoot -Args @("update-ref","refs/remotes/origin/product/macro-recorder-pro",$exact)

    $proExact = Resolve-RatDevInternalProductSource -RepoRoot $TempRoot -Slug "macro-recorder-pro"
    Assert-Equal $proExact.Ref "origin/product/macro-recorder-pro" "Exact product branch must win."

    # A slug found on multiple unrelated product branches must fail instead of guessing.
    Invoke-Git -Root $TempRoot -Args @("reset","--hard",$base)
    New-Item -ItemType Directory -Force -Path (Join-Path $TempRoot "plugins\ambiguous-tool") | Out-Null
    Set-Content (Join-Path $TempRoot "plugins\ambiguous-tool\marker.txt") "a"
    Invoke-Git -Root $TempRoot -Args @("add","plugins")
    Invoke-Git -Root $TempRoot -Args @("commit","-m","ambiguous-a")
    $a = (& git -C $TempRoot rev-parse HEAD).Trim()
    Invoke-Git -Root $TempRoot -Args @("update-ref","refs/remotes/origin/product/family-a",$a)

    Invoke-Git -Root $TempRoot -Args @("reset","--hard",$base)
    New-Item -ItemType Directory -Force -Path (Join-Path $TempRoot "plugins\ambiguous-tool") | Out-Null
    Set-Content (Join-Path $TempRoot "plugins\ambiguous-tool\marker.txt") "b"
    Invoke-Git -Root $TempRoot -Args @("add","plugins")
    Invoke-Git -Root $TempRoot -Args @("commit","-m","ambiguous-b")
    $b = (& git -C $TempRoot rev-parse HEAD).Trim()
    Invoke-Git -Root $TempRoot -Args @("update-ref","refs/remotes/origin/product/family-b",$b)

    $threw = $false
    try {
        Resolve-RatDevInternalProductSource -RepoRoot $TempRoot -Slug "ambiguous-tool" | Out-Null
    }
    catch {
        $threw = $true
        if ($_.Exception.Message -notmatch "multiple product branches") {
            throw
        }
    }
    if (-not $threw) {
        throw "Ambiguous product branch resolution should fail closed."
    }

    # Missing main registration is a normal null probe, not a terminating native stderr error.
    $missing = Read-RatDevJsonFromGitObject -RepoRoot $TempRoot -Object "HEAD:plugins/does-not-exist/rat-dev.json"
    if ($null -ne $missing) {
        throw "Missing Rat Dev JSON object should return null."
    }

    Write-Host "PASS: Rat Dev family product branch resolution" -ForegroundColor Green
}
finally {
    Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

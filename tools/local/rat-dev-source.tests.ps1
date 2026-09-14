$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "rat-dev-source.ps1")

$root = Join-Path ([System.IO.Path]::GetTempPath()) ("rat-dev-source-" + [guid]::NewGuid().ToString("N"))

function Invoke-TestGit {
    param([string[]]$Arguments)
    & git -C $root @Arguments | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

try {
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    Invoke-TestGit @("init")
    Invoke-TestGit @("config", "user.email", "rat-dev-ci@example.invalid")
    Invoke-TestGit @("config", "user.name", "Rat Dev CI")

    New-Item -ItemType Directory -Force -Path (Join-Path $root "products") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $root "plugins\demo\profiles") | Out-Null

    @'
{
  "id": "demo",
  "type": "plugin",
  "source": "plugins/demo"
}
'@ | Set-Content -Path (Join-Path $root "products\demo.json") -Encoding UTF8

    @'
{
  "type": "streamdeck-plugin",
  "plugin_dir": "com.example.demo.sdPlugin",
  "plugin_uuid": "com.example.demo",
  "open_profile_on_dev": true,
  "dev_profile": "profiles/demo.streamDeckProfile",
  "open_dev_folder": false
}
'@ | Set-Content -Path (Join-Path $root "plugins\demo\rat-dev.json") -Encoding UTF8

    Set-Content -Path (Join-Path $root "plugins\demo\placeholder.txt") -Value "base" -Encoding UTF8
    Invoke-TestGit @("add", ".")
    Invoke-TestGit @("commit", "-m", "base product")
    $base = (& git -C $root rev-parse HEAD).Trim()

    Invoke-TestGit @("update-ref", "refs/remotes/origin/product/demo", $base)

    Set-Content -Path (Join-Path $root "main-newer.txt") -Value "newer canonical main" -Encoding UTF8
    Invoke-TestGit @("add", ".")
    Invoke-TestGit @("commit", "-m", "newer main")
    $main = (& git -C $root rev-parse HEAD).Trim()
    Invoke-TestGit @("update-ref", "refs/remotes/origin/main", $main)

    $resolved = Resolve-RatDevInternalProductSource -RepoRoot $root -Slug "demo"
    if ($resolved.Ref -ne "origin/main") {
        throw "Expected stale merged product branch to yield to origin/main; got '$($resolved.Ref)'."
    }
    if (-not [bool]$resolved.Config.open_profile_on_dev) {
        throw "Expected rat-dev.json open_profile_on_dev to merge into product metadata resolution."
    }
    if ([string]$resolved.Config.dev_profile -ne "profiles/demo.streamDeckProfile") {
        throw "Expected rat-dev.json dev_profile to survive metadata resolution."
    }

    Invoke-TestGit @("checkout", "--detach", $base)
    Set-Content -Path (Join-Path $root "plugins\demo\product-newer.txt") -Value "unmerged product work" -Encoding UTF8
    Invoke-TestGit @("add", ".")
    Invoke-TestGit @("commit", "-m", "unmerged product work")
    $product = (& git -C $root rev-parse HEAD).Trim()
    Invoke-TestGit @("update-ref", "refs/remotes/origin/product/demo", $product)

    $resolvedProduct = Resolve-RatDevInternalProductSource -RepoRoot $root -Slug "demo"
    if ($resolvedProduct.Ref -ne "origin/product/demo") {
        throw "Expected unmerged product work to remain authoritative; got '$($resolvedProduct.Ref)'."
    }

    Write-Host "RAT DEV SOURCE RESOLUTION PASS"
}
finally {
    if (Test-Path $root) {
        Remove-Item $root -Recurse -Force -ErrorAction SilentlyContinue
    }
}

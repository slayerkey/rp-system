$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\tools\local\rat-dev-dependencies.ps1")

$root = Join-Path ([System.IO.Path]::GetTempPath()) ("rat-dev-deps-" + [guid]::NewGuid().ToString("N"))
try {
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    $packagePath = Join-Path $root "package.json"
    $lockPath = Join-Path $root "package-lock.json"
    Set-Content -Path $packagePath -NoNewline -Encoding utf8 -Value '{"name":"fixture","version":"1.0.0"}'
    Set-Content -Path $lockPath -NoNewline -Encoding utf8 -Value '{"name":"fixture","lockfileVersion":3}'

    $missing = Get-RatDevDependencyState -PluginRoot $root
    if (-not $missing.Locked -or $missing.Current) {
        throw "A locked project without node_modules must require npm ci."
    }

    New-Item -ItemType Directory -Force -Path (Join-Path $root "node_modules") | Out-Null
    Set-RatDevDependencyState -PluginRoot $root
    $current = Get-RatDevDependencyState -PluginRoot $root
    if (-not $current.Current) {
        throw "Recorded dependency state should be current."
    }

    Set-Content -Path $packagePath -NoNewline -Encoding utf8 -Value '{"name":"fixture","version":"1.0.1"}'
    if ((Get-RatDevDependencyState -PluginRoot $root).Current) {
        throw "Changing package.json must invalidate the dependency marker."
    }

    Set-RatDevDependencyState -PluginRoot $root
    Set-Content -Path $lockPath -NoNewline -Encoding utf8 -Value '{"name":"fixture","lockfileVersion":3,"changed":true}'
    if ((Get-RatDevDependencyState -PluginRoot $root).Current) {
        throw "Changing package-lock.json must invalidate the dependency marker."
    }

    Remove-Item $lockPath -Force
    $unlocked = Get-RatDevDependencyState -PluginRoot $root
    if ($unlocked.Locked) {
        throw "Projects without package-lock.json must remain on the legacy npm install path."
    }

    $native = Join-Path $root "native"
    New-Item -ItemType Directory -Force -Path $native | Out-Null
    Set-Content -Path (Join-Path $native "Fixture.csproj") -NoNewline -Encoding utf8 -Value '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>'

    Set-Item -Path Function:Get-RatDevDotNetSdkVersions -Value { @() }
    $missingSdkThrew = $false
    try {
        Assert-RatDevBuildPrerequisites -PluginRoot $root -Slug "fixture-plugin"
    }
    catch {
        $missingSdkThrew = $true
        $message = $_.Exception.Message
        if ($message -notmatch '\.NET 8\+ SDK' -or
            $message -notmatch 'Microsoft\.DotNet\.SDK\.8' -or
            $message -notmatch 'runtime by itself is not enough' -or
            $message -notmatch 'rat dev fixture-plugin') {
            throw "Missing-SDK error did not provide the expected actionable guidance: $message"
        }
    }
    if (-not $missingSdkThrew) {
        throw "A plugin containing a .csproj must fail Rat Dev prerequisite checks when no .NET SDK is available."
    }

    $ratDevPath = Join-Path $root "rat-dev.json"
    Set-Content -Path $ratDevPath -NoNewline -Encoding utf8 -Value '{"build_prerequisites":{"dotnet_sdk":"self-managed"}}'
    Assert-RatDevBuildPrerequisites -PluginRoot $root -Slug "fixture-plugin"
    Remove-Item $ratDevPath -Force

    Set-Item -Path Function:Get-RatDevDotNetSdkVersions -Value { @("8.0.425") }
    Assert-RatDevBuildPrerequisites -PluginRoot $root -Slug "fixture-plugin"

    Set-Item -Path Function:Get-RatDevDotNetSdkVersions -Value { @("10.0.100") }
    Assert-RatDevBuildPrerequisites -PluginRoot $root -Slug "fixture-plugin"

    Write-Host "Rat Dev dependency fingerprint and build-prerequisite checks passed."
}
finally {
    Remove-Item $root -Recurse -Force -ErrorAction SilentlyContinue
}

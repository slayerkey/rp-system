$ErrorActionPreference = "Stop"

function Test-RatDevPathInsideRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Candidate
    )

    if ([string]::IsNullOrWhiteSpace($Root) -or [string]::IsNullOrWhiteSpace($Candidate)) {
        return $false
    }

    try {
        $rootFull = [System.IO.Path]::GetFullPath($Root)
        $candidateFull = [System.IO.Path]::GetFullPath($Candidate)
    }
    catch {
        return $false
    }

    $trimChars = [char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $rootFull = $rootFull.TrimEnd($trimChars)

    if ($candidateFull.Equals($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    $prefix = $rootFull + [System.IO.Path]::DirectorySeparatorChar
    return $candidateFull.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-RatDevBuildOwnedProcesses {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot
    )

    if ($env:OS -ne "Windows_NT") {
        return @()
    }
    if (-not (Test-Path $PluginRoot -PathType Container)) {
        return @()
    }

    $matches = @()
    foreach ($process in @(Get-Process -ErrorAction SilentlyContinue)) {
        $path = $null
        try {
            $path = [string]$process.Path
        }
        catch {
            continue
        }

        if ([string]::IsNullOrWhiteSpace($path)) {
            continue
        }

        if (Test-RatDevPathInsideRoot -Root $PluginRoot -Candidate $path) {
            $matches += $process
        }
    }

    return @($matches)
}

function Stop-RatDevBuildOwnedProcesses {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot,
        [int]$Attempts = 8
    )

    if ($Attempts -lt 1) {
        $Attempts = 1
    }

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        $owned = @(Get-RatDevBuildOwnedProcesses -PluginRoot $PluginRoot)
        if (-not $owned.Count) {
            return @()
        }

        foreach ($process in $owned) {
            try {
                Stop-Process -Id $process.Id -Force -ErrorAction Stop
            }
            catch {
                # Re-query below. A process may already be exiting after the plugin stops.
            }
        }

        Start-Sleep -Milliseconds (150 + (100 * $attempt))
    }

    return @(Get-RatDevBuildOwnedProcesses -PluginRoot $PluginRoot)
}

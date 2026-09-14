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

    try {
        $rootFull = [System.IO.Path]::GetFullPath($PluginRoot).TrimEnd("\", "/")
    }
    catch {
        return @()
    }

    # Stream Deck JavaScript plugins run under a system node.exe. Its executable
    # path is outside the plugin root, but its command line references the linked
    # .sdPlugin files. Capture those command lines so Rat Dev can still identify
    # and release the exact development plugin process after a partial build.
    $commandLines = @{}
    try {
        foreach ($entry in @(Get-CimInstance Win32_Process -ErrorAction Stop)) {
            if ($null -ne $entry.ProcessId -and -not [string]::IsNullOrWhiteSpace([string]$entry.CommandLine)) {
                $commandLines[[int]$entry.ProcessId] = [string]$entry.CommandLine
            }
        }
    }
    catch {
        # Native helper executable-path detection below still works if CIM is
        # unavailable. Command-line matching is a Windows recovery enhancement.
    }

    $matches = @()
    foreach ($process in @(Get-Process -ErrorAction SilentlyContinue)) {
        $owned = $false
        $path = $null
        try {
            $path = [string]$process.Path
        }
        catch { }

        if (-not [string]::IsNullOrWhiteSpace($path) -and
            (Test-RatDevPathInsideRoot -Root $PluginRoot -Candidate $path)) {
            $owned = $true
        }

        if (-not $owned -and $commandLines.ContainsKey([int]$process.Id)) {
            $commandLine = [string]$commandLines[[int]$process.Id]
            if ($commandLine.IndexOf($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $owned = $true
            }
        }

        if ($owned) {
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

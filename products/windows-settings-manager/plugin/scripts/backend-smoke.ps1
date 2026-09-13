$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $PSScriptRoot "windows-settings-backend.ps1"

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = "powershell.exe"
$psi.Arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`""
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.StandardInputEncoding = New-Object System.Text.UTF8Encoding($false)
$psi.CreateNoWindow = $true

$p = [System.Diagnostics.Process]::new()
$p.StartInfo = $psi
if (-not $p.Start()) { throw "Could not start backend." }

try {
    function Request([int]$Id, [string]$Op, $RequestArgs = @{}) {
        $payload = @{ id = $Id; op = $Op; args = $RequestArgs } | ConvertTo-Json -Depth 6 -Compress
        $p.StandardInput.WriteLine($payload)
        $p.StandardInput.Flush()
        $line = $p.StandardOutput.ReadLine()
        if ([string]::IsNullOrWhiteSpace($line)) {
            $stderr = $p.StandardError.ReadToEnd()
            throw "Backend returned no response for $Op. $stderr"
        }
        return $line | ConvertFrom-Json
    }

    $ping = Request 1 "ping"
    if (-not $ping.ok) { throw "Backend ping failed: $($ping.error)" }

    $snapshot = Request 2 "snapshot"
    if (-not $snapshot.ok -or -not $snapshot.result.backendOnline) {
        throw "Backend snapshot failed: $($snapshot.error)"
    }
    if ($snapshot.result.osBuild -lt 26100 -and $snapshot.result.hdr.api -ne "unavailable") {
        throw "Pre-24H2 Windows must not expose a legacy HDR control path."
    }
    if ($snapshot.result.osBuild -ge 26100 -and $snapshot.result.hdr.api -ne "hdr-state") {
        throw "Windows 11 24H2+ must use the separated HDR state path."
    }

    $awakeOn = Request 3 "setKeepAwake" @{ enabled = $true }
    if (-not $awakeOn.ok -or -not $awakeOn.result.state) {
        throw "Keep Awake enable failed: $($awakeOn.error)"
    }

    $awakeOff = Request 4 "setKeepAwake" @{ enabled = $false }
    if (-not $awakeOff.ok -or $awakeOff.result.state) {
        throw "Keep Awake disable failed: $($awakeOff.error)"
    }

    Write-Host "WINDOWS SETTINGS BACKEND SMOKE PASS"
    Write-Host "OS build: $($snapshot.result.osBuild)"
    Write-Host "HDR API: $($snapshot.result.hdr.api)"
    Write-Host "Topology: $($snapshot.result.topology)"
    Write-Host "Power plan: $($snapshot.result.powerPlanName)"
}
finally {
    try { $p.StandardInput.Close() } catch {}
    if (-not $p.WaitForExit(2500)) { $p.Kill() }
    $p.Dispose()
}

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Helper = Join-Path $Root "com.packrat.monitormanagerlite.sdPlugin\helper\monitor-helper.ps1"
if (-not (Test-Path $Helper)) {
    throw "Bundled monitor helper missing. Run npm run build first."
}
$request = '{"id":1,"op":"scan","params":{}}'
$result = $request | powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Helper
if ($LASTEXITCODE -ne 0) { throw "Monitor helper scan failed." }
$reply = $result | Select-Object -Last 1 | ConvertFrom-Json
if (-not $reply.ok) { throw "Monitor helper scan returned failure: $($reply.error)" }
$monitors = @($reply.result.monitors)
Write-Host "MONITOR MANAGER LITE HOST AUDIT PASS" -ForegroundColor Green
Write-Host "Active monitor records: $($monitors.Count)"
foreach ($monitor in $monitors) {
    $mode = $monitor.currentMode
    Write-Host ("- {0} | {1}x{2} @{3} Hz | DDC brightness={4} contrast={5} | HDR={6}" -f
      $monitor.description,$mode.width,$mode.height,$mode.frequency,$monitor.ddcBrightness,$monitor.ddcContrast,$monitor.hdrState)
}
if ($reply.result.internalBrightness) {
    Write-Host "Internal panel brightness path: AVAILABLE"
}

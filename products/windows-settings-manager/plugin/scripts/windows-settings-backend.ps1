$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;

public static class PackRatWindowsNative
{
    private const uint QDC_ONLY_ACTIVE_PATHS = 0x00000002;
    private const uint SDC_APPLY = 0x00000080;
    private const uint SDC_TOPOLOGY_INTERNAL = 0x00000001;
    private const uint SDC_TOPOLOGY_CLONE = 0x00000002;
    private const uint SDC_TOPOLOGY_EXTEND = 0x00000004;
    private const uint SDC_TOPOLOGY_EXTERNAL = 0x00000008;
    private const uint DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO_2 = 15;
    private const uint DISPLAYCONFIG_DEVICE_INFO_SET_HDR_STATE = 16;
    private const uint ES_SYSTEM_REQUIRED = 0x00000001;
    private const uint ES_DISPLAY_REQUIRED = 0x00000002;
    private const uint ES_CONTINUOUS = 0x80000000;

    [StructLayout(LayoutKind.Sequential)]
    public struct Luid
    {
        public uint LowPart;
        public int HighPart;
        public override string ToString() { return HighPart.ToString("X8") + ":" + LowPart.ToString("X8"); }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Rational
    {
        public uint Numerator;
        public uint Denominator;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PathSourceInfo
    {
        public Luid adapterId;
        public uint id;
        public uint modeInfoIdx;
        public uint statusFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PathTargetInfo
    {
        public Luid adapterId;
        public uint id;
        public uint modeInfoIdx;
        public uint outputTechnology;
        public uint rotation;
        public uint scaling;
        public Rational refreshRate;
        public uint scanLineOrdering;
        [MarshalAs(UnmanagedType.Bool)]
        public bool targetAvailable;
        public uint statusFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PathInfo
    {
        public PathSourceInfo sourceInfo;
        public PathTargetInfo targetInfo;
        public uint flags;
    }

    [StructLayout(LayoutKind.Explicit, Size = 64)]
    private struct ModeInfo
    {
        [FieldOffset(0)] public uint infoType;
        [FieldOffset(4)] public uint id;
        [FieldOffset(8)] public Luid adapterId;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DeviceInfoHeader
    {
        public uint type;
        public uint size;
        public Luid adapterId;
        public uint id;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct RtlOsVersionInfoEx
    {
        public uint dwOSVersionInfoSize;
        public uint dwMajorVersion;
        public uint dwMinorVersion;
        public uint dwBuildNumber;
        public uint dwPlatformId;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string szCSDVersion;
        public ushort wServicePackMajor;
        public ushort wServicePackMinor;
        public ushort wSuiteMask;
        public byte wProductType;
        public byte wReserved;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct RtlOsVersionInfoEx
    {
        public uint dwOSVersionInfoSize;
        public uint dwMajorVersion;
        public uint dwMinorVersion;
        public uint dwBuildNumber;
        public uint dwPlatformId;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string szCSDVersion;
        public ushort wServicePackMajor;
        public ushort wServicePackMinor;
        public ushort wSuiteMask;
        public byte wProductType;
        public byte wReserved;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct AdvancedColorInfo2
    {
        public DeviceInfoHeader header;
        public uint flags;
        public uint colorEncoding;
        public uint bitsPerColorChannel;
        public uint activeColorMode;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct HdrSet
    {
        public DeviceInfoHeader header;
        public uint enableHdr;
    }

    public sealed class HdrSummary
    {
        public HdrSummary()
        {
            api = "unavailable";
            errors = new string[0];
        }

        public bool available { get; set; }
        public string api { get; set; }
        public int supportedCount { get; set; }
        public int enabledCount { get; set; }
        public bool mixed { get; set; }
        public string[] errors { get; set; }
    }

    public sealed class SetResult
    {
        public SetResult()
        {
            status = "FAILED";
        }

        public string status { get; set; }
        public string error { get; set; }
        public HdrSummary state { get; set; }
    }

    [DllImport("ntdll.dll", CharSet = CharSet.Unicode)]
    private static extern int RtlGetVersion(ref RtlOsVersionInfoEx versionInfo);

    private static readonly int RuntimeWindowsBuild = ReadWindowsBuild();

    static PackRatWindowsNative()
    {
        AssertSize(typeof(DeviceInfoHeader), 20, "DISPLAYCONFIG_DEVICE_INFO_HEADER");
        AssertSize(typeof(AdvancedColorInfo2), 36, "DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2");
        AssertSize(typeof(HdrSet), 24, "DISPLAYCONFIG_SET_HDR_STATE");
    }

    private static void AssertSize(Type type, int expected, string name)
    {
        int actual = Marshal.SizeOf(type);
        if (actual != expected)
            throw new TypeLoadException(name + " layout mismatch: " + actual + " bytes; expected " + expected + ".");
    }

    private static int ReadWindowsBuild()
    {
        var info = new RtlOsVersionInfoEx();
        info.dwOSVersionInfoSize = (uint)Marshal.SizeOf(typeof(RtlOsVersionInfoEx));
        int status = RtlGetVersion(ref info);
        if (status != 0)
            throw new InvalidOperationException("RtlGetVersion failed: " + status);
        return checked((int)info.dwBuildNumber);
    }

    public static int GetWindowsBuild()
    {
        return RuntimeWindowsBuild;
    }

    private static bool SupportsSeparatedHdrApi()
    {
        return RuntimeWindowsBuild >= 26100;
    }

    [DllImport("ntdll.dll", CharSet = CharSet.Unicode)]
    private static extern int RtlGetVersion(ref RtlOsVersionInfoEx versionInfo);

    private static readonly int RuntimeWindowsBuild = ReadWindowsBuild();

    static PackRatWindowsNative()
    {
        AssertSize(typeof(DeviceInfoHeader), 20, "DISPLAYCONFIG_DEVICE_INFO_HEADER");
        AssertSize(typeof(AdvancedColorInfo), 32, "DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO");
        AssertSize(typeof(AdvancedColorSet), 24, "DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE");
        AssertSize(typeof(AdvancedColorInfo2), 36, "DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2");
        AssertSize(typeof(HdrSet), 24, "DISPLAYCONFIG_SET_HDR_STATE");
    }

    private static void AssertSize(Type type, int expected, string name)
    {
        int actual = Marshal.SizeOf(type);
        if (actual != expected)
            throw new TypeLoadException(name + " layout mismatch: " + actual + " bytes; expected " + expected + ".");
    }

    private static int ReadWindowsBuild()
    {
        var info = new RtlOsVersionInfoEx();
        info.dwOSVersionInfoSize = (uint)Marshal.SizeOf(typeof(RtlOsVersionInfoEx));
        int status = RtlGetVersion(ref info);
        if (status != 0)
            throw new InvalidOperationException("RtlGetVersion failed: " + status);
        return checked((int)info.dwBuildNumber);
    }

    public static int GetWindowsBuild()
    {
        return RuntimeWindowsBuild;
    }

    private static bool SupportsSeparatedHdrApi()
    {
        return RuntimeWindowsBuild >= 26100;
    }

    [DllImport("user32.dll")]
    private static extern int GetDisplayConfigBufferSizes(uint flags, out uint numPathArrayElements, out uint numModeInfoArrayElements);

    [DllImport("user32.dll")]
    private static extern int QueryDisplayConfig(
        uint flags,
        ref uint numPathArrayElements,
        [Out] PathInfo[] pathArray,
        ref uint numModeInfoArrayElements,
        [Out] ModeInfo[] modeInfoArray,
        IntPtr currentTopologyId);

    [DllImport("user32.dll")]
    private static extern int SetDisplayConfig(
        uint numPathArrayElements,
        IntPtr pathArray,
        uint numModeInfoArrayElements,
        IntPtr modeInfoArray,
        uint flags);

    [DllImport("user32.dll", EntryPoint = "DisplayConfigGetDeviceInfo")]
    private static extern int GetAdvancedColorInfo2(ref AdvancedColorInfo2 requestPacket);

    [DllImport("user32.dll", EntryPoint = "DisplayConfigSetDeviceInfo")]
    private static extern int SetHdrState(ref HdrSet setPacket);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint SetThreadExecutionState(uint esFlags);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool LockWorkStation();

    private static PathInfo[] ActivePaths()
    {
        uint pathCount;
        uint modeCount;
        int rc = GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out pathCount, out modeCount);
        if (rc != 0) throw new InvalidOperationException("GetDisplayConfigBufferSizes failed: " + rc);

        for (int attempt = 0; attempt < 3; attempt++)
        {
            var paths = new PathInfo[Math.Max(1, (int)pathCount)];
            var modes = new ModeInfo[Math.Max(1, (int)modeCount)];
            uint pc = pathCount;
            uint mc = modeCount;
            rc = QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, ref pc, paths, ref mc, modes, IntPtr.Zero);
            if (rc == 0) return paths.Take((int)pc).ToArray();
            if (rc != 122) throw new InvalidOperationException("QueryDisplayConfig failed: " + rc);
            rc = GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out pathCount, out modeCount);
            if (rc != 0) throw new InvalidOperationException("GetDisplayConfigBufferSizes retry failed: " + rc);
        }
        throw new InvalidOperationException("Display configuration changed too quickly to read.");
    }

    private static string SourceKey(PathInfo path)
    {
        return path.sourceInfo.adapterId.HighPart + ":" +
            path.sourceInfo.adapterId.LowPart + ":" +
            path.sourceInfo.id;
    }

    private static bool IsInternal(uint technology)
    {
        return technology == 6 || technology == 11 || technology == 13 || technology == 0x80000000;
    }

    public static string GetTopology()
    {
        var paths = ActivePaths();
        if (paths.Length == 0) return "unknown";
        if (paths.Length == 1) return IsInternal(paths[0].targetInfo.outputTechnology) ? "internal" : "external";

        var sourceKeys = new HashSet<string>(paths.Select(SourceKey));
        if (sourceKeys.Count == 1) return "clone";
        if (sourceKeys.Count == paths.Length) return "extend";

        // A mixed clone + extend graph is a valid Windows display arrangement,
        // but it is not one of the four simple projection topologies this
        // plugin can truthfully represent.
        return "unknown";
    }

    public static bool SetTopology(string topology)
    {
        if (string.Equals(GetTopology(), topology, StringComparison.OrdinalIgnoreCase))
            return true;

        uint flag;
        switch ((topology ?? "").ToLowerInvariant())
        {
            case "internal": flag = SDC_TOPOLOGY_INTERNAL; break;
            case "clone": flag = SDC_TOPOLOGY_CLONE; break;
            case "extend": flag = SDC_TOPOLOGY_EXTEND; break;
            case "external": flag = SDC_TOPOLOGY_EXTERNAL; break;
            default: throw new ArgumentException("Unsupported display topology.");
        }

        int rc = SetDisplayConfig(0, IntPtr.Zero, 0, IntPtr.Zero, SDC_APPLY | flag);
        if (rc != 0) return false;

        for (int attempt = 0; attempt < 12; attempt++)
        {
            Thread.Sleep(attempt == 0 ? 250 : 150);
            try
            {
                if (string.Equals(GetTopology(), topology, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            catch
            {
                // Display paths can be temporarily unavailable while Windows
                // rebuilds the active topology. Keep polling within this bound.
            }
        }
        return false;
    }

    private static bool TryReadNewHdr(PathTargetInfo target, out bool supported, out bool enabled, out string error)
    {
        var info = new AdvancedColorInfo2();
        info.header.type = DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO_2;
        info.header.size = (uint)Marshal.SizeOf(typeof(AdvancedColorInfo2));
        info.header.adapterId = target.adapterId;
        info.header.id = target.id;
        int rc = GetAdvancedColorInfo2(ref info);
        if (rc != 0)
        {
            supported = false;
            enabled = false;
            error = "GET_ADVANCED_COLOR_INFO_2 failed: " + rc;
            return false;
        }
        bool limitedByPolicy = (info.flags & (1u << 3)) != 0;
        bool hdrSupported = (info.flags & (1u << 4)) != 0;
        // activeColorMode is the truthful current output mode. The separate
        // highDynamicRangeUserEnabled bit can remain set even when HDR is not
        // actually active, so it must not be rendered as live HDR state.
        enabled = info.activeColorMode == 2;
        supported = enabled || (hdrSupported && !limitedByPolicy);
        error = null;
        return true;
    }

    public static HdrSummary GetHdr()
    {
        if (!SupportsSeparatedHdrApi())
        {
            return new HdrSummary {
                available = false,
                api = "unavailable",
                supportedCount = 0,
                enabledCount = 0,
                mixed = false,
                errors = new[] { "Reliable HDR control requires Windows 11 24H2 (build 26100) or later." }
            };
        }

        var errors = new List<string>();
        int supportedCount = 0;
        int enabledCount = 0;

        foreach (var path in ActivePaths())
        {
            bool supported;
            bool enabled;
            string error;
            bool got = TryReadNewHdr(path.targetInfo, out supported, out enabled, out error);
            if (!got)
            {
                if (!String.IsNullOrWhiteSpace(error)) errors.Add(error);
                continue;
            }
            if (!supported) continue;
            supportedCount++;
            if (enabled) enabledCount++;
        }

        return new HdrSummary {
            available = true,
            api = "hdr-state",
            supportedCount = supportedCount,
            enabledCount = enabledCount,
            mixed = supportedCount > 1 && enabledCount > 0 && enabledCount < supportedCount,
            errors = errors.ToArray()
        };
    }

    private static bool WaitForNewHdrState(PathTargetInfo target, bool enabled)
    {
        for (int attempt = 0; attempt < 12; attempt++)
        {
            Thread.Sleep(attempt == 0 ? 180 : 120);
            bool supported;
            bool current;
            string error;
            if (TryReadNewHdr(target, out supported, out current, out error)
                && supported && current == enabled)
                return true;
        }
        return false;
    }

    private static bool SetHdrForTarget(PathTargetInfo target, bool enabled)
    {
        if (!SupportsSeparatedHdrApi()) return false;

        bool supported;
        bool current;
        string error;
        if (!TryReadNewHdr(target, out supported, out current, out error)) return false;
        if (!supported) return false;

        var packet = new HdrSet();
        packet.header.type = DISPLAYCONFIG_DEVICE_INFO_SET_HDR_STATE;
        packet.header.size = (uint)Marshal.SizeOf(typeof(HdrSet));
        packet.header.adapterId = target.adapterId;
        packet.header.id = target.id;
        packet.enableHdr = enabled ? 1u : 0u;
        int rc = SetHdrState(ref packet);
        if (rc != 0) return false;
        return WaitForNewHdrState(target, enabled);
    }

    public static SetResult SetHdr(bool enabled)
    {
        if (!SupportsSeparatedHdrApi())
            return new SetResult {
                status = "FAILED",
                error = "Reliable HDR control requires Windows 11 24H2 (build 26100) or later.",
                state = GetHdr()
            };

        int supported = 0;
        int succeeded = 0;
        foreach (var path in ActivePaths())
        {
            bool isSupported;
            bool current;
            string error;
            bool readable = TryReadNewHdr(path.targetInfo, out isSupported, out current, out error);

            if (!readable || !isSupported) continue;
            supported++;
            if (SetHdrForTarget(path.targetInfo, enabled)) succeeded++;
        }

        var state = GetHdr();
        if (supported == 0)
            return new SetResult { status = "FAILED", error = "No active HDR-capable display was found.", state = state };

        bool verified = enabled
            ? state.supportedCount > 0 && state.enabledCount == state.supportedCount
            : state.enabledCount == 0;

        string status = verified && succeeded == supported ? "COMPLETE"
            : succeeded > 0 ? "PARTIAL"
            : "FAILED";
        return new SetResult {
            status = status,
            error = status == "COMPLETE" ? null : "One or more displays did not confirm the requested HDR state.",
            state = state
        };
    }

    public static bool SetKeepAwake(bool enabled)
    {
        uint flags = enabled
            ? ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
            : ES_CONTINUOUS;
        return SetThreadExecutionState(flags) != 0;
    }

    public static bool Lock()
    {
        return LockWorkStation();
    }
}
'@

$script:keepAwake = $false

function Invoke-PowerCfg {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $output = (& powercfg.exe @Arguments 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "powercfg $($Arguments -join ' ') failed: $($output.Trim())"
    }
    return $output
}

function Get-ActivePowerPlan {
    $text = Invoke-PowerCfg /getactivescheme
    $match = [regex]::Match($text, '(?i)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\s+\(([^\r\n\)]*)\))?')
    if (-not $match.Success) { throw "Could not parse active power plan." }
    [pscustomobject]@{ guid = $match.Groups[1].Value.ToLowerInvariant(); name = $match.Groups[2].Value.Trim() }
}

function Get-PowerPlans {
    $active = Get-ActivePowerPlan
    $text = Invoke-PowerCfg /list
    $regex = [regex]'(?im)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\s+\(([^\r\n\)]*)\))?'
    $plans = @()
    foreach ($match in $regex.Matches($text)) {
        $guid = $match.Groups[1].Value.ToLowerInvariant()
        $plans += [pscustomobject]@{
            guid = $guid
            name = $match.Groups[2].Value.Trim()
            active = ($guid -eq $active.guid)
        }
    }
    @($plans | Group-Object guid | ForEach-Object { $_.Group[0] })
}

function Get-SettingSeconds {
    param([string]$Subgroup, [string]$Setting)
    $text = Invoke-PowerCfg /query SCHEME_CURRENT $Subgroup $Setting
    $matches = [regex]::Matches($text, '(?i)0x[0-9a-f]{8}')
    if ($matches.Count -lt 2) { throw "Could not parse power setting $Setting." }
    $ac = [Convert]::ToUInt32($matches[$matches.Count - 2].Value.Substring(2), 16)
    $dc = [Convert]::ToUInt32($matches[$matches.Count - 1].Value.Substring(2), 16)
    [pscustomobject]@{ ac = [int64]$ac; dc = [int64]$dc }
}

function Get-Timeout {
    $monitor = Get-SettingSeconds SUB_VIDEO VIDEOIDLE
    $sleep = Get-SettingSeconds SUB_SLEEP STANDBYIDLE
    [pscustomobject]@{
        monitorAcSeconds = $monitor.ac
        monitorDcSeconds = $monitor.dc
        sleepAcSeconds = $sleep.ac
        sleepDcSeconds = $sleep.dc
    }
}

function Set-Timeout {
    param($Args)
    $values = @{
        monitorAcSeconds = [int64]$Args.monitorAcSeconds
        monitorDcSeconds = [int64]$Args.monitorDcSeconds
        sleepAcSeconds = [int64]$Args.sleepAcSeconds
        sleepDcSeconds = [int64]$Args.sleepDcSeconds
    }
    foreach ($value in $values.Values) {
        if ($value -lt 0 -or $value -gt [uint32]::MaxValue) {
            throw "Timeout values must be between 0 and 4294967295 seconds."
        }
    }

    $current = Get-ActivePowerPlan
    $errors = [System.Collections.Generic.List[string]]::new()
    $writes = @(
        @{ label = "Screen AC"; args = @("/setacvalueindex", "SCHEME_CURRENT", "SUB_VIDEO", "VIDEOIDLE", [string]$values.monitorAcSeconds) },
        @{ label = "Screen battery"; args = @("/setdcvalueindex", "SCHEME_CURRENT", "SUB_VIDEO", "VIDEOIDLE", [string]$values.monitorDcSeconds) },
        @{ label = "Sleep AC"; args = @("/setacvalueindex", "SCHEME_CURRENT", "SUB_SLEEP", "STANDBYIDLE", [string]$values.sleepAcSeconds) },
        @{ label = "Sleep battery"; args = @("/setdcvalueindex", "SCHEME_CURRENT", "SUB_SLEEP", "STANDBYIDLE", [string]$values.sleepDcSeconds) }
    )

    foreach ($write in $writes) {
        try {
            [string[]]$commandArgs = $write.args
            Invoke-PowerCfg @commandArgs | Out-Null
        }
        catch {
            $errors.Add("$($write.label): $($_.Exception.Message)")
        }
    }

    $activationOk = $true
    try {
        Invoke-PowerCfg /setactive $current.guid | Out-Null
    }
    catch {
        $activationOk = $false
        $errors.Add("Activate plan: $($_.Exception.Message)")
    }

    try {
        $after = Get-Timeout
    }
    catch {
        return [pscustomobject]@{
            status = "FAILED"
            state = $null
            error = "Timeout writes were attempted but final Windows readback failed: $($_.Exception.Message)"
        }
    }

    $checks = @(
        @{ label = "Screen AC"; ok = ($after.monitorAcSeconds -eq $values.monitorAcSeconds) },
        @{ label = "Screen battery"; ok = ($after.monitorDcSeconds -eq $values.monitorDcSeconds) },
        @{ label = "Sleep AC"; ok = ($after.sleepAcSeconds -eq $values.sleepAcSeconds) },
        @{ label = "Sleep battery"; ok = ($after.sleepDcSeconds -eq $values.sleepDcSeconds) }
    )
    $matched = @($checks | Where-Object { $_.ok }).Count
    foreach ($check in $checks | Where-Object { -not $_.ok }) {
        $errors.Add("$($check.label) did not match the requested value after readback.")
    }

    $status = if ($matched -eq $checks.Count -and $activationOk) {
        "COMPLETE"
    }
    elseif ($matched -gt 0) {
        "PARTIAL"
    }
    else {
        "FAILED"
    }

    [pscustomobject]@{
        status = $status
        state = $after
        error = $(if ($status -eq "COMPLETE") { $null } else { ($errors -join " | ") })
    }
}

function Get-Snapshot {
    $errors = [System.Collections.Generic.List[string]]::new()

    try { $hdr = [PackRatWindowsNative]::GetHdr() }
    catch {
        $errors.Add("HDR: $($_.Exception.Message)")
        $hdr = [pscustomobject]@{ available = $false; api = "unavailable"; supportedCount = 0; enabledCount = 0; mixed = $false }
    }

    try { $topology = [PackRatWindowsNative]::GetTopology() }
    catch { $errors.Add("Display: $($_.Exception.Message)"); $topology = "unknown" }

    try {
        $power = Get-ActivePowerPlan
        $plans = @(Get-PowerPlans)
    }
    catch {
        $errors.Add("Power: $($_.Exception.Message)")
        $power = $null
        $plans = @()
    }

    try { $timeout = Get-Timeout }
    catch { $errors.Add("Timeout: $($_.Exception.Message)"); $timeout = $null }

    [pscustomobject]@{
        backendOnline = $true
        capturedAt = [DateTimeOffset]::UtcNow.ToString("o")
        osBuild = [PackRatWindowsNative]::GetWindowsBuild()
        hdr = $hdr
        topology = $topology
        powerPlanGuid = $(if ($power) { $power.guid } else { $null })
        powerPlanName = $(if ($power) { $power.name } else { $null })
        powerPlans = $plans
        timeout = $timeout
        keepAwake = [bool]$script:keepAwake
        errors = @($errors)
    }
}

function Write-Reply {
    param([int]$Id, [bool]$Ok, $Result = $null, [string]$ErrorText = $null)
    [pscustomobject]@{ id = $Id; ok = $Ok; result = $Result; error = $ErrorText } |
        ConvertTo-Json -Depth 12 -Compress |
        Write-Output
}

while (($line = [Console]::In.ReadLine()) -ne $null) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $id = 0
    try {
        $request = $line | ConvertFrom-Json
        $id = [int]$request.id
        $args = $request.args
        switch ([string]$request.op) {
            "ping" {
                Write-Reply $id $true ([pscustomobject]@{ version = 1 })
            }
            "snapshot" {
                Write-Reply $id $true (Get-Snapshot)
            }
            "setHdr" {
                $result = [PackRatWindowsNative]::SetHdr([bool]$args.enabled)
                Write-Reply $id ($result.status -ne "FAILED") $result $result.error
            }
            "setTopology" {
                $target = [string]$args.topology
                [void][PackRatWindowsNative]::SetTopology($target)
                $actual = [PackRatWindowsNative]::GetTopology()
                $result = [pscustomobject]@{
                    status = $(if ($actual -eq $target) { "COMPLETE" } else { "FAILED" })
                    state = $actual
                }
                Write-Reply $id ($result.status -eq "COMPLETE") $result $(if ($result.status -eq "FAILED") { "Windows did not confirm the requested display topology." } else { $null })
            }
            "setPowerPlan" {
                $guid = [string]$args.guid
                if ($guid -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
                    throw "Invalid power plan GUID."
                }
                Invoke-PowerCfg /setactive $guid | Out-Null
                $after = Get-ActivePowerPlan
                $ok = $after.guid -eq $guid.ToLowerInvariant()
                Write-Reply $id $ok ([pscustomobject]@{ status = $(if ($ok) { "COMPLETE" } else { "FAILED" }); state = $after }) $(if ($ok) { $null } else { "Power plan did not change." })
            }
            "setTimeout" {
                $result = Set-Timeout $args
                Write-Reply $id ($result.status -ne "FAILED") $result $result.error
            }
            "setKeepAwake" {
                $enabled = [bool]$args.enabled
                $ok = [PackRatWindowsNative]::SetKeepAwake($enabled)
                if ($ok) { $script:keepAwake = $enabled }
                $result = [pscustomobject]@{ status = $(if ($ok) { "COMPLETE" } else { "FAILED" }); state = [bool]$script:keepAwake }
                Write-Reply $id $ok $result $(if ($ok) { $null } else { "SetThreadExecutionState failed." })
            }
            "lock" {
                $ok = [PackRatWindowsNative]::Lock()
                Write-Reply $id $ok ([pscustomobject]@{ status = $(if ($ok) { "COMPLETE" } else { "FAILED" }) }) $(if ($ok) { $null } else { "LockWorkStation failed." })
            }
            default {
                Write-Reply $id $false $null "Unknown backend operation."
            }
        }
    }
    catch {
        Write-Reply $id $false $null $_.Exception.Message
    }
}

if ($script:keepAwake) {
    [void][PackRatWindowsNative]::SetKeepAwake($false)
}

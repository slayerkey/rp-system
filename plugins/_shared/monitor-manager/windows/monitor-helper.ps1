# PackRat Monitor Manager Windows helper.
# JSONL RPC over stdin/stdout. No arbitrary VCP operation is exposed to customers;
# the plugin itself capability-gates the small safe MCCS allowlist.

$ErrorActionPreference = "Stop"

Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class MonitorNative {
    const int ENUM_CURRENT_SETTINGS = -1;
    const int CDS_UPDATEREGISTRY = 0x00000001;
    const int CDS_TEST = 0x00000002;
    const int CDS_SET_PRIMARY = 0x00000010;
    const int DISP_CHANGE_SUCCESSFUL = 0;
    const uint MONITORINFOF_PRIMARY = 1;
    const uint QDC_ONLY_ACTIVE_PATHS = 0x00000002;
    const uint QDC_DATABASE_CURRENT = 0x00000004;
    const uint SDC_APPLY = 0x00000080;
    const uint SDC_TOPOLOGY_INTERNAL = 0x00000001;
    const uint SDC_TOPOLOGY_CLONE = 0x00000002;
    const uint SDC_TOPOLOGY_EXTEND = 0x00000004;
    const uint SDC_TOPOLOGY_EXTERNAL = 0x00000008;

    public delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int left, top, right, bottom; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct MONITORINFOEX {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string szDevice;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct PHYSICAL_MONITOR {
        public IntPtr hPhysicalMonitor;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string szPhysicalMonitorDescription;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DEVMODE {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
        public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
        public int dmFields;
        public int dmPositionX, dmPositionY;
        public int dmDisplayOrientation;
        public int dmDisplayFixedOutput;
        public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
        public short dmLogPixels;
        public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
        public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct LUID { public uint LowPart; public int HighPart; }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_RATIONAL { public uint Numerator; public uint Denominator; }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_PATH_SOURCE_INFO {
        public LUID adapterId;
        public uint id;
        public uint modeInfoIdx;
        public uint statusFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_PATH_TARGET_INFO {
        public LUID adapterId;
        public uint id;
        public uint modeInfoIdx;
        public int outputTechnology;
        public int rotation;
        public int scaling;
        public DISPLAYCONFIG_RATIONAL refreshRate;
        public int scanLineOrdering;
        [MarshalAs(UnmanagedType.Bool)] public bool targetAvailable;
        public uint statusFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_PATH_INFO {
        public DISPLAYCONFIG_PATH_SOURCE_INFO sourceInfo;
        public DISPLAYCONFIG_PATH_TARGET_INFO targetInfo;
        public uint flags;
    }

    [StructLayout(LayoutKind.Explicit, Size = 48)]
    public struct DISPLAYCONFIG_MODE_INFO_UNION { }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_MODE_INFO {
        public int infoType;
        public uint id;
        public LUID adapterId;
        public DISPLAYCONFIG_MODE_INFO_UNION modeInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_DEVICE_INFO_HEADER {
        public int type;
        public uint size;
        public LUID adapterId;
        public uint id;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DISPLAYCONFIG_SOURCE_DEVICE_NAME {
        public DISPLAYCONFIG_DEVICE_INFO_HEADER header;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string viewGdiDeviceName;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DISPLAYCONFIG_TARGET_DEVICE_NAME {
        public DISPLAYCONFIG_DEVICE_INFO_HEADER header;
        public uint flags;
        public int outputTechnology;
        public ushort edidManufactureId;
        public ushort edidProductCodeId;
        public uint connectorInstance;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string monitorFriendlyDeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string monitorDevicePath;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO {
        public DISPLAYCONFIG_DEVICE_INFO_HEADER header;
        public uint value;
        public int colorEncoding;
        public uint bitsPerColorChannel;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE {
        public DISPLAYCONFIG_DEVICE_INFO_HEADER header;
        public uint value;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2 {
        public DISPLAYCONFIG_DEVICE_INFO_HEADER header;
        public uint value;
        public int colorEncoding;
        public uint bitsPerColorChannel;
        public int activeColorMode;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_SET_HDR_STATE {
        public DISPLAYCONFIG_DEVICE_INFO_HEADER header;
        public uint value;
    }

    public class ModeRecord {
        public int width { get; set; }
        public int height { get; set; }
        public int frequency { get; set; }
        public int orientation { get; set; }
    }

    public class DisplayRecord {
        public string deviceName { get; set; }
        public string monitorDevicePath { get; set; }
        public string description { get; set; }
        public bool internalDisplay { get; set; }
        public bool primary { get; set; }
        public int left { get; set; }
        public int top { get; set; }
        public int right { get; set; }
        public int bottom { get; set; }
        public int physicalIndex { get; set; }
        public int physicalCount { get; set; }
        public string capabilities { get; set; }
        public bool ddcBrightness { get; set; }
        public uint brightness { get; set; }
        public uint brightnessMin { get; set; }
        public uint brightnessMax { get; set; }
        public bool ddcContrast { get; set; }
        public uint contrast { get; set; }
        public uint contrastMin { get; set; }
        public uint contrastMax { get; set; }
        public ModeRecord currentMode { get; set; }
        public List<ModeRecord> modes { get; set; }
        public string hdrState { get; set; }
        public bool hdrEnabled { get; set; }
    }

    [DllImport("user32.dll")] static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc callback, IntPtr data);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFOEX info);
    [DllImport("dxva2.dll", SetLastError = true)] static extern bool GetNumberOfPhysicalMonitorsFromHMONITOR(IntPtr hMonitor, out uint count);
    [DllImport("dxva2.dll", SetLastError = true)] static extern bool GetPhysicalMonitorsFromHMONITOR(IntPtr hMonitor, uint count, [Out] PHYSICAL_MONITOR[] monitors);
    [DllImport("dxva2.dll", SetLastError = true)] static extern bool DestroyPhysicalMonitors(uint count, PHYSICAL_MONITOR[] monitors);
    [DllImport("dxva2.dll", SetLastError = true)] static extern bool GetCapabilitiesStringLength(IntPtr monitor, out uint length);
    [DllImport("dxva2.dll", CharSet = CharSet.Ansi, SetLastError = true)] static extern bool CapabilitiesRequestAndCapabilitiesReply(IntPtr monitor, StringBuilder capabilities, uint length);
    [DllImport("dxva2.dll", SetLastError = true)] static extern bool GetMonitorBrightness(IntPtr monitor, out uint min, out uint current, out uint max);
    [DllImport("dxva2.dll", SetLastError = true)] static extern bool SetMonitorBrightness(IntPtr monitor, uint value);
    [DllImport("dxva2.dll", SetLastError = true)] static extern bool GetMonitorContrast(IntPtr monitor, out uint min, out uint current, out uint max);
    [DllImport("dxva2.dll", SetLastError = true)] static extern bool SetMonitorContrast(IntPtr monitor, uint value);
    [DllImport("dxva2.dll", SetLastError = true)] static extern bool GetVCPFeatureAndVCPFeatureReply(IntPtr monitor, byte code, IntPtr type, out uint current, out uint maximum);
    [DllImport("dxva2.dll", SetLastError = true)] static extern bool SetVCPFeature(IntPtr monitor, byte code, uint value);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool EnumDisplaySettingsEx(string deviceName, int modeNum, ref DEVMODE devMode, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int ChangeDisplaySettingsEx(string deviceName, ref DEVMODE devMode, IntPtr hwnd, uint flags, IntPtr lParam);
    [DllImport("user32.dll")] static extern int SetDisplayConfig(uint pathCount, IntPtr paths, uint modeCount, IntPtr modes, uint flags);

    [DllImport("user32.dll")] static extern int GetDisplayConfigBufferSizes(uint flags, out uint pathCount, out uint modeCount);
    [DllImport("user32.dll")] static extern int QueryDisplayConfig(uint flags, ref uint pathCount, [Out] DISPLAYCONFIG_PATH_INFO[] paths, ref uint modeCount, [Out] DISPLAYCONFIG_MODE_INFO[] modes, IntPtr topology);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int DisplayConfigGetDeviceInfo(IntPtr packet);
    [DllImport("user32.dll")] static extern int DisplayConfigSetDeviceInfo(IntPtr packet);

    static DEVMODE EmptyMode() {
        var mode = new DEVMODE();
        mode.dmDeviceName = new string('\0', 32);
        mode.dmFormName = new string('\0', 32);
        mode.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
        return mode;
    }

    static IntPtr FindMonitor(string deviceName) {
        IntPtr found = IntPtr.Zero;
        MonitorEnumProc proc = delegate(IntPtr h, IntPtr dc, ref RECT r, IntPtr data) {
            var mi = new MONITORINFOEX();
            mi.cbSize = Marshal.SizeOf(typeof(MONITORINFOEX));
            if (GetMonitorInfo(h, ref mi) && string.Equals(mi.szDevice, deviceName, StringComparison.OrdinalIgnoreCase)) {
                found = h;
                return false;
            }
            return true;
        };
        EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, proc, IntPtr.Zero);
        return found;
    }

    static PHYSICAL_MONITOR[] Physical(string deviceName) {
        var h = FindMonitor(deviceName);
        if (h == IntPtr.Zero) return new PHYSICAL_MONITOR[0];
        uint count;
        if (!GetNumberOfPhysicalMonitorsFromHMONITOR(h, out count) || count == 0) return new PHYSICAL_MONITOR[0];
        var array = new PHYSICAL_MONITOR[count];
        return GetPhysicalMonitorsFromHMONITOR(h, count, array) ? array : new PHYSICAL_MONITOR[0];
    }

    static string Caps(IntPtr h) {
        uint length;
        if (!GetCapabilitiesStringLength(h, out length) || length < 2 || length > 65535) return null;
        var sb = new StringBuilder((int)length);
        return CapabilitiesRequestAndCapabilitiesReply(h, sb, length) ? sb.ToString() : null;
    }

    public static List<ModeRecord> GetModes(string deviceName) {
        var modes = new List<ModeRecord>();
        var seen = new HashSet<string>();
        for (int i = 0; i < 4096; i++) {
            var dm = EmptyMode();
            if (!EnumDisplaySettingsEx(deviceName, i, ref dm, 0)) break;
            var key = dm.dmPelsWidth + "x" + dm.dmPelsHeight + "@" + dm.dmDisplayFrequency + "/" + dm.dmDisplayOrientation;
            if (!seen.Add(key)) continue;
            modes.Add(new ModeRecord { width=dm.dmPelsWidth, height=dm.dmPelsHeight, frequency=dm.dmDisplayFrequency, orientation=dm.dmDisplayOrientation });
        }
        return modes;
    }

    public static ModeRecord GetCurrentMode(string deviceName) {
        var dm = EmptyMode();
        if (!EnumDisplaySettingsEx(deviceName, ENUM_CURRENT_SETTINGS, ref dm, 0)) return null;
        return new ModeRecord { width=dm.dmPelsWidth, height=dm.dmPelsHeight, frequency=dm.dmDisplayFrequency, orientation=dm.dmDisplayOrientation };
    }

    static bool IsInternalDisplay(string deviceName) {
        uint pathCount, modeCount;
        if (GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out pathCount, out modeCount) != 0 || pathCount == 0) return false;
        var paths = new DISPLAYCONFIG_PATH_INFO[pathCount];
        var modes = new DISPLAYCONFIG_MODE_INFO[modeCount];
        if (QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, ref pathCount, paths, ref modeCount, modes, IntPtr.Zero) != 0) return false;
        for (int i=0; i<pathCount; i++) {
            var source = new DISPLAYCONFIG_SOURCE_DEVICE_NAME();
            source.header.type = 1;
            source.header.size = (uint)Marshal.SizeOf(typeof(DISPLAYCONFIG_SOURCE_DEVICE_NAME));
            source.header.adapterId = paths[i].sourceInfo.adapterId;
            source.header.id = paths[i].sourceInfo.id;
            IntPtr sp = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(DISPLAYCONFIG_SOURCE_DEVICE_NAME)));
            try {
                Marshal.StructureToPtr(source, sp, false);
                if (DisplayConfigGetDeviceInfo(sp) != 0) continue;
                source = (DISPLAYCONFIG_SOURCE_DEVICE_NAME)Marshal.PtrToStructure(sp, typeof(DISPLAYCONFIG_SOURCE_DEVICE_NAME));
            } finally { Marshal.FreeHGlobal(sp); }
            if (!string.Equals(source.viewGdiDeviceName, deviceName, StringComparison.OrdinalIgnoreCase)) continue;
            int tech = paths[i].targetInfo.outputTechnology;
            return tech == 6 || tech == 11 || tech == 13 || unchecked((uint)tech) == 0x80000000u;
        }
        return false;
    }

    static string StableMonitorPath(string deviceName) {
        uint pathCount, modeCount;
        if (GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out pathCount, out modeCount) != 0 || pathCount == 0) return null;
        var paths = new DISPLAYCONFIG_PATH_INFO[pathCount];
        var modes = new DISPLAYCONFIG_MODE_INFO[modeCount];
        if (QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, ref pathCount, paths, ref modeCount, modes, IntPtr.Zero) != 0) return null;

        for (int i=0; i<pathCount; i++) {
            var source = new DISPLAYCONFIG_SOURCE_DEVICE_NAME();
            source.header.type = 1;
            source.header.size = (uint)Marshal.SizeOf(typeof(DISPLAYCONFIG_SOURCE_DEVICE_NAME));
            source.header.adapterId = paths[i].sourceInfo.adapterId;
            source.header.id = paths[i].sourceInfo.id;
            IntPtr sp = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(DISPLAYCONFIG_SOURCE_DEVICE_NAME)));
            try {
                Marshal.StructureToPtr(source, sp, false);
                if (DisplayConfigGetDeviceInfo(sp) != 0) continue;
                source = (DISPLAYCONFIG_SOURCE_DEVICE_NAME)Marshal.PtrToStructure(sp, typeof(DISPLAYCONFIG_SOURCE_DEVICE_NAME));
            } finally { Marshal.FreeHGlobal(sp); }
            if (!string.Equals(source.viewGdiDeviceName, deviceName, StringComparison.OrdinalIgnoreCase)) continue;

            var target = new DISPLAYCONFIG_TARGET_DEVICE_NAME();
            target.header.type = 2;
            target.header.size = (uint)Marshal.SizeOf(typeof(DISPLAYCONFIG_TARGET_DEVICE_NAME));
            target.header.adapterId = paths[i].targetInfo.adapterId;
            target.header.id = paths[i].targetInfo.id;
            IntPtr tp = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(DISPLAYCONFIG_TARGET_DEVICE_NAME)));
            try {
                Marshal.StructureToPtr(target, tp, false);
                if (DisplayConfigGetDeviceInfo(tp) != 0) return null;
                target = (DISPLAYCONFIG_TARGET_DEVICE_NAME)Marshal.PtrToStructure(tp, typeof(DISPLAYCONFIG_TARGET_DEVICE_NAME));
                return String.IsNullOrWhiteSpace(target.monitorDevicePath) ? null : target.monitorDevicePath;
            } finally { Marshal.FreeHGlobal(tp); }
        }
        return null;
    }

    static bool TryHdr(string deviceName, bool set, bool enabled, out bool supported, out bool current) {
        supported = false; current = false;
        uint pathCount, modeCount;
        if (GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out pathCount, out modeCount) != 0 || pathCount == 0) return false;
        var paths = new DISPLAYCONFIG_PATH_INFO[pathCount];
        var modes = new DISPLAYCONFIG_MODE_INFO[modeCount];
        if (QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, ref pathCount, paths, ref modeCount, modes, IntPtr.Zero) != 0) return false;

        for (int i=0; i<pathCount; i++) {
            var source = new DISPLAYCONFIG_SOURCE_DEVICE_NAME();
            source.header.type = 1;
            source.header.size = (uint)Marshal.SizeOf(typeof(DISPLAYCONFIG_SOURCE_DEVICE_NAME));
            source.header.adapterId = paths[i].sourceInfo.adapterId;
            source.header.id = paths[i].sourceInfo.id;
            IntPtr sp = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(DISPLAYCONFIG_SOURCE_DEVICE_NAME)));
            try {
                Marshal.StructureToPtr(source, sp, false);
                if (DisplayConfigGetDeviceInfo(sp) != 0) continue;
                source = (DISPLAYCONFIG_SOURCE_DEVICE_NAME)Marshal.PtrToStructure(sp, typeof(DISPLAYCONFIG_SOURCE_DEVICE_NAME));
            } finally { Marshal.FreeHGlobal(sp); }
            if (!string.Equals(source.viewGdiDeviceName, deviceName, StringComparison.OrdinalIgnoreCase)) continue;

            // Windows 11 24H2+ exposes HDR separately from generic Advanced Color.
            // Prefer that exact API so WCG-only displays are never mislabeled as HDR-capable.
            var hdr = new DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2();
            hdr.header.type = 15; // DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO_2
            hdr.header.size = (uint)Marshal.SizeOf(typeof(DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2));
            hdr.header.adapterId = paths[i].targetInfo.adapterId;
            hdr.header.id = paths[i].targetInfo.id;
            IntPtr hp = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2)));
            int hdrRc;
            try {
                Marshal.StructureToPtr(hdr, hp, false);
                hdrRc = DisplayConfigGetDeviceInfo(hp);
                if (hdrRc == 0) hdr = (DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2)Marshal.PtrToStructure(hp, typeof(DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2));
            } finally { Marshal.FreeHGlobal(hp); }

            if (hdrRc == 0) {
                supported = (hdr.value & (1u << 4)) != 0; // highDynamicRangeSupported
                current = (hdr.value & (1u << 5)) != 0;   // highDynamicRangeUserEnabled
                if (set) {
                    if (!supported) return true;
                    var packet = new DISPLAYCONFIG_SET_HDR_STATE();
                    packet.header.type = 16; // DISPLAYCONFIG_DEVICE_INFO_SET_HDR_STATE
                    packet.header.size = (uint)Marshal.SizeOf(typeof(DISPLAYCONFIG_SET_HDR_STATE));
                    packet.header.adapterId = paths[i].targetInfo.adapterId;
                    packet.header.id = paths[i].targetInfo.id;
                    packet.value = enabled ? 1u : 0u;
                    IntPtr pp = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(DISPLAYCONFIG_SET_HDR_STATE)));
                    try {
                        Marshal.StructureToPtr(packet, pp, false);
                        if (DisplayConfigSetDeviceInfo(pp) != 0) return false;
                    } finally { Marshal.FreeHGlobal(pp); }

                    // Re-query instead of assuming the requested state stuck.
                    hp = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2)));
                    try {
                        hdr.header.type = 15;
                        hdr.header.size = (uint)Marshal.SizeOf(typeof(DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2));
                        Marshal.StructureToPtr(hdr, hp, false);
                        if (DisplayConfigGetDeviceInfo(hp) != 0) return false;
                        hdr = (DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2)Marshal.PtrToStructure(hp, typeof(DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2));
                        current = (hdr.value & (1u << 5)) != 0;
                    } finally { Marshal.FreeHGlobal(hp); }
                }
                return true;
            }

            // Older Windows exposes only "Advanced Color", which cannot reliably
            // distinguish HDR from WCG. Fail closed instead of guessing.
            return false;
        }
        return false;
    }

    public static List<DisplayRecord> Scan() {
        var list = new List<DisplayRecord>();
        MonitorEnumProc proc = delegate(IntPtr h, IntPtr dc, ref RECT r, IntPtr data) {
            var mi = new MONITORINFOEX();
            mi.cbSize = Marshal.SizeOf(typeof(MONITORINFOEX));
            if (!GetMonitorInfo(h, ref mi)) return true;
            uint count = 0;
            GetNumberOfPhysicalMonitorsFromHMONITOR(h, out count);
            var phys = count > 0 ? new PHYSICAL_MONITOR[count] : new PHYSICAL_MONITOR[0];
            bool have = count > 0 && GetPhysicalMonitorsFromHMONITOR(h, count, phys);
            if (!have) {
                bool hs, he; bool hq=TryHdr(mi.szDevice, false, false, out hs, out he);
                list.Add(new DisplayRecord {
                    deviceName=mi.szDevice, monitorDevicePath=(StableMonitorPath(mi.szDevice) ?? mi.szDevice) + "#0", description=mi.szDevice, internalDisplay=IsInternalDisplay(mi.szDevice), primary=(mi.dwFlags & MONITORINFOF_PRIMARY) != 0,
                    left=mi.rcMonitor.left, top=mi.rcMonitor.top, right=mi.rcMonitor.right, bottom=mi.rcMonitor.bottom,
                    physicalIndex=0, physicalCount=0, capabilities=null, ddcBrightness=false, ddcContrast=false,
                    currentMode=GetCurrentMode(mi.szDevice), modes=GetModes(mi.szDevice),
                    hdrState=hq ? (hs ? "SUPPORTED" : "NOT_SUPPORTED") : "UNKNOWN", hdrEnabled=he
                });
                return true;
            }
            try {
                for (int i=0; i<phys.Length; i++) {
                    uint bmin=0,bcur=0,bmax=0,cmin=0,ccur=0,cmax=0;
                    bool bs=GetMonitorBrightness(phys[i].hPhysicalMonitor, out bmin, out bcur, out bmax);
                    bool cs=GetMonitorContrast(phys[i].hPhysicalMonitor, out cmin, out ccur, out cmax);
                    bool hs, he; bool hq=TryHdr(mi.szDevice, false, false, out hs, out he);
                    list.Add(new DisplayRecord {
                        deviceName=mi.szDevice, monitorDevicePath=(StableMonitorPath(mi.szDevice) ?? mi.szDevice) + "#" + i, description=phys[i].szPhysicalMonitorDescription, internalDisplay=IsInternalDisplay(mi.szDevice), primary=(mi.dwFlags & MONITORINFOF_PRIMARY) != 0,
                        left=mi.rcMonitor.left, top=mi.rcMonitor.top, right=mi.rcMonitor.right, bottom=mi.rcMonitor.bottom,
                        physicalIndex=i, physicalCount=phys.Length, capabilities=Caps(phys[i].hPhysicalMonitor),
                        ddcBrightness=bs, brightness=bcur, brightnessMin=bmin, brightnessMax=bmax,
                        ddcContrast=cs, contrast=ccur, contrastMin=cmin, contrastMax=cmax,
                        currentMode=GetCurrentMode(mi.szDevice), modes=GetModes(mi.szDevice),
                        hdrState=hq ? (hs ? "SUPPORTED" : "NOT_SUPPORTED") : "UNKNOWN", hdrEnabled=he
                    });
                }
            } finally { DestroyPhysicalMonitors((uint)phys.Length, phys); }
            return true;
        };
        EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, proc, IntPtr.Zero);
        return list;
    }

    static T WithPhysical<T>(string deviceName, int index, Func<IntPtr,T> fn) {
        var phys=Physical(deviceName);
        if (index < 0 || index >= phys.Length) throw new InvalidOperationException("Physical monitor is unavailable.");
        try { return fn(phys[index].hPhysicalMonitor); }
        finally { DestroyPhysicalMonitors((uint)phys.Length, phys); }
    }

    public static bool SetBrightnessValue(string deviceName, int index, uint value) {
        return WithPhysical(deviceName,index,h => SetMonitorBrightness(h,value));
    }
    public static bool SetContrastValue(string deviceName, int index, uint value) {
        return WithPhysical(deviceName,index,h => SetMonitorContrast(h,value));
    }
    public static uint[] GetVcp(string deviceName, int index, byte code) {
        return WithPhysical(deviceName,index,h => {
            uint cur,max; if(!GetVCPFeatureAndVCPFeatureReply(h,code,IntPtr.Zero,out cur,out max)) throw new InvalidOperationException("VCP read failed.");
            return new uint[]{cur,max};
        });
    }
    public static bool SetVcp(string deviceName, int index, byte code, uint value) {
        return WithPhysical(deviceName,index,h => SetVCPFeature(h,code,value));
    }

    public static bool SetMode(string deviceName, int width, int height, int frequency, int orientation, bool primary) {
        var dm=EmptyMode();
        if(!EnumDisplaySettingsEx(deviceName,ENUM_CURRENT_SETTINGS,ref dm,0)) return false;
        dm.dmPelsWidth=width; dm.dmPelsHeight=height; dm.dmDisplayFrequency=frequency; dm.dmDisplayOrientation=orientation;
        dm.dmFields |= 0x00080000 | 0x00100000 | 0x00400000 | 0x00000080;
        if (primary) {
            dm.dmPositionX=0; dm.dmPositionY=0;
            dm.dmFields |= 0x00000020;
        }
        uint flags=CDS_TEST;
        int test=ChangeDisplaySettingsEx(deviceName,ref dm,IntPtr.Zero,flags,IntPtr.Zero);
        if(test!=DISP_CHANGE_SUCCESSFUL) return false;
        flags=CDS_UPDATEREGISTRY | (primary ? CDS_SET_PRIMARY : 0);
        return ChangeDisplaySettingsEx(deviceName,ref dm,IntPtr.Zero,flags,IntPtr.Zero)==DISP_CHANGE_SUCCESSFUL;
    }

    public static string GetTopology() {
        uint pathCount, modeCount;
        if (GetDisplayConfigBufferSizes(QDC_DATABASE_CURRENT, out pathCount, out modeCount) != 0) return "unknown";
        var paths = new DISPLAYCONFIG_PATH_INFO[pathCount];
        var modes = new DISPLAYCONFIG_MODE_INFO[modeCount];
        IntPtr topology = Marshal.AllocHGlobal(4);
        try {
            Marshal.WriteInt32(topology, 0);
            if (QueryDisplayConfig(QDC_DATABASE_CURRENT, ref pathCount, paths, ref modeCount, modes, topology) != 0) return "unknown";
            switch (Marshal.ReadInt32(topology)) {
                case 1: return "internal";
                case 2: return "duplicate";
                case 4: return "extend";
                case 8: return "external";
                default: return "unknown";
            }
        } finally {
            Marshal.FreeHGlobal(topology);
        }
    }

    public static bool SetTopology(string mode) {
        uint flag;
        switch((mode ?? "").ToLowerInvariant()) {
            case "internal": flag=SDC_TOPOLOGY_INTERNAL; break;
            case "duplicate": case "clone": flag=SDC_TOPOLOGY_CLONE; break;
            case "extend": flag=SDC_TOPOLOGY_EXTEND; break;
            case "external": flag=SDC_TOPOLOGY_EXTERNAL; break;
            default: return false;
        }
        return SetDisplayConfig(0,IntPtr.Zero,0,IntPtr.Zero,SDC_APPLY|flag)==0;
    }

    public static bool GetHdr(string deviceName, out bool supported, out bool enabled) {
        return TryHdr(deviceName,false,false,out supported,out enabled);
    }
    public static bool SetHdr(string deviceName, bool enabled) {
        bool supported,current;
        return TryHdr(deviceName,true,enabled,out supported,out current) && supported && current==enabled;
    }
}
'@

function Get-InternalBrightness {
    try {
        $items = @(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness -ErrorAction Stop)
        if (-not $items.Count) { return $null }
        return [pscustomobject]@{
            available = $true
            current = [int]$items[0].CurrentBrightness
            levels = @($items[0].Level | ForEach-Object { [int]$_ })
            instanceName = [string]$items[0].InstanceName
        }
    } catch {
        return $null
    }
}

function Set-InternalBrightness([int]$Value) {
    $methods = @(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop)
    if (-not $methods.Count) { throw "Internal brightness is not available." }
    Invoke-CimMethod -InputObject $methods[0] -MethodName WmiSetBrightness -Arguments @{ Timeout = 0; Brightness = [byte][Math]::Max(0,[Math]::Min(100,$Value)) } | Out-Null
    return $true
}

function Write-Reply($Id, [bool]$Ok, $Result, $ErrorText = $null) {
    $payload = if ($Ok) {
        @{ id = $Id; ok = $true; result = $Result }
    } else {
        @{ id = $Id; ok = $false; error = [string]$ErrorText }
    }
    [Console]::Out.WriteLine(($payload | ConvertTo-Json -Compress -Depth 12))
    [Console]::Out.Flush()
}

while (($line = [Console]::In.ReadLine()) -ne $null) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $id = $null
    try {
        $request = $line | ConvertFrom-Json
        $id = $request.id
        $p = $request.params
        switch ([string]$request.op) {
            "scan" {
                $records = @([MonitorNative]::Scan())
                $internal = Get-InternalBrightness
                Write-Reply $id $true @{ monitors = $records; internalBrightness = $internal; topology = [MonitorNative]::GetTopology() }
            }
            "set-brightness" {
                if ($p.kind -eq "internal") {
                    Write-Reply $id $true (Set-InternalBrightness ([int]$p.value))
                } else {
                    $ok = [MonitorNative]::SetBrightnessValue([string]$p.deviceName,[int]$p.physicalIndex,[uint32]$p.value)
                    if (-not $ok) { throw "DDC brightness write failed." }
                    Write-Reply $id $true $true
                }
            }
            "set-contrast" {
                $ok = [MonitorNative]::SetContrastValue([string]$p.deviceName,[int]$p.physicalIndex,[uint32]$p.value)
                if (-not $ok) { throw "DDC contrast write failed." }
                Write-Reply $id $true $true
            }
            "get-vcp" {
                $value = [MonitorNative]::GetVcp([string]$p.deviceName,[int]$p.physicalIndex,[byte]$p.code)
                Write-Reply $id $true @{ current = [uint32]$value[0]; maximum = [uint32]$value[1] }
            }
            "set-vcp" {
                $allowed = @(0x60,0x62,0xD6)
                if ($allowed -notcontains [int]$p.code) { throw "VCP code is outside the PackRat safe allowlist." }
                $ok = [MonitorNative]::SetVcp([string]$p.deviceName,[int]$p.physicalIndex,[byte]$p.code,[uint32]$p.value)
                if (-not $ok) { throw "VCP write failed." }
                Write-Reply $id $true $true
            }
            "set-mode" {
                $ok = [MonitorNative]::SetMode([string]$p.deviceName,[int]$p.width,[int]$p.height,[int]$p.frequency,[int]$p.orientation,[bool]$p.primary)
                if (-not $ok) { throw "Requested Windows display mode was rejected." }
                Write-Reply $id $true $true
            }
            "set-topology" {
                $ok = [MonitorNative]::SetTopology([string]$p.mode)
                if (-not $ok) { throw "Windows display topology change failed." }
                Write-Reply $id $true $true
            }
            "get-hdr" {
                $supported = $false; $enabled = $false
                $ok = [MonitorNative]::GetHdr([string]$p.deviceName,[ref]$supported,[ref]$enabled)
                Write-Reply $id $true @{ queryOk=$ok; supported=$supported; enabled=$enabled }
            }
            "set-hdr" {
                $ok = [MonitorNative]::SetHdr([string]$p.deviceName,[bool]$p.enabled)
                if (-not $ok) { throw "HDR is unsupported or Windows rejected the requested state." }
                Write-Reply $id $true $true
            }
            default { throw "Unknown monitor helper operation." }
        }
    } catch {
        Write-Reply $id $false $null $_.Exception.Message
    }
}

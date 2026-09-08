param(
  [ValidateSet("List","State","Switch","Cycle","MicToggle","MicSet","VolumeSet","VolumeAdjust")]
  [string]$Action = "State",
  [ValidateSet("output","input")]
  [string]$Flow = "output",
  [string]$Match = "",
  [int]$Value = 0,
  [int]$Step = 1,
  [string]$Muted = ""
)

$ErrorActionPreference = "Stop"

if (-not ("PackRatAudio.Core" -as [type])) {
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace PackRatAudio {
  public enum EDataFlow { Render=0, Capture=1, All=2 }
  public enum ERole { Console=0, Multimedia=1, Communications=2 }
  [Flags] public enum DeviceState : uint { Active=1, Disabled=2, NotPresent=4, Unplugged=8, All=15 }
  [Flags] public enum CLSCTX : uint { INPROC_SERVER=1, INPROC_HANDLER=2, LOCAL_SERVER=4, REMOTE_SERVER=16, ALL=23 }

  [StructLayout(LayoutKind.Sequential)]
  public struct PROPERTYKEY {
    public Guid fmtid;
    public uint pid;
    public PROPERTYKEY(Guid f, uint p) { fmtid=f; pid=p; }
  }

  [StructLayout(LayoutKind.Explicit)]
  public struct PROPVARIANT {
    [FieldOffset(0)] public ushort vt;
    [FieldOffset(8)] public IntPtr pointerValue;
    public string AsString() {
      return vt == 31 && pointerValue != IntPtr.Zero ? Marshal.PtrToStringUni(pointerValue) : "";
    }
  }

  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-C0A0A8A4E3A7"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceCollection {
    int GetCount(out uint pcDevices);
    int Item(uint nDevice, out IMMDevice ppDevice);
  }

  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, CLSCTX dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    int OpenPropertyStore(int stgmAccess, out IPropertyStore ppProperties);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
    int GetState(out DeviceState pdwState);
  }

  [ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyStore {
    int GetCount(out uint cProps);
    int GetAt(uint iProp, out PROPERTYKEY pkey);
    int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
    int SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
    int Commit();
  }

  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(EDataFlow dataFlow, DeviceState dwStateMask, out IMMDeviceCollection ppDevices);
    int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppEndpoint);
    int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);
    int RegisterEndpointNotificationCallback(IntPtr pClient);
    int UnregisterEndpointNotificationCallback(IntPtr pClient);
  }

  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumeratorComObject {}

  [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr pNotify);
    int UnregisterControlChangeNotify(IntPtr pNotify);
    int GetChannelCount(out uint pnChannelCount);
    int SetMasterVolumeLevel(float fLevelDB, Guid pguidEventContext);
    int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
    int GetMasterVolumeLevel(out float pfLevelDB);
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int SetChannelVolumeLevel(uint nChannel, float fLevelDB, Guid pguidEventContext);
    int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, Guid pguidEventContext);
    int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
    int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
    int GetMute(out bool pbMute);
    int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);
    int VolumeStepUp(Guid pguidEventContext);
    int VolumeStepDown(Guid pguidEventContext);
    int QueryHardwareSupport(out uint pdwHardwareSupportMask);
    int GetVolumeRange(out float pflVolumeMindB, out float pflVolumeMaxdB, out float pflVolumeIncrementdB);
  }

  [ComImport, Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPolicyConfig {
    int GetMixFormat(string pszDeviceName, IntPtr ppFormat);
    int GetDeviceFormat(string pszDeviceName, int bDefault, IntPtr ppFormat);
    int ResetDeviceFormat(string pszDeviceName);
    int SetDeviceFormat(string pszDeviceName, IntPtr pEndpointFormat, IntPtr pMixFormat);
    int GetProcessingPeriod(string pszDeviceName, int bDefault, IntPtr pmftDefaultPeriod, IntPtr pmftMinimumPeriod);
    int SetProcessingPeriod(string pszDeviceName, IntPtr pmftPeriod);
    int GetShareMode(string pszDeviceName, IntPtr pMode);
    int SetShareMode(string pszDeviceName, IntPtr mode);
    int GetPropertyValue(string pszDeviceName, ref PROPERTYKEY key, IntPtr pv);
    int SetPropertyValue(string pszDeviceName, ref PROPERTYKEY key, IntPtr pv);
    int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, ERole role);
    int SetEndpointVisibility(string pszDeviceName, int bVisible);
  }

  [ComImport, Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
  class PolicyConfigClient {}

  public class DeviceInfo {
    public string id;
    public string name;
    public bool isDefault;
  }

  public static class Core {
    static readonly PROPERTYKEY Friendly = new PROPERTYKEY(new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"), 14);
    static IMMDeviceEnumerator Enumerator() { return (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject()); }

    static string Name(IMMDevice d) {
      IPropertyStore store; d.OpenPropertyStore(0, out store);
      PROPVARIANT pv; var key = Friendly; store.GetValue(ref key, out pv);
      return pv.AsString() ?? "";
    }

    static string Id(IMMDevice d) { string id; d.GetId(out id); return id; }

    static IMMDevice Default(EDataFlow flow) {
      IMMDevice d; Enumerator().GetDefaultAudioEndpoint(flow, ERole.Multimedia, out d); return d;
    }

    static IAudioEndpointVolume EndpointVolume(IMMDevice d) {
      Guid iid = typeof(IAudioEndpointVolume).GUID; object o;
      d.Activate(ref iid, CLSCTX.ALL, IntPtr.Zero, out o);
      return (IAudioEndpointVolume)o;
    }

    public static DeviceInfo[] List(EDataFlow flow) {
      var e = Enumerator(); IMMDeviceCollection c;
      e.EnumAudioEndpoints(flow, DeviceState.Active, out c);
      uint n; c.GetCount(out n);
      string def = "";
      try { def = Id(Default(flow)); } catch {}
      var list = new List<DeviceInfo>();
      for (uint i=0;i<n;i++) {
        IMMDevice d; c.Item(i, out d);
        var id = Id(d);
        list.Add(new DeviceInfo { id=id, name=Name(d), isDefault=(id==def) });
      }
      return list.ToArray();
    }

    public static DeviceInfo GetDefault(EDataFlow flow) {
      var d = Default(flow);
      return new DeviceInfo { id=Id(d), name=Name(d), isDefault=true };
    }

    public static DeviceInfo SetDefault(EDataFlow flow, string match) {
      var list = List(flow);
      DeviceInfo hit = null;
      foreach (var d in list) if (string.Equals(d.name, match, StringComparison.OrdinalIgnoreCase) || string.Equals(d.id, match, StringComparison.OrdinalIgnoreCase)) { hit=d; break; }
      if (hit == null) foreach (var d in list) if ((d.name ?? "").IndexOf(match ?? "", StringComparison.OrdinalIgnoreCase) >= 0) { hit=d; break; }
      if (hit == null) throw new Exception("Audio device not found: " + match);
      var p = (IPolicyConfig)(new PolicyConfigClient());
      p.SetDefaultEndpoint(hit.id, ERole.Console);
      p.SetDefaultEndpoint(hit.id, ERole.Multimedia);
      p.SetDefaultEndpoint(hit.id, ERole.Communications);
      return hit;
    }

    public static DeviceInfo Cycle(EDataFlow flow, int step) {
      var list = List(flow);
      if (list.Length == 0) throw new Exception("No active audio devices");
      int idx = 0;
      for (int i=0;i<list.Length;i++) if (list[i].isDefault) { idx=i; break; }
      int next = ((idx + step) % list.Length + list.Length) % list.Length;
      return SetDefault(flow, list[next].id);
    }

    public static bool GetMute(EDataFlow flow) {
      bool muted; EndpointVolume(Default(flow)).GetMute(out muted); return muted;
    }

    public static void SetMute(EDataFlow flow, bool muted) {
      EndpointVolume(Default(flow)).SetMute(muted, Guid.Empty);
    }

    public static bool ToggleMute(EDataFlow flow) {
      bool next = !GetMute(flow); SetMute(flow, next); return next;
    }

    public static int GetVolume(EDataFlow flow) {
      float v; EndpointVolume(Default(flow)).GetMasterVolumeLevelScalar(out v); return (int)Math.Round(v*100);
    }

    public static int SetVolume(EDataFlow flow, int value) {
      value = Math.Max(0, Math.Min(100, value));
      EndpointVolume(Default(flow)).SetMasterVolumeLevelScalar(value/100f, Guid.Empty);
      return value;
    }

    public static int AdjustVolume(EDataFlow flow, int delta) {
      return SetVolume(flow, GetVolume(flow) + delta);
    }
  }
}
'@
}

$df = if ($Flow -eq "input") { [PackRatAudio.EDataFlow]::Capture } else { [PackRatAudio.EDataFlow]::Render }

switch ($Action) {
  "List" {
    $out = [PackRatAudio.Core]::List($df)
    $out | ConvertTo-Json -Compress -Depth 4
  }
  "State" {
    $o = [PackRatAudio.Core]::GetDefault([PackRatAudio.EDataFlow]::Render)
    $i = [PackRatAudio.Core]::GetDefault([PackRatAudio.EDataFlow]::Capture)
    [pscustomobject]@{
      output = $o.name
      input = $i.name
      volume = [PackRatAudio.Core]::GetVolume([PackRatAudio.EDataFlow]::Render)
      inputVolume = [PackRatAudio.Core]::GetVolume([PackRatAudio.EDataFlow]::Capture)
      micMuted = [PackRatAudio.Core]::GetMute([PackRatAudio.EDataFlow]::Capture)
    } | ConvertTo-Json -Compress
  }
  "Switch" {
    if (-not $Match) { throw "Match is required for Switch" }
    [PackRatAudio.Core]::SetDefault($df, $Match) | ConvertTo-Json -Compress
  }
  "Cycle" {
    [PackRatAudio.Core]::Cycle($df, $Step) | ConvertTo-Json -Compress
  }
  "MicToggle" {
    [pscustomobject]@{ micMuted = [PackRatAudio.Core]::ToggleMute([PackRatAudio.EDataFlow]::Capture) } | ConvertTo-Json -Compress
  }
  "MicSet" {
    $m = $Muted -match '^(1|true|yes|on)$'
    [PackRatAudio.Core]::SetMute([PackRatAudio.EDataFlow]::Capture, $m)
    [pscustomobject]@{ micMuted = $m } | ConvertTo-Json -Compress
  }
  "VolumeSet" {
    [pscustomobject]@{ volume = [PackRatAudio.Core]::SetVolume($df, $Value) } | ConvertTo-Json -Compress
  }
  "VolumeAdjust" {
    [pscustomobject]@{ volume = [PackRatAudio.Core]::AdjustVolume($df, $Value) } | ConvertTo-Json -Compress
  }
}

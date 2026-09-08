using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;

namespace PackRatAppAudio {
  public enum EDataFlow { Render = 0, Capture = 1, All = 2 }
  public enum ERole { Console = 0, Multimedia = 1, Communications = 2 }
  [Flags] public enum DeviceState : uint { Active = 1, Disabled = 2, NotPresent = 4, Unplugged = 8, All = 15 }
  [Flags] public enum CLSCTX : uint { INPROC_SERVER = 1, INPROC_HANDLER = 2, LOCAL_SERVER = 4, REMOTE_SERVER = 16, ALL = 23 }
  public enum AudioSessionState { Inactive = 0, Active = 1, Expired = 2 }

  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, CLSCTX dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    int OpenPropertyStore(int stgmAccess, IntPtr ppProperties);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
    int GetState(out DeviceState pdwState);
  }

  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(EDataFlow dataFlow, DeviceState dwStateMask, IntPtr ppDevices);
    int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppEndpoint);
    int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);
    int RegisterEndpointNotificationCallback(IntPtr pClient);
    int UnregisterEndpointNotificationCallback(IntPtr pClient);
  }

  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumeratorComObject { }

  [ComImport, Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionControl {
    int GetState(out AudioSessionState pRetVal);
    int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
    int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
    int GetGroupingParam(out Guid pRetVal);
    int SetGroupingParam(ref Guid Override, ref Guid EventContext);
    int RegisterAudioSessionNotification(IntPtr NewNotifications);
    int UnregisterAudioSessionNotification(IntPtr NewNotifications);
  }

  [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionControl2 {
    int GetState(out AudioSessionState pRetVal);
    int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
    int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, ref Guid EventContext);
    int GetGroupingParam(out Guid pRetVal);
    int SetGroupingParam(ref Guid Override, ref Guid EventContext);
    int RegisterAudioSessionNotification(IntPtr NewNotifications);
    int UnregisterAudioSessionNotification(IntPtr NewNotifications);
    int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int GetProcessId(out uint pRetVal);
    int IsSystemSoundsSession();
    int SetDuckingPreference([MarshalAs(UnmanagedType.Bool)] bool optOut);
  }

  [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface ISimpleAudioVolume {
    int SetMasterVolume(float fLevel, ref Guid EventContext);
    int GetMasterVolume(out float pfLevel);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid EventContext);
    int GetMute(out bool pbMute);
  }

  [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionEnumerator {
    int GetCount(out int SessionCount);
    int GetSession(int SessionCount, out IAudioSessionControl Session);
  }

  [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionManager2 {
    int GetAudioSessionControl(ref Guid AudioSessionGuid, uint StreamFlags, out IAudioSessionControl SessionControl);
    int GetSimpleAudioVolume(ref Guid AudioSessionGuid, uint StreamFlags, out ISimpleAudioVolume AudioVolume);
    int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
    int RegisterSessionNotification(IntPtr SessionNotification);
    int UnregisterSessionNotification(IntPtr SessionNotification);
    int RegisterDuckNotification([MarshalAs(UnmanagedType.LPWStr)] string sessionID, IntPtr duckNotification);
    int UnregisterDuckNotification(IntPtr duckNotification);
  }

  public sealed class SessionInfo {
    public int pid;
    public string process;
    public string displayName;
    public string sessionIdentifier;
    public int volume;
    public bool muted;
    public string state;
  }

  internal sealed class SessionHandle : IDisposable {
    public IAudioSessionControl Control;
    public IAudioSessionControl2 Control2;
    public ISimpleAudioVolume Volume;
    public SessionInfo Info;
    public void Dispose() {
      Release(Volume); Release(Control2); Release(Control);
      Volume = null; Control2 = null; Control = null;
    }
    static void Release(object o) {
      if (o != null && Marshal.IsComObject(o)) {
        try { Marshal.ReleaseComObject(o); } catch { }
      }
    }
  }

  public static class Core {
    static IMMDeviceEnumerator Enumerator() { return (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject()); }

    static IMMDevice DefaultOutput() {
      IMMDevice d;
      int hr = Enumerator().GetDefaultAudioEndpoint(EDataFlow.Render, ERole.Multimedia, out d);
      if (hr != 0 || d == null) Marshal.ThrowExceptionForHR(hr);
      return d;
    }

    static IAudioSessionManager2 Manager(IMMDevice d) {
      Guid iid = typeof(IAudioSessionManager2).GUID;
      object o;
      int hr = d.Activate(ref iid, CLSCTX.ALL, IntPtr.Zero, out o);
      if (hr != 0 || o == null) Marshal.ThrowExceptionForHR(hr);
      return (IAudioSessionManager2)o;
    }

    static string ProcessName(uint pid) {
      if (pid == 0) return "System Sounds";
      try { return Process.GetProcessById((int)pid).ProcessName; }
      catch { return "PID " + pid; }
    }

    static IEnumerable<SessionHandle> EnumerateHandles() {
      IMMDevice device = null;
      IAudioSessionManager2 manager = null;
      IAudioSessionEnumerator sessions = null;
      try {
        device = DefaultOutput();
        manager = Manager(device);
        int hr = manager.GetSessionEnumerator(out sessions);
        if (hr != 0 || sessions == null) Marshal.ThrowExceptionForHR(hr);
        int count; sessions.GetCount(out count);
        for (int i = 0; i < count; i++) {
          IAudioSessionControl control = null;
          try {
            sessions.GetSession(i, out control);
            if (control == null) continue;
            var control2 = (IAudioSessionControl2)control;
            var volume = (ISimpleAudioVolume)control;
            uint pid; control2.GetProcessId(out pid);
            float level; volume.GetMasterVolume(out level);
            bool muted; volume.GetMute(out muted);
            AudioSessionState state; control.GetState(out state);
            string display = "", identifier = "";
            try { control.GetDisplayName(out display); } catch { }
            try { control2.GetSessionIdentifier(out identifier); } catch { }
            var handle = new SessionHandle {
              Control = control,
              Control2 = control2,
              Volume = volume,
              Info = new SessionInfo {
                pid = (int)pid,
                process = ProcessName(pid),
                displayName = display ?? "",
                sessionIdentifier = identifier ?? "",
                volume = (int)Math.Round(Math.Max(0, Math.Min(1, level)) * 100),
                muted = muted,
                state = state.ToString()
              }
            };
            control = null;
            yield return handle;
          } finally {
            if (control != null && Marshal.IsComObject(control)) try { Marshal.ReleaseComObject(control); } catch { }
          }
        }
      } finally {
        if (sessions != null && Marshal.IsComObject(sessions)) try { Marshal.ReleaseComObject(sessions); } catch { }
        if (manager != null && Marshal.IsComObject(manager)) try { Marshal.ReleaseComObject(manager); } catch { }
        if (device != null && Marshal.IsComObject(device)) try { Marshal.ReleaseComObject(device); } catch { }
      }
    }

    static bool Match(SessionInfo s, string match) {
      if (String.IsNullOrWhiteSpace(match)) return false;
      int pid;
      if (Int32.TryParse(match, out pid) && s.pid == pid) return true;
      return String.Equals(s.process, match, StringComparison.OrdinalIgnoreCase)
          || (!String.IsNullOrEmpty(s.displayName) && s.displayName.IndexOf(match, StringComparison.OrdinalIgnoreCase) >= 0)
          || (!String.IsNullOrEmpty(s.process) && s.process.IndexOf(match, StringComparison.OrdinalIgnoreCase) >= 0);
    }

    public static SessionInfo[] List() {
      var result = new List<SessionInfo>();
      foreach (var h in EnumerateHandles()) using (h) result.Add(h.Info);
      return result.OrderBy(x => x.process, StringComparer.OrdinalIgnoreCase).ThenBy(x => x.pid).ToArray();
    }

    public static SessionInfo[] Find(string match) { return List().Where(x => Match(x, match)).ToArray(); }

    public static int SetVolume(string match, int value) {
      value = Math.Max(0, Math.Min(100, value));
      int changed = 0; Guid context = Guid.Empty;
      foreach (var h in EnumerateHandles()) using (h) {
        if (!Match(h.Info, match)) continue;
        h.Volume.SetMasterVolume(value / 100f, ref context); changed++;
      }
      if (changed == 0) throw new InvalidOperationException("No active audio session matched: " + match);
      return changed;
    }

    public static int AdjustVolume(string match, int delta) {
      int changed = 0; Guid context = Guid.Empty;
      foreach (var h in EnumerateHandles()) using (h) {
        if (!Match(h.Info, match)) continue;
        float current; h.Volume.GetMasterVolume(out current);
        float next = Math.Max(0, Math.Min(1, current + delta / 100f));
        h.Volume.SetMasterVolume(next, ref context); changed++;
      }
      if (changed == 0) throw new InvalidOperationException("No active audio session matched: " + match);
      return changed;
    }

    public static int SetMute(string match, bool muted) {
      int changed = 0; Guid context = Guid.Empty;
      foreach (var h in EnumerateHandles()) using (h) {
        if (!Match(h.Info, match)) continue;
        h.Volume.SetMute(muted, ref context); changed++;
      }
      if (changed == 0) throw new InvalidOperationException("No active audio session matched: " + match);
      return changed;
    }

    public static int ToggleMute(string match) {
      int changed = 0; Guid context = Guid.Empty;
      foreach (var h in EnumerateHandles()) using (h) {
        if (!Match(h.Info, match)) continue;
        bool current; h.Volume.GetMute(out current);
        h.Volume.SetMute(!current, ref context); changed++;
      }
      if (changed == 0) throw new InvalidOperationException("No active audio session matched: " + match);
      return changed;
    }
  }
}

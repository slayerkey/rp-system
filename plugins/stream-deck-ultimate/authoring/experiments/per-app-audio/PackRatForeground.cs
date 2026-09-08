using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace PackRatAppAudio {
  public sealed class ForegroundInfo {
    public int pid;
    public string process;
  }

  public static class Foreground {
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    public static ForegroundInfo Get() {
      try {
        IntPtr window = GetForegroundWindow();
        if (window == IntPtr.Zero) return new ForegroundInfo { pid = 0, process = "" };
        uint processId;
        GetWindowThreadProcessId(window, out processId);
        if (processId == 0) return new ForegroundInfo { pid = 0, process = "" };
        string process = "";
        try { process = Process.GetProcessById((int)processId).ProcessName ?? ""; }
        catch { process = ""; }
        return new ForegroundInfo { pid = (int)processId, process = process };
      } catch {
        return new ForegroundInfo { pid = 0, process = "" };
      }
    }
  }
}

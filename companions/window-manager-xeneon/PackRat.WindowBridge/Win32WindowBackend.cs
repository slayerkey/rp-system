using System.Collections.Concurrent;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;

namespace PackRat.WindowBridge;

public sealed class Win32WindowBackend : IWindowBackend
{
    private readonly ConcurrentDictionary<string, string> _iconCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly WindowEventWatcher _watcher;

    public event Action? Changed;

    public Win32WindowBackend()
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("PackRat Window Bridge requires Windows.");
        _watcher = new WindowEventWatcher(() => Changed?.Invoke());
    }

    public WindowSnapshot ReadSnapshot(int protocol)
    {
        var monitorEntries = EnumerateMonitors();
        var monitorModels = monitorEntries.Select((entry, index) =>
            new MonitorModel(
                entry.Id,
                $"Monitor {index + 1}",
                entry.Bounds.Left,
                entry.Bounds.Top,
                entry.Bounds.Width,
                entry.Bounds.Height,
                entry.Work.Left,
                entry.Work.Top,
                entry.Work.Width,
                entry.Work.Height,
                entry.Primary)).ToArray();

        var monitorIds = monitorEntries.ToDictionary(entry => entry.Handle, entry => entry.Id);
        var windows = new List<WindowModel>();

        Native.EnumWindows((hwnd, _) =>
        {
            try
            {
                if (TryBuildWindow(hwnd, monitorIds, out var window)) windows.Add(window);
            }
            catch
            {
                // One inaccessible/elevated process must never hide the rest of the desktop.
            }
            return true;
        }, IntPtr.Zero);

        var foreground = Native.GetForegroundWindow();
        var activeId = foreground != IntPtr.Zero
            ? foreground.ToInt64().ToString(CultureInfo.InvariantCulture)
            : null;
        if (activeId is not null && windows.All(w => w.Id != activeId)) activeId = null;

        return new WindowSnapshot(protocol, activeId, monitorModels, windows);
    }

    public void Execute(string command, string windowId, string? monitorId)
    {
        if (!long.TryParse(windowId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value))
            throw new ArgumentException("Invalid window id.");
        var hwnd = new IntPtr(value);
        if (!Native.IsWindow(hwnd)) throw new ArgumentException("Window is no longer available.");

        var monitors = EnumerateMonitors();
        var ids = monitors.ToDictionary(entry => entry.Handle, entry => entry.Id);
        if (!TryBuildWindow(hwnd, ids, out _))
            throw new ArgumentException("Window is no longer managed by Window Bridge.");

        switch (command)
        {
            case "focus":
                Focus(hwnd);
                return;
            case "minimize":
                Native.ShowWindow(hwnd, Native.SW_MINIMIZE);
                return;
            case "maximize_restore":
                Native.ShowWindow(hwnd, Native.IsZoomed(hwnd) ? Native.SW_RESTORE : Native.SW_MAXIMIZE);
                return;
            case "snap_left":
                Snap(hwnd, monitors, true);
                return;
            case "snap_right":
                Snap(hwnd, monitors, false);
                return;
            case "move_monitor":
                if (string.IsNullOrWhiteSpace(monitorId)) throw new ArgumentException("Missing monitor id.");
                MoveToMonitor(hwnd, monitors, monitorId);
                return;
            case "close":
                if (!Native.PostMessage(hwnd, Native.WM_CLOSE, IntPtr.Zero, IntPtr.Zero))
                    throw new InvalidOperationException("Windows rejected the close request.");
                return;
            default:
                throw new ArgumentException("Unknown window command.");
        }
    }

    private void Focus(IntPtr hwnd)
    {
        if (Native.IsIconic(hwnd)) Native.ShowWindow(hwnd, Native.SW_RESTORE);
        if (!Native.SetForegroundWindow(hwnd))
            throw new InvalidOperationException("Windows refused foreground activation. Foreground-lock or elevation rules may apply.");
    }

    private static void Snap(IntPtr hwnd, IReadOnlyList<MonitorEntry> monitors, bool left)
    {
        var currentHandle = Native.MonitorFromWindow(hwnd, Native.MONITOR_DEFAULTTONEAREST);
        var current = monitors.FirstOrDefault(m => m.Handle == currentHandle)
            ?? throw new InvalidOperationException("Unable to resolve the window monitor.");
        Native.ShowWindow(hwnd, Native.SW_RESTORE);
        var model = new MonitorModel(current.Id, current.Id, current.Bounds.Left, current.Bounds.Top, current.Bounds.Width, current.Bounds.Height,
            current.Work.Left, current.Work.Top, current.Work.Width, current.Work.Height, current.Primary);
        var target = WindowGeometry.Snap(model, left);
        if (!Native.SetWindowPos(hwnd, IntPtr.Zero, target.X, target.Y, target.Width, target.Height, Native.SWP_NOZORDER))
            throw new InvalidOperationException("Windows rejected the snap request.");
        Native.SetForegroundWindow(hwnd);
    }

    private static void MoveToMonitor(IntPtr hwnd, IReadOnlyList<MonitorEntry> monitors, string monitorId)
    {
        var target = monitors.FirstOrDefault(m => string.Equals(m.Id, monitorId, StringComparison.Ordinal));
        if (target is null) throw new ArgumentException("Monitor is no longer available.");

        var sourceHandle = Native.MonitorFromWindow(hwnd, Native.MONITOR_DEFAULTTONEAREST);
        var source = monitors.FirstOrDefault(m => m.Handle == sourceHandle)
            ?? throw new InvalidOperationException("Unable to resolve the current monitor.");

        var wasMinimized = Native.IsIconic(hwnd);
        var wasMaximized = Native.IsZoomed(hwnd);
        Native.ShowWindow(hwnd, Native.SW_RESTORE);

        if (!Native.GetWindowRect(hwnd, out var rect))
            throw new InvalidOperationException("Unable to read the window bounds.");

        var sourceModel = ToModel(source);
        var targetModel = ToModel(target);
        var next = WindowGeometry.MoveToMonitor(
            new WindowRect(rect.Left, rect.Top, Math.Max(1, rect.Right - rect.Left), Math.Max(1, rect.Bottom - rect.Top)),
            sourceModel,
            targetModel);

        if (!Native.SetWindowPos(hwnd, IntPtr.Zero, next.X, next.Y, next.Width, next.Height, Native.SWP_NOZORDER))
            throw new InvalidOperationException("Windows rejected the monitor move.");

        if (wasMaximized) Native.ShowWindow(hwnd, Native.SW_MAXIMIZE);
        else if (wasMinimized) Native.ShowWindow(hwnd, Native.SW_MINIMIZE);
    }

    private static MonitorModel ToModel(MonitorEntry entry) =>
        new(entry.Id, entry.Id, entry.Bounds.Left, entry.Bounds.Top, entry.Bounds.Width, entry.Bounds.Height,
            entry.Work.Left, entry.Work.Top, entry.Work.Width, entry.Work.Height, entry.Primary);

    private bool TryBuildWindow(IntPtr hwnd, IReadOnlyDictionary<IntPtr, string> monitorIds, out WindowModel window)
    {
        window = default!;
        if (hwnd == IntPtr.Zero || !Native.IsWindowVisible(hwnd)) return false;

        var className = new StringBuilder(128);
        Native.GetClassName(hwnd, className, className.Capacity);
        if (className.ToString() is "Progman" or "WorkerW") return false;

        var exStyle = Native.GetWindowLongPtr(hwnd, Native.GWL_EXSTYLE).ToInt64();
        if ((exStyle & Native.WS_EX_TOOLWINDOW) != 0) return false;

        if (Native.DwmGetWindowAttribute(hwnd, Native.DWMWA_CLOAKED, out var cloaked, sizeof(int)) == 0 && cloaked != 0)
            return false;

        var length = Native.GetWindowTextLength(hwnd);
        if (length <= 0) return false;
        var titleBuilder = new StringBuilder(Math.Min(length + 1, 8192));
        Native.GetWindowText(hwnd, titleBuilder, titleBuilder.Capacity);
        var title = titleBuilder.ToString().Trim();
        if (title.Length == 0) return false;

        Native.GetWindowThreadProcessId(hwnd, out var processId);
        if (processId == 0 || processId == Environment.ProcessId) return false;

        string processName = "Application";
        string processPath = "";
        string appName = "Application";

        try
        {
            using var process = Process.GetProcessById((int)processId);
            processName = string.IsNullOrWhiteSpace(process.ProcessName) ? processName : process.ProcessName;
            try { processPath = process.MainModule?.FileName ?? ""; } catch { }
            appName = ResolveAppName(processPath, processName);
        }
        catch
        {
            appName = processName;
        }

        var monitorHandle = Native.MonitorFromWindow(hwnd, Native.MONITOR_DEFAULTTONEAREST);
        var monitorId = monitorIds.TryGetValue(monitorHandle, out var id) ? id : "";
        var state = Native.IsIconic(hwnd) ? "minimized" : Native.IsZoomed(hwnd) ? "maximized" : "normal";
        var appKey = !string.IsNullOrWhiteSpace(processPath) ? processPath.ToLowerInvariant() : processName.ToLowerInvariant();
        var icon = ResolveIcon(processPath);

        window = new WindowModel(
            hwnd.ToInt64().ToString(CultureInfo.InvariantCulture),
            appKey,
            appName,
            processName,
            title.Length > 4096 ? title[..4096] : title,
            state,
            monitorId,
            icon);
        return true;
    }

    private static string ResolveAppName(string processPath, string processName)
    {
        if (!string.IsNullOrWhiteSpace(processPath))
        {
            try
            {
                var info = FileVersionInfo.GetVersionInfo(processPath);
                foreach (var value in new[] { info.FileDescription, info.ProductName })
                    if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
            }
            catch { }
        }
        return processName;
    }

    private string ResolveIcon(string processPath)
    {
        if (string.IsNullOrWhiteSpace(processPath) || !File.Exists(processPath)) return "";
        return _iconCache.GetOrAdd(processPath, static path =>
        {
            try
            {
                using var icon = Icon.ExtractAssociatedIcon(path);
                if (icon is null) return "";
                using var bitmap = icon.ToBitmap();
                using var stream = new MemoryStream();
                bitmap.Save(stream, ImageFormat.Png);
                return "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
            }
            catch
            {
                return "";
            }
        });
    }

    private static List<MonitorEntry> EnumerateMonitors()
    {
        var list = new List<MonitorEntry>();
        Native.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr handle, IntPtr hdc, ref Native.RECT monitorRect, IntPtr data) =>
        {
            var info = new Native.MONITORINFOEX { cbSize = Marshal.SizeOf<Native.MONITORINFOEX>(), szDevice = "" };
            if (Native.GetMonitorInfo(handle, ref info))
            {
                var id = string.IsNullOrWhiteSpace(info.szDevice)
                    ? handle.ToInt64().ToString(CultureInfo.InvariantCulture)
                    : info.szDevice;
                list.Add(new MonitorEntry(
                    handle,
                    id,
                    RectData.From(info.rcMonitor),
                    RectData.From(info.rcWork),
                    (info.dwFlags & Native.MONITORINFOF_PRIMARY) != 0));
            }
            return true;
        }, IntPtr.Zero);

        list.Sort((a, b) =>
        {
            var primary = b.Primary.CompareTo(a.Primary);
            if (primary != 0) return primary;
            var x = a.Bounds.Left.CompareTo(b.Bounds.Left);
            return x != 0 ? x : a.Bounds.Top.CompareTo(b.Bounds.Top);
        });
        return list;
    }

    public void Dispose() => _watcher.Dispose();

    private sealed record MonitorEntry(IntPtr Handle, string Id, RectData Bounds, RectData Work, bool Primary);
    private readonly record struct RectData(int Left, int Top, int Width, int Height)
    {
        public static RectData From(Native.RECT value) =>
            new(value.Left, value.Top, Math.Max(1, value.Right - value.Left), Math.Max(1, value.Bottom - value.Top));
    }
}

internal sealed class WindowEventWatcher : IDisposable
{
    private readonly Action _changed;
    private readonly Thread _thread;
    private readonly ManualResetEventSlim _ready = new(false);
    private readonly List<IntPtr> _hooks = [];
    private readonly Native.WinEventDelegate _callback;
    private Exception? _startupError;
    private uint _threadId;
    private bool _disposed;

    public WindowEventWatcher(Action changed)
    {
        _changed = changed;
        _callback = OnWinEvent;
        _thread = new Thread(Run) { IsBackground = true, Name = "PackRat Window Bridge WinEvent" };
        _thread.Start();
        if (!_ready.Wait(TimeSpan.FromSeconds(5)))
            throw new InvalidOperationException("Windows event watcher did not start.");
        if (_startupError is not null)
            throw new InvalidOperationException("Windows event watcher failed to start.", _startupError);
    }

    private void Run()
    {
        try
        {
            _threadId = Native.GetCurrentThreadId();
            _hooks.Add(Native.SetWinEventHook(
                Native.EVENT_SYSTEM_FOREGROUND,
                Native.EVENT_SYSTEM_FOREGROUND,
                IntPtr.Zero,
                _callback,
                0,
                0,
                Native.WINEVENT_OUTOFCONTEXT));
            _hooks.Add(Native.SetWinEventHook(
                Native.EVENT_OBJECT_DESTROY,
                Native.EVENT_OBJECT_NAMECHANGE,
                IntPtr.Zero,
                _callback,
                0,
                0,
                Native.WINEVENT_OUTOFCONTEXT));

            if (_hooks.Any(hook => hook == IntPtr.Zero))
                throw new InvalidOperationException("SetWinEventHook returned null.");

            _ready.Set();
            while (Native.GetMessage(out var message, IntPtr.Zero, 0, 0) > 0)
            {
                Native.TranslateMessage(ref message);
                Native.DispatchMessage(ref message);
            }
        }
        catch (Exception ex)
        {
            _startupError = ex;
            _ready.Set();
        }
        finally
        {
            foreach (var hook in _hooks.Where(hook => hook != IntPtr.Zero))
                Native.UnhookWinEvent(hook);
            _hooks.Clear();
        }
    }

    private void OnWinEvent(IntPtr hook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint eventThread, uint eventTime)
    {
        if (eventType == Native.EVENT_SYSTEM_FOREGROUND || idObject == Native.OBJID_WINDOW)
        {
            try { _changed(); } catch { }
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        if (_threadId != 0) Native.PostThreadMessage(_threadId, Native.WM_QUIT, IntPtr.Zero, IntPtr.Zero);
        if (_thread.IsAlive) _thread.Join(TimeSpan.FromSeconds(2));
        _ready.Dispose();
    }
}

internal static class Native
{
    public const int GWL_EXSTYLE = -20;
    public const long WS_EX_TOOLWINDOW = 0x00000080L;
    public const int DWMWA_CLOAKED = 14;
    public const uint MONITOR_DEFAULTTONEAREST = 2;
    public const uint MONITORINFOF_PRIMARY = 1;
    public const int SW_MINIMIZE = 6;
    public const int SW_MAXIMIZE = 3;
    public const int SW_RESTORE = 9;
    public const uint SWP_NOZORDER = 0x0004;
    public const uint WM_CLOSE = 0x0010;
    public const uint WM_QUIT = 0x0012;
    public const uint EVENT_SYSTEM_FOREGROUND = 0x0003;
    public const uint EVENT_OBJECT_DESTROY = 0x8001;
    public const uint EVENT_OBJECT_NAMECHANGE = 0x800C;
    public const uint WINEVENT_OUTOFCONTEXT = 0x0000;
    public const int OBJID_WINDOW = 0;

    public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
    public delegate bool MonitorEnumProc(IntPtr monitor, IntPtr hdc, ref RECT rect, IntPtr data);
    public delegate void WinEventDelegate(IntPtr hook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint eventThread, uint eventTime);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct MONITORINFOEX
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string szDevice;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X, Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public UIntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public POINT pt;
        public uint lPrivate;
    }

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc callback, IntPtr data);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFOEX info);

    [DllImport("user32.dll")]
    public static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hwnd, int command);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowTextLength(IntPtr hwnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int maxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hwnd, StringBuilder className, int maxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    public static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out int value, int size);

    [DllImport("user32.dll")]
    public static extern IntPtr SetWinEventHook(uint eventMin, uint eventMax, IntPtr module, WinEventDelegate callback, uint processId, uint threadId, uint flags);

    [DllImport("user32.dll")]
    public static extern bool UnhookWinEvent(IntPtr hook);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern int GetMessage(out MSG message, IntPtr hwnd, uint min, uint max);

    [DllImport("user32.dll")]
    public static extern bool TranslateMessage(ref MSG message);

    [DllImport("user32.dll")]
    public static extern IntPtr DispatchMessage(ref MSG message);

    [DllImport("user32.dll")]
    public static extern bool PostThreadMessage(uint threadId, uint message, IntPtr wParam, IntPtr lParam);
}

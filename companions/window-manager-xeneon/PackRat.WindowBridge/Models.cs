using System.Text.Json.Serialization;

namespace PackRat.WindowBridge;

public sealed record MonitorModel(
    string Id,
    string Name,
    int Left,
    int Top,
    int Width,
    int Height,
    int WorkLeft,
    int WorkTop,
    int WorkWidth,
    int WorkHeight,
    bool Primary);

public sealed record WindowModel(
    string Id,
    string AppKey,
    string AppName,
    string ProcessName,
    string Title,
    string State,
    string MonitorId,
    string IconDataUri);

public sealed record WindowSnapshot(
    int Protocol,
    string? ActiveWindowId,
    IReadOnlyList<MonitorModel> Monitors,
    IReadOnlyList<WindowModel> Windows,
    string? Error = null)
{
    [JsonPropertyName("type")]
    public string Type => "snapshot";
}

public readonly record struct WindowRect(int X, int Y, int Width, int Height);

public interface IWindowBackend : IDisposable
{
    event Action? Changed;
    WindowSnapshot ReadSnapshot(int protocol);
    void Execute(string command, string windowId, string? monitorId);
}

public static class WindowGeometry
{
    public static WindowRect Snap(MonitorModel monitor, bool left)
    {
        var leftWidth = Math.Max(1, monitor.WorkWidth / 2);
        var rightWidth = Math.Max(1, monitor.WorkWidth - leftWidth);
        return left
            ? new WindowRect(monitor.WorkLeft, monitor.WorkTop, leftWidth, monitor.WorkHeight)
            : new WindowRect(monitor.WorkLeft + leftWidth, monitor.WorkTop, rightWidth, monitor.WorkHeight);
    }

    public static WindowRect MoveToMonitor(WindowRect window, MonitorModel source, MonitorModel target)
    {
        var width = Math.Clamp(window.Width, 1, Math.Max(1, target.WorkWidth));
        var height = Math.Clamp(window.Height, 1, Math.Max(1, target.WorkHeight));

        var sourceSpanX = Math.Max(1, source.WorkWidth - Math.Min(window.Width, source.WorkWidth));
        var sourceSpanY = Math.Max(1, source.WorkHeight - Math.Min(window.Height, source.WorkHeight));
        var relX = Math.Clamp((double)(window.X - source.WorkLeft) / sourceSpanX, 0, 1);
        var relY = Math.Clamp((double)(window.Y - source.WorkTop) / sourceSpanY, 0, 1);

        var targetSpanX = Math.Max(0, target.WorkWidth - width);
        var targetSpanY = Math.Max(0, target.WorkHeight - height);
        var x = target.WorkLeft + (int)Math.Round(relX * targetSpanX);
        var y = target.WorkTop + (int)Math.Round(relY * targetSpanY);

        return new WindowRect(x, y, width, height);
    }
}

public sealed class FakeWindowBackend : IWindowBackend
{
    private readonly object _gate = new();
    private readonly List<MonitorModel> _monitors =
    [
        new("MONITOR-1", "Main Display", 0, 0, 2560, 1440, 0, 0, 2560, 1400, true),
        new("MONITOR-2", "Side Display", 2560, 0, 1920, 1080, 2560, 0, 1920, 1040, false),
        new("MONITOR-3", "Portrait", -1080, 0, 1080, 1920, -1080, 0, 1080, 1880, false),
        new("MONITOR-4", "Studio Ultrawide", 4480, 0, 3440, 1440, 4480, 0, 3440, 1400, false),
    ];

    private readonly List<WindowModel> _windows =
    [
        new("101", "browser", "Browser", "browser", "Creator Dashboard — Analytics", "normal", "MONITOR-1", ""),
        new("102", "editor", "Editor", "editor", "window-manager-xeneon — rp-system", "maximized", "MONITOR-1", ""),
        new("103", "terminal", "Terminal", "terminal", "PackRat build output", "normal", "MONITOR-2", ""),
        new("104", "mail", "Mail", "mail", "Support inbox — 7 unread", "normal", "MONITOR-2", ""),
        new("105", "music", "Music", "music", "Focus Mix", "minimized", "MONITOR-1", ""),
        new("106", "notes", "Notes", "notes", "<b>not markup</b> — 日本語 🎮 gyqp", "normal", "MONITOR-4", ""),
    ];

    private string? _active = "102";

    public event Action? Changed;

    public WindowSnapshot ReadSnapshot(int protocol)
    {
        lock (_gate)
        {
            return new WindowSnapshot(protocol, _active, _monitors.ToArray(), _windows.ToArray());
        }
    }

    public void Execute(string command, string windowId, string? monitorId)
    {
        lock (_gate)
        {
            var index = _windows.FindIndex(w => w.Id == windowId);
            if (index < 0) throw new ArgumentException("Window is no longer available.");
            var window = _windows[index];

            switch (command)
            {
                case "focus":
                    window = window with { State = window.State == "minimized" ? "normal" : window.State };
                    _active = window.Id;
                    break;
                case "minimize":
                    window = window with { State = "minimized" };
                    if (_active == window.Id) _active = null;
                    break;
                case "maximize_restore":
                    window = window with { State = window.State == "maximized" ? "normal" : "maximized" };
                    _active = window.Id;
                    break;
                case "snap_left":
                case "snap_right":
                    window = window with { State = "normal" };
                    _active = window.Id;
                    break;
                case "move_monitor":
                    if (string.IsNullOrWhiteSpace(monitorId) || !_monitors.Any(m => m.Id == monitorId))
                        throw new ArgumentException("Monitor is no longer available.");
                    window = window with { MonitorId = monitorId };
                    _active = window.Id;
                    break;
                case "close":
                    _windows.RemoveAt(index);
                    if (_active == window.Id) _active = null;
                    Changed?.Invoke();
                    return;
                default:
                    throw new ArgumentException("Unknown window command.");
            }

            _windows[index] = window;
        }

        Changed?.Invoke();
    }

    public void Dispose() { }
}

public static class SelfTest
{
    public static int Run()
    {
        try
        {
            var monitor = new MonitorModel("A", "A", 0, 0, 1920, 1080, 0, 0, 1920, 1040, true);
            var left = WindowGeometry.Snap(monitor, true);
            var right = WindowGeometry.Snap(monitor, false);
            if (left.X != 0 || left.Width + right.Width != 1920 || right.X != left.Width || left.Height != 1040)
                throw new Exception("snap geometry failed");

            var target = new MonitorModel("B", "B", 1920, 0, 1280, 1024, 1920, 0, 1280, 984, false);
            var moved = WindowGeometry.MoveToMonitor(new WindowRect(960, 200, 900, 700), monitor, target);
            if (moved.X < target.WorkLeft || moved.Y < target.WorkTop ||
                moved.X + moved.Width > target.WorkLeft + target.WorkWidth ||
                moved.Y + moved.Height > target.WorkTop + target.WorkHeight)
                throw new Exception("move-to-monitor geometry escaped target work area");

            using var fake = new FakeWindowBackend();
            var initial = fake.ReadSnapshot(1);
            if (initial.Windows.Count != 6 || initial.Monitors.Count != 4 || initial.ActiveWindowId != "102")
                throw new Exception("fixture snapshot failed");

            fake.Execute("minimize", "102", null);
            var minimized = fake.ReadSnapshot(1);
            if (minimized.ActiveWindowId is not null || minimized.Windows.Single(w => w.Id == "102").State != "minimized")
                throw new Exception("fixture minimize/active-clear failed");

            fake.Execute("move_monitor", "103", "MONITOR-4");
            if (fake.ReadSnapshot(1).Windows.Single(w => w.Id == "103").MonitorId != "MONITOR-4")
                throw new Exception("fixture monitor move failed");

            fake.Execute("close", "103", null);
            if (fake.ReadSnapshot(1).Windows.Any(w => w.Id == "103"))
                throw new Exception("fixture close failed");

            Console.WriteLine("WINDOW BRIDGE SELF-TEST PASS: snap/move geometry, six-window/four-monitor fixture, active clear, monitor move and close");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("WINDOW BRIDGE SELF-TEST FAIL: " + ex);
            return 1;
        }
    }
}

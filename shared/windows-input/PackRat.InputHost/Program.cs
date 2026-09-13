using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace PackRat.InputHost;

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public static int Main(string[] args)
    {
        if (!OperatingSystem.IsWindows()) return 2;
        if (args.Contains("--selftest", StringComparer.OrdinalIgnoreCase))
        {
            Emit(new
            {
                ok = true,
                platform = "windows",
                inputSize = Marshal.SizeOf<Native.INPUT>(),
                emergencyStop = "Ctrl+Shift+F12",
                recoveryBeforeHooks = true,
                familySessionLock = "kernel-file-lock",
                exactHeldKeyDescriptors = true,
                sendInputChecked = true
            });
            return 0;
        }

        Native.EnableDpiAwareness();
        using var engine = new Engine();

        // Recovery is intentionally attempted before global hooks are installed.
        // If Lite/Pro currently owns the family lock, the journal is live and untouched.
        engine.RecoverBeforeHooks();
        engine.StartHooks();

        var parentPid = ReadArgInt(args, "--parent-pid");
        if (parentPid > 0 && parentPid != Environment.ProcessId)
            StartParentWatch(parentPid, engine);

        string? line;
        while ((line = Console.ReadLine()) is not null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            string id = "";
            try
            {
                using var doc = JsonDocument.Parse(line);
                var root = doc.RootElement;
                id = ReadString(root, "id");
                var command = ReadString(root, "command");
                switch (command)
                {
                    case "ping":
                        Reply(id, new
                        {
                            ok = true,
                            version = "1.0.0",
                            emergencyStop = "Ctrl+Shift+F12",
                            familySessionLock = "kernel-file-lock"
                        });
                        break;

                    case "startRecording":
                        engine.StartRecording(
                            includeMouse: ReadBool(root, "includeMouse"),
                            includeMouseMove: ReadBool(root, "includeMouseMove", true),
                            maxDurationMs: ReadInt(root, "maxDurationMs", 30000, 1000, 600000),
                            maxEvents: ReadInt(root, "maxEvents", 60, 1, 25000));
                        Reply(id, new { ok = true, started = true });
                        break;

                    case "stopRecording":
                        engine.StopRecording("manual");
                        Reply(id, new { ok = true, stopped = true });
                        break;

                    case "cancelRecording":
                        engine.CancelRecording();
                        Reply(id, new { ok = true, cancelled = true });
                        break;

                    case "play":
                        var events = root.TryGetProperty("events", out var arr) && arr.ValueKind == JsonValueKind.Array
                            ? arr.Clone()
                            : JsonDocument.Parse("[]").RootElement.Clone();
                        engine.Play(
                            events,
                            speed: ReadDouble(root, "speed", 1.0, 0.25, 4.0),
                            repeatCount: ReadInt(root, "repeatCount", 1, 0, 100),
                            coordinateMode: ReadString(root, "coordinateMode") == "active-window" ? "active-window" : "absolute");
                        Reply(id, new { ok = true, started = true });
                        break;

                    case "stopPlayback":
                        engine.StopPlayback("manual");
                        Reply(id, new { ok = true, stopped = true });
                        break;

                    case "releaseKeys":
                        var keys = new List<int>();
                        if (root.TryGetProperty("keys", out var keyArray) && keyArray.ValueKind == JsonValueKind.Array)
                            foreach (var item in keyArray.EnumerateArray())
                                if (item.TryGetInt32(out var key)) keys.Add(key);
                        engine.ReleaseTrackedKeys(keys);
                        Reply(id, new { ok = true, released = true });
                        break;

                    default:
                        Reply(id, new { ok = false, error = "Unknown command." });
                        break;
                }
            }
            catch (Exception ex)
            {
                Reply(id, new { ok = false, error = ex.Message });
            }
        }

        return 0;
    }

    private static void StartParentWatch(int parentPid, Engine engine)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var parent = Process.GetProcessById(parentPid);
                await parent.WaitForExitAsync();
            }
            catch
            {
                // Parent already gone or inaccessible. Treat either case as lost ownership.
            }

            try { engine.Dispose(); } catch { }
            Environment.Exit(0);
        });
    }

    internal static void Emit(object value)
    {
        lock (JsonOptions)
        {
            Console.Out.WriteLine(JsonSerializer.Serialize(value, JsonOptions));
            Console.Out.Flush();
        }
    }

    private static void Reply(string id, object value)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(value, JsonOptions));
        var map = new Dictionary<string, object?> { ["id"] = id };
        foreach (var prop in doc.RootElement.EnumerateObject())
            map[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText(), JsonOptions);
        Emit(map);
    }

    private static int ReadArgInt(string[] args, string name)
    {
        for (var i = 0; i < args.Length - 1; i++)
            if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase) &&
                int.TryParse(args[i + 1], out var value))
                return value;
        return 0;
    }

    private static string ReadString(JsonElement root, string name)
        => root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : "";

    private static bool ReadBool(JsonElement root, string name, bool fallback = false)
        => root.TryGetProperty(name, out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False ? value.GetBoolean() : fallback;

    private static int ReadInt(JsonElement root, string name, int fallback, int min, int max)
    {
        var value = root.TryGetProperty(name, out var item) && item.TryGetInt32(out var number) ? number : fallback;
        return Math.Clamp(value, min, max);
    }

    private static double ReadDouble(JsonElement root, string name, double fallback, double min, double max)
    {
        var value = root.TryGetProperty(name, out var item) && item.TryGetDouble(out var number) ? number : fallback;
        return Math.Clamp(value, min, max);
    }
}

internal sealed class Engine : IDisposable
{
    private readonly object _gate = new();
    private readonly string _stateDirectory;
    private readonly string _recoveryFile;
    private readonly string _sessionLockFile;
    private FileStream? _familySessionLock;
    private int _disposed;

    private Thread? _hookThread;
    private readonly ManualResetEventSlim _hooksReady = new(false);
    private Native.HookProc? _keyboardProc;
    private Native.HookProc? _mouseProc;
    private IntPtr _keyboardHook;
    private IntPtr _mouseHook;

    private bool _recording;
    private bool _includeMouse;
    private bool _includeMouseMove;
    private int _maxDurationMs;
    private int _maxEvents;
    private readonly List<MacroEvent> _events = [];
    private Stopwatch _recordClock = new();
    private long _lastEventMs;
    private long _lastMoveMs;
    private Native.POINT _lastMovePoint;
    private Timer? _progressTimer;
    private bool _truncated;

    private CancellationTokenSource? _playbackCts;
    private Task? _playbackTask;
    private readonly Dictionary<string, HeldKey> _downKeys = new(StringComparer.Ordinal);
    private readonly HashSet<string> _downButtons = new(StringComparer.OrdinalIgnoreCase);

    public Engine()
    {
        _stateDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "PackRat", "InputHost");
        _recoveryFile = Path.Combine(_stateDirectory, "held-input.json");
        _sessionLockFile = Path.Combine(_stateDirectory, "macro-recorder-session.lock");
    }

    public void RecoverBeforeHooks()
    {
        if (!TryAcquireFamilySession(false)) return;
        try
        {
            RecoverStuckInputOwned();
        }
        finally
        {
            ReleaseFamilySession();
        }
    }

    public void StartHooks()
    {
        if (_hookThread is not null) return;
        _hookThread = new Thread(HookLoop) { IsBackground = true, Name = "PackRat Input Hooks" };
        _hookThread.Start();
        if (!_hooksReady.Wait(TimeSpan.FromSeconds(5)))
            throw new InvalidOperationException("Input hooks did not start.");
        if (_keyboardHook == IntPtr.Zero || _mouseHook == IntPtr.Zero)
            throw new InvalidOperationException("Windows input hooks could not be installed.");
    }

    private void HookLoop()
    {
        _keyboardProc = KeyboardHook;
        _mouseProc = MouseHook;
        var module = Native.GetModuleHandle(null);
        _keyboardHook = Native.SetWindowsHookEx(Native.WH_KEYBOARD_LL, _keyboardProc, module, 0);
        _mouseHook = Native.SetWindowsHookEx(Native.WH_MOUSE_LL, _mouseProc, module, 0);
        _hooksReady.Set();
        if (_keyboardHook == IntPtr.Zero || _mouseHook == IntPtr.Zero) return;

        while (Native.GetMessage(out var msg, IntPtr.Zero, 0, 0) > 0)
        {
            Native.TranslateMessage(ref msg);
            Native.DispatchMessage(ref msg);
        }
    }

    public void StartRecording(bool includeMouse, bool includeMouseMove, int maxDurationMs, int maxEvents)
    {
        lock (_gate)
        {
            ThrowIfDisposed();
            if (_recording) throw new InvalidOperationException("A recording is already active.");
            if (_playbackCts is not null) throw new InvalidOperationException("Stop playback before recording.");
        }

        BeginFamilySession();
        try
        {
            lock (_gate)
            {
                ThrowIfDisposed();
                if (_recording || _playbackCts is not null)
                    throw new InvalidOperationException("Macro Recorder is already active.");

                _events.Clear();
                _includeMouse = includeMouse;
                _includeMouseMove = includeMouseMove;
                _maxDurationMs = maxDurationMs;
                _maxEvents = maxEvents;
                _truncated = false;
                _recordClock = Stopwatch.StartNew();
                _lastEventMs = 0;
                _lastMoveMs = -1000;
                _lastMovePoint = new Native.POINT { X = int.MinValue, Y = int.MinValue };
                _recording = true;
                _progressTimer?.Dispose();
                _progressTimer = new Timer(_ => ProgressTick(), null, 500, 500);
            }
        }
        catch
        {
            ReleaseFamilySession();
            throw;
        }

        Program.Emit(new { @event = "recordingStarted", startedAt = DateTimeOffset.UtcNow.ToString("O") });
    }

    private void ProgressTick()
    {
        bool shouldStop;
        int count;
        long elapsed;
        lock (_gate)
        {
            if (!_recording) return;
            elapsed = _recordClock.ElapsedMilliseconds;
            count = _events.Count;
            shouldStop = elapsed >= _maxDurationMs;
            if (shouldStop) _truncated = true;
        }

        Program.Emit(new { @event = "recordingProgress", eventCount = count, elapsedMs = elapsed });
        if (shouldStop) StopRecording("duration-cap");
    }

    public void StopRecording(string reason)
    {
        MacroEvent[] copy;
        long duration;
        bool truncated;
        lock (_gate)
        {
            if (!_recording) return;
            _recording = false;
            _recordClock.Stop();
            duration = _recordClock.ElapsedMilliseconds;
            copy = _events.ToArray();
            truncated = _truncated;
            _progressTimer?.Dispose();
            _progressTimer = null;
        }

        ReleaseFamilySession();
        Program.Emit(new
        {
            @event = "recordingStopped",
            macro = new { events = copy, durationMs = duration, truncated, stopReason = reason }
        });
    }

    public void CancelRecording()
    {
        var cancelled = false;
        lock (_gate)
        {
            if (!_recording) return;
            _recording = false;
            _events.Clear();
            _progressTimer?.Dispose();
            _progressTimer = null;
            cancelled = true;
        }

        ReleaseFamilySession();
        if (cancelled) Program.Emit(new { @event = "recordingCancelled" });
    }

    private IntPtr KeyboardHook(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code < 0) return Native.CallNextHookEx(_keyboardHook, code, wParam, lParam);

        var data = Marshal.PtrToStructure<Native.KBDLLHOOKSTRUCT>(lParam);
        var injected = (data.flags & Native.LLKHF_INJECTED) != 0;
        var message = unchecked((int)wParam.ToInt64());
        var down = message is Native.WM_KEYDOWN or Native.WM_SYSKEYDOWN;
        var up = message is Native.WM_KEYUP or Native.WM_SYSKEYUP;

        if (!injected && down && data.vkCode == Native.VK_F12 &&
            IsDown(Native.VK_CONTROL) && IsDown(Native.VK_SHIFT) &&
            IsPlaybackActive())
        {
            StopPlayback("emergency-hotkey", false);
            return new IntPtr(1);
        }

        if (!injected && (down || up))
        {
            Record(new MacroEvent
            {
                Type = down ? "keyDown" : "keyUp",
                Vk = (int)data.vkCode,
                Scan = (int)data.scanCode,
                Extended = (data.flags & Native.LLKHF_EXTENDED) != 0,
                Name = Native.KeyName((int)data.vkCode)
            });
        }

        return Native.CallNextHookEx(_keyboardHook, code, wParam, lParam);
    }

    private IntPtr MouseHook(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code < 0) return Native.CallNextHookEx(_mouseHook, code, wParam, lParam);
        var data = Marshal.PtrToStructure<Native.MSLLHOOKSTRUCT>(lParam);
        if ((data.flags & Native.LLMHF_INJECTED) != 0)
            return Native.CallNextHookEx(_mouseHook, code, wParam, lParam);

        bool includeMouse;
        bool includeMove;
        lock (_gate)
        {
            includeMouse = _recording && _includeMouse;
            includeMove = _includeMouseMove;
        }
        if (!includeMouse) return Native.CallNextHookEx(_mouseHook, code, wParam, lParam);

        var message = unchecked((int)wParam.ToInt64());
        MacroEvent? ev = null;

        if (message == Native.WM_MOUSEMOVE && includeMove)
        {
            lock (_gate)
            {
                var now = _recordClock.ElapsedMilliseconds;
                var dx = Math.Abs(data.pt.X - _lastMovePoint.X);
                var dy = Math.Abs(data.pt.Y - _lastMovePoint.Y);
                if (now - _lastMoveMs < 12 && dx < 2 && dy < 2)
                    return Native.CallNextHookEx(_mouseHook, code, wParam, lParam);
                _lastMoveMs = now;
                _lastMovePoint = data.pt;
            }
            ev = PositionEvent("mouseMove", data.pt);
        }
        else if (message is Native.WM_LBUTTONDOWN or Native.WM_LBUTTONUP)
            ev = PositionEvent(message == Native.WM_LBUTTONDOWN ? "mouseDown" : "mouseUp", data.pt, "left");
        else if (message is Native.WM_RBUTTONDOWN or Native.WM_RBUTTONUP)
            ev = PositionEvent(message == Native.WM_RBUTTONDOWN ? "mouseDown" : "mouseUp", data.pt, "right");
        else if (message is Native.WM_MBUTTONDOWN or Native.WM_MBUTTONUP)
            ev = PositionEvent(message == Native.WM_MBUTTONDOWN ? "mouseDown" : "mouseUp", data.pt, "middle");
        else if (message is Native.WM_XBUTTONDOWN or Native.WM_XBUTTONUP)
        {
            var which = ((data.mouseData >> 16) & 0xffff) == 2 ? "x2" : "x1";
            ev = PositionEvent(message == Native.WM_XBUTTONDOWN ? "mouseDown" : "mouseUp", data.pt, which);
        }
        else if (message is Native.WM_MOUSEWHEEL or Native.WM_MOUSEHWHEEL)
        {
            ev = PositionEvent("wheel", data.pt);
            ev.Delta = unchecked((short)((data.mouseData >> 16) & 0xffff));
            ev.Horizontal = message == Native.WM_MOUSEHWHEEL;
        }

        if (ev is not null) Record(ev);
        return Native.CallNextHookEx(_mouseHook, code, wParam, lParam);
    }

    private MacroEvent PositionEvent(string type, Native.POINT point, string? button = null)
    {
        var ev = new MacroEvent { Type = type, X = point.X, Y = point.Y, Button = button };
        var hwnd = Native.GetForegroundWindow();
        if (hwnd != IntPtr.Zero &&
            Native.GetWindowRect(hwnd, out var rect) &&
            rect.Right > rect.Left && rect.Bottom > rect.Top)
        {
            ev.RelX = (double)(point.X - rect.Left) / (rect.Right - rect.Left);
            ev.RelY = (double)(point.Y - rect.Top) / (rect.Bottom - rect.Top);
        }
        return ev;
    }

    private void Record(MacroEvent ev)
    {
        bool cap = false;
        lock (_gate)
        {
            if (!_recording) return;
            if (ev.Type.StartsWith("mouse", StringComparison.Ordinal) || ev.Type == "wheel")
            {
                if (!_includeMouse) return;
            }

            var now = _recordClock.ElapsedMilliseconds;
            ev.DelayMs = (int)Math.Clamp(now - _lastEventMs, 0, _maxDurationMs);
            _lastEventMs = now;
            _events.Add(ev);
            if (_events.Count >= _maxEvents)
            {
                _truncated = true;
                cap = true;
            }
        }

        if (cap) ThreadPool.QueueUserWorkItem(_ => StopRecording("event-cap"));
    }

    public void Play(JsonElement events, double speed, int repeatCount, string coordinateMode)
    {
        lock (_gate)
        {
            ThrowIfDisposed();
            if (_recording) throw new InvalidOperationException("Stop recording before playback.");
            if (_playbackCts is not null) throw new InvalidOperationException("Playback is already active.");
        }

        BeginFamilySession();

        CancellationTokenSource cts;
        try
        {
            lock (_gate)
            {
                ThrowIfDisposed();
                if (_recording || _playbackCts is not null)
                    throw new InvalidOperationException("Macro Recorder is already active.");
                cts = new CancellationTokenSource();
                _playbackCts = cts;
            }
        }
        catch
        {
            ReleaseFamilySession();
            throw;
        }

        var cloned = events.Clone();
        _playbackTask = Task.Run(() => PlaybackLoop(cloned, speed, repeatCount, coordinateMode, cts.Token));
        Program.Emit(new { @event = "playbackStarted" });
    }

    private async Task PlaybackLoop(JsonElement events, double speed, int repeatCount, string coordinateMode, CancellationToken token)
    {
        string reason = "completed";
        string? error = null;

        try
        {
            var iteration = 0;
            while (!token.IsCancellationRequested && (repeatCount == 0 || iteration < repeatCount))
            {
                foreach (var ev in events.EnumerateArray())
                {
                    token.ThrowIfCancellationRequested();
                    var delay = ev.TryGetProperty("delayMs", out var delayEl) && delayEl.TryGetInt32(out var delayMs) ? delayMs : 0;
                    var scaled = Math.Max(0, (int)Math.Round(delay / speed));
                    if (scaled > 0) await Task.Delay(scaled, token);
                    SendEvent(ev, coordinateMode);
                }
                iteration++;
            }
        }
        catch (OperationCanceledException)
        {
            reason = "cancelled";
        }
        catch (Exception ex)
        {
            reason = "error";
            error = ex.Message;
        }
        finally
        {
            try
            {
                ReleasePressed();
            }
            catch (Exception cleanupEx)
            {
                reason = "error";
                error = string.IsNullOrWhiteSpace(error)
                    ? cleanupEx.Message
                    : $"{error} Cleanup: {cleanupEx.Message}";
            }

            lock (_gate)
            {
                _playbackCts?.Dispose();
                _playbackCts = null;
                _playbackTask = null;
            }

            ReleaseFamilySession();
            Program.Emit(new { @event = "playbackStopped", reason, error });
        }
    }

    private void SendEvent(JsonElement ev, string coordinateMode)
    {
        var type = ev.TryGetProperty("type", out var typeEl) ? typeEl.GetString() ?? "" : "";

        if (type is "keyDown" or "keyUp")
        {
            var key = new HeldKey(
                GetInt(ev, "vk"),
                GetInt(ev, "scan"),
                GetBool(ev, "extended"));

            if (type == "keyDown")
            {
                AddHeldKeyBeforeInjection(key);
                try
                {
                    Native.SendKey(key.Vk, key.Scan, false, key.Extended);
                }
                catch
                {
                    RollBackHeldKeyAfterFailedDown(key);
                    throw;
                }
            }
            else
            {
                Native.SendKey(key.Vk, key.Scan, true, key.Extended);
                RemoveHeldKeyAfterSuccessfulRelease(key);
            }
            return;
        }

        if (type is "mouseMove" or "mouseDown" or "mouseUp" or "wheel")
        {
            var point = PlaybackPoint(ev, coordinateMode);
            Native.MovePointer(point.X, point.Y);
        }

        if (type is "mouseDown" or "mouseUp")
        {
            var button = NormalizeButton(ev.TryGetProperty("button", out var buttonEl) ? buttonEl.GetString() : null);
            if (type == "mouseDown")
            {
                AddHeldButtonBeforeInjection(button);
                try
                {
                    Native.SendMouseButton(button, false);
                }
                catch
                {
                    RollBackHeldButtonAfterFailedDown(button);
                    throw;
                }
            }
            else
            {
                Native.SendMouseButton(button, true);
                RemoveHeldButtonAfterSuccessfulRelease(button);
            }
        }
        else if (type == "wheel")
        {
            Native.SendWheel(GetInt(ev, "delta"), GetBool(ev, "horizontal"));
        }
    }

    private Native.POINT PlaybackPoint(JsonElement ev, string coordinateMode)
    {
        var x = GetInt(ev, "x");
        var y = GetInt(ev, "y");

        if (coordinateMode == "active-window" &&
            ev.TryGetProperty("relX", out var rx) && rx.TryGetDouble(out var relX) &&
            ev.TryGetProperty("relY", out var ry) && ry.TryGetDouble(out var relY))
        {
            var hwnd = Native.GetForegroundWindow();
            if (hwnd != IntPtr.Zero &&
                Native.GetWindowRect(hwnd, out var rect) &&
                rect.Right > rect.Left && rect.Bottom > rect.Top)
            {
                x = rect.Left + (int)Math.Round(relX * (rect.Right - rect.Left));
                y = rect.Top + (int)Math.Round(relY * (rect.Bottom - rect.Top));
            }
        }

        return new Native.POINT { X = x, Y = y };
    }

    public void StopPlayback(string reason, bool wait = true)
    {
        Task? task;
        lock (_gate)
        {
            if (_playbackCts is null) return;
            try { _playbackCts.Cancel(); } catch { }
            task = _playbackTask;
        }

        if (wait && task is not null && !task.IsCompleted)
        {
            try { task.Wait(TimeSpan.FromSeconds(3)); } catch { }
        }
    }

    public void ReleaseTrackedKeys(IEnumerable<int> keys)
    {
        var requested = keys.Where(v => v is > 0 and <= 255).ToHashSet();
        HeldKey[] tracked;
        lock (_gate)
        {
            tracked = _downKeys.Values.Where(key => requested.Contains(key.Vk)).ToArray();
        }

        foreach (var key in tracked)
        {
            Native.SendKey(key.Vk, key.Scan, true, key.Extended);
            RemoveHeldKeyAfterSuccessfulRelease(key);
        }
    }

    private bool IsPlaybackActive()
    {
        lock (_gate) return _playbackCts is not null;
    }

    private void BeginFamilySession()
    {
        if (!TryAcquireFamilySession(true))
            throw new InvalidOperationException("Macro Recorder Lite or Pro already has an active recording or playback session.");

        try
        {
            RecoverStuckInputOwned();
        }
        catch
        {
            ReleaseFamilySession();
            throw;
        }
    }

    private bool TryAcquireFamilySession(bool throwOnFilesystemError)
    {
        lock (_gate)
        {
            if (_familySessionLock is not null) return true;
        }

        try
        {
            Directory.CreateDirectory(_stateDirectory);
            var stream = new FileStream(
                _sessionLockFile,
                FileMode.OpenOrCreate,
                FileAccess.ReadWrite,
                FileShare.None,
                bufferSize: 1,
                FileOptions.WriteThrough);

            lock (_gate)
            {
                if (_familySessionLock is not null)
                {
                    stream.Dispose();
                    return true;
                }
                _familySessionLock = stream;
            }

            return true;
        }
        catch (IOException)
        {
            return false;
        }
        catch when (!throwOnFilesystemError)
        {
            return false;
        }
    }

    private void ReleaseFamilySession()
    {
        FileStream? stream;
        lock (_gate)
        {
            stream = _familySessionLock;
            _familySessionLock = null;
        }

        try { stream?.Dispose(); } catch { }
    }

    private bool OwnsFamilySession()
    {
        lock (_gate) return _familySessionLock is not null;
    }

    private void RecoverStuckInputOwned()
    {
        if (!OwnsFamilySession())
            throw new InvalidOperationException("Held-input recovery requires Macro Recorder family session ownership.");

        if (!File.Exists(_recoveryFile)) return;

        var state = ReadRecoveryState();
        var failedKeys = new List<HeldKey>();
        var failedButtons = new List<string>();
        var errors = new List<string>();

        foreach (var key in state.Keys.DistinctBy(key => key.Id))
        {
            try
            {
                Native.SendKey(key.Vk, key.Scan, true, key.Extended);
            }
            catch (Exception ex)
            {
                failedKeys.Add(key);
                errors.Add($"key {key.Vk}: {ex.Message}");
            }
        }

        foreach (var button in state.Buttons.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                Native.SendMouseButton(button, true);
            }
            catch (Exception ex)
            {
                failedButtons.Add(button);
                errors.Add($"{button} mouse: {ex.Message}");
            }
        }

        WriteRecoveryState(failedKeys, failedButtons);

        if (errors.Count > 0)
            throw new InvalidOperationException("Could not recover all held input: " + string.Join(" | ", errors));
    }

    private RecoveryState ReadRecoveryState()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(_recoveryFile));
        var keys = new List<HeldKey>();
        var buttons = new List<string>();

        if (doc.RootElement.TryGetProperty("keys", out var keyArray) && keyArray.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in keyArray.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Number && item.TryGetInt32(out var legacyVk))
                {
                    if (legacyVk is > 0 and <= 255) keys.Add(new HeldKey(legacyVk, 0, false));
                    continue;
                }

                if (item.ValueKind != JsonValueKind.Object) continue;
                var vk = GetInt(item, "vk");
                if (vk is <= 0 or > 255) continue;
                keys.Add(new HeldKey(vk, GetInt(item, "scan"), GetBool(item, "extended")));
            }
        }

        if (doc.RootElement.TryGetProperty("buttons", out var buttonArray) && buttonArray.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in buttonArray.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.String) continue;
                var raw = item.GetString();
                if (string.IsNullOrWhiteSpace(raw)) continue;
                buttons.Add(NormalizeButton(raw));
            }
        }

        return new RecoveryState(keys, buttons);
    }

    private void AddHeldKeyBeforeInjection(HeldKey key)
    {
        lock (_gate)
        {
            EnsureFamilySessionOwnedLocked();
            _downKeys[key.Id] = key;
            try
            {
                PersistHeldInputLocked();
            }
            catch
            {
                _downKeys.Remove(key.Id);
                throw;
            }
        }
    }

    private void RollBackHeldKeyAfterFailedDown(HeldKey key)
    {
        lock (_gate)
        {
            _downKeys.Remove(key.Id);
            try { PersistHeldInputLocked(); } catch { }
        }
    }

    private void RemoveHeldKeyAfterSuccessfulRelease(HeldKey key)
    {
        lock (_gate)
        {
            if (!_downKeys.Remove(key.Id)) return;
            try
            {
                PersistHeldInputLocked();
            }
            catch
            {
                _downKeys[key.Id] = key;
                throw;
            }
        }
    }

    private void AddHeldButtonBeforeInjection(string button)
    {
        lock (_gate)
        {
            EnsureFamilySessionOwnedLocked();
            _downButtons.Add(button);
            try
            {
                PersistHeldInputLocked();
            }
            catch
            {
                _downButtons.Remove(button);
                throw;
            }
        }
    }

    private void RollBackHeldButtonAfterFailedDown(string button)
    {
        lock (_gate)
        {
            _downButtons.Remove(button);
            try { PersistHeldInputLocked(); } catch { }
        }
    }

    private void RemoveHeldButtonAfterSuccessfulRelease(string button)
    {
        lock (_gate)
        {
            if (!_downButtons.Remove(button)) return;
            try
            {
                PersistHeldInputLocked();
            }
            catch
            {
                _downButtons.Add(button);
                throw;
            }
        }
    }

    private void ReleasePressed()
    {
        HeldKey[] keys;
        string[] buttons;
        lock (_gate)
        {
            keys = _downKeys.Values.ToArray();
            buttons = _downButtons.ToArray();
        }

        var errors = new List<string>();

        foreach (var key in keys)
        {
            try
            {
                Native.SendKey(key.Vk, key.Scan, true, key.Extended);
                RemoveHeldKeyAfterSuccessfulRelease(key);
            }
            catch (Exception ex)
            {
                errors.Add($"key {key.Vk}: {ex.Message}");
            }
        }

        foreach (var button in buttons)
        {
            try
            {
                Native.SendMouseButton(button, true);
                RemoveHeldButtonAfterSuccessfulRelease(button);
            }
            catch (Exception ex)
            {
                errors.Add($"{button} mouse: {ex.Message}");
            }
        }

        if (errors.Count > 0)
            throw new InvalidOperationException("Could not release all injected held input: " + string.Join(" | ", errors));
    }

    private void PersistHeldInputLocked()
    {
        EnsureFamilySessionOwnedLocked();
        WriteRecoveryState(_downKeys.Values, _downButtons);
    }

    private void WriteRecoveryState(IEnumerable<HeldKey> keys, IEnumerable<string> buttons)
    {
        Directory.CreateDirectory(_stateDirectory);

        var state = new
        {
            keys = keys.Select(key => new { vk = key.Vk, scan = key.Scan, extended = key.Extended }).ToArray(),
            buttons = buttons.ToArray()
        };

        var temp = _recoveryFile + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(state));
        File.Move(temp, _recoveryFile, true);

        if (state.keys.Length == 0 && state.buttons.Length == 0)
        {
            // The empty file is the durable tombstone. Deletion is only a cleanup optimization.
            try { File.Delete(_recoveryFile); } catch { }
            try { File.Delete(temp); } catch { }
        }
    }

    private void EnsureFamilySessionOwnedLocked()
    {
        if (_familySessionLock is null)
            throw new InvalidOperationException("Held-input journal access requires Macro Recorder family session ownership.");
    }

    private static string NormalizeButton(string? value)
        => value?.ToLowerInvariant() switch
        {
            "right" => "right",
            "middle" => "middle",
            "x1" => "x1",
            "x2" => "x2",
            _ => "left"
        };

    private static bool IsDown(int vk) => (Native.GetAsyncKeyState(vk) & 0x8000) != 0;

    private static int GetInt(JsonElement root, string name)
        => root.TryGetProperty(name, out var el) && el.TryGetInt32(out var value) ? value : 0;

    private static bool GetBool(JsonElement root, string name)
        => root.TryGetProperty(name, out var el) &&
           el.ValueKind is JsonValueKind.True or JsonValueKind.False &&
           el.GetBoolean();

    private void ThrowIfDisposed()
    {
        if (Volatile.Read(ref _disposed) != 0)
            throw new ObjectDisposedException(nameof(Engine));
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;

        try { CancelRecording(); } catch { }
        try { StopPlayback("dispose"); } catch { }

        try
        {
            if (OwnsFamilySession()) ReleasePressed();
        }
        catch { }

        ReleaseFamilySession();

        if (_keyboardHook != IntPtr.Zero) Native.UnhookWindowsHookEx(_keyboardHook);
        if (_mouseHook != IntPtr.Zero) Native.UnhookWindowsHookEx(_mouseHook);
        _progressTimer?.Dispose();
        _hooksReady.Dispose();
    }
}

internal sealed record HeldKey(int Vk, int Scan, bool Extended)
{
    public string Id => $"{Vk}:{Scan}:{(Extended ? 1 : 0)}";
}

internal sealed record RecoveryState(List<HeldKey> Keys, List<string> Buttons);

internal sealed class MacroEvent
{
    public string Type { get; set; } = "";
    public int DelayMs { get; set; }
    public int Vk { get; set; }
    public int Scan { get; set; }
    public bool Extended { get; set; }
    public string? Name { get; set; }
    public int X { get; set; }
    public int Y { get; set; }
    public double? RelX { get; set; }
    public double? RelY { get; set; }
    public string? Button { get; set; }
    public int Delta { get; set; }
    public bool Horizontal { get; set; }
}

internal static class Native
{
    internal const int WH_KEYBOARD_LL = 13;
    internal const int WH_MOUSE_LL = 14;
    internal const int WM_KEYDOWN = 0x0100, WM_KEYUP = 0x0101, WM_SYSKEYDOWN = 0x0104, WM_SYSKEYUP = 0x0105;
    internal const int WM_MOUSEMOVE = 0x0200, WM_LBUTTONDOWN = 0x0201, WM_LBUTTONUP = 0x0202, WM_RBUTTONDOWN = 0x0204, WM_RBUTTONUP = 0x0205;
    internal const int WM_MBUTTONDOWN = 0x0207, WM_MBUTTONUP = 0x0208, WM_MOUSEWHEEL = 0x020A, WM_XBUTTONDOWN = 0x020B, WM_XBUTTONUP = 0x020C, WM_MOUSEHWHEEL = 0x020E;
    internal const uint LLKHF_EXTENDED = 0x01, LLKHF_INJECTED = 0x10, LLMHF_INJECTED = 0x01;
    internal const int VK_SHIFT = 0x10, VK_CONTROL = 0x11, VK_MENU = 0x12, VK_LWIN = 0x5B, VK_RWIN = 0x5C, VK_F12 = 0x7B;

    private const uint INPUT_MOUSE = 0, INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_EXTENDEDKEY = 0x0001, KEYEVENTF_KEYUP = 0x0002, KEYEVENTF_SCANCODE = 0x0008;
    private const uint MOUSEEVENTF_MOVE = 0x0001, MOUSEEVENTF_LEFTDOWN = 0x0002, MOUSEEVENTF_LEFTUP = 0x0004, MOUSEEVENTF_RIGHTDOWN = 0x0008, MOUSEEVENTF_RIGHTUP = 0x0010;
    private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020, MOUSEEVENTF_MIDDLEUP = 0x0040, MOUSEEVENTF_XDOWN = 0x0080, MOUSEEVENTF_XUP = 0x0100;
    private const uint MOUSEEVENTF_WHEEL = 0x0800, MOUSEEVENTF_HWHEEL = 0x01000, MOUSEEVENTF_VIRTUALDESK = 0x4000, MOUSEEVENTF_ABSOLUTE = 0x8000;
    private const int SM_XVIRTUALSCREEN = 76, SM_YVIRTUALSCREEN = 77, SM_CXVIRTUALSCREEN = 78, SM_CYVIRTUALSCREEN = 79;

    internal delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)] internal struct POINT { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)] internal struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] internal struct MSG { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public POINT pt; }
    [StructLayout(LayoutKind.Sequential)] internal struct KBDLLHOOKSTRUCT { public uint vkCode, scanCode, flags, time; public UIntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)] internal struct MSLLHOOKSTRUCT { public POINT pt; public uint mouseData, flags, time; public UIntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)] internal struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public UIntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)] internal struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public UIntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Explicit)] internal struct InputUnion { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)] internal struct INPUT { public uint type; public InputUnion U; }

    [DllImport("user32.dll", SetLastError = true)] internal static extern IntPtr SetWindowsHookEx(int idHook, HookProc callback, IntPtr hMod, uint threadId);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] internal static extern IntPtr GetModuleHandle(string? moduleName);
    [DllImport("user32.dll")] internal static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] internal static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] internal static extern int GetMessage(out MSG msg, IntPtr hwnd, uint min, uint max);
    [DllImport("user32.dll")] internal static extern bool TranslateMessage(ref MSG msg);
    [DllImport("user32.dll")] internal static extern IntPtr DispatchMessage(ref MSG msg);
    [DllImport("user32.dll")] internal static extern short GetAsyncKeyState(int vKey);
    [DllImport("user32.dll", SetLastError = true)] internal static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [DllImport("user32.dll")] internal static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] internal static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr value);

    internal static void EnableDpiAwareness()
    {
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { }
    }

    internal static void SendKey(int vk, int scan, bool up, bool extended)
    {
        if (vk is <= 0 or > 255) throw new ArgumentOutOfRangeException(nameof(vk));

        uint flags = up ? KEYEVENTF_KEYUP : 0;
        ushort wVk = (ushort)vk;
        ushort wScan = (ushort)Math.Clamp(scan, 0, 65535);
        if (scan > 0)
        {
            flags |= KEYEVENTF_SCANCODE;
            wVk = 0;
        }
        if (extended) flags |= KEYEVENTF_EXTENDEDKEY;

        SendOne(
            new INPUT
            {
                type = INPUT_KEYBOARD,
                U = new InputUnion
                {
                    ki = new KEYBDINPUT { wVk = wVk, wScan = wScan, dwFlags = flags }
                }
            },
            up ? "keyboard release" : "keyboard press");
    }

    internal static void MovePointer(int x, int y)
    {
        var vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
        var vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
        var vw = Math.Max(2, GetSystemMetrics(SM_CXVIRTUALSCREEN));
        var vh = Math.Max(2, GetSystemMetrics(SM_CYVIRTUALSCREEN));
        var dx = Math.Clamp((int)Math.Round((x - vx) * 65535.0 / (vw - 1)), 0, 65535);
        var dy = Math.Clamp((int)Math.Round((y - vy) * 65535.0 / (vh - 1)), 0, 65535);

        SendMouse(dx, dy, 0, MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK, "pointer move");
    }

    internal static void SendMouseButton(string button, bool up)
    {
        uint flags;
        uint data = 0;
        switch (button)
        {
            case "right": flags = up ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_RIGHTDOWN; break;
            case "middle": flags = up ? MOUSEEVENTF_MIDDLEUP : MOUSEEVENTF_MIDDLEDOWN; break;
            case "x1": flags = up ? MOUSEEVENTF_XUP : MOUSEEVENTF_XDOWN; data = 1; break;
            case "x2": flags = up ? MOUSEEVENTF_XUP : MOUSEEVENTF_XDOWN; data = 2; break;
            default: flags = up ? MOUSEEVENTF_LEFTUP : MOUSEEVENTF_LEFTDOWN; break;
        }

        SendMouse(0, 0, data, flags, up ? $"{button} mouse release" : $"{button} mouse press");
    }

    internal static void SendWheel(int delta, bool horizontal)
        => SendMouse(0, 0, unchecked((uint)delta), horizontal ? MOUSEEVENTF_HWHEEL : MOUSEEVENTF_WHEEL, horizontal ? "horizontal wheel" : "vertical wheel");

    private static void SendMouse(int dx, int dy, uint data, uint flags, string operation)
    {
        SendOne(
            new INPUT
            {
                type = INPUT_MOUSE,
                U = new InputUnion
                {
                    mi = new MOUSEINPUT { dx = dx, dy = dy, mouseData = data, dwFlags = flags }
                }
            },
            operation);
    }

    private static void SendOne(INPUT input, string operation)
    {
        Marshal.SetLastPInvokeError(0);
        var sent = SendInput(1, [input], Marshal.SizeOf<INPUT>());
        if (sent == 1) return;

        var error = Marshal.GetLastPInvokeError();
        var detail = error == 0
            ? "Windows rejected the input. This can happen when the target runs at a higher integrity level (UIPI)."
            : new Win32Exception(error).Message;
        throw new InvalidOperationException($"{operation} failed: {detail}");
    }

    internal static string KeyName(int vk)
    {
        if (vk is >= 0x30 and <= 0x39 || vk is >= 0x41 and <= 0x5A)
            return ((char)vk).ToString();

        return vk switch
        {
            0x08 => "Backspace",
            0x09 => "Tab",
            0x0D => "Enter",
            0x10 => "Shift",
            0x11 => "Ctrl",
            0x12 => "Alt",
            0x1B => "Esc",
            0x20 => "Space",
            0x25 => "Left",
            0x26 => "Up",
            0x27 => "Right",
            0x28 => "Down",
            0x2E => "Delete",
            0x5B => "Left Windows",
            0x5C => "Right Windows",
            >= 0x70 and <= 0x7B => $"F{vk - 0x6F}",
            _ => $"VK {vk:X2}"
        };
    }
}

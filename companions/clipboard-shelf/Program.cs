using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;

namespace PackRat.ClipboardShelfBridge;

internal static class Program
{
    [DllImport("kernel32.dll")]
    private static extern bool FreeConsole();

    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Any(x => string.Equals(x, "--self-test", StringComparison.OrdinalIgnoreCase)))
        {
            Environment.ExitCode = SelfTest.Run();
            return;
        }

        using var singleInstance = new Mutex(true, @"Local\PackRatClipboardShelfBridge", out var created);
        if (!created) return;

        FreeConsole();
        ApplicationConfiguration.Initialize();

        var storage = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "PackRat", "ClipboardShelf", "state.dat");

        var history = new ClipboardHistory(storage);
        history.Load();

        using var window = new ClipboardWindow(history);
        using var server = new BridgeServer(history);
        server.CopyToClipboardAsync = window.CopyEntryAsync;
        server.StartAsync().GetAwaiter().GetResult();

        window.CaptureInitial();
        Application.Run(window);

        server.StopAsync().GetAwaiter().GetResult();
    }
}

internal sealed class ClipEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Text { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool Pinned { get; set; }
    public bool Favorite { get; set; }
}

internal sealed class PersistedState
{
    public List<ClipEntry> Entries { get; set; } = [];
    public int MaxHistory { get; set; } = 40;
    public bool PrivateMode { get; set; }
    public string CurrentId { get; set; } = "";
}

internal sealed class SnapshotEntry
{
    public string Id { get; init; } = "";
    public string Text { get; init; } = "";
    public string CreatedAt { get; init; } = "";
    public bool Pinned { get; init; }
    public bool Favorite { get; init; }
    public string Url { get; init; } = "";
    public string Domain { get; init; } = "";
}

internal sealed class BridgeSnapshot
{
    public string Type { get; init; } = "snapshot";
    public int Version { get; init; } = 1;
    public bool PrivateMode { get; init; }
    public int MaxHistory { get; init; }
    public string CurrentId { get; init; } = "";
    public long Revision { get; init; }
    public List<SnapshotEntry> Entries { get; init; } = [];
}

internal sealed class ClipboardHistory
{
    private readonly object _gate = new();
    private readonly string _storagePath;
    private readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private List<ClipEntry> _entries = [];
    private int _maxHistory = 40;
    private bool _privateMode;
    private string _currentId = "";
    private long _revision;

    public event Action? Changed;

    public ClipboardHistory(string storagePath) => _storagePath = storagePath;

    public int Count { get { lock (_gate) return _entries.Count; } }
    public int MaxHistory { get { lock (_gate) return _maxHistory; } }
    public bool PrivateMode { get { lock (_gate) return _privateMode; } }

    public void Load()
    {
        lock (_gate)
        {
            try
            {
                if (!File.Exists(_storagePath)) return;
                var protectedBytes = File.ReadAllBytes(_storagePath);
                var plain = ProtectedData.Unprotect(protectedBytes, null, DataProtectionScope.CurrentUser);
                var saved = JsonSerializer.Deserialize<PersistedState>(plain, _json);
                if (saved is null) return;
                _entries = saved.Entries
                    .Where(x => !string.IsNullOrEmpty(x.Text))
                    .Select(CloneSafe)
                    .ToList();
                _maxHistory = Math.Clamp(saved.MaxHistory, 10, 100);
                _privateMode = saved.PrivateMode;
                _currentId = saved.CurrentId ?? "";
                PruneLocked();
            }
            catch
            {
                _entries = [];
                _currentId = "";
            }
        }
    }

    public bool Ingest(string? text)
    {
        if (string.IsNullOrEmpty(text)) return false;
        if (text.Length > 1_000_000) text = text[..1_000_000];

        lock (_gate)
        {
            if (_privateMode) return false;
            var now = DateTimeOffset.UtcNow;
            var existing = _entries.FirstOrDefault(x => string.Equals(x.Text, text, StringComparison.Ordinal));
            if (existing is not null)
            {
                _entries.Remove(existing);
                existing.CreatedAt = now;
                _entries.Insert(0, existing);
                _currentId = existing.Id;
            }
            else
            {
                var entry = new ClipEntry { Text = text, CreatedAt = now };
                _entries.Insert(0, entry);
                _currentId = entry.Id;
            }
            PruneLocked();
            PersistLocked();
            _revision++;
        }
        Changed?.Invoke();
        return true;
    }

    public string? GetText(string id)
    {
        lock (_gate) return _entries.FirstOrDefault(x => x.Id == id)?.Text;
    }

    public void MarkCurrent(string id)
    {
        lock (_gate)
        {
            if (_entries.All(x => x.Id != id)) return;
            _currentId = id;
            PersistLocked();
            _revision++;
        }
        Changed?.Invoke();
    }

    public void SetPinned(string id, bool value) => MutateEntry(id, x => x.Pinned = value);
    public void SetFavorite(string id, bool value) => MutateEntry(id, x => x.Favorite = value);

    public void Delete(string id)
    {
        lock (_gate)
        {
            var removed = _entries.RemoveAll(x => x.Id == id) > 0;
            if (!removed) return;
            if (_currentId == id) _currentId = "";
            PersistLocked();
            _revision++;
        }
        Changed?.Invoke();
    }

    public void Clear()
    {
        lock (_gate)
        {
            _entries.Clear();
            _currentId = "";
            PersistLocked();
            _revision++;
        }
        Changed?.Invoke();
    }

    public void SetPrivate(bool value)
    {
        lock (_gate)
        {
            if (_privateMode == value) return;
            _privateMode = value;
            PersistLocked();
            _revision++;
        }
        Changed?.Invoke();
    }

    public void SetMaxHistory(int value)
    {
        lock (_gate)
        {
            var next = Math.Clamp(value, 10, 100);
            if (_maxHistory == next) return;
            _maxHistory = next;
            PruneLocked();
            PersistLocked();
            _revision++;
        }
        Changed?.Invoke();
    }

    public BridgeSnapshot Snapshot()
    {
        lock (_gate)
        {
            var ordered = _entries
                .OrderByDescending(x => x.Pinned)
                .ThenByDescending(x => x.CreatedAt)
                .Select(ToSnapshot)
                .ToList();
            return new BridgeSnapshot
            {
                PrivateMode = _privateMode,
                MaxHistory = _maxHistory,
                CurrentId = _currentId,
                Revision = _revision,
                Entries = ordered
            };
        }
    }

    public object Health()
    {
        lock (_gate)
        {
            return new { ok = true, version = 1, entries = _entries.Count, maxHistory = _maxHistory, privateMode = _privateMode };
        }
    }

    private void MutateEntry(string id, Action<ClipEntry> change)
    {
        lock (_gate)
        {
            var entry = _entries.FirstOrDefault(x => x.Id == id);
            if (entry is null) return;
            change(entry);
            PruneLocked();
            PersistLocked();
            _revision++;
        }
        Changed?.Invoke();
    }

    private void PruneLocked()
    {
        var keepUnpinned = _entries
            .Where(x => !x.Pinned)
            .OrderByDescending(x => x.CreatedAt)
            .Take(_maxHistory)
            .Select(x => x.Id)
            .ToHashSet(StringComparer.Ordinal);

        _entries = _entries
            .Where(x => x.Pinned || keepUnpinned.Contains(x.Id))
            .OrderByDescending(x => x.CreatedAt)
            .ToList();
    }

    private void PersistLocked()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_storagePath)!);
            var payload = new PersistedState
            {
                Entries = _entries.Select(CloneSafe).ToList(),
                MaxHistory = _maxHistory,
                PrivateMode = _privateMode,
                CurrentId = _currentId
            };
            var plain = JsonSerializer.SerializeToUtf8Bytes(payload, _json);
            var protectedBytes = ProtectedData.Protect(plain, null, DataProtectionScope.CurrentUser);
            var tmp = _storagePath + ".tmp";
            File.WriteAllBytes(tmp, protectedBytes);
            File.Move(tmp, _storagePath, true);
        }
        catch
        {
            // Privacy rule: never print clipboard contents or serialized state.
        }
    }

    private static ClipEntry CloneSafe(ClipEntry x) => new()
    {
        Id = string.IsNullOrWhiteSpace(x.Id) ? Guid.NewGuid().ToString("N") : x.Id,
        Text = x.Text.Length > 1_000_000 ? x.Text[..1_000_000] : x.Text,
        CreatedAt = x.CreatedAt,
        Pinned = x.Pinned,
        Favorite = x.Favorite
    };

    private static SnapshotEntry ToSnapshot(ClipEntry x)
    {
        var url = "";
        var domain = "";
        if (Uri.TryCreate(x.Text.Trim(), UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        {
            url = x.Text.Trim();
            domain = uri.Host.StartsWith("www.", StringComparison.OrdinalIgnoreCase) ? uri.Host[4..] : uri.Host;
        }
        return new SnapshotEntry
        {
            Id = x.Id,
            Text = x.Text,
            CreatedAt = x.CreatedAt.ToUniversalTime().ToString("O"),
            Pinned = x.Pinned,
            Favorite = x.Favorite,
            Url = url,
            Domain = domain
        };
    }
}

internal sealed class BridgeCommand
{
    public string Command { get; set; } = "";
    public string Id { get; set; } = "";
    public bool? Value { get; set; }
    public int? MaxHistory { get; set; }
}

internal sealed class BridgeServer : IDisposable
{
    public const string Protocol = "packrat-clipboard-shelf-v1-a91f6c";
    private readonly ClipboardHistory _history;
    private readonly ConcurrentDictionary<Guid, WebSocket> _clients = new();
    private readonly SemaphoreSlim _broadcast = new(1, 1);
    private WebApplication? _app;
    public Func<string, Task<bool>>? CopyToClipboardAsync { get; set; }

    public BridgeServer(ClipboardHistory history)
    {
        _history = history;
        _history.Changed += OnChanged;
    }

    public async Task StartAsync()
    {
        var builder = WebApplication.CreateBuilder(Array.Empty<string>());
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:17485");
        var app = builder.Build();
        app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });

        app.Use(async (context, next) =>
        {
            if (context.Request.Path != "/ws")
            {
                await next(context);
                return;
            }
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            var origin = context.Request.Headers.Origin.ToString();
            if (!AllowedOrigin(origin))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }

            var requested = context.Request.Headers["Sec-WebSocket-Protocol"].ToString()
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (!requested.Contains(Protocol, StringComparer.Ordinal))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }

            using var socket = await context.WebSockets.AcceptWebSocketAsync(Protocol);
            var id = Guid.NewGuid();
            _clients[id] = socket;
            try
            {
                await SendSnapshotAsync(socket);
                await ClientLoopAsync(socket);
            }
            finally
            {
                _clients.TryRemove(id, out _);
            }
        });


        app.MapGet("/health", () => Results.Json(_history.Health()));

        _app = app;
        await app.StartAsync();
    }

    public async Task StopAsync()
    {
        if (_app is null) return;
        try { using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2)); await _app.StopAsync(timeout.Token); } catch { }
        foreach (var socket in _clients.Values)
        {
            try { await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "shutdown", CancellationToken.None); } catch { }
        }
    }

    private static bool AllowedOrigin(string origin)
    {
        if (string.IsNullOrWhiteSpace(origin) || origin.Equals("null", StringComparison.OrdinalIgnoreCase)) return true;
        return origin.StartsWith("file://", StringComparison.OrdinalIgnoreCase)
            || origin.StartsWith("http://127.0.0.1", StringComparison.OrdinalIgnoreCase)
            || origin.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase);
    }

    private async Task ClientLoopAsync(WebSocket socket)
    {
        var buffer = new byte[4096];
        while (socket.State == WebSocketState.Open)
        {
            using var ms = new MemoryStream();
            WebSocketReceiveResult result;
            do
            {
                result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    try { await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None); } catch { }
                    return;
                }
                if (result.MessageType != WebSocketMessageType.Text) return;
                ms.Write(buffer, 0, result.Count);
                if (ms.Length > 32_768) return;
            } while (!result.EndOfMessage);

            BridgeCommand? command;
            try { command = JsonSerializer.Deserialize<BridgeCommand>(ms.ToArray(), new JsonSerializerOptions(JsonSerializerDefaults.Web)); }
            catch { continue; }
            if (command is null) continue;
            await HandleAsync(command, socket);
        }
    }

    private async Task HandleAsync(BridgeCommand command, WebSocket socket)
    {
        switch ((command.Command ?? "").Trim().ToLowerInvariant())
        {
            case "refresh":
                await SendSnapshotAsync(socket);
                break;
            case "copy":
                if (!string.IsNullOrWhiteSpace(command.Id) && CopyToClipboardAsync is not null)
                    await CopyToClipboardAsync(command.Id);
                break;
            case "pin":
                if (!string.IsNullOrWhiteSpace(command.Id) && command.Value.HasValue) _history.SetPinned(command.Id, command.Value.Value);
                break;
            case "favorite":
                if (!string.IsNullOrWhiteSpace(command.Id) && command.Value.HasValue) _history.SetFavorite(command.Id, command.Value.Value);
                break;
            case "delete":
                if (!string.IsNullOrWhiteSpace(command.Id)) _history.Delete(command.Id);
                break;
            case "clear":
                _history.Clear();
                break;
            case "private":
                if (command.Value.HasValue) _history.SetPrivate(command.Value.Value);
                break;
            case "config":
                if (command.MaxHistory.HasValue) _history.SetMaxHistory(command.MaxHistory.Value);
                break;
        }
    }

    private void OnChanged() => _ = BroadcastSnapshotAsync();

    private async Task BroadcastSnapshotAsync()
    {
        await _broadcast.WaitAsync();
        try
        {
            foreach (var pair in _clients.ToArray())
            {
                if (pair.Value.State != WebSocketState.Open)
                {
                    _clients.TryRemove(pair.Key, out _);
                    continue;
                }
                try { await SendSnapshotAsync(pair.Value); }
                catch { _clients.TryRemove(pair.Key, out _); }
            }
        }
        finally { _broadcast.Release(); }
    }

    private async Task SendSnapshotAsync(WebSocket socket)
    {
        if (socket.State != WebSocketState.Open) return;
        var bytes = JsonSerializer.SerializeToUtf8Bytes(_history.Snapshot(), new JsonSerializerOptions(JsonSerializerDefaults.Web));
        await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
    }

    public void Dispose()
    {
        _history.Changed -= OnChanged;
        _broadcast.Dispose();
        _app?.DisposeAsync().AsTask().GetAwaiter().GetResult();
    }
}

internal sealed class ClipboardWindow : Form
{
    private const int WM_CLIPBOARDUPDATE = 0x031D;
    private readonly ClipboardHistory _history;
    private readonly NotifyIcon _tray;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool AddClipboardFormatListener(IntPtr hwnd);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RemoveClipboardFormatListener(IntPtr hwnd);

    public ClipboardWindow(ClipboardHistory history)
    {
        _history = history;
        ShowInTaskbar = false;
        WindowState = FormWindowState.Minimized;
        FormBorderStyle = FormBorderStyle.FixedToolWindow;
        Opacity = 0;
        Text = "PackRat Clipboard Shelf Bridge";

        var menu = new ContextMenuStrip();
        var status = new ToolStripMenuItem("Clipboard Shelf Bridge: running") { Enabled = false };
        var privateItem = new ToolStripMenuItem("Private Mode") { Checked = _history.PrivateMode, CheckOnClick = true };
        privateItem.CheckedChanged += (_, _) => _history.SetPrivate(privateItem.Checked);
        var clear = new ToolStripMenuItem("Clear History");
        clear.Click += (_, _) => _history.Clear();
        var exit = new ToolStripMenuItem("Exit");
        exit.Click += (_, _) => Close();
        menu.Items.Add(status);
        menu.Items.Add(privateItem);
        menu.Items.Add(clear);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(exit);

        _tray = new NotifyIcon
        {
            Icon = SystemIcons.Application,
            Text = "PackRat Clipboard Shelf Bridge",
            ContextMenuStrip = menu,
            Visible = true
        };
    }

    protected override void SetVisibleCore(bool value)
    {
        base.SetVisibleCore(false);
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        AddClipboardFormatListener(Handle);
    }

    protected override void OnHandleDestroyed(EventArgs e)
    {
        RemoveClipboardFormatListener(Handle);
        base.OnHandleDestroyed(e);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_CLIPBOARDUPDATE) BeginInvoke(new Action(CaptureClipboard));
        base.WndProc(ref m);
    }

    public void CaptureInitial() => BeginInvoke(new Action(CaptureClipboard));

    private void CaptureClipboard()
    {
        if (_history.PrivateMode) return;
        for (var attempt = 0; attempt < 6; attempt++)
        {
            try
            {
                if (!Clipboard.ContainsText(TextDataFormat.UnicodeText)) return;
                var text = Clipboard.GetText(TextDataFormat.UnicodeText);
                if (!string.IsNullOrEmpty(text)) _history.Ingest(text);
                return;
            }
            catch (ExternalException)
            {
                Thread.Sleep(18 + attempt * 12);
            }
        }
    }

    public Task<bool> CopyEntryAsync(string id)
    {
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        void Copy()
        {
            try
            {
                var text = _history.GetText(id);
                if (text is null) { tcs.TrySetResult(false); return; }
                Clipboard.SetText(text, TextDataFormat.UnicodeText);
                _history.MarkCurrent(id);
                tcs.TrySetResult(true);
            }
            catch { tcs.TrySetResult(false); }
        }
        if (InvokeRequired) BeginInvoke((Action)Copy); else Copy();
        return tcs.Task;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) _tray.Dispose();
        base.Dispose(disposing);
    }
}

internal static class SelfTest
{
    public static int Run()
    {
        var root = Path.Combine(Path.GetTempPath(), "packrat-clipboard-shelf-selftest-" + Guid.NewGuid().ToString("N"));
        var path = Path.Combine(root, "state.dat");
        try
        {
            var h = new ClipboardHistory(path);
            h.SetMaxHistory(10);
            h.Ingest("pin me");
            var pinId = h.Snapshot().CurrentId;
            h.SetPinned(pinId, true);

            h.Ingest("https://example.com/path");
            var url = h.Snapshot().Entries.First(x => x.Text.StartsWith("https://", StringComparison.Ordinal));
            if (url.Domain != "example.com") throw new Exception("URL recognition failed");

            h.Ingest("duplicate");
            h.Ingest("duplicate");
            if (h.Snapshot().Entries.Count(x => x.Text == "duplicate") != 1) throw new Exception("dedupe failed");

            h.SetFavorite(h.Snapshot().Entries.First(x => x.Text == "duplicate").Id, true);
            if (!h.Snapshot().Entries.First(x => x.Text == "duplicate").Favorite) throw new Exception("favorite failed");

            h.SetPrivate(true);
            if (h.Ingest("private fixture text")) throw new Exception("private mode captured text");
            if (h.Snapshot().Entries.Any(x => x.Text == "private fixture text")) throw new Exception("private text persisted");
            h.SetPrivate(false);

            for (var i = 0; i < 50; i++) h.Ingest("rapid-" + i.ToString("D2"));
            var snapshot = h.Snapshot();
            if (snapshot.Entries.Count(x => !x.Pinned) != 10) throw new Exception("history limit failed");
            if (snapshot.Entries.All(x => !x.Pinned || x.Text != "pin me")) throw new Exception("pin pruning failed");

            var reload = new ClipboardHistory(path);
            reload.Load();
            if (reload.Count != snapshot.Entries.Count) throw new Exception("DPAPI persistence reload failed");

            reload.Clear();
            if (reload.Count != 0) throw new Exception("clear failed");

            Console.WriteLine("CLIPBOARD SHELF BRIDGE SELF-TEST PASS");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("CLIPBOARD SHELF BRIDGE SELF-TEST FAIL: " + ex.GetType().Name + " - " + ex.Message);
            return 1;
        }
        finally
        {
            try { if (Directory.Exists(root)) Directory.Delete(root, true); } catch { }
        }
    }
}

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

        if (CompanionInstall.EnsureInstalledAndRelaunched()) return;

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

internal static class CompanionInstall
{
    private const string RunValueName = "PackRatClipboardShelfBridge";

    public static string InstalledPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "PackRat", "ClipboardShelf", "PackRat.ClipboardShelfBridge.exe");

    public static bool EnsureInstalledAndRelaunched()
    {
        var current = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(current)) return false;
        if (!string.Equals(Path.GetFileName(current), "PackRat.ClipboardShelfBridge.exe", StringComparison.OrdinalIgnoreCase))
            return false;

        try
        {
            var installed = InstalledPath;
            Directory.CreateDirectory(Path.GetDirectoryName(installed)!);
            if (!string.Equals(Path.GetFullPath(current), Path.GetFullPath(installed), StringComparison.OrdinalIgnoreCase))
            {
                File.Copy(current, installed, true);
                RegisterStartup(installed);
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = installed,
                    UseShellExecute = true
                });
                return true;
            }

            RegisterStartup(installed);
        }
        catch
        {
            // The bridge can still run portably if install/startup registration fails.
        }

        return false;
    }

    private static void RegisterStartup(string installedPath)
    {
        using var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(
            @"Software\Microsoft\Windows\CurrentVersion\Run");
        key?.SetValue(RunValueName, "\"" + installedPath + "\"", Microsoft.Win32.RegistryValueKind.String);
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
    public string PairingToken { get; set; } = "";
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
    public bool Truncated { get; init; }
    public int FullLength { get; init; }
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
    private string _pairingToken = CreatePairingToken();
    private long _revision;

    public event Action? Changed;

    public ClipboardHistory(string storagePath) => _storagePath = storagePath;

    public int Count { get { lock (_gate) return _entries.Count; } }
    public int MaxHistory { get { lock (_gate) return _maxHistory; } }
    public bool PrivateMode { get { lock (_gate) return _privateMode; } }
    public string PairingToken { get { lock (_gate) return _pairingToken; } }

    public void Load()
    {
        lock (_gate)
        {
            try
            {
                if (!File.Exists(_storagePath))
                {
                    PersistLocked();
                    return;
                }
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
                _pairingToken = string.IsNullOrWhiteSpace(saved.PairingToken) ? CreatePairingToken() : saved.PairingToken;
                PruneLocked();
                PersistLocked();
            }
            catch
            {
                _entries = [];
                _maxHistory = 40;
                _privateMode = false;
                _currentId = "";
                _pairingToken = CreatePairingToken();
                PersistLocked();
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

    public void ClearCurrent()
    {
        lock (_gate)
        {
            if (string.IsNullOrEmpty(_currentId)) return;
            _currentId = "";
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
        if (!string.IsNullOrEmpty(_currentId) && _entries.All(x => x.Id != _currentId))
            _currentId = "";
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
                CurrentId = _currentId,
                PairingToken = _pairingToken
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

    private static string CreatePairingToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16));

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
        const int previewLimit = 16_384;
        var preview = x.Text.Length > previewLimit ? x.Text[..previewLimit] : x.Text;
        return new SnapshotEntry
        {
            Id = x.Id,
            Text = preview,
            CreatedAt = x.CreatedAt.ToUniversalTime().ToString("O"),
            Pinned = x.Pinned,
            Favorite = x.Favorite,
            Url = url,
            Domain = domain,
            Truncated = x.Text.Length > previewLimit,
            FullLength = x.Text.Length
        };
    }
}

internal sealed class BridgeCommand
{
    public string Command { get; set; } = "";
    public string Id { get; set; } = "";
    public bool? Value { get; set; }
    public int? MaxHistory { get; set; }
    public string Token { get; set; } = "";
}

internal sealed class BridgeServer : IDisposable
{
    public const string Protocol = "packrat-clipboard-shelf-v1-a91f6c";
    private readonly ClipboardHistory _history;
    private readonly ConcurrentDictionary<Guid, WebSocket> _clients = new();
    private readonly SemaphoreSlim _broadcast = new(1, 1);
    private int _broadcastDirty;
    private int _broadcastLoopActive;
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
            if (!await AuthenticateAsync(socket)) return;

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

    internal static bool AllowedOrigin(string origin)
    {
        if (string.IsNullOrWhiteSpace(origin) || origin.Equals("null", StringComparison.OrdinalIgnoreCase)) return true;
        if (origin.Equals("file://", StringComparison.OrdinalIgnoreCase)) return true;
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return false;
        return string.Equals(uri.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase)
            || string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase);
    }

    internal static bool SecureTokenEquals(string expected, string provided)
    {
        if (string.IsNullOrWhiteSpace(expected) || string.IsNullOrWhiteSpace(provided)) return false;
        var left = Encoding.UTF8.GetBytes(expected);
        var right = Encoding.UTF8.GetBytes(provided);
        return CryptographicOperations.FixedTimeEquals(left, right);
    }

    private async Task<bool> AuthenticateAsync(WebSocket socket)
    {
        BridgeCommand? command = null;
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(4));
            command = await ReceiveCommandAsync(socket, timeout.Token);
        }
        catch (OperationCanceledException) { }

        if (command is not null
            && string.Equals(command.Command, "auth", StringComparison.OrdinalIgnoreCase)
            && SecureTokenEquals(_history.PairingToken, command.Token))
            return true;

        try { await socket.CloseAsync(WebSocketCloseStatus.PolicyViolation, "pairing", CancellationToken.None); } catch { }
        return false;
    }

    private static async Task<BridgeCommand?> ReceiveCommandAsync(WebSocket socket, CancellationToken cancellationToken = default)
    {
        var buffer = new byte[4096];
        using var ms = new MemoryStream();
        WebSocketReceiveResult result;
        do
        {
            result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                try { await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None); } catch { }
                return null;
            }
            if (result.MessageType != WebSocketMessageType.Text) return null;
            ms.Write(buffer, 0, result.Count);
            if (ms.Length > 32_768) return null;
        } while (!result.EndOfMessage);

        try { return JsonSerializer.Deserialize<BridgeCommand>(ms.ToArray(), new JsonSerializerOptions(JsonSerializerDefaults.Web)); }
        catch { return null; }
    }

    private async Task ClientLoopAsync(WebSocket socket)
    {
        while (socket.State == WebSocketState.Open)
        {
            var command = await ReceiveCommandAsync(socket);
            if (command is null) return;
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

    private void OnChanged()
    {
        Interlocked.Exchange(ref _broadcastDirty, 1);
        if (Interlocked.CompareExchange(ref _broadcastLoopActive, 1, 0) == 0)
            _ = BroadcastLoopAsync();
    }

    private async Task BroadcastLoopAsync()
    {
        try
        {
            while (true)
            {
                Interlocked.Exchange(ref _broadcastDirty, 0);
                await Task.Delay(25);
                await BroadcastSnapshotAsync();
                if (Volatile.Read(ref _broadcastDirty) == 0) break;
            }
        }
        catch
        {
            // A disconnected client must not crash clipboard capture or leak clipboard data to logs.
        }
        finally
        {
            Interlocked.Exchange(ref _broadcastLoopActive, 0);
            if (Volatile.Read(ref _broadcastDirty) != 0) OnChanged();
        }
    }

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
    private string _suppressNextClipboardText = "";

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
        var pairing = new ToolStripMenuItem("Copy Pairing Code");
        pairing.Click += (_, _) =>
        {
            try
            {
                _suppressNextClipboardText = _history.PairingToken;
                Clipboard.SetText(_suppressNextClipboardText, TextDataFormat.UnicodeText);
                _history.ClearCurrent();
            }
            catch
            {
                _suppressNextClipboardText = "";
                MessageBox.Show(
                    "Windows clipboard is busy. Try Copy Pairing Code again.",
                    "Clipboard Shelf",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
        };
        var clear = new ToolStripMenuItem("Clear History");
        clear.Click += (_, _) =>
        {
            if (MessageBox.Show(
                "Clear all Clipboard Shelf history? Pinned and favorite entries will also be removed.",
                "Clipboard Shelf",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning) == DialogResult.Yes)
                _history.Clear();
        };
        var exit = new ToolStripMenuItem("Exit");
        exit.Click += (_, _) => Close();
        menu.Items.Add(status);
        menu.Items.Add(privateItem);
        menu.Items.Add(pairing);
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
                if (!Clipboard.ContainsText(TextDataFormat.UnicodeText))
                {
                    _history.ClearCurrent();
                    return;
                }
                var text = Clipboard.GetText(TextDataFormat.UnicodeText);
                if (!string.IsNullOrEmpty(_suppressNextClipboardText)
                    && string.Equals(text, _suppressNextClipboardText, StringComparison.Ordinal))
                {
                    _suppressNextClipboardText = "";
                    _history.ClearCurrent();
                    return;
                }
                if (!string.IsNullOrEmpty(text)) _history.Ingest(text);
                else _history.ClearCurrent();
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

internal static class ProtocolSelfTest
{
    public static async Task RunAsync(string path)
    {
        var history = new ClipboardHistory(path);
        history.Load();
        history.Ingest("protocol fixture text");

        using var server = new BridgeServer(history);
        await server.StartAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var ct = timeout.Token;
        try
        {
            using (var bad = new ClientWebSocket())
            {
                bad.Options.AddSubProtocol(BridgeServer.Protocol);
                await bad.ConnectAsync(new Uri("ws://127.0.0.1:17485/ws"), ct);
                await SendAsync(bad, new { command = "auth", token = history.PairingToken + "BAD" }, ct);
                var closeBuffer = new byte[1024];
                var result = await bad.ReceiveAsync(new ArraySegment<byte>(closeBuffer), ct);
                if (result.MessageType != WebSocketMessageType.Close)
                    throw new Exception("unauthorized bridge received clipboard data");
            }

            using (var good = new ClientWebSocket())
            {
                good.Options.AddSubProtocol(BridgeServer.Protocol);
                await good.ConnectAsync(new Uri("ws://127.0.0.1:17485/ws"), ct);
                await SendAsync(good, new { command = "auth", token = history.PairingToken }, ct);
                var snapshot = await ReceiveTextAsync(good, ct);
                if (!snapshot.Contains("\"type\":\"snapshot\"", StringComparison.Ordinal)
                    || !snapshot.Contains("protocol fixture text", StringComparison.Ordinal))
                    throw new Exception("authorized bridge snapshot failed");
                good.Abort();
            }

            using var http = new HttpClient();
            var health = await http.GetStringAsync("http://127.0.0.1:17485/health");
            if (health.Contains("protocol fixture text", StringComparison.Ordinal)
                || health.Contains(history.PairingToken, StringComparison.Ordinal))
                throw new Exception("bridge health leaked private data");
        }
        finally
        {
            await server.StopAsync();
        }
    }

    private static async Task SendAsync(ClientWebSocket socket, object value, CancellationToken cancellationToken)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        await socket.SendAsync(bytes, WebSocketMessageType.Text, true, cancellationToken);
    }

    private static async Task<string> ReceiveTextAsync(ClientWebSocket socket, CancellationToken cancellationToken)
    {
        var buffer = new byte[64 * 1024];
        using var ms = new MemoryStream();
        WebSocketReceiveResult result;
        do
        {
            result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);
            if (result.MessageType != WebSocketMessageType.Text)
                throw new Exception("expected bridge text snapshot");
            ms.Write(buffer, 0, result.Count);
            if (ms.Length > 2_000_000) throw new Exception("bridge snapshot unexpectedly large");
        } while (!result.EndOfMessage);
        return Encoding.UTF8.GetString(ms.ToArray());
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
            h.Load();
            if (h.PairingToken.Length < 24) throw new Exception("pairing token generation failed");
            if (!BridgeServer.SecureTokenEquals(h.PairingToken, h.PairingToken)) throw new Exception("pairing token equality failed");
            if (BridgeServer.SecureTokenEquals(h.PairingToken, h.PairingToken + "x")) throw new Exception("pairing token rejection failed");
            if (!BridgeServer.AllowedOrigin("null") || !BridgeServer.AllowedOrigin("file://")) throw new Exception("local file origin rejected");
            if (!BridgeServer.AllowedOrigin("http://127.0.0.1:8080") || !BridgeServer.AllowedOrigin("http://localhost:8080")) throw new Exception("localhost origin rejected");
            if (BridgeServer.AllowedOrigin("http://localhost.evil.example") || BridgeServer.AllowedOrigin("https://example.com")) throw new Exception("remote origin accepted");
            if (!CompanionInstall.InstalledPath.EndsWith("PackRat.ClipboardShelfBridge.exe", StringComparison.OrdinalIgnoreCase)) throw new Exception("install path invalid");

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
            if (!BridgeServer.SecureTokenEquals(h.PairingToken, reload.PairingToken)) throw new Exception("pairing token persistence failed");

            reload.Ingest(new string('L', 20_000));
            var longEntry = reload.Snapshot().Entries.First(x => x.FullLength == 20_000);
            if (!longEntry.Truncated || longEntry.Text.Length != 16_384) throw new Exception("long preview cap failed");
            if (reload.GetText(longEntry.Id)?.Length != 20_000) throw new Exception("full long clipboard text not preserved");

            reload.ClearCurrent();
            if (!string.IsNullOrEmpty(reload.Snapshot().CurrentId)) throw new Exception("current clipboard clear failed");

            var health = JsonSerializer.Serialize(reload.Health());
            if (health.Contains(reload.PairingToken, StringComparison.Ordinal) || health.Contains("rapid-49", StringComparison.Ordinal))
                throw new Exception("health endpoint privacy failed");

            var corruptPath = Path.Combine(root, "corrupt-state.dat");
            Directory.CreateDirectory(root);
            File.WriteAllBytes(corruptPath, [1, 2, 3, 4, 5]);
            var corrupt = new ClipboardHistory(corruptPath);
            corrupt.Load();
            if (corrupt.Count != 0 || corrupt.PairingToken.Length < 24) throw new Exception("corrupt persistence recovery failed");

            reload.Clear();
            if (reload.Count != 0) throw new Exception("clear failed");

            ProtocolSelfTest.RunAsync(Path.Combine(root, "protocol-state.dat")).GetAwaiter().GetResult();

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

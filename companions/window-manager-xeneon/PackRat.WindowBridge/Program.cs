using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PackRat.WindowBridge;

public static class Program
{
    public const int DefaultPort = 17487;
    public const int ProtocolVersion = 1;
    public const string CompanionVersion = "1.0.0";
    private const string FixtureKey = "window-fixture-key";

    public static async Task<int> Main(string[] args)
    {
        if (args.Contains("--self-test", StringComparer.OrdinalIgnoreCase))
            return SelfTest.Run();

        var fixtureRequested = args.Contains("--fixture", StringComparer.OrdinalIgnoreCase);
        var fixture = fixtureRequested && Environment.GetEnvironmentVariable("PACKRAT_WINDOW_BRIDGE_TEST") == "1";
        if (fixtureRequested && !fixture)
        {
            Console.Error.WriteLine("Fixture mode is restricted to the PackRat test environment.");
            return 2;
        }
        var noBrowser = fixture || args.Contains("--no-browser", StringComparer.OrdinalIgnoreCase);
        var port = ArgInt(args, "--port", DefaultPort);
        var protocol = fixture ? ArgInt(args, "--fixture-protocol", ProtocolVersion) : ProtocolVersion;

        if (!OperatingSystem.IsWindows() && !fixture)
        {
            Console.Error.WriteLine("PackRat Window Bridge requires Windows.");
            return 2;
        }

        var pairing = new PairingKeyStore(fixture, FixtureKey);
        var builder = WebApplication.CreateBuilder(args);
        builder.WebHost.UseUrls($"http://127.0.0.1:{port}");
        builder.Logging.ClearProviders();

        builder.Services.AddSingleton(pairing);
        builder.Services.AddSingleton<IWindowBackend>(_ => fixture ? new FakeWindowBackend() : new Win32WindowBackend());
        builder.Services.AddSingleton(sp => new WindowService(sp.GetRequiredService<IWindowBackend>(), protocol));
        builder.Services.AddSingleton<BridgeHub>();
        builder.Services.AddHostedService<WindowMonitorService>();

        var app = builder.Build();
        app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });

        app.Use(async (context, next) =>
        {
            if (!BridgeSecurity.IsLoopback(context.Connection.RemoteIpAddress))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { ok = false, error = "loopback only" });
                return;
            }

            var origin = context.Request.Headers.Origin.ToString();
            if (!BridgeSecurity.IsAllowedOrigin(origin, port))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { ok = false, error = "origin not allowed" });
                return;
            }

            context.Response.Headers["Cache-Control"] = "no-store";
            await next();
        });

        app.MapGet("/health", (WindowService windows, BridgeHub hub) => Results.Json(new
        {
            ok = true,
            product = "PackRat Window Bridge",
            version = CompanionVersion,
            protocol,
            port,
            clients = hub.ClientCount,
            fixture
        }));

        app.MapGet("/", () => Results.Content(SetupHtml(port, pairing.Key), "text/html; charset=utf-8"));

        app.Map("/widget", async context =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            var windows = context.RequestServices.GetRequiredService<WindowService>();
            var hub = context.RequestServices.GetRequiredService<BridgeHub>();
            using var socket = await context.WebSockets.AcceptWebSocketAsync();
            await hub.HandleAsync(socket, windows, pairing.Key, protocol, context.RequestAborted);
        });

        app.Lifetime.ApplicationStarted.Register(() =>
        {
            Console.WriteLine($"PackRat Window Bridge {CompanionVersion} listening on 127.0.0.1:{port}");
            Console.WriteLine($"Pairing key: {pairing.Key}");
            if (!fixture) Console.WriteLine($"Pairing key file: {pairing.Path}");
            Console.WriteLine("Window titles, process metadata, icons and commands stay on this PC. No PackRat cloud is used.");
            if (!noBrowser)
            {
                try
                {
                    Process.Start(new ProcessStartInfo($"http://127.0.0.1:{port}/") { UseShellExecute = true });
                }
                catch { }
            }
        });

        try
        {
            await app.RunAsync();
        }
        finally
        {
            var backend = app.Services.GetService<IWindowBackend>();
            backend?.Dispose();
        }

        return 0;
    }

    private static int ArgInt(string[] args, string name, int fallback)
    {
        var index = Array.FindIndex(args, value => value.Equals(name, StringComparison.OrdinalIgnoreCase));
        return index >= 0 && index + 1 < args.Length && int.TryParse(args[index + 1], out var value) ? value : fallback;
    }

    private static string SetupHtml(int port, string key)
    {
        var safeKey = System.Net.WebUtility.HtmlEncode(key);
        return $$"""
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PackRat Window Bridge</title>
<style>
:root{font-family:Inter,Segoe UI,Arial,sans-serif;color:#f6f8fa;background:#080b0f}*{box-sizing:border-box}body{margin:0;padding:32px;background:radial-gradient(circle at 80% 0,#2be86a1f,transparent 34%),#080b0f}.wrap{max-width:760px;margin:auto}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;color:#7f8a96}.card{margin-top:22px;padding:24px;border:1px solid #ffffff18;border-radius:20px;background:#11161dcc}h1{font-size:34px;margin:7px 0 8px}p{color:#aeb8c2;line-height:1.55}.key{font:800 17px ui-monospace,Consolas,monospace;word-break:break-all;background:#07090c;border:1px solid #ffffff1c;border-radius:12px;padding:15px;margin:12px 0}button{min-height:46px;padding:0 18px;border:0;border-radius:12px;background:#2be86a;color:#041008;font-weight:900;cursor:pointer}.pill{display:inline-block;border:1px solid #ffffff1c;border-radius:999px;padding:7px 11px;color:#c7d0d8;font-size:12px}.steps{display:grid;gap:10px;margin-top:18px}.step{padding:14px;border:1px solid #ffffff12;border-radius:12px;color:#dbe2e8}.muted{font-size:12px;color:#8996a3}
</style>
</head>
<body><div class="wrap">
<div class="eyebrow">PACKRAT · LOCAL WINDOWS COMPANION</div>
<h1>Window Bridge</h1>
<p>Native Windows window control for the XENEON Edge Window Manager. The bridge listens only on this PC and does not send desktop data to PackRat.</p>
<span class="pill">127.0.0.1:{{port}}</span>
<div class="card">
<div class="eyebrow">XENEON PAIRING KEY</div>
<div id="key" class="key">{{safeKey}}</div>
<button type="button" onclick="navigator.clipboard.writeText(document.getElementById('key').textContent)">Copy pairing key</button>
<div class="steps">
<div class="step"><b>1.</b> Keep PackRat Window Bridge running.</div>
<div class="step"><b>2.</b> Open Window Manager for XENEON in iCUE settings.</div>
<div class="step"><b>3.</b> Paste this key into <b>Window Bridge Key</b>.</div>
</div>
<p class="muted">The key is generated locally for your Windows user. No PackRat account, cloud relay, telemetry, or remote control endpoint is used.</p>
</div>
</div></body></html>
""";
    }
}

public static class BridgeSecurity
{
    public static bool IsLoopback(IPAddress? address)
    {
        if (address is null) return false;
        if (IPAddress.IsLoopback(address)) return true;
        return address.IsIPv4MappedToIPv6 && IPAddress.IsLoopback(address.MapToIPv4());
    }

    public static bool IsAllowedOrigin(string? value, int port)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;
        var origin = value.Trim().ToLowerInvariant();
        return
            origin == "null" ||
            origin == "file://" ||
            origin == $"http://127.0.0.1:{port}" ||
            origin == $"http://localhost:{port}";
    }

    public static bool FixedTimeKeyEquals(string? supplied, string expected)
    {
        if (string.IsNullOrEmpty(supplied)) return false;
        var left = SHA256.HashData(Encoding.UTF8.GetBytes(supplied));
        var right = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
        return CryptographicOperations.FixedTimeEquals(left, right);
    }
}

public sealed class PairingKeyStore
{
    public string Key { get; }
    public string Path { get; }

    public PairingKeyStore(bool fixture, string fixtureKey)
    {
        if (fixture)
        {
            Key = fixtureKey;
            Path = "";
            return;
        }

        var root = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var directory = System.IO.Path.Combine(root, "PackRat", "WindowBridge");
        Directory.CreateDirectory(directory);
        Path = System.IO.Path.Combine(directory, "bridge-key.txt");

        try
        {
            if (File.Exists(Path))
            {
                var existing = File.ReadAllText(Path, Encoding.UTF8).Trim();
                if (existing.Length >= 24)
                {
                    Key = existing;
                    return;
                }
            }
        }
        catch { }

        var bytes = RandomNumberGenerator.GetBytes(32);
        Key = Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        File.WriteAllText(Path, Key + Environment.NewLine, new UTF8Encoding(false));
    }
}

public sealed class WindowService
{
    private readonly IWindowBackend _backend;
    private readonly int _protocol;
    private readonly object _gate = new();
    private WindowSnapshot? _snapshot;
    private string _serialized = "";

    public WindowService(IWindowBackend backend, int protocol)
    {
        _backend = backend;
        _protocol = protocol;
    }

    public IWindowBackend Backend => _backend;

    public WindowSnapshot Snapshot()
    {
        lock (_gate)
        {
            _snapshot ??= _backend.ReadSnapshot(_protocol);
            return _snapshot;
        }
    }

    public (WindowSnapshot Snapshot, bool Changed) Refresh()
    {
        var next = _backend.ReadSnapshot(_protocol);
        var serialized = JsonSerializer.Serialize(next, JsonDefaults.Options);
        lock (_gate)
        {
            var changed = serialized != _serialized;
            _snapshot = next;
            _serialized = serialized;
            return (next, changed);
        }
    }

    public WindowSnapshot Execute(JsonElement root)
    {
        var command = RequiredString(root, "command", 64);
        var windowId = RequiredString(root, "windowId", 128);
        string? monitorId = null;
        if (command == "move_monitor") monitorId = RequiredString(root, "monitorId", 256);

        if (command is not ("focus" or "minimize" or "maximize_restore" or "snap_left" or "snap_right" or "move_monitor" or "close"))
            throw new ArgumentException("Unknown window command.");

        var current = Snapshot();
        if (!current.Windows.Any(window => window.Id == windowId))
            throw new ArgumentException("Window is no longer available.");
        if (monitorId is not null && !current.Monitors.Any(monitor => monitor.Id == monitorId))
            throw new ArgumentException("Monitor is no longer available.");

        _backend.Execute(command, windowId, monitorId);
        return Refresh().Snapshot;
    }

    private static string RequiredString(JsonElement root, string name, int max)
    {
        if (!root.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
            throw new ArgumentException($"Missing {name}.");
        var text = (value.GetString() ?? "").Trim();
        if (text.Length is 0 || text.Length > max) throw new ArgumentException($"Invalid {name}.");
        return text;
    }
}

public sealed class BridgeHub
{
    private readonly ConcurrentDictionary<Guid, WebSocket> _clients = new();
    public int ClientCount => _clients.Count;

    public async Task HandleAsync(WebSocket socket, WindowService windows, string pairingKey, int protocol, CancellationToken token)
    {
        var hello = await ReceiveJsonAsync(socket, TimeSpan.FromSeconds(4), token);
        if (hello is null)
        {
            await CloseQuietly(socket, WebSocketCloseStatus.PolicyViolation, "hello required");
            return;
        }

        var root = hello.RootElement;
        if (!root.TryGetProperty("type", out var type) || type.GetString() != "hello")
        {
            await SendAsync(socket, new { type = "pairing_required", reason = "hello_required" }, token);
            await CloseQuietly(socket, WebSocketCloseStatus.PolicyViolation, "hello required");
            return;
        }

        var clientProtocol = root.TryGetProperty("protocol", out var protocolNode) && protocolNode.TryGetInt32(out var parsed)
            ? parsed
            : 0;
        if (clientProtocol != protocol)
        {
            await SendAsync(socket, new
            {
                type = "protocol_mismatch",
                expectedProtocol = protocol,
                companionVersion = Program.CompanionVersion
            }, token);
            await CloseQuietly(socket, WebSocketCloseStatus.PolicyViolation, "protocol mismatch");
            return;
        }

        var suppliedKey = root.TryGetProperty("key", out var keyNode) && keyNode.ValueKind == JsonValueKind.String
            ? keyNode.GetString()
            : null;
        if (!BridgeSecurity.FixedTimeKeyEquals(suppliedKey, pairingKey))
        {
            await SendAsync(socket, new { type = "pairing_required", reason = "invalid_key" }, token);
            await CloseQuietly(socket, WebSocketCloseStatus.PolicyViolation, "pairing");
            return;
        }

        await SendAsync(socket, new
        {
            type = "auth_ok",
            protocol,
            companionVersion = Program.CompanionVersion
        }, token);
        await SendAsync(socket, windows.Snapshot(), token);

        var id = Guid.NewGuid();
        _clients[id] = socket;
        try
        {
            while (socket.State == WebSocketState.Open && !token.IsCancellationRequested)
            {
                using var message = await ReceiveJsonAsync(socket, TimeSpan.FromMinutes(10), token);
                if (message is null) break;

                try
                {
                    var messageRoot = message.RootElement;
                    if (!messageRoot.TryGetProperty("type", out var commandType) || commandType.GetString() != "command")
                        throw new ArgumentException("Unsupported message type.");

                    var snapshot = windows.Execute(messageRoot);
                    var command = messageRoot.GetProperty("command").GetString() ?? "";
                    await SendAsync(socket, new { type = "command_result", ok = true, command }, token);
                    await BroadcastAsync(snapshot, token);
                }
                catch (Exception error)
                {
                    await SendAsync(socket, new
                    {
                        type = "command_result",
                        ok = false,
                        error = Sanitize(error)
                    }, token);
                }
            }
        }
        finally
        {
            _clients.TryRemove(id, out _);
        }
    }

    public async Task BroadcastAsync(WindowSnapshot snapshot, CancellationToken token = default)
    {
        foreach (var pair in _clients.ToArray())
        {
            var socket = pair.Value;
            if (socket.State != WebSocketState.Open)
            {
                _clients.TryRemove(pair.Key, out _);
                continue;
            }

            try { await SendAsync(socket, snapshot, token); }
            catch { _clients.TryRemove(pair.Key, out _); }
        }
    }

    private static async Task<JsonDocument?> ReceiveJsonAsync(WebSocket socket, TimeSpan timeout, CancellationToken outer)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(outer);
        cts.CancelAfter(timeout);
        using var payload = new MemoryStream();
        var buffer = new byte[16 * 1024];

        try
        {
            while (true)
            {
                var result = await socket.ReceiveAsync(buffer, cts.Token);
                if (result.MessageType == WebSocketMessageType.Close) return null;
                if (result.MessageType != WebSocketMessageType.Text) continue;
                if (payload.Length + result.Count > 64 * 1024) throw new InvalidDataException("message too large");
                payload.Write(buffer, 0, result.Count);
                if (result.EndOfMessage) break;
            }
            return JsonDocument.Parse(payload.ToArray());
        }
        catch (OperationCanceledException) { return null; }
        catch (JsonException) { return null; }
    }

    private static async Task SendAsync<T>(WebSocket socket, T value, CancellationToken token)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value, JsonDefaults.Options));
        await socket.SendAsync(bytes, WebSocketMessageType.Text, true, token);
    }

    private static async Task CloseQuietly(WebSocket socket, WebSocketCloseStatus status, string reason)
    {
        try
        {
            if (socket.State == WebSocketState.Open)
                await socket.CloseAsync(status, reason, CancellationToken.None);
        }
        catch { }
    }

    private static string Sanitize(Exception error)
    {
        var text = error.Message;
        if (string.IsNullOrWhiteSpace(text)) text = "Window action failed.";
        return text.Length > 180 ? text[..180] : text;
    }
}

public sealed class WindowMonitorService : BackgroundService
{
    private readonly WindowService _windows;
    private readonly BridgeHub _hub;
    private readonly object _debounceGate = new();
    private Timer? _debounceTimer;

    public WindowMonitorService(WindowService windows, BridgeHub hub)
    {
        _windows = windows;
        _hub = hub;
    }

    public override Task StartAsync(CancellationToken cancellationToken)
    {
        _windows.Backend.Changed += OnNativeChanged;
        return base.StartAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken token)
    {
        await RefreshAndBroadcastAsync(token);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));

        try
        {
            while (await timer.WaitForNextTickAsync(token))
                await RefreshAndBroadcastAsync(token);
        }
        catch (OperationCanceledException) { }
    }

    private void OnNativeChanged()
    {
        lock (_debounceGate)
        {
            _debounceTimer ??= new Timer(async _ =>
            {
                try { await RefreshAndBroadcastAsync(CancellationToken.None); } catch { }
            });
            _debounceTimer.Change(TimeSpan.FromMilliseconds(150), Timeout.InfiniteTimeSpan);
        }
    }

    private async Task RefreshAndBroadcastAsync(CancellationToken token)
    {
        try
        {
            var result = _windows.Refresh();
            if (result.Changed) await _hub.BroadcastAsync(result.Snapshot, token);
        }
        catch
        {
            // Reconciliation retries on the next native event or five-second pass.
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _windows.Backend.Changed -= OnNativeChanged;
        lock (_debounceGate)
        {
            _debounceTimer?.Dispose();
            _debounceTimer = null;
        }
        await base.StopAsync(cancellationToken);
    }
}

internal static class JsonDefaults
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}

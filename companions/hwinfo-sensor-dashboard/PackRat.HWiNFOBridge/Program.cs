using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PackRat.HWiNFOBridge;

public static class Program
{
    public const int DefaultPort = 17489;
    public const int ProtocolVersion = 1;
    public const string CompanionVersion = "1.0.0";
    private const string FixtureKey = "hwinfo-fixture-key";

    public static async Task<int> Main(string[] args)
    {
        if (args.Contains("--self-test", StringComparer.OrdinalIgnoreCase))
            return SelfTest.Run();

        var fixtureRequested = args.Contains("--fixture", StringComparer.OrdinalIgnoreCase);
        var fixture = fixtureRequested && Environment.GetEnvironmentVariable("PACKRAT_HWINFO_BRIDGE_TEST") == "1";
        if (fixtureRequested && !fixture)
        {
            Console.Error.WriteLine("Fixture mode is restricted to the PackRat test environment.");
            return 2;
        }

        var port = ArgInt(args, "--port", DefaultPort);
        var noBrowser = fixture || args.Contains("--no-browser", StringComparer.OrdinalIgnoreCase);
        var fixtureStateFile = ArgString(args, "--fixture-state-file", "");

        if (!OperatingSystem.IsWindows() && !fixture)
        {
            Console.Error.WriteLine("PackRat HWiNFO Bridge requires Windows.");
            return 2;
        }

        if (!fixture && await ExistingBridgeIsHealthy(port))
        {
            if (!noBrowser) OpenBrowser($"http://127.0.0.1:{port}/");
            Console.WriteLine("PackRat HWiNFO Bridge is already running.");
            return 0;
        }

        var pairing = new PairingKeyStore(fixture, FixtureKey);
        var builder = WebApplication.CreateBuilder(args);
        builder.WebHost.UseUrls($"http://127.0.0.1:{port}");
        builder.Logging.ClearProviders();

        builder.Services.AddSingleton(pairing);
        builder.Services.AddSingleton<IHwinfoSource>(_ => fixture ? new FakeHWiNFOSource(fixtureStateFile) : new HWiNFOSharedMemorySource());
        builder.Services.AddSingleton<TelemetryState>();
        builder.Services.AddSingleton<BridgeHub>();
        builder.Services.AddHostedService<TelemetryMonitorService>();

        var app = builder.Build();
        app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });

        app.Use(async (context, next) =>
        {
            if (!BridgeSecurity.IsLoopback(context.Connection.RemoteIpAddress))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { ok=false, error="loopback only" });
                return;
            }

            var origin = context.Request.Headers.Origin.ToString();
            if (!BridgeSecurity.IsAllowedOrigin(origin, port))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { ok=false, error="origin not allowed" });
                return;
            }

            context.Response.Headers["Cache-Control"] = "no-store";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            await next();
        });

        app.MapGet("/health", (TelemetryState state, BridgeHub hub) => Results.Json(new
        {
            ok = true,
            product = "PackRat HWiNFO Bridge",
            version = CompanionVersion,
            protocol = ProtocolVersion,
            port,
            clients = hub.ClientCount,
            status = state.Snapshot.Status.Code,
            fixture
        }));

        app.MapGet("/api/status", (TelemetryState state) =>
        {
            var snapshot = state.Snapshot;
            return Results.Json(new
            {
                ok = snapshot.Status.Code == "live",
                status = snapshot.Status,
                pollTime = snapshot.PollTime,
                sensorCount = snapshot.Sensors.Count
            });
        });

        app.MapGet("/", (TelemetryState state) => Results.Content(SetupHtml(port, pairing.Key, state.Snapshot.Status), "text/html; charset=utf-8"));

        app.MapPost("/reset-key", async context =>
        {
            pairing.Rotate();
            context.Response.Redirect("/");
            await Task.CompletedTask;
        });

        app.Map("/widget", async context =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            var hub = context.RequestServices.GetRequiredService<BridgeHub>();
            var state = context.RequestServices.GetRequiredService<TelemetryState>();
            using var socket = await context.WebSockets.AcceptWebSocketAsync();
            await hub.HandleAsync(socket, state, pairing, context.RequestAborted);
        });

        app.Lifetime.ApplicationStarted.Register(() =>
        {
            Console.WriteLine($"PackRat HWiNFO Bridge {CompanionVersion} listening on 127.0.0.1:{port}");
            Console.WriteLine($"Pairing key: {pairing.Key}");
            if (!fixture) Console.WriteLine($"Pairing key file: {pairing.Path}");
            Console.WriteLine("HWiNFO sensor data stays on localhost. No PackRat cloud is used.");
            if (!noBrowser) OpenBrowser($"http://127.0.0.1:{port}/");
        });

        try
        {
            await app.RunAsync();
        }
        catch (IOException error) when (error.Message.Contains("address", StringComparison.OrdinalIgnoreCase))
        {
            Console.Error.WriteLine($"Port {port} is already in use by another process.");
            return 3;
        }
        finally
        {
            app.Services.GetService<IHwinfoSource>()?.Dispose();
        }

        return 0;
    }

    private static int ArgInt(string[] args, string name, int fallback)
    {
        var index = Array.FindIndex(args, value => value.Equals(name, StringComparison.OrdinalIgnoreCase));
        return index >= 0 && index + 1 < args.Length && int.TryParse(args[index + 1], out var parsed) ? parsed : fallback;
    }

    private static string ArgString(string[] args, string name, string fallback)
    {
        var index = Array.FindIndex(args, value => value.Equals(name, StringComparison.OrdinalIgnoreCase));
        return index >= 0 && index + 1 < args.Length ? args[index + 1] : fallback;
    }

    private static async Task<bool> ExistingBridgeIsHealthy(int port)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(650) };
        try
        {
            var response = await client.GetFromJsonAsync<JsonElement>($"http://127.0.0.1:{port}/health");
            return response.TryGetProperty("product", out var product) &&
                   product.GetString() == "PackRat HWiNFO Bridge";
        }
        catch { return false; }
    }

    private static void OpenBrowser(string url)
    {
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { }
    }

    private static string SetupHtml(int port, string key, ProviderStatus status)
    {
        var safeKey = WebUtility.HtmlEncode(key);
        var safeStatus = WebUtility.HtmlEncode(status.Code.Replace('_',' ').ToUpperInvariant());
        var safeMessage = WebUtility.HtmlEncode(status.Message);
        return $$"""
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; object-src 'none'; base-uri 'none'">
<title>PackRat HWiNFO Bridge</title>
<style>
:root{font-family:Inter,Segoe UI,Arial,sans-serif;color:#f6f8fa;background:#080b0f}*{box-sizing:border-box}body{margin:0;padding:30px;background:radial-gradient(circle at 80% 0,#55d6ff18,transparent 34%),#080b0f}.wrap{max-width:820px;margin:auto}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;color:#8c99a5}.card{margin-top:20px;padding:22px;border:1px solid #ffffff18;border-radius:20px;background:#11161dcc}h1{font-size:34px;margin:7px 0 8px}h2{font-size:18px;margin:0 0 8px}p{color:#aeb8c2;line-height:1.55}.key{font:800 16px ui-monospace,Consolas,monospace;word-break:break-all;background:#07090c;border:1px solid #ffffff1c;border-radius:12px;padding:15px;margin:12px 0}.row{display:flex;gap:10px;flex-wrap:wrap}.button,button{min-height:44px;padding:0 16px;border:0;border-radius:11px;background:#2be86a;color:#041008;font-weight:900;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}.secondary{background:#18222c;color:#edf3f7;border:1px solid #ffffff18}.pill{display:inline-block;border:1px solid #ffffff1c;border-radius:999px;padding:7px 11px;color:#c7d0d8;font-size:12px}.steps{display:grid;gap:9px;margin-top:16px}.step{padding:13px;border:1px solid #ffffff12;border-radius:11px;color:#dbe2e8}.notice{border-left:3px solid #ffb84d;padding-left:12px}.muted{font-size:12px;color:#8996a3}
</style>
</head>
<body><div class="wrap">
<div class="eyebrow">PACKRAT · LOCAL WINDOWS COMPANION</div>
<h1>HWiNFO Bridge</h1>
<p>Reads the HWiNFO Shared Memory interface already running on this PC and sends normalized sensor snapshots only to your local XENEON widget.</p>
<div class="row"><span class="pill">127.0.0.1:{{port}}</span><span class="pill">{{safeStatus}}</span></div>

<div class="card">
<h2>XENEON pairing key</h2>
<div id="key" class="key">{{safeKey}}</div>
<div class="row">
<button type="button" onclick="navigator.clipboard.writeText(document.getElementById('key').textContent)">Copy pairing key</button>
<form method="post" action="/reset-key"><button class="secondary" type="submit">Rotate key</button></form>
</div>
<div class="steps">
<div class="step"><b>1.</b> Install and start HWiNFO separately.</div>
<div class="step"><b>2.</b> Open HWiNFO Sensors and enable <b>Shared Memory Support</b>.</div>
<div class="step"><b>3.</b> Paste this local key into <b>HWiNFO Bridge Pairing Key</b> in the XENEON widget's iCUE settings.</div>
</div>
</div>

<div class="card">
<h2>Current HWiNFO status</h2>
<p>{{safeMessage}}</p>
<p class="notice">The free HWiNFO64 edition may disable Shared Memory after 12 hours of continuous runtime. PackRat reports that condition and does not bypass the limit.</p>
</div>

<div class="card">
<h2>Privacy and third-party notice</h2>
<p>No HWiNFO executable, library, license, sensor data, pairing key or account information is sent to PackRat. The bridge binds to localhost only.</p>
<p class="muted">HWiNFO is a third-party product and trademark of its respective owner. PackRat is independent and is not affiliated with, endorsed by, or sponsored by HWiNFO.</p>
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
        return origin == "null" || origin == "file://" ||
               origin == $"http://127.0.0.1:{port}" || origin == $"http://localhost:{port}";
    }

    public static bool FixedTimeKeyEquals(string? supplied, string expected)
    {
        if (string.IsNullOrEmpty(supplied)) return false;
        var a = SHA256.HashData(Encoding.UTF8.GetBytes(supplied));
        var b = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
        return CryptographicOperations.FixedTimeEquals(a,b);
    }
}

public sealed class PairingKeyStore
{
    private readonly bool _fixture;
    private readonly string _fixtureKey;
    public string Key { get; private set; }
    public string Path { get; }

    public PairingKeyStore(bool fixture, string fixtureKey)
    {
        _fixture = fixture;
        _fixtureKey = fixtureKey;
        if (fixture)
        {
            Key = fixtureKey;
            Path = "";
            return;
        }

        var root = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var directory = System.IO.Path.Combine(root, "PackRat", "HWiNFOBridge");
        Directory.CreateDirectory(directory);
        Path = System.IO.Path.Combine(directory, "bridge-key.txt");
        Key = LoadOrCreate();
    }

    public void Rotate()
    {
        if (_fixture) { Key = _fixtureKey; return; }
        Key = NewKey();
        File.WriteAllText(Path, Key + Environment.NewLine, new UTF8Encoding(false));
    }

    private string LoadOrCreate()
    {
        try
        {
            if (File.Exists(Path))
            {
                var existing = File.ReadAllText(Path, Encoding.UTF8).Trim();
                if (existing.Length >= 24) return existing;
            }
        }
        catch { }

        var key = NewKey();
        File.WriteAllText(Path, key + Environment.NewLine, new UTF8Encoding(false));
        return key;
    }

    private static string NewKey()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+','-').Replace('/','_');
    }
}

public sealed class TelemetryState
{
    private readonly object _gate = new();
    private SensorSnapshot _snapshot = new(
        "snapshot", Program.ProtocolVersion, Program.CompanionVersion, 0, 0,
        new ProviderStatus("starting", "Waiting for first HWiNFO read.", false, false, false, 0, 0),
        Array.Empty<SensorReadingDto>());

    public SensorSnapshot Snapshot { get { lock(_gate) return _snapshot; } }
    public void Set(SensorSnapshot value) { lock(_gate) _snapshot = value; }
}

public sealed class BridgeHub
{
    private readonly ConcurrentDictionary<Guid, ClientConnection> _clients = new();
    public int ClientCount => _clients.Count;

    public async Task HandleAsync(WebSocket socket, TelemetryState state, PairingKeyStore pairing, CancellationToken token)
    {
        var hello = await ReceiveJsonAsync(socket, TimeSpan.FromSeconds(5), token);
        if (hello is null)
        {
            await CloseQuietly(socket, WebSocketCloseStatus.PolicyViolation, "hello required");
            return;
        }

        using (hello)
        {
            var root = hello.RootElement;
            if (!root.TryGetProperty("type", out var type) || type.GetString() != "hello")
            {
                await SendDirect(socket, new { type="pairing_required", reason="hello_required" }, token);
                await CloseQuietly(socket, WebSocketCloseStatus.PolicyViolation, "hello required");
                return;
            }

            var protocol = root.TryGetProperty("protocol", out var p) && p.TryGetInt32(out var parsed) ? parsed : 0;
            if (protocol != Program.ProtocolVersion)
            {
                await SendDirect(socket, new { type="protocol_mismatch", expectedProtocol=Program.ProtocolVersion, companionVersion=Program.CompanionVersion }, token);
                await CloseQuietly(socket, WebSocketCloseStatus.PolicyViolation, "protocol mismatch");
                return;
            }

            var supplied = root.TryGetProperty("key", out var k) && k.ValueKind == JsonValueKind.String ? k.GetString() : null;
            if (!BridgeSecurity.FixedTimeKeyEquals(supplied, pairing.Key))
            {
                await SendDirect(socket, new { type="pairing_required", reason="invalid_key" }, token);
                await CloseQuietly(socket, WebSocketCloseStatus.PolicyViolation, "pairing");
                return;
            }
        }

        var client = new ClientConnection(socket);
        var id = Guid.NewGuid();
        _clients[id] = client;

        try
        {
            await client.SendObjectAsync(new { type="auth_ok", protocol=Program.ProtocolVersion, companionVersion=Program.CompanionVersion }, token);
            await client.SendObjectAsync(state.Snapshot, token);

            while (socket.State == WebSocketState.Open && !token.IsCancellationRequested)
            {
                var message = await ReceiveJsonAsync(socket, TimeSpan.FromMinutes(10), token);
                if (message is null) break;
                using (message)
                {
                    var root = message.RootElement;
                    if (root.TryGetProperty("type", out var type) && type.GetString() == "ping")
                        await client.SendObjectAsync(new { type="pong", at=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() }, token);
                }
            }
        }
        finally
        {
            _clients.TryRemove(id, out _);
            client.Dispose();
        }
    }

    public async Task BroadcastAsync(SensorSnapshot snapshot, CancellationToken token)
    {
        var payload = JsonSerializer.Serialize(snapshot, JsonDefaults.Options);
        foreach (var pair in _clients.ToArray())
        {
            var client = pair.Value;
            if (client.Socket.State != WebSocketState.Open)
            {
                _clients.TryRemove(pair.Key, out var removed);
                removed?.Dispose();
                continue;
            }
            try { await client.SendTextAsync(payload, token); }
            catch
            {
                _clients.TryRemove(pair.Key, out var removed);
                removed?.Dispose();
            }
        }
    }

    private static async Task<JsonDocument?> ReceiveJsonAsync(WebSocket socket, TimeSpan timeout, CancellationToken outer)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(outer);
        cts.CancelAfter(timeout);
        using var payload = new MemoryStream();
        var buffer = new byte[16*1024];
        try
        {
            while (true)
            {
                var result = await socket.ReceiveAsync(buffer, cts.Token);
                if (result.MessageType == WebSocketMessageType.Close) return null;
                if (result.MessageType != WebSocketMessageType.Text) continue;
                if (payload.Length + result.Count > 64*1024) throw new InvalidDataException("message too large");
                payload.Write(buffer,0,result.Count);
                if (result.EndOfMessage) break;
            }
            return JsonDocument.Parse(payload.ToArray());
        }
        catch (OperationCanceledException) { return null; }
        catch (JsonException) { return null; }
    }

    private static async Task SendDirect<T>(WebSocket socket, T value, CancellationToken token)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value, JsonDefaults.Options));
        await socket.SendAsync(bytes, WebSocketMessageType.Text, true, token);
    }

    private static async Task CloseQuietly(WebSocket socket, WebSocketCloseStatus status, string reason)
    {
        try { if(socket.State == WebSocketState.Open) await socket.CloseAsync(status, reason, CancellationToken.None); } catch { }
    }
}

public sealed class ClientConnection : IDisposable
{
    private readonly SemaphoreSlim _sendGate = new(1,1);
    public WebSocket Socket { get; }
    public ClientConnection(WebSocket socket) => Socket = socket;

    public Task SendObjectAsync<T>(T value, CancellationToken token) =>
        SendTextAsync(JsonSerializer.Serialize(value, JsonDefaults.Options), token);

    public async Task SendTextAsync(string payload, CancellationToken token)
    {
        await _sendGate.WaitAsync(token);
        try
        {
            if (Socket.State != WebSocketState.Open) return;
            var bytes = Encoding.UTF8.GetBytes(payload);
            await Socket.SendAsync(bytes, WebSocketMessageType.Text, true, token);
        }
        finally { _sendGate.Release(); }
    }

    public void Dispose() => _sendGate.Dispose();
}

public sealed class TelemetryMonitorService : BackgroundService
{
    private readonly IHwinfoSource _source;
    private readonly TelemetryState _state;
    private readonly BridgeHub _hub;
    private string _lastSerialized = "";
    private DateTimeOffset _lastHeartbeat = DateTimeOffset.MinValue;

    public TelemetryMonitorService(IHwinfoSource source, TelemetryState state, BridgeHub hub)
    {
        _source=source; _state=state; _hub=hub;
    }

    protected override async Task ExecuteAsync(CancellationToken token)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(750));
        while (!token.IsCancellationRequested)
        {
            await Refresh(token);
            try { if (!await timer.WaitForNextTickAsync(token)) break; }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task Refresh(CancellationToken token)
    {
        SourceReadResult result;
        try { result = _source.Read(); }
        catch (Exception error)
        {
            result = new SourceReadResult(
                new ProviderStatus("malformed", Sanitize(error.Message), false, false, false, 0, 0),
                0,0,Array.Empty<SensorReadingDto>());
        }

        var snapshot = new SensorSnapshot("snapshot", Program.ProtocolVersion, Program.CompanionVersion, result.PollTime, result.PollingPeriodMs, result.Status, result.Sensors);
        _state.Set(snapshot);
        var serialized = JsonSerializer.Serialize(snapshot, JsonDefaults.Options);
        var heartbeatDue = DateTimeOffset.UtcNow - _lastHeartbeat >= TimeSpan.FromSeconds(2);
        if (serialized != _lastSerialized || heartbeatDue)
        {
            _lastSerialized = serialized;
            _lastHeartbeat = DateTimeOffset.UtcNow;
            await _hub.BroadcastAsync(snapshot, token);
        }
    }

    private static string Sanitize(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "HWiNFO read failed.";
        return value.Length > 220 ? value[..220] : value;
    }
}

public sealed class FakeHWiNFOSource : IHwinfoSource
{
    private int _tick;
    private readonly string _stateFile;
    public FakeHWiNFOSource(string stateFile = "") => _stateFile = stateFile;
    public SourceReadResult Read()
    {
        _tick++;
        var state = Environment.GetEnvironmentVariable("PACKRAT_HWINFO_FIXTURE_STATE") ?? "live";
        if (!string.IsNullOrWhiteSpace(_stateFile) && File.Exists(_stateFile))
        {
            try { state = File.ReadAllText(_stateFile).Trim(); } catch { }
        }
        if (!string.Equals(state,"live",StringComparison.OrdinalIgnoreCase))
        {
            return new SourceReadResult(new ProviderStatus(state, $"Fixture state: {state}", true, state!="shared_memory_unavailable", false, 0, 0), 0, 1000, Array.Empty<SensorReadingDto>());
        }

        var stamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var list = new List<SensorReadingDto>();
        for(var i=0;i<128;i++)
        {
            var type = (i%6) switch {0=>"Temperature",1=>"Usage",2=>"Power",3=>"Fan",4=>"Clock",_=>"Voltage"};
            var unit = type switch {"Temperature"=>"°C","Usage"=>"%","Power"=>"W","Fan"=>"RPM","Clock"=>"MHz",_=>"V"};
            var device = i==127 ? "主板 センサー 🎮" : $"Fixture Device {i/8:00}";
            var label = i==127 ? "ポンプ温度 gyqp <b>not markup</b>" : $"Sensor {i:000}";
            var value = i==126 ? 9.87654321E12 : 30 + i + Math.Sin(_tick/3.0+i)*3;
            var fingerprint = $"{device}␟{label}␟{unit}␟{type}";
            list.Add(new SensorReadingDto(
                $"{i/8+1:X8}:{i%2}:{i+100:X8}", fingerprint, (uint)(i/8+1), (uint)(i%2), (uint)(i+100),
                device, device, label, label, unit, type, value, value-5, value+7, value-1.2, true, stamp));
        }
        return new SourceReadResult(
            new ProviderStatus("live","Fixture HWiNFO Shared Memory is live.",true,true,true,16,list.Count,true),
            stamp,1000,list);
    }
    public void Dispose(){}
}

internal static class JsonDefaults
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}

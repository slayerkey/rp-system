using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

const int Port = 17484;
const string Version = "1.0.0";

if (args.Contains("--self-test", StringComparer.OrdinalIgnoreCase))
{
    return SelfTest.Run();
}

var fixtureMode =
    args.Contains("--fixture", StringComparer.OrdinalIgnoreCase) &&
    Environment.GetEnvironmentVariable("PACKRAT_AUDIO_BRIDGE_TEST") == "1";

if (!OperatingSystem.IsWindows() && !fixtureMode)
{
    Console.Error.WriteLine("PackRat Audio Bridge requires Windows.");
    return 2;
}

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls($"http://127.0.0.1:{Port}");
builder.Logging.ClearProviders();
builder.Services.AddSingleton<IAudioBackend>(_ =>
    fixtureMode ? new FakeAudioBackend() : new CoreAudioBackend());
builder.Services.AddSingleton<AudioService>();
builder.Services.AddSingleton<BridgeHub>();
builder.Services.AddHostedService<AudioPoller>();

var app = builder.Build();
app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });

app.Use(async (ctx, next) =>
{
    if (!BridgeSecurity.IsLoopback(ctx.Connection.RemoteIpAddress))
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        await ctx.Response.WriteAsJsonAsync(new { ok = false, error = "loopback only" });
        return;
    }

    var origin = ctx.Request.Headers.Origin.ToString();
    if (!BridgeSecurity.IsAllowedOrigin(origin))
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        await ctx.Response.WriteAsJsonAsync(new { ok = false, error = "origin not allowed" });
        return;
    }

    if (!string.IsNullOrWhiteSpace(origin))
    {
        ctx.Response.Headers["Access-Control-Allow-Origin"] = origin;
    }
    ctx.Response.Headers["Cache-Control"] = "no-store";
    await next();
});

app.MapGet("/health", (AudioService service, BridgeHub hub) =>
{
    var snapshot = service.Snapshot();
    return Results.Json(new
    {
        ok = true,
        protocol = 1,
        version = Version,
        port = Port,
        clients = hub.ClientCount,
        capabilities = snapshot.Capabilities
    });
});

app.MapGet("/state", (AudioService service) => Results.Json(service.Snapshot()));

app.MapGet("/ws", async (HttpContext context, AudioService service, BridgeHub hub) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    using var socket = await context.WebSockets.AcceptWebSocketAsync();
    await hub.HandleAsync(socket, service, context.RequestAborted);
});

Console.WriteLine($"PackRat Audio Bridge {Version} listening on 127.0.0.1:{Port}");
await app.RunAsync();
return 0;

public static class BridgeSecurity
{
    public static bool IsLoopback(IPAddress? address)
    {
        if (address is null) return false;
        if (IPAddress.IsLoopback(address)) return true;
        return address.IsIPv4MappedToIPv6 && IPAddress.IsLoopback(address.MapToIPv4());
    }

    public static bool IsAllowedOrigin(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;
        var origin = value.Trim().ToLowerInvariant();
        return
            origin == "null" ||
            origin == "file://" ||
            origin == "http://127.0.0.1" ||
            origin.StartsWith("http://127.0.0.1:", StringComparison.Ordinal) ||
            origin == "http://localhost" ||
            origin.StartsWith("http://localhost:", StringComparison.Ordinal);
    }
}

public sealed record AudioEndpoint(
    string Id,
    string Name,
    int? Volume,
    bool Muted,
    bool VolumeAvailable,
    bool MuteAvailable);

public sealed record AudioCapabilities(
    bool DefaultDeviceSwitching,
    bool OutputVolume,
    bool InputVolume);

public sealed record BridgeInfo(bool Listening, string Version);

public sealed record AudioSnapshot(
    int Protocol,
    BridgeInfo Bridge,
    AudioCapabilities Capabilities,
    string DefaultOutputId,
    string DefaultInputId,
    IReadOnlyList<AudioEndpoint> Outputs,
    IReadOnlyList<AudioEndpoint> Inputs,
    string? Error)
{
    [JsonPropertyName("type")]
    public string Type => "snapshot";
}

public interface IAudioBackend
{
    AudioSnapshot Read();
    void SetDefaultOutput(string id);
    void SetDefaultInput(string id);
    void SetOutputVolume(int value);
    void SetInputVolume(int value);
    void SetOutputMute(bool value);
    void SetInputMute(bool value);
}

public sealed class AudioService
{
    private readonly IAudioBackend _backend;

    public AudioService(IAudioBackend backend) => _backend = backend;

    public AudioSnapshot Snapshot() => _backend.Read();

    public void Execute(JsonElement root)
    {
        var command = RequiredString(root, "command");

        switch (command)
        {
            case "refresh":
                return;
            case "set-default-output":
                _backend.SetDefaultOutput(RequiredString(root, "deviceId"));
                return;
            case "set-default-input":
                _backend.SetDefaultInput(RequiredString(root, "deviceId"));
                return;
            case "set-output-volume":
                _backend.SetOutputVolume(RequiredVolume(root));
                return;
            case "set-input-volume":
                _backend.SetInputVolume(RequiredVolume(root));
                return;
            case "set-output-mute":
                _backend.SetOutputMute(RequiredBoolean(root));
                return;
            case "set-input-mute":
                _backend.SetInputMute(RequiredBoolean(root));
                return;
            default:
                throw new ArgumentException("Unknown command.");
        }
    }

    private static string RequiredString(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
            throw new ArgumentException($"Missing {name}.");

        var text = (value.GetString() ?? "").Trim();
        if (text.Length is 0 or > 2048)
            throw new ArgumentException($"Invalid {name}.");

        return text;
    }

    private static int RequiredVolume(JsonElement root)
    {
        if (!root.TryGetProperty("value", out var value) ||
            value.ValueKind != JsonValueKind.Number ||
            !value.TryGetInt32(out var result) ||
            result < 0 ||
            result > 100)
            throw new ArgumentOutOfRangeException("value", "Volume must be 0-100.");

        return result;
    }

    private static bool RequiredBoolean(JsonElement root)
    {
        if (!root.TryGetProperty("value", out var value) ||
            (value.ValueKind != JsonValueKind.True && value.ValueKind != JsonValueKind.False))
            throw new ArgumentException("value must be boolean.");

        return value.GetBoolean();
    }
}

public sealed class BridgeHub
{
    private readonly ConcurrentDictionary<Guid, WebSocket> _clients = new();
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public int ClientCount => _clients.Count;

    public async Task HandleAsync(WebSocket socket, AudioService service, CancellationToken token)
    {
        var id = Guid.NewGuid();
        _clients[id] = socket;

        try
        {
            await SendAsync(socket, service.Snapshot(), token);
            var buffer = new byte[32 * 1024];

            while (socket.State == WebSocketState.Open && !token.IsCancellationRequested)
            {
                using var payload = new MemoryStream();
                WebSocketReceiveResult result;

                do
                {
                    result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await socket.CloseAsync(
                            WebSocketCloseStatus.NormalClosure,
                            "bye",
                            CancellationToken.None);
                        return;
                    }

                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        if (payload.Length + result.Count > 64 * 1024)
                            throw new InvalidDataException("command too large");
                        payload.Write(buffer, 0, result.Count);
                    }
                }
                while (!result.EndOfMessage);

                if (payload.Length == 0) continue;

                try
                {
                    using var document = JsonDocument.Parse(payload.ToArray());
                    service.Execute(document.RootElement);
                    await BroadcastAsync(service.Snapshot(), token);
                }
                catch (Exception error)
                {
                    await SendAsync(socket, new
                    {
                        type = "error",
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

    public async Task BroadcastAsync<T>(T value, CancellationToken token)
    {
        foreach (var pair in _clients.ToArray())
        {
            var socket = pair.Value;
            if (socket.State != WebSocketState.Open)
            {
                _clients.TryRemove(pair.Key, out _);
                continue;
            }

            try
            {
                await SendAsync(socket, value, token);
            }
            catch
            {
                _clients.TryRemove(pair.Key, out _);
            }
        }
    }

    private static async Task SendAsync<T>(
        WebSocket socket,
        T value,
        CancellationToken token)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value, Json));
        await socket.SendAsync(
            new ArraySegment<byte>(bytes),
            WebSocketMessageType.Text,
            true,
            token);
    }

    private static string Sanitize(Exception error)
    {
        var text = error is COMException com
            ? $"Windows audio error 0x{com.HResult:X8}"
            : error.Message;

        return text.Length > 180 ? text[..180] : text;
    }
}

public sealed class AudioPoller : BackgroundService
{
    private readonly AudioService _service;
    private readonly BridgeHub _hub;
    private string _lastSnapshot = "";

    public AudioPoller(AudioService service, BridgeHub hub)
    {
        _service = service;
        _hub = hub;
    }

    protected override async Task ExecuteAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            try
            {
                var snapshot = _service.Snapshot();
                var serialized = JsonSerializer.Serialize(snapshot);
                if (serialized != _lastSnapshot)
                {
                    _lastSnapshot = serialized;
                    await _hub.BroadcastAsync(snapshot, token);
                }
            }
            catch
            {
                // Individual reads fail soft. The next poll retries automatically.
            }

            try
            {
                await Task.Delay(750, token);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}

public sealed class FakeAudioBackend : IAudioBackend
{
    private readonly object _gate = new();
    private readonly List<AudioEndpoint> _outputs;
    private readonly List<AudioEndpoint> _inputs;
    private string _defaultOutputId;
    private string _defaultInputId;
    private readonly bool _canSwitch;

    public FakeAudioBackend(
        IEnumerable<AudioEndpoint>? outputs = null,
        IEnumerable<AudioEndpoint>? inputs = null,
        string? defaultOutputId = null,
        string? defaultInputId = null,
        bool canSwitch = true)
    {
        _outputs = (outputs ?? DefaultOutputs()).ToList();
        _inputs = (inputs ?? DefaultInputs()).ToList();
        _defaultOutputId = defaultOutputId ?? _outputs.FirstOrDefault()?.Id ?? "";
        _defaultInputId = defaultInputId ?? _inputs.FirstOrDefault()?.Id ?? "";
        _canSwitch = canSwitch;
    }

    public AudioSnapshot Read()
    {
        lock (_gate)
        {
            return new AudioSnapshot(
                1,
                new BridgeInfo(true, "1.0.0"),
                new AudioCapabilities(_canSwitch, true, true),
                _defaultOutputId,
                _defaultInputId,
                _outputs.ToArray(),
                _inputs.ToArray(),
                null);
        }
    }

    public void SetDefaultOutput(string id)
    {
        lock (_gate)
        {
            EnsureSwitching();
            EnsureKnown(_outputs, id);
            _defaultOutputId = id;
        }
    }

    public void SetDefaultInput(string id)
    {
        lock (_gate)
        {
            EnsureSwitching();
            EnsureKnown(_inputs, id);
            _defaultInputId = id;
        }
    }

    public void SetOutputVolume(int value) =>
        Update(_outputs, _defaultOutputId, value, null);

    public void SetInputVolume(int value) =>
        Update(_inputs, _defaultInputId, value, null);

    public void SetOutputMute(bool value) =>
        Update(_outputs, _defaultOutputId, null, value);

    public void SetInputMute(bool value) =>
        Update(_inputs, _defaultInputId, null, value);

    public void RemoveOutput(string id)
    {
        lock (_gate) _outputs.RemoveAll(endpoint => endpoint.Id == id);
    }

    public void ClearOutputs()
    {
        lock (_gate)
        {
            _outputs.Clear();
            _defaultOutputId = "";
        }
    }

    public void ClearInputs()
    {
        lock (_gate)
        {
            _inputs.Clear();
            _defaultInputId = "";
        }
    }

    private void Update(
        List<AudioEndpoint> endpoints,
        string id,
        int? volume,
        bool? muted)
    {
        lock (_gate)
        {
            var index = endpoints.FindIndex(endpoint => endpoint.Id == id);
            if (index < 0) throw new InvalidOperationException("No default endpoint.");

            var endpoint = endpoints[index];

            if (volume.HasValue)
            {
                if (!endpoint.VolumeAvailable)
                    throw new InvalidOperationException("Endpoint volume unavailable.");
                endpoint = endpoint with { Volume = Math.Clamp(volume.Value, 0, 100) };
            }

            if (muted.HasValue)
            {
                if (!endpoint.MuteAvailable)
                    throw new InvalidOperationException("Endpoint mute unavailable.");
                endpoint = endpoint with { Muted = muted.Value };
            }

            endpoints[index] = endpoint;
        }
    }

    private void EnsureSwitching()
    {
        if (!_canSwitch)
            throw new NotSupportedException("Default-device switching is unavailable.");
    }

    private static void EnsureKnown(List<AudioEndpoint> endpoints, string id)
    {
        if (!endpoints.Any(endpoint => endpoint.Id == id))
            throw new ArgumentException("Unknown endpoint.");
    }

    private static IEnumerable<AudioEndpoint> DefaultOutputs() =>
    [
        new("out-speakers", "Speakers (Realtek Audio)", 64, false, true, true),
        new("out-headset", "Headphones (Arctis Nova Pro)", 38, false, true, true),
        new("out-display", "XENEON EDGE Display Audio", 72, false, true, true)
    ];

    private static IEnumerable<AudioEndpoint> DefaultInputs() =>
    [
        new("in-main", "Microphone (Scarlett Solo USB)", 82, false, true, true),
        new("in-camera", "Microphone (USB Camera)", 55, false, true, true)
    ];
}

public static class SelfTest
{
    public static int Run()
    {
        static void Require(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
        }

        static void Command(AudioService service, object value)
        {
            using var document = JsonDocument.Parse(JsonSerializer.Serialize(value));
            service.Execute(document.RootElement);
        }

        var longName =
            "A Very Long USB Audio Device Friendly Name Designed To Stress Every XENEON Layout Without Losing Protocol Data";

        var backend = new FakeAudioBackend(
            outputs:
            [
                new("o1", "Speakers", 60, false, true, true),
                new("o2", "Headphones", 35, false, true, true),
                new("o3", longName, 80, false, true, true)
            ],
            inputs:
            [
                new("i1", "Main Mic", 75, false, true, true),
                new("i2", "Backup Mic", 50, false, true, true),
                new("i3", "Fixed Gain Mic", null, false, false, true)
            ],
            defaultOutputId: "o1",
            defaultInputId: "i1");

        var service = new AudioService(backend);

        Require(service.Snapshot().Outputs.Count == 3, "multiple outputs");
        Require(service.Snapshot().Inputs.Count == 3, "multiple inputs");
        Require(service.Snapshot().Outputs[2].Name == longName, "long friendly name");

        Command(service, new { command = "set-default-output", deviceId = "o2" });
        Command(service, new { command = "set-default-input", deviceId = "i2" });
        Require(service.Snapshot().DefaultOutputId == "o2", "output switching");
        Require(service.Snapshot().DefaultInputId == "i2", "input switching");

        Command(service, new { command = "set-output-volume", value = 27 });
        Command(service, new { command = "set-input-volume", value = 41 });
        Require(service.Snapshot().Outputs.Single(x => x.Id == "o2").Volume == 27, "output volume");
        Require(service.Snapshot().Inputs.Single(x => x.Id == "i2").Volume == 41, "input volume");

        Command(service, new { command = "set-output-mute", value = true });
        Require(service.Snapshot().Outputs.Single(x => x.Id == "o2").Muted, "mute");
        Command(service, new { command = "set-output-mute", value = false });
        Require(!service.Snapshot().Outputs.Single(x => x.Id == "o2").Muted, "unmute");

        backend.RemoveOutput("o3");
        Require(service.Snapshot().Outputs.Count == 2, "device disappearance");
        backend.ClearOutputs();
        backend.ClearInputs();
        Require(service.Snapshot().Outputs.Count == 0, "no outputs");
        Require(service.Snapshot().Inputs.Count == 0, "no inputs");

        var fixedMic = new AudioService(new FakeAudioBackend(
            inputs: [new("fixed", "Fixed Gain Mic", null, false, false, true)],
            defaultInputId: "fixed"));
        Require(!fixedMic.Snapshot().Inputs.Single().VolumeAvailable, "mic volume capability");
        try
        {
            Command(fixedMic, new { command = "set-input-volume", value = 10 });
            throw new Exception("fixed-gain microphone accepted volume");
        }
        catch (InvalidOperationException)
        {
        }

        var limited = new AudioService(new FakeAudioBackend(canSwitch: false));
        Require(!limited.Snapshot().Capabilities.DefaultDeviceSwitching, "switch capability");
        try
        {
            Command(limited, new
            {
                command = "set-default-output",
                deviceId = "out-headset"
            });
            throw new Exception("limited backend accepted switching");
        }
        catch (NotSupportedException)
        {
        }

        Require(BridgeSecurity.IsAllowedOrigin("null"), "file origin");
        Require(BridgeSecurity.IsAllowedOrigin("http://127.0.0.1:8080"), "loopback origin");
        Require(!BridgeSecurity.IsAllowedOrigin("https://evil.example"), "remote origin rejection");

        Console.WriteLine("PACKRAT AUDIO BRIDGE SELF-TEST PASS");
        return 0;
    }
}

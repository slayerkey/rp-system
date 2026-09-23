using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO.MemoryMappedFiles;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PackRat.HwinfoBridge;

public static class Program
{
    public const int Port = 17492;
    public const int Protocol = 1;
    public const string Version = "1.0.0";

    public static async Task<int> Main(string[] args)
    {
        if (args.Contains("--self-test", StringComparer.OrdinalIgnoreCase))
            return SelfTest.Run();

        var fixtureRequested = args.Contains("--fixture", StringComparer.OrdinalIgnoreCase);
        var fixture = fixtureRequested && Environment.GetEnvironmentVariable("PACKRAT_HWINFO_BRIDGE_TEST") == "1";
        if (fixtureRequested && !fixture)
        {
            Console.Error.WriteLine("Fixture mode is restricted to PackRat QA.");
            return 2;
        }

        if (!OperatingSystem.IsWindows() && !fixture)
        {
            Console.Error.WriteLine("PackRat HWiNFO Bridge requires Windows.");
            return 2;
        }

        var builder = WebApplication.CreateBuilder(args);
        builder.WebHost.UseUrls($"http://127.0.0.1:{Port}");
        builder.Logging.ClearProviders();
        builder.Services.AddSingleton<IHwinfoSource>(_ => fixture ? new FixtureHwinfoSource() : new HwinfoSharedMemorySource());
        builder.Services.AddSingleton<SensorState>();
        builder.Services.AddSingleton<ClientHub>();
        builder.Services.AddHostedService<SensorPoller>();

        var app = builder.Build();
        app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });
        app.Use(async (context, next) =>
        {
            if (!IsLoopback(context.Connection.RemoteIpAddress))
            {
                context.Response.StatusCode = 403;
                return;
            }
            var origin = context.Request.Headers.Origin.ToString();
            if (!AllowedOrigin(origin))
            {
                context.Response.StatusCode = 403;
                return;
            }
            context.Response.Headers.CacheControl = "no-store";
            await next();
        });

        app.MapGet("/health", (SensorState state, ClientHub hub) =>
        {
            var snap = state.Current;
            return Results.Json(new {
                ok = true,
                product = "PackRat HWiNFO Bridge",
                version = Version,
                protocol = Protocol,
                port = Port,
                clients = hub.Count,
                hwinfoStatus = snap.Status,
                sensorCount = snap.Sensors.Count,
                lastUpdateUtc = snap.GeneratedUtc
            });
        });

        app.MapGet("/", () => Results.Content(SetupHtml(), "text/html; charset=utf-8"));

        app.Map("/widget", async context =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = 400;
                return;
            }
            var socket = await context.WebSockets.AcceptWebSocketAsync();
            var hub = context.RequestServices.GetRequiredService<ClientHub>();
            var state = context.RequestServices.GetRequiredService<SensorState>();
            await hub.HandleAsync(socket, state, context.RequestAborted);
        });

        app.Lifetime.ApplicationStarted.Register(() =>
        {
            Console.WriteLine($"PackRat HWiNFO Bridge {Version} listening on 127.0.0.1:{Port}");
            Console.WriteLine("Read-only HWiNFO Shared Memory bridge. No PackRat cloud, telemetry, or HWiNFO modification.");
        });

        await app.RunAsync();
        return 0;
    }

    static bool IsLoopback(IPAddress? ip) =>
        ip is not null && (IPAddress.IsLoopback(ip) || (ip.IsIPv4MappedToIPv6 && IPAddress.IsLoopback(ip.MapToIPv4())));

    static bool AllowedOrigin(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return true;
        var value = raw.Trim().ToLowerInvariant();
        return value is "null" or "file://" ||
               value == $"http://127.0.0.1:{Port}" ||
               value == $"http://localhost:{Port}";
    }

    static string SetupHtml() => """
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PackRat HWiNFO Bridge</title><style>
body{font:15px Segoe UI,Arial,sans-serif;background:#07090d;color:#f5f7fa;margin:0;padding:34px}.wrap{max-width:760px;margin:auto}
small{color:#ffb21e;font-weight:800;letter-spacing:.14em}h1{font-size:36px;margin:8px 0}.card{background:#10151d;border:1px solid #ffffff18;border-radius:18px;padding:22px;margin-top:22px}
p,li{color:#aeb8c5;line-height:1.55}.ok{color:#68efa0;font-weight:800}code{color:#fff}
</style></head><body><div class="wrap"><small>PACKRAT · LOCAL WINDOWS COMPANION</small><h1>HWiNFO Sensor Bridge</h1>
<p>Read-only local bridge for HWiNFO Sensor Dashboard on XENEON Edge. It reads HWiNFO's documented Shared Memory interface and exposes normalized sensor data only on localhost.</p>
<div class="card"><div class="ok">LOCAL ONLY · 127.0.0.1:17492</div><ol><li>Install and start HWiNFO separately.</li><li>Open HWiNFO Settings and enable <b>Shared Memory Support</b>.</li><li>Keep HWiNFO Sensors active. The XENEON widget reconnects automatically.</li></ol>
<p>HWiNFO Free can stop Shared Memory after its allowed runtime. This bridge does not bypass or reset that limit.</p></div>
<p>HWiNFO is third-party software and is not bundled, modified, or launched by PackRat.</p></div></body></html>
""";
}

public sealed record SensorReading(
    string Key,
    string Fingerprint,
    uint SensorId,
    uint SensorInstance,
    uint ReadingId,
    int Type,
    string Device,
    string Label,
    string Unit,
    double? Value,
    double? Min,
    double? Max,
    double? Avg);

public sealed record SensorSnapshot(
    string Type,
    int Protocol,
    string CompanionVersion,
    string Status,
    string Message,
    long? HwinfoPollUnix,
    uint? HwinfoPollingPeriodMs,
    DateTimeOffset GeneratedUtc,
    IReadOnlyList<SensorReading> Sensors)
{
    public static SensorSnapshot Initial => new("snapshot", Program.Protocol, Program.Version, "starting",
        "Connecting to HWiNFO Shared Memory.", null, null, DateTimeOffset.UtcNow, Array.Empty<SensorReading>());
}

public interface IHwinfoSource
{
    SensorSnapshot Read();
}

public sealed class HwinfoSharedMemorySource : IHwinfoSource
{
    const string MapName = @"Global\HWiNFO_SENS_SM2";
    const string MutexName = @"Global\HWiNFO_SM2_MUTEX";
    bool _everAvailable;

    public SensorSnapshot Read()
    {
        try
        {
            using var mmf = MemoryMappedFile.OpenExisting(MapName, MemoryMappedFileRights.Read);
            _everAvailable = true;
            using var mutex = Mutex.OpenExisting(MutexName);
            if (!mutex.WaitOne(TimeSpan.FromMilliseconds(750)))
                return Status("hwinfo_busy", "HWiNFO Shared Memory is busy. Retrying automatically.");

            try
            {
                using var view = mmf.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
                var capacity = checked((int)Math.Min(view.Capacity, int.MaxValue));
                if (capacity < HwinfoParser.HeaderSize) return Status("shared_memory_unavailable", "HWiNFO Shared Memory is incomplete.");
                var bytes = new byte[capacity];
                view.ReadArray(0, bytes, 0, bytes.Length);
                return BuildSnapshot(bytes);
            }
            finally
            {
                try { mutex.ReleaseMutex(); } catch { }
            }
        }
        catch (FileNotFoundException)
        {
            return MissingMap();
        }
        catch (WaitHandleCannotBeOpenedException)
        {
            return Status("hwinfo_starting", "HWiNFO Shared Memory exists but its consistency mutex is not ready yet.");
        }
        catch (UnauthorizedAccessException)
        {
            return Status("access_denied", "HWiNFO Shared Memory could not be opened. Run HWiNFO and the PackRat bridge at matching privilege levels.");
        }
        catch (Exception ex)
        {
            return Status("shared_memory_unavailable", "HWiNFO Shared Memory could not be read: " + Safe(ex.Message));
        }
    }

    SensorSnapshot MissingMap()
    {
        var running = Process.GetProcesses().Any(p =>
        {
            try { return p.ProcessName.StartsWith("HWiNFO", StringComparison.OrdinalIgnoreCase); }
            catch { return false; }
        });

        if (!running)
            return Status("hwinfo_not_running", "HWiNFO is not running. Start HWiNFO with Sensors active.");

        if (_everAvailable)
            return Status("shared_memory_unavailable",
                "HWiNFO Shared Memory became unavailable. HWiNFO Free can disable Shared Memory after 12 hours; restart HWiNFO or use an eligible HWiNFO license.");

        return Status("shared_memory_disabled",
            "HWiNFO is running but Shared Memory is unavailable. Enable Shared Memory Support in HWiNFO Settings.");
    }

    SensorSnapshot BuildSnapshot(byte[] bytes)
    {
        HwinfoDocument doc;
        try { doc = HwinfoParser.Parse(bytes); }
        catch (Exception ex) { return Status("shared_memory_unavailable", "HWiNFO Shared Memory metadata is invalid: " + Safe(ex.Message)); }

        if (doc.Signature == "DEAD")
            return Status("shared_memory_unavailable",
                "HWiNFO Shared Memory is inactive. HWiNFO Free can disable Shared Memory after 12 hours; restart HWiNFO or use an eligible HWiNFO license.");

        if (doc.Signature != "HWiS")
            return Status("shared_memory_unavailable", "HWiNFO Shared Memory is not active.");

        var staleAfter = Math.Max(10.0, (doc.PollingPeriodMs ?? 2000) / 1000.0 * 4.0);
        var age = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - doc.PollUnix;
        if (doc.PollUnix > 0 && age > staleAfter)
            return new("snapshot", Program.Protocol, Program.Version, "sensors_not_active",
                "HWiNFO sensor polling is not updating. Open or restart the HWiNFO Sensors window.",
                doc.PollUnix, doc.PollingPeriodMs, DateTimeOffset.UtcNow, doc.Readings);

        if (doc.Readings.Count == 0)
            return new("snapshot", Program.Protocol, Program.Version, "no_sensors",
                "HWiNFO Shared Memory is active but no sensor readings are available.",
                doc.PollUnix, doc.PollingPeriodMs, DateTimeOffset.UtcNow, doc.Readings);

        return new("snapshot", Program.Protocol, Program.Version, "ok",
            "HWiNFO Shared Memory connected.", doc.PollUnix, doc.PollingPeriodMs, DateTimeOffset.UtcNow, doc.Readings);
    }

    static SensorSnapshot Status(string code, string message) =>
        new("snapshot", Program.Protocol, Program.Version, code, message, null, null, DateTimeOffset.UtcNow, Array.Empty<SensorReading>());

    static string Safe(string text)
    {
        text = string.IsNullOrWhiteSpace(text) ? "unknown error" : text.Replace("\r", " ").Replace("\n", " ");
        return text.Length > 180 ? text[..180] : text;
    }
}

public sealed record HwinfoDocument(string Signature, long PollUnix, uint? PollingPeriodMs, IReadOnlyList<SensorReading> Readings);

public static class HwinfoParser
{
    public const int HeaderSize = 44;
    const int SensorBaseSize = 264;
    const int ReadingBaseSize = 316;

    public static HwinfoDocument Parse(byte[] data)
    {
        if (data.Length < 40) throw new InvalidDataException("header too short");
        var signature = Encoding.ASCII.GetString(data, 0, 4);
        var revision = U32(data, 8);
        var poll = I64(data, 12);
        var sensorOffset = I32(data, 20);
        var sensorSize = I32(data, 24);
        var sensorCount = I32(data, 28);
        var readingOffset = I32(data, 32);
        var readingSize = I32(data, 36);
        var readingCount = I32(data, 40);
        uint? polling = revision >= 1 && data.Length >= 48 ? U32(data, 44) : null;

        Bounds(data.Length, sensorOffset, sensorSize, sensorCount, SensorBaseSize, "sensor");
        Bounds(data.Length, readingOffset, readingSize, readingCount, ReadingBaseSize, "reading");
        if (sensorCount > 10000 || readingCount > 100000) throw new InvalidDataException("unreasonable HWiNFO element count");

        var sensors = new List<(uint id,uint inst,string original,string user)>(sensorCount);
        for (var i = 0; i < sensorCount; i++)
        {
            var o = sensorOffset + i * sensorSize;
            var original = Text(data, o + 8, 128, false);
            var user = Text(data, o + 136, 128, false);
            if (sensorSize >= SensorBaseSize + 256)
            {
                original = PreferUtf8(data, o + SensorBaseSize, 128, original);
                user = PreferUtf8(data, o + SensorBaseSize + 128, 128, user);
            }
            sensors.Add((U32(data,o), U32(data,o+4), original, user));
        }

        var output = new List<SensorReading>(readingCount);
        for (var i = 0; i < readingCount; i++)
        {
            var o = readingOffset + i * readingSize;
            var type = I32(data, o);
            var sensorIndex = I32(data, o + 4);
            var readingId = U32(data, o + 8);
            if (sensorIndex < 0 || sensorIndex >= sensors.Count) continue;
            var labelOriginal = Text(data, o + 12, 128, false);
            var labelUser = Text(data, o + 140, 128, false);
            var unit = Text(data, o + 268, 16, false);
            if (readingSize >= ReadingBaseSize + 272)
            {
                labelOriginal = PreferUtf8(data, o + ReadingBaseSize, 128, labelOriginal);
                labelUser = PreferUtf8(data, o + ReadingBaseSize + 128, 128, labelUser);
                unit = PreferUtf8(data, o + ReadingBaseSize + 256, 16, unit);
            }

            var sensor = sensors[sensorIndex];
            var device = Pick(sensor.user, sensor.original, "Sensor");
            var label = Pick(labelUser, labelOriginal, $"Reading {readingId}");
            var value = Finite(D64(data, o + 284));
            var min = Finite(D64(data, o + 292));
            var max = Finite(D64(data, o + 300));
            var avg = Finite(D64(data, o + 308));
            var key = $"{sensor.id}:{sensor.inst}:{readingId}";
            var fingerprint = Fingerprint(type, sensor.original, sensor.user, labelOriginal, labelUser, unit);
            output.Add(new(key, fingerprint, sensor.id, sensor.inst, readingId, type, device, label, unit, value, min, max, avg));
        }

        return new(signature, poll, polling, output);
    }

    static void Bounds(int length, int offset, int stride, int count, int minimum, string name)
    {
        if (offset < 0 || stride < minimum || count < 0) throw new InvalidDataException($"invalid {name} descriptor");
        var end = (long)offset + (long)stride * count;
        if (end > length) throw new InvalidDataException($"{name} section exceeds mapping");
    }

    static string Pick(string a, string b, string fallback) => !string.IsNullOrWhiteSpace(a) ? a : !string.IsNullOrWhiteSpace(b) ? b : fallback;

    static string Fingerprint(int type, params string[] fields) =>
        type + "|" + string.Join("|", fields.Select(v => (v ?? "").Trim().ToLowerInvariant()));

    static string Text(byte[] b, int offset, int length, bool utf8)
    {
        var end = Array.IndexOf(b, (byte)0, offset, length);
        if (end < 0) end = offset + length;
        var span = b.AsSpan(offset, end - offset);
        if (span.Length == 0) return "";
        try { return (utf8 ? new UTF8Encoding(false, true) : Encoding.Latin1).GetString(span).Trim(); }
        catch { return ""; }
    }

    static string PreferUtf8(byte[] b, int offset, int length, string fallback)
    {
        var value = Text(b, offset, length, true);
        if (string.IsNullOrWhiteSpace(value) || value.Any(ch => char.IsControl(ch) && ch is not '\t')) return fallback;
        return value;
    }

    static double? Finite(double value) => double.IsFinite(value) ? value : null;
    static uint U32(byte[] b, int o) => BitConverter.ToUInt32(b, o);
    static int I32(byte[] b, int o) => BitConverter.ToInt32(b, o);
    static long I64(byte[] b, int o) => BitConverter.ToInt64(b, o);
    static double D64(byte[] b, int o) => BitConverter.ToDouble(b, o);
}

public sealed class FixtureHwinfoSource : IHwinfoSource
{
    int _tick;
    public SensorSnapshot Read()
    {
        _tick++;
        var sensors = SelfTest.BuildFixtureReadings(140, _tick);
        return new("snapshot", Program.Protocol, Program.Version, "ok", "Fixture HWiNFO connected.",
            DateTimeOffset.UtcNow.ToUnixTimeSeconds(), 1000, DateTimeOffset.UtcNow, sensors);
    }
}

public sealed class SensorState
{
    readonly object _gate = new();
    SensorSnapshot _current = SensorSnapshot.Initial;
    public SensorSnapshot Current { get { lock (_gate) return _current; } }
    public void Set(SensorSnapshot value) { lock (_gate) _current = value; }
}

public sealed class SensorPoller : BackgroundService
{
    readonly IHwinfoSource _source;
    readonly SensorState _state;
    readonly ClientHub _hub;
    public SensorPoller(IHwinfoSource source, SensorState state, ClientHub hub) { _source = source; _state = state; _hub = hub; }

    protected override async Task ExecuteAsync(CancellationToken token)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        do
        {
            SensorSnapshot snapshot;
            try { snapshot = _source.Read(); }
            catch (Exception ex)
            {
                snapshot = new("snapshot", Program.Protocol, Program.Version, "bridge_error",
                    "Local HWiNFO bridge error: " + ex.GetType().Name, null, null, DateTimeOffset.UtcNow, Array.Empty<SensorReading>());
            }
            _state.Set(snapshot);
            await _hub.BroadcastAsync(snapshot, token);
        } while (await timer.WaitForNextTickAsync(token));
    }
}

public sealed class ClientHub
{
    sealed class Client(WebSocket socket)
    {
        public WebSocket Socket { get; } = socket;
        public SemaphoreSlim SendGate { get; } = new(1, 1);
    }

    readonly ConcurrentDictionary<Guid, Client> _clients = new();
    public int Count => _clients.Count;

    public async Task HandleAsync(WebSocket socket, SensorState state, CancellationToken token)
    {
        var client = new Client(socket);
        var id = Guid.NewGuid();
        _clients[id] = client;
        try
        {
            await SendAsync(client, new { type = "hello", protocol = Program.Protocol, companionVersion = Program.Version }, token);
            await SendAsync(client, state.Current, token);
            var buffer = new byte[1024];
            while (socket.State == WebSocketState.Open && !token.IsCancellationRequested)
            {
                var result = await socket.ReceiveAsync(buffer, token);
                if (result.MessageType == WebSocketMessageType.Close) break;
            }
        }
        catch (OperationCanceledException) { }
        catch (WebSocketException) { }
        finally
        {
            _clients.TryRemove(id, out _);
            try { client.SendGate.Dispose(); } catch { }
        }
    }

    public async Task BroadcastAsync(SensorSnapshot snapshot, CancellationToken token)
    {
        foreach (var pair in _clients.ToArray())
        {
            if (pair.Value.Socket.State != WebSocketState.Open) { _clients.TryRemove(pair.Key, out _); continue; }
            try { await SendAsync(pair.Value, snapshot, token); }
            catch { _clients.TryRemove(pair.Key, out _); }
        }
    }

    static async Task SendAsync<T>(Client client, T value, CancellationToken token)
    {
        await client.SendGate.WaitAsync(token);
        try
        {
            if (client.Socket.State != WebSocketState.Open) return;
            var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value, JsonOptions.Value));
            await client.Socket.SendAsync(bytes, WebSocketMessageType.Text, true, token);
        }
        finally { client.SendGate.Release(); }
    }
}

static class JsonOptions
{
    public static readonly JsonSerializerOptions Value = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}

public static class SelfTest
{
    public static int Run()
    {
        try
        {
            var bytes = BuildMapping(140);
            var parsed = HwinfoParser.Parse(bytes);
            Check(parsed.Readings.Count == 140, "140 sensors/readings");
            Check(parsed.Readings.Any(r => r.Device.Contains("Ω") && r.Label.Contains("温度")), "UTF-8 extension decode");
            Check(parsed.Readings.Count(r => r.Label == "Duplicate") == 2, "duplicate labels preserved");
            Check(parsed.Readings.Any(r => r.Value == 0), "real zero preserved");
            Check(parsed.Readings.Any(r => r.Value is null), "NaN becomes unavailable, not zero");
            Check(parsed.Readings.Select(r => r.Key).Distinct().Count() == parsed.Readings.Count, "stable IDs unique");
            var extreme = parsed.Readings.Single(r => r.Label == "Extreme");
            Check(extreme.Value == 9999999, "extreme finite value preserved");
            try
            {
                HwinfoParser.Parse(new byte[44]);
                throw new Exception("malformed fixture did not fail");
            }
            catch (InvalidDataException) { }
            Console.WriteLine("HWiNFO BRIDGE SELF-TEST PASS");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("HWiNFO BRIDGE SELF-TEST FAIL: " + ex);
            return 1;
        }
    }

    static void Check(bool ok, string label) { if (!ok) throw new Exception(label); }

    public static IReadOnlyList<SensorReading> BuildFixtureReadings(int count, int tick)
    {
        var list = new List<SensorReading>();
        for (var i = 0; i < count; i++)
        {
            var type = i % 8 + 1;
            var device = i % 3 == 0 ? "CPU [#0]: AMD Ryzen" : i % 3 == 1 ? "GPU [#0]: NVIDIA" : "ASUS Motherboard";
            var label = i % 10 == 0 ? "CPU Package" : i % 10 == 1 ? "GPU Hot Spot" : i % 10 == 2 ? "GPU Power" : $"Sensor {i}";
            var unit = type == 1 ? "°C" : type == 5 ? "W" : type == 8 ? "%" : "";
            var value = 30 + (i % 70) + Math.Sin((tick + i) / 6d) * 4;
            list.Add(new($"{100+i}:0:{2000+i}", $"{type}|{device.ToLowerInvariant()}|{label.ToLowerInvariant()}|{unit}",
                (uint)(100+i), 0, (uint)(2000+i), type, device, label, unit, value, value-3, value+4, value-0.7));
        }
        return list;
    }

    static byte[] BuildMapping(int count)
    {
        const int sensorStride = 520;
        const int readingStride = 588;
        const int header = 48;
        var sensorOffset = header;
        var readingOffset = sensorOffset + sensorStride * count;
        var b = new byte[readingOffset + readingStride * count];
        Encoding.ASCII.GetBytes("HWiS").CopyTo(b,0);
        Put(b,4,1); Put(b,8,2); Put64(b,12,DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        Put(b,20,sensorOffset); Put(b,24,sensorStride); Put(b,28,count);
        Put(b,32,readingOffset); Put(b,36,readingStride); Put(b,40,count); Put(b,44,1000);

        for (var i=0;i<count;i++)
        {
            var so=sensorOffset+i*sensorStride;
            Put(b,so,100+i); Put(b,so+4,0);
            WriteLatin(b,so+8,128,"Device "+i); WriteLatin(b,so+136,128,"Device "+i);
            var utfDevice=i==3 ? "Board Ω / 温度" : "Device "+i;
            WriteUtf8(b,so+264,128,utfDevice); WriteUtf8(b,so+392,128,utfDevice);

            var ro=readingOffset+i*readingStride;
            Put(b,ro,i%8+1); Put(b,ro+4,i); Put(b,ro+8,2000+i);
            var label=i is 7 or 8 ? "Duplicate" : i==3 ? "Temp" : i==4 ? "Extreme" : "Reading "+i;
            WriteLatin(b,ro+12,128,label); WriteLatin(b,ro+140,128,label); WriteLatin(b,ro+268,16,"C");
            WriteUtf8(b,ro+316,128,label); WriteUtf8(b,ro+444,128,i==3 ? "温度" : label); WriteUtf8(b,ro+572,16,i==3 ? "°C" : "C");
            var value=i==0?0:i==1?double.NaN:i==4?9999999:40+i;
            PutDouble(b,ro+284,value); PutDouble(b,ro+292,value); PutDouble(b,ro+300,value); PutDouble(b,ro+308,value);
        }
        return b;
    }

    static void Put(byte[] b,int o,int v)=>BitConverter.GetBytes(v).CopyTo(b,o);
    static void Put64(byte[] b,int o,long v)=>BitConverter.GetBytes(v).CopyTo(b,o);
    static void PutDouble(byte[] b,int o,double v)=>BitConverter.GetBytes(v).CopyTo(b,o);
    static void WriteLatin(byte[] b,int o,int len,string s)=>Encoding.Latin1.GetBytes(s).AsSpan(0,Math.Min(len-1,Encoding.Latin1.GetByteCount(s))).CopyTo(b.AsSpan(o));
    static void WriteUtf8(byte[] b,int o,int len,string s){var x=Encoding.UTF8.GetBytes(s);x.AsSpan(0,Math.Min(len-1,x.Length)).CopyTo(b.AsSpan(o));}
}

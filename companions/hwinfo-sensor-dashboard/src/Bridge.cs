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
        if (args.Contains("--self-test", StringComparer.OrdinalIgnoreCase)) return SelfTest.Run();
        var fixtureRequested = args.Contains("--fixture", StringComparer.OrdinalIgnoreCase);
        var fixture = fixtureRequested && Environment.GetEnvironmentVariable("PACKRAT_HWINFO_BRIDGE_TEST") == "1";
        if (fixtureRequested && !fixture) { Console.Error.WriteLine("Fixture mode is restricted to PackRat QA."); return 2; }
        if (!OperatingSystem.IsWindows() && !fixture) { Console.Error.WriteLine("PackRat HWiNFO Bridge requires Windows."); return 2; }

        var builder = WebApplication.CreateBuilder(args);
        builder.WebHost.UseUrls($"http://127.0.0.1:{Port}");
        builder.Logging.ClearProviders();
        builder.Services.AddSingleton<IHwinfoSource>(_ => fixture ? new FixtureHwinfoSource() : new HwinfoSharedMemorySource());
        builder.Services.AddSingleton<SensorState>();
        builder.Services.AddSingleton<ClientHub>();
        builder.Services.AddHostedService<SensorPoller>();
        var app = builder.Build();
        app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });

        app.Use(async (context, next) => {
            if (!IsLoopback(context.Connection.RemoteIpAddress)) { context.Response.StatusCode = 403; return; }
            var origin = context.Request.Headers.Origin.ToString();
            if (!AllowedOrigin(origin)) { context.Response.StatusCode = 403; return; }
            context.Response.Headers.CacheControl = "no-store";
            await next();
        });

        app.MapGet("/health", (SensorState state, ClientHub hub) => {
            var snap = state.Current;
            return Results.Json(new { ok=true, product="PackRat HWiNFO Bridge", version=Version, protocol=Protocol, port=Port, clients=hub.Count, hwinfoStatus=snap.Status, sensorCount=snap.Sensors.Count, lastUpdateUtc=snap.GeneratedUtc });
        });
        app.MapGet("/", () => Results.Content(SetupHtml(), "text/html; charset=utf-8"));
        app.Map("/widget", async context => {
            if (!context.WebSockets.IsWebSocketRequest) { context.Response.StatusCode = 400; return; }
            var socket = await context.WebSockets.AcceptWebSocketAsync();
            await context.RequestServices.GetRequiredService<ClientHub>().HandleAsync(socket, context.RequestServices.GetRequiredService<SensorState>(), context.RequestAborted);
        });
        app.Lifetime.ApplicationStarted.Register(() => Console.WriteLine($"PackRat HWiNFO Bridge {Version} listening on 127.0.0.1:{Port}"));
        await app.RunAsync();
        return 0;
    }

    static bool IsLoopback(IPAddress? ip) => ip is not null && (IPAddress.IsLoopback(ip) || (ip.IsIPv4MappedToIPv6 && IPAddress.IsLoopback(ip.MapToIPv4())));
    static bool AllowedOrigin(string? raw) {
        if (string.IsNullOrWhiteSpace(raw)) return true;
        var v=raw.Trim().ToLowerInvariant();
        return v is "null" or "file://" || v==$"http://127.0.0.1:{Port}" || v==$"http://localhost:{Port}";
    }
    static string SetupHtml() => """
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PackRat HWiNFO Bridge</title></head>
<body style="font:15px Segoe UI,Arial;background:#07090d;color:#f5f7fa;padding:32px"><main style="max-width:760px;margin:auto"><h1>HWiNFO Sensor Bridge</h1>
<p>Read-only local bridge for HWiNFO Sensor Dashboard on XENEON Edge.</p><ol><li>Install and start HWiNFO separately.</li><li>Enable Shared Memory Support.</li><li>Keep HWiNFO Sensors active.</li></ol>
<p>Local only: 127.0.0.1:17492. HWiNFO Free can make Shared Memory unavailable after its allowed runtime; PackRat does not bypass that limit.</p></main></body></html>
""";
}

public sealed record SensorReading(string Key,string Fingerprint,uint SensorId,uint SensorInstance,uint ReadingId,int Type,string Device,string Label,string Unit,double? Value,double? Min,double? Max,double? Avg);
public sealed record SensorSnapshot(string Type,int Protocol,string CompanionVersion,string Status,string Message,long? HwinfoPollUnix,uint? HwinfoPollingPeriodMs,DateTimeOffset GeneratedUtc,IReadOnlyList<SensorReading> Sensors) {
    public static SensorSnapshot Initial => new("snapshot",Program.Protocol,Program.Version,"starting","Connecting to HWiNFO Shared Memory.",null,null,DateTimeOffset.UtcNow,Array.Empty<SensorReading>());
}
public interface IHwinfoSource { SensorSnapshot Read(); }

public sealed class HwinfoSharedMemorySource : IHwinfoSource
{
    const string MapName=@"Global\HWiNFO_SENS_SM2";
    const string MutexName=@"Global\HWiNFO_SM2_MUTEX";
    bool everAvailable;

    public SensorSnapshot Read() {
        try {
            using var mmf=MemoryMappedFile.OpenExisting(MapName,MemoryMappedFileRights.Read);
            everAvailable=true;
            using var mutex=Mutex.OpenExisting(MutexName);
            var wait=mutex.WaitOne(TimeSpan.FromMilliseconds(750));
            if(!wait) return Status("hwinfo_busy","HWiNFO Shared Memory is busy. Retrying automatically.");
            try {
                using var view=mmf.CreateViewAccessor(0,0,MemoryMappedFileAccess.Read);
                var capacity=checked((int)Math.Min(view.Capacity,int.MaxValue));
                if(capacity<HwinfoParser.HeaderSize) return Status("shared_memory_unavailable","HWiNFO Shared Memory is incomplete.");
                var bytes=new byte[capacity];
                view.ReadArray(0,bytes,0,bytes.Length);
                return Build(bytes);
            } finally { try { mutex.ReleaseMutex(); } catch {} }
        } catch(FileNotFoundException) { return MissingMap(); }
          catch(WaitHandleCannotBeOpenedException) { return Status("hwinfo_starting","HWiNFO Shared Memory exists but its consistency mutex is not ready yet."); }
          catch(UnauthorizedAccessException) { return Status("access_denied","HWiNFO Shared Memory could not be opened. Run HWiNFO and the PackRat bridge at matching privilege levels."); }
          catch(Exception ex) { return Status("shared_memory_unavailable","HWiNFO Shared Memory could not be read: "+Safe(ex.Message)); }
    }

    SensorSnapshot MissingMap() {
        var running=Process.GetProcesses().Any(p=>{try{return p.ProcessName.StartsWith("HWiNFO",StringComparison.OrdinalIgnoreCase);}catch{return false;}});
        if(!running) return Status("hwinfo_not_running","HWiNFO is not running. Start HWiNFO with Sensors active.");
        if(everAvailable) return Status("shared_memory_unavailable","HWiNFO Shared Memory became unavailable. HWiNFO Free can deactivate Shared Memory after 12 hours; enable it again or use an eligible HWiNFO license.");
        return Status("shared_memory_disabled","HWiNFO is running but Shared Memory is unavailable. Enable Shared Memory Support in HWiNFO Settings.");
    }

    SensorSnapshot Build(byte[] bytes) {
        HwinfoDocument doc;
        try { doc=HwinfoParser.Parse(bytes); } catch(Exception ex) { return Status("shared_memory_unavailable","HWiNFO Shared Memory metadata is invalid: "+Safe(ex.Message)); }
        if(doc.Signature=="DEAD") return Status("shared_memory_unavailable","HWiNFO Shared Memory is inactive. HWiNFO Free can deactivate Shared Memory after 12 hours; enable it again or use an eligible HWiNFO license.");
        if(doc.Signature!="HWiS") return Status("shared_memory_unavailable","HWiNFO Shared Memory is not active.");
        var staleAfter=Math.Max(10.0,(doc.PollingPeriodMs??2000)/1000.0*4.0);
        var age=DateTimeOffset.UtcNow.ToUnixTimeSeconds()-doc.PollUnix;
        if(doc.PollUnix>0 && age>staleAfter) return new("snapshot",Program.Protocol,Program.Version,"sensors_not_active","HWiNFO sensor polling is not updating. Open or restart the HWiNFO Sensors window.",doc.PollUnix,doc.PollingPeriodMs,DateTimeOffset.UtcNow,doc.Readings);
        if(doc.Readings.Count==0) return new("snapshot",Program.Protocol,Program.Version,"no_sensors","HWiNFO Shared Memory is active but no sensor readings are available.",doc.PollUnix,doc.PollingPeriodMs,DateTimeOffset.UtcNow,doc.Readings);
        return new("snapshot",Program.Protocol,Program.Version,"ok","HWiNFO Shared Memory connected.",doc.PollUnix,doc.PollingPeriodMs,DateTimeOffset.UtcNow,doc.Readings);
    }
    static SensorSnapshot Status(string code,string message)=>new("snapshot",Program.Protocol,Program.Version,code,message,null,null,DateTimeOffset.UtcNow,Array.Empty<SensorReading>());
    static string Safe(string text){text=string.IsNullOrWhiteSpace(text)?"unknown error":text.Replace("\r"," ").Replace("\n"," ");return text.Length>180?text[..180]:text;}
}

public sealed record HwinfoDocument(string Signature,long PollUnix,uint? PollingPeriodMs,IReadOnlyList<SensorReading> Readings);

public static class HwinfoParser
{
    public const int HeaderSize=44;
    const int SensorBaseSize=264;
    const int ReadingBaseSize=316;

    public static HwinfoDocument Parse(byte[] data) {
        if(data.Length<HeaderSize) throw new InvalidDataException("header too short");
        var signature=Encoding.ASCII.GetString(data,0,4);
        var revision=U32(data,8);
        var poll=I64(data,12);
        var sensorOffset=I32(data,20); var sensorSize=I32(data,24); var sensorCount=I32(data,28);
        var readingOffset=I32(data,32); var readingSize=I32(data,36); var readingCount=I32(data,40);
        uint? polling=revision>=1 && data.Length>=48 ? U32(data,44) : null;
        Bounds(data.Length,sensorOffset,sensorSize,sensorCount,SensorBaseSize,"sensor");
        Bounds(data.Length,readingOffset,readingSize,readingCount,ReadingBaseSize,"reading");
        if(sensorCount>10000||readingCount>100000) throw new InvalidDataException("unreasonable HWiNFO element count");

        var sensors=new List<(uint id,uint inst,string original,string user)>(sensorCount);
        for(var i=0;i<sensorCount;i++){
            var o=sensorOffset+i*sensorSize;
            sensors.Add((U32(data,o),U32(data,o+4),Latin1(data,o+8,128),Latin1(data,o+136,128)));
        }

        var output=new List<SensorReading>(readingCount);
        for(var i=0;i<readingCount;i++){
            var o=readingOffset+i*readingSize;
            var type=I32(data,o); var sensorIndex=I32(data,o+4); var readingId=U32(data,o+8);
            if(sensorIndex<0||sensorIndex>=sensors.Count) continue;
            var labelOriginal=Latin1(data,o+12,128); var labelUser=Latin1(data,o+140,128); var unit=Latin1(data,o+268,16);
            var sensor=sensors[sensorIndex];
            var device=Pick(sensor.user,sensor.original,"Sensor"); var label=Pick(labelUser,labelOriginal,$"Reading {readingId}");
            var value=Finite(D64(data,o+284)); var min=Finite(D64(data,o+292)); var max=Finite(D64(data,o+300)); var avg=Finite(D64(data,o+308));
            var key=$"{sensor.id}:{sensor.inst}:{readingId}";
            var fingerprint=Fingerprint(type,sensor.original,sensor.user,labelOriginal,labelUser,unit);
            output.Add(new(key,fingerprint,sensor.id,sensor.inst,readingId,type,device,label,unit,value,min,max,avg));
        }
        return new(signature,poll,polling,output);
    }

    static void Bounds(int length,int offset,int stride,int count,int minimum,string name){
        if(offset<0||stride<minimum||count<0) throw new InvalidDataException($"invalid {name} descriptor");
        var end=(long)offset+(long)stride*count;
        if(end>length) throw new InvalidDataException($"{name} section exceeds mapping");
    }
    static string Pick(string a,string b,string fallback)=>!string.IsNullOrWhiteSpace(a)?a:!string.IsNullOrWhiteSpace(b)?b:fallback;
    static string Fingerprint(int type,params string[] fields)=>type+"|"+string.Join("|",fields.Select(v=>(v??"").Trim().ToLowerInvariant()));
    static string Latin1(byte[] b,int offset,int length){var end=Array.IndexOf(b,(byte)0,offset,length);if(end<0)end=offset+length;return Encoding.Latin1.GetString(b,offset,end-offset).Trim();}
    static double? Finite(double v)=>double.IsFinite(v)?v:null;
    static uint U32(byte[] b,int o)=>BitConverter.ToUInt32(b,o); static int I32(byte[] b,int o)=>BitConverter.ToInt32(b,o); static long I64(byte[] b,int o)=>BitConverter.ToInt64(b,o); static double D64(byte[] b,int o)=>BitConverter.ToDouble(b,o);
}

public sealed class FixtureHwinfoSource : IHwinfoSource
{
    int tick;
    public SensorSnapshot Read()=>new("snapshot",Program.Protocol,Program.Version,"ok","Fixture HWiNFO connected.",DateTimeOffset.UtcNow.ToUnixTimeSeconds(),1000,DateTimeOffset.UtcNow,SelfTest.BuildFixtureReadings(140,++tick));
}
public sealed class SensorState { readonly object gate=new(); SensorSnapshot current=SensorSnapshot.Initial; public SensorSnapshot Current{get{lock(gate)return current;}} public void Set(SensorSnapshot v){lock(gate)current=v;} }
public sealed class SensorPoller : BackgroundService
{
    readonly IHwinfoSource source; readonly SensorState state; readonly ClientHub hub;
    public SensorPoller(IHwinfoSource source,SensorState state,ClientHub hub){this.source=source;this.state=state;this.hub=hub;}
    protected override async Task ExecuteAsync(CancellationToken token){
        using var timer=new PeriodicTimer(TimeSpan.FromSeconds(1));
        do { SensorSnapshot snap; try{snap=source.Read();}catch(Exception ex){snap=new("snapshot",Program.Protocol,Program.Version,"bridge_error","Local HWiNFO bridge error: "+ex.GetType().Name,null,null,DateTimeOffset.UtcNow,Array.Empty<SensorReading>());} state.Set(snap); await hub.BroadcastAsync(snap,token); }
        while(await timer.WaitForNextTickAsync(token));
    }
}

public sealed class ClientHub
{
    sealed class Client(WebSocket socket){public WebSocket Socket{get;}=socket;public SemaphoreSlim Gate{get;}=new(1,1);}
    readonly ConcurrentDictionary<Guid,Client> clients=new();
    public int Count=>clients.Count;
    public async Task HandleAsync(WebSocket socket,SensorState state,CancellationToken token){
        var c=new Client(socket);var id=Guid.NewGuid();clients[id]=c;
        try{
            await SendAsync(c,new{type="hello",protocol=Program.Protocol,companionVersion=Program.Version},token);
            await SendAsync(c,state.Current,token);
            var buffer=new byte[1024];
            while(socket.State==WebSocketState.Open&&!token.IsCancellationRequested){var r=await socket.ReceiveAsync(buffer,token);if(r.MessageType==WebSocketMessageType.Close)break;}
        }catch(OperationCanceledException){}catch(WebSocketException){}finally{clients.TryRemove(id,out _);c.Gate.Dispose();}
    }
    public async Task BroadcastAsync(SensorSnapshot snap,CancellationToken token){
        foreach(var pair in clients.ToArray()){var c=pair.Value;if(c.Socket.State!=WebSocketState.Open){clients.TryRemove(pair.Key,out _);continue;}try{await SendAsync(c,snap,token);}catch{clients.TryRemove(pair.Key,out _);}}
    }
    static async Task SendAsync<T>(Client c,T value,CancellationToken token){await c.Gate.WaitAsync(token);try{if(c.Socket.State!=WebSocketState.Open)return;var bytes=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value,JsonOptions.Value));await c.Socket.SendAsync(bytes,WebSocketMessageType.Text,true,token);}finally{c.Gate.Release();}}
}
static class JsonOptions { public static readonly JsonSerializerOptions Value=new(JsonSerializerDefaults.Web){DefaultIgnoreCondition=JsonIgnoreCondition.WhenWritingNull}; }

public static class SelfTest
{
    public static int Run(){
        try{
            var parsed=HwinfoParser.Parse(BuildMapping(140));
            Check(parsed.Readings.Count==140,"140 readings");
            Check(parsed.Readings.Count(r=>r.Label=="Duplicate")==2,"duplicate names");
            Check(parsed.Readings.Any(r=>r.Value==0),"true zero");
            Check(parsed.Readings.Any(r=>r.Value is null),"NaN unavailable");
            Check(parsed.Readings.Select(r=>r.Key).Distinct().Count()==parsed.Readings.Count,"stable IDs unique");
            Check(parsed.Readings.Single(r=>r.Label=="Extreme").Value==9999999,"extreme finite value");
            var unicode=BuildFixtureReadings(140,1);Check(unicode.Any(r=>r.Device.Contains("Ω")&&r.Label.Contains("温度")),"Unicode normalized transport fixture");
            try{HwinfoParser.Parse(new byte[44]);throw new Exception("malformed mapping accepted");}catch(InvalidDataException){}
            Console.WriteLine("HWiNFO BRIDGE SELF-TEST PASS");return 0;
        }catch(Exception ex){Console.Error.WriteLine("HWiNFO BRIDGE SELF-TEST FAIL: "+ex);return 1;}
    }
    static void Check(bool ok,string label){if(!ok)throw new Exception(label);}
    public static IReadOnlyList<SensorReading> BuildFixtureReadings(int count,int tick){
        var list=new List<SensorReading>();
        for(var i=0;i<count;i++){
            var type=i%8+1;var device=i==3?"ASUS ROG Ω Motherboard":i%3==0?"CPU [#0]: AMD Ryzen":i%3==1?"GPU [#0]: NVIDIA":"ASUS Motherboard";
            var label=i==3?"VRM 温度":i%10==0?"CPU Package":i%10==1?"GPU Hot Spot":i%10==2?"GPU Power":$"Sensor {i}";
            var unit=type==1?"°C":type==5?"W":type==8?"%":"";
            var value=30+(i%70)+Math.Sin((tick+i)/6d)*4;
            list.Add(new($"{100+i}:0:{2000+i}",$"{type}|{device.ToLowerInvariant()}|{label.ToLowerInvariant()}|{unit}",(uint)(100+i),0,(uint)(2000+i),type,device,label,unit,value,value-3,value+4,value-.7));
        } return list;
    }
    static byte[] BuildMapping(int count){
        const int sensorStride=264,readingStride=316,header=48;var sensorOffset=header;var readingOffset=sensorOffset+sensorStride*count;var b=new byte[readingOffset+readingStride*count];
        Encoding.ASCII.GetBytes("HWiS").CopyTo(b,0);Put(b,4,1);Put(b,8,1);Put64(b,12,DateTimeOffset.UtcNow.ToUnixTimeSeconds());Put(b,20,sensorOffset);Put(b,24,sensorStride);Put(b,28,count);Put(b,32,readingOffset);Put(b,36,readingStride);Put(b,40,count);Put(b,44,1000);
        for(var i=0;i<count;i++){var so=sensorOffset+i*sensorStride;Put(b,so,100+i);Put(b,so+4,0);WriteLatin(b,so+8,128,"Device "+i);WriteLatin(b,so+136,128,"Device "+i);
            var ro=readingOffset+i*readingStride;Put(b,ro,i%8+1);Put(b,ro+4,i);Put(b,ro+8,2000+i);var label=i is 7 or 8?"Duplicate":i==4?"Extreme":"Reading "+i;WriteLatin(b,ro+12,128,label);WriteLatin(b,ro+140,128,label);WriteLatin(b,ro+268,16,"C");var value=i==0?0:i==1?double.NaN:i==4?9999999:40+i;PutDouble(b,ro+284,value);PutDouble(b,ro+292,value);PutDouble(b,ro+300,value);PutDouble(b,ro+308,value);}
        return b;
    }
    static void Put(byte[] b,int o,int v)=>BitConverter.GetBytes(v).CopyTo(b,o);static void Put64(byte[] b,int o,long v)=>BitConverter.GetBytes(v).CopyTo(b,o);static void PutDouble(byte[] b,int o,double v)=>BitConverter.GetBytes(v).CopyTo(b,o);
    static void WriteLatin(byte[] b,int o,int len,string s){var x=Encoding.Latin1.GetBytes(s);x.AsSpan(0,Math.Min(len-1,x.Length)).CopyTo(b.AsSpan(o));}
}
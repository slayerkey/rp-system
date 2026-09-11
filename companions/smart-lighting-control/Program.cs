using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Json;

namespace PackRat.SmartLighting;

public static class Program {
    const int DefaultPort=17486;
    public static async Task<int> Main(string[] args){
        if(args.Contains("--self-test"))return SelfTest();
        var fixture=args.Contains("--fixture");
        var noBrowser=args.Contains("--no-browser")||fixture;
        var port=ArgInt(args,"--port",DefaultPort);
        ILightingRuntime runtime;
        LightingController? real=null;
        if(fixture)runtime=new FixtureRuntime();
        else{var local=new LocalState();real=new LightingController(local);runtime=real;await real.StartAsync();}

        var builder=WebApplication.CreateBuilder(args);
        builder.WebHost.UseUrls($"http://127.0.0.1:{port}");
        builder.Services.Configure<JsonOptions>(o=>{o.SerializerOptions.PropertyNamingPolicy=JsonNamingPolicy.CamelCase;o.SerializerOptions.DefaultIgnoreCondition=System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;});
        var app=builder.Build();
        app.UseWebSockets(new WebSocketOptions{KeepAliveInterval=TimeSpan.FromSeconds(20)});
        app.Use(async(ctx,next)=>{
            if(ctx.Connection.RemoteIpAddress is not null&&!IPAddress.IsLoopback(ctx.Connection.RemoteIpAddress)){ctx.Response.StatusCode=403;return;}
            await next();
        });

        var sockets=new ConcurrentDictionary<Guid,WebSocket>();
        async Task SendAsync(WebSocket ws,object value,CancellationToken ct=default){
            var bytes=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value,JsonDefaults.Options));
            await ws.SendAsync(bytes,WebSocketMessageType.Text,true,ct);
        }
        async Task BroadcastAsync(){
            var dead=new List<Guid>();
            foreach(var pair in sockets){
                try{if(pair.Value.State==WebSocketState.Open)await SendAsync(pair.Value,runtime.Snapshot);else dead.Add(pair.Key);}catch{dead.Add(pair.Key);}
            }
            foreach(var id in dead)if(sockets.TryRemove(id,out var ws))try{ws.Dispose();}catch{}
        }
        runtime.Changed+=()=>_=BroadcastAsync();

        app.MapGet("/",()=>Results.Content(SetupHtml(port),"text/html; charset=utf-8"));
        app.MapGet("/health",()=>Results.Json(new{ok=true,product="PackRat Lighting Companion",protocol=1,fixture}));
        app.MapGet("/api/setup/status",(HttpContext ctx)=>{
            if(!SetupOriginAllowed(ctx,port))return Results.StatusCode(403);
            return Results.Json(real is null?new{pairingToken=runtime.PairingToken,fixture=true}:real.SetupStatus());
        });
        app.MapPost("/api/setup/hue/discover",async(HttpContext ctx)=>{
            if(!SetupOriginAllowed(ctx,port)||real is null)return Results.StatusCode(403);
            try{return Results.Json(new{ok=true,bridges=await real.DiscoverHueAsync(ctx.RequestAborted)});}catch(Exception ex){return Results.BadRequest(new{ok=false,error=ex.Message});}
        });
        app.MapPost("/api/setup/hue/pair",async(HttpContext ctx)=>{
            if(!SetupOriginAllowed(ctx,port)||real is null)return Results.StatusCode(403);
            try{var body=await JsonDocument.ParseAsync(ctx.Request.Body,cancellationToken:ctx.RequestAborted);var ip=body.RootElement.GetProperty("ip").GetString()??"";var id=await real.PairHueAsync(ip,ctx.RequestAborted);return Results.Json(new{ok=true,bridge=id});}
            catch(Exception ex){return Results.BadRequest(new{ok=false,error=ex.Message});}
        });
        app.MapPost("/api/setup/govee/scan",async(HttpContext ctx)=>{
            if(!SetupOriginAllowed(ctx,port)||real is null)return Results.StatusCode(403);
            try{return Results.Json(new{ok=true,devices=await real.ScanGoveeLanAsync(ctx.RequestAborted)});}catch(Exception ex){return Results.BadRequest(new{ok=false,error=ex.Message});}
        });
        app.MapPost("/api/setup/govee/key",async(HttpContext ctx)=>{
            if(!SetupOriginAllowed(ctx,port)||real is null)return Results.StatusCode(403);
            try{var body=await JsonDocument.ParseAsync(ctx.Request.Body,cancellationToken:ctx.RequestAborted);var key=body.RootElement.GetProperty("key").GetString()??"";if(string.IsNullOrWhiteSpace(key))throw new InvalidOperationException("Enter a Govee Developer API key.");await real.SetGoveeKeyAsync(key,ctx.RequestAborted);return Results.Json(new{ok=true});}
            catch(Exception ex){return Results.BadRequest(new{ok=false,error=ex.Message});}
        });
        app.MapDelete("/api/setup/govee/key",async(HttpContext ctx)=>{
            if(!SetupOriginAllowed(ctx,port)||real is null)return Results.StatusCode(403);
            await real.ClearGoveeKeyAsync(ctx.RequestAborted);return Results.Json(new{ok=true});
        });

        app.Map("/widget",async ctx=>{
            if(!ctx.WebSockets.IsWebSocketRequest||!WidgetOriginAllowed(ctx)){ctx.Response.StatusCode=403;return;}
            using var ws=await ctx.WebSockets.AcceptWebSocketAsync();
            var hello=await ReceiveJsonAsync(ws,TimeSpan.FromSeconds(4),ctx.RequestAborted);
            if(hello is null||!hello.RootElement.TryGetProperty("type",out var typ)||typ.GetString()!="hello"||!hello.RootElement.TryGetProperty("token",out var tok)||!TokenEqual(tok.GetString(),runtime.PairingToken)){
                await SendAsync(ws,new{type="auth_error",error="invalid companion pairing token"},ctx.RequestAborted);await ws.CloseAsync(WebSocketCloseStatus.PolicyViolation,"auth",CancellationToken.None);return;
            }
            await SendAsync(ws,new{type="auth_ok",protocol=1},ctx.RequestAborted);
            await SendAsync(ws,runtime.Snapshot,ctx.RequestAborted);
            var id=Guid.NewGuid();sockets[id]=ws;
            try{
                while(ws.State==WebSocketState.Open&&!ctx.RequestAborted.IsCancellationRequested){
                    var msg=await ReceiveJsonAsync(ws,TimeSpan.FromMinutes(10),ctx.RequestAborted);if(msg is null)break;
                    try{await runtime.HandleCommandAsync(msg.RootElement,ctx.RequestAborted);}catch(Exception ex){await SendAsync(ws,new{type="error",error=ex.Message},ctx.RequestAborted);}
                }
            }finally{sockets.TryRemove(id,out _);}
        });

        app.Lifetime.ApplicationStarted.Register(()=>{
            Console.WriteLine($"PackRat Lighting Companion running at http://127.0.0.1:{port}/");
            Console.WriteLine("Credentials remain on this PC. No PackRat cloud is used.");
            if(!noBrowser)try{Process.Start(new ProcessStartInfo($"http://127.0.0.1:{port}/"){UseShellExecute=true});}catch{}
        });
        await app.RunAsync();
        if(real is not null)await real.DisposeAsync();
        return 0;
    }

    static bool SetupOriginAllowed(HttpContext ctx,int port){
        var origin=ctx.Request.Headers.Origin.ToString();
        if(string.IsNullOrWhiteSpace(origin))return true;
        return origin.Equals($"http://127.0.0.1:{port}",StringComparison.OrdinalIgnoreCase)||origin.Equals($"http://localhost:{port}",StringComparison.OrdinalIgnoreCase);
    }
    static bool WidgetOriginAllowed(HttpContext ctx){
        var origin=ctx.Request.Headers.Origin.ToString();
        return string.IsNullOrWhiteSpace(origin)||origin=="null"||origin.StartsWith("file://",StringComparison.OrdinalIgnoreCase);
    }
    static bool TokenEqual(string? supplied,string expected){
        if(string.IsNullOrEmpty(supplied))return false;
        var a=SHA256.HashData(Encoding.UTF8.GetBytes(supplied)),b=SHA256.HashData(Encoding.UTF8.GetBytes(expected));
        return CryptographicOperations.FixedTimeEquals(a,b);
    }
    static async Task<JsonDocument?> ReceiveJsonAsync(WebSocket ws,TimeSpan timeout,CancellationToken outer){
        using var cts=CancellationTokenSource.CreateLinkedTokenSource(outer);cts.CancelAfter(timeout);
        var buffer=new byte[32*1024];using var ms=new MemoryStream();
        try{
            while(true){var r=await ws.ReceiveAsync(buffer,cts.Token);if(r.MessageType==WebSocketMessageType.Close)return null;if(r.MessageType!=WebSocketMessageType.Text)continue;ms.Write(buffer,0,r.Count);if(r.EndOfMessage)break;if(ms.Length>128*1024)throw new InvalidOperationException("message too large");}
            return JsonDocument.Parse(ms.ToArray());
        }catch(OperationCanceledException){return null;}catch(JsonException){return null;}
    }
    static int ArgInt(string[] args,string name,int fallback){var i=Array.IndexOf(args,name);return i>=0&&i+1<args.Length&&int.TryParse(args[i+1],out var v)?v:fallback;}

    static int SelfTest(){
        try{
            var cmd=GoveeClient.BuildLanCommand("turn",new{value=1});if(!cmd.Contains("\"cmd\":\"turn\"")||!cmd.Contains("\"value\":1"))throw new Exception("Govee LAN command serialization failed");
            dynamic xy=HueClient.RgbToXy(255,0,0);var rgb=HueClient.XyToRgb((double)xy.x,(double)xy.y,100);if(rgb.R<180||rgb.G>120||rgb.B>120)throw new Exception("Hue color conversion failed");
            var fixture=JsonDocument.Parse("""{"data":[{"id":"gl1","type":"grouped_light","on":{"on":true},"dimming":{"brightness":66},"color":{"xy":{"x":0.4,"y":0.4}},"color_temperature":{"mirek":250,"mirek_schema":{"mirek_minimum":153,"mirek_maximum":500}}},{"id":"r1","type":"room","metadata":{"name":"Studio"},"services":[{"rid":"gl1","rtype":"grouped_light"}]},{"id":"s1","type":"scene","metadata":{"name":"Focus"},"group":{"rid":"r1"}}]}""");
            var list=HueClient.NormalizeResources(fixture.RootElement.GetProperty("data"),new HashSet<string>{"hue:room:r1"});
            var room=list.FirstOrDefault(t=>t.Id=="hue:room:r1")??throw new Exception("Hue room normalization failed");
            if(!room.Favorite||room.Scenes.Count!=1||room.Brightness!=66)throw new Exception("Hue room capability/scene normalization failed");
            if(!new FixtureRuntime().Snapshot.Targets.Any(t=>t.Provider=="govee"))throw new Exception("fixture runtime failed");
            Console.WriteLine("SMART LIGHTING COMPANION SELF-TEST PASS: Hue resource normalization/color, Govee LAN payload, fixture protocol");
            return 0;
        }catch(Exception ex){Console.Error.WriteLine("SMART LIGHTING COMPANION SELF-TEST FAIL: "+ex);return 1;}
    }

    static string SetupHtml(int port)=>$$"""
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PackRat Lighting Companion</title><style>
:root{font-family:Inter,Segoe UI,Arial,sans-serif;color:#f7f8fa;background:#090a0f}*{box-sizing:border-box}body{margin:0;padding:32px;background:radial-gradient(circle at 80% 0,#8b5cf622,transparent 30%),#090a0f}.wrap{max-width:920px;margin:auto}.hero{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:22px}h1{margin:5px 0;font-size:34px}.muted,p{color:#aeb3c0;line-height:1.5}.pill{border:1px solid #ffffff18;border-radius:999px;padding:8px 12px;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{background:#12141d;border:1px solid #ffffff16;border-radius:20px;padding:20px}.full{grid-column:1/-1}.label{font-size:11px;font-weight:800;letter-spacing:.14em;color:#9ca3af;text-transform:uppercase}.token{font:800 18px ui-monospace,Consolas,monospace;background:#080910;border:1px solid #ffffff16;padding:14px;border-radius:12px;word-break:break-all;margin:10px 0}input,button{min-height:46px;border-radius:12px;border:1px solid #ffffff1c;background:#1a1d29;color:#fff;padding:0 13px}input{width:100%;margin:8px 0}button{cursor:pointer;font-weight:800;background:#8b5cf6}button.secondary{background:#242735}.row{display:flex;gap:8px;flex-wrap:wrap}.row>*{flex:1}.status{font-size:12px;margin-top:10px;min-height:18px;color:#cbd5e1}.ok{color:#42e38d}.warn{color:#fbbf24}code{color:#c4b5fd}@media(max-width:700px){body{padding:16px}.grid{grid-template-columns:1fr}.full{grid-column:auto}.hero{display:block}h1{font-size:28px}}
</style></head><body><div class="wrap">
<div class="hero"><div><div class="label">PACKRAT · LOCAL WINDOWS COMPANION</div><h1>Hue + Govee Lighting</h1><p>Everything here stays on this PC. No PackRat account or PackRat cloud.</p></div><div class="pill">127.0.0.1:{{port}}</div></div>
<div class="grid">
<section class="card full"><div class="label">1 · XENEON CONNECTION</div><h2>Companion Pairing Token</h2><p>Copy this token into the widget's <b>Companion Pairing Token</b> setting in iCUE.</p><div id="token" class="token">Loading…</div><button onclick="copyToken()">Copy token</button><div id="summary" class="status"></div></section>
<section class="card"><div class="label">2 · PHILIPS HUE</div><h2>Pair your Hue Bridge</h2><p>Discover locally first. Press the physical link button on the Hue Bridge, then click Pair.</p><div class="row"><button onclick="discoverHue()">Discover bridges</button></div><select id="hueList" style="width:100%;min-height:46px;margin:8px 0;background:#1a1d29;color:#fff;border:1px solid #ffffff1c;border-radius:12px"></select><input id="hueIp" placeholder="Or enter bridge IP, e.g. 192.168.1.20"><button onclick="pairHue()">Pair selected / IP</button><div id="hueStatus" class="status"></div></section>
<section class="card"><div class="label">3 · GOVEE</div><h2>LAN first, cloud optional</h2><p>Enable <b>LAN Control</b> for compatible lights in Govee Home, then scan. For Govee scenes or cloud-only lights, paste your own Developer API key.</p><button onclick="scanGovee()">Scan LAN devices</button><input id="goveeKey" type="password" autocomplete="off" placeholder="Optional Govee Developer API key"><div class="row"><button onclick="saveGovee()">Save API key</button><button class="secondary" onclick="clearGovee()">Remove key</button></div><div id="goveeStatus" class="status"></div></section>
<section class="card full"><div class="label">CAPABILITY NOTES</div><p><b>Hue:</b> local Bridge v2 resources for lights, rooms/zones, scenes, on/off, brightness, color and color temperature when exposed by the light. <b>Govee:</b> LAN-capable devices use local UDP for core controls; the optional Developer API adds model capability ranges, cloud-only device state and scenes.</p></section>
</div></div><script>
const j=(u,o={})=>fetch(u,{headers:{'Content-Type':'application/json'},...o}).then(async r=>{const x=await r.json().catch(()=>({}));if(!r.ok)throw Error(x.error||r.statusText);return x});
async function refresh(){const s=await j('/api/setup/status');token.textContent=s.pairingToken;summary.textContent=(s.targetCount??0)+' lighting targets ready';summary.className='status ok';if(s.hue?.configured){hueStatus.textContent='Paired: '+(s.hue.bridgeId||s.hue.bridgeIp);hueStatus.className='status ok'}if(s.govee?.cloud){goveeStatus.textContent='Developer API connected'+(s.govee.lan?' · LAN devices found':'');goveeStatus.className='status ok'}else if(s.govee?.lan){goveeStatus.textContent='LAN devices found · cloud key not required for local core controls';goveeStatus.className='status ok'}}
function copyToken(){navigator.clipboard.writeText(token.textContent)}
async function discoverHue(){try{hueStatus.textContent='Discovering…';const x=await j('/api/setup/hue/discover',{method:'POST'});hueList.innerHTML=x.bridges.map(b=>'<option value="'+b.ip+'">'+(b.id||'Hue Bridge')+' · '+b.ip+' · '+b.source+'</option>').join('');hueStatus.textContent=x.bridges.length?x.bridges.length+' bridge(s) found':'No bridge found. Enter its IP manually.'}catch(e){hueStatus.textContent=e.message}}
async function pairHue(){try{const ip=hueIp.value.trim()||hueList.value;if(!ip)throw Error('Discover or enter a bridge IP first.');hueStatus.textContent='Press the Hue Bridge button, then pairing…';const x=await j('/api/setup/hue/pair',{method:'POST',body:JSON.stringify({ip})});hueStatus.textContent='Paired '+x.bridge;hueStatus.className='status ok';refresh()}catch(e){hueStatus.textContent=e.message;hueStatus.className='status warn'}}
async function scanGovee(){try{goveeStatus.textContent='Scanning LAN…';const x=await j('/api/setup/govee/scan',{method:'POST'});goveeStatus.textContent=x.devices+' LAN device(s) found';goveeStatus.className='status '+(x.devices?'ok':'warn');refresh()}catch(e){goveeStatus.textContent=e.message}}
async function saveGovee(){try{const key=goveeKey.value.trim();if(!key)throw Error('Paste your Govee Developer API key first.');goveeStatus.textContent='Validating key…';await j('/api/setup/govee/key',{method:'POST',body:JSON.stringify({key})});goveeKey.value='';goveeStatus.textContent='Developer API connected';goveeStatus.className='status ok';refresh()}catch(e){goveeStatus.textContent=e.message;goveeStatus.className='status warn'}}
async function clearGovee(){await j('/api/setup/govee/key',{method:'DELETE'});goveeStatus.textContent='Developer API key removed';refresh()}
refresh().catch(e=>summary.textContent=e.message);
</script></body></html>
""";
}

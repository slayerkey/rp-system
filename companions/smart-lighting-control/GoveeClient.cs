using System.Net;
using System.Net.Http.Json;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace PackRat.SmartLighting;

public sealed class GoveeClient {
    const string ApiBase="https://openapi.api.govee.com";
    readonly LocalState state;
    readonly Dictionary<string,LanDevice> lan=new(StringComparer.OrdinalIgnoreCase);
    List<CloudDevice> cloud=new();
    readonly Dictionary<string,List<CloudScene>> sceneCache=new(StringComparer.OrdinalIgnoreCase);
    readonly Dictionary<string,CloudState> cloudStates=new(StringComparer.OrdinalIgnoreCase);
    DateTime cloudDevicesAt=DateTime.MinValue, scenesAt=DateTime.MinValue, cloudStatesAt=DateTime.MinValue;
    public GoveeClient(LocalState state){this.state=state;}
    public bool CloudConfigured=>!string.IsNullOrWhiteSpace(state.GoveeApiKey());

    public async Task<List<LightingTarget>> GetTargetsAsync(bool scanLan=false,CancellationToken ct=default){
        if(scanLan||lan.Count==0)await DiscoverLanAsync(null,ct);
        if(CloudConfigured&&DateTime.UtcNow-cloudDevicesAt>TimeSpan.FromMinutes(1))await RefreshCloudDevicesAsync(ct);
        if(CloudConfigured&&DateTime.UtcNow-cloudStatesAt>TimeSpan.FromSeconds(15))await RefreshCloudStatesAsync(ct);
        if(CloudConfigured&&DateTime.UtcNow-scenesAt>TimeSpan.FromMinutes(10))await RefreshScenesAsync(ct);
        return Normalize();
    }

    public async Task<int> DiscoverLanAsync(string? manualIp=null,CancellationToken ct=default){
        IPAddress? manual=null;
        if(!string.IsNullOrWhiteSpace(manualIp)&&(!IPAddress.TryParse(manualIp,out manual)||manual.AddressFamily!=AddressFamily.InterNetwork))
            throw new InvalidOperationException("Enter a valid IPv4 address for the Govee light.");
        try{
            var group=IPAddress.Parse("239.255.255.250");
            var localAddresses=NetworkInterface.GetAllNetworkInterfaces()
                .Where(n=>n.OperationalStatus==OperationalStatus.Up&&n.NetworkInterfaceType!=NetworkInterfaceType.Loopback)
                .SelectMany(n=>n.GetIPProperties().UnicastAddresses)
                .Select(a=>a.Address)
                .Where(a=>a.AddressFamily==AddressFamily.InterNetwork&&!IPAddress.IsLoopback(a))
                .Distinct()
                .ToList();

            using var udp=new UdpClient(AddressFamily.InterNetwork);
            udp.Client.SetSocketOption(SocketOptionLevel.Socket,SocketOptionName.ReuseAddress,true);
            udp.Client.Bind(new IPEndPoint(IPAddress.Any,4002));

            var joined=false;
            foreach(var local in localAddresses){
                try{udp.JoinMulticastGroup(group,local);joined=true;}catch(SocketException){}
            }
            if(!joined)try{udp.JoinMulticastGroup(group);}catch(SocketException){}

            var scan=Encoding.UTF8.GetBytes(BuildLanCommand("scan",new{account_topic="reserve"}));
            if(manual is not null){
                await udp.SendAsync(scan,scan.Length,new IPEndPoint(manual,4001));
            }else if(localAddresses.Count>0){
                foreach(var local in localAddresses){
                    try{
                        using var sender=new UdpClient(new IPEndPoint(local,0));
                        sender.Client.SetSocketOption(SocketOptionLevel.IP,SocketOptionName.MulticastTimeToLive,1);
                        await sender.SendAsync(scan,scan.Length,new IPEndPoint(group,4001));
                    }catch(SocketException){}
                }
            }else{
                await udp.SendAsync(scan,scan.Length,new IPEndPoint(group,4001));
            }

            var until=DateTime.UtcNow.AddMilliseconds(1600);
            while(DateTime.UtcNow<until&&!ct.IsCancellationRequested){
                var task=udp.ReceiveAsync(ct).AsTask();var done=await Task.WhenAny(task,Task.Delay(180,ct));if(done!=task)continue;
                var packet=await task;ParseLanPacket(packet.Buffer,packet.RemoteEndPoint.Address.ToString());
            }
            foreach(var d in lan.Values.ToList()){
                var status=Encoding.UTF8.GetBytes(BuildLanCommand("devStatus",new{}));
                await udp.SendAsync(status,status.Length,new IPEndPoint(IPAddress.Parse(d.Ip),4003));
            }
            until=DateTime.UtcNow.AddMilliseconds(750);
            while(DateTime.UtcNow<until&&!ct.IsCancellationRequested){
                var task=udp.ReceiveAsync(ct).AsTask();var done=await Task.WhenAny(task,Task.Delay(120,ct));if(done!=task)continue;
                var packet=await task;ParseLanPacket(packet.Buffer,packet.RemoteEndPoint.Address.ToString());
            }
        }catch(SocketException){}catch(OperationCanceledException){}
        return lan.Count;
    }
    public static string BuildLanCommand(string command,object data)=>JsonSerializer.Serialize(new{msg=new{cmd=command,data}},JsonDefaults.Options);

    void ParseLanPacket(byte[] bytes,string remoteIp){
        try{
            using var doc=JsonDocument.Parse(bytes);var root=doc.RootElement;
            if(!root.TryGetProperty("msg",out var msg)||!msg.TryGetProperty("cmd",out var cmdEl)||!msg.TryGetProperty("data",out var data))return;
            var cmd=cmdEl.GetString()??"";
            if(cmd=="scan"){
                var ip=Str(data,"ip");if(string.IsNullOrWhiteSpace(ip))ip=remoteIp;
                var device=Str(data,"device");if(string.IsNullOrWhiteSpace(device))return;
                lan[device]=new LanDevice{Device=device,Ip=ip,Sku=Str(data,"sku"),Name=Str(data,"sku")+" "+device.Replace(":","").TakeLast(4).Aggregate("",(a,c)=>a+c),Reachable=true};
            } else if(cmd=="devStatus"){
                var found=lan.Values.FirstOrDefault(x=>x.Ip==remoteIp);if(found is null)return;
                found.Reachable=true;
                if(data.TryGetProperty("onOff",out var on))found.On=on.GetInt32()==1;
                if(data.TryGetProperty("brightness",out var bri)&&bri.ValueKind==JsonValueKind.Number)found.Brightness=bri.GetInt32();
                if(data.TryGetProperty("color",out var color))found.Color=new RgbColor(Int(color,"r"),Int(color,"g"),Int(color,"b"));
                if(data.TryGetProperty("colorTemInKelvin",out var temp)&&temp.ValueKind==JsonValueKind.Number&&temp.GetInt32()>0){found.TemperatureK=temp.GetInt32();found.SupportsTemperature=true;}
            }
        }catch{}
    }

    HttpClient CloudHttp(){
        var h=new HttpClient{BaseAddress=new Uri(ApiBase),Timeout=TimeSpan.FromSeconds(8)};
        h.DefaultRequestHeaders.TryAddWithoutValidation("Govee-API-Key",state.GoveeApiKey());
        return h;
    }
    public async Task ValidateAndSaveApiKeyAsync(string key,CancellationToken ct=default){
        var prior=state.GoveeApiKey();state.SetGoveeApiKey(key);
        try{await RefreshCloudDevicesAsync(ct);if(cloud.Count==0)throw new InvalidOperationException("The key worked, but no supported Govee lights were returned.");}
        catch{state.SetGoveeApiKey(prior);throw;}
    }
    async Task RefreshCloudDevicesAsync(CancellationToken ct){
        using var http=CloudHttp();using var res=await http.GetAsync("/router/api/v1/user/devices",ct);res.EnsureSuccessStatusCode();
        using var doc=JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        var data=doc.RootElement.TryGetProperty("data",out var d)&&d.ValueKind==JsonValueKind.Array?d:default;
        var next=new List<CloudDevice>();
        if(data.ValueKind==JsonValueKind.Array)foreach(var e in data.EnumerateArray()){
            if(Str(e,"type")!="devices.types.light")continue;
            var cd=new CloudDevice{Device=Str(e,"device"),Sku=Str(e,"sku"),Name=Str(e,"deviceName")};
            if(e.TryGetProperty("capabilities",out var caps)&&caps.ValueKind==JsonValueKind.Array){
                foreach(var c in caps.EnumerateArray())ParseCloudCapability(cd,c);
            }
            if(!string.IsNullOrWhiteSpace(cd.Device))next.Add(cd);
        }
        cloud=next;cloudDevicesAt=DateTime.UtcNow;
    }
    static void ParseCloudCapability(CloudDevice d,JsonElement c){
        var type=Str(c,"type"); var instance=Str(c,"instance");
        if(type=="devices.capabilities.on_off"&&instance=="powerSwitch")d.Power=true;
        if(type=="devices.capabilities.range"&&instance=="brightness")d.Brightness=true;
        if(type=="devices.capabilities.color_setting"&&instance=="colorRgb")d.Color=true;
        if(type=="devices.capabilities.color_setting"&&instance=="colorTemperatureK"){
            d.Temperature=true;
            if(c.TryGetProperty("parameters",out var p)&&p.TryGetProperty("range",out var r)&&r.TryGetProperty("min",out var mn)&&r.TryGetProperty("max",out var mx))d.TemperatureRange=[mn.GetInt32(),mx.GetInt32()];
        }
        if(instance.Contains("scene",StringComparison.OrdinalIgnoreCase)&&c.TryGetProperty("parameters",out var pars)&&pars.TryGetProperty("options",out var opts)&&opts.ValueKind==JsonValueKind.Array){
            foreach(var o in opts.EnumerateArray())if(o.TryGetProperty("name",out var n)&&o.TryGetProperty("value",out var v))d.StaticScenes.Add(new CloudScene{Name=n.GetString()??"Scene",Type=type,Instance=instance,Value=v.Clone()});
        }
    }
    async Task RefreshCloudStatesAsync(CancellationToken ct){
        using var http=CloudHttp();
        foreach(var d in cloud.Take(12)){
            try{
                var payload=new{requestId=Guid.NewGuid().ToString(),payload=new{sku=d.Sku,device=d.Device}};
                using var res=await http.PostAsJsonAsync("/router/api/v1/device/state",payload,JsonDefaults.Options,ct);
                if(!res.IsSuccessStatusCode)continue;using var doc=JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
                var p=doc.RootElement.TryGetProperty("payload",out var pp)?pp:doc.RootElement.TryGetProperty("data",out var dd)?dd:default;
                if(p.ValueKind!=JsonValueKind.Object||!p.TryGetProperty("capabilities",out var caps)||caps.ValueKind!=JsonValueKind.Array)continue;
                var st=new CloudState{Reachable=true};
                foreach(var c in caps.EnumerateArray()){
                    var type=Str(c,"type"); var inst=Str(c,"instance"); if(!c.TryGetProperty("state",out var s)||!s.TryGetProperty("value",out var value))continue;
                    if(type=="devices.capabilities.online"&&value.ValueKind is JsonValueKind.True or JsonValueKind.False)st.Reachable=value.GetBoolean();
                    if(type=="devices.capabilities.on_off"&&inst=="powerSwitch"&&value.ValueKind==JsonValueKind.Number)st.On=value.GetInt32()==1;
                    if(type=="devices.capabilities.range"&&inst=="brightness"&&value.ValueKind==JsonValueKind.Number)st.Brightness=value.GetDouble();
                    if(type=="devices.capabilities.color_setting"&&inst=="colorRgb"&&value.ValueKind==JsonValueKind.Number){var rgb=value.GetInt32();st.Color=new((rgb>>16)&255,(rgb>>8)&255,rgb&255);}
                    if(type=="devices.capabilities.color_setting"&&inst=="colorTemperatureK"&&value.ValueKind==JsonValueKind.Number)st.TemperatureK=value.GetInt32();
                }
                cloudStates[d.Device]=st;
            }catch{}
        }
        cloudStatesAt=DateTime.UtcNow;
    }
    async Task RefreshScenesAsync(CancellationToken ct){
        using var http=CloudHttp();
        foreach(var d in cloud.Take(12)){
            var scenes=new List<CloudScene>(d.StaticScenes);
            try{
                var payload=new{requestId=Guid.NewGuid().ToString(),payload=new{sku=d.Sku,device=d.Device}};
                using var res=await http.PostAsJsonAsync("/router/api/v1/device/scenes",payload,JsonDefaults.Options,ct);
                if(res.IsSuccessStatusCode){
                    using var doc=JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
                    if(doc.RootElement.TryGetProperty("payload",out var p)&&p.TryGetProperty("capabilities",out var caps)&&caps.ValueKind==JsonValueKind.Array){
                        foreach(var c in caps.EnumerateArray()){
                            var type=Str(c,"type"); var inst=Str(c,"instance");
                            if(!c.TryGetProperty("parameters",out var pars)||!pars.TryGetProperty("options",out var opts)||opts.ValueKind!=JsonValueKind.Array)continue;
                            foreach(var o in opts.EnumerateArray())if(o.TryGetProperty("name",out var n)&&o.TryGetProperty("value",out var v))scenes.Add(new CloudScene{Name=n.GetString()??"Scene",Type=type,Instance=inst,Value=v.Clone()});
                        }
                    }
                }
            }catch{}
            sceneCache[d.Device]=scenes.GroupBy(s=>s.Name,StringComparer.OrdinalIgnoreCase).Select(g=>g.First()).ToList();
        }
        scenesAt=DateTime.UtcNow;
    }

    List<LightingTarget> Normalize(){
        var targets=new List<LightingTarget>();var allIds=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach(var c in cloud){
            lan.TryGetValue(c.Device,out var l);cloudStates.TryGetValue(c.Device,out var st);
            var id="govee:device:"+c.Device;
            var t=new LightingTarget{Id=id,Provider="govee",Kind="light",Name=string.IsNullOrWhiteSpace(c.Name)?c.Sku:c.Name,On=l?.On??st?.On??false,Brightness=l?.Brightness??st?.Brightness,Color=l?.Color??st?.Color,TemperatureK=l?.TemperatureK??st?.TemperatureK,TemperatureRange=c.TemperatureRange,Reachable=l?.Reachable??st?.Reachable??true,Favorite=state.Config.Favorites.Contains(id),Transport=l is null?"cloud":"lan+cloud",Capabilities=new(){Power=c.Power||l is not null,Brightness=c.Brightness||l is not null,Color=c.Color||l is not null,Temperature=c.Temperature||l?.SupportsTemperature==true},NativeId=c.Device,NativeAux=JsonSerializer.Serialize(new GoveeMeta{Device=c.Device,Sku=c.Sku,Ip=l?.Ip},JsonDefaults.Options)};
            if(sceneCache.TryGetValue(c.Device,out var scenes)){
                for(int i=0;i<scenes.Count;i++){
                    var s=scenes[i];var sid="govee:scene:"+Safe(c.Device)+":"+i;
                    t.Scenes.Add(new SceneRef{Id=sid,Name=s.Name});
                    targets.Add(new LightingTarget{Id=sid,Provider="govee",Kind="scene",Name=s.Name,ParentId=id,Reachable=t.Reachable,Favorite=state.Config.Favorites.Contains(sid),Capabilities=new(){Scene=true},NativeId=c.Device,NativeAux=JsonSerializer.Serialize(new SceneMeta{Device=c.Device,Sku=c.Sku,Type=s.Type,Instance=s.Instance,Value=s.Value},JsonDefaults.Options)});
                }
            }
            targets.Add(t);allIds.Add(c.Device);
        }
        foreach(var l in lan.Values.Where(x=>!allIds.Contains(x.Device))){
            var id="govee:device:"+l.Device;
            targets.Add(new LightingTarget{Id=id,Provider="govee",Kind="light",Name=l.Name,On=l.On,Brightness=l.Brightness,Color=l.Color,TemperatureK=l.TemperatureK,TemperatureRange=l.SupportsTemperature?[2000,9000]:null,Reachable=l.Reachable,Favorite=state.Config.Favorites.Contains(id),Transport="lan",Capabilities=new(){Power=true,Brightness=true,Color=true,Temperature=l.SupportsTemperature},NativeId=l.Device,NativeAux=JsonSerializer.Serialize(new GoveeMeta{Device=l.Device,Sku=l.Sku,Ip=l.Ip},JsonDefaults.Options)});
        }
        // Put devices before their scenes while preserving provider data.
        return targets.OrderBy(t=>t.Kind=="scene"?1:0).ThenBy(t=>t.Name,StringComparer.OrdinalIgnoreCase).ToList();
    }

    public async Task ControlAsync(LightingTarget target,string command,JsonElement message,CancellationToken ct=default){
        if(target.Kind=="scene"){
            var sm=JsonSerializer.Deserialize<SceneMeta>(target.NativeAux??"",JsonDefaults.Options)??throw new InvalidOperationException("Govee scene metadata missing.");
            await CloudControlAsync(sm.Sku,sm.Device,sm.Type,sm.Instance,sm.Value,ct);return;
        }
        var meta=JsonSerializer.Deserialize<GoveeMeta>(target.NativeAux??"",JsonDefaults.Options)??throw new InvalidOperationException("Govee device metadata missing.");
        if(command=="scene"&&message.TryGetProperty("sceneId",out var sid)){
            throw new InvalidOperationException("Scene commands are resolved by the controller.");
        }
        var useLan=!string.IsNullOrWhiteSpace(meta.Ip)&&(command!="temperature"||target.Capabilities.Temperature);
        if(useLan&&command is "power" or "brightness" or "color" or "temperature"){
            object data=command switch{
                "power"=>new{value=message.GetProperty("value").GetBoolean()?1:0},
                "brightness"=>new{value=Math.Clamp(message.GetProperty("value").GetInt32(),0,100)},
                "color"=>new{color=new{r=message.GetProperty("r").GetInt32(),g=message.GetProperty("g").GetInt32(),b=message.GetProperty("b").GetInt32()},colorTemInKelvin=0},
                "temperature"=>new{color=new{r=0,g=0,b=0},colorTemInKelvin=message.GetProperty("value").GetInt32()},
                _=>new{}
            };
            var lanCmd=command switch{"power"=>"turn","brightness"=>"brightness","color"=>"colorwc","temperature"=>"colorwc",_=>""};
            using var udp=new UdpClient();var bytes=Encoding.UTF8.GetBytes(BuildLanCommand(lanCmd,data));await udp.SendAsync(bytes,bytes.Length,new IPEndPoint(IPAddress.Parse(meta.Ip!),4003));return;
        }
        if(!CloudConfigured)throw new InvalidOperationException("This Govee control needs the optional Developer API key for this device.");
        if(command=="power")await CloudControlAsync(meta.Sku,meta.Device,"devices.capabilities.on_off","powerSwitch",message.GetProperty("value").GetBoolean()?1:0,ct);
        else if(command=="brightness")await CloudControlAsync(meta.Sku,meta.Device,"devices.capabilities.range","brightness",message.GetProperty("value").GetInt32(),ct);
        else if(command=="color"){var rgb=(message.GetProperty("r").GetInt32()<<16)|(message.GetProperty("g").GetInt32()<<8)|message.GetProperty("b").GetInt32();await CloudControlAsync(meta.Sku,meta.Device,"devices.capabilities.color_setting","colorRgb",rgb,ct);}
        else if(command=="temperature")await CloudControlAsync(meta.Sku,meta.Device,"devices.capabilities.color_setting","colorTemperatureK",message.GetProperty("value").GetInt32(),ct);
        else throw new InvalidOperationException("Unsupported Govee command.");
    }
    async Task CloudControlAsync(string sku,string device,string type,string instance,object value,CancellationToken ct){
        if(!CloudConfigured)throw new InvalidOperationException("Govee Developer API key is not configured.");
        using var http=CloudHttp();var payload=new{requestId=Guid.NewGuid().ToString(),payload=new{sku,device,capability=new{type,instance,value}}};
        using var res=await http.PostAsJsonAsync("/router/api/v1/device/control",payload,JsonDefaults.Options,ct);res.EnsureSuccessStatusCode();
    }

    static string Str(JsonElement e,string p)=>e.ValueKind==JsonValueKind.Object&&e.TryGetProperty(p,out var v)&&v.ValueKind==JsonValueKind.String?v.GetString()??"":"";
    static int Int(JsonElement e,string p)=>e.ValueKind==JsonValueKind.Object&&e.TryGetProperty(p,out var v)&&v.ValueKind==JsonValueKind.Number?v.GetInt32():0;
    static string Safe(string s)=>new string(s.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();

    sealed class LanDevice {public string Device="",Ip="",Sku="",Name="";public bool On,Reachable;public double? Brightness;public RgbColor? Color;public int? TemperatureK;public bool SupportsTemperature;}
    sealed class CloudDevice {public string Device="",Sku="",Name="";public bool Power,Brightness,Color,Temperature;public int[]? TemperatureRange;public List<CloudScene> StaticScenes=new();}
    sealed class CloudState {public bool On,Reachable=true;public double? Brightness;public RgbColor? Color;public int? TemperatureK;}
    sealed class CloudScene {public string Name="",Type="",Instance="";public JsonElement Value;}
    sealed class GoveeMeta {public string Device{get;set;}="";public string Sku{get;set;}="";public string? Ip{get;set;}}
    sealed class SceneMeta {public string Device{get;set;}="";public string Sku{get;set;}="";public string Type{get;set;}="";public string Instance{get;set;}="";public JsonElement Value{get;set;}}
}

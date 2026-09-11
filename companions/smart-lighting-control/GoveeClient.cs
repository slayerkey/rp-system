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
    DateTime cloudDevicesAt=DateTime.MinValue, scenesAt=DateTime.MinValue, cloudStatesAt=DateTime.MinValue, lanStatusAt=DateTime.MinValue;
    int cloudStateCursor=0;
    public GoveeClient(LocalState state){this.state=state;}
    public bool CloudConfigured=>!string.IsNullOrWhiteSpace(state.GoveeApiKey());
    public string? LastCloudError { get; private set; }

    public async Task<List<LightingTarget>> GetTargetsAsync(bool scanLan=false,CancellationToken ct=default){
        if(scanLan||lan.Count==0)await DiscoverLanAsync(null,ct);
        else if(DateTime.UtcNow-lanStatusAt>TimeSpan.FromSeconds(4))await RefreshLanStatusAsync(ct);
        if(CloudConfigured){
            if(DateTime.UtcNow-cloudDevicesAt>TimeSpan.FromMinutes(10))
                try{await RefreshCloudDevicesAsync(ct);}catch(Exception ex){LastCloudError=CloudError(ex);}
            if(cloud.Count>0&&DateTime.UtcNow-cloudStatesAt>TimeSpan.FromSeconds(15))
                try{await RefreshNextCloudStateAsync(ct);}catch(Exception ex){LastCloudError=CloudError(ex);}
            if(cloud.Count>0&&DateTime.UtcNow-scenesAt>TimeSpan.FromMinutes(30))
                try{await RefreshScenesAsync(ct);}catch(Exception ex){LastCloudError=CloudError(ex);}
        }
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
                var manualKey="ip:"+manual;
                if(!lan.Values.Any(x=>x.Ip==manual.ToString()))
                    lan[manualKey]=new LanDevice{Device=manualKey,Ip=manual.ToString(),Sku="LAN",Name="Govee LAN "+manual,Reachable=false};
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
        }catch(SocketException){}catch(OperationCanceledException){}
        if(lan.Count>0)await RefreshLanStatusAsync(ct);
        return lan.Count;
    }

    async Task RefreshLanStatusAsync(CancellationToken ct=default){
        if(lan.Count==0)return;
        try{
            using var udp=new UdpClient(AddressFamily.InterNetwork);
            udp.Client.SetSocketOption(SocketOptionLevel.Socket,SocketOptionName.ReuseAddress,true);
            udp.Client.Bind(new IPEndPoint(IPAddress.Any,4002));
            try{udp.JoinMulticastGroup(IPAddress.Parse("239.255.255.250"));}catch(SocketException){}
            var devices=lan.Values.ToList();
            foreach(var d in devices)d.Reachable=false;
            foreach(var d in devices){
                var status=Encoding.UTF8.GetBytes(BuildLanCommand("devStatus",new{}));
                await udp.SendAsync(status,status.Length,new IPEndPoint(IPAddress.Parse(d.Ip),4003));
            }
            var until=DateTime.UtcNow.AddMilliseconds(850);
            while(DateTime.UtcNow<until&&!ct.IsCancellationRequested){
                var task=udp.ReceiveAsync(ct).AsTask();var done=await Task.WhenAny(task,Task.Delay(120,ct));if(done!=task)continue;
                var packet=await task;ParseLanPacket(packet.Buffer,packet.RemoteEndPoint.Address.ToString());
            }
            lanStatusAt=DateTime.UtcNow;
        }catch(SocketException){}catch(OperationCanceledException){}
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
                foreach(var stale in lan.Where(x=>x.Value.Ip==ip&&x.Key.StartsWith("ip:",StringComparison.OrdinalIgnoreCase)).Select(x=>x.Key).ToList())lan.Remove(stale);
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

    static string CloudError(Exception ex){
        var message=ex.Message.Replace("\r"," ").Replace("\n"," ").Trim();
        return message.Length>120?message[..120]:message;
    }
    void NoteCloudResponse(HttpResponseMessage response){
        if(response.IsSuccessStatusCode){LastCloudError=null;return;}
        if((int)response.StatusCode==429)LastCloudError="Developer API rate limited";
        else if((int)response.StatusCode==401)LastCloudError="Developer API key rejected";
        else if((int)response.StatusCode>=500)LastCloudError="Developer API unavailable";
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
        using var http=CloudHttp();using var res=await http.GetAsync("/router/api/v1/user/devices",ct);NoteCloudResponse(res);res.EnsureSuccessStatusCode();
        using var doc=JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        var data=doc.RootElement.TryGetProperty("data",out var d)&&d.ValueKind==JsonValueKind.Array?d:default;
        var next=new List<CloudDevice>();
        if(data.ValueKind==JsonValueKind.Array)foreach(var e in data.EnumerateArray()){
            var cd=ParseCloudDevice(e);
            if(cd is not null)next.Add(cd);
        }
        cloud=next;cloudDevicesAt=DateTime.UtcNow;
    }
    static CloudDevice? ParseCloudDevice(JsonElement e){
        if(Str(e,"type")!="devices.types.light")return null;
        var cd=new CloudDevice{Device=Str(e,"device"),Sku=Str(e,"sku"),Name=Str(e,"deviceName")};
        if(e.TryGetProperty("capabilities",out var caps)&&caps.ValueKind==JsonValueKind.Array)
            foreach(var capability in caps.EnumerateArray())ParseCloudCapability(cd,capability);
        return string.IsNullOrWhiteSpace(cd.Device)?null:cd;
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
        if(type.Contains("scene",StringComparison.OrdinalIgnoreCase)&&c.TryGetProperty("parameters",out var pars)&&pars.TryGetProperty("options",out var opts)&&opts.ValueKind==JsonValueKind.Array){
            foreach(var o in opts.EnumerateArray())if(o.TryGetProperty("name",out var n)&&o.TryGetProperty("value",out var v))d.StaticScenes.Add(new CloudScene{Name=n.GetString()??"Scene",Type=type,Instance=instance,Value=v.Clone()});
        }
    }
    async Task RefreshNextCloudStateAsync(CancellationToken ct){
        // Budget cloud polling across the whole account instead of polling every
        // device every refresh. LAN-capable devices already have local status.
        // One cloud state request per 15 seconds is <= 5,760/day total, leaving
        // substantial room for device discovery, scenes and user controls.
        var candidates=cloud.Where(d=>!lan.ContainsKey(d.Device)).ToList();
        if(candidates.Count==0){cloudStatesAt=DateTime.UtcNow;return;}
        if(cloudStateCursor>=candidates.Count)cloudStateCursor=0;
        var d=candidates[cloudStateCursor++];
        try{
            using var http=CloudHttp();
            var payload=new{requestId=Guid.NewGuid().ToString(),payload=new{sku=d.Sku,device=d.Device}};
            using var res=await http.PostAsJsonAsync("/router/api/v1/device/state",payload,JsonDefaults.Options,ct);
            NoteCloudResponse(res);
            if(res.IsSuccessStatusCode){
                using var doc=JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
                var p=doc.RootElement.TryGetProperty("payload",out var pp)?pp:doc.RootElement.TryGetProperty("data",out var dd)?dd:default;
                if(p.ValueKind==JsonValueKind.Object&&p.TryGetProperty("capabilities",out var caps)&&caps.ValueKind==JsonValueKind.Array){
                    cloudStates[d.Device]=ParseCloudState(caps);
                }
            }
        }catch{}
        cloudStatesAt=DateTime.UtcNow;
    }
    static CloudState ParseCloudState(JsonElement caps){
        var st=new CloudState{Reachable=true};
        foreach(var cap in caps.EnumerateArray()){
            var type=Str(cap,"type"); var inst=Str(cap,"instance");
            if(!cap.TryGetProperty("state",out var s)||!s.TryGetProperty("value",out var value))continue;
            if(type=="devices.capabilities.online"&&value.ValueKind is JsonValueKind.True or JsonValueKind.False)st.Reachable=value.GetBoolean();
            if(type=="devices.capabilities.on_off"&&inst=="powerSwitch"&&value.ValueKind==JsonValueKind.Number)st.On=value.GetInt32()==1;
            if(type=="devices.capabilities.range"&&inst=="brightness"&&value.ValueKind==JsonValueKind.Number)st.Brightness=value.GetDouble();
            if(type=="devices.capabilities.color_setting"&&inst=="colorRgb"&&value.ValueKind==JsonValueKind.Number){var rgb=value.GetInt32();st.Color=new((rgb>>16)&255,(rgb>>8)&255,rgb&255);}
            if(type=="devices.capabilities.color_setting"&&inst=="colorTemperatureK"&&value.ValueKind==JsonValueKind.Number)st.TemperatureK=value.GetInt32();
        }
        return st;
    }

    public static void RunDeterministicParserSelfTest(){
        using var deviceDoc=JsonDocument.Parse("""
        {"type":"devices.types.light","sku":"H6601","device":"AA:BB:CC:DD","deviceName":"Fixture Light","capabilities":[
          {"type":"devices.capabilities.on_off","instance":"powerSwitch","parameters":{"dataType":"ENUM"}},
          {"type":"devices.capabilities.range","instance":"brightness","parameters":{"dataType":"INTEGER","range":{"min":1,"max":100}}},
          {"type":"devices.capabilities.color_setting","instance":"colorRgb","parameters":{"dataType":"INTEGER","range":{"min":0,"max":16777215}}},
          {"type":"devices.capabilities.color_setting","instance":"colorTemperatureK","parameters":{"dataType":"INTEGER","range":{"min":2000,"max":9000}}},
          {"type":"devices.capabilities.dynamic_scene","instance":"lightScene","parameters":{"dataType":"ENUM","options":[{"name":"Aurora","value":{"paramId":4284,"id":3857}}]}}
        ]}
        """);
        var d=ParseCloudDevice(deviceDoc.RootElement)??throw new Exception("Govee fixture device parser returned null");
        if(!d.Power||!d.Brightness||!d.Color||!d.Temperature)throw new Exception("Govee fixture capabilities were not detected");
        if(d.TemperatureRange is null||d.TemperatureRange[0]!=2000||d.TemperatureRange[1]!=9000)throw new Exception("Govee fixture temperature range failed");
        if(d.StaticScenes.Count!=1||d.StaticScenes[0].Name!="Aurora")throw new Exception("Govee fixture scene parser failed");

        using var stateDoc=JsonDocument.Parse("""
        [{"type":"devices.capabilities.online","instance":"online","state":{"value":true}},
         {"type":"devices.capabilities.on_off","instance":"powerSwitch","state":{"value":1}},
         {"type":"devices.capabilities.range","instance":"brightness","state":{"value":73}},
         {"type":"devices.capabilities.color_setting","instance":"colorRgb","state":{"value":16711680}},
         {"type":"devices.capabilities.color_setting","instance":"colorTemperatureK","state":{"value":4200}}]
        """);
        var st=ParseCloudState(stateDoc.RootElement);
        if(!st.Reachable||!st.On||st.Brightness!=73||st.Color?.R!=255||st.Color.G!=0||st.Color.B!=0||st.TemperatureK!=4200)
            throw new Exception("Govee fixture state parser failed");
    }

    async Task RefreshScenesAsync(CancellationToken ct){
        using var http=CloudHttp();
        foreach(var d in cloud){
            var scenes=new List<CloudScene>(d.StaticScenes);
            await AppendScenesAsync(http,d,"/router/api/v1/device/scenes",scenes,ct);
            await AppendScenesAsync(http,d,"/router/api/v1/device/diy-scenes",scenes,ct);
            sceneCache[d.Device]=scenes.GroupBy(s=>s.Name,StringComparer.OrdinalIgnoreCase).Select(g=>g.First()).ToList();
        }
        scenesAt=DateTime.UtcNow;
    }

    static async Task AppendScenesAsync(HttpClient http,CloudDevice d,string endpoint,List<CloudScene> scenes,CancellationToken ct){
        try{
            var payload=new{requestId=Guid.NewGuid().ToString(),payload=new{sku=d.Sku,device=d.Device}};
            using var res=await http.PostAsJsonAsync(endpoint,payload,JsonDefaults.Options,ct);
            if((int)res.StatusCode is 401 or 429 || (int)res.StatusCode>=500)NoteCloudResponse(res);
            if(!res.IsSuccessStatusCode)return;
            using var doc=JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            if(!doc.RootElement.TryGetProperty("payload",out var p)||!p.TryGetProperty("capabilities",out var caps)||caps.ValueKind!=JsonValueKind.Array)return;
            foreach(var capability in caps.EnumerateArray()){
                var type=Str(capability,"type"); var inst=Str(capability,"instance");
                if(!capability.TryGetProperty("parameters",out var pars)||!pars.TryGetProperty("options",out var opts)||opts.ValueKind!=JsonValueKind.Array)continue;
                foreach(var o in opts.EnumerateArray())
                    if(o.TryGetProperty("name",out var n)&&o.TryGetProperty("value",out var v))
                        scenes.Add(new CloudScene{Name=n.GetString()??"Scene",Type=type,Instance=inst,Value=v.Clone()});
            }
        }catch{}
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
            using var udp=new UdpClient();var bytes=Encoding.UTF8.GetBytes(BuildLanCommand(lanCmd,data));await udp.SendAsync(bytes,bytes.Length,new IPEndPoint(IPAddress.Parse(meta.Ip!),4003));ApplyCachedState(meta.Device,command,message);return;
        }
        if(!CloudConfigured)throw new InvalidOperationException("This Govee control needs the optional Developer API key for this device.");
        if(command=="power")await CloudControlAsync(meta.Sku,meta.Device,"devices.capabilities.on_off","powerSwitch",message.GetProperty("value").GetBoolean()?1:0,ct);
        else if(command=="brightness")await CloudControlAsync(meta.Sku,meta.Device,"devices.capabilities.range","brightness",message.GetProperty("value").GetInt32(),ct);
        else if(command=="color"){var rgb=(message.GetProperty("r").GetInt32()<<16)|(message.GetProperty("g").GetInt32()<<8)|message.GetProperty("b").GetInt32();await CloudControlAsync(meta.Sku,meta.Device,"devices.capabilities.color_setting","colorRgb",rgb,ct);}
        else if(command=="temperature")await CloudControlAsync(meta.Sku,meta.Device,"devices.capabilities.color_setting","colorTemperatureK",message.GetProperty("value").GetInt32(),ct);
        else throw new InvalidOperationException("Unsupported Govee command.");
        ApplyCachedState(meta.Device,command,message);
    }

    void ApplyCachedState(string device,string command,JsonElement message){
        lan.TryGetValue(device,out var local);
        if(!cloudStates.TryGetValue(device,out var remote)){remote=new CloudState{Reachable=true};cloudStates[device]=remote;}
        if(command=="power"){
            var value=message.GetProperty("value").GetBoolean();remote.On=value;if(local is not null)local.On=value;
        }else if(command=="brightness"){
            var value=message.GetProperty("value").GetDouble();remote.Brightness=value;if(local is not null)local.Brightness=value;
        }else if(command=="color"){
            var value=new RgbColor(message.GetProperty("r").GetInt32(),message.GetProperty("g").GetInt32(),message.GetProperty("b").GetInt32());
            remote.Color=value;if(local is not null)local.Color=value;
        }else if(command=="temperature"){
            var value=message.GetProperty("value").GetInt32();remote.TemperatureK=value;if(local is not null){local.TemperatureK=value;local.SupportsTemperature=true;}
        }
    }

    async Task CloudControlAsync(string sku,string device,string type,string instance,object value,CancellationToken ct){
        if(!CloudConfigured)throw new InvalidOperationException("Govee Developer API key is not configured.");
        using var http=CloudHttp();var payload=new{requestId=Guid.NewGuid().ToString(),payload=new{sku,device,capability=new{type,instance,value}}};
        using var res=await http.PostAsJsonAsync("/router/api/v1/device/control",payload,JsonDefaults.Options,ct);NoteCloudResponse(res);res.EnsureSuccessStatusCode();
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

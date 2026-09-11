using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace PackRat.SmartLighting;

public sealed record HueBridgeCandidate(string Id,string Ip,string Source);

public sealed class HueClient {
    readonly LocalState state;
    public HueClient(LocalState state){this.state=state;}
    public bool Configured=>!string.IsNullOrWhiteSpace(state.Config.HueBridgeIp)&&!string.IsNullOrWhiteSpace(state.HueAppKey());

    public async Task<List<HueBridgeCandidate>> DiscoverAsync(CancellationToken ct=default){
        var found=await DiscoverMdnsAsync(ct);
        if(found.Count>0)return found;
        try{
            using var http=new HttpClient{Timeout=TimeSpan.FromSeconds(4)};
            var rows=await http.GetFromJsonAsync<List<Dictionary<string,string>>>("https://discovery.meethue.com/",ct)??new();
            foreach(var row in rows){
                if(row.TryGetValue("internalipaddress",out var ip)&&IPAddress.TryParse(ip,out _)){
                    var id=row.TryGetValue("id",out var bridgeId)?bridgeId:"";
                    found.Add(new(id,ip,"Hue discovery service fallback"));
                }
            }
        }catch{}
        return found.GroupBy(x=>x.Ip,StringComparer.OrdinalIgnoreCase).Select(g=>g.First()).ToList();
    }

    static async Task<List<HueBridgeCandidate>> DiscoverMdnsAsync(CancellationToken ct){
        var result=new List<HueBridgeCandidate>();
        try{
            using var udp=new UdpClient(AddressFamily.InterNetwork);
            udp.Client.ReceiveTimeout=1600;
            var query=BuildMdnsQuery("_hue._tcp.local");
            await udp.SendAsync(query,query.Length,new IPEndPoint(IPAddress.Parse("224.0.0.251"),5353));
            var deadline=DateTime.UtcNow.AddMilliseconds(1600);
            while(DateTime.UtcNow<deadline&&!ct.IsCancellationRequested){
                var wait=udp.ReceiveAsync(ct).AsTask();
                var done=await Task.WhenAny(wait,Task.Delay(250,ct));
                if(done!=wait)continue;
                var packet=await wait;
                ParseMdns(packet.Buffer,result);
            }
        }catch{}
        return result.GroupBy(x=>x.Ip,StringComparer.OrdinalIgnoreCase).Select(g=>g.First()).ToList();
    }
    static byte[] BuildMdnsQuery(string name){
        using var ms=new MemoryStream();using var bw=new BinaryWriter(ms);
        void U16(ushort v){bw.Write((byte)(v>>8));bw.Write((byte)v);}
        U16(0);U16(0);U16(1);U16(0);U16(0);U16(0);
        foreach(var part in name.Split('.')){var b=Encoding.UTF8.GetBytes(part);bw.Write((byte)b.Length);bw.Write(b);}bw.Write((byte)0);
        U16(12);U16(0x8001); // PTR, IN with QU bit to request unicast response
        return ms.ToArray();
    }
    static void ParseMdns(byte[] data,List<HueBridgeCandidate> output){
        if(data.Length<12)return;
        int p=4;ushort qd=ReadU16(data,ref p),an=ReadU16(data,ref p),ns=ReadU16(data,ref p),ar=ReadU16(data,ref p);p=12;
        for(int i=0;i<qd;i++){ReadName(data,ref p);p+=4;if(p>data.Length)return;}
        var ips=new List<string>();var ids=new List<string>();
        for(int i=0;i<an+ns+ar&&p<data.Length;i++){
            ReadName(data,ref p);if(p+10>data.Length)break;
            ushort type=ReadU16(data,ref p);p+=2;p+=4;ushort len=ReadU16(data,ref p);if(p+len>data.Length)break;
            if(type==1&&len==4)ips.Add(new IPAddress(data.AsSpan(p,4)).ToString());
            if(type==16){
                int end=p+len,q=p;
                while(q<end){int l=data[q++];if(l<=0||q+l>end)break;var s=Encoding.UTF8.GetString(data,q,l);q+=l;if(s.StartsWith("bridgeid=",StringComparison.OrdinalIgnoreCase))ids.Add(s[9..]);}
            }
            p+=len;
        }
        foreach(var ip in ips)output.Add(new(ids.FirstOrDefault()??"",ip,"mDNS"));
    }
    static ushort ReadU16(byte[] d,ref int p){if(p+2>d.Length){p=d.Length;return 0;}return (ushort)((d[p++]<<8)|d[p++]);}
    static string ReadName(byte[] d,ref int p,int depth=0){
        if(depth>10||p>=d.Length)return"";var parts=new List<string>();int guard=0;
        while(p<d.Length&&guard++<128){
            int len=d[p++];
            if(len==0)break;
            if((len&0xC0)==0xC0){if(p>=d.Length)break;int off=((len&0x3F)<<8)|d[p++];int tmp=off;parts.Add(ReadName(d,ref tmp,depth+1));break;}
            if(p+len>d.Length)break;parts.Add(Encoding.UTF8.GetString(d,p,len));p+=len;
        }
        return string.Join('.',parts.Where(x=>x.Length>0));
    }

    HttpClient CreateHttp(string ip,string? expectedPin,Action<string>? pinObserver=null){
        var handler=new HttpClientHandler();
        handler.ServerCertificateCustomValidationCallback=(req,cert,chain,errors)=>{
            if(cert is null)return false;
            var pin=Convert.ToHexString(SHA256.HashData(cert.GetRawCertData()));
            pinObserver?.Invoke(pin);
            return string.IsNullOrWhiteSpace(expectedPin)||CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(pin),Encoding.ASCII.GetBytes(expectedPin));
        };
        return new HttpClient(handler){BaseAddress=new Uri("https://"+ip+"/"),Timeout=TimeSpan.FromSeconds(6)};
    }

    public async Task<string> PairAsync(string ip,CancellationToken ct=default){
        if(!IPAddress.TryParse(ip,out _))throw new InvalidOperationException("Enter a valid Hue Bridge IP address.");
        string? observedPin=null;
        using var http=CreateHttp(ip,null,p=>observedPin=p);
        using var body=new StringContent(JsonSerializer.Serialize(new{devicetype="packrat_smart_lighting#xeneon",generateclientkey=true}),Encoding.UTF8,"application/json");
        using var response=await http.PostAsync("api",body,ct);
        var text=await response.Content.ReadAsStringAsync(ct);
        response.EnsureSuccessStatusCode();
        using var doc=JsonDocument.Parse(text);
        if(doc.RootElement.ValueKind!=JsonValueKind.Array||doc.RootElement.GetArrayLength()==0)throw new InvalidOperationException("Unexpected Hue pairing response.");
        var first=doc.RootElement[0];
        if(first.TryGetProperty("error",out var error)){
            var desc=error.TryGetProperty("description",out var d)?d.GetString():"Hue Bridge rejected pairing.";
            throw new InvalidOperationException(desc??"Hue Bridge rejected pairing.");
        }
        if(!first.TryGetProperty("success",out var success)||!success.TryGetProperty("username",out var username))throw new InvalidOperationException("Hue Bridge did not return an application key.");
        var key=username.GetString();if(string.IsNullOrWhiteSpace(key))throw new InvalidOperationException("Hue application key was blank.");
        state.Config.HueBridgeIp=ip;state.Config.HueCertificateSha256=observedPin;state.SetHueAppKey(key);
        try{
            using var configHttp=CreateHttp(ip,observedPin);
            var config=await configHttp.GetStringAsync("api/config",ct);using var cfg=JsonDocument.Parse(config);
            if(cfg.RootElement.TryGetProperty("bridgeid",out var id))state.Config.HueBridgeId=id.GetString();
        }catch{}
        state.Save();
        return state.Config.HueBridgeId??ip;
    }

    public async Task<List<LightingTarget>> GetTargetsAsync(CancellationToken ct=default){
        var ip=state.Config.HueBridgeIp;var key=state.HueAppKey();
        if(string.IsNullOrWhiteSpace(ip)||string.IsNullOrWhiteSpace(key))return new();
        using var http=CreateHttp(ip,state.Config.HueCertificateSha256);
        http.DefaultRequestHeaders.TryAddWithoutValidation("hue-application-key",key);
        using var response=await http.GetAsync("clip/v2/resource",ct);response.EnsureSuccessStatusCode();
        using var doc=JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        if(!doc.RootElement.TryGetProperty("data",out var data)||data.ValueKind!=JsonValueKind.Array)return new();
        return NormalizeResources(data,state.Config.Favorites);
    }

    public static List<LightingTarget> NormalizeResources(JsonElement data,ISet<string>? favorites=null){
        favorites??=new HashSet<string>();
        var resources=data.EnumerateArray().Select(e=>e.Clone()).ToList();
        var grouped=resources.Where(e=>S(e,"type")=="grouped_light").ToDictionary(e=>S(e,"id"),e=>e,StringComparer.Ordinal);
        var targets=new List<LightingTarget>();var ownerMap=new Dictionary<string,string>(StringComparer.Ordinal);
        foreach(var e in resources.Where(e=>S(e,"type")=="light")){
            var rid=S(e,"id"); var id="hue:light:"+rid; var name=MetaName(e,"Hue Light");
            var t=FromHueState(e,id,"light",name,rid);t.Favorite=favorites.Contains(id);targets.Add(t);ownerMap[rid]=id;
        }
        foreach(var e in resources.Where(e=>S(e,"type") is "room" or "zone")){
            var kind=S(e,"type"); var rid=S(e,"id"); var id="hue:"+kind+":"+rid; var service=ServiceRid(e,"grouped_light");
            if(string.IsNullOrWhiteSpace(service)||!grouped.TryGetValue(service,out var g))continue;
            var t=FromHueState(g,id,kind,MetaName(e,kind=="room"?"Hue Room":"Hue Zone"),service);t.NativeAux=rid;t.Favorite=favorites.Contains(id);targets.Add(t);ownerMap[rid]=id;
        }
        var scenes=new List<LightingTarget>();
        foreach(var e in resources.Where(e=>S(e,"type")=="scene")){
            var rid=S(e,"id"); var group=e.TryGetProperty("group",out var gr)?S(gr,"rid"):""; var id="hue:scene:"+rid;
            var t=new LightingTarget{Id=id,Provider="hue",Kind="scene",Name=MetaName(e,"Hue Scene"),ParentId=ownerMap.TryGetValue(group,out var parent)?parent:null,Reachable=true,Favorite=favorites.Contains(id),Capabilities=new(){Scene=true},NativeId=rid};
            scenes.Add(t);
        }
        targets.AddRange(scenes);
        foreach(var parent in targets.Where(t=>t.Kind is "room" or "zone")){
            parent.Scenes=scenes.Where(s=>s.ParentId==parent.Id).Select(s=>new SceneRef{Id=s.Id,Name=s.Name}).ToList();
        }
        return targets;
    }
    static LightingTarget FromHueState(JsonElement e,string id,string kind,string name,string nativeId){
        bool on=e.TryGetProperty("on",out var onObj)&&onObj.TryGetProperty("on",out var ov)&&ov.GetBoolean();
        double? bri=e.TryGetProperty("dimming",out var dim)&&dim.TryGetProperty("brightness",out var bv)?bv.GetDouble():null;
        RgbColor? rgb=null;if(e.TryGetProperty("color",out var col)&&col.TryGetProperty("xy",out var xy)&&xy.TryGetProperty("x",out var xx)&&xy.TryGetProperty("y",out var yy))rgb=XyToRgb(xx.GetDouble(),yy.GetDouble(),bri??100);
        int? temp=null;int[]? range=null;
        if(e.TryGetProperty("color_temperature",out var ctObj)){
            if(ctObj.TryGetProperty("mirek",out var mk)&&mk.ValueKind==JsonValueKind.Number&&mk.GetInt32()>0)temp=(int)Math.Round(1_000_000d/mk.GetInt32());
            if(ctObj.TryGetProperty("mirek_schema",out var schema)&&schema.TryGetProperty("mirek_minimum",out var mn)&&schema.TryGetProperty("mirek_maximum",out var mx)&&mn.GetInt32()>0&&mx.GetInt32()>0)range=[(int)Math.Round(1_000_000d/mx.GetInt32()),(int)Math.Round(1_000_000d/mn.GetInt32())];
        }
        return new LightingTarget{Id=id,Provider="hue",Kind=kind,Name=name,NativeId=nativeId,On=on,Brightness=bri,Color=rgb,TemperatureK=temp,TemperatureRange=range,Reachable=true,Capabilities=new(){Power=e.TryGetProperty("on",out _),Brightness=e.TryGetProperty("dimming",out _),Color=e.TryGetProperty("color",out _),Temperature=e.TryGetProperty("color_temperature",out _)}};
    }
    static string S(JsonElement e,string p)=>e.ValueKind==JsonValueKind.Object&&e.TryGetProperty(p,out var v)&&v.ValueKind==JsonValueKind.String?v.GetString()??"":"";
    static string MetaName(JsonElement e,string fallback)=>e.TryGetProperty("metadata",out var m)&&m.TryGetProperty("name",out var n)&&n.ValueKind==JsonValueKind.String?n.GetString()??fallback:fallback;
    static string ServiceRid(JsonElement e,string type){
        if(!e.TryGetProperty("services",out var s)||s.ValueKind!=JsonValueKind.Array)return"";
        foreach(var x in s.EnumerateArray())if(S(x,"rtype")==type)return S(x,"rid");return"";
    }

    public async Task ControlAsync(LightingTarget target,string command,JsonElement message,CancellationToken ct=default){
        var ip=state.Config.HueBridgeIp;var key=state.HueAppKey();if(string.IsNullOrWhiteSpace(ip)||string.IsNullOrWhiteSpace(key)||string.IsNullOrWhiteSpace(target.NativeId))throw new InvalidOperationException("Hue is not paired.");
        using var http=CreateHttp(ip,state.Config.HueCertificateSha256);http.DefaultRequestHeaders.TryAddWithoutValidation("hue-application-key",key);
        string resource=target.Kind is "room" or "zone"?"grouped_light":target.Kind=="scene"?"scene":"light";
        object payload=command switch{
            "power"=>new{on=new{on=message.GetProperty("value").GetBoolean()}},
            "brightness"=>new{dimming=new{brightness=Math.Clamp(message.GetProperty("value").GetDouble(),0,100)}},
            "temperature"=>new{color_temperature=new{mirek=(int)Math.Round(1_000_000d/Math.Clamp(message.GetProperty("value").GetDouble(),1000,10000))}},
            "color"=>new{color=new{xy=RgbToXy(message.GetProperty("r").GetInt32(),message.GetProperty("g").GetInt32(),message.GetProperty("b").GetInt32())}},
            "scene"=>new{recall=new{action="active"}},
            _=>throw new InvalidOperationException("Unsupported Hue command.")
        };
        var nativeId=command=="scene"&&message.TryGetProperty("sceneId",out var sceneId)?sceneId.GetString()?.Split(':').Last():target.NativeId;
        if(command=="scene")resource="scene";
        using var req=new HttpRequestMessage(HttpMethod.Put,$"clip/v2/resource/{resource}/{nativeId}"){Content=JsonContent.Create(payload)};
        using var response=await http.SendAsync(req,ct);response.EnsureSuccessStatusCode();
    }

    public static object RgbToXy(int r,int g,int b){
        double R=r/255d,G=g/255d,B=b/255d;
        R=R>.04045?Math.Pow((R+.055)/1.055,2.4):R/12.92;G=G>.04045?Math.Pow((G+.055)/1.055,2.4):G/12.92;B=B>.04045?Math.Pow((B+.055)/1.055,2.4):B/12.92;
        var X=R*.664511+G*.154324+B*.162028;var Y=R*.283881+G*.668433+B*.047685;var Z=R*.000088+G*.072310+B*.986039;var sum=X+Y+Z;
        return new{x=sum<=0?0:X/sum,y=sum<=0?0:Y/sum};
    }
    public static RgbColor XyToRgb(double x,double y,double brightness){
        if(y<=0)return new(0,0,0);var Y=Math.Clamp(brightness/100d,0.01,1);var X=(Y/y)*x;var Z=(Y/y)*(1-x-y);
        var r=X*1.656492-Y*.354851-Z*.255038;var g=-X*.707196+Y*1.655397+Z*.036152;var b=X*.051713-Y*.121364+Z*1.011530;
        double C(double c){c=Math.Max(0,c);c=c<=.0031308?12.92*c:1.055*Math.Pow(c,1/2.4)-.055;return Math.Clamp(c,0,1);}
        var cr=C(r); var cg=C(g); var cb=C(b); var max=Math.Max(cr,Math.Max(cg,cb)); if(max>1){cr/=max;cg/=max;cb/=max;}
        return new((int)Math.Round(cr*255),(int)Math.Round(cg*255),(int)Math.Round(cb*255));
    }
}

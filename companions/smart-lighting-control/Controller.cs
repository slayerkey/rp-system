using System.Text.Json;

namespace PackRat.SmartLighting;

public interface ILightingRuntime {
    string PairingToken { get; }
    LightingSnapshot Snapshot { get; }
    event Action? Changed;
    Task HandleCommandAsync(JsonElement message,CancellationToken ct=default);
}

public sealed class LightingController : ILightingRuntime, IAsyncDisposable {
    readonly LocalState state;
    readonly HueClient hue;
    readonly GoveeClient govee;
    readonly SemaphoreSlim refreshLock=new(1,1);
    readonly CancellationTokenSource stop=new();
    Task? loop;
    bool firstGoveeScan=true;
    public string PairingToken { get; }
    public LightingSnapshot Snapshot { get; private set; }=new();
    public event Action? Changed;

    public LightingController(LocalState state){
        this.state=state;hue=new(state);govee=new(state);PairingToken=state.PairingToken();
        Snapshot.Providers["hue"]=new();
        Snapshot.Providers["govee"]=new();
    }
    public async Task StartAsync(){await RefreshAsync();loop=Task.Run(RefreshLoop);}
    async Task RefreshLoop(){
        while(!stop.IsCancellationRequested){
            try{await Task.Delay(TimeSpan.FromSeconds(5),stop.Token);await RefreshAsync(stop.Token);}catch(OperationCanceledException){break;}catch{}
        }
    }
    public async Task RefreshAsync(CancellationToken ct=default){
        if(!await refreshLock.WaitAsync(0,ct))return;
        try{
            var targets=new List<LightingTarget>();
            var hp=new ProviderStatus(); var gp=new ProviderStatus();
            if(hue.Configured){
                try{var list=await hue.GetTargetsAsync(ct);targets.AddRange(list);hp.Connected=true;hp.Detail="Hue Bridge local";}
                catch(Exception ex){hp.Connected=false;hp.Detail=SafeError(ex);}
            }else hp.Detail="Not paired";
            try{
                var list=await govee.GetTargetsAsync(firstGoveeScan,ct);firstGoveeScan=false;targets.AddRange(list);
                gp.Lan=list.Any(t=>t.Provider=="govee"&&(t.Transport?.Contains("lan")==true));
                gp.Cloud=govee.CloudConfigured;gp.Connected=list.Count>0;gp.Partial=gp.Lan||gp.Cloud;
                gp.Detail=gp.Lan&&gp.Cloud?"LAN + Developer API":gp.Lan?"LAN":gp.Cloud?"Developer API":"Not configured";
            }catch(Exception ex){gp.Cloud=govee.CloudConfigured;gp.Partial=gp.Cloud;gp.Detail=SafeError(ex);}
            foreach(var t in targets)t.Favorite=state.Config.Favorites.Contains(t.Id);
            Snapshot=new LightingSnapshot{UpdatedAt=DateTimeOffset.UtcNow.ToString("O"),Providers=new(){{"hue",hp},{"govee",gp}},Targets=targets};
            Changed?.Invoke();
        }finally{refreshLock.Release();}
    }
    static string SafeError(Exception ex){var s=ex.Message.Replace("\r"," ").Replace("\n"," ");return s.Length>120?s[..120]:s;}

    public async Task HandleCommandAsync(JsonElement message,CancellationToken ct=default){
        var command=message.TryGetProperty("command",out var c)?c.GetString()??"":"";
        var id=message.TryGetProperty("id",out var i)?i.GetString()??"":"";
        if(command=="refresh"){await RefreshAsync(ct);return;}
        if(command=="favorite"){
            if(string.IsNullOrWhiteSpace(id))return;state.ToggleFavorite(id,message.TryGetProperty("value",out var v)&&v.GetBoolean());
            var existing=Snapshot.Targets.FirstOrDefault(t=>t.Id==id);if(existing is not null)existing.Favorite=state.Config.Favorites.Contains(id);Changed?.Invoke();return;
        }
        LightingTarget? target;
        if(command=="scene"&&message.TryGetProperty("sceneId",out var sceneEl)){
            var sceneId=sceneEl.GetString()??"";target=Snapshot.Targets.FirstOrDefault(t=>t.Id==sceneId&&t.Kind=="scene");
        }else target=Snapshot.Targets.FirstOrDefault(t=>t.Id==id);
        if(target is null)throw new InvalidOperationException("Lighting target was not found.");
        if(target.Reachable==false)throw new InvalidOperationException("Lighting target is offline.");
        if(target.Provider=="hue")await hue.ControlAsync(target,command,message,ct);
        else if(target.Provider=="govee")await govee.ControlAsync(target,command,message,ct);
        else throw new InvalidOperationException("Unknown lighting provider.");
        ApplyOptimistic(target,command,message);
        Changed?.Invoke();
        _=Task.Run(async()=>{try{await Task.Delay(350,stop.Token);await RefreshAsync(stop.Token);}catch{}});
    }
    static void ApplyOptimistic(LightingTarget t,string command,JsonElement m){
        if(command=="power"&&m.TryGetProperty("value",out var p))t.On=p.GetBoolean();
        if(command=="brightness"&&m.TryGetProperty("value",out var b))t.Brightness=b.GetDouble();
        if(command=="temperature"&&m.TryGetProperty("value",out var k))t.TemperatureK=k.GetInt32();
        if(command=="color"&&m.TryGetProperty("r",out var r)&&m.TryGetProperty("g",out var g)&&m.TryGetProperty("b",out var b2))t.Color=new(r.GetInt32(),g.GetInt32(),b2.GetInt32());
    }

    public Task<List<HueBridgeCandidate>> DiscoverHueAsync(CancellationToken ct=default)=>hue.DiscoverAsync(ct);
    public async Task<string> PairHueAsync(string ip,CancellationToken ct=default){var r=await hue.PairAsync(ip,ct);await RefreshAsync(ct);return r;}
    public async Task<int> ScanGoveeLanAsync(CancellationToken ct=default){var n=await govee.DiscoverLanAsync(ct);await RefreshAsync(ct);return n;}
    public async Task SetGoveeKeyAsync(string key,CancellationToken ct=default){await govee.ValidateAndSaveApiKeyAsync(key,ct);await RefreshAsync(ct);}
    public async Task ClearGoveeKeyAsync(CancellationToken ct=default){state.SetGoveeApiKey(null);await RefreshAsync(ct);}
    public object SetupStatus()=>new{
        pairingToken=PairingToken,
        hue=new{configured=hue.Configured,bridgeIp=state.Config.HueBridgeIp,bridgeId=state.Config.HueBridgeId},
        govee=new{lan=Snapshot.Providers.TryGetValue("govee",out var g)&&g.Lan,cloud=govee.CloudConfigured},
        targetCount=Snapshot.Targets.Count
    };
    public async ValueTask DisposeAsync(){stop.Cancel();if(loop is not null)try{await loop;}catch{}stop.Dispose();refreshLock.Dispose();}
}

public sealed class FixtureRuntime : ILightingRuntime {
    public string PairingToken=>"fixture-token";
    public LightingSnapshot Snapshot { get; private set; }
    public event Action? Changed;
    public FixtureRuntime(){
        Snapshot=new LightingSnapshot{
            Providers=new(){{"hue",new(){Connected=true,Detail="Fixture Hue Bridge"}},{"govee",new(){Connected=true,Lan=true,Cloud=true,Detail="Fixture LAN + cloud"}}},
            Targets=new(){
                new(){Id="hue:room:studio",Provider="hue",Kind="room",Name="Studio",On=true,Brightness=72,Color=new(255,198,112),TemperatureK=3600,TemperatureRange=[2000,6500],Favorite=true,Capabilities=new(){Power=true,Brightness=true,Color=true,Temperature=true},Scenes=[new(){Id="hue:scene:focus",Name="Focus"}]},
                new(){Id="hue:scene:focus",Provider="hue",Kind="scene",Name="Focus",ParentId="hue:room:studio",Favorite=true,Capabilities=new(){Scene=true}},
                new(){Id="govee:device:bars",Provider="govee",Kind="light",Name="Desk Bars",On=true,Brightness=61,Color=new(139,92,246),Favorite=true,Transport="lan",Capabilities=new(){Power=true,Brightness=true,Color=true}}
            }
        };
    }
    public Task HandleCommandAsync(JsonElement m,CancellationToken ct=default){
        var cmd=m.TryGetProperty("command",out var c)?c.GetString():""; var id=m.TryGetProperty("id",out var i)?i.GetString():"";
        if(cmd=="scene"&&m.TryGetProperty("sceneId",out var s))id=s.GetString();
        var t=Snapshot.Targets.FirstOrDefault(x=>x.Id==id);
        if(t is not null){
            if(cmd=="power")t.On=m.GetProperty("value").GetBoolean();
            if(cmd=="brightness")t.Brightness=m.GetProperty("value").GetDouble();
            if(cmd=="color")t.Color=new(m.GetProperty("r").GetInt32(),m.GetProperty("g").GetInt32(),m.GetProperty("b").GetInt32());
            if(cmd=="temperature")t.TemperatureK=m.GetProperty("value").GetInt32();
            if(cmd=="favorite")t.Favorite=m.GetProperty("value").GetBoolean();
        }
        Snapshot.UpdatedAt=DateTimeOffset.UtcNow.ToString("O");Changed?.Invoke();return Task.CompletedTask;
    }
}

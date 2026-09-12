using System.Text.Json;
using System.Text.Json.Serialization;

namespace PackRat.SmartLighting;

public sealed class CapabilitySet {
    [JsonPropertyName("power")] public bool Power { get; set; }
    [JsonPropertyName("brightness")] public bool Brightness { get; set; }
    [JsonPropertyName("color")] public bool Color { get; set; }
    [JsonPropertyName("temperature")] public bool Temperature { get; set; }
    [JsonPropertyName("scene")] public bool Scene { get; set; }
}
public sealed class SceneRef {
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
}
public sealed class LightingTarget {
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("provider")] public string Provider { get; set; } = "";
    [JsonPropertyName("kind")] public string Kind { get; set; } = "light";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("parentId")] public string? ParentId { get; set; }
    [JsonPropertyName("on")] public bool On { get; set; }
    [JsonPropertyName("brightness")] public double? Brightness { get; set; }
    [JsonPropertyName("color")] public RgbColor? Color { get; set; }
    [JsonPropertyName("temperatureK")] public int? TemperatureK { get; set; }
    [JsonPropertyName("temperatureRange")] public int[]? TemperatureRange { get; set; }
    [JsonPropertyName("reachable")] public bool Reachable { get; set; } = true;
    [JsonPropertyName("favorite")] public bool Favorite { get; set; }
    [JsonPropertyName("transport")] public string? Transport { get; set; }
    [JsonPropertyName("capabilities")] public CapabilitySet Capabilities { get; set; } = new();
    [JsonPropertyName("scenes")] public List<SceneRef> Scenes { get; set; } = new();
    [JsonIgnore] public string? NativeId { get; set; }
    [JsonIgnore] public string? NativeAux { get; set; }
}
public sealed class RgbColor {
    [JsonPropertyName("r")] public int R { get; set; }
    [JsonPropertyName("g")] public int G { get; set; }
    [JsonPropertyName("b")] public int B { get; set; }
    public RgbColor() {}
    public RgbColor(int r,int g,int b){R=r;G=g;B=b;}
}
public sealed class ProviderStatus {
    [JsonPropertyName("connected")] public bool Connected { get; set; }
    [JsonPropertyName("partial")] public bool Partial { get; set; }
    [JsonPropertyName("lan")] public bool Lan { get; set; }
    [JsonPropertyName("cloud")] public bool Cloud { get; set; }
    [JsonPropertyName("detail")] public string? Detail { get; set; }
}
public sealed class LightingSnapshot {
    [JsonPropertyName("type")] public string Type { get; set; } = "snapshot";
    [JsonPropertyName("protocol")] public int Protocol { get; set; } = 1;
    [JsonPropertyName("updatedAt")] public string UpdatedAt { get; set; } = DateTimeOffset.UtcNow.ToString("O");
    [JsonPropertyName("providers")] public Dictionary<string,ProviderStatus> Providers { get; set; } = new();
    [JsonPropertyName("targets")] public List<LightingTarget> Targets { get; set; } = new();
}
public static class JsonDefaults {
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) {
        WriteIndented=false,
        DefaultIgnoreCondition=JsonIgnoreCondition.WhenWritingNull
    };
}

using System.Text.Json.Serialization;

namespace PackRat.HWiNFOBridge;

public sealed record ProviderStatus(
    string Code,
    string Message,
    bool ProcessRunning,
    bool MappingPresent,
    bool SharedMemoryActive,
    int SensorCount,
    int ReadingCount,
    bool WasPreviouslyLive = false);

public sealed record SensorReadingDto(
    string Key,
    string Fingerprint,
    uint SensorId,
    uint SensorInstance,
    uint ReadingId,
    string SensorName,
    string SensorOriginalName,
    string Label,
    string OriginalLabel,
    string Unit,
    string Type,
    double? Value,
    double? Min,
    double? Max,
    double? Avg,
    bool Available,
    long SampleTime);

public sealed record SensorSnapshot(
    [property: JsonPropertyName("type")] string Type,
    int Protocol,
    string CompanionVersion,
    long PollTime,
    int PollingPeriodMs,
    ProviderStatus Status,
    IReadOnlyList<SensorReadingDto> Sensors);

public sealed record SourceReadResult(
    ProviderStatus Status,
    long PollTime,
    int PollingPeriodMs,
    IReadOnlyList<SensorReadingDto> Sensors);

public interface IHwinfoSource : IDisposable
{
    SourceReadResult Read();
}

using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using PackRat.AudioCore;

Console.InputEncoding = Encoding.UTF8;
Console.OutputEncoding = Encoding.UTF8;

var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);

if (args.Contains("--self-test", StringComparer.OrdinalIgnoreCase))
{
    var sample = new HelperResponse(
        "self-test",
        true,
        "SUCCESS",
        Array.Empty<OperationResult>(),
        null,
        null);
    Console.WriteLine(JsonSerializer.Serialize(sample, json));
    return 0;
}

if (!OperatingSystem.IsWindows())
{
    Console.Error.WriteLine("Audio Manager Pro helper requires Windows.");
    return 2;
}

var audio = new WindowsAudioSystem();
string? line;

while ((line = Console.ReadLine()) is not null)
{
    if (string.IsNullOrWhiteSpace(line)) continue;

    HelperResponse response;
    try
    {
        using var document = JsonDocument.Parse(line);
        response = Handle(document.RootElement, audio);
    }
    catch (Exception error)
    {
        response = new HelperResponse(
            "",
            false,
            "FAILED",
            Array.Empty<OperationResult>(),
            null,
            Sanitize(error));
    }

    Console.WriteLine(JsonSerializer.Serialize(response, json));
    Console.Out.Flush();
}

return 0;

static HelperResponse Handle(JsonElement root, WindowsAudioSystem audio)
{
    var id = OptionalString(root, "id");
    var command = RequiredString(root, "command");

    if (command == "snapshot")
    {
        var snapshot = audio.Read();
        return new HelperResponse(
            id,
            snapshot.Error is null,
            snapshot.Error is null ? "SUCCESS" : "FAILED",
            Array.Empty<OperationResult>(),
            snapshot,
            snapshot.Error);
    }

    if (command != "apply")
        throw new ArgumentException("Unknown helper command.");

    if (!root.TryGetProperty("operations", out var operations) ||
        operations.ValueKind != JsonValueKind.Array)
        throw new ArgumentException("Missing operations array.");

    var results = new List<OperationResult>();
    var index = 0;

    foreach (var operation in operations.EnumerateArray())
    {
        try
        {
            ExecuteOperation(operation, audio);
            results.Add(new OperationResult(index, true, null));
        }
        catch (Exception error)
        {
            results.Add(new OperationResult(index, false, Sanitize(error)));
        }

        index++;
    }

    var successCount = results.Count(result => result.Ok);
    var failureCount = results.Count - successCount;
    var status = successCount == 0 && results.Count > 0
        ? "FAILED"
        : failureCount > 0
            ? "PARTIAL"
            : "SUCCESS";

    if (results.Count == 0) status = "FAILED";

    var snapshotAfter = audio.Read();
    return new HelperResponse(
        id,
        status == "SUCCESS",
        status,
        results,
        snapshotAfter,
        results.Count == 0 ? "No operations were supplied." : null);
}

static void ExecuteOperation(JsonElement operation, WindowsAudioSystem audio)
{
    var kind = RequiredString(operation, "kind");
    var endpointId = RequiredString(operation, "endpointId");

    switch (kind)
    {
        case "set-default":
            audio.SetDefault(
                ParseFlow(RequiredString(operation, "flow")),
                ParseRole(RequiredString(operation, "role")),
                endpointId);
            return;

        case "set-volume":
            audio.SetEndpointVolume(endpointId, RequiredInt(operation, "value", 0, 100));
            return;

        case "set-mute":
            audio.SetEndpointMute(endpointId, RequiredBool(operation, "value"));
            return;

        default:
            throw new ArgumentException("Unknown audio operation.");
    }
}

static AudioFlowKind ParseFlow(string value) =>
    value.Equals("output", StringComparison.OrdinalIgnoreCase)
        ? AudioFlowKind.Output
        : value.Equals("input", StringComparison.OrdinalIgnoreCase)
            ? AudioFlowKind.Input
            : throw new ArgumentException("Invalid audio flow.");

static AudioDefaultRole ParseRole(string value) =>
    value.Equals("default", StringComparison.OrdinalIgnoreCase)
        ? AudioDefaultRole.Default
        : value.Equals("communications", StringComparison.OrdinalIgnoreCase)
            ? AudioDefaultRole.Communications
            : throw new ArgumentException("Invalid audio role.");

static string RequiredString(JsonElement root, string name)
{
    if (!root.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
        throw new ArgumentException($"Missing {name}.");

    var text = (value.GetString() ?? "").Trim();
    if (text.Length is 0 or > 4096)
        throw new ArgumentException($"Invalid {name}.");

    return text;
}

static string OptionalString(JsonElement root, string name)
{
    if (!root.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
        return "";

    var text = (value.GetString() ?? "").Trim();
    return text.Length > 4096 ? text[..4096] : text;
}

static int RequiredInt(JsonElement root, string name, int min, int max)
{
    if (!root.TryGetProperty(name, out var value) ||
        value.ValueKind != JsonValueKind.Number ||
        !value.TryGetInt32(out var result) ||
        result < min ||
        result > max)
        throw new ArgumentOutOfRangeException(name);

    return result;
}

static bool RequiredBool(JsonElement root, string name)
{
    if (!root.TryGetProperty(name, out var value) ||
        (value.ValueKind != JsonValueKind.True && value.ValueKind != JsonValueKind.False))
        throw new ArgumentException($"Invalid {name}.");

    return value.GetBoolean();
}

static string Sanitize(Exception error)
{
    var text = error is COMException com
        ? $"Windows audio error 0x{com.HResult:X8}"
        : error.Message;

    return text.Length > 220 ? text[..220] : text;
}

public sealed record OperationResult(int Index, bool Ok, string? Error);

public sealed record HelperResponse(
    string Id,
    bool Ok,
    string Status,
    IReadOnlyList<OperationResult> Results,
    AudioSystemSnapshot? Snapshot,
    string? Error);

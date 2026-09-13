using PackRat.AudioCore;

public sealed class CoreAudioBackend : IAudioBackend
{
    private readonly WindowsAudioSystem _audio = new();

    public AudioSnapshot Read()
    {
        var snapshot = _audio.Read();
        return new AudioSnapshot(
            1,
            new BridgeInfo(true, "1.0.0"),
            new AudioCapabilities(snapshot.DefaultDeviceSwitching, true, true),
            snapshot.DefaultOutputId,
            snapshot.DefaultInputId,
            snapshot.Outputs.Select(Map).ToArray(),
            snapshot.Inputs.Select(Map).ToArray(),
            snapshot.Error);
    }

    public void SetDefaultOutput(string id)
    {
        _audio.SetDefault(AudioFlowKind.Output, AudioDefaultRole.Default, id);
        _audio.SetDefault(AudioFlowKind.Output, AudioDefaultRole.Communications, id);
    }

    public void SetDefaultInput(string id)
    {
        _audio.SetDefault(AudioFlowKind.Input, AudioDefaultRole.Default, id);
        _audio.SetDefault(AudioFlowKind.Input, AudioDefaultRole.Communications, id);
    }

    public void SetOutputVolume(int value)
    {
        var id = RequireDefault(_audio.Read().DefaultOutputId, "output");
        _audio.SetEndpointVolume(id, value);
    }

    public void SetInputVolume(int value)
    {
        var id = RequireDefault(_audio.Read().DefaultInputId, "input");
        _audio.SetEndpointVolume(id, value);
    }

    public void SetOutputMute(bool value)
    {
        var id = RequireDefault(_audio.Read().DefaultOutputId, "output");
        _audio.SetEndpointMute(id, value);
    }

    public void SetInputMute(bool value)
    {
        var id = RequireDefault(_audio.Read().DefaultInputId, "input");
        _audio.SetEndpointMute(id, value);
    }

    private static AudioEndpoint Map(EndpointInfo endpoint) =>
        new(
            endpoint.Id,
            endpoint.Name,
            endpoint.Volume,
            endpoint.Muted,
            endpoint.VolumeAvailable,
            endpoint.MuteAvailable);

    private static string RequireDefault(string id, string kind) =>
        string.IsNullOrWhiteSpace(id)
            ? throw new InvalidOperationException($"No default {kind} endpoint.")
            : id;
}

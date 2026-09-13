using System.Runtime.InteropServices;

namespace PackRat.AudioCore;

public enum AudioFlowKind
{
    Output,
    Input
}

public enum AudioDefaultRole
{
    Default,
    Communications
}

public sealed record EndpointInfo(
    string Id,
    string Name,
    string InstanceId,
    string ContainerId,
    int? Volume,
    bool Muted,
    bool VolumeAvailable,
    bool MuteAvailable);

public sealed record AudioSystemSnapshot(
    bool DefaultDeviceSwitching,
    string DefaultOutputId,
    string CommunicationsOutputId,
    string DefaultInputId,
    string CommunicationsInputId,
    IReadOnlyList<EndpointInfo> Outputs,
    IReadOnlyList<EndpointInfo> Inputs,
    string? Error);

public sealed class WindowsAudioSystem
{
    private readonly object _gate = new();
    private bool _defaultSwitchingAvailable;

    public WindowsAudioSystem()
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("Windows Core Audio is required.");

        _defaultSwitchingAvailable = PolicyConfig.TryProbe();
    }

    public AudioSystemSnapshot Read()
    {
        lock (_gate)
        {
            try
            {
                using var core = new CoreAudioClient();
                return new AudioSystemSnapshot(
                    _defaultSwitchingAvailable,
                    core.GetDefaultId(AudioFlow.Render, AudioRole.Console),
                    core.GetDefaultId(AudioFlow.Render, AudioRole.Communications),
                    core.GetDefaultId(AudioFlow.Capture, AudioRole.Console),
                    core.GetDefaultId(AudioFlow.Capture, AudioRole.Communications),
                    core.List(AudioFlow.Render),
                    core.List(AudioFlow.Capture),
                    null);
            }
            catch (Exception error)
            {
                return new AudioSystemSnapshot(
                    _defaultSwitchingAvailable,
                    "",
                    "",
                    "",
                    "",
                    Array.Empty<EndpointInfo>(),
                    Array.Empty<EndpointInfo>(),
                    Sanitize(error));
            }
        }
    }

    public void SetDefault(AudioFlowKind flow, AudioDefaultRole role, string endpointId)
    {
        lock (_gate)
        {
            if (!_defaultSwitchingAvailable)
                throw new NotSupportedException("Default-device switching is unavailable.");

            var nativeFlow = flow == AudioFlowKind.Output ? AudioFlow.Render : AudioFlow.Capture;
            using var core = new CoreAudioClient();
            if (!core.List(nativeFlow).Any(endpoint => endpoint.Id == endpointId))
                throw new ArgumentException("Endpoint is no longer active.");

            var roles = role == AudioDefaultRole.Communications
                ? new[] { AudioRole.Communications }
                : new[] { AudioRole.Console, AudioRole.Multimedia };

            try
            {
                PolicyConfig.SetDefaultEndpoint(endpointId, roles);
            }
            catch
            {
                _defaultSwitchingAvailable = false;
                throw new NotSupportedException(
                    "Windows rejected default-device switching. Endpoint volume and mute remain available.");
            }
        }
    }

    public void SetEndpointVolume(string endpointId, int value)
    {
        lock (_gate)
        {
            using var core = new CoreAudioClient();
            using var control = core.GetVolumeControl(endpointId);
            control.SetVolume(value);
        }
    }

    public void SetEndpointMute(string endpointId, bool value)
    {
        lock (_gate)
        {
            using var core = new CoreAudioClient();
            using var control = core.GetVolumeControl(endpointId);
            control.SetMute(value);
        }
    }

    private static string Sanitize(Exception error) =>
        error is COMException com
            ? $"Windows audio error 0x{com.HResult:X8}"
            : error.Message;
}

internal sealed class CoreAudioClient : IDisposable
{
    private IMMDeviceEnumerator? _enumerator =
        (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();

    public IReadOnlyList<EndpointInfo> List(AudioFlow flow)
    {
        var endpoints = new List<EndpointInfo>();
        IMMDeviceCollection? collection = null;

        try
        {
            HResult(_enumerator!.EnumAudioEndpoints(flow, DeviceState.Active, out collection));
            HResult(collection.GetCount(out var count));

            for (uint index = 0; index < count; index++)
            {
                IMMDevice? device = null;
                try
                {
                    HResult(collection.Item(index, out device));
                    endpoints.Add(ReadEndpoint(device));
                }
                catch
                {
                    // Audio endpoints can disappear between enumeration and inspection.
                }
                finally
                {
                    Release(device);
                }
            }
        }
        finally
        {
            Release(collection);
        }

        return endpoints;
    }

    public string GetDefaultId(AudioFlow flow, AudioRole role)
    {
        IMMDevice? device = null;
        try
        {
            var hr = _enumerator!.GetDefaultAudioEndpoint(flow, role, out device);
            if (hr < 0 || device is null) return "";

            HResult(device.GetId(out var id));
            return id ?? "";
        }
        catch
        {
            return "";
        }
        finally
        {
            Release(device);
        }
    }

    public EndpointVolumeControl GetVolumeControl(string endpointId)
    {
        IMMDevice? device = null;
        HResult(_enumerator!.GetDevice(endpointId, out device));
        if (device is null)
            throw new InvalidOperationException("Audio endpoint is unavailable.");

        try
        {
            return EndpointVolumeControl.From(device);
        }
        finally
        {
            Release(device);
        }
    }

    private static EndpointInfo ReadEndpoint(IMMDevice device)
    {
        HResult(device.GetId(out var id));
        var name = ReadStringProperty(device, PropertyKeys.DeviceFriendlyName) ?? "Unnamed audio device";
        var instanceId = ReadStringProperty(device, PropertyKeys.DeviceInstanceId) ?? "";
        var containerId = ReadGuidProperty(device, PropertyKeys.DeviceContainerId)?.ToString("D") ?? "";

        try
        {
            using var control = EndpointVolumeControl.From(device);
            return new EndpointInfo(
                id ?? "",
                name,
                instanceId,
                containerId,
                control.GetVolume(),
                control.GetMute(),
                true,
                true);
        }
        catch
        {
            return new EndpointInfo(
                id ?? "",
                name,
                instanceId,
                containerId,
                null,
                false,
                false,
                false);
        }
    }

    private static string? ReadStringProperty(IMMDevice device, PropertyKey key)
    {
        IPropertyStore? store = null;
        PropVariant value = default;
        try
        {
            HResult(device.OpenPropertyStore(StorageMode.Read, out store));
            HResult(store.GetValue(ref key, out value));
            return value.GetString();
        }
        catch
        {
            return null;
        }
        finally
        {
            value.Clear();
            Release(store);
        }
    }

    private static Guid? ReadGuidProperty(IMMDevice device, PropertyKey key)
    {
        IPropertyStore? store = null;
        PropVariant value = default;
        try
        {
            HResult(device.OpenPropertyStore(StorageMode.Read, out store));
            HResult(store.GetValue(ref key, out value));
            return value.GetGuid();
        }
        catch
        {
            return null;
        }
        finally
        {
            value.Clear();
            Release(store);
        }
    }

    public void Dispose()
    {
        Release(_enumerator);
        _enumerator = null;
    }

    internal static void HResult(int hr)
    {
        if (hr < 0) Marshal.ThrowExceptionForHR(hr);
    }

    internal static void Release(object? value)
    {
        if (value is null || !Marshal.IsComObject(value)) return;
        try { Marshal.FinalReleaseComObject(value); }
        catch { }
    }
}

internal sealed class EndpointVolumeControl : IDisposable
{
    private IAudioEndpointVolume? _volume;

    private EndpointVolumeControl(IAudioEndpointVolume volume) => _volume = volume;

    public static EndpointVolumeControl From(IMMDevice device)
    {
        var interfaceId = typeof(IAudioEndpointVolume).GUID;
        CoreAudioClient.HResult(device.Activate(
            ref interfaceId,
            ClsCtx.All,
            IntPtr.Zero,
            out var raw));

        return new EndpointVolumeControl((IAudioEndpointVolume)raw);
    }

    public int GetVolume()
    {
        CoreAudioClient.HResult(_volume!.GetMasterVolumeLevelScalar(out var value));
        return Math.Clamp((int)Math.Round(value * 100), 0, 100);
    }

    public bool GetMute()
    {
        CoreAudioClient.HResult(_volume!.GetMute(out var muted));
        return muted;
    }

    public void SetVolume(int value)
    {
        CoreAudioClient.HResult(_volume!.SetMasterVolumeLevelScalar(
            Math.Clamp(value, 0, 100) / 100f,
            Guid.Empty));
    }

    public void SetMute(bool value)
    {
        CoreAudioClient.HResult(_volume!.SetMute(value, Guid.Empty));
    }

    public void Dispose()
    {
        CoreAudioClient.Release(_volume);
        _volume = null;
    }
}

internal static class PolicyConfig
{
    public static bool TryProbe()
    {
        object? instance = null;
        try
        {
            instance = new PolicyConfigComObject();
            return instance is IPolicyConfig;
        }
        catch
        {
            return false;
        }
        finally
        {
            CoreAudioClient.Release(instance);
        }
    }

    public static void SetDefaultEndpoint(string id, IEnumerable<AudioRole> roles)
    {
        object? instance = null;
        try
        {
            instance = new PolicyConfigComObject();
            var policy = (IPolicyConfig)instance;
            foreach (var role in roles)
                CoreAudioClient.HResult(policy.SetDefaultEndpoint(id, role));
        }
        finally
        {
            CoreAudioClient.Release(instance);
        }
    }
}

internal static class PropertyKeys
{
    public static PropertyKey DeviceFriendlyName =
        new(new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"), 14);

    public static PropertyKey DeviceInstanceId =
        new(new Guid("78C34FC8-104A-4ACA-9EA4-524D52996E57"), 256);

    public static PropertyKey DeviceContainerId =
        new(new Guid("8C7ED206-3F8A-4827-B3AB-AE9E1FAEFC6C"), 2);
}

internal enum AudioFlow
{
    Render = 0,
    Capture = 1,
    All = 2
}

internal enum AudioRole
{
    Console = 0,
    Multimedia = 1,
    Communications = 2
}

[Flags]
internal enum DeviceState : uint
{
    Active = 0x00000001
}

internal enum StorageMode
{
    Read = 0
}

[Flags]
internal enum ClsCtx : uint
{
    InprocServer = 0x1,
    InprocHandler = 0x2,
    LocalServer = 0x4,
    RemoteServer = 0x10,
    All = InprocServer | InprocHandler | LocalServer | RemoteServer
}

[ComImport]
[Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
internal class MMDeviceEnumeratorComObject
{
}

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
internal interface IMMDeviceEnumerator
{
    [PreserveSig] int EnumAudioEndpoints(AudioFlow dataFlow, DeviceState stateMask, out IMMDeviceCollection devices);
    [PreserveSig] int GetDefaultAudioEndpoint(AudioFlow dataFlow, AudioRole role, out IMMDevice endpoint);
    [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
    [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr callback);
    [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr callback);
}

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E")]
internal interface IMMDeviceCollection
{
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int Item(uint index, out IMMDevice device);
}

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("D666063F-1587-4E43-81F1-B948E807363F")]
internal interface IMMDevice
{
    [PreserveSig] int Activate(ref Guid interfaceId, ClsCtx clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object instance);
    [PreserveSig] int OpenPropertyStore(StorageMode access, out IPropertyStore properties);
    [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    [PreserveSig] int GetState(out DeviceState state);
}

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
internal interface IPropertyStore
{
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int GetAt(uint index, out PropertyKey key);
    [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant value);
    [PreserveSig] int SetValue(ref PropertyKey key, ref PropVariant value);
    [PreserveSig] int Commit();
}

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
internal interface IAudioEndpointVolume
{
    [PreserveSig] int RegisterControlChangeNotify(IntPtr notify);
    [PreserveSig] int UnregisterControlChangeNotify(IntPtr notify);
    [PreserveSig] int GetChannelCount(out uint count);
    [PreserveSig] int SetMasterVolumeLevel(float levelDb, Guid eventContext);
    [PreserveSig] int SetMasterVolumeLevelScalar(float level, Guid eventContext);
    [PreserveSig] int GetMasterVolumeLevel(out float levelDb);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
    [PreserveSig] int SetChannelVolumeLevel(uint channel, float levelDb, Guid eventContext);
    [PreserveSig] int SetChannelVolumeLevelScalar(uint channel, float level, Guid eventContext);
    [PreserveSig] int GetChannelVolumeLevel(uint channel, out float levelDb);
    [PreserveSig] int GetChannelVolumeLevelScalar(uint channel, out float level);
    [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, Guid eventContext);
    [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool muted);
    [PreserveSig] int GetVolumeStepInfo(out uint step, out uint stepCount);
    [PreserveSig] int VolumeStepUp(Guid eventContext);
    [PreserveSig] int VolumeStepDown(Guid eventContext);
    [PreserveSig] int QueryHardwareSupport(out uint mask);
    [PreserveSig] int GetVolumeRange(out float minDb, out float maxDb, out float incrementDb);
}

[ComImport]
[Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
internal class PolicyConfigComObject
{
}

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("F8679F50-850A-41CF-9C72-430F290290C8")]
internal interface IPolicyConfig
{
    [PreserveSig] int GetMixFormat(string deviceName, IntPtr format);
    [PreserveSig] int GetDeviceFormat(string deviceName, bool @default, IntPtr format);
    [PreserveSig] int ResetDeviceFormat(string deviceName);
    [PreserveSig] int SetDeviceFormat(string deviceName, IntPtr endpointFormat, IntPtr mixFormat);
    [PreserveSig] int GetProcessingPeriod(string deviceName, bool @default, IntPtr period, IntPtr minPeriod);
    [PreserveSig] int SetProcessingPeriod(string deviceName, IntPtr period);
    [PreserveSig] int GetShareMode(string deviceName, IntPtr mode);
    [PreserveSig] int SetShareMode(string deviceName, IntPtr mode);
    [PreserveSig] int GetPropertyValue(string deviceName, IntPtr key, IntPtr value);
    [PreserveSig] int SetPropertyValue(string deviceName, IntPtr key, IntPtr value);
    [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string deviceId, AudioRole role);
    [PreserveSig] int SetEndpointVisibility(string deviceName, bool visible);
}

[StructLayout(LayoutKind.Sequential)]
internal struct PropertyKey
{
    public Guid FormatId;
    public uint PropertyId;

    public PropertyKey(Guid formatId, uint propertyId)
    {
        FormatId = formatId;
        PropertyId = propertyId;
    }
}

[StructLayout(LayoutKind.Explicit, Size = 24)]
internal struct PropVariant
{
    [FieldOffset(0)] private ushort _variantType;
    [FieldOffset(8)] private IntPtr _pointer;

    public string? GetString() =>
        _variantType == 31 && _pointer != IntPtr.Zero
            ? Marshal.PtrToStringUni(_pointer)
            : null;

    public Guid? GetGuid() =>
        _variantType == 72 && _pointer != IntPtr.Zero
            ? Marshal.PtrToStructure<Guid>(_pointer)
            : null;

    public void Clear()
    {
        try { PropVariantClear(ref this); }
        catch { }
    }

    [DllImport("ole32.dll")]
    private static extern int PropVariantClear(ref PropVariant value);
}

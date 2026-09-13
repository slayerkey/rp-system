using System.Runtime.InteropServices;
using System.Text.Json;
using Windows.Devices.Bluetooth;
using Windows.Devices.Enumeration;
using Windows.Devices.Radios;

internal static class Program
{
    private const string ConnectedKey = "System.Devices.Aep.IsConnected";
    private const string PresentKey = "System.Devices.Aep.IsPresent";
    private const string PairedKey = "System.Devices.Aep.IsPaired";
    private const string AddressKey = "System.Devices.Aep.DeviceAddress";
    private const string ContainerKey = "System.Devices.Aep.ContainerId";
    private const string BatteryKey = "System.Devices.BatteryLife";
    private const string BatteryChargingKey = "System.Devices.BatteryPlusCharging";

    private static readonly string[] RequestedProperties =
    [
        ConnectedKey, PresentKey, PairedKey, AddressKey, ContainerKey, BatteryKey, BatteryChargingKey
    ];

    private static readonly Guid AudioSink = new("0000110B-0000-1000-8000-00805F9B34FB");
    private static readonly Guid HandsFree = new("0000111E-0000-1000-8000-00805F9B34FB");

    public static async Task<int> Main(string[] args)
    {
        try
        {
            if (args.Length > 0 && args[0].Equals("server", StringComparison.OrdinalIgnoreCase))
            {
                await RunServerAsync();
                return 0;
            }

            if (args.Length == 0 || args[0].Equals("snapshot", StringComparison.OrdinalIgnoreCase))
            {
                var result = await SnapshotAsync();
                Console.WriteLine(JsonSerializer.Serialize(result, JsonOptions));
                return result.ok ? 0 : 2;
            }

            if (args.Length >= 4 && args[0].Equals("control", StringComparison.OrdinalIgnoreCase))
            {
                var op = args[1].ToLowerInvariant();
                var idIndex = Array.FindIndex(args, x => x == "--id");
                if (idIndex < 0 || idIndex + 1 >= args.Length) return Fail("Missing --id.");
                var result = await ControlAsync(args[idIndex + 1], op);
                Console.WriteLine(JsonSerializer.Serialize(result, JsonOptions));
                return result.ok ? 0 : 3;
            }

            return Fail("Unknown command.");
        }
        catch (Exception ex)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { ok = false, error = ex.Message }, JsonOptions));
            return 1;
        }
    }

    private static async Task RunServerAsync()
    {
        while (await Console.In.ReadLineAsync() is { } line)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            string? id = null;
            try
            {
                using var request = JsonDocument.Parse(line);
                var root = request.RootElement;
                id = root.TryGetProperty("id", out var idElement) ? idElement.GetString() : null;
                var command = root.TryGetProperty("command", out var commandElement)
                    ? commandElement.GetString()
                    : null;

                object result;
                if (command == "snapshot")
                {
                    result = await SnapshotAsync();
                }
                else if (command == "control")
                {
                    var operation = root.TryGetProperty("operation", out var operationElement)
                        ? operationElement.GetString()
                        : null;
                    var deviceId = root.TryGetProperty("deviceId", out var deviceElement)
                        ? deviceElement.GetString()
                        : null;

                    result = operation is "connect" or "disconnect" && !string.IsNullOrWhiteSpace(deviceId)
                        ? await ControlAsync(deviceId, operation)
                        : new { ok = false, error = "Invalid control request." };
                }
                else
                {
                    result = new { ok = false, error = "Unknown bridge command." };
                }

                WriteServerResponse(id, result);
            }
            catch (Exception ex)
            {
                WriteServerResponse(id, new { ok = false, error = ex.Message });
            }
        }
    }

    private static void WriteServerResponse(string? id, object result)
    {
        var resultElement = JsonSerializer.SerializeToElement(result, JsonOptions);
        Console.Out.WriteLine(JsonSerializer.Serialize(new { id, result = resultElement }, JsonOptions));
        Console.Out.Flush();
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private static int Fail(string message)
    {
        Console.WriteLine(JsonSerializer.Serialize(new { ok = false, error = message }, JsonOptions));
        return 1;
    }

    private static async Task<dynamic> SnapshotAsync()
    {
        var adapter = await BluetoothAdapter.GetDefaultAsync();
        if (adapter is null)
            return new { ok = true, adapterAvailable = false, devices = Array.Empty<object>(), error = (string?)null };

        var radio = await adapter.GetRadioAsync();
        if (radio is null || radio.State != RadioState.On)
            return new { ok = true, adapterAvailable = false, devices = Array.Empty<object>(), error = (string?)null };

        var output = new Dictionary<string, DeviceDto>(StringComparer.OrdinalIgnoreCase);
        await AddDevicesAsync(output, BluetoothLEDevice.GetDeviceSelectorFromPairingState(true), "ble", false);
        await AddDevicesAsync(output, BluetoothDevice.GetDeviceSelectorFromPairingState(true), "classic", true);

        return new
        {
            ok = true,
            adapterAvailable = true,
            devices = output.Values.OrderByDescending(x => x.connected).ThenBy(x => x.name).ToArray(),
            error = (string?)null
        };
    }

    private static async Task AddDevicesAsync(
        Dictionary<string, DeviceDto> output,
        string selector,
        string kind,
        bool classic)
    {
        var devices = await DeviceInformation.FindAllAsync(
            selector,
            RequestedProperties,
            DeviceInformationKind.AssociationEndpoint);

        foreach (var info in devices)
        {
            var address = StringProp(info, AddressKey);
            bool audioClass = false;
            bool installedAudioService = false;
            if (classic && !string.IsNullOrWhiteSpace(address))
            {
                var normalizedAddress = NormalizeAddress(address);
                if (ulong.TryParse(normalizedAddress, System.Globalization.NumberStyles.HexNumber, null, out var numericAddress)
                    && NativeBluetooth.TryGetClassOfDevice(numericAddress, out var classOfDevice))
                {
                    // Bluetooth Class of Device major class occupies bits 8-12; Audio/Video is value 4.
                    audioClass = ((classOfDevice >> 8) & 0x1F) == 4;
                    if (audioClass)
                        installedAudioService = NativeBluetooth.SupportsAnyService(numericAddress, AudioSink, HandsFree);
                }
            }

            var battery = ByteProp(info, BatteryKey);
            var plusCharging = ByteProp(info, BatteryChargingKey);
            bool? charging = null;
            if (plusCharging is >= 0 and <= 200)
            {
                charging = plusCharging >= 101;
                if (battery is null)
                    battery = charging == true ? plusCharging - 100 : plusCharging;
            }
            if (battery is > 100) battery = null;

            var key = !string.IsNullOrWhiteSpace(address)
                ? "bt:" + NormalizeAddress(address)
                : "id:" + info.Id.ToLowerInvariant();

            var connected = BoolProp(info, ConnectedKey) ?? false;
            var present = BoolProp(info, PresentKey);
            var next = new DeviceDto
            {
                id = address is not null ? NormalizeAddress(address) : info.Id,
                nativeId = info.Id,
                name = string.IsNullOrWhiteSpace(info.Name) ? "Bluetooth device" : info.Name,
                address = address is null ? null : NormalizeAddress(address),
                containerId = StringProp(info, ContainerKey),
                kind = kind,
                paired = BoolProp(info, PairedKey) ?? info.Pairing.IsPaired,
                connected = connected,
                present = present,
                batteryPercent = battery,
                charging = charging,
                control = new ControlDto
                {
                    // A disconnected audio endpoint may no longer enumerate an enabled service,
                    // so CONNECT uses the classic Audio/Video class but only while Windows
                    // positively reports the paired device as present. DISCONNECT requires an
                    // enabled service plus a live connected state.
                    connect = audioClass && present == true,
                    disconnect = audioClass && connected && installedAudioService
                }
            };

            if (output.TryGetValue(key, out var previous))
                output[key] = Merge(previous, next);
            else
                output[key] = next;
        }
    }

    private static DeviceDto Merge(DeviceDto a, DeviceDto b) => new()
    {
        id = !string.IsNullOrWhiteSpace(b.id) ? b.id : a.id,
        nativeId = b.nativeId ?? a.nativeId,
        name = b.name != "Bluetooth device" ? b.name : a.name,
        address = b.address ?? a.address,
        containerId = b.containerId ?? a.containerId,
        kind = a.kind == b.kind ? a.kind : "dual",
        paired = a.paired || b.paired,
        connected = a.connected || b.connected,
        present = (a.present ?? false) || (b.present ?? false),
        batteryPercent = b.batteryPercent ?? a.batteryPercent,
        charging = b.charging ?? a.charging,
        control = new ControlDto
        {
            connect = a.control.connect || b.control.connect,
            disconnect = a.control.disconnect || b.control.disconnect
        }
    };

    private static async Task<dynamic> ControlAsync(string addressText, string operation)
    {
        var normalized = NormalizeAddress(addressText);
        if (!ulong.TryParse(normalized, System.Globalization.NumberStyles.HexNumber, null, out var address))
            return new { ok = false, error = "This device has no controllable Bluetooth address." };

        var enable = operation == "connect";
        if (!enable && operation != "disconnect")
            return new { ok = false, error = "Operation must be connect or disconnect." };

        var found = NativeBluetooth.FindDevice(address, out var radio, out var device);
        if (!found || radio == IntPtr.Zero)
            return new { ok = false, error = "Paired Bluetooth device was not found on an active adapter." };

        try
        {
            var hfp = NativeBluetooth.TransitionService(radio, ref device, HandsFree, enable);
            var sink = NativeBluetooth.TransitionService(radio, ref device, AudioSink, enable);

            var allExposedSucceeded = hfp.IsAcceptable && sink.IsAcceptable;
            var atLeastOneProfileExists = hfp.Exists || sink.Exists;
            if (!allExposedSucceeded || !atLeastOneProfileExists)
            {
                return new
                {
                    ok = false,
                    error = $"Windows rejected the Bluetooth audio service change (A2DP: {sink.Status}, HFP: {hfp.Status})."
                };
            }

            if (enable)
            {
                // Service enablement can return before the device-wide Bluetooth
                // connection flag catches up. Give Windows a short bounded window
                // to confirm the paired device actually became connected.
                var deadline = DateTime.UtcNow.AddSeconds(8);
                do
                {
                    if (NativeBluetooth.IsConnected(address))
                        return new { ok = true, error = (string?)null };
                    await Task.Delay(250);
                } while (DateTime.UtcNow < deadline);

                return new
                {
                    ok = false,
                    error = "Bluetooth audio services were enabled, but Windows did not confirm a live device connection."
                };
            }

            // Disconnect success is defined by the audio profiles reaching their
            // disabled state. Other Bluetooth profiles (for example HID) may keep
            // a multi-function device connected at the device-wide level.
            return new { ok = true, error = (string?)null };
        }
        finally
        {
            NativeBluetooth.CloseRadio(radio);
        }
    }

    private static string NormalizeAddress(string value) =>
        new(value.Where(Uri.IsHexDigit).ToArray()).ToUpperInvariant();

    private static bool? BoolProp(DeviceInformation info, string key) =>
        info.Properties.TryGetValue(key, out var value) && value is bool b ? b : null;

    private static string? StringProp(DeviceInformation info, string key)
    {
        if (!info.Properties.TryGetValue(key, out var value) || value is null) return null;
        return value.ToString();
    }

    private static int? ByteProp(DeviceInformation info, string key)
    {
        if (!info.Properties.TryGetValue(key, out var value) || value is null) return null;
        try { return Convert.ToInt32(value); } catch { return null; }
    }

    private sealed class DeviceDto
    {
        public string id { get; set; } = "";
        public string? nativeId { get; set; }
        public string name { get; set; } = "";
        public string? address { get; set; }
        public string? containerId { get; set; }
        public string? kind { get; set; }
        public bool paired { get; set; }
        public bool connected { get; set; }
        public bool? present { get; set; }
        public int? batteryPercent { get; set; }
        public bool? charging { get; set; }
        public ControlDto control { get; set; } = new();
    }

    private sealed class ControlDto
    {
        public bool connect { get; set; }
        public bool disconnect { get; set; }
    }
}

internal static class NativeBluetooth
{
    public const uint BLUETOOTH_SERVICE_DISABLE = 0x00;
    public const uint BLUETOOTH_SERVICE_ENABLE = 0x01;

    [StructLayout(LayoutKind.Sequential)]
    private struct BLUETOOTH_FIND_RADIO_PARAMS
    {
        public uint dwSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BLUETOOTH_DEVICE_SEARCH_PARAMS
    {
        public uint dwSize;
        [MarshalAs(UnmanagedType.Bool)] public bool fReturnAuthenticated;
        [MarshalAs(UnmanagedType.Bool)] public bool fReturnRemembered;
        [MarshalAs(UnmanagedType.Bool)] public bool fReturnUnknown;
        [MarshalAs(UnmanagedType.Bool)] public bool fReturnConnected;
        [MarshalAs(UnmanagedType.Bool)] public bool fIssueInquiry;
        public byte cTimeoutMultiplier;
        public IntPtr hRadio;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct BLUETOOTH_DEVICE_INFO
    {
        public uint dwSize;
        public ulong Address;
        public uint ulClassofDevice;
        [MarshalAs(UnmanagedType.Bool)] public bool fConnected;
        [MarshalAs(UnmanagedType.Bool)] public bool fRemembered;
        [MarshalAs(UnmanagedType.Bool)] public bool fAuthenticated;
        public SYSTEMTIME stLastSeen;
        public SYSTEMTIME stLastUsed;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 248)] public string szName;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct SYSTEMTIME
    {
        public ushort wYear, wMonth, wDayOfWeek, wDay, wHour, wMinute, wSecond, wMilliseconds;
    }

    [DllImport("bthprops.cpl", SetLastError = true)]
    private static extern IntPtr BluetoothFindFirstRadio(ref BLUETOOTH_FIND_RADIO_PARAMS pbtfrp, out IntPtr phRadio);

    [DllImport("bthprops.cpl", SetLastError = true)]
    private static extern bool BluetoothFindNextRadio(IntPtr hFind, out IntPtr phRadio);

    [DllImport("bthprops.cpl")]
    private static extern bool BluetoothFindRadioClose(IntPtr hFind);

    [DllImport("bthprops.cpl", SetLastError = true)]
    private static extern IntPtr BluetoothFindFirstDevice(ref BLUETOOTH_DEVICE_SEARCH_PARAMS pbtsp, ref BLUETOOTH_DEVICE_INFO pbtdi);

    [DllImport("bthprops.cpl", SetLastError = true)]
    private static extern bool BluetoothFindNextDevice(IntPtr hFind, ref BLUETOOTH_DEVICE_INFO pbtdi);

    [DllImport("bthprops.cpl")]
    private static extern bool BluetoothFindDeviceClose(IntPtr hFind);

    [DllImport("bthprops.cpl", SetLastError = true)]
    private static extern uint BluetoothEnumerateInstalledServices(
        IntPtr hRadio,
        ref BLUETOOTH_DEVICE_INFO pbtdi,
        ref uint pcServiceInout,
        [Out] Guid[] pGuidServices);

    [DllImport("bthprops.cpl", SetLastError = true)]
    public static extern uint BluetoothSetServiceState(
        IntPtr hRadio,
        ref BLUETOOTH_DEVICE_INFO pbtdi,
        ref Guid pGuidService,
        uint dwServiceFlags);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    public readonly record struct ServiceTransition(string Status, bool Exists, bool IsAcceptable);

    private const uint ERROR_SUCCESS = 0;
    private const uint ERROR_INVALID_PARAMETER = 87;
    private const uint ERROR_SERVICE_DOES_NOT_EXIST = 1060;
    private const uint E_INVALIDARG = 0x80070057;

    private static bool IsAlreadyInState(uint code) =>
        code == ERROR_INVALID_PARAMETER || code == E_INVALIDARG;

    public static ServiceTransition TransitionService(
        IntPtr radio,
        ref BLUETOOTH_DEVICE_INFO device,
        Guid service,
        bool enable)
    {
        var desired = enable ? BLUETOOTH_SERVICE_ENABLE : BLUETOOTH_SERVICE_DISABLE;
        var guid = service;
        var result = BluetoothSetServiceState(radio, ref device, ref guid, desired);

        if (result == ERROR_SUCCESS)
            return new ServiceTransition("ok", true, true);
        if (result == ERROR_SERVICE_DOES_NOT_EXIST)
            return new ServiceTransition("absent", false, true);

        if (IsAlreadyInState(result))
        {
            if (!enable)
            {
                // Windows reports E_INVALIDARG when a service is already disabled.
                return new ServiceTransition("ok", true, true);
            }

            // A service can be enabled in Windows while the remote audio device is
            // no longer connected. Cycle the profile once to force a reconnect.
            guid = service;
            var disable = BluetoothSetServiceState(
                radio,
                ref device,
                ref guid,
                BLUETOOTH_SERVICE_DISABLE);

            if (disable != ERROR_SUCCESS && !IsAlreadyInState(disable))
            {
                if (disable == ERROR_SERVICE_DOES_NOT_EXIST)
                    return new ServiceTransition("absent", false, true);
                return new ServiceTransition($"fail:{disable}", true, false);
            }

            Thread.Sleep(150);
            guid = service;
            for (var attempt = 0; attempt < 3; attempt++)
            {
                var reenable = BluetoothSetServiceState(
                    radio,
                    ref device,
                    ref guid,
                    BLUETOOTH_SERVICE_ENABLE);
                if (reenable == ERROR_SUCCESS || IsAlreadyInState(reenable))
                    return new ServiceTransition("ok", true, true);
                if (reenable == ERROR_SERVICE_DOES_NOT_EXIST)
                    return new ServiceTransition("absent", false, true);
                Thread.Sleep(150);
                guid = service;
            }
        }

        return new ServiceTransition($"fail:{result}", true, false);
    }

    public static bool IsConnected(ulong address)
    {
        if (!FindDevice(address, out var radio, out var device)) return false;
        try
        {
            return device.fConnected;
        }
        finally
        {
            CloseRadio(radio);
        }
    }

    public static bool FindDevice(ulong address, out IntPtr matchingRadio, out BLUETOOTH_DEVICE_INFO matchingDevice)
    {
        matchingRadio = IntPtr.Zero;
        matchingDevice = NewDeviceInfo();
        var radioParams = new BLUETOOTH_FIND_RADIO_PARAMS { dwSize = (uint)Marshal.SizeOf<BLUETOOTH_FIND_RADIO_PARAMS>() };
        var radioFind = BluetoothFindFirstRadio(ref radioParams, out var radio);
        if (radioFind == IntPtr.Zero) return false;

        try
        {
            do
            {
                var search = new BLUETOOTH_DEVICE_SEARCH_PARAMS
                {
                    dwSize = (uint)Marshal.SizeOf<BLUETOOTH_DEVICE_SEARCH_PARAMS>(),
                    fReturnAuthenticated = true,
                    fReturnRemembered = true,
                    fReturnConnected = true,
                    fReturnUnknown = false,
                    fIssueInquiry = false,
                    cTimeoutMultiplier = 0,
                    hRadio = radio
                };
                var info = NewDeviceInfo();
                var find = BluetoothFindFirstDevice(ref search, ref info);
                if (find != IntPtr.Zero)
                {
                    try
                    {
                        do
                        {
                            if (info.Address == address)
                            {
                                matchingRadio = radio;
                                matchingDevice = info;
                                return true;
                            }
                            info = NewDeviceInfo();
                        } while (BluetoothFindNextDevice(find, ref info));
                    }
                    finally { BluetoothFindDeviceClose(find); }
                }
                CloseHandle(radio);
                radio = IntPtr.Zero;
            } while (BluetoothFindNextRadio(radioFind, out radio));
        }
        finally
        {
            BluetoothFindRadioClose(radioFind);
            if (radio != IntPtr.Zero && radio != matchingRadio) CloseHandle(radio);
        }
        return false;
    }

    public static void CloseRadio(IntPtr radio)
    {
        if (radio != IntPtr.Zero) CloseHandle(radio);
    }

    public static bool SupportsAnyService(ulong address, params Guid[] wanted)
    {
        if (!FindDevice(address, out var radio, out var device)) return false;
        try
        {
            uint count = 32;
            var services = new Guid[count];
            var result = BluetoothEnumerateInstalledServices(radio, ref device, ref count, services);
            if (result == 234) // ERROR_MORE_DATA
            {
                services = new Guid[count];
                result = BluetoothEnumerateInstalledServices(radio, ref device, ref count, services);
            }
            if (result != 0) return false;

            var actual = services.Take((int)Math.Min(count, (uint)services.Length));
            return wanted.Any(target => actual.Contains(target));
        }
        finally
        {
            CloseRadio(radio);
        }
    }

    public static bool TryGetClassOfDevice(ulong address, out uint classOfDevice)
    {
        classOfDevice = 0;
        if (!FindDevice(address, out var radio, out var device)) return false;
        try
        {
            classOfDevice = device.ulClassofDevice;
            return true;
        }
        finally
        {
            CloseRadio(radio);
        }
    }

    private static BLUETOOTH_DEVICE_INFO NewDeviceInfo() => new()
    {
        dwSize = (uint)Marshal.SizeOf<BLUETOOTH_DEVICE_INFO>(),
        szName = string.Empty
    };
}

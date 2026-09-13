using System.Runtime.InteropServices;
using System.Text.Json;
using Windows.Devices.Bluetooth;
using Windows.Devices.Enumeration;

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
                var result = Control(args[idIndex + 1], op);
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
            ulong? numericAddress = null;
            bool audioControl = false;

            if (classic)
            {
                try
                {
                    using var bt = await BluetoothDevice.FromIdAsync(info.Id);
                    if (bt is not null)
                    {
                        numericAddress = bt.BluetoothAddress;
                        address ??= bt.BluetoothAddress.ToString("X12");
                        audioControl = bt.ClassOfDevice?.MajorClass == BluetoothMajorClass.AudioVideo;
                    }
                }
                catch { }
            }
            else
            {
                try
                {
                    using var ble = await BluetoothLEDevice.FromIdAsync(info.Id);
                    if (ble is not null)
                    {
                        numericAddress = ble.BluetoothAddress;
                        address ??= ble.BluetoothAddress.ToString("X12");
                    }
                }
                catch { }
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

            var next = new DeviceDto
            {
                id = address is not null ? NormalizeAddress(address) : info.Id,
                nativeId = info.Id,
                name = string.IsNullOrWhiteSpace(info.Name) ? "Bluetooth device" : info.Name,
                address = address is null ? null : NormalizeAddress(address),
                containerId = StringProp(info, ContainerKey),
                kind = kind,
                paired = BoolProp(info, PairedKey) ?? info.Pairing.IsPaired,
                connected = BoolProp(info, ConnectedKey) ?? false,
                present = BoolProp(info, PresentKey),
                batteryPercent = battery,
                charging = charging,
                control = new ControlDto { connect = audioControl, disconnect = audioControl }
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

    private static object Control(string addressText, string operation)
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
            var flag = enable ? NativeBluetooth.BLUETOOTH_SERVICE_ENABLE : NativeBluetooth.BLUETOOTH_SERVICE_DISABLE;
            var sink = AudioSink;
            var handsFree = HandsFree;
            var sinkResult = NativeBluetooth.BluetoothSetServiceState(radio, ref device, ref sink, flag);
            var hfpResult = NativeBluetooth.BluetoothSetServiceState(radio, ref device, ref handsFree, flag);
            var ok = sinkResult == 0 || hfpResult == 0;
            return ok
                ? new { ok = true, error = (string?)null }
                : new { ok = false, error = $"Windows rejected the Bluetooth audio service change ({sinkResult}/{hfpResult})." };
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
    public static extern uint BluetoothSetServiceState(
        IntPtr hRadio,
        ref BLUETOOTH_DEVICE_INFO pbtdi,
        ref Guid pGuidService,
        uint dwServiceFlags);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

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

    private static BLUETOOTH_DEVICE_INFO NewDeviceInfo() => new()
    {
        dwSize = (uint)Marshal.SizeOf<BLUETOOTH_DEVICE_INFO>(),
        szName = string.Empty
    };
}

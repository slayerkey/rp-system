using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace PackRat.HWiNFOBridge;

public sealed class HWiNFOSharedMemorySource : IHwinfoSource
{
    public const string MappingName = @"Global\HWiNFO_SENS_SM2";
    public const string MutexName = @"Global\HWiNFO_SM2_MUTEX";
    public const uint ActiveSignature = 0x53695748;
    private bool _wasLive;

    public SourceReadResult Read()
    {
        var processRunning = IsHWiNFORunning();
        var mapping = Native.OpenFileMappingW(Native.FILE_MAP_READ, false, MappingName);
        if (mapping == IntPtr.Zero)
        {
            var err = Marshal.GetLastWin32Error();
            var code = err == 5 ? "access_denied"
                : !processRunning ? "hwinfo_not_running"
                : _wasLive ? "shared_memory_lost"
                : "shared_memory_unavailable";
            return Empty(code, processRunning, false, false, _wasLive, err == 5
                ? "Windows denied access to HWiNFO Shared Memory."
                : code == "hwinfo_not_running"
                    ? "HWiNFO is not running."
                    : code == "shared_memory_lost"
                        ? "HWiNFO Shared Memory was available and then became unavailable."
                        : "HWiNFO is running but Shared Memory is not available. Enable Sensors and Shared Memory Support.");
        }

        try
        {
            var view = Native.MapViewOfFile(mapping, Native.FILE_MAP_READ, 0, 0, UIntPtr.Zero);
            if (view == IntPtr.Zero)
            {
                var err = Marshal.GetLastWin32Error();
                return Empty(err == 5 ? "access_denied" : "malformed", processRunning, true, false, _wasLive,
                    err == 5 ? "Windows denied access to the HWiNFO Shared Memory view." : "Could not map HWiNFO Shared Memory.");
            }

            try
            {
                var mutex = Native.OpenMutexW(Native.SYNCHRONIZE | Native.MUTEX_MODIFY_STATE, false, MutexName);
                if (mutex == IntPtr.Zero)
                {
                    var err = Marshal.GetLastWin32Error();
                    return Empty(err == 5 ? "access_denied" : "malformed", processRunning, true, false, _wasLive,
                        err == 5 ? "Windows denied access to the HWiNFO Shared Memory mutex." : "HWiNFO Shared Memory mutex was not available.");
                }

                try
                {
                    var wait = Native.WaitForSingleObject(mutex, 80);
                    if (wait != Native.WAIT_OBJECT_0 && wait != Native.WAIT_ABANDONED)
                        return Empty("stale", processRunning, true, true, _wasLive, "HWiNFO Shared Memory is busy; retaining the last good dashboard data.");

                    try
                    {
                        var headerBytes = new byte[48];
                        Marshal.Copy(view, headerBytes, 0, headerBytes.Length);
                        var header = HWiNFOParser.ReadHeader(headerBytes);
                        if (header.Signature != ActiveSignature)
                        {
                            var code = _wasLive ? "shared_memory_lost" : "shared_memory_inactive";
                            return Empty(code, processRunning, true, false, _wasLive,
                                _wasLive ? "HWiNFO Shared Memory stopped after previously being live." : "HWiNFO Shared Memory exists but is not active.");
                        }

                        var required = HWiNFOParser.RequiredLength(header);
                        var bytes = new byte[required];
                        Marshal.Copy(view, bytes, 0, bytes.Length);
                        var parsed = HWiNFOParser.Parse(bytes);
                        if (parsed.Sensors.Count == 0)
                        {
                            return new SourceReadResult(
                                new ProviderStatus("no_sensors", "Shared Memory is active but no sensor readings were exposed.", processRunning, true, true, 0, 0, _wasLive),
                                parsed.PollTime, parsed.PollingPeriodMs, parsed.Sensors);
                        }

                        _wasLive = true;
                        return new SourceReadResult(
                            new ProviderStatus("live", "HWiNFO Shared Memory is live.", processRunning, true, true, parsed.SensorElementCount, parsed.Sensors.Count, true),
                            parsed.PollTime, parsed.PollingPeriodMs, parsed.Sensors);
                    }
                    catch (Exception error) when (error is InvalidDataException or ArgumentOutOfRangeException or OverflowException)
                    {
                        return Empty("malformed", processRunning, true, false, _wasLive, Sanitize(error.Message));
                    }
                    finally
                    {
                        Native.ReleaseMutex(mutex);
                    }
                }
                finally { Native.CloseHandle(mutex); }
            }
            finally { Native.UnmapViewOfFile(view); }
        }
        finally { Native.CloseHandle(mapping); }
    }

    private static SourceReadResult Empty(string code, bool processRunning, bool mappingPresent, bool active, bool wasLive, string message) =>
        new(new ProviderStatus(code, message, processRunning, mappingPresent, active, 0, 0, wasLive), 0, 0, Array.Empty<SensorReadingDto>());

    private static bool IsHWiNFORunning()
    {
        try
        {
            return Process.GetProcesses().Any(p =>
            {
                try { return p.ProcessName.StartsWith("HWiNFO", StringComparison.OrdinalIgnoreCase); }
                finally { p.Dispose(); }
            });
        }
        catch { return false; }
    }

    private static string Sanitize(string value) => value.Length > 220 ? value[..220] : value;
    public void Dispose() { }

    private static class Native
    {
        public const uint FILE_MAP_READ = 0x0004;
        public const uint SYNCHRONIZE = 0x00100000;
        public const uint MUTEX_MODIFY_STATE = 0x0001;
        public const uint WAIT_OBJECT_0 = 0;
        public const uint WAIT_ABANDONED = 0x80;

        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
        public static extern IntPtr OpenFileMappingW(uint desiredAccess, bool inheritHandle, string name);
        [DllImport("kernel32.dll", SetLastError=true)]
        public static extern IntPtr MapViewOfFile(IntPtr mapping, uint desiredAccess, uint offsetHigh, uint offsetLow, UIntPtr bytesToMap);
        [DllImport("kernel32.dll", SetLastError=true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool UnmapViewOfFile(IntPtr address);
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
        public static extern IntPtr OpenMutexW(uint desiredAccess, bool inheritHandle, string name);
        [DllImport("kernel32.dll", SetLastError=true)]
        public static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
        [DllImport("kernel32.dll", SetLastError=true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool ReleaseMutex(IntPtr handle);
        [DllImport("kernel32.dll", SetLastError=true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool CloseHandle(IntPtr handle);
    }
}

public readonly record struct HWiNFOHeader(
    uint Signature, uint Version, uint Revision, long PollTime,
    uint SensorOffset, uint SensorSize, uint SensorCount,
    uint ReadingOffset, uint ReadingSize, uint ReadingCount,
    uint PollingPeriod);

public sealed record ParsedHWiNFO(long PollTime, int PollingPeriodMs, int SensorElementCount, IReadOnlyList<SensorReadingDto> Sensors);

public static class HWiNFOParser
{
    private const int BaseSensorSize = 264;
    private const int V2SensorSize = 392;
    private const int BaseReadingSize = 316;
    private const int V2ReadingSize = 460;
    private const int MaxBlockBytes = 64 * 1024 * 1024;
    private const int MaxRows = 8192;
    private const char Separator = '␟';

    public static HWiNFOHeader ReadHeader(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < 44) throw new InvalidDataException("Shared Memory header is shorter than 44 bytes.");
        return new HWiNFOHeader(
            U32(bytes,0), U32(bytes,4), U32(bytes,8), I64(bytes,12),
            U32(bytes,20), U32(bytes,24), U32(bytes,28),
            U32(bytes,32), U32(bytes,36), U32(bytes,40),
            bytes.Length >= 48 ? U32(bytes,44) : 0);
    }

    public static int RequiredLength(HWiNFOHeader h)
    {
        ValidateHeader(h);
        var sensorEnd = checked((long)h.SensorOffset + (long)h.SensorSize * h.SensorCount);
        var readingEnd = checked((long)h.ReadingOffset + (long)h.ReadingSize * h.ReadingCount);
        var end = Math.Max(48L, Math.Max(sensorEnd, readingEnd));
        if (end > MaxBlockBytes) throw new InvalidDataException("Shared Memory layout exceeds the 64 MiB safety bound.");
        return checked((int)end);
    }

    public static ParsedHWiNFO Parse(ReadOnlySpan<byte> bytes)
    {
        var h = ReadHeader(bytes);
        if (h.Signature != HWiNFOSharedMemorySource.ActiveSignature) throw new InvalidDataException("Shared Memory signature is not active HWiS.");
        var required = RequiredLength(h);
        if (bytes.Length < required) throw new InvalidDataException("Shared Memory snapshot is shorter than the advertised sections.");

        var sensors = new SensorRow[h.SensorCount];
        for (var i=0; i<sensors.Length; i++)
        {
            var offset = checked((int)h.SensorOffset + i * checked((int)h.SensorSize));
            var row = bytes.Slice(offset, checked((int)h.SensorSize));
            var original = Legacy(row.Slice(8,128));
            var user = h.Version >= 2 && row.Length >= V2SensorSize ? Utf8(row.Slice(264,128)) : Legacy(row.Slice(136,128));
            sensors[i] = new SensorRow(U32(row,0), U32(row,4), Clean(user, original), Clean(original, user));
        }

        var drafts = new List<Draft>(checked((int)h.ReadingCount));
        for (var i=0; i<(int)h.ReadingCount; i++)
        {
            var offset = checked((int)h.ReadingOffset + i * checked((int)h.ReadingSize));
            var row = bytes.Slice(offset, checked((int)h.ReadingSize));
            var sensorIndex = U32(row,4);
            if (sensorIndex >= sensors.Length) continue;
            var sensor = sensors[sensorIndex];
            var originalLabel = Legacy(row.Slice(12,128));
            var userLabel = h.Version >= 2 && row.Length >= V2ReadingSize ? Utf8(row.Slice(316,128)) : Legacy(row.Slice(140,128));
            var unit = h.Version >= 2 && row.Length >= V2ReadingSize ? Utf8(row.Slice(444,16)) : Legacy(row.Slice(268,16));
            var type = TypeName(U32(row,0));
            var readingId = U32(row,8);
            var value = F64(row,284);
            var min = F64(row,292);
            var max = F64(row,300);
            var avg = F64(row,308);
            var available = double.IsFinite(value);
            var label = Clean(userLabel, originalLabel);
            var displaySensor = Clean(sensor.DisplayName, sensor.OriginalName);
            var baseFingerprint = Join(displaySensor, label, unit, type);
            drafts.Add(new Draft(
                $"{sensor.Id:X8}:{sensor.Instance}:{readingId:X8}",
                baseFingerprint, sensor.Id, sensor.Instance, readingId,
                displaySensor, sensor.OriginalName, label, Clean(originalLabel,label), unit, type,
                Finite(value), Finite(min), Finite(max), Finite(avg), available));
        }

        var duplicates = drafts.GroupBy(d => d.Fingerprint, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
        var ordinals = new Dictionary<string,int>(StringComparer.Ordinal);
        var result = new List<SensorReadingDto>(drafts.Count);
        var sampleTime = PollToMilliseconds(h.PollTime);
        foreach (var draft in drafts.OrderBy(d=>d.SensorId).ThenBy(d=>d.SensorInstance).ThenBy(d=>d.ReadingId))
        {
            var fingerprint = draft.Fingerprint;
            if (duplicates[fingerprint] > 1)
            {
                var ordinal = ordinals.TryGetValue(fingerprint,out var current) ? current+1 : 1;
                ordinals[fingerprint] = ordinal;
                fingerprint = $"{fingerprint}{Separator}{ordinal}";
            }
            result.Add(new SensorReadingDto(
                draft.Key, fingerprint, draft.SensorId, draft.SensorInstance, draft.ReadingId,
                draft.SensorName, draft.SensorOriginalName, draft.Label, draft.OriginalLabel,
                draft.Unit, draft.Type, draft.Value, draft.Min, draft.Max, draft.Avg, draft.Available, sampleTime));
        }

        return new ParsedHWiNFO(sampleTime, checked((int)h.PollingPeriod), sensors.Length, result);
    }

    private static void ValidateHeader(HWiNFOHeader h)
    {
        if (h.SensorCount > MaxRows || h.ReadingCount > MaxRows) throw new InvalidDataException("Shared Memory row count exceeds safety bounds.");
        if (h.SensorCount > 0 && h.SensorSize < BaseSensorSize) throw new InvalidDataException("Sensor row is smaller than the documented base layout.");
        if (h.ReadingCount > 0 && h.ReadingSize < BaseReadingSize) throw new InvalidDataException("Reading row is smaller than the documented base layout.");
        if (h.SensorSize > 4096 || h.ReadingSize > 4096) throw new InvalidDataException("Shared Memory row size exceeds safety bounds.");
        if (h.SensorOffset < 44 || h.ReadingOffset < 44) throw new InvalidDataException("Shared Memory section offset points inside the header.");
    }

    private static uint U32(ReadOnlySpan<byte> b,int o) => BitConverter.ToUInt32(b.Slice(o,4));
    private static long I64(ReadOnlySpan<byte> b,int o) => BitConverter.ToInt64(b.Slice(o,8));
    private static double F64(ReadOnlySpan<byte> b,int o) => BitConverter.ToDouble(b.Slice(o,8));
    private static double? Finite(double v) => double.IsFinite(v) ? v : null;
    private static string Utf8(ReadOnlySpan<byte> value) => Decode(value, Encoding.UTF8);
    private static string Legacy(ReadOnlySpan<byte> value)
    {
        var utf = Decode(value, Encoding.UTF8);
        return utf.Contains('�') ? Decode(value, Encoding.Latin1) : utf;
    }
    private static string Decode(ReadOnlySpan<byte> value, Encoding encoding)
    {
        var zero = value.IndexOf((byte)0);
        if (zero >= 0) value = value[..zero];
        return encoding.GetString(value).Trim();
    }
    private static string Clean(string preferred,string fallback) => string.IsNullOrWhiteSpace(preferred) ? (fallback ?? "") : preferred;
    private static string Join(string a,string b,string c,string d) => string.Join(Separator, a.Trim(), b.Trim(), c.Trim(), d.Trim());
    private static string TypeName(uint value) => value switch {1=>"Temperature",2=>"Voltage",3=>"Fan",4=>"Current",5=>"Power",6=>"Clock",7=>"Usage",8=>"Other",_=>"Other"};
    private static long PollToMilliseconds(long poll) => poll > 10_000_000_000L ? poll : checked(poll * 1000L);

    private sealed record SensorRow(uint Id,uint Instance,string DisplayName,string OriginalName);
    private sealed record Draft(string Key,string Fingerprint,uint SensorId,uint SensorInstance,uint ReadingId,string SensorName,string SensorOriginalName,string Label,string OriginalLabel,string Unit,string Type,double? Value,double? Min,double? Max,double? Avg,bool Available);
}

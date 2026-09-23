using System.Buffers.Binary;
using System.Diagnostics;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PackRat.HWiNFOReader;

internal static class Program
{
    private const string MapName = @"Global\HWiNFO_SENS_SM2";
    private const string MutexName = @"Global\HWiNFO_SM2_MUTEX";
    private const uint ActiveSignature = 0x53695748; // HWiS little-endian
    private const uint DeadSignature = 0x44414544;   // DEAD little-endian
    private const int SensorMinSize = 264;
    private const int ReadingMinSize = 316;
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private sealed record Status(string State, string? Detail = null);
    private sealed record SensorItem(
        string Id, string DeviceId, uint SensorId, uint SensorInst, uint ReadingId,
        string DeviceName, string OriginalDeviceName, string Name, string OriginalName,
        string Unit, string Type, double? Value, double? Min, double? Max, double? Avg);
    private sealed record ReadResult(Status Status, long? PollTime = null, uint? PollingPeriod = null, List<SensorItem>? Sensors = null);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("kernel32.dll")]
    private static extern int MultiByteToWideChar(uint codePage, uint flags, byte[] source, int sourceLength, [Out] char[] destination, int destinationLength);

    public static async Task<int> Main(string[] args)
    {
        var stream = args.Contains("--stream", StringComparer.OrdinalIgnoreCase);
        var once = args.Contains("--once", StringComparer.OrdinalIgnoreCase);
        var interval = Math.Clamp(IntArg(args, "--interval", 500), 250, 5000);
        var fixture = StringArg(args, "--fixture");

        string? lastCatalogHash = null;
        string? lastStatusState = null;

        do
        {
            ReadResult result;
            try
            {
                result = fixture is not null
                    ? ParseBytes(await File.ReadAllBytesAsync(fixture), fixtureMode: true)
                    : ReadLive();
            }
            catch (Exception ex)
            {
                result = new ReadResult(new Status("shared_memory_unavailable", ex.Message));
            }

            if (result.Status.State != "ready")
            {
                if (lastStatusState != result.Status.State || once || fixture is not null)
                    WriteJson(new { type = "status", status = result.Status, result.PollTime, result.PollingPeriod });
                lastStatusState = result.Status.State;
                lastCatalogHash = null;
            }
            else
            {
                lastStatusState = "ready";
                var sensors = result.Sensors ?? [];
                var hash = CatalogHash(sensors);
                if (hash != lastCatalogHash)
                {
                    WriteJson(new { type = "catalog", status = result.Status, result.PollTime, result.PollingPeriod, sensors });
                    lastCatalogHash = hash;
                }
                else
                {
                    var values = sensors.Select(s => new { s.Id, s.Value, s.Min, s.Max, s.Avg }).ToArray();
                    WriteJson(new { type = "values", status = result.Status, result.PollTime, result.PollingPeriod, values });
                }
            }

            if (once || fixture is not null || !stream) break;
            await Task.Delay(interval);
        } while (true);

        return 0;
    }

    private static ReadResult ReadLive()
    {
        try
        {
            using var mapping = MemoryMappedFile.OpenExisting(MapName, MemoryMappedFileRights.Read);
            using var view = mapping.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
            var capacity = checked((int)Math.Min(view.Capacity, 64L * 1024 * 1024));
            if (capacity < 44) return new ReadResult(new Status("incompatible", "HWiNFO Shared Memory header is too small."));

            var bytes = new byte[capacity];
            Mutex? mutex = null;
            var locked = false;
            try
            {
                if (Mutex.TryOpenExisting(MutexName, out mutex))
                    locked = mutex.WaitOne(250);
                view.ReadArray(0, bytes, 0, bytes.Length);
            }
            finally
            {
                if (locked) try { mutex?.ReleaseMutex(); } catch { }
                mutex?.Dispose();
            }

            return ParseBytes(bytes, fixtureMode: false);
        }
        catch (FileNotFoundException)
        {
            var processes = GetHWiNFOProcesses();
            if (processes.Count == 0)
                return new ReadResult(new Status("not_running", "HWiNFO is not running. Start HWiNFO 7.0+ in Sensors mode."));
            if (!HasSensorsWindow(processes))
                return new ReadResult(new Status("sensors_inactive", "HWiNFO is running but the Sensors window is not active."));
            return new ReadResult(new Status("shared_memory_disabled", "Enable Shared Memory Support in HWiNFO Sensors settings."));
        }
        catch (UnauthorizedAccessException)
        {
            return new ReadResult(new Status("shared_memory_unavailable", "HWiNFO Shared Memory exists but cannot be opened by this user."));
        }
    }

    private static ReadResult ParseBytes(byte[] bytes, bool fixtureMode)
    {
        if (bytes.Length < 44) return new ReadResult(new Status("incompatible", "Shared Memory fixture/header is too small."));
        var span = bytes.AsSpan();
        var signature = U32(span, 0);
        var revision = U32(span, 8);
        var pollTime = I64(span, 12);
        var sensorOffset = U32(span, 20);
        var sensorSize = U32(span, 24);
        var sensorCount = U32(span, 28);
        var readingOffset = U32(span, 32);
        var readingSize = U32(span, 36);
        var readingCount = U32(span, 40);
        uint? pollingPeriod = revision >= 1 && bytes.Length >= 48 ? U32(span, 44) : null;

        if (signature == DeadSignature)
            return new ReadResult(new Status("shared_memory_expired", "HWiNFO marked Shared Memory inactive. HWiNFO Free can disable it after 12 hours and it must be re-enabled manually."), pollTime, pollingPeriod);
        if (signature != ActiveSignature)
            return new ReadResult(new Status("incompatible", "HWiNFO Shared Memory signature is invalid."), pollTime, pollingPeriod);
        if (sensorSize < SensorMinSize || readingSize < ReadingMinSize || sensorCount > 10000 || readingCount > 50000)
            return new ReadResult(new Status("incompatible", "HWiNFO Shared Memory layout is outside supported bounds."), pollTime, pollingPeriod);
        if (!SectionFits(bytes.Length, sensorOffset, sensorSize, sensorCount) || !SectionFits(bytes.Length, readingOffset, readingSize, readingCount))
            return new ReadResult(new Status("incompatible", "HWiNFO Shared Memory section bounds are invalid."), pollTime, pollingPeriod);
        if (sensorCount == 0 || readingCount == 0)
            return new ReadResult(new Status("sensors_inactive", "HWiNFO Shared Memory is active but no sensor readings are published."), pollTime, pollingPeriod);

        var devices = new List<(uint Id, uint Inst, string Orig, string User)>(checked((int)sensorCount));
        for (var i = 0; i < sensorCount; i++)
        {
            var start = checked((int)(sensorOffset + sensorSize * i));
            var item = span.Slice(start, checked((int)sensorSize));
            devices.Add((U32(item, 0), U32(item, 4), FixedText(item.Slice(8, 128)), FixedText(item.Slice(136, 128))));
        }

        var sensors = new List<SensorItem>(checked((int)readingCount));
        for (var i = 0; i < readingCount; i++)
        {
            var start = checked((int)(readingOffset + readingSize * i));
            var item = span.Slice(start, checked((int)readingSize));
            var type = U32(item, 0);
            var sensorIndex = U32(item, 4);
            var readingId = U32(item, 8);
            if (sensorIndex >= devices.Count) continue;
            var device = devices[(int)sensorIndex];
            var originalName = FixedText(item.Slice(12, 128));
            var userName = FixedText(item.Slice(140, 128));
            var unit = FixedText(item.Slice(268, 16));
            var value = Finite(F64(item, 284));
            var min = Finite(F64(item, 292));
            var max = Finite(F64(item, 300));
            var avg = Finite(F64(item, 308));
            var id = $"hwinfo:{device.Id}:{device.Inst}:{readingId}";
            var deviceId = $"{device.Id}:{device.Inst}";
            sensors.Add(new SensorItem(
                id, deviceId, device.Id, device.Inst, readingId,
                string.IsNullOrWhiteSpace(device.User) ? device.Orig : device.User,
                device.Orig,
                string.IsNullOrWhiteSpace(userName) ? originalName : userName,
                originalName,
                unit,
                ReadingType(type),
                value, min, max, avg));
        }

        return new ReadResult(new Status("ready"), pollTime, pollingPeriod, sensors);
    }

    private static List<Process> GetHWiNFOProcesses()
    {
        var output = new List<Process>();
        foreach (var process in Process.GetProcesses())
        {
            try
            {
                if (process.ProcessName.StartsWith("HWiNFO", StringComparison.OrdinalIgnoreCase))
                    output.Add(process);
                else process.Dispose();
            }
            catch { process.Dispose(); }
        }
        return output;
    }

    private static bool HasSensorsWindow(List<Process> processes)
    {
        var ids = processes.Select(p => (uint)p.Id).ToHashSet();
        var found = false;
        EnumWindows((window, _) =>
        {
            if (!IsWindowVisible(window)) return true;
            GetWindowThreadProcessId(window, out var pid);
            if (!ids.Contains(pid)) return true;
            var title = new StringBuilder(512);
            GetWindowText(window, title, title.Capacity);
            var text = title.ToString();
            if (text.Contains("sensor", StringComparison.OrdinalIgnoreCase) || text.Contains("HWiNFO", StringComparison.OrdinalIgnoreCase))
            {
                found = true;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        foreach (var process in processes) process.Dispose();
        return found;
    }

    private static string CatalogHash(IEnumerable<SensorItem> sensors)
    {
        using var sha = SHA256.Create();
        var text = string.Join("\n", sensors.Select(s => $"{s.Id}|{s.DeviceName}|{s.Name}|{s.Unit}|{s.Type}"));
        return Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(text)));
    }

    private static string FixedText(ReadOnlySpan<byte> source)
    {
        var end = source.IndexOf((byte)0);
        if (end >= 0) source = source[..end];
        if (source.IsEmpty) return "";
        var data = source.ToArray();
        try { return StrictUtf8.GetString(data).Trim(); }
        catch (DecoderFallbackException)
        {
            var chars = new char[Math.Max(1, data.Length * 2)];
            var count = MultiByteToWideChar(0, 0, data, data.Length, chars, chars.Length);
            return count > 0 ? new string(chars, 0, count).Trim() : Encoding.Latin1.GetString(data).Trim();
        }
    }

    private static string ReadingType(uint type) => type switch
    {
        1 => "temperature", 2 => "voltage", 3 => "fan", 4 => "current",
        5 => "power", 6 => "clock", 7 => "usage", 8 => "other", _ => "none"
    };
    private static bool SectionFits(int length, uint offset, uint size, uint count)
    {
        try { return checked((ulong)offset + (ulong)size * count) <= (ulong)length; } catch { return false; }
    }
    private static uint U32(ReadOnlySpan<byte> span, int offset) => BinaryPrimitives.ReadUInt32LittleEndian(span.Slice(offset, 4));
    private static long I64(ReadOnlySpan<byte> span, int offset) => BinaryPrimitives.ReadInt64LittleEndian(span.Slice(offset, 8));
    private static double F64(ReadOnlySpan<byte> span, int offset) => BitConverter.Int64BitsToDouble(BinaryPrimitives.ReadInt64LittleEndian(span.Slice(offset, 8)));
    private static double? Finite(double value) => double.IsFinite(value) ? value : null;
    private static int IntArg(string[] args, string key, int fallback)
    {
        var index = Array.FindIndex(args, value => value.Equals(key, StringComparison.OrdinalIgnoreCase));
        return index >= 0 && index + 1 < args.Length && int.TryParse(args[index + 1], out var result) ? result : fallback;
    }
    private static string? StringArg(string[] args, string key)
    {
        var index = Array.FindIndex(args, value => value.Equals(key, StringComparison.OrdinalIgnoreCase));
        return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
    }
    private static void WriteJson(object value) => Console.WriteLine(JsonSerializer.Serialize(value, JsonOptions));
}

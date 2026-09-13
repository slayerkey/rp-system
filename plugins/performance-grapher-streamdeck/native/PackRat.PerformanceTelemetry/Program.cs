using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using LibreHardwareMonitor.Hardware;

namespace PackRat.PerformanceTelemetry;

internal sealed class UpdateVisitor : IVisitor
{
    public void VisitComputer(IComputer computer) => computer.Traverse(this);
    public void VisitHardware(IHardware hardware)
    {
        hardware.Update();
        foreach (var sub in hardware.SubHardware) sub.Accept(this);
    }
    public void VisitSensor(ISensor sensor) { }
    public void VisitParameter(IParameter parameter) { }
}

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    private static string? ForegroundProcess()
    {
        try
        {
            var handle = GetForegroundWindow();
            if (handle == IntPtr.Zero) return null;
            _ = GetWindowThreadProcessId(handle, out var pid);
            if (pid == 0) return null;
            using var process = Process.GetProcessById((int)pid);
            return process.ProcessName + ".exe";
        }
        catch
        {
            return null;
        }
    }

    private static IEnumerable<IHardware> Walk(IHardware hardware)
    {
        yield return hardware;
        foreach (var child in hardware.SubHardware)
        {
            foreach (var nested in Walk(child)) yield return nested;
        }
    }

    private static string SensorId(IHardware hardware, ISensor sensor)
    {
        static string Safe(string value) => Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(value))
        )[..16].ToLowerInvariant();

        var basis = string.Join("|",
            hardware.HardwareType.ToString(),
            hardware.Identifier.ToString(),
            sensor.SensorType.ToString(),
            sensor.Identifier.ToString(),
            sensor.Name);
        return "lhm." + Safe(basis);
    }

    private static object CatalogEntry(IHardware hardware, ISensor sensor, string id) => new
    {
        id,
        name = sensor.Name,
        sensorType = sensor.SensorType.ToString(),
        hardwareType = hardware.HardwareType.ToString(),
        hardwareName = hardware.Name,
        hardwareId = hardware.Identifier.ToString(),
        unit = sensor.SensorType switch
        {
            SensorType.Voltage => "V",
            SensorType.Current => "A",
            SensorType.Power => "W",
            SensorType.Clock => "MHz",
            SensorType.Temperature => "°C",
            SensorType.Load => "%",
            SensorType.Frequency => "Hz",
            SensorType.Fan => "RPM",
            SensorType.Flow => "L/h",
            SensorType.Control => "%",
            SensorType.Level => "%",
            SensorType.Factor => "",
            SensorType.Data => "GB",
            SensorType.SmallData => "MB",
            SensorType.Throughput => "B/s",
            SensorType.TimeSpan => "s",
            SensorType.Timing => "ns",
            SensorType.Energy => "mWh",
            SensorType.Noise => "dBA",
            SensorType.Conductivity => "µS/cm",
            SensorType.Humidity => "%",
            _ => "",
        },
    };

    private static (List<object> Catalog, List<(ISensor Sensor, string Id)> Sensors) ReadCatalog(Computer computer)
    {
        var catalog = new List<object>();
        var sensors = new List<(ISensor Sensor, string Id)>();

        foreach (var root in computer.Hardware)
        {
            foreach (var hardware in Walk(root))
            {
                foreach (var sensor in hardware.Sensors)
                {
                    var id = SensorId(hardware, sensor);
                    catalog.Add(CatalogEntry(hardware, sensor, id));
                    sensors.Add((sensor, id));
                }
            }
        }

        return (catalog, sensors);
    }

    private static Dictionary<string, float> ReadValues(IEnumerable<(ISensor Sensor, string Id)> sensors)
    {
        var values = new Dictionary<string, float>(StringComparer.Ordinal);
        foreach (var (sensor, id) in sensors)
        {
            if (sensor.Value is float value && float.IsFinite(value)) values[id] = value;
        }

        return values;
    }

    private static void Emit(object payload)
    {
        Console.WriteLine(JsonSerializer.Serialize(payload, JsonOptions));
        Console.Out.Flush();
    }

    public static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        var probe = args.Any(x => string.Equals(x, "--probe", StringComparison.OrdinalIgnoreCase));

        var computer = new Computer
        {
            IsCpuEnabled = true,
            IsGpuEnabled = true,
            IsMemoryEnabled = true,
            IsMotherboardEnabled = true,
            IsControllerEnabled = true,
            IsStorageEnabled = true,
            IsNetworkEnabled = true,
        };

        try
        {
            computer.Open();
        }
        catch (Exception ex)
        {
            Emit(new { type = "status", status = "unavailable", error = ex.Message });
            return probe ? 0 : 2;
        }

        try
        {
            var visitor = new UpdateVisitor();
            var sensorBindings = new List<(ISensor Sensor, string Id)>();
            var iteration = 0;

            while (true)
            {
                try
                {
                    computer.Accept(visitor);
                    if (iteration == 0 || iteration % 30 == 0)
                    {
                        var (catalog, sensors) = ReadCatalog(computer);
                        sensorBindings = sensors;
                        Emit(new
                        {
                            type = "catalog",
                            sensors = catalog,
                        });
                    }

                    var values = ReadValues(sensorBindings);
                    Emit(new
                    {
                        type = "sample",
                        at = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        foregroundProcess = ForegroundProcess(),
                        values,
                    });
                }
                catch (Exception ex)
                {
                    Emit(new { type = "status", status = "degraded", error = ex.Message });
                }

                iteration++;
                if (probe) break;
                await Task.Delay(1000);
            }

            return 0;
        }
        finally
        {
            try { computer.Close(); } catch { }
        }
    }
}

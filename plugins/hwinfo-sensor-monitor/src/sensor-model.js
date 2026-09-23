export const AUTO = Object.freeze({
  CPU_TEMP: "auto:cpu-temp", CPU_LOAD: "auto:cpu-load", CPU_POWER: "auto:cpu-power",
  GPU_TEMP: "auto:gpu-temp", GPU_LOAD: "auto:gpu-load", GPU_POWER: "auto:gpu-power",
  GPU_FAN: "auto:gpu-fan", RAM_LOAD: "auto:ram-load"
});

export function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function stableSensorId(sensorId, sensorInst, readingId) {
  return "hwinfo:" + (Number(sensorId) >>> 0) + ":" + (Number(sensorInst) >>> 0) + ":" + (Number(readingId) >>> 0);
}

function norm(value) { return String(value || "").replace(/\s+/g, " ").trim().toLowerCase(); }

function score(sensor, target) {
  const device = norm(sensor.deviceName), name = norm(sensor.name), unit = norm(sensor.unit), type = norm(sensor.type);
  const gpu = /gpu|graphics|geforce|radeon|arc/.test(device);
  const cpu = /cpu|processor|ryzen|core ultra|core i[3579]|intel/.test(device);
  const memory = /memory|ram/.test(device + " " + name);
  if (target === AUTO.CPU_TEMP && cpu && (type === "temperature" || unit.includes("°c"))) return /package|tctl|tdie/.test(name) ? 110 : 80;
  if (target === AUTO.CPU_LOAD && cpu && (type === "usage" || unit === "%")) return /total|overall/.test(name) ? 110 : 70;
  if (target === AUTO.CPU_POWER && cpu && (type === "power" || unit === "w")) return name.includes("package") ? 110 : 70;
  if (target === AUTO.GPU_TEMP && gpu && (type === "temperature" || unit.includes("°c"))) return /gpu temperature|gpu core|core/.test(name) ? 110 : /hot spot|hotspot/.test(name) ? 75 : 65;
  if (target === AUTO.GPU_LOAD && gpu && (type === "usage" || unit === "%")) return /gpu core|gpu usage|d3d 3d|3d/.test(name) ? 110 : 70;
  if (target === AUTO.GPU_POWER && gpu && (type === "power" || unit === "w")) return /total|board|package|gpu power/.test(name) ? 110 : 70;
  if (target === AUTO.GPU_FAN && gpu && (type === "fan" || /rpm/.test(unit))) return /gpu fan|fan 1|fan #1/.test(name) ? 110 : 75;
  if (target === AUTO.RAM_LOAD && memory && unit === "%") return /physical|memory load|used/.test(name) ? 100 : 70;
  return -1;
}

export function resolveSensor(catalog, ref) {
  const sensors = Array.isArray(catalog) ? catalog : [], wanted = String(ref || "");
  if (!wanted) return null;
  if (!wanted.startsWith("auto:")) return sensors.find((sensor) => sensor.id === wanted) || null;
  let winner = null, best = -1;
  for (const sensor of sensors) {
    const value = score(sensor, wanted);
    if (value > best) { best = value; winner = sensor; }
  }
  return best >= 0 ? winner : null;
}

export function statusCopy(status) {
  const state = String(status?.state || "starting");
  const table = {
    ready: ["HWiNFO ready", "Shared Memory sensor data is available."],
    not_running: ["Start HWiNFO", "HWiNFO 7.0+ must be installed and running in Sensors mode."],
    sensors_inactive: ["Open HWiNFO Sensors", "The HWiNFO Sensors window is not active. Open Sensors to publish readings."],
    shared_memory_disabled: ["Enable Shared Memory Support", "In HWiNFO Sensors settings, enable Shared Memory Support."],
    shared_memory_expired: ["Shared Memory expired", "HWiNFO Free can stop Shared Memory after 12 hours. Re-enable it manually in HWiNFO, or use an appropriate HWiNFO Pro license."],
    shared_memory_unavailable: ["Shared Memory unavailable", "HWiNFO is running but its Shared Memory sensor feed is unavailable."],
    incompatible: ["HWiNFO interface unavailable", "The detected Shared Memory layout is unsupported or invalid."],
    starting: ["Connecting to HWiNFO", "Waiting for local sensor data."]
  };
  return table[state] || ["HWiNFO unavailable", String(status?.detail || "Sensor data is unavailable.")];
}

export function formatReading(value, precision = 1) {
  const n = finite(value);
  if (n === null) return "--";
  const digits = Math.max(0, Math.min(4, Number(precision) || 0));
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(Math.min(1, digits)) + "M";
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(Math.min(1, digits)) + "K";
  return n.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function normalizeSettings(raw = {}, kind = "sensor") {
  const source = raw && typeof raw === "object" ? raw : {};
  const defaults = {
    sensorId: AUTO.GPU_TEMP,
    sensorIds: [AUTO.GPU_TEMP, AUTO.CPU_TEMP, AUTO.GPU_LOAD],
    customLabel: "", precision: 1, showMinMax: true, historyEnabled: kind === "graph",
    historyWindowMs: kind === "graph" ? 60000 : 30000,
    warningThreshold: 80, criticalThreshold: 90, thresholdDirection: "above",
    refreshMs: 1000, accent: "#2BE86A", dashboardPage: 0
  };
  const historyWindowMs = [30000, 60000, 300000].includes(Number(source.historyWindowMs)) ? Number(source.historyWindowMs) : defaults.historyWindowMs;
  const refreshMs = [250, 500, 1000, 2000, 5000].includes(Number(source.refreshMs)) ? Number(source.refreshMs) : 1000;
  const sensorIds = Array.isArray(source.sensorIds) ? source.sensorIds.map(String).filter(Boolean).slice(0, 12) : defaults.sensorIds;
  return {
    ...defaults, ...source,
    sensorId: String(source.sensorId || defaults.sensorId),
    sensorIds: sensorIds.length ? sensorIds : defaults.sensorIds,
    customLabel: String(source.customLabel || "").slice(0, 28),
    precision: Math.max(0, Math.min(4, Number(source.precision) || 0)),
    showMinMax: source.showMinMax !== false,
    historyEnabled: source.historyEnabled !== false,
    historyWindowMs,
    warningThreshold: finite(source.warningThreshold) ?? defaults.warningThreshold,
    criticalThreshold: finite(source.criticalThreshold) ?? defaults.criticalThreshold,
    thresholdDirection: source.thresholdDirection === "below" ? "below" : "above",
    refreshMs,
    accent: /^#[0-9A-Fa-f]{6}$/.test(String(source.accent || "")) ? String(source.accent).toUpperCase() : defaults.accent,
    dashboardPage: Math.max(0, Number(source.dashboardPage) || 0)
  };
}

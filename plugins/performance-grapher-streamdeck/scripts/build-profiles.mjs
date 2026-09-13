import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const profileDir = resolve(root, "com.packrat.performance-grapher.sdPlugin", "profiles");

const UUID = Object.freeze({
  graph: "com.packrat.performance-grapher.graph",
  fps: "com.packrat.performance-grapher.fps",
  session: "com.packrat.performance-grapher.session",
  metric: "com.packrat.performance-grapher.metric",
  alert: "com.packrat.performance-grapher.alert",
});

function deterministicUuid(seed) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`.toUpperCase();
}

function pageFolderId(uuid) {
  const chunks = (uuid.replace(/-/g, "") + "000").match(/.{5}/g) || [];
  return chunks
    .map((chunk) => parseInt(chunk, 16).toString(32).padStart(4, "0"))
    .join("")
    .slice(0, 26)
    .toUpperCase()
    .replace(/V/g, "W")
    .replace(/U/g, "V") + "Z";
}

function action(seed, uuid, name, settings = {}) {
  return {
    ActionID: deterministicUuid(`action:${seed}`),
    LinkedTitle: true,
    Name: name,
    UUID: uuid,
    Settings: settings,
    State: 0,
    States: [{
      Title: "",
      ShowTitle: false,
      TitleAlignment: "middle",
      TitleColor: "#FFFFFF",
      FontFamily: "Arial",
      FontSize: 12,
      FontStyle: "Regular",
      FontUnderline: false,
    }],
  };
}

function fps(seed, mode = "fps", windowMs = 60_000) {
  return action(seed, UUID.fps, mode === "frametime" ? "Frametime" : "Game FPS", {
    fpsMode: mode,
    lowMode: "one",
    windowMs,
  });
}

function graph(seed, metricId, name, windowMs = 300_000, threshold = 85, thresholdDirection = "above") {
  return action(seed, UUID.graph, name, {
    metricId,
    windowMs,
    threshold,
    thresholdDirection,
  });
}

function metric(seed, metricId, name) {
  return action(seed, UUID.metric, name, { metricId });
}

function alert(seed, metricId, name, threshold, thresholdDirection) {
  return action(seed, UUID.alert, name, {
    metricId,
    threshold,
    thresholdDirection,
    windowMs: 60_000,
  });
}

function session(seed) {
  return action(seed, UUID.session, "Session Summary", { summaryPage: 0 });
}

function compactActions(prefix) {
  return {
    "0,0": fps(`${prefix}-fps`, "fps"),
    "1,0": fps(`${prefix}-frametime`, "frametime"),
    "2,0": session(`${prefix}-session`),
    "3,0": graph(`${prefix}-gpu-temp`, "gpu.temperature", "GPU Temperature", 300_000, 85, "above"),
    "0,1": graph(`${prefix}-gpu-load`, "gpu.load", "GPU Load", 60_000, 98, "above"),
    "1,1": graph(`${prefix}-cpu-load`, "cpu.load", "CPU Load", 300_000, 95, "above"),
    "2,1": metric(`${prefix}-ram`, "ram.load", "RAM Used"),
    "3,1": alert(`${prefix}-gpu-alert`, "gpu.temperature", "GPU Temp Alert", 85, "above"),
  };
}

function mk2Actions() {
  return {
    "0,0": fps("mk2-fps", "fps"),
    "1,0": fps("mk2-frametime", "frametime"),
    "2,0": session("mk2-session"),
    "3,0": graph("mk2-gpu-temp", "gpu.temperature", "GPU Temperature", 300_000, 85, "above"),
    "4,0": graph("mk2-gpu-load", "gpu.load", "GPU Load", 60_000, 98, "above"),

    "0,1": graph("mk2-cpu-load", "cpu.load", "CPU Load", 300_000, 95, "above"),
    "1,1": graph("mk2-ram", "ram.load", "RAM Used", 300_000, 90, "above"),
    "2,1": graph("mk2-cpu-temp", "cpu.temperature", "CPU Temperature", 300_000, 90, "above"),
    "3,1": metric("mk2-gpu-power", "gpu.power", "GPU Power"),
    "4,1": alert("mk2-gpu-temp-alert", "gpu.temperature", "GPU Temp Alert", 85, "above"),

    "0,2": graph("mk2-fps-15m", "game.fps", "FPS History", 900_000, 60, "below"),
    "1,2": graph("mk2-frame-15m", "game.frametime", "Frametime History", 900_000, 33.3, "above"),
    "2,2": graph("mk2-gpu-temp-15m", "gpu.temperature", "GPU Temp 15 Min", 900_000, 85, "above"),
    "3,2": graph("mk2-cpu-load-15m", "cpu.load", "CPU Load 15 Min", 900_000, 95, "above"),
    "4,2": alert("mk2-fps-alert", "game.fps", "FPS Alert", 60, "below"),
  };
}

function xlActions() {
  const actions = {
    "0,0": fps("xl-fps", "fps"),
    "1,0": fps("xl-frametime", "frametime"),
    "2,0": session("xl-session"),
    "3,0": metric("xl-gpu-temp", "gpu.temperature", "GPU Temperature"),
    "4,0": metric("xl-gpu-load", "gpu.load", "GPU Load"),
    "5,0": metric("xl-cpu-load", "cpu.load", "CPU Load"),
    "6,0": metric("xl-cpu-temp", "cpu.temperature", "CPU Temperature"),
    "7,0": metric("xl-ram", "ram.load", "RAM Used"),
  };

  const fiveMinute = [
    ["game.fps", "FPS 5 Min", 60, "below"],
    ["game.frametime", "Frametime 5 Min", 33.3, "above"],
    ["gpu.temperature", "GPU Temp 5 Min", 85, "above"],
    ["gpu.load", "GPU Load 5 Min", 98, "above"],
    ["cpu.load", "CPU Load 5 Min", 95, "above"],
    ["ram.load", "RAM 5 Min", 90, "above"],
    ["cpu.temperature", "CPU Temp 5 Min", 90, "above"],
    ["gpu.power", "GPU Power 5 Min", 300, "above"],
  ];
  fiveMinute.forEach(([id, name, threshold, direction], col) => {
    actions[`${col},1`] = graph(`xl-5m-${col}`, id, name, 300_000, threshold, direction);
  });

  const fifteenMinute = [
    ["game.fps", "FPS 15 Min", 60, "below"],
    ["game.frametime", "Frametime 15 Min", 33.3, "above"],
    ["gpu.temperature", "GPU Temp 15 Min", 85, "above"],
    ["gpu.load", "GPU Load 15 Min", 98, "above"],
    ["cpu.load", "CPU Load 15 Min", 95, "above"],
    ["ram.load", "RAM 15 Min", 90, "above"],
    ["cpu.temperature", "CPU Temp 15 Min", 90, "above"],
    ["gpu.power", "GPU Power 15 Min", 300, "above"],
  ];
  fifteenMinute.forEach(([id, name, threshold, direction], col) => {
    actions[`${col},2`] = graph(`xl-15m-${col}`, id, name, 900_000, threshold, direction);
  });

  const alerts = [
    ["game.fps", "FPS Alert", 60, "below"],
    ["game.frametime", "Frametime Alert", 33.3, "above"],
    ["gpu.temperature", "GPU Temp Alert", 85, "above"],
    ["cpu.temperature", "CPU Temp Alert", 90, "above"],
    ["gpu.load", "GPU Load Alert", 98, "above"],
    ["cpu.load", "CPU Load Alert", 95, "above"],
    ["ram.load", "RAM Alert", 90, "above"],
  ];
  alerts.forEach(([id, name, threshold, direction], col) => {
    actions[`${col},3`] = alert(`xl-alert-${col}`, id, name, threshold, direction);
  });
  actions["7,3"] = session("xl-session-2");

  return actions;
}

const PROFILE_SPECS = [
  { file: "performance-dashboard-mk2", name: "PackRat Performance Dashboard", width: 5, height: 3, keypad: mk2Actions() },
  { file: "performance-dashboard-xl", name: "PackRat Performance Dashboard XL", width: 8, height: 4, keypad: xlActions() },
  { file: "performance-dashboard-plus", name: "PackRat Performance Dashboard +", width: 4, height: 2, keypad: compactActions("plus") },
  { file: "performance-dashboard-neo", name: "PackRat Performance Dashboard Neo", width: 4, height: 2, keypad: compactActions("neo") },
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const year = 2026 - 1980;
  const date = (year << 9) | (1 << 5) | 1;
  const time = 0;

  for (const [path, rawValue] of entries) {
    const name = Buffer.from(path.replace(/\\/g, "/"), "utf8");
    const raw = Buffer.isBuffer(rawValue) ? rawValue : Buffer.from(rawValue, "utf8");
    const compressed = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const localRecord = Buffer.concat([local, name, compressed]);
    locals.push(localRecord);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    offset += localRecord.length;
  }

  const centralData = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralData, end]);
}

function buildProfile(spec) {
  const rootUuid = deterministicUuid(`profile-root:${spec.file}`);
  const pageUuid = deterministicUuid(`profile-page:${spec.file}`);
  const folder = pageFolderId(pageUuid);
  const rootPath = `${rootUuid}.sdProfile`;
  const bundle = {
    Name: spec.name,
    Pages: { Current: pageUuid, Pages: [pageUuid] },
    Version: "2.0",
  };
  const page = { Controllers: [{ Actions: spec.keypad, Type: "Keypad" }] };
  return zip([
    [`${rootPath}/manifest.json`, JSON.stringify(bundle, null, 2)],
    [`${rootPath}/Profiles/${folder}/manifest.json`, JSON.stringify(page, null, 2)],
  ]);
}

await rm(profileDir, { recursive: true, force: true });
await mkdir(profileDir, { recursive: true });

for (const spec of PROFILE_SPECS) {
  const file = resolve(profileDir, `${spec.file}.streamDeckProfile`);
  await writeFile(file, buildProfile(spec));
  console.log(`Built profile ${spec.file} (${Object.keys(spec.keypad).length} keys)`);
}

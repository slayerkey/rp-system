import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { profileAction, writeProfiles } from "../../../tools/streamdeck/profile-builder.mjs";

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

function action(seed, uuid, name, settings = {}) {
  return profileAction(seed, uuid, name, settings);
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

await writeProfiles(profileDir, PROFILE_SPECS);
for (const spec of PROFILE_SPECS) {
  console.log(`Performance Grapher profile ready: ${spec.file} (${Object.keys(spec.keypad).length} keys)`);
}

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { profileAction, writeProfiles } from "../../../tools/streamdeck/profile-builder.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const profileDir = resolve(root, "com.packrat.internet-health-pro.sdPlugin", "profiles");

const UUID = {
  health: "com.packrat.internet-health-pro.health",
  latency: "com.packrat.internet-health-pro.latency",
  jitter: "com.packrat.internet-health-pro.jitter-loss",
  outage: "com.packrat.internet-health-pro.outage",
  target: "com.packrat.internet-health-pro.target",
  speed: "com.packrat.internet-health-pro.speed-test",
  summary: "com.packrat.internet-health-pro.summary",
};

function action(seed, key, name, settings = {}) {
  return profileAction(seed, UUID[key], name, settings);
}

function standardActions(prefix) {
  return {
    "0,0": action(`${prefix}-health`, "health", "Internet Health"),
    "1,0": action(`${prefix}-latency`, "latency", "Latency"),
    "2,0": action(`${prefix}-jitter`, "jitter", "Jitter / Loss", { metric: "jitter" }),
    "3,0": action(`${prefix}-outage`, "outage", "Outage", { outageMode: "uptime" }),
    "4,0": action(`${prefix}-speed`, "speed", "Speed Test"),
    "0,1": action(`${prefix}-summary`, "summary", "Health Summary"),
    "1,1": action(`${prefix}-target`, "target", "Target Health", { target: "1.1.1.1", targetMethod: "auto", family: "auto" }),
  };
}

function xlActions() {
  const items = [
    ["health", "Internet Health", {}],
    ["latency", "Latency", {}],
    ["jitter", "Jitter / Loss", { metric: "jitter" }],
    ["outage", "Outage", { outageMode: "uptime" }],
    ["speed", "Speed Test", {}],
    ["summary", "Health Summary", {}],
    ["target", "Target Health", { target: "1.1.1.1", targetMethod: "auto", family: "auto" }],
  ];
  const actions = {};
  items.forEach(([key, name, settings], col) => {
    actions[`${col},0`] = action(`xl-${key}`, key, name, settings);
  });
  return actions;
}

function compactActions(prefix) {
  return {
    "0,0": action(`${prefix}-health`, "health", "Internet Health"),
    "1,0": action(`${prefix}-latency`, "latency", "Latency"),
    "2,0": action(`${prefix}-jitter`, "jitter", "Jitter / Loss", { metric: "jitter" }),
    "3,0": action(`${prefix}-outage`, "outage", "Outage", { outageMode: "uptime" }),
    "0,1": action(`${prefix}-speed`, "speed", "Speed Test"),
    "1,1": action(`${prefix}-summary`, "summary", "Health Summary"),
    "2,1": action(`${prefix}-target`, "target", "Target Health", { target: "1.1.1.1", targetMethod: "auto", family: "auto" }),
  };
}

await writeProfiles(profileDir, [
  { file: "internet-health-dashboard-mk2", name: "PackRat Internet Health", keypad: standardActions("mk2") },
  { file: "internet-health-dashboard-xl", name: "PackRat Internet Health XL", keypad: xlActions() },
  { file: "internet-health-dashboard-plus", name: "PackRat Internet Health +", keypad: compactActions("plus") },
  { file: "internet-health-dashboard-neo", name: "PackRat Internet Health Neo", keypad: compactActions("neo") },
]);

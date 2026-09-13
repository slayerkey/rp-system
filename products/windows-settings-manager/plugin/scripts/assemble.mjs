import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const ASSETS = path.join(ROOT, "assets");
const UI = path.join(ROOT, "ui");
const BACKEND = path.join(ROOT, "scripts", "windows-settings-backend.ps1");

const DEVICES = [
  { id: "standard", label: "Stream Deck", deviceType: 0, columns: 5, rows: 3 },
  { id: "mini", label: "Stream Deck Mini", deviceType: 1, columns: 3, rows: 2 },
  { id: "xl", label: "Stream Deck XL", deviceType: 2, columns: 8, rows: 4 },
  { id: "plus", label: "Stream Deck +", deviceType: 7, columns: 4, rows: 2 },
  { id: "neo", label: "Stream Deck Neo", deviceType: 9, columns: 4, rows: 2 },
  { id: "galleon", label: "Galleon 100 SD", deviceType: 12, columns: 4, rows: 3 },
  { id: "plus-xl", label: "Stream Deck + XL", deviceType: 13, columns: 9, rows: 4 }
];

const ACTIONS = {
  lite: {
    status: "com.packrat.windows-settings-manager-lite.status",
    hdr: "com.packrat.windows-settings-manager-lite.hdr",
    power: "com.packrat.windows-settings-manager-lite.power",
    display: "com.packrat.windows-settings-manager-lite.display",
    timeout: "com.packrat.windows-settings-manager-lite.timeout",
    awake: "com.packrat.windows-settings-manager-lite.awake",
    lock: "com.packrat.windows-settings-manager-lite.lock"
  },
  pro: {
    status: "com.packrat.windows-settings-manager-pro.status",
    hdr: "com.packrat.windows-settings-manager-pro.hdr",
    power: "com.packrat.windows-settings-manager-pro.power",
    display: "com.packrat.windows-settings-manager-pro.display",
    timeout: "com.packrat.windows-settings-manager-pro.timeout",
    awake: "com.packrat.windows-settings-manager-pro.awake",
    lock: "com.packrat.windows-settings-manager-pro.lock",
    apply: "com.packrat.windows-settings-manager-pro.apply-mode",
    cycle: "com.packrat.windows-settings-manager-pro.cycle-mode",
    current: "com.packrat.windows-settings-manager-pro.current-mode",
    save: "com.packrat.windows-settings-manager-pro.save-mode",
    page: "com.packrat.windows-settings-manager-pro.profile-page"
  }
};

const MODE_IDS = ["gaming", "work", "night", "present", "movie"];

for (const flavor of ["lite", "pro"]) {
  await assemble(flavor);
}

async function assemble(flavor) {
  const uuid = `com.packrat.windows-settings-manager-${flavor}`;
  const plugin = path.join(OUT, `${uuid}.sdPlugin`);
  await mkdir(path.join(plugin, "bin"), { recursive: true });
  await mkdir(path.join(plugin, "imgs", "plugin"), { recursive: true });
  await mkdir(path.join(plugin, "imgs", "actions", "common"), { recursive: true });
  await mkdir(path.join(plugin, "ui"), { recursive: true });
  await mkdir(path.join(plugin, "profiles"), { recursive: true });

  await copyFile(BACKEND, path.join(plugin, "bin", "windows-settings-backend.ps1"));
  await copyFile(path.join(ASSETS, "marketplace.png"), path.join(plugin, "imgs", "plugin", "marketplace.png"));
  await copyFile(path.join(ASSETS, "marketplace@2x.png"), path.join(plugin, "imgs", "plugin", "marketplace@2x.png"));
  for (const file of ["config.html", "pi.css", "pi.js"]) {
    await copyFile(path.join(UI, file), path.join(plugin, "ui", file));
  }

  await writeFile(path.join(plugin, "imgs", "actions", "common", "icon.svg"), iconSvg());
  await writeFile(path.join(plugin, "imgs", "actions", "common", "icon@2x.svg"), iconSvg());
  await writeFile(path.join(plugin, "imgs", "actions", "common", "key.svg"), keySvg());
  await writeFile(path.join(plugin, "imgs", "actions", "common", "key@2x.svg"), keySvg());
  await writeFile(path.join(plugin, "imgs", "plugin", "category-icon.svg"), iconSvg());
  await writeFile(path.join(plugin, "imgs", "plugin", "category-icon@2x.svg"), iconSvg());

  const profiles = await buildProfiles(flavor, plugin);
  await writeFile(path.join(plugin, "manifest.json"), JSON.stringify(manifest(flavor, profiles), null, 2) + "\n");
}

function manifest(flavor, profiles) {
  const pro = flavor === "pro";
  const name = pro ? "Windows Settings Manager Pro" : "Windows Settings Manager Lite";
  const uuid = `com.packrat.windows-settings-manager-${flavor}`;
  const actions = [
    actionDef(name, "System Status", ACTIONS[flavor].status, "See current Windows system state and refresh it."),
    actionDef(name, "HDR", ACTIONS[flavor].hdr, "Show real HDR state and toggle or set HDR where supported."),
    actionDef(name, "Power Plan", ACTIONS[flavor].power, "Show the active Windows power plan and cycle or choose a plan."),
    actionDef(name, "Display Topology", ACTIONS[flavor].display, "Show and change Windows display topology: PC screen, duplicate, extend, or second screen."),
    actionDef(name, "Screen & Sleep", ACTIONS[flavor].timeout, "Show screen timeout and cycle or set screen and sleep timeouts."),
    actionDef(name, "Keep Awake", ACTIONS[flavor].awake, "Prevent idle display-off and sleep while this plugin backend is active."),
    actionDef(name, "Lock PC", ACTIONS[flavor].lock, "Lock the current Windows workstation.")
  ];

  if (pro) {
    actions.push(
      actionDef(name, "Apply PC Mode", ACTIONS.pro.apply, "Apply only the Windows settings saved in the selected PC Mode."),
      actionDef(name, "Cycle PC Mode", ACTIONS.pro.cycle, "Cycle through configured PC Modes and apply the next one."),
      actionDef(name, "Current PC Mode", ACTIONS.pro.current, "Show which saved PC Mode matches the live Windows state."),
      actionDef(name, "Save Current Mode", ACTIONS.pro.save, "Capture the currently readable Windows settings into a PC Mode."),
      { ...actionDef(name, "Profile Page", ACTIONS.pro.page, "Navigate the bundled PC Modes profile."), VisibleInActionsList: false }
    );
  }

  return {
    "$schema": "https://schemas.elgato.com/streamdeck/plugins/manifest.json",
    Name: name,
    Version: "0.1.0.0",
    Author: "PackRat",
    Description: pro
      ? "PC Modes and live Windows system controls for HDR, power, display topology, screen and sleep, Keep Awake, and lock."
      : "Live Windows system controls for HDR, power, display topology, screen and sleep, Keep Awake, and lock.",
    Category: name,
    CategoryIcon: "imgs/plugin/category-icon",
    Icon: "imgs/plugin/marketplace",
    CodePath: "bin/plugin.js",
    SDKVersion: 3,
    Software: { MinimumVersion: "7.3" },
    OS: [{ Platform: "windows", MinimumVersion: "10" }],
    Nodejs: { Version: "20", Debug: "enabled" },
    UUID: uuid,
    Profiles: profiles,
    Actions: actions
  };
}

function actionDef(category, name, uuid, tooltip) {
  return {
    Name: name,
    UUID: uuid,
    Icon: "imgs/actions/common/icon",
    Tooltip: tooltip,
    PropertyInspectorPath: "ui/config.html",
    Controllers: ["Keypad"],
    States: [{
      Image: "imgs/actions/common/key",
      TitleAlignment: "middle",
      ShowTitle: true
    }]
  };
}

async function buildProfiles(flavor, plugin) {
  const registrations = [];
  for (const device of DEVICES) {
    const stem = `windows-settings-${flavor}-${device.id}`;
    const profileName = `profiles/${stem}`;
    const displayName = flavor === "pro"
      ? `Windows PC Modes Pro - ${device.label}`
      : `Windows Settings Lite - ${device.label}`;

    const pages = flavor === "pro"
      ? [
          profilePage(proModesPage(device, profileName)),
          profilePage(proSettingsPage(device, profileName))
        ]
      : [profilePage(litePage(device))];

    const archive = createProfileArchive({
      seed: `${flavor}|${device.id}`,
      name: displayName,
      pages
    });
    await writeFile(path.join(plugin, "profiles", `${stem}.streamDeckProfile`), archive);
    registrations.push({
      Name: profileName,
      DeviceType: device.deviceType,
      Readonly: false,
      DontAutoSwitchWhenInstalled: true,
      AutoInstall: true
    });
  }
  return registrations;
}

function litePage(device) {
  const defs = [
    item("status", "System Status"),
    item("hdr", "HDR"),
    item("power", "Power Plan"),
    item("display", "Display Topology"),
    item("timeout", "Screen & Sleep"),
    item("awake", "Keep Awake"),
    item("lock", "Lock PC")
  ];
  if (device.id === "mini") defs.splice(4, 1);
  return layout(device, defs.map((def) => pluginAction("lite", def.kind, def.name, {}, `lite|${device.id}|${def.kind}`)));
}

function proModesPage(device, profileName) {
  const defs = MODE_IDS.map((id) => pluginAction("pro", "apply", id.toUpperCase(), { modeId: id }, `pro|${device.id}|apply|${id}`));

  if (device.columns * device.rows >= 15) {
    for (const id of MODE_IDS) {
      defs.push(pluginAction("pro", "save", `Save ${id}`, { modeId: id }, `pro|${device.id}|save|${id}`));
    }
    defs.push(pluginAction("pro", "current", "Current PC Mode", {}, `pro|${device.id}|current`));
    defs.push(pluginAction("pro", "cycle", "Cycle PC Mode", {}, `pro|${device.id}|cycle`));
    defs.push(pluginAction("pro", "hdr", "HDR", {}, `pro|${device.id}|modes-hdr`));
    defs.push(pluginAction("pro", "power", "Power Plan", {}, `pro|${device.id}|modes-power`));
    defs.push(pluginAction("pro", "page", "Settings", { profileName, page: 1 }, `pro|${device.id}|settings-page`));
  } else if (device.columns * device.rows >= 8) {
    defs.push(pluginAction("pro", "current", "Current PC Mode", {}, `pro|${device.id}|current`));
    defs.push(pluginAction("pro", "cycle", "Cycle PC Mode", {}, `pro|${device.id}|cycle`));
    defs.push(pluginAction("pro", "page", "Settings", { profileName, page: 1 }, `pro|${device.id}|settings-page`));
  } else {
    defs.push(pluginAction("pro", "page", "Settings", { profileName, page: 1 }, `pro|${device.id}|settings-page`));
  }
  return layout(device, defs);
}

function proSettingsPage(device, profileName) {
  const capacity = device.columns * device.rows;
  const controls = [
    ["hdr", "HDR"],
    ["power", "Power Plan"],
    ["display", "Display Topology"],
    ["timeout", "Screen & Sleep"],
    ["awake", "Keep Awake"],
    ["lock", "Lock PC"],
    ["status", "System Status"]
  ];

  const defs = controls
    .filter(([kind]) => !(device.id === "mini" && (kind === "timeout" || kind === "status")))
    .map(([kind, name]) => pluginAction("pro", kind, name, {}, `pro|${device.id}|settings|${kind}`));

  if (capacity >= 15) {
    for (const id of MODE_IDS) {
      defs.push(pluginAction("pro", "save", `Save ${id}`, { modeId: id }, `pro|${device.id}|settings-save|${id}`));
    }
  }
  defs.push(pluginAction("pro", "page", "PC Modes", { profileName, page: 0 }, `pro|${device.id}|modes-page`));
  return layout(device, defs.slice(0, capacity));
}

function profilePage(actions) {
  return { Controllers: [{ Actions: actions, Type: "Keypad" }] };
}

function layout(device, actions) {
  const mapped = {};
  actions.slice(0, device.columns * device.rows).forEach((value, index) => {
    mapped[`${index % device.columns},${Math.floor(index / device.columns)}`] = value;
  });
  return mapped;
}

function pluginAction(flavor, kind, name, settings, seed) {
  return {
    ActionID: deterministicUuid(`wsm|${seed}`),
    LinkedTitle: true,
    Name: name,
    UUID: ACTIONS[flavor][kind],
    Settings: settings,
    State: 0,
    States: [{ Title: "", ShowTitle: true, TitleAlignment: "middle" }]
  };
}

function item(kind, name) { return { kind, name }; }

function createProfileArchive({ seed, name, pages }) {
  const rootUuid = deterministicUuid(`wsm-profile|${seed}|root`).toUpperCase();
  const pageUuids = pages.map((_, index) => deterministicUuid(`wsm-profile|${seed}|page|${index}`));
  const root = `${rootUuid}.sdProfile`;
  const entries = [[
    `${root}/manifest.json`,
    jsonBuffer({
      Device: { Model: "", UUID: "" },
      Name: name,
      Pages: { Current: pageUuids[0], Pages: pageUuids },
      Version: "2.0"
    })
  ]];

  pages.forEach((page, index) => {
    entries.push([
      `${root}/Profiles/${profileFolderId(pageUuids[index])}/manifest.json`,
      jsonBuffer(page)
    ]);
  });
  return createStoredZip(entries);
}

function deterministicUuid(seed) {
  const bytes = Buffer.from(createHash("sha256").update(seed).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function profileFolderId(uuid) {
  return ((uuid.replaceAll("-", "") + "000").match(/.{5}/g) ?? [])
    .map((value) => Number.parseInt(value, 16).toString(32).padStart(4, "0"))
    .join("")
    .slice(0, 26)
    .toUpperCase()
    .replaceAll("V", "W")
    .replaceAll("U", "V") + "Z";
}

function jsonBuffer(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8");
}

function createStoredZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [nameValue, data] of entries) {
    const name = Buffer.from(nameValue.replaceAll("\\", "/"), "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);
    offset += local.length + name.length + data.length;
  }
  const centralData = Buffer.concat(central);
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

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><g fill="#FFFFFF"><rect x="8" y="8" width="17" height="17" rx="2"/><rect x="31" y="8" width="17" height="17" rx="2"/><rect x="8" y="31" width="17" height="17" rx="2"/><rect x="31" y="31" width="17" height="17" rx="2"/></g></svg>`;
}

function keySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144"><rect width="144" height="144" rx="24" fill="#0f1218"/><g fill="#eef1f5"><rect x="33" y="32" width="34" height="34" rx="4"/><rect x="77" y="32" width="34" height="34" rx="4"/><rect x="33" y="76" width="34" height="34" rx="4"/><rect x="77" y="76" width="34" height="34" rx="4"/></g></svg>`;
}

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const ASSETS = path.join(ROOT, "assets");
const UI = path.join(ROOT, "ui");
const BACKEND = path.join(ROOT, "scripts", "windows-settings-backend.ps1");
const PACKRAT_LOGO = path.resolve(ROOT, "..", "..", "..", "tools", "art", "assets", "ratpack-icon-transparent.png");
const LITE_PRO_MAP = path.resolve(ROOT, "..", "..", "lite-pro-map.json");
const PRO_MARKETPLACE_URL = await resolveProMarketplaceUrl();

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
    lock: "com.packrat.windows-settings-manager-lite.lock",
    sleep: "com.packrat.windows-settings-manager-lite.sleep",
    power: "com.packrat.windows-settings-manager-lite.power",
    awake: "com.packrat.windows-settings-manager-lite.awake",
    desktopPrev: "com.packrat.windows-settings-manager-lite.desktop-previous",
    desktopNext: "com.packrat.windows-settings-manager-lite.desktop-next"
  },
  pro: {
    lock: "com.packrat.windows-settings-manager-pro.lock",
    sleep: "com.packrat.windows-settings-manager-pro.sleep",
    hibernate: "com.packrat.windows-settings-manager-pro.hibernate",
    restart: "com.packrat.windows-settings-manager-pro.restart",
    shutdown: "com.packrat.windows-settings-manager-pro.shutdown",
    wifi: "com.packrat.windows-settings-manager-pro.wifi",
    bluetooth: "com.packrat.windows-settings-manager-pro.bluetooth",
    power: "com.packrat.windows-settings-manager-pro.power",
    awake: "com.packrat.windows-settings-manager-pro.awake",
    theme: "com.packrat.windows-settings-manager-pro.theme",
    desktopPrev: "com.packrat.windows-settings-manager-pro.desktop-previous",
    desktopNext: "com.packrat.windows-settings-manager-pro.desktop-next",
    desktopNew: "com.packrat.windows-settings-manager-pro.desktop-new",
    desktopClose: "com.packrat.windows-settings-manager-pro.desktop-close",
    desktopCurrent: "com.packrat.windows-settings-manager-pro.desktop-current",
    status: "com.packrat.windows-settings-manager-pro.status",
    hdr: "com.packrat.windows-settings-manager-pro.hdr",
    display: "com.packrat.windows-settings-manager-pro.display",
    timeout: "com.packrat.windows-settings-manager-pro.timeout",
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
  await copyFile(PACKRAT_LOGO, path.join(plugin, "ui", "packrat-icon.png"));
  await copyFile(path.join(ASSETS, "marketplace.png"), path.join(plugin, "imgs", "plugin", "marketplace.png"));
  await copyFile(path.join(ASSETS, "marketplace@2x.png"), path.join(plugin, "imgs", "plugin", "marketplace@2x.png"));
  for (const file of ["config.html", "pi.css", "pi.js"]) {
    const source = path.join(UI, file);
    const target = path.join(plugin, "ui", file);
    if (file !== "pi.js") {
      await copyFile(source, target);
      continue;
    }

    const raw = await readFile(source, "utf8");
    const marker = 'const PRO_MARKETPLACE_URL = "";';
    if (!raw.includes(marker)) throw new Error("Property Inspector Pro URL injection marker is missing.");
    await writeFile(
      target,
      raw.replace(marker, `const PRO_MARKETPLACE_URL = ${JSON.stringify(PRO_MARKETPLACE_URL)};`)
    );
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

async function resolveProMarketplaceUrl() {
  const data = JSON.parse(await readFile(LITE_PRO_MAP, "utf8"));
  const pair = data.pairs?.find((item) =>
    item.lite_id === "windows-settings-manager-lite"
    && item.pro_id === "windows-settings-manager-pro"
  );
  if (!pair) throw new Error("Windows Settings Manager Lite/Pro relationship is missing.");

  const url = typeof pair.pro_marketplace_url === "string"
    ? pair.pro_marketplace_url.trim()
    : "";
  if (!url) return "";

  const directProductUrl = /^https:\/\/marketplace\.elgato\.com\/product\/[a-z0-9][a-z0-9-]*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i;
  if (!directProductUrl.test(url)) {
    throw new Error(`Windows Settings Manager Pro upsell URL is not a verified direct Marketplace product URL: ${url}`);
  }
  return url;
}

function manifest(flavor, profiles) {
  const pro = flavor === "pro";
  const name = pro ? "Windows Settings Manager Pro" : "Windows Settings Manager Lite";
  const uuid = `com.packrat.windows-settings-manager-${flavor}`;

  const actions = pro
    ? [
        actionDef(name, "Lock PC", ACTIONS.pro.lock, "Lock the current Windows workstation immediately."),
        actionDef(name, "Sleep", ACTIONS.pro.sleep, "Put this PC into Windows sleep."),
        actionDef(name, "Hibernate", ACTIONS.pro.hibernate, "Hibernate this PC when Windows reports hibernation is available."),
        actionDef(name, "Restart", ACTIONS.pro.restart, "Restart Windows. Default behavior requires a second press within three seconds."),
        actionDef(name, "Shutdown", ACTIONS.pro.shutdown, "Shut down Windows. Default behavior requires a second press within three seconds."),
        actionDef(name, "Wi-Fi", ACTIONS.pro.wifi, "Show live Windows Wi-Fi radio state and request Toggle, On, or Off through the Windows radio API."),
        actionDef(name, "Bluetooth", ACTIONS.pro.bluetooth, "Show live Windows Bluetooth radio state and request Toggle, On, or Off through the Windows radio API."),
        actionDef(name, "Power Plan", ACTIONS.pro.power, "Show the active Windows power plan and cycle or choose an exact plan."),
        actionDef(name, "Keep Awake", ACTIONS.pro.awake, "Toggle or explicitly set Stay Awake. It prevents idle display-off and sleep while the plugin backend is active."),
        actionDef(name, "Light / Dark Theme", ACTIONS.pro.theme, "Show and change Windows light/dark personalization state for apps, system, or both."),
        actionDef(name, "Previous Desktop", ACTIONS.pro.desktopPrev, "Move to the previous Windows virtual desktop and verify the resulting desktop state."),
        actionDef(name, "Next Desktop", ACTIONS.pro.desktopNext, "Move to the next Windows virtual desktop and verify the resulting desktop state."),
        actionDef(name, "New Desktop", ACTIONS.pro.desktopNew, "Create a Windows virtual desktop and verify that it was created."),
        actionDef(name, "Close Desktop", ACTIONS.pro.desktopClose, "Close the current Windows virtual desktop. The only desktop is never closed."),
        actionDef(name, "Current Desktop", ACTIONS.pro.desktopCurrent, "Show the current Windows virtual desktop index and desktop count."),
        actionDef(name, "System Status", ACTIONS.pro.status, "Refresh the Windows state used by every key."),
        actionDef(name, "HDR", ACTIONS.pro.hdr, "Advanced control retained for compatibility. Monitor Manager remains PackRat's deep display product."),
        actionDef(name, "Display Topology", ACTIONS.pro.display, "Advanced projection-topology control retained for compatibility."),
        actionDef(name, "Screen & Sleep Timeouts", ACTIONS.pro.timeout, "Advanced screen-off and sleep timeout control."),
        actionDef(name, "Apply PC Mode", ACTIONS.pro.apply, "Advanced optional PC Mode. Only explicitly saved settings are changed."),
        actionDef(name, "Cycle PC Mode", ACTIONS.pro.cycle, "Cycle through configured optional PC Modes."),
        actionDef(name, "Current PC Mode", ACTIONS.pro.current, "Show which optional saved PC Mode matches live Windows state."),
        actionDef(name, "Save Current Mode", ACTIONS.pro.save, "Capture readable Windows state into an optional PC Mode."),
        { ...actionDef(name, "Profile Page", ACTIONS.pro.page, "Navigate a bundled profile page."), VisibleInActionsList: false }
      ]
    : [
        actionDef(name, "Lock PC", ACTIONS.lite.lock, "Lock the current Windows workstation immediately."),
        actionDef(name, "Sleep", ACTIONS.lite.sleep, "Put this PC into Windows sleep."),
        actionDef(name, "Power Plan", ACTIONS.lite.power, "Show the active Windows power plan and cycle or choose an exact plan."),
        actionDef(name, "Keep Awake", ACTIONS.lite.awake, "Toggle or explicitly set Stay Awake."),
        actionDef(name, "Previous Desktop", ACTIONS.lite.desktopPrev, "Move to the previous Windows virtual desktop and verify the resulting state."),
        actionDef(name, "Next Desktop", ACTIONS.lite.desktopNext, "Move to the next Windows virtual desktop and verify the resulting state.")
      ];

  return {
    "$schema": "https://schemas.elgato.com/streamdeck/plugins/manifest.json",
    Name: name,
    Version: "0.1.0.0",
    Author: "PackRat",
    Description: pro
      ? "Premium Windows controls for Stream Deck with live state: power, radios, power plans, Keep Awake, theme, and virtual desktops."
      : "Six useful Windows controls for Stream Deck: lock, sleep, power plan, Keep Awake, and virtual desktop navigation.",
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
      FontSize: 14,
      ShowTitle: false
    }]
  };
}

async function buildProfiles(flavor, plugin) {
  const registrations = [];
  for (const device of DEVICES) {
    const stem = `windows-settings-${flavor}-${device.id}`;
    const profileName = `profiles/${stem}`;
    const displayName = flavor === "pro"
      ? `Windows Control Center Pro - ${device.label}`
      : `Windows Control Center Lite - ${device.label}`;

    const page = flavor === "pro" ? proPage(device) : litePage(device);
    const archive = createProfileArchive({
      seed: `${flavor}|${device.id}`,
      name: displayName,
      pages: [profilePage(page)]
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
    profileDef("lock", "Lock PC"),
    profileDef("sleep", "Sleep"),
    profileDef("power", "Power Plan", { operation: "cycle" }),
    profileDef("awake", "Keep Awake", { operation: "toggle" }),
    profileDef("desktopPrev", "Previous Desktop"),
    profileDef("desktopNext", "Next Desktop")
  ];
  return layout(device, defs.map((def) =>
    pluginAction("lite", def.kind, def.name, def.settings, `lite|${device.id}|${def.kind}`)
  ));
}

function proPage(device) {
  const core = [
    profileDef("lock", "Lock PC"),
    profileDef("sleep", "Sleep"),
    profileDef("hibernate", "Hibernate"),
    profileDef("restart", "Restart", { confirmation: "double" }),
    profileDef("shutdown", "Shutdown", { confirmation: "double" }),
    profileDef("wifi", "Wi-Fi", { operation: "toggle" }),
    profileDef("bluetooth", "Bluetooth", { operation: "toggle" }),
    profileDef("power", "Power Plan", { operation: "cycle" }),
    profileDef("awake", "Keep Awake", { operation: "toggle" }),
    profileDef("theme", "Light / Dark", { operation: "toggle", scope: "both" }),
    profileDef("desktopPrev", "Previous Desktop"),
    profileDef("desktopNext", "Next Desktop"),
    profileDef("desktopNew", "New Desktop"),
    profileDef("desktopClose", "Close Desktop"),
    profileDef("desktopCurrent", "Current Desktop")
  ];

  let defs;
  if (device.id === "mini") {
    defs = [
      core[0], core[1], core[5], core[6], core[10], core[11]
    ];
  } else if (device.id === "plus" || device.id === "neo") {
    defs = [
      core[0], core[1], core[5], core[6], core[7], core[8], core[10], core[11]
    ];
  } else if (device.id === "galleon") {
    defs = core.slice(0, 12);
  } else {
    defs = [...core];
  }

  const capacity = device.columns * device.rows;
  if (capacity > core.length) {
    defs.push(
      profileDef("status", "System Status"),
      profileDef("hdr", "HDR"),
      profileDef("display", "Display Topology"),
      profileDef("timeout", "Screen & Sleep")
    );
    if (capacity >= 24) {
      for (const id of MODE_IDS) {
        defs.push(profileDef("apply", id.toUpperCase(), { modeId: id }));
      }
    }
    if (capacity >= 30) {
      defs.push(
        profileDef("current", "Current PC Mode"),
        profileDef("cycle", "Cycle PC Mode")
      );
    }
  }

  return layout(device, defs.slice(0, capacity).map((def, index) =>
    pluginAction("pro", def.kind, def.name, def.settings, `pro|${device.id}|${index}|${def.kind}`)
  ));
}

function profileDef(kind, name, settings = {}) {
  return { kind, name, settings };
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
    States: [{ Title: "", ShowTitle: false, TitleAlignment: "middle", FontSize: 14 }]
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="24" fill="#080A0E"/>
    <rect x="4" y="4" width="136" height="136" rx="21" fill="none" stroke="#303640" stroke-width="3"/>
    <path d="M22 12h100" stroke="#FFB21E" stroke-width="4" stroke-linecap="round"/>
    <g fill="none" stroke="#F5F7FB" stroke-width="5" stroke-linejoin="round">
      <rect x="49" y="39" width="19" height="19" rx="3"/>
      <rect x="76" y="39" width="19" height="19" rx="3"/>
      <rect x="49" y="66" width="19" height="19" rx="3"/>
      <rect x="76" y="66" width="19" height="19" rx="3"/>
    </g>
  </svg>`;
}

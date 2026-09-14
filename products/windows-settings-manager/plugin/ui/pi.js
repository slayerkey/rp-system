let websocket = null;
let uuid = null;
let actionUuid = "";
let settings = {};
let context = { flavor: "lite", snapshot: null, modes: [] };
let built = false;
let modeDirty = false;
const PRO_MARKETPLACE_URL = "";

function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
  uuid = inUUID;
  try {
    const info = JSON.parse(inActionInfo);
    actionUuid = info.action ?? "";
    settings = info.payload?.settings ?? {};
  } catch {
    actionUuid = "";
    settings = {};
  }

  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);
  websocket.onopen = () => {
    websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
    if (!built) { build(); built = true; }
    renderActionSettings();
    requestContext();
  };
  websocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.event === "didReceiveSettings") {
      settings = message.payload?.settings ?? {};
      renderActionSettings();
    }
    if (message.event === "sendToPropertyInspector" && message.payload?.type === "context") {
      context = message.payload;
      renderContext();
    }
  };
}

function saveActionSettings(next) {
  settings = { ...settings, ...next };
  if (websocket?.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify({
    event: "setSettings",
    action: actionUuid,
    context: uuid,
    payload: settings
  }));
}

function sendPlugin(payload) {
  if (websocket?.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify({
    event: "sendToPlugin",
    action: actionUuid,
    context: uuid,
    payload
  }));
}

function requestContext() { sendPlugin({ type: "get-context" }); }

function build() {
  document.getElementById("refresh").addEventListener("click", () => sendPlugin({ type: "refresh" }));
  document.getElementById("proUpgrade").addEventListener("click", () => {
    if (!PRO_MARKETPLACE_URL || websocket?.readyState !== WebSocket.OPEN) return;
    websocket.send(JSON.stringify({
      event: "openUrl",
      payload: { url: PRO_MARKETPLACE_URL }
    }));
  });

  bindSelect("toggleOperation", "operation");
  bindSelect("themeOperation", "operation");
  bindSelect("themeScope", "scope");
  bindSelect("confirmation", "confirmation");
  bindSelect("hdrOperation", "operation");
  bindSelect("powerOperation", "operation");
  bindSelect("powerGuid", "guid");
  bindSelect("displayOperation", "operation");
  bindSelect("displayTopology", "topology");
  bindSelect("timeoutOperation", "operation");
  bindNumber("monitorAcSeconds");
  bindNumber("monitorDcSeconds");
  bindNumber("sleepAcSeconds");
  bindNumber("sleepDcSeconds");
  bindSelect("actionModeId", "modeId");

  document.getElementById("editModeId").addEventListener("change", () => {
    modeDirty = false;
    populateModeEditor();
  });
  for (const id of ["modeName", "modeHdr", "modeTopology", "modePower", "modeAwake", "modeTimeoutEnabled", "modeMonitorAc", "modeMonitorDc", "modeSleepAc", "modeSleepDc"]) {
    document.getElementById(id).addEventListener("input", () => { modeDirty = true; });
    document.getElementById(id).addEventListener("change", () => { modeDirty = true; });
  }

  document.getElementById("saveMode").addEventListener("click", () => {
    const id = document.getElementById("editModeId").value || "gaming";
    const nextSettings = editorSettings();
    if (!nextSettings) {
      document.getElementById("errors").textContent =
        "Timeout values must be whole seconds from 0 to 4294967295. Blank values are not saved as Never.";
      return;
    }
    sendPlugin({
      type: "save-mode",
      id,
      name: document.getElementById("modeName").value.trim() || id.toUpperCase(),
      settings: nextSettings
    });
    modeDirty = false;
  });

  document.getElementById("captureMode").addEventListener("click", () => {
    const id = document.getElementById("editModeId").value || "gaming";
    sendPlugin({ type: "capture-mode", id });
    modeDirty = false;
  });
}

function bindSelect(id, key) {
  document.getElementById(id).addEventListener("change", (event) => saveActionSettings({ [key]: event.target.value }));
}

function bindNumber(id) {
  document.getElementById(id).addEventListener("change", (event) => {
    const raw = event.target.value.trim();
    const number = Number(raw);
    if (raw !== "" && Number.isInteger(number) && number >= 0 && number <= 0xffffffff) {
      saveActionSettings({ [id]: number });
    }
  });
}

function actionSuffix() {
  return actionUuid.split(".").pop() || "";
}

function renderActionSettings() {
  const suffix = actionSuffix();
  for (const id of [
    "toggleFields",
    "themeFields",
    "confirmFields",
    "hdrFields",
    "powerFields",
    "displayFields",
    "timeoutFields",
    "modeActionFields"
  ]) {
    document.getElementById(id).classList.add("hidden");
  }

  let has = true;
  if (suffix === "wifi" || suffix === "bluetooth" || suffix === "awake") {
    show("toggleFields");
    setValue("toggleOperation", settings.operation ?? "toggle");
    document.getElementById("toggleHelp").textContent = suffix === "wifi"
      ? "Uses the Windows radio API and re-reads the effective Wi-Fi radio state. If Windows policy or hardware denies control, the key fails closed instead of pretending it changed."
      : suffix === "bluetooth"
        ? "Controls the PC's global Bluetooth radio, not an individual headset or peripheral. Individual devices belong in Wireless Device Manager."
        : "On means STAY AWAKE. Off means SLEEP NORMAL. Turning this off does not immediately put the PC to sleep.";
  } else if (suffix === "theme") {
    show("themeFields");
    setValue("themeOperation", settings.operation ?? "toggle");
    setValue("themeScope", settings.scope ?? "both");
  } else if (suffix === "restart" || suffix === "shutdown") {
    show("confirmFields");
    setValue("confirmation", settings.confirmation ?? "double");
  } else if (suffix === "hdr") {
    show("hdrFields");
    setValue("hdrOperation", settings.operation ?? "toggle");
  } else if (suffix === "power") {
    show("powerFields");
    setValue("powerOperation", settings.operation ?? "cycle");
  } else if (suffix === "display") {
    show("displayFields");
    setValue("displayOperation", settings.operation ?? "cycle");
    const liveTopology = context.snapshot?.topology;
    setValue(
      "displayTopology",
      settings.topology ?? (["internal", "clone", "extend", "external"].includes(liveTopology) ? liveTopology : "")
    );
  } else if (suffix === "timeout") {
    show("timeoutFields");
    setValue("timeoutOperation", settings.operation ?? "cycle-screen");
    const liveTimeout = context.snapshot?.timeout;
    for (const id of ["monitorAcSeconds", "monitorDcSeconds", "sleepAcSeconds", "sleepDcSeconds"]) {
      setValue(id, settings[id] ?? liveTimeout?.[id] ?? "");
    }
  } else if (suffix === "apply-mode" || suffix === "save-mode") {
    show("modeActionFields");
  } else {
    has = false;
  }

  const noAction = document.getElementById("noActionSettings");
  noAction.classList.toggle("hidden", has);
  if (!has) noAction.textContent = noSettingsHelp(suffix);

  const modeRelated = ["apply-mode", "save-mode", "current-mode", "cycle-mode"].includes(suffix);
  document.getElementById("modeEditor").classList.toggle(
    "hidden",
    context.flavor !== "pro" || !modeRelated
  );

  renderDynamicSelects();
}

function noSettingsHelp(suffix) {
  const copy = {
    lock: "Pressing this key immediately locks the current Windows workstation.",
    sleep: "Pressing this key immediately requests Windows sleep.",
    hibernate: "Pressing this key requests Windows hibernation only when hibernation is available. Otherwise the key shows N/A and does nothing.",
    "desktop-previous": "Moves one Windows virtual desktop left. At the first desktop it safely does nothing.",
    "desktop-next": "Moves one Windows virtual desktop right. At the last desktop it safely does nothing.",
    "desktop-new": "Creates a new Windows virtual desktop and verifies that the desktop count increased.",
    "desktop-close": "Closes the current virtual desktop after verification. The only desktop is never closed.",
    "desktop-current": "Read-only. Shows the current virtual desktop index and total desktop count.",
    status: "Press to refresh all live Windows state. A successful refresh shows the Stream Deck OK check.",
    "current-mode": "Advanced read-only action showing which configured PC Mode matches the live Windows state.",
    "cycle-mode": "Advanced action that cycles only through configured PC Modes. Empty modes are skipped."
  };
  return copy[suffix] ?? "This key has no extra settings.";
}

function renderContext() {
  const snapshot = context.snapshot;
  document.getElementById("edition").textContent = context.flavor === "pro"
    ? "Premium Windows Control Center for Stream Deck"
    : "Six useful Windows controls for Stream Deck";
  document.getElementById("liteUpsell").classList.toggle(
    "hidden",
    context.flavor !== "lite" || !PRO_MARKETPLACE_URL
  );

  const live = document.getElementById("live");
  live.textContent = "";
  const offline = Boolean(snapshot && !snapshot.backendOnline);
  const rows = snapshot ? [
    ["Backend", offline ? "Offline" : "Connected"],
    ["Wi-Fi", offline ? "Offline" : radioLabel(snapshot.wifi)],
    ["Bluetooth", offline ? "Offline" : radioLabel(snapshot.bluetooth)],
    ["Power", offline ? "Offline" : (snapshot.powerPlanName || "Unknown")],
    ["Keep Awake", offline ? "Offline" : (snapshot.keepAwake ? "On" : "Off")],
    ["Theme", offline ? "Offline" : themeLabel(snapshot.theme)],
    ["Desktop", offline ? "Offline" : desktopLabel(snapshot.virtualDesktop)],
    ["Hibernate", offline ? "Offline" : (snapshot.hibernateAvailable ? "Available" : "N/A")],
    ["Windows build", snapshot.osBuild || "Unknown"]
  ] : [["Backend", "Waiting"]];
  for (const [label, value] of rows) {
    const cell = document.createElement("div");
    cell.className = "metric";
    const l = document.createElement("span");
    const v = document.createElement("strong");
    l.textContent = label;
    v.textContent = String(value);
    cell.append(l, v);
    live.append(cell);
  }

  document.getElementById("errors").textContent = Array.isArray(snapshot?.errors) && snapshot.errors.length
    ? snapshot.errors.join(" | ")
    : "";

  const hdrUsable = Boolean(
    snapshot?.hdr?.available
    && snapshot.hdr.supportedCount > 0
    && (snapshot.hdr.errors?.length ?? 0) === 0
  );
  const modeHdr = document.getElementById("modeHdr");
  for (const option of modeHdr?.options ?? []) {
    if (option.value === "on" || option.value === "off") option.disabled = !hdrUsable;
  }

  renderActionSettings();
  if (!modeDirty) populateModeEditor();
}

function renderDynamicSelects() {
  fillModeSelect("actionModeId", settings.modeId || "gaming");
  fillModeSelect("editModeId", document.getElementById("editModeId").value || "gaming");

  const plans = context.snapshot?.powerPlans ?? [];
  fillPowerSelect("powerGuid", plans, settings.guid || context.snapshot?.powerPlanGuid || "", false);
  fillPowerSelect("modePower", plans, document.getElementById("modePower").value, true);
}

function fillModeSelect(id, selected) {
  const select = document.getElementById(id);
  if (!select) return;
  select.textContent = "";
  for (const mode of context.modes ?? []) {
    const option = document.createElement("option");
    option.value = mode.id;
    option.textContent = mode.name;
    select.appendChild(option);
  }
  if (selected && [...select.options].some((o) => o.value === selected)) select.value = selected;
}

function fillPowerSelect(id, plans, selected, allowIgnore) {
  const select = document.getElementById(id);
  if (!select) return;
  select.textContent = "";
  if (allowIgnore) addOption(select, "", "Ignore");
  for (const plan of plans) addOption(select, plan.guid, plan.name || plan.guid);
  if (selected && !plans.some((p) => p.guid === selected)) addOption(select, selected, selected);
  if ([...select.options].some((o) => o.value === selected)) select.value = selected;
}

function populateModeEditor() {
  if (context.flavor !== "pro") return;
  const id = document.getElementById("editModeId").value || "gaming";
  const mode = (context.modes ?? []).find((item) => item.id === id);
  if (!mode) return;
  const s = mode.settings ?? {};
  setValue("modeName", mode.name);
  setValue("modeHdr", s.hdr === true ? "on" : s.hdr === false ? "off" : "");
  setValue("modeTopology", s.topology ?? "");
  fillPowerSelect("modePower", context.snapshot?.powerPlans ?? [], s.powerPlanGuid ?? "", true);
  setValue("modePower", s.powerPlanGuid ?? "");
  setValue("modeAwake", s.keepAwake === true ? "on" : s.keepAwake === false ? "off" : "");

  const includeTimeout = Boolean(s.timeout);
  document.getElementById("modeTimeoutEnabled").checked = includeTimeout;
  const timeout = s.timeout ?? context.snapshot?.timeout ?? {};
  setValue("modeMonitorAc", timeout.monitorAcSeconds ?? 900);
  setValue("modeMonitorDc", timeout.monitorDcSeconds ?? 600);
  setValue("modeSleepAc", timeout.sleepAcSeconds ?? 1800);
  setValue("modeSleepDc", timeout.sleepDcSeconds ?? 900);
}

function editorSettings() {
  const result = {};
  const hdr = document.getElementById("modeHdr").value;
  if (hdr) result.hdr = hdr === "on";

  const topology = document.getElementById("modeTopology").value;
  if (topology) result.topology = topology;

  const power = document.getElementById("modePower").value;
  if (power) result.powerPlanGuid = power;

  const awake = document.getElementById("modeAwake").value;
  if (awake) result.keepAwake = awake === "on";

  if (document.getElementById("modeTimeoutEnabled").checked) {
    const values = [
      seconds("modeMonitorAc"),
      seconds("modeMonitorDc"),
      seconds("modeSleepAc"),
      seconds("modeSleepDc")
    ];
    if (values.some((value) => value === null)) return null;
    result.timeout = {
      monitorAcSeconds: values[0],
      monitorDcSeconds: values[1],
      sleepAcSeconds: values[2],
      sleepDcSeconds: values[3]
    };
  }
  return result;
}

function seconds(id) {
  const raw = document.getElementById(id).value.trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff ? value : null;
}

function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function show(id) { document.getElementById(id).classList.remove("hidden"); }

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el && document.activeElement !== el) el.value = value;
}

function radioLabel(radio) {
  if (!radio?.available) return "N/A";
  if (radio.state === "on") return "On";
  if (radio.state === "off") return "Off";
  if (radio.state === "disabled") return "Disabled";
  if (radio.state === "mixed") return "Mixed";
  return "N/A";
}

function themeLabel(theme) {
  if (!theme?.available) return "N/A";
  if (theme.combined === "dark") return "Dark";
  if (theme.combined === "light") return "Light";
  if (theme.combined === "mixed") return "Mixed";
  return "N/A";
}

function desktopLabel(desktop) {
  if (!desktop?.available || !desktop.currentIndex || !desktop.count) return "N/A";
  return `${desktop.currentIndex} / ${desktop.count}`;
}

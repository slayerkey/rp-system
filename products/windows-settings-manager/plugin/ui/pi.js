let websocket = null;
let uuid = null;
let actionUuid = "";
let settings = {};
let context = { flavor: "lite", snapshot: null, modes: [] };
let built = false;
let modeDirty = false;

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
    sendPlugin({
      type: "save-mode",
      id,
      name: document.getElementById("modeName").value.trim() || id.toUpperCase(),
      settings: editorSettings()
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
    const number = Number(event.target.value);
    if (Number.isInteger(number) && number >= 0) saveActionSettings({ [id]: number });
  });
}

function renderActionSettings() {
  const suffix = actionUuid.split(".").pop() || "";
  for (const id of ["hdrFields", "powerFields", "displayFields", "timeoutFields", "modeActionFields"]) {
    document.getElementById(id).classList.add("hidden");
  }

  let has = true;
  if (suffix === "hdr") {
    show("hdrFields");
    setValue("hdrOperation", settings.operation ?? "toggle");
  } else if (suffix === "power") {
    show("powerFields");
    setValue("powerOperation", settings.operation ?? "cycle");
  } else if (suffix === "display") {
    show("displayFields");
    setValue("displayOperation", settings.operation ?? "cycle");
    setValue("displayTopology", settings.topology ?? "extend");
  } else if (suffix === "timeout") {
    show("timeoutFields");
    setValue("timeoutOperation", settings.operation ?? "cycle-screen");
    for (const id of ["monitorAcSeconds", "monitorDcSeconds", "sleepAcSeconds", "sleepDcSeconds"]) {
      if (settings[id] !== undefined) setValue(id, settings[id]);
    }
  } else if (suffix === "apply-mode" || suffix === "save-mode") {
    show("modeActionFields");
  } else {
    has = false;
  }
  document.getElementById("noActionSettings").classList.toggle("hidden", has);
  renderDynamicSelects();
}

function renderContext() {
  const snapshot = context.snapshot;
  document.getElementById("edition").textContent = context.flavor === "pro"
    ? "PC Modes & System Controls for Stream Deck"
    : "Windows System Controls for Stream Deck";
  document.getElementById("modeEditor").classList.toggle("hidden", context.flavor !== "pro");

  const live = document.getElementById("live");
  live.textContent = "";
  const rows = snapshot ? [
    ["Backend", snapshot.backendOnline ? "Connected" : "Offline"],
    ["HDR", hdrLabel(snapshot.hdr)],
    ["Display", String(snapshot.topology || "unknown").toUpperCase()],
    ["Power", snapshot.powerPlanName || "Unknown"],
    ["Screen AC", duration(snapshot.timeout?.monitorAcSeconds)],
    ["Sleep AC", duration(snapshot.timeout?.sleepAcSeconds)],
    ["Keep Awake", snapshot.keepAwake ? "On" : "Off"],
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

  renderDynamicSelects();
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
    result.timeout = {
      monitorAcSeconds: seconds("modeMonitorAc"),
      monitorDcSeconds: seconds("modeMonitorDc"),
      sleepAcSeconds: seconds("modeSleepAc"),
      sleepDcSeconds: seconds("modeSleepDc")
    };
  }
  return result;
}

function seconds(id) {
  const value = Number(document.getElementById(id).value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
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
function duration(seconds) {
  if (seconds === undefined || seconds === null) return "N/A";
  if (seconds === 0) return "Never";
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}
function hdrLabel(hdr) {
  if (!hdr?.available || hdr.supportedCount === 0) return "N/A";
  if (hdr.mixed) return "Mixed";
  return hdr.enabledCount === hdr.supportedCount ? "On" : "Off";
}

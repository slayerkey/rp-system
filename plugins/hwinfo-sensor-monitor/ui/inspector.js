(() => {
  "use strict";
  const ACTION_KIND = {
    "com.packrat.hwinfo-sensor-monitor.sensor": "sensor",
    "com.packrat.hwinfo-sensor-monitor.graph": "graph",
    "com.packrat.hwinfo-sensor-monitor.dashboard": "dashboard",
    "com.packrat.hwinfo-sensor-monitor.alert": "alert"
  };
  let socket = null, uiUuid = "", actionContext = "", actionUuid = "", kind = "sensor";
  let settings = {}, statusSnapshot = null, searchOffset = 0, searchTotal = 0, query = "", requestCounter = 0;
  let saveTimer = null, searchTimer = null;
  const $ = (id) => document.getElementById(id);
  const settingFields = ["customLabel","precision","showMinMax","refreshMs","accent","historyEnabled","historyWindowMs","thresholdDirection","warningThreshold","criticalThreshold","visualAttention"];

  function send(event) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event)); }
  function sendPlugin(payload) {
    // PackRat PI transport uses the PI UUID for websocket context: context: uiUuid
    send({ event: "sendToPlugin", action: actionUuid, context: uiUuid, payload: { ...payload, actionContext } });
  }
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => send({ event: "setSettings", action: actionUuid, context: actionContext, payload: settings }), 80);
  }
  function readField(id) {
    const el = $(id);
    if (!el) return;
    if (el.type === "checkbox") settings[id] = el.checked;
    else if (["precision","refreshMs","historyWindowMs","warningThreshold","criticalThreshold"].includes(id)) {
      const n = Number(el.value); if (Number.isFinite(n)) settings[id] = n;
    } else settings[id] = el.value;
  }
  function paintFields() {
    for (const id of settingFields) {
      const el = $(id); if (!el) continue;
      const value = settings[id];
      if (el.type === "checkbox") el.checked = Boolean(value);
      else if (value !== undefined && value !== null) el.value = String(value);
    }
    $("historyCard").hidden = !(kind === "graph" || kind === "dashboard");
    $("thresholdCard").hidden = kind !== "alert";
    $("attentionWrap").hidden = kind !== "alert";
    $("sensorHeading").textContent = kind === "dashboard" ? "Dashboard sensors" : "Sensor";
  }
  function statusClass(state) {
    return state === "ready" ? "ready" : ["not_running","sensors_inactive","shared_memory_disabled","shared_memory_expired","shared_memory_unavailable","incompatible"].includes(state) ? "error" : "";
  }
  function paintStatus(payload) {
    statusSnapshot = payload;
    const info = payload?.status || {};
    $("statusTitle").textContent = info.title || "Connecting to HWiNFO";
    $("statusDetail").textContent = info.detail || "Waiting for local sensor data.";
    $("statusDot").className = "dot " + statusClass(info.state);
    const snap = payload?.snapshot || {};
    $("statusMeta").textContent = (snap.sensorCount || 0) + " sensors discovered" + (snap.pollingPeriod ? " · HWiNFO poll " + snap.pollingPeriod + " ms" : "");
    const selected = Array.isArray(snap.selected) ? snap.selected : [];
    const item = selected.find((entry) => entry?.sensor)?.sensor;
    if (kind !== "dashboard") {
      $("selectedPreview").textContent = item
        ? (item.deviceName + " · " + item.name + " · " + (item.value ?? "--") + (item.unit ? " " + item.unit : ""))
        : "Selected sensor is not currently available. Your saved sensor identity is preserved.";
    } else {
      const available = selected.filter((entry) => entry?.sensor).length;
      $("selectedPreview").textContent = available + " of " + selected.length + " dashboard sensors currently available.";
    }
  }
  function requestSearch(reset = true) {
    if (reset) searchOffset = 0;
    requestCounter += 1;
    sendPlugin({ type: "hwinfo.search", query, offset: searchOffset, limit: 80, requestId: String(requestCounter) });
  }
  function renderSearch(result) {
    if (!result || String(result.requestId || "") !== String(requestCounter)) return;
    searchTotal = Number(result.total) || 0;
    searchOffset = Number(result.offset) || 0;
    const list = $("sensorList");
    if (searchOffset === 0) list.replaceChildren();
    const grouped = new Map();
    for (const sensor of result.items || []) {
      const key = sensor.deviceName || "Other sensors";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(sensor);
    }
    for (const [device, sensors] of grouped) {
      const head = document.createElement("div"); head.className = "device-head"; head.textContent = device; list.appendChild(head);
      for (const sensor of sensors) {
        const row = document.createElement("label"); row.className = "sensor-row";
        const input = document.createElement("input"); input.type = kind === "dashboard" ? "checkbox" : "radio"; input.name = "sensorChoice";
        input.checked = kind === "dashboard" ? (settings.sensorIds || []).includes(sensor.id) : settings.sensorId === sensor.id;
        input.addEventListener("change", () => {
          if (kind === "dashboard") {
            const set = new Set(Array.isArray(settings.sensorIds) ? settings.sensorIds : []);
            if (input.checked) { if (set.size < 12) set.add(sensor.id); else input.checked = false; }
            else set.delete(sensor.id);
            settings.sensorIds = [...set];
          } else settings.sensorId = sensor.id;
          saveSoon();
          setTimeout(() => sendPlugin({ type: "hwinfo.inspect" }), 100);
        });
        const main = document.createElement("div");
        const name = document.createElement("div"); name.className = "name"; name.textContent = sensor.name || sensor.originalName || sensor.id;
        const meta = document.createElement("div"); meta.className = "meta"; meta.textContent = (sensor.type || "sensor") + (sensor.unit ? " · " + sensor.unit : "");
        main.append(name, meta);
        const reading = document.createElement("div"); reading.className = "reading"; reading.textContent = sensor.value == null ? "--" : String(sensor.value) + (sensor.unit ? " " + sensor.unit : "");
        row.append(input, main, reading); list.appendChild(row);
      }
    }
    const shown = searchOffset + (result.items?.length || 0);
    $("moreSensors").hidden = shown >= searchTotal;
    $("moreSensors").dataset.next = String(shown);
  }

  settingFields.forEach((id) => $(id)?.addEventListener("change", () => { readField(id); saveSoon(); }));
  $("sensorSearch").addEventListener("input", (ev) => {
    query = String(ev.target.value || "");
    clearTimeout(searchTimer); searchTimer = setTimeout(() => requestSearch(true), 180);
  });
  $("moreSensors").addEventListener("click", () => { searchOffset = Number($("moreSensors").dataset.next) || 0; requestSearch(false); });
  $("resetConfig").addEventListener("click", () => sendPlugin({ type: "hwinfo.reset" }));

  window.connectElgatoStreamDeckSocket = (port, propertyInspectorUUID, registerEvent, info, actionInfo) => {
    uiUuid = String(propertyInspectorUUID || "");
    const action = JSON.parse(actionInfo || "{}");
    actionContext = String(action.context || "");
    actionUuid = String(action.action || "");
    kind = ACTION_KIND[actionUuid] || "sensor";
    settings = { ...(action.payload?.settings || {}) };
    paintFields();

    socket = new WebSocket("ws://127.0.0.1:" + port);
    socket.addEventListener("open", () => {
      send({ event: registerEvent, uuid: uiUuid });
      sendPlugin({ type: "hwinfo.inspect" });
      requestSearch(true);
    });
    socket.addEventListener("message", (event) => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (message.event === "sendToPropertyInspector" && message.payload?.type === "hwinfo.state") {
        if (message.payload.settings) { settings = { ...settings, ...message.payload.settings }; paintFields(); }
        paintStatus(message.payload);
        if (message.payload.search) renderSearch(message.payload.search);
      } else if (message.event === "didReceiveSettings" && message.payload?.settings) {
        settings = { ...settings, ...message.payload.settings }; paintFields();
      }
    });
  };
})();

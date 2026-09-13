(() => {
  const DEFAULTS = {
    metricId: "gpu.temperature",
    windowMs: 60000,
    threshold: 85,
    thresholdDirection: "above",
    scaleMin: null,
    scaleMax: null,
    accent: "#2BE86A",
    fpsMode: "fps",
    lowMode: "one",
    summaryPage: 0,
  };

  const KINDS = {
    "com.packrat.performance-grapher.graph": "graph",
    "com.packrat.performance-grapher.fps": "fps",
    "com.packrat.performance-grapher.session": "session",
    "com.packrat.performance-grapher.metric": "metric",
    "com.packrat.performance-grapher.alert": "alert",
  };

  let socket = null;
  let uiUuid = "";
  let context = "";
  let actionUuid = "";
  let kind = "graph";
  let settings = { ...DEFAULTS };
  let snapshot = null;
  let saveTimer = null;

  const $ = (id) => document.getElementById(id);

  function send(message) {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  function filterFields() {
    for (const node of document.querySelectorAll("[data-kinds]")) {
      const kinds = String(node.getAttribute("data-kinds") || "").split(/\s+/);
      node.hidden = !kinds.includes(kind);
    }
  }

  function numberOrNull(value) {
    if (value == null || String(value).trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function collectSettings() {
    const min = numberOrNull($("scaleMin").value);
    const max = numberOrNull($("scaleMax").value);
    return {
      ...settings,
      metricId: $("metricId").value || settings.metricId || "gpu.temperature",
      windowMs: Number($("windowMs").value || 60000),
      threshold: numberOrNull($("threshold").value) ?? 85,
      thresholdDirection: $("thresholdDirection").value === "below" ? "below" : "above",
      scaleMin: min !== null && max !== null && max > min ? min : null,
      scaleMax: min !== null && max !== null && max > min ? max : null,
      accent: $("accent").value.toUpperCase(),
      fpsMode: $("fpsMode").value === "frametime" ? "frametime" : "fps",
      lowMode: $("lowMode").value === "pointOne" ? "pointOne" : "one",
    };
  }

  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      settings = collectSettings();
      $("accentValue").textContent = settings.accent;
      send({ event: "setSettings", action: actionUuid, context, payload: settings });
    }, 80);
  }

  function applySettings(next) {
    settings = { ...DEFAULTS, ...(next || {}) };
    $("windowMs").value = String([0, 60000, 300000, 900000].includes(Number(settings.windowMs)) ? Number(settings.windowMs) : 60000);
    $("threshold").value = Number.isFinite(Number(settings.threshold)) ? Number(settings.threshold) : 85;
    $("thresholdDirection").value = settings.thresholdDirection === "below" ? "below" : "above";
    $("scaleMin").value = settings.scaleMin == null ? "" : String(settings.scaleMin);
    $("scaleMax").value = settings.scaleMax == null ? "" : String(settings.scaleMax);
    $("fpsMode").value = settings.fpsMode === "frametime" ? "frametime" : "fps";
    $("lowMode").value = settings.lowMode === "pointOne" ? "pointOne" : "one";
    const accent = /^#[0-9A-Fa-f]{6}$/.test(String(settings.accent || "")) ? String(settings.accent) : DEFAULTS.accent;
    $("accent").value = accent;
    $("accentValue").textContent = accent.toUpperCase();
    updateMetricOptions();
  }

  function statusCopy(status, provider) {
    const state = String(status?.state || "starting");
    if (state === "ready") return { cls: "ready", title: provider + " ready", detail: provider === "Game telemetry" ? "PresentMon is receiving frame-presentation data locally." : "Libre Hardware Monitor sensor helper is sampling at 1 Hz." };
    if (state === "permission_required") return { cls: "warn", title: "Windows permission required", detail: "PresentMon ETW capture needs Performance Log Users membership or sufficient administrator rights on this system." };
    if (state === "unavailable" || state === "offline") return { cls: "error", title: provider + " unavailable", detail: String(status?.detail || "Provider is offline. Use the diagnostic button or check the local installation.") };
    if (state === "degraded") return { cls: "warn", title: provider + " limited", detail: String(status?.detail || "Some sensors are unavailable. Windows CPU/RAM metrics remain available.") };
    return { cls: "warn", title: "Starting " + provider.toLowerCase(), detail: String(status?.detail || "Initializing local telemetry…") };
  }

  function paintStatus(dotId, titleId, detailId, info) {
    $(dotId).className = "dot " + info.cls;
    $(titleId).textContent = info.title;
    $(detailId).textContent = info.detail;
  }

  function updateStatus() {
    const statuses = snapshot?.status || {};
    paintStatus("fpsDot", "fpsTitle", "fpsDetail", statusCopy(statuses.fps, "Game telemetry"));
    paintStatus("sensorDot", "sensorTitle", "sensorDetail", statusCopy(statuses.hardware, "Hardware sensors"));
    const session = snapshot?.session || {};
    if (session.active) {
      const avg = session.current?.averageFps;
      $("sessionLine").textContent = (session.process || "Game") + " · " + (Number.isFinite(avg) ? Math.round(avg) + " avg FPS" : "collecting session data");
    } else if (session.lastCompleted) {
      const last = session.lastCompleted;
      $("sessionLine").textContent = "Last: " + (last.process || "game") + " · " + (Number.isFinite(last.averageFps) ? Math.round(last.averageFps) + " avg FPS" : "session saved");
    } else $("sessionLine").textContent = "No active game session.";
  }

  function updateMetricOptions() {
    const select = $("metricId");
    const wanted = String(settings.metricId || select.value || (kind === "metric" ? "cpu.load" : "gpu.temperature"));
    const metrics = Array.isArray(snapshot?.metrics) ? snapshot.metrics : [
      { id: "cpu.load", name: "CPU Load", source: "Windows" },
      { id: "ram.load", name: "RAM Used", source: "Windows" },
      { id: "game.fps", name: "Game FPS", source: "PresentMon" },
      { id: "game.frametime", name: "Frametime", source: "PresentMon" },
    ];
    const groups = new Map();
    for (const metric of metrics) {
      const source = String(metric.source || "Local");
      if (!groups.has(source)) groups.set(source, []);
      groups.get(source).push(metric);
    }
    select.replaceChildren();
    for (const [source, items] of groups) {
      const group = document.createElement("optgroup");
      group.label = source;
      for (const metric of items) {
        const option = document.createElement("option");
        option.value = String(metric.id || "");
        option.textContent = String(metric.name || metric.id) + (metric.hardwareName ? " · " + metric.hardwareName : "");
        group.appendChild(option);
      }
      select.appendChild(group);
    }
    const exists = metrics.some((m) => String(m.id) === wanted);
    if (!exists && wanted) {
      const option = document.createElement("option");
      option.value = wanted;
      option.textContent = wanted + " · unavailable";
      select.prepend(option);
    }
    select.value = wanted;
  }

  function command(name) {
    send({ event: "sendToPlugin", action: actionUuid, context, payload: { type: "performanceGrapher.command", command: name } });
  }

  window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, info, rawActionInfo) => {
    uiUuid = uuid;
    const actionInfo = JSON.parse(rawActionInfo || "{}");
    context = String(actionInfo.context || uuid);
    actionUuid = String(actionInfo.action || "");
    kind = KINDS[actionUuid] || "graph";
    applySettings(actionInfo.payload?.settings || {});
    filterFields();

    socket = new WebSocket("ws://127.0.0.1:" + port);
    socket.onopen = () => {
      send({ event: registerEvent, uuid: uiUuid });
      send({ event: "getSettings", action: actionUuid, context });
      send({ event: "sendToPlugin", action: actionUuid, context, payload: { type: "performanceGrapher.inspect" } });
    };
    socket.onmessage = (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.event === "didReceiveSettings") applySettings(message.payload?.settings || {});
      if (message.event === "sendToPropertyInspector" && message.payload?.type === "performanceGrapher.state") {
        snapshot = message.payload.snapshot || null;
        settings = { ...settings, ...(message.payload.settings || {}) };
        updateMetricOptions();
        updateStatus();
      }
    };
  };

  for (const id of ["metricId", "windowMs", "threshold", "thresholdDirection", "scaleMin", "scaleMax", "fpsMode", "lowMode", "accent"]) {
    $(id).addEventListener(id === "accent" || id === "threshold" || id === "scaleMin" || id === "scaleMax" ? "input" : "change", saveSoon);
  }
  $("restartFps").addEventListener("click", () => command("restart-fps"));
  $("presentMonHelp").addEventListener("click", () => command("open-presentmon-help"));
  $("resetSession").addEventListener("click", () => command("reset-session"));
})();

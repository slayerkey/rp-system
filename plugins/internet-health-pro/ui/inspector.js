(() => {
  const DEFAULT_ACTION = {
    historyWindow: 30, latencyWarn: 80, latencyBad: 150, jitterWarn: 15, jitterBad: 30,
    lossWarn: 3, lossBad: 10, metric: "jitter", outageMode: "uptime", target: "1.1.1.1",
    targetMethod: "auto", targetPort: 443, family: "auto", expectedDownloadMbps: 0,
    expectedUploadMbps: 0, lowSpeedPercent: 70, accent: "#2BE86A"
  };
  const DEFAULT_GLOBAL = { intervalSeconds: 1, diagnosticSeconds: 30, httpSeconds: 60, targetSeconds: 30, historyHours: 24, cadenceVersion: 2 };
  const ID_TO_KIND = {
    "com.packrat.internet-health-pro.health": "health",
    "com.packrat.internet-health-pro.latency": "latency",
    "com.packrat.internet-health-pro.jitter-loss": "jitter-loss",
    "com.packrat.internet-health-pro.outage": "outage",
    "com.packrat.internet-health-pro.target": "target",
    "com.packrat.internet-health-pro.speed-test": "speed-test",
    "com.packrat.internet-health-pro.summary": "summary"
  };

  let socket = null;
  let uiUuid = "";
  let actionUuid = "";
  let actionContext = "";
  let kind = "health";
  let settings = { ...DEFAULT_ACTION };
  let globals = { ...DEFAULT_GLOBAL };
  let snapshot = null;
  let saveTimer = null;
  let inspectTimer = null;

  const $ = (id) => document.getElementById(id);
  function send(message) {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }
  function number(id, fallback) {
    const value = Number($(id).value);
    return Number.isFinite(value) ? value : fallback;
  }
  function collectAction() {
    return {
      ...settings,
      historyWindow: number("historyWindow", 30),
      latencyWarn: number("latencyWarn", 80),
      latencyBad: number("latencyBad", 150),
      jitterWarn: number("jitterWarn", 15),
      jitterBad: number("jitterBad", 30),
      lossWarn: number("lossWarn", 3),
      lossBad: number("lossBad", 10),
      metric: $("metric").value,
      outageMode: $("outageMode").value,
      target: $("target").value.trim(),
      targetMethod: $("targetMethod").value,
      targetPort: number("targetPort", 443),
      family: $("family").value,
      expectedDownloadMbps: number("expectedDownloadMbps", 0),
      expectedUploadMbps: number("expectedUploadMbps", 0),
      lowSpeedPercent: number("lowSpeedPercent", 70),
      accent: $("accent").value.toUpperCase()
    };
  }
  function setSaveStatus(text) {
    const node = $("saveStatus");
    if (node) node.textContent = text;
  }
  function save() {
    settings = collectAction();
    globals = { ...globals, intervalSeconds: number("intervalSeconds", 1), cadenceVersion: 2 };
    $("accentValue").textContent = settings.accent;
    const actionSent = send({ event: "setSettings", action: actionUuid, context: uiUuid, payload: settings });
    const globalSent = send({ event: "setGlobalSettings", context: uiUuid, payload: globals });
    setSaveStatus(actionSent && globalSent ? "Saving…" : "Stream Deck connection unavailable.");
  }
  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 120);
  }
  function applyAction(next) {
    settings = { ...DEFAULT_ACTION, ...(next || {}) };
    for (const [id, value] of Object.entries({
      historyWindow: settings.historyWindow, latencyWarn: settings.latencyWarn, latencyBad: settings.latencyBad,
      jitterWarn: settings.jitterWarn, jitterBad: settings.jitterBad, lossWarn: settings.lossWarn, lossBad: settings.lossBad,
      metric: settings.metric, outageMode: settings.outageMode, target: settings.target,
      targetMethod: settings.targetMethod, targetPort: settings.targetPort, family: settings.family,
      expectedDownloadMbps: settings.expectedDownloadMbps, expectedUploadMbps: settings.expectedUploadMbps,
      lowSpeedPercent: settings.lowSpeedPercent
    })) if ($(id)) $(id).value = value;
    const accent = /^#[0-9A-Fa-f]{6}$/.test(String(settings.accent || "")) ? settings.accent : DEFAULT_ACTION.accent;
    $("accent").value = accent;
    $("accentValue").textContent = accent.toUpperCase();
  }
  function applyGlobal(next) {
    globals = { ...DEFAULT_GLOBAL, ...(next || {}) };
    const allowed = [1,5,10,15,30,60];
    $("intervalSeconds").value = allowed.includes(Number(globals.intervalSeconds)) ? Number(globals.intervalSeconds) : 1;
  }
  function filterFields() {
    for (const node of document.querySelectorAll("[data-kinds]")) {
      const kinds = String(node.getAttribute("data-kinds") || "").split(/\s+/);
      node.hidden = !kinds.includes(kind);
    }
  }
  function methodName(value) {
    return value === "icmp" ? "ICMP latency" : value === "tcp" ? "TCP-connect timing" : value === "dns" ? "DNS lookup" : value === "https" ? "HTTPS response timing" : "waiting";
  }
  function updateStatus() {
    const state = String(snapshot?.connectivity?.status || "starting");
    const dot = $("statusDot");
    dot.className = "dot";
    let title = "Starting monitor…";
    if (state === "online") { dot.classList.add("good"); title = "Connection healthy"; }
    else if (state === "offline") { dot.classList.add("bad"); title = "Internet offline"; }
    else if (state === "dns-failure") { dot.classList.add("bad"); title = "DNS failure"; }
    else if (state === "degraded" || state === "suspected-offline") { dot.classList.add("warn"); title = "Connection degraded"; }
    $("statusTitle").textContent = title;
    const metrics = snapshot?.metrics || {};
    const detail = Number.isFinite(Number(metrics.current))
      ? Math.round(Number(metrics.current)) + " ms · " + methodName(metrics.method)
      : String(snapshot?.connectivity?.reason || "Waiting for measurement");
    $("statusDetail").textContent = detail;
    $("methodDetail").textContent = snapshot?.target?.reading
      ? "Target: " + methodName(snapshot.target.reading.method) + (Number.isFinite(Number(snapshot.target.reading.ms)) ? " · " + Math.round(snapshot.target.reading.ms) + " ms" : "")
      : "Primary latency: " + methodName(metrics.method) + ". HTTPS timing is labeled separately.";
    $("speedTest").disabled = Boolean(snapshot?.speedRunning);
    $("speedTest").textContent = snapshot?.speedRunning ? "Testing…" : "Run speed test";
    $("refresh").disabled = false;
    $("refresh").textContent = "Probe now";
  }
  function requestState() {
    return send({ event: "sendToPlugin", action: actionUuid, context: uiUuid, payload: { type: "internetHealth.inspect", actionContext } });
  }
  function command(command) {
    return send({ event: "sendToPlugin", action: actionUuid, context: uiUuid, payload: { type: "internetHealth.command", command, actionContext } });
  }

  window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, info, rawActionInfo) => {
    uiUuid = uuid;
    const actionInfo = JSON.parse(rawActionInfo || "{}");
    actionUuid = String(actionInfo.action || "");
    actionContext = String(actionInfo.context || "");
    kind = ID_TO_KIND[actionUuid] || "health";
    applyAction(actionInfo.payload?.settings || {});
    filterFields();

    socket = new WebSocket("ws://127.0.0.1:" + port);
    socket.onopen = () => {
      send({ event: registerEvent, uuid: uiUuid });
      send({ event: "getSettings", action: actionUuid, context: uiUuid });
      send({ event: "getGlobalSettings", context: uiUuid });
      requestState();
      setTimeout(requestState, 250);
      clearInterval(inspectTimer);
      inspectTimer = setInterval(requestState, 1500);
    };
    socket.onclose = () => {
      clearInterval(inspectTimer);
      inspectTimer = null;
    };
    socket.onmessage = (event) => {
      let message = null;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.event === "didReceiveSettings") {
        applyAction(message.payload?.settings || {});
        setSaveStatus("Saved");
      }
      if (message.event === "didReceiveGlobalSettings") applyGlobal(message.payload?.settings || message.payload || {});
      if (message.event === "sendToPropertyInspector" && message.payload?.type === "internetHealth.state") {
        snapshot = message.payload;
        updateStatus();
      }
    };
  };

  for (const id of ["historyWindow","latencyWarn","latencyBad","jitterWarn","jitterBad","lossWarn","lossBad","metric","outageMode","target","targetMethod","targetPort","family","expectedDownloadMbps","expectedUploadMbps","lowSpeedPercent","accent","intervalSeconds"]) {
    $(id).addEventListener(id === "target" || id === "accent" ? "input" : "change", queueSave);
  }
  $("refresh").addEventListener("click", () => {
    $("refresh").disabled = true;
    $("refresh").textContent = "Probing…";
    $("methodDetail").textContent = "Running a fresh connectivity probe…";
    if (!command("refresh")) {
      $("refresh").disabled = false;
      $("refresh").textContent = "Probe now";
      $("methodDetail").textContent = "Stream Deck connection unavailable.";
    }
  });
  $("speedTest").addEventListener("click", () => {
    $("speedTest").disabled = true;
    $("speedTest").textContent = "Starting…";
    if (!command("speedTest")) {
      $("speedTest").disabled = false;
      $("speedTest").textContent = "Run speed test";
    }
  });
})();

(() => {
  "use strict";

  const PI_BUILD = "1.0.0.0-2";
  window.__performanceGrapherPiVersion = PI_BUILD;
  console.log("Performance Grapher PI build " + PI_BUILD);

  const { streamDeckClient, useSettings } = SDPIComponents;

  const KINDS = {
    "com.packrat.performance-grapher.graph": "graph",
    "com.packrat.performance-grapher.fps": "fps",
    "com.packrat.performance-grapher.session": "session",
    "com.packrat.performance-grapher.metric": "metric",
    "com.packrat.performance-grapher.alert": "alert",
  };

  const FALLBACK_METRICS = [
    { id: "cpu.load", name: "CPU Load", source: "Windows", unit: "%" },
    { id: "ram.load", name: "RAM Used", source: "Windows", unit: "%" },
    { id: "game.fps", name: "Game FPS", source: "Game telemetry", unit: "FPS" },
    { id: "game.frametime", name: "Frametime", source: "Game telemetry", unit: "ms" },
  ];

  const HARDWARE_CANONICAL = new Set([
    "cpu.temperature",
    "gpu.temperature",
    "gpu.load",
    "gpu.power",
    "cpu.power",
  ]);

  let actionUuid = "";
  let kind = "graph";
  let snapshot = null;
  let metricSetting = undefined;

  const $ = (id) => document.getElementById(id);
  const [getMetricSetting, setMetricSetting] = useSettings("metricId", (value) => {
    metricSetting = typeof value === "string" && value ? value : undefined;
    updateMetricOptions();
    updateWarning();
  }, null);

  function defaultMetric() {
    return kind === "metric" ? "cpu.load" : "gpu.temperature";
  }

  function selectedMetric() {
    return metricSetting || defaultMetric();
  }

  function filterFields() {
    for (const node of document.querySelectorAll("[data-kinds]")) {
      const kinds = String(node.getAttribute("data-kinds") || "").split(/\s+/).filter(Boolean);
      node.hidden = !kinds.includes(kind);
    }
  }

  function optionLabel(metric) {
    const name = String(metric?.name || metric?.id || "Metric");
    const hardware = String(metric?.hardwareName || "").trim();
    return hardware ? name + " · " + hardware : name;
  }

  function updateMetricOptions() {
    const select = $("metricId");
    if (!select) return;

    const wanted = selectedMetric();
    const metrics = Array.isArray(snapshot?.metrics) && snapshot.metrics.length
      ? snapshot.metrics
      : FALLBACK_METRICS;

    const groups = new Map();
    for (const metric of metrics) {
      if (!metric?.id) continue;
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
        option.value = String(metric.id);
        option.textContent = optionLabel(metric);
        group.appendChild(option);
      }
      select.appendChild(group);
    }

    const exists = metrics.some((metric) => String(metric.id) === wanted);
    if (!exists && wanted) {
      const option = document.createElement("option");
      option.value = wanted;
      option.textContent = snapshot
        ? friendlyMetricName(wanted) + " · unavailable on this PC"
        : friendlyMetricName(wanted);
      select.prepend(option);
    }

    select.value = wanted;
  }

  function friendlyMetricName(id) {
    const known = {
      "cpu.load": "CPU Load",
      "ram.load": "RAM Used",
      "cpu.temperature": "CPU Temperature",
      "gpu.temperature": "GPU Temperature",
      "gpu.load": "GPU Load",
      "gpu.power": "GPU Power",
      "cpu.power": "CPU Power",
      "game.fps": "Game FPS",
      "game.frametime": "Frametime",
    };
    return known[id] || String(id || "Metric");
  }

  function providerInfo(status, provider) {
    const state = String(status?.state || "starting");
    const detail = String(status?.detail || "");

    if (state === "ready") {
      return {
        cls: "ready",
        title: provider + " ready",
        detail: provider === "Game telemetry"
          ? "Frame presentation data is arriving."
          : "Hardware sensor data is arriving.",
      };
    }

    if (state === "permission_required") {
      return {
        cls: "warn",
        title: "Game FPS needs Windows permission",
        detail: "Add your Windows account to Performance Log Users, sign out and back in once, then restart game telemetry.",
      };
    }

    if (state === "degraded") {
      return {
        cls: "warn",
        title: provider + " limited",
        detail: detail || "Some advanced sensors are unavailable. Windows CPU and RAM still work.",
      };
    }

    if (state === "unavailable" || state === "offline") {
      return {
        cls: "error",
        title: provider + " unavailable",
        detail: detail || "The local telemetry provider is not available.",
      };
    }

    return {
      cls: "warn",
      title: provider + " starting",
      detail: detail || "Waiting for local telemetry.",
    };
  }

  function paintProvider(prefix, info) {
    $(prefix + "Dot").className = "dot " + info.cls;
    $(prefix + "Title").textContent = info.title;
    $(prefix + "Detail").textContent = info.detail;
  }

  function metricNeedsGame(metricId) {
    return metricId === "game.fps" || metricId === "game.frametime";
  }

  function metricNeedsHardware(metricId) {
    return HARDWARE_CANONICAL.has(metricId) || String(metricId || "").startsWith("lhm.");
  }

  function updateWarning() {
    const warning = $("providerWarning");
    const button = $("warningAction");
    if (!warning || !button) return;

    warning.hidden = true;
    button.hidden = true;
    button.onclick = null;

    if (!snapshot) return;

    const statuses = snapshot.status || {};
    const metricId = selectedMetric();
    const needsGame = kind === "fps" || kind === "session" || metricNeedsGame(metricId);
    const needsHardware = !needsGame && (kind === "graph" || kind === "metric" || kind === "alert") && metricNeedsHardware(metricId);

    let info = null;
    let provider = "";
    if (needsGame) {
      provider = "fps";
      info = providerInfo(statuses.fps, "Game telemetry");
    } else if (needsHardware) {
      provider = "hardware";
      info = providerInfo(statuses.hardware, "Hardware sensors");
    }

    if (!info) return;
    const state = provider === "fps" ? String(statuses.fps?.state || "") : String(statuses.hardware?.state || "");
    if (state === "ready" || state === "starting" || state === "stopped") return;

    $("warningTitle").textContent = info.title;
    $("warningDetail").textContent = info.detail;
    warning.hidden = false;

    if (provider === "fps" && state === "permission_required") {
      button.textContent = "Open FPS permission guide";
      button.hidden = false;
      button.onclick = () => command("open-presentmon-help");
    }
  }

  function updateStatus() {
    const statuses = snapshot?.status || {};
    paintProvider("fps", providerInfo(statuses.fps, "Game telemetry"));
    paintProvider("sensor", providerInfo(statuses.hardware, "Hardware sensors"));

    const session = snapshot?.session || {};
    if (session.active) {
      const avg = session.current?.averageFps;
      $("sessionLine").textContent =
        (session.process || "Game") +
        (Number.isFinite(avg) ? " · " + Math.round(avg) + " avg FPS" : " · collecting session data");
    } else if (session.lastCompleted) {
      const last = session.lastCompleted;
      $("sessionLine").textContent =
        "Last: " +
        (last.process || "game") +
        (Number.isFinite(last.averageFps) ? " · " + Math.round(last.averageFps) + " avg FPS" : "");
    } else {
      $("sessionLine").textContent = "No active game session.";
    }

    updateWarning();
  }

  async function command(name) {
    await streamDeckClient.send("sendToPlugin", {
      type: "performanceGrapher.command",
      command: name,
    });
  }

  async function requestState() {
    await streamDeckClient.send("sendToPlugin", {
      type: "performanceGrapher.inspect",
    });
  }

  $("metricId").addEventListener("change", async () => {
    metricSetting = $("metricId").value || defaultMetric();
    updateWarning();
    await setMetricSetting(metricSetting);
  });

  $("restartFps").addEventListener("click", () => void command("restart-fps"));
  $("presentMonHelp").addEventListener("click", () => void command("open-presentmon-help"));
  $("resetSession").addEventListener("click", () => void command("reset-session"));

  streamDeckClient.sendToPropertyInspector.subscribe((event) => {
    const payload = event?.payload;
    if (payload?.type !== "performanceGrapher.state") return;
    snapshot = payload.snapshot || null;
    if (payload.settings?.metricId && !metricSetting) {
      metricSetting = String(payload.settings.metricId);
    }
    updateMetricOptions();
    updateStatus();
  });

  void streamDeckClient.getConnectionInfo().then(async (connection) => {
    actionUuid = String(connection?.actionInfo?.action || "");
    kind = KINDS[actionUuid] || "graph";
    const savedMetric = await getMetricSetting();
    metricSetting = typeof savedMetric === "string" && savedMetric ? savedMetric : undefined;
    filterFields();
    updateMetricOptions();
    document.body.classList.add("ready");
    await requestState();
  });
})();

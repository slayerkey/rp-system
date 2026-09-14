(() => {
  "use strict";

  const PI_BUILD = "1.0.0.0-3";
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

  const COMMON_METRICS = [
    { id: "gpu.temperature", label: "GPU Temperature" },
    { id: "cpu.temperature", label: "CPU Temperature" },
    { id: "gpu.fan", label: "GPU Fan Speed" },
    { id: "gpu.load", label: "GPU Load" },
    { id: "cpu.load", label: "CPU Load" },
    { id: "ram.load", label: "RAM Used" },
    { id: "gpu.power", label: "GPU Power" },
    { id: "cpu.power", label: "CPU Power" },
    { id: "game.fps", label: "Game FPS" },
    { id: "game.frametime", label: "Frametime" },
  ];

  const FALLBACK_METRICS = [
    { id: "cpu.load", name: "CPU Load", source: "Windows", unit: "%" },
    { id: "ram.load", name: "RAM Used", source: "Windows", unit: "%" },
    { id: "game.fps", name: "Game FPS", source: "Game telemetry", unit: "FPS" },
    { id: "game.frametime", name: "Frametime", source: "Game telemetry", unit: "ms" },
  ];

  const HARDWARE_CANONICAL = new Set([
    "cpu.temperature",
    "gpu.temperature",
    "gpu.fan",
    "gpu.load",
    "gpu.power",
    "cpu.power",
  ]);

  let kind = "graph";
  let snapshot = null;
  let fpsSetup = { state: "idle", detail: null };
  let metricSetting = undefined;
  let showAdvanced = false;

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

  function friendlyMetricName(id) {
    return COMMON_METRICS.find((item) => item.id === id)?.label || String(id || "Metric");
  }

  function shortDeviceName(value) {
    let text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";

    text = text
      .replace(/^Advanced Micro Devices,? Inc\.?\s*/i, "")
      .replace(/^AMD\s+/i, "")
      .replace(/^NVIDIA\s+/i, "")
      .replace(/^Intel\(R\)\s*/i, "")
      .replace(/^Intel\s+/i, "")
      .replace(/^GeForce\s+/i, "");

    const useful = text.match(/\b(?:RTX|GTX|RX|ARC|RYZEN|CORE)\b.*$/i);
    if (useful?.[0]) text = useful[0];
    return text.length > 34 ? text.slice(0, 33) + "…" : text;
  }

  function advancedGroupLabel(metric) {
    const type = String(metric?.hardwareType || "").toLowerCase();
    const device = shortDeviceName(metric?.hardwareName);
    let prefix = "Other";
    if (type.includes("gpu")) prefix = "GPU";
    else if (type.includes("cpu")) prefix = "CPU";
    else if (type.includes("memory")) prefix = "Memory";
    else if (type.includes("storage")) prefix = "Storage";
    else if (type.includes("network")) prefix = "Network";
    else if (type.includes("motherboard")) prefix = "Motherboard";
    else if (type.includes("controller")) prefix = "Controller";
    return device ? prefix + " · " + device : prefix;
  }

  function appendOption(parent, metric, label = null) {
    const option = document.createElement("option");
    option.value = String(metric.id);
    const unit = String(metric.unit || "").trim();
    option.textContent = label || (String(metric.name || metric.id) + (unit ? " (" + unit + ")" : ""));
    parent.appendChild(option);
  }

  function updateMetricOptions() {
    const select = $("metricId");
    if (!select) return;

    const wanted = selectedMetric();
    const metrics = Array.isArray(snapshot?.metrics) && snapshot.metrics.length
      ? snapshot.metrics
      : FALLBACK_METRICS;
    const byId = new Map(metrics.filter((metric) => metric?.id).map((metric) => [String(metric.id), metric]));

    select.replaceChildren();

    const commonGroup = document.createElement("optgroup");
    commonGroup.label = "Common";
    for (const common of COMMON_METRICS) {
      const metric = byId.get(common.id);
      if (metric) appendOption(commonGroup, metric, common.label);
    }
    select.appendChild(commonGroup);

    if (showAdvanced) {
      const groups = new Map();
      const advanced = metrics
        .filter((metric) => String(metric?.id || "").startsWith("lhm."))
        .sort((a, b) => {
          const groupCompare = advancedGroupLabel(a).localeCompare(advancedGroupLabel(b));
          if (groupCompare) return groupCompare;
          return String(a.name || "").localeCompare(String(b.name || ""));
        });

      for (const metric of advanced) {
        const label = advancedGroupLabel(metric);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(metric);
      }

      for (const [label, items] of groups) {
        const group = document.createElement("optgroup");
        group.label = label;
        for (const metric of items) appendOption(group, metric);
        select.appendChild(group);
      }
    }

    const exists = metrics.some((metric) => String(metric.id) === wanted);
    if (!exists && wanted) {
      const option = document.createElement("option");
      option.value = wanted;
      option.textContent = snapshot
        ? friendlyMetricName(wanted) + " · unavailable on this PC"
        : friendlyMetricName(wanted);
      select.prepend(option);
    } else if (wanted.startsWith("lhm.") && !showAdvanced) {
      const metric = byId.get(wanted);
      if (metric) {
        const currentGroup = document.createElement("optgroup");
        currentGroup.label = "Current advanced sensor";
        appendOption(currentGroup, metric, String(metric.name || wanted));
        select.appendChild(currentGroup);
      }
    }

    select.value = wanted;
    $("advancedMetricsButton").textContent = showAdvanced ? "Hide advanced sensors" : "Show advanced sensors";
  }

  function providerInfo(status, provider) {
    const state = String(status?.state || "starting");
    const detail = String(status?.detail || "");

    if (state === "ready") {
      return {
        cls: "ready",
        title: provider + " ready",
        detail: provider === "Game telemetry"
          ? "Frame data is arriving."
          : "Hardware sensor data is arriving.",
      };
    }

    if (state === "permission_required") {
      return {
        cls: "warn",
        title: "Game FPS needs one-time setup",
        detail: "Click Enable Game FPS, approve the Windows prompt, then sign out and back in once.",
      };
    }

    if (state === "degraded") {
      return {
        cls: "warn",
        title: provider + " limited",
        detail: detail || "Some advanced sensors are unavailable. CPU and RAM still work.",
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

    if (provider === "fps" && state === "permission_required") {
      if (fpsSetup.state === "working") {
        info = {
          cls: "warn",
          title: "Waiting for Windows approval",
          detail: "Approve the one-time Windows prompt to enable Game FPS.",
        };
      } else if (fpsSetup.state === "sign_out_required") {
        info = {
          cls: "ready",
          title: "Game FPS access enabled",
          detail: "Sign out of Windows and back in once. After that, Game FPS works automatically.",
        };
      } else if (fpsSetup.state === "cancelled") {
        info = {
          cls: "warn",
          title: "Game FPS setup cancelled",
          detail: "Nothing changed. Click Enable Game FPS whenever you want to try again.",
        };
      } else if (fpsSetup.state === "error") {
        info = {
          cls: "error",
          title: "Could not enable Game FPS",
          detail: fpsSetup.detail || "Windows did not complete the permission setup.",
        };
      }
    }

    $("warningTitle").textContent = info.title;
    $("warningDetail").textContent = info.detail;
    warning.hidden = false;

    if (provider === "fps" && state === "permission_required" && !["working", "sign_out_required"].includes(fpsSetup.state)) {
      button.textContent = "Enable Game FPS";
      button.hidden = false;
      button.onclick = () => command("enable-fps-access");
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

  $("advancedMetricsButton").addEventListener("click", () => {
    showAdvanced = !showAdvanced;
    updateMetricOptions();
  });
  $("restartFps").addEventListener("click", () => void command("restart-fps"));
  $("presentMonHelp").addEventListener("click", () => void command("open-presentmon-help"));
  $("resetSession").addEventListener("click", () => void command("reset-session"));

  streamDeckClient.sendToPropertyInspector.subscribe((event) => {
    const payload = event?.payload;
    if (payload?.type !== "performanceGrapher.state") return;
    snapshot = payload.snapshot || null;
    fpsSetup = payload.fpsSetup || fpsSetup;
    if (payload.settings?.metricId && !metricSetting) {
      metricSetting = String(payload.settings.metricId);
    }
    updateMetricOptions();
    updateStatus();
  });

  void streamDeckClient.getConnectionInfo().then(async (connection) => {
    const actionUuid = String(connection?.actionInfo?.action || "");
    kind = KINDS[actionUuid] || "graph";
    const savedMetric = await getMetricSetting();
    metricSetting = typeof savedMetric === "string" && savedMetric ? savedMetric : undefined;
    filterFields();
    updateMetricOptions();
    document.body.classList.add("ready");
    await requestState();
  });
})();

(() => {
  "use strict";
  const { useSettings, streamDeckClient } = SDPIComponents;
  const COMMON = [
    ["gpu.load", "GPU Load"], ["cpu.load", "CPU Load"], ["ram.load", "RAM Used"],
    ["gpu.temperature", "GPU Temperature"], ["cpu.temperature", "CPU Temperature"],
    ["gpu.fan", "GPU Fan"], ["gpu.power", "GPU Power"], ["cpu.power", "CPU Power"],
  ];
  let uiUuid = "";
  let actionContext = "";
  let savedMetric = "gpu.load";
  let neoMode = "overview";
  let advanced = false;
  let metrics = [];
  const $ = (id) => document.getElementById(id);
  const [getMetric, setMetric] = useSettings("metricId", (value) => {
    savedMetric = typeof value === "string" && value ? value : "gpu.load";
    renderMetricPicker();
  }, null);
  const [getMode] = useSettings("neoMode", (value) => {
    neoMode = ["overview", "single", "rotate"].includes(String(value)) ? value : "overview";
    showModeFields();
  }, null);
  function showModeFields() {
    for (const field of document.querySelectorAll("[data-modes]")) {
      const modes = String(field.dataset.modes || "").split(/\s+/);
      field.hidden = !modes.includes(neoMode);
    }
  }
  function renderMetricPicker() {
    const el = $("metricId");
    const values = new Map(metrics.filter((m) => m?.id).map((m) => [String(m.id), m]));
    const selected = savedMetric || "gpu.load";
    el.replaceChildren();
    const group = document.createElement("optgroup");
    group.label = "Common PC metrics";
    for (const [id, label] of COMMON) {
      if (metrics.length && !values.has(id)) continue;
      const option = document.createElement("option");
      option.value = id; option.textContent = label;
      group.appendChild(option);
    }
    el.appendChild(group);
    if (advanced) {
      const extra = document.createElement("optgroup");
      extra.label = "Advanced sensors";
      for (const metric of metrics.filter((m) => String(m?.id || "").startsWith("lhm."))) {
        const option = document.createElement("option");
        option.value = String(metric.id);
        option.textContent = String(metric.hardwareName || "Sensor") + " · " + String(metric.name || metric.id);
        extra.appendChild(option);
      }
      if (extra.childElementCount) el.appendChild(extra);
    }
    if (![...el.options].some((opt) => opt.value === selected)) {
      // Persisted advanced/unavailable readings remain selected instead of resetting silently.
      const option = document.createElement("option");
      option.value = selected; option.textContent = selected + " (saved)";
      el.prepend(option);
    }
    el.value = selected;
  }
  $("metricId").addEventListener("change", async () => {
    savedMetric = $("metricId").value;
    await setMetric(savedMetric);
  });
  $("advanced").addEventListener("click", () => {
    advanced = !advanced;
    $("advanced").textContent = advanced ? "Hide advanced sensors" : "Show advanced sensors";
    renderMetricPicker();
  });
  streamDeckClient.sendToPropertyInspector.subscribe((event) => {
    const payload = event?.payload || {};
    if (payload.type !== "performanceNeo.state") return;
    metrics = Array.isArray(payload.snapshot?.metrics) ? payload.snapshot.metrics : [];
    const hardware = payload.snapshot?.status?.hardware;
    $("status").textContent = hardware?.state === "ready" ? "Live hardware sensors available."
      : "GPU and temperature readings depend on compatible hardware. CPU and RAM work without a hardware sensor driver.";
    renderMetricPicker();
  });
  void streamDeckClient.getConnectionInfo().then(async (info) => {
    uiUuid = String(info?.propertyInspectorUUID || "");
    actionContext = String(info?.actionInfo?.context || "");
    const [metric, mode] = await Promise.all([getMetric(), getMode()]);
    savedMetric = typeof metric === "string" && metric ? metric : "gpu.load";
    neoMode = ["overview", "single", "rotate"].includes(String(mode)) ? mode : "overview";
    showModeFields();
    renderMetricPicker();
    document.body.classList.add("ready");
    if (uiUuid && actionContext) {
      await streamDeckClient.send("sendToPlugin", { type: "performanceNeo.inspect", actionContext });
    }
  }).catch((err) => { console.error("Neo PI connection failed", err); document.body.classList.add("ready"); });
})();

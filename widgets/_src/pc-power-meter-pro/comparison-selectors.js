/* Real-iCUE compatibility layer for PC Power Meter Pro.
 *
 * The original multi-sensor `sensors-factory` control is officially documented,
 * but this product repeatedly failed to import on a real iCUE installation while
 * the otherwise similar Lite package installed. Pro now exposes ordinary
 * sensors-combobox controls and converts them back into the array shape expected
 * by the existing shared runtime. No telemetry math or measurement semantics are
 * changed here.
 */
(function () {
  "use strict";

  var FALLBACK_COLORS = ["#4CC9F0", "#FFB44A", "#B47CFF"];

  function binding(name) {
    try {
      if (typeof globalThis.__ratpackIcueRead === "function") {
        var value = globalThis.__ratpackIcueRead(name);
        if (value !== undefined && value !== null) return value;
      }
    } catch (error) { }

    try {
      switch (name) {
        case "primarySensor": return typeof primarySensor !== "undefined" ? primarySensor : undefined;
        case "comparisonSensor1": return typeof comparisonSensor1 !== "undefined" ? comparisonSensor1 : undefined;
        case "comparisonSensor2": return typeof comparisonSensor2 !== "undefined" ? comparisonSensor2 : undefined;
        case "comparisonSensor3": return typeof comparisonSensor3 !== "undefined" ? comparisonSensor3 : undefined;
        case "comparisonColor1": return typeof comparisonColor1 !== "undefined" ? comparisonColor1 : undefined;
        case "comparisonColor2": return typeof comparisonColor2 !== "undefined" ? comparisonColor2 : undefined;
        case "comparisonColor3": return typeof comparisonColor3 !== "undefined" ? comparisonColor3 : undefined;
      }
    } catch (error) { }

    try { return globalThis[name]; }
    catch (error) { return undefined; }
  }

  function buildComparisonSensors() {
    var primary = String(binding("primarySensor") || "").trim();
    var seen = {};
    if (primary) seen[primary] = true;
    var result = [];

    for (var index = 1; index <= 3; index++) {
      var sensorId = String(binding("comparisonSensor" + index) || "").trim();
      if (!sensorId || seen[sensorId]) continue;
      seen[sensorId] = true;
      var color = String(binding("comparisonColor" + index) || FALLBACK_COLORS[index - 1]).trim();
      result.push({ sensorId: sensorId, color: color || FALLBACK_COLORS[index - 1] });
    }
    return result;
  }

  try {
    Object.defineProperty(globalThis, "comparisonSensors", {
      configurable: true,
      enumerable: false,
      get: buildComparisonSensors
    });
  } catch (error) {
    /* Browser/dev fallback. Real iCUE and the hardened PackRat bridge both allow
     * the getter path above. */
    try { globalThis.comparisonSensors = buildComparisonSensors(); }
    catch (ignored) { }
  }

  globalThis.__pcPowerProComparisonTest = {
    buildComparisonSensors: buildComparisonSensors
  };
})();

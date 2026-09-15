/* Network Dashboard real-iCUE settings reconciliation.
 *
 * Physical testing showed iCUE can update the document-level property bindings
 * before (or without) delivering onDataUpdated. The core widget historically read
 * window properties only, so changes appeared after a dashboard page transition.
 * This patch reads the canonical direct-binding bridge itself and reconciles only
 * when a setting value actually changes. */
(function () {
  "use strict";

  var DEFAULT_HEADER = "NETWORK DASHBOARD";
  var WATCH_MS = 140;
  var watchTimer = null;
  var lastSignature = "";
  var eventHooksInstalled = false;
  var accessorInstalled = false;

  function usable(value) {
    return value !== undefined && value !== null && value !== ""
      && !(typeof Node !== "undefined" && value instanceof Node);
  }

  function directBinding(name) {
    try {
      if (typeof globalThis.__ratpackIcueRead === "function") {
        var bridged = globalThis.__ratpackIcueRead(name);
        if (usable(bridged)) return bridged;
      }
    } catch (error) { }

    /* Source/preview fallback. The exact package gets the generated bridge above. */
    try {
      switch (name) {
        case "probeHosts": return typeof probeHosts !== "undefined" ? probeHosts : undefined;
        case "probeInterval": return typeof probeInterval !== "undefined" ? probeInterval : undefined;
        case "warnAt": return typeof warnAt !== "undefined" ? warnAt : undefined;
        case "customHeader": return typeof customHeader !== "undefined" ? customHeader : undefined;
        case "headerTitleSize": return typeof headerTitleSize !== "undefined" ? headerTitleSize : undefined;
        case "hostTextSize": return typeof hostTextSize !== "undefined" ? hostTextSize : undefined;
        case "textColor": return typeof textColor !== "undefined" ? textColor : undefined;
        case "accentColor": return typeof accentColor !== "undefined" ? accentColor : undefined;
        case "backgroundColor": return typeof backgroundColor !== "undefined" ? backgroundColor : undefined;
        case "transparency": return typeof transparency !== "undefined" ? transparency : undefined;
      }
    } catch (error) { }

    try {
      var globalValue = globalThis[name];
      if (usable(globalValue)) return globalValue;
    } catch (error) { }
    return undefined;
  }

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = fallback;
    return Math.max(min, Math.min(max, number));
  }

  function customHeading() {
    var value = directBinding("customHeader");
    return value == null ? "" : String(value).trim().slice(0, 48);
  }

  function installCoreAccessor() {
    if (accessorInstalled) return;
    var previous = typeof globalThis.getIcueProperty === "function" ? globalThis.getIcueProperty : null;
    globalThis.getIcueProperty = function (name, fallback) {
      var live = directBinding(name);
      if (usable(live)) return live;
      if (previous) {
        try { return previous(name, fallback); } catch (error) { }
      }
      return fallback;
    };
    accessorInstalled = true;
  }

  function applyHeader() {
    if (typeof document === "undefined") return;
    var node = document.getElementById("networkHeaderTitle");
    if (!node) return;
    var heading = customHeading() || DEFAULT_HEADER;
    if (node.textContent !== heading) node.textContent = heading;
  }

  function applyNetworkUiSettings() {
    if (typeof document === "undefined") return;
    var root = document.documentElement;
    var headerScale = clamp(directBinding("headerTitleSize"), 75, 180, 100) / 100;
    var size = clamp(directBinding("hostTextSize"), 12, 24, 15);
    var opacity = clamp(directBinding("transparency"), 0, 100, 100);
    var text = String(directBinding("textColor") || "#F4F6F8");
    var accent = String(directBinding("accentColor") || "#2BE86A");
    var background = String(directBinding("backgroundColor") || "#07090D");

    root.style.setProperty("--net-header-scale", String(headerScale));
    root.style.setProperty("--net-user-host-size", size + "px");
    root.style.setProperty("--net-background-factor", String(opacity / 100));
    root.style.setProperty("--text", text);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--bg", background);
    applyHeader();
  }

  function settingSnapshot() {
    return [
      "probeHosts", "probeInterval", "warnAt", "customHeader", "headerTitleSize", "hostTextSize",
      "textColor", "accentColor", "backgroundColor", "transparency"
    ].map(function (name) {
      var value = directBinding(name);
      if (value === undefined) return name + "=<undefined>";
      if (typeof value === "object") {
        try { return name + "=" + JSON.stringify(value); } catch (error) { }
      }
      return name + "=" + String(value);
    }).join("\u001f");
  }

  function reconcile(forceCore) {
    installCoreAccessor();
    applyNetworkUiSettings();
    if (forceCore && typeof globalThis.applySettings === "function") {
      try { globalThis.applySettings(); } catch (error) { }
    }
  }

  function pollBindings() {
    var next = settingSnapshot();
    if (next === lastSignature) return;
    lastSignature = next;
    reconcile(true);
  }

  function installEventHooks() {
    if (eventHooksInstalled) return;
    try {
      if (!globalThis.icueEvents) return;
      var originalInit = globalThis.icueEvents.onICUEInitialized;
      var originalUpdate = globalThis.icueEvents.onDataUpdated;
      globalThis.icueEvents.onICUEInitialized = function () {
        if (typeof originalInit === "function") originalInit.apply(this, arguments);
        lastSignature = "";
        pollBindings();
      };
      globalThis.icueEvents.onDataUpdated = function () {
        if (typeof originalUpdate === "function") originalUpdate.apply(this, arguments);
        lastSignature = "";
        pollBindings();
      };
      eventHooksInstalled = true;
    } catch (error) { }
  }

  function installPageRestoreHooks() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
          lastSignature = "";
          pollBindings();
        }
      });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pageshow", function () {
        lastSignature = "";
        pollBindings();
      });
    }
  }

  function start() {
    installCoreAccessor();
    installEventHooks();
    installPageRestoreHooks();
    pollBindings();
    clearInterval(watchTimer);
    watchTimer = setInterval(pollBindings, WATCH_MS);
  }

  globalThis.__netDashboardUiTest = {
    apply: applyNetworkUiSettings,
    reconcile: reconcile,
    poll: pollBindings,
    customHeading: customHeading,
    directBinding: directBinding,
    clamp: clamp
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
})();
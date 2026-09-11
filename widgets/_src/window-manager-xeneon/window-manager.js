(function () {
  "use strict";

  var WINDOW_SERVICE_URL = "ws://127.0.0.1:17487/widget";
  var RECONNECT_MS = 2500;
  var PIN_STORAGE_KEY = "packrat.window-manager-xeneon.pins.v1";
  var slots = [
    { id: "s-h", w: 840, h: 344 },
    { id: "s-v", w: 696, h: 416 },
    { id: "m-h", w: 840, h: 696 },
    { id: "m-v", w: 696, h: 840 },
    { id: "l-h", w: 1688, h: 696 },
    { id: "l-v", w: 696, h: 1688 },
    { id: "xl-h", w: 2536, h: 696 },
    { id: "xl-v", w: 696, h: 2536 }
  ];

  var model = {
    connection: "starting",
    socket: null,
    reconnectTimer: null,
    fixtureMode: false,
    windows: [],
    monitors: [],
    activeWindowId: null,
    selectedWindowId: null,
    pins: {},
    commandLog: [],
    settings: {
      bridgeKey: "",
      showPinned: true,
      showIcons: true,
      textColor: "#F4F6F8",
      accentColor: "#2BE86A",
      backgroundColor: "#080B0F"
    },
    toastTimer: null,
    booted: false,
    shuttingDown: false
  };

  function byId(id) { return document.getElementById(id); }

  function boolValue(value, fallback) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      var normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") return true;
      if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") return false;
    }
    return fallback;
  }

  function textValue(value, fallback) {
    if (value === undefined || value === null) return fallback;
    return String(value);
  }

  function readSettings() {
    try {
      if (typeof globalThis.__ratpackIcueSyncGlobals === "function") globalThis.__ratpackIcueSyncGlobals();
    } catch (error) {}

    var nextBridgeKey = model.settings.bridgeKey;
    var nextShowPinned = model.settings.showPinned;
    var nextShowIcons = model.settings.showIcons;
    var nextTextColor = model.settings.textColor;
    var nextAccentColor = model.settings.accentColor;
    var nextBackgroundColor = model.settings.backgroundColor;

    try { nextBridgeKey = typeof bridgeKey !== "undefined" ? bridgeKey : nextBridgeKey; } catch (error) {}
    try { nextShowPinned = typeof showPinned !== "undefined" ? showPinned : nextShowPinned; } catch (error) {}
    try { nextShowIcons = typeof showIcons !== "undefined" ? showIcons : nextShowIcons; } catch (error) {}
    try { nextTextColor = typeof textColor !== "undefined" ? textColor : nextTextColor; } catch (error) {}
    try { nextAccentColor = typeof accentColor !== "undefined" ? accentColor : nextAccentColor; } catch (error) {}
    try { nextBackgroundColor = typeof backgroundColor !== "undefined" ? backgroundColor : nextBackgroundColor; } catch (error) {}

    var previousKey = model.settings.bridgeKey;
    model.settings.bridgeKey = textValue(nextBridgeKey, "").trim();
    model.settings.showPinned = boolValue(nextShowPinned, true);
    model.settings.showIcons = boolValue(nextShowIcons, true);
    model.settings.textColor = textValue(nextTextColor, "#F4F6F8");
    model.settings.accentColor = textValue(nextAccentColor, "#2BE86A");
    model.settings.backgroundColor = textValue(nextBackgroundColor, "#080B0F");

    var root = document.documentElement;
    root.style.setProperty("--text", model.settings.textColor);
    root.style.setProperty("--accent", model.settings.accentColor);
    root.style.setProperty("--bg", model.settings.backgroundColor);
    document.body.setAttribute("data-show-pinned", model.settings.showPinned ? "true" : "false");
    document.body.setAttribute("data-show-icons", model.settings.showIcons ? "true" : "false");

    if (!model.fixtureMode && previousKey !== model.settings.bridgeKey && model.socket) {
      try { model.socket.close(); } catch (error) {}
    }
    return previousKey !== model.settings.bridgeKey;
  }

  function nearestSlot(width, height) {
    var best = slots[0];
    var bestDistance = Infinity;
    slots.forEach(function (slot) {
      var dx = width - slot.w;
      var dy = height - slot.h;
      var distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = slot;
      }
    });
    return best.id;
  }

  function applySlot() {
    var id = nearestSlot(window.innerWidth || 840, window.innerHeight || 344);
    document.body.setAttribute("data-slot", id);
    return id;
  }

  function loadPins() {
    model.pins = {};
    try {
      var raw = localStorage.getItem(PIN_STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;

      if (parsed.schemaVersion === 1 && parsed.pins && typeof parsed.pins === "object" && !Array.isArray(parsed.pins)) {
        model.pins = parsed.pins;
        return;
      }

      // Migrate the original v1 prerelease shape, which stored the pins object directly.
      if (!Object.prototype.hasOwnProperty.call(parsed, "schemaVersion")) {
        model.pins = parsed;
        savePins();
      }
    } catch (error) {
      model.pins = {};
    }
  }

  function savePins() {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, pins: model.pins }));
    } catch (error) {}
  }

  function windowById(id) {
    var wanted = String(id || "");
    for (var index = 0; index < model.windows.length; index += 1) {
      if (String(model.windows[index].id || "") === wanted) return model.windows[index];
    }
    return null;
  }

  function appKeyOf(windowInfo) {
    if (!windowInfo) return "";
    return String(windowInfo.appKey || windowInfo.processPath || windowInfo.processName || windowInfo.appName || "").trim().toLowerCase();
  }

  function selectedWindow() {
    return windowById(model.selectedWindowId);
  }

  function ensureSelection() {
    if (model.selectedWindowId && windowById(model.selectedWindowId)) return;
    if (model.activeWindowId && windowById(model.activeWindowId)) {
      model.selectedWindowId = String(model.activeWindowId);
      return;
    }
    model.selectedWindowId = model.windows.length ? String(model.windows[0].id) : null;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
    });
  }

  function appFallback(windowInfo) {
    var label = String(windowInfo && (windowInfo.appName || windowInfo.processName || windowInfo.title) || "?").trim();
    return label ? label.slice(0, 2).toUpperCase() : "?";
  }

  function iconMarkup(windowInfo, className) {
    var icon = windowInfo && windowInfo.iconDataUri ? String(windowInfo.iconDataUri) : "";
    if (/^data:image\/(?:png|svg\+xml);/i.test(icon)) {
      return '<img class="' + className + '" src="' + escapeHtml(icon) + '" alt="" />';
    }
    return '<span class="' + className + ' icon-fallback">' + escapeHtml(appFallback(windowInfo)) + '</span>';
  }

  function stateLabel(windowInfo) {
    if (!windowInfo) return "";
    if (windowInfo.state === "minimized") return "MINIMIZED";
    if (windowInfo.state === "maximized") return "MAXIMIZED";
    return "OPEN";
  }

  function monitorLabel(windowInfo) {
    var id = String(windowInfo && windowInfo.monitorId || "");
    for (var index = 0; index < model.monitors.length; index += 1) {
      if (String(model.monitors[index].id) === id) return model.monitors[index].name || ("Monitor " + (index + 1));
    }
    return id || "Desktop";
  }

  function renderWindowCard(windowInfo) {
    var id = String(windowInfo.id || "");
    var active = id && id === String(model.activeWindowId || "");
    var selected = id && id === String(model.selectedWindowId || "");
    var pinned = Boolean(model.pins[appKeyOf(windowInfo)]);
    return '<button type="button" class="window-card' + (active ? ' active' : '') + (selected ? ' selected' : '') + '" data-window-id="' + escapeHtml(id) + '" aria-label="Focus ' + escapeHtml(windowInfo.title || windowInfo.appName || "window") + '">' +
      iconMarkup(windowInfo, "window-icon") +
      '<span class="app-name">' + escapeHtml(windowInfo.appName || windowInfo.processName || "Application") + (pinned ? '<span class="pin-star" aria-label="Pinned">★</span>' : '') + '</span>' +
      '<span class="window-title">' + escapeHtml(windowInfo.title || "Untitled window") + '</span>' +
      '<span class="window-meta"><span>' + escapeHtml(stateLabel(windowInfo)) + '</span><span>•</span><span>' + escapeHtml(monitorLabel(windowInfo)) + '</span></span>' +
    '</button>';
  }

  function renderPinned() {
    var host = byId("pinnedList");
    if (!host) return;
    var values = Object.keys(model.pins).map(function (key) { return model.pins[key]; });
    values.sort(function (left, right) { return String(left.appName || left.key).localeCompare(String(right.appName || right.key)); });
    host.innerHTML = values.map(function (pin) {
      var open = null;
      for (var i = 0; i < model.windows.length; i += 1) {
        if (appKeyOf(model.windows[i]) === String(pin.key || "")) { open = model.windows[i]; break; }
      }
      var display = open || pin;
      return '<button type="button" class="pinned-app' + (open ? '' : ' closed') + '" data-pin-key="' + escapeHtml(pin.key || "") + '" aria-label="' + (open ? "Focus" : "Pinned") + ' ' + escapeHtml(pin.appName || "application") + '">' +
        iconMarkup(display, "pin-icon") +
        '<span class="pin-name">' + escapeHtml(pin.appName || "App") + '</span>' +
        '<span class="pin-state">' + (open ? "OPEN" : "CLOSED") + '</span>' +
      '</button>';
    }).join("");
  }

  function stateCopy() {
    if (model.connection === "pairing") return ["PAIRING KEY NEEDED", "Install Window Manager Lite, open its XENEON setup, then paste the local pairing key in iCUE settings."];
    if (model.connection === "denied") return ["PAIRING KEY REJECTED", "Window Manager Lite rejected this key. Copy the current key from its XENEON setup and try again."];
    if (model.connection === "disconnected") return ["WINDOW MANAGER LITE OFFLINE", "Start Stream Deck with Window Manager Lite installed. The panel reconnects automatically."];
    if (model.connection === "version_mismatch") return ["WINDOW MANAGER LITE UPDATE NEEDED", "The XENEON widget and Window Manager Lite use different service versions. Update Window Manager Lite."];
    if (model.connection === "connecting" || model.connection === "starting") return ["CONNECTING TO WINDOWS", "Looking for Window Manager Lite on this PC."];
    if (!model.windows.length) return ["NO OPEN WINDOWS", "Open an app on the Windows desktop and it will appear here automatically."];
    return ["", ""];
  }

  function render() {
    ensureSelection();
    document.body.setAttribute("data-connection", model.connection);
    document.body.setAttribute("data-has-windows", model.windows.length ? "true" : "false");

    var host = byId("windowList");
    if (host) host.innerHTML = model.windows.map(renderWindowCard).join("");
    renderPinned();

    var empty = byId("emptyState");
    var emptyCopy = stateCopy();
    var showEmpty = model.connection !== "live" || model.windows.length === 0;
    if (empty) empty.hidden = !showEmpty;
    if (byId("emptyTitle")) byId("emptyTitle").textContent = emptyCopy[0];
    if (byId("emptyBody")) byId("emptyBody").textContent = emptyCopy[1];

    var selected = selectedWindow();
    if (byId("selectedApp")) byId("selectedApp").textContent = selected ? (selected.appName || selected.processName || "APPLICATION") : "NO WINDOW SELECTED";
    if (byId("selectedTitle")) byId("selectedTitle").textContent = selected ? (selected.title || "Untitled window") : "Tap a window card to control it.";

    var active = windowById(model.activeWindowId);
    if (byId("activeText")) byId("activeText").textContent = model.connection === "live" ? (active ? "ACTIVE • " + (active.appName || active.processName || "WINDOW") : "NO ACTIVE WINDOW") : String(model.connection || "offline").toUpperCase();
    if (byId("monitorBadge")) byId("monitorBadge").textContent = model.monitors.length + (model.monitors.length === 1 ? " MONITOR" : " MONITORS");

    var ids = ["pinAction", "minimizeAction", "maximizeAction", "snapLeftAction", "snapRightAction", "moveAction", "closeAction"];
    ids.forEach(function (id) { var button = byId(id); if (button) button.disabled = !selected || model.connection !== "live"; });
    if (byId("maximizeAction")) {
      var maxLabel = byId("maximizeAction").querySelector(".action-label");
      if (maxLabel) maxLabel.textContent = selected && selected.state === "maximized" ? "Restore" : "Max";
      byId("maximizeAction").setAttribute("aria-label", selected && selected.state === "maximized" ? "Restore window" : "Maximize window");
    }
    if (byId("pinAction")) {
      var pinned = selected ? Boolean(model.pins[appKeyOf(selected)]) : false;
      byId("pinAction").classList.toggle("is-on", pinned);
      var pinLabel = byId("pinAction").querySelector(".action-label");
      if (pinLabel) pinLabel.textContent = pinned ? "Unpin" : "Pin";
    }
  }

  function toast(message) {
    var node = byId("toast");
    if (!node) return;
    node.textContent = String(message || "");
    node.classList.add("show");
    if (model.toastTimer) clearTimeout(model.toastTimer);
    model.toastTimer = setTimeout(function () { node.classList.remove("show"); }, 1700);
  }

  function normalizeSnapshot(payload) {
    var windows = Array.isArray(payload && payload.windows) ? payload.windows : [];
    var monitors = Array.isArray(payload && payload.monitors) ? payload.monitors : [];
    return {
      windows: windows.filter(function (entry) { return entry && entry.id != null; }).map(function (entry) {
        var copy = Object.assign({}, entry);
        copy.id = String(copy.id);
        copy.monitorId = copy.monitorId == null ? "" : String(copy.monitorId);
        copy.appKey = appKeyOf(copy);
        return copy;
      }),
      monitors: monitors.filter(function (entry) { return entry && entry.id != null; }).map(function (entry, index) {
        return Object.assign({ name: "Monitor " + (index + 1) }, entry, { id: String(entry.id) });
      }),
      activeWindowId: payload && payload.activeWindowId != null ? String(payload.activeWindowId) : null
    };
  }

  function applySnapshot(payload) {
    var snapshot = normalizeSnapshot(payload || {});
    model.windows = snapshot.windows;
    model.monitors = snapshot.monitors;
    model.activeWindowId = snapshot.activeWindowId;
    if (model.selectedWindowId && !windowById(model.selectedWindowId)) model.selectedWindowId = null;
    model.connection = "live";
    render();
  }

  function fixtureExecute(command) {
    model.commandLog.push(JSON.parse(JSON.stringify(command)));
    var windowInfo = windowById(command.windowId);
    if (!windowInfo) return { ok: false, error: "window not found" };
    if (command.command === "focus") {
      model.activeWindowId = windowInfo.id;
      windowInfo.state = windowInfo.state === "minimized" ? "normal" : windowInfo.state;
    } else if (command.command === "minimize") {
      windowInfo.state = "minimized";
      if (String(model.activeWindowId || "") === windowInfo.id) model.activeWindowId = null;
    } else if (command.command === "maximize_restore") {
      windowInfo.state = windowInfo.state === "maximized" ? "normal" : "maximized";
      model.activeWindowId = windowInfo.id;
    } else if (command.command === "snap_left" || command.command === "snap_right") {
      windowInfo.state = "normal";
      model.activeWindowId = windowInfo.id;
      windowInfo.layout = command.command === "snap_left" ? "left" : "right";
    } else if (command.command === "move_monitor") {
      var validMonitor = model.monitors.some(function (monitor) { return String(monitor.id) === String(command.monitorId); });
      if (!validMonitor) return { ok: false, error: "monitor not found" };
      windowInfo.monitorId = String(command.monitorId);
      model.activeWindowId = windowInfo.id;
    } else if (command.command === "close") {
      model.windows = model.windows.filter(function (entry) { return entry.id !== windowInfo.id; });
      if (String(model.activeWindowId || "") === windowInfo.id) model.activeWindowId = null;
      if (String(model.selectedWindowId || "") === windowInfo.id) model.selectedWindowId = null;
    }
    render();
    return { ok: true };
  }

  function sendCommand(command, extra) {
    var selected = selectedWindow();
    if (!selected) return false;
    var payload = Object.assign({ type: "command", command: command, windowId: selected.id }, extra || {});
    if (model.fixtureMode) {
      var result = fixtureExecute(payload);
      if (!result.ok) toast(result.error || "Window action failed");
      return result.ok;
    }
    if (!model.socket || model.socket.readyState !== WebSocket.OPEN || model.connection !== "live") return false;
    try {
      model.socket.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  function selectWindow(id, focus) {
    if (!windowById(id)) return;
    model.selectedWindowId = String(id);
    render();
    if (focus) sendCommand("focus");
  }

  function togglePin() {
    var selected = selectedWindow();
    if (!selected) return;
    var key = appKeyOf(selected);
    if (!key) return;
    if (model.pins[key]) {
      delete model.pins[key];
      toast("Application unpinned");
    } else {
      model.pins[key] = {
        key: key,
        appKey: key,
        appName: selected.appName || selected.processName || "Application",
        processName: selected.processName || "",
        iconDataUri: selected.iconDataUri || ""
      };
      toast("Application pinned");
    }
    savePins();
    render();
  }

  function openMonitorSheet() {
    var selected = selectedWindow();
    if (!selected) return;
    var host = byId("monitorOptions");
    if (!host) return;
    host.innerHTML = model.monitors.map(function (monitor, index) {
      var active = String(monitor.id) === String(selected.monitorId || "");
      return '<button class="monitor-option' + (active ? ' current' : '') + '" type="button" data-monitor-id="' + escapeHtml(monitor.id) + '">' +
        '<span class="monitor-number">' + (index + 1) + '</span>' +
        '<span class="monitor-copy"><strong>' + escapeHtml(monitor.name || ("Monitor " + (index + 1))) + '</strong><small>' + escapeHtml(String(monitor.width || "?") + " × " + String(monitor.height || "?")) + (monitor.primary ? " • PRIMARY" : "") + '</small></span>' +
        '<span class="monitor-current">' + (active ? "CURRENT" : "MOVE") + '</span>' +
      '</button>';
    }).join("");
    var sheet = byId("monitorSheet");
    sheet.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
  }

  function closeMonitorSheet() {
    var sheet = byId("monitorSheet");
    if (!sheet) return;
    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
  }

  function openCloseSheet() {
    var selected = selectedWindow();
    if (!selected) return;
    byId("closeTarget").textContent = (selected.appName || selected.processName || "Application") + " • " + (selected.title || "Untitled window");
    var sheet = byId("closeSheet");
    sheet.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
  }

  function closeCloseSheet() {
    var sheet = byId("closeSheet");
    if (!sheet) return;
    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
  }

  function startFixture(fixture) {
    model.fixtureMode = true;
    if (model.reconnectTimer) { clearTimeout(model.reconnectTimer); model.reconnectTimer = null; }
    var snapshot = fixture && fixture.snapshot ? fixture.snapshot : fixture;
    applySnapshot(snapshot || {});
  }

  function socketMessage(payload) {
    if (!payload || typeof payload !== "object") return;
    if (payload.type === "auth_ok") {
      model.connection = "live";
      render();
      return;
    }
    if (payload.type === "pairing_required") {
      model.connection = payload.reason === "invalid_key" ? "denied" : "pairing";
      render();
      return;
    }
    if (payload.type === "protocol_mismatch") {
      model.connection = "version_mismatch";
      render();
      try { if (model.socket) model.socket.close(); } catch (error) {}
      return;
    }
    if (payload.type === "snapshot") {
      applySnapshot(payload);
      return;
    }
    if (payload.type === "command_result" && payload.ok === false) {
      toast(payload.error || "Window action failed");
    }
  }

  function isTerminalConnectionState() {
    return model.connection === "denied" || model.connection === "version_mismatch";
  }

  function scheduleReconnect() {
    if (model.fixtureMode || model.shuttingDown || model.reconnectTimer || isTerminalConnectionState()) return;
    model.reconnectTimer = setTimeout(function () {
      model.reconnectTimer = null;
      startLiveConnection();
    }, RECONNECT_MS);
  }

  function installSocket(socket) {
    model.socket = socket;
    socket.addEventListener("message", function (event) {
      var payload;
      try { payload = JSON.parse(String(event.data || "")); } catch (error) { return; }
      socketMessage(payload);
    });
    socket.addEventListener("close", function () {
      if (model.socket !== socket) return;
      model.socket = null;
      if (!isTerminalConnectionState()) {
        model.connection = model.settings.bridgeKey ? "disconnected" : "pairing";
        render();
        scheduleReconnect();
      }
    });
    socket.addEventListener("error", function () {
      if (model.socket !== socket || isTerminalConnectionState()) return;
      model.connection = "disconnected";
      render();
    });
    socket.send(JSON.stringify({ type: "hello", protocol: 1, key: model.settings.bridgeKey, client: "xeneon-window-manager" }));
  }

  function startLiveConnection() {
    if (model.fixtureMode || model.shuttingDown) return;
    readSettings();
    if (!model.settings.bridgeKey) {
      model.connection = "pairing";
      render();
      scheduleReconnect();
      return;
    }
    if (model.socket && (model.socket.readyState === WebSocket.OPEN || model.socket.readyState === WebSocket.CONNECTING)) return;
    model.connection = "connecting";
    render();
    var socket;
    try { socket = new WebSocket(WINDOW_SERVICE_URL); }
    catch (error) {
      model.connection = "disconnected";
      render();
      scheduleReconnect();
      return;
    }
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      try { socket.close(); } catch (error) {}
      model.connection = "disconnected";
      render();
      scheduleReconnect();
    }, 1800);
    socket.addEventListener("open", function () {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      installSocket(socket);
    }, { once: true });
    socket.addEventListener("error", function () {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      model.connection = "disconnected";
      render();
      scheduleReconnect();
    }, { once: true });
  }

  function refreshSettings() {
    var keyChanged = readSettings();
    if (keyChanged && model.reconnectTimer) {
      clearTimeout(model.reconnectTimer);
      model.reconnectTimer = null;
    }
    if (keyChanged) {
      model.connection = model.settings.bridgeKey ? "connecting" : "pairing";
    }
    render();
    if (!model.fixtureMode && keyChanged) startLiveConnection();
  }

  function installIcueLifecycle() {
    var events;
    try { events = globalThis.icueEvents; } catch (error) { events = null; }
    if (!events || typeof events !== "object") events = {};
    events.onICUEInitialized = refreshSettings;
    events.onDataUpdated = refreshSettings;
    globalThis.icueEvents = events;
  }

  function installEvents() {
    byId("windowList").addEventListener("click", function (event) {
      var button = event.target.closest && event.target.closest("[data-window-id]");
      if (!button) return;
      selectWindow(button.getAttribute("data-window-id"), true);
    });
    byId("pinnedList").addEventListener("click", function (event) {
      var button = event.target.closest && event.target.closest("[data-pin-key]");
      if (!button) return;
      var key = String(button.getAttribute("data-pin-key") || "");
      for (var index = 0; index < model.windows.length; index += 1) {
        if (appKeyOf(model.windows[index]) === key) {
          selectWindow(model.windows[index].id, true);
          return;
        }
      }
      toast("Pinned app is not open");
    });

    byId("pinAction").addEventListener("click", togglePin);
    byId("minimizeAction").addEventListener("click", function () { sendCommand("minimize"); });
    byId("maximizeAction").addEventListener("click", function () { sendCommand("maximize_restore"); });
    byId("snapLeftAction").addEventListener("click", function () { sendCommand("snap_left"); });
    byId("snapRightAction").addEventListener("click", function () { sendCommand("snap_right"); });
    byId("moveAction").addEventListener("click", openMonitorSheet);
    byId("closeAction").addEventListener("click", openCloseSheet);
    byId("monitorSheetClose").addEventListener("click", closeMonitorSheet);
    byId("monitorOptions").addEventListener("click", function (event) {
      var button = event.target.closest && event.target.closest("[data-monitor-id]");
      if (!button) return;
      var monitorId = button.getAttribute("data-monitor-id");
      closeMonitorSheet();
      sendCommand("move_monitor", { monitorId: monitorId });
    });
    byId("cancelClose").addEventListener("click", closeCloseSheet);
    byId("confirmClose").addEventListener("click", function () {
      closeCloseSheet();
      sendCommand("close");
    });
    window.addEventListener("resize", function () { applySlot(); render(); });
    window.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      closeMonitorSheet();
      closeCloseSheet();
    });
  }

  function installTestHooks() {
    globalThis.__PACKRAT_WINDOW_TEST__ = {
      getState: function () {
        return {
          connection: model.connection,
          windows: model.windows.map(function (windowInfo) {
            return { id: windowInfo.id, title: windowInfo.title, state: windowInfo.state, monitorId: windowInfo.monitorId, appKey: appKeyOf(windowInfo) };
          }),
          monitors: model.monitors.map(function (monitor) { return { id: monitor.id, name: monitor.name, primary: Boolean(monitor.primary) }; }),
          activeWindowId: model.activeWindowId,
          selectedWindowId: model.selectedWindowId,
          pins: Object.keys(model.pins),
          commandLog: model.commandLog.slice(),
          slot: document.body.getAttribute("data-slot"),
          booted: model.booted,
          shuttingDown: model.shuttingDown
        };
      },
      snapshot: function (snapshot) { applySnapshot(snapshot || {}); },
      connection: function (state) { model.connection = String(state || "disconnected"); render(); },
      select: function (id, focus) { selectWindow(id, Boolean(focus)); },
      command: function (name, extra) { return sendCommand(name, extra || {}); },
      clearPins: function () { model.pins = {}; savePins(); render(); },
      setPins: function (pins) { model.pins = pins || {}; savePins(); render(); }
    };
  }

  function shutdown() {
    model.shuttingDown = true;
    if (model.reconnectTimer) {
      clearTimeout(model.reconnectTimer);
      model.reconnectTimer = null;
    }
    if (model.toastTimer) {
      clearTimeout(model.toastTimer);
      model.toastTimer = null;
    }
    if (model.socket) {
      try { model.socket.close(); } catch (error) {}
      model.socket = null;
    }
  }

  function boot() {
    if (model.booted) return;
    model.booted = true;
    model.shuttingDown = false;
    installIcueLifecycle();
    applySlot();
    loadPins();
    readSettings();
    installEvents();
    installTestHooks();

    var fixture = null;
    try { fixture = globalThis.__PACKRAT_WINDOW_FIXTURE__ || null; } catch (error) { fixture = null; }
    if (fixture) startFixture(fixture);
    else startLiveConnection();

    window.addEventListener("pagehide", shutdown, { once: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();

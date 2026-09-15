
/* Browser widgets cannot send ICMP. This optional monitor measures a tiny HTTPS
 * round trip to Cloudflare and never starts while Show Ping is disabled. */
function renderPing() {
    var host = document.getElementById("pingStatus");
    var enabled = settings().showPing;
    host.hidden = !enabled;
    if (!enabled) return;
    host.textContent = pingState.latency === null
        ? (pingState.failed ? "PING OFFLINE" : "PING --")
        : "PING " + Math.round(pingState.latency) + " MS";
    host.setAttribute("data-state", pingState.failed ? "failed" : (pingState.latency === null ? "waiting" : "live"));
}

function samplePing() {
    if (!settings().showPing || pingState.inFlight || (document.hidden && pingVisibilityConfirmed)) return;
    pingState.inFlight = true;
    var started = performance.now();
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var finished = false;
    function complete(success) {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (success) {
            pingState.latency = Math.max(0, performance.now() - started);
            pingState.failed = false;
        } else {
            pingState.latency = null;
            pingState.failed = true;
        }
        pingState.inFlight = false;
        renderPing();
    }
    var timeout = setTimeout(function () {
        if (controller) controller.abort();
        complete(false);
    }, PING_TIMEOUT_MS);
    fetch(PING_URL + "&packrat_t=" + Date.now(), {
        method: "GET",
        cache: "no-store",
        mode: "no-cors",
        credentials: "omit",
        redirect: "follow",
        signal: controller ? controller.signal : undefined
    }).then(function (response) {
        /* Opaque is expected for file-origin no-cors timing. The body is irrelevant;
         * request-to-response completion is the measurement. */
        if (!response) { complete(false); return; }
        try { if (response.body && response.body.cancel) response.body.cancel(); } catch (e) { }
        complete(true);
    }, function () { complete(false); });
}

function stopPingTimer() {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
}

function syncPingFeature() {
    if (!settings().showPing || (document.hidden && pingVisibilityConfirmed)) {
        stopPingTimer();
        renderPing();
        return;
    }
    renderPing();
    if (!pingTimer) {
        samplePing();
        pingTimer = setInterval(samplePing, PING_INTERVAL_MS);
    }
}

/* Touch controls. */
function openSensorEditor(id) {
    selectedSensorId = id;
    var pref = sensorPref(id);
    document.getElementById("editorName").textContent = names[id] || id;
    document.getElementById("rangeMin").value = pref.min === null ? "" : String(pref.min);
    document.getElementById("rangeMax").value = pref.max === null ? "" : String(pref.max);
    document.getElementById("rangeError").textContent = "";
    Array.prototype.forEach.call(document.querySelectorAll(".mode-button"), function (button) {
        button.classList.toggle("active", button.getAttribute("data-mode") === pref.mode);
    });
    document.getElementById("sensorEditor").hidden = false;
}

function closeSensorEditor() {
    document.getElementById("sensorEditor").hidden = true;
    selectedSensorId = null;
}

function saveEditorRange() {
    if (!selectedSensorId) return;
    var minRaw = document.getElementById("rangeMin").value.trim();
    var maxRaw = document.getElementById("rangeMax").value.trim();
    var error = document.getElementById("rangeError");
    if (!minRaw && !maxRaw) {
        var automatic = sensorPref(selectedSensorId);
        automatic.min = null;
        automatic.max = null;
        setSensorPref(selectedSensorId, automatic);
        error.textContent = "";
        renderSensors();
        return;
    }
    var min = Number(minRaw);
    var max = Number(maxRaw);
    if (!minRaw || !maxRaw || !isFinite(min) || !isFinite(max) || max <= min) {
        error.textContent = "Enter two numbers with HIGH greater than LOW.";
        return;
    }
    var pref = sensorPref(selectedSensorId);
    pref.min = min;
    pref.max = max;
    setSensorPref(selectedSensorId, pref);
    error.textContent = "RANGE APPLIED";
    renderSensors();
}

function bindControls() {
    document.getElementById("fpsHeroButton").addEventListener("click", function () {
        fpsState.heroUnit = fpsState.heroUnit === "fps" ? "ms" : "fps";
        fpsState.dirty = true;
        persistPreferences();
        renderFps();
    });
    document.getElementById("frameWindowButton").addEventListener("click", function () {
        fpsState.windowIndex = (fpsState.windowIndex + 1) % FPS_WINDOWS.length;
        fpsState.statsCache = null;
        fpsState.dirty = true;
        persistPreferences();
        renderFps();
    });
    document.getElementById("pagePrev").addEventListener("click", function () {
        sensorPage = Math.max(0, sensorPage - 1);
        renderSensors();
    });
    document.getElementById("pageNext").addEventListener("click", function () {
        var pages = Math.max(1, Math.ceil(sensorList().length / capacityForSlot()));
        sensorPage = Math.min(pages - 1, sensorPage + 1);
        renderSensors();
    });
    document.getElementById("cells").addEventListener("click", function (event) {
        var cell = event.target.closest(".cell");
        if (cell) openSensorEditor(cell.getAttribute("data-sensor-id"));
    });
    document.getElementById("cells").addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        var cell = event.target.closest(".cell");
        if (cell) { event.preventDefault(); openSensorEditor(cell.getAttribute("data-sensor-id")); }
    });
    document.getElementById("editorClose").addEventListener("click", closeSensorEditor);
    document.getElementById("rangeSave").addEventListener("click", saveEditorRange);
    document.getElementById("rangeAuto").addEventListener("click", function () {
        if (!selectedSensorId) return;
        var pref = sensorPref(selectedSensorId);
        pref.min = null;
        pref.max = null;
        setSensorPref(selectedSensorId, pref);
        document.getElementById("rangeMin").value = "";
        document.getElementById("rangeMax").value = "";
        document.getElementById("rangeError").textContent = "AUTO RANGE ACTIVE";
        renderSensors();
    });
    document.getElementById("modeButtons").addEventListener("click", function (event) {
        var button = event.target.closest(".mode-button");
        if (!button || !selectedSensorId) return;
        var pref = sensorPref(selectedSensorId);
        pref.mode = button.getAttribute("data-mode");
        setSensorPref(selectedSensorId, pref);
        Array.prototype.forEach.call(document.querySelectorAll(".mode-button"), function (item) {
            item.classList.toggle("active", item === button);
        });
        renderSensors();
    });
    window.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !document.getElementById("sensorEditor").hidden) closeSensorEditor();
    });
    window.addEventListener("resize", rateLimit(function () {
        sensorPage = 0;
        renderSensors();
        fpsState.dirty = true;
        renderFps();
    }, 150));
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
            pingVisibilityConfirmed = true;
            /* iCUE may preserve the webview across dashboard pages. Reapply the
             * concrete background from the current property exactly once on return. */
            applyPersonalization();
            applyDisplaySettings();
        }
        if (document.hidden && pingVisibilityConfirmed) {
            stopPingTimer();
            return;
        }
        syncFpsFeature();
        syncPingFeature();
    });
    window.addEventListener("pageshow", function () {
        applyPersonalization();
        applyDisplaySettings();
        renderSensors();
        renderFps();
    });
    window.addEventListener("beforeunload", persistPreferences);
}

function t(value) { return value; }

pluginSensorsdataproviderEvents = {
    onInitialized: function () {
        sensorReady = wireSensorPlugin();
        startSensorSampling();
        renderFps();
    }
};

pluginFpsdataproviderEvents = {
    onInitialized: function () {
        syncFpsFeature();
    }
};

packratEvents(function () {
    applyDisplaySettings();
    restorePreferenceFallbackIfNeeded();
    syncFpsFeature();
    syncPingFeature();
    sensorPage = 0;
    renderSensors();
    fpsState.dirty = true;
    renderFps();
    restartSensors();
});

packratBoot(function () {
    store = durableStore("history");
    prefsStore = durableStore("preferences");
    restore();
    bindControls();
    sensorReady = wireSensorPlugin();
    applyDisplaySettings();
    renderSensors();
    renderFps();
    startSensorSampling();
    syncFpsFeature();
    syncPingFeature();
});

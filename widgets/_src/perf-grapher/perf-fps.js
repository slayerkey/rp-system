var fpsSampleTimer = null;
var fpsRenderTimer = null;

function fpsCall(method) {
    return new Promise(function (resolve) {
        var plugin = window.plugins && window.plugins.Fpsdataprovider;
        if (!plugin || !plugin[method]) { resolve(null); return; }
        var requestId = nextFpsRequest++;
        fpsPending[requestId] = resolve;
        setTimeout(function () {
            if (fpsPending[requestId]) { delete fpsPending[requestId]; resolve(null); }
        }, 4000);
        try { plugin[method](requestId); }
        catch (e) { delete fpsPending[requestId]; resolve(null); }
    });
}

function asBoolean(value) {
    return value === true || value === 1 || String(value).toLowerCase() === "true";
}

function sameProcess(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function resetFpsSession(process) {
    fpsState.samples = [];
    fpsState.sessionProcess = String(process || "").trim();
    fpsState.statsCache = null;
}

function onFpsProcess(value) {
    var process = String(value || "").trim();
    fpsState.process = process;
    if (fpsState.available && process) {
        if (fpsState.sessionProcess && !sameProcess(fpsState.sessionProcess, process)) resetFpsSession(process);
        else if (!fpsState.sessionProcess) fpsState.sessionProcess = process;
    }
    fpsState.dirty = true;
}

function onFpsValue(value) {
    var fps = Number(value);
    fpsState.current = isFinite(fps) && fps > 0 ? fps : null;
    fpsState.dirty = true;
}

function onFpsAvailability(value) {
    var available = asBoolean(value);
    fpsState.available = available;
    if (!available) fpsState.current = null;
    fpsState.dirty = true;
    if (available && settings().showFps) {
        Promise.all([fpsCall("getCurrentFps"), fpsCall("getCurrentProcess")]).then(function (values) {
            onFpsProcess(values[1]);
            onFpsValue(values[0]);
        });
    }
}

function wireFpsPlugin() {
    var plugin = window.plugins && window.plugins.Fpsdataprovider;
    if (!plugin || !plugin.asyncResponse || !plugin.asyncResponse.connect) return false;
    if (wiredFpsPlugin === plugin) return true;
    plugin.asyncResponse.connect(function (requestId, value) {
        var resolve = fpsPending[requestId];
        if (resolve) { delete fpsPending[requestId]; resolve(value); }
    });
    if (plugin.fpsUpdated && plugin.fpsUpdated.connect) plugin.fpsUpdated.connect(onFpsValue);
    if (plugin.fpsAvailabilityChanged && plugin.fpsAvailabilityChanged.connect) {
        plugin.fpsAvailabilityChanged.connect(onFpsAvailability);
    }
    if (plugin.processChanged && plugin.processChanged.connect) plugin.processChanged.connect(onFpsProcess);
    wiredFpsPlugin = plugin;
    return true;
}

function refreshFpsState() {
    if (!settings().showFps) return;
    if (!wireFpsPlugin()) {
        onFpsAvailability(false);
        return;
    }
    Promise.all([
        fpsCall("getFpsAvailable"),
        fpsCall("getCurrentFps"),
        fpsCall("getCurrentProcess")
    ]).then(function (values) {
        fpsState.available = asBoolean(values[0]);
        onFpsProcess(values[2]);
        onFpsValue(fpsState.available ? values[1] : null);
    });
}

function captureFpsSample() {
    if (!fpsState.available || !isFinite(fpsState.current) || fpsState.current <= 0) return;
    var now = Date.now();
    fpsState.samples.push([now, fpsState.current]);
    fpsState.statsCache = null;
    fpsState.dirty = true;
}

function fpsWindowSamples(now) {
    var selected = FPS_WINDOWS[fpsState.windowIndex];
    if (!selected.ms) return fpsState.samples.slice();
    var cutoff = now - selected.ms;
    var start = 0;
    while (start < fpsState.samples.length && fpsState.samples[start][0] < cutoff) start++;
    return fpsState.samples.slice(start);
}

function lowestAverage(values, fraction) {
    var valid = values.map(Number).filter(function (value) { return isFinite(value) && value > 0; });
    if (!valid.length) return null;
    valid.sort(function (a, b) { return a - b; });
    var count = Math.max(1, Math.ceil(valid.length * fraction));
    var total = 0;
    for (var i = 0; i < count; i++) total += valid[i];
    return total / count;
}

function fpsLowStats(samples) {
    var now = Date.now();
    var cache = fpsState.statsCache;
    if (cache && cache.windowIndex === fpsState.windowIndex && cache.count === samples.length && now - cache.at < 1000) {
        return cache;
    }
    var values = samples.map(function (sample) { return sample[1]; });
    cache = {
        at: now,
        windowIndex: fpsState.windowIndex,
        count: samples.length,
        one: lowestAverage(values, 0.01),
        pointOne: lowestAverage(values, 0.001)
    };
    fpsState.statsCache = cache;
    return cache;
}

function downsampleFrametimes(samples, maxPoints) {
    if (!samples.length) return [];
    if (samples.length <= maxPoints) {
        return samples.map(function (sample) { return 1000 / sample[1]; });
    }
    var values = [];
    var bucket = samples.length / maxPoints;
    for (var i = 0; i < maxPoints; i++) {
        var start = Math.floor(i * bucket);
        var end = Math.max(start + 1, Math.floor((i + 1) * bucket));
        var worst = 0;
        for (var j = start; j < end && j < samples.length; j++) {
            worst = Math.max(worst, 1000 / samples[j][1]);
        }
        values.push(worst);
    }
    return values;
}

function renderFps() {
    fpsState.dirty = false;
    var cfg = settings();
    if (!cfg.showFps) {
        document.getElementById("sessionStatus").textContent = sensorReady ? "SENSORS LIVE" : "LOCAL TELEMETRY";
        return;
    }
    var available = fpsState.available && isFinite(fpsState.current) && fpsState.current > 0;
    var process = document.getElementById("processName");
    var value = document.getElementById("fpsValue");
    var unit = document.getElementById("fpsUnit");
    var hint = document.getElementById("fpsHint");
    var lowOne = document.getElementById("lowOne");
    var lowPointOne = document.getElementById("lowPointOne");
    var frameLatest = document.getElementById("frameLatest");
    var line = document.getElementById("frameLine");
    var area = document.getElementById("frameArea");
    document.getElementById("windowLabel").textContent = FPS_WINDOWS[fpsState.windowIndex].label;
    document.getElementById("sessionStatus").textContent = available ? "FPS LIVE" : (sensorReady ? "SENSORS LIVE" : "LOCAL TELEMETRY");

    if (!available) {
        process.textContent = "DESKTOP IDLE";
        value.textContent = "--";
        unit.textContent = fpsState.heroUnit === "ms" ? "MS" : "FPS";
        hint.textContent = "Start a game to begin a frametime session.";
        lowOne.textContent = "--";
        lowPointOne.textContent = "--";
        frameLatest.textContent = "-- MS";
        line.setAttribute("d", "");
        area.setAttribute("d", "");
        return;
    }

    process.textContent = (fpsState.process || fpsState.sessionProcess || "GAME SESSION").toUpperCase();
    if (fpsState.heroUnit === "ms") {
        value.textContent = (1000 / fpsState.current).toFixed(1);
        unit.textContent = "MS";
        hint.textContent = "Tap to show frames per second.";
    } else {
        value.textContent = String(Math.round(fpsState.current));
        unit.textContent = "FPS";
        hint.textContent = "Tap to show frametime milliseconds.";
    }

    var samples = fpsWindowSamples(Date.now());
    var stats = fpsLowStats(samples);
    lowOne.textContent = stats.one === null ? "--" : stats.one.toFixed(1);
    lowPointOne.textContent = stats.pointOne === null ? "--" : stats.pointOne.toFixed(1);
    frameLatest.textContent = (1000 / fpsState.current).toFixed(1) + " MS";

    var frametimes = downsampleFrametimes(samples, 240);
    var range = observedRange(frametimes);
    var path = scaledPath(frametimes, 100, 32, range.low, range.high);
    line.setAttribute("d", path);
    area.setAttribute("d", path ? path + "L100 32L0 32Z" : "");
}

function startFpsTimers() {
    if (!settings().showFps) return;
    if (!fpsSampleTimer) fpsSampleTimer = setInterval(captureFpsSample, FPS_SAMPLE_MS);
    if (!fpsRenderTimer) {
        fpsRenderTimer = setInterval(function () {
            if (fpsState.dirty) renderFps();
        }, FPS_RENDER_MS);
    }
}

function stopFpsTimers() {
    if (fpsSampleTimer) clearInterval(fpsSampleTimer);
    if (fpsRenderTimer) clearInterval(fpsRenderTimer);
    fpsSampleTimer = null;
    fpsRenderTimer = null;
}

function syncFpsFeature() {
    var enabled = settings().showFps;
    document.body.setAttribute("data-show-fps", enabled ? "true" : "false");
    document.getElementById("fpsPanel").hidden = !enabled;
    if (enabled) {
        refreshFpsState();
        startFpsTimers();
    } else {
        stopFpsTimers();
        fpsState.dirty = false;
        document.getElementById("sessionStatus").textContent = sensorReady ? "SENSORS LIVE" : "LOCAL TELEMETRY";
    }
}

function rawRange(data) {
    var low = Infinity;
    var high = -Infinity;
    for (var i = 0; i < data.length; i++) {
        var value = Number(data[i]);
        if (!isFinite(value)) continue;
        if (value < low) low = value;
        if (value > high) high = value;
    }
    if (!isFinite(low)) return { low: 0, high: 100 };
    return { low: low, high: high };
}

function observedRange(data) {
    var raw = rawRange(data);
    var low = raw.low;
    var high = raw.high;
    if (!data.length) return raw;
    if (low === high) {
        var singlePad = Math.max(1, Math.abs(low) * 0.1);
        return { low: low >= 0 ? Math.max(0, low - singlePad) : low - singlePad, high: high + singlePad };
    }
    var pad = (high - low) * 0.08;
    return { low: low >= 0 ? Math.max(0, low - pad) : low - pad, high: high + pad };
}

function displayRange(data, pref) {
    if (pref.min !== null && pref.max !== null && pref.max > pref.min) {
        return { low: pref.min, high: pref.max, custom: true };
    }
    var auto = observedRange(data);
    auto.custom = false;
    return auto;
}

function smoothValues(data, strength) {
    var values = data.map(Number).filter(function (value) { return isFinite(value); });
    if (strength <= 0 || values.length < 2) return values;
    var alpha = 1 / (1 + strength);
    var result = [values[0]];
    for (var i = 1; i < values.length; i++) {
        result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
    }
    return result;
}

function scaledPath(values, width, height, low, high) {
    if (!values || values.length < 2 || !isFinite(low) || !isFinite(high) || high <= low) return "";
    var step = width / (values.length - 1);
    var path = "";
    for (var i = 0; i < values.length; i++) {
        var value = clamp(Number(values[i]), low, high);
        var x = (i * step).toFixed(2);
        var y = (height - ((value - low) / (high - low)) * height).toFixed(2);
        path += (i ? "L" : "M") + x + " " + y;
    }
    return path;
}

function levelPercent(value, range) {
    if (!isFinite(value) || range.high <= range.low) return 0;
    return clamp(((value - range.low) / (range.high - range.low)) * 100, 0, 100);
}

function graphVisual(data, range, cfg) {
    var plotted = smoothValues(data, cfg.smoothing);
    var path = scaledPath(plotted, 100, 30, range.low, range.high);
    var area = cfg.showFill && path ? path + "L100 30L0 30Z" : "";
    return '<svg class="graph" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">'
        + (cfg.showGrid ? '<line class="grid" x1="0" y1="15" x2="100" y2="15"></line>' : "")
        + (area ? '<path class="area" d="' + area + '"></path>' : "")
        + (path ? '<path class="line" d="' + path + '"></path>' : "")
        + '</svg>';
}

function barVisual(latest, range) {
    return '<div class="bar-visual"><div class="bar-track"><div class="bar-fill" style="--level:'
        + levelPercent(latest, range).toFixed(2) + '%"></div></div></div>';
}

function radialVisual(latest, range) {
    return '<svg class="radial" viewBox="0 0 120 70" aria-hidden="true">'
        + '<path class="radial-track" pathLength="100" d="M15 60 A45 45 0 0 1 105 60"></path>'
        + '<path class="radial-fill" pathLength="100" style="--level:' + levelPercent(latest, range).toFixed(2)
        + '" d="M15 60 A45 45 0 0 1 105 60"></path></svg>';
}

function sensorValueHtml(latest, unit, cfg) {
    if (latest === null) return '<span class="value-number">-</span>';
    return '<span class="value-number">' + escapeHtml(fmt(latest, cfg.decimals)) + '</span>'
        + (unit ? '<span class="value-unit">' + escapeHtml(unit) + '</span>' : "");
}

function readoutVisual(latest, unit, cfg) {
    return '<div class="readout"><span class="readout-value">'
        + sensorValueHtml(latest, unit, cfg) + '</span></div>';
}

function sensorCardHtml(sensor, cfg) {
    var id = String(sensor.sensorId);
    var data = series[id] || [];
    var label = names[id] || id;
    var unit = units[id] || "";
    var latest = data.length ? Number(data[data.length - 1]) : null;
    if (latest !== null && !isFinite(latest)) latest = null;
    var color = safeColor(sensor.color, "#2BE86A");
    var pref = sensorPref(id);
    var range = displayRange(data, pref);
    var warn = cfg.showWarn && latest !== null && latest >= cfg.warnAt;
    var observed = rawRange(data);
    var visual = "";
    var footer = "";

    if (pref.mode === "bar") visual = barVisual(latest, range);
    else if (pref.mode === "radial") visual = radialVisual(latest, range);
    else if (pref.mode === "readout") visual = readoutVisual(latest, unit, cfg);
    else visual = graphVisual(data, range, cfg);

    if (pref.mode === "graph") {
        footer = '<div class="cell-foot"><span>'
            + (data.length ? escapeHtml(fmt(observed.low, cfg.decimals) + unit) : "") + '</span><span>'
            + (data.length ? escapeHtml(fmt(observed.high, cfg.decimals) + unit) : "") + '</span></div>';
    } else if (pref.mode === "bar" || pref.mode === "radial") {
        footer = '<div class="scale-foot"><span>' + escapeHtml(fmt(range.low, cfg.decimals) + unit)
            + '</span><span>' + escapeHtml(fmt(range.high, cfg.decimals) + unit) + '</span></div>';
    }

    return '<div class="cell interactive' + (warn ? " warn" : "") + '" role="button" tabindex="0"'
        + ' data-sensor-id="' + escapeHtml(id) + '" data-mode="' + pref.mode + '" style="--series:' + color + '">'
        + '<div class="cell-head"><span class="cell-name">' + escapeHtml(label) + '</span>'
        + '<span class="cell-value">' + sensorValueHtml(latest, unit, cfg) + '</span></div>'
        + '<div class="visual-slot">' + visual + '</div>' + footer
        + '<span class="mode-chip">' + pref.mode.toUpperCase() + '</span></div>';
}

function slotTier() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    if (width >= 2400 || height >= 2400) return "xl";
    if (width >= 1500 || height >= 1500) return "l";
    if (height <= 450) return "s";
    return "m";
}

function capacityForSlot() {
    var tier = slotTier();
    var showFps = settings().showFps;
    if (showFps) return { s: 4, m: 4, l: 8, xl: 12 }[tier];
    return { s: 8, m: 8, l: 12, xl: 16 }[tier];
}

function columnsForSlot() {
    var width = window.innerWidth;
    var landscape = width >= 760;
    var tier = slotTier();
    var showFps = settings().showFps;
    if (!landscape) return 2;
    if (tier === "xl") return 4;
    if (!showFps && tier === "l") return 3;
    if (showFps && tier === "m") return 1;
    return 2;
}

function renderSensors() {
    applyDisplaySettings();
    var cfg = settings();
    var list = sensorList();
    var host = document.getElementById("cells");
    var status = document.getElementById("sensorStatus");
    var pager = document.getElementById("sensorPager");
    var capacity = capacityForSlot();
    var pages = Math.max(1, Math.ceil(list.length / capacity));
    sensorPage = clamp(sensorPage, 0, pages - 1);
    host.setAttribute("data-columns", String(columnsForSlot()));
    host.setAttribute("data-capacity", String(capacity));

    if (!list.length) {
        pager.hidden = true;
        status.textContent = sensorReady ? "NO SENSORS" : "WAITING";
        host.innerHTML = '<div class="empty">'
            + (sensorReady ? t("Pick sensors in settings to start graphing.") : t("Waiting for the iCUE sensor service."))
            + '</div>';
        return;
    }

    var visible = list.slice(sensorPage * capacity, sensorPage * capacity + capacity);
    host.innerHTML = visible.map(function (sensor) { return sensorCardHtml(sensor, cfg); }).join("");
    if (pages > 1) {
        status.textContent = "";
        pager.hidden = false;
        document.getElementById("pageLabel").textContent = (sensorPage + 1) + " / " + pages;
    } else {
        pager.hidden = true;
        status.textContent = list.length + " LIVE";
    }
}

/* FPS provider plumbing and calculations. */
var fpsPending = {};
var nextFpsRequest = 1;
var wiredFpsPlugin = null;

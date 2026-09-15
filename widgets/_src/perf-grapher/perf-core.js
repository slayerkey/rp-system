/* Performance Grapher v1.4.1. Sensor history, FPS and the optional HTTPS latency
 * probe stay independent so one provider cannot take the other displays down. */

var HISTORY_POINTS = 120;
var HISTORY_MAX_AGE_MS = 600000;
var FPS_SAMPLE_MS = 100;
var FPS_RENDER_MS = 200;
var PING_URL = "https://speed.cloudflare.com/__down?bytes=1";
var PING_INTERVAL_MS = 10000;
var PING_TIMEOUT_MS = 4000;
var DURABLE_ROOT_KEY = "packratPerfGrapher";
var LEGACY_PREFS_INDEX_KEY = "packrat:perf-grapher:prefs-v3";
var FPS_WINDOWS = [
    { label: "60 SEC", ms: 60000 },
    { label: "5 MIN", ms: 300000 },
    { label: "SESSION", ms: null }
];
var SENSOR_MODES = ["graph", "bar", "radial", "readout"];

var series = {};
var names = {};
var units = {};
var sensorPrefs = {};
var sensorReady = false;
var sensorPage = 0;
var selectedSensorId = null;
var store = null;
var prefsStore = null;

var fpsState = {
    available: false,
    current: null,
    process: "",
    sessionProcess: "",
    samples: [],
    windowIndex: 0,
    heroUnit: "fps",
    dirty: true,
    statsCache: null
};

var pingState = {
    latency: null,
    failed: false,
    inFlight: false
};
var pingTimer = null;
var pingVisibilityConfirmed = !document.hidden;
var backgroundPaintTimers = [];

function num(name, fallback) {
    var value = Number(getIcueProperty(name, fallback));
    return isFinite(value) ? value : fallback;
}

function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
}

function propertyText(name, fallback) {
    var value = getIcueProperty(name, fallback);
    if (value === null || value === undefined) return fallback;
    return String(value);
}

function propertyBool(name, fallback) {
    var value = getIcueProperty(name, fallback);
    if (typeof value === "string") {
        var normalized = value.trim().toLowerCase();
        if (normalized === "false" || normalized === "0" || normalized === "off") return false;
        if (normalized === "true" || normalized === "1" || normalized === "on") return true;
    }
    return value === undefined || value === null ? fallback : Boolean(value);
}

function settings() {
    var font = propertyText("fontChoice", "system");
    if (["system", "bahnschriftSemi", "bahnschrift", "segoe", "arial", "consolas"].indexOf(font) < 0) {
        font = "system";
    }
    return {
        sensors: getIcueProperty("sensors", null),
        intervalSec: clamp(num("sampleSeconds", 2), 1, 30),
        decimals: clamp(Math.round(num("decimals", 0)), 0, 2),
        showWarn: propertyBool("showWarn", true),
        warnAt: num("warnAt", 80),
        showFill: getIcueProperty("showFill", true) !== false,
        showGrid: propertyBool("showGrid", true),
        smoothing: clamp(Math.round(num("smoothing", 0)), 0, 10),
        showFps: propertyBool("showFps", true),
        showPing: propertyBool("showPing", false),
        title: propertyText("widgetTitle", "Performance").trim().slice(0, 48) || "Performance",
        titleScale: clamp(num("sensorTitleSize", 100), 75, 200) / 100,
        valueScale: clamp(num("sensorValueSize", 100), 75, 180) / 100,
        headerScale: clamp(num("headerTitleSize", 100), 75, 180) / 100,
        font: font,
        sensorNameColor: safeColor(propertyText("sensorNameColor", "#F2F5F7"), "#F2F5F7")
    };
}

function fmt(value, decimals) {
    return Number(value).toFixed(decimals);
}

function safeColor(value, fallback) {
    var color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
}

/* QtWebEngine can deliver onDataUpdated just before the replacement property value
 * is visible to JavaScript, and it does not always repaint a background whose only
 * change is inside a CSS custom-property expression. Apply a concrete body colour
 * immediately, then re-read it across the short iCUE update window. */
function applyBackgroundPaint() {
    var color = safeColor(propertyText("backgroundColor", "#0B0E11"), "#0B0E11");
    var transparency = clamp(num("transparency", 0), 0, 100);
    var alpha = clamp(1 - transparency / 100, 0, 1);
    var red = parseInt(color.slice(1, 3), 16);
    var green = parseInt(color.slice(3, 5), 16);
    var blue = parseInt(color.slice(5, 7), 16);
    var rgba = "rgba(" + red + ", " + green + ", " + blue + ", " + alpha.toFixed(3) + ")";
    document.documentElement.style.setProperty("--bg-alpha", String(alpha));
    document.body.style.backgroundColor = rgba;
    document.body.setAttribute("data-background-paint", color + ":" + transparency);
    void document.body.offsetHeight;
}

function scheduleBackgroundPaint() {
    for (var i = 0; i < backgroundPaintTimers.length; i++) clearTimeout(backgroundPaintTimers[i]);
    backgroundPaintTimers = [];
    applyBackgroundPaint();
    [60, 180, 420].forEach(function (delay) {
        backgroundPaintTimers.push(setTimeout(applyBackgroundPaint, delay));
    });
}

function applyDisplaySettings() {
    var cfg = settings();
    document.body.setAttribute("data-font", cfg.font);
    document.body.setAttribute("data-show-fps", cfg.showFps ? "true" : "false");
    document.documentElement.style.setProperty("--sensor-title-scale", String(cfg.titleScale));
    document.documentElement.style.setProperty("--sensor-value-scale", String(cfg.valueScale));
    document.documentElement.style.setProperty("--header-title-scale", String(cfg.headerScale));
    document.documentElement.style.setProperty("--sensor-name", cfg.sensorNameColor);
    document.getElementById("titleText").textContent = cfg.title;
    document.getElementById("fpsPanel").hidden = !cfg.showFps;
    document.getElementById("pingStatus").hidden = !cfg.showPing;
    scheduleBackgroundPaint();
}

function sensorList() {
    var raw = settings().sensors;
    if (!raw) return [];
    if (typeof raw === "string") {
        try { raw = JSON.parse(raw); } catch (e) { return []; }
    }
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (item) { return item && item.sensorId; });
}

function defaultSensorPref() {
    return { mode: "graph", min: null, max: null };
}

function sensorPref(id) {
    var raw = sensorPrefs[id] || {};
    var mode = SENSOR_MODES.indexOf(raw.mode) >= 0 ? raw.mode : "graph";
    var min = Number(raw.min);
    var max = Number(raw.max);
    var custom = raw.min !== null && raw.min !== undefined && raw.min !== "" &&
        raw.max !== null && raw.max !== undefined && raw.max !== "" &&
        isFinite(min) && isFinite(max) && max > min;
    return { mode: mode, min: custom ? min : null, max: custom ? max : null };
}

function setSensorPref(id, next) {
    sensorPrefs[id] = {
        mode: SENSOR_MODES.indexOf(next.mode) >= 0 ? next.mode : "graph",
        min: next.min === null ? null : Number(next.min),
        max: next.max === null ? null : Number(next.max)
    };
    persistPreferences();
}

/* Sensor provider plumbing. */

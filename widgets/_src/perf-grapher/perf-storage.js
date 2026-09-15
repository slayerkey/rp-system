
/* CORSAIR persists widget-owned JSON under localStorage[uniqueId]. Keep history,
 * active preferences, and our preference backup inside that exact UUID record so
 * dashboard-page changes and iCUE restarts follow the documented storage path. */
function widgetStorageKey() {
    try {
        if (typeof uniqueId !== "undefined" && uniqueId) return String(uniqueId);
    } catch (e) { }
    return "packrat-perf-grapher-preview";
}

function readWidgetStorage() {
    try {
        var root = JSON.parse(localStorage.getItem(widgetStorageKey()));
        return root && typeof root === "object" && !Array.isArray(root) ? root : {};
    } catch (e) { return {}; }
}

function writeWidgetStorage(root) {
    try { localStorage.setItem(widgetStorageKey(), JSON.stringify(root)); }
    catch (e) { }
}

function durableStore(namespace) {
    return {
        read: function (fallback) {
            var root = readWidgetStorage();
            var bucket = root[DURABLE_ROOT_KEY];
            return bucket && bucket[namespace] !== undefined ? bucket[namespace] : fallback;
        },
        write: function (value) {
            var root = readWidgetStorage();
            var bucket = root[DURABLE_ROOT_KEY];
            if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) bucket = {};
            bucket[namespace] = value;
            root[DURABLE_ROOT_KEY] = bucket;
            writeWidgetStorage(root);
        }
    };
}

function readLegacyStore(namespace) {
    try {
        var raw = localStorage.getItem(widgetStorageKey() + ":" + namespace);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function sensorSignature() {
    return sensorList().map(function (sensor) { return String(sensor.sensorId); }).sort().join("|");
}

function normalizePrefs(raw) {
    var clean = {};
    if (!raw || typeof raw !== "object") return clean;
    for (var id in raw) {
        var source = raw[id] || {};
        var mode = SENSOR_MODES.indexOf(source.mode) >= 0 ? source.mode : "graph";
        var min = Number(source.min);
        var max = Number(source.max);
        var custom = source.min !== null && source.min !== undefined && source.min !== ""
            && source.max !== null && source.max !== undefined && source.max !== ""
            && isFinite(min) && isFinite(max) && max > min;
        clean[id] = { mode: mode, min: custom ? min : null, max: custom ? max : null };
    }
    return clean;
}

/* 1.4.1 contained a legacy standalone sensor-signature lookup. Keep it readable for
 * migration/preview compatibility, but real iCUE persistence must use the UUID JSON. */
function readLegacyPreferenceIndex() {
    try {
        var parsed = JSON.parse(localStorage.getItem(LEGACY_PREFS_INDEX_KEY));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (e) { return {}; }
}

function validPreferenceIndex(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readPreferenceIndex() {
    var persisted = durableStore("preferenceIndex").read(null);
    var index = validPreferenceIndex(persisted);
    if (Object.keys(index).length) return index;
    return readLegacyPreferenceIndex();
}

/* Keep a second copy by exact sensor set inside localStorage[uniqueId]. This protects
 * against an empty/corrupt active preference record without leaving CORSAIR's
 * documented persistence key. */
function writePreferenceIndex(payload) {
    if (!payload || typeof payload !== "object" || !payload.signature) return;
    var index = validPreferenceIndex(durableStore("preferenceIndex").read(null));
    index[payload.signature] = payload;

    /* Bound old sensor-set snapshots so changing hardware/configuration cannot grow
     * the widget's persisted UUID object forever. Keep the newest twelve signatures. */
    var keys = Object.keys(index);
    if (keys.length > 12) {
        keys.sort(function (a, b) {
            return Number(index[b] && index[b].at || 0) - Number(index[a] && index[a].at || 0);
        });
        for (var i = 12; i < keys.length; i++) delete index[keys[i]];
    }
    durableStore("preferenceIndex").write(index);
}

function preferencePayload() {
    return {
        version: 4,
        at: Date.now(),
        signature: sensorSignature(),
        sensorPrefs: normalizePrefs(sensorPrefs),
        view: { fpsWindow: fpsState.windowIndex, heroUnit: fpsState.heroUnit }
    };
}

function persistPreferences() {
    if (!prefsStore) return;
    var payload = preferencePayload();
    sensorPrefs = payload.sensorPrefs;
    prefsStore.write(payload);
    writePreferenceIndex(payload);
}

function applySavedPreferences(saved) {
    if (!saved || typeof saved !== "object"
        || !saved.sensorPrefs || typeof saved.sensorPrefs !== "object" || Array.isArray(saved.sensorPrefs)) {
        return false;
    }
    var normalized = normalizePrefs(saved.sensorPrefs);
    if (!Object.keys(normalized).length) return false;
    sensorPrefs = normalized;
    if (saved.view) {
        fpsState.windowIndex = clamp(Math.round(Number(saved.view.fpsWindow) || 0), 0, FPS_WINDOWS.length - 1);
        fpsState.heroUnit = saved.view.heroUnit === "ms" ? "ms" : "fps";
    }
    return true;
}

function restorePreferences(legacy) {
    var exact = prefsStore ? prefsStore.read(null) : null;
    if (applySavedPreferences(exact)) {
        /* Existing 1.4.1 preferences immediately seed the new UUID-scoped backup. */
        var migrated = preferencePayload();
        prefsStore.write(migrated);
        writePreferenceIndex(migrated);
        return true;
    }
    var previous = readLegacyStore("perf-prefs-v3");
    if (applySavedPreferences(previous)) {
        persistPreferences();
        return true;
    }
    var signature = sensorSignature();
    var fallback = signature ? readPreferenceIndex()[signature] : null;
    if (applySavedPreferences(fallback)) {
        persistPreferences();
        return true;
    }
    if (legacy && typeof legacy === "object" && applySavedPreferences(legacy)) {
        persistPreferences();
        return true;
    }
    return false;
}

function restorePreferenceFallbackIfNeeded() {
    if (Object.keys(sensorPrefs).length) return;
    var signature = sensorSignature();
    if (!signature) return;
    var fallback = readPreferenceIndex()[signature];
    if (applySavedPreferences(fallback)) {
        persistPreferences();
        renderSensors();
    }
}

function persistHistory() {
    if (!store) return;
    var trimmed = {};
    for (var id in series) trimmed[id] = series[id].slice(-HISTORY_POINTS);
    store.write({
        version: 3,
        history: { at: Date.now(), series: trimmed, names: names, units: units }
    });
}

function persist() {
    persistHistory();
    persistPreferences();
}

function restore() {
    if (!store) return;
    var saved = store.read(null);
    var migratedHistory = false;
    if (!saved) {
        saved = readLegacyStore("perf-history");
        migratedHistory = Boolean(saved);
    }
    var legacyPrefs = saved && saved.sensorPrefs && typeof saved.sensorPrefs === "object"
        ? { version: 2, sensorPrefs: saved.sensorPrefs, view: saved.view || null }
        : null;
    restorePreferences(legacyPrefs);
    if (!saved) return;

    var history = saved.history || saved;
    if (!history.series || !history.at || Date.now() - Number(history.at) > HISTORY_MAX_AGE_MS) return;
    series = history.series;
    names = history.names || {};
    units = history.units || {};
    for (var id in series) {
        if (!Array.isArray(series[id])) { delete series[id]; continue; }
        series[id] = series[id].filter(function (value) { return isFinite(Number(value)); })
            .map(Number).slice(-HISTORY_POINTS);
    }
    if (migratedHistory) persistHistory();
}

/* Sensor visualization helpers. */

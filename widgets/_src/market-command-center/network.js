/* Packrat widget networking: polling with last-known-good survival.
 *
 * House rule for every network widget: never blank the UI on a failed request.
 * Show the last good data with a stale indicator instead. This mirrors how the
 * Stream Deck trackers behave (plugins/_shared/src/espn.ts returns null on any
 * failure and the caller keeps rendering), and it matters more here, because a
 * dashboard widget is on screen continuously and a flicker to empty is very visible.
 *
 * Nothing in this file throws.
 */

var PACKRAT_TIMEOUT_MS = 8000;

function packratTimeoutSignal(ms) {
    if (AbortSignal.timeout) return AbortSignal.timeout(ms);
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, ms);
    return c.signal;
}

/* Resolves to parsed JSON, or null on any failure. Never rejects. */
function packratFetchJson(url, headers) {
    return fetch(url, {
        signal: packratTimeoutSignal(PACKRAT_TIMEOUT_MS),
        headers: headers || { accept: "application/json" }
    }).then(function (r) {
        return r.ok ? r.json() : null;
    }).catch(function () {
        return null;
    });
}

/* Resolves to raw text, or null. Used for the CSV and plain-text endpoints. */
function packratFetchText(url) {
    return fetch(url, { signal: packratTimeoutSignal(PACKRAT_TIMEOUT_MS) })
        .then(function (r) { return r.ok ? r.text() : null; })
        .catch(function () { return null; });
}

/* A polling data source that caches its last successful payload.
 *
 *   var src = packratSource({
 *       namespace: "quotes",
 *       load: function () { return packratFetchJson(url); },  // -> data or null
 *       onUpdate: function (data, meta) { ... }               // meta.stale, meta.ageMs
 *   });
 *   src.start(60);   // refresh minutes
 *
 * The cached payload is restored from localStorage on boot, so a widget that starts
 * while the machine is offline still paints real data immediately.
 */
function packratSource(opts) {
    var store = packratStore(opts.namespace);
    var cached = store.read(null);
    var timer = null;
    var intervalMs = 60000;

    function emit(fresh) {
        if (!cached) { opts.onUpdate(null, { stale: true, ageMs: null, empty: true }); return; }
        var age = Date.now() - cached.at;
        opts.onUpdate(cached.data, {
            stale: !fresh,
            ageMs: age,
            empty: false
        });
    }

    function tick() {
        Promise.resolve(opts.load()).then(function (data) {
            if (data === null || data === undefined) { emit(false); return; }
            cached = { at: Date.now(), data: data };
            store.write(cached);
            emit(true);
        }).catch(function () {
            emit(false);
        });
    }

    return {
        start: function (minutes) {
            intervalMs = Math.max(15, Number(minutes) || 5) * 60000;
            if (cached) emit(false);          // paint last-known-good immediately
            tick();
            if (timer) clearInterval(timer);
            timer = setInterval(tick, intervalMs);
        },
        refresh: tick,
        stop: function () { if (timer) { clearInterval(timer); timer = null; } }
    };
}

/* "3m ago" / "2h ago", for the stale indicator. */
function packratAgo(ms) {
    if (ms === null || ms === undefined) return "";
    var m = Math.floor(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
}

/* Splits a comma or space separated settings string into clean upper/lower tokens. */
function packratTokens(raw, lower) {
    if (!raw) return [];
    var parts = String(raw).split(/[,\s]+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
        var t = parts[i].trim();
        if (!t) continue;
        out.push(lower ? t.toLowerCase() : t.toUpperCase());
    }
    return out;
}

/* Packrat widget runtime: iCUE lifecycle, property access, personalization.
 *
 * Inlined into every widget by widgets/_build/inline.py. Classic script, never a
 * module: an inlined module gets its own scope and iCUE's injected property globals
 * stop resolving.
 */

function getIcueProperty(name, fallback) {
    /* Canonical 2026 iCUE path: tools/xeneon/inline.py emits a static direct-binding
     * reader for document-level settings. Avoid Function/eval here because QtWebEngine
     * and the compatibility runner do not expose lexical settings the same way. */
    var usable = function (v) {
        return v !== undefined && v !== null && v !== ""
            && !(typeof Node !== "undefined" && v instanceof Node);
    };
    try {
        if (typeof globalThis.__ratpackIcueRead === "function") {
            var direct = globalThis.__ratpackIcueRead(name);
            if (usable(direct)) return direct;
        }
    } catch (e) { }
    try {
        var w = window[name];
        if (usable(w)) return w;
    } catch (e) { }
    return fallback;
}

function applyPersonalization() {
    var root = document.documentElement;
    var map = { textColor: "--text", accentColor: "--accent", backgroundColor: "--bg" };
    for (var prop in map) {
        var v = getIcueProperty(prop, null);
        if (v) root.style.setProperty(map[prop], v);
    }
    void root.offsetHeight;
}

function packratBoot(onReady) {
    var tries = 0;
    (function attempt() {
        var live = false;
        try { live = (typeof iCUE_initialized !== "undefined" && iCUE_initialized); } catch (e) { }
        if (live || tries >= 15) {
            applyPersonalization();
            onReady(live);
            return;
        }
        tries++;
        setTimeout(attempt, 100);
    })();
}

function rateLimit(fn, minMs) {
    var last = 0, pending = null;
    return function () {
        var now = Date.now(), args = arguments, self = this;
        if (now - last >= minMs) { last = now; fn.apply(self, args); return; }
        if (pending) return;
        pending = setTimeout(function () {
            pending = null; last = Date.now(); fn.apply(self, args);
        }, minMs - (now - last));
    };
}

function packratStore(namespace) {
    var key = (typeof uniqueId !== "undefined" ? uniqueId : "packrat") + ":" + namespace;
    return {
        read: function (fallback) {
            try { return JSON.parse(localStorage.getItem(key)) || fallback; }
            catch (e) { return fallback; }
        },
        write: function (value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { }
        }
    };
}

function packratEvents(onData) {
    icueEvents = {
        onICUEInitialized: function () { applyPersonalization(); if (onData) onData(); },
        onDataUpdated: function () { applyPersonalization(); if (onData) onData(); }
    };
}

/* iCUE's document-level property bindings already exist before authored body scripts
 * execute. Apply the current Custom Style values immediately instead of waiting for
 * iCUE_initialized so first paint and strict lexical-host tests cannot see defaults. */
applyPersonalization();

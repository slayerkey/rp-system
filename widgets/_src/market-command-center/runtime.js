/* Packrat widget runtime: iCUE lifecycle, property access, personalization.
 *
 * Inlined into the shipping widget by tools/xeneon/inline.py. Classic script, never a
 * module: an inlined module gets its own scope and iCUE's injected property globals
 * stop resolving.
 */

/* iCUE properties can be document-level lexical bindings instead of normal window
 * properties. The canonical inline build injects __ratpackIcueRead with static direct
 * references for every declared control; globalThis is only the compatibility fallback.
 */
function getIcueProperty(name, fallback) {
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
        var w = globalThis[name];
        return usable(w) ? w : fallback;
    } catch (e) {
        return fallback;
    }
}

/* Personalization properties map straight onto the CSS custom properties in
 * tokens.css, so a widget never has to restyle anything by hand. */
function applyPersonalization() {
    var root = document.documentElement;
    var map = { textColor: "--text", accentColor: "--accent", backgroundColor: "--bg" };
    for (var prop in map) {
        var v = getIcueProperty(prop, null);
        if (v) root.style.setProperty(map[prop], v);
    }
    var trans = getIcueProperty("transparency", null);
    if (trans !== null && trans !== undefined) {
        root.style.setProperty("--bg-alpha", String(1 - Number(trans) / 100));
    }
}

/* iCUE_initialized read once is a documented timing coin-flip: it intermittently
 * reads false even when genuinely running inside iCUE. Retry for ~1.5s, then boot
 * regardless so the widget still renders standalone in a browser or preview tool.
 */
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

/* Programmatic refresh paths must stay at or under 10 updates/second; iCUE's own
 * render loop is capped at 30fps by default (iCUE.fpsLimit). */
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

/* Per-instance persistence. iCUE injects `uniqueId` (the widget instance's QUuid),
 * which is the documented localStorage key, so two copies of the same widget on one
 * dashboard keep separate state. Never store tokens here: user-supplied keys belong
 * in a textfield property, which iCUE persists for you.
 */
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

/* iCUE calls onDataUpdated whenever any property changes. Assigning icueEvents is
 * mandatory even for a widget with zero properties: the import validator rejects a
 * widget whose sources never reference it. */
function packratEvents(onData) {
    icueEvents = {
        onICUEInitialized: function () { applyPersonalization(); if (onData) onData(); },
        onDataUpdated: function () { applyPersonalization(); if (onData) onData(); }
    };
}

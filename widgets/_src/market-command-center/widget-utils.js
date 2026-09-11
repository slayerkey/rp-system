/* Packrat widget animation: a frame loop that respects the platform's limits.
 *
 * iCUE.fpsLimit defaults to 30, and the docs are explicit that programmatic update
 * paths should stay at or under that. requestAnimationFrame on a desktop runs at
 * 60Hz or higher, so an uncapped loop burns roughly double the CPU for frames the
 * device never shows. This caps to the limit iCUE actually reports.
 *
 * Also honours prefers-reduced-motion by falling back to a slow tick, so an ambient
 * widget still updates the time but stops animating.
 */

function packratFrameLoop(draw) {
    var limit = 30;
    try { if (typeof iCUE !== "undefined" && iCUE.fpsLimit) limit = Number(iCUE.fpsLimit) || 30; }
    catch (e) { /* not running under iCUE */ }

    var reduced = false;
    try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { }

    var minMs = 1000 / (reduced ? 2 : limit);
    var last = 0, raf = null, running = false;

    function step(ts) {
        if (!running) return;
        if (ts - last >= minMs) { last = ts; draw(ts, reduced); }
        raf = requestAnimationFrame(step);
    }

    return {
        start: function () { if (running) return; running = true; raf = requestAnimationFrame(step); },
        stop: function () { running = false; if (raf) cancelAnimationFrame(raf); raf = null; },
        reduced: function () { return reduced; }
    };
}

/* Backing-store sizing for a canvas. A widget slot is a fixed pixel size, but the
 * preview panel renders a scaled screenshot, so read the real box rather than
 * assuming the slot dimensions. Returns true when the size changed. */
function packratFitCanvas(canvas) {
    var r = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(r.width * dpr));
    var h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width === w && canvas.height === h) return false;
    canvas.width = w; canvas.height = h;
    return true;
}

/* Reads a CSS custom property off :root, so canvas drawing can use the same
 * personalization colours iCUE injected into the stylesheet. */
function packratCssVar(name, fallback) {
    try {
        var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    } catch (e) { return fallback; }
}

/* Zero-padded clock parts for the current time, in the user's locale conventions
 * where it matters and fixed where it does not. */
function packratClockParts(use24) {
    var d = new Date();
    var h = d.getHours();
    var suffix = h < 12 ? "AM" : "PM";
    if (!use24) { h = h % 12; if (h === 0) h = 12; }
    return {
        date: d,
        hh: use24 ? String(h).padStart(2, "0") : String(h),
        mm: String(d.getMinutes()).padStart(2, "0"),
        ss: String(d.getSeconds()).padStart(2, "0"),
        suffix: use24 ? "" : suffix,
        dateText: d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
        // Fractional units, for smooth sweep hands rather than ticking ones.
        fh: (d.getHours() % 12 + d.getMinutes() / 60) / 12,
        fm: (d.getMinutes() + d.getSeconds() / 60) / 60,
        fs: (d.getSeconds() + d.getMilliseconds() / 1000) / 60
    };
}

/* Sparkline path from a series of numbers, normalised into a 0..w by 0..h box.
 * Returns an SVG path `d` string, or "" when there is nothing to draw. */
function packratSparkPath(series, w, h) {
    if (!series || series.length < 2) return "";
    var min = Infinity, max = -Infinity, i;
    for (i = 0; i < series.length; i++) {
        if (series[i] < min) min = series[i];
        if (series[i] > max) max = series[i];
    }
    var span = (max - min) || 1;
    var step = w / (series.length - 1);
    var d = "";
    for (i = 0; i < series.length; i++) {
        var x = (i * step).toFixed(2);
        var y = (h - ((series[i] - min) / span) * h).toFixed(2);
        d += (i === 0 ? "M" : "L") + x + " " + y;
    }
    return d;
}

/* Ambient Art Clock Pack: four animated clock faces for a dashboard slot.
 *
 * No network, no sensors, no maintenance. This is the category the platform data
 * most clearly rewards: three of the top seven widgets are decorative clocks. The
 * bet is that a designed pack beats a single default face, and that aesthetic
 * differentiation cannot be patched away the way a feature can.
 *
 * All artwork is original geometry drawn at runtime. No bitmaps, no third-party
 * art, no remote fonts.
 */

var canvas, ctx, loop, faceName = "orbit";

function settings() {
    return {
        face: String(getIcueProperty("face", "orbit") || "orbit"),
        use24: getIcueProperty("use24Hour", true) !== false,
        showDate: getIcueProperty("showDate", true) !== false,
        showSeconds: getIcueProperty("showSeconds", true) !== false,
        intensity: Number(getIcueProperty("intensity", 60)) || 60
    };
}

/* --- faces -----------------------------------------------------------------
 * Each face draws into the full canvas box. The time text itself is DOM, layered
 * over the canvas, so it always honours the readability floors and stays crisp.
 */

function faceOrbit(t, w, h, cfg, accent, text) {
    // Three concentric arcs: hours, minutes, seconds. A sweep, not a tick.
    var p = packratClockParts(cfg.use24);
    var cx = w / 2, cy = h / 2;
    var r0 = Math.min(w, h) * 0.42;
    var rings = [
        { f: p.fh, r: r0, width: r0 * 0.055, color: accent, alpha: 0.95 },
        { f: p.fm, r: r0 * 0.82, width: r0 * 0.042, color: text, alpha: 0.5 },
        { f: p.fs, r: r0 * 0.66, width: r0 * 0.026, color: accent, alpha: 0.35 }
    ];
    if (!cfg.showSeconds) rings.pop();

    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        ctx.beginPath();
        ctx.strokeStyle = ring.color;
        ctx.globalAlpha = 0.08;
        ctx.lineWidth = ring.width;
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.globalAlpha = ring.alpha;
        ctx.lineCap = "round";
        ctx.arc(cx, cy, ring.r, -Math.PI / 2, -Math.PI / 2 + ring.f * Math.PI * 2);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

function faceMatrix(t, w, h, cfg, accent, text) {
    // Falling glyph rain. Column state persists across frames on the function.
    var cols = faceMatrix.cols;
    var cell = Math.max(14, Math.min(w, h) * 0.045);
    var n = Math.ceil(w / cell);
    if (!cols || cols.length !== n || faceMatrix.h !== h) {
        cols = faceMatrix.cols = [];
        faceMatrix.h = h;
        for (var i = 0; i < n; i++) {
            cols.push({ y: Math.random() * h, speed: 0.4 + Math.random() * 1.4 });
        }
    }
    ctx.font = Math.round(cell * 0.8) + "px 'Consolas','SF Mono',monospace";
    ctx.textAlign = "center";
    var density = cfg.intensity / 100;
    for (var c = 0; c < cols.length; c++) {
        var col = cols[c];
        col.y += col.speed * cell * 0.25;
        if (col.y > h + cell * 6) col.y = -Math.random() * h * 0.5;
        // A short trail per column, brightest at the head.
        for (var k = 0; k < 6; k++) {
            var y = col.y - k * cell;
            if (y < -cell || y > h + cell) continue;
            ctx.globalAlpha = (k === 0 ? 0.85 : 0.32 * (1 - k / 6)) * density;
            ctx.fillStyle = k === 0 ? text : accent;
            var ch = String.fromCharCode(0x30A0 + ((Math.floor(col.y / cell) + k * 7 + c) % 96));
            ctx.fillText(ch, c * cell + cell / 2, y);
        }
    }
    ctx.globalAlpha = 1;
}

function facePulse(t, w, h, cfg, accent) {
    // A slow breathing radial field. Period is tied to the minute, not the frame,
    // so two widgets side by side stay in phase.
    var p = packratClockParts(cfg.use24);
    var phase = (Math.sin(p.fs * Math.PI * 2) + 1) / 2;
    var r = Math.min(w, h) * (0.32 + phase * 0.16) * (0.6 + cfg.intensity / 250);
    var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
    g.addColorStop(0, accent);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.20 + phase * 0.14;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
}

function faceMinimal() { /* text only; the canvas stays clear */ }

var FACES = { orbit: faceOrbit, matrix: faceMatrix, pulse: facePulse, minimal: faceMinimal };

/* Tap to change face.
 *
 * A four-face pack whose faces can only be reached through the iCUE settings panel
 * sells as one clock with options. Cycling them on tap makes the pack itself the
 * thing you interact with, and it is the one interaction that suits every face
 * rather than belonging to a single aesthetic.
 *
 * Same contract as Retro Terminal's phosphor tap: the override is remembered per
 * instance, and changing Face in the settings panel takes control back, so the two
 * can never disagree about which face is current.
 */
var FACE_ORDER = ["orbit", "matrix", "pulse", "minimal"];
var faceStore = packratStore("face");
var faceOverride = faceStore.read(null);

function currentFace() {
    var prop = String(getIcueProperty("face", "orbit") || "orbit");
    if (faceOverride && faceOverride.from === prop) return faceOverride.face;
    if (faceOverride) {                   // the property moved under us; it wins
        faceOverride = null;
        faceStore.write(null);
    }
    return prop;
}

function cycleFace() {
    var prop = String(getIcueProperty("face", "orbit") || "orbit");
    var cur = (faceOverride && faceOverride.from === prop) ? faceOverride.face : prop;
    var next = FACE_ORDER[(FACE_ORDER.indexOf(cur) + 1) % FACE_ORDER.length];
    faceOverride = { face: next, from: prop };
    faceStore.write(faceOverride);
    applyFace();
}

/* --- render ---------------------------------------------------------------- */

function draw() {
    var cfg = settings();
    packratFitCanvas(canvas);
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    var accent = packratCssVar("--accent", "#2BE86A");
    var text = packratCssVar("--text", "#F2F5F7");
    var face = currentFace();
    (FACES[face] || faceOrbit)(Date.now(), w, h, cfg, accent, text);

    var p = packratClockParts(cfg.use24);
    document.getElementById("time").textContent =
        p.hh + ":" + p.mm + (cfg.showSeconds ? ":" + p.ss : "");
    document.getElementById("suffix").textContent = p.suffix;
    var dateEl = document.getElementById("date");
    dateEl.textContent = cfg.showDate ? p.dateText : "";
    dateEl.style.display = cfg.showDate ? "" : "none";
    document.body.setAttribute("data-face", face);
}

function applyFace() {
    var face = currentFace();
    // The matrix column cache is face-specific, so it has to be dropped whenever the
    // face changes, including a change made by tapping rather than by a property.
    if (face !== faceName) { faceName = face; faceMatrix.cols = null; }
    draw();
}

packratEvents(applyFace);

/* Draw immediately rather than waiting out packratBoot's iCUE retry window: a clock
 * that is blank for a second and a half on load reads as broken, and none of the
 * faces need iCUE data to render. packratBoot still applies personalization after. */
function startDrawing() {
    if (loop) return;
    canvas = document.getElementById("art");
    ctx = canvas.getContext("2d");
    loop = packratFrameLoop(draw);
    // pointerdown, not click: on the panel's touchscreen it fires without waiting
    // out the double-tap window.
    document.getElementById("stage").addEventListener("pointerdown", cycleFace);
    applyFace();
    loop.start();
    window.addEventListener("resize", function () { faceMatrix.cols = null; draw(); });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startDrawing);
} else {
    startDrawing();
}

packratBoot(function () { startDrawing(); applyFace(); });

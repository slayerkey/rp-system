/* Retro Terminal Ambient: a CRT console that boots, then keeps time.
 *
 * Free, and deliberately so: this is the discovery hook. It is the widget someone
 * installs first, leaves on all day, and sees the Packrat name under. No network,
 * no sensors, no maintenance, nothing that can break or need updating.
 *
 * Scanlines, vignette and tube flicker are drawn from original geometry. There is
 * no bitmap art and no remote font.
 */

var canvas, ctx, loop;
var booted = false, bootAt = 0, shownLines = -1;

var BOOT = [
    "PACKRAT SYSTEMS // TERMINAL",
    "more widgets ................... MARKETPLACE @PACKRAT",
    "initialising display bus ....... OK",
    "mounting widget surface ........ OK",
    "clock source ................... LOCAL",
    "network ........................ NOT REQUIRED",
    "tap screen ..................... CHANGE PHOSPHOR",
    "ready."
];

/* Tap to change phosphor.
 *
 * Real terminals shipped in a handful of phosphor colours, so cycling those on tap
 * is an interaction that belongs to this product rather than one bolted onto it.
 * The boot log advertises it once, which is the only discovery an ambient widget
 * with no chrome can offer.
 *
 * A tap OVERRIDES the Accent Color property, and the override is remembered per
 * instance so it survives a restart. Changing Accent Color in the settings panel
 * clears it: without that, someone who taps and then picks a colour in iCUE would
 * see their pick ignored with no way back short of guessing which one wins.
 */
var PHOSPHORS = ["#2BE86A", "#FFB000", "#41D0F0", "#F2F5F7", "#FF6BD6"];
var phosphorStore = packratStore("phosphor");
var override = phosphorStore.read(null);

function accentColour() {
    var prop = String(getIcueProperty("accentColor", PHOSPHORS[0]));
    if (override && override.from === prop) return override.color;
    if (override) {                       // the property moved under us; it wins
        override = null;
        phosphorStore.write(null);
    }
    return prop;
}

function applyAccent() {
    document.documentElement.style.setProperty("--accent", accentColour());
}

function cyclePhosphor() {
    var prop = String(getIcueProperty("accentColor", PHOSPHORS[0]));
    var current = (override && override.from === prop) ? override.color : prop;
    var next = PHOSPHORS[(PHOSPHORS.indexOf(current) + 1) % PHOSPHORS.length];
    override = { color: next, from: prop };
    phosphorStore.write(override);
    applyAccent();
}

function settings() {
    return {
        use24: getIcueProperty("use24Hour", true) !== false,
        label: String(getIcueProperty("label", "PACKRAT") || "PACKRAT"),
        scanlines: getIcueProperty("scanlines", true) !== false,
        flicker: getIcueProperty("flicker", true) !== false,
        showDate: getIcueProperty("showDate", true) !== false
    };
}

/* The boot log types itself out once, then the clock takes over. Pure decoration,
 * but it is what makes the widget feel alive on first install. */
function bootProgress() {
    var elapsed = Date.now() - bootAt;
    var perLine = 260;
    var shown = Math.min(BOOT.length, Math.floor(elapsed / perLine));
    if (shown >= BOOT.length && elapsed > perLine * BOOT.length + 600) booted = true;
    return shown;
}

function drawScanlines(w, h) {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#000000";
    var gap = Math.max(2, Math.round(h / 220));
    for (var y = 0; y < h; y += gap * 2) ctx.fillRect(0, y, w, gap);
    ctx.globalAlpha = 1;
}

function draw(ts, reduced) {
    var cfg = settings();
    packratFitCanvas(canvas);
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Vignette, so the panel reads as a curved tube rather than a flat rectangle.
    var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1,
                                     w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (cfg.scanlines) drawScanlines(w, h);

    var screen = document.getElementById("screen");
    // Slow brightness flicker: the one detail that reads CRT rather than LCD.
    if (cfg.flicker && !reduced) {
        var f = 0.97 + Math.sin(ts / 90) * 0.012 + Math.random() * 0.012;
        screen.style.opacity = String(Math.min(1, f));
    } else {
        screen.style.opacity = "1";
    }

    var p = packratClockParts(cfg.use24);
    document.getElementById("time").textContent = p.hh + ":" + p.mm + ":" + p.ss;
    document.getElementById("prompt").textContent = cfg.label.toUpperCase() + "@edge:~$";

    var dateEl = document.getElementById("date");
    dateEl.textContent = cfg.showDate
        ? p.date.getFullYear() + "-"
          + String(p.date.getMonth() + 1).padStart(2, "0") + "-"
          + String(p.date.getDate()).padStart(2, "0") + "  "
          + p.date.toLocaleDateString(undefined, { weekday: "long" })
        : "";

    if (!booted) {
        var n = bootProgress();
        if (n !== shownLines) {
            shownLines = n;
            document.getElementById("log").innerHTML = BOOT.slice(0, n).map(function (l) {
                return '<span class="line">' + l + "</span>";
            }).join("");
        }
        screen.setAttribute("data-mode", "boot");
    } else {
        screen.setAttribute("data-mode", "clock");
    }

    // Cursor blink is clock-driven rather than frame-driven, so it stays 1Hz at
    // any frame rate and does not speed up on a faster machine.
    document.getElementById("cursor").style.visibility =
        (Math.floor(Date.now() / 500) % 2) ? "hidden" : "visible";
}

// applyPersonalization() runs before this callback and writes --accent straight from
// the property, so a tapped phosphor has to be re-applied after it or every settings
// change silently reverts the colour the user just tapped in.
packratEvents(function () { applyAccent(); draw(performance.now(), false); });

/* Start drawing the moment the DOM is ready, NOT inside packratBoot.
 *
 * packratBoot retries the iCUE handshake for up to 1.5 seconds before calling back.
 * Under iCUE that resolves on the first try, but anywhere the flag is absent or late
 * (a browser, the settings-panel preview, a slow start) the widget sat on a blank
 * screen for the whole retry window. An ambient widget showing nothing for a second
 * and a half reads as broken, and this one needs no iCUE data to draw a clock.
 *
 * packratBoot still runs; it only applies personalization once iCUE is up.
 */
function startDrawing() {
    if (loop) return;
    canvas = document.getElementById("crt");
    ctx = canvas.getContext("2d");
    bootAt = Date.now();
    // pointerdown, not click: on the panel's touchscreen it fires immediately, while
    // click waits out the double-tap window and makes the widget feel unresponsive.
    document.getElementById("stage").addEventListener("pointerdown", cyclePhosphor);
    applyAccent();
    loop = packratFrameLoop(draw);
    loop.start();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startDrawing);
} else {
    startDrawing();
}

packratBoot(function () { startDrawing(); applyAccent(); });

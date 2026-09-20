/* AI Usage Dashboard: every provider's limits on one panel.
 *
 * ARCHITECTURE, and why it is a bridge rather than a direct call.
 *
 * There is no public CORS-open usage endpoint for any of these providers. Anthropic
 * gates browser access behind an explicit anthropic-dangerous-direct-browser-access
 * opt-in, the OAuth usage endpoint is undocumented, and the Stream Deck plugins
 * authenticate with Cookie and User-Agent headers that a browser engine strips from
 * a fetch. A widget calling those endpoints directly cannot work, and pretending
 * otherwise would ship a product that fails on every machine.
 *
 * So this reads from the Packrat Stream Deck plugin already running on the same PC,
 * over 127.0.0.1. That plugin has done the auth work, runs under Node where the
 * same-origin policy does not apply, and is already polling. The widget is a second
 * view onto data that exists.
 *
 * That makes this a cross-sell rather than a standalone: it needs the Stream Deck
 * plugin installed. The empty state says so plainly instead of showing a broken
 * dashboard.
 */

var BRIDGE_DEFAULT = "http://127.0.0.1:8787";

var state = { providers: [], meta: null, reachable: false };

var KNOWN = {
    claude:   { label: "Claude" },
    chatgpt:  { label: "ChatGPT" },
    codex:    { label: "Codex" },
    cursor:   { label: "Cursor" },
    copilot:  { label: "Copilot" },
    gemini:   { label: "Gemini" }
};

function settings() {
    var raw = String(getIcueProperty("bridgeUrl", BRIDGE_DEFAULT) || BRIDGE_DEFAULT).trim();
    return {
        bridge: raw.replace(/\/+$/, ""),
        refresh: Number(getIcueProperty("refreshMinutes", 5)) || 5,
        warnAt: Number(getIcueProperty("warnAt", 80)) || 80,
        showReset: getIcueProperty("showReset", true) !== false,
        compact: getIcueProperty("compact", false) === true,
        // How many providers get the full ring treatment. Anything past this shows
        // as a compact bar instead. The point is a hierarchy: the two or three you
        // actually watch stay glanceable, the rest are present without competing.
        rings: Math.max(0, Number(getIcueProperty("ringCount", 3)))
    };
}

/* The bridge reports a list of providers, each with a used/limit pair per window.
 * Anything it does not report simply does not appear: the widget never invents a
 * provider or a number. */
function loadUsage() {
    var cfg = settings();
    return packratFetchJson(cfg.bridge + "/usage").then(function (json) {
        if (!json) return null;
        var list = Array.isArray(json) ? json : (json.providers || []);
        if (!list.length) return null;
        return list.map(function (p) {
            var pct = null;
            if (typeof p.percent === "number") pct = p.percent;
            else if (typeof p.used === "number" && typeof p.limit === "number" && p.limit > 0) {
                pct = (p.used / p.limit) * 100;
            }
            var key = String(p.id || p.provider || "").toLowerCase();
            return {
                id: key,
                label: p.label || (KNOWN[key] && KNOWN[key].label) || (p.id || "Unknown"),
                percent: pct === null ? null : Math.max(0, Math.min(100, pct)),
                used: p.used, limit: p.limit,
                window: p.window || p.period || "",
                resetsAt: p.resetsAt || p.reset_at || null
            };
        });
    });
}

/* --- formatting ----------------------------------------------------------- */

function untilText(iso) {
    if (!iso) return "";
    var ms = new Date(iso).getTime() - Date.now();
    if (isNaN(ms)) return "";
    if (ms <= 0) return "resetting";
    var m = Math.floor(ms / 60000);
    if (m < 60) return "resets in " + m + "m";
    var h = Math.floor(m / 60);
    if (h < 24) return "resets in " + h + "h " + (m % 60) + "m";
    return "resets in " + Math.floor(h / 24) + "d";
}

function usedText(p) {
    if (typeof p.used === "number" && typeof p.limit === "number") {
        return Math.round(p.used).toLocaleString() + " / " + Math.round(p.limit).toLocaleString();
    }
    return p.window || "";
}

/* --- render ---------------------------------------------------------------- */

function ringHtml(p, cfg) {
    var pctv = p.percent === null ? 0 : p.percent;
    var warn = pctv >= cfg.warnAt;
    // 44 radius on a 100 box: circumference 276.46, so dashoffset is a clean map.
    var C = 276.46;
    var off = C * (1 - pctv / 100);
    return '<div class="prov' + (warn ? " warn" : "") + '">'
         + '<div class="ring-wrap">'
         +   '<svg class="ring" viewBox="0 0 100 100" aria-hidden="true">'
         +     '<circle class="track" cx="50" cy="50" r="44"/>'
         +     '<circle class="fill" cx="50" cy="50" r="44" '
         +        'style="stroke-dasharray:' + C + ';stroke-dashoffset:' + off.toFixed(1) + '"/>'
         +   '</svg>'
         +   '<span class="ring-pct">' + (p.percent === null ? "-" : Math.round(p.percent) + "%") + '</span>'
         + '</div>'
         + '<span class="prov-name">' + p.label + '</span>'
         + '<span class="prov-sub">' + usedText(p) + '</span>'
         + (cfg.showReset ? '<span class="prov-reset">' + untilText(p.resetsAt) + '</span>' : '')
         + '</div>';
}

/* The compact form: a horizontal bar. Same information, a quarter of the height,
 * so a second tier of providers costs almost no space. */
function barHtml(p, cfg) {
    var pctv = p.percent === null ? 0 : p.percent;
    var warn = pctv >= cfg.warnAt;
    return '<div class="bar-row' + (warn ? " warn" : "") + '">'
         + '<span class="bar-name">' + p.label + '</span>'
         + '<span class="bar-track"><span class="bar-fill" style="width:' + pctv.toFixed(1) + '%"></span></span>'
         + '<span class="bar-pct">' + (p.percent === null ? "-" : Math.round(p.percent) + "%") + '</span>'
         + (cfg.showReset ? '<span class="bar-reset">' + untilText(p.resetsAt) + '</span>' : '')
         + '</div>';
}

function render() {
    var cfg = settings();
    var host = document.getElementById("providers");
    var second = document.getElementById("secondary");
    var status = document.getElementById("status");

    if (!state.providers.length) {
        host.innerHTML = '<div class="empty">'
            + t("Waiting for the Packrat Stream Deck plugin on this PC.")
            + '</div>';
        second.innerHTML = "";
        status.textContent = "";
        status.className = "status";
        return;
    }

    document.body.setAttribute("data-compact", cfg.compact ? "1" : "0");
    var top = state.providers.slice(0, cfg.rings);
    var rest = state.providers.slice(cfg.rings);
    host.innerHTML = top.map(function (p) { return ringHtml(p, cfg); }).join("");
    second.innerHTML = rest.map(function (p) { return barHtml(p, cfg); }).join("");
    second.style.display = rest.length ? "" : "none";

    if (state.meta && state.meta.stale) {
        status.textContent = t("Offline") + " · " + packratAgo(state.meta.ageMs);
        status.className = "status stale";
    } else {
        status.textContent = "";
        status.className = "status";
    }
}

function t(s) { return s; }

/* --- wiring ---------------------------------------------------------------- */

var src = null;

function startSource() {
    if (src) src.stop();
    src = packratSource({
        namespace: "ai-usage",
        load: loadUsage,
        onUpdate: function (data, meta) {
            state.providers = data || [];
            state.meta = meta;
            render();
        }
    });
    src.start(settings().refresh);
}

var restart = rateLimit(startSource, 1500);

packratEvents(function () { render(); restart(); });

packratBoot(function () { startSource(); });

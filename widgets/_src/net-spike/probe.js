/* Network reachability probe for the iCUE widget runtime.
 *
 * Throwaway diagnostic, not a product. It answers one question the docs do not:
 * from a file:// origin inside QtWebEngine, which of the APIs the roadmap depends
 * on can a widget actually read?
 *
 * READABLE is the only reliable verdict here, and it is the only one the roadmap
 * needs: the fetch resolved and the body could be read, so the widget can use the
 * host directly. Everything else is reported as BLOCKED without a cause, because
 * the browser deliberately refuses to tell you one: a CORS rejection, a DNS
 * failure, a proxy, and an offline machine all surface as the same opaque
 * "TypeError: Failed to fetch".
 *
 * A mode:"no-cors" retry is run as a hint only. Do NOT read it as proof of a CORS
 * block: Chromium resolves no-cors requests with an opaque response in cases where
 * the request never actually succeeded, so it produces false CORS verdicts for
 * hosts that are simply unreachable (observed 2026-08-05 against site.api.espn.com,
 * which sends Access-Control-Allow-Origin: * yet failed from every origin on a
 * machine whose network could not route to it).
 *
 * To attribute a BLOCKED result, check the host's headers from the same machine:
 *   curl -s -o /dev/null -D - -H "Origin: null" "<url>" | grep -i access-control
 * ACAO present plus BLOCKED here means a network path problem, not CORS.
 */

var TIMEOUT_MS = 8000;

var TARGETS = [
    { key: "espn", label: "ESPN scoreboard", note: "NASCAR / UFC / Tennis",
      url: "https://site.api.espn.com/apis/site/v2/sports/racing/nascar-premier/scoreboard" },
    { key: "coingecko", label: "CoinGecko", note: "Crypto prices",
      url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd" },
    { key: "finnhub", label: "Finnhub", note: "Stock quotes (401 = readable = OK)",
      url: "https://finnhub.io/api/v1/quote?symbol=AAPL" },
    { key: "stooq", label: "Stooq CSV", note: "Stock fallback",
      url: "https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv" },
    { key: "openmeteo", label: "Open-Meteo", note: "Weather",
      url: "https://api.open-meteo.com/v1/forecast?latitude=51.5&longitude=-0.13&current=temperature_2m" },
    { key: "spacedevs", label: "Launch Library 2", note: "Rocket launches",
      url: "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=1" },
    { key: "iss", label: "wheretheiss.at", note: "ISS position",
      url: "https://api.wheretheiss.at/v1/satellites/25544" },
    { key: "local", label: "127.0.0.1:8787", note: "Localhost bridge",
      url: "http://127.0.0.1:8787/health" }
];

var STATES = {
    ok:     { cls: "ok",   text: "READABLE" },
    http:   { cls: "ok",   text: "READABLE" },
    cors:   { cls: "cors", text: "BLOCKED" },
    fail:   { cls: "fail", text: "BLOCKED" },
    run:    { cls: "run",  text: "..." }
};

function timeoutSignal(ms) {
    // AbortSignal.timeout is Chromium 124+; the runtime is 130, but the same file
    // is opened in older browsers during development, so keep a fallback.
    if (AbortSignal.timeout) return AbortSignal.timeout(ms);
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, ms);
    return c.signal;
}

function probe(target) {
    var started = Date.now();
    return fetch(target.url, { signal: timeoutSignal(TIMEOUT_MS) })
        .then(function (r) {
            // Reaching here at all means the response was readable, which is the
            // only thing being tested. A 401 or 429 still proves CORS is open.
            return { state: r.ok ? "ok" : "http", detail: "HTTP " + r.status,
                     ms: Date.now() - started };
        })
        .catch(function (err) {
            var why = String((err && err.message) || err);
            return fetch(target.url, { mode: "no-cors", signal: timeoutSignal(TIMEOUT_MS) })
                .then(function () {
                    // Hint only. An opaque resolve is NOT proof the host was reached.
                    return { state: "cors", detail: why + "  (opaque retry resolved)",
                             ms: Date.now() - started };
                })
                .catch(function () {
                    return { state: "fail", detail: why + "  (opaque retry also failed)",
                             ms: Date.now() - started };
                });
        });
}

function render(target, result) {
    var row = document.getElementById("row-" + target.key);
    if (!row) return;
    var s = STATES[result.state] || STATES.fail;
    row.className = "row " + s.cls;
    row.querySelector(".state").textContent = s.text;
    row.querySelector(".detail").textContent =
        result.detail + (result.ms != null ? "  (" + result.ms + "ms)" : "");
}

function runAll() {
    var btn = document.getElementById("runBtn");
    btn.disabled = true;
    document.getElementById("summary").textContent = "Probing " + TARGETS.length + " hosts...";
    TARGETS.forEach(function (t) {
        var row = document.getElementById("row-" + t.key);
        if (row) {
            row.className = "row run";
            row.querySelector(".state").textContent = STATES.run.text;
            row.querySelector(".detail").textContent = "";
        }
    });
    Promise.all(TARGETS.map(function (t) {
        return probe(t).then(function (r) { render(t, r); return r; });
    })).then(function (results) {
        var readable = results.filter(function (r) { return r.state === "ok" || r.state === "http"; }).length;
        var blocked = results.length - readable;
        document.getElementById("summary").textContent =
            readable + " readable, " + blocked + " blocked (cause not attributable in-browser)";
        btn.disabled = false;
    });
}

function buildRows() {
    document.getElementById("rows").innerHTML = TARGETS.map(function (t) {
        return '<div class="row" id="row-' + t.key + '">' +
               '<span class="label">' + t.label + '</span>' +
               '<span class="note">' + t.note + '</span>' +
               '<span class="state">-</span>' +
               '<span class="detail"></span>' +
               '</div>';
    }).join("");
}

function boot() {
    buildRows();
    document.getElementById("runBtn").addEventListener("click", runAll);
    document.getElementById("env").textContent =
        "origin " + (location.origin || "null") +
        "  |  iCUE " + (typeof iCUE !== "undefined" ? "present" : "absent");
    runAll();
}

// Assigned unconditionally: iCUE's import validator rejects a widget whose sources
// never reference icueEvents, and a one-shot iCUE_initialized read is a documented
// timing coin-flip, so booting is not gated on it.
icueEvents = {
    onICUEInitialized: function () {
        document.getElementById("env").textContent =
            "origin " + (location.origin || "null") + "  |  iCUE initialized";
    },
    onDataUpdated: function () { }
};

document.addEventListener("DOMContentLoaded", boot);

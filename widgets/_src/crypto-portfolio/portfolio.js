/* Crypto Portfolio: what your holdings are actually worth, right now.
 *
 * Deliberately NOT a second price ticker. Market Command Center already shows
 * prices; this one multiplies price by the quantity you hold and answers the only
 * question an owner actually has on a glanceable display: what is it worth, and is
 * it up or down today. Prices come from the same CoinGecko endpoint, so the two
 * products share their whole data layer.
 *
 * Holdings live in a textfield property, which iCUE persists. Nothing is sent
 * anywhere: the quantities never leave the machine, only coin ids go out in the
 * price request, which is the same request the free ticker makes.
 */

var CG = "https://api.coingecko.com/api/v3/coins/markets";

var state = { rows: [], total: 0, change: 0, meta: null };

/* "bitcoin:0.5, ethereum:4" -> [{id, qty}]. Tolerant of "=" and whitespace, and of
 * a bare coin id with no quantity (treated as a watch-only zero holding). */
function parseHoldings(raw) {
    var out = [];
    var parts = String(raw || "").split(/[,\n]+/);
    for (var i = 0; i < parts.length; i++) {
        var t = parts[i].trim();
        if (!t) continue;
        var m = /^([a-z0-9\-]+)\s*[:=]?\s*([0-9]*\.?[0-9]*)$/i.exec(t);
        if (!m) continue;
        out.push({ id: m[1].toLowerCase(), qty: parseFloat(m[2]) || 0 });
    }
    return out;
}

function settings() {
    return {
        holdings: parseHoldings(getIcueProperty("holdings", "bitcoin:0.5, ethereum:4")),
        cgKey: String(getIcueProperty("coingeckoKey", "") || "").trim(),
        refresh: Number(getIcueProperty("refreshMinutes", 15)) || 15,
        hideValue: getIcueProperty("hideValue", false) === true,
        showAlloc: getIcueProperty("showAllocation", true) !== false
    };
}

function loadPrices(ids, cgKey) {
    if (!ids.length) return Promise.resolve([]);
    var url = CG + "?vs_currency=usd&ids=" + encodeURIComponent(ids.join(","))
            + "&price_change_percentage=24h";
    if (cgKey) url += "&x_cg_demo_api_key=" + encodeURIComponent(cgKey);
    return packratFetchJson(url).then(function (json) {
        return (!json || !json.length) ? null : json;
    });
}

/* --- formatting ----------------------------------------------------------- */

function money(v, hide) {
    if (hide) return "*****";
    if (v === null || v === undefined || isNaN(v)) return "-";
    if (v >= 100000) return "$" + Math.round(v).toLocaleString();
    if (v >= 100) return "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return "$" + v.toFixed(2);
}

function qtyText(q) {
    if (q >= 1000) return q.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (q >= 1) return String(Number(q.toFixed(4)));
    return String(Number(q.toFixed(8)));
}

function pct(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

/* --- render ---------------------------------------------------------------- */

function render() {
    var cfg = settings();
    var host = document.getElementById("rows");
    var totalEl = document.getElementById("total");
    var chgEl = document.getElementById("totalChange");
    var status = document.getElementById("status");

    if (!state.rows.length) {
        host.innerHTML = '<div class="empty">' + t("Add your holdings in settings, like bitcoin:0.5") + '</div>';
        totalEl.textContent = money(0, cfg.hideValue);
        chgEl.textContent = "";
        chgEl.className = "total-change";
        return;
    }

    totalEl.textContent = money(state.total, cfg.hideValue);
    chgEl.textContent = pct(state.change);
    chgEl.className = "total-change " + (state.change >= 0 ? "up" : "down");

    host.innerHTML = state.rows.map(function (r) {
        var dir = r.changePct >= 0 ? "up" : "down";
        var share = state.total > 0 ? (r.value / state.total) * 100 : 0;
        var alloc = cfg.showAlloc
            ? '<span class="alloc" aria-hidden="true"><span class="alloc-fill" style="width:'
              + share.toFixed(1) + '%"></span></span>'
            : "";
        return '<div class="row ' + dir + '">'
             + '<span class="sym">' + r.symbol + '</span>'
             + '<span class="qty">' + qtyText(r.qty) + '</span>'
             + '<span class="visual">' + alloc + '</span>'
             + '<span class="value">' + money(r.value, cfg.hideValue) + '</span>'
             + '<span class="chg">' + pct(r.changePct) + '</span>'
             + '</div>';
    }).join("");

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

function recompute(priced) {
    var cfg = settings();
    var byId = {};
    (priced || []).forEach(function (c) { byId[c.id] = c; });

    var rows = [], total = 0, prevTotal = 0;
    cfg.holdings.forEach(function (h) {
        var c = byId[h.id];
        if (!c) return;
        var value = c.current_price * h.qty;
        var chg = c.price_change_percentage_24h || 0;
        // Yesterday's value for this holding, so the portfolio-level change is
        // weighted by position size rather than being a naive average of percentages.
        var prev = value / (1 + chg / 100);
        total += value;
        prevTotal += prev;
        rows.push({
            id: h.id,
            symbol: String(c.symbol || h.id).toUpperCase(),
            qty: h.qty,
            price: c.current_price,
            value: value,
            changePct: chg
        });
    });

    rows.sort(function (a, b) { return b.value - a.value; });
    state.rows = rows;
    state.total = total;
    state.change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
    render();
}

var src = null;

function startSource() {
    var cfg = settings();
    if (src) src.stop();
    src = packratSource({
        namespace: "portfolio",
        load: function () {
            var c = settings();
            return loadPrices(c.holdings.map(function (h) { return h.id; }), c.cgKey);
        },
        onUpdate: function (data, meta) { state.meta = meta; recompute(data); }
    });
    src.start(cfg.refresh);
}

var restart = rateLimit(startSource, 1500);

packratEvents(function () { render(); restart(); });

packratBoot(function () { startSource(); });

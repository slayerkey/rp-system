/* Market Command Center: stocks and crypto on one dashboard row set.
 *
 * Data sources:
 *   CoinGecko /coins/markets  keyless/demo-key crypto quotes + 7d sparkline data
 *   Finnhub   /quote          user-supplied free key for stock/ETF quotes
 *
 * Finnhub's free quote endpoint does not include candle history. Instead of calling
 * a premium history endpoint, stocks build an honest rolling sparkline from the
 * successful quotes this widget has actually observed. Until two samples exist,
 * the UI falls back to the session low/high range from the same quote response.
 *
 * Major Markets uses liquid ETFs as clearly labelled proxies so the feature stays
 * on the same free Finnhub quote path: SPY = S&P 500, QQQ = Nasdaq 100, DIA = Dow.
 */

var CG = "https://api.coingecko.com/api/v3/coins/markets";
var FH = "https://finnhub.io/api/v1/quote";
var MAJOR_MARKETS = [
    { query: "SPY", symbol: "SPY", name: "S&P 500" },
    { query: "QQQ", symbol: "QQQ", name: "Nasdaq 100" },
    { query: "DIA", symbol: "DIA", name: "Dow" }
];

var state = { rows: [], meta: null };
var stockHistoryStore = packratStore("stock-chart-history-v1");
var stockHistory = stockHistoryStore.read({});

function settings() {
    return {
        showMajors: getIcueProperty("showMajorMarkets", true) !== false,
        symbols: packratTokens(getIcueProperty("symbols", "AAPL, MSFT, NVDA"), false),
        coins: packratTokens(getIcueProperty("coins", "bitcoin, ethereum"), true),
        apiKey: String(getIcueProperty("finnhubKey", "") || "").trim(),
        cgKey: String(getIcueProperty("coingeckoKey", "") || "").trim(),
        refresh: Math.max(15, Number(getIcueProperty("refreshMinutes", 15)) || 15),
        sparklines: getIcueProperty("showSparklines", true) !== false
    };
}

function stockDefinitions(cfg) {
    var defs = [];
    var reserved = Object.create(null);
    if (cfg.showMajors) {
        MAJOR_MARKETS.forEach(function (m) {
            defs.push(m);
            reserved[m.query] = true;
        });
    }
    cfg.symbols.forEach(function (s) {
        if (!reserved[s]) defs.push({ query: s, symbol: s, name: s });
    });
    return defs;
}

function recordStockPoint(symbol, price) {
    var now = Date.now();
    var weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    var points = Array.isArray(stockHistory[symbol]) ? stockHistory[symbol] : [];
    points = points.filter(function (p) {
        return p && Number.isFinite(Number(p.price)) && Number(p.at) >= weekAgo;
    });
    var last = points.length ? points[points.length - 1] : null;
    if (!last || Number(last.price) !== Number(price)) {
        points.push({ at: now, price: Number(price) });
    } else {
        last.at = now;
    }
    if (points.length > 128) points = points.slice(points.length - 128);
    stockHistory[symbol] = points;
    stockHistoryStore.write(stockHistory);
    return points.map(function (p) { return Number(p.price); });
}

/* --- loaders. Each resolves to an array of rows, or null so the source keeps
       showing its last known good payload. ------------------------------------ */

function loadCrypto(ids, cgKey) {
    if (!ids.length) return Promise.resolve([]);
    var url = CG + "?vs_currency=usd&ids=" + encodeURIComponent(ids.join(","))
            + "&sparkline=true&price_change_percentage=24h";
    if (cgKey) url += "&x_cg_demo_api_key=" + encodeURIComponent(cgKey);
    return packratFetchJson(url).then(function (json) {
        if (!json || !json.length) return null;
        return json.map(function (c) {
            var spark = (c.sparkline_in_7d && c.sparkline_in_7d.price) || [];
            var thinned = [];
            for (var i = 0; i < spark.length; i += 4) thinned.push(spark[i]);
            return {
                kind: "crypto",
                symbol: String(c.symbol || "").toUpperCase(),
                name: c.name || c.id,
                price: c.current_price,
                changePct: c.price_change_percentage_24h,
                spark: thinned,
                low: c.low_24h, high: c.high_24h
            };
        });
    });
}

function loadStocks(defs, key) {
    if (!defs.length || !key) return Promise.resolve([]);
    return Promise.all(defs.map(function (d) {
        return packratFetchJson(FH + "?symbol=" + encodeURIComponent(d.query) + "&token=" + encodeURIComponent(key))
            .then(function (q) {
                if (!q || !q.c) return null;
                return {
                    kind: "stock",
                    symbol: d.symbol,
                    name: d.name,
                    price: q.c,
                    changePct: q.dp,
                    spark: recordStockPoint(d.query, q.c),
                    low: q.l, high: q.h, open: q.o,
                    query: d.query
                };
            });
    })).then(function (rows) {
        var ok = rows.filter(function (r) { return r !== null; });
        return ok.length ? ok : null;
    });
}

/* --- formatting ----------------------------------------------------------- */

function money(v) {
    if (v === null || v === undefined) return "-";
    if (v >= 1000) return "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (v >= 1) return "$" + v.toFixed(2);
    return "$" + v.toFixed(v < 0.01 ? 6 : 4);
}

function pct(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

/* --- render --------------------------------------------------------------- */

function rowHtml(r, showCharts) {
    var dir = r.changePct >= 0 ? "up" : "down";
    var visual = "";

    if (showCharts && r.spark && r.spark.length > 1) {
        var d = packratSparkPath(r.spark, 100, 28);
        visual = '<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">'
               + '<path d="' + d + '" /></svg>';
    } else if (showCharts && r.low != null && r.high != null && r.high > r.low) {
        var at = Math.max(0, Math.min(100, ((r.price - r.low) / (r.high - r.low)) * 100));
        visual = '<span class="range" aria-hidden="true">'
               + '<span class="range-fill" style="width:' + at.toFixed(1) + '%"></span>'
               + '<span class="range-dot" style="left:' + at.toFixed(1) + '%"></span></span>';
    }

    return '<div class="row ' + dir + '">'
         + '<span class="sym">' + r.symbol + '</span>'
         + '<span class="name">' + r.name + '</span>'
         + '<span class="visual">' + visual + '</span>'
         + '<span class="price">' + money(r.price) + '</span>'
         + '<span class="chg">' + pct(r.changePct) + '</span>'
         + '</div>';
}

function render() {
    var cfg = settings();
    var host = document.getElementById("rows");
    var status = document.getElementById("status");

    if (!state.rows.length) {
        var needKey = stockDefinitions(cfg).length && !cfg.apiKey;
        host.innerHTML = '<div class="empty">'
            + (needKey ? t("Stocks and Major Markets need a free Finnhub key. Get one at finnhub.io/register")
                       : t("Waiting for market data."))
            + '</div>';
        status.textContent = "";
        status.className = "status";
        return;
    }

    host.innerHTML = state.rows.map(function (r) { return rowHtml(r, cfg.sparklines); }).join("");

    if (state.meta && state.meta.stale) {
        status.textContent = t("Offline") + " · " + packratAgo(state.meta.ageMs);
        status.className = "status stale";
    } else {
        status.textContent = "";
        status.className = "status";
    }
}

function t(s) { return s; }

/* --- wiring --------------------------------------------------------------- */

var cryptoSrc = null, stockSrc = null;
var latest = { crypto: [], stocks: [] };
var sourceMeta = { crypto: null, stocks: null };

function merge() {
    state.rows = latest.stocks.concat(latest.crypto);
    var metas = [sourceMeta.stocks, sourceMeta.crypto].filter(function (m) { return m && !m.empty; });
    if (!metas.length) {
        state.meta = null;
    } else {
        state.meta = {
            stale: metas.some(function (m) { return !!m.stale; }),
            ageMs: Math.max.apply(null, metas.map(function (m) { return Number(m.ageMs) || 0; }))
        };
    }
    render();
}

function startSources() {
    var cfg = settings();
    if (cryptoSrc) cryptoSrc.stop();
    if (stockSrc) stockSrc.stop();

    cryptoSrc = packratSource({
        namespace: "crypto",
        load: function () { var c = settings(); return loadCrypto(c.coins, c.cgKey); },
        onUpdate: function (data, meta) {
            latest.crypto = data || [];
            sourceMeta.crypto = meta;
            merge();
        }
    });

    stockSrc = packratSource({
        namespace: "stocks",
        load: function () { var c = settings(); return loadStocks(stockDefinitions(c), c.apiKey); },
        onUpdate: function (data, meta) {
            latest.stocks = data || [];
            sourceMeta.stocks = meta;
            merge();
        }
    });

    cryptoSrc.start(cfg.refresh);
    stockSrc.start(cfg.refresh);
}

var restart = rateLimit(startSources, 1500);

packratEvents(function () { render(); restart(); });

packratBoot(function () {
    document.getElementById("title").textContent = t("Markets");
    startSources();
});

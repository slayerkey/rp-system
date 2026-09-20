# coding: utf-8
#!/usr/bin/env python3
"""
Marketplace art generator for Market Command Center (RatPack's finance dashboard plugin).
Outputs 1920x960 banners, a preview GIF, and preview.mp4 to scripts/output/marketing/.
"""
import os, re, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
OUT_DIR = os.path.join(SCRIPT_DIR, "output", "marketing")
ASSETS_DIR = os.path.join(SCRIPT_DIR, "assets")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

sys.path.insert(0, os.path.join(ROOT_DIR, "..", "_shared"))
import marketing_engine as me
from marketing_engine import Image, ImageDraw

# House brand tokens (wordmark "Packrat", not the engine's stale "Ratpack" default).
sys.path.insert(0, os.path.join(ROOT_DIR, "..", "ratpack-projects", "brand"))
import tokens
tokens.apply(me)

BRAND = (22, 199, 132)   # #16C784 — the plugin's own "up" green
BG = (11, 14, 17)        # #0B0E11 — the plugin's own dark background
me.BRAND = BRAND
me.BG = BG
me.OUT_DIR = OUT_DIR

# ── Brand logo: the plugin's own ascending-bars mark, as a white silhouette PNG ─────
# (_tinted_logo recolors this to the accent wherever it's used, so it must stay pure white.)
LOGO_PATH = os.path.join(ASSETS_DIR, "logo.png")

def ensure_logo():
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    baseline = 450
    bars = [(150, 320, 210, baseline), (226, 230, 286, baseline), (302, 120, 362, baseline)]
    for x0, y0, x1, y1 in bars:
        d.rounded_rectangle([x0, y0, x1, y1], radius=10, fill=(255, 255, 255, 255))
    img.save(LOGO_PATH)

ensure_logo()

# ── Spark data (small, hand-picked so the shape reads clearly at key size) ─────────
SPARK_UP = [10, 20, 15, 25, 22, 30, 28, 38, 34, 44, 40, 52]
SPARK_UP_SOFT = [30, 32, 28, 35, 33, 40, 38, 44, 42, 48, 46, 52]
SPARK_DOWN = [52, 48, 50, 42, 44, 36, 38, 30, 32, 24, 26, 18]

def tk(ticker, price, change, up=True, tag="1D", spark=SPARK_UP, pl=None, pl_up=True, alert=False, stale=False):
    color = BRAND if up else (234, 57, 67)
    spec = {
        "kind": "ticker", "ticker": ticker, "price": price, "change": change,
        "change_color": color, "tag": tag, "spark": spark, "alert": alert, "stale": stale,
        "alert_color": (240, 185, 11),
    }
    if pl:
        spec["pl"] = pl
        spec["pl_color"] = BRAND if pl_up else (234, 57, 67)
    return spec

def clk(exchange, session, color, countdown, sub, band=None):
    return {"kind": "marketclock", "exchange": exchange, "session": session, "color": color,
            "countdown": countdown, "sub": sub, "band": band}

def hm1(ticker, change, up=True):
    return {"kind": "heatmap_single", "ticker": ticker, "change": change, "fill": BRAND if up else (180, 60, 66)}

def hmgrid(entries):
    tiles = [{"ticker": t, "change": c, "fill": BRAND if up else (180, 60, 66)} for t, c, up in entries]
    return {"kind": "heatmap_grid", "tiles": tiles}

def gauge(value, label):
    return {"kind": "gauge", "value": value, "label": label}

def earn(ticker, countdown, sub, date, urgent=False):
    accent = (240, 185, 11) if urgent else (230, 232, 234)
    return {"kind": "earnings", "ticker": ticker, "countdown": countdown, "sub": sub, "date": date,
            "accent": accent, "urgent": urgent}

def tk_range(ticker, price, change, range_pct, up=True, tag="1D"):
    spec = tk(ticker, price, change, up=up, tag=tag)
    spec["range_pct"] = range_pct
    return spec

CFG = {
    "name": "Market Command Center",
    "brand": BRAND,
    "bg": BG,
    "icon": "",
    "logo_img": LOGO_PATH,
    "logo_color": BRAND,
    "icon_sub": "MARKETS",

    # Banded house style: cover title band, seal footer, honest device/OS facts.
    # Chips and glyphs match what the plugin manifest actually declares (mac 12+,
    # windows 10+, every deck model).
    "hero_title_clean": "Market Command Center",
    "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
    "os_glyphs": ["brand-windows", "brand-apple"],
    "os_support": "Windows and macOS",
    "hero_deck": "new",
    "hero_device_frac": 0.66,
    "hero_watermark": False,
    "device_photo_mockup": True,

    "hero_title": ["Your trading desk.", "On your Stream Deck."],
    "tagline": "Live stocks, crypto, indices and market timing. No login, nothing to sign in to.",
    "bullets": [
        "Live price, daily change and a real sparkline on every key",
        "Rotate a watchlist, track P/L, set price alerts",
        "One free API key for stocks. Crypto needs none at all.",
    ],
    # Ten distinct faces on a fifteen key deck: every action the plugin really has,
    # no duplicates, and the deck stays honestly partly lit.
    "hero_keys": [
        tk("SPY", "$293.08", "+1.24%", up=True, tag="1D", spark=SPARK_UP),
        tk("BTC", "$60,317", "+1.87%", up=True, tag="24H", spark=SPARK_UP_SOFT),
        tk("NVDA", "$199.00", "-0.50%", up=False, tag="1D", spark=SPARK_DOWN),
        clk("US", "OPEN", BRAND, "5:59:12", "Closes in", band=0.42),
        tk("AAPL", "$293.08", "+2.10%", up=True, tag="1D", spark=SPARK_UP, pl="P/L +$1,240", pl_up=True),
        hmgrid([("AAPL", "+2.1%", True), ("TSLA", "-1.8%", False), ("NVDA", "+3.2%", True),
                ("MSFT", "+0.4%", True), ("AMZN", "-0.6%", False), ("META", "-2.9%", False)]),
        gauge(21, "Extreme Fear"),
        earn("AAPL", "2 DAYS", "After close", "Jul 24, 2026", urgent=True),
        clk("TSE", "LUNCH", (150, 160, 176), "22:14", "Resumes in"),
        tk_range("MSFT", "$365.46", "+0.62%", 0.82, up=True),
    ],
    "bottom": [
        ("layout-grid", "WATCHLIST HEATMAP", "Color-coded grid"),
        ("gauge", "FEAR & GREED GAUGE", "Live speedometer"),
        ("calendar-event", "EARNINGS COUNTDOWN", "Never miss a report"),
        ("clock", "9 EXCHANGES", "Pre-market to close"),
    ],

    "feature_banners": [
        (
            "Every price you watch, live.",
            [
                tk("SPY", "$293.08", "+1.24%", up=True, spark=SPARK_UP),
                tk("QQQ", "$412.55", "+0.86%", up=True, spark=SPARK_UP_SOFT),
                tk("AAPL", "$293.08", "+2.10%", up=True, spark=SPARK_UP),
                tk("BTC", "$60,317", "+1.87%", up=True, tag="24H", spark=SPARK_UP_SOFT),
                tk("ETH", "$1,590", "+0.61%", up=True, tag="24H", spark=SPARK_UP),
            ],
            ["S&P 500", "Nasdaq 100", "Apple", "Bitcoin", "Ethereum"],
            BRAND,
            "Stocks, ETFs, indices and crypto side by side. No tab switching to check a price.",
        ),
        (
            "One key, a whole watchlist.",
            [
                tk("AAPL", "$293.08", "+2.10%", up=True, spark=SPARK_UP),
                tk("MSFT", "$365.46", "+0.62%", up=True, spark=SPARK_UP_SOFT),
                tk("TSLA", "$233.50", "-1.15%", up=False, spark=SPARK_DOWN),
            ],
            ["AAPL", "rotates to", "MSFT, then TSLA"],
            BRAND,
            "Type a few tickers separated by commas. One key rotates through all of them automatically.",
        ),
        (
            "Never miss the open, anywhere.",
            [
                clk("US", "OPEN", BRAND, "5:59:12", "Closes in", band=0.42),
                clk("LSE", "CLOSED", (150, 160, 176), "14:32:07", "Opens in"),
                clk("TSE", "LUNCH", (150, 160, 176), "22:14", "Resumes in"),
            ],
            ["New York", "London", "Tokyo"],
            BRAND,
            "Nine exchanges with real pre-market, lunch-break and after-hours sessions, color-coded at a glance.",
        ),
        (
            "Your position, not just the price.",
            [
                tk("AAPL", "$293.08", "+2.10%", up=True, spark=SPARK_UP, pl="P/L +$1,240", pl_up=True),
                tk("TSLA", "$233.50", "-1.15%", up=False, spark=SPARK_DOWN, pl="P/L -$318", pl_up=False),
                tk("BTC", "$60,317", "+1.87%", up=True, tag="24H", spark=SPARK_UP_SOFT, alert=True),
            ],
            ["Shares + cost basis", "Tracks the loss too", "Alert ring on target"],
            BRAND,
            "Enter shares and cost basis to see live profit and loss. Set a price target and the key rings when it hits.",
        ),
        (
            "Crypto needs nothing. Stocks need one key.",
            [
                tk("BTC", "$60,317", "+1.87%", up=True, tag="24H", spark=SPARK_UP_SOFT),
                tk("ETH", "$1,590", "+0.61%", up=True, tag="24H", spark=SPARK_UP),
                tk("SOL", "$74.03", "+2.09%", up=True, tag="24H", spark=SPARK_UP),
            ],
            ["Works instantly", "Works instantly", "Works instantly"],
            BRAND,
            "Crypto keys work the moment you drop them in. Stocks use one free API key, entered once for every key on your deck.",
        ),
        (
            "Your whole watchlist, one glance.",
            [
                hm1("AAPL", "+2.1%", up=True),
                hmgrid([("AAPL", "+2.1%", True), ("TSLA", "-1.8%", False), ("NVDA", "+3.2%", True),
                        ("MSFT", "+0.4%", True), ("AMZN", "-0.6%", False), ("META", "-2.9%", False)]),
                gauge(21, "Extreme Fear"),
            ],
            ["Fills the key", "Full watchlist", "Live market mood"],
            BRAND,
            "Turn any Stock or Crypto key into a color-coded heatmap. No one else on the marketplace visualizes a watchlist like this.",
        ),
        (
            "Know what's coming before it hits.",
            [
                earn("AAPL", "2 DAYS", "After close", "Jul 24, 2026", urgent=True),
                earn("NVDA", "14 DAYS", "Before open", "Aug 5, 2026"),
                tk_range("MSFT", "$365.46", "+0.62%", 0.82, up=True),
            ],
            ["3-day amber ring", "Any earnings date", "52-week range bar"],
            BRAND,
            "A countdown to the next earnings report, and a bar showing exactly where today's price sits between its 52-week low and high.",
        ),
    ],

    "statement": (
        "Five keys wide. The whole market.",
        "Stocks, crypto and market timing, live on every press.",
    ),

    "video_scenes": [
        ("Live prices on every press", [tk("SPY", "$293.08", "+1.24%", up=True, spark=SPARK_UP)]),
        ("Crypto, 24 hours a day", [tk("BTC", "$60,317", "+1.87%", up=True, tag="24H", spark=SPARK_UP_SOFT)]),
        ("Rotate your whole watchlist", [tk("AAPL", "$293.08", "+2.10%", up=True, spark=SPARK_UP),
                                          tk("MSFT", "$365.46", "+0.62%", up=True, spark=SPARK_UP_SOFT)]),
        ("Nine exchanges, real sessions", [clk("US", "OPEN", BRAND, "5:59:12", "Closes in", band=0.42),
                                            clk("TSE", "LUNCH", (150, 160, 176), "22:14", "Resumes in")]),
        ("Track P/L. Set alerts.", [tk("AAPL", "$293.08", "+2.10%", up=True, spark=SPARK_UP, pl="P/L +$1,240", pl_up=True),
                                     tk("BTC", "$60,317", "+1.87%", up=True, tag="24H", spark=SPARK_UP_SOFT, alert=True)]),
    ],

    "description": {
        "search_line": (
            "Live stocks, crypto, a watchlist heatmap and Fear & Greed gauge on your Stream Deck. "
            "Track prices, earnings dates and portfolio P/L for Bitcoin, AAPL and more."
        ),
        "intro": (
            "Market Command Center puts live stocks, crypto, indices and market timing on your "
            "Stream Deck keys. Drop in a key and it starts showing real prices in seconds, no "
            "account required for crypto and one free API key for stocks."
        ),
        "tagline": "Your trading desk, five keys wide.",
        "features": [
            ("Live Stocks & Indices", "Price, daily change and a real intraday sparkline for any stock, ETF or index, powered by a free Finnhub API key you enter once."),
            ("Crypto, Zero Setup", "Bitcoin, Ethereum and any other coin work the moment you drop the key in. No account, no API key, updates around the clock."),
            ("Watchlist Heatmap", "Turn any Stock or Crypto key into a color-coded grid of your whole watchlist, shaded red to green by daily move, one symbol filling the entire key when you only track one."),
            ("Fear & Greed Gauge", "The crypto market's Fear & Greed Index as a live speedometer, needle and all, color-matched top to bottom. No API key needed."),
            ("Earnings Countdown", "Days until a company's next scheduled earnings report, with a before-open or after-close note and a highlighted ring inside the final 3 days."),
            ("Watchlist Rotation", "Type several tickers separated by commas and one key cycles through all of them on a timer you control, so a full watchlist fits in a single slot."),
            ("Position P/L, Alerts & 52-Week Range", "See live profit and loss from your shares and cost basis, a ring when a price alert is crossed, and a bar showing where today's price sits in its 52-week range."),
            ("Market Clock, 9 Exchanges", "New York, London, Frankfurt, Paris, Tokyo, Hong Kong, Singapore, Sydney and Toronto, with real pre-market, lunch-break and after-hours sessions and a live countdown to the next change."),
            ("Timeframes & Themes", "Scrub between 1-day, 1-week, 1-month and 1-year views right on the key, in Dark, Minimal or On-Stream Pro themes built for looking good on camera."),
        ],
        "outro": "Built for day traders, swing traders and anyone who wants the market on their desk without a browser tab open.",
        "keywords": [
            "stocks", "crypto", "stock market", "Bitcoin", "portfolio tracker", "market clock",
            "watchlist heatmap", "fear and greed index", "earnings calendar", "52 week high low",
            "trading dashboard", "Stream Deck finance", "price alerts", "watchlist",
        ],
        "collection": ("More Stream Deck profiles, plugins and tools from Packrat, all on "
                       "the marketplace at @packrat."),
    },
}

# Device + OS support, read off the plugin's OWN manifest so the listing can never
# claim hardware or platforms the plugin doesn't actually declare.
def compat_line():
    import json, glob
    names = {"windows": "Windows", "mac": "macOS"}
    oses = []
    for man in sorted(glob.glob(os.path.join(ROOT_DIR, "*.sdPlugin", "manifest.json"))):
        with open(man, encoding="utf-8") as fh:
            data = json.load(fh)
        oses = [names.get(o.get("Platform"), o.get("Platform")) for o in data.get("OS", [])]
        break
    return f"Works on every Stream Deck model, for {' and '.join(oses or ['Windows'])}."


def inject_compat(out_dir):
    path = os.path.join(out_dir, "description.txt")
    if not os.path.exists(path):
        return
    line = compat_line()
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    if line in text:
        return
    parts = text.split("\n\n", 2)   # [search_line, intro, rest]
    text = ("\n\n".join([parts[0], parts[1], line, parts[2]]) if len(parts) == 3
            else line + "\n\n" + text)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


ICON_SOURCE = os.path.join(ASSETS_DIR, "icon-source.png")


def build_banded(cfg, out_dir):
    """The banded kit /rat-art produces: clean cover, tell-me-more page, then the
    feature gallery, all in one designed frame."""
    for old in os.listdir(out_dir):
        if re.match(r"\d+-.*\.png$", old):
            os.remove(os.path.join(out_dir, old))
    me.BRAND = cfg["brand"]; me.BG = cfg["bg"]; me.OUT_DIR = out_dir

    # Hand-made store artwork wins over the generated name-mark.
    if os.path.exists(ICON_SOURCE):
        art = Image.open(ICON_SOURCE).convert("RGBA")
        art.resize((288, 288), Image.LANCZOS).save(os.path.join(out_dir, "icon-288x288.png"))
        art.resize((288, 288), Image.LANCZOS).save(os.path.join(out_dir, "icon.png"))
        art.resize((512, 512), Image.LANCZOS).save(os.path.join(out_dir, "icon@2x.png"))
    else:
        icon = me.make_listing_icon(cfg, 288)
        icon.save(os.path.join(out_dir, "icon-288x288.png"))
        icon.save(os.path.join(out_dir, "icon.png"))
        me.make_listing_icon(cfg, 512).save(os.path.join(out_dir, "icon@2x.png"))
    me.write_description(cfg, out_dir)

    clean = dict(cfg); clean["hero_layout"] = "clean"
    order = ["1-hero.png", "2-tellmore.png"]
    me.banner_hero(clean).convert("RGB").save(os.path.join(out_dir, "1-hero.png"))
    me.banner_hero(cfg).convert("RGB").save(os.path.join(out_dir, "2-tellmore.png"))
    for i, (title, specs, labels, acc, *rest) in enumerate(cfg["feature_banners"], start=3):
        name = f"{i}-feature.png"
        me.banner_features_clean(clean, title, specs, labels,
                                 caption=rest[0] if rest else None, accent=acc) \
            .convert("RGB").save(os.path.join(out_dir, name))
        order.append(name)
    with open(os.path.join(out_dir, "gallery_order.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(order) + "\n")
    me.gen_video(cfg)
    inject_compat(out_dir)
    print(f"  banded art -> {out_dir}")


def main():
    print("Generating Market Command Center marketing assets...")
    build_banded(CFG, OUT_DIR)
    print(f"\nDone. All files in: {OUT_DIR}")

if __name__ == "__main__":
    main()

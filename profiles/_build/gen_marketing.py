# coding: utf-8
"""Marketplace listing art for all six Packrat profiles.

Output: profiles/<name>/marketing/ (banners, preview.gif/mp4, icons, description.txt).
Hero/feature keys are the profiles' REAL rendered key images (icons.render), so the
listing mirrors the product exactly.
"""
import io
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT.parent.parent / "_shared"))
sys.path.insert(0, str(HERE))

import marketing_engine as me
from marketing_engine import Image, ImageDraw, ImageFont
import icons

sys.path.insert(0, str(ROOT.parent / "brand"))
import tokens
tokens.apply(me)  # Packrat wordmark + house tokens; per-product accents still win

WHITE = (255, 255, 255)
DARK = (20, 20, 20)
GREEN_DOT = (76, 217, 100)
LOGOS = HERE / "assets" / "logos"  # real brand marks (Simple Icons font + official assets)

def key_img(icon, fg=WHITE, bg=DARK, dot=None, label=None, flip=False, nav=False,
            label_color=None):
    """A hero/feature key spec built from the profile's real key renderer.

    nav=True renders the dim outline + chevron treatment the built profiles use for
    folder keys, so hero art can show that a deck has grouped pages rather than one
    flat wall of hotkeys.

    label_color overrides the caption colour, which a pale key face needs or the
    white default disappears into it. The built profile sets the same colour on
    the real key, so this keeps the render honest rather than merely legible."""
    png = icons.render(icon, size=144, bg=bg, fg=fg, glyph_size=68, dot=dot,
                       flip=flip, nav=nav)
    spec = {"kind": "image", "img": Image.open(io.BytesIO(png)), "label": label}
    if label_color is not None:
        spec["label_color"] = label_color
    return spec

WEAPON_ICONS_DIR = Path(me._ENGINE_DIR) / "assets" / "weapon-icons"

def weapon_key(name, fg=WHITE, bg=DARK, label=None, glyph_frac=0.46):
    """A key tile using a real weapon icon (game-icons.net, CC BY 3.0) instead of
    a Tabler glyph -- Tabler has no gun/knife/explosive icons at all (confirmed
    2026-08-08). House-rule exception, owner-approved 2026-08-08; every icon
    pulled from there and its required attribution is tracked in
    brand/THIRD_PARTY_ICONS.md -- add a line there before using a new one."""
    src = Image.open(WEAPON_ICONS_DIR / f"{name}.png").convert("RGBA")
    size = 144
    glyph_size = int(size * glyph_frac)
    scale = glyph_size / max(src.size)
    src = src.resize((max(1, int(src.width * scale)), max(1, int(src.height * scale))), Image.LANCZOS)
    tint = Image.new("RGBA", src.size, (*fg, 255))
    tint.putalpha(src.getchannel("A"))
    tile = Image.new("RGBA", (size, size), (*bg, 255))
    cy = int(size * 0.40)
    tile.alpha_composite(tint, ((size - tint.width) // 2, cy - tint.height // 2))
    return {"kind": "image", "img": tile, "label": label}

def numbered_key_img(icon, n, fg=WHITE, bg=DARK, label=None):
    """A key tile like key_img(), plus a small numeral badge in the bottom-right
    corner -- for slot-style keys (weapon loadouts, item slots) where a real icon
    reads better than a bare number glyph, but the slot number still matters."""
    spec = key_img(icon, fg=fg, bg=bg, label=label)
    im = spec["img"].copy()
    d = ImageDraw.Draw(im)
    r = 18
    cx, cy = im.width - r - 10, im.height - r - 10
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*fg, 255), outline=(*bg, 255), width=2)
    fnt = me.fnt(22)
    txt = str(n)
    bbox = d.textbbox((0, 0), txt, font=fnt)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), txt, font=fnt, fill=(*bg, 255))
    spec["img"] = im
    return spec

STRIP_BLACK = (9, 9, 11)

def strip_icon(icon, fg=WHITE, size=132):
    """A bare glyph for the Stream Deck + touch strip: no key tile, vertically
    centred (cy_ratio 0.5, not the 0.4 that leaves room for a key label) and drawn
    on the strip's own black so no tile edge shows."""
    png = icons.render(icon, size=size, bg=STRIP_BLACK, fg=fg,
                       glyph_size=int(size * 0.72), cy_ratio=0.5)
    return {"kind": "image", "img": Image.open(io.BytesIO(png)), "label": None}

def crest_key(bg, label=None):
    """The real SU crest key, exactly as it appears on the built profile."""
    png = icons.image_key(LOGOS / "su-crest-raw.png", size=144, bg=bg)
    return {"kind": "image", "img": Image.open(io.BytesIO(png)), "label": label}

def plugin_key(sdplugin: Path, action: str, variant: str = "key", label=None):
    """A hero/feature key spec taken from a plugin's REAL shipped key art.

    Profiles mirror themselves via icons.render; plugins that draw their own key faces
    (Better Hotkeys' brass keycaps and mouse silhouettes) have to be read off disk
    instead, or the listing would show generic Tabler tiles the buyer never sees.
    """
    p = sdplugin / "imgs" / "actions" / action / f"{variant}@2x.png"
    if not p.exists():
        raise FileNotFoundError(f"{p} (key art missing; run the plugin's tools/gen_icons.py)")
    return {"kind": "image", "img": Image.open(p), "label": label}

ICONS_REPO = ROOT.parent.parent / "ratpack-icons"

def icon_pack_key(pack: str, rel: str, label=None):
    """A key face taken from an icon pack's REAL shipped 144x144 PNG.

    Same rule as plugin_key: an icon pack's whole product IS the key art, so the
    listing must show the actual files the buyer installs. Generating lookalike
    Tabler tiles here would advertise art that isn't in the pack.
    """
    p = ICONS_REPO / f"com.packrat.{pack}.sdIconPack" / "icons" / rel
    if not p.exists():
        raise FileNotFoundError(f"{p} (icon pack not built; see ../ratpack-icons/build_pack.py)")
    return {"kind": "image", "img": Image.open(p), "label": label}

def radial_face(angle, distance, size=200, label=None):
    """Better Hotkeys' Radial Select key face at a REAL configured angle/distance.

    The shipped radialselect/key.png is one static frame, but the action redraws its own
    key per instance (src/radial-icon.ts does this with a generated SVG). Reproducing that
    maths here is what lets the listing show genuinely different aim states instead of the
    same picture captioned two ways.
    """
    import math
    from marketing_engine import ImageDraw
    CHARCOAL, DIM_DEEP = (28, 27, 25), (68, 65, 60)
    ss = 4
    s = size * ss
    c = s / 2
    r_out, r_in = s * 0.335, s * 0.167
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=(*CHARCOAL, 255))

    def polar(r, deg):
        a = math.radians(deg)
        return (c + r * math.sin(a), c - r * math.cos(a))

    box_out = [c - r_out, c - r_out, c + r_out, c + r_out]
    for i in range(8):
        deg = i * 45
        lit = abs(((deg - angle + 540) % 360) - 180) < 22.5
        col = (*BH_BRASS, 255) if lit else (*DIM_DEEP, 255)
        # PIL angles are 0=east/clockwise; the plugin's 0=north, so shift by -90.
        start = deg - 90 - 22.5
        d.pieslice(box_out, start, start + 45, fill=col)

    hole = r_in - s * 0.028
    d.ellipse([c - hole, c - hole, c + hole, c + hole], fill=(*CHARCOAL, 255))
    d.ellipse([c - s * 0.042, c - s * 0.042, c + s * 0.042, c + s * 0.042], fill=(*BH_BRASS, 255))

    reach = r_in + (r_out - r_in + s * 0.042) * (distance / 100)
    dx, dy = polar(reach, angle)
    px, py = polar(r_in - s * 0.021, angle)
    d.line([px, py, dx, dy], fill=(*BH_BRASS, 255), width=int(s * 0.021))
    rr = s * 0.035
    d.ellipse([dx - rr, dy - rr, dx + rr, dy + rr], fill=(*BH_BRASS, 255),
              outline=(*CHARCOAL, 255), width=int(s * 0.014))
    return {"kind": "image", "img": img.resize((size, size), Image.LANCZOS), "label": label}

def glyph_logo(icon_name: str) -> str:
    """A white Tabler-glyph silhouette on transparent, cached under assets/logos, so
    make_listing_icon and logo_key can tint it to the product accent. For products
    with no brand wordmark to fall back on (e.g. the Packrat plugins)."""
    from PIL import ImageDraw, ImageFont
    out = LOGOS / f"glyph-{icon_name}.png"
    if not out.exists():
        ch = icons.icon_map()[icon_name]
        S = 512
        im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((S / 2, S / 2), ch,
                                font=ImageFont.truetype(str(icons.TTF), int(S * 0.72)),
                                fill=(255, 255, 255, 255), anchor="mm")
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out)
    return str(out)

import json as _json

def _registry():
    return _json.loads((ROOT.parent / "registry.json").read_text(encoding="utf-8"))["products"]

WIDGET_DEVICE_NAMES = {
    "dashboard_lcd": "Corsair Xeneon Edge",
    "pump_lcd": "iCUE LINK LCD",
    "keyboard_lcd": "Corsair Keyboard LCD",
}


def _widget_support(folder: str, prod: dict) -> tuple[list[str], list[str]]:
    """Device and OS support for an iCUE widget, read from its own manifest.json.

    Only what the manifest actually declares gets advertised. The docs are explicit
    that you should declare a device only once you have designed and tested a layout
    for it, so the manifest is the honest source for the listing too.
    """
    man_path = ROOT.parent / prod.get("paths", {}).get("dir", f"widgets/{folder}") / "manifest.json"
    man = _json.loads(man_path.read_text(encoding="utf-8")) if man_path.exists() else {}
    devices = [WIDGET_DEVICE_NAMES.get(d.get("type"), d.get("type"))
               for d in man.get("supported_devices", [])] or ["Corsair Xeneon Edge"]
    names = {"windows": "Windows", "win": "Windows", "mac": "macOS", "macos": "macOS"}
    oses = [names.get(o.get("platform"), o.get("platform")) for o in man.get("os", [])] or ["Windows"]
    return devices, list(dict.fromkeys(oses))


def _banded_facts(folder: str, cfg: dict):
    """Registry-driven honesty for the cover: device chip + OS logos (only when
    the product genuinely ships both Windows and Mac). Also auto-picks a themed
    background plate from brand/ai_backgrounds/<folder> if one exists."""
    prod = _registry().get(folder, {})
    if prod.get("type") == "plugin":
        # Plugins are not profile packs and are not tied to one deck model, and they
        # carry no variant_files to read; the cfg supplies its own chips / OS glyphs.
        # Owner (2026-07-25): no OS in the bottom-right (OS lives on the tell-more page).
        # Instead the right chip states the hardware scope a plugin genuinely has: it
        # runs on every model, so "All Stream Decks" (parallels a profile's device chip).
        cfg.setdefault("hero_chips", ["Stream Deck Plugin", "All StreamDecks"])
        cfg.setdefault("os_glyphs", None)
    elif prod.get("type") == "icons":
        # An icon pack is just image files: every model, every OS, no variants to
        # read. Without this branch the empty variant_files below would silently
        # advertise "Profile Pack / Stream Deck MK.2", which is wrong three ways.
        cfg.setdefault("hero_chips", ["Icon Pack", "All StreamDecks"])
        cfg.setdefault("os_glyphs", ["brand-windows", "brand-apple"])
    elif prod.get("type") == "widget":
        # An iCUE widget is not a Stream Deck product at all: it runs on a Corsair
        # device screen. Both the device chip and the OS come from the widget's OWN
        # manifest.json, the same rule the plugin branch follows, because a widget
        # may declare any subset of the three device classes.
        devices, oses = _widget_support(folder, prod)
        cfg.setdefault("hero_chips", ["iCUE Widget", " + ".join(devices)])
        cfg.setdefault("os_glyphs", [g for g, ok in
                                     (("brand-windows", "Windows" in oses),
                                      ("brand-apple", "macOS" in oses)) if ok] or None)
    else:
        variants = prod.get("variant_files", {})
        sizes = {v.split("_")[0] for v in variants}
        dev_names = " + ".join(n for n, k in (("MK.2", "std"), ("XL", "xl"), ("Plus", "plus"))
                               if k in sizes)
        dual_os = any(v.endswith("_mac") for v in variants) and any(not v.endswith("_mac") for v in variants)
        # VSD-only products (no std/xl at all) have no physical Stream Deck to name,
        # so the chip must not say "Stream Deck MK.2" -- that's the exact device the
        # product doesn't need. "vsd" gets its own chip text, joined onto any real
        # desk-deck sizes the product also ships (a ported product like World of
        # Warcraft carries both).
        right = f"Stream Deck {dev_names}" if dev_names else ""
        if "vsd" in sizes:
            right = f"{right} + Virtual Stream Deck" if right else "Virtual Stream Deck"
        # A product on every device class has nothing left to enumerate, and the
        # full string ("Stream Deck MK.2 + XL + Plus + Virtual Stream Deck") is 50
        # characters -- it only fits the cover band at 20pt, half the size of the
        # chip opposite it. Say the short true thing instead, matching the phrase
        # the plugin and icon-pack branches already use.
        if {"std", "xl", "plus", "vsd"} <= sizes:
            right = "All Stream Decks"
        cfg["hero_chips"] = ["Profile Pack", right or "Virtual Stream Deck"]
        cfg["os_glyphs"] = ["brand-windows", "brand-apple"] if dual_os else None
        # A plain profile has no distinctive product icon -- the generated name-mark
        # badge on the tell-more page just repeats the title a few inches above
        # itself and reads as low-effort filler (owner feedback, 2026-08-08).
        cfg.setdefault("hero_badge_icon", False)
    plates = sorted((ROOT.parent / "brand" / "ai_backgrounds" / folder).glob("*.png")) \
        if (ROOT.parent / "brand" / "ai_backgrounds" / folder).exists() else []
    # A review workflow may supply a researched background explicitly. That source
    # must win over the legacy first-file convention so staging stays reproducible.
    if plates and not cfg.get("bg_image"):
        cfg["bg_image"] = str(plates[0])

# ── iCUE widgets ───────────────────────────────────────────────────────────────
# A widget has no keys and no deck, so none of the deck hero paths apply. The
# centrepiece is the widget itself, using the real screenshots captured by
# widgets/harness/shots.mjs at native slot resolution. Copy lives here so the
# listing and the in-product manifest description stay separately reviewable.

WIDGETS = ROOT.parent / "widgets"
WIDGET_SHOTS = WIDGETS / "_marketing" / "_shots"
# Must match PHOSPHORS in _src/retro-terminal/terminal.js and the capture order
# in harness/shots_phosphor.mjs.
PHOSPHOR_NAMES = ["green", "amber", "cyan", "white", "magenta"]
FACE_NAMES = ["orbit", "matrix", "pulse", "minimal"]

# Widgets that respond to a tap get a banner showing what tapping does, built from
# the real captures in harness/shots_tap.mjs. Keyed by slug so a widget without a tap
# interaction is simply absent and its kit is unchanged.
#   (slot size, states, banner filename, title, caption, layout)
TAP_BANNERS = {
    "retro-terminal": ("S", PHOSPHOR_NAMES, "colors", "Tap to change the phosphor",
                       "Touch the screen and it steps to the next colour. It remembers which.",
                       "palette"),
    "ambient-clock": ("M", FACE_NAMES, "faces", "Tap to change the face",
                      "Four faces in one widget. Touch the screen to step through them.",
                      "panels"),
}

# slug -> (cover title, search line, intro, tagline, [(feature, text)], outro,
#          [(banner title, [size tags], caption)])
WIDGET_COPY = {
    "market-command-center": (
        "Market Command Center",
        "Stock tracker widget and crypto board for the Corsair Xeneon Edge.",
        "Your whole watchlist, live on your dashboard, so you stop alt-tabbing to a "
        "browser tab you left open three hours ago.",
        "Prices, daily movement and 7 day sparklines at a glance.",
        [("Coins and stocks together", "One board for both, sorted the way you set it up."),
         ("Real 7 day sparklines", "Crypto ships a true week of history, not a decorative squiggle."),
         ("Honest day ranges", "Stocks show the real session low to high with today sitting on it."),
         ("Survives a dropout", "Loses the connection and it keeps your last known prices on screen.")],
        "Coins need no setup at all. Stocks need your own Finnhub API key, which costs "
        "nothing, needs no card, and takes a minute at finnhub.io/register.",
        [("Built for the full width", ["XL"], "Ten instruments across the display, still readable from a metre away."),
         ("Fits every slot", ["L", "M", "S"], "Drops columns as space runs out. It never shrinks the numbers to fit.")],
    ),
    "crypto-portfolio": (
        "Crypto Portfolio",
        "Crypto portfolio widget for the Corsair Xeneon Edge.",
        "What your coins are actually worth, all day, without opening an exchange.",
        "Live total value, today's move, and every position sized against the rest.",
        [("Total value first", "The number you actually want, big enough to read across the room."),
         ("Weighted daily change", "A big holding moves the number more than a small one, as it should."),
         ("Allocation at a glance", "Each position shown as its share of the whole portfolio."),
         ("Amounts stay yours", "Your quantities never leave your PC. Only coin names go out.")],
        "Enter what you hold once. Hide the amounts any time with a single switch.",
        [("The whole portfolio at once", ["XL"], "Total, daily move and every holding, in one glance."),
         ("Fits every slot", ["L", "M", "S"], "Keeps the total no matter how small the space gets.")],
    ),
    "sports": (
        "Ultimate Sports Tracker",
        "Sports tracker widget with live scores and a scoreboard for the Corsair Xeneon Edge.",
        "Live scores for every team you follow, on one screen. Football scores, basketball, "
        "hockey and baseball, plus the sports schedule for whatever has not started yet.",
        "Eleven sports, one scoreboard, your teams only.",
        [("Every sport in one widget", "Football, basketball, hockey, baseball, soccer, college "
                                       "and the WNBA, plus UFC, NASCAR and Formula 1."),
         ("Fight nights and race weekends", "A card shows its main event, a race shows who is "
                                            "leading, right beside your teams."),
         ("The urgent game first", "Anything in progress moves to the front, then whatever starts "
                                   "soonest, then last night's final."),
         ("Who is ahead is obvious", "The leading side stays bright and the trailing side steps "
                                     "back, readable from across the room.")],
        "Name what you follow once and it does the rest, checking often while a game is live and "
        "easing off when nothing is on. It keeps the last scores on screen if the connection drops. "
        "Not affiliated with, endorsed by, or sponsored by any league, team or broadcaster.",
        [("Six sports at once", ["XL"], "The full width of the display, one cell per thing you follow."),
         ("Fits every slot", ["L", "M", "S"], "Wraps and stacks as space runs out. The score is the last thing to go.")],
    ),
    "ambient-clock": (
        "Ambient Clock Pack",
        "Ambient clock widget pack, four animated faces for the Corsair Xeneon Edge.",
        "Four animated clock faces built for a screen that stays on all day.",
        "Orbit, Matrix, Pulse and Minimal, all drawn live in your own colours.",
        [("Orbit", "Three arcs sweep the hours, minutes and seconds. No ticking, just motion."),
         ("Matrix", "Glyphs rain behind the time, at whatever intensity you like."),
         ("Pulse", "A slow breathing field of colour, tied to the clock so it never drifts."),
         ("Minimal", "Just the time, as large as the slot allows, and nothing else.")],
        "Every face is drawn on the fly, so nothing is downloaded and nothing expires.",
        [("Four faces, one widget", ["XL"], "Switch between them from the settings panel, any time."),
         ("Reshapes for the slot", ["L", "M", "S"], "From the small tile to the full width of the display.")],
    ),
    "retro-terminal": (
        "Retro Terminal",
        "Retro terminal widget, a CRT clock for the Corsair Xeneon Edge.",
        "A CRT console for your dashboard. It boots, reports in, and then keeps time.",
        "Scanlines, vignette and tube flicker, all drawn live.",
        [("Boots like the real thing", "A start up log types itself out once, then the clock takes over."),
         ("Tap to change phosphor", "Touch the screen and it cycles green, amber, cyan, white and magenta."),
         ("Your name on the prompt", "Put anything you like in front of the cursor."),
         ("Every effect optional", "Scanlines and flicker each switch off on their own.")],
        "No network, no accounts, no upkeep. It just runs.",
        [("The full width command line", ["XL"], "Prompt, clock and date read as one line across the display."),
         ("Fits every slot", ["L", "M", "S"], "Stacks itself down when the space gets narrow.")],
    ),
    "perf-grapher": (
        "Performance Grapher",
        "PC performance widget with sensor history for the Corsair Xeneon Edge.",
        "See where your machine has been, not just where it is right now.",
        "Rolling history graphs for any sensor iCUE can read.",
        [("Actual history", "A rolling window per sensor, so you can see the spike you just missed."),
         ("Any sensor iCUE reads", "CPU and GPU load, temperatures, fan speeds, memory, your pick."),
         ("Your own warning level", "Set the number that matters to you and the card turns amber."),
         ("Survives a restart", "Reopening your dashboard does not wipe the graphs.")],
        "Reads straight from iCUE. Nothing touches the network.",
        [("Four sensors, side by side", ["XL"], "Each with its own colour, low and high for the window."),
         ("Fits every slot", ["L", "M", "S"], "Rearranges the grid rather than squeezing the graphs flat.")],
    ),
    "ai-usage": (
        "AI Usage Dashboard",
        "AI usage widget for Claude, ChatGPT and Cursor on the Corsair Xeneon Edge.",
        "Every AI limit you are burning through, on one panel, before you hit the wall.",
        "Claude, ChatGPT, Codex, Cursor, Copilot and Gemini, all in one place.",
        [("One ring per provider", "How much of the window is gone, readable in under a second."),
         ("Knows when it resets", "A live countdown to the next window, per provider."),
         ("Warns before the wall", "Set your own threshold and the ring turns amber early."),
         ("No new sign ins", "Reads from the Packrat Stream Deck plugin already running on your PC.")],
        "Requires the Packrat Stream Deck plugin on the same PC.",
        [("Every provider at once", ["XL"], "Four rings across the display, each with its reset time."),
         ("Fits every slot", ["L", "M", "S"], "Drops the captions before it ever shrinks the rings.")],
    ),
    "home-assistant": (
        "Home Assistant Panel",
        "Home Assistant widget for your own entities on the Corsair Xeneon Edge.",
        "Your house, on your desk, without picking up your phone.",
        "Any entity from your own Home Assistant, live on a tile.",
        [("Pick your own entities", "List what matters and they appear in the order you wrote them."),
         ("Lights up when it is on", "Lights and switches read at a glance without stopping to think."),
         ("Sensors with their units", "Temperature, humidity, power draw, all formatted properly."),
         ("Stays on your network", "Talks straight to your own server with a token you create.")],
        "Setup takes two things on your own server: a long lived access token, and "
        "adding null to CORS allowed origins under Settings, System, Network. On Home "
        "Assistant before 2026.8 that setting lives in configuration.yaml instead.",
        [("Six entities across the display", ["XL"], "Lights, sensors and locks together on one board."),
         ("Fits every slot", ["L", "M", "S"], "Collapses to a single column when the space gets tall and thin.")],
    ),
    "slot-machine": (
        "Slot Machine",
        "Slot machine widget for the Corsair Xeneon Edge.",
        "Three reels on your dashboard, for when the build is compiling.",
        "Weighted reels, a real wind up, and near miss tension on the last one.",
        [("It actually builds", "The third reel drags whenever the first two match. You will feel it."),
         ("Bet levels that matter", "Level up to scale every payout, with the odds left exactly alone."),
         ("A daily bonus", "Claim once every 24 hours. The higher your level, the bigger it lands."),
         ("Tap to spin", "One touch on the display. Nothing to install, nothing to sign into.")],
        "Credits are cosmetic. There is no purchase and nothing of value is wagered.",
        [("The full cabinet", ["XL"], "Reels, stats and the payout table across the display."),
         ("Fits every slot", ["L", "M", "S"], "Stacks the panels rather than shrinking the reels.")],
    ),
}

def widget_shot(slug, tag="XL"):
    p = WIDGET_SHOTS / f"{slug}-{tag}.png"
    return str(p) if p.exists() else None


_PROP_RE = re.compile(r'<meta\s+name="x-icue-property"([^>]*)/?>')
_ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')
_TR_RE = re.compile(r"tr\('(.*)'\)|^'(.*)'$")


def _prop_text(v):
    """Unwrap the tr('...') / '...' quoting the manifest metas use for labels."""
    m = _TR_RE.match((v or "").strip())
    return (m.group(1) or m.group(2)) if m else (v or "").strip()


def widget_settings(slug, limit=4):
    """The widget's real iCUE settings, read off the SHIPPED index.html.

    Properties are declared as x-icue-property metas and already carry human labels,
    so the settings banner describes what the buyer actually gets. Hand-writing this
    list would drift from the build the first time a property is renamed.

    Colour properties are collapsed into one row: three near-identical "any colour
    you like" lines would crowd out the settings that actually differentiate.
    """
    src = WIDGETS / slug / "index.html"
    if not src.exists():
        return []
    items, colours = [], []
    for raw in _PROP_RE.findall(src.read_text(encoding="utf-8")):
        a = dict(_ATTR_RE.findall(raw))
        label, kind = _prop_text(a.get("data-label")), a.get("data-type", "")
        if not label:
            continue
        if kind == "color":
            colours.append(label.replace(" Color", ""))
            continue
        if kind == "slider":
            unit = _prop_text(a.get("data-unit-label", ""))
            desc = f"Anywhere from {a.get('data-min', '?')} to {a.get('data-max', '?')}{unit}."
        elif kind == "switch":
            desc = "Turn it on or off on its own."
        elif kind == "textfield":
            # Four textfields in a row all reading "put your own text in" is what the
            # first pass produced. The declared default is a real example, so use it,
            # and say plainly where a key is kept when there is no default to show.
            default = _prop_text(a.get("data-default", ""))
            desc = (f"Starts on {default}. Change it to whatever you follow."
                    if default else "Yours to paste in. iCUE keeps it, the widget never stores it.")
        elif kind == "sensors-factory":
            desc = "Picked straight from the sensors iCUE already reads."
        elif kind in ("combobox", "dropdown", "select"):
            desc = "Choose from the list."
        else:
            desc = "Set it the way you want it."
        items.append((label, desc))
    if colours:
        names = ", ".join(colours[:-1]) + f" and {colours[-1]}" if len(colours) > 1 else colours[0]
        items.append((f"{names} colour", "Match it to the rest of your setup."))
    return items[:limit]

def widget_cfg(slug: str):
    """Config for an iCUE widget listing, driven by the registry and WIDGET_COPY."""
    prod = _registry().get(slug, {})
    title, search, intro, tagline, feats, outro, banners = WIDGET_COPY[slug]
    devices, oses = _widget_support(slug, prod)
    return {
        "game": "WIDGET",
        "name": prod.get("name", title),
        "brand": tokens.ACCENT,
        "bg": tokens.BG,
        "icon": "",
        "icon_sub": "WIDGET",
        "logo_img": None,
        "hero_title_clean": title,
        "hero_title_max_sz": 96,
        "hero_device_frac": 0.88,
        "widget_shot": widget_shot(slug, "XL"),
        "widget_banners": banners,
        "slug": slug,
        "description": {
            "search_line": search,
            "intro": intro,
            "tagline": tagline,
            "features": feats,
            "outro": outro,
            "collection": ("Part of the Packrat collection for the Corsair Xeneon Edge. "
                           "See the full lineup on the marketplace."),
            "keywords": prod.get("keywords", []),
        },
    }

def build_widget(folder: str, cfg: dict, out_override=None):
    """Marketing kit for a widget: cover, then one banner per shot group."""
    live_out = ROOT.parent / _registry()[folder]["paths"]["marketing"]
    out = Path(out_override) if out_override is not None else live_out
    out.mkdir(parents=True, exist_ok=True)
    import re as _re
    for old in out.glob("*.png"):
        if _re.match(r"\d+-.*\.png$", old.name):
            old.unlink()

    _banded_facts(folder, cfg)
    me.BRAND = cfg["brand"]; me.BG = cfg["bg"]; me.OUT_DIR = str(out)

    src = out / "icon-source.png"
    if not src.exists() and out_override is not None:
        src = live_out / "icon-source.png"
    if src.exists():
        art = Image.open(src).convert("RGBA")
        for size, name in ((288, "icon-288x288.png"), (288, "icon.png"), (512, "icon@2x.png")):
            art.resize((size, size), Image.LANCZOS).save(out / name)
    else:
        icon = me.make_listing_icon(cfg, 288)
        icon.save(out / "icon-288x288.png"); icon.save(out / "icon.png")
        me.make_listing_icon(cfg, 512).save(out / "icon@2x.png")

    me.write_description(cfg, str(out))

    # Stale banners from an earlier, shorter run would survive into the kit and put
    # gallery_order.txt out of sync with the folder, which the QA gate reports as an
    # error. The banner set is regenerated wholesale, so clear it first.
    for old in out.glob("[0-9]*-*.png"):
        old.unlink()

    slug = cfg["slug"]
    desc = cfg["description"]
    showcase, sizes = cfg["widget_banners"]

    def shots_banner(spec):
        title, tags, caption = spec
        shots = [widget_shot(slug, t) for t in tags]
        labels = [f"{t} slot" for t in tags] if len(tags) > 1 else None
        return me.banner_widget_shots(cfg, title, shots, caption=caption, labels=labels)

    # Reading order for an IMMUTABLE gallery: cover, then the product big enough to
    # judge, then why you want it, then what you control, then how it fits. The two
    # middle banners are the deep dive the earlier 3-banner kit was missing.
    pages = [
        ("hero", lambda: me.banner_widget_hero(cfg)),
        ("showcase", lambda: shots_banner(showcase)),
        ("features", lambda: me.banner_widget_detail(
            cfg, "What it does", widget_shot(slug, "L"), desc["features"],
            caption=desc["tagline"])),
    ]
    # A widget with a tap interaction gets a banner showing it, built from real
    # captures (harness/shots_phosphor.mjs) rather than recoloured art. Only inserted
    # when those captures exist, so every other widget's kit is unchanged.
    spec = TAP_BANNERS.get(slug)
    if spec:
        size, states, fname, btitle, bcaption, layout = spec
        taps = [widget_shot(slug, f"{size}-{s}") for s in states]
        labels = [s.capitalize() for s in states]
        if all(taps):
            # Wide captures cropped to a band and stacked (phosphor), versus whole
            # panels side by side (faces): a face is radial art that a horizontal
            # crop would decapitate, while a terminal line survives it and gains the
            # scale that keeps its scanlines visible.
            draw = ((lambda: me.banner_widget_palette(cfg, btitle, taps, labels, caption=bcaption))
                    if layout == "palette" else
                    (lambda: me.banner_widget_shots(cfg, btitle, taps, caption=bcaption, labels=labels)))
            pages.append((fname, draw))
    settings = widget_settings(slug)
    if settings:
        pages.append(("settings", lambda: me.banner_widget_detail(
            cfg, "Set it up your way", widget_shot(slug, "M"), settings,
            caption=desc["outro"])))
    pages.append(("sizes", lambda: shots_banner(sizes)))

    order = []
    for i, (name, draw) in enumerate(pages, start=1):
        fname = f"{i}-{name}.png"
        draw().convert("RGB").save(out / fname)
        order.append(fname)
    (out / "gallery_order.txt").write_text("\n".join(order) + "\n", encoding="utf-8")

    inject_compat(folder, out)
    append_release_notes(folder, out)
    print(f"  widget art -> {out}")

def build_one(folder: str, cfg: dict, out_override=None):
    """Ship the banded layout (what /rat-art produces): clean cover, a 'tell me
    more' page, then the feature gallery, all in one designed frame.

    out_override is used by the Codex review workflow to render a complete kit
    outside the registry's live marketing directory.
    """
    # iCUE widgets have no keys and no deck; their whole hero path is different.
    if _registry().get(folder, {}).get("type") == "widget":
        return build_widget(folder, cfg, out_override=out_override)
    # Output dir comes from the registry so non-profile products (plugins live under
    # plugins/, not profiles/) land their marketing/ next to their own source.
    dir_rel = _registry().get(folder, {}).get("paths", {}).get("dir", f"profiles/{folder}")
    # An explicit paths.marketing wins, the same way build_widget reads it. Two products
    # can share one source dir (the AI usage plugins are both built out of
    # claude-usage-streamdeck), and deriving the kit path from dir alone would point
    # them at one folder, where the second build wipes the first one's banners.
    mkt_rel = _registry().get(folder, {}).get("paths", {}).get("marketing")
    live_out = ROOT.parent / mkt_rel if mkt_rel else ROOT.parent / dir_rel / "marketing"
    out = Path(out_override) if out_override is not None else live_out
    out.mkdir(parents=True, exist_ok=True)
    import re as _re
    for old in out.glob("*.png"):          # drop stale numbered banners from prior runs
        if _re.match(r"\d+-.*\.png$", old.name):
            old.unlink()
    _banded_facts(folder, cfg)
    me.BRAND = cfg["brand"]; me.BG = cfg["bg"]; me.OUT_DIR = str(out)

    # Hand-made artwork wins over the generated mark. Carried over from the retired
    # per-plugin generator, which had this rule and would otherwise have silently lost
    # the owner's artwork when those products moved into BUILDS. Accepted, in order:
    # marketing/icon-source.png, then a <something>-icon.png in the product root (where
    # hand-made icons actually get dropped, e.g. free-icon.png / pro-icon.png).
    src = out / "icon-source.png"
    if not src.exists() and out_override is not None:
        src = live_out / "icon-source.png"
    if not src.exists():
        loose = sorted((ROOT.parent / dir_rel).glob("*-icon.png"))
        if loose:
            src = loose[0]
    if src.exists():
        art = Image.open(src).convert("RGBA")
        art.resize((288, 288), Image.LANCZOS).save(out / "icon-288x288.png")
        art.resize((288, 288), Image.LANCZOS).save(out / "icon.png")
        art.resize((512, 512), Image.LANCZOS).save(out / "icon@2x.png")
    else:
        icon = me.make_listing_icon(cfg, 288)
        icon.save(out / "icon-288x288.png"); icon.save(out / "icon.png")
        me.make_listing_icon(cfg, 512).save(out / "icon@2x.png")
    me.write_description(cfg, str(out))

    clean = dict(cfg); clean["hero_layout"] = "clean"
    order = ["1-hero.png", "2-tellmore.png"]
    me.banner_hero(clean).convert("RGB").save(out / "1-hero.png")           # cover
    me.banner_hero(cfg).convert("RGB").save(out / "2-tellmore.png")         # tell-me-more
    # Scale shot, third so it lands early in an immutable gallery: for a product
    # sold on quantity, "there are hundreds of these" has to be seen, not read.
    n_off = 3
    if cfg.get("icon_wall"):
        paths, wall_title, wall_cap = cfg["icon_wall"]
        me.banner_icon_wall(clean, paths, wall_title, caption=wall_cap) \
            .convert("RGB").save(out / "3-iconwall.png")
        order.append("3-iconwall.png")
        n_off = 4
    for i, (title, specs, labels, acc, *rest) in enumerate(cfg["feature_banners"], start=n_off):
        cap = rest[0] if rest else None
        name = f"{i}-feature.png"
        me.banner_features_clean(clean, title, specs, labels, caption=cap, accent=acc) \
            .convert("RGB").save(out / name)
        order.append(name)
    (out / "gallery_order.txt").write_text("\n".join(order) + "\n", encoding="utf-8")
    me.gen_video(cfg)
    print(f"  banded art -> {out}")

    inject_compat(folder, out)
    append_release_notes(folder, out)
    make_dist_zip(folder, out)

def compat_line(folder: str) -> str:
    """Human-readable device + OS support line from the registry variant list."""
    prod = _registry().get(folder, {})
    if prod.get("type") == "plugin":
        # Plugins run on every Stream Deck model. OS comes from the plugin's OWN
        # manifest.json (the thing Elgato actually enforces), not a hardcoded guess:
        # some plugins here are Windows-only, others ship Windows + macOS.
        names = {"windows": "Windows", "mac": "macOS"}
        oses = []
        for man in sorted((ROOT.parent / prod["paths"]["dir"]).glob("*.sdPlugin/manifest.json")):
            data = _json.loads(man.read_text(encoding="utf-8"))
            oses = [names.get(o.get("Platform"), o.get("Platform")) for o in data.get("OS", [])]
            break
        oses = oses or ["Windows"]
        return f"Works on every Stream Deck model, for {' and '.join(oses)}."
    if prod.get("type") == "icons":
        return "Works on every Stream Deck model, for Windows and macOS."
    if prod.get("type") == "widget":
        devices, oses = _widget_support(folder, prod)
        return (f"Works on the {' and '.join(devices)} through iCUE, "
                f"for {' and '.join(oses)}.")
    variants = prod.get("variant_files", {})
    sizes = {v.split("_")[0] for v in variants}
    devices = [n for n, k in (("Stream Deck MK.2", "std"), ("Stream Deck XL", "xl"),
                              ("Stream Deck +", "plus"),
                              ("Virtual Stream Deck", "vsd")) if k in sizes] \
        or ["Stream Deck MK.2"]
    has_mac = any(v.endswith("_mac") for v in variants)
    has_win = any(not v.endswith("_mac") for v in variants)
    oses = [n for n, ok in (("Windows", has_win), ("macOS", has_mac)) if ok] or ["Windows"]
    # VSD-only products name the HARDWARE that unlocks the panel, because that is
    # what a buyer owns and searches for. CONFIRMED 2026-08-09 against the live
    # Maker Console: there is no "Virtual Stream Deck" device tag any more, only
    # the unlocking devices, so the listing metadata says NIGHTSWORD/SCIMITAR and
    # the copy must agree with it. Device list comes from registry
    # marketplace_devices; the map only converts a console tag into its retail
    # name. GALLEON is deliberately absent: it is a keyboard with a PHYSICAL
    # built-in deck, a different grid, not this 8x8 on-screen panel.
    if sizes == {"vsd"} and prod.get("marketplace_devices"):
        retail = {"NIGHTSWORD v2 WL SD": "NIGHTSWORD v2 WIRELESS SD",
                  "SCIMITAR ELITE": "SCIMITAR ELITE"}
        names = [retail.get(d, d) for d in prod["marketplace_devices"]]
        joined = names[0] if len(names) == 1 else \
            f"{', '.join(names[:-1])} and {names[-1]}"
        return f"Works on Virtual Stream Deck ({joined}), for {' and '.join(oses)}."
    # "A, B and C" rather than "A and B and C" once a third device exists.
    dev_text = devices[0] if len(devices) == 1 else \
        f"{', '.join(devices[:-1])} and {devices[-1]}"
    return f"Works on {dev_text}, for {' and '.join(oses)}."

def inject_compat(folder: str, out: Path):
    """Insert the compatibility line as its own paragraph right after the intro,
    so buyers see the real device/OS support (was wrongly 'MK.2' only)."""
    desc = out / "description.txt"
    if not desc.exists():
        return
    line = compat_line(folder)
    text = desc.read_text(encoding="utf-8")
    if line in text:
        return
    parts = text.split("\n\n", 2)   # [search_line, intro, rest]
    if len(parts) == 3:
        text = parts[0] + "\n\n" + parts[1] + "\n\n" + line + "\n\n" + parts[2]
    else:
        text = line + "\n\n" + text
    desc.write_text(text, encoding="utf-8")

def append_release_notes(folder: str, out: Path):
    """Release notes live below a 40-dash divider so both parts paste from one
    file. Bullets ONLY: no header, no 'Initial release' filler (owner rule)."""
    notes = RELEASE_NOTES.get(folder)
    desc = out / "description.txt"
    if not notes or not desc.exists():
        return
    bullets = "\n".join(l for l in notes.strip().splitlines()
                        if l.lstrip().startswith("-"))
    text = desc.read_text(encoding="utf-8")
    text += ("\n\n" + "-" * 40 + "\n" + bullets + "\n")
    desc.write_text(text, encoding="utf-8")

def make_dist_zip(folder: str, out: Path):
    """Upload-ready zip: EVERY device variant, plus install notes and the marketplace
    link. One zip per product, never one per variant: this used to glob and keep a
    single .streamDeckProfile, so a buyer on any deck but the alphabetically-first
    one downloaded a file their hardware could not use. Name and contents match
    make_kit.py, which builds the zip that actually gets uploaded.

    Ships INSTALL.md, NOT README.md: the README in a product folder is the internal
    build log, with pricing rationale and competitor numbers no buyer should see."""
    import zipfile
    prod = _registry().get(folder, {})
    src = ROOT.parent / prod.get("paths", {}).get("dir", f"profiles/{folder}")
    if prod.get("type") == "plugin":
        package = ROOT.parent / prod.get("paths", {}).get("package", "")
        files = [package] if package.is_file() else []
    else:
        names = list(prod.get("variant_files", {}).values()) or \
            [p.name for p in sorted(src.glob("*.streamDeckProfile"))]
        files = [src / n for n in names if (src / n).exists()]
    if not files:
        return
    zip_path = out / f"{folder}-v{prod.get('version', '1.0.0')}.zip"
    # Drop zips left by earlier runs. A stale single-variant zip sitting beside the
    # real one is the exact mistake this function is here to stop.
    for old in out.glob("*.zip"):
        if old != zip_path:
            old.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in files:
            z.write(p, p.name)
        extras = [src / "INSTALL.md", *sorted(src.glob("*.url"))]
        for p in extras:
            if p.exists():
                z.write(p, p.name)
    print(f"  dist zip: {zip_path.name} ({len(files)} variants)")

VAL_RED = (255, 70, 85)
STARTER_PURPLE = (170, 120, 255)
DAVINCI_ORANGE = (255, 150, 70)
PAL_BLUE = (90, 200, 250)
DISCORD_BLURPLE = (130, 140, 250)
SU_GOLD = (217, 164, 65)
SU_MAROON = (42, 12, 20)
SS_GREEN = (43, 232, 106)   # house hacker-green, for the Screensaver Scheduler plugin
BH_BRASS = (232, 121, 26)   # Better Hotkeys' own key palette (its tools/gen_icons.py)
BH_BADGE_BLUE = (34, 88, 234)   # tier-seal blue, sampled from the hand-made listing icons
                                # so the cover badge and the store thumbnail match
BG = (8, 10, 16)

COLLECTION = ("Part of the Packrat profile collection for Stream Deck. Game decks, "
              "streamer decks and editing decks, all on the marketplace at @packrat.")
PLUGIN_COLLECTION = ("More Stream Deck profiles, plugins and tools from Packrat, all on "
                     "the marketplace at @packrat.")

# ---------------------------------------------------------------- Valorant
def valorant_cfg():
    A = VAL_RED
    mute = key_img("microphone-off", label="Mute Mic")
    deaf = key_img("headphones-off", label="Deafen")
    ptt = key_img("microphone", fg=A, dot=GREEN_DOT, label="Push to\nTalk")
    clip = key_img("scissors", fg=A, label="Save Clip")
    mark = key_img("flag", fg=A, label="Marker")
    trak = key_img("chart-bar", fg=A, label="Tracker")
    xh = key_img("crosshair", fg=A, label="Cross\nhairs")
    w1 = key_img("number-1", label="Primary")
    spike = key_img("bomb", fg=A, label="Spike")
    ult = key_img("letter-x", fg=(255, 200, 80), label="Ult")
    buy = key_img("shopping-bag", fg=A, label="Buy")
    vyes = key_img("thumb-up", fg=(95, 200, 120), label="Vote Yes")
    vno = key_img("thumb-down", fg=A, label="Vote No")
    reload = key_img("refresh", label="Reload")
    tvoice = key_img("microphone", fg=A, label="Team\nVoice")
    return {
        "game": "VALORANT", "name": "Valorant",
        "logo_img": str(LOGOS / "valorant.png"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "DECK",
        "os_support": "Windows + Mac",
        "hero_title": ["Every Valorant key,", "one tap away."],
        "tagline": "Weapons, abilities, votes, comms, clips and crosshairs. One press, one action. No macros.",
        "bullets": ["Game page: weapons, abilities, ult, buy, reload, drop",
                    "Comms and clips: Discord mute/deafen, OBS clip and marker",
                    "Vote yes/no, team voice hold, crosshair codes, tracker.gg"],
        "hero_keys": [w1, spike, ult, buy, reload, mute, deaf, ptt, tvoice, clip, mark, vyes, vno, xh],
        "device_photo_mockup": True,
        "bottom": [("device-gamepad-2", "Game keys", "Default binds"),
                   ("headphones-off", "Comms", "Mute and deafen"),
                   ("scissors", "Clips", "Save the moment"),
                   ("crosshair", "Crosshairs", "Pro-style codes")],
        "feature_banners": [
            ("The whole loadout on keys.", [w1, spike, ult, buy, key_img("refresh", label="Reload")],
             ["1", "4", "X", "B", "R"], None,
             "Weapons, spike, abilities, ult, buy menu and reload, each key taps Valorant's own default bind. One press, one action, no macros."),
            ("Comms control mid-match.", [mute, deaf, ptt, key_img("microphone", fg=A, label="Team\nVoice")],
             ["Discord mute", "Discord deafen", "Hold to talk", "Team voice V"], None,
             "Mute or deafen Discord while you clutch, plus real hold-to-talk keys for Discord and team voice."),
            ("Clip the ace the second it happens.", [clip, mark, key_img("player-record", fg=A, label="Record"), key_img("broadcast", fg=A, label="Stream")],
             ["Save replay", "Drop marker", "Record", "Go live"], None,
             "Bind it to your clipping software and save the play before the round ends."),
            ("Votes and crosshairs, instantly.", [vyes, vno, xh, key_img("target", fg=A, label="Dot")],
             ["F5", "F6", "Folder", "4 codes"], None,
             "Vote yes or no without finding the key, and paste style-named crosshair codes into the import box between rounds."),
            ("Your stats and scene, one tap away.", [trak, key_img("world", fg=A, label="VLR News")],
             ["tracker.gg", "vlr.gg"], None,
             "Match history and the pro scene open in your browser without alt-tab hunting."),
        ],
        "statement": ["Built for ranked nights.",
                      "Game keys, comms, clips and votes. One press, one action, nothing automated."],
        "video_scenes": [
            ("Weapons and abilities on tap", [w1, spike, ult, buy]),
            ("Mute and deafen mid-match", [mute, deaf, ptt]),
            ("Clip the ace instantly", [clip, mark]),
            ("Votes, crosshairs, stats", [vyes, vno, xh, trak]),
            ("Valorant", [spike, ult, mute, clip, vyes]),
        ],
        "description": {
            "search_line": "Valorant Stream Deck profile: weapon and ability hotkeys, buy menu, vote yes no, Discord mute deafen, OBS clips, crosshair codes.",
            "intro": "The complete Valorant deck for Stream Deck: a Game page tapping Valorant's default keybinds (weapons, spike, abilities, ult, buy, reload, drop, inspect), a comms and clips home page, votes, team voice, crosshair codes and stats.",
            "tagline": "Every key you reach for, one tap away.",
            "features": [
                ("Game page", "Primary, pistol, knife, spike, Q/E/C abilities, ult, buy menu, reload, use, drop, inspect on default binds."),
                ("Comms row", "Discord mute, deafen, hold-to-talk, plus a team voice hold key."),
                ("Clip row", "OBS save replay, marker, record and stream."),
                ("Votes", "Vote yes (F5) and no (F6) without hunting the keyboard."),
                ("Crosshairs and intel", "Style-named crosshair codes, tracker.gg and vlr.gg."),
            ],
            "outro": "Every game key sends a single tap of Valorant's own default keybind. No macros, no sequences, no automation. If you rebound keys in Valorant, mirror the change on the button.",
            "keywords": ["Valorant", "Stream Deck profile", "hotkeys", "abilities", "Discord mute", "crosshair codes"],
            "collection": COLLECTION,
        },
    }

# ---------------------------------------------------------------- Starter Pack
def starter_cfg():
    A = STARTER_PURPLE
    mute = key_img("microphone-off", label="Mute Mic")
    deaf = key_img("headphones-off", label="Deafen")
    clip = key_img("scissors", fg=A, label="Save Clip")
    mark = key_img("flag", fg=A, label="Marker")
    rec = key_img("player-record", fg=A, label="Record")
    strm = key_img("broadcast", fg=A, label="Stream")
    vo = key_img("microphone", fg=A, label="Voiceover")
    subs = key_img("badge-cc", fg=A, label="Subtitles")
    vids = key_img("folder", fg=A, label="Videos")
    snd = key_img("music", fg=A, label="Sounds")
    sfx = key_img("volume", label="Hype")
    return {
        "game": "STREAMER", "name": "Streamer Starter Pack",
        "logo_img": str(LOGOS / "obsstudio.png"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "STARTER",
        "hero_title": ["Your first stream deck,", "done right."],
        "tagline": "The OBS and Discord controls every streamer presses daily, plus a 13-slot soundboard.",
        "bullets": ["Mute, deafen, record, stream, clip and marker on one page",
                    "Voiceover and subtitle hotkeys wired for your workflow",
                    "Soundboard page ready for your own sounds"],
        "hero_keys": [mute, deaf, clip, mark, rec, strm, vo, subs, vids, snd, sfx],
        "device_photo_mockup": True,
        "bottom": [("microphone-off", "Comms", "Mute and deafen"),
                   ("player-record", "Capture", "Record and clip"),
                   ("music", "Soundboard", "13 ready slots"),
                   ("folder", "Recordings", "One-tap folder")],
        "feature_banners": [
            ("Every stream, the same five buttons.", [mute, deaf, clip, mark, rec],
             ["Discord mute", "Discord deafen", "OBS replay", "OBS marker", "OBS record"], None,
             "Mute, deafen, clip, marker, record. The daily drivers sit on the top row where your hand expects them."),
            ("Go live without touching OBS.", [strm, rec, clip],
             ["Start stream", "Start record", "Save replay"], None,
             "Documented OBS hotkey binds ship in the README. Set them once, never open Settings again."),
            ("Voiceover and subtitles, one press each.", [vo, subs, vids],
             ["Record VO", "Captions", "Open folder"], None,
             "A mic-only recording hotkey for voiceovers, a captions toggle for your subtitle tool, and your Videos folder on a key."),
            ("A soundboard that plays YOUR sounds.", [snd, sfx, key_img("volume", label="Applause"), key_img("volume", label="Drum Roll"), key_img("volume", label="Outro")],
             ["Sound page", "Slot", "Slot", "Slot", "Slot"], None,
             "13 pre-labeled Play Audio slots. Drop in your own licensed sounds and they are on your deck in seconds."),
            ("Consistent with the whole Packrat lineup.", [mute, deaf],
             ["Same everywhere", "Same everywhere"], None,
             "Mute and deafen look and behave identically across every Packrat profile, so muscle memory transfers."),
        ],
        "statement": ["Day one to partner.",
                      "The 80 percent of buttons streamers actually use, none of the ones they don't."],
        "video_scenes": [
            ("Mute and deafen instantly", [mute, deaf]),
            ("Record, stream, clip, mark", [rec, strm, clip, mark]),
            ("Voiceover and subtitles", [vo, subs]),
            ("Streamer Starter Pack", [mute, deaf, clip, mark, rec]),
        ],
        "description": {
            "search_line": "Streamer starter Stream Deck profile: OBS record, stream and clip hotkeys, Discord mute and deafen, markers, soundboard.",
            "intro": "A one-page control room for OBS and Discord streamers on Stream Deck: comms, recording, clipping, markers, voiceover, subtitles and a soundboard page.",
            "tagline": "The buttons every streamer presses daily, on one page.",
            "features": [
                ("Comms", "Discord mute and deafen toggles that work mid-game."),
                ("Capture", "OBS record, stream, save-replay and marker hotkeys, documented in the README."),
                ("Voiceover and subtitles", "One press to record a VO take or toggle your captions tool."),
                ("Soundboard page", "13 pre-labeled slots for your own sounds."),
                ("Recordings folder", "Opens your Videos folder instantly."),
            ],
            "outro": "Bind the documented hotkeys once in OBS and Discord and the deck runs your whole session.",
            "keywords": ["streamer", "Stream Deck profile", "OBS hotkeys", "Discord mute", "soundboard", "starter"],
            "collection": COLLECTION,
        },
    }

# ---------------------------------------------------------------- DaVinci
def davinci_cfg():
    A = DAVINCI_ORANGE
    blade = key_img("cut", fg=A, label="Blade")
    mark = key_img("flag", fg=A, label="Marker")
    j = key_img("player-play", flip=True, label="Rev")
    k = key_img("player-stop", label="Stop")
    l = key_img("player-play", label="Play")
    inb = key_img("arrow-bar-to-left", fg=A, label="In")
    outb = key_img("arrow-bar-to-right", fg=A, label="Out")
    split = key_img("slash", fg=A, label="Split")
    rip = key_img("trash", fg=A, label="Ripple Del")
    fit = key_img("zoom-scan", fg=A, label="Zoom Fit")
    ins = key_img("row-insert-bottom", fg=A, label="Insert")
    ovr = key_img("layers-intersect", fg=A, label="Overwrite")
    app = key_img("plus", fg=A, label="Append")
    cap = key_img("badge-cc", fg=A, label="Captions")
    colors = [key_img("circle", fg=rgb, label=n)
              for n, rgb in [("Orange", (255, 150, 60)), ("Green", (95, 200, 120)),
                             ("Blue", (95, 145, 255)), ("Pink", (255, 130, 185))]]
    return {
        "game": "RESOLVE", "name": "DaVinci Resolve",
        "logo_img": str(LOGOS / "davinciresolve.png"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "EDIT",
        "hero_title": ["The Resolve shortcuts", "you actually press."],
        "tagline": "Three pages: edit essentials, pro edits, captions and clip colors.",
        "bullets": ["Edit shortcuts on Resolve's own defaults, zero setup",
                    "Insert, overwrite, replace and append on real keys",
                    "Captions plus one-tap clip colors"],
        "hero_keys": [blade, mark, j, k, l, inb, outb, split, rip, ins, ovr, app, cap, colors[0]],
        "device_photo_mockup": True,
        "bottom": [("cut", "Cutting", "Blade and split"),
                   ("player-play", "Playback", "Play and rewind"),
                   ("flag", "Markers", "One-tap marks"),
                   ("bolt", "Setup", "None needed")],
        "feature_banners": [
            ("Stop hunting for shortcuts.", [blade, split, rip, key_img("pointer", fg=A, label="Select"), mark],
             ["Blade", "Split", "Ripple Del", "Select", "Marker"], None,
             "Your most-used edits, labeled and one tap away."),
            ("Playback under your fingers.", [j, k, l, inb, outb],
             ["Rewind", "Stop", "Play", "Mark In", "Mark Out"], None,
             "Scrub, stop and set your in and out points without the keyboard."),
            ("Build your cut without the mouse.", [ins, ovr, key_img("repeat", fg=A, label="Replace"), key_img("arrow-up", fg=A, label="Place Top"), app],
             ["Insert", "Overwrite", "Replace", "Place Top", "Append"], None,
             "Insert, overwrite, replace and append, each on its own key."),
            ("Captions and clip colors on tap.", [cap] + colors,
             ["Captions", "Orange", "Green", "Blue", "Pink"], None,
             "Generate captions and color your timeline with a single press."),
            ("Import and start cutting.", [blade, j, k, l, mark, inb],
             ["Blade", "Rewind", "Stop", "Play", "Marker", "Mark In"], None,
             "Runs on Resolve's own default shortcuts. No setup."),
        ],
        "statement": ["Half the price of the big packs.",
                      "Three pages covering what editors actually press, not 200 buttons you will never find."],
        "video_scenes": [
            ("Blade, split, ripple delete", [blade, split, rip]),
            ("Play, stop, rewind", [j, k, l]),
            ("Insert, overwrite, append", [ins, ovr, app]),
            ("Captions and clip colors", [cap] + colors[:3]),
            ("DaVinci Resolve Starter", [blade, j, k, l, mark]),
        ],
        "description": {
            "search_line": "DaVinci Resolve Stream Deck profile: edit page shortcuts, insert overwrite append, playback keys, markers, captions and clip colors.",
            "intro": "The DaVinci Resolve editing shortcuts you actually press, on real keys: blade, split, ripple delete, playback, markers, in and out points, insert, overwrite, replace and append, plus captions and one-tap clip colors.",
            "tagline": "Editing shortcuts, assembly edits, captions and clip colors.",
            "features": [
                ("Editing", "Blade, select, markers, play, stop and rewind, in and out, split, ripple delete, undo, zoom fit."),
                ("Assembly", "Insert, overwrite, replace, place on top, append, transitions, retime, disable clip, edit-point navigation."),
                ("Captions", "A generate-captions key wired to a documented custom bind."),
                ("Clip colors", "Seven one-tap clip colors plus clear, for a timeline you can read at a glance."),
                ("Zero setup", "The editing shortcuts use Resolve's own default keymap out of the box."),
            ],
            "outro": "The Captions and Colors page uses documented custom binds (Resolve has no defaults for them); the included map sets them up in minutes.",
            "keywords": ["DaVinci Resolve", "Stream Deck profile", "video editing", "shortcuts", "captions", "clip colors"],
            "collection": COLLECTION,
        },
    }

# ---------------------------------------------------------------- Palworld
def palworld_cfg():
    A = PAL_BLUE
    spr = key_img("run", label="Auto Sprint")
    spr_on = key_img("run", fg=A, dot=GREEN_DOT, label="Auto Sprint")
    hit = key_img("pick", label="Auto Hit")
    hit_on = key_img("pick", fg=A, dot=GREEN_DOT, label="Auto Hit")
    sort = key_img("backpack", fg=A, label="Sort Inv")
    mapk = key_img("map-2", fg=A, label="Map")
    bag = key_img("backpack", label="Bag")
    bld = key_img("hammer", fg=A, label="Build")
    thr = key_img("target", fg=A, label="Throw Pal")
    guide = key_img("book", fg=A, label="Guide")
    paldb = key_img("database", fg=A, label="Pal DB")
    fullmap = key_img("map-2", label="Full Map")
    patch = key_img("news", fg=A, label="Patch\nNotes")
    return {
        "game": "PALWORLD", "name": "Palworld",
        "logo_img": str(LOGOS / "palworld.png"), "logo_scale": 1.5,
        "brand": A, "bg": BG, "icon": "", "icon_sub": "DECK",
        "hero_title": ["Palworld's missing", "auto-run button."],
        "tagline": "Toggle-hold sprint and mining so your hands can rest. PvE game, zero ban risk.",
        "bullets": ["Auto Sprint: one press toggles Shift+W held for you",
                    "Auto Hit: hands-free mining and logging",
                    "Sort, map, bag, build and throw on real keys"],
        "hero_keys": [spr, hit, sort, mapk, bag, bld, thr, guide, paldb, fullmap, patch],
        "device_photo_mockup": True,
        "bottom": [("run", "Auto Sprint", "True auto-run"),
                   ("pick", "Auto Hit", "AFK mining"),
                   ("backpack", "Sorting", "One-tap tidy"),
                   ("shield-check", "PvE safe", "No anti-cheat")],
        "feature_banners": [
            ("The auto-run Palworld never shipped.", [spr, spr_on],
             ["Press once", "Running"], None,
             "One press holds Shift+W down for you, press again to stop. The green dot shows it is live, and page switches always release it."),
            ("Mine while you stretch.", [hit, hit_on],
             ["Press once", "Swinging"], None,
             "Toggle-holds left click for hands-free ore, wood and damage farming at your base."),
            ("Inventory chores, one tap.", [sort, bag, bld],
             ["Click sort", "Tab", "B"], None,
             "Sort Inv clicks Palworld's sort button at a spot you set once. Bag and Build open instantly."),
            ("The rest of your hotbar.", [mapk, thr],
             ["Map", "Throw Pal"], None,
             "Map and Pal throw on keys, so your mouse hand never leaves aim."),
            ("Powered by Better Hotkeys and Mouse.", [spr_on, hit_on],
             ["Toggle key", "Toggle mouse"], None,
             "Uses the Packrat plugin for real key and mouse holds, something stock Stream Deck cannot do."),
            ("A beginner's guide page built in.", [guide, key_img("database", fg=A, label="Pal DB"), key_img("map-2", label="Full Map"), key_img("news", fg=A, label="Patch\nNotes")],
             ["Wiki", "paldb.cc", "mapgenie.io", "Steam news"], None,
             "The wiki, the Pal and sphere database, the interactive map and patch notes, one tap from the deck."),
        ],
        "statement": ["Farm smarter, not longer.",
                      "The two toggles every Palworld player wishes were in the settings menu."],
        "video_scenes": [
            ("Press once. Auto-run.", [spr, spr_on]),
            ("Hands-free mining", [hit, hit_on]),
            ("Sort, bag, build, map", [sort, bag, bld, mapk]),
            ("Palworld Automation Deck", [spr_on, hit_on, sort, mapk]),
        ],
        "description": {
            "search_line": "Palworld Stream Deck profile with auto sprint and auto attack toggles, inventory sort, map and build keys.",
            "intro": "An automation deck for Palworld on Stream Deck. One press toggles sprint or mining on and off using real key holds, fixing the auto-run the game never shipped.",
            "tagline": "Auto sprint. Auto hit. Rested hands.",
            "features": [
                ("Auto Sprint", "Toggle-holds Shift+W for true auto-run, with an on-state indicator."),
                ("Auto Hit", "Toggle-holds left click for hands-free mining and logging."),
                ("Sort Inv", "Clicks the inventory sort button at a screen spot you set once."),
                ("Hotbar keys", "Map, bag, build menu and Pal throw."),
                ("Guide page", "Wiki, Pal database, interactive map and patch notes on one-tap keys."),
                ("Safe holds", "Toggles always release when you switch pages, and Palworld has no anti-cheat to trip."),
            ],
            "outro": "Requires the Better Hotkeys and Mouse plugin, which Stream Deck offers to install on import.",
            "keywords": ["Palworld", "Stream Deck profile", "auto sprint", "auto attack", "toggle", "gaming"],
            "collection": COLLECTION,
        },
    }

# ---------------------------------------------------------------- Discord
def discord_cfg():
    A = DISCORD_BLURPLE
    RED = (255, 95, 95)
    mute = key_img("microphone", label="Mute Mic")
    mute_on = key_img("microphone-off", fg=RED, label="Mute Mic")
    deaf = key_img("headphones", label="Deafen")
    deaf_on = key_img("headphones-off", fg=RED, label="Deafen")
    ptt = key_img("microphone", fg=A, label="Push to\nTalk")
    cam = key_img("video", fg=A, dot=GREEN_DOT, label="Camera")
    share = key_img("screen-share", fg=A, dot=GREEN_DOT, label="Screen\nShare")
    mode = key_img("activity", label="Voice\nMode")
    notif = key_img("bell", fg=A, label="Notifs")
    audio = key_img("device-speaker", fg=A, label="Audio\nDevice")
    quick = key_img("search", fg=A, label="Quick\nSwitch")
    return {
        "game": "DISCORD", "name": "Discord",
        "logo_img": str(LOGOS / "discord.png"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "VOICE",
        "hero_title": ["Discord control", "that shows your state."],
        "tagline": "Official Discord integration: mute, deafen, camera, screen share. Keys update live.",
        "bullets": ["Keys reflect real Discord state: muted, deafened, camera on",
                    "Camera and screen share toggles, no window switching",
                    "Zero keybind setup, one-time authorize and done"],
        "hero_keys": [mute_on, deaf, ptt, cam, share, mode, notif, audio, quick],
        "device_photo_mockup": True,
        "bottom": [("microphone-off", "Voice", "Mute and deafen"),
                   ("video", "Camera", "One-key toggle"),
                   ("screen-share", "Share", "Start and stop"),
                   ("bell", "Focus", "Notification key")],
        "feature_banners": [
            ("Keys that know when you're muted.", [mute, mute_on, deaf, deaf_on],
             ["Live", "Muted", "Hearing", "Deafened"], None,
             "Built on the official Discord integration, every key mirrors your real voice state the instant it changes."),
            ("Camera and screen share, one press.", [cam, share],
             ["Toggle camera", "Toggle share"], None,
             "Flip your camera or start screen sharing mid-call without touching Discord's share menu."),
            ("Voice modes and focus.", [ptt, mode, notif, audio],
             ["Hold to talk", "Mic mode", "Notifications", "Swap device"], None,
             "Push to talk, voice-mode switching, a notification key and one-tap audio device swapping."),
            ("No keybinds. No setup sheet.", [mute, cam],
             ["Authorize once", "Then it works"], None,
             "The official integration talks to Discord directly. Click Request Access once and every key just works."),
        ],
        "statement": ["The deck your call deserves.",
                      "Voice, camera and screen share, live on physical keys."],
        "video_scenes": [
            ("Mute shows muted", [mute, mute_on]),
            ("Deafen shows deafened", [deaf, deaf_on]),
            ("Camera and screen share", [cam, share]),
            ("Discord Essentials", [mute, deaf, ptt, cam, share]),
        ],
        "description": {
            "search_line": "Discord Stream Deck profile with live mute, deafen, camera and screen share toggles using the official Discord integration.",
            "intro": "Discord essentials on Stream Deck, built on the official Discord plugin: keys show your live voice state and control mute, deafen, push to talk, camera and screen sharing from inside any game.",
            "tagline": "Mute, deafen, camera, share. Live on your deck.",
            "features": [
                ("Live state", "Mute and deafen keys update the moment your Discord state changes."),
                ("Camera and screen share", "Toggle both mid-call without opening Discord."),
                ("Push to talk", "Hold-to-speak plus a voice activity mode switch."),
                ("Focus tools", "Notification key and one-tap audio device switching."),
                ("Zero setup", "Authorize the official Discord integration once, no keybinds to configure."),
            ],
            "outro": "Requires the free official Discord plugin for Stream Deck, offered automatically on install.",
            "keywords": ["Discord", "Stream Deck profile", "mute", "deafen", "camera", "screen share"],
            "collection": COLLECTION,
        },
    }

# ---------------------------------------------------------------- Streamer U
def su_cfg():
    A = SU_GOLD
    M = SU_MAROON
    mute = key_img("microphone-off", label="Mute Mic")
    deaf = key_img("headphones-off", label="Deafen")
    clip = key_img("scissors", fg=A, bg=M, label="Save Clip")
    rec = key_img("player-record", fg=A, bg=M, label="Record")
    strm = key_img("broadcast", fg=A, bg=M, label="Stream")
    campus = crest_key(bg=M, label="SU Hub")
    grow = key_img("dashboard", fg=A, bg=M, label="Dash\nboards")
    dash = key_img("dashboard", fg=A, bg=M, label="Twitch\nDash")
    ideas = key_img("wand", fg=A, bg=M, label="Title\nIdeas")
    clips24 = key_img("clock", fg=A, bg=M, label="Clips 24h")
    clips7 = key_img("calendar", fg=A, bg=M, label="Clips\n7 Days")
    return {
        "game": "STREAMER U", "name": "Streamer University",
        "logo_img": str(LOGOS / "su-crest-raw.png"), "logo_full_color": True,
        "brand": A, "bg": (16, 6, 9), "icon": "", "icon_sub": "DECK",
        "hero_title": ["Your streaming career,", "freshman year."],
        "tagline": "A collegiate maroon-and-gold deck for aspiring creators. Unofficial fan companion.",
        "bullets": ["The day-one streaming controls: mute, deafen, clip, record, stream",
                    "SU Hub: Campus Live, shop, Kai's channel, top clips 24h and 7 days",
                    "Dashboards: Twitch, YouTube Studio, TikTok Studio, AI title ideas"],
        "hero_keys": [mute, deaf, clip, rec, strm, campus, clips24, clips7, grow, dash, ideas],
        "device_photo_mockup": True,
        "bottom": [("school", "Campus", "SU live hub"),
                   ("player-record", "Go live", "OBS controls"),
                   ("dashboard", "Dashboards", "Creator tools"),
                   ("wand", "AI assist", "Title ideas")],
        "feature_banners": [
            ("Day-one controls, varsity colors.", [mute, deaf, clip, rec, strm],
             ["Mute", "Deafen", "Clip", "Record", "Stream"], None,
             "The same proven OBS and Discord control row as the Streamer Starter Pack, in collegiate maroon and gold."),
            ("The campus, one button away.", [campus, key_img("shopping-cart", fg=A, bg=M, label="SU Shop"), key_img("brand-twitch", fg=A, bg=M, label="Kai Live"), clips24, clips7],
             ["Campus Live", "Merch", "twitch.tv/kaicenat", "Top clips", "Top clips"], None,
             "Campus Live, the shop and Kai's channel, plus the SU category's top Twitch clips from the last 24 hours or 7 days."),
            ("Grow like it's your major.", [dash, key_img("brand-youtube", fg=A, bg=M, label="YT Studio"), key_img("brand-tiktok", fg=A, bg=M, label="TikTok"), ideas],
             ["Twitch", "YouTube", "TikTok", "AI prompt"], None,
             "A Dashboards page with your creator dashboards on tap plus a paste-ready AI prompt that writes ten stream titles for today's show."),
            ("One aesthetic, head to toe.", [campus, grow, ideas],
             ["Maroon + gold", "Original icons", "Premium feel"], None,
             "An original collegiate icon system. No copied logos, no AI-generated art, just a deck that looks like campus."),
        ],
        "statement": ["Show up like you got in.",
                      "For Streamer University students, fans, and everyone who wants their shot."],
        "video_scenes": [
            ("Go live, campus style", [mute, deaf, clip, rec]),
            ("Visit the campus", [campus]),
            ("Grow your channel", [dash, ideas]),
            ("Streamer University", [mute, clip, campus, grow]),
        ],
        "description": {
            "search_line": "Streamer University fan Stream Deck profile for new streamers: OBS and Discord controls, creator dashboards, campus quick links.",
            "intro": "An unofficial fan companion for Streamer University watchers and aspiring creators on Stream Deck. Day-one streaming controls in a collegiate maroon-and-gold icon set, plus the campus and your growth dashboards one tap away.",
            "tagline": "Freshman year for your stream.",
            "features": [
                ("Control row", "Discord mute and deafen plus OBS clip, marker, record and stream."),
                ("SU Hub", "Campus Live, the SU shop, Kai's channel, and the category's top clips from the last 24 hours or 7 days."),
                ("Dashboards page", "Twitch dashboard, YouTube Studio, TikTok Studio and an AI title-ideas prompt."),
                ("Original theme", "Collegiate maroon and gold icon system, no copied artwork."),
            ],
            "outro": "Unofficial fan-made product, not affiliated with or endorsed by Streamer University or Kai Cenat.",
            "keywords": ["Streamer University", "new streamer", "Stream Deck profile", "creator", "Twitch", "starter"],
            "collection": COLLECTION,
        },
    }

# ---------------------------------------------------------------- Screensaver Scheduler (plugin)
def screensaver_cfg():
    A = SS_GREEN
    morning = key_img("sunrise", fg=A, label="Morning")
    midday = key_img("sun", label="Midday")
    evening = key_img("sunset", fg=A, label="Evening")
    night = key_img("moon", label="Night")
    nextk = key_img("player-track-next", fg=A, label="Next")
    cyc = key_img("rotate", label="Cycle")
    cyc_on = key_img("rotate", fg=A, dot=GREEN_DOT, label="Cycling")
    sched = key_img("clock", fg=A, label="Scheduled")
    folder = key_img("folder", label="Your .scr")
    photo = key_img("photo", fg=A, label="Preview")
    shuffle = key_img("arrows-shuffle", label="Shuffle")
    return {
        "game": "SCREENSAVER", "name": "Screensaver Scheduler",
        "logo_img": glyph_logo("device-desktop"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "SCHEDULER",
        "os_support": "Windows",
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "os_glyphs": ["brand-windows"],
        "hero_title_clean": "Screensaver Scheduler",
        "hero_title": ["Your screensavers,", "on a schedule."],
        "tagline": "A day-to-night cycle by the clock, a timed rotation, or the next one on a single press.",
        "bullets": ["A day-to-night cycle: a different screensaver morning, noon and night",
                    "Auto-cycle through your favorites on a timer",
                    "One press jumps to the next and shows it now"],
        "hero_keys": [morning, midday, evening, night, nextk, cyc, cyc_on, sched, folder, photo, shuffle],
        "device_photo_mockup": True,
        "bottom": [("clock", "Scheduled", "By time of day"),
                   ("rotate", "Auto Cycle", "On a timer"),
                   ("player-track-next", "Next", "One press"),
                   ("folder", "Your .scr", "Add your own")],
        "feature_banners": [
            ("A day-to-night screensaver cycle.", [morning, midday, evening, night],
             ["Morning", "Midday", "Evening", "Night"], None,
             "Set a screensaver for each part of the day. When the clock hits your time, it switches. Calm mornings, bold nights."),
            ("Never the same one twice.", [cyc, cyc_on],
             ["Press once", "Cycling"], None,
             "Auto Cycle rotates through the screensavers you pick on a timer you choose, so idle time never looks the same."),
            ("The next one, right now.", [nextk, photo],
             ["Next", "On screen"], None,
             "One press switches to the next screensaver and shows it on screen the moment you press the key."),
            ("Bring your own screensavers.", [folder, photo, shuffle],
             ["Your folder", "Preview", "Shuffle"], None,
             "Drop any screensaver files into a folder and they line up next to the ones built into Windows."),
            ("Set it and forget it.", [sched, cyc_on],
             ["Scheduled", "Cycling"], None,
             "Scheduling and cycling run quietly in the background while Stream Deck is open. Nothing to keep on screen."),
        ],
        "statement": ["Your screensavers, finally on a schedule.",
                      "Windows only lets you pick one. This makes them change on their own."],
        "video_scenes": [
            ("Scheduled by time of day", [morning, night, sched]),
            ("Auto cycle on a timer", [cyc, cyc_on]),
            ("Next one, one press", [nextk, photo]),
            ("Bring your own", [folder, shuffle]),
            ("Screensaver Scheduler", [sched, cyc, nextk]),
        ],
        "description": {
            "search_line": "Screensaver Scheduler Stream Deck plugin: change your Windows screensaver on a day and night schedule, auto cycle through them on a timer, or switch to the next one with a single press.",
            "intro": "Windows lets you set one screensaver and then never changes it. Screensaver Scheduler puts them on a schedule instead: run a day-to-night cycle from morning to night, rotate through your favorites on a timer, or jump to the next one whenever you press a key.",
            "tagline": "Scheduled, cycled, or one press away.",
            "features": [
                ("Day-to-night cycle", "Set a screensaver for each time of day, from a calm morning to a bold night. When the clock hits your time, it switches."),
                ("Auto Cycle", "Rotate through the screensavers you choose every few minutes, so idle time never looks the same twice."),
                ("Next Screensaver", "One press jumps to the next screensaver and shows it on screen right away."),
                ("Bring your own", "Point it at a folder of screensaver files and they appear alongside the ones built into Windows."),
                ("Runs in the background", "Cycling and scheduling keep going no matter which Stream Deck page you are looking at."),
            ],
            "outro": "For Windows. Scheduling and cycling take effect the next time your PC goes idle; the Next key shows a screensaver on the spot.",
            "keywords": ["screensaver", "screensavers", "screensaver scheduler", "auto screensaver", "screensaver cycle", "Stream Deck plugin", "Windows"],
            "collection": PLUGIN_COLLECTION,
        },
    }

# ---------------------------------------------------------------- Better Hotkeys (Lite)
BH_FREE_SDPLUGIN = ROOT.parent / "free" / "better-hotkeys-mouse" / "com.packrat.betterhotkeys.sdPlugin"
BH_PRO_SDPLUGIN = ROOT.parent / "plugins" / "better-hotkeys-pro" / "com.packrat.betterhotkeyspro.sdPlugin"

def betterhotkeys_cfg():
    A = BH_BRASS
    k = lambda *a, **kw: plugin_key(BH_FREE_SDPLUGIN, *a, **kw)
    hold_on, hold_off = k("holdkey", "key_on", "Held"), k("holdkey", "key", "Released")
    tog_on, tog_off = k("togglekey", "key_on", "On"), k("togglekey", "key", "Off")
    cl, cm, cr = (k("clickmouse", "key_left", "Left"), k("clickmouse", "key_middle", "Middle"),
                  k("clickmouse", "key_right", "Right"))
    tm_on, tm_off = k("togglemouse", "key_left_on", "Held"), k("togglemouse", "key_left", "Released")
    return {
        "game": "HOTKEYS", "name": "Better Hotkeys & Mouse",
        "logo_img": glyph_logo("arrow-bar-to-down"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "LITE",
        "os_support": "Windows and macOS",
        # Tier reads as a seal beside the title, not a footer chip: the corner chip was
        # too quiet to signal "this is the lite one" (owner, 2026-07-29). The second
        # facts chip goes back to the house default hardware line.
        "hero_badge": "LITE",
        "hero_badge_color": BH_BADGE_BLUE, "hero_badge_fg": WHITE,
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "os_glyphs": ["brand-windows", "brand-apple"],
        "hero_title_clean": "Better Hotkeys & Mouse",
        "hero_title": ["Hotkeys that", "actually hold."],
        "tagline": "The one thing stock Stream Deck can't do: keep a key down.",
        "bullets": ["Hold Shift + W for real sustained auto-run, not a tap",
                    "Toggle a key down and leave it there while you do something else",
                    "Click and toggle mouse buttons, which stock cannot send at all"],
        # Hero keys unlabeled: the plugin's key art is full-bleed, so a title on top of it
        # renders cramped at cover scale. Labels stay on the feature banners, where
        # banner_features_clean relies on each key carrying its own.
        "hero_keys": [k("holdkey", "key_on"), k("holdkey", "key"), k("togglekey", "key_on"),
                      k("togglekey", "key"), k("clickmouse", "key_left"),
                      k("clickmouse", "key_middle"), k("clickmouse", "key_right"),
                      k("togglemouse", "key_left_on")],
        "device_photo_mockup": True,
        "bottom": [("arrow-bar-to-down", "Hold", "Down while you hold"),
                   ("toggle-right", "Toggle", "Down until you press again"),
                   ("click", "Click", "Left, right or middle"),
                   ("mouse-2", "Mouse toggle", "Hands-free hold")],
        "feature_banners": [
            ("Hold what stock can't.", [hold_on, hold_off],
             ["Held", "Released"], None,
             "Hold Key stays down for exactly as long as you hold the Stream Deck key."),
            ("Press once. Walk away.", [tog_on, tog_off],
             ["On", "Off"], None,
             "Toggle Key latches a key down until you press it again. The key face shows which."),
            ("Send the mouse Stream Deck can't.", [cl, cm, cr, tm_on, tm_off],
             ["Left", "Middle", "Right", "Held", "Released"], None,
             "Click any button, or toggle one down and leave it held."),
        ],
        "statement": ["Hotkeys that actually hold.",
                      "Stock Stream Deck taps. This one keeps the key down until you say otherwise."],
        "video_scenes": [
            ("Hold it down for real", [hold_on, hold_off]),
            ("Toggle it and walk away", [tog_on, tog_off]),
            ("Send the mouse", [cl, cm, cr]),
            ("Better Hotkeys & Mouse", [hold_on, tog_on, cl]),
        ],
        "description": {
            "search_line": "Better Hotkeys & Mouse: hold a key down for sustained input, toggle it and walk away, and click or toggle mouse buttons, on Windows or Mac.",
            "intro": "Better Hotkeys & Mouse adds the one thing Stream Deck's stock Hotkey action can't do: hold a key down. Press and hold for sustained input, or toggle it and leave it held while you do other things. Also sends mouse clicks and toggles mouse buttons, which stock Stream Deck cannot do at all.",
            "tagline": "Hotkeys that actually hold.",
            "features": [
                ("Hold Key", "Hold one or more keys for exactly as long as you hold the deck key. Shift + W is real sustained auto-run."),
                ("Toggle Key", "Press once to hold a key down, press again to release it. The key face shows on or off."),
                ("Click Mouse", "Left, right or middle click, wherever your cursor already is or at a spot you set."),
                ("Toggle Mouse Button", "Press once to hold a mouse button down, press again to let go."),
            ],
            "outro": "Record a key by pressing it, or capture a mouse position by moving the cursor and tapping the deck key. Better Hotkeys & Mouse Pro adds mouse movement, radial select, auto-repeat, drag, scroll and dial support.",
            "keywords": ["Stream Deck hotkey", "hold key", "toggle key", "click mouse", "toggle mouse button", "macOS", "Windows"],
            "collection": PLUGIN_COLLECTION,
        },
    }

# ---------------------------------------------------------------- Better Hotkeys Pro
def betterhotkeys_pro_cfg():
    A = BH_BRASS
    k = lambda *a, **kw: plugin_key(BH_PRO_SDPLUGIN, *a, **kw)
    hold_on, tog_on = k("holdkey", "key_on", "Hold"), k("togglekey", "key_on", "Toggle")
    cl = k("clickmouse", "key_left", "Click")
    mv = k("movemouse", "key", "Move")
    hm = k("holdmouse", "key_right_on", "Hold btn")
    tm = k("togglemouse", "key_left_on", "Toggle btn")
    drag, scr = k("mousedrag", "key", "Drag"), k("scroll", "key", "Scroll")
    rad = k("radialselect", "key", "Radial")
    rep_on, rep_off = k("autorepeat", "key_on", "Repeating"), k("autorepeat", "key", "Off")
    enc = k("encoderhotkey", "key", "Dial")
    mic, mic_on = k("mutemic", "key", "Live"), k("mutemic", "key_on", "Muted")
    ptt, vol = k("pushtotalk", "key_on", "Push to talk"), k("micvolume", "key", "Level")
    return {
        "game": "HOTKEYS PRO", "name": "Better Hotkeys & Mouse Pro",
        "logo_img": glyph_logo("arrow-bar-to-down"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "PRO",
        "os_support": "Windows and macOS",
        # Same seal treatment as the Lite cover, so the pair reads as one family.
        "hero_badge": "PRO",
        "hero_badge_color": BH_BADGE_BLUE, "hero_badge_fg": WHITE,
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "os_glyphs": ["brand-windows", "brand-apple"],
        # Title drops the "Pro" word: the seal beside it already says PRO, and having
        # both read as a stutter on the cover. The listing NAME keeps "Pro" (see "name").
        "hero_title_clean": "Better Hotkeys & Mouse",
        "hero_title": ["Every action.", "One plugin."],
        "tagline": "Held keys, the whole mouse, wheel menus, dials and mic, all in one.",
        "bullets": ["Move, hold, drag and scroll the mouse, which stock cannot send at all",
                    "Pick any in-game wheel slot with a dial that shows where it aims",
                    "Map a Stream Deck + dial, repeat a key on a timer, mute your mic everywhere"],
        # Unlabeled on the cover (see the Lite cfg's note); labels live on the features.
        "hero_keys": [k("holdkey", "key_on"), k("togglekey", "key_on"), k("clickmouse", "key_left"),
                      k("movemouse", "key"), k("holdmouse", "key_right_on"),
                      k("togglemouse", "key_left_on"), k("mousedrag", "key"), k("scroll", "key"),
                      k("radialselect", "key"), k("autorepeat", "key_on"), k("encoderhotkey", "key")],
        "device_photo_mockup": True,
        "bottom": [("arrow-bar-to-down", "Keyboard", "Hold and toggle keys"),
                   ("mouse", "Mouse", "Move, drag and scroll"),
                   ("chart-donut", "Wheel menus", "One key, any wheel"),
                   ("rotate-clockwise", "Dials", "Stream Deck + support")],
        "feature_banners": [
            ("Hold what stock can't.", [hold_on, k("holdkey", "key", "Released"), tog_on, k("togglekey", "key", "Off")],
             ["Held", "Released", "On", "Off"], None,
             "Hold Key stays down while you hold it. Toggle Key latches until you press again."),
            ("The whole mouse, from the deck.", [cl, mv, hm, tm, drag, scr],
             ["Click", "Move", "Hold", "Toggle", "Drag", "Scroll"], None,
             "Click, move to an exact spot, hold, toggle, drag between two points and scroll."),
            # Real per-config faces (radial_face), not the one static shipped PNG shown
            # twice: this banner's whole claim is that the key shows where it will aim.
            ("One key. Any wheel.", [radial_face(0, 45, 200, "12:00"), radial_face(90, 65, 200, "3:00"),
                                     radial_face(180, 90, 200, "6:00"), radial_face(270, 55, 200, "9:00")],
             ["12:00", "3:00", "6:00", "9:00"], None,
             "Pick one slot from any in-game wheel menu. The key face shows exactly where it will aim."),
            ("Turn a dial. Repeat a key.", [enc, k("scroll", "key", "Scroll"), rep_on],
             ["Dial", "Scroll", "Repeating"], None,
             "A Stream Deck + dial sends a hotkey or the scroll wheel, and faster spins travel further."),
            ("Mute everything, from one key.", [mic, mic_on, ptt, vol],
             ["Live", "Muted", "Push to talk", "Level"], None,
             "System-level mute, so Discord, OBS and your game all hear the same thing."),
        ],
        "statement": ["Fourteen actions. One plugin.",
                      "Everything the deck can send: held keys, the whole mouse, wheel menus, dials and your mic."],
        "video_scenes": [
            ("Hold and toggle keys", [hold_on, tog_on]),
            ("The whole mouse", [cl, mv, drag, scr]),
            ("One key, any wheel", [rad, hm, tm]),
            ("Dials and auto-repeat", [enc, rep_on]),
            ("Better Hotkeys & Mouse Pro", [hold_on, rad, enc]),
        ],
        "description": {
            "search_line": "Better Hotkeys Pro: hold keys down, move drag and scroll the mouse, aim a radial wheel menu, map a dial and mute your mic, on Windows or Mac.",
            "intro": "Better Hotkeys & Mouse Pro sends everything a Stream Deck key can't on its own. Hold a key down for sustained input, move drag and scroll the mouse, pick a slot from any in-game wheel menu, map a Stream Deck + dial, and mute your microphone across every app at once.",
            "tagline": "Every action, one plugin.",
            "features": [
                ("Hold & Toggle Key", "Hold keys for as long as you hold the deck key, or toggle them down until you press again."),
                ("Full mouse control", "Click, move to an exact spot, hold, toggle, drag between two points and scroll the wheel."),
                ("Radial Select", "Pick one slot from any wheel menu with a single key."),
                ("Dial Control", "Turn a Stream Deck + dial to send a hotkey or the scroll wheel, and spin faster to travel further."),
                ("Mic control", "Mute system-wide, hold to talk, or set your input level. (Windows for now.)"),
                ("Auto-Repeat & Drag", "Repeat a key or click at a rate you set, and drag between two points."),
            ],
            "outro": "Record a key by pressing it, or capture a mouse position by moving the cursor and tapping the deck key.",
            "keywords": ["better hotkeys pro", "Stream Deck hotkey", "hold key", "radial menu", "wheel menu", "auto repeat", "push to talk", "Stream Deck +", "dial", "macOS"],
            "collection": PLUGIN_COLLECTION,
        },
    }

RELEASE_NOTES = {
    "ai-prompts-lite": """Initial release. Windows and macOS, Stream Deck MK.2 and XL.
- Eight prompts: shorten any text, fix its tone, generate twenty ideas, write a YouTube hook, debug an error, send a cold email, summarise a meeting and break a blocker.
- Each key holds a complete prompt with its placeholders marked, and pastes it wherever your cursor is.
- Works in ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself.
- No plugin and no account needed.""",
    "ai-prompts-creator": """Initial release. Windows and macOS, Stream Deck MK.2 and XL.
- Twelve creator prompts: hook generator, ten ranked titles, script skeleton, SEO description, thumbnail brief, comment replies, Shorts hooks, brand outreach, sponsor read, community post, A/B analysis and repurposing.
- On Stream Deck XL the three universal helpers get their own row.
- Works in ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself.""",
    "ai-prompts-developer": """Initial release. Windows and macOS, Stream Deck MK.2 and XL.
- Thirteen developer prompts: code review, explain, debug consultant, test writer, commit message, PR description, refactor, regex, SQL, error copy, API design, architecture doc and security audit.
- On Stream Deck XL the three universal helpers get their own row.
- Works in Claude, ChatGPT, Gemini, Copilot, Cursor or a model you run yourself.""",
    "ai-prompts-marketing": """Initial release. Windows and macOS, Stream Deck MK.2 and XL.
- Eleven marketing prompts: tweet thread, LinkedIn post, cold email, three ad variants, fifteen subject lines, SEO meta, case study, product copy, newsletter intro, testimonial request and positioning statement.
- On Stream Deck XL the three universal helpers get their own row.
- Works in ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself.""",
    "ai-prompts-freelancer": """Initial release. Windows and macOS, Stream Deck MK.2 and XL.
- Ten freelancer prompts: proposal polish, meeting summary, client update, scope creep reply, invoice line items, contract clause, rate increase, portfolio bio, discovery questions and rejection response.
- On Stream Deck XL the three universal helpers get their own row.
- Works in ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself.""",
    "ai-prompts-coach": """Initial release. Windows and macOS, Stream Deck MK.2 and XL.
- Seven coaching prompts: a multi phase performance session ending in a ninety day plan, a quick diagnostic, goal clarity, a decision frame, a belief audit, a blocker breaker and a weekly review.
- On Stream Deck XL the three universal helpers get their own row.
- Works in ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself.""",
    "ai-prompt-toolkit": """Initial release. Windows and macOS, Stream Deck MK.2 and XL.
- All 56 prompts in one profile, in five folders: creator, developer, marketing, freelancer and coaching.
- Three universal helpers stay on the home page, so nothing is more than two presses away.
- Each key holds a complete prompt with its placeholders marked, and pastes it wherever your cursor is.
- Works in ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself.""",
    "epic-pen": """Initial release. Windows, Stream Deck MK.2, XL, Stream Deck + and Virtual Stream Deck.
- Tools: pen, highlighter, eraser, clear, undo and the cursor key that hands control back to what is underneath.
- Colors: six quick colors on their own keys, plus a last color key.
- Stroke size: thicker and thinner on keys, and on a dial on Stream Deck +.
- Screenshot and toolbar toggle, plus a draw key that turns the ink overlay on and off.
- Every key uses an Epic Pen default shortcut, so there is nothing to configure before you start.""",
    "epic-pen-pro": """Initial release. Windows, Stream Deck MK.2, XL, Stream Deck + and Virtual Stream Deck.
- Shapes: line, arrow, rectangle and ellipse, each on its own key.
- Text: type labels anywhere on screen.
- Boards: whiteboard and blackboard, plus fading ink for marks that clear themselves.
- Tools: pen, highlighter, eraser, clear, undo, cursor, stroke size, screenshot and six quick colors.
- Four pages on MK.2, one flat page on XL and the Virtual Stream Deck, stroke size on a dial on Stream Deck +.
- Shapes, text, boards and fading ink need Epic Pen Pro in the app itself.""",
    # The five neon colorways ship the same 572 files, so one note body serves all
    # of them; only the colour word changes. Filled in below the dict.
    "solidworks": """Initial release. Windows, Stream Deck MK.2 and XL.
- Views: front, back, left, right, top, bottom, isometric and normal to, plus the orientation bar.
- Selection: filter by face, edge or vertex, toggle filters and open the filter toolbar.
- Navigation: zoom to fit, zoom in and out, expand the feature tree and the display pane.
- Tools: shortcut bar, command search, sketch line, rebuild, force regen, repeat and recent documents.
- Every key is a SOLIDWORKS default shortcut, so there is nothing to set up first.""",
    "vectorworks": """Initial release. Windows and macOS, Stream Deck MK.2 and XL.
- Draw: select, pan, zoom, line, rectangle, circle, arc, polyline, polygon and wall, plus undo, redo and save.
- Modify: move, duplicate, group, ungroup, mirror, offset, fillet, split, trim, reorder, rotate and eyedropper.
- 3D and Views: push pull, extrude, add and subtract solids, flyover, walkthrough, top plan, set 3D view and fit to objects.
- Render modes: wireframe, shaded, hidden line and final render, plus the object info palette.
- Every key uses a Vectorworks default shortcut, so there is nothing to configure before you start.""",
    "fortnite": """Setup guide added. Windows, Stream Deck MK.2 and XL.
- The download now includes a setup guide. The Mute, Deafen and capture keys press hotkeys in Discord and OBS, and nothing in the download said so, so those keys could look broken out of the box.
- The guide covers the Discord problem that catches most people out: Fortnite runs as administrator for its anti-cheat, so Discord has to as well or it never hears the key.
- The listing now says up front which keys need Discord and OBS.
- No change to the profiles themselves. Every key was already sending the right keystroke.""",
    "satisfactory": """Initial release. Windows, Stream Deck MK.2 and XL.
- Build: build menu, dismantle, change build mode, lock hologram and the customizer.
- Hotbar: all ten slots on their own keys.
- Explore: map, resource scanner, codex, flashlight, photo mode and interact.
- Guide: the wiki, a production calculator, recipe tools and patch notes.
- Every key matches Satisfactory's default bindings, so there is nothing to set up first.""",
    "world-of-warcraft": """Initial release. Windows and macOS, Stream Deck MK.2 and XL.
- Panels: character, spellbook, talents, achievements, map, bags, mounts, group finder and guild.
- Action Bar: all twelve primary slots, so a hearthstone or mount parked there is one press away.
- Ready Check: pull the whole group's status without touching the keyboard.
- Guide: Wowhead, Raider.IO, Warcraft Logs and the official patch notes.
- A utility layer only. One press sends one key and nothing here automates play.""",
    "elite-dangerous": """Initial release. Windows, Stream Deck MK.2 and XL.
- Ship: landing gear, cargo scoop, hardpoints, lights, silent running and heat sink.
- Flight: frame shift drive, hyperspace, flight assist and boost.
- Panels and Pips: all four UI panels, plus the power distributor laid out like the pips on your HUD.
- Target: target ahead, next ship, highest threat and next subsystem.
- A profile, not a plugin. Nothing installs, nothing runs in the background and nothing reads your game files.""",
    "osrs": """Initial release. Windows and macOS, Stream Deck MK.2 and XL.
- Every interface tab on its own key: inventory, combat, skills, quests, equipment, prayer, spellbook, clan, friends, account, settings, emotes and music.
- Guide: Grand Exchange prices, a DPS calculator, Wise Old Man, TempleOSRS and the hiscores.
- Also on the Guide page: the wiki, a full interactive world map, the quest list, the world switcher and official news.
- Matches the game's default function key layout, so there is nothing to set up first.""",
    "forza": """Initial release. Windows, Stream Deck MK.2 and XL. Works with Forza Horizon 6 and Horizon 5.
- Capture: photo mode and camera change, one press each, mid race.
- Data: the telemetry overlay and rewind on their own keys.
- Radio: skip stations forward and back, plus the horn and Anna.
- Race tools: map, mini leaderboard, Forza LINK, convertible roof and interact.
- Links: tune sheets, the car wiki, the official site and support.""",
    "code-cost": """First release. Windows and macOS.
- Cost: spend for today, the last 7 days or the last 30 days on a single key.
- Press the key to move between periods without opening settings.
- Filter to Claude Code, Codex, or both together.
- Reads the session files already saved on your computer. No account, no key, no network.
- A model with no price on file marks the figure as incomplete rather than guessing a rate.""",
    "code-cost-pro": """First release. Windows and macOS.
- Plan Value: your usage priced at token rates against what your plan costs.
- Cost: three periods with an optional monthly budget bar that turns red when you go over.
- Breakdown: top three by model or by project, press to swap.
- Cache Hit: what share of your prompt came from cache and what it saved.
- Trend: one bar per day, up to 30 days.
- On a Stream Deck +, the dial scrubs between periods.""",
    "nba-tracker": """Initial release. Windows and macOS.
- Team Score: the live score for your team on a key, with a countdown to the next game when none is on.
- Standings: rank, record, games behind and current form. Press to swap conference and division.
- League Scoreboard: every game playing tonight on one key, live games first.
- A green frame flashes when your team scores; an amber bar and a timestamp appear if the feed goes quiet.""",
    "nfl-tracker": """Initial release. Windows and macOS.
- Team Score: the live score for your team on a key, with a countdown to kickoff when none is on.
- Standings: conference seed, record, games behind and current form. Press to swap to the division race.
- League Scoreboard: every game on today's slate from one key, live games first.
- A green frame flashes when your team scores; an amber bar and a timestamp appear if the feed goes quiet.""",
    "nhl-tracker": """Initial release. Windows and macOS.
- Team Score: the live score with period and clock, and a countdown to puck drop when no game is on.
- Standings: conference seed, record, games behind and current form. Press to swap to the division.
- League Scoreboard: every game on the night from one key, live games first.
- A green frame flashes when your team scores; an amber bar and a timestamp appear if the feed goes quiet.""",
    "soccer-tracker": """Initial release. Windows and macOS.
- Team Score: the live score and match minute for your club, with a countdown to kick-off when none is on.
- Nine competitions on one deck, from the Premier League to MLS and Liga MX.
- The table: position, record, points and current form.
- League Scoreboard: pick a competition and cycle every match playing in it.""",
    "ufc-tracker": """Initial release. Windows and macOS.
- Next Event: the next card, its main event, and a countdown once fight night is close.
- Fight Card: every bout on the card, one press at a time, main event first.
- Winners appear on the key as bouts are settled.
- Set the event key to open the card's page instead of refreshing.""",
    "nascar-tracker": """Initial release. Windows and macOS.
- Next Race: the next race with a countdown to green, and the race status on race day.
- Race Field: the running order, one driver per press.
- Driver Standings: the championship table with points, leader first.""",
    "valorant": """Initial release. Three pages:
- Home: Discord mute, deafen and push to talk, OBS save clip, marker, record and stream, vote yes/no (F5/F6), team voice hold (V), tracker.gg and vlr.gg.
- Game page: primary, pistol, knife, spike, Q/E/C abilities, ult, buy, reload, use, drop and inspect, all on Valorant's default keybinds. One press, one action, no macros.
- Crosshairs: four style-named crosshair codes ready to paste into the import box.""",
    "streamer-starter-pack": """Initial release.
- Home page: Discord mute and deafen, OBS record, stream, save replay and marker, voiceover and subtitle hotkeys, one-tap Videos folder.
- Soundboard page: 13 pre-labeled Play Audio slots ready for your own sounds.
- Every keybind documented in the included README, set up once in OBS and Discord.""",
    "davinci-resolve": """Initial release. Three pages:
- Edit: blade, select, markers, play/stop/rewind, in/out, split, ripple delete, undo, zoom fit, on Resolve's default keymap.
- Pro: insert, overwrite, replace, place on top, append (F9-F12 family), transitions, retime, trim, snap, edit-point navigation.
- Colors: generate captions, normalize audio, seven one-tap clip colors plus clear (custom binds, map included).""",
    "palworld": """Initial release.
- Auto Sprint and Auto Hit toggle-holds with on-state indicators (requires the Better Hotkeys and Mouse plugin).
- Sort Inv click-at-spot, plus map, bag, build and Pal throw keys.
- Guide page: wiki, Pal database, interactive map and patch notes.""",
    "discord-essentials": """Initial release, built on the official Discord plugin.
- Live-state mute and deafen keys, push to talk, voice mode switch.
- Camera and screen share toggles, notification key, audio device swap, quick switcher.
- Authorize Discord once on first press, no keybind setup.""",
    "streamer-university": """Initial release. Unofficial fan companion.
- Home: Discord mute and deafen, OBS clip, marker, record and stream in collegiate maroon and gold.
- SU Hub: Campus Live, SU Shop, Kai's channel, plus Top Clips (24h) and Top Clips (7 days).
- Dashboards: Twitch dashboard, YouTube Studio, TikTok Studio and an AI title-ideas prompt.""",
    "better-hotkeys": """- This plugin now focuses on four core actions: Hold Key, Toggle Key, Click Mouse and Toggle Mouse Button.
- Move Mouse, Hold Mouse Button, Radial Select, Auto-Repeat, Mouse Drag, Scroll, Encoder Hotkey and the mic actions have moved to Better Hotkeys & Mouse Pro.
- If you use any of those actions, install Better Hotkeys & Mouse Pro to keep them.""",
    "better-hotkeys-pro": """- Hold Key and Toggle Key: keep one or more keys down, held or latched.
- Full mouse control: click, move, hold, toggle, drag between two points and scroll.
- Radial Select: pick a slot from any in-game wheel menu, aimed on a draggable dial.
- Dial Control for Stream Deck +: turning sends a hotkey or the mouse scroll wheel, and faster spins send extra steps.
- Mic actions now cover both of the microphones Windows treats as default, plus an "All microphones" option for routed setups.
- Auto-Repeat: repeat a key or click at a rate you set, with an optional time limit.
- Mic controls: system-wide mute, push to talk and input level (Windows).""",
    "screensaver-cycler": """First release. Three actions:
- Next Screensaver: one press switches to the next screensaver and shows it right away.
- Auto Cycle: rotate through your screensavers on a timer you set.
- Scheduled: set specific screensavers for specific times of day.
- Add your own screensaver files from any folder, alongside the ones built into Windows.""",
}


# ---------------------------------------------------------------- Sport trackers
# Six plugins off one shared core (plugins/_shared), so their listings come off one cfg
# factory too. The key art is the REAL badge each plugin renders at runtime, rasterized to
# plugins/<slug>/marketing/keys by tools/art/svg_to_png.mjs. Nothing here is a mockup.

ULTIMATE_SD = ROOT.parent / "plugins" / "stream-deck-ultimate" / "com.packrat.stream-deck-ultimate-bundle.sdPlugin"

def ultimate_key(name: str, label=None):
    """A key face from Stream Deck Ultimate's REAL shipped art.

    Ultimate keeps its faces in imgs/keys/<name>.png rather than the
    imgs/actions/<action>/<variant>@2x.png layout plugin_key expects, because the
    plugin repaints every key at runtime from a flat pool rather than per action.
    Same rule as plugin_key and icon_pack_key: show the buyer the file they install.
    """
    path = ULTIMATE_SD / "imgs" / "keys" / f"{name}.png"
    if not path.exists():
        raise FileNotFoundError(f"{path} (Ultimate key art missing)")
    return {"kind": "image", "img": Image.open(path), "label": label, "full_face": True}


def tracker_key(slug: str, name: str, label=None):
    """A key face taken from the plugin's own renderer, rasterized to marketing/keys.

    The trackers (and Clipboard Manager) draw their keys live rather than shipping static
    art, so plugin_key has nothing to read. Regenerate with that plugin's own key script:
        npx tsx plugins/_shared/scripts/marketing-keys.ts <tmp>          # trackers
        npx tsx plugins/clipboard-manager/scripts/marketing-keys.ts <tmp>
        node tools/art/svg_to_png.mjs <tmp> plugins
    """
    path = ROOT.parent / "plugins" / slug / "marketing" / "keys" / f"{name}.png"
    if not path.exists():
        raise FileNotFoundError(f"{path} (run plugins/_shared/scripts/marketing-keys.ts, then tools/art/svg_to_png.mjs)")
    # full_face: the badge fills the key, so the caption goes under the tile, not on it.
    return {"kind": "image", "img": Image.open(path), "label": label, "full_face": True}


def tracker_cfg(slug, name, accent, glyph, icon_sub, spec):
    """Shared listing shape for a sport tracker: same promise, different sport."""
    k = lambda n, label=None: tracker_key(slug, n, label)
    return {
        "game": spec["kicker"], "name": name,
        "logo_img": glyph_logo(glyph),
        "brand": accent, "bg": BG, "icon": "", "icon_sub": icon_sub,
        "os_support": "Windows and macOS",
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "os_glyphs": ["brand-windows", "brand-apple"],
        "hero_title_clean": name,
        "hero_title": spec["hero_title"],
        "tagline": spec["tagline"],
        "bullets": spec["bullets"],
        "hero_keys": [k(n) for n in spec["hero_keys"]],
        "device_photo_mockup": True,
        "bottom": spec["bottom"],
        "feature_banners": [
            (title, [k(n, lbl) for n, lbl in keys], [lbl for _, lbl in keys], None, caption)
            for title, keys, caption in spec["features"]
        ],
        "statement": spec["statement"],
        "video_scenes": [(title, [k(n) for n in keys]) for title, keys in spec["video"]],
        "description": {
            "search_line": spec["search_line"],
            "intro": spec["intro"],
            "tagline": spec["tagline"],
            "features": spec["desc_features"],
            "outro": spec["outro"],
            "keywords": spec["keywords"],
            "collection": PLUGIN_COLLECTION,
        },
    }


NBA_ACCENT = (253, 185, 39)
NFL_ACCENT = (227, 24, 55)
NHL_ACCENT = (108, 171, 221)
SOCCER_ACCENT = (43, 232, 106)
UFC_ACCENT = (215, 48, 62)
NASCAR_ACCENT = (228, 161, 27)


# ---------------------------------------------------------------- Clipboard Manager
def clipboard_cfg():
    A = tokens.ACCENT
    k = lambda n, label=None: tracker_key("clipboard-manager", n, label)
    # No spec labels. Each face already renders its own "SLOT n" and the text it is
    # holding, so a caption underneath would only repeat the art. Same call Calendar makes.
    s1, s2, s3, s4 = k("slot1"), k("slot2"), k("slot3"), k("slot4")
    long_, restore, empty, pick = k("long"), k("restore"), k("empty"), k("pick")
    return {
        "game": "CLIPBOARD", "name": "Clipboard Manager",
        "logo_img": glyph_logo("clipboard-copy"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "",
        "os_support": "Windows and macOS",
        "os_glyphs": ["brand-windows", "brand-apple"],
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "hero_title_clean": "Clipboard Manager",
        "hero_title": ["Your last four", "copies, on keys."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "The last four things you copied, sitting on four keys, ready to paste.",
        "bullets": ["Your last four copies, one on each key, newest first",
                    "Read what is in a slot before you press it",
                    "Still there after a restart, so yesterday's copy is too"],
        # Exactly four, because the product has exactly four slots. Padding the deck out
        # with a fifth would be inventing a key nobody can actually place.
        "hero_keys": [s1, s2, s3, s4],
        "device_photo_mockup": True,
        "bottom": [("clipboard-text", "Four slots", "Your last four copies"),
                   ("eye", "See it first", "Preview on the key"),
                   ("clipboard-copy", "One press", "Pastes it straight in"),
                   ("history", "Survives a restart", "Still there tomorrow")],
        "feature_banners": [
            ("Your last four copies, on four keys.",
             [s1, s2, s3, s4], None, None,
             "Slot 1 is whatever you copied most recently, and the row shifts along as you copy. No more copying something twice because the first one is already gone."),
            ("Read it before you paste it.",
             [long_, s2, s3], None, None,
             "Each key shows a shortened preview of the text it is holding, so you can tell two similar copies apart at a glance. The press always gives you the whole thing, however long it was."),
            # The one banner that repeats a key on purpose. Comparing the two press modes
            # only works if the text is held constant, so the labels carry the difference.
            ("Paste it, or just put it back.",
             [k("slot2", "Pastes it in"), k("restore", "Puts it back")],
             ["Pastes it in", "Puts it back"], None,
             "A press drops the text straight into whatever you are working in. Set a key to put it back on the clipboard instead when the window you want is not the one in front."),
            ("Calm when there is nothing in it yet.",
             [pick, empty], None, None,
             "A key with no slot chosen, or a slot you have not copied that far back yet, says so plainly. Copied images and files are skipped, so a screenshot never takes one of the four."),
        ],
        "statement": ["Your last four copies, on four keys.",
                      "Copy, copy, copy, copy. They are all still there, and one press pastes any of them."],
        "video_scenes": [
            ("Your last four copies", [s1, s2, s3, s4]),
            ("Read it before you paste it", [long_, s2]),
            ("Or just put it back", [s2, restore]),
            ("Clipboard Manager", [s1, s2, s3]),
        ],
        "description": {
            "search_line": "Clipboard Manager for Stream Deck: your last four copies sit on four keys, each showing a preview of the text it holds, and a press pastes it straight in.",
            "intro": "Copying something new loses whatever you copied before it, so you go back and copy it again. Clipboard Manager keeps the last four and puts one on each key, newest first. Glance down to see what is in a slot, press it to paste it.",
            "tagline": "Your last four copies, on four keys.",
            "features": [
                ("Four slots", "Each key holds one of your last four copies. Slot 1 is the most recent, and the row shifts along as you copy."),
                ("Preview on the key", "A shortened preview of the text so you can tell two similar copies apart. The press still pastes the whole thing."),
                ("Paste or restore", "A press pastes into whatever you are working in, or just puts the text back on the clipboard for you to paste yourself."),
                ("Survives a restart", "Your slots are still there after a reboot, so something you copied yesterday is still one press away."),
                ("Text only, on purpose", "Copied images and files are skipped rather than taking up a slot you wanted for text."),
            ],
            "outro": "For Windows and macOS, on every Stream Deck model. Building the four slots means reading what you copy, and what you copy stays on your own computer.",
            "keywords": ["clipboard", "clipboard manager", "clipboard history", "copy paste", "paste", "Stream Deck plugin"],
            "collection": PLUGIN_COLLECTION,
        },
    }


def clipboard_pro_cfg():
    A = tokens.ACCENT
    sdplugin = ROOT.parent / "plugins" / "clipboard-manager-pro" / "com.packrat.clipboardpro.sdPlugin"
    k = lambda action, label=None: plugin_key(sdplugin, action, label=label)
    search = k("picker", "Search history")
    recent = k("slot", "50 recent")
    pinned = k("slot", "Pinned")
    plain = k("slot", "Plain text")
    named = k("slot", "Named key")
    return {
        "game": "CLIPBOARD PRO", "name": "Clipboard Manager Pro",
        "logo_img": glyph_logo("clipboard-copy"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "PRO",
        "os_support": "Windows and macOS",
        "os_glyphs": ["brand-windows", "brand-apple"],
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "hero_title_clean": "Clipboard Manager Pro",
        "hero_title": ["Search every copy.", "Paste from one key."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "Your last 50 copies, searchable, pinned, and ready on your keys.",
        "bullets": ["Search the full rolling history instead of losing an older copy",
                    "Pin the entries that must stay while everything else keeps moving",
                    "Name important keys and paste without rich formatting"],
        "hero_keys": [search, recent, pinned, plain, named],
        "device_photo_mockup": True,
        "bottom": [("search", "Search 50 copies", "Find an older item"),
                   ("pin", "Keep what matters", "Pins never rotate out"),
                   ("letter-case", "Paste clean text", "Remove rich formatting"),
                   ("tag", "Name each key", "Know it at a glance")],
        "feature_banners": [
            ("Search the copy you thought was gone.",
             [search, recent], ["Search history", "50 recent"], None,
             "Type a few words in the picker, choose the match, then press the key to paste it. Hold the key to step through every match."),
            ("Fifty recent copies, still there tomorrow.",
             [recent, search, named], ["50 recent", "Search", "Named key"], None,
             "The rolling history keeps more than one row can show and survives a restart, so yesterday's useful copy stays within reach."),
            ("Pin what must not rotate out.",
             [pinned, recent], ["Pinned", "Still rolling"], None,
             "Hold a recent-entry key to pin it. Hold a pinned-entry key to unpin it and return it to the rolling history."),
            ("Clean text, not someone else's styling.",
             [plain, recent], ["Plain text", "Standard paste"], None,
             "Plain-text mode removes rich formatting while preserving every character. Long values are shortened only on the key, never in the paste."),
            ("Give the important keys real names.",
             [named, pinned, search], ["Work email", "Pinned", "Search"], None,
             "Name a configured key for the job it does while the full clipboard value stays underneath, ready to paste."),
        ],
        "statement": ["Search 50 recent copies from one key.",
                      "Pin the keepers, name the important ones, and paste clean text when formatting gets in the way."],
        "video_scenes": [
            ("Search every copy", [search, recent]),
            ("Pin what must stay", [pinned, recent]),
            ("Paste clean text", [plain, named]),
            ("Clipboard Manager Pro", [search, pinned, recent]),
        ],
        "description": {
            "search_line": "Clipboard Manager Pro for Stream Deck: search your last 50 copies, pin entries that must stay, name important keys, and paste clean plain text in one press.",
            "intro": "The copy you need is usually five copies back. Clipboard Manager Pro keeps a deeper rolling history and gives it a real picker: type a few words, choose the result, then paste it from the key without leaving the job in front of you.",
            "tagline": "Search every copy. Paste from one key.",
            "features": [
                ("Searchable 50-entry history", "Filter the full rolling history in the Property Inspector, select a result, then press the key to paste it."),
                ("Picker key", "Press to paste the selected match. Hold for 0.6 seconds to step through matches on the deck."),
                ("Pinned entries", "Hold a recent entry to pin it so rotation cannot remove it. Hold a pinned entry to unpin it."),
                ("Plain-text paste", "Always rewrite the selected copy as text before pasting, removing rich formatting without truncating the value."),
                ("Custom key names", "Name a slot for its purpose while the full clipboard value remains underneath."),
                ("Safe history", "Empty, duplicate, long, image, and file clipboard content is handled without filling the deck with junk."),
            ],
            "outro": "For Windows and macOS, on every Stream Deck model. Clipboard history stays in this plugin's settings on your own machine.",
            "keywords": ["clipboard", "clipboard manager", "clipboard history", "search clipboard", "plain text paste", "Stream Deck plugin"],
            "collection": PLUGIN_COLLECTION,
        },
    }


def nba_cfg():
    return tracker_cfg("nba-tracker", "NBA Tracker", NBA_ACCENT, "ball-basketball", "TRACKER", {
        "kicker": "NBA",
        "hero_title": ["Live NBA scores,", "on your deck."],
        "tagline": "The score, the countdown to tip-off, and where your team stands, without leaving the game.",
        "bullets": ["Live score on a key, refreshing while the game runs",
                    "A countdown to tip-off when there is no game on",
                    "Every game playing tonight on a single key"],
        "hero_keys": ["score", "next", "standings", "board", "flash", "stale"],
        "bottom": [("ball-basketball", "Live score", "On the key"),
                   ("clock", "Countdown", "To tip-off"),
                   ("list-numbers", "Standings", "Rank and form"),
                   ("layout-grid", "Every game", "One key")],
        "features": [
            ("The score, while you play.", [("score", "Live"), ("flash", "They scored")],
             "One key, one team. Both sides, both scores, and the quarter and clock, refreshing about every 45 seconds. A green frame flashes the moment your team scores."),
            ("A countdown to tip-off.", [("next", "Next game")],
             "No game on? The same key shows who is next, home or away, and counts down once it is close. No more checking the schedule."),
            ("Where your team stands.", [("standings", "Standings")],
             "Rank, record, games behind and the current run of form. Press the key to swap between the conference table and the division."),
            ("Every game, one key.", [("board", "League board")],
             "The whole night on a single key: games in progress first, then what is coming, then the finals. Press for the next one."),
            ("Honest when the feed goes quiet.", [("stale", "Last known")],
             "If the score cannot be refreshed the key keeps the last one it got, draws an amber bar and prints how old it is. A stale number never passes for a live one."),
        ],
        "statement": ["Live NBA scores, without alt-tabbing.",
                      "Pick your team once. The key does the rest, all season."],
        "video": [("Live score on a key", ["score", "flash"]),
                  ("Countdown to tip-off", ["next"]),
                  ("Standings at a glance", ["standings"]),
                  ("Every game tonight", ["board"]),
                  ("NBA Tracker", ["score", "next", "standings"])],
        "search_line": "NBA Tracker Stream Deck plugin: live NBA scores on your keys, a countdown to the next tip-off, conference and division standings, and every game playing tonight on one key.",
        "intro": "Checking the score means alt-tabbing out of a game or a stream. NBA Tracker puts it on a key instead: pick your team and it shows the live score while the game runs, and counts down to the next one when it does not.",
        "desc_features": [
            ("Live score", "Both scores, the quarter and the clock, refreshing on their own about every 45 seconds."),
            ("Score alerts", "A green frame flashes the moment your team scores or the game tips off."),
            ("Next game countdown", "With no game on, the key shows the next opponent and counts down once it is close."),
            ("Standings", "Rank, record, games behind and current form. Press to swap conference and division."),
            ("Every game tonight", "One key cycles the whole league, live games first."),
            ("Works offline", "If the feed goes quiet the key keeps the last score, marked with its age."),
        ],
        "outro": "For Windows and macOS, on every Stream Deck model. Not affiliated with or endorsed by the NBA or any team.",
        "keywords": ["nba tracker", "nba scores", "nba live scores", "basketball scores", "nba standings", "Stream Deck plugin"],
    })


def nfl_cfg():
    return tracker_cfg("nfl-tracker", "NFL Tracker", NFL_ACCENT, "ball-american-football", "TRACKER", {
        "kicker": "NFL",
        "hero_title": ["Live NFL scores,", "on your deck."],
        "tagline": "The score, the countdown to kickoff, and where your team stands, without leaving the game.",
        "bullets": ["Live score on a key, refreshing while the game runs",
                    "A countdown to kickoff when there is no game on",
                    "Every game on the slate from a single key"],
        "hero_keys": ["score", "next", "standings", "board", "flash", "stale"],
        "bottom": [("ball-american-football", "Live score", "On the key"),
                   ("clock", "Countdown", "To kickoff"),
                   ("list-numbers", "Standings", "Rank and form"),
                   ("layout-grid", "Every game", "One key")],
        "features": [
            ("The score, while you play.", [("score", "Live"), ("flash", "They scored")],
             "One key, one team. Both sides, both scores, and the quarter and clock. A green frame flashes the moment your team scores."),
            ("A countdown to kickoff.", [("next", "Next game")],
             "Sunday is a week away and you still want to know. The key shows the next opponent and the date, then counts down once it is close."),
            ("Where your team stands.", [("standings", "Standings")],
             "Conference seed, record, games behind and current form. Press the key to swap to the division race."),
            ("The whole slate, one key.", [("board", "League board")],
             "Every game on today's slate, live ones first. Press for the next game. Nothing to configure."),
            ("Honest when the feed goes quiet.", [("stale", "Last known")],
             "If the score cannot be refreshed the key keeps the last one it got, draws an amber bar and prints how old it is."),
        ],
        "statement": ["Live NFL scores, without alt-tabbing.",
                      "Pick your team once. The key does the rest, all season."],
        "video": [("Live score on a key", ["score", "flash"]),
                  ("Countdown to kickoff", ["next"]),
                  ("Standings at a glance", ["standings"]),
                  ("The whole slate", ["board"]),
                  ("NFL Tracker", ["score", "next", "standings"])],
        "search_line": "NFL Tracker Stream Deck plugin: live NFL scores on your keys, a countdown to the next kickoff, conference and division standings, and every game on the slate from one key.",
        "intro": "Sunday means one game on the screen and seven more you care about. NFL Tracker puts them on your keys: your team for the live score and countdown, and a second key to cycle the whole slate.",
        "desc_features": [
            ("Live score", "Both scores, the quarter and the clock, refreshing on their own while the game is on."),
            ("Score alerts", "A green frame flashes the moment your team scores or the game kicks off."),
            ("Kickoff countdown", "With no game on, the key shows the next opponent and counts down once it is close."),
            ("Standings", "Conference seed, record, games behind and form. Press to swap to the division race."),
            ("The whole slate", "One key cycles every game playing today, live ones first."),
            ("Works offline", "If the feed goes quiet the key keeps the last score, marked with its age."),
        ],
        "outro": "For Windows and macOS, on every Stream Deck model. Not affiliated with or endorsed by the NFL or any team.",
        "keywords": ["nfl tracker", "nfl scores", "nfl scoreboard", "live nfl scores", "nfl standings", "Stream Deck plugin"],
    })


def nhl_cfg():
    return tracker_cfg("nhl-tracker", "NHL Tracker", NHL_ACCENT, "trophy", "TRACKER", {
        "kicker": "NHL",
        "hero_title": ["Live NHL scores,", "on your deck."],
        "tagline": "The score, the countdown to puck drop, and where your team sits, without leaving the game.",
        "bullets": ["Live score on a key, period and clock included",
                    "A countdown to puck drop when there is no game on",
                    "Every game on the night from a single key"],
        "hero_keys": ["score", "next", "standings", "board", "flash", "stale"],
        "bottom": [("trophy", "Live score", "On the key"),
                   ("clock", "Countdown", "To puck drop"),
                   ("list-numbers", "Standings", "Rank and form"),
                   ("layout-grid", "Every game", "One key")],
        "features": [
            ("The score, while you play.", [("score", "Live"), ("flash", "They scored")],
             "One key, one team. Both sides, both scores, the period and the clock. A green frame flashes the moment your team scores."),
            ("A countdown to puck drop.", [("next", "Next game")],
             "No game on? The key shows who is next, home or away, and counts down once it is close."),
            ("Where your team sits.", [("standings", "Standings")],
             "Conference seed, record, games behind and the current run of form. Press the key to swap to the division."),
            ("Every game on the night.", [("board", "League board")],
             "A twelve game night on one key, live ones first. Press for the next game."),
            ("Honest when the feed goes quiet.", [("stale", "Last known")],
             "If the score cannot be refreshed the key keeps the last one it got, draws an amber bar and prints how old it is."),
        ],
        "statement": ["Live NHL scores, without alt-tabbing.",
                      "Pick your team once. The key does the rest, all season."],
        "video": [("Live score on a key", ["score", "flash"]),
                  ("Countdown to puck drop", ["next"]),
                  ("Standings at a glance", ["standings"]),
                  ("Every game tonight", ["board"]),
                  ("NHL Tracker", ["score", "next", "standings"])],
        "search_line": "NHL Tracker Stream Deck plugin: live NHL scores on your keys with period and clock, a countdown to the next puck drop, conference and division standings, and every game on the night from one key.",
        "intro": "A twelve game night and you can watch one of them. NHL Tracker puts the rest on your keys: your team for the live score, period and clock, and a second key to cycle every game on.",
        "desc_features": [
            ("Live score", "Both scores, the period and the clock, refreshing on their own while the game is on."),
            ("Score alerts", "A green frame flashes the moment your team scores or the game starts."),
            ("Puck drop countdown", "With no game on, the key shows the next opponent and counts down once it is close."),
            ("Standings", "Conference seed, record, games behind and form. Press to swap to the division."),
            ("Every game tonight", "One key cycles the whole night, live games first."),
            ("Works offline", "If the feed goes quiet the key keeps the last score, marked with its age."),
        ],
        "outro": "For Windows and macOS, on every Stream Deck model. Not affiliated with or endorsed by the NHL or any team.",
        "keywords": ["nhl tracker", "nhl scores", "hockey scores", "live nhl scores", "nhl standings", "Stream Deck plugin"],
    })


def soccer_cfg():
    return tracker_cfg("soccer-tracker", "Soccer Tracker", SOCCER_ACCENT, "ball-football", "TRACKER", {
        "kicker": "SOCCER",
        "hero_title": ["Live soccer scores,", "on your deck."],
        "tagline": "Nine competitions, your clubs, the table and the countdown to kick-off on your keys.",
        "bullets": ["Follow clubs from nine competitions at once",
                    "Live score with the match minute, and a countdown to kick-off",
                    "The table with points, form and position"],
        "hero_keys": ["score", "next", "standings", "board", "flash", "stale"],
        "bottom": [("ball-football", "Live score", "On the key"),
                   ("clock", "Countdown", "To kick-off"),
                   ("list-numbers", "The table", "Points and form"),
                   ("layout-grid", "Every match", "One key")],
        "features": [
            ("The score, while you play.", [("score", "Live"), ("flash", "They scored")],
             "One key, one club. Both sides, both scores and the match minute. A green frame flashes the moment your club scores."),
            ("Nine competitions, one deck.", [("next", "Next match")],
             "Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Champions League, Europa League, MLS and Liga MX. Follow a club from each, on its own key."),
            ("The table, on a key.", [("standings", "The table")],
             "Position, record, points and the current run of form for whichever competition your club plays in."),
            ("Every match today.", [("board", "Match board")],
             "Pick a competition and one key cycles everything playing in it, live matches first."),
            ("Honest when the feed goes quiet.", [("stale", "Last known")],
             "If the score cannot be refreshed the key keeps the last one it got, draws an amber bar and prints how old it is."),
        ],
        "statement": ["Live soccer scores, without alt-tabbing.",
                      "Your clubs, across nine competitions, on the keys in front of you."],
        "video": [("Live score on a key", ["score", "flash"]),
                  ("Countdown to kick-off", ["next"]),
                  ("The table at a glance", ["standings"]),
                  ("Every match today", ["board"]),
                  ("Soccer Tracker", ["score", "next", "standings"])],
        "search_line": "Soccer Tracker Stream Deck plugin: live soccer scores on your keys across nine competitions, with the league table and a countdown to kick-off.",
        "intro": "Following a club means following a competition, and most people follow more than one. Soccer Tracker puts them on your keys: pick a club from any of nine competitions and the key shows the live score and match minute, then counts down to the next kick-off when there is nothing on.",
        "desc_features": [
            ("Live score", "Both scores and the match minute, refreshing on their own while the match is on."),
            ("Nine competitions", "The five big European leagues, both continental cups, MLS and Liga MX, on one deck."),
            ("Kick-off countdown", "With no match on, the key shows the next opponent and counts down once it is close."),
            ("The table", "Position, record, points and current form for your club's competition."),
            ("Every match today", "Pick a competition and one key cycles everything playing in it."),
            ("Works offline", "If the feed goes quiet the key keeps the last score, marked with its age."),
        ],
        "outro": "For Windows and macOS, on every Stream Deck model. Not affiliated with or endorsed by any league, competition or club.",
        "keywords": ["soccer tracker", "soccer scores", "football scores", "premier league scores", "live soccer scores", "Stream Deck plugin"],
    })


def ufc_cfg():
    return tracker_cfg("ufc-tracker", "UFC Tracker", UFC_ACCENT, "karate", "TRACKER", {
        "kicker": "UFC",
        "hero_title": ["Fight night,", "on your deck."],
        "tagline": "The next card, the main event, and every bout as the night goes on.",
        "bullets": ["The next card and its main event, with a countdown",
                    "Every bout on the card, one key press at a time",
                    "Winners appear as the night is decided"],
        "hero_keys": ["event", "card", "result"],
        "bottom": [("karate", "Next card", "Main event"),
                   ("clock", "Countdown", "To first bell"),
                   ("list-numbers", "Full card", "Bout by bout"),
                   ("trophy", "Results", "As they land")],
        "features": [
            ("The next card, always there.", [("event", "Next event"), ("live", "In progress")],
             "The main event and a countdown once fight night is close. When the card is running, the key shows how far along the night is."),
            ("The whole card, one key.", [("card", "Bout")],
             "Every bout, one at a time, main event first. Press for the next one. Nothing to configure."),
            ("Winners as they land.", [("result", "Decided")],
             "Once a bout is settled the key shows who won, so you can catch up on the prelims without opening anything."),
        ],
        "statement": ["Fight night, without alt-tabbing.",
                      "The card, the countdown and the results, on the keys in front of you."],
        "video": [("The next card", ["event"]),
                  ("Countdown to first bell", ["event"]),
                  ("Bout by bout", ["card"]),
                  ("Winners as they land", ["result"]),
                  ("UFC Tracker", ["event", "card", "result"])],
        "search_line": "UFC Tracker Stream Deck plugin: the next UFC card on your keys, a countdown to the first bell, every bout on the card one press at a time, and the winner as each bout is settled.",
        "intro": "Fight night runs for hours and the bout you care about is somewhere in the middle. UFC Tracker puts the card on your keys: the next event and its main event with a countdown, and a second key that walks the whole card bout by bout.",
        "desc_features": [
            ("Next event", "The next card, its main event and a countdown once it is close. While the card is running it shows how far along the night is."),
            ("Full fight card", "Every bout on the card, one at a time, main event first. Press for the next bout."),
            ("Results as they land", "Once a bout is decided the key shows who won."),
            ("Open the card", "Set the event key to open the card's page instead of refreshing."),
            ("Works offline", "If the feed goes quiet the key keeps the last card it had, marked with an amber bar."),
        ],
        "outro": "For Windows and macOS, on every Stream Deck model. Fighter names identify the bouts on the card; no photos or promotion marks are shown. Not affiliated with or endorsed by UFC, any promotion or any fighter.",
        "keywords": ["ufc tracker", "ufc fight card", "mma scores", "fight night", "ufc results", "Stream Deck plugin"],
    })


def nascar_cfg():
    return tracker_cfg("nascar-tracker", "NASCAR Tracker", NASCAR_ACCENT, "steering-wheel", "TRACKER", {
        "kicker": "NASCAR",
        "hero_title": ["Race day,", "on your deck."],
        "tagline": "The next race, the running order, and the championship table on your keys.",
        "bullets": ["The next race with a countdown to green",
                    "The running order, one driver per press",
                    "The championship table with points"],
        "hero_keys": ["event", "field", "standings"],
        "bottom": [("steering-wheel", "Next race", "With countdown"),
                   ("flag", "Running order", "Driver by driver"),
                   ("list-numbers", "Championship", "Points table"),
                   ("clock", "Race day", "Status live")],
        "features": [
            ("The next race, always there.", [("event", "Next race"), ("live", "Race day")],
             "The race and a countdown once it is close. On race day the key shows the race status instead."),
            ("The running order, one key.", [("field", "Running order")],
             "Every driver in order, one press at a time. Before the green flag there is no field yet, and the key says so rather than showing nothing."),
            ("The championship table.", [("standings", "Points")],
             "The season standings with championship points, leader first. Press the key to walk down the order."),
        ],
        "statement": ["Race day, without alt-tabbing.",
                      "The next race, the running order and the title fight, on the keys in front of you."],
        "video": [("The next race", ["event"]),
                  ("Countdown to green", ["event"]),
                  ("The running order", ["field"]),
                  ("Championship points", ["standings"]),
                  ("NASCAR Tracker", ["event", "field", "standings"])],
        "search_line": "NASCAR Tracker Stream Deck plugin: the next race on your keys with a countdown, the running order one driver at a time, and the championship points table.",
        "intro": "A race runs for three hours and the interesting part is who is where. NASCAR Tracker puts race day on your keys: the next race with a countdown to green, the running order driver by driver, and the championship table.",
        "desc_features": [
            ("Next race", "The next race and a countdown once it is close. On race day the key shows the race status instead."),
            ("Running order", "Every driver in order, one press at a time."),
            ("Driver standings", "The championship table with points, leader first. Press to walk down the order."),
            ("Honest before green", "Before the green flag there is no field to show, and the key says so rather than showing nothing."),
            ("Works offline", "If the feed goes quiet the key keeps the last data it had, marked with an amber bar."),
        ],
        "outro": "For Windows and macOS, on every Stream Deck model. Driver names identify the field; no photos, liveries or team marks are shown. Not affiliated with or endorsed by NASCAR, any team or any driver.",
        "keywords": ["nascar tracker", "nascar standings", "race results", "cup series", "nascar schedule", "Stream Deck plugin"],
    })

def render_comparison(folder: str, cfg: dict):
    """Emit both hero directions side by side so we can pick one, without a full rebuild:
      marketing_compare/A_multidevice/  -> three decks on the hero + compatibility banner
      marketing_compare/B_single/       -> single MK.2 hero + a three-deck breakdown banner
    """
    me.BRAND = cfg["brand"]; me.BG = cfg["bg"]
    base = ROOT / folder / "marketing_compare"
    A = base / "A_multidevice"; B = base / "B_single"
    A.mkdir(parents=True, exist_ok=True); B.mkdir(parents=True, exist_ok=True)

    cfg_a = dict(cfg); cfg_a["hero_layout"] = "multi_device"
    me.banner_hero(cfg_a).convert("RGB").save(A / "1-hero.png")
    me.banner_compatibility(cfg_a).convert("RGB").save(A / "2-compatibility.png")

    cfg_b = dict(cfg); cfg_b["hero_layout"] = "single"
    me.banner_hero(cfg_b).convert("RGB").save(B / "1-hero.png")
    me.banner_compatibility(cfg_b).convert("RGB").save(B / "2-models.png")
    print("comparison ->", base)


# ------------------------------------------------- 2026-07-31 validated batch
# Accents mirror each profile's own key palette in build_all.py so the listing
# keys are literally the product's keys.
VW_TEAL = (0, 178, 169)
FN_BLUE = (80, 155, 255)
SF_ORANGE = (250, 149, 73)
WOW_GOLD = (255, 200, 90)
ED_ORANGE = (255, 122, 0)
OSRS_GOLD = (232, 185, 90)
FORZA_MAGENTA = (225, 60, 140)

def vectorworks_cfg():
    """Positioning (profiles/vectorworks/README.md): lead on CURATION, never on
    breadth. SideshowFX sells 550-1621 command libraries; this sells the set a
    working drafter can actually navigate. Never claim coverage."""
    A = VW_TEAL
    sel = key_img("pointer", fg=A, label="Select")
    pan = key_img("hand-grab", label="Pan")
    zoom = key_img("zoom-in", label="Zoom")
    line = key_img("slash", fg=A, label="Line")
    rect = key_img("square", fg=A, label="Rect")
    circ = key_img("circle", fg=A, label="Circle")
    arc = key_img("circle-half", fg=A, label="Arc")
    poly = key_img("vector", fg=A, label="Polyline")
    wall = key_img("wall", fg=A, label="Wall")
    undo = key_img("arrow-back", label="Undo")
    save = key_img("device-floppy", label="Save")
    move = key_img("arrows-move", fg=A, label="Move")
    grp = key_img("layers-union", fg=A, label="Group")
    mirror = key_img("flip-horizontal", fg=A, label="Mirror")
    push = key_img("cube-plus", fg=A, label="Push Pull")
    ext = key_img("cube", fg=A, label="Extrude")
    fly = key_img("3d-rotate", fg=A, label="Flyover")
    render = key_img("sparkles", fg=A, label="Render")
    fit = key_img("zoom-scan", fg=A, label="Fit")
    return {
        "game": "VECTORWORKS", "name": "Vectorworks",
        "brand": A, "bg": BG, "icon": "", "icon_sub": "CAD",
        "hero_title": ["The Vectorworks tools", "you reach for most."],
        "tagline": "Three pages: draw, modify, 3D and views. Every key a Vectorworks default.",
        "bullets": ["Runs on Vectorworks' own default shortcuts, zero setup",
                    "Draw, modify and 3D on labeled keys you can find",
                    "Windows and Mac, MK.2 and XL, one download"],
        "hero_keys": [sel, pan, zoom, line, rect, circ, arc, poly, wall,
                      undo, save, move, grp, push],
        "device_photo_mockup": True,
        "bottom": [("pointer", "Draw", "Tools on one page"),
                   ("arrows-move", "Modify", "Move and mirror"),
                   ("cube", "3D", "Push pull, extrude"),
                   ("bolt", "Setup", "None needed")],
        "feature_banners": [
            ("Your drawing tools, labeled.", [sel, line, rect, circ, arc],
             ["Select", "Line", "Rect", "Circle", "Arc"], None,
             "The basic palette on real keys, so you stop hunting the tool bar."),
            ("Modify without the menu dive.", [move, grp, mirror, key_img("cut", fg=A, label="Split"), key_img("scissors", fg=A, label="Trim")],
             ["Move", "Group", "Mirror", "Split", "Trim"], None,
             "Move, duplicate, group, mirror, offset, trim and reorder, all one tap."),
            ("Model and look around.", [push, ext, fly, key_img("walk", fg=A, label="Walk"), fit],
             ["Push Pull", "Extrude", "Flyover", "Walk", "Fit"], None,
             "Push pull, extrude, solids, flyover, walkthrough and the standard views."),
            ("Render modes on tap.", [key_img("grid-3x3", fg=A, label="Wireframe"), key_img("circle-half-2", fg=A, label="Shaded"), key_img("line-dashed", fg=A, label="Hidden"), render, key_img("info-circle", fg=A, label="Obj Info")],
             ["Wireframe", "Shaded", "Hidden Line", "Render", "Obj Info"], None,
             "Switch how the model draws without leaving the keyboard."),
            ("Import and draw.", [sel, line, rect, undo, save, fit],
             ["Select", "Line", "Rect", "Undo", "Save", "Fit"], None,
             "Every key is a Vectorworks default. Nothing to configure first."),
        ],
        "statement": ["The commands you actually use.",
                      "A set you can navigate at a glance, not a library of a thousand buttons you will never find."],
        "video_scenes": [
            ("Draw tools on real keys", [sel, line, rect, circ]),
            ("Modify without the menu", [move, grp, mirror]),
            ("Model in 3D", [push, ext, fly]),
            ("Render and inspect", [render, fit]),
            ("Vectorworks", [sel, line, rect, push, save]),
        ],
        "description": {
            "search_line": "Vectorworks Stream Deck profile: drawing tools, modify commands, 3D modeling, standard views and render modes on real keys.",
            "intro": "The Vectorworks commands you actually reach for, on labeled keys: select, pan, zoom, line, rectangle, circle, arc, polyline and wall, plus move, group, mirror, trim, push pull, extrude, the standard views and every render mode.",
            "tagline": "Draw, modify, model and render without hunting the tool bar.",
            "features": [
                ("Draw", "Select, pan, zoom, line, rectangle, circle, arc, polyline, polygon and wall."),
                ("Modify", "Move, duplicate, group, ungroup, mirror, offset, fillet, split, trim, reorder and rotate."),
                ("3D and views", "Push pull, extrude, add and subtract solids, flyover, walkthrough, top plan, fit to objects."),
                ("Render", "Wireframe, shaded, hidden line and final render, plus the object info palette."),
                ("Zero setup", "Every key uses a Vectorworks default shortcut, so it works the moment you import it."),
            ],
            "outro": "Covers the shared command set across Vectorworks editions in one profile, for Stream Deck MK.2 and XL on Windows and Mac.",
            "keywords": ["Vectorworks", "Stream Deck profile", "CAD shortcuts", "architecture", "BIM", "drafting"],
            "collection": COLLECTION,
        },
    }

def fortnite_cfg():
    """Positioning: comms and capture plus the game keys a deck can genuinely
    serve. Building keys are deliberately absent (README explains why)."""
    A = FN_BLUE
    mute = key_img("microphone-off", label="Mute Mic")
    deafen = key_img("headphones-off", label="Deafen")
    ptt = key_img("microphone", fg=A, dot=GREEN_DOT, label="Push to Talk")
    clip = key_img("scissors", fg=A, label="Save Clip")
    mark = key_img("flag", fg=A, label="Marker")
    rec = key_img("player-record", fg=A, label="Record")
    stream = key_img("broadcast", fg=A, label="Stream")
    mp = key_img("map-2", fg=A, label="Map")
    bag = key_img("backpack", label="Bag")
    emote = key_img("mood-smile", fg=A, label="Emote")
    squad = key_img("users-group", fg=A, label="Squad")
    s1 = key_img("number-1", label="Slot 1")
    s2 = key_img("number-2", label="Slot 2")
    s3 = key_img("number-3", label="Slot 3")
    pick = key_img("pick", fg=A, label="Pickaxe")
    reload = key_img("refresh", label="Reload")
    tracker = key_img("chart-bar", fg=A, label="Stats")
    shop = key_img("shopping-bag", fg=A, label="Item Shop")
    return {
        "game": "FORTNITE", "name": "Fortnite",
        "brand": A, "bg": BG, "icon": "", "icon_sub": "DECK",
        "hero_title": ["Fortnite comms", "without alt-tabbing."],
        "tagline": "Mic, clips and stream controls up front. Weapon slots and match keys behind them.",
        "bullets": ["Push to talk, mute and deafen without leaving the match",
                    "Save a clip or drop a marker mid fight",
                    "Weapon slots, pickaxe and reload on Fortnite's own defaults"],
        "hero_keys": [mute, deafen, ptt, clip, mark, rec, stream, mp, bag, emote,
                      squad, s1, s2, pick],
        "device_photo_mockup": True,
        "bottom": [("microphone", "Comms", "Talk and mute"),
                   ("scissors", "Capture", "Clip the play"),
                   ("number-1", "Loadout", "Slots on keys"),
                   ("world", "Intel", "Stats and shop")],
        "feature_banners": [
            ("Talk without leaving the fight.", [ptt, mute, deafen, squad, emote],
             ["Push to Talk", "Mute Mic", "Deafen", "Squad", "Emote"], None,
             "Hold to talk, mute, deafen and squad comms, all without alt-tabbing."),
            ("Clip it before you forget.", [clip, mark, rec, stream, key_img("message", label="Chat")],
             ["Save Clip", "Marker", "Record", "Stream", "Chat"], None,
             "Save the replay, drop a marker and control your stream from the deck."),
            ("Your loadout on real keys.", [s1, s2, s3, pick, reload],
             ["Slot 1", "Slot 2", "Slot 3", "Pickaxe", "Reload"], None,
             "Weapon slots, pickaxe, reload and pick up, on Fortnite's own default keybinds."),
            ("Map, bag and emote.", [mp, bag, emote, key_img("hand-click", label="Pick Up"), key_img("alert-triangle", fg=A, label="Trap")],
             ["Map", "Bag", "Emote", "Pick Up", "Trap"], None,
             "The match keys you press between fights, one tap each."),
            ("Stats and shop, one press.", [tracker, shop, key_img("news", fg=A, label="Patch"), key_img("map-pin", fg=A, label="POIs")],
             ["Stats", "Item Shop", "Patch Notes", "Map and POIs"], None,
             "Check your stats, the shop rotation and the patch notes without a browser hunt."),
        ],
        "statement": ["One press, one action.",
                      "Single taps of Fortnite's own default keybinds. No macros, nothing that plays for you."],
        "video_scenes": [
            ("Push to talk, mute, deafen", [ptt, mute, deafen]),
            ("Save clip and marker", [clip, mark, rec]),
            ("Weapon slots and pickaxe", [s1, s2, s3, pick]),
            ("Stats and item shop", [tracker, shop]),
            ("Fortnite", [ptt, clip, mp, s1, emote]),
        ],
        "description": {
            "search_line": "Fortnite Stream Deck profile: push to talk, mute, save clip, stream controls, weapon slots, map, emote and stats links.",
            "intro": "Your Fortnite comms and capture on real keys: push to talk, mute, deafen, save a clip, drop a marker, start recording or streaming, plus weapon slots, pickaxe, reload, map, bag and emote on the game's own default keybinds.",
            "tagline": "Comms and clips up front, match keys behind them.",
            "features": [
                ("Comms", "Push to talk in game, plus mute and deafen for Discord, squad comms and chat, without alt-tabbing."),
                ("Capture", "Save a replay clip, drop a marker, start and stop recording or streaming in OBS."),
                ("Match keys", "Weapon slots one to five, pickaxe, reload, pick up, trap and upgrade."),
                ("Between fights", "Map, inventory and emote, each on their own key."),
                ("Intel", "Stats, item shop, patch notes and a map with named locations."),
                ("Before you start", "The mute, deafen and capture keys press hotkeys in Discord and OBS, so those two apps need the matching bind set once. The included install guide walks you through it in a couple of minutes. The Fortnite keys need nothing."),
            ],
            "outro": "Built for Battle Royale defaults. One press sends one key, with no sequences and no automation. Building keys are left off on purpose: they are faster on the keyboard already under your hand.",
            "keywords": ["Fortnite", "Stream Deck profile", "battle royale", "keybinds", "push to talk", "Discord mute", "clips"],
            "collection": COLLECTION,
        },
    }

def satisfactory_cfg():
    A = SF_ORANGE
    build = key_img("hammer", fg=A, label="Build")
    dis = key_img("trash", fg=A, label="Dismantle")
    mode = key_img("adjustments", fg=A, label="Build Mode")
    lock = key_img("lock", fg=A, label="Lock Holo")
    cust = key_img("palette", fg=A, label="Customizer")
    bag = key_img("backpack", label="Bag")
    mp = key_img("map-2", fg=A, label="Map")
    scan = key_img("radar", fg=A, label="Scanner")
    codex = key_img("book", fg=A, label="Codex")
    torch = key_img("bulb", label="Torch")
    photo = key_img("camera", fg=A, label="Photo")
    use = key_img("hand-click", label="Use")
    h1 = key_img("number-1", label="Slot 1")
    h2 = key_img("number-2", label="Slot 2")
    h3 = key_img("number-3", label="Slot 3")
    h4 = key_img("number-4", label="Slot 4")
    calc = key_img("calculator", fg=A, label="Calc")
    recipes = key_img("list-check", fg=A, label="Recipes")
    return {
        "game": "SATISFACTORY", "name": "Satisfactory",
        "brand": A, "bg": BG, "icon": "", "icon_sub": "FACTORY",
        "hero_title": ["Satisfactory build tools", "on real keys."],
        "tagline": "Build menu, dismantle and all ten hotbar slots, plus your reference sites.",
        "bullets": ["Build, dismantle and build mode without the key hunt",
                    "All ten hotbar slots on their own keys",
                    "Wiki, calculator and recipe tools one press away"],
        "hero_keys": [build, dis, mode, lock, cust, bag, mp, scan, codex, torch,
                      photo, h1, h2, h3],
        "device_photo_mockup": True,
        "bottom": [("hammer", "Build", "Menu and modes"),
                   ("number-1", "Hotbar", "All ten slots"),
                   ("radar", "Explore", "Map and scanner"),
                   ("calculator", "Planning", "Calc and recipes")],
        "feature_banners": [
            ("Build without the key hunt.", [build, dis, mode, lock, cust],
             ["Build", "Dismantle", "Build Mode", "Lock Holo", "Customizer"], None,
             "The build tools you press hundreds of times a session, labeled."),
            ("Every hotbar slot, its own key.", [h1, h2, h3, h4, key_img("number-5", label="Slot 5")],
             ["Slot 1", "Slot 2", "Slot 3", "Slot 4", "Slot 5"], None,
             "All ten slots on the deck, so swapping belts and splitters is one tap."),
            ("Find your way around.", [mp, scan, codex, torch, photo],
             ["Map", "Scanner", "Codex", "Torch", "Photo"], None,
             "Map, resource scanner, codex, flashlight and photo mode, one press each."),
            ("Plan without alt-tabbing.", [key_img("book", label="Wiki"), calc, recipes, key_img("news", fg=A, label="Patch")],
             ["Wiki", "Calculator", "Recipes", "Patch Notes"], None,
             "The wiki, production calculator and recipe tools open straight from the deck."),
            ("Import and start building.", [build, dis, bag, mp, h1, h2],
             ["Build", "Dismantle", "Bag", "Map", "Slot 1", "Slot 2"], None,
             "Every key matches Satisfactory's default bindings. Nothing to set up."),
        ],
        "statement": ["Ten hotbar slots, ten keys.",
                      "The part of a factory builder a deck was made for, plus the sites you keep open anyway."],
        "video_scenes": [
            ("Build menu and dismantle", [build, dis, mode]),
            ("All ten hotbar slots", [h1, h2, h3, h4]),
            ("Map, scanner, photo", [mp, scan, photo]),
            ("Calculator and recipes", [calc, recipes]),
            ("Satisfactory", [build, h1, mp, scan, photo]),
        ],
        "description": {
            "search_line": "Satisfactory Stream Deck profile: build menu, dismantle, build modes, all ten hotbar slots, map, scanner and reference links.",
            "intro": "Your Satisfactory build tools on real keys: build menu, dismantle, build mode, lock hologram and customizer, plus all ten hotbar slots, the map, resource scanner, codex, flashlight and photo mode.",
            "tagline": "Build tools and the full hotbar, plus the sites you keep open.",
            "features": [
                ("Build", "Build menu, dismantle, change build mode, lock hologram and the customizer."),
                ("Hotbar", "All ten slots on their own keys, for swapping belts, splitters and foundations."),
                ("Explore", "Map, resource scanner, codex, flashlight, photo mode and interact."),
                ("Planning", "The wiki, a production calculator, recipe tools and patch notes."),
                ("Zero setup", "Every key matches Satisfactory's default bindings out of the box."),
            ],
            "outro": "Movement and vehicle controls are left off on purpose: they are held inputs that belong under your hand, not on a deck key.",
            "keywords": ["Satisfactory", "Stream Deck profile", "factory game", "hotbar", "keybinds", "factory builder"],
            "collection": COLLECTION,
        },
    }

def wow_cfg():
    """Positioning: a utility layer, never a rotation helper. The Icy Veins
    action-bar pattern is the pitch; Ready Check is the raid-leader hook."""
    A = WOW_GOLD
    char = key_img("user", fg=A, label="Character")
    spells = key_img("book", fg=A, label="Spells")
    talents = key_img("hierarchy", fg=A, label="Talents")
    ach = key_img("trophy", fg=A, label="Achieve")
    mp = key_img("map-2", fg=A, label="Map")
    bags = key_img("backpack", label="Bags")
    mounts = key_img("horse", fg=A, label="Mounts")
    finder = key_img("users-group", fg=A, label="Group Finder")
    guild = key_img("shield", fg=A, label="Guild")
    ready = key_img("circle-check", fg=(110, 230, 140), label="Ready Check")
    chat = key_img("message", label="Chat")
    hide = key_img("eye-off", label="Hide UI")
    b1 = key_img("number-1", label="Bar 1")
    b2 = key_img("number-2", label="Bar 2")
    b3 = key_img("number-3", label="Bar 3")
    wowhead = key_img("world", label="Wowhead")
    rio = key_img("chart-bar", fg=A, label="Raider IO")
    return {
        "game": "WARCRAFT", "name": "World of Warcraft",
        "bg_opacity": 0.8,
        "brand": A, "bg": BG, "icon": "", "icon_sub": "MMO",
        "hero_title": ["Stop wasting", "action bar space."],
        "tagline": "Every panel on a key, your whole action bar on the deck, ready check one press.",
        "bullets": ["Hearthstone and mounts off your bars and onto the deck",
                    "All twelve action bar slots on their own keys",
                    "Ready check the group without touching the keyboard"],
        "hero_keys": [char, spells, talents, ach, mp, bags, mounts, finder, guild,
                      ready, chat, hide, b1, b2],
        "device_photo_mockup": True,
        "bottom": [("user", "Panels", "One key each"),
                   ("number-1", "Action Bar", "All twelve"),
                   ("circle-check", "Raid", "Ready check"),
                   ("world", "Reference", "Wowhead, logs")],
        "feature_banners": [
            ("Free up your action bars.", [b1, b2, b3, key_img("number-4", label="Bar 4"), mounts],
             ["Bar 1", "Bar 2", "Bar 3", "Bar 4", "Mounts"], None,
             "Park your hearthstone, mount and flasks on a bar slot and press them from the deck."),
            ("Every panel, one key.", [char, spells, talents, ach, mp],
             ["Character", "Spells", "Talents", "Achieve", "Map"], None,
             "Character, spellbook, talents, achievements and the map without the key hunt."),
            ("Ready check the group.", [ready, finder, guild, key_img("users", label="Social"), chat],
             ["Ready Check", "Group Finder", "Guild", "Social", "Chat"], None,
             "Pull the whole raid's status with one press, then queue and chat from the same page."),
            ("Look it up mid pull.", [wowhead, rio, key_img("file-analytics", fg=A, label="Logs"), key_img("news", fg=A, label="Patch")],
             ["Wowhead", "Raider IO", "Logs", "Patch Notes"], None,
             "Wowhead, Raider.IO, Warcraft Logs and the patch notes, straight from the deck."),
            ("Nothing plays for you.", [char, bags, mp, b1, hide],
             ["Character", "Bags", "Map", "Bar 1", "Hide UI"], None,
             "One press sends one key. No rotations, no sequences, no timers."),
        ],
        "statement": ["A utility layer, not a rotation.",
                      "Panels, bars and a ready check. Nothing here plays the game for you."],
        "video_scenes": [
            ("Panels on real keys", [char, spells, talents, mp]),
            ("Your whole action bar", [b1, b2, b3]),
            ("Hearthstone and mounts", [mounts, bags]),
            ("Ready check the raid", [ready, finder]),
            ("World of Warcraft", [char, mounts, ready, b1, mp]),
        ],
        "description": {
            "search_line": "World of Warcraft Stream Deck profile: interface panels, all twelve action bar slots, ready check, mounts, group finder and Wowhead links.",
            "intro": "The World of Warcraft panels you open a hundred times a session, on real keys: character, spellbook, talents, achievements, map, bags, mounts, group finder and guild, plus your entire twelve slot action bar and a one press ready check.",
            "tagline": "Panels, your action bar and a ready check, all on the deck.",
            "features": [
                ("Panels", "Character, spellbook, talents, achievements, map, bags, mounts, group finder and guild."),
                ("Action bar", "All twelve primary slots, so a hearthstone or mount parked there is one press away."),
                ("Ready check", "Pull the whole group's status without touching the keyboard."),
                ("Reference", "Wowhead, Raider.IO, Warcraft Logs and the official patch notes."),
                ("Zero setup", "Every key uses WoW's own default bindings, so it works the moment you import it."),
            ],
            "outro": "This is a utility layer, not a rotation helper. One press sends one key and nothing here automates play. Windows and Mac, Stream Deck MK.2 and XL.",
            "keywords": ["World of Warcraft", "Stream Deck profile", "WoW", "MMO", "action bar", "ready check"],
            "collection": COLLECTION,
        },
    }

def elite_cfg():
    """Positioning (profiles/elite-dangerous/README.md): lead on ZERO SETUP. A
    free GitHub plugin does live game state; this must never claim that."""
    A = ED_ORANGE
    gear = key_img("plane-departure", fg=A, label="Landing Gear")
    scoop = key_img("package", fg=A, label="Cargo Scoop")
    hard = key_img("target", fg=A, label="Hardpoints")
    lights = key_img("bulb", label="Lights")
    silent = key_img("ghost", fg=A, label="Silent Run")
    fsd = key_img("rocket", fg=A, label="Frame Shift")
    hyper = key_img("sparkles", fg=A, label="Hyperspace")
    fa = key_img("steering-wheel", fg=A, label="Flight Assist")
    boost = key_img("bolt", fg=A, label="Boost")
    heat = key_img("flame", fg=A, label="Heat Sink")
    galmap = key_img("planet", fg=A, label="Galaxy Map")
    nav = key_img("route", fg=A, label="Nav")
    sysp = key_img("settings", label="Systems")
    psys = key_img("shield", fg=(90, 190, 255), label="Pip SYS")
    peng = key_img("engine", fg=(110, 230, 140), label="Pip ENG")
    pwep = key_img("target", fg=(255, 100, 100), label="Pip WEP")
    tahead = key_img("crosshair", fg=A, label="Target")
    return {
        "game": "ELITE DANGEROUS", "name": "Elite Dangerous",
        "brand": A, "bg": BG, "icon": "", "icon_sub": "SHIP",
        "hero_title": ["Elite Dangerous,", "no setup needed."],
        "tagline": "Ship systems, the four panels and your power pips. Import and fly.",
        "bullets": ["Gear, scoop, hardpoints and lights on labeled keys",
                    "All four panels and the power distributor one tap away",
                    "No plugin, no companion app, nothing reading your game files"],
        "hero_keys": [gear, scoop, hard, lights, silent, fsd, hyper, fa, boost,
                      heat, galmap, nav, psys, peng],
        "device_photo_mockup": True,
        "bottom": [("plane-departure", "Ship", "Gear and scoop"),
                   ("layout-sidebar", "Panels", "All four"),
                   ("shield", "Pips", "Power on tap"),
                   ("bolt", "Setup", "None needed")],
        "feature_banners": [
            ("Ship systems on labeled keys.", [gear, scoop, hard, lights, silent],
             ["Landing Gear", "Cargo Scoop", "Hardpoints", "Lights", "Silent Run"], None,
             "The toggles you hunt for mid approach, each on its own key."),
            ("Jump and run.", [fsd, hyper, fa, boost, heat],
             ["Frame Shift", "Hyperspace", "Flight Assist", "Boost", "Heat Sink"], None,
             "Frame shift, hyperspace, flight assist, boost and heat sink, one press each."),
            ("Power where you need it.", [psys, peng, pwep, key_img("scale", label="Balance"), galmap],
             ["Pip SYS", "Pip ENG", "Pip WEP", "Balance", "Galaxy Map"], None,
             "The power distributor on four keys, laid out like the pips on your HUD."),
            ("Panels without the reach.", [nav, key_img("message", label="Comms"), key_img("ship", fg=A, label="Role"), sysp, tahead],
             ["Nav", "Comms", "Role", "Systems", "Target"], None,
             "All four UI panels plus targeting, one tap from anywhere in the cockpit."),
            ("Import and fly.", [gear, scoop, fsd, psys, nav, galmap],
             ["Landing Gear", "Cargo Scoop", "Frame Shift", "Pip SYS", "Nav", "Galaxy Map"], None,
             "Elite's own default binds. No plugin to install, nothing running in the background."),
        ],
        "statement": ["Double-click and fly.",
                      "No plugin to install, no companion app, and nothing reading your game files."],
        "video_scenes": [
            ("Gear, scoop, hardpoints", [gear, scoop, hard]),
            ("Frame shift and boost", [fsd, hyper, boost]),
            ("Power pips on the deck", [psys, peng, pwep]),
            ("All four panels", [nav, sysp, galmap]),
            ("Elite Dangerous", [gear, fsd, psys, nav, galmap]),
        ],
        "description": {
            "search_line": "Elite Dangerous Stream Deck profile: landing gear, cargo scoop, hardpoints, frame shift drive, power pips, UI panels and targeting.",
            "intro": "Your Elite Dangerous ship systems on real keys: landing gear, cargo scoop, hardpoints, ship lights, silent running, frame shift drive, hyperspace, flight assist, boost and heat sink, plus all four UI panels and the power distributor.",
            "tagline": "Ship systems, panels and pips, with nothing to install.",
            "features": [
                ("Ship", "Landing gear, cargo scoop, hardpoints, lights, silent running and heat sink."),
                ("Flight", "Frame shift drive, hyperspace, flight assist and boost."),
                ("Power", "The distributor on four keys, laid out like the pips on your HUD."),
                ("Panels", "Navigation, comms, role and systems, plus target ahead, next ship, highest threat and subsystem."),
                ("Zero setup", "Elite's own default keyboard binds, so it works the moment you import it."),
            ],
            "outro": "A profile, not a plugin: nothing installs, nothing runs in the background and nothing reads your game files. For Stream Deck MK.2 and XL on Windows.",
            "keywords": ["Elite Dangerous", "Stream Deck profile", "space sim", "keybinds", "HOTAS", "cockpit"],
            "collection": COLLECTION,
        },
    }

def osrs_cfg():
    """Positioning (profiles/osrs/README.md): lead on the REFERENCE LAYER. Rune
    Nav already owns tab navigation; the Guide page is what it lacks."""
    A = OSRS_GOLD
    bag = key_img("backpack", label="Bag")
    combat = key_img("sword", fg=A, label="Combat")
    skills = key_img("chart-bar", fg=A, label="Skills")
    quests = key_img("book", fg=A, label="Quests")
    gear = key_img("shirt", fg=A, label="Gear")
    prayer = key_img("sparkles", fg=A, label="Prayer")
    magic = key_img("wand", fg=A, label="Magic")
    clan = key_img("users-group", fg=A, label="Clan")
    friends = key_img("user", label="Friends")
    emotes = key_img("mood-smile", fg=A, label="Emotes")
    wiki = key_img("book", label="Wiki")
    mp = key_img("map-2", fg=A, label="World Map")
    prices = key_img("coins", fg=A, label="GE Prices")
    hi = key_img("trophy", fg=A, label="Hiscores")
    dps = key_img("sword", fg=A, label="DPS Calc")
    wom = key_img("chart-line", fg=A, label="Wise Old Man")
    temple = key_img("flame", fg=A, label="Temple")
    worlds = key_img("server", label="Worlds")
    return {
        "game": "OLD SCHOOL", "name": "Old School RuneScape",
        "bg_opacity": 0.8,
        "brand": A, "bg": BG, "icon": "", "icon_sub": "OSRS",
        "hero_title": ["Every OSRS tab", "and every tool."],
        "tagline": "All thirteen interface tabs, plus GE prices, DPS calc and XP tracking.",
        "bullets": ["GE prices, DPS calculator and XP tracking one press away",
                    "All thirteen interface tabs on their own keys",
                    "Windows and Mac, MK.2 and XL, one download"],
        "hero_keys": [bag, combat, skills, quests, gear, prayer, magic, clan,
                      friends, emotes, prices, mp, hi, wom],
        "device_photo_mockup": True,
        "bottom": [("coins", "Prices", "GE, one press"),
                   ("chart-line", "Tracking", "XP and records"),
                   ("backpack", "Tabs", "All thirteen"),
                   ("map-2", "Map", "Full world map")],
        "feature_banners": [
            ("Your second monitor, on the deck.", [prices, dps, wom, temple, hi],
             ["GE Prices", "DPS Calc", "Wise Old Man", "Temple", "Hiscores"], None,
             "Grand Exchange prices, the DPS calculator, XP tracking and your hiscores, one press each."),
            ("Every tab, its own key.", [bag, combat, skills, prayer, magic],
             ["Bag", "Combat", "Skills", "Prayer", "Magic"], None,
             "Inventory, combat, skills, prayer and spellbook without moving the mouse."),
            ("Look it up mid grind.", [wiki, mp, quests, worlds, key_img("news", fg=A, label="News")],
             ["Wiki", "World Map", "Quests", "Worlds", "News"], None,
             "The wiki, a full world map, the quest list, the world switcher and official news."),
            ("The rest of the interface.", [gear, clan, friends, emotes, key_img("settings", label="Options")],
             ["Gear", "Clan", "Friends", "Emotes", "Options"], None,
             "Worn equipment, clan chat, friends, emotes, music and settings, all one tap."),
            ("Import and play.", [bag, combat, prayer, prices, mp],
             ["Bag", "Combat", "Prayer", "GE Prices", "World Map"], None,
             "Matches the game's default function key layout. Nothing to set up."),
        ],
        "statement": ["Prices, DPS and XP on tap.",
                      "The tabs every OSRS profile has, plus the tools none of them do."],
        "video_scenes": [
            ("GE prices and DPS calc", [prices, dps]),
            ("XP tracking and records", [wom, temple, hi]),
            ("Every interface tab", [bag, combat, prayer, magic]),
            ("Wiki and world map", [wiki, mp]),
            ("Old School RuneScape", [bag, prayer, prices, mp, wom]),
        ],
        "description": {
            "search_line": "Old School RuneScape Stream Deck profile: all interface tabs plus Grand Exchange prices, DPS calculator, XP tracking, world map and hiscores.",
            "intro": "Every Old School RuneScape interface tab on its own key, plus the sites you keep on a second monitor: Grand Exchange prices, the DPS calculator, Wise Old Man XP tracking, TempleOSRS, a full world map, the quest list, hiscores and the world switcher.",
            "tagline": "All thirteen tabs, plus prices, DPS and XP tracking.",
            "features": [
                ("Reference", "Grand Exchange prices, DPS calculator, Wise Old Man, TempleOSRS and hiscores."),
                ("Tabs", "Inventory, combat, skills, quests, equipment, prayer, spellbook and clan chat."),
                ("More tabs", "Friends, account, settings, emotes and music, each on its own key."),
                ("Look it up", "The wiki, a full interactive world map, the quest list, world switcher and official news."),
                ("Zero setup", "Matches the game's default function key layout, so it works the moment you import it."),
            ],
            "outro": "For Stream Deck MK.2 and XL on Windows and Mac. If you have rebound a tab, change that one key in the Stream Deck app to match.",
            "keywords": ["Old School RuneScape", "OSRS", "Stream Deck profile", "RuneScape", "Grand Exchange", "keybinds"],
            "collection": COLLECTION,
        },
    }

def forza_cfg():
    """Covers Forza Horizon 6 and 5 (identical PC schemes). Competing listings
    are single-game profiles, so two-game coverage is the hook."""
    A = FORZA_MAGENTA
    photo = key_img("camera", fg=A, label="Photo")
    cam = key_img("video", fg=A, label="Camera")
    mp = key_img("map-2", fg=A, label="Map")
    tel = key_img("gauge", fg=A, label="Telemetry")
    rew = key_img("history", fg=A, label="Rewind")
    horn = key_img("bell", label="Horn")
    rprev = key_img("player-track-prev", label="Radio Back")
    rnext = key_img("player-track-next", label="Radio Next")
    anna = key_img("message-circle", fg=A, label="Anna")
    link = key_img("link", fg=A, label="Forza LINK")
    conv = key_img("car", fg=A, label="Convertible")
    lead = key_img("trophy", fg=A, label="Leaders")
    act = key_img("hand-click", label="Activate")
    tune = key_img("adjustments", fg=A, label="Tunes")
    wiki = key_img("book", fg=A, label="Car Wiki")
    return {
        "game": "FORZA", "name": "Forza",
        "brand": A, "bg": BG, "icon": "", "icon_sub": "RACE",
        "hero_title": ["Forza, without", "leaving the wheel."],
        "tagline": "Camera, photo, telemetry, radio and map. Works with Horizon 6 and Horizon 5.",
        "bullets": ["Photo mode, camera and telemetry without a hand off the wheel",
                    "Radio, horn and rewind on their own keys",
                    "One profile for Forza Horizon 6 and Horizon 5"],
        "hero_keys": [photo, cam, mp, tel, rew, horn, rprev, rnext, anna, link,
                      conv, lead, act, tune],
        "device_photo_mockup": True,
        "bottom": [("camera", "Capture", "Photo and camera"),
                   ("gauge", "Data", "Telemetry"),
                   ("player-track-next", "Radio", "Station skip"),
                   ("car", "Two games", "Horizon 6 and 5")],
        "feature_banners": [
            ("Never take a hand off the wheel.", [cam, photo, tel, rew, horn],
             ["Camera", "Photo", "Telemetry", "Rewind", "Horn"], None,
             "Switch view, grab a photo, check telemetry and rewind, mid race."),
            ("Your radio, your way.", [rprev, rnext, anna, link, conv],
             ["Radio Back", "Radio Next", "Anna", "Forza LINK", "Convertible"], None,
             "Skip stations, call Anna, open Forza LINK and drop the roof without a menu."),
            ("Check the map and the board.", [mp, lead, act, tel],
             ["Map", "Leaders", "Activate", "Telemetry"], None,
             "Map, mini leaderboard, interact and the telemetry overlay, one press each."),
            ("Tunes and cars, one press.", [tune, wiki, key_img("world", label="Forza net"), key_img("news", fg=A, label="Support")],
             ["Tunes", "Car Wiki", "Forza net", "Support"], None,
             "Tune sheets, the car wiki and the official site straight from the deck."),
            ("Two games, one profile.", [photo, cam, mp, tel, rprev],
             ["Photo", "Camera", "Map", "Telemetry", "Radio"], None,
             "Works with Forza Horizon 6 and Horizon 5 on the games' own default controls."),
        ],
        "statement": ["Everything around the driving.",
                      "Driving stays on the wheel. The camera, photo, telemetry and radio move to the deck."],
        "video_scenes": [
            ("Camera and photo mode", [cam, photo]),
            ("Telemetry and rewind", [tel, rew]),
            ("Radio and Anna", [rprev, rnext, anna]),
            ("Map and leaderboard", [mp, lead]),
            ("Forza", [photo, cam, tel, mp, rnext]),
        ],
        "description": {
            "search_line": "Forza Stream Deck profile: photo mode, camera change, telemetry, rewind, radio, map and horn for Forza Horizon 6 and Horizon 5.",
            "intro": "Everything around the driving, on real keys: photo mode, camera change, telemetry, rewind, horn, radio stations, the map, Anna, Forza LINK, the convertible roof and the mini leaderboard. Works with Forza Horizon 6 and Forza Horizon 5.",
            "tagline": "Camera, photo, telemetry and radio, without leaving the wheel.",
            "features": [
                ("Capture", "Photo mode and camera change, one press each, mid race."),
                ("Data", "The telemetry overlay and rewind on their own keys."),
                ("Radio", "Skip stations forward and back, plus the horn and Anna."),
                ("Race tools", "Map, mini leaderboard, Forza LINK, convertible roof and interact."),
                ("Reference", "Tune sheets, the car wiki, the official site and support."),
            ],
            "outro": "Driving inputs are left off on purpose: accelerate, brake, steering and gears are held inputs that belong on the wheel. Uses the games' own default keyboard controls.",
            "keywords": ["Forza", "Forza Horizon", "Stream Deck profile", "racing", "photo mode", "telemetry"],
            "collection": COLLECTION,
        },
    }

SW_RED = (215, 35, 42)

def solidworks_cfg():
    """Third CAD profile after DaVinci and Vectorworks. Same curation pitch as
    Vectorworks: this niche has zero comps, so there is no breadth claim to make
    and none is made."""
    A = SW_RED
    sbar = key_img("keyboard", fg=A, label="Shortcut Bar")
    search = key_img("search", fg=A, label="Search")
    zfit = key_img("zoom-scan", fg=A, label="Zoom Fit")
    zin = key_img("zoom-in", label="Zoom In")
    zout = key_img("zoom-out", label="Zoom Out")
    iso = key_img("cube", fg=A, label="Isometric")
    normal = key_img("square-arrow-up", fg=A, label="Normal To")
    front = key_img("square", fg=A, label="Front")
    top = key_img("arrow-up", fg=A, label="Top")
    right = key_img("layout-sidebar-right", fg=A, label="Right")
    rebuild = key_img("refresh", fg=A, label="Rebuild")
    save = key_img("device-floppy", label="Save")
    undo = key_img("arrow-back", label="Undo")
    ffaces = key_img("square", fg=(110, 200, 255), label="Faces")
    fedges = key_img("line-dashed", fg=(110, 200, 255), label="Edges")
    fverts = key_img("point", fg=(110, 200, 255), label="Verts")
    line = key_img("pencil", fg=A, label="Line")
    regen = key_img("rotate-3d", fg=A, label="Force Regen")
    tree = key_img("list-tree", fg=A, label="Tree")
    orient = key_img("view-360", fg=A, label="Orient Bar")
    return {
        "game": "SOLIDWORKS", "name": "SOLIDWORKS",
        "brand": A, "bg": BG, "icon": "", "icon_sub": "CAD",
        "hero_title": ["The SOLIDWORKS keys", "you press all day."],
        "tagline": "Shortcut bar, the full view cube and the selection filters on real keys.",
        "bullets": ["Runs on SOLIDWORKS' own default shortcuts, zero setup",
                    "The whole Ctrl+1 to Ctrl+8 view cube on labeled keys",
                    "Selection filters and the shortcut bar one tap away"],
        "hero_keys": [sbar, search, zfit, zin, zout, iso, normal, front, top,
                      right, rebuild, save, undo, tree],
        "device_photo_mockup": True,
        "bottom": [("cube", "Views", "Full view cube"),
                   ("filter", "Filters", "Faces, edges"),
                   ("keyboard", "Shortcut Bar", "S, one tap"),
                   ("bolt", "Setup", "None needed")],
        "feature_banners": [
            ("The view cube on real keys.", [front, top, right, iso, normal],
             ["Front", "Top", "Right", "Isometric", "Normal To"], None,
             "Ctrl+1 through Ctrl+8 laid out where you can see them, plus the orientation bar."),
            ("Filter what you select.", [ffaces, fedges, fverts, key_img("filter", label="Filters"), key_img("layout-grid", label="Filter Bar")],
             ["Faces", "Edges", "Verts", "Filters", "Filter Bar"], None,
             "Faces, edges and vertices on their own keys, so picking the right entity stops being a fight."),
            ("Zoom and rebuild without looking.", [zfit, zin, zout, rebuild, regen],
             ["Zoom Fit", "Zoom In", "Zoom Out", "Rebuild", "Force Regen"], None,
             "Zoom to fit, zoom in and out, rebuild and force regen, one press each."),
            ("The shortcut bar, one tap.", [sbar, search, line, tree, orient],
             ["Shortcut Bar", "Search", "Line", "Tree", "Orient Bar"], None,
             "S for the shortcut bar, W for command search, plus the tree and sketch line."),
            ("Import and model.", [sbar, front, iso, zfit, save, undo],
             ["Shortcut Bar", "Front", "Isometric", "Zoom Fit", "Save", "Undo"], None,
             "Every key is a SOLIDWORKS default. Nothing to configure first."),
        ],
        "statement": ["The keys you press all day.",
                      "The view cube, the filters and the shortcut bar, where you can actually see them."],
        "video_scenes": [
            ("The full view cube", [front, top, right, iso]),
            ("Selection filters", [ffaces, fedges, fverts]),
            ("Zoom and rebuild", [zfit, rebuild, regen]),
            ("Shortcut bar and search", [sbar, search]),
            ("SOLIDWORKS", [sbar, front, iso, zfit, save]),
        ],
        "description": {
            "search_line": "SOLIDWORKS Stream Deck profile: view orientations, selection filters, shortcut bar, zoom, rebuild and sketch tools on real keys.",
            "intro": "The SOLIDWORKS commands you press all day, on labeled keys: the shortcut bar, command search, zoom to fit, the whole Ctrl+1 to Ctrl+8 view cube, the face, edge and vertex selection filters, rebuild, force regen and the feature tree.",
            "tagline": "View cube, selection filters and the shortcut bar, all on the deck.",
            "features": [
                ("Views", "Front, back, left, right, top, bottom, isometric and normal to, plus the orientation bar."),
                ("Selection", "Filter by face, edge or vertex, toggle filters, and open the filter toolbar."),
                ("Navigation", "Zoom to fit, zoom in and out, expand the tree and the display pane."),
                ("Tools", "Shortcut bar, command search, sketch line, rebuild, force regen, repeat and recent documents."),
                ("Zero setup", "Every key uses a SOLIDWORKS default shortcut, so it works the moment you import it."),
            ],
            "outro": "For Stream Deck MK.2 and XL on Windows. If you have customized a shortcut in Tools > Customize > Keyboard, rebind that one key in the Stream Deck app to match.",
            "keywords": ["SOLIDWORKS", "Stream Deck profile", "CAD shortcuts", "engineering", "3D modeling", "drafting"],
            "collection": COLLECTION,
        },
    }

# ---------------------------------------------------------------- Claude Usage
CLAUDE_ORANGE = (255, 138, 61)
CLAUDE_REPO = ROOT.parent.parent / "claude-usage-streamdeck"

def _claude_faces():
    """Claude Usage renders its keys as SVG at runtime, so there is no static art for
    plugin_key() to read. That repo's scripts/key_faces.py is the mirror instead."""
    import importlib.util
    p = CLAUDE_REPO / "scripts" / "key_faces.py"
    spec = importlib.util.spec_from_file_location("claude_key_faces", p)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod

def claude_usage_cfg():
    A = CLAUDE_ORANGE
    kf = _claude_faces()
    s = kf.spec
    # No spec labels anywhere: banner_features_clean draws each spec's own label ON the
    # tile, and these key faces already render their window name and reset inside the
    # 144px art (unlike Better Hotkeys' pictorial keycaps). A label here collides with
    # that text, so the captions do the naming instead.
    # The premium-model weekly window (Fable / Opus on Max) shipped in 0.1.2.0.
    fable = s(kf.ring(58, "FABLE", "3d"))
    five, week = s(kf.ring(72, "5H", "1h 40m")), s(kf.ring(35, "WEEK", "3d"))
    over = s(kf.dual(72, 35))
    return {
        "game": "CLAUDE", "name": "Claude Usage",
        "logo_img": str(LOGOS / "claude.png"),   # SimpleIcons mark, rasterized white for tinting
        "brand": A, "bg": BG, "icon": "", "icon_sub": "",
        "os_support": "Windows and macOS",
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "hero_title_clean": "Claude Usage",
        "hero_title": ["Know if you can", "keep going."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "Your Claude limits, live on the deck. No browser tab.",
        "bullets": ["Session, weekly and premium model limits, all live",
                    "Eight display styles, three themes, per-key setup",
                    "Named accounts so work and personal never mix"],
        # 15 distinct faces, no duplicates: every style and window the plugin really has.
        "hero_keys": [
            s(kf.ring(42, "5H", "2h 14m")), s(kf.ring(78, "WEEK", "3d")), s(kf.ring(95, "5H", "12m")),
            s(kf.full(78, "WEEK", "3d")), s(kf.bignumber(35, "WEEK", "3d")),
            s(kf.status(42, "5H")), s(kf.countdown(82, "42m", "5H")), s(kf.bigtime("2h 14m", "5H")),
            s(kf.sparkline(72, "WEEK")), s(kf.heatmap()),
            s(kf.dual(42, 78)), s(kf.full(95, "5H", "12m")),
            s(kf.bignumber(58, "FABLE", "3d")), s(kf.status(95, "5H")), s(kf.bigtime("42m", "5H")),
        ],
        "device_photo_mockup": True,
        "bottom": [("chart-donut-3", "Live usage", "Session and weekly"),
                   ("palette", "Eight styles", "Ring, fill, number, more"),
                   ("users", "Accounts", "Work and personal apart"),
                   ("shield-lock", "Local only", "Token stays on your PC")],
        "feature_banners": [
            ("Every limit. One glance.",
             [five, week, fable, s(kf.bignumber(24, "EXTRA", "")), over],
             None, None,
             "Session, weekly, the premium model cap, extra credits, or all of it on one Overview key."),
            # Split 4 + 4: place_row does not wrap, and 8 tiles at disp=250/gap=50 is
            # 2350px on a 1920 canvas, so the last two would render off the edge.
            ("Eight ways to read it.",
             [s(kf.ring(42, "5H", "2h 14m")), s(kf.full(78, "WEEK", "3d")),
              s(kf.bignumber(42, "5H", "2h 14m")), s(kf.bigtime("2h 14m", "5H"))],
             None, None,
             "Ring, Full water fill, Big Number, Big Time. Short-press a key to cycle the style."),
            ("Or watch the trend.",
             [s(kf.countdown(78, "3d", "WEEK")), s(kf.sparkline(72, "WEEK")),
              s(kf.heatmap()), s(kf.status(42, "5H"))],
             None, None,
             "Countdown, Sparkline, Weekly Heatmap, Status. Eight styles in all, on any key."),
            # Status faces, not rings: they render the state word inside the key, so the
            # banner needs no labels and still names all four states.
            ("Green means keep going.",
             [s(kf.status(32, "5H")), s(kf.status(64, "5H")),
              s(kf.status(82, "5H")), s(kf.status(95, "5H"))],
             None, None,
             "Safe, Moderate, Warning, Critical. The colour walks green to red so you catch it without reading a number."),
            ("Work and personal, apart.",
             [s(kf.ring(42, "WORK", "2h 14m")), s(kf.ring(78, "PERSONAL", "1h 40m")),
              s(kf.ring(28, "CLIENT", "3h 45m")), s(kf.ring(95, "TEAM", "12m"))],
             None, None,
             "Paste each session key once, name it, then point any key at the account you want."),
        ],
        "statement": ["Know if you can keep going.",
                      "The limit that stops you mid-prompt is the one you could not see. Now it is on the deck."],
        "video_scenes": [
            ("Session and weekly, live", [five, week]),
            ("Premium models get their own", [five, week, fable]),
            ("Eight styles, one press", [s(kf.ring(72, "5H", "1h 40m")),
                                         s(kf.bignumber(72, "5H", "1h 40m")),
                                         s(kf.status(72, "5H"))]),
            ("Claude Usage", [five, week, fable]),
        ],
        "description": {
            "search_line": "Claude Usage: live Claude limits on your Stream Deck, showing your 5-hour session, weekly total and premium-model weekly cap at a glance.",
            "intro": "Stop guessing whether you are about to hit a wall mid-prompt. Claude Usage shows your live 5-hour session, weekly and premium-model limits right on your Stream Deck. One glance tells you if you are safe to keep going, with no browser tab and no slash commands.",
            "tagline": "Know if you can keep going.",
            "features": [
                ("Session and weekly", "Your rolling 5-hour window and your weekly total, accurate to your plan, with a live countdown to the next reset."),
                ("Premium model weekly", "Max plans cap Fable and Opus separately. That window gets its own key, and reads whichever premium model your account reports."),
                ("Eight display styles", "Ring, Full water fill, Big Number, Big Time, Countdown, Sparkline, Weekly Heatmap and Status. Short-press to cycle."),
                ("Colour that warns you", "Green to amber to red as you approach the limit, so a glance is enough."),
                ("Named accounts", "Track work, personal and client on separate keys. Paste each session key once."),
            ],
            "outro": "Everything stays on your machine: the session key is read locally and never leaves your PC.",
            "keywords": ["Claude usage", "Claude limits", "5-hour session", "weekly limit", "Fable", "Opus", "Max plan", "Stream Deck"],
            "collection": PLUGIN_COLLECTION,
        },
    }

# ---------------------------------------------------------------- Calendar Sync Pro
RELEASE_NOTES["calendar-pro"] = """First release. Windows and macOS, every Stream Deck model.
- Add as many calendars as you keep. They merge onto one key, and a meeting in two of them only shows once.
- Join Meeting key opens the link for whatever is next: Teams, Meet, Zoom and Webex.
- Agenda scrolls on the Stream Deck+ dial, with a press to jump back to the top.
- Each calendar is checked as you add it, so a wrong link tells you straight away."""


def calendar_pro_cfg():
    A = tokens.ACCENT
    kf = _calendar_faces()
    s = kf.spec
    # Same faces as the free tier, because Pro draws the same key. What changes is how many
    # calendars reach it, so the captions carry the difference rather than new art.
    review = s(kf.event("IN 5M", "Design Review", "TODAY 14:30", "warn"))
    standup = s(kf.event("IN 1M", "Standup", "TODAY 09:30", "imminent"))
    running = s(kf.event("NOW", "Sprint Planning", "TODAY 10:00", "now", join=True))
    quiet = s(kf.event("IN 2H 15M", "1:1 with Sam", "TODAY 16:00", "normal"))
    tomorrow = s(kf.event("IN 12H 45M", "Quarterly Planning", "TOMORROW 09:00", "normal"))
    client = s(kf.event("IN 45M", "Client Call", "TODAY 15:00", "normal", join=True))
    offsite = s(kf.event("TODAY", "Company Offsite", "all day", "normal"))
    personal = s(kf.event("IN 3H", "Dentist", "TODAY 17:00", "normal"))
    team = s(kf.event("IN 25M", "Team Sync", "TODAY 14:00", "warn", join=True))
    stale = s(kf.event("IN 8M", "Retro", "TODAY 11:00", "warn", stale=True, stale_age="12m"))
    done = s(kf.message("ALL DONE", "for today"))
    agenda1 = s(kf.event("IN 45M", "Client Call", "TODAY 15:00", "normal", position="1/4"))
    agenda2 = s(kf.event("IN 2H 15M", "1:1 with Sam", "TODAY 16:00", "normal", position="2/4"))
    agenda3 = s(kf.event("IN 3H", "Dentist", "TODAY 17:00", "normal", position="3/4"))
    agenda4 = s(kf.event("IN 5H", "Retro", "TODAY 18:00", "normal", position="4/4"))
    return {
        "game": "CALENDAR", "name": "Calendar Sync Pro",
        "logo_img": glyph_logo("calendar"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "PRO",
        "os_support": "Windows and macOS",
        "os_glyphs": ["brand-windows", "brand-apple"],
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "hero_title_clean": "Calendar Sync Pro",
        "hero_title": ["Every calendar.", "One key."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "Work, personal and shared calendars, merged onto one key and counting down.",
        "bullets": ["Add every calendar you keep and read them as one",
                    "One press opens the meeting, whoever is hosting it",
                    "Turn the dial on Stream Deck+ to scroll through your day"],
        # Eleven faces on a fifteen key deck: the deck stays honestly partly lit.
        "hero_keys": [review, standup, running, quiet, client,
                      team, tomorrow, offsite, personal, agenda4, done],
        "device_photo_mockup": True,
        "bottom": [("layers-union", "All calendars", "Merged on one key"),
                   ("video", "One press", "Opens the meeting"),
                   ("rotate-360", "Dial scroll", "On Stream Deck+"),
                   ("palette", "Colour warns", "Amber to red")],
        "feature_banners": [
            ("Work and personal, on one key.",
             [team, personal, client, quiet],
             None, None,
             "Add as many calendars as you keep and they merge into a single answer. A meeting sitting in two of them still only shows once, so nothing double counts."),
            ("The meeting is one press away.",
             [running, team, client],
             None, None,
             "The Join key opens the link for whatever is next. Teams, Meet, Zoom and Webex are all found on their own, whether the invite puts the link in the location or buries it in the body."),
            ("Turn the dial, scroll your day.",
             [agenda1, agenda2, agenda3, agenda4],
             None, None,
             "On Stream Deck+ the dial scrolls through what is left, both directions, so checking what you already passed is a turn of the wrist. Press the dial to jump back to the top."),
            ("The colour tells you before the text does.",
             [quiet, review, standup, running],
             None, None,
             "Slate while there is time, amber as it closes in, red just before the start, green while it is running. Set both thresholds to whatever counts as close for you."),
            ("It handles the awkward ones.",
             [offsite, tomorrow, stale, done],
             None, None,
             "Repeating meetings, all day events, calendars written in another timezone, and a dropped connection. No countdown to midnight, and an amber bar when you are seeing cached data."),
        ],
        "statement": ["Every calendar. One key.",
                      "The meeting you miss is the one in the calendar you forgot to check. Put them all on the same key."],
        "video_scenes": [
            ("Every calendar, merged", [quiet, review, standup]),
            ("One press opens the meeting", [running, client]),
            ("The dial scrolls your day", [agenda1, agenda2, agenda3]),
            ("Calendar Sync Pro", [review, running, quiet]),
        ],
        "description": {
            "search_line": "Calendar Sync Pro for Stream Deck: merge every calendar you keep onto one key, with a live countdown to your next meeting and a one press join key.",
            "intro": "The meeting you miss is the one in the calendar you forgot to check. Calendar Sync Pro puts all of them on the same key: your next event with a live countdown that shifts colour as the time closes in, one press to open the meeting link, and work, personal and shared calendars merged into a single answer.",
            "tagline": "Every calendar. One key.",
            "features": [
                ("Every calendar on one key", "Add as many as you keep. They merge into one answer, and a meeting in two of them only shows once."),
                ("One press to join", "The Join key opens the link for your next meeting. Teams, Meet, Zoom and Webex are found automatically."),
                ("Scroll the day on a dial", "On Stream Deck+, turn the dial to move through what is left, both ways, and press it to jump back to the top."),
                ("Colour that warns you", "Slate while there is time, amber as it nears, red just before the start, green while it is running."),
                ("Checked as you add it", "Every calendar is tested the moment you paste it, so a wrong link tells you straight away instead of leaving a blank key."),
                ("Keeps working offline", "Lose connection and the key holds the last schedule it read, marked with its age, so you always know what you are looking at."),
            ],
            "outro": "Works with any calendar that gives you a link, including Google Calendar, Outlook, Apple Calendar and Fastmail. Your calendars are read on your own computer and go nowhere else.",
            "keywords": ["calendar sync", "google calendar", "outlook calendar", "next meeting", "meeting countdown", "join meeting"],
            "collection": PLUGIN_COLLECTION,
        },
    }


# ---------------------------------------------------------------- AI Usage Tracker
RELEASE_NOTES["ai-usage-tracker"] = """Initial release. Windows and macOS, every Stream Deck model.
- All eight providers in one plugin: Claude, ChatGPT, Codex, Cursor, Gemini, Copilot, Grok and Perplexity.
- Pick the provider per key, or put every one you track on a single rollup key.
- Eight display styles and three themes, the same on every provider.
- One provider going quiet leaves the other seven reading normally."""


RELEASE_NOTES["clipboard-manager"] = """Initial release. Windows and macOS, every Stream Deck model.
- Clipboard Slot: four keys give you your last four copies, slot 1 being the most recent.
- Each key previews the text it is holding, so you see what you are pasting before you press.
- A press pastes it straight in, or just puts it back on the clipboard for you to paste yourself.
- Previews are shortened to fit the key, but a press always gives you the whole thing.
- Your slots survive a restart, so what you copied yesterday is still there today.
- Copied images and files are skipped, so a screenshot never takes one of the four slots."""

RELEASE_NOTES["clipboard-manager-pro"] = """Initial release. Windows and macOS, every Stream Deck model.
- Search and paste from a rolling history of 50 recent text copies.
- Pin entries that must stay and unpin them from the same key.
- Name configured keys without changing the full value they paste.
- Paste as plain text to remove rich formatting without truncating the text.
- History and settings stay isolated from Clipboard Manager Lite."""


def ai_usage_tracker_cfg():
    # House accent, not a provider colour. This product covers eight brands, so
    # borrowing any one of their palettes would misrepresent the other seven, and
    # house rule 5 keeps third-party marks off the cover entirely. Provider names
    # appear as plain text, which is the part that is safe.
    A = tokens.ACCENT
    kf = _claude_faces()
    s = kf.spec
    roll = s(kf.rollup())
    # A provider with no reading renders as "--" rather than a guessed number. This is
    # the isolation banner's whole point, so the art has to show the real degraded cell.
    roll_degraded = s(kf.rollup([("CLAUDE", 42), ("GPT", 78), ("CODEX", 25), ("CURSOR", 61),
                                 ("GEMINI", 88), ("COPILOT", None), ("GROK", 55), ("PPLX", 33)]))
    claude_k = s(kf.ring(42, "CLAUDE", "2h 14m"))
    gpt = s(kf.ring(78, "GPT", "3d"))
    cursor = s(kf.full(61, "CURSOR", "12d"))
    gemini = s(kf.status(88, "GEMINI"))
    return {
        "game": "AI USAGE", "name": "AI Usage Tracker",
        "brand": A, "bg": BG, "icon": "", "icon_sub": "",
        "os_support": "Windows and macOS",
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "hero_title_clean": "AI Usage Tracker",
        "hero_title": ["Every AI limit.", "One deck."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "Eight AI services, live on the deck. No browser tabs.",
        "bullets": ["Claude, ChatGPT, Codex, Cursor, Gemini, Copilot, Grok and Perplexity",
                    "One key can show every service you track at once",
                    "Eight display styles and three themes on any key"],
        # 12 faces, not 15: house rule 3 keeps the deck honestly part-lit, so the
        # remaining buttons stay dark under the idle glow instead of implying the
        # product ships a full board of keys.
        "hero_keys": [
            roll, claude_k, gpt,
            cursor, s(kf.bignumber(25, "CODEX", "4h")), gemini,
            s(kf.countdown(55, "1h 20m", "GROK")), s(kf.bigtime("3d", "PPLX")),
            s(kf.sparkline(72, "CLAUDE")), s(kf.heatmap()),
            s(kf.dual(42, 78)), s(kf.ring(95, "COPILOT", "12m")),
        ],
        "device_photo_mockup": True,
        "bottom": [("layout-grid", "Eight services", "One plugin"),
                   ("chart-donut-3", "Rollup key", "All of them at once"),
                   ("palette", "Eight styles", "Ring, fill, number, more"),
                   ("shield-lock", "Stays local", "Tokens never leave your PC")],
        "feature_banners": [
            ("Every service. One key.",
             [roll, claude_k, gpt, cursor],
             None, None,
             "The rollup key stacks every service you track on one face, so a single glance covers all of them."),
            ("Pick a service per key.",
             [claude_k, gpt, s(kf.ring(25, "CODEX", "4h")), s(kf.ring(61, "CURSOR", "12d"))],
             None, None,
             "Claude, ChatGPT, Codex, Cursor, Gemini, Copilot, Grok and Perplexity. Point any key at the one you want."),
            ("Eight ways to read it.",
             [s(kf.ring(42, "CLAUDE", "2h 14m")), s(kf.full(78, "GPT", "3d")),
              s(kf.bignumber(42, "GROK", "2h 14m")), s(kf.bigtime("2h 14m", "GEMINI"))],
             None, None,
             "Ring, Full water fill, Big Number, Big Time. Short-press a key to cycle the style."),
            ("Green means keep going.",
             [s(kf.status(32, "CLAUDE")), s(kf.status(64, "GPT")),
              s(kf.status(82, "CURSOR")), s(kf.status(95, "GEMINI"))],
             None, None,
             "Safe, Moderate, Warning, Critical. The colour walks green to red so you catch it without reading a number."),
            ("One goes quiet, the rest keep reading.",
             [roll_degraded, claude_k, gpt, gemini],
             None, None,
             "If a service stops answering, only that one shows a dash. The others carry on as normal."),
        ],
        "statement": ["Every AI limit. One deck.",
                      "The limit that stops you mid-prompt is the one you could not see. Now they are all on the deck."],
        "video_scenes": [
            ("Every service on one key", [roll, claude_k]),
            ("Or a key each", [claude_k, gpt, cursor]),
            ("Eight styles, one press", [s(kf.ring(72, "CLAUDE", "1h 40m")),
                                         s(kf.bignumber(72, "CLAUDE", "1h 40m")),
                                         s(kf.status(72, "CLAUDE"))]),
            ("AI Usage Tracker", [roll, claude_k, gpt]),
        ],
        "description": {
            "search_line": "AI usage on your Stream Deck: live limits for Claude, ChatGPT, Codex, Cursor, Gemini, Copilot, Grok and Perplexity, all in one plugin.",
            "intro": "Stop guessing whether you are about to hit a wall mid-prompt. AI Usage Tracker shows your live limits for eight AI services right on your Stream Deck. Give each service its own key, or put all of them on one rollup key and read the lot at a glance.",
            "tagline": "Every AI limit. One deck.",
            "features": [
                ("Eight services, one plugin", "Claude, ChatGPT, Codex, Cursor, Gemini, Copilot, Grok and Perplexity, each with the windows that service actually reports."),
                ("The rollup key", "One key showing every service you track, as a bar each, so you can scan all of them without pressing anything."),
                ("Eight display styles", "Ring, Full water fill, Big Number, Big Time, Countdown, Sparkline, Weekly Heatmap and Status. Short-press to cycle."),
                ("Colour that warns you", "Green to amber to red as you approach a limit, so a glance is enough."),
                ("Keeps working when one does not", "If a service stops answering, only that key shows it. The rest keep reading normally."),
                ("Named accounts", "Track work, personal and client separately, per service. Paste each token once."),
            ],
            "outro": "Everything stays on your machine: tokens are read locally and never leave your PC. Some services can be detected from a CLI you already have signed in, with nothing to paste.",
            "keywords": ["AI usage", "Claude usage", "ChatGPT usage", "token usage", "AI limits", "Stream Deck"],
            "collection": PLUGIN_COLLECTION,
        },
    }


# ---------------------------------------------------------------- Neon icon packs
# Five colorways of one product, identical but for accent and name, so they share a
# single cfg factory instead of five near-duplicate functions. Accents are the same
# RGBs the pack builder uses for its own previews (PREVIEW_ACCENT_OVERRIDES in
# ../ratpack-icons/build_pack.py), so listing art and pack art cannot drift apart.
ICON_PACKS = {
    #  slug          accent RGB        colour word   the one-line look
    "neon-blue":   ((70, 150, 255),  "Blue",   "Electric blue"),
    "neon-green":  ((50, 255, 120),  "Green",  "Vivid jade"),
    "neon-pink":   ((255, 80, 170),  "Pink",   "Hot rose"),
    "neon-yellow": ((255, 215, 50),  "Yellow", "Radiant gold"),
    "neon-black":  ((80, 80, 90),    "Black",  "Deep black"),
}

# All five ship the same 572 files, so one note body serves them all; only the
# colour word changes. Defined here rather than inline in RELEASE_NOTES because
# that dict is built long before ICON_PACKS exists.
for _slug, (_a, _colour, _look) in ICON_PACKS.items():
    RELEASE_NOTES[_slug] = f"""Initial release. Every Stream Deck model, Windows and macOS.
- 500+ icons in the Neon {_colour} colorway, PNG at 144x144.
- Streaming, editing, media, system, UI, symbols and meeting controls.
- Text keys for A to Z, 0 to 99 and F1 to F24, plus short labels like LIVE, REC and MUTE.
- 50 brand logos drawn in the same style as the rest of the pack."""

def icon_pack_wall(slug: str, want: int = 240):
    """A varied sample of the pack's REAL icons for the scale banner.

    Round-robins across categories so the wall never reads as one block of 90
    brand marks. `numbers` and `letters` are skipped: 126 of the pack's 572 files
    are digits and characters, and a wall of numerals looks like padding even
    though they are genuinely useful keys.
    """
    base = ICONS_REPO / f"com.packrat.{slug}.sdIconPack" / "icons"
    skip = {"numbers", "letters", "blank"}
    buckets = [sorted(d.glob("*.png")) for d in sorted(base.iterdir())
               if d.is_dir() and d.name not in skip]
    out, i = [], 0
    while len(out) < want and any(i < len(b) for b in buckets):
        for b in buckets:
            if i < len(b) and len(out) < want:
                out.append(b[i])
        i += 1
    return out

def icon_pack_cfg(slug: str):
    accent, colour, look = ICON_PACKS[slug]
    # NO labels on these keys. place_row() burns a key's own label onto the tile
    # (banner_features_clean ignores its `labels` argument and says so), which
    # collides with a full-bleed neon glyph and, worse, advertises captions the
    # pack does not ship. The icons ARE the product, so they show unaltered.
    k = lambda rel, _label=None: icon_pack_key(slug, rel)
    # Neon Black inverts the series: dark glyphs on white tiles, not a glowing
    # colour on black. Its copy has to say so or the art contradicts the words.
    inverted = slug == "neon-black"
    surface = "crisp white tiles" if inverted else "matte black tiles"
    glow = "sharp, minimal glyphs" if inverted else "a bright LED glow"

    live = k("core10/LIVE.png", "Live")
    rec = k("core10/record.png", "Record")
    mic = k("core10/mic_mute.png", "Mute Mic")
    obs = k("core10/obs.png", "OBS")
    discord = k("core10/discord.png", "Discord")
    play = k("core10/play.png", "Play")
    settings = k("core10/settings.png", "Settings")
    sparkles = k("core10/sparkles.png", "Sparkle")
    golive = k("core10/go_live.png", "Go Live")
    heart = k("core10/heart.png", "Heart")
    brb = k("stream/brb.png", "BRB")
    scene = k("stream/scene_next.png", "Next Scene")
    cut = k("edit/cut.png", "Cut")
    undo = k("edit/undo.png", "Undo")
    render = k("edit/render.png", "Render")
    pause = k("media/pause.png", "Pause")
    vol = k("media/speaker-wave.png", "Volume")
    cam = k("media/camera.png", "Camera")
    files = k("system/files.png", "Files")
    lock = k("system/lock.png", "Lock")
    chat = k("labels/CHAT.png", "CHAT")
    clip = k("labels/CLIP.png", "CLIP")

    return {
        "game": "ICONS", "name": f"Neon {colour} Icons",
        "logo_img": glyph_logo("sparkles"),
        "brand": accent, "bg": BG, "icon": "", "icon_sub": colour.upper(),
        "os_support": "Windows + Mac",
        "hero_title_clean": f"Neon {colour} Icons",
        "hero_title": [f"{look} keys,", "every one of them."],
        "tagline": f"500+ icons on {surface}, sharp at Stream Deck key size.",
        "bullets": ["Streaming, editing, media, system and symbols, all covered",
                    "Letters A to Z, numbers, and F1 to F24 as clean text keys",
                    "50 brand logos for the apps you already use"],
        # An XL, and ALL 32 slots filled. This is a deliberate, owner-approved
        # exception to house rule 3 ("never fill all 15 deck slots"), granted
        # 2026-08-05 and scoped to icon packs only. That rule exists so a product
        # never implies it fills a deck it cannot fill. An icon pack genuinely
        # ships 572 icons, so a full deck is the honest picture and an empty key
        # actively misleads: it reads as "they ran out of icons", which is the
        # opposite of the thing being sold. Profiles and plugins keep the rule.
        "hero_deck": "xl",
        "hero_keys": [live, rec, mic, obs, discord, play, sparkles, golive,
                      cut, vol, cam, brb, scene, chat, clip, undo, render, pause,
                      files, lock, heart, settings,
                      k("brands/spotify.png"), k("brands/youtube.png"),
                      k("brands/twitch.png"), k("brands/steam.png"),
                      k("stream/raid.png"), k("system/browser.png"),
                      k("edit/export.png"), k("media/music.png"),
                      k("system/search.png"), k("stream/screenshot.png")],
        "icon_wall": (icon_pack_wall(slug), f"500+ icons, one {colour.lower()} look.",
                      "Streaming, editing, media, system, symbols, labels and 50 brand logos, "
                      "all drawn in the same style."),
        "device_photo_mockup": True,
        "bottom": [("broadcast", "Streaming", "Live and scenes"),
                   ("scissors", "Editing", "Cut to render"),
                   ("player-play", "Media", "Play and volume"),
                   ("typography", "Labels", "A to Z, F1 to F24")],
        "feature_banners": [
            (f"500+ icons in one {colour.lower()} look.", [live, rec, golive, brb, mic],
             ["LIVE", "Record", "Go Live", "BRB", "Mute"], None,
             f"Every key in the pack shares the same {look.lower()} treatment on {surface}, so a deck built from it reads as one set instead of a scrapbook."),
            ("Built for the whole workflow.", [cut, undo, render, play, vol],
             ["Cut", "Undo", "Render", "Play", "Volume"], None,
             "Streaming, editing, media transport, system controls and symbols are all in the pack, so one download covers the deck you actually use."),
            ("Letters, numbers and F-keys.", [chat, clip, k("labels/MUTE.png", "MUTE"),
                                              k("labels/REC.png", "REC"), k("labels/AFK.png", "AFK")],
             ["CHAT", "CLIP", "MUTE", "REC", "AFK"], None,
             "Short text keys are drawn to the same grid as the glyphs: A to Z, 0 to 99, F1 to F24 and the labels you reach for most, all centered and legible."),
            ("The apps you already run.", [obs, discord, k("brands/spotify.png", "Spotify"),
                                           k("brands/youtube.png", "YouTube"), k("brands/twitch.png", "Twitch")],
             ["OBS", "Discord", "Spotify", "YouTube", "Twitch"], None,
             "50 brand marks are included and drawn in the same style, so a launcher page matches the rest of your deck instead of clashing with it."),
            ("Sharp at key size.", [sparkles, heart, files, lock, scene],
             ["Sparkle", "Heart", "Files", "Lock", "Scene"], None,
             "Every icon is rendered from vector art at 144x144, the size Stream Deck actually draws, so nothing looks soft or resampled on the hardware."),
        ],
        "statement": [f"One {colour.lower()} look, across your whole deck.",
                      "500+ icons that were drawn to sit next to each other."],
        "video_scenes": [
            ("500+ icons, one look", [live, rec, golive]),
            ("Stream, edit, media, system", [cut, play, vol]),
            ("Letters and labels", [chat, clip]),
            ("Brands included", [obs, discord]),
            (f"Neon {colour} Icons", [live, sparkles, mic]),
        ],
        "description": {
            "search_line": f"Neon {colour.lower()} icons for Stream Deck: 500+ glowing {colour.lower()} icons on {surface} covering streaming, editing, media, system controls, labels and brand logos.",
            "intro": f"{look} glyphs wrapped in {glow} on {surface}, so every key reads instantly from across the room. One look for the whole deck: stream controls, editing keys, media transport and app launchers, all built to sit next to each other.",
            "tagline": "One look, across every page of your deck.",
            "features": [
                ("Streaming", "Go live, end stream, record, markers, scene and source controls, mic and camera toggles, chat and BRB."),
                ("Editing", "Cut, copy, paste, split, join, ripple delete, undo, redo, zoom, markers, nudges, render, export and import."),
                ("Media and system", "Play, pause, stop, forward, back, loop, shuffle, volume and mute, plus apps, files, downloads, settings, power and WiFi."),
                ("Labels and symbols", "Text keys for A to Z, 0 to 99 and F1 to F24, plus labels like LIVE, REC, CLIP, MUTE and CHAT."),
                ("50 brand logos included", "Steam, Epic, OBS, YouTube, Twitch, Discord, Adobe, DaVinci Resolve, Figma, VS Code and more, in the same style as the pack."),
            ],
            "outro": "PNG at 144x144, the size Stream Deck draws. To use one: select a key, click the icon, Set from File.",
            "keywords": [f"neon {colour.lower()} icons", "neon icons", f"{colour.lower()} icons",
                         "stream deck icons", "glow icons", "streaming icons"],
            "collection": ("More icon packs from Packrat, in other colours and styles, "
                           "all on the marketplace at @packrat."),
        },
    }

RELEASE_NOTES.update({
    "slot-machine": """
- Three weighted reels with a wind up, staggered stops and an extra drag on the third whenever the first two match.
- Bet levels 1 to 10 scale every payout together, so the return stays honest at every level.
- Daily bonus that grows with your level, claimable once every 24 hours.
- Runs on the Xeneon Edge in every slot size, horizontal and vertical.
""",
    "retro-terminal": """
- Boot log types itself out once on first load, then hands over to the clock.
- Scanlines, vignette and tube flicker are drawn live and each switch off on their own.
- Tap the screen to cycle the phosphor: green, amber, cyan, white, magenta.
- Your tapped colour is remembered, and the Accent Color setting still overrides it.
- Your own text on the prompt.
- Cursor blink is clock driven, so it stays at one second on any machine.
""",
    "market-command-center": """
- New in 1.0.1: setup text now says the Finnhub key for stocks costs nothing, and where to create one.

- Coins and stocks on one board, with real 7 day sparklines for crypto.
- Stocks show the true session low to high with the current price marked on it.
- Optional CoinGecko key for anyone running several widgets at once.
- Keeps the last known prices on screen when the connection drops.
""",
    "crypto-portfolio": """
- Live total value from the quantities you enter, with each position sized against the rest.
- Daily change is weighted by position size, so a large holding moves it more than a small one.
- Hide amounts with a single switch when someone is looking over your shoulder.
- Quantities never leave your PC. Only coin names go out in the price request.
""",
    "ambient-clock": """
- Four faces: Orbit sweeps three arcs, Matrix rains glyphs, Pulse breathes, Minimal steps back.
- Every face is drawn live in your own colours, at any slot size.
- Animation intensity is adjustable, and honours the system reduced motion setting.
- No network of any kind.
""",
    "perf-grapher": """
- New in 1.1.0: show readings as whole numbers, one decimal place, or two.
- New switch to turn the warning tint off without losing your warning level.
- New background transparency slider.
- Fixed a warning level of 0 being ignored and treated as 80.

- Rolling history graph per sensor, not just the current reading.
- Works with any sensor iCUE can read, each with its own colour and its window low and high.
- History survives a restart, so reopening the dashboard does not clear the graphs.
""",
    "ai-usage": """
- One ring per provider showing how much of the current window is spent.
- Live countdown to the next reset, per provider.
- Your own warning level, so the ring turns amber before you hit the wall.
- Reads from the Packrat Stream Deck plugin on the same PC. No extra sign in.
""",
    "home-assistant": """
- New in 1.0.1: setup instructions now name the exact CORS setting to change, on Home Assistant 2026.8 and newer as well as older versions.

- Any entities you list, shown in the order you wrote them.
- Lights and switches read on or off at a glance; sensors show their real units.
- Talks straight to your own server with a token you create yourself.
- Keeps the last known state on screen if the server goes away.
""",
})

# --------------------------------------------------------------- NIGHTSWORD / VSD
# Virtual Stream Deck products carry no physical device to photograph, so their
# hero art uses hero_device="none" (marketing_engine.render_vsd_panel: a real
# on-screen panel mockup, not implied hardware). See registry.json notes for
# each product's "not install-tested on real hardware" status.
MC_GREEN = (95, 180, 95)
CS2_ORANGE = (255, 140, 40)
LOL_BLUE = (30, 190, 230)
DOTA_RED = (196, 30, 30)
FL_ORANGE = (255, 130, 30)

def minecraft_cfg():
    G = MC_GREEN
    inv = key_img("backpack", fg=G, label="Inventory")
    drop = key_img("hand-off", label="Drop")
    offhand = key_img("transfer", label="Offhand")
    chat = key_img("message", label="Chat")
    cmd = key_img("terminal-2", fg=G, label="Command")
    autorun = key_img("run", fg=G, label="Auto Run")
    autoswing = key_img("sword", fg=G, label="Auto Swing")
    pickblock = key_img("color-picker", fg=G, label="Pick Block")
    h = [key_img(f"number-{n}", label=f"Hotbar {n}") for n in range(1, 10)]
    gui = key_img("eye-off", label="Toggle GUI")
    shot = key_img("camera", fg=G, label="Screenshot")
    debug = key_img("bug", fg=G, label="Debug")
    persp = key_img("camera-rotate", fg=G, label="Perspective")
    full = key_img("maximize", label="Fullscreen")
    adv = key_img("trophy", fg=G, label="Advancements")
    wiki = key_img("book", label="Wiki")
    craft = key_img("hammer", fg=G, label="Crafting")
    return {
        "game": "MINECRAFT", "name": "Minecraft",
        "brand": G, "bg": BG, "icon": "", "icon_sub": "PLAY",
        "hero_title": ["Minecraft on", "real keys."],
        "hero_title_clean": "MINECRAFT PROFILE",
        "tagline": "Auto run, auto swing, full hotbar and debug tools, one tap away.",
        "bullets": ["Auto run and auto swing toggles, plus pick block",
                    "Full 1-9 hotbar, no counting keys",
                    "Debug, screenshot, perspective and a wiki reference layer"],
        "hero_keys": [autorun, autoswing, pickblock, inv, drop, offhand, chat, cmd,
                      *h, gui, shot, debug, persp, full, adv, wiki, craft],
        "hero_panel_keys": [autorun, autoswing, pickblock, h[0], inv, debug],
        "hero_device": "vsd-dual",
        "hero_panel_cols": 3, "hero_panel_rows": 2,
        "hero_chips": ["Profile Pack", "Virtual Stream Deck"],
        "bottom": [("run", "Auto Run/Swing", "Toggle, not a macro"),
                   ("layout-grid", "Hotbar", "All 9 slots"),
                   ("bug", "Debug", "F3, screenshots, view"),
                   ("book", "Reference", "Wiki and crafting")],
        "feature_banners": [
            ("Toggle it and go.", [autorun, autoswing, pickblock],
             ["Auto Run", "Auto Swing", "Pick Block"], None,
             "Press once to hold the key down, press again to release. Not a macro, no sequences."),
            ("Everything but the keyboard.", [inv, drop, offhand, chat, cmd],
             ["Inventory", "Drop", "Offhand", "Chat", "Command"], None,
             "Java Edition's own default binds, zero setup."),
            ("Your hotbar, always in reach.", h[:5],
             ["Slot 1", "Slot 2", "Slot 3", "Slot 4", "Slot 5"], None,
             "All nine hotbar slots, one tap each, no counting keys."),
            ("Debug and capture on tap.", [debug, shot, persp, full, gui],
             ["Debug", "Screenshot", "Perspective", "Fullscreen", "Toggle GUI"], None,
             "The F-key row you keep forgetting, right on your panel."),
            ("Skip the alt-tab for the wiki.", [wiki, craft, adv],
             ["Wiki", "Crafting", "Advancements"], None,
             "Reference links for crafting, advancements and the full wiki."),
        ],
        "statement": ["Built for building, not for combat.",
                      "A utility companion, not a PvP tool. Toggles hold one real input, never chain a sequence."],
        "video_scenes": [
            ("Auto run and auto swing", [autorun, autoswing]),
            ("Inventory, drop, offhand, chat", [inv, drop, offhand, chat]),
            ("Full hotbar on tap", h[:3]),
            ("Debug, screenshot, perspective", [debug, shot, persp]),
            ("Minecraft Profile", [autorun, h[0], debug, wiki]),
        ],
        "description": {
            "search_line": "Minecraft Stream Deck profile: auto run, auto swing, "
                           "inventory, hotbar, chat, debug screen and a wiki reference "
                           "layer, on Java Edition's own default keybinds.",
            "intro": "The Minecraft shortcuts you actually use, on real keys: auto run "
                     "and auto swing toggles, pick block, inventory, drop, offhand swap, "
                     "chat, command console, the full 1-9 hotbar, debug screen, "
                     "screenshots, perspective, fullscreen and advancements, plus wiki "
                     "and crafting reference links.",
            "tagline": "Auto run, auto swing, a full hotbar and debug tools.",
            "features": [
                ("Auto run and auto swing", "Press once to hold Auto Run or Auto Swing "
                                            "down, press again to release. A toggle, not "
                                            "a macro: no sequences, no chained input."),
                ("Inventory", "Inventory, drop, offhand swap, chat, the command console and pick block."),
                ("Hotbar", "All nine hotbar slots, one tap each, no counting keys."),
                ("Display and debug", "Toggle GUI, screenshot, perspective, fullscreen "
                                      "and the F3 debug screen."),
                ("Reference layer", "One-tap links to the Minecraft Wiki, crafting "
                                    "recipes, the debug-screen field guide and advancements list."),
            ],
            "outro": "Built for building and exploring, not combat: every key is a "
                     "single tap or a single toggle of one of Minecraft's own default "
                     "binds, nothing invented, nothing chained.",
            "keywords": ["Minecraft", "Stream Deck profile", "Minecraft shortcuts",
                        "Java Edition", "crafting"],
            "collection": COLLECTION,
        },
    }

def cs2_cfg():
    O = CS2_ORANGE
    buy = key_img("shopping-bag", fg=O, label="Buy")
    score = key_img("clipboard-list", label="Scoreboard")
    allchat = key_img("message", label="All Chat")
    teamchat = key_img("messages", fg=O, label="Team Chat")
    reload = key_img("refresh", label="Reload")
    drop = key_img("hand-off", label="Drop")
    inspect = key_img("eye", label="Inspect")
    slots = [weapon_key(icon, fg=O, label=l) for icon, l in
             [("primary", "Primary"), ("secondary", "Secondary"), ("knife", "Knife"),
              ("grenade", "Grenade"), ("bomb", "Bomb")]]
    leetify = key_img("chart-bar", fg=O, label="Leetify")
    hltv = key_img("news", label="HLTV")
    return {
        "game": "CS2", "name": "CS2",
        "brand": O, "bg": BG, "icon": "", "icon_sub": "PLAY",
        "hero_title": ["CS2 on", "real keys."],
        "hero_title_clean": "CS2 PROFILE",
        "tagline": "Buy menu, scoreboard, comms and loadout slots, one tap away.",
        "bullets": ["Buy menu, scoreboard, chat and reload on real default binds",
                    "All five weapon slots, no counting keys",
                    "Leetify, HLTV and pro settings reference links"],
        "hero_keys": [buy, score, allchat, teamchat, reload, drop, inspect,
                      *slots, leetify, hltv],
        "hero_panel_keys": [buy, reload, slots[0], slots[4], score, allchat],
        "hero_device": "vsd-dual",
        "hero_panel_cols": 3, "hero_panel_rows": 2,
        "hero_chips": ["Profile Pack", "Virtual Stream Deck"],
        "bottom": [("shopping-bag", "Buy Menu", "One tap open"),
                   ("clipboard-list", "Comms", "Scoreboard and chat"),
                   ("target", "Loadout", "All 5 slots"),
                   ("chart-bar", "Stats", "Leetify and HLTV")],
        "feature_banners": [
            ("Your round, one tap away.", [buy, score, allchat, teamchat, reload],
             ["Buy", "Scoreboard", "All Chat", "Team Chat", "Reload"], None,
             "CS2's own default binds. Not bannable, not automation, just single taps."),
            ("Your loadout, laid out.", slots,
             ["Primary", "Secondary", "Knife", "Grenade", "Bomb"], None,
             "Five weapon slots, one tap each."),
            ("Drop and inspect without reaching.", [drop, inspect],
             ["Drop", "Inspect"], None,
             "The small stuff that adds up over a match."),
            ("Your stats, one tap away.", [leetify, hltv],
             ["Leetify", "HLTV"], None,
             "Post-match analysis and pro coverage, without alt-tabbing."),
        ],
        "statement": ["Single taps only. Nothing scripted, nothing chained.",
                      "Every key sends one of CS2's own default binds. No automation, no risk."],
        "video_scenes": [
            ("Buy, scoreboard, chat", [buy, score, allchat]),
            ("Full loadout on tap", slots[:3]),
            ("Drop and inspect", [drop, inspect]),
            ("Leetify and HLTV", [leetify, hltv]),
            ("CS2 Profile", [buy, score, *slots[:2]]),
        ],
        "description": {
            "search_line": "CS2 Stream Deck profile: buy menu, scoreboard, chat, reload "
                           "and all five weapon slots, on Counter-Strike 2's own default keybinds.",
            "intro": "The CS2 keys you reach for every round, on real buttons: buy menu, "
                     "scoreboard, all and team chat, reload, drop, inspect and all five "
                     "weapon slots, plus Leetify, HLTV and pro settings reference links.",
            "tagline": "Buy menu, comms, loadout slots and a stats reference layer.",
            "features": [
                ("Round essentials", "Buy menu, scoreboard, all chat and team chat, one tap each."),
                ("Loadout", "Primary, secondary, knife, grenade and bomb slots, no counting keys."),
                ("Utility", "Reload, drop and inspect, off the keyboard and onto your panel."),
                ("Reference layer", "One-tap links to Leetify, HLTV and pro settings."),
                ("Single tap, always", "Every key sends one of CS2's own default binds. "
                                       "No scripts, no chained input."),
            ],
            "outro": "Single key presses of Counter-Strike 2's own default keybinds only, "
                     "the same standard every profile in the Packrat lineup holds to.",
            "keywords": ["CS2", "Counter-Strike 2", "Stream Deck profile", "CS2 keybinds", "esports"],
            "collection": COLLECTION,
        },
    }

def lol_cfg():
    B = LOL_BLUE
    shop = key_img("shopping-bag", fg=B, label="Shop")
    recall = key_img("home", fg=B, label="Recall")
    q = key_img("letter-q", label="Q")
    w = key_img("letter-w", label="W")
    e = key_img("letter-e", label="E")
    r = key_img("letter-r", fg=B, label="R")
    sumd = key_img("letter-d", label="Summ D")
    sumf = key_img("letter-f", label="Summ F")
    items = [key_img(f"number-{n}", label=f"Item {n}") for n in range(1, 5)]
    camlock = key_img("focus-2", fg=B, label="Cam Lock")
    opgg = key_img("chart-bar", fg=B, label="OP.GG")
    return {
        "game": "LEAGUE", "name": "League of Legends",
        "brand": B, "bg": BG, "icon": "", "icon_sub": "PLAY",
        "hero_title": ["League on", "real keys."],
        "hero_title_clean": "LEAGUE OF LEGENDS PROFILE",
        "tagline": "Shop, recall, abilities and summoner spells, one tap away.",
        "bullets": ["Shop, recall and all four abilities on real default binds",
                    "Summoner spells, item slots, smart cast and self cast",
                    "Built to the same single-tap standard as our Valorant profile"],
        "hero_keys": [shop, recall, q, w, e, r, sumd, sumf, *items, camlock, opgg],
        "hero_panel_keys": [shop, recall, q, w, e, r],
        "hero_device": "vsd-dual",
        "hero_panel_cols": 3, "hero_panel_rows": 2,
        "hero_chips": ["Profile Pack", "Virtual Stream Deck"],
        "bottom": [("shopping-bag", "Shop & Recall", "Two of your most-pressed keys"),
                   ("letter-q", "Abilities", "QWER on tap"),
                   ("letter-d", "Summoners", "D and F"),
                   ("focus-2", "Camera", "Lock and stats links")],
        "feature_banners": [
            ("Shop and recall, one tap.", [shop, recall],
             ["Shop", "Recall"], None,
             "The two keys you reach for between every fight."),
            ("Your kit, laid out.", [q, w, e, r, sumd],
             ["Q", "W", "E", "R", "Summ D"], None,
             "All four abilities and both summoner spells."),
            ("Items and camera, covered.", [*items, camlock],
             ["Item 1", "Item 2", "Item 3", "Item 4", "Cam Lock"], None,
             "Item slots and camera lock, off the keyboard."),
            ("Built like our Valorant profile.", [q, w, e, r],
             ["Q", "W", "E", "R"], None,
             "Same single-tap standard, same no-automation rule."),
        ],
        "statement": ["Single taps only. Nothing scripted, nothing chained.",
                      "Built to the exact same standard as our shipping Valorant profile."],
        "video_scenes": [
            ("Shop and recall", [shop, recall]),
            ("Full ability kit", [q, w, e, r]),
            ("Summoner spells and items", [sumd, sumf, items[0]]),
            ("Camera and stats", [camlock, opgg]),
            ("League of Legends Profile", [shop, q, r, recall]),
        ],
        "description": {
            "search_line": "League of Legends Stream Deck profile: shop, recall, "
                           "abilities, summoner spells and item slots, on Riot's own default keybinds.",
            "intro": "The League of Legends keys you reach for constantly, on real "
                     "buttons: shop, recall, all four abilities, both summoner spells, "
                     "item slots, smart cast toggles, self cast and camera lock.",
            "tagline": "Shop, recall, your full kit and camera lock, one tap away.",
            "features": [
                ("Core kit", "Shop, recall and all four abilities, Q, W, E and R."),
                ("Summoner spells", "Both summoner spell slots, D and F."),
                ("Items", "Four item slots, no reaching across the keyboard mid fight."),
                ("Smart cast and self cast", "Toggle keys for smart cast and self cast on your core abilities."),
                ("Camera", "One-tap camera lock, plus OP.GG and U.GG reference links."),
            ],
            "outro": "Built to the identical single-tap standard as our shipping "
                     "Valorant profile: one key, one default bind, every time.",
            "keywords": ["League of Legends", "LoL Stream Deck", "Stream Deck profile",
                        "LoL keybinds", "MOBA"],
            "collection": COLLECTION,
        },
    }

def dota2_cfg():
    R = DOTA_RED
    q = key_img("letter-q", label="Q")
    w = key_img("letter-w", label="W")
    e = key_img("letter-e", label="E")
    r = key_img("letter-r", fg=R, label="R")
    atk = key_img("swords", fg=R, label="Attack Move")
    stop = key_img("player-stop", label="Stop")
    hold = key_img("shield-half", fg=R, label="Hold")
    cam = key_img("focus-2", fg=R, label="Center Cam")
    dotabuff = key_img("chart-bar", fg=R, label="Dotabuff")
    opendota = key_img("chart-bar", label="OpenDota")
    return {
        "game": "DOTA 2", "name": "Dota 2",
        "brand": R, "bg": BG, "icon": "", "icon_sub": "PLAY",
        "hero_title": ["Dota 2 on", "real keys."],
        "hero_title_clean": "DOTA 2 PROFILE",
        "tagline": "Abilities, attack move, stop and hold, one tap away.",
        "bullets": ["All four abilities on real default binds",
                    "Attack move, stop, hold and center camera",
                    "Dotabuff and OpenDota reference links"],
        "hero_keys": [q, w, e, r, atk, stop, hold, cam, dotabuff, opendota],
        "hero_panel_keys": [q, w, e, r, atk, cam],
        "hero_device": "vsd-dual",
        "hero_panel_cols": 3, "hero_panel_rows": 2,
        "hero_chips": ["Profile Pack", "Virtual Stream Deck"],
        "bottom": [("letter-q", "Abilities", "QWER on tap"),
                   ("swords", "Commands", "Attack, stop, hold"),
                   ("focus-2", "Camera", "Center on hero"),
                   ("chart-bar", "Stats", "Dotabuff and OpenDota")],
        "feature_banners": [
            ("Your kit, laid out.", [q, w, e, r],
             ["Q", "W", "E", "R"], None,
             "All four abilities, one tap each."),
            ("Commands your hero already knows.", [atk, stop, hold, cam],
             ["Attack Move", "Stop", "Hold", "Center Cam"], None,
             "Defaults stable since the original mod. Nothing guessed."),
            ("Your stats, one tap away.", [dotabuff, opendota],
             ["Dotabuff", "OpenDota"], None,
             "Match history and hero stats, without alt-tabbing."),
        ],
        "statement": ["Valve's own rules: remapping is fine, scripting is not.",
                      "Every key is a single tap of one of Dota 2's own default binds."],
        "video_scenes": [
            ("Full ability kit", [q, w, e, r]),
            ("Attack, stop, hold", [atk, stop, hold]),
            ("Center camera", [cam]),
            ("Dotabuff and OpenDota", [dotabuff, opendota]),
            ("Dota 2 Profile", [q, r, atk, cam]),
        ],
        "description": {
            "search_line": "Dota 2 Stream Deck profile: abilities, attack move, stop, "
                           "hold and center camera, on Dota 2's own default keybinds.",
            "intro": "The Dota 2 commands you use constantly, on real buttons: all four "
                     "abilities, attack move, stop, hold position and center camera, "
                     "plus Dotabuff and OpenDota reference links.",
            "tagline": "Your full ability kit and hero commands, one tap away.",
            "features": [
                ("Abilities", "Q, W, E and R, one tap each."),
                ("Hero commands", "Attack move, stop and hold position, defaults stable since the original mod."),
                ("Camera", "Center camera on your hero without reaching for the keyboard."),
                ("Reference layer", "One-tap links to Dotabuff and OpenDota for match and hero stats."),
            ],
            "outro": "Valve's own developer forum permits hotkey remapping and only "
                     "bans scripts that automate ability combos; this profile is single "
                     "taps only, nothing scripted.",
            "keywords": ["Dota 2", "Dota Stream Deck", "Stream Deck profile", "Dota keybinds", "MOBA"],
            "collection": COLLECTION,
        },
    }

def flstudio_cfg():
    O = FL_ORANGE
    play = key_img("player-play", fg=(110, 230, 140), label="Play")
    playlist = key_img("playlist", fg=O, label="Playlist")
    stepseq = key_img("grid-dots", fg=O, label="Step Seq")
    pianoroll = key_img("piano", fg=O, label="Piano Roll")
    browser = key_img("folder", fg=O, label="Browser")
    samples = key_img("music", fg=O, label="Samples")
    mixer = key_img("adjustments", fg=O, label="Mixer")
    midi = key_img("settings", label="MIDI")
    arrange = key_img("layout-grid", label="Arrange")
    manual = key_img("book", label="Manual")
    return {
        "game": "FL STUDIO", "name": "FL Studio",
        "brand": O, "bg": BG, "icon": "", "icon_sub": "CREATE",
        "hero_title": ["FL Studio on", "real keys."],
        "hero_title_clean": "FL STUDIO PROFILE",
        "tagline": "Playlist, piano roll, mixer and browser, one tap away.",
        "bullets": ["Every window switch on Image-Line's own default binds",
                    "Playlist, step sequencer, piano roll, browser and mixer",
                    "Built for a workflow that never stops switching views"],
        "hero_keys": [play, playlist, stepseq, pianoroll, browser, samples, mixer, midi, arrange, manual],
        "hero_panel_keys": [play, playlist, pianoroll, mixer, browser, arrange],
        "hero_device": "vsd-dual",
        "hero_panel_cols": 3, "hero_panel_rows": 2,
        "hero_chips": ["Profile Pack", "Virtual Stream Deck"],
        "bottom": [("playlist", "Playlist", "F5 one tap"),
                   ("piano", "Piano Roll", "F7 one tap"),
                   ("adjustments", "Mixer", "F9 one tap"),
                   ("folder", "Browser", "Plugins and samples")],
        "feature_banners": [
            ("Every window, one tap.", [playlist, stepseq, pianoroll, browser, mixer],
             ["Playlist", "Step Seq", "Piano Roll", "Browser", "Mixer"], None,
             "Image-Line's own default window-switch binds."),
            ("Play without reaching for space bar.", [play, arrange, midi],
             ["Play", "Arrange", "MIDI"], None,
             "Transport and workspace controls on your panel."),
            ("Samples without the hunt.", [browser, samples],
             ["Browser", "Samples"], None,
             "Jump straight to your plugin or sample browser."),
            ("Learn it faster.", [manual],
             ["Manual"], None,
             "One tap to Image-Line's own online manual."),
        ],
        "statement": ["Built for the workflow, not just the shortcuts.",
                      "FL Studio never stops switching views. Now neither does your hand leave the mouse."],
        "video_scenes": [
            ("Playlist, step seq, piano roll", [playlist, stepseq, pianoroll]),
            ("Browser and mixer", [browser, mixer]),
            ("Play and arrange", [play, arrange]),
            ("Samples and manual", [samples, manual]),
            ("FL Studio Profile", [playlist, pianoroll, mixer]),
        ],
        "description": {
            "search_line": "FL Studio Stream Deck profile: playlist, step sequencer, "
                           "piano roll, mixer, browser and MIDI settings, on Image-Line's "
                           "own default keybinds.",
            "intro": "The FL Studio window switches you make constantly, on real "
                     "buttons: playlist, step sequencer, piano roll, plugin and sample "
                     "browser, mixer, MIDI settings and window arrangement.",
            "tagline": "Every FL Studio window, one tap away.",
            "features": [
                ("Core windows", "Playlist, step sequencer, piano roll, browser and mixer, each on its own key."),
                ("Transport", "Play and pause without leaving your MIDI controller."),
                ("Samples", "A dedicated key for your sample browser, separate from the plugin picker."),
                ("Workspace", "MIDI settings and arrange windows, one tap each."),
                ("Reference", "One tap to Image-Line's own online manual."),
            ],
            "outro": "Every key here is a confirmed default from Image-Line's own manual, "
                     "nothing guessed.",
            "keywords": ["FL Studio", "FL Studio Stream Deck", "Stream Deck profile",
                        "music production", "DAW shortcuts"],
            "collection": COLLECTION,
        },
    }

def wow_vsd_cfg():
    """Split out of world-of-warcraft 2026-08-17 after Elgato rejected that listing
    for tagging the Corsair mice with no profile built for them. Same utility-layer
    positioning as the desk-deck product (never a rotation helper), reflowed flat
    across the 64-key panel, so the pitch leads on everything being visible at once
    rather than on freeing up action bar space."""
    A = WOW_GOLD
    char = key_img("user", fg=A, label="Character")
    spells = key_img("book", fg=A, label="Spells")
    talents = key_img("hierarchy", fg=A, label="Talents")
    ach = key_img("trophy", fg=A, label="Achieve")
    mp = key_img("map-2", fg=A, label="Map")
    bags = key_img("backpack", label="Bags")
    mounts = key_img("horse", fg=A, label="Mounts")
    finder = key_img("users-group", fg=A, label="Group Finder")
    guild = key_img("shield", fg=A, label="Guild")
    ready = key_img("circle-check", fg=(110, 230, 140), label="Ready Check")
    chat = key_img("message", label="Chat")
    hide = key_img("eye-off", label="Hide UI")
    bars = [key_img(f"number-{n}", label=f"Bar {n}") for n in range(1, 7)]
    wowhead = key_img("world", label="Wowhead")
    rio = key_img("chart-bar", fg=A, label="Raider IO")
    logs = key_img("file-analytics", fg=A, label="Logs")
    patch = key_img("news", fg=A, label="Patch")
    return {
        "game": "WARCRAFT", "name": "World of Warcraft VSD Profile",
        "bg_opacity": 0.8,
        "brand": A, "bg": BG, "icon": "", "icon_sub": "MMO",
        "hero_title": ["Warcraft on", "real keys."],
        "hero_title_clean": "WARCRAFT PROFILE",
        "tagline": "Every panel, your whole action bar and a ready check, all on one screen.",
        "bullets": ["Every interface panel on its own key, no folders",
                    "All twelve action bar slots, hearthstone and mounts included",
                    "Ready check the group without touching the keyboard"],
        "hero_keys": [char, spells, talents, ach, mp, bags, mounts, finder, guild,
                      ready, chat, hide, *bars, wowhead, rio, logs, patch],
        "hero_panel_keys": [char, mounts, ready, bars[0], mp, spells],
        "hero_device": "vsd-dual",
        "hero_panel_cols": 3, "hero_panel_rows": 2,
        "hero_chips": ["Profile Pack", "Virtual Stream Deck"],
        "bottom": [("user", "Panels", "One key each"),
                   ("number-1", "Action Bar", "All twelve"),
                   ("circle-check", "Raid", "Ready check"),
                   ("world", "Reference", "Wowhead, logs")],
        "feature_banners": [
            ("Every panel, one key.", [char, spells, talents, ach, mp],
             ["Character", "Spells", "Talents", "Achieve", "Map"], None,
             "Character, spellbook, talents, achievements and the map, no key hunt."),
            ("Free up your action bars.", [bars[0], bars[1], bars[2], bars[3], mounts],
             ["Bar 1", "Bar 2", "Bar 3", "Bar 4", "Mounts"], None,
             "Park your hearthstone, mount and flasks on a bar slot and press them here."),
            ("Ready check the group.", [ready, finder, guild, chat],
             ["Ready Check", "Group Finder", "Guild", "Chat"], None,
             "Pull the whole raid's status with one press, then queue and chat too."),
            ("Look it up mid pull.", [wowhead, rio, logs, patch],
             ["Wowhead", "Raider IO", "Logs", "Patch Notes"], None,
             "Wowhead, Raider.IO, Warcraft Logs and the patch notes, one tap each."),
        ],
        "statement": ["A utility layer, not a rotation.",
                      "Panels, bars and a ready check. Nothing here plays the game for you."],
        "video_scenes": [
            ("Every panel on one screen", [char, spells, talents, mp]),
            ("Your whole action bar", [bars[0], bars[1], bars[2]]),
            ("Ready check the raid", [ready, finder]),
            ("Warcraft Profile", [char, mounts, ready, bars[0]]),
        ],
        "description": {
            "search_line": "World of Warcraft profile for the Virtual Stream Deck: every "
                           "interface panel, all twelve action bar slots, ready check, "
                           "mounts, group finder and Wowhead links, on one screen.",
            "intro": "The World of Warcraft panels you open a hundred times a session, "
                     "laid out flat on the on-screen panel your mouse unlocks: character, "
                     "spellbook, talents, achievements, map, bags, mounts, group finder "
                     "and guild, plus your entire twelve slot action bar and a one press "
                     "ready check. No folders, because there is room for all of it at once.",
            "tagline": "Panels, your action bar and a ready check, all on one screen.",
            "features": [
                ("Panels", "Character, spellbook, talents, achievements, map, bags, "
                           "mounts, group finder and guild."),
                ("Action bar", "All twelve primary slots, so a hearthstone or mount "
                               "parked there is one press away."),
                ("Ready check", "Pull the whole group's status without touching the keyboard."),
                ("Reference", "Wowhead, Raider.IO, Warcraft Logs and the official patch notes."),
                ("Zero setup", "Every key uses WoW's own default bindings, so it works "
                               "the moment you import it."),
            ],
            "outro": "This is a utility layer, not a rotation helper. One press sends one "
                     "key and nothing here automates play.",
            "keywords": ["World of Warcraft", "WoW", "Stream Deck profile", "MMO",
                         "action bar", "ready check"],
            "collection": COLLECTION,
        },
    }

def osrs_vsd_cfg():
    """Split out of osrs 2026-08-17, same reason as wow_vsd_cfg. Keeps the parent's
    positioning (lead on the REFERENCE LAYER, which Rune Nav lacks), but the Guide
    page is no longer a folder: the 64-key panel shows tabs and tools together."""
    A = OSRS_GOLD
    bag = key_img("backpack", label="Bag")
    combat = key_img("sword", fg=A, label="Combat")
    skills = key_img("chart-bar", fg=A, label="Skills")
    quests = key_img("book", fg=A, label="Quests")
    gear = key_img("shirt", fg=A, label="Gear")
    prayer = key_img("sparkles", fg=A, label="Prayer")
    magic = key_img("wand", fg=A, label="Magic")
    clan = key_img("users-group", fg=A, label="Clan")
    friends = key_img("user", label="Friends")
    emotes = key_img("mood-smile", fg=A, label="Emotes")
    wiki = key_img("book", label="Wiki")
    mp = key_img("map-2", fg=A, label="World Map")
    prices = key_img("coins", fg=A, label="GE Prices")
    hi = key_img("trophy", fg=A, label="Hiscores")
    dps = key_img("sword", fg=A, label="DPS Calc")
    wom = key_img("chart-line", fg=A, label="Wise Old Man")
    temple = key_img("flame", fg=A, label="Temple")
    worlds = key_img("server", label="Worlds")
    news = key_img("news", fg=A, label="News")
    return {
        "game": "OLD SCHOOL", "name": "OSRS VSD Profile",
        "bg_opacity": 0.8,
        "brand": A, "bg": BG, "icon": "", "icon_sub": "OSRS",
        "hero_title": ["Every tab and", "every tool."],
        "hero_title_clean": "OSRS PROFILE",
        "tagline": "All thirteen tabs and the whole reference layer, on one screen.",
        "bullets": ["GE prices, DPS calculator and XP tracking one press away",
                    "All thirteen interface tabs on their own keys",
                    "Tabs and tools together, no folder to open"],
        "hero_keys": [bag, combat, skills, quests, gear, prayer, magic, clan,
                      friends, emotes, prices, mp, hi, wom, dps, temple, wiki,
                      worlds, news],
        "hero_panel_keys": [bag, prayer, prices, mp, combat, wom],
        "hero_device": "vsd-dual",
        "hero_panel_cols": 3, "hero_panel_rows": 2,
        "hero_chips": ["Profile Pack", "Virtual Stream Deck"],
        "bottom": [("coins", "Prices", "GE, one press"),
                   ("chart-line", "Tracking", "XP and records"),
                   ("backpack", "Tabs", "All thirteen"),
                   ("map-2", "Map", "Full world map")],
        "feature_banners": [
            ("Your second monitor, on the panel.", [prices, dps, wom, temple, hi],
             ["GE Prices", "DPS Calc", "Wise Old Man", "Temple", "Hiscores"], None,
             "Grand Exchange prices, DPS calculator, XP tracking and hiscores, one press each."),
            ("Every tab, its own key.", [bag, combat, skills, prayer, magic],
             ["Bag", "Combat", "Skills", "Prayer", "Magic"], None,
             "Inventory, combat, skills, prayer and spellbook without moving the mouse."),
            ("Look it up mid grind.", [wiki, mp, quests, worlds, news],
             ["Wiki", "World Map", "Quests", "Worlds", "News"], None,
             "The wiki, a full world map, the quest list, world switcher and official news."),
            ("The rest of the interface.", [gear, clan, friends, emotes],
             ["Gear", "Clan", "Friends", "Emotes"], None,
             "Worn equipment, clan chat, friends and emotes, all one tap."),
        ],
        "statement": ["Prices, DPS and XP on tap.",
                      "The tabs every OSRS profile has, plus the tools none of them do."],
        "video_scenes": [
            ("GE prices and DPS calc", [prices, dps]),
            ("XP tracking and records", [wom, temple, hi]),
            ("Every interface tab", [bag, combat, prayer, magic]),
            ("OSRS Profile", [bag, prayer, prices, mp]),
        ],
        "description": {
            "search_line": "OSRS profile for the Virtual Stream Deck: every Old School "
                           "RuneScape interface tab plus Grand Exchange prices, DPS "
                           "calculator, XP tracking, world map and hiscores, on one screen.",
            "intro": "Every Old School RuneScape interface tab on its own key, plus the "
                     "sites you keep on a second monitor: Grand Exchange prices, the DPS "
                     "calculator, Wise Old Man XP tracking, TempleOSRS, a full world map, "
                     "the quest list, hiscores and the world switcher. The on-screen panel "
                     "your mouse unlocks has room for the tabs and the tools at once, so "
                     "there is no Guide folder to open first.",
            "tagline": "All thirteen tabs, plus prices, DPS and XP tracking.",
            "features": [
                ("Reference", "Grand Exchange prices, DPS calculator, Wise Old Man, "
                              "TempleOSRS and hiscores."),
                ("Tabs", "Inventory, combat, skills, quests, equipment, prayer, "
                         "spellbook and clan chat."),
                ("More tabs", "Friends, account, settings, emotes and music, each on "
                              "its own key."),
                ("Look it up", "The wiki, a full interactive world map, the quest list, "
                               "world switcher and official news."),
                ("Zero setup", "Matches the game's default function key layout, so it "
                               "works the moment you import it."),
            ],
            "outro": "If you have rebound a tab, change that one key in the Stream Deck "
                     "app to match.",
            "keywords": ["Old School RuneScape", "OSRS", "Stream Deck profile",
                         "RuneScape", "Grand Exchange", "keybinds"],
            "collection": COLLECTION,
        },
    }

RELEASE_NOTES.update({
    "calendar": """Initial release. Windows and macOS.
- Next Meeting: the next thing on your calendar with a live countdown on one key.
- The key turns amber as the start closes in, red just before it, and green while the meeting runs.
- Agenda: everything left on your day, one at a time. Press to step to the next.
- Works with any calendar that gives you a private iCal link, including Google, Outlook and Apple.
- Handles repeating meetings, moved and cancelled ones, all day events and other timezones.
- Keeps showing the last schedule it read when the connection drops, with its age on the key.""",
    "minecraft": """Initial release. Virtual Stream Deck only.
- Inventory, drop, offhand swap, chat and the command console on Java Edition's own default binds.
- The full 1-9 hotbar, one tap per slot.
- Toggle GUI, screenshot, perspective, fullscreen, debug screen and advancements.
- Wiki, crafting recipe, debug-screen guide and advancements-list reference links.""",
    "cs2": """Initial release. Virtual Stream Deck only, Windows.
- Buy menu, scoreboard, all chat, team chat and reload on CS2's own default binds.
- All five weapon slots: primary, secondary, knife, grenade and bomb.
- Drop and inspect.
- Leetify, HLTV and pro settings reference links.""",
    "league-of-legends": """Initial release. Virtual Stream Deck only.
- Shop, recall and all four abilities (Q/W/E/R) on League's own default binds.
- Both summoner spells, four item slots, smart cast toggles and self cast.
- Camera lock, plus OP.GG and U.GG reference links.
- Built to the same single-tap standard as our Valorant profile.""",
    "dota2": """Initial release. Virtual Stream Deck only.
- All four abilities (Q/W/E/R) on Dota 2's own default binds.
- Attack move, stop, hold position and center camera.
- Dotabuff and OpenDota reference links.""",
    "fl-studio": """Initial release. Virtual Stream Deck only.
- Playlist, step sequencer, piano roll, browser and mixer, each on its own key.
- Play/pause, sample browser, MIDI settings and arrange windows.
- One-tap link to Image-Line's own online manual.""",
    "world-of-warcraft-vsd": """Initial release. Virtual Stream Deck only, Windows and macOS.
- Every interface panel on its own key: character, spellbook, talents, achievements, map, bags, mounts, group finder and guild.
- All twelve action bar slots, so a hearthstone or mount parked there is one press away.
- Ready check the whole group without touching the keyboard.
- Wowhead, Raider.IO, Warcraft Logs and the official patch notes.
- Laid out flat across the panel, no folders to open.
- A utility layer only. One press sends one key, and nothing here automates play.""",
    "osrs-vsd": """Initial release. Virtual Stream Deck only, Windows and macOS.
- All thirteen interface tabs on their own keys, on the game's own default function key layout.
- Grand Exchange prices, DPS calculator, Wise Old Man, TempleOSRS and hiscores.
- The wiki, a full world map, the quest list, world switcher and official news.
- Tabs and reference tools together on one screen, no Guide folder to open first.""",
})

def _resolve_keys():
    """Key faces shared by both DaVinci tiers, so the two listings show the same
    product and the Lite art is a genuine subset of the Pro art."""
    A = DAVINCI_ORANGE
    k = lambda i, lbl, fg=A: key_img(i, fg=fg, label=lbl)
    return {
        "blade": k("cut", "Blade"), "select": k("pointer", "Select"),
        "split": k("slash", "Split"), "ripple": k("trash", "Ripple Del"),
        "marker": k("flag", "Marker"), "snap": k("magnet", "Snap"),
        "trim": k("scissors", "Trim"), "fit": k("zoom-scan", "Zoom Fit"),
        "j": key_img("player-play", flip=True, label="Rev"),
        "kk": key_img("player-stop", label="Stop"),
        "l": key_img("player-play", label="Play"),
        "inb": k("arrow-bar-to-left", "In"), "outb": k("arrow-bar-to-right", "Out"),
        "ins": k("row-insert-bottom", "Insert"), "ovr": k("layers-intersect", "Overwrite"),
        "rep": k("repeat", "Replace"), "top": k("arrow-up", "Place Top"),
        "app": k("plus", "Append"), "trans": k("transition-right", "Transition"),
        "retime": k("clock-play", "Retime"),
        "serial": k("binary-tree", "Serial"), "parallel": k("hierarchy-2", "Parallel"),
        "layer": k("stack-2", "Layer"), "bypass": k("eye-off", "Bypass"),
        "plights": k("bulb", "Printer Lights"),
        "master": key_img("brightness", label="Master"),
        "red": key_img("circle", fg=(255, 80, 80), label="Red"),
        "green": key_img("circle", fg=(80, 230, 120), label="Green"),
        "blue": key_img("circle", fg=(90, 160, 255), label="Blue"),
        "mema": k("circle-letter-a", "Memory A"), "grab": k("copy", "Grab Grade"),
        "back": key_img("arrow-back-up", fg=(150, 154, 164), label="Back", nav=True),
        "prevnode": key_img("chevron-left", fg=A, label="Prev Node"),
        "nextnode": key_img("chevron-right", fg=A, label="Next Node"),
        "gEdit": key_img("cut", fg=A, label="Edit", nav=True),
        "gAsm": key_img("bolt", fg=A, label="Assembly", nav=True),
        "gColor": key_img("palette", fg=A, label="Color", nav=True),
        "gGrade": key_img("wand", fg=A, label="Grade", nav=True),
    }


# ---------------------------------------------------------------- Calendar
CALENDAR_SCRIPTS = ROOT.parent / "plugins" / "calendar" / "scripts"

def _calendar_faces():
    """Calendar renders its keys as SVG at runtime, so there is no static art for
    plugin_key() to read. plugins/calendar/scripts/key_faces.py mirrors face.ts and is
    the single source of truth for listing art, same arrangement as Claude Usage."""
    import importlib.util
    p = CALENDAR_SCRIPTS / "key_faces.py"
    spec = importlib.util.spec_from_file_location("calendar_key_faces", p)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod


def calendar_cfg():
    A = tokens.ACCENT
    kf = _calendar_faces()
    s = kf.spec
    # No spec labels anywhere. These faces render their own title and time inside the
    # 144px art, so a label underneath would just repeat them; the captions do the
    # naming instead. Same reasoning as Claude Usage.
    review = s(kf.event("IN 5M", "Design Review", "TODAY 14:30", "warn"))
    standup = s(kf.event("IN 1M", "Standup", "TODAY 09:30", "imminent"))
    running = s(kf.event("NOW", "Sprint Planning", "TODAY 10:00", "now", join=True))
    quiet = s(kf.event("IN 2H 15M", "1:1 with Sam", "TODAY 16:00", "normal"))
    tomorrow = s(kf.event("IN 12H 45M", "Quarterly Planning", "TOMORROW 09:00", "normal"))
    client = s(kf.event("IN 45M", "Client Call", "TODAY 15:00", "normal", position="2/4", join=True))
    offsite = s(kf.event("TODAY", "Company Offsite", "all day", "normal"))
    stale = s(kf.event("IN 8M", "Retro", "TODAY 11:00", "warn", stale=True, stale_age="12m"))
    # The offline banner has to compare like with like, so it uses one event twice, on the
    # slate band. On the amber band the stale bar and its age are amber against amber and
    # the whole point of the comparison disappears.
    offline_lost = s(kf.event("IN 2H 15M", "1:1 with Sam", "TODAY 16:00", "normal",
                              stale=True, stale_age="12m"))
    offline_ok = s(kf.event("IN 2H 15M", "1:1 with Sam", "TODAY 16:00", "normal"))
    nothing = s(kf.message("NOTHING", "scheduled"))
    done = s(kf.message("ALL DONE", "for today"))
    agenda1 = s(kf.event("IN 45M", "Client Call", "TODAY 15:00", "normal", position="1/3"))
    agenda2 = s(kf.event("IN 2H 15M", "1:1 with Sam", "TODAY 16:00", "normal", position="2/3"))
    agenda3 = s(kf.event("IN 5H", "Retro", "TODAY 18:00", "normal", position="3/3"))
    return {
        "game": "CALENDAR", "name": "Calendar Sync Lite",
        "logo_img": glyph_logo("calendar"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "LITE",
        "os_support": "Windows and macOS",
        "os_glyphs": ["brand-windows", "brand-apple"],
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        # Lite is in the cover title and on the search icon on purpose (owner, 2026-08-11):
        # the upgrade should stay visible instead of being discovered by accident.
        "hero_title_clean": "Calendar Sync Lite",
        "hero_title": ["Never miss the", "start again."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "Your next meeting on a key, counting down, changing colour as it gets close.",
        "bullets": ["The next thing on your calendar, with a live countdown",
                    "Amber as it nears, red just before, green while it runs",
                    "Step through the rest of your day one key press at a time"],
        # Ten distinct faces on a fifteen key deck: every state the plugin really has,
        # no duplicates, and the deck stays honestly partly lit.
        "hero_keys": [review, standup, running, quiet, client,
                      tomorrow, offsite, stale, nothing, done],
        "device_photo_mockup": True,
        "bottom": [("clock", "Countdown", "Live on the key"),
                   ("palette", "Colour warns", "Amber to red"),
                   ("list-check", "Your whole day", "One key at a time"),
                   ("calendar", "Any calendar", "Google, Outlook, Apple")],
        "feature_banners": [
            ("The colour tells you before the text does.",
             [quiet, review, standup, running],
             None, None,
             "Slate while there is time, amber as it closes in, red just before the start, green while it is running. Set both thresholds to whatever counts as close for you."),
            ("What is next, and how long have you got.",
             [review, quiet, tomorrow],
             None, None,
             "One key answers the question you keep alt-tabbing to check. It counts down on its own and flips to the next meeting the moment one ends."),
            ("Step through the rest of your day.",
             [agenda1, agenda2, agenda3],
             None, None,
             "The Agenda key shows everything you have left, one at a time. Press to move to the next, and the counter in the corner tells you where you are."),
            ("It handles the awkward ones.",
             [offsite, tomorrow, nothing, done],
             None, None,
             "Repeating meetings, ones that got moved or cancelled, all day events, and calendars written in another timezone. No countdown to midnight, and a calm key when the day is done."),
            # Labels stay None: banner_features_clean ignores them by design, because these
            # faces already carry their own text. The pair is one event shown twice, so the
            # amber bar and its age are the only difference and the caption names it.
            ("It keeps working when the wifi does not.",
             [offline_ok, offline_lost],
             None, None,
             "Lose connection and the key holds the last schedule it read, marked with an amber bar and how old it is, so you always know what you are looking at."),
        ],
        "statement": ["Never miss the start again.",
                      "The meeting you forget is the one you could not see coming. Now it is on the deck, counting down."],
        "video_scenes": [
            ("What is next, counting down", [quiet, review]),
            ("Colour warns you before the text", [review, standup, running]),
            ("Your whole day, one key", [agenda1, agenda2, agenda3]),
            ("Calendar Sync Lite", [review, running, quiet]),
        ],
        "description": {
            "search_line": "Calendar Sync Lite for Stream Deck: your next meeting on a key with a live countdown, and a colour that changes as the start gets close.",
            "intro": "Meetings get missed because nothing tells you one is about to start. Calendar Sync Lite puts the next thing on your schedule on a Stream Deck key and counts down to it, shifting from amber to red as the time closes in, so you catch it from across the room without alt-tabbing to check.",
            "tagline": "Never miss the start again.",
            "features": [
                ("Next Meeting", "The next thing on your calendar with a live countdown, refreshing on its own. A meeting already running stays on the key instead of vanishing."),
                ("Colour that warns you", "Slate while there is time, amber as it nears, red just before the start, green while it runs. Both thresholds are yours to set."),
                ("Agenda", "Everything left on your day, one at a time. Press to step to the next, with a counter showing where you are."),
                ("Any calendar", "Works with Google Calendar, Outlook, Apple Calendar, Fastmail and anything else that gives you a private iCal link."),
                ("Gets the hard parts right", "Repeating meetings, moved and cancelled ones, all day events, and calendars written in another timezone."),
                ("Keeps working offline", "Lose connection and the key holds the last schedule it read, marked with its age so you know it is not current."),
            ],
            "outro": "Paste your calendar link once and the settings panel tells you straight away whether it worked. Windows and macOS.",
            "keywords": ["calendar", "next meeting", "meeting countdown", "schedule", "google calendar",
                         "outlook calendar", "agenda", "Stream Deck plugin"],
            "collection": PLUGIN_COLLECTION,
        },
    }


def davinci_lite_cfg():
    """The gated product's actual archive supplies every mockup key and position."""
    import zipfile

    prod = _registry()["davinci-resolve-lite"]
    root = ROOT.parent / prod["paths"]["dir"]
    K = {}

    def layout(variant, cols, rows):
        with zipfile.ZipFile(root / prod["variant_files"][variant]) as z:
            pages = [n for n in z.namelist() if n.endswith("/manifest.json")
                     and n.count("/") == 4]
            if len(pages) != 1:
                raise ValueError("Rebuild gated DaVinci Lite before generating marketing")
            page = _json.loads(z.read(pages[0]))
            actions = next(c["Actions"] for c in page["Controllers"] if c["Type"] == "Keypad")
            blank = {"kind": "image", "img": Image.open(io.BytesIO(
                z.read(pages[0].replace("manifest.json", "Images/black.png")))).copy()}
            grid = [blank] * (cols * rows)
            for pos, action in actions.items():
                state = action["States"][0]
                icon = Path(state["Image"]).stem
                face = {"kind": "image", "img": Image.open(io.BytesIO(
                    z.read(pages[0].replace("manifest.json", state["Image"])))).copy(),
                        "label": state["Title"].replace("\n", " ")}
                K[icon] = face
                col, row = map(int, pos.split(","))
                grid[row * cols + col] = face
            return grid

    mk = layout("std_win", 5, 3)
    xl = layout("xl_win", 8, 4)
    plus = layout("plus_win", 4, 2)
    return {
        "game": "RESOLVE", "name": prod["name"], "hero_watermark": False,
        "logo_img": "",  # Nominative title only; no third-party logo on the cover.
        "brand": DAVINCI_ORANGE, "bg": BG, "icon": "", "icon_sub": "LITE",
        "hero_title": [prod["name"]], "hero_title_clean": prod["name"],
        "tagline": "Playback and marking on real labeled keys.",
        "bullets": ["MK.2 and XL: rewind, stop, play and mark your footage",
                    "Plus: select, mark, set in and out, zoom fit and one Scrub dial",
                    "One page, using Resolve's default shortcuts"],
        "hero_keys": mk,
        "hero_lineup": [("plus_v3", plus, None, ["Scrub", "", "", ""]),
                        ("mk2_v3", mk, None), ("xl_v3", xl, None)],
        "device_photo_mockup": True,
        "bottom": [("player-play", "Playback", "MK.2 and XL"),
                   ("flag", "Markers", "One-tap marks"),
                   ("arrows-horizontal", "Plus dial", "Timeline scrub"),
                   ("bolt", "Setup", "Default shortcuts")],
        "feature_banners": [
            ("Playback under your fingers.", [K["jrev"], K["kstop"], K["lplay"]],
             ["Rewind", "Stop", "Play"], None,
             "On MK.2 and XL, review your footage with J, K and L on separate keys."),
            ("Mark the moments that matter.", [K["markerflag"], K["in"], K["out"]],
             ["Marker", "Mark In", "Mark Out"], None,
             "Drop a timeline marker and set in and out points on every supported deck."),
            ("Keep your place in the timeline.", [K["select"], K["snap"], K["zoomfit"], K["undo"], K["redo"]],
             ["Select", "Snap", "Zoom Fit", "Undo", "Redo"], None,
             "MK.2 and XL keep these timeline helpers together on one page."),
            ("A compact start on Stream Deck +.", [K["select"], K["markerflag"], K["zoomfit"], K["in"], K["out"]],
             ["Select", "Marker", "Zoom Fit", "Mark In", "Mark Out"], None,
             "Five Resolve keys, a Get Pro key and one Scrub dial. Two keys and three dials stay unassigned."),
        ],
        "statement": ["Start with playback and marking.",
                      "One page for Windows and macOS, with a compact Plus layout."],
        "video_scenes": [("MK.2 and XL: rewind, stop, play", [K["jrev"], K["kstop"], K["lplay"]]),
                         ("Mark in, mark out, drop a marker", [K["in"], K["out"], K["markerflag"]]),
                         ("Select and zoom to fit", [K["select"], K["zoomfit"]])],
        "description": {
            "search_line": "DaVinci Resolve Stream Deck profile: playback keys, in and out points, and timeline markers on real labeled keys. The free starter set for the Resolve edit page.",
            "intro": "Review your footage and mark the moments you want to keep. One page puts Resolve's default shortcuts under your hand, with a compact marking layout and timeline Scrub dial on Stream Deck +.",
            "tagline": "Start with playback and marking.",
            "features": [
                ("MK.2 and XL", "Eleven Resolve keys: Select, Marker, J reverse, K stop, L play, In, Out, Undo, Redo, Snap and Zoom Fit. Plus one Get Pro key."),
                ("Stream Deck +", "Five Resolve keys: Select, Marker, Zoom Fit, In and Out. Plus one Get Pro key and exactly one Scrub dial. Two keys and three dials stay unassigned."),
                ("Marking", "Set in and out points and drop timeline markers on every supported deck."),
                ("Default shortcuts", "Import the profile matching your device and OS. No keyboard preset is needed; customized Resolve shortcuts must match the defaults."),
            ],
            "outro": "Ready to cut? DaVinci Resolve Pro adds blade, split, ripple delete, insert, overwrite, replace and append, plus Color and Grade pages with printer lights, node controls, grade memories and versions. Pro's Edit page adds Zoom, Undo and Edit Point dials alongside Scrub. The Get Pro key opens its Marketplace listing.",
            "keywords": [], "collection": COLLECTION,
        },
    }


RELEASE_NOTES["davinci-resolve-lite"] = """- v1.1.0: deliberate non-additive update. Blade, Split, Ripple Delete and the entire Assembly page moved to DaVinci Resolve Pro. Lite is now the playback and marking starter set.
- MK.2 and XL keep eleven Resolve keys. Stream Deck + keeps Select, Marker, Zoom Fit, In and Out.
- Stream Deck + dropped from four dials to one Scrub dial. Zoom, Undo and Edit Point dials moved to Pro.
- Added one Get Pro key to every device and OS variant."""


RELEASE_NOTES["davinci-resolve-pro"] = """- Initial release. Five pages, six device builds.
- Color: printer lights for master, red, green and blue, serial, parallel and layer nodes, bypass node and bypass all, node stepping, and a Printer Lights switch that shows whether the mode is on.
- Grade: memories A to C with save and recall, grab grade from the previous clip, add version, next version.
- Edit: blade, select, split, ripple delete, snap, trim, zoom fit.
- Assembly: insert, overwrite, replace, place on top, append, transitions, retime.
- Stream Deck + build puts the four printer light channels on the dials, plus timeline scrub, zoom and undo.
- Ships MK.2, XL and Stream Deck + for both Windows and macOS. Every key uses Resolve's default keymap."""


def davinci_pro_cfg():
    A, K = DAVINCI_ORANGE, _resolve_keys()
    return {
        "game": "RESOLVE", "name": "DaVinci Resolve Pro", "hero_watermark": False,
        "logo_img": str(LOGOS / "davinciresolve.png"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "PRO",
        "hero_title": ["DaVinci Resolve Pro"],
        "tagline": "Editing, nodes and color grading across five pages.",
        "bullets": ["Printer lights on the dials, a color surface without the panel",
                    "Serial, parallel and layer nodes on labeled keys",
                    "Runs on Resolve's own defaults, no keyboard preset to import"],
        "hero_keys": [K["blade"], K["marker"], K["split"], K["j"], K["l"], K["inb"],
                      K["outb"], K["serial"], K["parallel"], K["bypass"], K["plights"],
                      K["red"], K["green"], K["blue"]],
        # Pro ships all three decks, so the cover shows all three, each on its own
        # page: Plus on Color, MK.2 on Edit, XL on the flat everything layout.
        "hero_lineup": [
            # The Plus's REAL Color page. Master/Red/Green/Blue live on the dials,
            # so they belong on the touch strip, not duplicated up in the keys.
            ("plus_v3", [K["back"], K["plights"], K["serial"], K["parallel"],
                         K["layer"], K["bypass"], K["prevnode"], K["nextnode"]],
             None, [strip_icon("brightness"), strip_icon("circle", (255, 80, 80)),
                    strip_icon("circle", (80, 230, 130)), strip_icon("circle", (95, 165, 255))]),
            # Folder keys on the front deck: shows the product has grouped pages.
            ("mk2_v3", [K["gEdit"], K["gAsm"], K["gColor"], K["gGrade"], K["marker"],
                        K["j"], K["kk"], K["l"], K["inb"], K["outb"],
                        K["blade"], K["select"], K["split"], K["ripple"], K["fit"]],
             None),
            ("xl_v3", [K["blade"], K["select"], K["marker"], K["split"], K["j"],
                       K["kk"], K["l"], K["inb"], K["outb"], K["ripple"], K["snap"],
                       K["trim"], K["fit"], K["ins"], K["ovr"], K["rep"], K["top"],
                       K["app"], K["trans"], K["retime"], K["serial"], K["parallel"],
                       K["layer"], K["bypass"], K["plights"], K["master"], K["red"],
                       K["green"], K["blue"], K["mema"], K["grab"]], None),
        ],
        "device_photo_mockup": True,
        "bottom": [("palette", "Color", "Printer lights"),
                   ("binary-tree", "Nodes", "Serial and parallel"),
                   ("cut", "Editing", "Blade and trim"),
                   ("bolt", "Setup", "None needed")],
        "feature_banners": [
            ("Four dials, four color channels.", [K["master"], K["red"], K["green"], K["blue"], K["plights"]],
             ["Master", "Red", "Green", "Blue", "Printer Lights"], None,
             "On Stream Deck +, turn a dial to push each printer light up or down. "
             "Press Printer Lights once and the whole strip goes live."),
            ("Color grade from the deck.", [K["plights"], K["master"], K["red"], K["green"], K["blue"]],
             ["Printer Lights", "Master", "Red", "Green", "Blue"], None,
             "Resolve's printer lights on dials, or on keys where there are no dials."),
            ("Nodes without the right-click.", [K["serial"], K["parallel"], K["layer"], K["bypass"], K["grab"]],
             ["Serial", "Parallel", "Layer", "Bypass", "Grab Grade"], None,
             "Add, bypass and step through nodes while your eyes stay on the image."),
            ("Your cut, on real keys.", [K["blade"], K["split"], K["ripple"], K["trim"], K["marker"]],
             ["Blade", "Split", "Ripple Del", "Trim", "Marker"], None,
             "The edits you make hundreds of times a day, labeled and one tap away."),
            ("Build the timeline without the mouse.", [K["ins"], K["ovr"], K["rep"], K["top"], K["app"]],
             ["Insert", "Overwrite", "Replace", "Place Top", "Append"], None,
             "Insert, overwrite, replace and append, each on its own key."),
            ("Import and start grading.", [K["plights"], K["serial"], K["blade"], K["l"], K["marker"]],
             ["Printer Lights", "Serial", "Blade", "Play", "Marker"], None,
             "Every key uses Resolve's default shortcuts. Nothing to import, nothing to map."),
        ],
        "statement": ["A color surface without the color panel.",
                      "Printer lights, nodes and grades on the deck you already own."],
        "description": {
            "search_line": "Every DaVinci Resolve shortcut you actually press, on labeled keys: blade, split, ripple delete, insert, overwrite, replace, append, plus color page printer lights and node control. Cut and grade without touching the keyboard.",
            "intro": "Grade and cut DaVinci Resolve from the deck. Printer lights sit on the Stream Deck + dials as a real color control surface, and on labeled keys everywhere else, so master, red, green and blue are under your hand while your eyes stay on the image.",
            "tagline": "Cut and grade without touching the keyboard.",
            "features": [
                [
                    "Color",
                    "Printer lights for master, red, green and blue, plus serial, parallel and layer nodes, bypass node, bypass all and node stepping."
                ],
                [
                    "Grade",
                    "Grade memories with save and recall, grab the grade from the previous clip, add and step versions."
                ],
                [
                    "Editing",
                    "Blade, select, split, ripple delete, snap, trim, zoom fit, markers."
                ],
                [
                    "Assembly",
                    "Insert, overwrite, replace, place on top, append, transitions, retime."
                ],
                [
                    "Dials on Stream Deck +",
                    "A knob per printer light channel, plus timeline scrub, zoom and undo."
                ],
                [
                    "Zero setup",
                    "Every key uses Resolve's default keymap. No keyboard preset to import."
                ]
            ],
            "outro": "Press Printer Lights once to turn the mode on. The key shows a lit bulb while it is active, so you can see whether the color controls are live.",
            "collection": "Part of the Packrat profile collection for Stream Deck. Game decks, streamer decks and editing decks, all on the marketplace at @packrat.",
            "keywords": []
        },
        "video_scenes": [("Printer lights on the dials", [K["master"], K["red"], K["green"]]),
                         ("Serial, parallel, layer nodes", [K["serial"], K["parallel"], K["layer"]]),
                         ("Blade, split, ripple delete", [K["blade"], K["split"], K["ripple"]])],
    }


# ---------------------------------------------------------------- Window Manager
WM_SCRIPTS = ROOT.parent / "plugins" / "_wm" / "scripts"
WF_SCRIPTS = ROOT.parent / "plugins" / "_wf" / "scripts"


def _wm_faces():
    """Window Manager renders its keys as SVG at runtime, so there is no static art for
    plugin_key() to read. plugins/_wm/scripts/key_faces.py mirrors badge.ts and is the
    single source of truth for listing art, same arrangement as Calendar. It sits beside
    the TypeScript rather than under a plugin because Lite and Pro share the faces."""
    import importlib.util
    p = WM_SCRIPTS / "key_faces.py"
    spec = importlib.util.spec_from_file_location("wm_key_faces", p)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod


def _wf_faces():
    """Same arrangement as _wm_faces, for plugins/_wf/src/badge.ts."""
    import importlib.util
    p = WF_SCRIPTS / "key_faces.py"
    spec = importlib.util.spec_from_file_location("wf_key_faces", p)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod


RELEASE_NOTES["window-manager"] = """Initial release. Windows and macOS, every Stream Deck model.
- Send the window you are working in to the left half, the right half, the middle or full screen.
- Point a key at a particular screen and the window moves across to it as well.
- Key faces draw the shape they make, so a row of them is easy to tell apart at a glance.
- Step through your open windows, inside one program or across everything.
- The next window is named on the key before you press it.
- A window that cannot be moved says so instead of doing nothing."""

RELEASE_NOTES["window-manager-pro"] = """Initial release. Windows and macOS, every Stream Deck model.
- Save your whole arrangement to a key. Hold once to record, press to put it all back.
- Layouts remember a share of each screen, so they survive a resolution change or an unplugged monitor.
- Anything not running is skipped, and the key tells you how many were missed.
- Record just the program you are in when that is all you want.
- A Stream Deck Plus dial slides a window along or resizes it a little at a time.
- Includes snapping to halves, middle and full screen, and stepping through open windows."""

RELEASE_NOTES["workflow-automation"] = """Initial release. Windows and macOS, every Stream Deck model.
- Build a routine of up to five steps and run the whole thing with one press.
- Steps open a program, press a key combination, wait a set time, or open a link.
- A wait is a real step, so you can open something slow and type into it once it is ready.
- The key counts the steps off as it runs.
- A step that goes wrong stops the routine and the key names which one it was.
- Half-finished steps are skipped, so you can build a routine a piece at a time."""

RELEASE_NOTES["workflow-automation-pro"] = """Initial release. Windows and macOS, every Stream Deck model.
- Room for twenty five steps on one key.
- Add a condition and the routine only carries on when it makes sense.
- Stopping on a condition looks different from something going wrong, so you can tell them apart.
- Send a web request as a step, to a home automation hook, a chat notice or your own script.
- Each request decides whether a failure stops the routine or is shrugged off.
- Includes opening programs, pressing key combinations, waiting and opening links."""


def windowmanager_cfg():
    A = tokens.ACCENT
    kf = _wm_faces()
    s = kf.spec
    # No spec labels: these faces render their own heading inside the 144px art, so a
    # label underneath would repeat it. Captions do the naming. Same as Calendar.
    left, right = s(kf.snap("left")), s(kf.snap("right"))
    full, center = s(kf.snap("maximize")), s(kf.snap("center"))
    left2 = s(kf.snap("left", monitor=2))
    right1 = s(kf.snap("right", monitor=1))
    next_code = s(kf.cycle("layout.ts - ratpack"))
    next_chat = s(kf.cycle("general - Discord"))
    next_app = s(kf.cycle(scope="app"))
    blocked = s(kf.blocked())
    setup = s(kf.permission())
    alone = s(kf.idle("NEXT", "only one open"))
    return {
        "game": "WINDOWS", "name": "Window Manager Lite",
        "logo_img": glyph_logo("app-window"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "LITE",
        "os_support": "Windows and macOS",
        "hero_badge": "LITE",
        "hero_badge_color": BH_BADGE_BLUE, "hero_badge_fg": WHITE,
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "os_glyphs": ["brand-windows", "brand-apple"],
        "hero_title_clean": "Window Manager",
        "hero_title": ["Put it where", "you want it."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "One press puts the window exactly where you want it. No dragging, no aiming.",
        "bullets": ["Left half, right half, middle or full screen, on one press",
                    "Send a window to another screen without dragging it there",
                    "Step through your open windows without hunting the taskbar"],
        # Ten distinct faces on a fifteen key deck: every state the plugin really has,
        # no duplicates, and the deck stays honestly partly lit.
        "hero_keys": [left, right, full, center, left2,
                      right1, next_code, next_chat, next_app, alone],
        "device_photo_mockup": True,
        "bottom": [("layout-columns", "Halves", "Left or right, instantly"),
                   ("maximize", "Full screen", "Or neatly centred"),
                   ("device-desktop", "Any screen", "Send it across"),
                   ("switch-horizontal", "Step through", "One press per window")],
        "feature_banners": [
            ("The key shows the shape it makes.",
             [left, right, full, center],
             None, None,
             "Four keys that look identical would be four keys you have to remember. Each one draws the screen with its own half filled, so you can pick the right one at a glance from across the desk."),
            ("Send it to the other screen too.",
             [left2, right1, full],
             None, None,
             "Tell a key which screen to use and the window travels there as well as landing in place. Unplug that screen and the key keeps working on the one you still have, instead of quietly doing nothing."),
            ("Get back to what you were doing.",
             [next_code, next_chat, next_app],
             None, None,
             "Each press brings the next window forward, and the key names the one you are about to land on. Keep pressing to work through all of them rather than bouncing between the same two."),
            ("It tells you when it cannot.",
             [blocked, setup, alone],
             None, None,
             "Some windows genuinely cannot be moved, and a key that silently does nothing is the worst way to find out. This one says so on its face, and walks you through the Mac permission the first time."),
        ],
        "statement": ["Put it where you want it.",
                      "Dragging a window to the same place forty times a day is forty things you should not have to aim at."],
        "video_scenes": [
            ("Halves, middle, full screen", [left, right, full, center]),
            ("Send it to another screen", [left2, right1]),
            ("Step through your windows", [next_code, next_chat]),
            ("Window Manager Lite", [left, right, next_code]),
        ],
        "description": {
            "search_line": "Window Manager for Stream Deck: snap the window you are working in to the left half, the right half, the middle or full screen, on any monitor, with one press.",
            "intro": "Window Manager puts a window exactly where you want it without dragging it there. Give one key the left half, another the right half, another the whole screen, and the layout you set up forty times a day becomes one press. Tell a key which monitor to use and the window travels across on its own.",
            "tagline": "Put it where you want it.",
            "features": [
                ("Snap Window", "Left half, right half, middle or full screen, applied to whatever you are working in. The key face draws the shape it makes, so a row of them is easy to tell apart."),
                ("Any monitor", "Point a key at a particular screen and the window moves there as well as landing in place. Unplug that screen and the key keeps working on the one you still have."),
                ("Cycle Windows", "Each press brings the next window forward, either inside the program you are in or across everything. Keep pressing to work through all of them, not just the last two."),
                ("It says when it cannot", "Windows owned by a program running as administrator cannot be moved. The key tells you, rather than looking like it did nothing."),
            ],
            "outro": "Works on Windows and macOS, on every Stream Deck. Window Manager Pro adds saved layouts that put your whole arrangement back in one press, and a Stream Deck Plus dial for fine positioning.",
            "keywords": ["window manager", "window layout", "multi monitor", "snap window", "Windows", "macOS"],
            "collection": PLUGIN_COLLECTION,
        },
    }


def windowmanager_pro_cfg():
    A = tokens.ACCENT
    kf = _wm_faces()
    s = kf.spec
    work = s(kf.layout("Work", windows=6, state="ready"))
    stream = s(kf.layout("Stream", windows=4, state="ready"))
    edit = s(kf.layout("Edit", windows=3, state="ready"))
    empty = s(kf.layout("Writing", state="empty"))
    partial = s(kf.layout("Work", windows=6, state="partial", missing=2))
    left, right = s(kf.snap("left")), s(kf.snap("right"))
    full, center = s(kf.snap("maximize")), s(kf.snap("center"))
    left2 = s(kf.snap("left", monitor=2))
    next_code = s(kf.cycle("layout.ts - ratpack"))
    return {
        "game": "WINDOWS PRO", "name": "Window Manager Pro",
        "logo_img": glyph_logo("layout-grid"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "PRO",
        "os_support": "Windows and macOS",
        # Same seal treatment as the Lite cover, so the pair reads as one family.
        "hero_badge": "PRO",
        "hero_badge_color": BH_BADGE_BLUE, "hero_badge_fg": WHITE,
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "os_glyphs": ["brand-windows", "brand-apple"],
        # Title drops the "Pro" word: the seal beside it already says PRO, and having both
        # reads as a stutter on the cover. The listing NAME keeps it (see "name").
        "hero_title_clean": "Window Manager",
        "hero_title": ["Your whole setup.", "One press."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "Arrange everything once, record it, and get it all back whenever you want.",
        "bullets": ["Save every window where it sits and restore the lot in one press",
                    "Layouts survive a resolution change or an unplugged monitor",
                    "A dial for the last bit of fine positioning"],
        "hero_keys": [work, stream, edit, empty, partial,
                      left, right, full, center, next_code],
        "device_photo_mockup": True,
        "bottom": [("layout-grid", "Saved layouts", "The whole setup back"),
                   ("device-desktop", "Any screens", "Survives unplugging"),
                   ("adjustments", "Dial control", "Fine positioning"),
                   ("layout-columns", "Snapping", "Halves and full screen")],
        "feature_banners": [
            ("Record it once. Get it back forever.",
             [work, stream, edit],
             None, None,
             "Arrange your windows the way you want them, hold the key for a moment, and that arrangement is saved. Every press after that puts all of it back, on the right screens and at the right sizes. Give each key its own name and keep as many setups as you like."),
            ("It survives the screens changing.",
             [work, partial, empty],
             None, None,
             "Layouts remember a share of each screen rather than fixed points, so one saved on a large display still makes sense on a laptop. Undock and nothing ends up off the edge where you cannot reach it. Anything not running is skipped, and the key tells you how many."),
            ("Everything the snapping does, too.",
             [left, right, full, center],
             None, None,
             "Halves, middle and full screen on any monitor, and stepping through your open windows one press at a time. The key face draws the shape it makes so a row of them is easy to tell apart."),
        ],
        "statement": ["Your whole setup. One press.",
                      "Rebuilding the same arrangement every morning is the part of the job nobody put on the list."],
        "video_scenes": [
            ("Hold once to record", [empty, work]),
            ("Press to put it all back", [work, stream, edit]),
            ("It survives the screens changing", [work, partial]),
            ("Window Manager Pro", [work, left, right]),
        ],
        "description": {
            "search_line": "Window Manager Pro for Stream Deck: save your whole window layout to a key and put every window back on the right screen, at the right size, in one press.",
            "intro": "Window Manager Pro saves your whole window layout to a key. Arrange things the way you like them, hold the key once to record it, and every press after that puts everything back, on the right screens and at the right sizes. Rebuilding the same arrangement every morning stops being part of the job.",
            "tagline": "Your whole setup. One press.",
            "features": [
                ("Window Layout", "Hold a key to record where everything is, press it to put it all back. Give each key its own name and keep a setup for writing, one for editing, one for a stream."),
                ("It survives the screens changing", "Layouts remember a share of each screen rather than fixed points, so one saved on a large display still makes sense on a laptop, and undocking never leaves a window off the edge."),
                ("Nothing running is skipped quietly", "Programs that are not open are left out and the key tells you how many, so a half restored setup is never a surprise."),
                ("A dial for the fine work", "On a Stream Deck Plus, turn to slide a window along or resize it a little at a time. Press to swap between the two. It can never be pushed off the screen."),
                ("Snapping included", "Halves, middle and full screen on any monitor, and stepping through your open windows one press at a time."),
            ],
            "outro": "Works on Windows and macOS, on every Stream Deck.",
            "keywords": ["window layout", "window manager", "multi monitor", "save windows", "snap window", "Windows", "macOS"],
            "collection": PLUGIN_COLLECTION,
        },
    }


def workflow_cfg():
    A = tokens.ACCENT
    kf = _wf_faces()
    s = kf.spec
    ready = s(kf.idle("Morning", 4))
    ready2 = s(kf.idle("Stream", 5))
    blank = s(kf.idle("Routine", 0))
    step1 = s(kf.running("Morning", 4, 1, "open Slack.exe"))
    step2 = s(kf.running("Morning", 4, 2, "wait 2s"))
    step3 = s(kf.running("Morning", 4, 3, "press keys"))
    finished = s(kf.done("Morning", 4))
    broke = s(kf.failed("Morning", 4, 2, "Could not find Slack.exe"))
    single = s(kf.idle("Focus", 1))
    long_run = s(kf.running("Stream", 5, 4, "open obs64.exe"))
    return {
        "game": "MACROS", "name": "Workflow Automation Lite",
        "logo_img": glyph_logo("list-numbers"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "LITE",
        "os_support": "Windows and macOS",
        "hero_badge": "LITE",
        "hero_badge_color": BH_BADGE_BLUE, "hero_badge_fg": WHITE,
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "os_glyphs": ["brand-windows", "brand-apple"],
        "hero_title_clean": "Workflow Automation",
        "hero_title": ["Five things.", "One press."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "The same five things you do every morning, on one key, in order.",
        "bullets": ["Open programs, press key combinations, wait, open links",
                    "The key counts the steps off so you can see how far along it is",
                    "A step that goes wrong stops it and names which one"],
        "hero_keys": [ready, ready2, blank, step1, step2,
                      step3, long_run, finished, broke, single],
        "device_photo_mockup": True,
        "bottom": [("player-play", "One press", "The whole routine"),
                   ("clock", "Real waits", "For slow programs"),
                   ("list-numbers", "Live progress", "Counted on the key"),
                   ("alert-triangle", "Honest failures", "Names the step")],
        "feature_banners": [
            ("Watch it work.",
             [step1, step2, step3, finished],
             None, None,
             "The key counts the steps off as it goes and says what it is doing right now. A routine that takes a few seconds should not look like a key that did nothing, so this one shows its work and marks the pips as it passes them."),
            ("Waiting is a real step.",
             [step2, step3, finished],
             None, None,
             "Most routines break because something had not finished opening yet. Put a wait between opening a program and typing into it and the keystrokes land where you meant them, not in whatever was in front."),
            ("When it breaks, it says where.",
             [broke, blank, ready],
             None, None,
             "A step that fails stops the routine there rather than carrying on as though it worked, and the key names the step so you know exactly what to fix. Half-finished steps are skipped, so you can build a routine a piece at a time."),
        ],
        "statement": ["Five things. One press.",
                      "The same opening ritual every morning is the easiest thing you will ever hand to a key."],
        "video_scenes": [
            ("Build the steps in order", [blank, ready]),
            ("Watch it count them off", [step1, step2, step3]),
            ("It says where it broke", [broke, finished]),
            ("Workflow Automation Lite", [ready, step2, finished]),
        ],
        "description": {
            "search_line": "Workflow Automation for Stream Deck: build a macro of up to five steps, opening programs, pressing keys, waiting and opening links, and run the whole thing with one press.",
            "intro": "Workflow Automation turns the same five things you do every morning into one press. Build a macro of steps that run in order: open a program, press a key combination, wait for something slow to load, open a link. The key counts them off as it goes, so a routine that takes a few seconds never looks like a key that did nothing.",
            "tagline": "Five things. One press.",
            "features": [
                ("Run Sequence", "Up to five steps in the order you write them. Open a program, press a key combination, wait a set time, or open a link."),
                ("Waiting is a real step", "Most routines break because something had not finished opening. A proper wait means the keystrokes land in the program you meant, not whatever was in front."),
                ("Live progress on the key", "The face counts the steps off and says what it is doing right now, so you can see how far along it is at a glance."),
                ("Honest failures", "A step that goes wrong stops the routine and the key names which step it was, instead of carrying on as though nothing happened."),
            ],
            "outro": "Works on Windows and macOS, on every Stream Deck. Workflow Automation Pro raises the limit to twenty five steps and adds conditions that stop a routine when it does not make sense, plus web requests it can send.",
            "keywords": ["macro", "automation", "workflow", "multi action", "sequence", "Windows", "macOS"],
            "collection": PLUGIN_COLLECTION,
        },
    }


def workflow_pro_cfg():
    A = tokens.ACCENT
    kf = _wf_faces()
    s = kf.spec
    ready = s(kf.idle("Go Live", 9))
    ready2 = s(kf.idle("Shutdown", 12))
    gate = s(kf.stopped("Go Live", 9, 2, "obs64.exe was not running"))
    step3 = s(kf.running("Go Live", 9, 3, "post hooks.test"))
    step6 = s(kf.running("Go Live", 9, 6, "press keys"))
    step9 = s(kf.running("Shutdown", 12, 9, "wait 3s"))
    finished = s(kf.done("Go Live", 9))
    broke = s(kf.failed("Go Live", 9, 4, "Could not find obs64.exe"))
    long_ready = s(kf.idle("Full Setup", 25))
    blank = s(kf.idle("Routine", 0))
    return {
        "game": "MACROS PRO", "name": "Workflow Automation Pro",
        "logo_img": glyph_logo("route"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "PRO",
        "os_support": "Windows and macOS",
        "hero_badge": "PRO",
        "hero_badge_color": BH_BADGE_BLUE, "hero_badge_fg": WHITE,
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "os_glyphs": ["brand-windows", "brand-apple"],
        "hero_title_clean": "Workflow Automation",
        "hero_title": ["A routine that", "checks first."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "Twenty five steps, conditions that stop it, and requests it can send.",
        "bullets": ["A condition checks before it acts, so nothing starts twice",
                    "Send a web request to a hook, a chat notice or your own script",
                    "Twenty five steps on a single key"],
        "hero_keys": [ready, ready2, long_ready, gate, step3,
                      step6, step9, finished, broke, blank],
        "device_photo_mockup": True,
        "bottom": [("git-branch", "Conditions", "Checks before acting"),
                   ("world-www", "Web requests", "Tell something else"),
                   ("list-numbers", "Twenty five steps", "On a single key"),
                   ("player-play", "One press", "The whole routine")],
        "feature_banners": [
            ("It checks before it acts.",
             [gate, step3, finished],
             None, None,
             "Add a condition and the routine only carries on when it makes sense. A key can check your recorder is already running and stop quietly if it is not, instead of piling a second copy on top of the first. Stopping on a condition is shown differently from something going wrong, so you can tell them apart at a glance."),
            ("One press can tell something else.",
             [step3, step6, finished],
             None, None,
             "Send a web request as a step and starting your setup can also fire a home automation hook, post a notice, or call your own script. Each request decides for itself whether a failure should stop the routine or be shrugged off."),
            ("Room for the whole ritual.",
             [long_ready, ready2, step9],
             None, None,
             "Twenty five steps on a single key, counted off as they run. Long routines still read at a glance because the progress marks shrink to fit rather than spilling off the face."),
            ("When it breaks, it says where.",
             [broke, gate, blank],
             None, None,
             "A step that fails stops the routine there and the key names it, so you know exactly what to fix. Half-finished steps are skipped, so a routine can be built a piece at a time."),
        ],
        "statement": ["A routine that checks first.",
                      "The difference between a macro and something you trust is what it does when the world is not how it expected."],
        "video_scenes": [
            ("It checks before it acts", [gate, step3]),
            ("Send a request as a step", [step3, step6]),
            ("Twenty five steps on one key", [long_ready, step9]),
            ("Workflow Automation Pro", [ready, step6, finished]),
        ],
        "description": {
            "search_line": "Workflow Automation Pro for Stream Deck: a macro of up to twenty five steps with conditions that stop it when they are not met, and web requests it can send.",
            "intro": "Workflow Automation Pro builds a macro that checks before it acts. Open programs, press key combinations, wait and open links, with room for twenty five steps on one key. Add a condition and the routine only carries on when it makes sense, so a key can see your recorder is already running and stop quietly instead of starting a second copy.",
            "tagline": "A routine that checks first.",
            "features": [
                ("Conditions", "Only carry on if a program is running, or only if it is not. Stopping on a condition is shown differently from something going wrong, so you can tell the two apart at a glance."),
                ("Web requests", "Send a request as a step, so one press can also fire a home automation hook, post a notice, or call your own script. Each one decides whether a failure stops the routine."),
                ("Twenty five steps", "Room for the whole ritual on a single key, counted off as it runs. Long routines still read at a glance."),
                ("Honest failures", "A step that goes wrong stops the routine and the key names which step it was, so you know exactly what to fix."),
                ("Everything in the basic tier", "Opening programs, pressing key combinations, waiting for something to load, and opening links."),
            ],
            "outro": "Works on Windows and macOS, on every Stream Deck.",
            "keywords": ["macro", "automation", "webhook", "sequence", "multi action", "Windows", "macOS"],
            "collection": PLUGIN_COLLECTION,
        },
    }

# -- Epic Pen ------------------------------------------------------------------
# Accent is Epic Pen's own factory quick-colour slot 1, so the art reads as Epic
# Pen without using a single piece of Epic Pen artwork. No logo anywhere: house
# rule 5, and a third-party mark on a cover is the standard rejection vector.
EP_CYAN_M = (0, 173, 239)
EP_PLATE = str(ROOT.parent / "brand" / "ai_backgrounds" / "epic-pen" / "annotation.png")


def _epicpen_keys():
    A = EP_CYAN_M
    return {
        "draw": key_img("writing", label="Draw"),
        "pen": key_img("pencil", fg=A, label="Pen"),
        "high": key_img("highlight", fg=A, label="Highlight"),
        "erase": key_img("eraser", fg=A, label="Eraser"),
        "clear": key_img("trash", fg=(231, 76, 60), label="Clear"),
        "cursor": key_img("pointer", label="Cursor"),
        "undo": key_img("arrow-back-up", label="Undo"),
        "sizedn": key_img("circle-minus", label="Size -"),
        "sizeup": key_img("circle-plus", label="Size +"),
        "shot": key_img("camera", label="Screenshot"),
        "tool": key_img("layout-navbar", label="Toolbar"),
        "last": key_img("color-picker", fg=A, label="Last Color"),
        "palette": key_img("palette", fg=A, label="Colors", nav=True),
        "c1": key_img("pencil", bg=(0, 173, 239), fg=DARK, label="Cyan",
                      label_color=(17, 17, 17)),
        "c2": key_img("pencil", bg=(254, 242, 0), fg=DARK, label="Yellow",
                      label_color=(17, 17, 17)),
        "c3": key_img("pencil", bg=(255, 11, 136), label="Pink"),
        "c5": key_img("pencil", bg=(31, 212, 48), fg=DARK, label="Green",
                      label_color=(17, 17, 17)),
        "c6": key_img("pencil", bg=(231, 76, 60), label="Red"),
        "line": key_img("line", fg=A, label="Line"),
        "arrow": key_img("arrow-narrow-right", fg=A, label="Arrow"),
        "rect": key_img("square", fg=A, label="Rectangle"),
        "ellip": key_img("oval", fg=A, label="Ellipse"),
        "text": key_img("letter-t", fg=A, label="Text"),
        "white": key_img("chalkboard", bg=(238, 238, 238), fg=DARK, label="Whiteboard",
                         label_color=(17, 17, 17)),
        "black": key_img("chalkboard", bg=(0, 0, 0), label="Blackboard"),
        "fade": key_img("ripple", fg=A, label="Fade Ink"),
        "launch": key_img("app-window", label="Launch"),
        "brush": key_img("brush", fg=A, label="Size"),
    }


def epic_pen_cfg():
    """Funnel head. Sells the physical-control-surface benefit, never a feature
    count: the whole product is 18 keys and pretending otherwise invites the
    comparison it would lose."""
    A, K = EP_CYAN_M, _epicpen_keys()
    return {
        "game": "EPIC PEN", "name": "Epic Pen Profile",
        "brand": A, "bg": BG, "icon": "", "icon_sub": "ANNOTATE",
        "bg_image": EP_PLATE, "bg_opacity": 0.7,
        "hero_title": ["Draw on your screen", "without breaking stride."],
        "tagline": "Pen, highlighter, eraser and colors on real keys. Stop hunting the toolbar.",
        "bullets": ["Every Epic Pen tool on a labeled key you can find by feel",
                    "Six quick colors and stroke size without opening a menu",
                    "Runs on Epic Pen's own default shortcuts, nothing to set up"],
        "hero_keys": [K["draw"], K["pen"], K["high"], K["erase"], K["clear"],
                      K["cursor"], K["undo"], K["sizedn"], K["sizeup"], K["shot"],
                      K["palette"], K["last"], K["tool"]],
        "device_photo_mockup": True,
        "bottom": [("pencil", "Tools", "Pen and highlighter"),
                   ("palette", "Colors", "Six on tap"),
                   ("camera", "Capture", "Screenshot the markup"),
                   ("bolt", "Setup", "None needed")],
        "feature_banners": [
            ("The tools you use every minute.", [K["pen"], K["high"], K["erase"], K["clear"], K["undo"]],
             ["Pen", "Highlight", "Eraser", "Clear", "Undo"], None,
             "Switch tool mid sentence without looking away from what you are explaining."),
            ("Change color without a menu.", [K["c1"], K["c2"], K["c3"], K["c5"], K["c6"]],
             ["Cyan", "Yellow", "Pink", "Green", "Red"], None,
             "Six quick colors on their own keys, each one a single press."),
            ("Draw, then get out of the way.", [K["draw"], K["cursor"], K["tool"], K["shot"], K["clear"]],
             ["Draw", "Cursor", "Toolbar", "Screenshot", "Clear"], None,
             "Turn the ink overlay on, hand the mouse back, capture the result, wipe the screen."),
            ("Stroke size under your thumb.", [K["sizedn"], K["sizeup"], K["brush"], K["pen"], K["high"]],
             ["Size -", "Size +", "Dial", "Pen", "Highlight"], None,
             "Thicker for a heading, thinner for detail. On Stream Deck + it lives on a dial."),
        ],
        "statement": ["Teaching, presenting, coaching, tutorials.",
                      "Anywhere you point at a screen and need the mark to appear now."],
        "video_scenes": [("Pen, highlighter, eraser", [K["pen"], K["high"], K["erase"]]),
                         ("Six colors on tap", [K["c1"], K["c2"], K["c3"]]),
                         ("Size and screenshot", [K["sizeup"], K["shot"]]),
                         ("Clear and carry on", [K["clear"], K["draw"]])],
        "description": {
            "search_line": "Epic Pen Stream Deck profile: pen, highlighter, eraser, clear, undo, stroke size, screenshot and quick colors on real keys.",
            "intro": "Epic Pen turns your screen into something you can draw on. This profile puts every tool it ships with on a labeled Stream Deck key, so you mark up what you are showing without dragging the floating toolbar around or trying to remember a chord.",
            "tagline": "Point at the screen and the mark is already there.",
            "features": [
                ("Tools", "Pen, highlighter, eraser and clear, plus undo and the cursor key that hands control back to whatever is underneath."),
                ("Colors", "Six quick colors on their own keys, and a last color key to jump back to what you were using."),
                ("Stroke size", "Thicker and thinner on two keys, or on a dial if you have a Stream Deck +."),
                ("Screenshot", "Capture the annotated screen without leaving what you are doing."),
                ("Zero setup", "Every key sends an Epic Pen default shortcut, so it works the moment you import it."),
            ],
            "outro": "Requires Epic Pen for Windows. Works on Stream Deck, MK.2, XL, Stream Deck + and the Virtual Stream Deck.",
            "keywords": ["Epic Pen", "Stream Deck profile", "screen annotation", "teaching", "presenting", "whiteboard"],
            "collection": COLLECTION,
        },
    }


def epic_pen_pro_cfg():
    """Paid tier. House rule 8: the word "free" cannot appear anywhere in this
    listing, so the funnel is never named. The Epic Pen Pro requirement sits in
    the intro rather than the outro because it has to land inside the first 250
    characters, which is all a lot of buyers read."""
    A, K = EP_CYAN_M, _epicpen_keys()
    return {
        "game": "EPIC PEN", "name": "Epic Pen Pro Profile",
        "brand": A, "bg": BG, "icon": "", "icon_sub": "PRO",
        "bg_image": EP_PLATE, "bg_opacity": 0.7,
        "hero_title": ["Every Epic Pen tool", "on a key."],
        "tagline": "Shapes, text, whiteboard and fading ink, plus everything you draw with.",
        "bullets": ["Shapes, arrows and text without touching the toolbar",
                    "Whiteboard and blackboard on a single press",
                    "Runs on Epic Pen's own default shortcuts, nothing to set up"],
        "hero_keys": [K["draw"], K["pen"], K["high"], K["erase"], K["clear"],
                      K["line"], K["arrow"], K["rect"], K["ellip"], K["text"],
                      K["white"], K["black"], K["fade"], K["shot"]],
        "device_photo_mockup": True,
        "bottom": [("square-rounded", "Shapes", "Line, arrow, box"),
                   ("letter-t", "Text", "Type on screen"),
                   ("chalkboard", "Boards", "White and black"),
                   ("ripple", "Fading ink", "Marks that clear themselves")],
        "feature_banners": [
            ("Shapes without the steady hand.", [K["line"], K["arrow"], K["rect"], K["ellip"], K["text"]],
             ["Line", "Arrow", "Rectangle", "Ellipse", "Text"], None,
             "Circle the thing, point at the thing, label the thing. One key each."),
            ("Turn the screen into a board.", [K["white"], K["black"], K["pen"], K["high"], K["clear"]],
             ["Whiteboard", "Blackboard", "Pen", "Highlight", "Clear"], None,
             "Drop a clean surface over everything when you need to sketch an idea from scratch."),
            ("The tools you use every minute.", [K["pen"], K["high"], K["erase"], K["undo"], K["cursor"]],
             ["Pen", "Highlight", "Eraser", "Undo", "Cursor"], None,
             "Switch tool mid sentence without looking away from what you are explaining."),
            ("Change color without a menu.", [K["c1"], K["c2"], K["c3"], K["c5"], K["c6"]],
             ["Cyan", "Yellow", "Pink", "Green", "Red"], None,
             "Six quick colors on their own keys, each one a single press."),
            ("Marks that clean up after themselves.", [K["fade"], K["clear"], K["shot"], K["sizeup"], K["launch"]],
             ["Fade Ink", "Clear", "Screenshot", "Size +", "Launch"], None,
             "Fading ink for pointing, clear for a reset, screenshot for anything worth keeping."),
        ],
        "statement": ["Four pages on MK.2, one flat page on XL.",
                      "Same layout on Stream Deck +, with stroke size on a dial."],
        "video_scenes": [("Shapes on real keys", [K["line"], K["arrow"], K["rect"]]),
                         ("Text anywhere on screen", [K["text"], K["ellip"]]),
                         ("Whiteboard and blackboard", [K["white"], K["black"]]),
                         ("Fading ink and clear", [K["fade"], K["clear"]])],
        "description": {
            "search_line": "Epic Pen Stream Deck profile: shapes, arrows, text, whiteboard, blackboard, fading ink, colors and every drawing tool on real keys.",
            "intro": "The complete Epic Pen control surface on your Stream Deck. Shapes, arrows, text, whiteboard, blackboard and fading ink need Epic Pen Pro in the app itself; the pen, highlighter, eraser, colors and screenshot keys work on any Epic Pen install.",
            "tagline": "Circle it, label it, or wipe the screen and start clean.",
            "features": [
                ("Shapes", "Line, arrow, rectangle and ellipse, each on its own key, so a straight line stays straight."),
                ("Text", "Drop typed labels anywhere on screen without reaching for the toolbar."),
                ("Boards", "Whiteboard and blackboard turn the screen into a clean surface for sketching an idea."),
                ("Fading ink", "Marks that disappear on their own, for pointing at something without cleaning up after."),
                ("Everything else", "Pen, highlighter, eraser, clear, undo, cursor, stroke size, screenshot, six quick colors and a key that launches Epic Pen."),
                ("Zero setup", "Every key sends an Epic Pen default shortcut, so it works the moment you import it."),
            ],
            "outro": "Requires Epic Pen for Windows, with Epic Pen Pro for the shapes, text, board and fading ink keys. Works on Stream Deck, MK.2, XL, Stream Deck + and the Virtual Stream Deck.",
            "keywords": ["Epic Pen", "Stream Deck profile", "screen annotation", "whiteboard", "presenting", "teaching"],
            "collection": COLLECTION,
        },
    }


# ---------------------------------------------------------------- Sports Tracker Ultimate
# The one tracker listing that is not about a league. Its promise is the opposite of the six
# single-sport ones: not "your team on a key" but "every team, every sport, one plugin". The
# key art therefore spans sports on purpose rather than repeating one league six times.
def ultimate_sports_cfg():
    cfg = tracker_cfg("ultimate-sports", "Sports Tracker Ultimate", tokens.ACCENT, "trophy", "ULTIMATE", {
        "kicker": "ALL SPORTS",
        "hero_title": ["Live scores,", "every sport."],
        "tagline": "Football, basketball, hockey, baseball, soccer, college, UFC, NASCAR and Formula 1, all on one deck.",
        "bullets": ["Every team you follow on a single key, live games first",
                    "Eleven sports and nineteen leagues in one plugin",
                    "Hold any key to open that game in your browser"],
        "hero_keys": ["myteams", "nba", "nhl", "mlb", "soccer", "college", "ufc", "f1"],
        "bottom": [("star", "My Teams", "One key, all of them"),
                   ("ball-football", "11 sports", "One plugin"),
                   ("list-numbers", "Standings", "Rank and form"),
                   ("circle-dot", "Stream Deck +", "Dial through games")],
        "features": [
            ("Every team, one key.", [("myteams", "My Teams")],
             "Pick your teams once, across as many sports as you like. One key holds the whole list and puts whatever matters most in front: a live game, then anything about to start, then the rest. Tap for the next one."),
            ("Eleven sports, one plugin.", [("nfl", "Football"), ("nba", "Basketball"), ("nhl", "Hockey"), ("mlb", "Baseball"), ("soccer", "Soccer"), ("college", "College")],
             "Football, basketball, hockey, baseball, soccer, college football and basketball, WNBA, UFC, NASCAR and Formula 1. Nineteen leagues in total, including nine soccer competitions, so a deck can follow the Premier League and LaLiga at once."),
            ("Fights and races too.", [("ufc", "Fight night"), ("f1", "Drivers"), ("nascar", "The field")],
             "Not everything is a game between two sides. Fight cards walk bout by bout with the winners filling in, and a race weekend gives you the running order and the championship table one driver per press."),
            ("The countdown, and the table.", [("next", "Next game"), ("standings", "Standings"), ("board", "League games")],
             "No game on? The key shows who is next and counts down once it is close. Standings give rank, record, games behind and current form. A third key walks a whole league's slate, live games first."),
            ("Honest when the feed goes quiet.", [("stale", "Last known")],
             "If a score cannot be refreshed the key keeps the last one it got, draws an amber bar and prints how old it is. A stale number never passes for a live one."),
        ],
        "statement": ["Every sport you follow, on one deck.",
                      "Pick your teams once. The keys do the rest, all season, in every season."],
        "video": [("Every team on one key", ["myteams", "nfl"]),
                  ("Eleven sports, one plugin", ["nba", "nhl", "mlb", "soccer"]),
                  ("Fights and races too", ["ufc", "f1"]),
                  ("Standings and countdowns", ["standings", "next"]),
                  ("Sports Tracker Ultimate", ["myteams", "nfl", "soccer"])],
        # First 250 characters carry the search weight, so the terms with measured demand in
        # streamdeck-market-data/query_suggestions_top3000.csv go here, as prose rather than a
        # list: tracker (21), football (31), game (33), sport (17), scores (13), schedule (13),
        # baseball (13), scoreboard (12), formula (13), live score (11).
        "search_line": "Live scores for every sport you follow, on one Stream Deck key. Sports Tracker Ultimate covers football, basketball, hockey, baseball, soccer, college, UFC, NASCAR and Formula 1, with live scoreboards, standings and next game schedules.",
        "intro": "Checking the score means alt-tabbing out of a game or a stream, and following more than one sport used to mean installing a plugin per league. This is one plugin for all of them: pick your teams once, and a single key walks your whole list with live games first.",
        "desc_features": [
            ("Every team on one key", "My Teams holds your whole list across every sport and shows the most urgent first: live, then starting soon, then the rest."),
            ("Eleven sports", "Football, basketball, hockey, baseball, soccer, college football and basketball, WNBA, UFC, NASCAR and Formula 1. Nineteen leagues, nine of them soccer competitions."),
            ("Live scores", "Both scores, the period and the clock, refreshing on their own. A green frame flashes the moment the score changes."),
            ("Standings and schedules", "Rank, record, games behind and form. With no game on, the key counts down to the next one."),
            ("Open the game", "Hold any key to open that game's page in your browser. Tap does the everyday thing."),
            ("Stream Deck + dial", "Turn the dial to move through every game across every sport you follow, with the matchup on the touch strip."),
            ("Works offline", "If a feed goes quiet the key keeps the last score it got, marked with its age."),
        ],
        "outro": "For Windows and macOS, on every Stream Deck model, with dial and touch support on Stream Deck +. Not affiliated with or endorsed by any league, team or governing body.",
        "keywords": ["sports tracker", "live scores", "football scores", "scoreboard",
                     "sports schedule", "live score", "baseball scores", "Stream Deck plugin"],
    })
    # tracker_cfg hardcodes "All StreamDecks" for the six single-sport listings, where the
    # device range is the only thing left to say. Here the cover has one job and it is the
    # sport count, so the second chip carries that instead.
    cfg["hero_chips"] = ["Stream Deck Plugin", "11 Sports"]
    return cfg


RELEASE_NOTES["ultimate-sports"] = """Initial release. Windows and macOS, every Stream Deck model.
- Eleven sports in one plugin: football, basketball, hockey, baseball, soccer, college football and basketball, WNBA, UFC, NASCAR and Formula 1. Nineteen leagues, nine of them soccer competitions.
- My Teams: one key holds every team you follow, across every sport, and shows the most urgent first.
- Team Score, Standings and League Games keys for any team or league in any of the eleven sports.
- Fight cards and race weekends walk bout by bout and driver by driver, with championship points.
- Stream Deck +: turn the dial through every game across every sport, with the matchup on the touch strip.
- Hold any key to open that game's page in your browser.
- A green frame flashes when a score changes; an amber bar and a timestamp appear if a feed goes quiet."""

RELEASE_NOTES["sports"] = """Initial release for the Corsair Xeneon Edge. Requires iCUE 5.47 or newer.
- Eleven sports in one widget: football, basketball, hockey, baseball, soccer, college football and basketball, the WNBA, UFC, NASCAR and Formula 1.
- Follow up to six teams across any mix of those leagues, named by abbreviation in the settings panel.
- UFC, NASCAR and Formula 1 sit beside your teams: a fight card shows its main event, a race shows who is leading and on which lap.
- Live games sort to the front, then whatever starts soonest, then the finals.
- The leading side stays bright and the trailing side steps back, so the answer reads at a glance.
- Checks often while a game is on and eases off when nothing is, so it stays quiet in the background.
- Keeps the last scores it fetched on screen if the connection drops, with the age shown.
- Reshapes for every dashboard slot, from the small tile to the full width of the display."""


# ---------------------------------------------- RatPack AI prompt profiles
# Seven listings off one prompt source (profiles/_build/ratpack_ai_prompts.json).
# Copy rule that governs all of them: these PASTE a prompt, they do not run the
# AI and they do not talk to it. Never write copy that implies otherwise.

AI_CREATOR    = (229, 62, 62)
AI_DEVELOPER  = (49, 130, 206)
AI_MARKETING  = (221, 107, 32)
AI_FREELANCER = (128, 90, 213)
AI_COACHING   = (47, 133, 90)
AI_UNIVERSAL  = (150, 158, 170)

AI_WORKS_WITH = ("Works in ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run "
                 "yourself. The prompt lands wherever your cursor is.")


def _ai_src():
    import json
    from pathlib import Path as _P
    d = json.loads((_P(__file__).parent / "ratpack_ai_prompts.json").read_text(encoding="utf-8"))
    return {f["id"]: f for f in d["folders"]}


def _ai_keys(cat, accent, ids=None):
    """Hero keys drawn with the same renderer the profile itself uses, so the
    art shows the real key faces rather than a mockup of them."""
    cats = _ai_src()
    ps = cats[cat]["prompts"]
    if ids:
        by = {p["id"]: p for p in ps}
        ps = [by[i] for i in ids]
    return [key_img(p["icon"], fg=accent, label=p["button_name"]) for p in ps]


def _ai_feature_rows(cat, accent, rows):
    cats = _ai_src()
    by = {p["id"]: p for p in cats[cat]["prompts"]}
    out = []
    for title, ids, blurb in rows:
        keys = [key_img(by[i]["icon"], fg=accent, label=by[i]["button_name"]) for i in ids]
        labels = [by[i]["button_name"] for i in ids]
        out.append((title, keys, labels, None, blurb))
    return out


def _ai_cfg(cat, accent, name, hero_title, tagline, bullets, bottom,
            feature_rows, statement, desc, icon_sub, extra_keys=None,
            listing_name=None):
    cats = _ai_src()
    n = len(cats[cat]["prompts"]) if cat != "lite" else 8
    hero = extra_keys if extra_keys is not None else _ai_keys(cat, accent)
    uni = _ai_keys("universal", AI_UNIVERSAL)
    return {
        "game": name.upper(), "name": name,
        "brand": accent, "bg": BG, "icon": "", "icon_sub": icon_sub,
        # The cover carries the LISTING name, which differs from the profile
        # name inside Stream Deck ("AI Prompts Developers" vs the searchable
        # "AI Prompts for Developers"). The clean hero reads this key.
        "hero_title_clean": listing_name or name,
        "hero_title": hero_title,
        "tagline": tagline,
        "bullets": bullets,
        "hero_keys": hero[:14],
        "device_photo_mockup": True,
        "bottom": bottom,
        "feature_banners": feature_rows + [
            ("The three that fit any job.", uni,
             [p["button_name"] for p in cats["universal"]["prompts"]], None,
             "Shorten anything, fix the tone of anything, or turn a blank page into twenty "
             "concrete ideas. On Stream Deck XL these sit on their own row."),
            ("Any AI, no setup.", hero[:5],
             [p["button_name"] for p in cats[cat]["prompts"][:5]],
             None, AI_WORKS_WITH),
        ],
        "statement": statement,
        "video_scenes": [
            (feature_rows[0][0], hero[:4]),
            (feature_rows[-1][0] if len(feature_rows) > 1 else "One press, prompt ready", hero[4:8] or hero[:4]),
            ("Any AI tool", uni),
            (name, hero[:5]),
        ],
        "description": desc,
    }


def ai_prompts_lite_cfg():
    """The funnel tier. It carries the three universal helpers plus one prompt
    from each of the five paid packs, so the listing shows the whole range."""
    cats = _ai_src()
    order = [("shrink-it", AI_UNIVERSAL), ("tone-fix", AI_UNIVERSAL), ("rapid-brainstorm", AI_UNIVERSAL),
             ("hook-generator", AI_CREATOR), ("debug-consultant", AI_DEVELOPER),
             ("cold-email", AI_MARKETING), ("meeting-summary", AI_FREELANCER),
             ("blocker-interrogation", AI_COACHING)]
    lookup = {p["id"]: p for c in cats for p in cats[c]["prompts"]}
    keys = [key_img(lookup[i]["icon"], fg=col, label=lookup[i]["button_name"]) for i, col in order]
    return {
        "game": "AI PROMPTS", "name": "AI Prompts Lite",
        "brand": AI_UNIVERSAL, "bg": BG, "icon": "", "icon_sub": "AI",
        "hero_title_clean": "AI Prompts Lite",
        "hero_title": ["AI Prompts", "Lite"],
        "tagline": "Eight ready prompts on real keys. One press puts the whole prompt where you are typing.",
        "bullets": ["Eight prompts covering writing, video, code, outreach and focus",
                    "Pastes into any AI tool you already use",
                    "Windows and Mac, Stream Deck MK.2 and XL"],
        "hero_keys": keys,
        "device_photo_mockup": True,
        "bottom": [("scissors", "Shorter", "Cut any text by a third"),
                   ("adjustments", "Tone", "Say it the right way"),
                   ("bulb", "Ideas", "Twenty, not one"),
                   ("bolt", "Setup", "Import and press")],
        "feature_banners": [
            ("Three that fit any job.", keys[:3], ["Shrink 30%", "Tone Fix", "Ideas"], None,
             "Shorten anything by a third, fix how a message reads, or turn a blank page into "
             "twenty concrete ideas with a constraint framework behind them."),
            ("One from each pack.", keys[3:], ["Hook Gen", "Debug", "Cold Email", "Meeting Notes", "Blocker"], None,
             "A YouTube hook writer, a debugging consultant, a cold email, a meeting summariser "
             "and the question that gets you unstuck. One from every category."),
            ("Any AI, no setup.", keys[:5], ["Shrink 30%", "Tone Fix", "Ideas", "Hook Gen", "Debug"], None,
             AI_WORKS_WITH),
        ],
        "statement": ["Press the key. The prompt is already written.",
                      "Every button holds a full prompt with the placeholders marked, so you fill in your "
                      "own detail and send."],
        "video_scenes": [("Three that fit any job", keys[:3]),
                         ("One from each pack", keys[3:7]),
                         ("Any AI tool", keys[:3]),
                         ("AI Prompts Lite", keys[:5])],
        "description": {
            "search_line": "AI prompts on Stream Deck keys for ChatGPT, Claude and Gemini. Press a key and a full, ready written prompt pastes straight into your AI chat.",
            "intro": "Eight prompts on labeled keys: shorten any text, fix its tone, generate twenty ideas, write a YouTube hook, debug an error, send a cold email, summarise a meeting and break a blocker.",
            "tagline": "Stop retyping the same prompt. Press one key instead.",
            "features": [
                ("One press", "The whole prompt goes on the clipboard and pastes where your cursor is."),
                ("Any AI tool", "ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself."),
                ("Written to work", "Every prompt marks its placeholders, so you know exactly what to fill in."),
                ("Two devices, two systems", "Stream Deck MK.2 and XL, on Windows and macOS."),
                ("Nothing to install", "No plugin and no account. Import the profile and press a key."),
            ],
            "outro": "Part of a set of prompt profiles for creators, developers, marketers, freelancers and anyone who wants a thinking partner.",
            "keywords": ["AI prompts", "ChatGPT", "Claude", "Stream Deck profile", "prompt profile", "productivity"],
            "collection": COLLECTION,
        },
    }


def ai_prompts_creator_cfg():
    return _ai_cfg(
        "creator", AI_CREATOR, "AI Prompts Creators",
        ["AI Prompts", "for Creators"],
        "Twelve prompts for the whole video pipeline, from hook to thumbnail to sponsor read.",
        ["Hooks, titles, scripts, descriptions and thumbnail briefs",
         "Comment replies, Shorts hooks, sponsor reads and brand outreach",
         "Windows and Mac, Stream Deck MK.2 and XL"],
        [("fish-hook", "Hook", "Three openings, ranked"),
         ("pin", "Titles", "Ten, CTR ranked"),
         ("photo", "Thumbnail", "Three concepts"),
         ("recycle", "Repurpose", "One video, five posts")],
        _ai_feature_rows("creator", AI_CREATOR, [
            ("Before you film.",
             ["hook-generator", "title-optimizer", "script-skeleton", "thumbnail-brief"],
             "Three opening hooks built on different tension structures, ten titles ranked by "
             "estimated click through, a full script skeleton with the stakes set in the first "
             "ninety seconds, and three thumbnail concepts with the exact overlay words."),
            ("After you upload.",
             ["yt-seo-description", "comment-reply", "community-post", "ab-test-analysis"],
             "A description that hooks before the fold, three ways to answer any comment "
             "including a critical one, community posts, and an honest read on whether your "
             "A/B result actually meant anything."),
            ("Getting paid.",
             ["brand-outreach", "sponsor-script", "shorts-hook", "repurpose"],
             "A partnership pitch that opens with something specific about the brand, a sixty "
             "second sponsor read that does not start with the words today's sponsor, vertical "
             "hooks for the three second scroll window, and one video turned into five posts."),
        ]),
        ["Twelve prompts. One content pipeline.",
         "Written for a working channel: every prompt marks its placeholders, so you drop in "
         "your topic and get something usable rather than something generic."],
        {
            "search_line": "AI prompts for YouTube creators on Stream Deck keys. Press a key and a full prompt for hooks, titles, scripts, descriptions or thumbnails pastes into ChatGPT or Claude.",
            "intro": "Twelve prompts covering the whole video pipeline: three opening hooks, ten CTR ranked titles, a script skeleton, an SEO description, three thumbnail concepts, comment replies, Shorts hooks, brand outreach, a sponsor read, community posts, A/B analysis, and one video repurposed into five platform posts.",
            "tagline": "The prompt is already written. Press the key and fill in your topic.",
            "features": [
                ("Before you film", "Hook generator, title optimizer, script skeleton and thumbnail brief."),
                ("After you upload", "SEO description, comment replies, community posts and A/B test analysis."),
                ("Getting paid", "Brand partnership pitch, sponsor read script and Shorts hooks."),
                ("Repurpose", "Turn a single video into a newsletter, a LinkedIn post, a thread, a Short and an email."),
                ("Any AI tool", "ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself."),
            ],
            "outro": "Stream Deck MK.2 and XL, Windows and macOS. On XL the three universal helpers get their own row.",
            "keywords": ["AI prompts", "YouTube", "content creator", "ChatGPT", "Stream Deck profile", "creator prompts"],
            "collection": COLLECTION,
        },
        "YT", listing_name="AI Prompts for Creators")


def ai_prompts_developer_cfg():
    return _ai_cfg(
        "developer", AI_DEVELOPER, "AI Prompts Developers",
        ["AI Prompts", "for Developers"],
        "Thirteen prompts for review, debugging, tests, commits and design docs.",
        ["Code review with no praise padding, and a ranked debugging consultant",
         "Tests, commit messages, PR descriptions, regex, SQL and security audits",
         "Windows and Mac, Stream Deck MK.2 and XL"],
        [("search", "Review", "Senior lens, no praise"),
         ("bug", "Debug", "Three ranked causes"),
         ("checkbox", "Tests", "Full coverage suite"),
         ("shield-lock", "Audit", "Exploit and fix")],
        _ai_feature_rows("developer", AI_DEVELOPER, [
            ("Read the code.",
             ["code-review", "explain-code", "debug-consultant", "security-audit"],
             "A review that skips the compliments and names what is actually wrong, a plain "
             "English walkthrough of unfamiliar code, three ranked probable causes for a bug "
             "with an experiment each, and a security pass that says how a hole gets exploited."),
            ("Ship the change.",
             ["test-writer", "commit-message", "pr-description", "refactor"],
             "A full test suite including the edge cases, a conventional commit message, a pull "
             "request description that summarises intent rather than listing files, and a "
             "refactor that is explicitly forbidden from changing behaviour."),
            ("The fiddly parts.",
             ["regex-builder", "sql-query", "error-message", "api-design", "tech-design-doc"],
             "Regex you can read afterwards, SQL with the joins reasoned out, error messages "
             "written for the person who has to act on them, plus API and architecture "
             "documents with the data model made explicit."),
        ]),
        ["Thirteen prompts. No praise padding.",
         "The review prompt is told not to compliment the code, and the refactor prompt is told "
         "not to change behaviour. The constraints are the point."],
        {
            "search_line": "AI prompts for developers on Stream Deck keys. Press a key and a full prompt for code review, debugging, tests, commits or architecture pastes into Claude, ChatGPT or Cursor.",
            "intro": "Thirteen prompts for the working day: code review that names real problems instead of padding with praise, a debugging consultant that ranks three probable causes, a test writer, commit messages, PR descriptions, refactoring, regex, SQL, error copy, API design, architecture docs and a security audit.",
            "tagline": "The prompt is already written. Press the key and paste your code.",
            "features": [
                ("Read the code", "Review, explain, debug and security audit, each with its own constraints."),
                ("Ship the change", "Tests, conventional commits, PR descriptions and behaviour preserving refactors."),
                ("The fiddly parts", "Regex, SQL, error messages, API design and architecture documents."),
                ("Written with constraints", "The review prompt is told not to praise. The refactor prompt is told not to change behaviour."),
                ("Any AI tool", "Claude, ChatGPT, Gemini, Copilot, Cursor or a model you run yourself."),
            ],
            "outro": "Stream Deck MK.2 and XL, Windows and macOS. On XL the three universal helpers get their own row.",
            "keywords": ["AI prompts", "Claude", "ChatGPT", "Cursor", "code review", "Stream Deck profile"],
            "collection": COLLECTION,
        },
        "DEV", listing_name="AI Prompts for Developers")


def ai_prompts_marketing_cfg():
    return _ai_cfg(
        "marketing", AI_MARKETING, "AI Prompts Marketing",
        ["AI Prompts", "for Marketing"],
        "Eleven prompts for threads, ads, cold email, subject lines, SEO and positioning.",
        ["Threads, LinkedIn posts, cold email and three angled ad variants",
         "Fifteen subject lines, SEO meta, case studies and positioning",
         "Windows and Mac, Stream Deck MK.2 and XL"],
        [("brand-x", "Thread", "Eight tweets"),
         ("mail", "Cold Email", "Three sentences"),
         ("speakerphone", "Ad Copy", "Pain, proof, claim"),
         ("target", "Position", "One clear statement")],
        _ai_feature_rows("marketing", AI_MARKETING, [
            ("Social that lands.",
             ["tweet-thread", "linkedin-post", "product-desc", "newsletter-intro"],
             "An eight tweet thread that opens on a real hook and closes on a reason to reply, "
             "a LinkedIn post whose first line earns the see more click, product copy led by "
             "outcome rather than feature, and a newsletter intro."),
            ("Email that gets opened.",
             ["cold-email", "email-subject-lines", "testimonial-request", "case-study"],
             "A cold email in three sentences with one specific ask, fifteen subject lines with "
             "preview text that continues rather than repeats, a testimonial request that tells "
             "the client exactly what to write about, and a case study with the result up front."),
            ("Say what you are.",
             ["ad-copy-variants", "seo-meta", "positioning-statement"],
             "Three ad variants built on different angles, pain, proof and claim, so you are "
             "testing an idea rather than a synonym. Plus SEO meta and a positioning statement "
             "that names the alternative you are beating."),
        ]),
        ["Eleven prompts. Three different angles, not three synonyms.",
         "The ad prompt writes from pain, proof and claim so a test tells you something. The "
         "subject line prompt writes the preview text too."],
        {
            "search_line": "AI prompts for marketing on Stream Deck keys. Press a key and a full prompt for threads, ad copy, cold email, subject lines or positioning pastes into ChatGPT or Claude.",
            "intro": "Eleven prompts for the work that repeats: an eight tweet thread, a LinkedIn post, a three sentence cold email, three ad variants built on different angles, fifteen subject lines with preview text, SEO meta, a case study, product copy, a newsletter intro, a testimonial request and a positioning statement.",
            "tagline": "The prompt is already written. Press the key and paste your brief.",
            "features": [
                ("Social", "Threads, LinkedIn posts, product copy and newsletter intros."),
                ("Email", "Cold email, fifteen subject lines, testimonial requests and case studies."),
                ("Positioning", "Three ad variants on pain, proof and claim, plus SEO meta and a positioning statement."),
                ("Built to test", "The ad prompt writes three genuinely different angles so an A/B result means something."),
                ("Any AI tool", "ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself."),
            ],
            "outro": "Stream Deck MK.2 and XL, Windows and macOS. On XL the three universal helpers get their own row.",
            "keywords": ["AI prompts", "marketing", "copywriting", "ChatGPT", "social media", "Stream Deck profile"],
            "collection": COLLECTION,
        },
        "MKT", listing_name="AI Prompts for Marketing")


def ai_prompts_freelancer_cfg():
    return _ai_cfg(
        "freelancer", AI_FREELANCER, "AI Prompts Freelancers",
        ["AI Prompts", "Freelancers"],
        "Ten prompts for proposals, client updates, scope, invoices and raising your rate.",
        ["Proposal polish, meeting notes, client updates and scope replies",
         "Invoices, contract clauses, rate raises and discovery questions",
         "Windows and Mac, Stream Deck MK.2 and XL"],
        [("pencil", "Polish", "Hedging removed"),
         ("ban", "Scope", "Say no, keep client"),
         ("trending-up", "Rate", "Ask with a reason"),
         ("zoom-scan", "Discovery", "The right questions")],
        _ai_feature_rows("freelancer", AI_FREELANCER, [
            ("Winning the work.",
             ["proposal-polisher", "discovery-questions", "portfolio-bio", "rejection-response"],
             "A proposal with the hedging language stripped out, the discovery questions that "
             "surface the real budget and decision maker, a portfolio bio, and a reply to a no "
             "that keeps the door open for the next project."),
            ("Running the work.",
             ["meeting-summary", "client-update", "scope-creep-response", "contract-clause"],
             "Raw meeting notes turned into decisions and owners, a client update under a "
             "hundred and fifty words, a scope reply that says no without losing the "
             "relationship, and plain language contract clauses."),
            ("Getting paid.",
             ["invoice-line-items", "rate-increase"],
             "Loose notes turned into invoice line items a client will not query, and a rate "
             "increase email built on the value you have already delivered rather than an "
             "apology for asking."),
        ]),
        ["Ten prompts. The awkward conversations, already drafted.",
         "Scope creep, rate increases and turning down work are the messages that sit unwritten "
         "for days. These are the ones worth a key."],
        {
            "search_line": "AI prompts for freelancers on Stream Deck keys. Press a key and a full prompt for proposals, client updates, scope replies, invoices or a rate increase pastes into ChatGPT or Claude.",
            "intro": "Ten prompts for running a practice: a proposal with the hedging removed, meeting notes turned into decisions, a short client update, a scope creep reply that keeps the relationship, invoice line items, contract clauses, a rate increase email, a portfolio bio, discovery questions and a graceful answer to a no.",
            "tagline": "The prompt is already written. Press the key and paste your notes.",
            "features": [
                ("Winning the work", "Proposal polish, discovery questions, portfolio bio and rejection replies."),
                ("Running the work", "Meeting summaries, client updates, scope replies and contract clauses."),
                ("Getting paid", "Invoice line items from loose notes, and a rate increase built on delivered value."),
                ("The awkward ones", "Scope creep and rate raises are the messages that sit unwritten. These draft them."),
                ("Any AI tool", "ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself."),
            ],
            "outro": "Stream Deck MK.2 and XL, Windows and macOS. On XL the three universal helpers get their own row.",
            "keywords": ["AI prompts", "freelancer", "proposals", "ChatGPT", "client work", "Stream Deck profile"],
            "collection": COLLECTION,
        },
        "OPS", listing_name="AI Prompts for Freelancers")


def ai_prompts_coach_cfg():
    return _ai_cfg(
        "coaching", AI_COACHING, "AI Coach Prompts",
        ["AI Coach", "Prompts"],
        "Seven prompts that find the one thing actually holding you back, and what to do this week.",
        ["A full multi phase diagnostic that ends in a ninety day plan",
         "Goal clarity, decision framing, belief audit, blocker and weekly review",
         "Windows and Mac, Stream Deck MK.2 and XL"],
        [("compass", "Coach", "The full session"),
         ("stethoscope", "Diagnose", "Three ranked causes"),
         ("scale", "Decide", "A clear recommendation"),
         ("calendar", "Review", "The why, not the list")],
        _ai_feature_rows("coaching", AI_COACHING, [
            ("The full session.",
             ["full-coach-session", "performance-diagnostic"],
             "A multi phase diagnostic that works through where you are, what you have already "
             "tried and what is actually binding, then ends with a ninety day plan. It fits "
             "career, business, fitness, creative work or study. The short version gives you "
             "three ranked causes and one experiment to run this week."),
            ("Getting clear.",
             ["goal-clarity", "decision-frame", "belief-audit"],
             "A vague goal sharpened until it is specific enough to start, a hard decision put "
             "into a frame that produces a recommendation instead of another week of delay, and "
             "a limiting belief examined and replaced with something more accurate."),
            ("Every week.",
             ["blocker-interrogation", "weekly-review"],
             "The real reason you are procrastinating plus a fifteen minute action that breaks "
             "the inertia, and a weekly review with enough structure that it finds the why "
             "behind the wins and the gaps instead of drifting into venting."),
        ]),
        ["Seven prompts. One binding constraint.",
         "The flagship prompt runs a structured multi phase session rather than handing back a "
         "list of tips. Most stuck weeks have one cause, and it is rarely effort."],
        {
            "search_line": "AI prompts for coaching on Stream Deck keys. Press a key and a full performance diagnostic, goal clarity, decision or weekly review prompt pastes into ChatGPT or Claude.",
            "intro": "Seven prompts for thinking clearly: a multi phase coaching session that finds the one constraint actually holding you back and ends in a ninety day plan, plus a quick diagnostic, goal clarity, a decision frame, a belief audit, a blocker breaker and a structured weekly review.",
            "tagline": "The prompt is already written. Press the key and describe where you are stuck.",
            "features": [
                ("The full session", "A multi phase diagnostic that works for career, business, fitness, creative work or study."),
                ("Getting clear", "Goal clarity, a decision frame that produces a recommendation, and a belief audit."),
                ("Every week", "A blocker breaker with a fifteen minute action, and a weekly review with real structure."),
                ("Built to push back", "These prompts ask for evidence rather than agreeing with your first explanation."),
                ("Any AI tool", "ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself."),
            ],
            "outro": "Stream Deck MK.2 and XL, Windows and macOS. On XL the three universal helpers get their own row.",
            "keywords": ["AI prompts", "coaching", "productivity", "ChatGPT", "goal setting", "Stream Deck profile"],
            "collection": COLLECTION,
        },
        "COACH", listing_name="AI Coach Prompts")


def ai_prompt_toolkit_cfg():
    """All 56. Home is the three universal helpers plus five folder keys."""
    cats = _ai_src()
    fold = [key_img("video", fg=AI_CREATOR, label="Creator", nav=True),
            key_img("code", fg=AI_DEVELOPER, label="Dev Tools", nav=True),
            key_img("speakerphone", fg=AI_MARKETING, label="Marketing", nav=True),
            key_img("briefcase", fg=AI_FREELANCER, label="Freelance", nav=True),
            key_img("compass", fg=AI_COACHING, label="Coach", nav=True)]
    uni = _ai_keys("universal", AI_UNIVERSAL)
    return {
        "game": "AI PROMPT TOOLKIT", "name": "AI Prompt Toolkit",
        "brand": AI_UNIVERSAL, "bg": BG, "icon": "", "icon_sub": "AI",
        "hero_title_clean": "AI Prompt Toolkit",
        "hero_title": ["AI Prompt", "Toolkit"],
        "tagline": "Fifty six prompts in five folders. Nothing is more than two presses away.",
        "bullets": ["Creator, developer, marketing, freelancer and coaching sets in one profile",
                    "Three universal helpers stay on the home page",
                    "Windows and Mac, Stream Deck MK.2 and XL"],
        "hero_keys": uni + fold,
        "device_photo_mockup": True,
        "bottom": [("folder", "Five folders", "One per discipline"),
                   ("bulb", "Always there", "Three on the home page"),
                   ("bolt", "Two presses", "To any of the 56"),
                   ("device-desktop", "Two decks", "MK.2 and XL")],
        "feature_banners": [
            ("Five folders on the home page.", fold,
             ["Creator", "Dev Tools", "Marketing", "Freelance", "Coach"], None,
             "Twelve creator prompts, thirteen for developers, eleven for marketing, ten for "
             "freelancing and seven coaching prompts. Each folder opens onto its whole set."),
            ("Three that never move.", uni, ["Shrink 30%", "Tone Fix", "Ideas"], None,
             "Shorten any text by a third, fix how a message reads, or turn a blank page into "
             "twenty ideas. These stay on the home page because they fit any job."),
            ("The creator set.", _ai_keys("creator", AI_CREATOR)[:5],
             [p["button_name"] for p in cats["creator"]["prompts"][:5]], None,
             "Hooks, titles, scripts, descriptions and thumbnail briefs, plus sponsor reads, "
             "brand outreach and repurposing."),
            ("The developer set.", _ai_keys("developer", AI_DEVELOPER)[:5],
             [p["button_name"] for p in cats["developer"]["prompts"][:5]], None,
             "Review, explain, debug, tests and commits, plus regex, SQL, API design and a "
             "security audit."),
            ("Any AI, no setup.", uni + fold[:2], ["Shrink 30%", "Tone Fix", "Ideas", "Creator", "Dev Tools"], None,
             AI_WORKS_WITH),
        ],
        "statement": ["Fifty six prompts. Two presses to any of them.",
                      "Every prompt marks its placeholders, so you fill in your own detail rather than "
                      "editing someone else's example."],
        "video_scenes": [("Five folders", fold),
                         ("Three that never move", uni),
                         ("Fifty six prompts", _ai_keys("creator", AI_CREATOR)[:4]),
                         ("AI Prompt Toolkit", uni + fold[:2])],
        "description": {
            "search_line": "56 AI prompts on Stream Deck keys for ChatGPT, Claude and Gemini. Five folders for creators, developers, marketers, freelancers and coaching, with three helpers always on the home page.",
            "intro": "Fifty six ready written prompts in one profile. Five folders hold the creator set, the developer set, marketing, freelancer operations and a coaching set, while three universal helpers stay on the home page. Nothing is more than two presses away.",
            "tagline": "Press a key. The whole prompt pastes where you are typing.",
            "features": [
                ("Creator, 12 prompts", "Hooks, titles, scripts, descriptions, thumbnails, sponsor reads and repurposing."),
                ("Developer, 13 prompts", "Review, explain, debug, tests, commits, regex, SQL, API design and security."),
                ("Marketing, 11 prompts", "Threads, LinkedIn, cold email, ad variants, subject lines, SEO and positioning."),
                ("Freelancer, 10 prompts", "Proposals, meeting notes, client updates, scope replies, invoices and rate raises."),
                ("Coaching, 7 prompts", "A multi phase performance diagnostic, goal clarity, decisions and a weekly review."),
                ("Any AI tool", "ChatGPT, Claude, Gemini, Perplexity, Copilot or a model you run yourself."),
            ],
            "outro": "Stream Deck MK.2 and XL, Windows and macOS. Import the profile and press a key.",
            "keywords": ["AI prompts", "ChatGPT", "Claude", "Gemini", "prompt pack", "Stream Deck profile"],
            "collection": COLLECTION,
        },
    }


# ---------------------------------------------------------------- Claude & Codex Cost
# Keyword demand measured 2026-08-22 from query_suggestions_top3000.csv, not guessed:
#   claude 91 (Plugins) | chatgpt 89 (Plugins) | monitor 67 | codex 50 (only 24 products)
#   dashboard 23 | token 22 | tracker 21 | meter 20 | claude code 20 | ai usage 19 | usage 17
# `codex` beats `openai` (38 popularity across 148 products) on both axes, which is why the
# product name pairs claude with codex rather than with openai. `chatgpt` cannot go in the NAME
# (the plugin does not read ChatGPT app usage) but is accurate in the body, because Codex ships
# with ChatGPT Plus and Pro.
def codecost_cfg():
    A = tokens.ACCENT
    k = lambda n, label=None: tracker_key("code-cost", n, label)
    today, week, month = k("today"), k("week"), k("month")
    claude, codex, partial, nologs = k("claude"), k("codex"), k("partial"), k("nologs")
    return {
        "game": "AI COST", "name": "Claude & Codex Cost Lite",
        "logo_img": glyph_logo("coin"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "",
        "os_support": "Windows and macOS",
        "os_glyphs": ["brand-windows", "brand-apple"],
        "hero_chips": ["Lite", "Pro version available"],
        "hero_title_clean": "Claude Code Cost",
        "hero_title": ["What Claude Code", "actually costs."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "Today, this week, this month. Read from the session files already on your computer.",
        "bullets": ["Spend for today, 7 days or 30 days on one key",
                    "Claude Code and Codex together, or either on its own",
                    "Nothing to sign in to and nothing leaves your machine"],
        # Five keys on a deck that holds fifteen. Every face here is a real state of the one
        # action this product ships; padding it out would mean inventing keys nobody can place.
        "hero_keys": [today, week, month, claude, codex],
        "device_photo_mockup": True,
        "bottom": [("coin", "Real spend", "Not a percentage"),
                   ("calendar", "Three periods", "Press to switch"),
                   ("plug-off", "No account", "No key to paste"),
                   ("device-desktop", "Stays local", "Reads your own files")],
        "feature_banners": [
            ("Today, this week, this month.",
             [today, week, month], None, None,
             "One key, three periods. Press it to move between them, or set the one you want and leave it. The figure updates on its own while you work, so a long session is visible as it happens rather than at the end of the month."),
            ("Claude Code and Codex, together or apart.",
             [claude, codex], None, None,
             "Both tools on one key, or a key each when you want to see which one is doing the spending. Codex comes with a ChatGPT Plus or Pro plan, so both sides are covered without an API account."),
            ("Honest when it cannot be sure.",
             [partial, nologs], None, None,
             "A red dot means one of the models you used has no price on file yet, so the real figure is higher than the one shown. If there are no session files to read, the key says so. A wrong number shown confidently would be worse than either."),
        ],
        "statement": ["What Claude Code actually costs.",
                      "Priced from the session files already on your computer. No account, no key, no upload."],
        "video_scenes": [
            ("What did today cost?", [today]),
            ("This week, this month", [week, month]),
            ("Claude Code and Codex", [claude, codex]),
            ("Claude & Codex Cost Lite", [today, week, month]),
        ],
        "description": {
            "search_line": "Claude Code cost on a key. See what Claude and Codex actually cost you today, this week and this month, in dollars, with a monitor that reads the session files already saved on your computer.",
            "intro": "Usage plugins show a percentage of a quota. This one shows money. It reads the session files Claude Code and Codex already write on your computer, prices the tokens in them, and puts the figure on a key you can glance at while you work. There is no account to create and no key to paste.",
            "tagline": "What Claude Code actually costs.",
            "features": [
                ("Three periods", "Today, the last 7 days, or the last 30. Press the key to move between them without opening settings."),
                ("Both tools", "Claude Code and Codex on one key, or filter to either on its own. Codex is included with a ChatGPT Plus or Pro plan."),
                ("Nothing to set up", "Drag the key on and it works. No sign in, no API key, nothing to connect."),
                ("Stays on your computer", "The plugin makes no network requests at all. It reads your own files and nothing is uploaded."),
                ("Says when it is unsure", "A model with no price on file leaves the figure marked as incomplete instead of guessing a rate and showing a confident wrong number."),
            ],
            "outro": "Claude & Codex Cost Pro adds Plan Value, which tells you whether your plan is paying for itself, plus all time totals, a breakdown by model and by project, a budget alarm, cache hit rate and a daily trend. For Windows and macOS, on every Stream Deck model. Costs are an estimate worked out from published token rates and will not match a bill exactly.",
            "keywords": ["claude", "chatgpt", "monitor", "codex", "token cost", "Stream Deck plugin"],
            "collection": PLUGIN_COLLECTION,
        },
    }


def codecostpro_cfg():
    A = tokens.ACCENT
    k = lambda n, label=None: tracker_key("code-cost-pro", n, label)
    value, valuelow = k("value"), k("valuelow")
    budget, over = k("budget"), k("over")
    bymodel, byproject, cache, trend = k("bymodel"), k("byproject"), k("cache"), k("trend")
    return {
        "game": "AI COST", "name": "Claude & Codex Cost Pro",
        "logo_img": glyph_logo("scale"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "",
        "os_support": "Windows and macOS",
        "os_glyphs": ["brand-windows", "brand-apple"],
        "hero_chips": ["Pro", "Stream Deck + dial"],
        "hero_title_clean": "Claude Code Value",
        "hero_title": ["Is your plan", "paying for itself?"],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "What your usage was worth against what your plan costs, plus where every dollar went.",
        "bullets": ["Plan Value: usage priced at token rates against your plan price",
                    "All time totals, not just the last 30 days",
                    "Budget bar, cache hit rate and a daily trend chart"],
        "hero_keys": [value, budget, bymodel, cache, trend],
        "device_photo_mockup": True,
        "bottom": [("scale", "Plan Value", "Worth vs paid"),
                   ("chart-donut", "Where it went", "Model and project"),
                   ("database", "Cache hit", "What it saved"),
                   ("history", "All time", "Full history")],
        "feature_banners": [
            ("Is your plan paying for itself?",
             [value, valuelow], ["Earning its keep", "Not yet"], None,
             "Plan Value prices your last 30 days at token rates and divides it by what your plan costs. Above 1x the plan has paid for itself and the key goes green. Below it, you are paying for headroom you are not using. No other plugin shows this."),
            ("Where the money actually went.",
             [bymodel, byproject], None, None,
             "The top three by model, or by project. Press to swap. A week where one model quietly took most of the spend is obvious the moment you look down."),
            ("A budget you can see filling up.",
             [budget, over], ["Inside budget", "Over"], None,
             "Set a monthly figure and the bar fills as the month runs. It turns red when you go past it, so the overrun is visible on day six rather than on the invoice."),
            ("Cache hit rate, and the daily shape.",
             [cache, trend], None, None,
             "How much of your prompt was served from cache and what that discount was worth, next to a bar per day. A quiet week and a runaway one look completely different at a glance."),
        ],
        "statement": ["Is your plan paying for itself?",
                      "Plan Value answers it in one number, and the rest of the deck shows you why."],
        "video_scenes": [
            ("Is your plan paying for itself?", [value]),
            ("Where the money went", [bymodel, byproject]),
            ("A budget you can see", [budget, over]),
            ("Claude & Codex Cost Pro", [value, cache, trend]),
        ],
        "description": {
            "search_line": "Claude Code value on a key. Plan Value shows what your Claude and Codex usage was worth at token rates against what your plan costs, so you can tell whether it is paying for itself.",
            "intro": "Knowing what you spent is one thing. Knowing whether it was worth it is another. Plan Value prices your last 30 days of Claude Code and Codex usage at published token rates and divides it by what you pay each month. Above 1x the plan has earned its keep. Alongside it: where the money went by model and by project, a budget bar, cache hit rate and a daily trend.",
            "tagline": "Is your plan paying for itself?",
            "features": [
                ("Plan Value", "Your usage priced at token rates against your plan price. Green once the plan has paid for itself, amber while it has not."),
                ("By model and by project", "The top three of each, so a model or a repository quietly eating the month is easy to spot. Press the key to swap."),
                ("Budget bar", "Set a monthly figure and watch it fill. It turns red when you go over, on the key, while there is still month left."),
                ("Cache hit rate", "What share of your prompt came from cache and what that discount was worth."),
                ("Daily trend", "One bar per day, up to 30, so a bad week has a shape you recognise."),
                ("All time", "Every session still on your computer, totalled. Cost, breakdown and cache hit all read the full history, not just the last 30 days."),
                ("Dial support", "On a Stream Deck +, turn the dial to scrub between today, 7 days and 30 days."),
            ],
            "outro": "Reads the session files Claude Code and Codex already save on your computer. No account, no key, nothing uploaded. For Windows and macOS. Costs are an estimate worked out from published token rates and will not match a bill exactly.",
            "keywords": ["claude", "chatgpt", "monitor", "codex", "token cost", "Stream Deck plugin"],
            "collection": PLUGIN_COLLECTION,
        },
    }



def ultimate_cfg():
    A = tokens.ACCENT
    k = ultimate_key
    out, mic, clip, shot = k("output"), k("mic-live"), k("clip1"), k("shot")
    left, mx, screen = k("left"), k("max"), k("screen")
    web, discord, spotify = k("web"), k("discord"), k("spotify")
    work, focus, smart, home = k("work"), k("focus"), k("smart"), k("home")
    return {
        "game": "ULTIMATE", "name": "Stream Deck Ultimate",
        "logo_img": glyph_logo("layout-grid"),
        "brand": A, "bg": BG, "icon": "", "icon_sub": "",
        "os_support": "Windows",
        "os_glyphs": ["brand-windows"],
        "hero_chips": ["Stream Deck Plugin", "All StreamDecks"],
        "hero_title_clean": "Stream Deck Ultimate",
        "hero_title": ["Audio, windows,", "clipboard. One deck."],
        "hero_device_frac": tokens.HERO_DEVICE_FRAC,
        "hero_title_max_sz": tokens.HERO_TITLE_MAX_SZ,
        "hero_deck": "new",
        "tagline": "Per app volume, window snapping, clipboard history and screenshots, all on one deck.",
        "bullets": ["Set the volume of one app without touching everything else",
                    "Snap the window in front of you to half, corner or the next screen",
                    "Your last four copies waiting on four keys"],
        # Twelve of fifteen. The deck stays honestly partly lit; padding the last row
        # would be inventing keys the buyer has not placed yet.
        # No Discord or Spotify on the COVER: house rule 5, third-party marks on cover art
        # are a trademark rejection vector. Both still appear in the feature banners, which
        # is where showing the real Smart App keys belongs.
        "hero_keys": [out, mic, clip, shot, left, mx, screen, web, work, focus, smart, home],
        "device_photo_mockup": True,
        "bottom": [("volume", "Per app volume", "One app, not everything"),
                   ("layout-sidebar", "Window snapping", "Half, corner, next screen"),
                   ("clipboard-text", "Clipboard history", "Your last four copies"),
                   ("microphone", "Mic and outputs", "Switch and mute in one press")],
        "feature_banners": [
            ("Turn one app down, not everything.",
             [out, mic], None, None,
             "Set the volume of whatever you are listening to without dragging the whole system down with it. Pick an app to stay locked to, or let the key follow whichever window you are in."),
            ("Put the window where you want it.",
             [left, mx, screen], None, None,
             "Snap the window in front of you to half the screen, a corner, or the monitor next door. No dragging, no guessing at edges."),
            ("Your last four copies, waiting.",
             [clip, shot], None, None,
             "Copy, copy, copy, and they are all still on the deck. A press pastes any of them back. Screenshots go to a key too, region or full screen."),
            ("One press sets the whole desk up.",
             [work, focus, smart], None, None,
             "Work, Focus, Meeting and Gaming each open the apps you picked, arrange them, and set your audio to match. The Smart keys change with whatever app is in front of you."),
        ],
        "statement": ["Audio, windows and clipboard on one deck.",
                      "The things you do a hundred times a day, each sitting on a key."],
        "video_scenes": [
            ("Turn one app down", [out, mic]),
            ("Snap the window", [left, mx, screen]),
            ("Paste what you copied", [clip, shot]),
            ("Stream Deck Ultimate", [work, smart, home]),
        ],
        "description": {
            # Measured demand, query_suggestions_top3000.csv (median across top 1000 is 18):
            # audio 195 (Plugins), windows 192 (Profiles), volume 162 (Plugins),
            # clipboard 54 (Plugins), smart 41 (Plugins), utilities 31 (Plugins).
            # "ultimate" has NO row at all, so the product name carries no search weight and
            # cannot lead. screenshot (25) and productivity (25) are Icons-dominant, which is
            # the wrong traffic, so both sit in the body rather than the search line.
            "search_line": "Audio, windows and clipboard control for Stream Deck: set the volume of one app on its own, snap any window to half or a corner, and keep your last four copies on four keys.",
            "intro": "The small things add up. Hunting for the volume mixer to turn one app down, dragging a window to the right half of the screen, copying something twice because the first copy is already gone. Stream Deck Ultimate puts each of those on a key.",
            "tagline": "Audio, windows and clipboard on one deck.",
            "features": [
                ("Per app volume", "Turn one app up or down on its own. Lock a key to a chosen app, or let it follow whichever window you are working in."),
                ("Window snapping", "Send the window in front of you to half the screen, a corner, maximised, or the next monitor."),
                ("Clipboard history", "Your last four copies sit on four keys with a preview of each, and a press pastes one straight back in."),
                ("Screenshots", "Grab a region, a window or the whole screen from a key, and jump to the folder they land in."),
                ("Audio devices and mic", "Switch output and input, and mute your microphone. Pick which microphone the key mutes, so a virtual mixer does not get in the way."),
                ("Routines", "Work, Focus, Meeting and Gaming each open your apps, arrange the windows, and set the audio to match, in one press."),
                ("Smart keys", "Four keys that change with the app in front of you: browser tabs, editor commands, file navigation or music controls."),
            ],
            "outro": "For Windows, on every Stream Deck model. Everything runs on your own computer and nothing about what you copy or capture leaves it.",
            "keywords": ["audio", "volume", "windows", "clipboard", "smart", "utilities"],
            "collection": PLUGIN_COLLECTION,
        },
    }


RELEASE_NOTES["stream-deck-ultimate"] = """Initial release. Windows, every Stream Deck model.
- Per app volume: hold a key to one app, or let it follow the window you are in.
- Window control: halves, corners, centre, maximise, minimise, always on top and next monitor.
- Clipboard history: your last four copies on four keys, each with a preview, kept after a restart.
- Screenshots: region, window or full screen, plus a key that opens the folder they land in.
- Audio devices: switch output and input, adjust volume and mute the microphone.
- Pick which microphone the mic key mutes, so a virtual mixer does not get in the way.
- Routines: Work, Focus, Meeting and Gaming open your apps, arrange them and set the audio.
- Smart keys: four keys that follow the app in front of you, in browser, editor, files and music.
- Setup page for choosing your apps and audio devices, and a diagnostics report that carries no personal data."""


BUILDS = [
    ("stream-deck-ultimate", ultimate_cfg),
    ("ai-prompts-lite", ai_prompts_lite_cfg),
    ("ai-prompts-creator", ai_prompts_creator_cfg),
    ("ai-prompts-developer", ai_prompts_developer_cfg),
    ("ai-prompts-marketing", ai_prompts_marketing_cfg),
    ("ai-prompts-freelancer", ai_prompts_freelancer_cfg),
    ("ai-prompts-coach", ai_prompts_coach_cfg),
    ("ai-prompt-toolkit", ai_prompt_toolkit_cfg),
    ("calendar", calendar_cfg),
    ("calendar-pro", calendar_pro_cfg),
    ("clipboard-manager", clipboard_cfg),
    ("clipboard-manager-pro", clipboard_pro_cfg),
    ("claude-usage", claude_usage_cfg),
    ("ai-usage-tracker", ai_usage_tracker_cfg),
    ("davinci-resolve-lite", davinci_lite_cfg),
    ("davinci-resolve-pro", davinci_pro_cfg),
    ("valorant", valorant_cfg),
    ("streamer-starter-pack", starter_cfg),
    ("davinci-resolve", davinci_cfg),
    ("palworld", palworld_cfg),
    ("discord-essentials", discord_cfg),
    ("streamer-university", su_cfg),
    ("screensaver-cycler", screensaver_cfg),
    ("better-hotkeys", betterhotkeys_cfg),
    ("better-hotkeys-pro", betterhotkeys_pro_cfg),
    ("window-manager", windowmanager_cfg),
    ("window-manager-pro", windowmanager_pro_cfg),
    ("workflow-automation", workflow_cfg),
    ("workflow-automation-pro", workflow_pro_cfg),
    ("code-cost", codecost_cfg),
    ("code-cost-pro", codecostpro_cfg),
    ("nba-tracker", nba_cfg),
    ("nfl-tracker", nfl_cfg),
    ("nhl-tracker", nhl_cfg),
    ("soccer-tracker", soccer_cfg),
    ("ufc-tracker", ufc_cfg),
    ("nascar-tracker", nascar_cfg),
    ("ultimate-sports", ultimate_sports_cfg),
    ("epic-pen", epic_pen_cfg),
    ("epic-pen-pro", epic_pen_pro_cfg),
    ("vectorworks", vectorworks_cfg),
    ("fortnite", fortnite_cfg),
    ("satisfactory", satisfactory_cfg),
    ("world-of-warcraft", wow_cfg),
    ("elite-dangerous", elite_cfg),
    ("osrs", osrs_cfg),
    ("forza", forza_cfg),
    ("solidworks", solidworks_cfg),
    ("minecraft", minecraft_cfg),
    ("cs2", cs2_cfg),
    ("league-of-legends", lol_cfg),
    ("dota2", dota2_cfg),
    ("fl-studio", flstudio_cfg),
    ("world-of-warcraft-vsd", wow_vsd_cfg),
    ("osrs-vsd", osrs_vsd_cfg),
    *((slug, (lambda s=slug: icon_pack_cfg(s))) for slug in ICON_PACKS),
    *((slug, (lambda s=slug: widget_cfg(s))) for slug in WIDGET_COPY),
]

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    compare = "--compare" in sys.argv
    only = args[0] if args else None
    if only and only not in dict(BUILDS):
        sys.exit(
            f"gen_marketing.py: no BUILDS entry for '{only}'. "
            f"Known slugs: {', '.join(f for f, _ in BUILDS)}."
        )
    for folder, fn in BUILDS:
        if only and folder != only:
            continue
        if compare:
            print("comparison:", folder)
            render_comparison(folder, fn())
        else:
            print("marketing:", folder)
            build_one(folder, fn())

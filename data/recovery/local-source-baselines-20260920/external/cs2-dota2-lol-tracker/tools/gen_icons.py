# coding: utf-8
#!/usr/bin/env python3
"""
Generate every PNG asset a Ratpack Stream Deck plugin needs:
  imgs/plugin/marketplace.png (288) + @2x (512)   -- store / plugin icon
  imgs/plugin/category-icon.png (28) + @2x (56)    -- action-list category icon
  imgs/actions/<a>/icon.png (20) + @2x (40)        -- action list icon
  imgs/actions/<a>/key.png (72) + @2x (144)        -- default key image

One run builds icons for all five plugins. Glyphs are drawn from primitives (no fonts
needed for shapes) and supersampled 4x for clean edges. Run:  python tools/gen_icons.py
"""
import os, sys, math, subprocess

def ensure_deps():
    try:
        import PIL  # noqa
    except Exception:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow>=10.3.0"])
ensure_deps()

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SS = 4  # supersample factor

def font(size):
    for p in [r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# ---------------------------------------------------------------- Tabler glyphs
# A glyph name prefixed "ti:" is rendered from the Tabler webfont (clean line icons)
# instead of a hand-drawn primitive. Same font the marketing engine uses.
import re
_ICON_TTF = os.path.join(ROOT, "assets", "icons", "tabler-icons.ttf")
_ICON_CSS = os.path.join(ROOT, "assets", "icons", "tabler-icons.css")
_IMAP = None
def _imap():
    global _IMAP
    if _IMAP is None:
        _IMAP = {}
        try:
            css = open(_ICON_CSS, encoding="utf-8").read()
            for nm, code in re.findall(r'\.ti-([a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"', css, re.S):
                _IMAP[nm] = chr(int(code, 16))
        except Exception:
            pass
    return _IMAP

def _paste_tabler(img, box, name, color):
    ch = _imap().get(name)
    x0, y0, x1, y1 = box
    side = min(x1 - x0, y1 - y0)
    if not ch or not os.path.exists(_ICON_TTF):
        return
    f = ImageFont.truetype(_ICON_TTF, int(side))
    tmp = Image.new("RGBA", (int(side * 1.5), int(side * 1.5)), (0, 0, 0, 0))
    ImageDraw.Draw(tmp).text((tmp.width / 2, tmp.height / 2), ch, font=f, fill=(*color, 255), anchor="mm")
    img.alpha_composite(tmp, (int((x0 + x1) / 2 - tmp.width / 2), int((y0 + y1) / 2 - tmp.height / 2)))

def draw_glyph(img, d, glyph, box, color):
    if isinstance(glyph, str) and glyph.startswith("ti:"):
        _paste_tabler(img, box, glyph[3:], color)
    else:
        GLYPHS[glyph](d, box, color)

# ---------------------------------------------------------------- glyph drawers
# Each draws inside box (x0,y0,x1,y1) on draw `d` with primary color `c` (RGB).

def _box(box):
    x0, y0, x1, y1 = box
    return x0, y0, x1, y1, x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2

def g_cross(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    t = w * 0.30
    d.rounded_rectangle([cx - t/2, y0, cx + t/2, y1], radius=t*0.25, fill=c)
    d.rounded_rectangle([x0, cy - t/2, x1, cy + t/2], radius=t*0.25, fill=c)

def g_bullet(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    casing = hex2rgb("#caa14a")
    bw = w * 0.5
    d.rounded_rectangle([cx - bw/2, cy - h*0.1, cx + bw/2, y1], radius=bw*0.2, fill=casing)
    d.polygon([(cx - bw/2, cy - h*0.1), (cx + bw/2, cy - h*0.1), (cx, y0)], fill=c)

def g_skull(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    d.ellipse([x0, y0, x1, y0 + h*0.78], fill=c)
    d.rectangle([cx - w*0.22, y0 + h*0.55, cx + w*0.22, y1], fill=c)
    eye = w * 0.18
    d.ellipse([cx - w*0.28 - eye/2, cy - eye/2, cx - w*0.28 + eye/2, cy + eye/2], fill=(10, 10, 12))
    d.ellipse([cx + w*0.28 - eye/2, cy - eye/2, cx + w*0.28 + eye/2, cy + eye/2], fill=(10, 10, 12))
    d.polygon([(cx, cy + h*0.05), (cx - w*0.08, cy + h*0.22), (cx + w*0.08, cy + h*0.22)], fill=(10, 10, 12))

def g_flag(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    pole = w * 0.10
    d.rounded_rectangle([x0 + w*0.18, y0, x0 + w*0.18 + pole, y1], radius=pole/2, fill=hex2rgb("#cfd3da"))
    d.polygon([(x0 + w*0.18 + pole, y0), (x1, y0 + h*0.22), (x0 + w*0.18 + pole, y0 + h*0.44)], fill=c)

def g_droplet(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    d.ellipse([x0 + w*0.12, y0 + h*0.35, x1 - w*0.12, y1], fill=c)
    d.polygon([(cx, y0), (x0 + w*0.18, cy + h*0.05), (x1 - w*0.18, cy + h*0.05)], fill=c)

def g_coin(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    d.ellipse([x0, y0, x1, y1], fill=c)
    d.ellipse([x0 + w*0.12, y0 + h*0.12, x1 - w*0.12, y1 - h*0.12], outline=(10, 10, 12), width=int(w*0.05))
    f = font(int(h*0.62))
    bb = d.textbbox((0, 0), "$", font=f)
    d.text((cx - (bb[2]-bb[0])/2 - bb[0], cy - (bb[3]-bb[1])/2 - bb[1]), "$", font=f, fill=(10, 10, 12))

def g_swords(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    lw = int(w*0.10)
    steel = hex2rgb("#d7dbe2")
    d.line([(x0, y1), (x1, y0)], fill=steel, width=lw)
    d.line([(x0, y0), (x1, y1)], fill=steel, width=lw)
    d.line([(x0, y1), (x0 + w*0.22, y1 - h*0.22)], fill=c, width=lw+2)
    d.line([(x1, y1), (x1 - w*0.22, y1 - h*0.22)], fill=c, width=lw+2)

def g_satellite(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    d.rounded_rectangle([cx - w*0.12, cy - h*0.16, cx + w*0.12, cy + h*0.16], radius=w*0.04, fill=c)
    panel = hex2rgb("#5b8bd0")
    d.rectangle([x0, cy - h*0.10, cx - w*0.16, cy + h*0.10], fill=panel)
    d.rectangle([cx + w*0.16, cy - h*0.10, x1, cy + h*0.10], fill=panel)
    d.line([x0, cy, x1, cy], fill=(10, 10, 12), width=int(w*0.02))

def g_rocket(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    body = hex2rgb("#e9edf5")
    d.rounded_rectangle([cx - w*0.18, y0 + h*0.18, cx + w*0.18, y1 - h*0.20], radius=w*0.18, fill=body)
    d.polygon([(cx, y0), (cx - w*0.18, y0 + h*0.22), (cx + w*0.18, y0 + h*0.22)], fill=c)
    d.polygon([(cx - w*0.18, y1 - h*0.32), (cx - w*0.34, y1 - h*0.10), (cx - w*0.18, y1 - h*0.12)], fill=c)
    d.polygon([(cx + w*0.18, y1 - h*0.32), (cx + w*0.34, y1 - h*0.10), (cx + w*0.18, y1 - h*0.12)], fill=c)
    d.ellipse([cx - w*0.09, cy - h*0.06, cx + w*0.09, cy + h*0.12], fill=hex2rgb("#3b82f6"))

def g_image(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    d.rounded_rectangle(box, radius=w*0.10, outline=c, width=int(w*0.07))
    d.ellipse([x0 + w*0.16, y0 + h*0.16, x0 + w*0.36, y0 + h*0.36], fill=hex2rgb("#ffd60a"))
    d.polygon([(x0 + w*0.12, y1 - h*0.12), (x0 + w*0.42, cy), (x0 + w*0.62, y1 - h*0.12)], fill=c)
    d.polygon([(x0 + w*0.46, y1 - h*0.12), (x0 + w*0.72, cy + h*0.04), (x1 - w*0.10, y1 - h*0.12)], fill=c)

def g_hourglass(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    cap = hex2rgb("#cfd3da")
    d.rectangle([x0, y0, x1, y0 + h*0.08], fill=cap)
    d.rectangle([x0, y1 - h*0.08, x1, y1], fill=cap)
    d.polygon([(x0 + w*0.08, y0 + h*0.08), (x1 - w*0.08, y0 + h*0.08), (cx, cy)], fill=c)
    d.polygon([(x0 + w*0.08, y1 - h*0.08), (x1 - w*0.08, y1 - h*0.08), (cx, cy)], fill=c)

def g_crosshair(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    lw = int(w*0.06)
    d.ellipse([x0, y0, x1, y1], outline=c, width=lw)
    d.line([(cx, y0 - h*0.02), (cx, y0 + h*0.22)], fill=c, width=lw)
    d.line([(cx, y1 - h*0.22), (cx, y1 + h*0.02)], fill=c, width=lw)
    d.line([(x0 - w*0.02, cy), (x0 + w*0.22, cy)], fill=c, width=lw)
    d.line([(x1 - w*0.22, cy), (x1 + w*0.02, cy)], fill=c, width=lw)
    d.ellipse([cx - w*0.04, cy - h*0.04, cx + w*0.04, cy + h*0.04], fill=c)

def g_cart(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    lw = int(w*0.07)
    d.line([(x0, y0 + h*0.12), (x0 + w*0.2, y0 + h*0.12)], fill=c, width=lw)
    d.line([(x0 + w*0.2, y0 + h*0.12), (x0 + w*0.32, y1 - h*0.28)], fill=c, width=lw)
    d.line([(x0 + w*0.30, y1 - h*0.28), (x1, y1 - h*0.28)], fill=c, width=lw)
    d.line([(x0 + w*0.20, y0 + h*0.30), (x1 - w*0.02, y0 + h*0.30)], fill=c, width=lw)
    d.ellipse([x0 + w*0.30, y1 - h*0.18, x0 + w*0.46, y1 - h*0.02], fill=c)
    d.ellipse([x1 - w*0.28, y1 - h*0.18, x1 - w*0.12, y1 - h*0.02], fill=c)

def g_clock(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    lw = max(2, int(w*0.06))
    d.ellipse([x0, y0, x1, y1], outline=c, width=lw)
    d.line([(cx, cy), (cx, y0 + h*0.22)], fill=c, width=lw)          # hour hand up
    d.line([(cx, cy), (x1 - w*0.26, cy)], fill=c, width=lw)          # minute hand right
    d.ellipse([cx - w*0.04, cy - h*0.04, cx + w*0.04, cy + h*0.04], fill=c)

def g_star(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    r_out = min(w, h)/2
    r_in = r_out*0.45
    pts = []
    for i in range(10):
        a = math.radians(-90 + i*36)
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + r*math.cos(a), cy + r*math.sin(a)))
    d.polygon(pts, fill=c)

def g_bars(d, box, c):
    x0, y0, x1, y1, w, h, cx, cy = _box(box)
    bw = w*0.20
    d.rounded_rectangle([x0+w*0.10, cy, x0+w*0.10+bw, y1], radius=3, fill=c)
    d.rounded_rectangle([cx-bw/2, y0+h*0.28, cx+bw/2, y1], radius=3, fill=c)
    d.rounded_rectangle([x1-w*0.10-bw, y0+h*0.08, x1-w*0.10, y1], radius=3, fill=c)

GLYPHS = {
    "cross": g_cross, "bullet": g_bullet, "skull": g_skull, "flag": g_flag,
    "droplet": g_droplet, "coin": g_coin, "swords": g_swords, "satellite": g_satellite,
    "rocket": g_rocket, "image": g_image, "hourglass": g_hourglass, "crosshair": g_crosshair,
    "cart": g_cart, "clock": g_clock, "bars": g_bars, "star": g_star,
}

# ---------------------------------------------------------------- canvas helpers

def new(size, bg=None):
    img = Image.new("RGBA", (size*SS, size*SS), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def save(img, size, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(path)

def tile(size, palette, glyph, inset=0.20, bg=True, label=None):
    """Dark rounded tile with an accent glyph; used for key + marketplace images."""
    s = size * SS
    img, d = new(size)
    accent = hex2rgb(palette["accent"])
    if bg:
        d.rounded_rectangle([0, 0, s-1, s-1], radius=s*0.14, fill=hex2rgb(palette["bg"]))
        # accent glow plate, composited so the dark tile shows through
        plate = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(plate).rounded_rectangle([s*0.10, s*0.08, s*0.90, s*0.62], radius=s*0.08, fill=accent + (30,))
        img.alpha_composite(plate)
        d = ImageDraw.Draw(img)
    # Square, centred glyph box (never distort the aspect ratio). When a label is shown,
    # reserve a strip at the bottom and centre the square glyph in the area above it.
    gm = s * inset
    label_strip = s * 0.20 if label else 0
    avail_top, avail_bottom = gm, s - gm - label_strip
    avail_w, avail_h = s - 2 * gm, avail_bottom - avail_top
    side = max(1, min(avail_w, avail_h))
    gx0 = (s - side) / 2
    gy0 = avail_top + (avail_h - side) / 2
    draw_glyph(img, d, glyph, (gx0, gy0, gx0 + side, gy0 + side), accent)
    if label:
        f = font(int(s*0.13))
        bb = d.textbbox((0, 0), label, font=f)
        d.text(((s - (bb[2]-bb[0]))/2 - bb[0], s*0.82 - bb[1]), label, font=f, fill=hex2rgb("#e7eaf2"))
    return img

def list_icon(size, glyph):
    """Small transparent action-list / category icon. Per Elgato's guidelines these MUST be
    monochrome pure white (#FFFFFF) on transparent. Use a Tabler 'ti:' glyph so the stroke is a
    single clean colour (the colourful key images and marketplace tile are rendered separately)."""
    s = size * SS
    img, d = new(size)
    draw_glyph(img, d, glyph, (s*0.12, s*0.12, s*0.88, s*0.88), (255, 255, 255))
    return img

# ---------------------------------------------------------------- per-plugin build

def build_plugin(folder, sdplugin, palette, mkt_glyph, label, cat_icon, actions):
    base = os.path.join(ROOT, folder, sdplugin, "imgs")
    # Plugin marketplace icon (full colour is allowed for the store tile).
    save(tile(288, palette, mkt_glyph, inset=0.26, label=label), 288, os.path.join(base, "plugin", "marketplace.png"))
    save(tile(512, palette, mkt_glyph, inset=0.26, label=label), 512, os.path.join(base, "plugin", "marketplace@2x.png"))
    # Category icon: MUST be white monochrome.
    save(list_icon(28, cat_icon), 28, os.path.join(base, "plugin", "category-icon.png"))
    save(list_icon(56, cat_icon), 56, os.path.join(base, "plugin", "category-icon@2x.png"))
    for adir, key_glyph, alabel, list_glyph in actions:
        ad = os.path.join(base, "actions", adir)
        # Action list icon: MUST be white monochrome.
        save(list_icon(20, list_glyph), 20, os.path.join(ad, "icon.png"))
        save(list_icon(40, list_glyph), 40, os.path.join(ad, "icon@2x.png"))
        # Key (button) image: full colour is allowed.
        save(tile(72, palette, key_glyph, inset=0.22, label=alabel), 72, os.path.join(ad, "key.png"))
        save(tile(144, palette, key_glyph, inset=0.22, label=alabel), 144, os.path.join(ad, "key@2x.png"))
    # icon.png in the plugin root for the marketplace-art top bar (full colour).
    save(tile(256, palette, mkt_glyph, inset=0.26), 256, os.path.join(ROOT, folder, "icon.png"))
    print(f"icons -> {folder}")

# Per plugin: folder, sdPlugin, palette, marketplace glyph (colour), label, category list-icon
# (white Tabler), then actions as (dir, key glyph [colour], key label, list icon [white Tabler]).
PLUGINS = [
    ("cs2-reactive-deck", "com.ratpack.cs2reactivedeck.sdPlugin",
     {"bg": "#0c0d10", "accent": "#de9b35"}, "crosshair", "CS2", "ti:crosshair",
     [("health", "cross", "HP", "ti:heart"), ("ammo", "bullet", "AMMO", "ti:bolt"), ("killfeed", "skull", "KILLS", "ti:skull"),
      ("phase", "flag", "PHASE", "ti:flag"), ("money", "coin", "CASH", "ti:coin"), ("kda", "swords", "KDA", "ti:swords"),
      ("score", "bars", "SCORE", "ti:chart-bar")]),
    ("dota2-reactive-deck", "com.ratpack.dota2reactivedeck.sdPlugin",
     {"bg": "#120a0a", "accent": "#c23c2a"}, "swords", "DOTA 2", "ti:swords",
     [("hpmana", "droplet", "HP/MP", "ti:heart"), ("gold", "coin", "GOLD", "ti:coin"), ("roshan", "skull", "ROSH", "ti:skull"),
      ("kda", "swords", "KDA", "ti:swords"), ("respawn", "skull", "DEAD", "ti:hourglass-high"), ("matchtimer", "clock", "TIME", "ti:clock"),
      ("networth", "coin", "WORTH", "ti:coins")]),
    ("lol-live-companion", "com.ratpack.lollivecompanion.sdPlugin",
     {"bg": "#0a1014", "accent": "#c8aa6e"}, "coin", "LoL", "ti:coin",
     [("gold", "coin", "GOLD", "ti:coin"), ("health", "cross", "HP", "ti:heart"), ("afford", "cart", "BUY", "ti:shopping-cart"),
      ("kda", "swords", "KDA", "ti:swords"), ("level", "star", "LVL", "ti:star"), ("cs", "swords", "CS", "ti:target")]),
    ("nasa-space-tracker", "com.ratpack.nasaspacetracker.sdPlugin",
     {"bg": "#070b18", "accent": "#4a7bd6"}, "rocket", "NASA", "ti:rocket",
     [("iss", "satellite", "ISS", "ti:satellite"), ("launch", "rocket", "LAUNCH", "ti:rocket"), ("apod", "image", "APOD", "ti:photo")]),
    ("event-countdown", "com.ratpack.eventcountdown.sdPlugin",
     {"bg": "#100a18", "accent": "#a06bdc"}, "ti:calendar-time", "COUNTDOWN", "ti:calendar-time",
     [("countdown", "ti:calendar-time", "", "ti:calendar-time")]),
]

if __name__ == "__main__":
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for p in PLUGINS:
        if only and p[0] != only:
            continue
        build_plugin(*p)
    print("done")

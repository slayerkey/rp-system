# coding: utf-8
#!/usr/bin/env python3
"""
Shared Ratpack marketing engine for all five plugins. Built on the /marketplace-art engine
(canvas, top/bottom bars, gradient titles, key layout) plus parametric banner templates and a
`render_key` that mirrors the plugins' real SVG button look, so we don't redo art per plugin.

A per-plugin `scripts/gen-marketing.py` imports this, supplies a CONFIG, and calls build().
"""
import os, sys, subprocess, math

def ensure_deps():
    need = []
    for mod, pkg in [("PIL", "Pillow>=10.3.0"), ("numpy", "numpy")]:
        try:
            __import__(mod)
        except Exception:
            need.append(pkg)
    if need:
        subprocess.check_call([sys.executable, "-m", "pip", "install", *need])
ensure_deps()

from PIL import Image, ImageDraw, ImageFont, ImageFilter

KEY_SZ = 144
BRAND_NAME = "Ratpack"

# Repo-level brand asset: the Ratpack icon ALWAYS sits in the top-left bar (never the game icon).
_ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_ENGINE_DIR)
RATPACK_ICON = os.path.join(_REPO_ROOT, "assets", "ratpack-icon.png")
ICON_TTF = os.path.join(_REPO_ROOT, "assets", "icons", "tabler-icons.ttf")
ICON_CSS = os.path.join(_REPO_ROOT, "assets", "icons", "tabler-icons.css")

import re
_ICON_MAP = None
def _icon_map():
    global _ICON_MAP
    if _ICON_MAP is None:
        _ICON_MAP = {}
        try:
            css = open(ICON_CSS, encoding="utf-8").read()
            for nm, code in re.findall(r'\.ti-([a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"', css, re.S):
                _ICON_MAP[nm] = chr(int(code, 16))
        except Exception:
            pass
    return _ICON_MAP

def icon_img(name, size, color=(245, 250, 248)):
    """Render a real Tabler icon glyph (MIT, free for commercial). Returns None if unavailable."""
    ch = _icon_map().get(name)
    if not ch or not os.path.exists(ICON_TTF):
        return None
    pad = int(size * 0.16); box = size + pad * 2
    img = Image.new("RGBA", (box, box), (0, 0, 0, 0))
    try:
        ImageDraw.Draw(img).text((box / 2, box / 2), ch, font=ImageFont.truetype(ICON_TTF, size), fill=(*color[:3], 255), anchor="mm")
    except Exception:
        return None
    return img

# These are set per-plugin via build().
BRAND = (255, 138, 61)
BG = (8, 10, 16)
ICON_PATH = ""
OUT_DIR = ""

# ── Font ─────────────────────────────────────────────────────────────────────────
_FP = None
def get_fp():
    global _FP
    if _FP is not None:
        return _FP
    for p in [r"C:\Windows\Fonts\Montserrat-SemiBold.ttf", r"C:\Windows\Fonts\Inter-SemiBold.ttf",
              r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf"]:
        if os.path.exists(p):
            _FP = p
            return p
    return None

def fnt(size):
    fp = get_fp()
    try:
        return ImageFont.truetype(fp, size) if fp else ImageFont.load_default()
    except Exception:
        return ImageFont.load_default()

_DI = Image.new("L", (1, 1)); _DD = ImageDraw.Draw(_DI)
def txt_size(text, f):
    bb = _DD.textbbox((0, 0), text, font=f)
    return bb[2] - bb[0], bb[3] - bb[1]

def fit_fnt(text, max_w, max_sz, min_sz=14):
    for sz in range(max_sz, min_sz - 1, -2):
        f = fnt(sz)
        if txt_size(text, f)[0] <= max_w:
            return f
    return fnt(min_sz)

# ── Canvas builder ─────────────────────────────────────────────────────────────────
def make_canvas(W=1920, H=960, accent=None):
    accent = accent or BRAND
    canvas = Image.new("RGBA", (W, H), (*BG, 255))
    ImageDraw.Draw(canvas).rectangle([(0, 76), (W, H - 170)], fill=(6, 7, 12, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([(W // 2 - 200, 50), (W + 300, H - 50)], fill=(*accent, 40))
    glow = glow.filter(ImageFilter.GaussianBlur(180))
    canvas = Image.alpha_composite(canvas, glow)
    vign = Image.new("RGBA", (W, H), (0, 0, 0, 0)); vd = ImageDraw.Draw(vign)
    for r2 in range(max(W, H) // 2, 0, -14):
        t = r2 / (max(W, H) / 2); a = int(80 * t ** 2.5)
        if a > 0:
            vd.ellipse([(W // 2 - r2, H // 2 - r2), (W // 2 + r2, H // 2 + r2)], fill=(0, 0, 0, a))
    canvas = Image.alpha_composite(canvas, vign)
    _top_bar(canvas, W, accent)
    return canvas

def _top_bar(canvas, W, accent):
    TOP_H = 76; d = ImageDraw.Draw(canvas)
    d.rectangle([(0, 0), (W, TOP_H)], fill=(*BG, 255))
    _grad_line(canvas, TOP_H - 2, 0, W, (*accent, 200))
    lx = 14; icon_sz = int((TOP_H - 6) * 1.17)
    # Top-left brand icon is ALWAYS the Ratpack rat, never the game/plugin icon.
    if os.path.exists(RATPACK_ICON):
        try:
            ico = Image.open(RATPACK_ICON).convert("RGBA").resize((icon_sz, icon_sz), Image.LANCZOS)
            canvas.alpha_composite(ico, dest=(lx, (TOP_H - icon_sz) // 2)); lx += icon_sz + 12
        except Exception:
            pass
    d = ImageDraw.Draw(canvas); f_brand = fnt(28)
    bb = d.textbbox((0, 0), BRAND_NAME, font=f_brand)
    d.text((lx - bb[0], (TOP_H - (bb[3] - bb[1])) // 2 - bb[1]), BRAND_NAME, fill=(210, 220, 240, 230), font=f_brand)
    d.text((W - 170, (TOP_H - 20) // 2), "///", fill=(*accent, 130), font=fnt(20))
    d.line([(W - 110, TOP_H // 2), (W - 28, TOP_H // 2)], fill=(*accent, 80), width=1)

def _grad_line(canvas, y, x0, x1, color):
    r, g, b, a = color; w = x1 - x0
    ln = Image.new("RGBA", (w, 2), (0, 0, 0, 0)); px = ln.load()
    for xi in range(w):
        t = xi / max(w - 1, 1); fade = (1 - abs(t - 0.5) * 2) ** 0.5; al = int(a * fade)
        px[xi, 0] = px[xi, 1] = (r, g, b, al)
    canvas.alpha_composite(ln, dest=(x0, y - 1))

def add_bottom_bar(canvas, W, H, features, accent=None):
    accent = accent or BRAND
    BOT_H = 170; BOT_Y = H - BOT_H; d = ImageDraw.Draw(canvas)
    d.rectangle([(0, BOT_Y), (W, H)], fill=(*BG, 255))
    _grad_line(canvas, BOT_Y + 4, 0, W, (*accent, 200))
    n = len(features); tile_w = W // n
    for i, feat in enumerate(features):
        ikind, la, lb = feat[0], feat[1], feat[2]
        tx = i * tile_w
        if i > 0:
            d.line([(tx, BOT_Y + 20), (tx, H - 20)], fill=(255, 255, 255, 18), width=1)
        isz = 64; pad = 22; gap_ab = 12
        avail_w = tile_w - 2 * pad - isz - 16
        f_sm = fit_fnt(la, avail_w, 20, 12); f_big = fit_fnt(lb, avail_w, 34, 16)
        la_bb = d.textbbox((0, 0), la, font=f_sm); lb_bb = d.textbbox((0, 0), lb, font=f_big)
        la_h = la_bb[3] - la_bb[1]; lb_h = lb_bb[3] - lb_bb[1]
        total_h = la_h + gap_ab + lb_h
        gx = tx + pad; ty0 = BOT_Y + 20 + (BOT_H - 20 - total_h) // 2; icon_cy = ty0 + total_h // 2 - isz // 2
        ico = icon_img(ikind, isz - 8, (*accent, 215))
        if ico is not None:
            canvas.alpha_composite(ico, dest=(gx, icon_cy))
        else:
            _btm_icon(d, ikind, gx, icon_cy, isz, (*accent, 210))
        tfx = gx + isz + 16
        d.text((tfx - la_bb[0], ty0 - la_bb[1]), la, fill=(*accent, 200), font=f_sm)
        d.text((tfx - lb_bb[0], ty0 + la_h + gap_ab - lb_bb[1]), lb, fill=(230, 234, 250, 255), font=f_big)

def _btm_icon(d, kind, x, y, sz, col):
    if kind == "refresh":
        r2 = sz // 2 - 4; cx, cy = x + sz // 2, y + sz // 2
        d.arc([(cx - r2, cy - r2), (cx + r2, cy + r2)], -45, 270, fill=col, width=3)
        d.polygon([(cx + r2 - 2, cy - 8), (cx + r2 + 6, cy - 2), (cx + r2 - 2, cy + 4)], fill=col)
    elif kind == "palette":
        s = sz // 4
        for ri in range(2):
            for ci in range(2):
                d.rounded_rectangle([(x + ci * (s + 4), y + ri * (s + 4)), (x + ci * (s + 4) + s, y + ri * (s + 4) + s)], radius=3, fill=col)
    elif kind == "layers":
        for i in range(3):
            d.rounded_rectangle([(x + i * 5, y + i * 5), (x + sz - i * 5, y + sz - i * 5)], radius=5, outline=col, width=2)
    elif kind == "shield":
        rr = sz // 5; d.rounded_rectangle([(x + 2, y + 2), (x + sz - 2, y + sz - 2)], radius=rr, outline=col, width=2)
        d.line([(x + sz // 5, y + sz * 11 // 20), (x + sz * 2 // 5, y + sz * 7 // 10)], fill=col, width=3)
        d.line([(x + sz * 2 // 5, y + sz * 7 // 10), (x + sz * 4 // 5, y + sz * 3 // 10)], fill=col, width=3)
    elif kind == "clock":
        r2 = sz // 2 - 3; cx, cy = x + sz // 2, y + sz // 2
        d.ellipse([(cx - r2, cy - r2), (cx + r2, cy + r2)], outline=col, width=2)
        d.line([(cx, cy), (cx, cy - r2 + 6)], fill=col, width=3)
        d.line([(cx, cy), (cx + r2 - 8, cy + 4)], fill=col, width=2)
    elif kind == "bolt":
        d.polygon([(x + sz * 0.55, y), (x + sz * 0.2, y + sz * 0.58), (x + sz * 0.45, y + sz * 0.58),
                   (x + sz * 0.4, y + sz), (x + sz * 0.8, y + sz * 0.4), (x + sz * 0.5, y + sz * 0.4)], fill=col)
    elif kind == "globe":
        r2 = sz // 2 - 3; cx, cy = x + sz // 2, y + sz // 2
        d.ellipse([(cx - r2, cy - r2), (cx + r2, cy + r2)], outline=col, width=2)
        d.ellipse([(cx - r2 // 2, cy - r2), (cx + r2 // 2, cy + r2)], outline=col, width=2)
        d.line([(cx - r2, cy), (cx + r2, cy)], fill=col, width=2)
    elif kind == "rocket":
        cx = x + sz // 2
        d.polygon([(cx, y), (cx - sz * 0.18, y + sz * 0.4), (cx + sz * 0.18, y + sz * 0.4)], fill=col)
        d.rounded_rectangle([(cx - sz * 0.18, y + sz * 0.35), (cx + sz * 0.18, y + sz * 0.8)], radius=6, fill=col)
        d.polygon([(cx, y + sz), (cx - sz * 0.14, y + sz * 0.78), (cx + sz * 0.14, y + sz * 0.78)], fill=col)
    elif kind == "star":
        cx, cy = x + sz // 2, y + sz // 2; r_out = sz // 2 - 3; r_in = r_out // 2
        pts = []
        for i in range(10):
            a = math.radians(-90 + i * 36); r = r_out if i % 2 == 0 else r_in
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        d.polygon(pts, fill=col)
    elif kind == "heart":
        cx, cy = x + sz // 2, y + sz // 2 + 4; r = sz // 4
        d.ellipse([(cx - r * 2, cy - r), (cx, cy + r)], fill=col)
        d.ellipse([(cx, cy - r), (cx + r * 2, cy + r)], fill=col)
        d.polygon([(cx - r * 2, cy), (cx + r * 2, cy), (cx, cy + r * 2 + 4)], fill=col)
    elif kind == "coin":
        cx, cy = x + sz // 2, y + sz // 2; r2 = sz // 2 - 3
        d.ellipse([(cx - r2, cy - r2), (cx + r2, cy + r2)], fill=col)
        f = fnt(int(sz * 0.6)); bb = d.textbbox((0, 0), "$", font=f)
        d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], cy - (bb[3] - bb[1]) / 2 - bb[1]), "$", font=f, fill=(10, 10, 12))
    elif kind == "swords":
        d.line([(x, y + sz), (x + sz, y)], fill=col, width=4)
        d.line([(x, y), (x + sz, y + sz)], fill=col, width=4)
    elif kind == "trophy":
        cx = x + sz // 2
        d.rounded_rectangle([(x + sz * 0.25, y), (x + sz * 0.75, y + sz * 0.5)], radius=6, fill=col)
        d.rectangle([(cx - 4, y + sz * 0.5), (cx + 4, y + sz * 0.8)], fill=col)
        d.rectangle([(x + sz * 0.25, y + sz * 0.82), (x + sz * 0.75, y + sz)], fill=col)

# ── Gradient title ───────────────────────────────────────────────────────────────
def add_gradient_title(canvas, text, x, y, max_w, accent=None, white=False, max_sz=150):
    accent = accent or BRAND
    d = ImageDraw.Draw(canvas)
    f = _fit_banner(text, d, max_w, max_sz, 48)
    bb = d.textbbox((0, 0), text, font=f); pw, ph = bb[2] - bb[0], bb[3] - bb[1]
    top = ((min(255, accent[0] + 90), min(255, accent[1] + 60), min(255, accent[2] + 60)) if not white else (255, 255, 255))
    bot = (accent if not white else (215, 220, 240))
    gl = Image.new("RGBA", (pw + 4, ph + 4), (0, 0, 0, 0)); gd = ImageDraw.Draw(gl)
    for yy in range(ph):
        t = (yy / max(ph - 1, 1)) ** 1.6; c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        gd.line([(0, yy), (pw + 4, yy)], fill=(*c, 255))
    mask = Image.new("L", (pw + 4, ph + 4), 0)
    ImageDraw.Draw(mask).text((-bb[0], -bb[1]), text, fill=255, font=f)
    gl.putalpha(mask)
    shd = Image.new("RGBA", (pw + 8, ph + 8), (0, 0, 0, 0))
    ImageDraw.Draw(shd).text((-bb[0] + 3, -bb[1] + 4), text, fill=(0, 0, 0, 90), font=f)
    shd = shd.filter(ImageFilter.GaussianBlur(4))
    canvas.alpha_composite(shd, dest=(x, y)); canvas.alpha_composite(gl, dest=(x, y))
    return ph

def _fit_banner(text, draw, max_w, max_sz=150, min_sz=48):
    for sz in range(max_sz, min_sz - 1, -4):
        f = fnt(sz); bb = draw.textbbox((0, 0), text, font=f)
        if bb[2] - bb[0] <= max_w:
            return f
    return fnt(min_sz)

def draw_center(canvas, text, y, size, color, W=1920, weight=None):
    d = ImageDraw.Draw(canvas); f = fnt(size); tw, _ = txt_size(text, f)
    d.text(((W - tw) // 2, y), text, font=f, fill=(*color[:3], 255))

# ── Key renderer (mirrors the plugins' SVG buttons) ───────────────────────────────
def _vgrad_rounded(size, top, bot, radius):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0)); gd = ImageDraw.Draw(grad)
    for yy in range(size):
        t = yy / max(size - 1, 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        gd.line([(0, yy), (size, yy)], fill=(*c, 255))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=255)
    img.paste(grad, (0, 0), mask)
    return img

def _key_ctext(d, s, cx, y, sz, color, max_w=None):
    f = fnt(int(sz))
    if max_w:
        while _DD.textlength(s, font=f) > max_w and sz > 8:
            sz -= 1; f = fnt(int(sz))
    # anchor="mm" centres exactly on (cx, y), immune to per-glyph bearings (big numbers etc.).
    d.text((cx, y), s, font=f, fill=(*color[:3], 255), anchor="mm")

def _sat_glyph(d, cx, cy, color, f):
    """Tiny satellite: two solar panels and a body, like the app's ISS marker."""
    bl = (74, 123, 214)
    d.rounded_rectangle([cx - 9 * f, cy - 4 * f, cx - 1 * f, cy + 4 * f], radius=1 * f, fill=(*bl, 255))
    d.rounded_rectangle([cx + 1 * f, cy - 4 * f, cx + 9 * f, cy + 4 * f], radius=1 * f, fill=(*bl, 255))
    d.rounded_rectangle([cx - 4 * f, cy - 6 * f, cx + 4 * f, cy + 6 * f], radius=2 * f, fill=(*color[:3], 255))

def _globe_key(spec, size=144):
    """A key mirroring the real ISS button: a little Earth globe with a bright arrow pointing the
    way to the station, the direction spelled out, and the distance. Or the OVERHEAD pulse state."""
    f = size / 144.0
    r = int(size * 0.125)
    img = _vgrad_rounded(size, spec.get("bg", (7, 11, 24)), spec.get("bg2", (3, 5, 12)), r)
    d = ImageDraw.Draw(img)
    blue = (74, 123, 214); blue_br = (125, 169, 255); white = (245, 248, 255); dim = (150, 162, 196)

    if spec.get("overhead"):
        glowc = spec.get("glow", (255, 255, 255))
        ov = Image.new("RGBA", (size, size), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
        od.rounded_rectangle([3, 3, size - 4, size - 4], radius=r, outline=(*glowc, 150), width=int(8 * f))
        ov = ov.filter(ImageFilter.GaussianBlur(3)); img.alpha_composite(ov); d = ImageDraw.Draw(img)
        d.rounded_rectangle([7, 7, size - 8, size - 8], radius=r - 4, outline=(*glowc, 230), width=max(2, int(3 * f)))
        _sat_glyph(d, size * 0.5, size * 0.36, white, f)
        _key_ctext(d, "OVERHEAD", size * 0.5, size * 0.64, int(size * 0.14), white, max_w=size * 0.82)
        _key_ctext(d, spec.get("sub", "look up"), size * 0.5, size * 0.83, int(size * 0.11), blue_br, max_w=size * 0.84)
        return img

    gcx, gcy, gr = size * 0.5, size * 0.40, size * 0.205
    d.ellipse([gcx - gr, gcy - gr, gcx + gr, gcy + gr], fill=(10, 28, 58))
    hl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse([gcx - gr * 0.85, gcy - gr * 0.95, gcx + gr * 0.15, gcy + gr * 0.05], fill=(40, 82, 140, 130))
    img.alpha_composite(hl.filter(ImageFilter.GaussianBlur(int(7 * f)))); d = ImageDraw.Draw(img)
    # meridians, equator and continents, clipped to the globe
    over = Image.new("RGBA", (size, size), (0, 0, 0, 0)); od = ImageDraw.Draw(over)
    lw = max(1, int(1.2 * f))
    od.ellipse([gcx - gr * 0.36, gcy - gr, gcx + gr * 0.36, gcy + gr], outline=(47, 92, 152, 200), width=lw)
    od.ellipse([gcx - gr * 0.72, gcy - gr, gcx + gr * 0.72, gcy + gr], outline=(47, 92, 152, 140), width=lw)
    od.line([gcx - gr, gcy, gcx + gr, gcy], fill=(47, 92, 152, 200), width=lw)
    grn = (46, 125, 82, 255)
    od.ellipse([gcx - gr * 0.55, gcy - gr * 0.62, gcx + gr * 0.08, gcy - gr * 0.02], fill=grn)
    od.ellipse([gcx + gr * 0.12, gcy + gr * 0.02, gcx + gr * 0.62, gcy + gr * 0.52], fill=grn)
    od.ellipse([gcx - gr * 0.58, gcy + gr * 0.18, gcx - gr * 0.2, gcy + gr * 0.62], fill=grn)
    gmask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(gmask).ellipse([gcx - gr, gcy - gr, gcx + gr, gcy + gr], fill=255)
    img.paste(over, (0, 0), Image.composite(over.split()[3], Image.new("L", (size, size), 0), gmask)); d = ImageDraw.Draw(img)
    d.ellipse([gcx - gr, gcy - gr, gcx + gr, gcy + gr], outline=(*blue, 255), width=max(1, int(1.6 * f)))
    _key_ctext(d, "N", gcx, gcy - gr - 7 * f, int(size * 0.07), (150, 162, 196))
    # arrow to the ISS along the bearing (0 = North = up)
    rad = math.radians(spec.get("bearing", 45))
    tx = gcx + (gr + 5 * f) * math.sin(rad); ty = gcy - (gr + 5 * f) * math.cos(rad)
    d.line([gcx, gcy, tx, ty], fill=(*blue_br, 255), width=max(2, int(4 * f)))
    ah = 10 * f
    a1 = rad + math.radians(152); a2 = rad - math.radians(152)
    d.polygon([(tx, ty), (tx + ah * math.sin(a1), ty - ah * math.cos(a1)), (tx + ah * math.sin(a2), ty - ah * math.cos(a2))], fill=(*blue_br, 255))
    _sat_glyph(d, tx, ty, white, f * 0.9)
    d.ellipse([gcx - 2.6 * f, gcy - 2.6 * f, gcx + 2.6 * f, gcy + 2.6 * f], fill=(255, 255, 255))
    direction = spec.get("direction", "NORTHEAST")
    _key_ctext(d, direction, gcx, size * 0.67, int(size * (0.14 if len(direction) <= 5 else 0.125)), white, max_w=size * 0.92)
    _key_ctext(d, spec.get("sub", ""), gcx, size * 0.84, int(size * 0.105), dim, max_w=size * 0.92)
    return img

def _apod_key(spec, size=144):
    """A framed 'astronomy photo of the day' tile: a little deep-space scene (stars + a planet or
    nebula) with an APOD label, so the key reads as a real daily photo rather than a bare star."""
    import random
    f = size / 144.0
    r = int(size * 0.125)
    palette = spec.get("variant", 0)
    skies = [((24, 14, 46), (60, 30, 96)), ((8, 16, 44), (24, 44, 96)), ((30, 12, 30), (96, 36, 60)), ((10, 22, 30), (24, 70, 86))]
    top, bot = skies[palette % len(skies)]
    img = _vgrad_rounded(size, top, bot, r)
    d = ImageDraw.Draw(img)
    rng = random.Random(palette * 7 + 3)
    for _ in range(36):
        sx, sy = rng.uniform(8, size - 8), rng.uniform(8, size * 0.74)
        rad = rng.uniform(0.4, 1.6) * f
        a = int(rng.uniform(120, 255))
        d.ellipse([sx - rad, sy - rad, sx + rad, sy + rad], fill=(255, 255, 255, a))
    # a planet / nebula body
    pcx, pcy, pr = size * 0.66, size * 0.34, size * 0.17
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pc = [(120, 150, 255), (255, 160, 90), (180, 120, 255), (90, 220, 200)][palette % 4]
    ImageDraw.Draw(glow).ellipse([pcx - pr * 1.6, pcy - pr * 1.6, pcx + pr * 1.6, pcy + pr * 1.6], fill=(*pc, 70))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(int(8 * f)))); d = ImageDraw.Draw(img)
    d.ellipse([pcx - pr, pcy - pr, pcx + pr, pcy + pr], fill=(*pc, 255))
    hl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse([pcx - pr * 0.9, pcy - pr * 0.95, pcx + pr * 0.1, pcy], fill=(255, 255, 255, 90))
    img.alpha_composite(hl.filter(ImageFilter.GaussianBlur(int(4 * f)))); d = ImageDraw.Draw(img)
    # inner frame + label band
    d.rounded_rectangle([4 * f, 4 * f, size - 4 * f, size - 4 * f], radius=r - 2, outline=(255, 255, 255, 40), width=max(1, int(1 * f)))
    band = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(band).rounded_rectangle([0, size * 0.74, size, size], radius=0, fill=(6, 7, 14, 205))
    img.alpha_composite(band); d = ImageDraw.Draw(img)
    _key_ctext(d, "APOD", size * 0.5, size * 0.83, int(size * 0.13), (200, 214, 235), max_w=size * 0.86)
    _key_ctext(d, spec.get("sub", "photo of the day"), size * 0.5, size * 0.93, int(size * 0.078), (150, 162, 196), max_w=size * 0.9)
    return img

def _star_poly(d, cx, cy, r, color):
    pts = []
    for i in range(10):
        a = math.radians(-90 + i * 36); rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=(*color[:3], 255))

def _occasion_glyph(d, occ, cx, cy, accent, accent2, f):
    """The little themed motif the real countdown draws above the event name (tree, pumpkin, cake...)."""
    green = (63, 191, 111)
    if occ == "christmas":
        d.polygon([(cx, cy - 9 * f), (cx - 6 * f, cy - 1 * f), (cx + 6 * f, cy - 1 * f)], fill=green)
        d.polygon([(cx, cy - 4 * f), (cx - 8 * f, cy + 6 * f), (cx + 8 * f, cy + 6 * f)], fill=green)
        d.rectangle([cx - 1.6 * f, cy + 6 * f, cx + 1.6 * f, cy + 9 * f], fill=(138, 90, 43))
        d.ellipse([cx - 2 * f, cy - 11 * f, cx + 2 * f, cy - 7 * f], fill=(255, 216, 107))
    elif occ == "halloween":
        d.ellipse([cx - 9 * f, cy - 5 * f, cx + 9 * f, cy + 9 * f], fill=(255, 138, 43))
        d.rectangle([cx - 1.6 * f, cy - 8 * f, cx + 1.6 * f, cy - 4 * f], fill=green)
        d.polygon([(cx - 5 * f, cy), (cx - 2 * f, cy), (cx - 3.5 * f, cy + 3 * f)], fill=(26, 10, 0))
        d.polygon([(cx + 5 * f, cy), (cx + 2 * f, cy), (cx + 3.5 * f, cy + 3 * f)], fill=(26, 10, 0))
        d.polygon([(cx - 3.5 * f, cy + 4 * f), (cx + 3.5 * f, cy + 4 * f), (cx, cy + 7 * f)], fill=(26, 10, 0))
    elif occ == "birthday":
        d.rounded_rectangle([cx - 8 * f, cy, cx + 8 * f, cy + 8 * f], radius=2 * f, fill=(*accent[:3], 255))
        d.rectangle([cx - 1 * f, cy - 6 * f, cx + 1 * f, cy], fill=(255, 230, 160))
        d.ellipse([cx - 2.2 * f, cy - 9.5 * f, cx + 2.2 * f, cy - 5 * f], fill=(255, 138, 43))
    elif occ in ("valentines", "heart"):
        d.ellipse([cx - 8 * f, cy - 6 * f, cx + 0.5 * f, cy + 2 * f], fill=(*accent[:3], 255))
        d.ellipse([cx - 0.5 * f, cy - 6 * f, cx + 8 * f, cy + 2 * f], fill=(*accent[:3], 255))
        d.polygon([(cx - 7.5 * f, cy - 1 * f), (cx + 7.5 * f, cy - 1 * f), (cx, cy + 8 * f)], fill=(*accent[:3], 255))
    else:  # newyear / july4 / custom -> star
        _star_poly(d, cx, cy, 9 * f, accent)

def _countdown_key(spec, size=144):
    """Mirror the real Event Countdown key: themed glyph, event name, big number, unit, a background
    that drains as the day nears, plus the warn/urgent border and the day-of fireworks state."""
    f = size / 144.0
    r = int(size * 0.125)
    occ = spec.get("occasion", "custom")
    accent = spec.get("accent", (199, 155, 255))
    accent2 = spec.get("accent2", (160, 107, 220))
    phase = spec.get("phase", "normal")
    if phase == "urgent":
        accent = (255, 78, 66)
    img = _vgrad_rounded(size, spec.get("bg", (16, 10, 24)), spec.get("bg2", (8, 5, 15)), r)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)

    if phase == "celebrate":
        rng_pts = [(size * 0.28, size * 0.30), (size * 0.72, size * 0.26), (size * 0.5, size * 0.44)]
        cols = [accent, accent2, (255, 255, 255), (255, 216, 107)]
        burst = Image.new("RGBA", (size, size), (0, 0, 0, 0)); bd = ImageDraw.Draw(burst)
        for bi, (bx, by) in enumerate(rng_pts):
            R = (10 + bi * 8) * f; col = cols[bi % len(cols)]
            for i in range(11):
                a = i / 11 * 2 * math.pi
                x2, y2 = bx + R * math.cos(a), by + R * math.sin(a)
                bd.line([bx, by, x2, y2], fill=(*col, 230), width=max(1, int(2 * f)))
                bd.ellipse([x2 - 1.8 * f, y2 - 1.8 * f, x2 + 1.8 * f, y2 + 1.8 * f], fill=(*col, 255))
        img.paste(burst, (0, 0), Image.composite(burst.split()[3], Image.new("L", (size, size), 0), mask))
        # glow ring
        ov = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(ov).rounded_rectangle([3, 3, size - 4, size - 4], radius=r, outline=(*accent, 150), width=int(7 * f))
        img.alpha_composite(ov.filter(ImageFilter.GaussianBlur(3)))
        d = ImageDraw.Draw(img)
        _occasion_glyph(d, occ, size * 0.5, size * 0.64, accent, accent2, f)
        _key_ctext(d, spec.get("name", "EVENT"), size * 0.5, size * 0.80, int(size * 0.11), accent, max_w=size * 0.9)
        _key_ctext(d, "IT'S HERE!", size * 0.5, size * 0.92, int(size * 0.1), (255, 216, 107), max_w=size * 0.9)
        return img

    # draining background fill (full when far, empty when near)
    frac = spec.get("frac", 0.6)
    fillTop = size * (1 - frac)
    op = 0.26 if phase == "warn" else 0.17
    drain = Image.new("RGBA", (size, size), (0, 0, 0, 0)); dr = ImageDraw.Draw(drain)
    dr.rectangle([0, fillTop, size, size], fill=(*accent, int(op * 255)))
    dr.rectangle([0, fillTop, size, fillTop + 2 * f], fill=(*accent, 190))
    img.paste(drain, (0, 0), Image.composite(drain.split()[3], Image.new("L", (size, size), 0), mask))
    d = ImageDraw.Draw(img)
    if phase == "urgent":
        ov = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(ov).rounded_rectangle([3, 3, size - 4, size - 4], radius=r, outline=(*accent, 150), width=int(7 * f))
        img.alpha_composite(ov.filter(ImageFilter.GaussianBlur(3))); d = ImageDraw.Draw(img)
    if phase in ("warn", "urgent"):
        d.rounded_rectangle([2, 2, size - 3, size - 3], radius=r, outline=(*accent, 255), width=max(2, int(2 * f)))
    _occasion_glyph(d, occ, size * 0.5, size * 0.13, accent, accent2, f)
    _key_ctext(d, spec.get("name", "EVENT"), size * 0.5, size * 0.30, int(size * 0.11), accent, max_w=size * 0.92)
    big = str(spec.get("big", "12"))
    bs = 60 if len(big) <= 2 else 52 if len(big) == 3 else 38 if len(big) <= 5 else 30
    _key_ctext(d, big, size * 0.5, size * 0.66, int(bs * f), (255, 255, 255), max_w=size * 0.9)
    if spec.get("unit"):
        _key_ctext(d, spec["unit"], size * 0.5, size * 0.87, int(size * 0.11), accent, max_w=size * 0.9)
    return img

def render_key(spec, size=144):
    """spec keys: bg, bg2, glow, border, big, big_color, big_size, label, label_color,
    sub, sub_color, top, top_color, bar=(pct,color), plate=color.
    kind='globe' renders the ISS Earth-and-arrow key (bearing, direction, sub; overhead=True for the
    pulse state). kind='apod' renders a framed photo-of-the-day tile (variant=0..3, sub).
    kind='countdown' renders an event-countdown key (occasion, name, big, unit, phase, frac)."""
    if spec.get("kind") == "globe":
        return _globe_key(spec, size)
    if spec.get("kind") == "apod":
        return _apod_key(spec, size)
    if spec.get("kind") == "countdown":
        return _countdown_key(spec, size)
    r = int(size * 0.125)
    bg = spec.get("bg", (12, 12, 14)); bg2 = spec.get("bg2")
    if bg2:
        key = _vgrad_rounded(size, bg, bg2, r)
    else:
        key = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(key).rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=r, fill=(*bg, 255))
    d = ImageDraw.Draw(key)
    plate = spec.get("plate")
    if plate:
        # Subtle full-key tint (a clean colour wash), not a half-height block.
        ov = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(ov).rounded_rectangle([(2, 2), (size - 3, size - 3)], radius=r, fill=(*plate, 16))
        key.alpha_composite(ov); d = ImageDraw.Draw(key)
    glow = spec.get("glow")
    if glow:
        ov = Image.new("RGBA", (size, size), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
        od.rounded_rectangle([(3, 3), (size - 4, size - 4)], radius=r, outline=(*glow, 150), width=8)
        ov = ov.filter(ImageFilter.GaussianBlur(3))
        key.alpha_composite(ov)
        d = ImageDraw.Draw(key)
        d.rounded_rectangle([(7, 7), (size - 8, size - 8)], radius=r - 4, outline=(*glow, 230), width=3)
    border = spec.get("border")
    if border:
        d.rounded_rectangle([(2, 2), (size - 3, size - 3)], radius=r, outline=(*border, 255), width=3)

    def ctext(s, y, sz, color, weight=None):
        f = fnt(sz); tw, th = txt_size(s, f)
        d.text(((size - tw) // 2 - 0, y - th // 2), s, font=f, fill=(*color[:3], 255))

    def star(cx, cy, r_out, color):
        r_in = r_out * 0.45; pts = []
        for i in range(10):
            a = math.radians(-90 + i * 36); r = r_out if i % 2 == 0 else r_in
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        d.polygon(pts, fill=(*color[:3], 255))

    bar = spec.get("bar")
    has_sub = bool(spec.get("sub"))
    has_label = bool(spec.get("label"))
    both = has_label and has_sub
    # Vertical slots tuned so the number, label and sub never collide. The real plugin keys stack
    # big value -> small label -> dim sub down the key, with a fill bar (if any) flush at the bottom.
    if both:
        big_y = 0.34 if bar else 0.44          # make room for two text rows below
    else:
        big_y = 0.38 if (bar and has_sub) else (0.42 if bar else 0.5)
    label_y = (0.58 if bar else 0.64) if both else 0.78
    sub_y = (0.76 if bar else 0.85) if both else (0.70 if bar else 0.86)
    if spec.get("top"):
        ctext(spec["top"], int(size * 0.2), int(size * 0.12), spec.get("top_color", (180, 188, 205)))
    if spec.get("big") == "★":
        star(size // 2, int(size * 0.46), spec.get("big_size", int(size * 0.32)), spec.get("big_color", (255, 216, 107)))
    elif spec.get("big"):
        ctext(str(spec["big"]), int(size * big_y), spec.get("big_size", int(size * 0.4)), spec.get("big_color", (255, 255, 255)))
    if has_label:
        ctext(spec["label"], int(size * label_y), int(size * 0.14), spec.get("label_color", BRAND))
    if has_sub:
        ctext(spec["sub"], int(size * sub_y), int(size * 0.12), spec.get("sub_color", (170, 180, 200)))
    if bar:
        pct, bcol = bar
        pad = int(size * 0.12); bh = int(size * 0.06); by = int(size * 0.88)
        d.rounded_rectangle([(pad, by), (size - pad, by + bh)], radius=bh // 2, fill=(255, 255, 255, 40))
        if pct > 0:
            d.rounded_rectangle([(pad, by), (pad + int((size - 2 * pad) * pct), by + bh)], radius=bh // 2, fill=(*bcol, 255))
    return key

def place_row(canvas, specs, cx, cy, gap=24, disp=176, labels=None, label_color=(170,180,200)):
    n = len(specs); total = n * disp + (n - 1) * gap
    x = cx - total // 2
    d = ImageDraw.Draw(canvas)
    for i, spec in enumerate(specs):
        key = render_key(spec).resize((disp, disp), Image.LANCZOS)
        canvas.alpha_composite(key, dest=(x, cy - disp // 2))
        if labels and i < len(labels) and labels[i]:
            f = fnt(22); tw, _ = txt_size(labels[i], f)
            d.text((x + (disp - tw) // 2, cy + disp // 2 + 14), labels[i], font=f, fill=(*label_color, 255))
        x += disp + gap

def angled_keys(specs, disp=180, gap=22, angle=-9):
    n = len(specs); W = n * disp + (n - 1) * gap
    strip = Image.new("RGBA", (W, disp), (0, 0, 0, 0))
    x = 0
    for spec in specs:
        strip.alpha_composite(render_key(spec).resize((disp, disp), Image.LANCZOS), dest=(x, 0))
        x += disp + gap
    return strip.rotate(angle, expand=True, resample=Image.BICUBIC)

# ── Banner templates ───────────────────────────────────────────────────────────────
W, H = 1920, 960

def _tinted_logo(path, color, size):
    """Recolour a white logo silhouette PNG to `color`, fit within `size`."""
    im = Image.open(path).convert("RGBA")
    im.thumbnail((size, size), Image.LANCZOS)
    solid = Image.new("RGBA", im.size, (*color[:3], 255))
    solid.putalpha(im.split()[3])
    return solid

def logo_key(cfg, size=144):
    """A key showing the real game logo (or wordmark fallback), like Kick's K key."""
    accent = cfg["brand"]
    key = _vgrad_rounded(size, (16, 16, 20), (8, 8, 11), int(size * 0.125))
    d = ImageDraw.Draw(key)
    logo = cfg.get("logo_img")
    if logo and os.path.exists(logo):
        lg = _tinted_logo(logo, cfg.get("logo_color", accent), int(size * 0.58))
        key.alpha_composite(lg, ((size - lg.width) // 2, (size - lg.height) // 2))
        return key
    game = (cfg.get("game") or cfg["name"]).upper()
    f = _fit_banner(game, d, int(size * 0.78), int(size * 0.34), 16)
    bb = d.textbbox((0, 0), game, font=f); gw, gh = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((size - gw) / 2 - bb[0], size * 0.5 - gh / 2 - bb[1]), game, font=f, fill=(*accent, 255))
    return key

def _grid_keys(canvas, key_imgs, ksz=204, gap=18):
    """Place rendered keys in a clean right-aligned grid (no rotation). Centers uneven last rows."""
    n = len(key_imgs)
    cols = 3 if n >= 5 else 2
    rows = math.ceil(n / cols)
    cell = ksz + gap
    grid_w = cols * cell - gap
    grid_h = rows * cell - gap
    gx0 = W - 92 - grid_w
    gy0 = 76 + (H - 170 - 76 - grid_h) // 2
    for r in range(rows):
        row = key_imgs[r * cols:(r + 1) * cols]
        row_w = len(row) * cell - gap
        rx = gx0 + (grid_w - row_w) // 2
        for i, ki in enumerate(row):
            canvas.alpha_composite(ki.resize((ksz, ksz), Image.LANCZOS), dest=(rx + i * cell, gy0 + r * cell))

def banner_hero(cfg):
    accent = cfg["brand"]
    c = make_canvas(W, H, accent)
    d = ImageDraw.Draw(c)
    CONTENT_TOP, CONTENT_BOT = 76, H - 170
    lx, max_w = 96, 760
    # Product badge: the kick-style stats icon (real game logo + STATS), top-left.
    y = CONTENT_TOP + 30
    badge_icon = make_listing_icon(cfg, 116)
    c.alpha_composite(badge_icon, dest=(lx, y))
    y += 116 + 20
    # sentence-case title lines
    for i, line in enumerate(cfg["hero_title"]):
        y += add_gradient_title(c, line, lx, y, max_w, accent=accent, white=(i > 0), max_sz=90) + 8
    y += 22
    d.text((lx, y), cfg["tagline"], font=fnt(26), fill=(196, 206, 224, 235)); y += 56
    for b in cfg["bullets"][:3]:
        d.ellipse([(lx, y + 9), (lx + 12, y + 21)], fill=(*accent, 255))
        d.text((lx + 26, y), b, font=fnt(23), fill=(212, 220, 238, 240)); y += 46
    # right: straight grid of keys, led by the game-logo key
    key_imgs = [logo_key(cfg)] + [render_key(s) for s in cfg["hero_keys"]]
    _grid_keys(c, key_imgs)
    add_bottom_bar(c, W, H, cfg["bottom"], accent)
    return c

def banner_features(cfg, title, specs, labels, accent=None, caption=None):
    accent = accent or cfg["brand"]
    c = make_canvas(W, H, accent)
    ty = 150 if not caption else 132
    add_gradient_title(c, title, (W - _title_w(title, 84)) // 2, ty, 1560, accent=accent, white=True, max_sz=84)
    if caption:
        cf = 30
        while txt_size(caption, fnt(cf))[0] > 1580 and cf > 18:
            cf -= 1
        draw_center(c, caption, 286, cf, (190, 200, 220))
    place_row(c, specs, W // 2, 565 if caption else 540, gap=40, disp=200, labels=labels, label_color=accent)
    return c

def banner_statement(cfg, big, sub, accent=None):
    accent = accent or cfg["brand"]
    c = make_canvas(W, H, accent)
    add_gradient_title(c, big, (W - _title_w(big, 110)) // 2, 360, 1640, accent=accent, white=False, max_sz=110)
    draw_center(c, sub, 560, 36, (196, 204, 224))
    return c

def _title_w(text, sz=92):
    return min(txt_size(text, fnt(sz))[0], 1500)

# ── Video ───────────────────────────────────────────────────────────────────────
def gen_video(cfg):
    vW, vH = 1200, 630
    accent = cfg["brand"]
    frames = []
    specs = cfg["hero_keys"]

    def frame_with(center_specs, title):
        f = Image.new("RGB", (vW, vH), BG[:3])
        # subtle glow
        g = Image.new("RGBA", (vW, vH), (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse([(vW//2-260, 60), (vW//2+260, vH-20)], fill=(*accent, 46))
        g = g.filter(ImageFilter.GaussianBlur(120))
        fr = Image.alpha_composite(f.convert("RGBA"), g)
        dd = ImageDraw.Draw(fr)
        tf = fnt(40); tw, _ = txt_size(title, tf)
        dd.text(((vW - tw) // 2, 56), title, font=tf, fill=(228, 234, 250, 255))
        n = len(center_specs); disp = 150; gap = 26
        total = n * disp + (n - 1) * gap; x = vW // 2 - total // 2
        for spec in center_specs:
            fr.alpha_composite(render_key(spec).resize((disp, disp), Image.LANCZOS), dest=(x, vH // 2 - disp // 2 + 10))
            x += disp + gap
        return fr.convert("RGB")

    scenes = cfg.get("video_scenes")
    if scenes:
        # Show the product IN ACTION: walk through real states (e.g. a CS2 round progressing),
        # holding each scene briefly so the values visibly change frame to frame.
        for title, scene_specs in scenes:
            for _ in range(7):
                frames.append(frame_with(scene_specs, title))
    else:
        # Fallback: reveal the keys one at a time, hold, then carousel each big.
        title = cfg["video_title"]
        for i in range(1, len(specs) + 1):
            frames.append(frame_with(specs[:i], title))
        for _ in range(8):
            frames.append(frame_with(specs, title))
        for spec in specs:
            for _ in range(5):
                frames.append(frame_with([spec], cfg["name"]))
        for _ in range(6):
            frames.append(frame_with(specs, title))

    gif = os.path.join(OUT_DIR, "preview.gif")
    frames[0].save(gif, save_all=True, append_images=frames[1:], duration=90, loop=0, optimize=False)
    mp4 = os.path.join(OUT_DIR, "preview.mp4")
    try:
        subprocess.run(["ffmpeg", "-i", gif, "-vf", "scale=1920:1008:flags=lanczos,pad=1920:1080:0:36:black",
                        "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", mp4],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        print(f"  (ffmpeg unavailable, GIF only: {e})")

# ── Listing icon (kick-style: game wordmark + STATS) ───────────────────────────────
def make_listing_icon(cfg, size=288):
    accent = cfg["brand"]
    game = (cfg.get("game") or cfg["name"]).upper()
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    r = int(size * 0.20)
    ImageDraw.Draw(img).rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=r, fill=(*BG, 255))
    # accent glow behind the wordmark
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([(size * 0.12, size * 0.04), (size * 0.88, size * 0.66)], fill=(*accent, 70))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(int(size * 0.14))))
    d = ImageDraw.Draw(img)
    sub = cfg.get("icon_sub", "STATS")
    wm_y = 0.40 if sub else 0.5
    logo = cfg.get("logo_img")
    if logo and os.path.exists(logo):
        lg = _tinted_logo(logo, cfg.get("logo_color", accent), int(size * (0.46 if sub else 0.56)))
        img.alpha_composite(lg, ((size - lg.width) // 2, int(size * wm_y) - lg.height // 2))
    else:
        # game wordmark, fit to width
        f = _fit_banner(game, d, int(size * 0.80), int(size * 0.36), 20)
        bb = d.textbbox((0, 0), game, font=f); gw, gh = bb[2] - bb[0], bb[3] - bb[1]
        d.text(((size - gw) / 2 - bb[0], size * wm_y - gh / 2 - bb[1]), game, font=f, fill=(*accent, 255))
    if sub:
        spaced = " ".join(sub.upper()); sf = fnt(int(size * 0.115))
        sb = d.textbbox((0, 0), spaced, font=sf); sw, sh = sb[2] - sb[0], sb[3] - sb[1]
        d.text(((size - sw) / 2 - sb[0], size * 0.76 - sh / 2 - sb[1]), spaced, font=sf, fill=(206, 214, 230, 255))
    return img

# ── Listing description (kick-style, with search keywords) ─────────────────────────
def write_description(cfg, out):
    desc = cfg.get("description")
    if not desc:
        return
    L = [desc["intro"], "", f"*{desc['tagline']}*", ""]
    for name, text in desc["features"]:
        L.append(f"**{name}** - {text}")
    L.append("")
    if desc.get("outro"):
        L += [desc["outro"], ""]
    L += ["---", "", desc.get("collection",
          "Part of the Ratpack collection for Stream Deck. Whether you game, stream or track your "
          "stats, there is something in the lineup for you. See the full Ratpack collection on the marketplace."),
          "", ", ".join(desc["keywords"])]
    with open(os.path.join(out, "description.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")

# ── Build entry ────────────────────────────────────────────────────────────────────
def build(cfg, out_dir):
    global BRAND, BG, ICON_PATH, OUT_DIR
    BRAND = cfg["brand"]; BG = cfg["bg"]; ICON_PATH = cfg.get("icon", ""); OUT_DIR = out_dir
    os.makedirs(OUT_DIR, exist_ok=True)
    icon = make_listing_icon(cfg, 288); icon.save(os.path.join(OUT_DIR, "icon-288x288.png")); icon.save(os.path.join(OUT_DIR, "icon.png"))
    make_listing_icon(cfg, 512).save(os.path.join(OUT_DIR, "icon@2x.png"))
    write_description(cfg, OUT_DIR)
    banner_hero(cfg).convert("RGB").save(os.path.join(OUT_DIR, "1-hero.png"))
    fb = cfg["feature_banners"]
    for i, (title, specs, labels, acc, *rest) in enumerate(fb, start=2):
        caption = rest[0] if rest else None
        banner_features(cfg, title, specs, labels, acc, caption).convert("RGB").save(os.path.join(OUT_DIR, f"{i}-feature.png"))
    n = len(fb) + 2
    big, sub = cfg["statement"]
    banner_statement(cfg, big, sub).convert("RGB").save(os.path.join(OUT_DIR, f"{n}-why.png"))
    gen_video(cfg)
    print(f"  art -> {out_dir}")

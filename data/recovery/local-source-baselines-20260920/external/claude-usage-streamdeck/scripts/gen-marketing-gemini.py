# coding: utf-8
#!/usr/bin/env python3
"""
Ratpack - Gemini Usage - Marketing Generator
Run: python scripts/gen-marketing-gemini.py
Output: scripts/output/marketing/gemini/
"""
import os, sys, subprocess, math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
OUT_DIR    = os.path.join(SCRIPT_DIR, "output", "marketing", "gemini")
os.makedirs(OUT_DIR, exist_ok=True)

sys.path.insert(0, os.path.join(ROOT_DIR, "..", "_shared"))
import marketing_engine as me
from marketing_engine import (
    Image, ImageDraw, ImageFont, ImageFilter,
    fnt, txt_size, fit_fnt, icon_img,
    make_canvas, add_bottom_bar, add_gradient_title, banner_header,
)

def save(canvas, name):
    path = os.path.join(OUT_DIR, name)
    canvas.convert("RGB").save(path, quality=96)
    print("> " + name)

def place_keys(canvas, keys, cols, cell_w, cell_h, ox, oy,
               label_f=None, labels=None, label_colors=None, key_disp=None):
    ksz = key_disp if key_disp else me.KEY_SZ
    for i, key in enumerate(keys):
        row, col = divmod(i, cols)
        x = ox + col*cell_w + (cell_w-ksz)//2; y = oy + row*cell_h + (cell_h-ksz)//2
        if key_disp and key.size != (ksz, ksz): key = key.resize((ksz, ksz), Image.LANCZOS)
        canvas.alpha_composite(key, dest=(x, y))
        if label_f and labels and i < len(labels):
            lbl = labels[i]; lw, _ = txt_size(lbl, label_f)
            lcolor = (160, 160, 180) if not label_colors else label_colors[i]
            ImageDraw.Draw(canvas).text((x+(ksz-lw)//2, y+ksz+12), lbl, font=label_f, fill=(*lcolor[:3], 255))

BRAND = (66, 133, 244)   # Google Blue
BG    = (8, 10, 16)

me.BRAND   = BRAND
me.BG      = BG
me.OUT_DIR = OUT_DIR

PLUGIN_NAME = "Gemini Usage"
KEY_SZ  = 144
FILL_BG = (10, 10, 12)
GREEN   = (48, 226, 123)
YELLOW  = (255, 214, 10)
RED     = (255, 59, 48)

# ── Color helpers ─────────────────────────────────────────────────────────────
def lerp_color(c1, c2, t):
    return tuple(max(0, min(255, int(c1[i] + (c2[i] - c1[i]) * t))) for i in range(3))

def usage_color(used):
    u = max(0.0, min(100.0, used))
    if u >= 85: return RED
    if u >= 50: return lerp_color(YELLOW, RED, (u - 50) / 35)
    return lerp_color(GREEN, YELLOW, u / 50)

def usage_label(used):
    u = max(0.0, min(100.0, used))
    if u >= 85: return "Critical"
    if u >= 75: return "Warning"
    if u >= 50: return "Moderate"
    return "Safe"

# ── Key builder helpers ────────────────────────────────────────────────────────
def key_bg(bg=None):
    c = bg or (11, 11, 14)
    img = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([(0, 0), (KEY_SZ-1, KEY_SZ-1)], radius=10, fill=(*c, 255))
    return img

def draw_c(img, text, y, f, color, shadow=False):
    d = ImageDraw.Draw(img); w, _ = txt_size(text, f); x = (img.width - w) // 2
    if shadow: d.text((x+1, y+2), text, font=f, fill=(0, 0, 0, 110))
    d.text((x, y), text, font=f, fill=(*color[:3], 255))

# ── Key renderers (mirrors the plugin's actual SVG output) ────────────────────
def render_ring(used, label, reset, show_label=True, pct_max_sz=34):
    color = usage_color(used); img = key_bg()
    cx, cy, r, sw = 72, 57, 48, 11; bbox = [(cx-r, cy-r), (cx+r, cy+r)]
    track = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0))
    ImageDraw.Draw(track).arc(bbox, 0, 360, fill=(255, 255, 255, 28), width=sw)
    img.alpha_composite(track)
    if used > 0.5:
        arc = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0))
        ImageDraw.Draw(arc).arc(bbox, -90, -90 + 360 * min(used / 100, 1), fill=(*color, 255), width=sw)
        img.alpha_composite(arc)
    pct = "%d%%" % int(round(used)); draw_c(img, pct, 40, fit_fnt(pct, 78, pct_max_sz, 14), color)
    if show_label: draw_c(img, label, 114, fnt(13), (200, 200, 200))
    if reset: draw_c(img, reset, 129 if show_label else 116, fit_fnt(reset, 88, 14, 10), (255, 255, 255))
    return img

def render_full(used, label, reset):
    color = usage_color(used); img = key_bg(FILL_BG)
    fill_h = max(1, int(KEY_SZ * used / 100)); y0 = KEY_SZ - fill_h
    ov = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for yy in range(y0, KEY_SZ):
        t = (yy - y0) / max(fill_h - 1, 1); od.line([(0, yy), (KEY_SZ, yy)], fill=(*color, int(55 + 110 * t)))
    img.alpha_composite(ov)
    if fill_h > 2: ImageDraw.Draw(img).line([(0, y0), (KEY_SZ, y0)], fill=(*color, 200), width=3)
    pct = "%d%%" % int(round(used)); draw_c(img, pct, 58, fit_fnt(pct, 112, 52, 18), color, shadow=True)
    if reset: draw_c(img, reset, 118, fnt(12), (255, 255, 255), shadow=True)
    return img

def render_bignumber(used, label, reset):
    color = usage_color(used); img = key_bg()
    draw_c(img, label, 16, fnt(12), (180, 180, 180))
    pct = "%d%%" % int(round(used)); draw_c(img, pct, 48, fit_fnt(pct, 122, 58, 18), color)
    bx, bar_y, bh = 14, 118, 8; bw = KEY_SZ - 2*bx; fw = int(bw * min(used / 100, 1))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([(bx, bar_y), (bx+bw, bar_y+bh)], radius=4, fill=(255, 255, 255, 22))
    if fw > 0: d.rounded_rectangle([(bx, bar_y), (bx+fw, bar_y+bh)], radius=4, fill=(*color, 255))
    if reset: draw_c(img, reset, 131, fnt(10), (160, 160, 160))
    return img

def render_bigtime(reset, label):
    img = key_bg()
    draw_c(img, label.upper(), 16, fnt(10), (160, 160, 160))
    draw_c(img, "RESETS IN", 31, fnt(9), (120, 120, 120))
    draw_c(img, reset, 82, fit_fnt(reset, 112, 44, 16), (255, 255, 255))
    ImageDraw.Draw(img).rounded_rectangle([(14, 122), (130, 125)], radius=1, fill=(255, 255, 255, 22))
    return img

def render_countdown(used, reset, label):
    color = usage_color(used); img = key_bg(FILL_BG)
    fill_h = max(1, int(KEY_SZ * used / 100)); y0 = KEY_SZ - fill_h
    ov = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for yy in range(y0, KEY_SZ):
        t = (yy - y0) / max(fill_h - 1, 1); od.line([(0, yy), (KEY_SZ, yy)], fill=(*color, int(35 + 80 * t)))
    img.alpha_composite(ov)
    if fill_h > 2: ImageDraw.Draw(img).line([(0, y0), (KEY_SZ, y0)], fill=(*color, 160), width=2)
    draw_c(img, label.upper(), 16, fnt(10), (200, 200, 200), shadow=True)
    draw_c(img, "TIME LEFT", 29, fnt(9), (160, 160, 160), shadow=True)
    draw_c(img, reset, 80, fit_fnt(reset, 112, 42, 16), (255, 255, 255), shadow=True)
    return img

def render_status(used, label):
    color = usage_color(used); word = usage_label(used); img = key_bg(); d = ImageDraw.Draw(img)
    d.rectangle([(0, 0), (KEY_SZ, 10)], fill=(*color, 255))
    draw_c(img, label.upper(), 26, fnt(12), (160, 160, 160))
    draw_c(img, word, 62, fnt(30), color)
    draw_c(img, "%d%%" % int(round(used)), 98, fnt(20), (200, 200, 200))
    bx, by, bh = 14, 120, 7; bw = KEY_SZ - 2*bx; fw = int(bw * min(used / 100, 1))
    d.rounded_rectangle([(bx, by), (bx+bw, by+bh)], radius=3, fill=(255, 255, 255, 22))
    if fw > 0: d.rounded_rectangle([(bx, by), (bx+fw, by+bh)], radius=3, fill=(*color, 255))
    return img

SERIES = [18, 28, 35, 42, 51, 45, 38, 58, 72, 68, 55, 65, 78, 72]
def render_sparkline(used, label, series=None):
    if series is None: series = SERIES
    color = usage_color(used); img = key_bg(); d = ImageDraw.Draw(img)
    draw_c(img, label, 14, fnt(11), (160, 160, 160))
    pct = "%d%%" % int(round(used)); pw, _ = txt_size(pct, fnt(12))
    d.text((KEY_SZ-14-pw, 10), pct, font=fnt(12), fill=(*color, 255))
    ox, oy2, cw, ch = 10, 28, 124, 76; mx = max(series + [1])
    pts = [(int(ox + i / max(len(series)-1, 1) * cw), int(oy2 + ch * (1 - v / mx))) for i, v in enumerate(series)]
    for i in range(len(pts)-1): d.line([pts[i], pts[i+1]], fill=(*color, 200), width=2)
    if pts: lx2, ly2 = pts[-1]; d.ellipse([(lx2-4, ly2-4), (lx2+4, ly2+4)], fill=(*color, 255))
    draw_c(img, "30d history", 128, fnt(9), (120, 120, 120))
    return img

HEAT = [45, 60, 35, 80, 55, 88, 72]
def render_heatmap(cells=None, label="7D"):
    if cells is None: cells = HEAT
    img = key_bg(); d = ImageDraw.Draw(img)
    draw_c(img, label, 18, fnt(12), (160, 160, 160))
    draw_c(img, "HISTORY", 34, fnt(9), (100, 100, 100))
    days = ["M","T","W","T","F","S","S"]; cw2, gap = 14, 4
    total_w = len(days) * (cw2 + gap) - gap; ox = (KEY_SZ - total_w) // 2
    for i, v in enumerate(cells):
        x = ox + i * (cw2 + gap)
        col = (255, 255, 255, 28) if v is None else (*usage_color(v), int(60 + 160 * (v / 100)))
        d.rounded_rectangle([(x, 66), (x+cw2, 66+cw2)], radius=3, fill=col)
        if i == len(cells)-1:
            dc = usage_color(v) if v else (255, 255, 255)
            d.rounded_rectangle([(x-2, 64), (x+cw2+2, 68+cw2)], radius=4, outline=(*dc, 200), width=1)
        fw2b, _ = txt_size(days[i], fnt(8)); d.text((x+(cw2-fw2b)//2, 86), days[i], font=fnt(8), fill=(100, 100, 100, 255))
    draw_c(img, "today", 126, fnt(9), (100, 100, 100))
    return img

# ── Banner helpers ─────────────────────────────────────────────────────────────
def _grad_line(canvas, y, x0, x1, color):
    r, g, b, a = color; w = x1 - x0
    ln = Image.new("RGBA", (w, 2), (0, 0, 0, 0)); px = ln.load()
    for xi in range(w):
        t = xi / max(w-1, 1); fade = (1 - abs(t - 0.5) * 2) ** 0.5; al = int(a * fade)
        px[xi, 0] = px[xi, 1] = (r, g, b, al)
    canvas.alpha_composite(ln, dest=(x0, y-1))

def build_deck(keys, deck_w=800, deck_h=520):
    img = Image.new("RGBA", (deck_w, deck_h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rounded_rectangle([(0, 0), (deck_w, deck_h)], radius=28, fill=(16, 18, 24, 255))
    f_logo = fnt(22); lbl = "STREAM DECK"; lw2, lh2 = txt_size(lbl, f_logo)
    cr = 13; gp = 12; lx2 = (deck_w - (cr*2 + gp + lw2)) // 2; ly2 = 10; cxb, cyb = lx2+cr, ly2+cr
    lc = (*BRAND, 200)
    d.ellipse([(lx2, ly2), (lx2+cr*2, ly2+cr*2)], outline=lc, width=2)
    d.polygon([(cxb-5, cyb-6), (cxb-5, cyb+6), (cxb+7, cyb)], fill=lc)
    bb2 = d.textbbox((0, 0), lbl, font=f_logo)
    d.text((lx2+cr*2+gp-bb2[0], cyb-lh2//2-bb2[1]), lbl, fill=lc, font=f_logo)
    COLS2, ROWS2 = 5, 3; logo_h, pad, bgap = 46, 32, 10
    avail_w = deck_w - 2*pad; avail_h = deck_h - logo_h - 18
    btn = min((avail_w - (COLS2-1)*bgap) // COLS2, (avail_h - (ROWS2-1)*bgap) // ROWS2)
    gw2 = COLS2*btn + (COLS2-1)*bgap; gh2 = ROWS2*btn + (ROWS2-1)*bgap
    gx2 = (deck_w - gw2) // 2; gy2 = logo_h + (avail_h - gh2) // 2
    for row2 in range(ROWS2):
        for col2 in range(COLS2):
            idx2 = row2*COLS2 + col2; bx2 = gx2+col2*(btn+bgap); by2 = gy2+row2*(btn+bgap)
            d.rounded_rectangle([(bx2-1, by2+4), (bx2+btn+1, by2+btn+4)], radius=10, fill=(3, 4, 5, 255))
            d.rounded_rectangle([(bx2, by2), (bx2+btn, by2+btn)], radius=9, fill=(9, 10, 13, 255))
            d.rounded_rectangle([(bx2+3, by2+3), (bx2+btn-3, by2+int(btn*0.22))], radius=6, fill=(255, 255, 255, 7))
            if idx2 < len(keys):
                k = keys[idx2].resize((btn, btn), Image.LANCZOS); img.alpha_composite(k, dest=(bx2, by2))
    return img

def warp_deck(deck, tilt=70):
    import numpy as np
    w, h = deck.size; out_h = h + tilt
    src = [(0,0),(w,0),(w,h),(0,h)]; dst = [(0,0),(w,tilt),(w,h+tilt*3//4),(0,h-tilt//4)]
    A, b = [], []
    for (sx,sy),(dx,dy) in zip(src,dst):
        A += [[dx,dy,1,0,0,0,-dx*sx,-dy*sx],[0,0,0,dx,dy,1,-dx*sy,-dy*sy]]; b += [sx,sy]
    try:
        c = __import__("numpy").linalg.solve(__import__("numpy").array(A,dtype=float), __import__("numpy").array(b,dtype=float)).tolist()
        return deck.transform((w, out_h), Image.PERSPECTIVE, c, Image.BICUBIC)
    except Exception:
        r = Image.new("RGBA", (w, out_h), (0,0,0,0)); r.alpha_composite(deck, dest=(0, tilt//2)); return r

def draw_banner_c(canvas, text, y, f, color, W=1920):
    d = ImageDraw.Draw(canvas); tw, _ = txt_size(text, f); d.text(((W-tw)//2, y), text, font=f, fill=(*color[:3], 255))

# ═══════════════════════════════════════════════════════════════════════════════
# BANNERS
# ═══════════════════════════════════════════════════════════════════════════════

def _load_logo(svg_file, size, color):
    """Rasterize an SVG logo with resvg (correct fill-rules) and tint it to `color`."""
    import io, resvg_py
    svg_path = os.path.join(ROOT_DIR, "assets", svg_file)
    if not os.path.exists(svg_path):
        return None
    try:
        raw = open(svg_path, encoding="utf-8").read()
        ss = size * 4
        png = resvg_py.svg_to_bytes(
            svg_string=raw, width=ss, height=ss,
            style_sheet="* { fill: #ffffff; stroke: none; }",
        )
        logo = Image.open(io.BytesIO(bytes(png))).convert("RGBA").resize((size, size), Image.LANCZOS)
    except Exception:
        return None
    alpha = logo.split()[3]
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(Image.new("RGBA", (size, size), (*color[:3], 255)), (0, 0), alpha)
    return out

def _load_gemini_logo(size, color=(66, 133, 244)):
    return _load_logo("gemini-logo.svg", size, color)

def banner_hero():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    TOP_H, BOT_H = 76, 170; MAIN_Y = TOP_H; MAIN_H = H - TOP_H - BOT_H
    FLAT_DW, FLAT_DH, TILT = 880, 570, 65
    deck_keys = [
        render_ring(38, "2.5 PRO", "3h 22m"),
        render_bignumber(62, "2.5 PRO", "1h 18m"),
        render_status(38, "2.5 PRO"),
        render_countdown(62, "1h 18m", "2.5 PRO"),
        render_bigtime("3h 22m", "2.5 PRO"),
        render_sparkline(38, "2.5 PRO"),
        render_heatmap(),
        render_full(62, "2.5 PRO", "1h 18m"),
        render_ring(22, "2.5 PRO", "4h 50m"),
        render_ring(88, "2.5 PRO", "14m"),
        render_bignumber(38, "2.5 PRO", "3h 22m"),
        render_countdown(88, "14m", "2.5 PRO"),
        render_status(88, "2.5 PRO"),
        render_full(38, "2.5 PRO", "3h 22m"),
        render_ring(62, "2.5 PRO", "1h 18m"),
    ]
    area_w = int(W * 0.44); area_x0 = W - 40 - area_w
    area_y0 = MAIN_Y + 16; area_h = MAIN_Y + MAIN_H - area_y0 - 16
    mockup = me.render_device_photo_mockup(deck_keys, (area_w, area_h))
    deck_x = area_x0 + (area_w - mockup.width) // 2
    deck_y = area_y0 + (area_h - mockup.height) // 2
    canvas.alpha_composite(mockup, dest=(deck_x, deck_y))
    text_x = 70; text_max_w = deck_x - text_x - 60; d = ImageDraw.Draw(canvas)
    # Gemini logo to the left of the title
    title_y = MAIN_Y + 52
    LOGO_SZ = 90
    logo_img = _load_gemini_logo(LOGO_SZ, BRAND)
    if logo_img:
        canvas.alpha_composite(logo_img, dest=(text_x, title_y + 6))
        title_start_x = text_x + LOGO_SZ + 22
    else:
        title_start_x = text_x
    title_h = add_gradient_title(canvas, "Gemini Usage.", title_start_x, title_y, text_max_w - LOGO_SZ - 22, BRAND)
    # Tagline
    sub_y = title_y + max(title_h, LOGO_SZ + 10) + 18; d = ImageDraw.Draw(canvas)
    d.text((text_x, sub_y), "Know your quota. Zero configuration.", fill=(155, 165, 200, 200), font=fnt(26))
    # Bullets
    by2 = sub_y + 50
    bullets = [
        "Auto-loads from Gemini CLI. Nothing to paste.",
        "Live quota for 2.5 Pro (and Flash) with reset timer.",
        "8 display styles. Short-press to switch instantly.",
    ]
    for bline in bullets:
        d.ellipse([(text_x, by2+8), (text_x+8, by2+16)], fill=(*BRAND, 210))
        d.text((text_x+18, by2), bline, fill=(185, 195, 220, 200), font=fnt(22)); by2 += 36
    add_bottom_bar(canvas, W, H, [
        ("brand-google", "AUTO",    "DETECT"),
        ("layers",       "8",       "STYLES"),
        ("chart-bar",    "PER",     "MODEL"),
        ("shield",       "100%",    "LOCAL"),
    ], BRAND)
    save(canvas, "1-hero.png")

def banner_styles():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "8 display styles.", "Switch instantly with a short press.", W)
    CONTENT_H = (H - 170) - content_top
    keys8 = [
        render_ring(42, "2.5 PRO", "2h 14m"),      render_full(78, "2.5 PRO", "1h 40m"),
        render_bignumber(42, "2.5 PRO", "2h 14m"),  render_bigtime("2h 14m", "2.5 PRO"),
        render_countdown(78, "1h 40m", "2.5 PRO"),  render_sparkline(72, "2.5 PRO"),
        render_heatmap(),                            render_status(42, "2.5 PRO"),
    ]
    labels = ["Ring", "Full", "Big Number", "Big Time", "Countdown", "Sparkline", "Heatmap", "Status"]
    cell_w, cell_h, COLS2 = 252, 224, 4
    grid_h = 2 * cell_h
    oy = content_top + (CONTENT_H - grid_h) // 2; ox = (W - COLS2 * cell_w) // 2
    place_keys(canvas, keys8, COLS2, cell_w, cell_h, ox, oy, fnt(20), labels, key_disp=183)
    add_bottom_bar(canvas, W, H, [
        ("clock",   "LIVE",   "UPDATES"),
        ("palette", "OLED",   "THEMES"),
        ("layers",  "MULTI",  "ACCOUNT"),
        ("shield",  "100%",   "LOCAL"),
    ], BRAND)
    save(canvas, "2-styles.png")

def banner_alerts():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "Color shifts as quota climbs.", "No settings to touch - it just works.", W)
    CONTENT_H = (H - 170) - content_top
    alert_vals = [28, 58, 80, 95]; alert_resets = ["3h 22m", "1h 40m", "42m", "12m"]
    ks = 228
    alert_keys = [render_ring(v, "2.5 PRO", r, show_label=False, pct_max_sz=32).resize((ks, ks), Image.LANCZOS)
                  for v, r in zip(alert_vals, alert_resets)]
    state_names = ["Safe", "Moderate", "Warning", "Critical"]
    state_descs = ["0-49%", "50-74%", "75-84%", "85%+"]
    cell_w = 368
    block_h = ks + 58
    oy = content_top + (CONTENT_H - block_h) // 2
    ox = (W - 4 * cell_w) // 2
    for i, key in enumerate(alert_keys):
        x = ox + i*cell_w + (cell_w - ks) // 2
        canvas.alpha_composite(key, dest=(x, oy))
    d = ImageDraw.Draw(canvas); f_name = fnt(22); f_desc = fnt(17)
    for i, val in enumerate(alert_vals):
        col = usage_color(val); x = ox + i * cell_w
        nw, _ = txt_size(state_names[i], f_name); dw, _ = txt_size(state_descs[i], f_desc)
        d.text((x+(cell_w-nw)//2, oy+ks+14), state_names[i], font=f_name, fill=(*col, 255))
        d.text((x+(cell_w-dw)//2, oy+ks+42), state_descs[i], font=f_desc, fill=(140, 145, 165, 220))
    add_bottom_bar(canvas, W, H, [
        ("refresh", "LIVE",   "UPDATES"),
        ("clock",   "RESET",  "TIMER"),
        ("palette", "COLOR",  "SHIFTS"),
        ("shield",  "100%",   "LOCAL"),
    ], BRAND)
    save(canvas, "3-alerts.png")

def banner_reset():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "Reset countdown. Always on.", "Know exactly when your quota refills - no tab switching.", W)
    CONTENT_H = (H - 170) - content_top
    rkeys = [
        render_bigtime("3h 22m", "2.5 PRO"),
        render_bigtime("1h 18m", "2.5 PRO"),
        render_bigtime("42m",    "2.5 PRO"),
        render_countdown(88, "8m", "2.5 PRO"),
    ]
    rlabels = ["Plenty of time", "Pace yourself", "Wrap it up", "Final stretch"]
    cell_w, cell_h = 316, 246
    block_h = cell_h
    oy = content_top + (CONTENT_H - block_h) // 2; ox = (W - 4 * cell_w) // 2
    place_keys(canvas, rkeys, 4, cell_w, cell_h, ox, oy, fnt(22), rlabels, key_disp=183)
    add_bottom_bar(canvas, W, H, [
        ("clock",   "RESET",  "TIMER"),
        ("refresh", "LIVE",   "SYNC"),
        ("layers",  "8",      "STYLES"),
        ("shield",  "100%",   "LOCAL"),
    ], BRAND)
    save(canvas, "4-reset.png")

def banner_models():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "One key per model.", "2.5 Pro is the smart model. Flash is the fast one. Each has its own quota.", W)
    CONTENT_H = (H - 170) - content_top
    model_keys = [
        render_ring(38, "2.5 PRO",   "3h 22m"),
        render_ring(72, "2.5 FLASH", "1h 40m"),
        render_ring(55, "2.5 PRO",   "2h 05m"),
        render_ring(91, "2.5 FLASH", "9m"),
    ]
    model_labels = ["2.5 Pro - smart", "2.5 Flash - fast", "2.5 Pro", "Flash - critical"]
    model_colors = [usage_color(38), usage_color(72), usage_color(55), usage_color(91)]
    cell_w, cell_h = 370, 264
    block_h = cell_h
    oy = content_top + (CONTENT_H - block_h) // 2; ox = (W - 4 * cell_w) // 2
    place_keys(canvas, model_keys, 4, cell_w, cell_h, ox, oy, fnt(22), model_labels, model_colors, key_disp=228)
    add_bottom_bar(canvas, W, H, [
        ("chart-bar", "PER",    "MODEL"),
        ("layers",    "AUTO",   "DETECT"),
        ("clock",     "LIVE",   "RESETS"),
        ("shield",    "100%",   "LOCAL"),
    ], BRAND)
    save(canvas, "5-models.png")

def banner_zero_config():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "Already set up. You just don't know it yet.", "If you use the Gemini CLI, the plugin reads your credentials automatically. Nothing to paste.", W)
    CONTENT_H = (H - 170) - content_top
    d = ImageDraw.Draw(canvas)
    # Two scenarios side by side
    scenarios = [
        ("Already have Gemini CLI?",
         "Add the action to your Stream Deck.",
         "Quota appears immediately. Zero setup.",
         True),
        ("Starting fresh?",
         "One-time setup: install the CLI and sign in.",
         "After that, every plugin you add auto-loads.",
         False),
    ]
    scen_w = 680; scen_h = 200; gap = 80
    total_w = len(scenarios) * scen_w + gap
    sx = (W - total_w) // 2
    block_h = scen_h
    sy = content_top + (CONTENT_H - block_h) // 2
    for i, (heading, step1, step2, highlight) in enumerate(scenarios):
        x = sx + i * (scen_w + gap)
        fill = (14, 20, 34, 230) if highlight else (10, 14, 22, 180)
        outline_col = (*BRAND, 120) if highlight else (*BRAND, 35)
        d.rounded_rectangle([(x, sy), (x+scen_w, sy+scen_h)], radius=16,
                            fill=fill, outline=outline_col, width=2)
        # Heading
        f_h = fnt(26); hbb = d.textbbox((0,0), heading, font=f_h)
        hcol = BRAND if highlight else (180, 190, 215)
        d.text((x + scen_w//2 - (hbb[2]-hbb[0])//2, sy + 24 - hbb[1]), heading, font=f_h, fill=(*hcol, 255))
        # Step lines
        f_s1 = fnt(22); f_s2 = fnt(18)
        s1bb = d.textbbox((0,0), step1, font=f_s1)
        d.text((x + scen_w//2 - (s1bb[2]-s1bb[0])//2, sy + 76 - s1bb[1]), step1, font=f_s1, fill=(228, 234, 252, 255))
        s2bb = d.textbbox((0,0), step2, font=f_s2)
        d.text((x + scen_w//2 - (s2bb[2]-s2bb[0])//2, sy + 128 - s2bb[1]), step2, font=f_s2, fill=(140, 152, 180, 200))
        if highlight:
            # Small checkmark icon accent
            ic = icon_img("circle-check", 32, BRAND)
            if ic: canvas.alpha_composite(ic, dest=(x + 20, sy + 20))
    add_bottom_bar(canvas, W, H, [
        ("brand-google", "AUTO",   "DETECT"),
        ("refresh",      "AUTO",   "REFRESH"),
        ("layers",       "CLI",    "AWARE"),
        ("shield",       "100%",   "LOCAL"),
    ], BRAND)
    save(canvas, "6-zero-config.png")

def banner_multi_account():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "Work and personal. Side by side.", "Named keys for every account. No mixing them up.", W)
    CONTENT_H = (H - 170) - content_top
    ks = 230
    acct_keys = [
        render_ring(38, "Work",     "3h 22m").resize((ks, ks), Image.LANCZOS),
        render_ring(72, "Personal", "1h 40m").resize((ks, ks), Image.LANCZOS),
        render_ring(28, "Research", "3h 45m").resize((ks, ks), Image.LANCZOS),
        render_ring(95, "Side proj","12m"   ).resize((ks, ks), Image.LANCZOS),
    ]
    acct_labels = ["Work Account", "Personal Account", "Research Account", "Side Project"]
    acct_colors = [usage_color(38), usage_color(72), usage_color(28), usage_color(95)]
    cell_w, cell_h = 370, 264
    block_h = cell_h
    oy = content_top + (CONTENT_H - block_h) // 2; ox = (W - 4 * cell_w) // 2
    place_keys(canvas, acct_keys, 4, cell_w, cell_h, ox, oy, fnt(22), acct_labels, acct_colors, key_disp=ks)
    add_bottom_bar(canvas, W, H, [
        ("people", "NAMED",    "ACCOUNTS"),
        ("layers", "PER-KEY",  "SETTINGS"),
        ("palette","SHARED",   "STYLES"),
        ("shield", "100%",     "LOCAL"),
    ], BRAND)
    save(canvas, "7-multi-account.png")

# ═══════════════════════════════════════════════════════════════════════════════
# VIDEO
# ═══════════════════════════════════════════════════════════════════════════════

def gen_video():
    W, H = 1200, 630; FPS_MS = 60; TOP_H = 80; frames = []
    TARGETS = [38, 62, 55]; VLABELS = ["2.5 PRO", "2.5 PRO", "2.5 PRO"]; VRESETS = ["3h 22m", "1h 18m", "2h 05m"]

    def draw_frame(k1, k2, k3, phase_name, desc):
        canvas = Image.new("RGBA", (W, H), (*BG, 255))
        glow = Image.new("RGBA", (W, H), (0,0,0,0))
        ImageDraw.Draw(glow).ellipse([(-100, 100), (W+100, H-50)], fill=(*BRAND, 30))
        glow = glow.filter(ImageFilter.GaussianBlur(120))
        canvas = Image.alpha_composite(canvas, glow)
        d = ImageDraw.Draw(canvas); d.rectangle([(0,0),(W,TOP_H)], fill=(*BG, 255))
        _grad_line(canvas, TOP_H-1, 0, W, (*BRAND, 180))
        d = ImageDraw.Draw(canvas)
        f_title = fnt(26); bb = d.textbbox((0,0), PLUGIN_NAME, font=f_title)
        d.text((18, (TOP_H-(bb[3]-bb[1]))//2-bb[1]), PLUGIN_NAME, font=f_title, fill=(210, 220, 240, 220))
        d.text((18, (TOP_H-(bb[3]-bb[1]))//2-bb[1]+(bb[3]-bb[1])+2), "by Ratpack", font=fnt(14), fill=(120, 130, 160, 180))
        f_pn = fnt(20); pnw, _ = txt_size(phase_name, f_pn)
        d.text((W-pnw-18, (TOP_H-20)//2), phase_name, font=f_pn, fill=(*BRAND, 200))
        KEY_DISP = 160; GAP = 24; KY = TOP_H + (H-TOP_H-(KEY_DISP+36))//2
        total_kw = 3*KEY_DISP + 2*GAP; kx = (W - total_kw) // 2
        for ki, (key, lbl) in enumerate([(k1, VLABELS[0]), (k2, VLABELS[1]), (k3, VLABELS[2])]):
            x = kx + ki*(KEY_DISP+GAP)
            k_r = key.resize((KEY_DISP, KEY_DISP), Image.LANCZOS)
            canvas.alpha_composite(k_r, dest=(x, KY))
            lw, _ = txt_size(lbl, fnt(16)); d.text((x+(KEY_DISP-lw)//2, KY+KEY_DISP+10), lbl, font=fnt(16), fill=(130,140,170,200))
        descw, _ = txt_size(desc, fnt(18)); d.text(((W-descw)//2, H-42), desc, font=fnt(18), fill=(100, 110, 140, 200))
        return canvas.convert("RGB")

    # Phase 1: animated fill 0->38%
    for step in range(20):
        pct = step * 2; k1 = render_ring(pct, "2.5 PRO", "3h 22m"); k2 = render_ring(0, "2.5 PRO", ""); k3 = render_ring(0, "2.5 PRO", "")
        frames.append(draw_frame(k1, k2, k3, "Quota loading...", "Reading Gemini CLI credentials"))
    # Phase 2: hold at full state
    for _ in range(10):
        k1 = render_ring(38, "2.5 PRO", "3h 22m"); k2 = render_ring(62, "2.5 PRO", "1h 18m"); k3 = render_ring(55, "2.5 PRO", "2h 05m")
        frames.append(draw_frame(k1, k2, k3, "Live quota", "Gemini CLI credentials auto-loaded"))
    # Phase 3: cycle display styles
    CAROUSEL = [
        ("Ring",       render_ring(38,"2.5 PRO","3h 22m"),       render_ring(62,"2.5 PRO","1h 18m"),       render_ring(55,"2.5 PRO","2h 05m")),
        ("Big Number", render_bignumber(38,"2.5 PRO","3h 22m"),  render_bignumber(62,"2.5 PRO","1h 18m"),  render_bignumber(55,"2.5 PRO","2h 05m")),
        ("Countdown",  render_countdown(38,"3h 22m","2.5 PRO"),  render_countdown(62,"1h 18m","2.5 PRO"),  render_bigtime("2h 05m","2.5 PRO")),
        ("Status",     render_status(38,"2.5 PRO"),               render_status(62,"2.5 PRO"),               render_status(55,"2.5 PRO")),
        ("Fill",       render_full(38,"2.5 PRO","3h 22m"),        render_full(62,"2.5 PRO","1h 18m"),        render_full(55,"2.5 PRO","2h 05m")),
    ]
    for style_name, k1, k2, k3 in CAROUSEL:
        for _ in range(8):
            frames.append(draw_frame(k1, k2, k3, style_name, "Short-press to switch styles"))
    # Phase 4: critical state warning
    for _ in range(8):
        k1 = render_ring(91, "2.5 PRO", "9m"); k2 = render_ring(38, "2.5 PRO", "3h 22m"); k3 = render_status(91, "2.5 PRO")
        frames.append(draw_frame(k1, k2, k3, "Alert", "Color shifts automatically at 85%"))

    gif_path = os.path.join(OUT_DIR, "preview.gif")
    frames[0].save(gif_path, save_all=True, append_images=frames[1:], duration=FPS_MS, loop=0, optimize=False)
    print("> preview.gif")
    mp4_path = os.path.join(OUT_DIR, "preview.mp4")
    try:
        subprocess.run([
            "ffmpeg", "-i", gif_path,
            "-vf", "scale=1920:1008:flags=lanczos,pad=1920:1080:0:36:black",
            "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-y", mp4_path
        ], check=True, capture_output=True)
        print("> preview.mp4")
    except Exception:
        print("! ffmpeg not found - GIF only. Install ffmpeg to also produce preview.mp4")

# ═══════════════════════════════════════════════════════════════════════════════
# DESCRIPTION
# ═══════════════════════════════════════════════════════════════════════════════

DESCRIPTION = """Gemini Usage - Stream Deck plugin that shows your Gemini CLI quota at a glance. Reads credentials automatically from the Gemini CLI so there is nothing to configure.

Know your quota. Zero configuration.

Auto-loads from your installed Gemini CLI. See per-model quotas for Gemini 2.5 Pro, Flash, and more, with a live reset countdown on every key.

- Reads directly from your Gemini CLI credentials. No token to find or paste.
- Per-model quotas: track 2.5 Pro, 2.5 Flash, and any new model automatically.
- 8 display styles: Ring, Full, Big Number, Big Time, Countdown, Sparkline, Heatmap, Status.
- Smart color alerts shift green to amber to red as quota climbs. No settings needed.
- 100% local. Your credentials never leave your machine.

Keywords: Gemini, Google AI, Gemini CLI, AI quota, usage monitor, Stream Deck, AI limits, Gemini 2.5 Pro, developer tools
"""

def write_description():
    path = os.path.join(OUT_DIR, "description.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(DESCRIPTION)
    print("> description.txt")

# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print(f"\nGenerating Gemini Usage marketing assets -> {OUT_DIR}\n")
    banner_hero()
    banner_styles()
    banner_alerts()
    banner_reset()
    banner_models()
    banner_zero_config()
    banner_multi_account()
    write_description()
    gen_video()
    print("\nDone.")

if __name__ == "__main__":
    main()

# coding: utf-8
#!/usr/bin/env python3
"""
Ratpack - Grok Usage - Marketing Generator
Run: python scripts/gen-marketing-grok.py
Output: scripts/output/marketing/grok/
"""
import os, sys, subprocess, math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
OUT_DIR    = os.path.join(SCRIPT_DIR, "output", "marketing", "grok")
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

BRAND = (255, 59, 48)    # Grok red
BG    = (8, 10, 16)

me.BRAND   = BRAND
me.BG      = BG
me.OUT_DIR = OUT_DIR

PLUGIN_NAME = "Grok Usage"
KEY_SZ  = 144
FILL_BG = (10, 10, 12)
GREEN   = (48, 226, 123)
YELLOW  = (255, 214, 10)
RED     = (255, 59, 48)

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

def key_bg(bg=None):
    c = bg or (11, 11, 14)
    img = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([(0, 0), (KEY_SZ-1, KEY_SZ-1)], radius=10, fill=(*c, 255))
    return img

def draw_c(img, text, y, f, color, shadow=False):
    d = ImageDraw.Draw(img); w, _ = txt_size(text, f); x = (img.width - w) // 2
    if shadow: d.text((x+1, y+2), text, font=f, fill=(0, 0, 0, 110))
    d.text((x, y), text, font=f, fill=(*color[:3], 255))

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
    w, h = deck.size; out_h = h + tilt
    src = [(0,0),(w,0),(w,h),(0,h)]; dst = [(0,0),(w,tilt),(w,h+tilt*3//4),(0,h-tilt//4)]
    A, b = [], []
    for (sx,sy),(dx,dy) in zip(src,dst):
        A += [[dx,dy,1,0,0,0,-dx*sx,-dy*sx],[0,0,0,dx,dy,1,-dx*sy,-dy*sy]]; b += [sx,sy]
    try:
        import numpy as np
        c = np.linalg.solve(np.array(A,dtype=float), np.array(b,dtype=float)).tolist()
        return deck.transform((w, out_h), Image.PERSPECTIVE, c, Image.BICUBIC)
    except Exception:
        r = Image.new("RGBA", (w, out_h), (0,0,0,0)); r.alpha_composite(deck, dest=(0, tilt//2)); return r

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

# ═══════════════════════════════════════════════════════════════════════════════
# BANNERS
# ═══════════════════════════════════════════════════════════════════════════════

# Grok windows: Grok 3 Standard, Grok 4 Heavy, Grok 3 Reasoning, Grok 3 DeepSearch
WINDOWS = [
    ("GROK 3",  "Standard"),
    ("GROK 4",  "Heavy"),
    ("REASON",  "Reasoning"),
    ("DEEP",    "DeepSearch"),
]

def banner_hero():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    TOP_H, BOT_H = 76, 170; MAIN_Y = TOP_H; MAIN_H = H - TOP_H - BOT_H
    FLAT_DW, FLAT_DH, TILT = 880, 570, 65
    deck_keys = [
        render_ring(38, "GROK 3",  "3h 22m"),
        render_ring(72, "GROK 4",  "1h 40m"),
        render_ring(22, "REASON",  "4h 50m"),
        render_ring(55, "DEEP",    "2h 05m"),
        render_bignumber(38, "GROK 3", "3h 22m"),
        render_status(72, "GROK 4"),
        render_countdown(55, "2h 05m", "DEEP"),
        render_bigtime("3h 22m", "GROK 3"),
        render_sparkline(38, "GROK 3"),
        render_full(72, "GROK 4", "1h 40m"),
        render_bignumber(22, "REASON", "4h 50m"),
        render_heatmap(),
        render_status(55, "DEEP"),
        render_countdown(72, "1h 40m", "GROK 4"),
        render_ring(88, "REASON", "4h 50m"),
    ]
    area_w = int(W * 0.44); area_x0 = W - 40 - area_w
    area_y0 = MAIN_Y + 16; area_h = MAIN_Y + MAIN_H - area_y0 - 16
    mockup = me.render_device_photo_mockup(deck_keys, (area_w, area_h))
    deck_x = area_x0 + (area_w - mockup.width) // 2
    deck_y = area_y0 + (area_h - mockup.height) // 2
    canvas.alpha_composite(mockup, dest=(deck_x, deck_y))
    text_x = 70; text_max_w = deck_x - text_x - 60; d = ImageDraw.Draw(canvas)
    title_y = MAIN_Y + 52
    LOGO_SZ = 90
    logo_img = _load_logo("grok-logo.svg", LOGO_SZ, BRAND)
    if logo_img:
        canvas.alpha_composite(logo_img, dest=(text_x, title_y + 6))
        title_start_x = text_x + LOGO_SZ + 22
    else:
        title_start_x = text_x
    title_h = add_gradient_title(canvas, "Grok Usage.", title_start_x, title_y, text_max_w - LOGO_SZ - 22, BRAND)
    sub_y = title_y + max(title_h, LOGO_SZ + 10) + 18; d = ImageDraw.Draw(canvas)
    d.text((text_x, sub_y), "Grok 3, Grok 4, Reasoning, DeepSearch. One glance.", fill=(155, 165, 200, 200), font=fnt(26))
    by2 = sub_y + 50
    bullets = [
        "All four Grok rate-limit windows on separate keys.",
        "Color shifts green to red as queries run out.",
        "8 display styles. Short-press to switch instantly.",
    ]
    for bline in bullets:
        d.ellipse([(text_x, by2+8), (text_x+8, by2+16)], fill=(*BRAND, 210))
        d.text((text_x+18, by2), bline, fill=(185, 195, 220, 200), font=fnt(22)); by2 += 36
    grok_tile_logo = _load_logo("grok-logo.svg", 56, BRAND)
    add_bottom_bar(canvas, W, H, [
        (grok_tile_logo if grok_tile_logo else "brand-x", "4", "WINDOWS"),
        ("layers",   "8",       "STYLES"),
        ("chart-bar","LIVE",    "LIMITS"),
        ("shield",   "100%",    "LOCAL"),
    ], BRAND)
    save(canvas, "1-hero.png")

def banner_styles():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "8 display styles.", "Switch instantly with a short press.", W)
    CONTENT_H = (H - 170) - content_top
    keys8 = [
        render_ring(42, "GROK 3", "2h 14m"),      render_full(78, "GROK 4", "1h 40m"),
        render_bignumber(42, "GROK 3", "2h 14m"),  render_bigtime("2h 14m", "GROK 3"),
        render_countdown(78, "1h 40m", "GROK 4"),  render_sparkline(72, "GROK 3"),
        render_heatmap(),                           render_status(42, "GROK 3"),
    ]
    labels = ["Ring", "Full", "Big Number", "Big Time", "Countdown", "Sparkline", "Heatmap", "Status"]
    cell_w, cell_h, COLS2 = 252, 224, 4
    grid_h = 2 * cell_h
    oy = content_top + (CONTENT_H - grid_h) // 2; ox = (W - COLS2 * cell_w) // 2
    place_keys(canvas, keys8, COLS2, cell_w, cell_h, ox, oy, fnt(20), labels, key_disp=183)
    add_bottom_bar(canvas, W, H, [
        ("clock",   "LIVE",   "UPDATES"),
        ("palette", "OLED",   "THEMES"),
        ("layers",  "MULTI",  "WINDOW"),
        ("shield",  "100%",   "LOCAL"),
    ], BRAND)
    save(canvas, "2-styles.png")

def banner_alerts():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "Color shifts as queries run out.", "No settings to configure. Just glance at your deck.", W)
    CONTENT_H = (H - 170) - content_top
    alert_vals = [28, 58, 80, 95]; alert_resets = ["3h 22m", "1h 40m", "42m", "12m"]
    ks = 228
    alert_keys = [render_ring(v, "GROK 3", r, show_label=False, pct_max_sz=32).resize((ks, ks), Image.LANCZOS)
                  for v, r in zip(alert_vals, alert_resets)]
    state_names = ["Safe", "Moderate", "Warning", "Critical"]
    state_descs = ["0-49%", "50-74%", "75-84%", "85%+"]
    cell_w = 368; block_h = ks + 58
    oy = content_top + (CONTENT_H - block_h) // 2; ox = (W - 4 * cell_w) // 2
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
    content_top = banner_header(canvas, "Reset countdown. Always on.", "Know exactly when your window reopens. No guessing.", W)
    CONTENT_H = (H - 170) - content_top
    rkeys = [
        render_bigtime("3h 22m", "GROK 3"),
        render_bigtime("1h 40m", "GROK 4"),
        render_bigtime("42m",    "REASON"),
        render_countdown(88, "8m", "DEEP"),
    ]
    rlabels = ["Plenty of time", "Pace yourself", "Wrap it up", "Final stretch"]
    cell_w, cell_h = 316, 246; block_h = cell_h
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
    content_top = banner_header(canvas, "One key per Grok window.", "Grok 3, Grok 4 Heavy, Reasoning, DeepSearch - each has its own rate limit.", W)
    CONTENT_H = (H - 170) - content_top
    model_keys = [
        render_ring(38, "GROK 3",  "3h 22m"),
        render_ring(72, "GROK 4",  "1h 40m"),
        render_ring(22, "REASON",  "4h 50m"),
        render_ring(55, "DEEP",    "2h 05m"),
    ]
    model_labels = ["Grok 3 - Standard", "Grok 4 - Heavy", "Grok 3 - Reasoning", "Grok 3 - DeepSearch"]
    model_colors = [usage_color(38), usage_color(72), usage_color(22), usage_color(55)]
    cell_w, cell_h = 370, 264; block_h = cell_h
    oy = content_top + (CONTENT_H - block_h) // 2; ox = (W - 4 * cell_w) // 2
    place_keys(canvas, model_keys, 4, cell_w, cell_h, ox, oy, fnt(22), model_labels, model_colors, key_disp=228)
    add_bottom_bar(canvas, W, H, [
        ("chart-bar", "4",      "WINDOWS"),
        ("layers",    "LIVE",   "LIMITS"),
        ("clock",     "LIVE",   "RESETS"),
        ("shield",    "100%",   "LOCAL"),
    ], BRAND)
    save(canvas, "5-models.png")

def banner_setup():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "One paste to start tracking.", "Copy your Cookie header from the Network tab. Paste it once. Done.", W)
    CONTENT_H = (H - 170) - content_top
    d = ImageDraw.Draw(canvas)
    steps = [
        ("1", "Open grok.com and sign in",    "Any browser"),
        ("2", "Open DevTools - Network tab",   "F12, then reload"),
        ("3", "Click any grok.com request",    "Headers - Cookie - copy all"),
        ("4", "Paste into the plugin",         "Done. Updates every 2 minutes."),
    ]
    step_w, step_h = 360, 170; gap = 28
    total_w = len(steps) * step_w + (len(steps)-1) * gap
    sx = (W - total_w) // 2; sy = content_top + (CONTENT_H - step_h) // 2
    for i, (num, title, sub) in enumerate(steps):
        x = sx + i * (step_w + gap)
        d.rounded_rectangle([(x, sy), (x+step_w, sy+step_h)], radius=14,
                            fill=(14, 18, 28, 220), outline=(*BRAND, 60), width=1)
        f_num = fnt(52); bb = d.textbbox((0,0), num, font=f_num)
        d.text((x+24-bb[0], sy+16-bb[1]), num, font=f_num, fill=(*BRAND, 200))
        f_t = fnt(20); tw, _ = txt_size(title, f_t)
        # Fit title
        while tw > step_w - 80 and f_t.size > 14:
            f_t = fnt(f_t.size - 1); tw, _ = txt_size(title, f_t)
        d.text((x + step_w//2 - tw//2, sy + 28), title, font=f_t, fill=(220, 228, 248, 255))
        f_s = fnt(16); sw2, _ = txt_size(sub, f_s)
        while sw2 > step_w - 20:
            f_s = fnt(f_s.size - 1); sw2, _ = txt_size(sub, f_s)
        d.text((x + step_w//2 - sw2//2, sy + 62), sub, font=f_s, fill=(*BRAND, 200))
        if i < len(steps)-1:
            ax = x + step_w + gap//2; ay = sy + step_h//2
            d.polygon([(ax-8, ay-8),(ax+8, ay),(ax-8, ay+8)], fill=(*BRAND, 160))
    note = "You only need to do this once. The cookie stays valid for weeks."
    nw, _ = txt_size(note, fnt(20))
    d.text(((W-nw)//2, sy + step_h + 32), note, font=fnt(20), fill=(140, 150, 180, 200))
    add_bottom_bar(canvas, W, H, [
        ("cookie",  "ONE",    "PASTE"),
        ("refresh", "AUTO",   "REFRESH"),
        ("layers",  "4",      "WINDOWS"),
        ("shield",  "100%",   "LOCAL"),
    ], BRAND)
    save(canvas, "6-setup.png")

def banner_multi_key():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "All four windows. One glance.", "A key for each Grok mode. See them all at the same time.", W)
    CONTENT_H = (H - 170) - content_top
    ks = 230
    window_keys = [
        render_ring(38, "GROK 3", "3h 22m").resize((ks, ks), Image.LANCZOS),
        render_ring(72, "GROK 4", "1h 40m").resize((ks, ks), Image.LANCZOS),
        render_ring(22, "REASON", "4h 50m").resize((ks, ks), Image.LANCZOS),
        render_ring(55, "DEEP",   "2h 05m").resize((ks, ks), Image.LANCZOS),
    ]
    wlabels = ["Standard", "Heavy", "Reasoning", "DeepSearch"]
    wcolors = [usage_color(38), usage_color(72), usage_color(22), usage_color(55)]
    cell_w, cell_h = 370, 264; block_h = cell_h
    oy = content_top + (CONTENT_H - block_h) // 2; ox = (W - 4 * cell_w) // 2
    place_keys(canvas, window_keys, 4, cell_w, cell_h, ox, oy, fnt(22), wlabels, wcolors, key_disp=ks)
    add_bottom_bar(canvas, W, H, [
        ("layout-grid", "4",      "KEYS"),
        ("layers",      "PER-KEY","SETTINGS"),
        ("palette",     "SHARED", "STYLES"),
        ("shield",      "100%",   "LOCAL"),
    ], BRAND)
    save(canvas, "7-multi-key.png")

# ═══════════════════════════════════════════════════════════════════════════════
# VIDEO
# ═══════════════════════════════════════════════════════════════════════════════

def gen_video():
    W, H = 1200, 630; FPS_MS = 60; TOP_H = 80; frames = []

    def draw_frame(keys_and_labels, phase_name, desc):
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
        f_pn = fnt(20); pnw, _ = txt_size(phase_name, f_pn)
        d.text((W-pnw-18, (TOP_H-20)//2), phase_name, font=f_pn, fill=(*BRAND, 200))
        KEY_DISP = 140; GAP = 20; KY = TOP_H + (H-TOP_H-(KEY_DISP+36))//2
        n = len(keys_and_labels); total_kw = n*KEY_DISP+(n-1)*GAP; kx=(W-total_kw)//2
        for ki,(key,lbl) in enumerate(keys_and_labels):
            x=kx+ki*(KEY_DISP+GAP)
            canvas.alpha_composite(key.resize((KEY_DISP,KEY_DISP),Image.LANCZOS),dest=(x,KY))
            lw,_=txt_size(lbl,fnt(14));d.text((x+(KEY_DISP-lw)//2,KY+KEY_DISP+8),lbl,font=fnt(14),fill=(130,140,170,200))
        descw,_=txt_size(desc,fnt(18));d.text(((W-descw)//2,H-42),desc,font=fnt(18),fill=(100,110,140,200))
        return canvas.convert("RGB")

    # Phase 1: loading
    for step in range(20):
        pct=step*2
        keys=[(render_ring(pct,"GROK 3",""),"GROK 3"),(render_ring(0,"GROK 4",""),"GROK 4"),(render_ring(0,"REASON",""),"REASON"),(render_ring(0,"DEEP",""),"DEEP")]
        frames.append(draw_frame(keys,"Loading...","Reading rate limits"))
    # Phase 2: live
    for _ in range(10):
        keys=[(render_ring(38,"GROK 3","3h 22m"),"GROK 3"),(render_ring(72,"GROK 4","1h 40m"),"GROK 4"),(render_ring(22,"REASON","4h 50m"),"REASON"),(render_ring(55,"DEEP","2h 05m"),"DEEP")]
        frames.append(draw_frame(keys,"Live limits","All four windows updated"))
    # Phase 3: styles
    CAROUSEL=[
        ("Ring",[(render_ring(38,"GROK 3","3h 22m"),"GROK 3"),(render_ring(72,"GROK 4","1h 40m"),"GROK 4"),(render_ring(22,"REASON","4h 50m"),"REASON"),(render_ring(55,"DEEP","2h 05m"),"DEEP")]),
        ("Big Number",[(render_bignumber(38,"GROK 3","3h 22m"),"GROK 3"),(render_bignumber(72,"GROK 4","1h 40m"),"GROK 4"),(render_bignumber(22,"REASON","4h 50m"),"REASON"),(render_bignumber(55,"DEEP","2h 05m"),"DEEP")]),
        ("Status",[(render_status(38,"GROK 3"),"GROK 3"),(render_status(72,"GROK 4"),"GROK 4"),(render_status(22,"REASON"),"REASON"),(render_status(55,"DEEP"),"DEEP")]),
        ("Fill",[(render_full(38,"GROK 3","3h 22m"),"GROK 3"),(render_full(72,"GROK 4","1h 40m"),"GROK 4"),(render_full(22,"REASON","4h 50m"),"REASON"),(render_full(55,"DEEP","2h 05m"),"DEEP")]),
    ]
    for style_name,keys in CAROUSEL:
        for _ in range(7): frames.append(draw_frame(keys,style_name,"Short-press to switch styles"))
    # Phase 4: critical
    for _ in range(8):
        keys=[(render_ring(91,"GROK 4","9m"),"GROK 4"),(render_status(91,"GROK 4"),"GROK 4")]
        frames.append(draw_frame(keys,"Alert","Color shifts at 85%"))

    gif_path=os.path.join(OUT_DIR,"preview.gif")
    frames[0].save(gif_path,save_all=True,append_images=frames[1:],duration=FPS_MS,loop=0,optimize=False)
    print("> preview.gif")
    mp4_path=os.path.join(OUT_DIR,"preview.mp4")
    try:
        subprocess.run(["ffmpeg","-i",gif_path,"-vf","scale=1920:1008:flags=lanczos,pad=1920:1080:0:36:black",
                        "-c:v","libx264","-crf","18","-pix_fmt","yuv420p","-movflags","+faststart","-y",mp4_path],
                       check=True,capture_output=True)
        print("> preview.mp4")
    except Exception:
        print("! ffmpeg not found - GIF only")

DESCRIPTION = """Grok Usage monitor for Stream Deck. Tracks rate limits for Grok 3, Grok 4 Heavy, Reasoning, and DeepSearch with live reset countdowns.

See every Grok limit at a glance.

Four separate keys for four separate windows. Know which Grok mode still has headroom and which needs to reset before you switch back to it.

- Tracks all four Grok windows: Grok 3 Standard, Grok 4 Heavy, Reasoning, and DeepSearch.
- One-time setup: paste your Cookie header from the Network tab and you're done.
- 8 display styles including ring, status word, countdown, and fill.
- Smart color alerts shift green to amber to red as queries run out.
- 100% local. Your session data never leaves your machine.

Keywords: Grok, xAI, Grok 4, Grok 3, AI rate limits, Stream Deck, AI usage monitor, DeepSearch, reasoning AI
"""

def write_description():
    path=os.path.join(OUT_DIR,"description.txt")
    with open(path,"w",encoding="utf-8") as f: f.write(DESCRIPTION)
    print("> description.txt")

def main():
    print(f"\nGenerating Grok Usage marketing assets -> {OUT_DIR}\n")
    banner_hero()
    banner_styles()
    banner_alerts()
    banner_reset()
    banner_models()
    banner_setup()
    banner_multi_key()
    write_description()
    gen_video()
    print("\nDone.")

if __name__ == "__main__":
    main()

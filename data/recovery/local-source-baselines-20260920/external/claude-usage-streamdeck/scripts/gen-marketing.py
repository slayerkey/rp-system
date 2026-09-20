# coding: utf-8
#!/usr/bin/env python3
"""
Ratpack - Claude Usage - Marketing Generator
Run: python scripts/gen-marketing.py
Output: scripts/output/marketing/

Built on the shared engine (../_shared/marketing_engine.py) like every other provider
in this repo: engine canvas + banner_header + bottom bar + the real MK.2 device photo.
Only the key renderers are local, because they mirror THIS plugin's actual key art.
"""
import os, sys, subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
OUT_DIR    = os.path.join(SCRIPT_DIR, "output", "marketing")
ICON_PATH  = os.path.join(ROOT_DIR, "icon.png")
os.makedirs(OUT_DIR, exist_ok=True)

sys.path.insert(0, os.path.join(ROOT_DIR, "..", "_shared"))
import marketing_engine as me
from marketing_engine import (
    Image, ImageDraw, ImageFont, ImageFilter,
    fnt, txt_size, fit_fnt, icon_img,
    make_canvas, add_bottom_bar, add_gradient_title, banner_header,
)

BRAND = (255, 138, 61)   # Claude orange
BG    = (8, 10, 16)

me.BRAND   = BRAND
me.BG      = BG
me.OUT_DIR = OUT_DIR

PLUGIN_NAME = "Claude Usage"
KEY_SZ  = 144
FILL_BG = (10, 10, 12)
GREEN   = (48, 226, 123)
YELLOW  = (255, 214, 10)
RED     = (255, 59, 48)

def save(canvas, name):
    canvas.convert("RGB").save(os.path.join(OUT_DIR, name), quality=96)
    print("> " + name)

def place_keys(canvas, keys, cols, cell_w, cell_h, ox, oy,
               label_f=None, labels=None, label_colors=None, key_disp=None):
    ksz = key_disp if key_disp else KEY_SZ
    for i, key in enumerate(keys):
        row, col = divmod(i, cols)
        x = ox + col*cell_w + (cell_w-ksz)//2; y = oy + row*cell_h + (cell_h-ksz)//2
        if key_disp and key.size != (ksz, ksz): key = key.resize((ksz, ksz), Image.LANCZOS)
        canvas.alpha_composite(key, dest=(x, y))
        if label_f and labels and i < len(labels):
            lbl = labels[i]; lw, _ = txt_size(lbl, label_f)
            lcolor = (160, 160, 180) if not label_colors else label_colors[i]
            ImageDraw.Draw(canvas).text((x+(ksz-lw)//2, y+ksz+12), lbl, font=label_f, fill=(*lcolor[:3], 255))

# --- Color ---
def lerp_color(c1, c2, t):
    return tuple(max(0, min(255, int(c1[i]+(c2[i]-c1[i])*t))) for i in range(3))

def usage_color(used):
    u = max(0.0, min(100.0, used))
    if u >= 85: return RED
    if u >= 50: return lerp_color(YELLOW, RED, (u-50)/35)
    return lerp_color(GREEN, YELLOW, u/50)

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

# --- Key renderers (144x144, mirror src/render/svg.ts) ---

def render_ring(used, label, reset, show_label=True, pct_max_sz=34):
    color = usage_color(used); img = key_bg()
    cx, cy, r, sw = 72, 57, 48, 11; bbox = [(cx-r, cy-r), (cx+r, cy+r)]
    track = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0))
    ImageDraw.Draw(track).arc(bbox, 0, 360, fill=(255, 255, 255, 28), width=sw)
    img.alpha_composite(track)
    if used > 0.5:
        arc = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0))
        ImageDraw.Draw(arc).arc(bbox, -90, -90+360*min(used/100, 1), fill=(*color, 255), width=sw)
        img.alpha_composite(arc)
    pct = "%d%%" % int(round(used)); draw_c(img, pct, 40, fit_fnt(pct, 78, pct_max_sz, 14), color)
    if show_label: draw_c(img, label, 114, fnt(13), (200, 200, 200))
    if reset: draw_c(img, reset, 129 if show_label else 116, fit_fnt(reset, 88, 14, 10), (255, 255, 255))
    return img

def render_full(used, label, reset):
    color = usage_color(used); img = key_bg(FILL_BG)
    fill_h = max(1, int(KEY_SZ*used/100)); y0 = KEY_SZ - fill_h
    ov = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for yy in range(y0, KEY_SZ):
        t = (yy-y0)/max(fill_h-1, 1); od.line([(0, yy), (KEY_SZ, yy)], fill=(*color, int(55+110*t)))
    img.alpha_composite(ov)
    if fill_h > 2: ImageDraw.Draw(img).line([(0, y0), (KEY_SZ, y0)], fill=(*color, 200), width=3)
    pct = "%d%%" % int(round(used)); draw_c(img, pct, 58, fit_fnt(pct, 112, 52, 18), color, shadow=True)
    if reset: draw_c(img, reset, 118, fnt(12), (255, 255, 255), shadow=True)
    return img

def render_bignumber(used, label, reset):
    color = usage_color(used); img = key_bg()
    draw_c(img, label, 16, fnt(12), (180, 180, 180))
    pct = "%d%%" % int(round(used)); draw_c(img, pct, 48, fit_fnt(pct, 122, 58, 18), color)
    bx, bar_y, bh = 14, 118, 8; bw = KEY_SZ - 2*bx; fw = int(bw*min(used/100, 1))
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
    fill_h = max(1, int(KEY_SZ*used/100)); y0 = KEY_SZ - fill_h
    ov = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for yy in range(y0, KEY_SZ):
        t = (yy-y0)/max(fill_h-1, 1); od.line([(0, yy), (KEY_SZ, yy)], fill=(*color, int(35+80*t)))
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
    bx, by, bh = 14, 120, 7; bw = KEY_SZ - 2*bx; fw = int(bw*min(used/100, 1))
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
    ox, oy2, cw, ch = 10, 28, 124, 76; mx = max(series+[1])
    pts = [(int(ox + i/max(len(series)-1, 1)*cw), int(oy2 + ch*(1 - v/mx))) for i, v in enumerate(series)]
    for i in range(len(pts)-1): d.line([pts[i], pts[i+1]], fill=(*color, 200), width=2)
    if pts: lx2, ly2 = pts[-1]; d.ellipse([(lx2-4, ly2-4), (lx2+4, ly2+4)], fill=(*color, 255))
    draw_c(img, "24h history", 128, fnt(9), (120, 120, 120))
    return img

HEAT = [45, 60, 35, 80, 55, 88, 72]
def render_heatmap(cells=None, label="7D"):
    if cells is None: cells = HEAT
    img = key_bg(); d = ImageDraw.Draw(img)
    draw_c(img, label, 18, fnt(12), (160, 160, 160))
    draw_c(img, "7-DAY HISTORY", 34, fnt(9), (100, 100, 100))
    days = ["M", "T", "W", "T", "F", "S", "S"]; cw2, gap = 14, 4
    total_w = len(days)*(cw2+gap) - gap; ox = (KEY_SZ - total_w)//2
    for i, v in enumerate(cells):
        x = ox + i*(cw2+gap)
        col = (255, 255, 255, 28) if v is None else (*usage_color(v), int(60+160*(v/100)))
        d.rounded_rectangle([(x, 66), (x+cw2, 66+cw2)], radius=3, fill=col)
        if i == len(cells)-1:
            dc = usage_color(v) if v else (255, 255, 255)
            d.rounded_rectangle([(x-2, 64), (x+cw2+2, 68+cw2)], radius=4, outline=(*dc, 200), width=1)
        fw2, _ = txt_size(days[i], fnt(8)); d.text((x+(cw2-fw2)//2, 86), days[i], font=fnt(8), fill=(100, 100, 100, 255))
    draw_c(img, "today", 126, fnt(9), (100, 100, 100))
    return img

def render_dual(a_used, b_used):
    img = key_bg(); d = ImageDraw.Draw(img)
    draw_c(img, "OVERVIEW", 18, fnt(10), (140, 140, 140))
    def row(lbl, used, y):
        color = usage_color(used); bx = 14; bw = KEY_SZ - 2*bx; bh = 16
        fw = int(bw*min(used/100, 1)); lf = fnt(12)
        pw, _ = txt_size("%d%%" % int(used), lf)
        d.text((bx, y-16), lbl, font=lf, fill=(160, 160, 160, 255))
        d.text((KEY_SZ-bx-pw, y-16), "%d%%" % int(used), font=lf, fill=(*color, 255))
        d.rounded_rectangle([(bx, y), (bx+bw, y+bh)], radius=8, fill=(255, 255, 255, 20))
        if fw > 0: d.rounded_rectangle([(bx, y), (bx+fw, y+bh)], radius=8, fill=(*color, 255))
    row("5H", a_used, 50)
    row("WEEK", b_used, 96)
    return img

def _grad_line(canvas, y, x0, x1, color):
    r, g, b, a = color; w = x1 - x0
    ln = Image.new("RGBA", (w, 2), (0, 0, 0, 0)); px = ln.load()
    for xi in range(w):
        t = xi/max(w-1, 1); fade = (1 - abs(t-0.5)*2)**0.5; al = int(a*fade)
        px[xi, 0] = px[xi, 1] = (r, g, b, al)
    canvas.alpha_composite(ln, dest=(x0, y-1))

def _load_logo(svg_file, size, color):
    """Rasterize an SVG logo with resvg (correct fill-rules) and tint it to `color`."""
    import io
    svg_path = os.path.join(ROOT_DIR, "assets", svg_file)
    if not os.path.exists(svg_path):
        return None
    try:
        import resvg_py
        raw = open(svg_path, encoding="utf-8").read()
        ss = size*4
        png = resvg_py.svg_to_bytes(svg_string=raw, width=ss, height=ss,
                                    style_sheet="* { fill: #ffffff; stroke: none; }")
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

def banner_hero():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    TOP_H, BOT_H = 76, 170; MAIN_Y = TOP_H; MAIN_H = H - TOP_H - BOT_H
    # 15 distinct key formats, incl. the premium-model weekly window.
    deck_keys = [
        render_ring(42, "5H", "2h 14m"),   render_ring(78, "WEEK", "3d"),    render_ring(95, "5H", "12m"),
        render_full(78, "WEEK", "3d"),      render_bignumber(35, "WEEK", "3d"),
        render_status(42, "5H"),            render_countdown(82, "42m", "5H"), render_bigtime("2h 14m", "5H"),
        render_sparkline(72, "WEEK"),       render_heatmap(),
        render_dual(42, 78),                render_full(95, "5H", "12m"),
        render_bignumber(58, "FABLE", "3d"),render_status(95, "5H"),           render_bigtime("42m", "5H"),
    ]
    area_w = int(W*0.46); area_x0 = W - 40 - area_w
    area_y0 = MAIN_Y + 16; area_h = MAIN_Y + MAIN_H - area_y0 - 16
    mockup = me.render_straight_device(deck_keys, (area_w, area_h), accent=BRAND)
    deck_x = area_x0 + (area_w - mockup.width)//2
    deck_y = area_y0 + (area_h - mockup.height)//2
    canvas.alpha_composite(mockup, dest=(deck_x, deck_y))
    text_x = 70; text_max_w = deck_x - text_x - 60
    title_y = MAIN_Y + 62
    LOGO_SZ = 90
    logo_img = _load_logo("claude-logo.svg", LOGO_SZ, BRAND)
    if logo_img:
        canvas.alpha_composite(logo_img, dest=(text_x, title_y + 6))
        title_start_x = text_x + LOGO_SZ + 22; title_w = text_max_w - LOGO_SZ - 22
    else:
        title_start_x = text_x; title_w = text_max_w
    title_h = add_gradient_title(canvas, "Claude Usage.", title_start_x, title_y, title_w, BRAND)
    sub_y = title_y + max(title_h, LOGO_SZ + 10) + 18
    d = ImageDraw.Draw(canvas)
    d.text((text_x, sub_y), "Know if you can keep going, at a glance.", fill=(155, 165, 200, 200), font=fnt(26))
    by2 = sub_y + 50
    bullets = [
        "Session, weekly and premium model limits, live.",
        "8 display styles, 3 themes, per-key setup.",
        "Short-press style. Long-press window. Multi-account.",
    ]
    for bline in bullets:
        d.ellipse([(text_x, by2+8), (text_x+8, by2+16)], fill=(*BRAND, 210))
        d.text((text_x+18, by2), bline, fill=(185, 195, 220, 200), font=fnt(22)); by2 += 36
    add_bottom_bar(canvas, W, H, [
        ("refresh", "LIVE",  "USAGE"),
        ("palette", "8",     "STYLES"),
        ("layers",  "MULTI", "ACCOUNT"),
        ("shield",  "100%",  "LOCAL"),
    ], BRAND)
    save(canvas, "1-hero.png")

def banner_styles():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    # Two rows of keys + their labels need the vertical room, so cap the headline size
    # instead of letting it auto-fit to 150px and push the second row off the canvas.
    content_top = banner_header(canvas, "8 display styles.", "Short-press a key to cycle. Long-press to switch window.",
                                W, max_sz=104)
    CONTENT_H = (H - 170) - content_top
    keys8 = [
        render_ring(42, "5H", "2h 14m"),      render_full(78, "WEEK", "3d"),
        render_bignumber(42, "5H", "2h 14m"),  render_bigtime("2h 14m", "5H"),
        render_countdown(78, "3d", "WEEK"),    render_sparkline(72, "WEEK"),
        render_heatmap(),                       render_status(42, "5H"),
    ]
    labels = ["Ring", "Full", "Big Number", "Big Time", "Countdown", "Sparkline", "Heatmap", "Status"]
    cell_w, cell_h, COLS, KD = 252, 212, 4, 166
    oy = content_top + (CONTENT_H - 2*cell_h)//2; ox = (W - COLS*cell_w)//2
    place_keys(canvas, keys8, COLS, cell_w, cell_h, ox, oy, fnt(20), labels, key_disp=KD)
    add_bottom_bar(canvas, W, H, [
        ("clock",   "LIVE",  "UPDATES"),
        ("palette", "OLED",  "THEMES"),
        ("layers",  "MULTI", "ACCOUNT"),
        ("shield",  "100%",  "LOCAL"),
    ], BRAND)
    save(canvas, "2-styles.png")

def banner_alerts():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "Color shifts as you climb.", "No browser tab to refresh. The key just changes.", W)
    CONTENT_H = (H - 170) - content_top
    vals = [32, 64, 82, 95]; resets = ["3h", "1h 40m", "42m", "12m"]
    ks = 228
    keys = [render_ring(v, "5H", r, show_label=False, pct_max_sz=32).resize((ks, ks), Image.LANCZOS)
            for v, r in zip(vals, resets)]
    names = ["Safe", "Moderate", "Warning", "Critical"]
    descs = ["0-49%, fresh session", "50-74%, pace yourself", "75-84%, wrap it up", "85%+, about to throttle"]
    cell_w = 368; block_h = ks + 58
    oy = content_top + (CONTENT_H - block_h)//2; ox = (W - 4*cell_w)//2
    for i, key in enumerate(keys):
        canvas.alpha_composite(key, dest=(ox + i*cell_w + (cell_w-ks)//2, oy))
    d = ImageDraw.Draw(canvas); f_name = fnt(22); f_desc = fnt(17)
    for i, val in enumerate(vals):
        col = usage_color(val); x = ox + i*cell_w
        nw, _ = txt_size(names[i], f_name); dw, _ = txt_size(descs[i], f_desc)
        d.text((x+(cell_w-nw)//2, oy+ks+14), names[i], font=f_name, fill=(*col, 255))
        d.text((x+(cell_w-dw)//2, oy+ks+42), descs[i], font=f_desc, fill=(140, 145, 165, 220))
    add_bottom_bar(canvas, W, H, [
        ("refresh", "LIVE",  "UPDATES"),
        ("clock",   "RESET", "TIMER"),
        ("palette", "COLOR", "SHIFTS"),
        ("shield",  "100%",  "LOCAL"),
    ], BRAND)
    save(canvas, "3-alerts.png")

def banner_reset():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "Know your reset.", "Down to the minute, always on the key. No mental math.", W)
    CONTENT_H = (H - 170) - content_top
    rkeys = [
        render_bigtime("3h 22m", "5H"),  render_bigtime("1h 40m", "5H"),
        render_bigtime("42m", "5H"),     render_countdown(88, "8m", "5H"),
    ]
    rlabels = ["Plenty of time", "Pace yourself", "Wrap it up", "Final stretch"]
    cell_w, cell_h = 316, 246
    oy = content_top + (CONTENT_H - cell_h)//2; ox = (W - 4*cell_w)//2
    place_keys(canvas, rkeys, 4, cell_w, cell_h, ox, oy, fnt(22), rlabels, key_disp=183)
    add_bottom_bar(canvas, W, H, [
        ("clock",   "RESET", "TIMER"),
        ("refresh", "LIVE",  "SYNC"),
        ("layers",  "8",     "STYLES"),
        ("shield",  "100%",  "LOCAL"),
    ], BRAND)
    save(canvas, "4-reset.png")

def banner_no_switching():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    TOP_H, BOT_H = 76, 170; MAIN_Y = TOP_H; MAIN_H = H - TOP_H - BOT_H
    keys = [
        render_ring(35, "5H", "3h 22m"),   render_ring(72, "5H", "1h 40m"), render_ring(92, "5H", "12m"),
        render_status(35, "5H"),            render_status(72, "5H"),
        render_bignumber(35, "5H", "3h"),   render_bignumber(92, "5H", "12m"),
        render_bigtime("3h 22m", "5H"),     render_bigtime("42m", "5H"),
        render_full(35, "5H", "3h"),        render_full(92, "5H", "12m"),
        render_countdown(72, "1h 40m", "5H"), render_sparkline(72, "WEEK"),
        render_heatmap(),                    render_dual(35, 72),
    ]
    area_w = int(W*0.44); area_x0 = W - 44 - area_w
    area_y0 = MAIN_Y + 16; area_h = MAIN_Y + MAIN_H - area_y0 - 16
    mockup = me.render_straight_device(keys, (area_w, area_h), accent=BRAND)
    deck_x = area_x0 + (area_w - mockup.width)//2
    deck_y = area_y0 + (area_h - mockup.height)//2
    canvas.alpha_composite(mockup, dest=(deck_x, deck_y))
    text_x = 70; text_max_w = deck_x - text_x - 60
    title_y = MAIN_Y + 70
    h1 = add_gradient_title(canvas, "Stop checking", text_x, title_y, text_max_w, BRAND)
    h2 = add_gradient_title(canvas, "the browser.", text_x, title_y + h1 + 8, text_max_w, BRAND, white=True)
    sub_y = title_y + h1 + 8 + h2 + 28
    d = ImageDraw.Draw(canvas)
    d.text((text_x, sub_y), "Mid-prompt, not sure if you have headroom?", fill=(155, 165, 200, 200), font=fnt(26))
    d.text((text_x, sub_y+40), "Look down. Done.", fill=(200, 210, 240, 220), font=fnt(26))
    by2 = sub_y + 100
    for bline in ["Glanceable limits on every key.",
                  "Green when safe, red when critical.",
                  "Resets tick down in real time."]:
        d.ellipse([(text_x, by2+8), (text_x+8, by2+16)], fill=(*BRAND, 210))
        d.text((text_x+18, by2), bline, fill=(185, 195, 220, 200), font=fnt(22)); by2 += 36
    add_bottom_bar(canvas, W, H, [
        ("refresh", "ZERO",  "SWITCHING"),
        ("clock",   "RESET", "VISIBLE"),
        ("palette", "8",     "STYLES"),
        ("shield",  "100%",  "LOCAL"),
    ], BRAND)
    save(canvas, "5-no-switching.png")

def banner_every_limit():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "Every limit. One glance.",
                                "Session, weekly, premium model weekly and extra credits.", W)
    CONTENT_H = (H - 170) - content_top
    wkeys = [
        render_ring(72, "5H", "1h 40m"),  render_ring(35, "WEEK", "3d"),
        render_ring(58, "FABLE", "3d"),   render_bignumber(24, "EXTRA", ""),
        render_dual(72, 35),
    ]
    wlabels = ["5-Hour Session", "Weekly Total", "Fable Weekly", "Extra Credits", "Overview"]
    cell_w, cell_h = 326, 228
    oy = content_top + (CONTENT_H - cell_h)//2; ox = (W - 5*cell_w)//2
    place_keys(canvas, wkeys, 5, cell_w, cell_h, ox, oy, fnt(22), wlabels, key_disp=183)
    add_bottom_bar(canvas, W, H, [
        ("clock",     "5-HOUR", "SESSION"),
        ("refresh",   "WEEKLY", "TOTAL"),
        ("chart-bar", "FABLE",  "WEEKLY"),
        ("shield",    "LIVE",   "SYNC"),
    ], BRAND)
    save(canvas, "6-every-limit.png")

def banner_multi_account():
    W, H = 1920, 960; canvas = make_canvas(W, H, BRAND)
    content_top = banner_header(canvas, "Work. Personal. Client.", "Named accounts on every key. Never mix them up.", W)
    CONTENT_H = (H - 170) - content_top
    ks = 230
    acct_keys = [
        render_ring(42, "WORK", "2h 14m").resize((ks, ks), Image.LANCZOS),
        render_ring(78, "PERSONAL", "1h 40m").resize((ks, ks), Image.LANCZOS),
        render_ring(28, "CLIENT", "3h 45m").resize((ks, ks), Image.LANCZOS),
        render_ring(95, "TEAM", "12m").resize((ks, ks), Image.LANCZOS),
    ]
    acct_labels = ["Work Account", "Personal Account", "Client Account", "Team Account"]
    acct_colors = [usage_color(42), usage_color(78), usage_color(28), usage_color(95)]
    cell_w, cell_h = 370, 264
    oy = content_top + (CONTENT_H - cell_h)//2; ox = (W - 4*cell_w)//2
    place_keys(canvas, acct_keys, 4, cell_w, cell_h, ox, oy, fnt(22), acct_labels, acct_colors, key_disp=ks)
    add_bottom_bar(canvas, W, H, [
        ("people",  "NAMED",   "ACCOUNTS"),
        ("layers",  "PER-KEY", "SETTINGS"),
        ("palette", "SHARED",  "STYLES"),
        ("shield",  "100%",    "LOCAL"),
    ], BRAND)
    save(canvas, "7-multi-account.png")

# ═══════════════════════════════════════════════════════════════════════════════
# VIDEO
# ═══════════════════════════════════════════════════════════════════════════════

def gen_video():
    W, H = 1200, 630; FPS_MS = 60; TOP_H = 80; frames = []
    TARGETS = [72, 35, 95]; VLABELS = ["5H", "WEEK", "5H"]; VRESETS = ["1h 40m", "3d", "12m"]
    ALL_PHASES = ["Fill", "Limits", "Ring", "Big Number", "Countdown", "Status"]

    CAROUSEL = [
        ("Limits", "Session, weekly and Fable, side by side",
         render_ring(72, "5H", "1h 40m"), render_ring(35, "WEEK", "3d"), render_ring(58, "FABLE", "3d")),
        ("Ring", "Circular gauge, arc fills as you use more",
         render_ring(72, "5H", "1h 40m"), render_ring(35, "WEEK", "3d"), render_ring(95, "5H", "12m")),
        ("Big Number", "Giant percentage, cleanest glance",
         render_bignumber(72, "5H", "1h 40m"), render_bignumber(35, "WEEK", "3d"), render_bignumber(95, "5H", "12m")),
        ("Countdown", "Time left, front and center",
         render_countdown(72, "1h 40m", "5H"), render_bigtime("3d", "WEEK"), render_countdown(95, "12m", "5H")),
        ("Status", "Word plus color, fastest read",
         render_status(72, "5H"), render_status(35, "WEEK"), render_status(95, "5H")),
    ]

    def draw_canvas(k1, k2, k3, phase_name, desc, key_sub=None):
        canvas = Image.new("RGBA", (W, H), (*BG, 255))
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse([(-100, 100), (W+100, H-50)], fill=(*BRAND, 30))
        glow = glow.filter(ImageFilter.GaussianBlur(120))
        canvas = Image.alpha_composite(canvas, glow)
        d = ImageDraw.Draw(canvas); d.rectangle([(0, 0), (W, TOP_H)], fill=(*BG, 255))
        _grad_line(canvas, TOP_H-1, 0, W, (*BRAND, 180))
        lx = 18; icon_sz = 48
        if os.path.exists(ICON_PATH):
            try:
                ico = Image.open(ICON_PATH).convert("RGBA").resize((icon_sz, icon_sz), Image.LANCZOS)
                canvas.alpha_composite(ico, dest=(lx, (TOP_H-icon_sz)//2)); lx += icon_sz + 12
            except Exception: pass
        d = ImageDraw.Draw(canvas)
        f_title = fnt(26); f_sub2 = fnt(14)
        bb = d.textbbox((0, 0), PLUGIN_NAME, font=f_title)
        ty = (TOP_H-(bb[3]-bb[1]))//2 - bb[1]
        d.text((lx, ty), PLUGIN_NAME, font=f_title, fill=(210, 220, 240, 220))
        d.text((lx, ty+(bb[3]-bb[1])+2), "by Ratpack", font=f_sub2, fill=(120, 130, 160, 180))
        f_pn = fnt(20); pnw, _ = txt_size(phase_name, f_pn)
        d.text((W-pnw-20, (TOP_H-20)//2), phase_name, font=f_pn, fill=(*BRAND, 210))
        ksz = 168; gap = 32; total_kw = 3*ksz + 2*gap; kx = (W-total_kw)//2; ky = TOP_H + 40
        for key in [k1, k2, k3]:
            canvas.alpha_composite(key.resize((ksz, ksz), Image.LANCZOS), dest=(kx, ky)); kx += ksz + gap
        if key_sub:
            kx2 = (W-total_kw)//2; f_sub3 = fnt(15)
            for lbl in key_sub:
                lw3, _ = txt_size(lbl, f_sub3)
                d.text((kx2+(ksz-lw3)//2, ky+ksz+12), lbl, font=f_sub3, fill=(110, 120, 150, 200))
                kx2 += ksz + gap
        f_desc = fnt(21); dw, _ = txt_size(desc, f_desc)
        d.text(((W-dw)//2, ky+ksz+(40 if key_sub else 18)), desc, font=f_desc, fill=(155, 165, 200, 220))
        dot_y = H-32; dot_r = 6; total_dot = len(ALL_PHASES)*(dot_r*2+10) - 10
        dx = (W-total_dot)//2
        for ph in ALL_PHASES:
            fc = (*BRAND, 255) if ph == phase_name else (70, 80, 105, 200)
            d.ellipse([(dx, dot_y-dot_r), (dx+dot_r*2, dot_y+dot_r)], fill=fc)
            dx += dot_r*2 + 10
        hint = "Short-press any key to cycle styles"; hw2, _ = txt_size(hint, fnt(13))
        d.text(((W-hw2)//2, H-20), hint, font=fnt(13), fill=(70, 80, 105, 180))
        return canvas.convert("RGB")

    print("  Rendering fill + carousel GIF...")
    FILL_F = 24
    for fi in range(FILL_F):
        t = 1-(1-fi/max(FILL_F-1, 1))**2; tf = min(t*0.98+0.02, 1.0)
        k1 = render_ring(TARGETS[0]*tf, VLABELS[0], VRESETS[0] if tf >= 0.99 else None)
        k2 = render_full(TARGETS[1]*tf, VLABELS[1], VRESETS[1] if tf >= 0.99 else None)
        k3 = render_bignumber(TARGETS[2]*tf, VLABELS[2], VRESETS[2] if tf >= 0.99 else None)
        frames.append(draw_canvas(k1, k2, k3, "Fill", "Three styles, filling to your live limits",
                                  ["Ring", "Full", "Big Number"]))
    k1f = render_ring(TARGETS[0], VLABELS[0], VRESETS[0])
    k2f = render_full(TARGETS[1], VLABELS[1], VRESETS[1])
    k3f = render_bignumber(TARGETS[2], VLABELS[2], VRESETS[2])
    for _ in range(8):
        frames.append(draw_canvas(k1f, k2f, k3f, "Fill", "Three styles, filling to your live limits",
                                  ["Ring", "Full", "Big Number"]))
    for sn, sd, ck1, ck2, ck3 in CAROUSEL:
        for _ in range(11): frames.append(draw_canvas(ck1, ck2, ck3, sn, sd))

    gif_path = os.path.join(OUT_DIR, "preview.gif")
    frames[0].save(gif_path, save_all=True, append_images=frames[1:], duration=FPS_MS, loop=0, optimize=False)
    print("> preview.gif (%d frames @ %dms = %.1fs loop)" % (len(frames), FPS_MS, len(frames)*FPS_MS/1000))
    mp4_path = os.path.join(OUT_DIR, "preview.mp4")
    try:
        subprocess.run(["ffmpeg", "-i", gif_path,
                        "-vf", "scale=1920:1008:flags=lanczos,pad=1920:1080:0:36:black",
                        "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", "-y", mp4_path],
                       check=True, capture_output=True)
        print("> preview.mp4 (1920x1080, %.1f MB)" % (os.path.getsize(mp4_path)/1048576))
    except FileNotFoundError:
        print("! ffmpeg not found - GIF written, install ffmpeg for the MP4")
    except subprocess.CalledProcessError as e:
        print("! ffmpeg failed: %s" % e.stderr.decode("utf8", "replace")[-400:])

# ═══════════════════════════════════════════════════════════════════════════════
# DESCRIPTION + LISTING ICON
# ═══════════════════════════════════════════════════════════════════════════════

DESCRIPTION = """Know your Claude usage at a glance. Live limits, themeable, calm by design.

Stop guessing whether you are about to hit a wall mid-prompt. Claude Usage shows your live 5-hour session, weekly and premium-model limits right on your Stream Deck. One glance tells you if you are safe to keep going. No browser tab, no slash commands, no context switching.

Features:

- Live 5-hour session and weekly Claude usage, accurate to your plan

- Separate weekly limit for premium models (Fable, Opus) on Max plans

- Works with Claude Pro, Max, Team, and Enterprise

- 8 display styles: Ring, Full (water fill), Big Number, Big Time, Countdown, Sparkline, Weekly Heatmap, Status

- Colors go green to yellow to red as you approach your limit

- Short-press to cycle style, long-press to switch between 5-hour and weekly

- Multiple named accounts, track Work, Personal, and Client on separate keys

- Live countdown to your next session reset

- 100% local, your session token never leaves your machine

Claude usage monitor, Claude Code limits, 5-hour session, weekly limit, Fable, Opus, Max plan, Stream Deck

----

RELEASE NOTES - v0.1.2

- New: a separate weekly window for premium models, so Max users can watch their Fable or Opus limit alongside the all-models weekly total
- Pick it under Type in the key settings. On plans without a per-model cap the key says so instead of showing a wrong number
- Reads whichever premium model your account actually reports, so it keeps working as Anthropic adds model families
"""

def gen_description():
    with open(os.path.join(OUT_DIR, "description.txt"), "w", encoding="utf8") as f:
        f.write(DESCRIPTION)
    print("> description.txt")
    docs_dir = os.path.join(ROOT_DIR, "docs"); os.makedirs(docs_dir, exist_ok=True)
    with open(os.path.join(docs_dir, "descriptions.md"), "w", encoding="utf8") as f:
        f.write(DESCRIPTION)
    print("> docs/descriptions.md")

def gen_listing_icon():
    if not os.path.exists(ICON_PATH):
        print("! icon.png missing, skipped icon-288x288.png"); return
    Image.open(ICON_PATH).convert("RGBA").resize((288, 288), Image.LANCZOS) \
        .save(os.path.join(OUT_DIR, "icon-288x288.png"))
    print("> icon-288x288.png")

def main():
    print("\nGenerating %s marketing assets -> %s\n" % (PLUGIN_NAME, OUT_DIR))
    banner_hero()
    banner_styles()
    banner_alerts()
    banner_reset()
    banner_no_switching()
    banner_every_limit()
    banner_multi_account()
    gen_description()
    gen_listing_icon()
    gen_video()
    print("\nDone. Open %s to review." % OUT_DIR)

if __name__ == "__main__":
    main()

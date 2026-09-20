# coding: utf-8
"""Claude Usage key faces, mirroring src/render/svg.ts.

This plugin draws its key art at RUNTIME as SVG, so there is no static PNG for
`plugin_key()` to read off disk. These renderers are the mirror instead, and they
are the single source of truth for any listing art.

Imported by ratpack-projects/profiles/_build/gen_marketing.py (the /rat-art
pipeline). Do not draw banners here - banner layout belongs to the shared engine.
"""
from marketing_engine import Image, ImageDraw, fnt, txt_size, fit_fnt

KEY_SZ  = 144
FILL_BG = (10, 10, 12)
GREEN   = (48, 226, 123)
YELLOW  = (255, 214, 10)
RED     = (255, 59, 48)


def lerp_color(c1, c2, t):
    return tuple(max(0, min(255, int(c1[i] + (c2[i]-c1[i])*t))) for i in range(3))


def usage_color(used):
    """Matches usageColor() in src/render/themes.ts."""
    u = max(0.0, min(100.0, used))
    if u >= 85: return RED
    if u >= 50: return lerp_color(YELLOW, RED, (u-50)/35)
    return lerp_color(GREEN, YELLOW, u/50)


def usage_word(used):
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


def _c(img, text, y, f, color, shadow=False):
    d = ImageDraw.Draw(img); w, _ = txt_size(text, f); x = (img.width - w)//2
    if shadow: d.text((x+1, y+2), text, font=f, fill=(0, 0, 0, 110))
    d.text((x, y), text, font=f, fill=(*color[:3], 255))


def ring(used, label, reset, show_label=True, pct_max_sz=34):
    color = usage_color(used); img = key_bg()
    cx, cy, r, sw = 72, 57, 48, 11; bbox = [(cx-r, cy-r), (cx+r, cy+r)]
    track = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0))
    ImageDraw.Draw(track).arc(bbox, 0, 360, fill=(255, 255, 255, 28), width=sw)
    img.alpha_composite(track)
    if used > 0.5:
        arc = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0))
        ImageDraw.Draw(arc).arc(bbox, -90, -90+360*min(used/100, 1), fill=(*color, 255), width=sw)
        img.alpha_composite(arc)
    pct = "%d%%" % int(round(used)); _c(img, pct, 40, fit_fnt(pct, 78, pct_max_sz, 14), color)
    if show_label: _c(img, label, 114, fnt(13), (200, 200, 200))
    if reset: _c(img, reset, 129 if show_label else 116, fit_fnt(reset, 88, 14, 10), (255, 255, 255))
    return img


def full(used, label, reset):
    color = usage_color(used); img = key_bg(FILL_BG)
    fill_h = max(1, int(KEY_SZ*used/100)); y0 = KEY_SZ - fill_h
    ov = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for yy in range(y0, KEY_SZ):
        t = (yy-y0)/max(fill_h-1, 1); od.line([(0, yy), (KEY_SZ, yy)], fill=(*color, int(55+110*t)))
    img.alpha_composite(ov)
    if fill_h > 2: ImageDraw.Draw(img).line([(0, y0), (KEY_SZ, y0)], fill=(*color, 200), width=3)
    pct = "%d%%" % int(round(used)); _c(img, pct, 58, fit_fnt(pct, 112, 52, 18), color, shadow=True)
    if reset: _c(img, reset, 118, fnt(12), (255, 255, 255), shadow=True)
    return img


def bignumber(used, label, reset):
    color = usage_color(used); img = key_bg()
    _c(img, label, 16, fnt(12), (180, 180, 180))
    pct = "%d%%" % int(round(used)); _c(img, pct, 48, fit_fnt(pct, 122, 58, 18), color)
    bx, bar_y, bh = 14, 118, 8; bw = KEY_SZ - 2*bx; fw = int(bw*min(used/100, 1))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([(bx, bar_y), (bx+bw, bar_y+bh)], radius=4, fill=(255, 255, 255, 22))
    if fw > 0: d.rounded_rectangle([(bx, bar_y), (bx+fw, bar_y+bh)], radius=4, fill=(*color, 255))
    if reset: _c(img, reset, 131, fnt(10), (160, 160, 160))
    return img


def bigtime(reset, label):
    img = key_bg()
    _c(img, label.upper(), 16, fnt(10), (160, 160, 160))
    _c(img, "RESETS IN", 31, fnt(9), (120, 120, 120))
    _c(img, reset, 82, fit_fnt(reset, 112, 44, 16), (255, 255, 255))
    ImageDraw.Draw(img).rounded_rectangle([(14, 122), (130, 125)], radius=1, fill=(255, 255, 255, 22))
    return img


def countdown(used, reset, label):
    color = usage_color(used); img = key_bg(FILL_BG)
    fill_h = max(1, int(KEY_SZ*used/100)); y0 = KEY_SZ - fill_h
    ov = Image.new("RGBA", (KEY_SZ, KEY_SZ), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for yy in range(y0, KEY_SZ):
        t = (yy-y0)/max(fill_h-1, 1); od.line([(0, yy), (KEY_SZ, yy)], fill=(*color, int(35+80*t)))
    img.alpha_composite(ov)
    if fill_h > 2: ImageDraw.Draw(img).line([(0, y0), (KEY_SZ, y0)], fill=(*color, 160), width=2)
    _c(img, label.upper(), 16, fnt(10), (200, 200, 200), shadow=True)
    _c(img, "TIME LEFT", 29, fnt(9), (160, 160, 160), shadow=True)
    _c(img, reset, 80, fit_fnt(reset, 112, 42, 16), (255, 255, 255), shadow=True)
    return img


def status(used, label):
    color = usage_color(used); img = key_bg(); d = ImageDraw.Draw(img)
    d.rectangle([(0, 0), (KEY_SZ, 10)], fill=(*color, 255))
    _c(img, label.upper(), 26, fnt(12), (160, 160, 160))
    _c(img, usage_word(used), 62, fnt(30), color)
    _c(img, "%d%%" % int(round(used)), 98, fnt(20), (200, 200, 200))
    bx, by, bh = 14, 120, 7; bw = KEY_SZ - 2*bx; fw = int(bw*min(used/100, 1))
    d.rounded_rectangle([(bx, by), (bx+bw, by+bh)], radius=3, fill=(255, 255, 255, 22))
    if fw > 0: d.rounded_rectangle([(bx, by), (bx+fw, by+bh)], radius=3, fill=(*color, 255))
    return img


_SERIES = [18, 28, 35, 42, 51, 45, 38, 58, 72, 68, 55, 65, 78, 72]
def sparkline(used, label, series=None):
    series = series or _SERIES
    color = usage_color(used); img = key_bg(); d = ImageDraw.Draw(img)
    _c(img, label, 14, fnt(11), (160, 160, 160))
    pct = "%d%%" % int(round(used)); pw, _ = txt_size(pct, fnt(12))
    d.text((KEY_SZ-14-pw, 10), pct, font=fnt(12), fill=(*color, 255))
    ox, oy, cw, ch = 10, 28, 124, 76; mx = max(series+[1])
    pts = [(int(ox + i/max(len(series)-1, 1)*cw), int(oy + ch*(1 - v/mx))) for i, v in enumerate(series)]
    for i in range(len(pts)-1): d.line([pts[i], pts[i+1]], fill=(*color, 200), width=2)
    if pts:
        lx, ly = pts[-1]; d.ellipse([(lx-4, ly-4), (lx+4, ly+4)], fill=(*color, 255))
    _c(img, "24h history", 128, fnt(9), (120, 120, 120))
    return img


_HEAT = [45, 60, 35, 80, 55, 88, 72]
def heatmap(cells=None, label="7D"):
    cells = cells or _HEAT
    img = key_bg(); d = ImageDraw.Draw(img)
    _c(img, label, 18, fnt(12), (160, 160, 160))
    _c(img, "7-DAY HISTORY", 34, fnt(9), (100, 100, 100))
    days = ["M", "T", "W", "T", "F", "S", "S"]; cw, gap = 14, 4
    ox = (KEY_SZ - (len(days)*(cw+gap) - gap))//2
    for i, v in enumerate(cells):
        x = ox + i*(cw+gap)
        col = (255, 255, 255, 28) if v is None else (*usage_color(v), int(60+160*(v/100)))
        d.rounded_rectangle([(x, 66), (x+cw, 66+cw)], radius=3, fill=col)
        if i == len(cells)-1:
            dc = usage_color(v) if v else (255, 255, 255)
            d.rounded_rectangle([(x-2, 64), (x+cw+2, 68+cw)], radius=4, outline=(*dc, 200), width=1)
        fw, _ = txt_size(days[i], fnt(8))
        d.text((x+(cw-fw)//2, 86), days[i], font=fnt(8), fill=(100, 100, 100, 255))
    _c(img, "today", 126, fnt(9), (100, 100, 100))
    return img


def dual(a_used, b_used):
    img = key_bg(); d = ImageDraw.Draw(img)
    _c(img, "OVERVIEW", 18, fnt(10), (140, 140, 140))
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


_ROLLUP = [("CLAUDE", 42), ("GPT", 78), ("CODEX", 25), ("CURSOR", 61),
           ("GEMINI", 88), ("COPILOT", 12), ("GROK", 55), ("PPLX", 33)]


def rollup(cells=None):
    """Mirrors renderRollup() in src/render/svg.ts: one bar per switched-on provider.

    A cell whose usage is None is a provider with no reading right now; it dims to
    "--" instead of guessing a number, which is what the key really does.
    """
    cells = _ROLLUP if cells is None else cells
    img = key_bg(); d = ImageDraw.Draw(img)
    n = len(cells)
    cols = 2 if n > 4 else 1
    rows = -(-n // cols)
    pad_x, gap_x = 9, 7
    cell_w = (KEY_SZ - 2*pad_x - (cols-1)*gap_x)//cols
    row_h = min(34, 132//rows)
    top = (KEY_SZ - rows*row_h)//2
    fs = 10 if cols == 2 else 15
    bar_h = 5 if cols == 2 else 8
    suffix = "" if cols == 2 else "%"
    f = fnt(fs)
    for i, (label, used) in enumerate(cells):
        x = pad_x + (i % cols)*(cell_w + gap_x)
        y = top + (i//cols)*row_h
        val = "--" if used is None else "%d%s" % (int(round(used)), suffix)
        color = (120, 120, 120) if used is None else usage_color(used)
        vw, _ = txt_size(val, f)
        d.text((x, y), label, font=f, fill=(170, 170, 170, 255))
        d.text((x + cell_w - vw, y), val, font=f, fill=(*color, 255))
        by = y + fs + 4
        d.rounded_rectangle([(x, by), (x+cell_w, by+bar_h)], radius=bar_h//2,
                            fill=(255, 255, 255, 22))
        if used:
            fw = max(3, int(cell_w*min(used/100, 1)))
            d.rounded_rectangle([(x, by), (x+fw, by+bar_h)], radius=bar_h//2,
                                fill=(*color, 255))
    return img


def spec(img, label=None):
    """Wrap a rendered face as an engine key spec (same shape as plugin_key)."""
    return {"kind": "image", "img": img, "label": label}

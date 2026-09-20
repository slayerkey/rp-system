# coding: utf-8
#!/usr/bin/env python3
"""
Marketplace art generator for ratpack-kick (Kick Stats Stream Deck plugin).
Outputs 1920x960 banners, a preview GIF, and preview.mp4 to scripts/output/marketing/.
"""
import os, sys, subprocess, math, re
from typing import List, Optional, Tuple

def ensure_deps():
    need = []
    for mod, pkg in [("PIL","Pillow>=10.3.0"),("numpy","numpy")]:
        try: __import__(mod)
        except: need.append(pkg)
    if need:
        subprocess.check_call([sys.executable,"-m","pip","install",*need])
ensure_deps()

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

# ── Brand colors ────────────────────────────────────────────────────────────────
KICK_GREEN = (83, 252, 24)      # #53FC18 — Kick brand green
KICK_DIM   = (55, 160, 16)      # darker green for subtitles
BRAND      = KICK_GREEN
GREEN      = (48, 226, 123)
YELLOW     = (255, 214, 10)
RED        = (255, 59, 48)
BG         = (6, 8, 8)          # true dark canvas
FILL_BG    = (10, 11, 11)
KEY_BG_C   = (11, 11, 14)       # key background
DIM_C      = (90, 110, 90)      # dim text on keys
SUB_C      = (140, 160, 140)    # subtitle text on keys
KEY_SZ     = 144

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
OUT_DIR    = os.path.join(SCRIPT_DIR, "output", "marketing")
# Brand icon: use assets/brand-icon.png (copy of ratpack-profiles/icon.png).
# Source of truth: C:\Users\Key\Videos\Claude Projects\ratpack-profiles\icon.png
ICON_PATH  = os.path.join(ROOT_DIR, "assets", "brand-icon.png")
ICON_TTF   = os.path.join(ROOT_DIR, "assets", "icons", "tabler-icons.ttf")
ICON_CSS   = os.path.join(ROOT_DIR, "assets", "icons", "tabler-icons.css")
BRAND_NAME = "Ratpack"
os.makedirs(OUT_DIR, exist_ok=True)

# ── Kick logo polygon (from SimpleIcons, 24x24 viewBox) ──────────────────────
KICK_POLY_NORM = [
    (1.333,0),(9.333,0),(9.333,5.333),(12,5.333),(12,2.667),
    (14.667,2.667),(14.667,0),(22.667,0),(22.667,8),(20,8),
    (20,10.667),(17.333,10.667),(17.333,13.333),(20,13.333),
    (20,16),(22.667,16),(22.667,24),(14.667,24),(14.667,21.333),
    (12,21.333),(12,18.667),(9.333,18.667),(9.333,24),(1.333,24),
]

def draw_kick_logo(draw, cx, cy, size, color=KICK_GREEN):
    scale = size / 24.0
    # center the 24x24 logo
    ox = cx - size / 2
    oy = cy - size / 2
    pts = [(ox + x * scale, oy + y * scale) for (x, y) in KICK_POLY_NORM]
    draw.polygon(pts, fill=(*color, 255))

# ── Tabler icon helper ──────────────────────────────────────────────────────────
_ICON_MAP = None
def _get_icon_map():
    global _ICON_MAP
    if _ICON_MAP is not None: return _ICON_MAP
    _ICON_MAP = {}
    try:
        css = open(ICON_CSS, encoding="utf-8").read()
        for name, code in re.findall(r'\.ti-([a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"', css, re.S):
            _ICON_MAP[name] = chr(int(code, 16))
    except Exception as e:
        print(f"  [warn] icon CSS not loaded: {e}")
    return _ICON_MAP

def icon_img(name, size, color=(245, 250, 248)):
    ch = _get_icon_map().get(name)
    if not ch or not os.path.exists(ICON_TTF):
        return None
    pad = int(size * 0.16)
    box = size + pad * 2
    img = Image.new("RGBA", (box, box), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((box/2, box/2), ch,
        font=ImageFont.truetype(ICON_TTF, size),
        fill=(*color[:3], 255), anchor="mm")
    return img

# ── Fonts ───────────────────────────────────────────────────────────────────────
_FP = None
def get_fp():
    global _FP
    if _FP is not None: return _FP
    for p in [
        r"C:\Windows\Fonts\Montserrat-Bold.ttf",
        r"C:\Windows\Fonts\Montserrat-SemiBold.ttf",
        r"C:\Windows\Fonts\Inter-Bold.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
    ]:
        if os.path.exists(p): _FP = p; return p
    return None

def fnt(size):
    fp = get_fp()
    try: return ImageFont.truetype(fp, size) if fp else ImageFont.load_default()
    except: return ImageFont.load_default()

_DI = Image.new("L",(1,1)); _DD = ImageDraw.Draw(_DI)
def txt_sz(text, f):
    bb = _DD.textbbox((0,0), text, font=f)
    return bb[2]-bb[0], bb[3]-bb[1]

def fit_fnt(text, max_w, max_sz, min_sz=14):
    for sz in range(max_sz, min_sz-1, -2):
        f = fnt(sz)
        if txt_sz(text, f)[0] <= max_w: return f
    return fnt(min_sz)

def draw_c(img, text, y, f, color, shadow=False):
    d = ImageDraw.Draw(img)
    w, _ = txt_sz(text, f)
    x = (img.width - w) // 2
    if shadow: d.text((x+1, y+2), text, font=f, fill=(0,0,0,110))
    d.text((x, y), text, font=f, fill=(*color[:3], 255))

# ── Canvas builder ──────────────────────────────────────────────────────────────
W, H = 1920, 960

def make_canvas(accent=BRAND):
    canvas = Image.new("RGBA", (W, H), (*BG, 255))
    ImageDraw.Draw(canvas).rectangle([(0,76),(W,H-170)], fill=(6,8,8,255))
    # green glow upper-right
    glow = Image.new("RGBA", (W, H), (0,0,0,0))
    ImageDraw.Draw(glow).ellipse([(W//2+100, -80),(W+300, H//2+100)], fill=(*accent, 35))
    glow = glow.filter(ImageFilter.GaussianBlur(200))
    canvas = Image.alpha_composite(canvas, glow)
    # subtle center glow
    glow2 = Image.new("RGBA", (W, H), (0,0,0,0))
    ImageDraw.Draw(glow2).ellipse([(W//2-400, H//4),(W//2+400, H*3//4)], fill=(*accent, 12))
    glow2 = glow2.filter(ImageFilter.GaussianBlur(160))
    canvas = Image.alpha_composite(canvas, glow2)
    # vignette
    vign = Image.new("RGBA", (W, H), (0,0,0,0))
    vd = ImageDraw.Draw(vign)
    for r2 in range(max(W,H)//2, 0, -16):
        t = r2/(max(W,H)/2); a = int(70*t**2.5)
        if a > 0: vd.ellipse([(W//2-r2,H//2-r2),(W//2+r2,H//2+r2)], fill=(0,0,0,a))
    canvas = Image.alpha_composite(canvas, vign)
    _top_bar(canvas, accent)
    return canvas

def _grad_line(canvas, y, x0, x1, color):
    r,g,b,a = color; ww = x1-x0
    ln = Image.new("RGBA", (ww, 2), (0,0,0,0)); px = ln.load()
    for xi in range(ww):
        t = xi/max(ww-1,1); fade = (1-abs(t-0.5)*2)**0.5; al = int(a*fade)
        px[xi,0] = px[xi,1] = (r,g,b,al)
    canvas.alpha_composite(ln, dest=(x0, y-1))

def _top_bar(canvas, accent=BRAND):
    TOP_H = 76
    d = ImageDraw.Draw(canvas)
    d.rectangle([(0,0),(W,TOP_H)], fill=(*BG, 255))
    _grad_line(canvas, TOP_H-2, 0, W, (*accent, 200))
    lx = 16
    icon_sz = int((TOP_H-8)*1.2)
    if os.path.exists(ICON_PATH):
        try:
            ico = Image.open(ICON_PATH).convert("RGBA").resize((icon_sz, icon_sz), Image.LANCZOS)
            canvas.alpha_composite(ico, dest=(lx, (TOP_H-icon_sz)//2))
            lx += icon_sz + 14
        except: pass
    d = ImageDraw.Draw(canvas)
    f_brand = fnt(26)
    bb = d.textbbox((0,0), BRAND_NAME, font=f_brand)
    d.text((lx-bb[0], (TOP_H-(bb[3]-bb[1]))//2 - bb[1]), BRAND_NAME, fill=(210,225,210,230), font=f_brand)
    # right side slash motif
    d.text((W-170, (TOP_H-20)//2), "///", fill=(*accent, 100), font=fnt(18))
    d.line([(W-110, TOP_H//2),(W-28, TOP_H//2)], fill=(*accent, 60), width=1)

def add_bottom_bar(canvas, features, accent=BRAND):
    BOT_H = 170; BOT_Y = H - BOT_H
    d = ImageDraw.Draw(canvas)
    d.rectangle([(0, BOT_Y),(W, H)], fill=(*BG, 255))
    _grad_line(canvas, BOT_Y+4, 0, W, (*accent, 200))
    n = len(features); tile_w = W // n
    for i, (ikind, la, lb) in enumerate(features):
        tx = i * tile_w
        if i > 0: d.line([(tx, BOT_Y+20),(tx, H-20)], fill=(255,255,255,15), width=1)
        isz = 52; pad = 24; gap = 10
        avail_w = tile_w - 2*pad - isz - 18
        f_sm = fit_fnt(la, avail_w, 18, 11)
        f_big = fit_fnt(lb, avail_w, 34, 14)
        la_bb = d.textbbox((0,0), la, font=f_sm)
        lb_bb = d.textbbox((0,0), lb, font=f_big)
        la_h = la_bb[3]-la_bb[1]; lb_h = lb_bb[3]-lb_bb[1]
        total_h = la_h + gap + lb_h
        gx = tx + pad
        ty0 = BOT_Y + 20 + (BOT_H-20-total_h)//2
        icon_cy = ty0 + total_h//2 - isz//2
        # draw tabler icon or fallback to kick logo for "kick" kind
        ico = icon_img(ikind, isz-8, (*accent, 210))
        if ico:
            canvas.alpha_composite(ico, dest=(gx, icon_cy))
        else:
            _draw_btm_shape(d, ikind, gx, icon_cy, isz, (*accent, 210))
        tfx = gx + isz + 18
        d.text((tfx-la_bb[0], ty0-la_bb[1]), la, fill=(*accent, 190), font=f_sm)
        d.text((tfx-lb_bb[0], ty0+la_h+gap-lb_bb[1]), lb, fill=(230,240,230,255), font=f_big)

def _draw_btm_shape(d, kind, x, y, sz, col):
    if kind == "clock":
        r2 = sz//2-3; cx,cy = x+sz//2, y+sz//2
        d.ellipse([(cx-r2,cy-r2),(cx+r2,cy+r2)], outline=col, width=2)
        d.line([(cx,cy),(cx,cy-r2+6)], fill=col, width=3)
        d.line([(cx,cy),(cx+r2-8,cy+4)], fill=col, width=2)
    elif kind == "star":
        cx,cy = x+sz//2, y+sz//2; r_out=sz//2-3; r_in=r_out//2; pts=[]
        for i in range(10):
            a = math.radians(-90+i*36); r = r_out if i%2==0 else r_in
            pts.append((cx+r*math.cos(a), cy+r*math.sin(a)))
        d.polygon(pts, fill=col)
    else:
        d.rounded_rectangle([(x+4,y+4),(x+sz-4,y+sz-4)], radius=6, outline=col, width=2)

# ── Key drawing helpers ─────────────────────────────────────────────────────────
def key_bg(size=KEY_SZ, bg=None):
    c = bg or KEY_BG_C
    img = Image.new("RGBA", (size, size), (0,0,0,0))
    ImageDraw.Draw(img).rounded_rectangle([(0,0),(size-1,size-1)], radius=12, fill=(*c, 255))
    return img

def place_keys(canvas, keys, cols, cell_w, cell_h, ox, oy, key_disp=None,
               labels=None, label_f=None, label_color=None, sub_labels=None, sub_f=None):
    ksz = key_disp or KEY_SZ
    for i, key in enumerate(keys):
        row, col = divmod(i, cols)
        x = ox + col*cell_w + (cell_w-ksz)//2
        y = oy + row*cell_h + (cell_h-ksz)//2
        k = key.resize((ksz, ksz), Image.LANCZOS) if key.size != (ksz, ksz) else key
        canvas.alpha_composite(k, dest=(x, y))
        if label_f and labels and i < len(labels):
            lbl = labels[i]; lw,_ = txt_sz(lbl, label_f)
            lc = label_color[i] if isinstance(label_color, list) and i < len(label_color) else (label_color or (160,170,160))
            ImageDraw.Draw(canvas).text((x+(ksz-lw)//2, y+ksz+10), lbl, font=label_f, fill=(*lc[:3],220))
        if sub_f and sub_labels and i < len(sub_labels):
            sl = sub_labels[i]; sw,_ = txt_sz(sl, sub_f)
            lh = txt_sz(labels[i] if labels else "", label_f or fnt(1))[1] if labels else 0
            ImageDraw.Draw(canvas).text((x+(ksz-sw)//2, y+ksz+14+lh), sl, font=sub_f, fill=(100,120,100,180))

def add_gradient_title(canvas, text, x, y, max_w, accent=BRAND):
    d = ImageDraw.Draw(canvas)
    f = fit_fnt(text, d if False else max_w, 160, 52)
    for sz in range(160, 52-1, -4):
        ff = fnt(sz)
        if txt_sz(text, ff)[0] <= max_w: f = ff; break
    bb = d.textbbox((0,0), text, font=f)
    pw, ph = bb[2]-bb[0], bb[3]-bb[1]
    top = (min(255,accent[0]+80), min(255,accent[1]+50), min(255,accent[2]+50))
    bot = accent
    gl = Image.new("RGBA", (pw, ph), (0,0,0,0))
    gd = ImageDraw.Draw(gl)
    for yy in range(ph):
        t = (yy/max(ph-1,1))**1.5
        c = tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(3))
        gd.line([(0,yy),(pw,yy)], fill=(*c,255))
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).text((-bb[0],-bb[1]), text, fill=255, font=f)
    gl.putalpha(mask)
    shd = Image.new("RGBA", (pw+8, ph+8), (0,0,0,0))
    ImageDraw.Draw(shd).text((-bb[0]+3,-bb[1]+4), text, fill=(0,0,0,100), font=f)
    shd = shd.filter(ImageFilter.GaussianBlur(5))
    canvas.alpha_composite(shd, dest=(x, y))
    canvas.alpha_composite(gl, dest=(x, y))
    return ph

# ── Key renderers (simulate ratpack-kick display modes) ─────────────────────────
def key_followers(value_str="48.2K", label="FOLLOWERS", channel="@xqc"):
    img = key_bg()
    d = ImageDraw.Draw(img)
    f_label = fnt(14); f_val = fnt(36); f_ch = fnt(10)
    lw,_ = txt_sz(label, f_label); vw,_ = txt_sz(value_str, f_val); cw,_ = txt_sz(channel, f_ch)
    d.text(((KEY_SZ-lw)//2, 22), label, fill=(*SUB_C,255), font=f_label)
    d.text(((KEY_SZ-vw)//2, 58), value_str, fill=(*KICK_GREEN,255), font=f_val)
    d.text(((KEY_SZ-cw)//2, 122), channel, fill=(*DIM_C,255), font=f_ch)
    return img

def key_big_number(value_str, label, channel="", val_color=KICK_GREEN, bar_pct=None):
    img = key_bg()
    d = ImageDraw.Draw(img)
    f_label = fnt(13); f_ch = fnt(10)
    f_val = fit_fnt(value_str, KEY_SZ-16, 44, 20)
    lw,_ = txt_sz(label, f_label); vw,_ = txt_sz(value_str, f_val)
    d.text(((KEY_SZ-lw)//2, 22), label, fill=(*SUB_C,255), font=f_label)
    d.text(((KEY_SZ-vw)//2, 54), value_str, fill=(*val_color,255), font=f_val)
    if bar_pct is not None:
        bar_w = int(120 * bar_pct)
        d.rounded_rectangle([(12,110),(132,118)], radius=4, fill=(*DIM_C,80))
        if bar_w > 0:
            d.rounded_rectangle([(12,110),(12+bar_w,118)], radius=4, fill=(*KICK_GREEN,220))
    if channel:
        cw,_ = txt_sz(channel, f_ch)
        d.text(((KEY_SZ-cw)//2, 124 if bar_pct is None else 126), channel, fill=(*DIM_C,255), font=f_ch)
    return img

def key_live(viewers="1,247", duration="01:23", peak="1,891", channel="@xqc"):
    img = key_bg()
    d = ImageDraw.Draw(img)
    # live dot (green)
    d.ellipse([(10,10),(22,22)], fill=(*KICK_GREEN,255))
    f_live = fnt(12); f_dur = fnt(11); f_val = fnt(34); f_sub = fnt(11); f_ch = fnt(10)
    live_txt = f"LIVE  {duration}"
    lw,_ = txt_sz(live_txt, f_live)
    d.text((28, 13), live_txt, fill=(*KICK_GREEN,230), font=f_live)
    vw,_ = txt_sz(viewers, f_val)
    d.text(((KEY_SZ-vw)//2, 48), viewers, fill=(*KICK_GREEN,255), font=f_val)
    sub = "VIEWERS"; sw,_ = txt_sz(sub, f_sub)
    d.text(((KEY_SZ-sw)//2, 90), sub, fill=(*SUB_C,255), font=f_sub)
    pk = f"Peak: {peak}"; pw,_ = txt_sz(pk, f_ch)
    d.text(((KEY_SZ-pw)//2, 110), pk, fill=(*DIM_C,255), font=f_ch)
    cw,_ = txt_sz(channel, f_ch)
    d.text(((KEY_SZ-cw)//2, 126), channel, fill=(*DIM_C,200), font=f_ch)
    return img

def key_milestone(current=48200, target=50000, channel="@xqc"):
    img = key_bg()
    d = ImageDraw.Draw(img)
    pct = current / target
    f_h = fnt(13); f_val = fnt(26); f_sub = fnt(11); f_ch = fnt(10)
    header = f"TO: {target//1000}K"
    hw,_ = txt_sz(header, f_h)
    d.text(((KEY_SZ-hw)//2, 18), header, fill=(*SUB_C,255), font=f_h)
    val_str = f"{current//1000}.{(current%1000)//100}K"
    vw,_ = txt_sz(val_str, f_val)
    d.text(((KEY_SZ-vw)//2, 44), val_str, fill=(*KICK_GREEN,255), font=f_val)
    bar_w = int(120 * pct)
    d.rounded_rectangle([(12,80),(132,90)], radius=5, fill=(*DIM_C,60))
    if bar_w > 0:
        d.rounded_rectangle([(12,80),(12+bar_w,90)], radius=5, fill=(*KICK_GREEN,230))
    away = target-current; away_str = f"{away//1000}.{(away%1000)//100}K away"
    aw,_ = txt_sz(away_str, f_sub)
    d.text(((KEY_SZ-aw)//2, 96), away_str, fill=(*SUB_C,230), font=f_sub)
    eta = "~9 days"; ew,_ = txt_sz(eta, f_sub)
    d.text(((KEY_SZ-ew)//2, 112), eta, fill=(*DIM_C,200), font=f_sub)
    cw,_ = txt_sz(channel, f_ch)
    d.text(((KEY_SZ-cw)//2, 128), channel, fill=(*DIM_C,180), font=f_ch)
    return img

def key_trend(delta_str="+312", arrow="up", values=None, channel="@xqc"):
    img = key_bg()
    d = ImageDraw.Draw(img)
    if values is None:
        values = [41200,41800,42100,42500,43000,43800,44200,45100,45900,46700,47400,48200]
    label = "FOLLOWERS 7-DAY"; lw,_ = txt_sz(label, fnt(10))
    d.text(((KEY_SZ-lw)//2, 16), label, fill=(*SUB_C,200), font=fnt(10))
    arrow_color = KICK_GREEN if arrow=="up" else RED
    delta_color = KICK_GREEN if arrow=="up" else RED
    f_delta = fit_fnt(delta_str, 96, 30, 18)
    dw,_ = txt_sz(delta_str, f_delta)
    d.text((10, 40), delta_str, fill=(*delta_color,255), font=f_delta)
    # arrow symbol
    arrow_sym = "↑" if arrow=="up" else "↓"
    af = fnt(28)
    aw,_ = txt_sz(arrow_sym, af)
    d.text((KEY_SZ-aw-10, 38), arrow_sym, fill=(*arrow_color,255), font=af)
    # sparkline
    n = len(values); x0,x1,y_top,y_bot = 10,134,88,126
    mn,mx = min(values),max(values); rng = max(1,mx-mn)
    pts = [(x0+(x1-x0)*i/(n-1), y_top+(y_bot-y_top)*(1-(v-mn)/rng)) for i,v in enumerate(values)]
    line_color = KICK_GREEN if arrow=="up" else RED
    for i in range(len(pts)-1):
        d.line([pts[i],pts[i+1]], fill=(*line_color,180), width=2)
    d.ellipse([(pts[-1][0]-3,pts[-1][1]-3),(pts[-1][0]+3,pts[-1][1]+3)], fill=(*line_color,255))
    f_ch = fnt(10); cw,_ = txt_sz(channel, f_ch)
    d.text(((KEY_SZ-cw)//2, 130), channel, fill=(*DIM_C,180), font=f_ch)
    return img

def key_platform_icon(label="KICK"):
    img = key_bg()
    d = ImageDraw.Draw(img)
    draw_kick_logo(d, KEY_SZ//2, KEY_SZ//2-8, size=80)
    f = fnt(13); lw,_ = txt_sz(label, f)
    d.text(((KEY_SZ-lw)//2, 116), label, fill=(*SUB_C,220), font=f)
    return img

def key_new_follows(count="47", channel="@xqc"):
    img = key_bg()
    d = ImageDraw.Draw(img)
    label = "NEW FOLLOWS"; f_lbl = fnt(12)
    lw,_ = txt_sz(label, f_lbl)
    d.text(((KEY_SZ-lw)//2, 22), label, fill=(*SUB_C,255), font=f_lbl)
    f_val = fnt(48); vw,_ = txt_sz(count, f_val)
    d.text(((KEY_SZ-vw)//2, 52), count, fill=(*KICK_GREEN,255), font=f_val)
    sub = "TODAY"; sw,_ = txt_sz(sub, fnt(11))
    d.text(((KEY_SZ-sw)//2, 103), sub, fill=(*SUB_C,180), font=fnt(11))
    f_ch = fnt(10); cw,_ = txt_sz(channel, f_ch)
    d.text(((KEY_SZ-cw)//2, 126), channel, fill=(*DIM_C,180), font=f_ch)
    return img

def key_offline(channel="@xqc"):
    img = key_bg()
    d = ImageDraw.Draw(img)
    d.ellipse([(10,10),(22,22)], fill=(70,70,70,255))
    f_sub = fnt(14); f_dim = fnt(13); f_ch = fnt(10)
    ow,_ = txt_sz("OFFLINE", f_sub)
    d.text(((KEY_SZ-ow)//2, 60), "OFFLINE", fill=(*SUB_C,200), font=f_sub)
    nw,_ = txt_sz("Not live", f_dim)
    d.text(((KEY_SZ-nw)//2, 82), "Not live", fill=(*DIM_C,200), font=f_dim)
    f_ch2 = fnt(10); cw,_ = txt_sz(channel, f_ch2)
    d.text(((KEY_SZ-cw)//2, 114), channel, fill=(*DIM_C,160), font=f_ch2)
    return img

def key_full_number(value_str="48,247", label="FOLLOWERS", channel="@xqc"):
    img = key_bg()
    d = ImageDraw.Draw(img)
    f_lbl = fnt(13); f_val = fit_fnt(value_str, KEY_SZ-16, 34, 18); f_ch = fnt(10)
    lw,_ = txt_sz(label, f_lbl)
    d.text(((KEY_SZ-lw)//2, 22), label, fill=(*SUB_C,255), font=f_lbl)
    vw,_ = txt_sz(value_str, f_val)
    d.text(((KEY_SZ-vw)//2, 58), value_str, fill=(*KICK_GREEN,255), font=f_val)
    cw,_ = txt_sz(channel, f_ch)
    d.text(((KEY_SZ-cw)//2, 126), channel, fill=(*DIM_C,200), font=f_ch)
    return img

def key_loading():
    img = key_bg()
    d = ImageDraw.Draw(img)
    for i in range(3):
        y = 58+i*18; w = 80-i*16
        d.rounded_rectangle([(KEY_SZ//2-w//2,y),(KEY_SZ//2+w//2,y+10)], radius=5, fill=(25,30,25,255))
    return img

# ── Bullet list helper ───────────────────────────────────────────────────────────
def draw_bullets(canvas, bullets, x, y, f, color, dot_color, line_h=38):
    d = ImageDraw.Draw(canvas)
    for i, txt in enumerate(bullets):
        by = y + i*line_h
        d.ellipse([(x,by+7),(x+8,by+15)], fill=(*dot_color,255))
        d.text((x+18, by), txt, font=f, fill=(*color,240))

# ── Banner 1: Hero ──────────────────────────────────────────────────────────────
def banner_hero():
    canvas = make_canvas()
    d = ImageDraw.Draw(canvas)
    CONTENT_TOP = 76; CONTENT_BOT = H-170
    mid_y = (CONTENT_TOP+CONTENT_BOT)//2

    # LEFT side text
    lx = 96; max_w = 760
    title1 = "Your Kick stats."
    title2 = "Always visible."
    y = CONTENT_TOP + 60
    y += add_gradient_title(canvas, title1, lx, y, max_w) + 8
    y += add_gradient_title(canvas, title2, lx, y, max_w) + 36

    tagline = "Real-time follower count, live viewers, and milestone"
    tagline2 = "progress. On your Stream Deck. No login required."
    f_tag = fnt(22)
    d.text((lx, y), tagline, fill=(190,210,190,220), font=f_tag); y += 32
    d.text((lx, y), tagline2, fill=(190,210,190,220), font=f_tag); y += 52

    bullets = [
        "Followers, live viewers, new follows today",
        "Milestone progress bar with day estimate",
        "No API key needed. Just your username.",
    ]
    draw_bullets(canvas, bullets, lx, y, fnt(20), (200,220,200), KICK_GREEN, line_h=40)

    # RIGHT side key grid: 2 cols x 3 rows
    keys = [
        key_platform_icon(),
        key_big_number("48.2K", "FOLLOWERS", "@xqc", bar_pct=0.82),
        key_live("1,247","01:23","1,891","@xqc"),
        key_new_follows("47", "@xqc"),
        key_milestone(48200,50000,"@xqc"),
        key_trend("+312","up",None,"@xqc"),
    ]
    ksz = 176; cols = 3; rows = 2
    cell = ksz + 22
    grid_w = cols*cell; grid_h = rows*cell
    ox = W - 96 - grid_w + (cell-ksz)//2
    oy = CONTENT_TOP + (CONTENT_BOT-CONTENT_TOP-grid_h)//2 + (cell-ksz)//2
    for i, key in enumerate(keys):
        r, c = divmod(i, cols)
        x = W-96-grid_w + c*cell
        y2 = CONTENT_TOP + (CONTENT_BOT-CONTENT_TOP-grid_h)//2 + r*cell
        k = key.resize((ksz,ksz), Image.LANCZOS)
        canvas.alpha_composite(k, dest=(x, y2))

    add_bottom_bar(canvas, [
        ("device-watch", "ZERO SETUP", "Username only"),
        ("live-view", "REAL-TIME", "Live viewer count"),
        ("chart-bar", "MILESTONE", "Progress + ETA"),
        ("trending-up", "7-DAY TREND", "Sparkline chart"),
    ])
    canvas.save(os.path.join(OUT_DIR, "1-hero.png"))
    print("  1-hero.png")

# ── Banner 2: Display Modes ──────────────────────────────────────────────────────
def banner_modes():
    canvas = make_canvas()
    d = ImageDraw.Draw(canvas)
    CONTENT_TOP = 76; CONTENT_BOT = H-170
    CONTENT_H = CONTENT_BOT - CONTENT_TOP  # 714px

    f_h = fnt(52); hw,_ = txt_sz("Six ways to see your stats.", f_h)
    d.text(((W-hw)//2, CONTENT_TOP+22), "Six ways to see your stats.", fill=(230,240,230,255), font=f_h)

    keys = [
        key_big_number("48.2K","FOLLOWERS","@xqc",bar_pct=0.82),
        key_full_number("48,247","FOLLOWERS","@xqc"),
        key_milestone(48200,50000,"@xqc"),
        key_trend("+312","up",None,"@xqc"),
        key_live("1,247","01:23","1,891","@xqc"),
        key_platform_icon(),
    ]
    labels = ["Big Number","Full Number","Milestone","Trend","Live Viewers","Platform Icon"]
    f_lbl = fnt(20)
    lbl_h = 28
    ksz = 196; cols = 6; gap = 24
    cell = ksz + gap
    grid_w = cols*cell - gap
    # center vertically: title ~90px, keys+labels block
    title_h = 90
    block_h = ksz + lbl_h + 14
    oy = CONTENT_TOP + title_h + (CONTENT_H - title_h - block_h)//2
    ox = (W - grid_w)//2
    for i, key in enumerate(keys):
        x = ox + i*cell
        k = key.resize((ksz,ksz), Image.LANCZOS)
        canvas.alpha_composite(k, dest=(x, oy))
        lw,_ = txt_sz(labels[i], f_lbl)
        d.text((x+(ksz-lw)//2, oy+ksz+14), labels[i], fill=(*KICK_GREEN,200), font=f_lbl)

    sub = "Short press to cycle modes. Long press to switch between followers, live viewers, and new follows."
    f_sub = fnt(18); sw,_ = txt_sz(sub, f_sub)
    d.text(((W-sw)//2, CONTENT_BOT-36), sub, fill=(140,160,140,200), font=f_sub)

    add_bottom_bar(canvas, [
        ("layout-grid", "CYCLE MODES", "Short press"),
        ("arrows-exchange", "SWITCH METRIC", "Long press"),
        ("adjustments", "PER-KEY SETTINGS", "Each key independent"),
        ("palette", "TWO THEMES", "OLED + Creator"),
    ])
    canvas.save(os.path.join(OUT_DIR, "2-modes.png"))
    print("  2-modes.png")

# ── Banner 3: Live Mode ──────────────────────────────────────────────────────────
def banner_live():
    canvas = make_canvas(accent=KICK_GREEN)
    d = ImageDraw.Draw(canvas)
    CONTENT_TOP = 76; CONTENT_BOT = H-170
    CONTENT_H = CONTENT_BOT - CONTENT_TOP  # 714px

    # Big centered key + headline + sub all stacked, vertically centered
    ksz = 380
    head = "You're live. Know it instantly."
    sub = "Viewer count updates every 90 seconds while you stream."
    sub2 = "Switches to follower count when you go offline."
    f_head = fnt(52); f_sub = fnt(20)
    head_h = 66; sub_h = 30; gap = 28
    block_h = ksz + gap + head_h + sub_h + sub_h
    start_y = CONTENT_TOP + (CONTENT_H - block_h)//2

    lx = W//2 - ksz//2; ly = start_y

    # glow behind key
    glow = Image.new("RGBA",(W,H),(0,0,0,0))
    ImageDraw.Draw(glow).ellipse([(lx-80,ly-80),(lx+ksz+80,ly+ksz+80)], fill=(*KICK_GREEN,22))
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    canvas.alpha_composite(glow)

    live_key = key_live("3,741","02:47","4,102","@xqc")
    canvas.alpha_composite(live_key.resize((ksz,ksz), Image.LANCZOS), dest=(lx, ly))

    text_y = ly + ksz + gap
    hw,_ = txt_sz(head, f_head)
    d.text(((W-hw)//2, text_y), head, fill=(230,245,230,255), font=f_head)
    sw,_ = txt_sz(sub, f_sub)
    d.text(((W-sw)//2, text_y+head_h), sub, fill=(150,180,150,220), font=f_sub)
    sw2,_ = txt_sz(sub2, f_sub)
    d.text(((W-sw2)//2, text_y+head_h+sub_h), sub2, fill=(150,180,150,220), font=f_sub)

    add_bottom_bar(canvas, [
        ("refresh", "90 SEC REFRESH", "When live"),
        ("eye", "AUTO DETECT", "Stream start and end"),
        ("chart-line", "PEAK TRACKING", "Session high watermark"),
        ("clock", "STREAM TIMER", "Duration on the key"),
    ])
    canvas.save(os.path.join(OUT_DIR, "3-live-mode.png"))
    print("  3-live-mode.png")

# ── Banner 4: Milestone ──────────────────────────────────────────────────────────
def banner_milestone():
    canvas = make_canvas()
    d = ImageDraw.Draw(canvas)
    CONTENT_TOP = 76; CONTENT_BOT = H-170
    CONTENT_H = CONTENT_BOT - CONTENT_TOP  # 714px

    # Left: headline + description (40% of width)
    lx = 96; left_w = 740
    y = CONTENT_TOP + 60
    y += add_gradient_title(canvas, "Track every milestone.", lx, y, left_w) + 30

    sub_lines = [
        "Set a target and watch the bar fill up.",
        "ETA counts down in days, based on",
        "your real growth rate. Auto-detects",
        "1K, 5K, 10K, 50K, 100K, and beyond.",
    ]
    f_sub = fnt(23)
    for line in sub_lines:
        d.text((lx, y), line, fill=(180,200,180,220), font=f_sub); y += 36

    # Right: 3 milestone keys — vertically centered in right column
    stages = [
        (12000, 25000, "@creator"),
        (48200, 50000, "@xqc"),
        (99400, 100000, "@streamer"),
    ]
    labels_m = ["Setting goal", "Almost there", "So close..."]
    f_lbl = fnt(20)
    ksz = 258; gap = 28; lbl_h = 30
    block_w = 3*(ksz+gap) - gap
    block_h = ksz + 14 + lbl_h
    rx = lx + left_w + 40
    right_avail = W - rx - 60
    rx_center = rx + (right_avail - block_w)//2
    ry = CONTENT_TOP + (CONTENT_H - block_h)//2
    for i,(cur,tgt,ch) in enumerate(stages):
        x = rx_center + i*(ksz+gap)
        key = key_milestone(cur,tgt,ch)
        canvas.alpha_composite(key.resize((ksz,ksz),Image.LANCZOS), dest=(x, ry))
        lbl = labels_m[i]; lw,_ = txt_sz(lbl, f_lbl)
        d.text((x+(ksz-lw)//2, ry+ksz+14), lbl, fill=(*KICK_GREEN,190), font=f_lbl)

    add_bottom_bar(canvas, [
        ("target", "CUSTOM TARGET", "Set any number"),
        ("math-function", "AUTO DETECT", "Next round milestone"),
        ("calendar-stats", "DAYS TO GOAL", "Linear growth estimate"),
        ("confetti", "ACHIEVEMENT", "Celebrates when reached"),
    ])
    canvas.save(os.path.join(OUT_DIR, "4-milestone.png"))
    print("  4-milestone.png")

# ── Banner 5: Setup / No API Key ────────────────────────────────────────────────
def banner_setup():
    canvas = make_canvas()
    d = ImageDraw.Draw(canvas)
    CONTENT_TOP = 76; CONTENT_BOT = H-170

    # Center the headline
    f_head = fnt(68)
    head = "No API key. No login."
    hw,_ = txt_sz(head, f_head)
    d.text(((W-hw)//2, CONTENT_TOP+50), head, fill=(230,245,230,255), font=f_head)

    f_sub = fnt(26)
    sub = "Enter your Kick channel username. That is it. Stats start loading immediately."
    sw,_ = txt_sz(sub, f_sub)
    d.text(((W-sw)//2, CONTENT_TOP+150), sub, fill=(160,190,160,220), font=f_sub)

    # Show a "settings panel" mockup below
    px_w,px_h = 560, 220
    px = (W-px_w)//2; py = CONTENT_TOP+220
    d.rounded_rectangle([(px,py),(px+px_w,py+px_h)], radius=16, fill=(14,18,14,255), outline=(*KICK_GREEN,40), width=1)
    f_label = fnt(18); f_input = fnt(22); f_hint = fnt(15)
    d.text((px+24, py+22), "Kick Channel", fill=(*KICK_GREEN,200), font=f_label)
    d.text((px+24, py+60), "Username", fill=(*SUB_C,200), font=f_label)
    # Input box
    d.rounded_rectangle([(px+140,py+52),(px+px_w-24,py+94)], radius=8, fill=(10,14,10,255), outline=(*KICK_GREEN,60), width=1)
    d.text((px+156, py+64), "yourchannelname", fill=(*DIM_C,200), font=f_input)
    # Save button
    d.rounded_rectangle([(px+24,py+116),(px+px_w-24,py+158)], radius=8, fill=(*KICK_GREEN,255))
    btn_txt = "Save Channel"; btw,_ = txt_sz(btn_txt, f_label)
    d.text((px+(px_w-btw)//2, py+132), btn_txt, fill=(0,0,0,255), font=f_label)
    d.text((px+24, py+176), "Stats start loading immediately.", fill=(*DIM_C,200), font=f_hint)

    add_bottom_bar(canvas, [
        ("plug", "ZERO ACCOUNTS", "No Kick login needed"),
        ("lock-open", "PUBLIC API", "Uses public channel data"),
        ("device-desktop", "ONE PLUGIN", "Works on any Stream Deck"),
        ("bolt", "INSTANT", "Stats in under 30 seconds"),
    ])
    canvas.save(os.path.join(OUT_DIR, "5-setup.png"))
    print("  5-setup.png")

# ── Banner 6: Trend Mode ────────────────────────────────────────────────────────
def banner_trend():
    canvas = make_canvas()
    d = ImageDraw.Draw(canvas)
    CONTENT_TOP = 76; CONTENT_BOT = H-170
    CONTENT_H = CONTENT_BOT - CONTENT_TOP  # 714px

    f_head = fnt(56)
    head = "Watch your growth. Day by day."
    hw,_ = txt_sz(head, f_head)
    d.text(((W-hw)//2, CONTENT_TOP+28), head, fill=(230,245,230,255), font=f_head)

    # 3 trend keys — centered, large
    data_sets = [
        ([40000,40200,40800,41500,42100,42800,43600,44200,45000,46100,46800,48200], "+2,841", "@growing"),
        ([12000,12050,12100,12100,12080,12050,11900,11800,11700,11600,11500,11400], "-350",   "@dipping"),
        ([5000,5200,5500,5900,6400,6700,7100,7400,7800,8100,8500,8900], "+1,240",  "@rocket"),
    ]
    labels_t = ["Steady climb", "Tough week", "Blowing up"]
    f_lbl = fnt(22)
    ksz = 290; gap = 40; lbl_h = 30
    total_w = 3*ksz + 2*gap
    title_h = 96
    block_h = ksz + 16 + lbl_h
    oy = CONTENT_TOP + title_h + (CONTENT_H - title_h - block_h)//2
    ox = (W - total_w)//2
    for i, (vals, delta, ch) in enumerate(data_sets):
        arrow = "up" if delta.startswith("+") else "down"
        key = key_trend(delta, arrow, vals, ch)
        x = ox + i*(ksz+gap)
        canvas.alpha_composite(key.resize((ksz,ksz),Image.LANCZOS), dest=(x, oy))
        lbl = labels_t[i]; lw,_ = txt_sz(lbl, f_lbl)
        d.text((x+(ksz-lw)//2, oy+ksz+16), lbl, fill=(*KICK_GREEN,190), font=f_lbl)

    sub = "Stores 30 days of snapshots locally. Sparkline shows the shape of your growth at a glance."
    f_sub = fnt(20); sw,_ = txt_sz(sub, f_sub)
    d.text(((W-sw)//2, CONTENT_BOT-36), sub, fill=(140,160,140,200), font=f_sub)

    add_bottom_bar(canvas, [
        ("history", "30-DAY HISTORY", "Stored locally"),
        ("chart-dots", "SPARKLINE", "14-point chart"),
        ("trending-up", "TODAY OR 7-DAY", "Switchable window"),
        ("cpu", "NO CLOUD", "Everything stays on device"),
    ])
    canvas.save(os.path.join(OUT_DIR, "6-trend.png"))
    print("  6-trend.png")

# ── Banner 7: Grid Overview ─────────────────────────────────────────────────────
def banner_grid():
    canvas = make_canvas()
    d = ImageDraw.Draw(canvas)
    CONTENT_TOP = 76; CONTENT_BOT = H-170
    CONTENT_H = CONTENT_BOT - CONTENT_TOP  # 714px

    f_head = fnt(52)
    head = "One row. Every number that matters."
    hw,_ = txt_sz(head, f_head)
    d.text(((W-hw)//2, CONTENT_TOP+28), head, fill=(230,245,230,255), font=f_head)

    keys_row = [
        key_platform_icon(),
        key_big_number("48.2K","FOLLOWERS","@xqc",bar_pct=0.82),
        key_live("1,247","01:23","1,891","@xqc"),
        key_milestone(48200,50000,"@xqc"),
        key_trend("+312","up",None,"@xqc"),
    ]
    row_labels = ["Kick Logo","Followers","Live Count","Milestone","7-Day Trend"]
    f_lbl = fnt(21)
    ksz = 268; gap = 24; lbl_h = 30
    title_h = 96
    total_w = 5*ksz + 4*gap
    block_h = ksz + 16 + lbl_h
    oy = CONTENT_TOP + title_h + (CONTENT_H - title_h - block_h)//2
    ox = (W - total_w)//2
    for i, key in enumerate(keys_row):
        x = ox + i*(ksz+gap)
        canvas.alpha_composite(key.resize((ksz,ksz),Image.LANCZOS), dest=(x, oy))
        lbl = row_labels[i]; lw,_ = txt_sz(lbl, f_lbl)
        d.text((x+(ksz-lw)//2, oy+ksz+16), lbl, fill=(*SUB_C,200), font=f_lbl)

    sub = "Use one Stream Deck row for your entire Kick dashboard. Add more keys for extra metrics."
    f_sub = fnt(20); sw,_ = txt_sz(sub, f_sub)
    d.text(((W-sw)//2, CONTENT_BOT-36), sub, fill=(140,160,140,200), font=f_sub)

    add_bottom_bar(canvas, [
        ("layout-rows", "ONE ROW SETUP", "5 keys cover everything"),
        ("arrows-sort", "ANY ORDER", "Arrange however you want"),
        ("copy", "MULTIPLE KEYS", "Same stat, different modes"),
        ("device-gamepad", "MK2, XL, PLUS", "All Stream Decks supported"),
    ])
    canvas.save(os.path.join(OUT_DIR, "7-grid.png"))
    print("  7-grid.png")

# ── GIF + MP4 ──────────────────────────────────────────────────────────────────
def gen_video():
    GW, GH = 1200, 630
    frames = []
    bg_c = (*BG, 255)

    def make_frame():
        return Image.new("RGBA", (GW, GH), bg_c)

    def composite_key_centered(frame, key, scale=1.0):
        ksz = int(KEY_SZ * scale)
        k = key.resize((ksz,ksz), Image.LANCZOS)
        x = (GW-ksz)//2; y = (GH-ksz)//2 - 30
        frame.alpha_composite(k, dest=(x,y))
        return x, y, ksz

    def add_label(frame, text, y, color=(200,220,200), size=28):
        d = ImageDraw.Draw(frame)
        f = fnt(size); w,_ = txt_sz(text, f)
        d.text(((GW-w)//2, y), text, fill=(*color,240), font=f)

    def add_top_bar(frame):
        d = ImageDraw.Draw(frame)
        d.rectangle([(0,0),(GW,52)], fill=(*BG,255))
        _grad_line(frame, 50, 0, GW, (*KICK_GREEN,180))
        f_b = fnt(22)
        txt_b = "Kick Stats for Stream Deck"
        d.text((20,14), txt_b, fill=(200,220,200,220), font=f_b)
        # Kick logo small
        d2 = ImageDraw.Draw(frame)
        draw_kick_logo(d2, GW-36, 26, size=28)

    key_sequence = [
        (key_big_number("48.2K","FOLLOWERS","@xqc",bar_pct=0.82), "Followers at a glance"),
        (key_live("1,247","01:23","1,891","@xqc"), "Live viewer count"),
        (key_new_follows("47","@xqc"), "New follows today"),
        (key_milestone(48200,50000,"@xqc"), "Milestone progress"),
        (key_trend("+312","up",None,"@xqc"), "7-day growth trend"),
        (key_platform_icon(), "One-press to Kick dashboard"),
    ]

    HOLD = 14   # frames to hold each key
    FADE = 6    # frames for fade transition

    for ki, (key, label) in enumerate(key_sequence):
        # Fade in
        prev_key = key_sequence[ki-1][0] if ki > 0 else None
        for f_i in range(FADE):
            frame = make_frame()
            add_top_bar(frame)
            t = f_i/FADE
            if prev_key:
                x,y,ksz = composite_key_centered(frame, prev_key, scale=2.0)
                overlay = Image.new("RGBA",(GW,GH),(0,0,0,0))
                xo,yo,_ = composite_key_centered(overlay, key, scale=2.0)
                # blend
                arr_base = np.array(frame)
                arr_over = np.array(overlay)
                alpha = t
                blended = (arr_base*(1-alpha)+arr_over*alpha).astype(np.uint8)
                frame = Image.fromarray(blended, "RGBA")
                add_top_bar(frame)
            else:
                composite_key_centered(frame, key, scale=2.0)
            add_label(frame, label, GH-80)
            frames.append(frame.convert("RGB"))
        # Hold
        for _ in range(HOLD):
            frame = make_frame()
            add_top_bar(frame)
            composite_key_centered(frame, key, scale=2.0)
            add_label(frame, label, GH-80)
            frames.append(frame.convert("RGB"))

    gif_path = os.path.join(OUT_DIR, "preview.gif")
    frames[0].save(gif_path, save_all=True, append_images=frames[1:],
                   duration=60, loop=0, optimize=False)
    print(f"  preview.gif ({len(frames)} frames)")

    mp4_path = os.path.join(OUT_DIR, "preview.mp4")
    try:
        result = subprocess.run([
            "ffmpeg", "-i", gif_path,
            "-vf", "scale=1920:1008:flags=lanczos,pad=1920:1080:0:36:black",
            "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-y", mp4_path
        ], check=True, capture_output=True)
        print("  preview.mp4")
    except FileNotFoundError:
        print("  [skip] ffmpeg not found — install ffmpeg to generate preview.mp4")
    except subprocess.CalledProcessError as e:
        print(f"  [warn] ffmpeg failed: {e.stderr.decode()[:200]}")

# ── Marketplace icon 288x288 ────────────────────────────────────────────────────
def gen_marketplace_icon():
    SZ = 288
    img = Image.new("RGBA", (SZ, SZ), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Rounded black background
    d.rounded_rectangle([(0,0),(SZ-1,SZ-1)], radius=40, fill=(8, 8, 10, 255))
    # Kick logo centered, leaving room for "STATS" label below
    logo_size = 168
    logo_cy = int(SZ * 0.44)
    draw_kick_logo(d, SZ//2, logo_cy, size=logo_size)
    # "STATS" label below
    f_lbl = fnt(36)
    lbl = "STATS"
    lw, _ = txt_sz(lbl, f_lbl)
    d.text(((SZ-lw)//2, logo_cy + logo_size//2 + 14), lbl, fill=(180, 200, 180, 220), font=f_lbl)
    path = os.path.join(OUT_DIR, "icon-288x288.png")
    img.save(path)
    print("  icon-288x288.png")

# ── Listing description ─────────────────────────────────────────────────────────
def write_descriptions():
    path = os.path.join(OUT_DIR, "description.txt")
    content = """\
Kick Stats puts your most important creator numbers on your Stream Deck keys. Enter your channel username and stats start loading in seconds. No API key, no Kick login, no configuration needed.

*Your numbers. On your deck. Always.*

**Followers** - formatted count always visible on your deck, with a mini progress bar to your next milestone.
**Live Viewers** - updates every 90 seconds while you stream, then switches back to followers when you go offline. Peak viewer count tracked per session.
**New Follows Today** - see your daily growth at a glance without opening a browser tab.
**Milestone Progress** - set a target and watch the bar fill. Days-to-goal is estimated from your real growth rate and the key celebrates when you hit it.
**7-Day Trend** - sparkline chart built from 30 days of stored history so you can see the shape of your growth without leaving your stream.
**Six Display Modes** - Big Number, Full Number, Milestone, Trend, Live, and Platform Icon. Short press to cycle modes, long press to switch metrics. Every key is independent.

No API key. No login. Just your Kick username.

---

Part of the Ratpack creator toolkit for Stream Deck. Whether you stream, create content, or track your AI usage, there is something in the collection for you. Check out the full Ratpack lineup on the marketplace.

Kick stats, Kick follower count, live viewer count, Stream Deck creator plugin, Kick dashboard, milestone tracker, growth trend, new followers today
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("  description.txt")

# ── Main ────────────────────────────────────────────────────────────────────────
def main():
    print("Generating Kick Stats marketing assets...")
    banner_hero()
    banner_modes()
    banner_live()
    banner_milestone()
    banner_setup()
    banner_trend()
    banner_grid()
    print("Generating icon...")
    gen_marketplace_icon()
    print("Generating video assets...")
    gen_video()
    print("Writing listing copy...")
    write_descriptions()
    print(f"\nDone. All files in: {OUT_DIR}")

if __name__ == "__main__":
    main()

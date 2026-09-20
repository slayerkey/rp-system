# coding: utf-8
#!/usr/bin/env python3
"""
Football Team Tracker - Stream Deck Marketplace Art Generator
Generates banners, GIF, MP4 and listing icon for the Elgato Marketplace.
"""
import os, sys, math, subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
OUT_DIR    = os.path.join(SCRIPT_DIR, "output", "marketing")
os.makedirs(OUT_DIR, exist_ok=True)

# Shared engine lives two levels up from match-center (sports-stats -> Claude Projects -> _shared)
sys.path.insert(0, os.path.join(ROOT_DIR, "..", "..", "_shared"))
import marketing_engine as me
from marketing_engine import (
    Image, ImageDraw, ImageFilter,
    fnt, txt_size, fit_fnt, icon_img,
    make_canvas, add_bottom_bar, add_gradient_title, banner_header,
)

BRAND  = (0, 229, 160)    # #00e5a0 -- the live-score teal from scoreRenderer
BG     = (8, 10, 16)
DIM    = (85, 85, 85)
ORANGE = (245, 166, 35)   # half-time / prematch orange
RED_C  = (229, 57, 53)
WHITE  = (255, 255, 255)
GRAY   = (136, 136, 136)

me.BRAND  = BRAND
me.BG     = BG
me.OUT_DIR = OUT_DIR

W, H = 1920, 960

# ── Flag drawing ─────────────────────────────────────────────────────────────────
# Matches FLAG_SPECS in scoreRenderer.ts exactly.
FLAG_SPECS = {
    "GER": ("h", ["#000000", "#DD0000", "#FFCE00"]),
    "POR": ("v", ["#046A38", "#DA291C"]),
    "ENG": ("cross", "#FFFFFF", "#CE1124"),
    "FRA": ("v", ["#0055A4", "#FFFFFF", "#EF4135"]),
    "BRA": ("h", ["#009739", "#FEDD00", "#009739"]),
    "ARG": ("h", ["#74ACDF", "#FFFFFF", "#74ACDF"]),
    "ESP": ("h", ["#AA151B", "#F1BF00", "#AA151B"]),
    "ITA": ("v", ["#009246", "#FFFFFF", "#CE2B37"]),
    "NED": ("h", ["#AE1C28", "#FFFFFF", "#21468B"]),
    "CRO": ("h", ["#FF0000", "#FFFFFF", "#0093DD"]),
    "JPN": ("circle", "#FFFFFF", "#BC002D"),
    "MEX": ("v", ["#006847", "#FFFFFF", "#CE1126"]),
    "USA": ("h", ["#B22234", "#FFFFFF", "#3C3B6E"]),
    "CAN": ("v", ["#FF0000", "#FFFFFF", "#FF0000"]),
    "AUS": ("solid", "#00247D"),
    "SUI": ("cross", "#FF0000", "#FFFFFF"),
    "DEN": ("cross", "#C8102E", "#FFFFFF"),
    "SWE": ("cross", "#006AA7", "#FECC02"),
    "POL": ("h", ["#FFFFFF", "#DC143C"]),
    "URU": ("h", ["#0038A8", "#FFFFFF"]),
    "SEN": ("v", ["#00853F", "#FDEF42", "#E31B23"]),
    "MAR": ("solid", "#C1272D"),
    "KOR": ("circle", "#FFFFFF", "#CD2E3A"),
    "SRB": ("h", ["#C6363C", "#0C4076", "#FFFFFF"]),
    "UKR": ("h", ["#0057B7", "#FFD700"]),
    "TUR": ("solid", "#E30A17"),
    "MAR": ("solid", "#C1272D"),
    "ECU": ("h", ["#FFD100", "#034EA2", "#EF3340"]),
    # Club colors, for the League Table / Lineup / Scorers / Stats banners
    "ARS": ("solid", "#EF0107"),
    "CHE": ("solid", "#034694"),
    "MUN": ("solid", "#DA291C"),
    "LIV": ("solid", "#C8102E"),
    "MCI": ("solid", "#6CABDD"),
    "TOT": ("solid", "#132257"),
    "NEW": ("v", ["#000000", "#FFFFFF"]),
}

def _hex(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def draw_flag_on(img, x, y, w, h, tla, r=3):
    """Draw a flag at pixel coords (x,y) w*h on img, with rounded corners r."""
    x, y, w, h, r = int(x), int(y), int(w), int(h), int(r)
    spec = FLAG_SPECS.get(tla)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([x, y, x+w-1, y+h-1], radius=r, fill=255)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(layer)
    if spec is None:
        fd.rounded_rectangle([x, y, x+w-1, y+h-1], radius=r, fill=(50, 50, 50, 255))
    elif spec[0] == "h":
        n = len(spec[1]); sh = h / n
        for i, c in enumerate(spec[1]):
            fd.rectangle([x, y+i*sh, x+w, y+(i+1)*sh+1], fill=(*_hex(c), 255))
    elif spec[0] == "v":
        n = len(spec[1]); sw = w / n
        for i, c in enumerate(spec[1]):
            fd.rectangle([x+i*sw, y, x+(i+1)*sw+1, y+h], fill=(*_hex(c), 255))
    elif spec[0] == "cross":
        fd.rectangle([x, y, x+w, y+h], fill=(*_hex(spec[1]), 255))
        bh = h * 0.26; bwv = w * 0.2
        fd.rectangle([x, y+h/2-bh/2, x+w, y+h/2+bh/2], fill=(*_hex(spec[2]), 255))
        fd.rectangle([x+w*0.32-bwv/2, y, x+w*0.32+bwv/2, y+h], fill=(*_hex(spec[2]), 255))
    elif spec[0] == "circle":
        fd.rectangle([x, y, x+w, y+h], fill=(*_hex(spec[1]), 255))
        r2 = min(w, h) * 0.3; cx2, cy2 = x+w/2, y+h/2
        fd.ellipse([cx2-r2, cy2-r2, cx2+r2, cy2+r2], fill=(*_hex(spec[2]), 255))
    elif spec[0] == "solid":
        fd.rectangle([x, y, x+w, y+h], fill=(*_hex(spec[1]), 255))
    img.paste(layer, (0, 0), mask)
    # Subtle border
    bl = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(bl).rounded_rectangle([x+0.5, y+0.5, x+w-1.5, y+h-1.5], radius=r, outline=(255,255,255,55), width=1)
    img.alpha_composite(bl)

# ── Key builders -- mirror the real scoreRenderer.ts layouts exactly ─────────────

def _key_bg(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, size-1, size-1], radius=int(size*0.125), fill=(15, 15, 15, 255))
    return img

def _t(d, text, cx, cy, sz, color, anchor="mm"):
    d.text((cx, cy), str(text), font=fnt(int(sz)), fill=(*color[:3], 255), anchor=anchor)

def live_key(home_tla, away_tla, home_score, away_score, minute,
             stage="Group Stage", is_home=True, display="LIVE", size=144):
    """Mirror drawLiveMatch / drawHalfTime / drawExtraTime / drawPenalties."""
    f = size / 144
    img = _key_bg(size)
    d = ImageDraw.Draw(img)
    if display == "HALF_TIME":
        sc, st = ORANGE, "HALF TIME"
    elif display == "EXTRA_TIME":
        sc, st = BRAND, f"ET {minute}'"
    elif display == "PENALTIES":
        sc, st = (255, 107, 107), "PENALTIES"
    else:
        sc, st = BRAND, f"{minute}'" if minute else "LIVE"
    _t(d, stage[:22], size/2, 11*f, 11*f, DIM)
    fw, fh = int(34*f), int(28*f)
    draw_flag_on(img, 28*f - fw/2, 42*f - fh/2, fw, fh, home_tla)
    draw_flag_on(img, (size-28)*f - fw/2, 42*f - fh/2, fw, fh, away_tla)
    _t(d, home_tla, 28*f, 66*f, 12*f, BRAND if is_home else GRAY)
    _t(d, away_tla, (size-28)*f, 66*f, 12*f, BRAND if not is_home else GRAY)
    _t(d, home_score, 58*f, 100*f, 46*f, WHITE, anchor="rm")
    _t(d, "-", 72*f, 100*f, 24*f, DIM)
    _t(d, away_score, 86*f, 100*f, 46*f, WHITE, anchor="lm")
    _t(d, st, size/2, 134*f, 16*f, sc)
    return img

def goal_key(home_tla, away_tla, home_score, away_score, scorer, size=144):
    """Mirror drawLiveMatch goal-flash overlay (flashPhase=0 = white bg state)."""
    f = size / 144
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, size-1, size-1], radius=int(size*0.125), fill=(255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    _t(d, "GOOOAL!", size/2, 46*f, 25*f, BRAND)
    _t(d, scorer[:14], size/2, 80*f, 16*f, (0, 0, 0))
    _t(d, "Your team", size/2, 104*f, 16*f, (0, 150, 100))
    _t(d, f"{home_score} - {away_score}", size/2, 128*f, 22*f, (0, 0, 0))
    return img

def fulltime_key(home_tla, away_tla, home_score, away_score, result,
                 hours_ago=2, is_home=True, size=144):
    """Mirror drawFullTime."""
    f = size / 144
    img = _key_bg(size)
    d = ImageDraw.Draw(img)
    top = "FULL TIME" if hours_ago < 6 else (f"{int(hours_ago)}H AGO" if hours_ago < 48 else f"{int(hours_ago/24)}D AGO")
    rc = BRAND if result == "WIN" else (ORANGE if result == "DRAW" else RED_C)
    _t(d, top, size/2, 11*f, 13*f, GRAY)
    _t(d, result, size/2, 33*f, 26*f, rc)
    _t(d, f"{home_score} - {away_score}", size/2, 70*f, 44*f, WHITE)
    fw, fh = int(28*f), int(22*f)
    draw_flag_on(img, 28*f - fw/2, 106*f - fh/2, fw, fh, home_tla)
    draw_flag_on(img, (size-28)*f - fw/2, 106*f - fh/2, fw, fh, away_tla)
    _t(d, home_tla, 28*f, 128*f, 11*f, BRAND if is_home else GRAY)
    _t(d, away_tla, (size-28)*f, 128*f, 11*f, BRAND if not is_home else GRAY)
    return img

def prematch_key(home_tla, away_tla, stage="World Cup", days_away=3,
                 time_str="20:00", size=144, imminent=False):
    """Mirror drawPreMatch."""
    f = size / 144
    fill = (17, 31, 10, 255) if imminent else (15, 15, 15, 255)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, size-1, size-1], radius=int(size*0.125), fill=fill)
    d = ImageDraw.Draw(img)
    _t(d, stage[:22], size/2, 12*f, 11*f, DIM)
    fw, fh = int(32*f), int(26*f)
    draw_flag_on(img, 28*f - fw/2, 44*f - fh/2, fw, fh, home_tla)
    draw_flag_on(img, (size-28)*f - fw/2, 44*f - fh/2, fw, fh, away_tla)
    _t(d, home_tla, 28*f, 64*f, 12*f, GRAY)
    _t(d, "vs", size/2, 44*f, 13*f, DIM)
    _t(d, away_tla, (size-28)*f, 64*f, 12*f, GRAY)
    yb = 90*f
    if imminent:
        _t(d, "KICK OFF", size/2, yb, 20*f, BRAND)
        _t(d, "SOON!", size/2, yb+22*f, 18*f, BRAND)
    elif days_away >= 2:
        _t(d, "Sat 5 Jul", size/2, yb, 17*f, ORANGE)
        _t(d, time_str, size/2, yb+20*f, 15*f, GRAY)
        _t(d, f"in {days_away} days", size/2, yb+38*f, 13*f, DIM)
    elif days_away == 1:
        _t(d, "Tomorrow", size/2, yb, 17*f, ORANGE)
        _t(d, time_str, size/2, yb+20*f, 15*f, GRAY)
        _t(d, "in 20h", size/2, yb+38*f, 13*f, DIM)
    else:
        _t(d, time_str, size/2, yb, 26*f, ORANGE)
        _t(d, "Today", size/2, yb+22*f, 13*f, GRAY)
        _t(d, "in 45m", size/2, yb+38*f, 13*f, BRAND)
    return img

def flagonly_key(tla, name, size=144):
    """Mirror drawFlagOnly."""
    f = size / 144
    img = _key_bg(size)
    d = ImageDraw.Draw(img)
    fw, fh = int(104*f), int(68*f)
    draw_flag_on(img, size/2 - fw/2, 60*f - fh/2, fw, fh, tla, r=int(6*f))
    _t(d, name[:18].upper(), size/2, 116*f, 16*f, WHITE)
    if tla and name.upper() != tla:
        _t(d, tla, size/2, 134*f, 12*f, DIM)
    return img

def mc_logo_key(size=144):
    """Football Team Tracker 'plug-in identity' key: football + wordmark."""
    f = size / 144
    img = _key_bg(size)
    d = ImageDraw.Draw(img)
    cx, cy = size/2, size*0.42
    br = size * 0.24
    # ball body
    d.ellipse([cx-br, cy-br, cx+br, cy+br], fill=(235, 238, 245, 255))
    # patches
    pr = br * 0.29
    d.ellipse([cx-pr, cy-pr, cx+pr, cy+pr], fill=(18, 18, 18, 255))
    for ang in [90, 162, 234, 306, 18]:
        rad = math.radians(ang)
        px = cx + br*0.65*math.cos(rad); py = cy + br*0.65*math.sin(rad)
        d.ellipse([px-pr*0.82, py-pr*0.82, px+pr*0.82, py+pr*0.82], fill=(18, 18, 18, 200))
    _t(d, "FOOTBALL", size/2, size*0.78, size*0.1, BRAND)
    _t(d, "TRACKER", size/2, size*0.91, size*0.09, (165, 175, 195))
    return img

def _ordinal(n):
    """Mirror ordinal() in tableRenderer.ts."""
    m = n % 100
    if 11 <= m <= 13: return f"{n}TH"
    return {1: f"{n}ST", 2: f"{n}ND", 3: f"{n}RD"}.get(n % 10, f"{n}TH")

def _position_color(pos, total):
    """Mirror positionColor() in tableRenderer.ts."""
    if pos <= 4: return BRAND
    if total >= 18 and pos >= total - 2: return RED_C
    if total >= 12 and pos >= total - 1: return RED_C
    if pos <= 6: return ORANGE
    return WHITE

def table_key(tla, competition, position, total_teams, points, form, size=144):
    """Mirror drawTable() in tableRenderer.ts: flag, big ordinal, points, form dots."""
    f = size / 144
    img = _key_bg(size)
    d = ImageDraw.Draw(img)
    pc = _position_color(position, total_teams)
    label = competition if len(competition) <= 16 else competition
    _t(d, label.upper(), size/2, 10*f, 9*f, DIM)
    fw, fh = int(34*f), int(26*f)
    draw_flag_on(img, size/2 - fw/2, 34*f - fh/2, fw, fh, tla)
    _t(d, _ordinal(position), size/2, 76*f, 42*f, pc)
    _t(d, f"{points} PTS", size/2, 108*f, 18*f, WHITE)
    if form:
        results = form[-5:]
        r, gap = 6*f, 16*f
        total_w = len(results)*(r*2) + (len(results)-1)*(gap-r*2)
        sx = size/2 - total_w/2 + r
        for i, res in enumerate(results):
            c = BRAND if res == "W" else ORANGE if res == "D" else RED_C
            cx = sx + i*gap
            d.ellipse([cx-r, 132*f-r, cx+r, 132*f+r], fill=(*c, 255))
    return img

def lineup_key(own_tla, formation, opponent, is_home=True, minute=None, size=144):
    """Mirror drawConfirmed() in lineupRenderer.ts: team, FORMATION label, big code, CONFIRMED badge, opponent."""
    f = size / 144
    img = _key_bg(size)
    d = ImageDraw.Draw(img)
    _t(d, own_tla, size/2, 11*f, 12*f, WHITE)
    _t(d, "FORMATION", size/2, 24*f, 8*f, DIM)
    _t(d, formation, size/2, 58*f, 36*f, BRAND)
    badge_fill = (26, 46, 34, 255)
    d.rounded_rectangle([size/2-38*f, 78*f, size/2+38*f, 95*f], radius=4*f, fill=badge_fill)
    _t(d, "CONFIRMED", size/2, 86.5*f, 10*f, BRAND)
    vs = f"vs {opponent}" if is_home else f"@ {opponent}"
    _t(d, vs[:16], size/2, 112*f, 13*f, GRAY)
    if minute is not None:
        _t(d, f"{minute}'", size-6*f, 11*f, 10*f, ORANGE, anchor="rm")
    return img

def lineup_pending_key(own_tla, opponent, is_home=True, size=144):
    """Mirror drawPending() in lineupRenderer.ts."""
    f = size / 144
    img = _key_bg(size)
    d = ImageDraw.Draw(img)
    _t(d, own_tla, size/2, 11*f, 12*f, GRAY)
    _t(d, "TBC", size/2, 54*f, 44*f, WHITE)
    vs = f"vs {opponent}" if is_home else f"@ {opponent}"
    _t(d, vs[:16], size/2, 92*f, 11*f, GRAY)
    _t(d, "Lineup ~1h before KO", size/2, 114*f, 9*f, DIM)
    return img

_MEDALS = [(255, 215, 0), (192, 192, 192), (205, 127, 50)]

def scorers_key(competition, rows, page=0, total_pages=1, size=144):
    """Mirror drawScorers() in scorersRenderer.ts: 3 big names, small rank + goals, page dots."""
    f = size / 144
    img = _key_bg(size)
    d = ImageDraw.Draw(img)
    label = competition if len(competition) <= 16 else competition
    _t(d, label.upper(), size/2, 8*f, 8*f, DIM)
    d.line([(8*f, 15*f), (size-8*f, 15*f)], fill=(34, 34, 34, 255))
    row_h, start_y = 34*f, 30*f
    for i, (rank, name, goals) in enumerate(rows):
        y = start_y + i*row_h
        rank_color = _MEDALS[rank-1] if rank <= 3 else DIM
        _t(d, str(rank), 15*f, y, 14*f, rank_color)
        disp_name = name if len(name) <= 11 else name[:10] + "…"
        d.text((27*f, y), disp_name, font=fnt(int(17*f)), fill=(*WHITE, 255), anchor="lm")
        goal_color = BRAND if rank == 1 else GRAY
        d.text((137*f, y), str(goals), font=fnt(int(13*f)), fill=(*goal_color, 255), anchor="rm")
    if total_pages > 1:
        r, gap = 2*f, 9*f
        total_w = total_pages*(r*2) + (total_pages-1)*(gap-r*2)
        sx = size/2 - total_w/2 + r
        y = start_y + 3*row_h + 6*f
        for i in range(total_pages):
            col = BRAND if i == page else (58, 58, 58)
            cx = sx + i*gap
            d.ellipse([cx-r, y-r, cx+r, y+r], fill=(*col, 255))
    return img

def stats_key(home_tla, away_tla, home_score, away_score, minute, is_home, stats, size=144):
    """Mirror drawStats() in statsRenderer.ts: flags in corners, score+minute, 3 "H - A" stat rows."""
    f = size / 144
    img = _key_bg(size)
    d = ImageDraw.Draw(img)
    fw, fh = int(24*f), int(17*f)
    draw_flag_on(img, 24*f - fw/2, 14*f - fh/2, fw, fh, home_tla)
    draw_flag_on(img, (size-24)*f - fw/2, 14*f - fh/2, fw, fh, away_tla)
    _t(d, f"{home_score}-{away_score}", size/2, 11*f, 13*f, ORANGE)
    if minute is not None:
        _t(d, f"{minute}'", size/2, 24*f, 10*f, GRAY)
    d.line([(10*f, 32*f), (size-10*f, 32*f)], fill=(36, 36, 36, 255))
    row_h, start_y = 33*f, 46*f
    home_color = BRAND if is_home else WHITE
    away_color = WHITE if is_home else BRAND
    for i, (label, home_v, away_v) in enumerate(stats[:3]):
        y = start_y + i*row_h
        d.text((size/2-20*f, y), str(home_v), font=fnt(int(24*f)), fill=(*home_color, 255), anchor="rm")
        _t(d, "–", size/2, y, 16*f, GRAY)
        d.text((size/2+20*f, y), str(away_v), font=fnt(int(24*f)), fill=(*away_color, 255), anchor="lm")
        _t(d, label, size/2, y+15*f, 10*f, (170, 170, 170))
    return img

def place_key(canvas, key_img, cx, cy, disp):
    k = key_img.resize((disp, disp), Image.LANCZOS)
    canvas.alpha_composite(k, dest=(int(cx - disp//2), int(cy - disp//2)))

def _labeled_row(canvas, keys, cy, disp, gap, labels, label_color):
    n = len(keys)
    total = n*disp + (n-1)*gap
    x = W//2 - total//2
    d = ImageDraw.Draw(canvas)
    for i, k in enumerate(keys):
        place_key(canvas, k, x + disp//2, cy, disp)
        if labels and i < len(labels):
            lbl = labels[i]; f_l = fnt(20); tw, _ = txt_size(lbl, f_l)
            d.text((x + (disp-tw)//2, cy + disp//2 + 12), lbl, font=f_l, fill=(*label_color, 200))
        x += disp + gap

# ── Listing icon ─────────────────────────────────────────────────────────────────

def make_listing_icon(size=288):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    r = int(size * 0.20)
    ImageDraw.Draw(img).rounded_rectangle([0, 0, size-1, size-1], radius=r, fill=(*BG, 255))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([size*0.1, size*0.04, size*0.9, size*0.62], fill=(*BRAND, 60))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(int(size*0.14))))
    d = ImageDraw.Draw(img)
    cx, cy = size/2, size*0.40
    br = size * 0.24
    d.ellipse([cx-br, cy-br, cx+br, cy+br], fill=(232, 237, 246, 255))
    pr = br * 0.29
    d.ellipse([cx-pr, cy-pr, cx+pr, cy+pr], fill=(18, 18, 18, 255))
    for ang in [90, 162, 234, 306, 18]:
        rad = math.radians(ang)
        px = cx + br*0.65*math.cos(rad); py = cy + br*0.65*math.sin(rad)
        d.ellipse([px-pr*0.82, py-pr*0.82, px+pr*0.82, py+pr*0.82], fill=(18, 18, 18, 200))
    spaced = "F O O T B A L L   T R A C K E R"
    sf = fit_fnt(spaced, size * 0.88, int(size * 0.1), min_sz=int(size * 0.06))
    sb = d.textbbox((0, 0), spaced, font=sf); sw, sh = sb[2]-sb[0], sb[3]-sb[1]
    d.text(((size-sw)/2 - sb[0], size*0.75 - sh/2 - sb[1]), spaced, font=sf, fill=(200, 210, 228, 255))
    return img

# ── Banners ──────────────────────────────────────────────────────────────────────

def banner_hero():
    c = make_canvas(W, H, BRAND)
    d = ImageDraw.Draw(c)

    # Small icon badge top-left of text column
    icon = make_listing_icon(112)
    c.alpha_composite(icon, dest=(96, 98))

    y = 210
    y += add_gradient_title(c, "Five ways to follow", 96, y, 760, accent=BRAND, max_sz=72) + 6
    y += add_gradient_title(c, "your team, live.", 96, y, 760, accent=BRAND, white=True, max_sz=72) + 22

    d.text((96, y), "Pick your team once. Everything else updates itself.", font=fnt(24), fill=(196, 206, 224, 230))
    y += 50

    for b in [
        "Live score, goal alerts, half-time, extra time, penalties",
        "League table position, points and last-5 form",
        "Confirmed starting lineup and formation before kickoff",
        "Top scorers and live match stats, every competition",
    ]:
        d.ellipse([(96, y+10), (108, y+22)], fill=(*BRAND, 255))
        d.text((122, y), b, font=fnt(21), fill=(210, 218, 236, 240))
        y += 40

    # Right side: 2 rows x 3 cols of keys showing all 5 actions + logo
    keys = [
        mc_logo_key(),
        live_key("GER", "POR", 2, 1, 67, "Group Stage"),
        table_key("MCI", "Premier League", 1, 20, 68, "WWWDW"),
        lineup_key("ARS", "4-3-3", "Chelsea", is_home=True),
        scorers_key("Premier League", [(1, "Haaland", 19), (2, "Salah", 17), (3, "Saka", 15)]),
        stats_key("ARS", "CHE", 1, 0, 55, True, [
            ("POSSESSION %", 62, 38), ("SHOTS ON TARGET", 6, 2), ("CORNERS", 7, 3),
        ]),
    ]
    disp = 194; gap = 18; cols = 3
    grid_w = cols*disp + (cols-1)*gap
    grid_h = 2*disp + gap
    gx = W - 108 - grid_w
    gy = 76 + (H - 170 - 76 - grid_h) // 2
    for i, k in enumerate(keys):
        row = i // cols; col = i % cols
        place_key(c, k, gx + col*(disp+gap) + disp//2, gy + row*(disp+gap) + disp//2, disp)

    add_bottom_bar(c, W, H, [
        ("layout-grid", "5 buttons", "One plugin"),
        ("ball-football", "Competitions", "10+ supported"),
        ("flag", "Teams", "100+ nations + clubs"),
        ("bell", "Goal alerts", "On your desk"),
    ], BRAND)
    return c


def banner_live():
    c = make_canvas(W, H, BRAND)
    content_top = banner_header(
        c, "Every second of the match.",
        "Score, minute, half-time, extra time and penalties - all at a glance without touching your phone.",
        W)
    CONTENT_H = (H - 170) - content_top
    disp = 204; gap = 26
    keys = [
        live_key("GER", "POR", 0, 0, 12, "Group Stage", display="LIVE"),
        goal_key("GER", "POR", 1, 0, "J. Musiala"),
        live_key("GER", "POR", 1, 0, 45, "Group Stage", display="HALF_TIME"),
        live_key("GER", "POR", 1, 1, 72, "Group Stage", display="LIVE"),
        live_key("GER", "POR", 1, 1, 105, "Group Stage", display="EXTRA_TIME"),
        live_key("GER", "POR", 1, 1, 0, "Group Stage", display="PENALTIES"),
    ]
    labels = ["Early game", "GOAL!", "Half time", "Second half", "Extra time", "Penalties"]
    cy = content_top + CONTENT_H // 2 - 14
    _labeled_row(c, keys, cy, disp, gap, labels, BRAND)
    return c


def banner_table():
    c = make_canvas(W, H, BRAND)
    content_top = banner_header(
        c, "See exactly where your team stands.",
        "League position, points and last-five form, redrawn every 2 minutes. Works for any competition.",
        W)
    CONTENT_H = (H - 170) - content_top
    disp = 216; gap = 40
    keys = [
        table_key("MCI", "Premier League", 1, 20, 68, "WWWDW"),
        table_key("ARS", "Premier League", 4, 20, 58, "WDWWL"),
        table_key("TOT", "Premier League", 8, 20, 44, "LWDWD"),
        table_key("NEW", "Premier League", 18, 20, 22, "LLDLL"),
    ]
    labels = ["Title race", "Champions League spot", "Mid-table", "Relegation zone"]
    cy = content_top + CONTENT_H // 2 - 14
    _labeled_row(c, keys, cy, disp, gap, labels, BRAND)
    add_bottom_bar(c, W, H, [
        ("trophy", "Position", "Live standings"),
        ("chart-bar", "Points", "And goal form"),
        ("flame", "Form", "Last 5 results"),
        ("refresh", "Updates", "Every 2 minutes"),
    ], BRAND)
    return c


def banner_lineup():
    c = make_canvas(W, H, BRAND)
    content_top = banner_header(
        c, "Know the XI before kickoff.",
        "Confirmed formation and starting lineup, usually announced about an hour before the match.",
        W)
    CONTENT_H = (H - 170) - content_top
    disp = 216; gap = 40
    keys = [
        lineup_pending_key("ARS", "Chelsea", is_home=True),
        lineup_key("ARS", "4-3-3", "Chelsea", is_home=True),
        lineup_key("ARS", "4-2-3-1", "Liverpool", is_home=False, minute=34),
    ]
    labels = ["Before lineups drop", "Confirmed pre-match", "Live in the match"]
    cy = content_top + CONTENT_H // 2 - 14
    _labeled_row(c, keys, cy, disp, gap, labels, BRAND)
    return c


def banner_scorers():
    c = make_canvas(W, H, BRAND)
    content_top = banner_header(
        c, "The Golden Boot race, live.",
        "Top scorers for any competition. Press the button to page through the next three.",
        W)
    CONTENT_H = (H - 170) - content_top
    disp = 240; gap = 60
    keys = [
        scorers_key("Premier League", [(1, "Haaland", 19), (2, "Salah", 17), (3, "Saka", 15)], page=0, total_pages=2),
        scorers_key("Premier League", [(4, "Kane", 14), (5, "Son", 13), (6, "Watkins", 12)], page=1, total_pages=2),
    ]
    labels = ["Top 3", "Press for the next 3"]
    cy = content_top + CONTENT_H // 2 - 14
    _labeled_row(c, keys, cy, disp, gap, labels, BRAND)
    return c


def banner_stats():
    c = make_canvas(W, H, BRAND)
    content_top = banner_header(
        c, "The stats that actually matter.",
        "Possession, shots on target and corners, both teams side by side while the match is live.",
        W)
    CONTENT_H = (H - 170) - content_top
    disp = 240; gap = 60
    keys = [
        stats_key("ARS", "CHE", 0, 0, 10, True, [
            ("POSSESSION %", 55, 45), ("SHOTS ON TARGET", 1, 0), ("CORNERS", 2, 1),
        ]),
        stats_key("ARS", "CHE", 1, 0, 55, True, [
            ("POSSESSION %", 62, 38), ("SHOTS ON TARGET", 6, 2), ("CORNERS", 7, 3),
        ]),
    ]
    labels = ["Early doors", "Deep in the second half"]
    cy = content_top + CONTENT_H // 2 - 14
    _labeled_row(c, keys, cy, disp, gap, labels, BRAND)
    add_bottom_bar(c, W, H, [
        ("ball-football", "Possession", "Live percentage"),
        ("target-arrow", "Shots on target", "Both teams"),
        ("corner-up-right", "Corners", "Running count"),
        ("bolt", "Live updates", "Every 30s"),
    ], BRAND)
    return c


def banner_prematch():
    c = make_canvas(W, H, ORANGE, watermark=True)
    content_top = banner_header(
        c, "Know when your team plays next.",
        "The countdown updates live. Glows amber when kickoff is under 5 minutes away.",
        W, accent=ORANGE)
    CONTENT_H = (H - 170) - content_top
    disp = 216; gap = 42
    keys = [
        prematch_key("ENG", "FRA", "Champions League", days_away=5, time_str="20:45"),
        prematch_key("BRA", "ARG", "World Cup", days_away=1, time_str="18:00"),
        prematch_key("GER", "ESP", "Semi Final", days_away=0, time_str="17:30"),
        prematch_key("POR", "FRA", "World Cup Final", days_away=0, imminent=True),
    ]
    labels = ["5 days away", "Tomorrow", "Today, 45 mins", "Kick off soon!"]
    cy = content_top + CONTENT_H // 2 - 14
    _labeled_row(c, keys, cy, disp, gap, labels, ORANGE)
    add_bottom_bar(c, W, H, [
        ("calendar", "Next match", "Date + time"),
        ("clock", "Countdown", "Hours and minutes"),
        ("bolt", "Kickoff alert", "Amber glow"),
        ("refresh", "Auto-refresh", "No setup needed"),
    ], ORANGE)
    return c


def banner_fulltime():
    c = make_canvas(W, H, BRAND)
    content_top = banner_header(
        c, "Win, draw or loss - always visible.",
        "The last result stays on screen until the next match. Fades from 'Full Time' to '6H Ago' to '3D Ago'.",
        W)
    CONTENT_H = (H - 170) - content_top
    disp = 210; gap = 36
    keys = [
        fulltime_key("ENG", "FRA", 3, 1, "WIN", hours_ago=1, is_home=True),
        fulltime_key("GER", "ARG", 2, 2, "DRAW", hours_ago=8, is_home=True),
        fulltime_key("BRA", "ARG", 1, 3, "LOSS", hours_ago=28, is_home=True),
        fulltime_key("ESP", "ITA", 2, 0, "WIN", hours_ago=74, is_home=True),
    ]
    labels = ["Just ended", "8 hours ago", "Yesterday", "3 days ago"]
    cy = content_top + CONTENT_H // 2 - 14
    _labeled_row(c, keys, cy, disp, gap, labels, BRAND)
    return c


def banner_modes():
    c = make_canvas(W, H, BRAND)
    content_top = banner_header(
        c, "Three modes, every situation.",
        "Auto mode picks the right view automatically. Or pin it to next match only, or flag only.",
        W)
    CONTENT_H = (H - 170) - content_top
    disp = 178; gap = 24; lbl_h = 36; row_gap = 30
    total_h = disp + lbl_h + row_gap + disp + lbl_h
    gy1 = content_top + max(16, (CONTENT_H - total_h) // 2)
    gy2 = gy1 + disp + lbl_h + row_gap

    row1 = [
        live_key("GER", "POR", 2, 1, 67, "Group Stage"),
        prematch_key("ENG", "FRA", "Premier League", days_away=2, time_str="15:00"),
        fulltime_key("BRA", "ARG", 3, 2, "WIN", hours_ago=4, is_home=True),
    ]
    row2 = [
        flagonly_key("GER", "Germany"),
        flagonly_key("ENG", "England"),
        flagonly_key("BRA", "Brazil"),
    ]
    _labeled_row(c, row1, gy1 + disp//2, disp, gap,
                 ["Auto: live match", "Auto: next match", "Auto: last result"], BRAND)
    _labeled_row(c, row2, gy2 + disp//2, disp, gap,
                 ["Flag only mode", "Flag only mode", "Flag only mode"], (160, 170, 190))
    return c


def banner_competitions():
    c = make_canvas(W, H, BRAND)
    content_top = banner_header(
        c, "100+ teams. 10+ competitions.",
        "Premier League, Champions League, La Liga, Bundesliga, Serie A, Ligue 1, World Cup, Euros and more.",
        W)
    CONTENT_H = (H - 170) - content_top
    teams = [
        ("ENG", "England"), ("GER", "Germany"), ("FRA", "France"),
        ("BRA", "Brazil"), ("ARG", "Argentina"), ("ESP", "Spain"),
        ("ITA", "Italy"), ("POR", "Portugal"), ("NED", "Netherlands"),
        ("JPN", "Japan"), ("URU", "Uruguay"), ("MAR", "Morocco"),
    ]
    disp = 148; gap = 18; cols = 6
    grid_w = cols*disp + (cols-1)*gap
    grid_h = 2*disp + gap
    gx = (W - grid_w) // 2
    gy = content_top + max(12, (CONTENT_H - grid_h) // 2)
    for i, (tla, name) in enumerate(teams):
        row = i // cols; col = i % cols
        k = flagonly_key(tla, name)
        place_key(c, k, gx + col*(disp+gap) + disp//2, gy + row*(disp+gap) + disp//2, disp)
    return c


def banner_statement():
    c = make_canvas(W, H, BRAND)
    d = ImageDraw.Draw(c)
    t1 = "Your team. One button."
    t2 = "Always on."
    # Approximate widths at the font size add_gradient_title would pick
    w1 = min(txt_size(t1, fnt(110))[0], W - 200)
    w2 = min(txt_size(t2, fnt(110))[0], W - 200)
    bb1 = d.textbbox((0,0), t1, font=fnt(100)); h1 = bb1[3]-bb1[1]
    bb2 = d.textbbox((0,0), t2, font=fnt(110)); h2 = bb2[3]-bb2[1]
    y1 = H//2 - h1 - 20
    y2 = y1 + h1 + 28
    add_gradient_title(c, t1, (W-w1)//2, y1, W-200, accent=BRAND, max_sz=110)
    add_gradient_title(c, t2, (W-w2)//2, y2, W-200, accent=BRAND, white=True, max_sz=110)
    d = ImageDraw.Draw(c)
    sub = "Set it once. Your live score is always one glance away."
    f_sub = fnt(30); sw, _ = txt_size(sub, f_sub)
    d.text(((W-sw)//2, y2 + h2 + 52), sub, font=f_sub, fill=(168, 178, 200, 210))
    return c


# ── Video ─────────────────────────────────────────────────────────────────────────

def gen_video():
    vW, vH = 1200, 630

    def vbg():
        img = Image.new("RGB", (vW, vH), BG[:3])
        g = Image.new("RGBA", (vW, vH), (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse([(vW//2-320, 30), (vW//2+320, vH-30)], fill=(*BRAND, 32))
        return Image.alpha_composite(img.convert("RGBA"), g.filter(ImageFilter.GaussianBlur(110)))

    def frame(keys_list, title, subtitle=""):
        fr = vbg(); d = ImageDraw.Draw(fr)
        tf = fnt(38); tw, _ = txt_size(title, tf)
        d.text(((vW-tw)//2, 42), title, font=tf, fill=(228, 234, 250, 255))
        if subtitle:
            sf = fnt(22); sw, _ = txt_size(subtitle, sf)
            d.text(((vW-sw)//2, 90), subtitle, font=sf, fill=(148, 158, 182, 200))
        disp = 156; gap = 22
        total = len(keys_list)*disp + (len(keys_list)-1)*gap
        x = vW//2 - total//2
        cy = vH//2 + (16 if subtitle else 8)
        for k in keys_list:
            fr.alpha_composite(k.resize((disp, disp), Image.LANCZOS), dest=(x, cy - disp//2))
            x += disp + gap
        return fr.convert("RGB")

    # Walk through a real match from pre-match to full-time win
    scenes = [
        ("Football Team Tracker", [prematch_key("GER", "POR", "World Cup", days_away=3)], "3 days until kickoff"),
        ("Football Team Tracker", [prematch_key("GER", "POR", "World Cup", days_away=3)], "3 days until kickoff"),
        ("Kickoff imminent", [prematch_key("GER", "POR", "World Cup", imminent=True)], "Under 5 minutes"),
        ("Kickoff imminent", [prematch_key("GER", "POR", "World Cup", imminent=True)], ""),
        ("Live - 0:0", [live_key("GER", "POR", 0, 0, 12, "Group Stage")], "12 minutes"),
        ("Live - 0:0", [live_key("GER", "POR", 0, 0, 28, "Group Stage")], "28 minutes"),
        ("GOAL!", [goal_key("GER", "POR", 1, 0, "J. Musiala")], "Musiala - 23 min"),
        ("GOAL!", [goal_key("GER", "POR", 1, 0, "J. Musiala")], ""),
        ("Live - 1:0", [live_key("GER", "POR", 1, 0, 38, "Group Stage")], ""),
        ("Half time", [live_key("GER", "POR", 1, 0, 45, "Group Stage", display="HALF_TIME")], "1-0 at the break"),
        ("Half time", [live_key("GER", "POR", 1, 0, 45, "Group Stage", display="HALF_TIME")], ""),
        ("Live - 1:1", [live_key("GER", "POR", 1, 1, 67, "Group Stage")], "Equalizer 67 min"),
        ("Live - 1:1", [live_key("GER", "POR", 1, 1, 82, "Group Stage")], "82 minutes"),
        ("Extra time", [live_key("GER", "POR", 1, 1, 105, "Group Stage", display="EXTRA_TIME")], "ET 105+2"),
        ("Full time - WIN", [fulltime_key("GER", "POR", 2, 1, "WIN", hours_ago=1)], "Germany win 2-1"),
        ("Full time - WIN", [fulltime_key("GER", "POR", 2, 1, "WIN", hours_ago=1)], ""),
        # Four more buttons: table position, lineup, top scorers, live stats
        ("League Table", [table_key("MCI", "Premier League", 1, 20, 68, "WWWDW")], "1st place, 68 points"),
        ("League Table", [table_key("ARS", "Premier League", 4, 20, 58, "WDWWL")], "Champions League spot"),
        ("Team Lineup", [lineup_key("ARS", "4-3-3", "Chelsea", is_home=True)], "Confirmed 1h before kickoff"),
        ("Top Scorers", [scorers_key("Premier League", [(1, "Haaland", 19), (2, "Salah", 17), (3, "Saka", 15)])], "Press for the next 3"),
        ("Match Stats", [stats_key("ARS", "CHE", 1, 0, 55, True, [
            ("POSSESSION %", 62, 38), ("SHOTS ON TARGET", 6, 2), ("CORNERS", 7, 3),
        ])], "Live, both teams"),
        # Multi-team showcase
        ("Track any team", [
            flagonly_key("GER", "Germany"),
            flagonly_key("ENG", "England"),
            flagonly_key("BRA", "Brazil"),
        ], "One button per team"),
        ("Track any team", [
            flagonly_key("GER", "Germany"),
            flagonly_key("ENG", "England"),
            flagonly_key("BRA", "Brazil"),
        ], ""),
        # Club teams
        ("Clubs too", [
            live_key("ENG", "FRA", 1, 0, 55, "Premier League"),
            live_key("ESP", "ITA", 0, 0, 23, "Champions League"),
        ], "Any club or national team"),
    ]

    frames = []
    for title, keys, sub in scenes:
        for _ in range(5):
            frames.append(frame(keys, title, sub))

    gif = os.path.join(OUT_DIR, "preview.gif")
    frames[0].save(gif, save_all=True, append_images=frames[1:], duration=80, loop=0, optimize=False)
    print(f"  GIF -> {gif}")

    mp4 = os.path.join(OUT_DIR, "preview.mp4")
    try:
        subprocess.run([
            "ffmpeg", "-i", gif,
            "-vf", "scale=1920:1008:flags=lanczos,pad=1920:1080:0:36:black",
            "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-y", mp4,
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"  MP4 -> {mp4}")
    except Exception as e:
        print(f"  ffmpeg unavailable, GIF only: {e}")


# ── Description ───────────────────────────────────────────────────────────────────

def write_description():
    lines = [
        "Live football scores, league table position, starting lineups, top scorers and match stats on your Stream Deck. Supports Premier League, Champions League, World Cup, La Liga, Bundesliga, Serie A and more - pick your team once and forget about it.",
        "",
        "*Five ways to follow your team, live.*",
        "",
        "Football Team Tracker is five Stream Deck buttons in one plugin, each showing a different piece of the match without ever touching your phone.",
        "",
        "**Live Score** - Score and running match clock updated every 30 seconds. Goal alerts flash the scorer's name. Separate visual states for half-time, extra time and penalties. Polls faster in the final 10 minutes.",
        "**League Table** - Your team's current position, points and last-5 form, color-coded for Champions League, Europa and relegation zones. Redraws every 2 minutes.",
        "**Team Lineup** - Confirmed formation and starting XI, usually announced about an hour before kickoff. Shows TBC until the lineup drops.",
        "**Top Scorers** - The Golden Boot race for any competition. Press the button to page through the next three names.",
        "**Match Stats** - Live possession, shots on target and corners for both teams, side by side, while the match is in progress.",
        "**Pre-match countdown** - Shows the next fixture date and a live countdown to kickoff. Glows amber when kickoff is under 5 minutes away.",
        "**Full-time results** - The last score stays on screen after the final whistle, showing WIN, DRAW or LOSS at a glance.",
        "**Flag only mode** - Display your team's flag without API calls. Useful as a visual bookmark on a crowded deck.",
        "**Competition filter** - Pin any button to one competition (World Cup only, Premier League only) or follow your team across all fixtures.",
        "**100+ teams** - National teams and clubs across all major leagues. Search by name or country in the settings panel.",
        "",
        "Requires a football-data.org API key (sign up is free).",
        "",
        "---",
        "",
        "Part of the Ratpack collection for Stream Deck. Whether you game, stream or track your stats, there is something in the lineup for you.",
        "",
        "football, soccer, football tracker, team tracker, live score, league table, lineup, top scorers, match stats, Premier League, Champions League, World Cup, La Liga, Bundesliga, Serie A, stream deck, sports, goal alert",
    ]
    txt = "\n".join(lines) + "\n"
    path1 = os.path.join(OUT_DIR, "description.txt")
    with open(path1, "w", encoding="utf-8") as f:
        f.write(txt)
    docs_dir = os.path.join(ROOT_DIR, "docs")
    os.makedirs(docs_dir, exist_ok=True)
    path2 = os.path.join(docs_dir, "descriptions.md")
    with open(path2, "w", encoding="utf-8") as f:
        f.write(txt)
    print(f"  description -> {path1}")
    print(f"  description -> {path2}")


# ── Main ──────────────────────────────────────────────────────────────────────────

def main():
    print("Football Team Tracker - generating marketplace art")
    print(f"  output: {OUT_DIR}\n")

    # Listing icons
    make_listing_icon(288).save(os.path.join(OUT_DIR, "icon-288x288.png"))
    make_listing_icon(288).save(os.path.join(OUT_DIR, "icon.png"))
    make_listing_icon(512).save(os.path.join(OUT_DIR, "icon@2x.png"))
    print("  icons done")

    banners = [
        ("1-hero.png",        banner_hero),
        ("2-live.png",        banner_live),
        ("3-table.png",       banner_table),
        ("4-lineup.png",      banner_lineup),
        ("5-scorers.png",     banner_scorers),
        ("6-stats.png",       banner_stats),
        ("7-prematch.png",    banner_prematch),
        ("8-fulltime.png",    banner_fulltime),
        ("9-modes.png",       banner_modes),
        ("10-teams.png",      banner_competitions),
        ("11-statement.png",  banner_statement),
    ]
    for fname, fn in banners:
        print(f"  {fname} ...", end="", flush=True)
        fn().convert("RGB").save(os.path.join(OUT_DIR, fname))
        print(" done")

    print("\n  generating video...")
    gen_video()

    write_description()
    print("\nDone. Check scripts/output/marketing/")

if __name__ == "__main__":
    main()

"""Icon set for Better Hotkeys & Mouse.

Two jobs, two approaches:

KEY IMAGES (144px, on the deck) are drawn here. A keycap seen from the side, plunger
DOWN when held -- the whole product is "the key stays down", so the icon is literally
that. Hand-drawn because the two things that matter can't come from a stock set:
*which* mouse button is bound (left/right/middle), and whether it's held right now.

  Hold   -- a finger-pressure arrow. Down only while you press.
  Toggle -- a latch pin. It stays down on its own.
  Click  -- radiating arcs. Struck, not held.
  Move   -- crosshair and cursor.

LIST GLYPHS (20px, in the action picker) come from Tabler Icons instead. They're drawn
and hinted for exactly that size, where the keycap's travel gap and guide rails turn to
mush. Tabler is MIT, and these PNGs are rasterised from their artwork, so
LICENSE-tabler.txt ships inside the plugin.

Charcoal base, brass accent. ON is filled brass, OFF is dim outline.

Regenerate with:  python tools/gen_icons.py
"""

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
VENDOR = HERE / "vendor"
ROOT = HERE.parent / "com.packrat.betterhotkeys.sdPlugin" / "imgs"

CHARCOAL = (28, 27, 25, 255)
BRASS = (232, 121, 26, 255)
BRASS_DEEP = (150, 74, 14, 255)
DIM = (108, 103, 94, 255)
DIM_DEEP = (68, 65, 60, 255)

SS = 4  # supersample factor


def load_glyphs():
    """Parse the Tabler webfont CSS into {icon-name: character}."""
    css = (VENDOR / "tabler-icons.css").read_text(encoding="utf-8", errors="ignore")
    pairs = re.findall(r'\.ti-([a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"', css)
    return {name: chr(int(code, 16)) for name, code in pairs}


GLYPHS = load_glyphs()
FONT_PATH = str(VENDOR / "tabler-icons.ttf")

# Which Tabler glyph stands in for each action in the picker list. The action's name sits
# right beside it, so these need to be distinct and on-theme rather than self-explanatory.
LIST_GLYPHS = {
    "holdkey": "arrow-bar-to-down",  # pressed down onto a floor
    "togglekey": "toggle-right",  # the universal toggle switch
    "clickmouse": "click",
    "movemouse": "pointer",
    "holdmouse": "hand-click",  # a finger holding a button down
    "togglemouse": "mouse-2",
    "radialselect": "chart-donut",  # a ring with one segment picked out
    "autorepeat": "repeat",
    "mousedrag": "drag-drop",
    "scroll": "arrows-vertical",
    "mutemic": "microphone",
    "pushtotalk": "headset",
    "micvolume": "wave-sine",
    "encoderhotkey": "rotate-clockwise",
}


def render_tabler_glyph(size, name):
    """White Tabler glyph on transparency, for the action list and category icon.

    White because Stream Deck renders these against its own dark chrome and tints them
    itself; every other plugin's list glyphs are flat monochrome, so brass read as an
    odd duck rather than as branding.
    """
    char = GLYPHS.get(name)
    if char is None:
        raise SystemExit(f"Tabler has no glyph named {name!r} -- check tools/vendor/tabler-icons.css")
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_PATH, int(s * 0.82))
    d.text((s / 2, s / 2), char, font=font, fill=(255, 255, 255, 255), anchor="mm")
    return img.resize((size, size), Image.LANCZOS)


def _cap(d, cx, top, w, h, face, edge, stroke):
    """A keycap drawn in side view: a slab with a lit top face."""
    d.rounded_rectangle(
        [cx - w / 2, top, cx + w / 2, top + h],
        radius=h * 0.28,
        fill=edge,
        outline=face,
        width=stroke,
    )
    # Top face catches the light, which is what sells it as a physical key.
    d.line([cx - w / 2 + h * 0.3, top + stroke, cx + w / 2 - h * 0.3, top + stroke], fill=face, width=stroke)


def render_key(size, *, on, toggle):
    """Stream Deck key image. `on` = held, `toggle` = latch variant."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=CHARCOAL)

    face = BRASS if on else DIM
    edge = BRASS_DEEP if on else DIM_DEEP
    stroke = max(1, int(s * 0.030))

    cx = s / 2
    cap_w, cap_h = s * 0.46, s * 0.17

    # The travel gap is the whole idea: pressed sits low, released sits high.
    rest_top = s * 0.44
    down_top = s * 0.58
    cap_top = down_top if on else rest_top

    # Baseplate the key sits on.
    d.line([cx - cap_w * 0.62, s * 0.79, cx + cap_w * 0.62, s * 0.79], fill=edge, width=stroke)

    # Guide rails showing the shaft the cap travels in.
    for sx in (-1, 1):
        x = cx + sx * cap_w * 0.5
        d.line([x, cap_top + cap_h, x, s * 0.79], fill=edge, width=max(1, int(stroke * 0.7)))

    _cap(d, cx, cap_top, cap_w, cap_h, face, edge, stroke)

    if toggle:
        # A latch pin through the cap: it is held by the mechanism, not by you.
        pin_y = cap_top + cap_h / 2
        d.line([cx - cap_w * 0.78, pin_y, cx + cap_w * 0.78, pin_y], fill=face, width=stroke)
        r = s * 0.035
        for sx in (-1, 1):
            x = cx + sx * cap_w * 0.78
            box = [x - r, pin_y - r, x + r, pin_y + r]
            if on:
                d.ellipse(box, fill=face)
            else:
                d.ellipse(box, outline=face, width=max(1, int(stroke * 0.8)))
    else:
        # Finger pressure: an arrow pushing down onto the cap.
        ax = cx
        tip = cap_top - s * 0.045
        tail = tip - s * 0.15
        d.line([ax, tail, ax, tip], fill=face, width=stroke)
        head = s * 0.045
        d.polygon([(ax, tip + head * 0.5), (ax - head, tip - head * 0.7), (ax + head, tip - head * 0.7)], fill=face)

    return img.resize((size, size), Image.LANCZOS)



def _mouse_body(d, cx, cy, w, h, outline, stroke):
    """Mouse silhouette: rounded body with the button split line across the top."""
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=w * 0.45, outline=outline, width=stroke)
    # Split line sits where a real mouse's buttons end.
    split_y = cy - h * 0.12
    d.line([cx - w / 2, split_y, cx + w / 2, split_y], fill=outline, width=stroke)
    d.line([cx, cy - h / 2, cx, split_y], fill=outline, width=stroke)
    return split_y


def render_mouse_key(size, *, button, on=None, motif=None):
    """Key image for the mouse actions.

    `button` is left|right|middle|none. `motif` distinguishes actions that would
    otherwise draw the same picture:
      "click" -- radiating arcs, a button being struck
      "hold"  -- a downward pressure arrow, the same tell Hold Key uses
    """
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=CHARCOAL)

    lit = BRASS if on is not False else DIM
    outline = lit
    stroke = max(1, int(s * 0.032))
    cx, cy = s / 2, s * 0.56
    w, h = s * 0.40, s * 0.50

    split_y = _mouse_body(d, cx, cy, w, h, outline, stroke)

    # Fill only the button being used, so the icon says which one at a glance.
    if button in ("left", "right"):
        x0 = cx - w / 2 if button == "left" else cx
        d.rounded_rectangle(
            [x0 + stroke / 2, cy - h / 2 + stroke / 2, x0 + w / 2 - stroke / 2, split_y - stroke / 2],
            radius=w * 0.2,
            fill=lit,
        )
    elif button == "middle":
        d.line([cx, cy - h * 0.42, cx, split_y], fill=lit, width=stroke * 3)

    if motif == "click":
        # Radiating arcs: something is being struck, not held.
        top = cy - h / 2
        for i, r in enumerate((s * 0.09, s * 0.15)):
            box = [cx - w * 0.25 - r, top - r, cx - w * 0.25 + r, top + r]
            d.arc(box, start=200, end=340, fill=lit, width=max(1, int(stroke * (1.0 - i * 0.25))))
    elif motif == "hold":
        # Same downward pressure arrow as Hold Key, so the two read as a pair.
        tip = cy - h / 2 - s * 0.04
        tail = tip - s * 0.14
        d.line([cx, tail, cx, tip], fill=lit, width=stroke)
        head = s * 0.042
        d.polygon([(cx, tip + head * 0.5), (cx - head, tip - head * 0.7), (cx + head, tip - head * 0.7)], fill=lit)
    elif motif == "toggle":
        # Latch pin, same as Toggle Key: held by the mechanism, not by you.
        pin_y = cy - h / 2 - s * 0.08
        d.line([cx - w * 0.85, pin_y, cx + w * 0.85, pin_y], fill=lit, width=stroke)
        r = s * 0.032
        for sx in (-1, 1):
            x = cx + sx * w * 0.85
            box = [x - r, pin_y - r, x + r, pin_y + r]
            if on:
                d.ellipse(box, fill=lit)
            else:
                d.ellipse(box, outline=lit, width=max(1, int(stroke * 0.8)))

    return img.resize((size, size), Image.LANCZOS)


def render_move_key(size):
    """Move Mouse: crosshair target with a cursor arrow landing on it."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=CHARCOAL)

    stroke = max(1, int(s * 0.032))
    cx, cy = s * 0.46, s * 0.46
    r = s * 0.22

    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=DIM, width=stroke)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        d.line([cx + dx * r * 0.55, cy + dy * r * 0.55, cx + dx * r * 1.45, cy + dy * r * 1.45], fill=DIM, width=stroke)

    # Cursor arrow, brass, sitting on the target centre.
    ax, ay = cx + s * 0.02, cy + s * 0.02
    d.polygon(
        [(ax, ay), (ax, ay + s * 0.24), (ax + s * 0.055, ay + s * 0.175), (ax + s * 0.13, ay + s * 0.175)],
        fill=BRASS,
    )
    return img.resize((size, size), Image.LANCZOS)



def render_marketplace(size):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=CHARCOAL)
    stroke = max(1, int(s * 0.035))
    cx = s / 2
    cap_w, cap_h = s * 0.44, s * 0.16

    # Three caps, the middle one pressed -- the product in one picture.
    for i, sx in enumerate((-1, 0, 1)):
        x = cx + sx * s * 0.26
        pressed = sx == 0
        top = s * 0.54 if pressed else s * 0.42
        face = BRASS if pressed else DIM
        edge = BRASS_DEEP if pressed else DIM_DEEP
        d.line([x - cap_w * 0.5, s * 0.74, x + cap_w * 0.5, s * 0.74], fill=edge, width=stroke)
        _cap(d, x, top, cap_w * 0.8, cap_h, face, edge, stroke)

    return img.resize((size, size), Image.LANCZOS)


def render_radial_key(size):
    """Radial Select: a segmented wheel with one slot lit and a pointer flicked into it."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=CHARCOAL)

    cx = cy = s / 2
    r_out, r_in = s * 0.34, s * 0.15
    box_out = [cx - r_out, cy - r_out, cx + r_out, cy + r_out]

    # Eight dim segments, one lit -- the slot being chosen, up and to the right.
    seg = 45
    lit_index = 1  # 0 = up; 1 = the 45deg slot
    for i in range(8):
        start = i * seg - 90 - seg / 2
        colour = BRASS if i == lit_index else DIM_DEEP
        d.pieslice(box_out, start, start + seg, fill=colour)

    # Punch the hub back out so it reads as a ring of segments.
    d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=CHARCOAL)
    d.ellipse([cx - s * 0.045, cy - s * 0.045, cx + s * 0.045, cy + s * 0.045], fill=BRASS)

    # Pointer flicking toward the lit slot (up-right, 45deg).
    import math

    a = math.radians(45)
    tx, ty = cx + math.sin(a) * r_in * 1.2, cy - math.cos(a) * r_in * 1.2
    ex, ey = cx + math.sin(a) * (r_out - s * 0.02), cy - math.cos(a) * (r_out - s * 0.02)
    d.line([tx, ty, ex, ey], fill=CHARCOAL, width=max(1, int(s * 0.04)))
    return img.resize((size, size), Image.LANCZOS)


def render_repeat_key(size, *, on):
    """Auto-Repeat: two chasing arrows forming a loop; brass when running."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=CHARCOAL)

    import math

    colour = BRASS if on else DIM
    cx = cy = s / 2
    r = s * 0.26
    stroke = max(1, int(s * 0.05))
    box = [cx - r, cy - r, cx + r, cy + r]

    # Two arcs with a gap top and bottom, arrowheads chasing clockwise.
    d.arc(box, start=20, end=160, fill=colour, width=stroke)
    d.arc(box, start=200, end=340, fill=colour, width=stroke)
    for base in (160, 340):
        a = math.radians(base)
        hx, hy = cx + math.cos(a) * r, cy + math.sin(a) * r
        # tangent-ish arrowhead
        t = math.radians(base + 90)
        h = s * 0.05
        d.polygon(
            [
                (hx + math.cos(t) * h, hy + math.sin(t) * h),
                (hx - math.cos(t) * h, hy - math.sin(t) * h),
                (hx + math.cos(a) * h * 1.4, hy + math.sin(a) * h * 1.4),
            ],
            fill=colour,
        )
    return img.resize((size, size), Image.LANCZOS)


def render_drag_key(size):
    """Mouse Drag: a dim start dot, a dashed path, a brass end dot with an arrowhead."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=CHARCOAL)

    ax, ay = s * 0.28, s * 0.68
    bx, by = s * 0.72, s * 0.34
    stroke = max(1, int(s * 0.035))

    # Dashed path A -> B.
    import math

    steps = 7
    for i in range(steps):
        if i % 2:
            continue
        t0, t1 = i / steps, (i + 1) / steps
        d.line(
            [ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1],
            fill=DIM,
            width=stroke,
        )

    r = s * 0.06
    d.ellipse([ax - r, ay - r, ax + r, ay + r], outline=DIM, width=stroke)  # start
    d.ellipse([bx - r, by - r, bx + r, by + r], fill=BRASS)  # end

    # Arrowhead at B, pointing along the path.
    a = math.atan2(by - ay, bx - ax)
    h = s * 0.075
    d.polygon(
        [
            (bx + math.cos(a) * h * 1.6, by + math.sin(a) * h * 1.6),
            (bx + math.cos(a + 2.5) * h, by + math.sin(a + 2.5) * h),
            (bx + math.cos(a - 2.5) * h, by + math.sin(a - 2.5) * h),
        ],
        fill=BRASS,
    )
    return img.resize((size, size), Image.LANCZOS)


def render_scroll_key(size):
    """Scroll: a mouse (wheel lit) with an up/down arrow beside it -- all within bounds."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=CHARCOAL)

    stroke = max(1, int(s * 0.032))
    # Mouse shifted left so the motion arrow has room on the right.
    cx, cy = s * 0.38, s * 0.5
    w, h = s * 0.34, s * 0.46
    split_y = _mouse_body(d, cx, cy, w, h, DIM, stroke)
    d.line([cx, cy - h * 0.42, cx, split_y], fill=BRASS, width=stroke * 3)  # lit wheel

    # Up/down arrow on the right, comfortably inside the tile (y in ~0.24..0.76).
    ax = s * 0.72
    top, bot = s * 0.26, s * 0.74
    head = s * 0.06
    d.line([ax, top, ax, bot], fill=BRASS, width=stroke)
    d.polygon([(ax, top - head * 0.3), (ax - head, top + head), (ax + head, top + head)], fill=BRASS)
    d.polygon([(ax, bot + head * 0.3), (ax - head, bot - head), (ax + head, bot - head)], fill=BRASS)
    return img.resize((size, size), Image.LANCZOS)


def _mic(d, cx, top, s, colour, stroke):
    """A microphone: rounded capsule, arc cradle, stand and base."""
    cap_w, cap_h = s * 0.22, s * 0.34
    d.rounded_rectangle([cx - cap_w / 2, top, cx + cap_w / 2, top + cap_h], radius=cap_w / 2, outline=colour, width=stroke, fill=None)
    # Two grille lines.
    for f in (0.4, 0.62):
        y = top + cap_h * f
        d.line([cx - cap_w / 2 + stroke, y, cx + cap_w / 2 - stroke, y], fill=colour, width=max(1, int(stroke * 0.7)))
    # Cradle arc under the capsule.
    cradle_r = cap_w * 0.95
    cy_arc = top + cap_h * 0.72
    d.arc([cx - cradle_r, cy_arc - cradle_r, cx + cradle_r, cy_arc + cradle_r], start=20, end=160, fill=colour, width=stroke)
    # Stand + base.
    base_y = cy_arc + cradle_r
    d.line([cx, base_y, cx, base_y + s * 0.10], fill=colour, width=stroke)
    d.line([cx - s * 0.10, base_y + s * 0.10, cx + s * 0.10, base_y + s * 0.10], fill=colour, width=stroke)


def render_mic_key(size, *, live, slash=False, arrow=False):
    """Mic key. live -> brass; muted -> dim. slash = red mute bar; arrow = PTT pressure."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=CHARCOAL)

    colour = BRASS if live else DIM
    stroke = max(1, int(s * 0.036))
    cx = s / 2
    top = s * 0.26 if not arrow else s * 0.32

    if arrow:
        # Pressure arrow above, tying PTT to the Hold family.
        tip = top - s * 0.06
        d.line([cx, tip - s * 0.13, cx, tip], fill=colour, width=stroke)
        head = s * 0.045
        d.polygon([(cx, tip + head * 0.5), (cx - head, tip - head * 0.7), (cx + head, tip - head * 0.7)], fill=colour)

    _mic(d, cx, top, s, colour, stroke)

    if slash:
        # Red diagonal bar so "muted" is unmistakable and a little alarming.
        d.line([s * 0.26, s * 0.24, s * 0.74, s * 0.72], fill=(210, 70, 50, 255), width=int(stroke * 1.4))
    return img.resize((size, size), Image.LANCZOS)


def render_micvol_key(size):
    """Mic Volume: a mic with rising level bars."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=CHARCOAL)

    stroke = max(1, int(s * 0.036))
    _mic(d, s * 0.38, s * 0.26, s, BRASS, stroke)

    # Rising bars to the right.
    bx = s * 0.68
    for i in range(3):
        x = bx + i * s * 0.09
        bh = s * (0.10 + i * 0.08)
        d.line([x, s * 0.66, x, s * 0.66 - bh], fill=BRASS, width=int(stroke * 1.3))
    return img.resize((size, size), Image.LANCZOS)


def render_dial_key(size):
    """Encoder Hotkey: a rotary knob seen from above, with a turn arrow either side --
    the dial equivalent of the keycap-with-arrow language the key actions already use."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=CHARCOAL)

    import math

    cx = cy = s / 2
    r_out, r_in = s * 0.26, s * 0.10
    stroke = max(1, int(s * 0.032))

    # Knurled ring: short brass ticks around the rim, like a real rotary knob's grip.
    for i in range(14):
        a = math.radians(i * (360 / 14))
        x0, y0 = cx + math.sin(a) * r_out * 0.82, cy - math.cos(a) * r_out * 0.82
        x1, y1 = cx + math.sin(a) * r_out, cy - math.cos(a) * r_out
        d.line([x0, y0, x1, y1], fill=DIM, width=max(1, int(stroke * 0.8)))

    d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=BRASS, width=stroke)
    d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=CHARCOAL, outline=BRASS_DEEP, width=max(1, int(stroke * 0.7)))
    # Pointer straight up, the knob's "0" mark.
    d.line([cx, cy - r_in * 0.6, cx, cy - r_out * 0.78], fill=BRASS, width=stroke)

    # Curved turn arrows either side, showing it goes both ways.
    for sx, start, end in ((-1, 200, 320), (1, 220, 340)):
        r = s * 0.155
        ax, ay = cx + sx * s * 0.30, cy
        box = [ax - r, ay - r, ax + r, ay + r]
        a0, a1 = (start, end) if sx < 0 else (180 - end, 180 - start)
        d.arc(box, start=a0, end=a1, fill=DIM, width=stroke)

    return img.resize((size, size), Image.LANCZOS)


def save(img, rel):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
    print(f"  {rel}  ({img.width}x{img.height})")


def pair(make, rel, base):
    save(make(base), f"{rel}.png")
    save(make(base * 2), f"{rel}@2x.png")


print("Better Hotkeys & Mouse -- icons")

pair(lambda s: render_key(s, on=False, toggle=False), "actions/holdkey/key", 72)
pair(lambda s: render_key(s, on=True, toggle=False), "actions/holdkey/key_on", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["holdkey"]), "actions/holdkey/icon", 20)

pair(lambda s: render_key(s, on=False, toggle=True), "actions/togglekey/key", 72)
pair(lambda s: render_key(s, on=True, toggle=True), "actions/togglekey/key_on", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["togglekey"]), "actions/togglekey/icon", 20)

BUTTONS = ("left", "right", "middle")

# A variant per mouse button: the action swaps its own image to match what's selected,
# so a key bound to right-click doesn't sit there drawing a left-click.
for b in BUTTONS:
    pair(lambda s, b=b: render_mouse_key(s, button=b, motif="click"), f"actions/clickmouse/key_{b}", 72)
    pair(lambda s, b=b: render_mouse_key(s, button=b, on=False, motif="hold"), f"actions/holdmouse/key_{b}", 72)
    pair(lambda s, b=b: render_mouse_key(s, button=b, on=True, motif="hold"), f"actions/holdmouse/key_{b}_on", 72)
    pair(lambda s, b=b: render_mouse_key(s, button=b, on=False, motif="toggle"), f"actions/togglemouse/key_{b}", 72)
    pair(lambda s, b=b: render_mouse_key(s, button=b, on=True, motif="toggle"), f"actions/togglemouse/key_{b}_on", 72)

# Manifest defaults, used before any settings exist.
pair(lambda s: render_mouse_key(s, button="left", motif="click"), "actions/clickmouse/key", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["clickmouse"]), "actions/clickmouse/icon", 20)

pair(lambda s: render_move_key(s), "actions/movemouse/key", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["movemouse"]), "actions/movemouse/icon", 20)

# Hold Mouse carries the pressure arrow so it can't be mistaken for Click Mouse,
# which is otherwise the same picture.
pair(lambda s: render_mouse_key(s, button="left", on=False, motif="hold"), "actions/holdmouse/key", 72)
pair(lambda s: render_mouse_key(s, button="left", on=True, motif="hold"), "actions/holdmouse/key_on", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["holdmouse"]), "actions/holdmouse/icon", 20)

pair(lambda s: render_mouse_key(s, button="left", on=False, motif="toggle"), "actions/togglemouse/key", 72)
pair(lambda s: render_mouse_key(s, button="left", on=True, motif="toggle"), "actions/togglemouse/key_on", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["togglemouse"]), "actions/togglemouse/icon", 20)

pair(lambda s: render_radial_key(s), "actions/radialselect/key", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["radialselect"]), "actions/radialselect/icon", 20)

pair(lambda s: render_repeat_key(s, on=False), "actions/autorepeat/key", 72)
pair(lambda s: render_repeat_key(s, on=True), "actions/autorepeat/key_on", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["autorepeat"]), "actions/autorepeat/icon", 20)

pair(lambda s: render_drag_key(s), "actions/mousedrag/key", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["mousedrag"]), "actions/mousedrag/icon", 20)

pair(lambda s: render_scroll_key(s), "actions/scroll/key", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["scroll"]), "actions/scroll/icon", 20)

# Mute Mic: live (state 0) vs muted+slash (state 1).
pair(lambda s: render_mic_key(s, live=True), "actions/mutemic/key", 72)
pair(lambda s: render_mic_key(s, live=False, slash=True), "actions/mutemic/key_on", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["mutemic"]), "actions/mutemic/icon", 20)

# Push to Talk: rest (dim, with hold arrow) vs held/live (brass).
pair(lambda s: render_mic_key(s, live=False, arrow=True), "actions/pushtotalk/key", 72)
pair(lambda s: render_mic_key(s, live=True, arrow=True), "actions/pushtotalk/key_on", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["pushtotalk"]), "actions/pushtotalk/icon", 20)

pair(lambda s: render_micvol_key(s), "actions/micvolume/key", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["micvolume"]), "actions/micvolume/icon", 20)

pair(lambda s: render_dial_key(s), "actions/encoderhotkey/key", 72)
pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["encoderhotkey"]), "actions/encoderhotkey/icon", 20)

pair(lambda s: render_tabler_glyph(s, LIST_GLYPHS["holdkey"]), "plugin/category-icon", 28)
pair(lambda s: render_marketplace(s), "plugin/marketplace", 72)

print("done.")

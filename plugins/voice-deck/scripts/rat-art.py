#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = Path(__file__).resolve().parents[3]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from tools.art.marketplace_text import draw_fitted_text
W, H = 1920, 960
BG = (6, 8, 12)
PANEL = (13, 16, 23)
KEY = (18, 22, 30)
WHITE = (247, 249, 252)
MUTED = (165, 176, 192)
ACCENT = (43, 232, 106)
DANGER = (255, 91, 109)
DISCORD = (88, 101, 242)
BORDER = (46, 54, 67)
RAT = REPO / "tools" / "art" / "assets" / "ratpack-icon-transparent.png"

AVATAR_COLORS = [
    (88, 101, 242),
    (87, 162, 224),
    (226, 122, 92),
    (87, 178, 138),
    (190, 95, 153),
    (145, 128, 222),
]


def font(size: int, bold: bool = False):
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    raise SystemExit("Voice Deck Rat Art requires a deterministic UI font")


def background():
    img = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((350, 260, 1450, 1360), fill=(*ACCENT, 20))
    d.ellipse((1280, -420, 2200, 560), fill=(*DISCORD, 26))
    return Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(180)))


def signature(img):
    if RAT.exists():
        rat = Image.open(RAT).convert("RGBA")
        box = rat.getbbox()
        if box:
            rat = rat.crop(box)
        scale = min(44 / rat.width, 44 / rat.height)
        rat = rat.resize((max(1, int(rat.width * scale)), max(1, int(rat.height * scale))), Image.Resampling.LANCZOS)
        img.alpha_composite(rat, ((W - rat.width) // 2, 900 - rat.height // 2))
    else:
        d = ImageDraw.Draw(img)
        d.ellipse((W // 2 - 13, 886, W // 2 + 13, 912), fill=ACCENT)


def title(img, headline, sub=""):
    d = ImageDraw.Draw(img)
    draw_fitted_text(
        d, (96, 58, 1824, 128), headline, font,
        fill=WHITE, max_size=58, min_size=44, bold=True, max_lines=1
    )
    if sub:
        draw_fitted_text(
            d, (98, 138, 1824, 188), sub, font,
            fill=MUTED, max_size=24, min_size=20, max_lines=1
        )


def chip(draw, x, y, value):
    box = draw.textbbox((0, 0), value, font=font(17, True))
    width = box[2] - box[0] + 34
    draw.rounded_rectangle((x, y, x + width, y + 34), 17, fill=(18, 23, 34), outline=(65, 75, 96), width=1)
    draw.text((x + 17, y + 17), value, font=font(17, True), fill=DISCORD, anchor="lm")


def sc(value, size):
    return int(round(value * size / 144.0))


def discord_mark(draw, cx, cy, radius, fill=WHITE):
    """Deterministic Discord-style default-profile glyph for mock member avatars."""
    body_w = radius * 1.28
    body_h = radius * 0.82
    left = cx - body_w / 2
    top = cy - body_h / 2
    right = cx + body_w / 2
    bottom = cy + body_h / 2
    draw.rounded_rectangle((left, top, right, bottom), max(2, int(radius * 0.25)), fill=fill)
    eye_r = max(1, int(radius * 0.10))
    eye_y = cy - radius * 0.04
    draw.ellipse((cx - radius * 0.27 - eye_r, eye_y - eye_r, cx - radius * 0.27 + eye_r, eye_y + eye_r), fill=BG)
    draw.ellipse((cx + radius * 0.27 - eye_r, eye_y - eye_r, cx + radius * 0.27 + eye_r, eye_y + eye_r), fill=BG)
    draw.arc((cx - radius * 0.36, cy - radius * 0.10, cx + radius * 0.36, cy + radius * 0.40), 20, 160, fill=BG, width=max(1, int(radius * 0.09)))


def draw_avatar(draw, x, y, size, color, speaking=False, accent=ACCENT):
    cx, cy = x + sc(72, size), y + sc(59, size)
    avatar_r, ring_r = sc(31, size), sc(35, size)
    ring_color = accent if speaking else (53, 60, 74)
    ring_width = max(3, sc(6 if speaking else 3, size))
    draw.ellipse((cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r), outline=ring_color, width=ring_width)
    draw.ellipse((cx - avatar_r, cy - avatar_r, cx + avatar_r, cy + avatar_r), fill=color)
    discord_mark(draw, cx, cy, avatar_r * 0.70, WHITE)


def draw_mic(draw, x, y, size, active=False):
    color = DANGER if active else ACCENT
    cx, cy = x + sc(72, size), y + sc(55, size)
    width = sc(25, size)
    height = sc(39, size)
    draw.rounded_rectangle((cx - width // 2, cy - height // 2, cx + width // 2, cy + height // 2), max(3, sc(11, size)), outline=color, width=max(3, sc(5, size)))
    draw.arc((cx - sc(27, size), cy - sc(6, size), cx + sc(27, size), cy + sc(42, size)), 0, 180, fill=color, width=max(3, sc(5, size)))
    draw.line((cx, cy + sc(23, size), cx, cy + sc(40, size)), fill=color, width=max(3, sc(5, size)))
    draw.line((cx - sc(15, size), cy + sc(40, size), cx + sc(15, size), cy + sc(40, size)), fill=color, width=max(3, sc(5, size)))
    if active:
        draw.line((cx - sc(29, size), cy - sc(29, size), cx + sc(29, size), cy + sc(29, size)), fill=DANGER, width=max(4, sc(7, size)))


def draw_headphones(draw, x, y, size, active=False):
    color = DANGER if active else ACCENT
    cx, cy = x + sc(72, size), y + sc(57, size)
    radius = sc(30, size)
    draw.arc((cx - radius, cy - radius, cx + radius, cy + radius), 180, 360, fill=color, width=max(4, sc(6, size)))
    ear_w, ear_h = sc(12, size), sc(28, size)
    draw.rounded_rectangle((cx - radius - sc(4, size), cy, cx - radius + ear_w, cy + ear_h), max(2, sc(4, size)), fill=color)
    draw.rounded_rectangle((cx + radius - ear_w, cy, cx + radius + sc(4, size), cy + ear_h), max(2, sc(4, size)), fill=color)
    if active:
        draw.line((cx - sc(31, size), cy - sc(28, size), cx + sc(31, size), cy + sc(30, size)), fill=DANGER, width=max(4, sc(7, size)))


def draw_channel(draw, x, y, size):
    discord_mark(draw, x + sc(72, size), y + sc(55, size), sc(26, size), DISCORD)


def draw_ready(draw, x, y, size):
    cx, cy = x + sc(72, size), y + sc(55, size)
    radius = sc(15, size)
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=ACCENT)
    hole = sc(4, size)
    draw.ellipse((cx - hole, cy - hole, cx + hole, cy + hole), fill=KEY)


def draw_empty(draw, x, y, size):
    cx, cy = x + sc(72, size), y + sc(53, size)
    color = (114, 124, 143)
    radius = sc(11, size)
    draw.ellipse((cx - radius - sc(13, size), cy - radius, cx + radius - sc(13, size), cy + radius), outline=color, width=max(2, sc(3, size)))
    draw.ellipse((cx - radius + sc(14, size), cy - radius, cx + radius + sc(14, size), cy + radius), outline=color, width=max(2, sc(3, size)))
    draw.arc((cx - sc(37, size), cy, cx - sc(1, size), cy + sc(33, size)), 180, 360, fill=color, width=max(2, sc(3, size)))
    draw.arc((cx + sc(1, size), cy, cx + sc(37, size), cy + sc(33, size)), 180, 360, fill=color, width=max(2, sc(3, size)))


def key(draw, x, y, label, state="", accent=ACCENT, avatar=None, speaking=False, icon=None, size=126, active=False):
    radius = max(10, sc(22, size))
    outline = accent if speaking else BORDER
    outline_width = max(2, sc(6 if speaking else 2, size))
    draw.rounded_rectangle((x, y, x + size, y + size), radius, fill=KEY, outline=outline, width=outline_width)

    if avatar is not None:
        draw_avatar(draw, x, y, size, avatar, speaking, accent)
    elif icon == "mute":
        draw_mic(draw, x, y, size, active)
    elif icon == "deafen":
        draw_headphones(draw, x, y, size, active)
    elif icon == "channel":
        draw_channel(draw, x, y, size)
    elif icon == "empty":
        draw_empty(draw, x, y, size)
    else:
        draw_ready(draw, x, y, size)

    if label:
        draw.text((x + size / 2, y + sc(108, size)), label, font=font(max(10, sc(13, size)), True), fill=WHITE, anchor="mm")
    if state:
        state_color = DANGER if active else accent if speaking else MUTED
        draw.text((x + size / 2, y + sc(127, size)), state, font=font(max(8, sc(9, size)), True), fill=state_color, anchor="mm")


def deck_dimensions(cols=5, rows=3, key_size=126, gap=18, pad=30):
    return pad * 2 + cols * key_size + (cols - 1) * gap, pad * 2 + rows * key_size + (rows - 1) * gap


def deck(img, x, y, cols=5, rows=3, keys=None, key_size=126, gap=18):
    keys = keys or []
    pad = 30
    width, height = deck_dimensions(cols, rows, key_size, gap, pad)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((x, y, x + width, y + height), 42, fill=(20, 23, 29), outline=(55, 61, 73), width=3)
    d.rounded_rectangle((x + 12, y + 12, x + width - 12, y + height - 12), 34, outline=(5, 6, 9), width=3)
    for idx in range(cols * rows):
        row, col = divmod(idx, cols)
        spec = keys[idx] if idx < len(keys) else {"label": f"SLOT {idx + 1}", "state": "EMPTY", "icon": "empty"}
        key(d, x + pad + col * (key_size + gap), y + pad + row * (key_size + gap), size=key_size, **spec)


def room_keys():
    return [
        {"label": "VC1", "state": "4 MEMBERS", "icon": "channel", "accent": DISCORD},
        {"label": "MUTE", "state": "READY", "icon": "mute"},
        {"label": "DEAFEN", "state": "READY", "icon": "deafen"},
        {"label": "ALEX", "state": "SPEAKING", "avatar": AVATAR_COLORS[0], "speaking": True},
        {"label": "VOICE DECK", "state": "READY", "icon": "ready"},
        {"label": "YOU", "state": "SPOKE", "avatar": AVATAR_COLORS[1]},
        {"label": "MORIEN", "state": "LISTENING", "avatar": AVATAR_COLORS[2]},
        {"label": "MUGZEY", "state": "DEAFENED", "avatar": AVATAR_COLORS[3], "active": True},
        {"label": "SLOT 5", "state": "EMPTY", "icon": "empty"},
        {"label": "SLOT 6", "state": "EMPTY", "icon": "empty"},
        {"label": "SLOT 7", "state": "EMPTY", "icon": "empty"},
        {"label": "SLOT 8", "state": "EMPTY", "icon": "empty"},
        {"label": "SLOT 9", "state": "EMPTY", "icon": "empty"},
        {"label": "SLOT 10", "state": "EMPTY", "icon": "empty"},
        {"label": "SLOT 11", "state": "EMPTY", "icon": "empty"},
    ]


def hero(out):
    img = background()
    title(img, "Your Discord voice room. On Stream Deck.", "See members, speaking state, mute, deafen and channel changes without opening Discord.")
    d = ImageDraw.Draw(img)
    chip(d, 96, 205, "PACKRAT VOICE DECK FOR DISCORD")
    d.rounded_rectangle((96, 280, 755, 720), 36, fill=(*PANEL, 238), outline=(50, 59, 72), width=2)
    d.text((140, 332), "VOICE CONTROL, AT A GLANCE", font=font(20, True), fill=ACCENT)
    for i, value in enumerate(["SEE WHO'S IN VOICE", "SEE WHO'S TALKING", "MUTE + DEAFEN", "FOLLOW CHANNELS"]):
        d.text((140, 390 + i * 55), value, font=font(31, True), fill=WHITE)
    d.text((140, 640), "$9.99  ONE TIME", font=font(22, True), fill=DISCORD)

    keys = room_keys()
    deck_width, _ = deck_dimensions(5, 3, 112, 14, 30)
    deck_x = 1020
    deck(img, deck_x, 270, keys=keys, key_size=112, gap=14)
    d.text((deck_x + deck_width / 2, 755), "REALISTIC 4 PERSON ROOM  •  EMPTY SLOTS STAY CLEAR", font=font(16, True), fill=MUTED, anchor="mm")
    d.line((80, 850, 1840, 850), fill=(59, 69, 84), width=1)
    signature(img)
    img.convert("RGB").save(out / "02_cover.png", quality=95)


def features(out):
    img = background()
    title(img, "The states you actually care about", "A dashboard that changes with the call instead of a wall of generic member dots.")
    d = ImageDraw.Draw(img)
    examples = [
        ("CURRENT CHANNEL", {"label": "VC1", "state": "4 MEMBERS", "icon": "channel", "accent": DISCORD}, "Always know which room you're in."),
        ("SPEAKER SPOTLIGHT", {"label": "ALEX", "state": "SPEAKING", "avatar": AVATAR_COLORS[0], "speaking": True}, "The active speaker is impossible to miss."),
        ("VOICE STATE", {"label": "MUGZEY", "state": "DEAFENED", "avatar": AVATAR_COLORS[3], "active": True}, "Mute and deafen state reads instantly."),
        ("CONNECTION", {"label": "VOICE DECK", "state": "READY", "icon": "ready"}, "A clear ready state when Discord is connected."),
    ]
    for i, (heading, spec, desc) in enumerate(examples):
        x = 125 + i * 445
        d.rounded_rectangle((x, 255, x + 390, 710), 30, fill=(*PANEL, 235), outline=(48, 57, 70), width=2)
        key(d, x + 90, 310, size=210, **spec)
        draw_fitted_text(
            d, (x + 28, 550, x + 362, 590), heading, font,
            fill=ACCENT if i == 1 else WHITE, max_size=23, min_size=18, bold=True, max_lines=1, align="center"
        )
        draw_fitted_text(
            d, (x + 30, 610, x + 360, 682), desc, font,
            fill=MUTED, max_size=21, min_size=16, spacing=5, max_lines=3, align="center"
        )
    signature(img)
    img.convert("RGB").save(out / "03_gallery_01.png", quality=95)


def dashboard(out):
    img = background()
    title(img, "A real Discord voice dashboard", "Designed around a normal call: a few people, clear states, and unused slots that stay quiet.")
    keys = room_keys()
    deck_width, _ = deck_dimensions(5, 3, 130, 18, 30)
    x = (W - deck_width) // 2
    deck(img, x, 240, keys=keys, key_size=130, gap=18)
    d = ImageDraw.Draw(img)
    d.text((960, 800), "VOICE DASHBOARD  •  MK.2 / 15 KEY", font=font(22, True), fill=MUTED, anchor="mm")
    signature(img)
    img.convert("RGB").save(out / "04_gallery_02.png", quality=95)


def spotlight(out):
    img = background()
    title(img, "Speaking should be obvious", "The spotlight and roster use the same centered avatar geometry at every key size.")
    d = ImageDraw.Draw(img)
    left_x = 230
    key(d, left_x, 280, "ALEX", "SPEAKING", avatar=AVATAR_COLORS[0], speaking=True, size=240)
    draw_fitted_text(
        d, (left_x - 20, 555, left_x + 260, 595), "SPEAKER SPOTLIGHT", font,
        fill=ACCENT, max_size=24, min_size=19, bold=True, max_lines=1, align="center"
    )
    draw_fitted_text(
        d, (left_x - 50, 612, left_x + 290, 690), "Large, centered, and readable. No layout jump when someone talks.", font,
        fill=MUTED, max_size=21, min_size=16, spacing=6, max_lines=3, align="center"
    )

    roster = [
        ("YOU", AVATAR_COLORS[1], "SPOKE", False),
        ("MORIEN", AVATAR_COLORS[2], "LISTENING", False),
        ("MUGZEY", AVATAR_COLORS[3], "DEAFENED", True),
        ("SAM", AVATAR_COLORS[4], "LISTENING", False),
    ]
    for i, (name, color, state, active) in enumerate(roster):
        key(d, 720 + i * 250, 315, name, state, avatar=color, active=active, size=190)
    draw_fitted_text(
        d, (920, 545, 1460, 590), "DYNAMIC MEMBER SLOTS", font,
        fill=WHITE, max_size=24, min_size=19, bold=True, max_lines=1, align="center"
    )
    draw_fitted_text(
        d, (900, 605, 1480, 690), "Members stay in a predictable position. Only their live state changes.", font,
        fill=MUTED, max_size=21, min_size=16, spacing=6, max_lines=3, align="center"
    )
    signature(img)
    img.convert("RGB").save(out / "05_gallery_03.png", quality=95)


def compatibility(out):
    img = background()
    title(img, "Built for your Stream Deck", "Four device-specific profiles with the same readable voice language.")
    d = ImageDraw.Draw(img)
    cards = [
        ("MK.2 / 15 KEY", "10 live member slots", "5 × 3", 5, 3),
        ("STREAM DECK XL", "24 live member slots", "8 × 4", 8, 4),
        ("STREAM DECK +", "Voice Navigator dial", "4 × 2 + dial", 4, 2),
        ("STREAM DECK NEO", "Compact essentials", "4 × 2", 4, 2),
    ]
    for i, (name, desc, shape, cols, rows) in enumerate(cards):
        col = i % 2
        row = i // 2
        x = 120 + col * 860
        y = 235 + row * 275
        d.rounded_rectangle((x, y, x + 780, y + 220), 30, fill=(*PANEL, 235), outline=(51, 60, 73), width=2)
        d.text((x + 38, y + 36), name, font=font(26, True), fill=WHITE)
        d.text((x + 38, y + 80), desc, font=font(18), fill=MUTED)
        d.text((x + 38, y + 126), shape, font=font(17, True), fill=ACCENT if i != 2 else DISCORD)
        gx = x + 420
        gy = y + 45
        cell = 26 if cols <= 5 else 18
        gap = 7
        grid_width = cols * cell + (cols - 1) * gap
        for rr in range(rows):
            for cc in range(cols):
                xx = gx + cc * (cell + gap)
                yy = gy + rr * (cell + gap)
                outline = ACCENT if rr == 0 and cc == min(cols - 1, 3) else BORDER
                d.rounded_rectangle((xx, yy, xx + cell, yy + cell), 6, fill=KEY, outline=outline, width=2)
        d.text((gx + grid_width / 2, y + 178), "PROFILE INCLUDED", font=font(13, True), fill=MUTED, anchor="mm")
    signature(img)
    img.convert("RGB").save(out / "06_gallery_04.png", quality=95)


def search_icon(out):
    img = Image.new("RGBA", (288, 288), (*BG, 255))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((18, 18, 270, 270), 58, fill=KEY, outline=ACCENT, width=8)
    cx, cy = 144, 118
    ring_r = 72
    d.ellipse((cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r), outline=ACCENT, width=10)
    d.ellipse((cx - 61, cy - 61, cx + 61, cy + 61), fill=DISCORD)
    discord_mark(d, cx, cy, 43, WHITE)
    d.text((144, 230), "VOICE", font=font(26, True), fill=WHITE, anchor="mm")
    img.convert("RGB").save(out / "01_search_icon.png", quality=95)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()
    out = Path(args.destination)
    out.mkdir(parents=True, exist_ok=True)
    search_icon(out)
    hero(out)
    features(out)
    dashboard(out)
    spotlight(out)
    compatibility(out)
    required = ["01_search_icon.png", "02_cover.png", "03_gallery_01.png", "04_gallery_02.png", "05_gallery_03.png", "06_gallery_04.png"]
    for name in required:
        path = out / name
        if not path.is_file():
            raise SystemExit(f"Missing Rat Art output: {name}")
        with Image.open(path) as check:
            expected = (288, 288) if name == "01_search_icon.png" else (W, H)
            if check.size != expected:
                raise SystemExit(f"Wrong Rat Art size for {name}: {check.size} != {expected}")
    print(f"Voice Deck Rat Art ready: {out}")


if __name__ == "__main__":
    main()

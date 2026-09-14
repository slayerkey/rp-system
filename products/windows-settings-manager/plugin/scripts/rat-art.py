from __future__ import annotations

import argparse
import math
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
REPO = Path(__file__).resolve().parents[4]
ART_TOOLS = REPO / "tools" / "art"
if str(ART_TOOLS) not in sys.path:
    sys.path.insert(0, str(ART_TOOLS))

from marketplace_text import draw_fitted_text
from streamdeck_photo import alpha_crop_device, compose_device

W, H = 1920, 960
BG = (8, 10, 14)
PANEL = (15, 19, 25)
KEY_BG = (8, 10, 14)
BORDER = (48, 54, 64)
WHITE = (245, 247, 251)
MUTED = (154, 162, 175)
ORANGE = (255, 178, 30)
ORANGE_HOVER = (255, 196, 77)
RED = (255, 93, 108)
GREEN = (43, 232, 106)
NEUTRAL = (139, 147, 161)
RAT = REPO / "tools" / "art" / "assets" / "ratpack-icon-transparent.png"


def font(size: int, bold: bool = False):
    env = os.environ.get("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    candidates = [env] if env else []
    candidates += [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return ImageFont.truetype(candidate, size)
    raise SystemExit("RAT ART FAIL: deterministic marketplace font missing")


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, max_size: int, min_size: int = 16):
    for size in range(max_size, min_size - 1, -1):
        f = font(size, True)
        box = draw.textbbox((0, 0), text, font=f)
        if box[2] - box[0] <= max_width:
            return f
    return font(min_size, True)


def background():
    image = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((1050, -320, 2250, 900), fill=(*ORANGE, 28))
    d.ellipse((-420, 260, 760, 1260), fill=(49, 75, 120, 18))
    return Image.alpha_composite(image, glow.filter(ImageFilter.GaussianBlur(180)))


def signature(image):
    d = ImageDraw.Draw(image)
    d.line((70, 846, W - 70, 846), fill=(67, 73, 84, 150), width=1)
    if not RAT.is_file():
        raise SystemExit(f"RAT ART FAIL: PackRat logo missing: {RAT}")
    rat = Image.open(RAT).convert("RGBA")
    box = rat.getbbox()
    if box:
        rat = rat.crop(box)
    scale = min(46 / rat.width, 46 / rat.height)
    rat = rat.resize(
        (max(1, round(rat.width * scale)), max(1, round(rat.height * scale))),
        Image.Resampling.LANCZOS,
    )
    image.alpha_composite(rat, ((W - rat.width) // 2, 890 - rat.height // 2))


def header(image, headline, subtitle=""):
    d = ImageDraw.Draw(image)
    draw_fitted_text(
        d, (90, 58, 1830, 125), headline, font,
        fill=WHITE, max_size=58, min_size=42, bold=True, max_lines=1
    )
    if subtitle:
        draw_fitted_text(
            d, (94, 138, 1826, 190), subtitle, font,
            fill=MUTED, max_size=25, min_size=19, max_lines=1
        )


def tone_for(title: str, preferred: str = "brand"):
    value = title.upper()
    if "FAILED" in value or "ERROR" in value or "CHECK" in value:
        return "danger"
    if "OFFLINE" in value or "N/A" in value or "UNKNOWN" in value or "EMPTY" in value:
        return "neutral"
    if "READY" in value:
        return "success"
    return preferred


def tone_color(tone: str):
    return {
        "danger": RED,
        "success": GREEN,
        "neutral": NEUTRAL,
        "brand": ORANGE,
    }.get(tone, ORANGE)


def _line(draw, pts, fill=WHITE, width=9, joint="curve"):
    draw.line(pts, fill=fill, width=width, joint=joint)


def draw_icon(draw: ImageDraw.ImageDraw, kind: str, ox: int, oy: int, scale: float):
    def P(x, y):
        return ox + round(x * scale), oy + round(y * scale)

    white = WHITE
    width = max(5, round(5 * scale))

    if kind == "lock":
        x1, y1 = P(51, 50); x2, y2 = P(93, 81)
        draw.rounded_rectangle((x1, y1, x2, y2), radius=max(4, round(6 * scale)), outline=white, width=width)
        draw.arc((*P(59, 28), *P(85, 58)), 180, 360, fill=white, width=width)
        _line(draw, [P(72, 61), P(72, 70)], white, width)
    elif kind == "sleep":
        cx, cy = P(72, 57)
        r = round(29 * scale)
        draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=white)
        cut_x, cut_y = P(82, 48)
        rr = round(26 * scale)
        draw.ellipse((cut_x-rr, cut_y-rr, cut_x+rr, cut_y+rr), fill=KEY_BG)
    elif kind == "hibernate":
        cx, cy = P(66, 55)
        r = round(26 * scale)
        draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=white)
        cut_x, cut_y = P(76, 47)
        rr = round(23 * scale)
        draw.ellipse((cut_x-rr, cut_y-rr, cut_x+rr, cut_y+rr), fill=KEY_BG)
        for angle in (0, 60, 120):
            rad = math.radians(angle)
            dx = math.cos(rad) * 15 * scale
            dy = math.sin(rad) * 15 * scale
            _line(draw, [(round(P(93, 54)[0]-dx), round(P(93, 54)[1]-dy)), (round(P(93, 54)[0]+dx), round(P(93, 54)[1]+dy))], white, max(3, round(3 * scale)))
    elif kind == "restart":
        box = (*P(48, 31), *P(98, 81))
        draw.arc(box, 35, 335, fill=white, width=width)
        _line(draw, [P(91, 31), P(91, 45), P(77, 45)], white, width)
    elif kind == "shutdown":
        box = (*P(45, 35), *P(99, 87))
        draw.arc(box, 310, 230, fill=white, width=width)
        _line(draw, [P(72, 29), P(72, 59)], white, width)
    elif kind == "wifi":
        for box, start, end in [
            (((38, 37), (106, 85)), 215, 325),
            (((49, 50), (95, 84)), 215, 325),
            (((60, 65), (84, 83)), 215, 325),
        ]:
            draw.arc((*P(*box[0]), *P(*box[1])), start, end, fill=white, width=width)
        cx, cy = P(72, 84); rr=max(3, round(3*scale))
        draw.ellipse((cx-rr, cy-rr, cx+rr, cy+rr), fill=white)
    elif kind == "bluetooth":
        pts = [P(64, 27), P(64, 86), P(89, 65), P(64, 47), P(85, 30), P(64, 15), P(64, 86)]
        _line(draw, pts, white, width)
        _line(draw, [P(64, 55), P(50, 44)], white, width)
        _line(draw, [P(64, 61), P(50, 73)], white, width)
    elif kind == "power":
        pts = [P(76, 25), P(52, 59), P(70, 59), P(65, 87), P(92, 49), P(74, 49)]
        draw.polygon(pts, outline=white)
        _line(draw, pts + [pts[0]], white, max(4, round(4*scale)))
    elif kind == "awake":
        pts = [P(37, 59), P(50, 45), P(62, 38), P(72, 35), P(82, 38), P(94, 45), P(107, 59), P(94, 73), P(82, 80), P(72, 83), P(62, 80), P(50, 73), P(37, 59)]
        _line(draw, pts, white, width)
        cx, cy=P(72,59); rr=round(10*scale)
        draw.ellipse((cx-rr,cy-rr,cx+rr,cy+rr), outline=white, width=width)
    elif kind == "theme":
        cx, cy=P(72,57); rr=round(27*scale)
        draw.ellipse((cx-rr,cy-rr,cx+rr,cy+rr), outline=white, width=width)
        draw.pieslice((cx-rr+width//2,cy-rr+width//2,cx+rr-width//2,cy+rr-width//2), -90, 90, fill=white)
    elif kind in {"desktop-previous", "desktop-next", "desktop-new", "desktop-close", "desktop-current"}:
        if kind == "desktop-current":
            a=(43,38,87,71); b=(57,49,101,82)
        elif kind in {"desktop-new","desktop-close"}:
            a=(39,35,81,66); b=(47,43,89,74)
        elif kind == "desktop-previous":
            a=(55,35,97,66); b=(63,43,105,74)
        else:
            a=(39,35,81,66); b=(47,43,89,74)
        draw.rounded_rectangle((*P(a[0],a[1]),*P(a[2],a[3])), radius=max(3,round(4*scale)), outline=white, width=width)
        draw.rounded_rectangle((*P(b[0],b[1]),*P(b[2],b[3])), radius=max(3,round(4*scale)), outline=white, width=width)
        if kind == "desktop-previous":
            _line(draw, [P(42,58),P(26,58),P(36,48),P(26,58),P(36,68)], white, width)
        elif kind == "desktop-next":
            _line(draw, [P(102,58),P(118,58),P(108,48),P(118,58),P(108,68)], white, width)
        elif kind == "desktop-new":
            _line(draw, [P(110,47),P(110,69)], white, width)
            _line(draw, [P(99,58),P(121,58)], white, width)
        elif kind == "desktop-close":
            _line(draw, [P(101,49),P(119,67)], white, width)
            _line(draw, [P(119,49),P(101,67)], white, width)
    else:
        draw.rounded_rectangle((*P(50,36), *P(94,80)), radius=max(3, round(5*scale)), outline=white, width=width)


def render_key(kind: str, title: str, preferred_tone: str = "brand", size: int = 288):
    scale = size / 144.0
    image = Image.new("RGBA", (size, size), (*KEY_BG, 255))
    d = ImageDraw.Draw(image)
    border = round(4 * scale)
    d.rounded_rectangle(
        (round(4*scale), round(4*scale), size-round(4*scale), size-round(4*scale)),
        radius=round(21*scale),
        outline=BORDER,
        width=max(3, round(3*scale)),
    )
    tone = tone_for(title, preferred_tone)
    accent = tone_color(tone)
    d.line(
        (round(22*scale), round(12*scale), size-round(22*scale), round(12*scale)),
        fill=accent,
        width=max(4, round(4*scale)),
    )
    draw_icon(d, kind, 0, 0, scale)

    lines = [line.strip() for line in title.split("\n") if line.strip()][:2] or ["N/A"]
    longest = max(len(line) for line in lines)
    base = 23 if longest <= 5 else 20 if longest <= 8 else 17 if longest <= 11 else 15
    f = font(round(base * scale), True)
    ys = [round(124*scale)] if len(lines) == 1 else [round(111*scale), round(133*scale)]
    for line, y in zip(lines, ys):
        d.text((size//2, y), line, font=f, fill=WHITE, anchor="mm")
    return image


PRO_KEYS = [
    ("lock", "LOCK\nPC", "brand"),
    ("sleep", "SLEEP\nPC", "brand"),
    ("hibernate", "HIBER\nN/A", "brand"),
    ("restart", "RESTART", "danger"),
    ("shutdown", "SHUTDOWN", "danger"),
    ("wifi", "WI-FI\nN/A", "brand"),
    ("bluetooth", "BT\nN/A", "brand"),
    ("power", "POWER\nPERFORM", "brand"),
    ("awake", "SLEEP\nNORMAL", "brand"),
    ("theme", "THEME\nDARK", "brand"),
    ("desktop-previous", "DESK\nPREV", "brand"),
    ("desktop-next", "DESK\nNEXT", "brand"),
    ("desktop-new", "DESK\nNEW", "brand"),
    ("desktop-close", "DESK\nCLOSE", "danger"),
    ("desktop-current", "DESKTOP\n2 / 3", "brand"),
]

LITE_KEYS = [
    ("lock", "LOCK\nPC", "brand"),
    ("sleep", "SLEEP\nPC", "brand"),
    ("power", "POWER\nPERFORM", "brand"),
    ("awake", "SLEEP\nNORMAL", "brand"),
    ("desktop-previous", "DESK\nPREV", "brand"),
    ("desktop-next", "DESK\nNEXT", "brand"),
]


def blank_key():
    image = Image.new("RGBA", (288, 288), (*KEY_BG, 255))
    d = ImageDraw.Draw(image)
    d.rounded_rectangle((8, 8, 280, 280), radius=42, outline=BORDER, width=6)
    return image


def export_key_faces(output: Path, flavor: str):
    key_dir = output / "rat-art-keys"
    key_dir.mkdir(parents=True, exist_ok=True)
    specs = PRO_KEYS if flavor == "pro" else LITE_KEYS
    faces = [render_key(*spec) for spec in specs]
    while len(faces) < 15:
        faces.append(blank_key())
    for index, face in enumerate(faces[:15]):
        face.save(key_dir / f"{index:02d}.png", "PNG", optimize=True)
    return faces[:15], key_dir


def device_from_faces(faces, max_box=(1180, 590)):
    result = compose_device(faces)
    if result.uncovered_pixels != 0 or len(result.holes) != 15:
        raise SystemExit("RAT ART FAIL: Stream Deck device compositor did not cover all 15 LCDs")
    device = alpha_crop_device(result.device)
    scale = min(max_box[0] / device.width, max_box[1] / device.height)
    return device.resize(
        (max(1, round(device.width * scale)), max(1, round(device.height * scale))),
        Image.Resampling.LANCZOS,
    )


def card(draw, box):
    draw.rounded_rectangle(box, radius=28, fill=(*PANEL, 245), outline=(*BORDER, 255), width=2)


def paste_key(image, face, center, size):
    key = face.resize((size, size), Image.Resampling.LANCZOS)
    image.alpha_composite(key, (round(center[0] - size/2), round(center[1] - size/2)))


def chip(draw, x, y, text, accent=ORANGE):
    f = font(17, True)
    box = draw.textbbox((0, 0), text, font=f)
    width = box[2] - box[0] + 34
    draw.rounded_rectangle((x, y, x + width, y + 34), radius=17, fill=(21, 24, 31), outline=(61, 68, 78), width=1)
    draw.text((x + 17, y + 17), text, font=f, fill=accent, anchor="lm")
    return width


def cover(output: Path, flavor: str, faces):
    image = background()
    headline = "WINDOWS CONTROL CENTER" if flavor == "pro" else "WINDOWS ESSENTIALS"
    subtitle = (
        "The exact 15-key Pro profile, with live Windows state on the keys."
        if flavor == "pro"
        else "Six useful Windows controls, ready to drop onto Stream Deck."
    )
    header(image, headline, subtitle)
    device = device_from_faces(faces, (1220, 600))
    image.alpha_composite(device, ((W - device.width)//2, 215))
    d = ImageDraw.Draw(image)
    if flavor == "pro":
        labels = ["PC POWER", "LIVE WINDOWS STATE", "VIRTUAL DESKTOPS"]
    else:
        labels = ["LOCK + SLEEP", "POWER + KEEP AWAKE", "DESKTOP SWITCHING"]
    widths = [d.textbbox((0,0), label, font=font(17, True))[2] + 34 for label in labels]
    total = sum(widths) + 24 * (len(labels)-1)
    x = (W-total)//2
    for label, width in zip(labels, widths):
        chip(d, x, 782, label)
        x += width + 24
    signature(image)
    image.convert("RGB").save(output / "02_cover.png", "PNG", optimize=True)


def actual_profile_gallery(output: Path, flavor: str, faces):
    image = background()
    if flavor == "pro":
        header(image, "THE PROFILE YOU ACTUALLY USE", "The Marketplace art now shows the same 5 x 3 Windows Control Center layout customers install.")
        device = device_from_faces(faces, (1340, 640))
        image.alpha_composite(device, ((W-device.width)//2, 195))
    else:
        header(image, "THE SIX WINDOWS ESSENTIALS", "Lite stays deliberately small: one broad use case, six controls that are useful on their own.")
        d = ImageDraw.Draw(image)
        card(d, (190, 235, 1730, 725))
        centers = [(470,390),(760,390),(1050,390),(1340,390),(680,625),(1160,625)]
        for face, center in zip(faces[:6], centers):
            paste_key(image, face, center, 205)
    signature(image)
    image.convert("RGB").save(output / "03_gallery_01.png", "PNG", optimize=True)


def live_state_gallery(output: Path, flavor: str, faces):
    image = background()
    header(image, "LIVE WINDOWS STATE, RIGHT ON THE KEYS", "The buttons show what Windows is doing instead of just firing blind commands.")
    d = ImageDraw.Draw(image)
    if flavor == "pro":
        items = [
            (faces[7], "POWER PLAN", "See the active plan."),
            (faces[8], "KEEP AWAKE", "Normal sleep vs Stay Awake."),
            (faces[9], "THEME", "Light, Dark, or Mixed."),
            (faces[14], "CURRENT DESKTOP", "Know exactly where you are."),
        ]
    else:
        items = [
            (faces[2], "POWER PLAN", "See the active plan."),
            (faces[3], "KEEP AWAKE", "Normal sleep vs Stay Awake."),
            (faces[4], "DESKTOP PREV", "One press to move left."),
            (faces[5], "DESKTOP NEXT", "One press to move right."),
        ]

    for i, (face, head, body) in enumerate(items):
        x = 105 + i * 445
        card(d, (x, 240, x + 390, 735))
        paste_key(image, face, (x + 195, 405), 245)
        draw_fitted_text(
            d, (x + 28, 550, x + 362, 590), head, font,
            fill=ORANGE, max_size=23, min_size=18, bold=True, max_lines=1, align="center"
        )
        draw_fitted_text(
            d, (x + 34, 615, x + 356, 690), body, font,
            fill=MUTED, max_size=21, min_size=16, max_lines=2, align="center", spacing=5
        )
    signature(image)
    image.convert("RGB").save(output / "04_gallery_02.png", "PNG", optimize=True)


def desktop_gallery(output: Path, flavor: str, faces):
    image = background()
    if flavor == "pro":
        header(image, "VIRTUAL DESKTOPS FEEL MADE FOR STREAM DECK", "Previous, Next, New, Close, and Current Desktop are all visible in one physical row.")
        selected = faces[10:15]
        labels = ["PREVIOUS", "NEXT", "NEW", "CLOSE", "CURRENT"]
        start_x = 250
        gap = 300
        for i, (face, label) in enumerate(zip(selected, labels)):
            x = start_x + i * gap
            paste_key(image, face, (x, 455), 230)
            ImageDraw.Draw(image).text((x, 610), label, font=font(19, True), fill=ORANGE if label != "CLOSE" else RED, anchor="mm")
    else:
        header(image, "SWITCH DESKTOPS WITH ONE PRESS", "One of the most useful Windows shortcuts becomes two obvious physical buttons.")
        d = ImageDraw.Draw(image)
        card(d, (300, 235, 1620, 735))
        paste_key(image, faces[4], (700, 465), 310)
        paste_key(image, faces[5], (1220, 465), 310)
        draw_fitted_text(
            d, (430, 650, 1490, 705), "Move between Windows virtual desktops without remembering Ctrl + Win + Arrow.", font,
            fill=MUTED, max_size=27, min_size=21, max_lines=1, align="center"
        )
    signature(image)
    image.convert("RGB").save(output / "05_gallery_03.png", "PNG", optimize=True)


def final_gallery(output: Path, flavor: str, faces):
    image = background()
    d = ImageDraw.Draw(image)
    if flavor == "pro":
        header(image, "SAFE WHEN IT MATTERS", "Destructive actions are protected, and unavailable capabilities say N/A instead of pretending.")
        items = [
            (faces[3], "RESTART", "Second press required by default."),
            (faces[4], "SHUTDOWN", "Second press required by default."),
            (faces[5], "WI-FI", "N/A when Windows cannot expose the radio."),
            (faces[6], "BLUETOOTH", "N/A when the radio is unavailable."),
        ]
        for i, (face, head, body) in enumerate(items):
            x = 105 + i * 445
            card(d, (x, 245, x + 390, 725))
            paste_key(image, face, (x+195, 405), 235)
            draw_fitted_text(
                d, (x+30, 545, x+360, 585), head, font,
                fill=RED if i < 2 else NEUTRAL, max_size=23, min_size=18, bold=True, max_lines=1, align="center"
            )
            draw_fitted_text(
                d, (x+35, 610, x+355, 685), body, font,
                fill=MUTED, max_size=19, min_size=15, max_lines=2, align="center", spacing=5
            )
    else:
        header(image, "WHEN YOU WANT THE WHOLE CONTROL CENTER", "Pro takes the same everyday Windows use case and fills out the rest of the 5 x 3 deck.")
        pro_tease = [
            render_key("hibernate", "HIBER\nN/A"),
            render_key("restart", "RESTART", "danger"),
            render_key("bluetooth", "BT\nN/A"),
            render_key("theme", "THEME\nDARK"),
            render_key("desktop-current", "DESKTOP\n2 / 3"),
        ]
        d.text((320, 285), "LITE", font=font(23, True), fill=WHITE)
        for i, face in enumerate(faces[:6]):
            row, col = divmod(i, 3)
            paste_key(image, face, (260 + col*205, 425 + row*205), 165)
        d.text((1120, 285), "PRO ADDS", font=font(23, True), fill=ORANGE)
        for i, face in enumerate(pro_tease):
            paste_key(image, face, (980 + i*185, 500), 155)
        draw_fitted_text(
            d, (910, 635, 1760, 705), "Hibernate, protected power actions, connectivity, theme, full desktop management, and more.", font,
            fill=MUTED, max_size=24, min_size=18, max_lines=2, align="center", spacing=5
        )
    signature(image)
    image.convert("RGB").save(output / "06_gallery_04.png", "PNG", optimize=True)


def search_icon(output: Path):
    image = Image.new("RGBA", (288, 288), (*KEY_BG, 255))
    d = ImageDraw.Draw(image)
    d.rounded_rectangle((14, 14, 274, 274), radius=54, fill=KEY_BG, outline=BORDER, width=5)
    d.rounded_rectangle((26, 26, 262, 34), radius=4, fill=ORANGE)
    tile = 62
    gap = 14
    start_x = 75
    start_y = 78
    for row in range(2):
        for col in range(2):
            x = start_x + col * (tile + gap)
            y = start_y + row * (tile + gap)
            d.rounded_rectangle((x, y, x + tile, y + tile), radius=10, outline=WHITE, width=7)
    image.convert("RGB").save(output / "01_search_icon.png", "PNG", optimize=True)


def validate(output: Path):
    expected = {
        "01_search_icon.png": (288, 288),
        "02_cover.png": (1920, 960),
        "03_gallery_01.png": (1920, 960),
        "04_gallery_02.png": (1920, 960),
        "05_gallery_03.png": (1920, 960),
        "06_gallery_04.png": (1920, 960),
    }
    digests = {}
    import hashlib
    for name, size in expected.items():
        path = output / name
        if not path.is_file():
            raise SystemExit(f"RAT ART FAIL: missing {name}")
        with Image.open(path) as image:
            if image.size != size:
                raise SystemExit(f"RAT ART FAIL: {name} is {image.size}, expected {size}")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest in digests:
            raise SystemExit(f"RAT ART FAIL: {name} is byte-identical to {digests[digest]}")
        digests[digest] = name

    key_dir = output / "rat-art-keys"
    keys = sorted(key_dir.glob("*.png"))
    if len(keys) != 15:
        raise SystemExit(f"RAT ART FAIL: expected 15 product key faces, found {len(keys)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--flavor", choices=["lite", "pro"], required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    faces, _ = export_key_faces(args.output, args.flavor)
    search_icon(args.output)
    cover(args.output, args.flavor, faces)
    actual_profile_gallery(args.output, args.flavor, faces)
    live_state_gallery(args.output, args.flavor, faces)
    desktop_gallery(args.output, args.flavor, faces)
    final_gallery(args.output, args.flavor, faces)
    validate(args.output)
    print(f"Windows Settings Manager {args.flavor} Rat Art ready: {args.output}")


if __name__ == "__main__":
    main()

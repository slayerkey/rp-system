#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[3]
W, H = 1920, 960
SAFE = 72
BG = (6, 10, 15)
PANEL = (17, 24, 32)
KEY = (20, 29, 39)
WHITE = (246, 249, 252)
MUTED = (169, 180, 194)
ACC = (86, 242, 165)
WARN = (255, 204, 102)
RED = (255, 107, 118)
LINE = (53, 66, 79)
RAT = ROOT / "tools" / "art" / "assets" / "ratpack-icon-transparent.png"


def fail(message: str) -> None:
    raise SystemExit(f"RAT ART FAIL: {message}")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    env = os.getenv("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    candidates = [env] if env else []
    if os.name == "nt":
        candidates += [
            r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\bahnschrift.ttf",
            r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        ]
    else:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    fail("required deterministic marketplace font was not found; no silent fallback is allowed")


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, max_size: int, min_size: int = 18, bold: bool = True):
    for size in range(max_size, min_size - 1, -2):
        f = font(size, bold)
        box = draw.textbbox((0, 0), text, font=f)
        if box[2] - box[0] <= max_width:
            return f
    return font(min_size, bold)


def background() -> Image.Image:
    base = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((260, 145, 1660, 1180), fill=(*ACC, 20))
    d.ellipse((-300, -250, 620, 560), fill=(32, 103, 93, 18))
    d.ellipse((1320, -220, 2210, 560), fill=(55, 88, 133, 16))
    return Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(170)))


def packrat_mark(canvas: Image.Image, center_x: int, center_y: int, size: int = 48) -> None:
    if not RAT.exists():
        fail(f"canonical PackRat mark is missing: {RAT}")
    rat = Image.open(RAT).convert("RGBA")
    box = rat.getbbox()
    if not box:
        fail("canonical PackRat mark is empty")
    rat = rat.crop(box)
    scale = min(size / rat.width, size / rat.height)
    rat = rat.resize((max(1, int(rat.width * scale)), max(1, int(rat.height * scale))), Image.Resampling.LANCZOS)
    canvas.alpha_composite(rat, (center_x - rat.width // 2, center_y - rat.height // 2))


def hero_chrome(canvas: Image.Image, left: str = "AUDIO PROFILES", right: str = "STREAM DECK · WINDOWS") -> None:
    d = ImageDraw.Draw(canvas)
    packrat_mark(canvas, W // 2, 66, 52)
    d.text((SAFE, 66), left, font=font(23, True), fill=WHITE, anchor="lm")
    d.text((W - SAFE, 66), right, font=font(20, True), fill=ACC, anchor="rm")


def footer(canvas: Image.Image, left: str = "WINDOWS AUDIO", right: str = "STREAM DECK") -> None:
    d = ImageDraw.Draw(canvas)
    d.line((SAFE, 850, W - SAFE, 850), fill=(*LINE, 160), width=1)
    d.text((SAFE, 900), left, font=font(18, True), fill=MUTED, anchor="lm")
    d.text((W - SAFE, 900), right, font=font(18, True), fill=MUTED, anchor="rm")
    packrat_mark(canvas, W // 2, 900, 42)


def heading(canvas: Image.Image, headline: str, sub: str | None = None) -> None:
    d = ImageDraw.Draw(canvas)
    f = fit_font(d, headline, 1500, 62, 36, True)
    d.text((W // 2, 108), headline, font=f, fill=WHITE, anchor="mm")
    if sub:
        sf = fit_font(d, sub, 1580, 27, 19, False)
        d.text((W // 2, 165), sub, font=sf, fill=MUTED, anchor="mm")


def audio_key(d: ImageDraw.ImageDraw, x: int, y: int, size: int, label: str, out_name: str, in_name: str, accent=ACC, active: bool = False) -> None:
    radius = int(size * 0.14)
    border = accent if active else LINE
    d.rounded_rectangle((x, y, x + size, y + size), radius, fill=KEY, outline=border, width=5 if active else 3)

    d.text(
        (x + size // 2, y + int(size * 0.31)),
        label,
        font=fit_font(d, label, size - 44, 28, 17, True),
        fill=WHITE,
        anchor="mm",
    )
    badge = "ACTIVE" if active else "PROFILE"
    badge_color = accent if active else MUTED
    d.text(
        (x + size // 2, y + int(size * 0.53)),
        badge,
        font=font(max(13, int(size * 0.052)), True),
        fill=badge_color,
        anchor="mm",
    )

    line_y = y + int(size * 0.73)
    d.line(
        (x + int(size * 0.25), line_y, x + int(size * 0.75), line_y),
        fill=badge_color,
        width=max(6, int(size * 0.026)),
    )
    knob = max(8, int(size * 0.038))
    d.ellipse(
        (x + size // 2 - knob, line_y - knob, x + size // 2 + knob, line_y + knob),
        fill=WHITE if active else badge_color,
    )

    # OUT / IN are marketing annotations below the real key face, not fabricated key UI.
    annotation_y = y + size + 42
    tag_font = font(max(12, int(size * 0.048)), True)
    value_font = fit_font(d, out_name, size - 78, 17, 13, True)
    d.text((x + 12, annotation_y), "OUT", font=tag_font, fill=ACC, anchor="lm")
    d.text((x + 74, annotation_y), out_name, font=value_font, fill=WHITE, anchor="lm")
    value_font = fit_font(d, in_name, size - 78, 17, 13, True)
    d.text((x + 12, annotation_y + 34), "IN", font=tag_font, fill=ACC, anchor="lm")
    d.text((x + 74, annotation_y + 34), in_name, font=value_font, fill=WHITE, anchor="lm")


def save_cover(out: Path) -> None:
    im = background()
    hero_chrome(im)
    d = ImageDraw.Draw(im)

    d.text((W // 2, 151), "ONE KEY. YOUR WHOLE AUDIO SETUP.", font=fit_font(d, "ONE KEY. YOUR WHOLE AUDIO SETUP.", 1500, 51, 32, True), fill=WHITE, anchor="mm")

    specs = [
        ("HEADSET", "Headset", "Headset Mic"),
        ("SPEAKERS", "Speakers", "Desk Mic"),
        ("MEETING", "Headset", "Shure Mic"),
        ("STREAMING", "Monitor", "Broadcast Mic"),
        ("VR", "VR Headset", "VR Mic"),
    ]
    key_size, gap = 300, 40
    total = key_size * 5 + gap * 4
    start = (W - total) // 2
    for index, spec in enumerate(specs):
        audio_key(d, start + index * (key_size + gap), 255, key_size, *spec, active=index == 2)

    d.rounded_rectangle((390, 724, 1530, 807), 28, fill=(18, 45, 38, 230), outline=ACC, width=2)
    d.text((W // 2, 766), "OUTPUT + INPUT + COMMUNICATIONS ROLES + SAVED STATE", font=fit_font(d, "OUTPUT + INPUT + COMMUNICATIONS ROLES + SAVED STATE", 1060, 23, 17, True), fill=ACC, anchor="mm")
    im.convert("RGB").save(out / "02_cover.png", quality=95)


def gallery_roles(out: Path) -> None:
    im = background()
    heading(im, "One profile can own all four Windows audio roles.", "Games, system audio, calls, and voice apps do not always follow the same Windows default.")
    d = ImageDraw.Draw(im)
    roles = [
        ("DEFAULT OUTPUT", "Speakers", "games + system"),
        ("COMM OUTPUT", "Headset", "calls + voice"),
        ("DEFAULT INPUT", "Shure MV7", "primary mic"),
        ("COMM INPUT", "Headset Mic", "call mic"),
    ]
    x0, card_w, gap = 106, 397, 42
    for i, (role, name, purpose) in enumerate(roles):
        x = x0 + i * (card_w + gap)
        d.rounded_rectangle((x, 280, x + card_w, 635), 30, fill=PANEL, outline=LINE, width=2)
        d.text((x + card_w // 2, 349), role, font=font(18, True), fill=ACC, anchor="mm")
        d.text((x + card_w // 2, 453), name, font=fit_font(d, name, card_w - 54, 33, 20, True), fill=WHITE, anchor="mm")
        d.text((x + card_w // 2, 512), purpose, font=font(17), fill=MUTED, anchor="mm")
        d.line((x + 95, 570, x + card_w - 95, 570), fill=ACC, width=7)
        d.ellipse((x + card_w // 2 - 13, 557, x + card_w // 2 + 13, 583), fill=WHITE)
    d.rounded_rectangle((617, 690, 1303, 777), 24, fill=(18, 45, 38), outline=ACC, width=2)
    d.text((W // 2, 734), "APPLY PROFILE  →  SUCCESS", font=font(27, True), fill=WHITE, anchor="mm")
    footer(im)
    im.convert("RGB").save(out / "03_gallery_01.png", quality=95)


def gallery_state(out: Path) -> None:
    im = background()
    heading(im, "Save the state, not just the device.", "Restore the useful volume and mute state alongside routing when a profile needs it.")
    d = ImageDraw.Draw(im)

    items = [
        ("HEADSET OUTPUT", "42%", "UNMUTED", "default + communications"),
        ("SHURE MIC", "76%", "UNMUTED", "default input"),
    ]
    for i, (name, vol, mute, scope) in enumerate(items):
        x = 250 + i * 770
        d.rounded_rectangle((x, 285, x + 650, 660), 36, fill=PANEL, outline=LINE, width=2)
        d.text((x + 50, 350), name, font=font(20, True), fill=ACC)
        d.text((x + 50, 440), vol, font=font(66, True), fill=WHITE)
        d.text((x + 285, 431), mute, font=font(21, True), fill=MUTED)
        d.text((x + 50, 505), scope, font=font(18), fill=MUTED)
        d.rounded_rectangle((x + 50, 555, x + 600, 612), 18, fill=(13, 19, 27))
        d.text((x + 325, 584), "ROUTING + VOLUME + MUTE", font=font(16, True), fill=WHITE, anchor="mm")

    d.text((W // 2, 744), "Volume and mute restore are opt-in per profile role.", font=font(22, True), fill=ACC, anchor="mm")
    footer(im)
    im.convert("RGB").save(out / "04_gallery_02.png", quality=95)


def gallery_resilience(out: Path) -> None:
    im = background()
    heading(im, "Reconnected device? Safe match. Wrong device? Stop.", "Profiles keep hardware identity metadata instead of trusting one fragile endpoint ID.")
    d = ImageDraw.Draw(im)

    stages = [
        ("1", "ENDPOINT CHANGED", "USB / Bluetooth reconnect", ACC),
        ("2", "CHECK HARDWARE ID", "instance + container metadata", ACC),
        ("3", "SAFE REBIND", "only when identity is strong", ACC),
        ("!", "REBIND REQUIRED", "never guess by name alone", WARN),
    ]
    x0, card_w, gap = 98, 402, 38
    for i, (badge, title, body, color) in enumerate(stages):
        x = x0 + i * (card_w + gap)
        d.rounded_rectangle((x, 294, x + card_w, 624), 30, fill=PANEL, outline=color if i == 3 else LINE, width=3)
        d.ellipse((x + 34, 330, x + 104, 400), fill=(25, 52, 45) if color == ACC else (70, 54, 25))
        d.text((x + 69, 365), badge, font=font(26, True), fill=color, anchor="mm")
        d.text((x + card_w // 2, 455), title, font=fit_font(d, title, card_w - 38, 23, 16, True), fill=WHITE, anchor="mm")
        d.text((x + card_w // 2, 514), body, font=fit_font(d, body, card_w - 52, 18, 14, False), fill=MUTED, anchor="mm")
        d.text((x + card_w // 2, 574), "SAFE" if i < 3 else "NO SILENT FALLBACK", font=font(15, True), fill=color, anchor="mm")

    d.text((W // 2, 736), "SUCCESS  ·  PARTIAL  ·  FAILED", font=font(31, True), fill=WHITE, anchor="mm")
    footer(im)
    im.convert("RGB").save(out / "05_gallery_03.png", quality=95)


def gallery_dial(out: Path) -> None:
    im = background()
    heading(im, "Stream Deck+ gets a profile-aware output dial.", "Rotate volume. Press to reapply the whole profile. Touch to toggle profile output mute.")
    d = ImageDraw.Draw(im)

    d.rounded_rectangle((495, 265, 1425, 675), 44, fill=PANEL, outline=LINE, width=3)
    d.text((960, 340), "MEETING", font=font(32, True), fill=WHITE, anchor="mm")
    d.text((960, 398), "Headset · 42%", font=font(23), fill=MUTED, anchor="mm")
    d.line((660, 500, 1260, 500), fill=(52, 65, 79), width=22)
    d.line((660, 500, 912, 500), fill=ACC, width=22)
    d.ellipse((890, 478, 934, 522), fill=WHITE)

    labels = [("ROTATE", "volume"), ("PRESS", "apply profile"), ("TOUCH", "mute output")]
    for i, (verb, action) in enumerate(labels):
        x = 655 + i * 305
        d.text((x, 589), verb, font=font(17, True), fill=ACC, anchor="mm")
        d.text((x, 621), action, font=font(15), fill=MUTED, anchor="mm")

    d.text((W // 2, 744), "The dial follows the selected Audio Profile's primary output.", font=font(21, True), fill=WHITE, anchor="mm")
    footer(im, right="STREAM DECK +")
    im.convert("RGB").save(out / "06_gallery_04.png", quality=95)


def search_icon(out: Path) -> None:
    im = Image.new("RGBA", (288, 288), (*BG, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((18, 18, 270, 270), 56, fill=KEY, outline=ACC, width=8)
    for y, cx in ((82, 103), (144, 181), (206, 127)):
        d.line((62, y, 226, y), fill=WHITE, width=11)
        d.ellipse((cx - 19, y - 19, cx + 19, y + 19), fill=ACC)
    im.convert("RGB").save(out / "01_search_icon.png", quality=95)


def thumbnail_review(out: Path) -> None:
    cover = Image.open(out / "02_cover.png").convert("RGB")
    sizes = [(480, 240), (320, 160), (240, 120)]
    canvas = Image.new("RGB", (560, 650), BG)
    d = ImageDraw.Draw(canvas)
    d.text((28, 28), "AUDIO MANAGER PRO · V2 THUMBNAIL REVIEW", font=font(18, True), fill=WHITE)
    y = 74
    for width, height in sizes:
        shot = cover.resize((width, height), Image.Resampling.LANCZOS)
        canvas.paste(shot, (28, y))
        d.text((28, y + height + 8), f"{width} × {height}", font=font(14, True), fill=MUTED)
        y += height + 52
    review = out / "review"
    review.mkdir(parents=True, exist_ok=True)
    canvas.save(review / "thumbnail-sheet.png", quality=95)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()
    out = Path(args.destination)
    out.mkdir(parents=True, exist_ok=True)

    search_icon(out)
    save_cover(out)
    gallery_roles(out)
    gallery_state(out)
    gallery_resilience(out)
    gallery_dial(out)
    thumbnail_review(out)

    required = [
        "01_search_icon.png",
        "02_cover.png",
        "03_gallery_01.png",
        "04_gallery_02.png",
        "05_gallery_03.png",
        "06_gallery_04.png",
    ]
    for name in required:
        path = out / name
        if not path.is_file():
            fail(f"missing Marketplace output: {name}")
        with Image.open(path) as im:
            expected = (288, 288) if name == "01_search_icon.png" else (W, H)
            if im.size != expected:
                fail(f"{name}: {im.size} != {expected}")

    if not (out / "review" / "thumbnail-sheet.png").is_file():
        fail("V2 thumbnail review sheet was not generated")

    payloads = [Path(out / name).read_bytes() for name in required[1:]]
    if len(set(payloads)) != len(payloads):
        fail("Marketplace cover/gallery outputs must be visually distinct files")

    print(f"Audio Manager Pro Rat Art V2 ready: {out}")


if __name__ == "__main__":
    main()

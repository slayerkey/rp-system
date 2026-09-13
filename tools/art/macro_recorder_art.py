#!/usr/bin/env python3
"""Deterministic Marketplace hero renderer for Macro Recorder Lite / Pro.

Uses only product-generated key art plus PackRat's repository brand asset.
No image-generation provider and no fabricated desktop/application UI.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
W, H = 1920, 960
BG = (7, 10, 14)
WHITE = (246, 249, 252)
MUTED = (170, 180, 194)
GREEN = (53, 230, 126)
RED = (244, 76, 86)
RAT = ROOT / "tools" / "art" / "assets" / "ratpack-icon-transparent.png"

PRODUCTS = {
    "macro-recorder-lite": {
        "title": "MACRO RECORDER LITE",
        "edition": "FREE",
        "subtitle": "Record short keyboard workflows once. Replay them from Stream Deck.",
        "plugin": ROOT / "plugins" / "macro-recorder-lite" / "com.packrat.macro-recorder-lite.sdPlugin",
        "badges": ["KEYBOARD", "30 SEC", "60 EVENTS"],
    },
    "macro-recorder-pro": {
        "title": "MACRO RECORDER PRO",
        "edition": "PRO",
        "subtitle": "Record keyboard + mouse workflows once. Replay, edit, loop, and reuse.",
        "plugin": ROOT / "plugins" / "macro-recorder-pro" / "com.packrat.macro-recorder-pro.sdPlugin",
        "badges": ["KEYBOARD + MOUSE", "MACRO LIBRARY", "LOOPS"],
    },
}

def fail(message: str) -> None:
    raise SystemExit(f"RAT ART FAIL: {message}")

def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    env = os.getenv("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    candidates = [env] if env else []
    if os.name == "nt":
        candidates += [
            r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        ]
    else:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return ImageFont.truetype(candidate, size)
    fail("required deterministic marketplace font was not found")

def fit(draw: ImageDraw.ImageDraw, text: str, width: int, max_size: int, min_size: int, bold: bool = True):
    for size in range(max_size, min_size - 1, -2):
        f = font(size, bold)
        box = draw.textbbox((0, 0), text, font=f)
        if box[2] - box[0] <= width:
            return f
    return font(min_size, bold)

def background() -> Image.Image:
    canvas = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((220, 100, 1700, 1050), fill=(*GREEN, 27))
    d.ellipse((-350, 200, 650, 1050), fill=(*RED, 18))
    d.ellipse((1420, -250, 2200, 550), fill=(74, 125, 255, 16))
    return Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(180)))

def key_tile(canvas: Image.Image, image_path: Path, center_x: int, center_y: int, label: str, accent) -> None:
    if not image_path.is_file():
        fail(f"missing generated key art: {image_path}")
    tile = 270
    shadow = Image.new("RGBA", (tile + 80, tile + 80), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((30, 30, tile + 30, tile + 30), radius=44, fill=(0, 0, 0, 190))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    canvas.alpha_composite(shadow, (center_x - shadow.width // 2, center_y - shadow.height // 2 + 18))

    face = Image.new("RGBA", (tile, tile), (18, 22, 29, 255))
    fd = ImageDraw.Draw(face)
    fd.rounded_rectangle((1, 1, tile - 2, tile - 2), radius=38, outline=(*accent, 155), width=3)
    src = Image.open(image_path).convert("RGBA")
    src.thumbnail((190, 190), Image.Resampling.LANCZOS)
    face.alpha_composite(src, ((tile - src.width) // 2, (tile - src.height) // 2 - 10))
    canvas.alpha_composite(face, (center_x - tile // 2, center_y - tile // 2))

    d = ImageDraw.Draw(canvas)
    lf = font(28, True)
    d.text((center_x, center_y + 175), label, font=lf, fill=(*WHITE, 255), anchor="mm")

def packrat_mark(canvas: Image.Image) -> None:
    if not RAT.is_file():
        fail(f"missing PackRat brand asset: {RAT}")
    rat = Image.open(RAT).convert("RGBA")
    box = rat.getbbox()
    if box:
        rat = rat.crop(box)
    rat.thumbnail((86, 86), Image.Resampling.LANCZOS)
    canvas.alpha_composite(rat, (W - 126, 44))


def render_app_icon(slug: str, product: dict, out_dir: Path) -> Path:
    """Render the separate 288x288 Marketplace app icon required by Maker Console."""
    size = 288
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((18, 18, 270, 270), fill=(*GREEN, 35))
    glow = glow.filter(ImageFilter.GaussianBlur(34))
    icon = Image.alpha_composite(icon, glow)

    d = ImageDraw.Draw(icon)
    d.rounded_rectangle((12, 12, 276, 276), radius=56, fill=(13, 17, 23, 255), outline=(72, 83, 98, 210), width=3)

    # Record -> replay is the product mark: two large, readable elements.
    d.ellipse((48, 86, 118, 156), fill=(*RED, 255))
    play = [(168, 78), (168, 164), (238, 121)]
    d.polygon(play, fill=(*GREEN, 255))

    mark_font = fit(d, "MR", 190, 62, 48)
    d.text((144, 211), "MR", font=mark_font, fill=(*WHITE, 255), anchor="mm")

    edition = product["edition"]
    ef = font(16, True)
    eb = d.textbbox((0, 0), edition, font=ef)
    ew = eb[2] - eb[0] + 24
    d.rounded_rectangle((144 - ew // 2, 246, 144 + ew // 2, 274), radius=14, fill=(*GREEN, 30), outline=(*GREEN, 140), width=1)
    d.text((144, 260), edition, font=ef, fill=(*GREEN, 255), anchor="mm")

    out = out_dir / "00-app-icon.png"
    out_dir.mkdir(parents=True, exist_ok=True)
    icon.convert("RGB").save(out, "PNG", optimize=True)
    return out

def render(slug: str, out: Path) -> None:
    product = PRODUCTS.get(slug)
    if not product:
        fail(f"unknown Macro Recorder edition: {slug}")
    plugin = product["plugin"]
    record = plugin / "imgs" / "actions" / "record" / "key.png"
    replay = plugin / "imgs" / "actions" / "replay" / "key.png"

    app_icon = render_app_icon(slug, product, out.parent)

    canvas = background()
    draw = ImageDraw.Draw(canvas)

    badge_font = font(24, True)
    badge_text = product["edition"]
    bbox = draw.textbbox((0, 0), badge_text, font=badge_font)
    bw = bbox[2] - bbox[0] + 44
    draw.rounded_rectangle((66, 52, 66 + bw, 100), radius=24, fill=(*GREEN, 35), outline=(*GREEN, 150), width=2)
    draw.text((66 + bw // 2, 76), badge_text, font=badge_font, fill=(*GREEN, 255), anchor="mm")
    packrat_mark(canvas)

    title_font = fit(draw, product["title"], 1500, 70, 44)
    draw.text((W // 2, 92), product["title"], font=title_font, fill=(*WHITE, 255), anchor="mm")

    hero = "RECORD  →  DO IT  →  REPLAY"
    hero_font = fit(draw, hero, 1600, 84, 52)
    draw.text((W // 2, 230), hero, font=hero_font, fill=(*WHITE, 255), anchor="mm")

    sub_font = fit(draw, product["subtitle"], 1420, 32, 23, False)
    draw.text((W // 2, 305), product["subtitle"], font=sub_font, fill=(*MUTED, 255), anchor="mm")

    key_tile(canvas, record, 520, 550, "1. PRESS RECORD", RED)
    key_tile(canvas, replay, 1400, 550, "3. PRESS REPLAY", GREEN)

    # The middle stage is intentionally not represented as a plugin action.
    # It is the user's real performed workflow between Record and Stop.
    center = Image.new("RGBA", (450, 250), (0, 0, 0, 0))
    cd = ImageDraw.Draw(center)
    cd.rounded_rectangle((2, 2, 447, 247), radius=34, fill=(17, 21, 28, 230), outline=(84, 94, 110, 170), width=2)
    cd.text((225, 62), "DO THE THING", font=font(38, True), fill=(*WHITE, 255), anchor="mm")
    cd.text((225, 116), "keyboard shortcuts · app workflow", font=font(21, False), fill=(*MUTED, 255), anchor="mm")
    cd.text((225, 153), "mouse workflow" if slug.endswith("-pro") else "timing is captured automatically", font=font(21, False), fill=(*MUTED, 255), anchor="mm")
    cd.text((225, 202), "STOP WHEN DONE", font=font(24, True), fill=(*RED, 255), anchor="mm")
    canvas.alpha_composite(center, (W // 2 - center.width // 2, 425))

    bx = W // 2
    total = 0
    badge_sizes = []
    small = font(21, True)
    for text in product["badges"]:
        box = draw.textbbox((0, 0), text, font=small)
        width = box[2] - box[0] + 42
        badge_sizes.append((text, width))
        total += width
    total += 18 * (len(badge_sizes) - 1)
    cursor = bx - total // 2
    for text, width in badge_sizes:
        draw.rounded_rectangle((cursor, 842, cursor + width, 892), radius=25, fill=(24, 29, 37, 255), outline=(67, 78, 92, 190), width=2)
        draw.text((cursor + width // 2, 867), text, font=small, fill=(*WHITE, 255), anchor="mm")
        cursor += width + 18

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, "PNG", optimize=True)

    # Required browse-scale review sheet: 480x240, 320x160, 240x120.
    sizes = [(480, 240), (320, 160), (240, 120)]
    review = Image.new("RGB", (520, 600), (8, 10, 13))
    rd = ImageDraw.Draw(review)
    y = 20
    for sw, sh in sizes:
        thumb = canvas.convert("RGB").resize((sw, sh), Image.Resampling.LANCZOS)
        review.paste(thumb, ((520 - sw) // 2, y))
        rd.text((20, y + sh + 7), f"{sw} × {sh}", font=font(18, False), fill=MUTED)
        y += sh + 55
    review.save(out.with_name("hero-thumbnail-review.png"), "PNG", optimize=True)
    print(f"PASS {slug}: app icon {app_icon} | hero {out}")

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", choices=sorted(PRODUCTS), required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    render(args.slug, args.out)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "tools" / "art"
DEVICE = ART / "assets" / "streamdeck-mk2-straight.png"
LOGO = ART / "assets" / "ratpack-icon-transparent.png"
SCENE = ART / "scenes" / "warm-studio-v1" / "base.png"
W, H = 1920, 960
WHITE = (247, 248, 250)
MUTED = (175, 184, 196)
ORANGE = (244, 116, 0)
GREEN = (44, 232, 112)
WARN = (244, 180, 56)
RED = (242, 78, 78)
MONITOR = (429, 73, 1496, 572)

# Calibrated inner screen rectangles for the approved 1536x1024 MK.2 plate.
KEY_RECTS = [
    (226, 236, 390, 350), (454, 236, 618, 350), (682, 236, 846, 350), (910, 236, 1074, 350), (1138, 236, 1302, 350),
    (214, 442, 382, 558), (443, 442, 611, 558), (672, 442, 840, 558), (901, 442, 1069, 558), (1130, 442, 1298, 558),
    (202, 644, 374, 762), (431, 644, 603, 762), (660, 644, 832, 762), (889, 644, 1061, 762), (1118, 644, 1290, 762),
]

LABELS = [
    ("CLAUDE", "WORKING", "2:14", GREEN),
    ("AUTO QUEUE", "RUN TESTS", "QUEUE NEXT", GREEN),
    ("AUTO QUEUE", "FIX ERRORS", "QUEUE NEXT", GREEN),
    ("AUTO QUEUE", "REVIEW CODE", "QUEUE NEXT", GREEN),
    ("AUTO QUEUE", "CONTINUE", "QUEUE NEXT", GREEN),
    ("NEXT IN QUEUE", "UP NEXT", "Run tests…", GREEN),
    ("AUTO QUEUE", "DOCUMENT", "QUEUE NEXT", GREEN),
    ("AUTO QUEUE", "COMMIT LOCAL", "QUEUE NEXT", GREEN),
    ("AUTO QUEUE", "VERIFY", "QUEUE NEXT", GREEN),
    ("AUTO QUEUE", "PLAN NEXT", "QUEUE NEXT", GREEN),
    ("QUEUE CONTROL", "REMOVE", "NEXT", WARN),
    ("QUEUE CONTROL", "MOVE NEXT", "TO END", WARN),
    ("QUEUE CONTROL", "CLEAR", "QUEUE", RED),
    ("AUTO QUEUE", "SUMMARIZE", "QUEUE NEXT", GREEN),
    ("AUTO QUEUE", "FINISH TASK", "QUEUE NEXT", GREEN),
]


def fail(msg: str) -> None:
    raise SystemExit(f"STREAM DECK PHOTO HERO FAIL: {msg}")


def font_path(bold: bool) -> str:
    env = os.environ.get("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    if env and Path(env).is_file():
        return env
    candidates = (
        [r"C:\\Windows\\Fonts\\segoeuib.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
        if bold else
        [r"C:\\Windows\\Fonts\\segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    )
    for candidate in candidates:
        if Path(candidate).is_file():
            return candidate
    fail("deterministic font missing")


def F(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(font_path(bold), size)


def fit(draw: ImageDraw.ImageDraw, text: str, max_width: int, max_size: int, min_size: int, bold: bool = True):
    for size in range(max_size, min_size - 1, -2):
        f = F(size, bold)
        box = draw.textbbox((0, 0), text, font=f)
        if box[2] - box[0] <= max_width:
            return f
    return F(min_size, bold)


def key_face(top: str, main: str, sub: str, accent: tuple[int, int, int]) -> Image.Image:
    size = 288
    img = Image.new("RGBA", (size, size), (9, 12, 16, 255))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((8, 8, 280, 280), radius=38, fill=(14, 19, 25, 255), outline=(66, 76, 89, 255), width=4)
    d.rounded_rectangle((28, 24, 112, 32), radius=4, fill=(*accent, 255))
    d.ellipse((246, 24, 256, 34), fill=(*accent, 255))
    d.text((28, 62), top, font=fit(d, top, 232, 25, 17), fill=(*MUTED, 255))
    d.text((28, 120), main, font=fit(d, main, 232, 38, 22), fill=(*WHITE, 255))
    d.text((28, 206), sub, font=fit(d, sub, 232, 24, 16, False), fill=(*accent, 255))
    return img


def put_key(device: Image.Image, rect: tuple[int, int, int, int], key: Image.Image) -> None:
    x1, y1, x2, y2 = rect
    w, h = x2 - x1, y2 - y1
    key = key.resize((w, h), Image.Resampling.LANCZOS)
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, w - 1, h - 1), radius=max(12, int(min(w, h) * 0.11)), fill=245)
    device.alpha_composite(Image.composite(key, Image.new("RGBA", (w, h), (0,0,0,0)), mask), (x1, y1))


def device_with_keys() -> Image.Image:
    if not DEVICE.is_file():
        fail(f"approved MK.2 plate missing: {DEVICE}")
    dev = Image.open(DEVICE).convert("RGBA")
    if dev.size != (1536, 1024):
        fail(f"unexpected MK.2 plate size: {dev.size}")
    for rect, label in zip(KEY_RECTS, LABELS):
        put_key(dev, rect, key_face(*label))
    bbox = dev.getchannel("A").getbbox()
    if bbox:
        dev = dev.crop(bbox)
    return dev


def monitor_title(canvas: Image.Image) -> None:
    x1, y1, x2, y2 = MONITOR
    panel = Image.new("RGBA", (x2-x1, y2-y1), (4, 6, 8, 255))
    d = ImageDraw.Draw(panel)

    glow = Image.new("RGBA", panel.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-100, 210, panel.width+100, 600), fill=(*ORANGE, 32))
    panel.alpha_composite(glow.filter(ImageFilter.GaussianBlur(48)))

    f1 = fit(d, "AUTO QUEUE", int(panel.width*0.78), 96, 54)
    f2 = fit(d, "FOR CLAUDE CODE", int(panel.width*0.74), 60, 36)
    d.text((panel.width//2, 86), "AUTO QUEUE", font=f1, fill=(*WHITE,255), anchor="mm")
    d.text((panel.width//2, 178), "FOR CLAUDE CODE", font=f2, fill=(*ORANGE,255), anchor="mm")
    canvas.alpha_composite(panel, (x1, y1))


def add_logo(canvas: Image.Image) -> None:
    if not LOGO.is_file():
        fail("PackRat source logo missing")
    logo = Image.open(LOGO).convert("RGBA")
    bbox = logo.getbbox()
    if bbox:
        logo = logo.crop(bbox)
    # Render directly from source at the intended visible size. Never upscale a logo
    # extracted from a finished marketplace image.
    target = 116
    scale = min(target / logo.width, target / logo.height)
    logo = logo.resize((max(1, round(logo.width*scale)), max(1, round(logo.height*scale))), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, (1818 - logo.width//2, 62 - logo.height//2))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(out: Path) -> None:
    if not SCENE.is_file():
        fail("warm-studio-v1 scene missing")
    canvas = Image.open(SCENE).convert("RGBA")
    if canvas.size != (W, H):
        fail(f"scene must be {W}x{H}")

    monitor_title(canvas)
    add_logo(canvas)

    dev = device_with_keys()
    max_w, max_h = 1260, 720
    scale = min(max_w/dev.width, max_h/dev.height)
    dev = dev.resize((round(dev.width*scale), round(dev.height*scale)), Image.Resampling.LANCZOS)

    x = (W-dev.width)//2
    y = H-dev.height+30

    shadow = Image.new("RGBA", canvas.size, (0,0,0,0))
    alpha = dev.getchannel("A").filter(ImageFilter.GaussianBlur(18))
    surface = Image.new("RGBA", dev.size, (0,0,0,105))
    surface.putalpha(alpha.point(lambda a: int(a*0.55)))
    shadow.alpha_composite(surface, (x+6, y+18))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(dev, (x, y))

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    report = {
        "schema_version": 1,
        "product": "claude-auto-queue",
        "image_generation": "disabled",
        "renderer": "tools/art/render_streamdeck_photo_hero.py",
        "hardware_source": "tools/art/assets/streamdeck-mk2-straight.png",
        "hardware_sha256": sha256(DEVICE),
        "scene": "warm-studio-v1",
        "output": {"name": out.name, "size": [W, H], "sha256": sha256(out)},
    }
    (out.parent / "streamdeck-photo-hero-report.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print(f"STREAM DECK PHOTO HERO PASS: {out}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    render(args.out)


if __name__ == "__main__":
    main()

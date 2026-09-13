#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from streamdeck_photo import DEFAULT_DEVICE, alpha_crop_device, compose_device
from xeneon_all_hero_batch import F, MON, ORANGE, WHITE, fit, safe_logo

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "tools" / "art"
SCENE = ART / "scenes" / "warm-studio-v1" / "base.png"
W, H = 1920, 960
GREEN = (44, 232, 112)
MUTED = (175, 184, 196)
WARN = (244, 180, 56)
RED = (242, 78, 78)
PLATFORM_SUBTITLE = "for Stream Deck"

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


def key_face(top: str, main: str, sub: str, accent: tuple[int, int, int]) -> Image.Image:
    """Auto Queue adapter: render one real product key as a clean source image."""
    size = 288
    image = Image.new("RGBA", (size, size), (10, 12, 16, 255))
    draw = ImageDraw.Draw(image)
    pad = 28
    draw.rounded_rectangle((pad, 24, 112, 32), radius=4, fill=(*accent, 255))
    draw.ellipse((246, 24, 256, 34), fill=(*accent, 255))
    draw.text((pad, 62), top, font=fit(draw, top, 232, 25, 17, False), fill=(*MUTED, 255))
    draw.text((pad, 120), main, font=fit(draw, main, 232, 38, 22), fill=(*WHITE, 255))
    draw.text((pad, 206), sub, font=fit(draw, sub, 232, 24, 16, False), fill=(*accent, 255))
    return image


def monitor(canvas: Image.Image, line1: str, line2: str) -> None:
    """Exact XENEON hero typography/hierarchy with a Stream Deck subtitle."""
    x1, y1, x2, y2 = MON
    width = x2 - x1
    height = y2 - y1
    panel = Image.new("RGBA", (width, height), (4, 6, 8, 255))
    draw = ImageDraw.Draw(panel)

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((-120, int(height * 0.60), width + 140, int(height * 1.26)), fill=(*ORANGE, 30))
    panel.alpha_composite(glow.filter(ImageFilter.GaussianBlur(42)))

    for band in range(6):
        points = []
        baseline = int(height * 0.88) + band * 3
        for x in range(-20, width + 20, 8):
            points.append((x, baseline + int(math.sin(x / width * math.pi * 2 + band * 0.18) * (4 + band))))
        draw.line(points, fill=(*ORANGE, max(7, 27 - band * 3)), width=1)

    for x in range(int(width * 0.81), width - 28, 10):
        for y in range(22, 122, 10):
            draw.ellipse((x, y, x + 2, y + 2), fill=(*ORANGE, 25))

    f1 = fit(draw, line1, int(width * 0.84), 116, 50)
    f2 = fit(draw, line2, int(width * 0.88), 126, 48)
    fs = fit(draw, PLATFORM_SUBTITLE, int(width * 0.58), 46, 29)

    def center(text: str, font, center_y: float, color: tuple[int, int, int]) -> None:
        box = draw.textbbox((0, 0), text, font=font)
        text_width = box[2] - box[0]
        text_height = box[3] - box[1]
        tx = (width - text_width) // 2
        ty = int(center_y - text_height / 2 - box[1])
        shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.text((tx + 2, ty + 4), text, font=font, fill=(0, 0, 0, 175))
        panel.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(4)))
        draw.text((tx, ty), text, font=font, fill=(*color, 255))

    center(line1, f1, height * 0.10, WHITE)
    center(line2, f2, height * 0.31, ORANGE)
    center(PLATFORM_SUBTITLE, fs, height * 0.49, WHITE)
    canvas.alpha_composite(panel, (x1, y1))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(out: Path) -> None:
    if not SCENE.is_file():
        fail("warm-studio-v1 scene missing")
    canvas = Image.open(SCENE).convert("RGBA")
    if canvas.size != (W, H):
        fail(f"scene must be {W}x{H}")

    # Always begin from the untouched scene. Never cover a previously rendered
    # hero with a matte or shadow patch.
    monitor(canvas, "AUTO QUEUE", "CLAUDE CODE")

    key_images = [key_face(*label) for label in LABELS]
    device = alpha_crop_device(compose_device(key_images), pad=0)

    # Smaller than the first prototype so the full XENEON-style title stack has
    # comfortable separation from the hardware.
    max_width, max_height = 1000, 590
    scale = min(max_width / device.width, max_height / device.height)
    device = device.resize((round(device.width * scale), round(device.height * scale)), Image.Resampling.LANCZOS)
    x = (W - device.width) // 2
    y = H - device.height - 10

    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    alpha = device.getchannel("A").filter(ImageFilter.GaussianBlur(12))
    shadow_surface = Image.new("RGBA", device.size, (0, 0, 0, 52))
    shadow_surface.putalpha(alpha.point(lambda value: round(value * 0.34)))
    shadow.alpha_composite(shadow_surface, (x + 4, y + 9))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(device, (x, y))

    logo = safe_logo()
    canvas.alpha_composite(logo, (W - 58 - logo.width, 24))

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    report = {
        "schema_version": 2,
        "product": "claude-auto-queue",
        "image_generation": "disabled",
        "renderer": "tools/art/render_streamdeck_photo_hero.py",
        "compositor": "tools/art/streamdeck_photo.py",
        "calibration": "tools/art/streamdeck-mk2-straight.apertures.json",
        "hardware_source": "tools/art/assets/streamdeck-mk2-straight.png",
        "hardware_sha256": sha256(DEFAULT_DEVICE),
        "scene": "warm-studio-v1",
        "composition_model": "key-underlay+untouched-hardware-overlay",
        "hardware_plate_modified": false,
        "output": {"name": out.name, "size": [W, H], "sha256": sha256(out)},
    }
    (out.parent / "streamdeck-photo-hero-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"STREAM DECK PHOTO HERO PASS: {out}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    render(args.out)


if __name__ == "__main__":
    main()

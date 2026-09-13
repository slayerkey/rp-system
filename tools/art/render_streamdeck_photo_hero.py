#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from streamdeck_photo import DEFAULT_DEVICE, alpha_crop_device, compose_device, save_diagnostics
from xeneon_all_hero_batch import WHITE, fit, monitor, safe_logo

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "tools" / "art"
SCENE = ART / "scenes" / "warm-studio-v1" / "base.png"
W, H = 1920, 960
GREEN = (44, 232, 112)
MUTED = (175, 184, 196)
WARN = (244, 180, 56)
RED = (242, 78, 78)

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
    """Auto Queue adapter: product LCD content only, with no fake hardware bezel."""
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


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(out: Path) -> None:
    if not SCENE.is_file():
        fail("warm-studio-v1 scene missing")
    canvas = Image.open(SCENE).convert("RGBA")
    if canvas.size != (W, H):
        fail(f"scene must be {W}x{H}")

    # Reuse the exact approved XENEON monitor-title implementation.
    monitor(canvas, "AUTO QUEUE", "CLAUDE CODE", platform_subtitle="for Stream Deck")

    key_images = [key_face(*label) for label in LABELS]
    composition = compose_device(key_images)
    debug_files = save_diagnostics(composition, out.parent)
    device = alpha_crop_device(composition.device, pad=0)

    # Slightly smaller than the first prototype so the shared title stack has
    # comfortable breathing room above the hardware.
    max_width, max_height = 1000, 590
    scale = min(max_width / device.width, max_height / device.height)
    device = device.resize(
        (round(device.width * scale), round(device.height * scale)),
        Image.Resampling.LANCZOS,
    )
    x = (W - device.width) // 2
    y = H - device.height - 10

    # Broad, restrained silhouette shadow.
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    alpha = device.getchannel("A").filter(ImageFilter.GaussianBlur(11))
    shadow_surface = Image.new("RGBA", device.size, (0, 0, 0, 46))
    shadow_surface.putalpha(alpha.point(lambda value: round(value * 0.31)))
    shadow.alpha_composite(shadow_surface, (x + 4, y + 11))
    canvas.alpha_composite(shadow)

    # Small contact shadow under the bottom edge so the deck sits on the desk.
    contact = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    contact_draw = ImageDraw.Draw(contact)
    contact_draw.ellipse(
        (
            x + round(device.width * 0.10),
            y + device.height - 13,
            x + round(device.width * 0.90),
            y + device.height + 24,
        ),
        fill=(0, 0, 0, 72),
    )
    canvas.alpha_composite(contact.filter(ImageFilter.GaussianBlur(16)))
    canvas.alpha_composite(device, (x, y))

    logo = safe_logo()
    canvas.alpha_composite(logo, (W - 58 - logo.width, 24))

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, "PNG", optimize=True)

    report = {
        "schema_version": 3,
        "product": "claude-auto-queue",
        "image_generation": "disabled",
        "renderer": "tools/art/render_streamdeck_photo_hero.py",
        "compositor": "tools/art/streamdeck_photo.py",
        "calibration": "tools/art/streamdeck-mk2-straight.apertures.json",
        "hardware_source": "tools/art/assets/streamdeck-mk2-straight.png",
        "hardware_sha256": sha256(DEFAULT_DEVICE),
        "scene": "warm-studio-v1",
        "composition_model": "alpha-detected-lcd-underlay+untouched-hardware-overlay",
        "hardware_plate_modified": False,
        "detected_key_count": len(composition.holes),
        "uncovered_lcd_pixels": composition.uncovered_pixels,
        "detected_lcds": [
            {"index": hole.index, "bounds": list(hole.bounds), "pixels": hole.pixels}
            for hole in composition.holes
        ],
        "debug_outputs": debug_files,
        "output": {"name": out.name, "size": [W, H], "sha256": sha256(out)},
    }
    (out.parent / "streamdeck-photo-hero-report.json").write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"STREAM DECK PHOTO HERO PASS: {out}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    render(args.out)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from streamdeck_photo import DEFAULT_DEVICE, alpha_crop_device, compose_device, save_diagnostics
from xeneon_all_hero_batch import monitor, safe_logo

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "tools" / "art"
SCENE = ART / "scenes" / "warm-studio-v1" / "base.png"
W, H = 1920, 960


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_keys(key_dir: Path) -> list[Image.Image]:
    paths = sorted(key_dir.glob("*.png"))
    if len(paths) != 15:
        raise SystemExit(f"Expected exactly 15 runtime key PNGs in {key_dir}, got {len(paths)}")
    return [Image.open(path).convert("RGBA") for path in paths]


def render(product: str, line1: str, line2: str, key_dir: Path, out: Path) -> None:
    canvas = Image.open(SCENE).convert("RGBA")
    if canvas.size != (W, H):
        raise SystemExit(f"warm-studio-v1 scene must be {W}x{H}")

    monitor(canvas, line1, line2, platform_subtitle="for Stream Deck")
    composition = compose_device(load_keys(key_dir))
    debug_files = save_diagnostics(composition, out.parent)
    device = alpha_crop_device(composition.device)

    max_width, max_height = 1000, 590
    scale = min(max_width / device.width, max_height / device.height)
    device = device.resize((round(device.width * scale), round(device.height * scale)), Image.Resampling.LANCZOS)
    x = (W - device.width) // 2
    y = H - device.height - 10

    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    alpha = device.getchannel("A").filter(ImageFilter.GaussianBlur(11))
    surface = Image.new("RGBA", device.size, (0, 0, 0, 46))
    surface.putalpha(alpha.point(lambda value: round(value * 0.31)))
    shadow.alpha_composite(surface, (x + 4, y + 11))
    canvas.alpha_composite(shadow)

    contact = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    cd = ImageDraw.Draw(contact)
    cd.ellipse(
        (x + round(device.width * 0.10), y + device.height - 13,
         x + round(device.width * 0.90), y + device.height + 24),
        fill=(0, 0, 0, 72),
    )
    canvas.alpha_composite(contact.filter(ImageFilter.GaussianBlur(16)))
    canvas.alpha_composite(device, (x, y))

    logo = safe_logo()
    canvas.alpha_composite(logo, (W - 58 - logo.width, 24))

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    report = {
        "schema_version": 1,
        "product": product,
        "image_generation": "disabled",
        "runtime_keys": str(key_dir),
        "compositor": "tools/art/streamdeck_photo.py",
        "hardware_source": "tools/art/assets/streamdeck-mk2-straight.png",
        "hardware_sha256": sha256(DEFAULT_DEVICE),
        "scene": "warm-studio-v1",
        "composition_model": "alpha-detected-lcd-underlay+untouched-hardware-overlay",
        "detected_key_count": len(composition.holes),
        "uncovered_lcd_pixels": composition.uncovered_pixels,
        "debug_outputs": debug_files,
        "output": {"name": out.name, "size": [W, H], "sha256": sha256(out)},
    }
    (out.parent / "streamdeck-product-hero-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"STREAM DECK PRODUCT HERO PASS: {product} -> {out}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--product", required=True)
    p.add_argument("--line1", required=True)
    p.add_argument("--line2", required=True)
    p.add_argument("--keys-dir", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    render(args.product, args.line1, args.line2, args.keys_dir, args.out)


if __name__ == "__main__":
    main()

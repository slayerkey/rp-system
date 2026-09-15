#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

from streamdeck_photo import DEFAULT_DEVICE, alpha_crop_device, compose_device, save_diagnostics
from xeneon_all_hero_batch import F, fit, monitor, safe_logo

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "tools" / "art"
DEFAULT_SCENE = ART / "scenes" / "warm-studio-v1" / "base.png"
W, H = 1920, 960
WARM = (255, 126, 24)
COOL = (39, 158, 255)
WHITE = (247, 249, 251)
MUTED = (178, 188, 203)
TITLE_ORANGE = (244, 116, 0)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_keys(key_dir: Path) -> list[Image.Image]:
    paths = sorted(key_dir.glob("*.png"))
    if len(paths) != 15:
        raise SystemExit(f"Expected exactly 15 runtime key PNGs in {key_dir}, got {len(paths)}")
    return [Image.open(path).convert("RGBA") for path in paths]


def load_scene(scene_path: Path) -> Image.Image:
    if not scene_path.is_file():
        raise SystemExit(f"Stream Deck hero scene missing: {scene_path}")
    canvas = Image.open(scene_path).convert("RGBA")
    if canvas.size != (W, H):
        canvas = ImageOps.fit(
            canvas,
            (W, H),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
    return canvas


def glass_title(img: Image.Image, line1: str, line2: str, subtitle: str) -> None:
    x1, y1, x2, y2 = 235, 62, 1685, 335
    radius = 38

    panel = Image.new("RGBA", img.size, (0, 0, 0, 0))
    pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle((x1, y1, x2, y2), radius=radius, fill=(4, 8, 15, 205))
    img.alpha_composite(panel)

    outer = Image.new("L", img.size, 0)
    od = ImageDraw.Draw(outer)
    od.rounded_rectangle((x1, y1, x2, y2), radius=radius, fill=255)
    inner = Image.new("L", img.size, 0)
    idr = ImageDraw.Draw(inner)
    idr.rounded_rectangle((x1 + 3, y1 + 3, x2 - 3, y2 - 3), radius=radius - 3, fill=255)
    ring = ImageChops.subtract(outer, inner)

    gradient = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(gradient)
    span = max(1, x2 - x1)
    for x in range(x1, x2 + 1):
        t = (x - x1) / span
        color = tuple(round(WARM[i] * (1 - t) + COOL[i] * t) for i in range(3))
        gd.line((x, y1, x, y2), fill=(*color, 225), width=1)
    gradient.putalpha(ImageChops.multiply(gradient.getchannel("A"), ring))

    glow_mask = ring.filter(ImageFilter.GaussianBlur(16))
    glow = gradient.copy()
    glow.putalpha(glow_mask.point(lambda p: round(p * 0.24)))
    img.alpha_composite(glow)
    img.alpha_composite(gradient)

    d = ImageDraw.Draw(img)
    f1 = fit(d, line1, 1160, 104, 60)
    f2 = fit(d, line2, 1260, 110, 58)
    fs = fit(d, subtitle, 720, 42, 28, bold=False)

    def center(text: str, f, y: int, color: tuple[int, int, int]) -> None:
        if not text:
            return
        box = d.textbbox((0, 0), text, font=f)
        width = box[2] - box[0]
        height = box[3] - box[1]
        d.text(((W - width) // 2, y - height // 2 - box[1]), text, font=f, fill=(*color, 255))

    if line1:
        center(line1, f1, 120, WHITE)
        center(line2, f2, 216, TITLE_ORANGE)
        center(subtitle, fs, 294, WHITE)
    else:
        center(line2, f2, 165, TITLE_ORANGE)
        center(subtitle, fs, 278, WHITE)


def render(
    product: str,
    line1: str,
    line2: str,
    key_dir: Path,
    out: Path,
    *,
    scene_path: Path | None = None,
    title_style: str = "monitor",
) -> None:
    scene = scene_path or DEFAULT_SCENE
    canvas = load_scene(scene)

    if title_style == "glass":
        glass_title(canvas, line1, line2, "for Stream Deck")
    elif title_style == "monitor":
        monitor(canvas, line1, line2, platform_subtitle="for Stream Deck")
    else:
        raise SystemExit(f"Unsupported Stream Deck hero title style: {title_style}")
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
        "scene": str(scene.relative_to(ROOT) if scene.is_relative_to(ROOT) else scene),
        "title_style": title_style,
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
    p.add_argument("--scene", type=Path)
    p.add_argument("--title-style", choices=["monitor", "glass"], default="monitor")
    args = p.parse_args()
    render(
        args.product,
        args.line1,
        args.line2,
        args.keys_dir,
        args.out,
        scene_path=args.scene,
        title_style=args.title_style,
    )


if __name__ == "__main__":
    main()

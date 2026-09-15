#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

from streamdeck_marketplace_campaign import glass_panel, load_scene, resolve_campaign_config

GALLERIES = (
    "03_gallery_01.png",
    "04_gallery_02.png",
    "05_gallery_03.png",
    "06_gallery_04.png",
)
TARGET_SIZE = (1920, 960)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rounded_plate(source: Image.Image, size: tuple[int, int], radius: int = 34) -> Image.Image:
    fitted = ImageOps.fit(
        source.convert("RGBA"),
        size,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    fitted.putalpha(mask)
    return fitted


def wrap_gallery(source: Image.Image, scene: Path) -> Image.Image:
    canvas = load_scene(scene, veil=(2, 5, 10, 52))

    panel_box = (74, 24, 1846, 936)
    glass_panel(
        canvas,
        panel_box,
        radius=42,
        fill=(5, 9, 16, 218),
        border_alpha=210,
        glow_alpha=42,
        border_width=3,
    )

    plate_size = (1680, 840)
    plate_x = (TARGET_SIZE[0] - plate_size[0]) // 2
    plate_y = (TARGET_SIZE[1] - plate_size[1]) // 2

    plate = rounded_plate(source, plate_size, radius=34)

    shadow = Image.new("RGBA", TARGET_SIZE, (0, 0, 0, 0))
    alpha = plate.getchannel("A").filter(ImageFilter.GaussianBlur(18))
    shadow_patch = Image.new("RGBA", plate.size, (0, 0, 0, 95))
    shadow_patch.putalpha(alpha.point(lambda p: round(p * 0.58)))
    shadow.alpha_composite(shadow_patch, (plate_x + 4, plate_y + 12))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(plate, (plate_x, plate_y))

    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--product", required=True)
    parser.add_argument("--media-dir", required=True, type=Path)
    args = parser.parse_args()

    config = resolve_campaign_config(args.product)
    media_dir = args.media_dir
    report = {
        "schema_version": 1,
        "product": args.product,
        "campaign_style": config.campaign_style,
        "gallery_mode": config.gallery_mode,
        "gallery_scene": str(config.gallery_scene),
        "image_generation": "disabled",
        "galleries": [],
    }

    for name in GALLERIES:
        path = media_dir / name
        if not path.is_file():
            raise SystemExit(f"GALLERY CAMPAIGN FAIL: missing Marketplace gallery: {path}")

        source_hash = sha256(path)
        source = Image.open(path).convert("RGBA")
        if source.size != TARGET_SIZE:
            raise SystemExit(
                f"GALLERY CAMPAIGN FAIL: {name} is {source.size}, expected {TARGET_SIZE}"
            )

        if config.gallery_mode == "native":
            output_hash = source_hash
            action = "native-shared-campaign-preserved"
        else:
            output = wrap_gallery(source, config.gallery_scene)
            output.convert("RGB").save(path, "PNG", optimize=True)
            output_hash = sha256(path)
            action = "legacy-or-external-wrapped-with-current-campaign"

        report["galleries"].append(
            {
                "name": name,
                "action": action,
                "source_sha256": source_hash,
                "output_sha256": output_hash,
                "size": list(TARGET_SIZE),
            }
        )

    report_path = media_dir / "streamdeck-gallery-campaign-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        f"STREAM DECK GALLERY CAMPAIGN PASS: {args.product} "
        f"mode={config.gallery_mode} -> {media_dir}"
    )


if __name__ == "__main__":
    main()

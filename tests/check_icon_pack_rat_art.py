#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RENDERER = ROOT / "tools" / "art" / "rat_art_icon_pack.py"
MEDIA = [
    "01_search_icon.png",
    "02_cover.png",
    "03_gallery_01.png",
    "04_gallery_02.png",
    "05_gallery_03.png",
    "06_gallery_04.png",
]


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def make_icon(path: Path, index: int) -> None:
    image = Image.new("RGBA", (144, 144), (7, 9, 16, 255))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((4, 4, 139, 139), radius=24, outline=(120, 110, 245, 255), width=3)
    draw.ellipse((42 + index * 3, 42, 102 + index * 3, 102), fill=(235, 239, 255, 255))
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG")


def main() -> None:
    if not RENDERER.is_file():
        raise SystemExit(f"missing renderer: {RENDERER}")

    with tempfile.TemporaryDirectory(prefix="rat-icon-art-") as temp:
        root = Path(temp) / "factory-out"
        destination = Path(temp) / "media"
        static = root / "static"
        animated = root / "animated"
        ids = ["power", "symbol_plus", "number_01", "packrat_brand"]
        categories = ["system", "symbols", "numbers", "system"]

        for index, icon_id in enumerate(ids):
            make_icon(static / f"{icon_id}.png", index)

        first = Image.open(static / "power.png").convert("RGBA")
        second = first.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        animated.mkdir(parents=True, exist_ok=True)
        first.save(
            animated / "power.webp",
            "WEBP",
            save_all=True,
            append_images=[second],
            duration=83,
            loop=0,
        )

        write_json(
            root / "marketing" / "rat-art-icons.json",
            {
                "schema_version": 1,
                "product": "fixture",
                "name": "PackRat Fixture",
                "actual_icon_count": 4,
                "animated_icon_count": 1,
                "hero": "unused.png",
                "icon_paths": [f"static/{icon_id}.png" for icon_id in ids],
            },
        )
        write_json(
            root / "package-staging" / "manifest.json",
            {
                "Name": "PackRat Fixture",
                "Version": "1.0.0",
                "Description": "Fixture icon pack",
                "Author": "PackRat",
                "Icon": "icon.svg",
                "License": "license.txt",
            },
        )
        write_json(
            root / "package-staging" / "icons.json",
            [
                {"path": f"{icon_id}.png", "name": icon_id, "tags": ["P1", category]}
                for icon_id, category in zip(ids, categories)
            ],
        )
        write_json(
            root / "qa" / "static-build-report.json",
            {
                "product": "fixture",
                "icons": [
                    {
                        "id": icon_id,
                        "name": icon_id.replace("_", " ").title(),
                        "category": category,
                        "status": "built",
                    }
                    for icon_id, category in zip(ids, categories)
                ],
            },
        )
        write_json(
            root / "qa" / "animated-build-report.json",
            {
                "product": "fixture",
                "icons": [
                    {
                        "id": "power",
                        "animation": {"fps": 12, "duration": 2.0},
                    }
                ],
            },
        )

        subprocess.run(
            [
                sys.executable,
                str(RENDERER),
                "--factory-out",
                str(root),
                "--out",
                str(destination),
            ],
            cwd=ROOT,
            check=True,
        )

        for name in MEDIA:
            path = destination / name
            if not path.is_file():
                raise SystemExit(f"renderer did not create {name}")
            expected = (512, 512) if name == "01_search_icon.png" else (1920, 960)
            with Image.open(path) as image:
                if image.size != expected:
                    raise SystemExit(f"{name}: expected {expected}, got {image.size}")

    print("Icon-pack Rat Art synthetic regression PASS")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools" / "art" / "apply_streamdeck_gallery_campaign.py"
GALLERIES = [
    "03_gallery_01.png",
    "04_gallery_02.png",
    "05_gallery_03.png",
    "06_gallery_04.png",
]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_fixture(path: Path, index: int) -> None:
    image = Image.new("RGB", (1920, 960), (20 + index * 20, 30, 45))
    draw = ImageDraw.Draw(image)
    draw.rectangle((120, 100, 1800, 860), outline=(245, 245, 245), width=6)
    draw.text((180, 160), f"LEGACY GALLERY {index}", fill=(255, 255, 255))
    image.save(path, "PNG")


def run(product: str, media_dir: Path) -> dict:
    subprocess.run(
        [sys.executable, str(SCRIPT), "--product", product, "--media-dir", str(media_dir)],
        cwd=ROOT,
        check=True,
    )
    report_path = media_dir / "streamdeck-gallery-campaign-report.json"
    assert report_path.is_file()
    return json.loads(report_path.read_text(encoding="utf-8"))


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)

        wrapped = root / "wrapped"
        wrapped.mkdir()
        for i, name in enumerate(GALLERIES, 1):
            make_fixture(wrapped / name, i)
        before = {name: sha(wrapped / name) for name in GALLERIES}

        report = run("windows-settings-manager-pro", wrapped)
        assert report["gallery_mode"] == "wrap"
        for item in report["galleries"]:
            name = item["name"]
            assert item["action"] == "legacy-or-external-wrapped-with-current-campaign"
            assert item["source_sha256"] == before[name]
            assert item["output_sha256"] == sha(wrapped / name)
            assert item["output_sha256"] != before[name]
            assert Image.open(wrapped / name).size == (1920, 960)

        native = root / "native"
        native.mkdir()
        for i, name in enumerate(GALLERIES, 1):
            make_fixture(native / name, i)
        before_native = {name: sha(native / name) for name in GALLERIES}

        report = run("monitor-manager-pro", native)
        assert report["gallery_mode"] == "native"
        for item in report["galleries"]:
            name = item["name"]
            assert item["action"] == "native-shared-campaign-preserved"
            assert item["source_sha256"] == before_native[name]
            assert item["output_sha256"] == before_native[name]
            assert sha(native / name) == before_native[name]

    print("STREAM DECK GALLERY CAMPAIGN TEST PASS")


if __name__ == "__main__":
    main()

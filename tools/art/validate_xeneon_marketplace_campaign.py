#!/usr/bin/env python3
"""Fail-closed checks for the final XENEON five-frame Marketplace campaign."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

from rat_art import MARKETPLACE_ORDER
from xeneon_marketplace_campaign import STYLE, gallery_scene

ROOT = Path(__file__).resolve().parents[2]
FILES = ["1-hero.png", "2-showcase.png", "3-features.png", "4-settings.png", "5-sizes.png"]
KIT_ORDER = [
    ("1-hero.png", "02_cover.png"),
    ("2-showcase.png", "03_gallery_01.png"),
    ("3-features.png", "04_gallery_02.png"),
    ("4-settings.png", "05_gallery_03.png"),
    ("5-sizes.png", "06_gallery_04.png"),
]


def fail(reason: str) -> None:
    raise SystemExit(f"XENEON MARKETPLACE CAMPAIGN FAIL: {reason}")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check(slug: str, art: Path, kit: Path | None) -> None:
    if MARKETPLACE_ORDER != FILES:
        fail(f"renderer order disagrees with product-first campaign: {MARKETPLACE_ORDER}")
    report_path = art / "rat-art-report.json"
    if not report_path.is_file():
        fail(f"missing Rat Art report: {report_path}")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if report.get("slug") != slug or report.get("image_generation") != "disabled":
        fail("incorrect product or image-generation provenance")
    if report.get("marketplace_order") != FILES:
        fail("Rat Art report has stale gallery order")
    if report.get("gallery_system") != STYLE:
        fail("Rat Art did not use approved shared orange-blue glass gallery")
    expected_scene = gallery_scene(slug).relative_to(ROOT).as_posix()
    if report.get("gallery_scene") != expected_scene:
        fail("Rat Art report has unexpected or stale studio scene")

    hashes: dict[str, str] = {}
    for name in FILES:
        image = art / name
        if not image.is_file():
            fail(f"missing output: {image}")
        with Image.open(image) as img:
            if img.size != (1920, 960) or img.format != "PNG":
                fail(f"wrong output canvas for {name}")
        digest = sha(image)
        if digest in hashes.values():
            fail(f"cover/gallery reused an identical image: {name}")
        hashes[name] = digest
        if report["outputs"].get(name, {}).get("sha256") != digest:
            fail(f"Rat Art report hash mismatch for {name}")

    # Deterministic orange-left / blue-right ring, verified independently
    # of a product's captured UI or the approved room's ambient lighting.
    for name in FILES[1:]:
        with Image.open(art / name) as img:
            left = img.convert("RGB").getpixel((86, 445))
            right = img.convert("RGB").getpixel((1834, 445))
            if not (left[0] > left[2] and right[2] > right[0]):
                fail(f"missing canonical warm-left/cool-right frame in {name}")

    browse = art / "marketplace-15percent-sheet.jpg"
    with Image.open(browse) as img:
        if img.size != (864, 342):
            fail("missing or incorrectly sized 15-percent review sheet")

    if kit is not None:
        icon = kit / "01_search_icon.png"
        with Image.open(icon) as img:
            if img.size != (288, 288):
                fail("dedicated Maker Console icon must be 288x288")
        for source, shipped in KIT_ORDER:
            path = kit / shipped
            if not path.is_file() or sha(art / source) != sha(path):
                fail(f"final Rat Ship gallery order does not match the preview: {shipped}")
        if (kit / "07_gallery_05.png").exists():
            fail("XENEON Rat Ship must not append a fifth gallery or repeat the cover")
    print(f"XENEON MARKETPLACE CAMPAIGN PASS: {slug} / {STYLE} / visual-first order" +
          (" / exact SHIP_KIT" if kit is not None else ""))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("slug")
    parser.add_argument("--art", type=Path, required=True)
    parser.add_argument("--kit", type=Path)
    args = parser.parse_args()
    check(args.slug, args.art, args.kit)


if __name__ == "__main__":
    main()

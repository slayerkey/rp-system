#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.art import marketplace_text


def font_factory(size: int, bold: bool = False):
    candidates = (
        [Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"), Path("C:/Windows/Fonts/segoeuib.ttf")]
        if bold
        else [Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("C:/Windows/Fonts/segoeui.ttf")]
    )
    for path in candidates:
        if path.is_file():
            return ImageFont.truetype(str(path), size)
    raise SystemExit("Deterministic test font missing")


def main() -> None:
    helper = marketplace_text

    image = Image.new("RGB", (900, 500), "black")
    draw = ImageDraw.Draw(image)

    layout = helper.draw_fitted_text(
        draw,
        (40, 40, 420, 210),
        "This deliberately long Marketplace sentence must wrap inside its card instead of escaping into the next card.",
        font_factory,
        fill="white",
        max_size=34,
        min_size=18,
        spacing=6,
        max_lines=4,
    )
    assert len(layout.lines) >= 2
    assert layout.font_size >= 18

    failed = False
    try:
        helper.draw_fitted_text(
            draw,
            (40, 260, 90, 280),
            "This cannot possibly fit safely.",
            font_factory,
            fill="white",
            max_size=24,
            min_size=18,
            max_lines=1,
        )
    except helper.TextLayoutError:
        failed = True
    assert failed, "overflow must fail closed instead of clipping"

    rat_art_scripts = sorted(
        set((ROOT / "plugins").glob("**/scripts/rat-art.py"))
        | set((ROOT / "products").glob("**/scripts/rat-art.py"))
    )
    if not rat_art_scripts:
        raise SystemExit("No Stream Deck product Rat Art scripts found")

    for path in rat_art_scripts:
        source = path.read_text(encoding="utf-8")
        if ".multiline_text(" in source:
            raise SystemExit(
                f"{path.relative_to(ROOT)} uses raw multiline_text; use tools/art/marketplace_text.py so text cannot escape its box"
            )
        if "draw_fitted_text" not in source:
            raise SystemExit(
                f"{path.relative_to(ROOT)} does not use the shared fail-closed Marketplace text fitter"
            )

    print(f"RAT ART TEXT SAFETY PASS: {len(rat_art_scripts)} Stream Deck product renderers use bounded text")


if __name__ == "__main__":
    main()

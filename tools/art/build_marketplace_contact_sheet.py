#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ORDER = [
    ("COVER", "02_cover.png"),
    ("GALLERY 1", "03_gallery_01.png"),
    ("GALLERY 2", "04_gallery_02.png"),
    ("GALLERY 3", "05_gallery_03.png"),
    ("GALLERY 4", "06_gallery_04.png"),
]


def font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        Path(r"C:\Windows\Fonts\segoeuib.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return ImageFont.truetype(str(candidate), size)
    raise SystemExit("Marketplace contact sheet requires a deterministic bold font")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    images: list[tuple[str, Image.Image]] = []
    for label, name in ORDER:
        path = args.input / name
        if not path.is_file():
            raise SystemExit(f"Missing Marketplace image for contact sheet: {path}")
        image = Image.open(path).convert("RGB")
        if image.size != (1920, 960):
            raise SystemExit(f"Unexpected Marketplace image size for {name}: {image.size}")
        images.append((label, image))

    width = 1600
    pad = 30
    label_h = 44
    cover_w = width - 2 * pad
    cover_h = cover_w // 2
    cell_w = (width - 3 * pad) // 2
    cell_h = cell_w // 2
    height = pad + label_h + cover_h + pad + 2 * (label_h + cell_h + pad)

    sheet = Image.new("RGB", (width, height), (18, 18, 18))
    draw = ImageDraw.Draw(sheet)
    label_font = font(28)

    y = pad
    draw.text((pad, y), images[0][0], font=label_font, fill="white")
    y += label_h
    cover = images[0][1].resize((cover_w, cover_h), Image.Resampling.LANCZOS)
    sheet.paste(cover, (pad, y))
    y += cover_h + pad

    for row in range(2):
        for col in range(2):
            index = 1 + row * 2 + col
            x = pad + col * (cell_w + pad)
            yy = y + row * (label_h + cell_h + pad)
            draw.text((x, yy), images[index][0], font=label_font, fill="white")
            frame = images[index][1].resize((cell_w, cell_h), Image.Resampling.LANCZOS)
            sheet.paste(frame, (x, yy + label_h))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output, "PNG", optimize=True)
    print(f"MARKETPLACE CONTACT SHEET PASS: {args.output}")


if __name__ == "__main__":
    main()

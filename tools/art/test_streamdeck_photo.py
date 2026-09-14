#!/usr/bin/env python3
"""Deterministic smoke tests for the shared Stream Deck photo compositor."""
from pathlib import Path

from PIL import Image, ImageDraw

from streamdeck_photo import DEFAULT_DEVICE, compose_device, detect_holes, load_calibration


def main() -> None:
    plate = Image.open(DEFAULT_DEVICE).convert("RGBA")
    cal, holes = detect_holes(plate)
    assert cal.expected_key_count == 15
    assert len(holes) == 15
    assert all(hole.pixels > 10000 for hole in holes)

    opaque = [Image.new("RGBA", (288, 288), (18, 22, 28, 255)) for _ in range(15)]
    opaque_result = compose_device(opaque)
    assert opaque_result.uncovered_pixels == 0

    transparent = []
    for index in range(15):
        key = Image.new("RGBA", (288, 288), (0, 0, 0, 0))
        draw = ImageDraw.Draw(key)
        draw.ellipse((94, 94, 194, 194), fill=(40 + index * 5, 220, 120, 255))
        transparent.append(key)
    transparent_result = compose_device(transparent)
    assert transparent_result.uncovered_pixels == 0

    # The approved device source must still be exactly the calibrated size.
    assert plate.size == cal.source_size
    print("STREAM DECK PHOTO COMPOSITOR TEST PASS: 15 LCDs, opaque + transparent coverage=100%")


if __name__ == "__main__":
    main()

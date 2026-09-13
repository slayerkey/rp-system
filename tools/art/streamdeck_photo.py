#!/usr/bin/env python3
"""Shared deterministic Stream Deck MK.2 photo compositor.

Only the calibrated inner LCD apertures may be modified. The photographed
button bezels, glass rims, chassis, lighting, and transparency remain sourced
from the approved hardware plate.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "tools" / "art"
DEFAULT_DEVICE = ART / "assets" / "streamdeck-mk2-straight.png"
DEFAULT_CALIBRATION = ART / "streamdeck-mk2-straight.apertures.json"


class StreamDeckPhotoError(RuntimeError):
    pass


@dataclass(frozen=True)
class KeyAperture:
    index: int
    button: tuple[int, int, int, int]
    screen: tuple[int, int, int, int]


@dataclass(frozen=True)
class Calibration:
    source_size: tuple[int, int]
    screen_radius: int
    transparent_content_padding: float
    minimum_screen_inset: int
    keys: tuple[KeyAperture, ...]


def _rect(raw: object, label: str) -> tuple[int, int, int, int]:
    if not isinstance(raw, list) or len(raw) != 4 or not all(isinstance(v, int) for v in raw):
        raise StreamDeckPhotoError(f"{label} must be four integers")
    x1, y1, x2, y2 = raw
    if x2 <= x1 or y2 <= y1:
        raise StreamDeckPhotoError(f"{label} has invalid bounds: {raw}")
    return x1, y1, x2, y2


def load_calibration(path: Path = DEFAULT_CALIBRATION) -> Calibration:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema_version") != 1:
        raise StreamDeckPhotoError("unsupported Stream Deck photo calibration schema")
    size = data.get("source_size")
    if not isinstance(size, list) or len(size) != 2 or not all(isinstance(v, int) and v > 0 for v in size):
        raise StreamDeckPhotoError("source_size must be two positive integers")
    raw_keys = data.get("keys")
    if not isinstance(raw_keys, list) or len(raw_keys) != 15:
        raise StreamDeckPhotoError("MK.2 calibration must contain exactly 15 keys")
    keys: list[KeyAperture] = []
    for position, item in enumerate(raw_keys):
        if not isinstance(item, dict) or item.get("index") != position:
            raise StreamDeckPhotoError(f"key calibration index mismatch at {position}")
        keys.append(KeyAperture(position, _rect(item.get("button"), f"key {position} button"), _rect(item.get("screen"), f"key {position} screen")))
    cal = Calibration(
        source_size=(size[0], size[1]),
        screen_radius=int(data.get("screen_radius", 18)),
        transparent_content_padding=float(data.get("transparent_content_padding", 0.07)),
        minimum_screen_inset=int(data.get("minimum_screen_inset", 20)),
        keys=tuple(keys),
    )
    validate_calibration(cal)
    return cal


def _contains(outer: tuple[int, int, int, int], inner: tuple[int, int, int, int], inset: int) -> bool:
    ox1, oy1, ox2, oy2 = outer
    ix1, iy1, ix2, iy2 = inner
    return ix1 - ox1 >= inset and iy1 - oy1 >= inset and ox2 - ix2 >= inset and oy2 - iy2 >= inset


def _overlap(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    return max(a[0], b[0]) < min(a[2], b[2]) and max(a[1], b[1]) < min(a[3], b[3])


def validate_calibration(cal: Calibration) -> None:
    width, height = cal.source_size
    if cal.screen_radius < 0:
        raise StreamDeckPhotoError("screen_radius must be non-negative")
    if not 0 <= cal.transparent_content_padding < 0.4:
        raise StreamDeckPhotoError("transparent_content_padding is out of range")
    for key in cal.keys:
        bx1, by1, bx2, by2 = key.button
        sx1, sy1, sx2, sy2 = key.screen
        if bx1 < 0 or by1 < 0 or bx2 > width or by2 > height:
            raise StreamDeckPhotoError(f"button {key.index} is outside source image")
        if not _contains(key.button, key.screen, cal.minimum_screen_inset):
            raise StreamDeckPhotoError(
                f"screen {key.index} is not safely inset inside its physical button; "
                f"minimum inset={cal.minimum_screen_inset}"
            )
    for i, left in enumerate(cal.keys):
        for right in cal.keys[i + 1:]:
            if _overlap(left.screen, right.screen):
                raise StreamDeckPhotoError(f"screen apertures overlap: {left.index} and {right.index}")


def _visible_bbox(image: Image.Image, threshold: int = 2):
    alpha = image.getchannel("A")
    binary = alpha.point(lambda value: 255 if value >= threshold else 0)
    return binary.getbbox()


def _has_meaningful_transparency(image: Image.Image) -> bool:
    alpha = image.getchannel("A")
    extrema = alpha.getextrema()
    if extrema[0] == 255:
        return False
    bbox = _visible_bbox(image)
    if bbox is None:
        return True
    visible_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
    return visible_area < image.width * image.height * 0.96


def fit_key_art(
    image: Image.Image,
    size: tuple[int, int],
    *,
    transparent_padding: float,
    background: tuple[int, int, int, int] = (10, 12, 16, 255),
) -> Image.Image:
    """Fit key art into one LCD aperture.

    Transparent art is alpha-trimmed and contained with padding so invisible
    margins never make the visible icon/text undersized. Opaque art fills the
    LCD aperture edge-to-edge without ever touching the photographed bezel.
    """
    src = image.convert("RGBA")
    target_w, target_h = size
    if target_w <= 0 or target_h <= 0:
        raise StreamDeckPhotoError(f"invalid key target size: {size}")

    if _has_meaningful_transparency(src):
        bbox = _visible_bbox(src)
        if bbox is None:
            return Image.new("RGBA", size, background)
        src = src.crop(bbox)
        pad_x = round(target_w * transparent_padding)
        pad_y = round(target_h * transparent_padding)
        inner_w = max(1, target_w - 2 * pad_x)
        inner_h = max(1, target_h - 2 * pad_y)
        scale = min(inner_w / src.width, inner_h / src.height)
        fitted = src.resize((max(1, round(src.width * scale)), max(1, round(src.height * scale))), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", size, background)
        canvas.alpha_composite(fitted, ((target_w - fitted.width) // 2, (target_h - fitted.height) // 2))
        return canvas

    return ImageOps.fit(src, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def _rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=min(radius, min(size) // 2), fill=255)
    return mask


def _allowed_change_mask(cal: Calibration) -> Image.Image:
    mask = Image.new("L", cal.source_size, 0)
    draw = ImageDraw.Draw(mask)
    for key in cal.keys:
        draw.rounded_rectangle(key.screen, radius=cal.screen_radius, fill=255)
    return mask


def assert_only_apertures_changed(before: Image.Image, after: Image.Image, cal: Calibration) -> None:
    if before.size != cal.source_size or after.size != cal.source_size:
        raise StreamDeckPhotoError("changed-pixel assertion requires original source dimensions")
    diff = ImageChops.difference(before.convert("RGBA"), after.convert("RGBA"))
    allowed = _allowed_change_mask(cal)
    outside = ImageOps.invert(allowed)
    transparent = Image.new("RGBA", before.size, (0, 0, 0, 0))
    outside_diff = Image.composite(diff, transparent, outside)
    if outside_diff.getbbox() is not None:
        raise StreamDeckPhotoError("key compositing modified pixels outside calibrated LCD apertures")


def compose_device(
    key_images: Sequence[Image.Image],
    *,
    device_path: Path = DEFAULT_DEVICE,
    calibration_path: Path = DEFAULT_CALIBRATION,
    preserve_glass: float = 0.06,
) -> Image.Image:
    cal = load_calibration(calibration_path)
    if len(key_images) != len(cal.keys):
        raise StreamDeckPhotoError(f"expected 15 key images, got {len(key_images)}")
    original = Image.open(device_path).convert("RGBA")
    if original.size != cal.source_size:
        raise StreamDeckPhotoError(f"device source size {original.size} != calibrated {cal.source_size}")
    composed = original.copy()

    for aperture, key_image in zip(cal.keys, key_images):
        x1, y1, x2, y2 = aperture.screen
        size = (x2 - x1, y2 - y1)
        fitted = fit_key_art(
            key_image,
            size,
            transparent_padding=cal.transparent_content_padding,
        )
        if preserve_glass > 0:
            photographed_screen = original.crop(aperture.screen)
            fitted = Image.blend(fitted, photographed_screen, max(0.0, min(0.18, preserve_glass)))
            fitted = ImageEnhance.Contrast(fitted).enhance(1.02)
        mask = _rounded_mask(size, cal.screen_radius)
        transparent = Image.new("RGBA", size, (0, 0, 0, 0))
        patch = Image.composite(fitted, transparent, mask)
        composed.alpha_composite(patch, (x1, y1))

    assert_only_apertures_changed(original, composed, cal)
    return composed


def alpha_crop_device(device: Image.Image, pad: int = 0) -> Image.Image:
    bbox = device.getchannel("A").getbbox()
    if bbox is None:
        raise StreamDeckPhotoError("device plate has no visible alpha content")
    x1, y1, x2, y2 = bbox
    return device.crop((
        max(0, x1 - pad),
        max(0, y1 - pad),
        min(device.width, x2 + pad),
        min(device.height, y2 + pad),
    ))

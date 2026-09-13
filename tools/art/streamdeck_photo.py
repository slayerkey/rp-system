#!/usr/bin/env python3
"""Shared deterministic Stream Deck MK.2 photo compositor.

The approved hardware source contains transparent LCD windows. Product key art
is rendered *behind* those windows and the untouched photographed hardware
plate is composited on top. This preserves the exact physical bezel, roundness,
lighting, glass edge, and chassis without painting over any button hardware.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from PIL import Image, ImageOps

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
    transparent_content_padding: float
    alpha_hole_threshold: int
    keys: tuple[KeyAperture, ...]


def _rect(raw: object, label: str) -> tuple[int, int, int, int]:
    if not isinstance(raw, list) or len(raw) != 4 or not all(isinstance(v, int) for v in raw):
        raise StreamDeckPhotoError(f"{label} must be four integers")
    x1, y1, x2, y2 = raw
    if x2 <= x1 or y2 <= y1:
        raise StreamDeckPhotoError(f"{label} has invalid bounds: {raw}")
    return x1, y1, x2, y2


def _contains(outer: tuple[int, int, int, int], inner: tuple[int, int, int, int]) -> bool:
    return outer[0] <= inner[0] and outer[1] <= inner[1] and outer[2] >= inner[2] and outer[3] >= inner[3]


def _overlap(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    return max(a[0], b[0]) < min(a[2], b[2]) and max(a[1], b[1]) < min(a[3], b[3])


def load_calibration(path: Path = DEFAULT_CALIBRATION) -> Calibration:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema_version") != 2:
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
        transparent_content_padding=float(data.get("transparent_content_padding", 0.07)),
        alpha_hole_threshold=int(data.get("alpha_hole_threshold", 8)),
        keys=tuple(keys),
    )
    validate_calibration(cal)
    return cal


def validate_calibration(cal: Calibration) -> None:
    width, height = cal.source_size
    if not 0 <= cal.transparent_content_padding < 0.4:
        raise StreamDeckPhotoError("transparent_content_padding is out of range")
    if not 0 <= cal.alpha_hole_threshold <= 64:
        raise StreamDeckPhotoError("alpha_hole_threshold is out of range")
    for key in cal.keys:
        bx1, by1, bx2, by2 = key.button
        if bx1 < 0 or by1 < 0 or bx2 > width or by2 > height:
            raise StreamDeckPhotoError(f"button {key.index} is outside source image")
        if not _contains(key.button, key.screen):
            raise StreamDeckPhotoError(f"screen {key.index} is not contained inside its physical button")
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
    if alpha.getextrema()[0] == 255:
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
    """Fit one product key into the LCD underlay.

    Transparent images are alpha-trimmed before fitting so invisible margins
    never shrink the visible icon. Opaque key-face screenshots fill the LCD
    window. The hardware plate itself is never modified.
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


def _screen_is_real_alpha_hole(device: Image.Image, key: KeyAperture, threshold: int) -> bool:
    alpha = device.getchannel("A").crop(key.screen)
    width, height = alpha.size
    center = alpha.getpixel((width // 2, height // 2))
    if center > threshold:
        return False
    # Most of the calibrated screen box must actually be transparent/near-
    # transparent in the source plate. This catches a bad calibration before
    # product art can be rendered in the wrong place.
    low_alpha = alpha.point(lambda value: 255 if value <= threshold else 0)
    histogram = low_alpha.histogram()
    transparent_pixels = histogram[255]
    return transparent_pixels >= width * height * 0.58


def compose_device(
    key_images: Sequence[Image.Image],
    *,
    device_path: Path = DEFAULT_DEVICE,
    calibration_path: Path = DEFAULT_CALIBRATION,
) -> Image.Image:
    cal = load_calibration(calibration_path)
    if len(key_images) != len(cal.keys):
        raise StreamDeckPhotoError(f"expected 15 key images, got {len(key_images)}")

    plate = Image.open(device_path).convert("RGBA")
    if plate.size != cal.source_size:
        raise StreamDeckPhotoError(f"device source size {plate.size} != calibrated {cal.source_size}")
    for key in cal.keys:
        if not _screen_is_real_alpha_hole(plate, key, cal.alpha_hole_threshold):
            raise StreamDeckPhotoError(f"key {key.index} calibration does not match a transparent LCD hole in the source plate")

    # Product pixels live exclusively on an underlay behind the hardware.
    underlay = Image.new("RGBA", plate.size, (0, 0, 0, 0))
    for aperture, key_image in zip(cal.keys, key_images):
        x1, y1, x2, y2 = aperture.screen
        fitted = fit_key_art(
            key_image,
            (x2 - x1, y2 - y1),
            transparent_padding=cal.transparent_content_padding,
        )
        underlay.alpha_composite(fitted, (x1, y1))

    # The original plate is the top layer, unchanged byte-for-byte in memory.
    # Its real transparency defines the LCD roundness and its opaque pixels
    # preserve every photographed bezel/reflection automatically.
    result = Image.alpha_composite(underlay, plate)
    return result


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


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()

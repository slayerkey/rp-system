#!/usr/bin/env python3
"""Shared deterministic Stream Deck MK.2 photo compositor.

The approved hardware plate contains real transparent LCD windows. The
compositor detects those windows from the plate alpha channel, fills every
visible LCD pixel on a product underlay, then places the untouched photographed
hardware plate on top.

The hardware plate is never painted on.
"""
from __future__ import annotations

import hashlib
import json
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "tools" / "art"
DEFAULT_DEVICE = ART / "assets" / "streamdeck-mk2-straight.png"
DEFAULT_CALIBRATION = ART / "streamdeck-mk2-straight.apertures.json"


class StreamDeckPhotoError(RuntimeError):
    pass


@dataclass(frozen=True)
class KeyCalibration:
    index: int
    button: tuple[int, int, int, int]
    expected_hole_bounds: tuple[int, int, int, int]


@dataclass(frozen=True)
class Calibration:
    source_size: tuple[int, int]
    expected_key_count: int
    alpha_hole_threshold: int
    safety_bleed: int
    transparent_content_padding: float
    opaque_content_padding: float
    cached_bound_tolerance: int
    screen_background: tuple[int, int, int, int]
    keys: tuple[KeyCalibration, ...]


@dataclass
class DetectedHole:
    index: int
    button: tuple[int, int, int, int]
    bounds: tuple[int, int, int, int]
    mask: Image.Image
    bleed_mask: Image.Image
    pixels: int


@dataclass
class CompositionResult:
    device: Image.Image
    underlay: Image.Image
    mask_debug: Image.Image
    coverage_debug: Image.Image
    holes: tuple[DetectedHole, ...]
    uncovered_pixels: int


def _rect(raw: object, label: str) -> tuple[int, int, int, int]:
    if not isinstance(raw, list) or len(raw) != 4 or not all(isinstance(v, int) for v in raw):
        raise StreamDeckPhotoError(f"{label} must be four integers")
    x1, y1, x2, y2 = raw
    if x2 <= x1 or y2 <= y1:
        raise StreamDeckPhotoError(f"{label} has invalid bounds: {raw}")
    return x1, y1, x2, y2


def _rgba(raw: object, label: str) -> tuple[int, int, int, int]:
    if not isinstance(raw, list) or len(raw) != 4 or not all(isinstance(v, int) and 0 <= v <= 255 for v in raw):
        raise StreamDeckPhotoError(f"{label} must be four 0..255 integers")
    return raw[0], raw[1], raw[2], raw[3]


def _contains(outer: tuple[int, int, int, int], inner: tuple[int, int, int, int]) -> bool:
    return outer[0] <= inner[0] and outer[1] <= inner[1] and outer[2] >= inner[2] and outer[3] >= inner[3]


def _overlap(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    return max(a[0], b[0]) < min(a[2], b[2]) and max(a[1], b[1]) < min(a[3], b[3])


def load_calibration(path: Path = DEFAULT_CALIBRATION) -> Calibration:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema_version") != 3:
        raise StreamDeckPhotoError("unsupported Stream Deck photo calibration schema")
    size = data.get("source_size")
    if not isinstance(size, list) or len(size) != 2 or not all(isinstance(v, int) and v > 0 for v in size):
        raise StreamDeckPhotoError("source_size must be two positive integers")
    expected_key_count = int(data.get("expected_key_count", 0))
    raw_keys = data.get("keys")
    if not isinstance(raw_keys, list) or len(raw_keys) != expected_key_count or expected_key_count != 15:
        raise StreamDeckPhotoError("MK.2 calibration must contain exactly 15 keys")
    keys: list[KeyCalibration] = []
    for position, item in enumerate(raw_keys):
        if not isinstance(item, dict) or item.get("index") != position:
            raise StreamDeckPhotoError(f"key calibration index mismatch at {position}")
        keys.append(
            KeyCalibration(
                position,
                _rect(item.get("button"), f"key {position} button"),
                _rect(item.get("expected_hole_bounds"), f"key {position} expected_hole_bounds"),
            )
        )
    cal = Calibration(
        source_size=(size[0], size[1]),
        expected_key_count=expected_key_count,
        alpha_hole_threshold=int(data.get("alpha_hole_threshold", 240)),
        safety_bleed=int(data.get("safety_bleed", 3)),
        transparent_content_padding=float(data.get("transparent_content_padding", 0.07)),
        opaque_content_padding=float(data.get("opaque_content_padding", 0.025)),
        cached_bound_tolerance=int(data.get("cached_bound_tolerance", 8)),
        screen_background=_rgba(data.get("screen_background", [10, 12, 16, 255]), "screen_background"),
        keys=tuple(keys),
    )
    validate_calibration(cal)
    return cal


def validate_calibration(cal: Calibration) -> None:
    width, height = cal.source_size
    if not 0 <= cal.alpha_hole_threshold <= 254:
        raise StreamDeckPhotoError("alpha_hole_threshold is out of range")
    if not 0 <= cal.safety_bleed <= 8:
        raise StreamDeckPhotoError("safety_bleed is out of range")
    if not 0 <= cal.transparent_content_padding < 0.4:
        raise StreamDeckPhotoError("transparent_content_padding is out of range")
    if not 0 <= cal.opaque_content_padding < 0.15:
        raise StreamDeckPhotoError("opaque_content_padding is out of range")
    if not 0 <= cal.cached_bound_tolerance <= 24:
        raise StreamDeckPhotoError("cached_bound_tolerance is out of range")
    for key in cal.keys:
        bx1, by1, bx2, by2 = key.button
        if bx1 < 0 or by1 < 0 or bx2 > width or by2 > height:
            raise StreamDeckPhotoError(f"button {key.index} is outside source image")
        if not _contains(key.button, key.expected_hole_bounds):
            raise StreamDeckPhotoError(f"expected LCD bounds {key.index} escape the physical button")


def _bounds_close(actual: tuple[int, int, int, int], expected: tuple[int, int, int, int], tolerance: int) -> bool:
    return all(abs(a - e) <= tolerance for a, e in zip(actual, expected))


def _connected_components(alpha: Image.Image, threshold: int):
    width, height = alpha.size
    pix = alpha.load()
    seen = bytearray(width * height)
    components = []

    def pos(x: int, y: int) -> int:
        return y * width + x

    for sy in range(height):
        for sx in range(width):
            start = pos(sx, sy)
            if seen[start]:
                continue
            seen[start] = 1
            if pix[sx, sy] > threshold:
                continue

            queue = deque([(sx, sy)])
            points = []
            touches_edge = False
            while queue:
                x, y = queue.popleft()
                points.append((x, y))
                if x == 0 or y == 0 or x == width - 1 or y == height - 1:
                    touches_edge = True
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    index = pos(nx, ny)
                    if seen[index]:
                        continue
                    seen[index] = 1
                    if pix[nx, ny] <= threshold:
                        queue.append((nx, ny))
            components.append((points, touches_edge))
    return components


def detect_hole(plate: Image.Image, cal: Calibration, key: KeyCalibration) -> DetectedHole:
    bx1, by1, bx2, by2 = key.button
    alpha = plate.getchannel("A").crop(key.button)
    candidates = [
        (points, touches_edge)
        for points, touches_edge in _connected_components(alpha, cal.alpha_hole_threshold)
        if not touches_edge and len(points) >= 500
    ]
    if not candidates:
        raise StreamDeckPhotoError(f"key {key.index} has no internal LCD alpha component")
    candidates.sort(key=lambda item: len(item[0]), reverse=True)
    points, _ = candidates[0]

    # A real MK.2 key should have one dominant internal LCD component.
    if len(candidates) > 1 and len(candidates[1][0]) > len(points) * 0.20:
        raise StreamDeckPhotoError(f"key {key.index} has multiple competing LCD alpha components")

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    local_bounds = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    bounds = (
        bx1 + local_bounds[0],
        by1 + local_bounds[1],
        bx1 + local_bounds[2],
        by1 + local_bounds[3],
    )
    if not _contains(key.button, bounds):
        raise StreamDeckPhotoError(f"detected LCD {key.index} escapes its physical button")
    if not _bounds_close(bounds, key.expected_hole_bounds, cal.cached_bound_tolerance):
        raise StreamDeckPhotoError(
            f"detected LCD {key.index} drifted from cached bounds: actual={bounds} expected={key.expected_hole_bounds}"
        )

    mask = Image.new("L", alpha.size, 0)
    mp = mask.load()
    for x, y in points:
        mp[x, y] = 255

    if cal.safety_bleed:
        bleed_mask = mask.filter(ImageFilter.MaxFilter(cal.safety_bleed * 2 + 1))
    else:
        bleed_mask = mask.copy()
    return DetectedHole(key.index, key.button, bounds, mask, bleed_mask, len(points))


def detect_holes(
    plate: Image.Image,
    calibration_path: Path = DEFAULT_CALIBRATION,
) -> tuple[Calibration, tuple[DetectedHole, ...]]:
    cal = load_calibration(calibration_path)
    if plate.size != cal.source_size:
        raise StreamDeckPhotoError(f"device source size {plate.size} != calibrated {cal.source_size}")
    holes = tuple(detect_hole(plate, cal, key) for key in cal.keys)
    if len(holes) != cal.expected_key_count:
        raise StreamDeckPhotoError(f"expected {cal.expected_key_count} LCD holes, detected {len(holes)}")
    for i, left in enumerate(holes):
        for right in holes[i + 1:]:
            if _overlap(left.bounds, right.bounds):
                raise StreamDeckPhotoError(f"detected LCD bounds overlap: {left.index} and {right.index}")
    return cal, holes


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
    opaque_padding: float,
    background: tuple[int, int, int, int],
) -> Image.Image:
    """Return a fully opaque LCD face for one detected screen window."""
    src = image.convert("RGBA")
    target_w, target_h = size
    if target_w <= 0 or target_h <= 0:
        raise StreamDeckPhotoError(f"invalid key target size: {size}")

    canvas = Image.new("RGBA", size, background)
    if _has_meaningful_transparency(src):
        bbox = _visible_bbox(src)
        if bbox is None:
            return canvas
        src = src.crop(bbox)
        pad_x = round(target_w * transparent_padding)
        pad_y = round(target_h * transparent_padding)
        inner_w = max(1, target_w - 2 * pad_x)
        inner_h = max(1, target_h - 2 * pad_y)
        scale = min(inner_w / src.width, inner_h / src.height)
        fitted = src.resize(
            (max(1, round(src.width * scale)), max(1, round(src.height * scale))),
            Image.Resampling.LANCZOS,
        )
        canvas.alpha_composite(fitted, ((target_w - fitted.width) // 2, (target_h - fitted.height) // 2))
        return canvas

    # Full key-face images are authored for the entire physical LCD. Preserve
    # every source pixel and let the photo geometry provide the perspective
    # compression, but keep a tiny screen-safe inset so border-heavy UI does
    # not visually collide with the photographed glass/bezel edge.
    pad_x = round(target_w * opaque_padding)
    pad_y = round(target_h * opaque_padding)
    inner_w = max(1, target_w - 2 * pad_x)
    inner_h = max(1, target_h - 2 * pad_y)
    fitted = src.resize((inner_w, inner_h), Image.Resampling.LANCZOS)
    canvas.alpha_composite(fitted, (pad_x, pad_y))
    return canvas


def _local_bounds(global_bounds: tuple[int, int, int, int], button: tuple[int, int, int, int]):
    return (
        global_bounds[0] - button[0],
        global_bounds[1] - button[1],
        global_bounds[2] - button[0],
        global_bounds[3] - button[1],
    )


def _validate_coverage(underlay: Image.Image, holes: Sequence[DetectedHole]) -> tuple[int, list[int]]:
    alpha = underlay.getchannel("A")
    total_uncovered = 0
    per_key = []
    for hole in holes:
        bx1, by1, bx2, by2 = hole.button
        patch = alpha.crop(hole.button)
        ap = patch.load()
        mp = hole.mask.load()
        uncovered = 0
        for y in range(hole.mask.height):
            for x in range(hole.mask.width):
                if mp[x, y] and ap[x, y] < 250:
                    uncovered += 1
        per_key.append(uncovered)
        total_uncovered += uncovered
    return total_uncovered, per_key


def _mask_debug(plate: Image.Image, holes: Sequence[DetectedHole]) -> Image.Image:
    base = plate.convert("RGBA").copy()
    colors = [
        (255, 84, 84, 175), (255, 177, 66, 175), (255, 234, 88, 175),
        (75, 226, 135, 175), (77, 185, 255, 175),
    ]
    for hole in holes:
        bx1, by1, _, _ = hole.button
        color = colors[hole.index % len(colors)]
        tint = Image.new("RGBA", hole.mask.size, color)
        transparent = Image.new("RGBA", hole.mask.size, (0, 0, 0, 0))
        overlay = Image.composite(tint, transparent, hole.mask)
        base.alpha_composite(overlay, (bx1, by1))
        ImageDraw.Draw(base).text((hole.bounds[0] + 4, hole.bounds[1] + 4), str(hole.index + 1), fill=(255, 255, 255, 255))
    return base


def _coverage_debug(
    plate: Image.Image,
    underlay: Image.Image,
    holes: Sequence[DetectedHole],
) -> Image.Image:
    base = plate.convert("RGBA").copy()
    alpha = underlay.getchannel("A")
    for hole in holes:
        bx1, by1, _, _ = hole.button
        patch_alpha = alpha.crop(hole.button)
        hp = hole.mask.load()
        ap = patch_alpha.load()
        debug = Image.new("RGBA", hole.mask.size, (0, 0, 0, 0))
        dp = debug.load()
        for y in range(hole.mask.height):
            for x in range(hole.mask.width):
                if not hp[x, y]:
                    continue
                if ap[x, y] >= 250:
                    dp[x, y] = (40, 220, 100, 150)
                else:
                    dp[x, y] = (255, 0, 0, 235)
        base.alpha_composite(debug, (bx1, by1))
    return base


def compose_device(
    key_images: Sequence[Image.Image],
    *,
    device_path: Path = DEFAULT_DEVICE,
    calibration_path: Path = DEFAULT_CALIBRATION,
) -> CompositionResult:
    plate = Image.open(device_path).convert("RGBA")
    cal, holes = detect_holes(plate, calibration_path)
    if len(key_images) != len(holes):
        raise StreamDeckPhotoError(f"expected {len(holes)} key images, got {len(key_images)}")

    original_bytes = plate.tobytes()
    underlay = Image.new("RGBA", plate.size, (0, 0, 0, 0))

    for hole, key_image in zip(holes, key_images):
        bx1, by1, _, _ = hole.button
        lx1, ly1, lx2, ly2 = _local_bounds(hole.bounds, hole.button)
        face = fit_key_art(
            key_image,
            (lx2 - lx1, ly2 - ly1),
            transparent_padding=cal.transparent_content_padding,
            opaque_padding=cal.opaque_content_padding,
            background=cal.screen_background,
        )

        button_patch = Image.new("RGBA", hole.mask.size, cal.screen_background)
        button_patch.alpha_composite(face, (lx1, ly1))
        transparent = Image.new("RGBA", hole.mask.size, (0, 0, 0, 0))
        filled = Image.composite(button_patch, transparent, hole.bleed_mask)
        underlay.alpha_composite(filled, (bx1, by1))

    uncovered, per_key = _validate_coverage(underlay, holes)
    if uncovered:
        raise StreamDeckPhotoError(f"LCD underlay coverage failure: {uncovered} uncovered pixels across keys {per_key}")

    # Product content lives under the plate. The original photographed plate is
    # then composited on top without mutation.
    result = Image.alpha_composite(underlay, plate)
    if plate.tobytes() != original_bytes:
        raise StreamDeckPhotoError("hardware plate was modified in memory")

    return CompositionResult(
        device=result,
        underlay=underlay,
        mask_debug=_mask_debug(plate, holes),
        coverage_debug=_coverage_debug(plate, underlay, holes),
        holes=holes,
        uncovered_pixels=uncovered,
    )


def save_diagnostics(result: CompositionResult, out_dir: Path) -> dict[str, str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    device_path = out_dir / "device-only.png"
    underlay_path = out_dir / "key-underlay.png"
    mask_path = out_dir / "lcd-mask-debug.png"
    coverage_path = out_dir / "lcd-coverage-debug.png"
    alpha_crop_device(result.device).save(device_path, "PNG", optimize=True)
    result.underlay.save(underlay_path, "PNG", optimize=True)
    result.mask_debug.save(mask_path, "PNG", optimize=True)
    result.coverage_debug.save(coverage_path, "PNG", optimize=True)
    return {
        "device_only": device_path.name,
        "key_underlay": underlay_path.name,
        "lcd_mask_debug": mask_path.name,
        "lcd_coverage_debug": coverage_path.name,
    }


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

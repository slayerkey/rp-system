#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from render_streamdeck_product_hero import render

W = H = 288
BG = (8, 10, 14, 255)
CARD = (15, 18, 24, 255)
BORDER = (48, 54, 64, 255)
WHITE = (245, 247, 251, 255)
MUTED = (154, 162, 175, 255)
ORANGE = (255, 178, 30, 255)


def fail(message: str) -> None:
    raise SystemExit(message)


def font_path(bold: bool) -> str:
    env = os.environ.get("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    if env and Path(env).is_file():
        return env
    candidates = (
        [r"C:\Windows\Fonts\segoeuib.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
        if bold
        else [r"C:\Windows\Fonts\segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    )
    for candidate in candidates:
        if Path(candidate).is_file():
            return candidate
    fail("deterministic Stream Deck hero font missing")


def F(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(font_path(bold), size)


def fit(draw: ImageDraw.ImageDraw, text: str, max_width: int, max_size: int, min_size: int) -> ImageFont.FreeTypeFont:
    for size in range(max_size, min_size - 1, -2):
        f = F(size, True)
        box = draw.textbbox((0, 0), text, font=f)
        if box[2] - box[0] <= max_width:
            return f
    return F(min_size, True)


def split_balanced(text: str) -> tuple[str, str]:
    words = [part for part in str(text or "").strip().upper().split() if part]
    if not words:
        return "STREAM DECK", ""
    if len(words) == 1:
        return words[0], ""
    best = None
    for index in range(1, len(words)):
        left = " ".join(words[:index])
        right = " ".join(words[index:])
        score = abs(len(left) - len(right))
        candidate = (score, index, left, right)
        if best is None or candidate < best:
            best = candidate
    assert best is not None
    return best[2], best[3]


def wrap_action_name(name: str) -> tuple[str, str]:
    words = [part for part in str(name or "ACTION").strip().upper().replace("/", " / ").split() if part]
    if len(words) <= 1:
        return (words[0] if words else "ACTION"), ""
    best = None
    for index in range(1, len(words)):
        left = " ".join(words[:index])
        right = " ".join(words[index:])
        score = abs(len(left) - len(right))
        candidate = (score, index, left, right)
        if best is None or candidate < best:
            best = candidate
    assert best is not None
    return best[2], best[3]


def resolve_raster(plugin_dir: Path, ref: str | None) -> Path | None:
    if not ref:
        return None
    normalized = str(ref).replace("\\", "/").lstrip("/")
    base = plugin_dir / normalized
    candidates = [base]
    if not base.suffix:
        candidates.extend(
            [
                Path(str(base) + ".png"),
                Path(str(base) + "@2x.png"),
                Path(str(base) + ".jpg"),
                Path(str(base) + ".jpeg"),
            ]
        )
    for candidate in candidates:
        if candidate.is_file() and candidate.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            return candidate
    return None


def normalize_face(image: Image.Image) -> Image.Image:
    src = image.convert("RGBA")
    canvas = Image.new("RGBA", (W, H), BG)
    fitted = ImageOps.contain(src, (W, H), Image.Resampling.LANCZOS)
    canvas.alpha_composite(fitted, ((W - fitted.width) // 2, (H - fitted.height) // 2))
    return canvas


def blank_face() -> Image.Image:
    image = Image.new("RGBA", (W, H), BG)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((5, 5, W - 5, H - 5), 30, fill=CARD, outline=BORDER, width=3)
    return image


def fallback_face(name: str, icon_path: Path | None = None) -> Image.Image:
    image = blank_face()
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((20, 20, 66, 26), 3, fill=ORANGE)
    draw.rounded_rectangle((W - 54, 20, W - 20, 26), 3, fill=ORANGE)

    if icon_path:
        try:
            icon = Image.open(icon_path).convert("RGBA")
            icon.thumbnail((112, 112), Image.Resampling.LANCZOS)
            image.alpha_composite(icon, ((W - icon.width) // 2, 62))
        except Exception:
            icon_path = None

    line1, line2 = wrap_action_name(name)
    if icon_path:
        top = 205
        f1 = fit(draw, line1, 236, 28, 18)
        draw.text((W // 2, top), line1, font=f1, fill=WHITE, anchor="ma")
        if line2:
            f2 = fit(draw, line2, 236, 24, 16)
            draw.text((W // 2, top + 34), line2, font=f2, fill=MUTED, anchor="ma")
    else:
        f1 = fit(draw, line1, 236, 38, 22)
        draw.text((W // 2, 110), line1, font=f1, fill=WHITE, anchor="mm")
        if line2:
            f2 = fit(draw, line2, 236, 34, 20)
            draw.text((W // 2, 154), line2, font=f2, fill=MUTED, anchor="mm")
        draw.text((W // 2, 212), "PACKRAT", font=F(16, True), fill=ORANGE, anchor="mm")

    return image


def action_face(plugin_dir: Path, action: dict) -> tuple[Image.Image, str]:
    states = action.get("States") if isinstance(action.get("States"), list) else []
    state_ref = None
    if states and isinstance(states[0], dict):
        state_ref = states[0].get("Image")
    state_path = resolve_raster(plugin_dir, state_ref)
    if state_path:
        try:
            return normalize_face(Image.open(state_path)), f"state:{state_path.name}"
        except Exception:
            pass

    icon_path = resolve_raster(plugin_dir, action.get("Icon"))
    return fallback_face(str(action.get("Name") or "Action"), icon_path), "fallback"


def render_ship_hero(product: str, plugin_dir: Path, submission_path: Path, out: Path) -> dict:
    manifest_path = plugin_dir / "manifest.json"
    if not manifest_path.is_file():
        fail(f"Stream Deck hero manifest missing: {manifest_path}")
    if not submission_path.is_file():
        fail(f"Stream Deck hero submission metadata missing: {submission_path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    submission = json.loads(submission_path.read_text(encoding="utf-8"))
    actions = manifest.get("Actions")
    if not isinstance(actions, list) or not actions:
        fail(f"Stream Deck hero requires at least one manifest action: {manifest_path}")

    name = str(submission.get("name") or manifest.get("Name") or product).strip()
    line1, line2 = split_balanced(name)

    key_root = out.parent / "ship-hero-keys"
    key_root.mkdir(parents=True, exist_ok=True)

    sources: list[str] = []
    faces: list[Image.Image] = []
    for action in actions[:15]:
        if not isinstance(action, dict):
            continue
        face, source = action_face(plugin_dir, action)
        faces.append(face)
        sources.append(source)

    if not faces:
        fail("Stream Deck hero could not derive any action faces")

    while len(faces) < 15:
        faces.append(blank_face())
        sources.append("blank")

    for index, face in enumerate(faces[:15]):
        face.save(key_root / f"{index:02d}.png", "PNG", optimize=True)

    render(product, line1, line2, key_root, out)

    report_path = out.parent / "streamdeck-product-hero-report.json"
    if not report_path.is_file():
        fail("canonical Stream Deck hero renderer did not produce its report")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if report.get("detected_key_count") != 15:
        fail("canonical Stream Deck hero did not detect exactly 15 LCDs")
    if report.get("uncovered_lcd_pixels") != 0:
        fail("canonical Stream Deck hero left uncovered LCD pixels")
    if list(report.get("output", {}).get("size") or []) != [1920, 960]:
        fail("canonical Stream Deck hero output must be 1920x960")

    ship_report = {
        "schema_version": 1,
        "product": product,
        "source": "global-rat-ship-streamdeck-hero",
        "title": [line1, line2],
        "manifest": str(manifest_path),
        "submission": str(submission_path),
        "action_count": len(actions),
        "key_sources": sources[:15],
        "cover": str(out),
        "only_marketplace_slot_replaced": "02_cover.png",
        "image_generation": "disabled",
        "canonical_report": report,
    }
    (out.parent / "streamdeck-ship-hero-report.json").write_text(
        json.dumps(ship_report, indent=2) + "\n",
        encoding="utf-8",
    )
    return ship_report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--product", required=True)
    parser.add_argument("--plugin-dir", required=True, type=Path)
    parser.add_argument("--submission", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    render_ship_hero(args.product, args.plugin_dir, args.submission, args.out)
    print(f"STREAM DECK RAT SHIP HERO PASS: {args.product} -> {args.out}")


if __name__ == "__main__":
    main()

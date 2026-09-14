#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from render_streamdeck_product_hero import render

ROOT = Path(__file__).resolve().parents[2]
SVG_RENDERER = ROOT / "tools" / "ship" / "render_svg_icon.mjs"

W = H = 288
BG = (8, 10, 14, 255)
CARD = (15, 18, 24, 255)
BORDER = (48, 54, 64, 255)
WHITE = (245, 247, 251, 255)
MUTED = (154, 162, 175, 255)
ORANGE = (255, 178, 30, 255)
RED = (255, 93, 108, 255)
GREEN = (43, 232, 106, 255)
NEUTRAL = (139, 147, 161, 255)


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


def resolve_asset(plugin_dir: Path, ref: str | None) -> Path | None:
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
                Path(str(base) + ".webp"),
                Path(str(base) + ".svg"),
                Path(str(base) + "@2x.svg"),
            ]
        )
    for candidate in candidates:
        if candidate.is_file() and candidate.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
            return candidate
    return None


def rasterize_svg(svg_path: Path, cache_dir: Path) -> Path:
    if not SVG_RENDERER.is_file():
        fail(f"canonical Stream Deck SVG renderer missing: {SVG_RENDERER}")
    cache_dir.mkdir(parents=True, exist_ok=True)
    safe = svg_path.stem.replace("@", "_at_")
    digest = hashlib.sha256(svg_path.read_bytes()).hexdigest()[:16]
    target = cache_dir / f"{safe}-{digest}.png"
    if target.is_file():
        return target
    result = subprocess.run(
        ["node", str(SVG_RENDERER), str(svg_path), str(target)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if result.returncode != 0 or not target.is_file():
        detail = (result.stderr or result.stdout or "").strip()
        fail(f"could not rasterize Stream Deck SVG key asset {svg_path}: {detail}")
    return target


def raster_asset(asset: Path | None, cache_dir: Path) -> Path | None:
    if asset is None:
        return None
    if asset.suffix.lower() == ".svg":
        return rasterize_svg(asset, cache_dir)
    return asset


def normalize_face(image: Image.Image) -> Image.Image:
    src = image.convert("RGBA")
    canvas = Image.new("RGBA", (W, H), BG)
    fitted = ImageOps.contain(src, (W, H), Image.Resampling.LANCZOS)
    canvas.alpha_composite(fitted, ((W - fitted.width) // 2, (H - fitted.height) // 2))
    return canvas


def blank_face() -> Image.Image:
    image = Image.new("RGBA", (W, H), BG)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((5, 5, W - 5, H - 5), 30, fill=BG, outline=BORDER, width=4)
    return image


def compact_action_name(name: str, product_name: str = "") -> str:
    words = [part for part in str(name or "ACTION").strip().upper().replace("/", " / ").split() if part]
    product_words = {
        part
        for part in str(product_name or "").strip().upper().replace("/", " ").split()
        if len(part) > 2
    }
    trimmed = [part for part in words if part not in product_words]
    # Avoid removing everything when the action is intentionally the same as
    # the product name.
    return " ".join(trimmed or words)


def fallback_face(
    name: str,
    icon_path: Path | None = None,
    product_name: str = "",
    lines: list[str] | None = None,
    tone: str = "brand",
) -> Image.Image:
    image = blank_face()
    draw = ImageDraw.Draw(image)
    # Match the canonical PackRat hardware-key language used by newer products:
    # one restrained orange status/accent line, one large white glyph, concise
    # bottom text. Do not invent extra decorative bars or PACKRAT wordmarks.
    accent = {
        "danger": RED,
        "success": GREEN,
        "neutral": NEUTRAL,
        "brand": ORANGE,
    }.get(str(tone or "brand").lower(), ORANGE)
    draw.rounded_rectangle((44, 20, W - 44, 27), 3, fill=accent)

    if icon_path:
        try:
            icon = Image.open(icon_path).convert("RGBA")
            icon.thumbnail((150, 150), Image.Resampling.LANCZOS)
            image.alpha_composite(icon, ((W - icon.width) // 2, 43))
        except Exception:
            icon_path = None

    if lines is not None:
        clean = [str(value).strip().upper() for value in lines if str(value).strip()][:2]
        if not clean:
            clean = ["N/A"]
        line1 = clean[0]
        line2 = clean[1] if len(clean) > 1 else ""
    else:
        line1, line2 = wrap_action_name(compact_action_name(name, product_name))
    if icon_path:
        top = 211
        f1 = fit(draw, line1, 238, 29, 18)
        draw.text((W // 2, top), line1, font=f1, fill=WHITE, anchor="mm")
        if line2:
            f2 = fit(draw, line2, 238, 25, 16)
            draw.text((W // 2, top + 31), line2, font=f2, fill=WHITE, anchor="mm")
    else:
        f1 = fit(draw, line1, 236, 38, 22)
        draw.text((W // 2, 122), line1, font=f1, fill=WHITE, anchor="mm")
        if line2:
            f2 = fit(draw, line2, 236, 34, 20)
            draw.text((W // 2, 164), line2, font=f2, fill=WHITE, anchor="mm")

    return image


def action_face(plugin_dir: Path, action: dict, cache_dir: Path, product_name: str) -> tuple[Image.Image, str]:
    states = action.get("States") if isinstance(action.get("States"), list) else []
    state_ref = None
    if states and isinstance(states[0], dict):
        state_ref = states[0].get("Image")

    state_asset = resolve_asset(plugin_dir, state_ref)
    if state_asset and state_asset.suffix.lower() != ".svg":
        try:
            return normalize_face(Image.open(state_asset)), f"state-raster:{state_asset.name}"
        except Exception:
            pass

    # Modern PackRat actions often author their canonical glyph as SVG while the
    # real key value is painted dynamically at runtime. Preserve that glyph in
    # Marketplace heroes instead of degrading to a text-only placeholder.
    icon_asset = resolve_asset(plugin_dir, action.get("Icon"))
    visual_asset = icon_asset or state_asset
    visual_path = raster_asset(visual_asset, cache_dir)
    if visual_path:
        return (
            fallback_face(str(action.get("Name") or "Action"), visual_path, product_name),
            f"icon-{visual_asset.suffix.lower().lstrip('.')}:{visual_asset.name}",
        )

    return fallback_face(str(action.get("Name") or "Action"), None, product_name), "text-fallback"


def fixture_faces(
    plugin_dir: Path,
    manifest: dict,
    fixture_path: Path,
    cache_dir: Path,
) -> tuple[list[Image.Image], list[str]]:
    try:
        data = json.loads(fixture_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"could not read Stream Deck Rat Art key fixtures {fixture_path}: {exc}")
    if data.get("schema_version") != 1:
        fail(f"unsupported Stream Deck Rat Art key fixture schema: {fixture_path}")
    specs = data.get("keys")
    if not isinstance(specs, list) or len(specs) != 15:
        fail(f"Stream Deck Rat Art key fixtures must contain exactly 15 entries: {fixture_path}")

    actions = manifest.get("Actions")
    by_uuid = {
        str(action.get("UUID")): action
        for action in actions
        if isinstance(action, dict) and action.get("UUID")
    }

    faces: list[Image.Image] = []
    sources: list[str] = []
    for index, spec in enumerate(specs):
        if spec is None:
            faces.append(blank_face())
            sources.append("fixture-blank")
            continue
        if not isinstance(spec, dict):
            fail(f"Stream Deck Rat Art key fixture {index} must be an object or null")
        action_uuid = str(spec.get("action_uuid") or "").strip()
        action = by_uuid.get(action_uuid)
        if not action:
            fail(f"Stream Deck Rat Art key fixture {index} references unknown action UUID: {action_uuid}")

        icon_asset = resolve_asset(plugin_dir, action.get("Icon"))
        states = action.get("States") if isinstance(action.get("States"), list) else []
        state_ref = states[0].get("Image") if states and isinstance(states[0], dict) else None
        visual_asset = icon_asset or resolve_asset(plugin_dir, state_ref)
        visual_path = raster_asset(visual_asset, cache_dir)
        if not visual_path:
            fail(f"Stream Deck Rat Art key fixture {index} has no usable visual asset: {action_uuid}")

        raw_lines = spec.get("lines")
        if isinstance(raw_lines, str):
            fixture_lines = [part for part in raw_lines.split("\\n") if part.strip()]
        elif isinstance(raw_lines, list):
            fixture_lines = [str(part) for part in raw_lines]
        else:
            fixture_lines = [str(action.get("Name") or "Action")]

        tone = str(spec.get("tone") or "brand").strip().lower()
        if tone not in {"brand", "danger", "success", "neutral"}:
            fail(f"Stream Deck Rat Art key fixture {index} has invalid tone: {tone}")

        faces.append(
            fallback_face(
                str(action.get("Name") or "Action"),
                visual_path,
                "",
                fixture_lines,
                tone,
            )
        )
        sources.append(f"fixture:{action_uuid}")

    return faces, sources


def render_ship_hero(
    product: str,
    plugin_dir: Path,
    submission_path: Path,
    out: Path,
    keys_dir: Path | None = None,
    key_fixtures: Path | None = None,
) -> dict:
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
    svg_cache = out.parent / "ship-hero-svg-cache"

    sources: list[str] = []
    faces: list[Image.Image] = []

    if keys_dir is not None:
        paths = sorted(keys_dir.glob("*.png"))
        if len(paths) != 15:
            fail(f"Product Rat Art keys directory must contain exactly 15 PNGs: {keys_dir} (found {len(paths)})")
        for path in paths:
            try:
                face = normalize_face(Image.open(path))
            except Exception as exc:
                fail(f"Could not load product Rat Art key face {path}: {exc}")
            faces.append(face)
            sources.append(f"product-rat-art:{path.name}")
    elif key_fixtures is not None:
        if not key_fixtures.is_file():
            fail(f"Product Rat Art key fixture file is missing: {key_fixtures}")
        faces, sources = fixture_faces(plugin_dir, manifest, key_fixtures, svg_cache)
    else:
        for action in actions[:15]:
            if not isinstance(action, dict):
                continue
            face, source = action_face(plugin_dir, action, svg_cache, name)
            faces.append(face)
            sources.append(source)

        if not faces:
            fail("Stream Deck hero could not derive any action faces")

        text_only = [source for source in sources if source == "text-fallback"]
        if text_only:
            fail(
                "Stream Deck hero refused text-only key placeholders. "
                "Provide real action Icon/State art or product Rat Art key faces."
            )

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
        "product_rat_art_keys": str(keys_dir) if keys_dir is not None else None,
        "product_rat_art_key_fixtures": str(key_fixtures) if key_fixtures is not None else None,
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
    parser.add_argument("--keys-dir", type=Path)
    parser.add_argument("--key-fixtures", type=Path)
    args = parser.parse_args()
    render_ship_hero(
        args.product,
        args.plugin_dir,
        args.submission,
        args.out,
        args.keys_dir,
        args.key_fixtures,
    )
    print(f"STREAM DECK RAT SHIP HERO PASS: {args.product} -> {args.out}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Canonical deterministic Rat Art renderer for PackRat marketplace art.

This tool never calls an image generation API. XENEON product specific copy and
capture choices live beside each widget in widgets/_src/<slug>/rat-art.json.
The shared renderer only owns the deterministic device plate and composition.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

from xeneon_all_hero_batch import PRODUCTS as APPROVED_XENEON_HERO_PRODUCTS, SCENE_NAME as APPROVED_XENEON_HERO_SCENE, render_one as render_approved_xeneon_hero

ROOT = Path(__file__).resolve().parents[2]
W, H = 1920, 960
BG = (5, 8, 11)
WHITE = (246, 249, 252)
MUTED = (184, 193, 207)
ACCENT = (43, 232, 106)
ASSET_DIR = Path(__file__).resolve().parent / "assets"
DEVICE = ASSET_DIR / "xeneon-edge-straight.png"
DEVICE_QUAD = ASSET_DIR / "xeneon-edge-straight.quad"
RAT = ASSET_DIR / "ratpack-icon-transparent.png"
SLOT_ORDER = ["S_H", "S_V", "M_H", "M_V", "L_H", "L_V", "XL_H", "XL_V"]
CONTENT_DIVIDER_Y = 690
CONTENT_FOOTER_TEXT_Y = 744
MARKETPLACE_ORDER = ["1-hero.png", "3-features.png", "2-showcase.png", "4-settings.png", "5-sizes.png"]


def fail(msg: str) -> None:
    raise SystemExit(f"RAT ART FAIL: {msg}")


def resolve_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    env = os.getenv("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    candidates = [env] if env else []
    if os.name == "nt":
        candidates += [
            r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\bahnschrift.ttf",
            r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        ]
    else:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    fail("required deterministic marketplace font was not found; no silent fallback is allowed")


def fit_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    max_width: int,
    max_size: int,
    min_size: int = 18,
    bold: bool = True,
) -> ImageFont.FreeTypeFont:
    for size in range(max_size, min_size - 1, -2):
        font = resolve_font(size, bold)
        box = draw.textbbox((0, 0), text, font=font)
        if box[2] - box[0] <= max_width:
            return font
    return resolve_font(min_size, bold)


def wrapped_lines(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
    max_lines: int,
) -> list[str]:
    words = str(text).split()
    lines: list[str] = []
    line = ""
    for word in words:
        trial = f"{line} {word}".strip()
        if draw.textbbox((0, 0), trial, font=font)[2] > max_width and line:
            lines.append(line)
            line = word
            if len(lines) >= max_lines:
                break
        else:
            line = trial
    if line and len(lines) < max_lines:
        lines.append(line)
    return lines


def require_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        fail(f"Rat Art config missing {label}")
    return value.strip()


def load_product(slug: str) -> tuple[dict[str, Any], dict[str, Any], Path]:
    src = ROOT / "widgets" / "_src" / slug
    submission_path = src / "submission.json"
    config_path = src / "rat-art.json"
    if not submission_path.is_file():
        fail(f"missing submission metadata: {submission_path}")
    if not config_path.is_file():
        fail(f"missing product Rat Art config: {config_path}")
    submission = json.loads(submission_path.read_text(encoding="utf-8"))
    config = json.loads(config_path.read_text(encoding="utf-8"))
    if submission.get("slug") != slug:
        fail("submission.json slug mismatch")
    if config.get("schema_version") != 1:
        fail("rat-art.json schema_version must be 1")
    require_text(submission.get("name"), "submission name")
    return submission, config, config_path


def gradient_bg(accent=ACCENT) -> Image.Image:
    base = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((W // 2 - 760, 160, W // 2 + 760, H + 350), fill=(*accent, 26))
    draw.ellipse((-350, -330, 700, 430), fill=(24, 120, 82, 20))
    draw.ellipse((W - 700, -250, W + 250, 460), fill=(153, 40, 126, 18))
    return Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(190)))


def header(canvas: Image.Image, title: str, subtitle: str | None = None) -> int:
    draw = ImageDraw.Draw(canvas)
    draw.line((0, 152, W, 152), fill=(*ACCENT, 90), width=1)
    font = fit_font(draw, title, 1600, 76, 42)
    draw.text((W // 2, 76), title, font=font, fill=(*WHITE, 255), anchor="mm")
    if subtitle:
        sub_font = fit_font(draw, subtitle, 1600, 34, 20, bold=False)
        draw.text((W // 2, 184), subtitle, font=sub_font, fill=(*MUTED, 255), anchor="mm")
        return 220
    return 176


def draw_content_divider(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.line((170, CONTENT_DIVIDER_Y, W - 170, CONTENT_DIVIDER_Y), fill=(80, 95, 108, 120), width=1)


def packrat_signature(canvas: Image.Image, y: int = 892) -> None:
    """Render the footer brand mark as the PackRat icon only.

    Marketplace artwork intentionally avoids repeating the PACKRAT wordmark in
    the footer. Product/platform text may still appear elsewhere when useful.
    """
    draw = ImageDraw.Draw(canvas)
    icon_size = 46
    x = (W - icon_size) // 2

    if RAT.exists():
        rat = Image.open(RAT).convert("RGBA")
        box = rat.getbbox()
        if box:
            rat = rat.crop(box)
        scale = min(icon_size / rat.width, icon_size / rat.height)
        rat = rat.resize(
            (max(1, int(rat.width * scale)), max(1, int(rat.height * scale))),
            Image.Resampling.LANCZOS,
        )
        glow = Image.new("RGBA", (76, 76), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.ellipse((10, 10, 66, 66), fill=(*ACCENT, 24))
        canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(12)), (W // 2 - 38, y - 38))
        canvas.alpha_composite(rat, ((W - rat.width) // 2, y - rat.height // 2))
    else:
        draw.ellipse((x + 10, y - 13, x + 36, y + 13), fill=(*ACCENT, 180))


def footer(
    canvas: Image.Image,
    platform_labels: bool = False,
    right_text: str = "CORSAIR XENEON EDGE",
) -> None:
    top = 824
    draw = ImageDraw.Draw(canvas)
    draw.line((0, top, W, top), fill=(*ACCENT, 82), width=1)
    draw.line((0, H - 1, W, H - 1), fill=(*ACCENT, 46), width=1)
    if platform_labels:
        left_font = resolve_font(31, True)
        right_font = fit_font(draw, right_text, 600, 30, 20)
        draw.text((74, 892), "iCUE WIDGET", font=left_font, fill=(*WHITE, 255), anchor="lm")
        draw.text((W - 74, 892), right_text, font=right_font, fill=(*ACCENT, 255), anchor="rm")
    packrat_signature(canvas, 892)


def render_device(shot_path: Path, max_box=(1740, 580)) -> Image.Image:
    if not DEVICE.exists() or not DEVICE_QUAD.exists():
        fail("approved XENEON device plate or quad is missing")
    photo = Image.open(DEVICE).convert("RGBA")
    nums = [
        int(float(value))
        for value in DEVICE_QUAD.read_text(encoding="utf-8").replace(",", " ").split()
    ]
    if len(nums) != 8:
        fail("XENEON device quad must contain exactly eight numbers")
    x1, y1, x2, y2, x3, y3, x4, y4 = nums
    left, top = min(x1, x4), min(y1, y2)
    right, bottom = max(x2, x3), max(y3, y4)
    shot = Image.open(shot_path).convert("RGBA")
    shot = ImageEnhance.Brightness(shot).enhance(1.10)
    shot = ImageEnhance.Contrast(shot).enhance(1.06)
    shot = shot.resize((right - left, bottom - top), Image.Resampling.LANCZOS)
    under = Image.new("RGBA", photo.size, (0, 0, 0, 0))
    under.alpha_composite(shot, (left, top))
    lit = Image.alpha_composite(under, photo)
    crop = photo.getbbox()
    if crop:
        pad = 28
        crop = (
            max(0, crop[0] - pad),
            max(0, crop[1] - pad),
            min(photo.width, crop[2] + pad),
            min(photo.height, crop[3] + pad),
        )
        lit = lit.crop(crop)
    max_width, max_height = max_box
    scale = min(max_width / lit.width, max_height / lit.height)
    return lit.resize(
        (max(1, int(lit.width * scale)), max(1, int(lit.height * scale))),
        Image.Resampling.LANCZOS,
    )


def framed_shot(path: Path, max_box: tuple[int, int]) -> Image.Image:
    shot = Image.open(path).convert("RGBA")
    max_width, max_height = max_box
    scale = min(max_width / shot.width, max_height / shot.height)
    shot = shot.resize(
        (max(1, int(shot.width * scale)), max(1, int(shot.height * scale))),
        Image.Resampling.LANCZOS,
    )
    pad = 10
    panel = Image.new("RGBA", (shot.width + pad * 2, shot.height + pad * 2), (6, 10, 14, 240))
    draw = ImageDraw.Draw(panel)
    draw.rounded_rectangle(
        (0, 0, panel.width - 1, panel.height - 1),
        radius=18,
        outline=(95, 110, 125, 125),
        width=2,
    )
    panel.alpha_composite(shot, (pad, pad))
    return panel


def hero(shots: Path, out: Path, name: str, section: dict[str, Any]) -> None:
    canvas = gradient_bg()
    subtitle = require_text(section.get("subtitle"), "hero.subtitle")
    header(canvas, name, subtitle)
    panel = render_device(shots / "XL_H.png", (1760, 575))
    canvas.alpha_composite(panel, ((W - panel.width) // 2, 220 + max(0, (590 - panel.height) // 2)))
    footer(canvas, platform_labels=True)
    canvas.convert("RGB").save(out / "1-hero.png", quality=96)


def showcase(shots: Path, out: Path, section: dict[str, Any]) -> None:
    canvas = gradient_bg()
    title = require_text(section.get("title"), "showcase.title")
    subtitle = require_text(section.get("subtitle"), "showcase.subtitle")
    shot_name = require_text(section.get("shot", "XL_H.png"), "showcase.shot")
    header(canvas, title, subtitle)
    panel = framed_shot(shots / shot_name, (1700, 500))
    canvas.alpha_composite(panel, ((W - panel.width) // 2, 260))
    footer(canvas)
    canvas.convert("RGB").save(out / "2-showcase.png", quality=96)


def features(shots: Path, out: Path, section: dict[str, Any]) -> None:
    canvas = gradient_bg()
    title = require_text(section.get("title"), "features.title")
    subtitle = require_text(section.get("subtitle"), "features.subtitle")
    shot_name = require_text(section.get("shot", "M_V.png"), "features.shot")
    items = section.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= 4:
        fail("features.items must contain between one and four entries")
    header(canvas, title, subtitle)
    panel = framed_shot(shots / shot_name, (520, 500))
    canvas.alpha_composite(panel, (88, 270))
    draw = ImageDraw.Draw(canvas)
    x, y, max_width = 690, 285, 1090
    spacing = 472 // max(1, len(items))
    for item in items:
        if not isinstance(item, list) or len(item) != 2:
            fail("each features.items entry must be [title, description]")
        item_title = require_text(item[0], "feature title")
        description = require_text(item[1], "feature description")
        draw.rounded_rectangle((x, y + 12, x + 10, y + 32), radius=3, fill=(*ACCENT, 255))
        title_font = resolve_font(31, True)
        draw.text((x + 28, y), item_title, font=title_font, fill=(*WHITE, 255))
        desc_font = resolve_font(22, False)
        yy = y + 42
        for line in wrapped_lines(draw, description, desc_font, max_width - 40, 2):
            draw.text((x + 28, yy), line, font=desc_font, fill=(*MUTED, 255))
            yy += 29
        y += spacing
    footer(canvas)
    canvas.convert("RGB").save(out / "3-features.png", quality=96)


def settings(shots: Path, out: Path, section: dict[str, Any]) -> None:
    canvas = gradient_bg()
    title = require_text(section.get("title"), "settings.title")
    subtitle = require_text(section.get("subtitle"), "settings.subtitle")
    panels = section.get("panels")
    if not isinstance(panels, list) or not 1 <= len(panels) <= 4:
        fail("settings.panels must contain between one and four entries")
    header(canvas, title, subtitle)
    draw = ImageDraw.Draw(canvas)
    gap = 28
    box_width = min(390, (1640 - gap * (len(panels) - 1)) // len(panels))
    total = box_width * len(panels) + gap * (len(panels) - 1)
    x = (W - total) // 2
    panel_top = 285
    label_y = 610
    for panel_meta in panels:
        if not isinstance(panel_meta, dict):
            fail("each settings.panels entry must be an object")
        label = require_text(panel_meta.get("label"), "settings panel label")
        file_name = require_text(panel_meta.get("file"), "settings panel file")
        panel = framed_shot(shots / file_name, (box_width, 250))
        canvas.alpha_composite(panel, (x + (box_width - panel.width) // 2, panel_top))
        draw.text(
            (x + box_width // 2, label_y),
            label,
            font=resolve_font(25, True),
            fill=(*WHITE, 255),
            anchor="mm",
        )
        x += box_width + gap
    draw_content_divider(canvas)
    tags = section.get("tags")
    if isinstance(tags, str) and tags.strip():
        tag_font = fit_font(draw, tags, 1500, 23, 17, bold=False)
        draw.text((W // 2, CONTENT_FOOTER_TEXT_Y), tags, font=tag_font, fill=(*MUTED, 255), anchor="mm")
    footer(canvas)
    canvas.convert("RGB").save(out / "4-settings.png", quality=96)


def sizes(shots: Path, out: Path, section: dict[str, Any]) -> None:
    canvas = gradient_bg()
    title = require_text(section.get("title"), "sizes.title")
    subtitle = require_text(section.get("subtitle"), "sizes.subtitle")
    footer_text = require_text(section.get("footer"), "sizes.footer")
    header(canvas, title, subtitle)
    draw = ImageDraw.Draw(canvas)
    specs = [
        ("S slot", "S_H.png", 300, 210),
        ("M slot", "M_V.png", 255, 300),
        ("L slot", "L_H.png", 390, 210),
        ("XL slot", "XL_H.png", 450, 210),
    ]
    gap = 35
    widths = [spec[2] for spec in specs]
    total = sum(widths) + gap * 3
    x = (W - total) // 2
    base = 285
    visual_band = 300
    label_y = 640
    for label, file_name, max_width, max_height in specs:
        panel = framed_shot(shots / file_name, (max_width, max_height))
        py = base + (visual_band - panel.height) // 2
        canvas.alpha_composite(panel, (x + (max_width - panel.width) // 2, py))
        draw.text(
            (x + max_width // 2, label_y),
            label,
            font=resolve_font(24, True),
            fill=(*WHITE, 255),
            anchor="mm",
        )
        x += max_width + gap
    draw_content_divider(canvas)
    footer_font = fit_font(draw, footer_text, 1500, 21, 16, bold=False)
    draw.text((W // 2, CONTENT_FOOTER_TEXT_Y), footer_text, font=footer_font, fill=(*MUTED, 255), anchor="mm")
    footer(canvas)
    canvas.convert("RGB").save(out / "5-sizes.png", quality=96)


def contact_sheet(out: Path, name: str) -> None:
    files = [out / file_name for file_name in MARKETPLACE_ORDER]
    thumb_width, thumb_height = 768, 384
    sheet = Image.new("RGB", (1600, 1320), (7, 9, 12))
    draw = ImageDraw.Draw(sheet)
    title = f"{name} • Rat Art candidate"
    draw.text((42, 38), title, font=fit_font(draw, title, 1500, 40, 24), fill=WHITE)
    positions = [(32, 110), (800, 110), (32, 520), (800, 520), (416, 930)]
    for image_path, (x, y) in zip(files, positions):
        image = Image.open(image_path).convert("RGB").resize(
            (thumb_width, thumb_height),
            Image.Resampling.LANCZOS,
        )
        sheet.paste(image, (x, y))
    sheet.save(out / "contact-sheet.jpg", quality=92)


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def referenced_shots(config: dict[str, Any]) -> set[str]:
    result = {f"{name}.png" for name in SLOT_ORDER}
    showcase_cfg = config.get("showcase") or {}
    features_cfg = config.get("features") or {}
    if isinstance(showcase_cfg, dict) and isinstance(showcase_cfg.get("shot"), str):
        result.add(showcase_cfg["shot"])
    if isinstance(features_cfg, dict) and isinstance(features_cfg.get("shot"), str):
        result.add(features_cfg["shot"])
    settings_cfg = config.get("settings") or {}
    if isinstance(settings_cfg, dict):
        for panel in settings_cfg.get("panels") or []:
            if isinstance(panel, dict) and isinstance(panel.get("file"), str):
                result.add(panel["file"])
    return result


def render_xeneon(slug: str, shots: Path, out: Path) -> None:
    submission, config, config_path = load_product(slug)
    required = [shots / name for name in sorted(referenced_shots(config))]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        fail("missing deterministic widget captures: " + ", ".join(missing))
    for section in ("hero", "showcase", "features", "settings", "sizes"):
        if not isinstance(config.get(section), dict):
            fail(f"rat-art.json missing {section} section")

    out.mkdir(parents=True, exist_ok=True)
    name = require_text(submission.get("name"), "submission name")
    hero(shots, out, name, config["hero"])
    if slug in APPROVED_XENEON_HERO_PRODUCTS:
        render_approved_xeneon_hero(slug, shots / "XL_H.png", out / "1-hero.png", write_metadata=False)
    showcase(shots, out, config["showcase"])
    features(shots, out, config["features"])
    settings(shots, out, config["settings"])
    sizes(shots, out, config["sizes"])
    contact_sheet(out, name)

    report = {
        "schema_version": 3,
        "slug": slug,
        "image_generation": "disabled",
        "renderer": "tools/art/rat_art.py",
        "product_config": str(config_path.relative_to(ROOT)).replace("\\", "/"),
        "product_config_sha256": sha(config_path),
        "marketplace_order": MARKETPLACE_ORDER,
        "footer_branding": "logo-only",
        "hero_system": (
            f"approved-xeneon:{APPROVED_XENEON_HERO_SCENE}"
            if slug in APPROVED_XENEON_HERO_PRODUCTS
            else "legacy-xeneon"
        ),
        "outputs": {
            path.name: {"size": Image.open(path).size, "sha256": sha(path)}
            for path in sorted(out.glob("*.png"))
        },
        "contact_sheet": "contact-sheet.jpg",
    }
    (out / "rat-art-report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"RAT ART PASS: {slug} -> {out}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    xeneon = sub.add_parser("xeneon")
    xeneon.add_argument("slug")
    xeneon.add_argument("--shots", required=True, type=Path)
    xeneon.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    if args.cmd == "xeneon":
        render_xeneon(args.slug, args.shots, args.out)


if __name__ == "__main__":
    main()

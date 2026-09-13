#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import shutil
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "tools" / "art"
CATALOG_PATH = ART / "xeneon_hero_catalog.json"
PLATE = ART / "assets" / "xeneon-edge-transparent.png"
LOGO = ART / "assets" / "ratpack-icon-transparent.png"
W, H = 1920, 960
ORANGE = (244, 116, 0)
WHITE = (247, 248, 250)
MON = (430, 74, 1495, 570)


def fail(msg: str) -> None:
    raise SystemExit(msg)


def load_catalog() -> tuple[dict, dict[str, dict]]:
    if not CATALOG_PATH.is_file():
        fail(f"XENEON hero catalog missing: {CATALOG_PATH}")
    data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if data.get("version") != 1:
        fail(f"unsupported XENEON hero catalog version: {data.get('version')}")
    scene = str(data.get("scene") or "").strip()
    if not scene:
        fail("XENEON hero catalog scene is required")
    products = data.get("products")
    if not isinstance(products, list) or not products:
        fail("XENEON hero catalog requires products")

    by_slug: dict[str, dict] = {}
    for item in products:
        if not isinstance(item, dict):
            fail("XENEON hero catalog product entries must be objects")
        slug = str(item.get("slug") or "").strip()
        name = str(item.get("name") or "").strip()
        title = item.get("title")
        if not slug or not name or not isinstance(title, list) or len(title) != 2:
            fail(f"invalid XENEON hero catalog entry: {item!r}")
        if slug in by_slug:
            fail(f"duplicate XENEON hero slug: {slug}")
        by_slug[slug] = {
            "slug": slug,
            "name": name,
            "title": [str(title[0] or "").strip(), str(title[1] or "").strip()],
        }
    return data, by_slug


CATALOG, PRODUCTS = load_catalog()
SCENE_NAME = str(CATALOG["scene"])
BASE = ART / "scenes" / SCENE_NAME / "base.png"
PLATFORM_SUBTITLE = str(CATALOG.get("platform_subtitle") or "for XENEON Edge")


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
    fail("deterministic font missing")


def F(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(font_path(bold), size)


def fit(draw: ImageDraw.ImageDraw, text: str, max_width: int, max_size: int, min_size: int, bold: bool = True):
    if not text:
        return F(min_size, bold)
    for size in range(max_size, min_size - 1, -2):
        font = F(size, bold)
        box = draw.textbbox((0, 0), text, font=font)
        if box[2] - box[0] <= max_width:
            return font
    return F(min_size, bold)


def safe_logo() -> Image.Image:
    src = Image.open(LOGO).convert("RGBA")
    width, height = src.size
    pad = max(18, round(max(width, height) * 0.20))
    out = Image.new("RGBA", (width + 2 * pad, height + 2 * pad), (0, 0, 0, 0))
    out.alpha_composite(src, (pad, pad))
    out.thumbnail((164, 172), Image.Resampling.LANCZOS)
    return out


def monitor(
    img: Image.Image,
    line1: str,
    line2: str,
    *,
    platform_subtitle: str | None = None,
) -> None:
    x1, y1, x2, y2 = MON
    width = x2 - x1
    height = y2 - y1
    panel = Image.new("RGBA", (width, height), (4, 6, 8, 255))
    draw = ImageDraw.Draw(panel)

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((-120, int(height * 0.60), width + 140, int(height * 1.26)), fill=(*ORANGE, 30))
    panel.alpha_composite(glow.filter(ImageFilter.GaussianBlur(42)))

    for band in range(6):
        points = []
        baseline = int(height * 0.88) + band * 3
        for x in range(-20, width + 20, 8):
            points.append((x, baseline + int(math.sin(x / width * math.pi * 2 + band * 0.18) * (4 + band))))
        draw.line(points, fill=(*ORANGE, max(7, 27 - band * 3)), width=1)

    for x in range(int(width * 0.81), width - 28, 10):
        for y in range(22, 122, 10):
            draw.ellipse((x, y, x + 2, y + 2), fill=(*ORANGE, 25))

    f1 = fit(draw, line1, int(width * 0.84), 116, 50)
    f2 = fit(draw, line2, int(width * 0.88), 126, 48)
    subtitle = PLATFORM_SUBTITLE if platform_subtitle is None else platform_subtitle
    fs = fit(draw, subtitle, int(width * 0.58), 46, 29)

    def center(text: str, font, center_y: float, color: tuple[int, int, int]) -> None:
        if not text:
            return
        box = draw.textbbox((0, 0), text, font=font)
        text_width = box[2] - box[0]
        text_height = box[3] - box[1]
        tx = (width - text_width) // 2
        ty = int(center_y - text_height / 2 - box[1])
        shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.text((tx + 2, ty + 4), text, font=font, fill=(0, 0, 0, 175))
        panel.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(4)))
        draw.text((tx, ty), text, font=font, fill=(*color, 255))

    if line1:
        center(line1, f1, height * 0.10, WHITE)
        center(line2, f2, height * 0.31, ORANGE)
        center(subtitle, fs, height * 0.49, WHITE)
    else:
        center(line2, f2, height * 0.22, ORANGE)
        center(subtitle, fs, height * 0.48, WHITE)

    img.alpha_composite(panel, (x1, y1))


def device_geometry():
    plate = Image.open(PLATE).convert("RGBA")
    bbox = plate.getchannel("A").getbbox()
    if bbox is None:
        fail("approved XENEON device plate has no alpha content")
    pad = 10
    cx1 = max(0, bbox[0] - pad)
    cy1 = max(0, bbox[1] - pad)
    cx2 = min(plate.width, bbox[2] + pad)
    cy2 = min(plate.height, bbox[3] + pad)
    crop = plate.crop((cx1, cy1, cx2, cy2))
    screen = (243 - cx1, 465 - cy1, 1658 - cx1, 848 - cy1)
    target_width = 1890
    scale = target_width / crop.width
    target_height = round(crop.height * scale)
    x = (W - target_width) // 2
    y = H - target_height - 8
    device = crop.resize((target_width, target_height), Image.Resampling.LANCZOS)
    sx1, sy1, sx2, sy2 = [round(value * scale) for value in screen]
    return device, x, y, (sx1, sy1, sx2, sy2)


def prep_ui(path: Path, size: tuple[int, int]) -> Image.Image:
    ui = Image.open(path).convert("RGBA").resize(size, Image.Resampling.LANCZOS)
    ui = ImageEnhance.Contrast(ui).enhance(1.055)
    ui = ImageEnhance.Sharpness(ui).enhance(1.32)
    return ui.filter(ImageFilter.UnsharpMask(radius=0.75, percent=115, threshold=2))


def render_one(slug: str, shot: Path, out: Path, write_metadata: bool = True) -> None:
    product = PRODUCTS.get(slug)
    if product is None:
        fail(f"unknown XENEON slug: {slug}")
    if not shot.is_file():
        fail(f"missing real XL_H capture: {shot}")
    if not BASE.is_file() or not PLATE.is_file() or not LOGO.is_file():
        fail("approved environment assets missing")

    line1, line2 = product["title"]
    img = Image.open(BASE).convert("RGBA")
    if img.size != (W, H):
        fail(f"approved environment must be {W}x{H}: {BASE}")
    monitor(img, line1, line2)

    device, x, y, screen = device_geometry()
    sx1, sy1, sx2, sy2 = screen
    ui = prep_ui(shot, (sx2 - sx1, sy2 - sy1))

    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    alpha = device.getchannel("A").filter(ImageFilter.GaussianBlur(15))
    shadow_surface = Image.new("RGBA", device.size, (0, 0, 0, 84))
    shadow_surface.putalpha(alpha)
    shadow.alpha_composite(shadow_surface, (x + 4, y + 10))
    img.alpha_composite(shadow)

    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    layer.alpha_composite(ui, (x + sx1, y + sy1))
    layer.alpha_composite(device, (x, y))
    img.alpha_composite(layer)

    logo = safe_logo()
    img.alpha_composite(logo, (W - 58 - logo.width, 24))

    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out, "PNG", optimize=True)
    if write_metadata:
        out.with_suffix(".json").write_text(
            json.dumps(
                {
                    "slug": slug,
                    "name": product["name"],
                    "title": product["title"],
                    "scene": SCENE_NAME,
                    "catalog_version": CATALOG["version"],
                    "source_capture": str(shot),
                    "generated_image_dependency": False,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
    print(f"PASS {slug}: {out}")


def bundle(inp: Path, outdir: Path) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    heroes = outdir / "heroes"
    heroes.mkdir(exist_ok=True)

    rows = []
    for slug, product in PRODUCTS.items():
        png = inp / f"{slug}.png"
        meta = inp / f"{slug}.json"
        if png.is_file():
            shutil.copy2(png, heroes / png.name)
            rows.append((slug, product["name"], "RENDERED", png))
        else:
            rows.append((slug, product["name"], "MISSING", ""))
        if meta.is_file():
            shutil.copy2(meta, heroes / meta.name)

    rendered = [row for row in rows if row[2] == "RENDERED"]
    cols = 4
    tile_width, tile_height = 480, 280
    nrows = math.ceil(len(rendered) / cols)
    contact = Image.new("RGB", (cols * tile_width, nrows * tile_height), (12, 12, 14))
    draw = ImageDraw.Draw(contact)
    label_font = F(20, True)
    small = Image.new("RGB", (cols * 288, nrows * 144), (12, 12, 14))

    for index, (slug, name, _, path) in enumerate(rendered):
        col, row = index % cols, index // cols
        image = Image.open(path).convert("RGB")
        contact.paste(image.resize((480, 240), Image.Resampling.LANCZOS), (col * tile_width, row * tile_height))
        draw.rectangle(
            (col * tile_width, row * tile_height + 240, col * tile_width + tile_width, row * tile_height + tile_height),
            fill=(16, 17, 20),
        )
        draw.text((col * tile_width + 12, row * tile_height + 249), name, font=label_font, fill=(245, 246, 248))
        small.paste(image.resize((288, 144), Image.Resampling.LANCZOS), (col * 288, row * 144))

    contact.save(outdir / "contact-sheet.jpg", quality=94)
    small.save(outdir / "15-percent-sheet.jpg", quality=96)

    with (outdir / "manifest.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["slug", "product", "status"])
        for row in rows:
            writer.writerow(row[:3])

    (outdir / "README.md").write_text(
        "# PackRat XENEON all-hero batch\n\n"
        f"Rendered {len(rendered)}/{len(PRODUCTS)} configured XENEON products with real XL_H captures "
        f"and the approved {SCENE_NAME} hero system.\n\n"
        "No image-generation provider is used.\n",
        encoding="utf-8",
    )

    zip_path = outdir.parent / "packrat-xeneon-all-heroes.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(outdir.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(outdir))

    print(f"BUNDLE {len(rendered)}/{len(PRODUCTS)}: {zip_path}")
    if len(rendered) != len(PRODUCTS):
        fail("batch incomplete; see manifest.csv")


def list_products() -> None:
    for slug in PRODUCTS:
        print(slug)


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    render_parser = sub.add_parser("render")
    render_parser.add_argument("--slug", required=True)
    render_parser.add_argument("--shot", type=Path, required=True)
    render_parser.add_argument("--out", type=Path, required=True)

    bundle_parser = sub.add_parser("bundle")
    bundle_parser.add_argument("--input", type=Path, required=True)
    bundle_parser.add_argument("--out-dir", type=Path, required=True)

    sub.add_parser("list")

    args = parser.parse_args()
    if args.cmd == "render":
        render_one(args.slug, args.shot, args.out)
    elif args.cmd == "bundle":
        bundle(args.input, args.out_dir)
    else:
        list_products()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Deterministic Marketplace art for PackRat Stream Deck icon packs.

The icon factory owns semantic rendering and writes the generated product under
out/icons/<slug>. This renderer consumes only verified factory output and never
invents icon counts or substitutes decorative glyphs for the real product.
"""
from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 960
BG = (5, 7, 12)
PANEL = (14, 17, 25)
BORDER = (52, 60, 78)
WHITE = (247, 249, 253)
MUTED = (171, 183, 202)
ACCENT = (126, 112, 255)
CYAN = (83, 220, 225)
PINK = (255, 87, 166)
PRIORITY_TAGS = {"P0", "P1", "P2", "P3"}
REQUIRED_MEDIA = [
    "01_search_icon.png",
    "02_cover.png",
    "03_gallery_01.png",
    "04_gallery_02.png",
    "05_gallery_03.png",
    "06_gallery_04.png",
]


def fail(message: str) -> None:
    raise SystemExit(f"RAT ICON ART FAIL: {message}")


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    env = os.getenv("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    candidates = [env] if env else []
    if os.name == "nt":
        candidates += [
            r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
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
        if candidate and Path(candidate).is_file():
            return ImageFont.truetype(candidate, size)
    fail("required deterministic font was not found")


def fit_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    max_width: int,
    max_size: int,
    min_size: int = 18,
    bold: bool = True,
) -> ImageFont.FreeTypeFont:
    for size in range(max_size, min_size - 1, -2):
        candidate = font(size, bold)
        box = draw.textbbox((0, 0), text, font=candidate)
        if box[2] - box[0] <= max_width:
            return candidate
    return font(min_size, bold)


def background() -> Image.Image:
    canvas = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((-360, -330, 780, 580), fill=(*PINK, 32))
    draw.ellipse((720, -250, 1900, 880), fill=(*ACCENT, 34))
    draw.ellipse((650, 520, 1700, 1250), fill=(*CYAN, 25))
    return Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(180)))


def card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int = 28) -> None:
    draw.rounded_rectangle(
        box,
        radius=radius,
        fill=(*PANEL, 238),
        outline=(*BORDER, 210),
        width=2,
    )


def footer(canvas: Image.Image, rat_path: Path | None) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.line((0, 824, W, 824), fill=(*ACCENT, 80), width=1)
    if rat_path and rat_path.is_file():
        rat = Image.open(rat_path).convert("RGBA")
        box = rat.getbbox()
        if box:
            rat = rat.crop(box)
        rat.thumbnail((48, 48), Image.Resampling.LANCZOS)
        canvas.alpha_composite(rat, ((W - rat.width) // 2, 884 - rat.height // 2))


def header(canvas: Image.Image, kicker: str, title: str, subtitle: str) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.text((110, 82), kicker, font=font(22), fill=(*CYAN, 255))
    draw.text((110, 126), title, font=fit_font(draw, title, 1600, 62, 40), fill=(*WHITE, 255))
    draw.text(
        (112, 205),
        subtitle,
        font=fit_font(draw, subtitle, 1600, 27, 19, False),
        fill=(*MUTED, 255),
    )


def save(canvas: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(path, "PNG", optimize=True)


def load_factory_output(out_root: Path) -> tuple[dict, dict, list[dict], Path, dict]:
    required = [
        out_root / "marketing" / "rat-art-icons.json",
        out_root / "package-staging" / "manifest.json",
        out_root / "package-staging" / "icons.json",
        out_root / "qa" / "static-build-report.json",
    ]
    for path in required:
        if not path.is_file():
            fail(f"factory output missing {path}")

    handoff = json.loads(required[0].read_text(encoding="utf-8"))
    manifest = json.loads(required[1].read_text(encoding="utf-8"))
    staged_entries = json.loads(required[2].read_text(encoding="utf-8"))
    report = json.loads(required[3].read_text(encoding="utf-8"))
    static_dir = out_root / "static"
    animated_dir = out_root / "animated"

    records: list[dict] = []
    for entry in report.get("icons", []):
        icon_id = str(entry.get("id", "")).strip()
        path = static_dir / f"{icon_id}.png"
        if not icon_id or not path.is_file():
            continue
        records.append(
            {
                "id": icon_id,
                "name": str(entry.get("name") or icon_id).replace("_", " ").title(),
                "category": str(entry.get("category") or "other"),
                "path": path,
            }
        )

    actual_count = int(handoff.get("actual_icon_count", -1))
    if len(records) != actual_count:
        fail(f"static count mismatch: report has {len(records)}, handoff declares {actual_count}")

    staged_paths = {str(entry.get("path", "")).casefold() for entry in staged_entries}
    if len(staged_paths) != len(staged_entries):
        fail("package staging contains duplicate picker paths")

    animation_summary = {"fps": None, "duration": None}
    animation_report = out_root / "qa" / "animated-build-report.json"
    if animation_report.is_file():
        animated = json.loads(animation_report.read_text(encoding="utf-8"))
        metas = [entry.get("animation") for entry in animated.get("icons", []) if entry.get("animation")]
        fps_values = sorted({int(meta["fps"]) for meta in metas if meta.get("fps") is not None})
        duration_values = sorted({float(meta["duration"]) for meta in metas if meta.get("duration") is not None})
        if len(fps_values) == 1:
            animation_summary["fps"] = fps_values[0]
        if len(duration_values) == 1:
            animation_summary["duration"] = duration_values[0]

    return handoff, manifest, records, animated_dir, animation_summary


def tile(path: Path, size: int) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    return image.resize((size, size), Image.Resampling.LANCZOS)


def sample(records: list[dict], count: int) -> list[dict]:
    if not records:
        return []
    step = max(1, len(records) // count)
    chosen = []
    for index in range(0, len(records), step):
        chosen.append(records[index])
        if len(chosen) >= count:
            break
    return chosen


def render_search_icon(out_root: Path, destination: Path) -> None:
    source = out_root / "static" / "packrat_brand.png"
    if not source.is_file():
        options = sorted((out_root / "static").glob("*.png"))
        if not options:
            fail("no static icon is available for the Marketplace search icon")
        source = options[0]
    tile(source, 512).save(destination / "01_search_icon.png", "PNG", optimize=True)


def render_cover(
    destination: Path,
    handoff: dict,
    manifest: dict,
    records: list[dict],
    rat_path: Path | None,
) -> None:
    canvas = background()
    draw = ImageDraw.Draw(canvas)
    draw.text((105, 90), "PACKRAT ICON PACK", font=font(22), fill=(*CYAN, 255))
    name = str(manifest.get("Name") or handoff.get("name") or "PackRat Icon Pack")
    draw.text((105, 132), name, font=fit_font(draw, name, 800, 68, 44), fill=(*WHITE, 255))
    draw.text((108, 225), "Recognition first. RGB second.", font=font(30, False), fill=(*MUTED, 255))

    static_count = int(handoff["actual_icon_count"])
    animated_count = int(handoff.get("animated_icon_count", 0))
    categories = Counter(record["category"] for record in records)
    core_count = static_count - categories.get("symbols", 0) - categories.get("numbers", 0)

    draw.text(
        (108, 304),
        f"{static_count} static icons  +  {animated_count} animated counterparts",
        font=font(27),
        fill=(*CYAN, 255),
    )
    y = 390
    for value, label in [
        (core_count, "ACTION + WORKFLOW ICONS"),
        (categories.get("symbols", 0), "SYMBOLS + LABELS"),
        (categories.get("numbers", 0), "NUMBERED KEYS"),
    ]:
        card(draw, (108, y, 760, y + 98), 22)
        draw.text((140, y + 18), str(value), font=font(38), fill=(*WHITE, 255))
        draw.text((260, y + 31), label, font=font(19), fill=(*MUTED, 255))
        y += 116

    core = [record for record in records if record["category"] not in {"symbols", "numbers"}]
    chosen = sample(core, 20)
    start_x, start_y, size, gap = 950, 115, 132, 22
    for index, record in enumerate(chosen):
        row, column = divmod(index, 5)
        canvas.alpha_composite(
            tile(record["path"], size),
            (start_x + column * (size + gap), start_y + row * (size + gap)),
        )
    footer(canvas, rat_path)
    save(canvas, destination / "02_cover.png")


def render_small_scale(destination: Path, records: list[dict], rat_path: Path | None) -> None:
    canvas = background()
    header(
        canvas,
        "REAL KEY SIZE",
        "Built to read at a glance.",
        "Every visual decision is judged at Stream Deck scale, not only in a giant preview.",
    )
    draw = ImageDraw.Draw(canvas)
    core = [record for record in records if record["category"] not in {"symbols", "numbers"}]
    chosen = sample(core, 8)[:4]
    sizes = [144, 72, 36]
    columns = [1030, 1270, 1490]
    draw.text((105, 330), "144 → 72 → 36 PX", font=font(27), fill=(*CYAN, 255))
    draw.multiline_text(
        (105, 382),
        "Large silhouette. Controlled glow.\nClear foreground hierarchy.",
        font=font(31),
        fill=(*WHITE, 255),
        spacing=12,
    )
    draw.multiline_text(
        (105, 525),
        "The RGB treatment supports recognition.\nIt never replaces it.",
        font=font(23, False),
        fill=(*MUTED, 255),
        spacing=10,
    )
    for row, record in enumerate(chosen):
        y = 295 + row * 118
        draw.text((800, y + 35), record["name"][:22], font=font(16), fill=(*MUTED, 255))
        for x, size in zip(columns, sizes):
            canvas.alpha_composite(tile(record["path"], size), (x + (144 - size) // 2, y))
    footer(canvas, rat_path)
    save(canvas, destination / "03_gallery_01.png")


def render_categories(destination: Path, records: list[dict], rat_path: Path | None) -> None:
    canvas = background()
    categories = Counter(record["category"] for record in records)
    core_count = len(records) - categories.get("symbols", 0) - categories.get("numbers", 0)
    header(
        canvas,
        "CORE COVERAGE",
        f"{core_count} everyday action and workflow icons.",
        "System controls, media, audio, streaming, files, creator tools, development, navigation and more.",
    )
    draw = ImageDraw.Draw(canvas)
    core_categories = [
        category
        for category, _ in categories.most_common()
        if category not in {"symbols", "numbers"}
    ][:6]
    y = 300
    for category in core_categories:
        group = [record for record in records if record["category"] == category]
        draw.text((100, y + 31), category.replace("_", " ").upper(), font=font(20), fill=(*CYAN, 255))
        draw.text((340, y + 31), str(len(group)), font=font(20), fill=(*MUTED, 255))
        for index, record in enumerate(sample(group, 7)):
            canvas.alpha_composite(tile(record["path"], 86), (470 + index * 112, y))
        y += 102
    footer(canvas, rat_path)
    save(canvas, destination / "04_gallery_02.png")


def render_utilities(destination: Path, records: list[dict], rat_path: Path | None) -> None:
    canvas = background()
    header(
        canvas,
        "BUILD YOUR OWN DECK",
        "More than action buttons.",
        "Symbols, labels, letters, function keys and numbered keys make custom pages feel complete.",
    )
    draw = ImageDraw.Draw(canvas)
    symbols = [record for record in records if record["category"] == "symbols"]
    numbers = [record for record in records if record["category"] == "numbers"]

    if not symbols and not numbers:
        # Generic fallback for future packs that intentionally omit utility categories.
        categories = Counter(record["category"] for record in records)
        draw.text((110, 320), "PURPOSE-BUILT COVERAGE", font=font(25), fill=(*CYAN, 255))
        x, y = 110, 375
        for category, count in categories.most_common(8):
            card(draw, (x, y, x + 360, y + 110), 22)
            draw.text((x + 28, y + 23), category.replace("_", " ").upper(), font=font(19), fill=(*WHITE, 255))
            draw.text((x + 28, y + 62), f"{count} icons", font=font(18, False), fill=(*MUTED, 255))
            x += 395
            if x > 1500:
                x, y = 110, y + 140
    else:
        draw.text((110, 310), f"{len(symbols)} SYMBOLS + LABELS", font=font(25), fill=(*CYAN, 255))
        draw.text((110, 580), f"{len(numbers)} NUMBERED KEYS", font=font(25), fill=(*CYAN, 255))
        for index, record in enumerate(sample(symbols, 16)):
            canvas.alpha_composite(tile(record["path"], 96), (110 + (index % 8) * 112, 350 + (index // 8) * 112))
        for index, record in enumerate(sample(numbers, 12)):
            canvas.alpha_composite(tile(record["path"], 96), (1100 + (index % 6) * 112, 350 + (index // 6) * 112))
        draw.text((1100, 310), "UTILITY SET", font=font(25), fill=(*CYAN, 255))
        draw.text((1100, 585), "0–99 INCLUDED" if len(numbers) == 100 else f"{len(numbers)} NUMBERED KEYS", font=font(23), fill=(*WHITE, 255))
        draw.multiline_text(
            (1100, 630),
            "No colorway multiplication.\nEach count is a real picker entry.",
            font=font(20, False),
            fill=(*MUTED, 255),
            spacing=8,
        )
    footer(canvas, rat_path)
    save(canvas, destination / "05_gallery_03.png")


def render_animations(
    destination: Path,
    handoff: dict,
    animated_dir: Path,
    rat_path: Path | None,
    animation_summary: dict,
) -> None:
    canvas = background()
    animated_count = int(handoff.get("animated_icon_count", 0))
    static_count = int(handoff.get("actual_icon_count", 0))
    header(
        canvas,
        "SELECTIVE MOTION",
        f"{animated_count} animated counterparts.",
        "Motion is reserved for states and actions where animation adds useful feedback instead of constant noise.",
    )
    draw = ImageDraw.Draw(canvas)
    paths = sorted(animated_dir.glob("*.webp"))[:18]
    start_x, start_y, size, gap = 115, 310, 112, 25
    for index, path in enumerate(paths):
        image = Image.open(path)
        image.seek(0)
        image = image.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
        row, column = divmod(index, 9)
        canvas.alpha_composite(image, (start_x + column * (size + gap), start_y + row * (size + gap)))

    fps = animation_summary.get("fps")
    duration = animation_summary.get("duration")
    motion_label = "SELECTIVE ANIMATION"
    if fps is not None and duration is not None:
        motion_label = f"{fps} FPS  •  {duration:g} SECOND LOOPS"
    card(draw, (115, 610, 875, 750), 24)
    draw.text((150, 640), motion_label, font=font(23), fill=(*WHITE, 255))
    draw.text(
        (150, 682),
        "Stable key background. Motion stays on the subject layer.",
        font=font(19, False),
        fill=(*MUTED, 255),
    )
    card(draw, (950, 610, 1780, 750), 24)
    draw.text((985, 640), f"{max(0, static_count - animated_count)} ICONS STAY STATIC", font=font(23), fill=(*WHITE, 255))
    draw.text(
        (985, 682),
        "No animation just to inflate the pack or make every page move.",
        font=font(19, False),
        fill=(*MUTED, 255),
    )
    footer(canvas, rat_path)
    save(canvas, destination / "06_gallery_04.png")


def validate_media(destination: Path) -> None:
    for name in REQUIRED_MEDIA:
        path = destination / name
        if not path.is_file():
            fail(f"missing output {name}")
        image = Image.open(path)
        expected = (512, 512) if name == "01_search_icon.png" else (1920, 960)
        if image.size != expected:
            fail(f"{name} has size {image.size}; expected {expected}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--factory-out", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--rat-asset")
    args = parser.parse_args()

    factory_out = Path(args.factory_out).resolve()
    destination = Path(args.out).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    rat_path = Path(args.rat_asset).resolve() if args.rat_asset else None

    handoff, manifest, records, animated_dir, animation_summary = load_factory_output(factory_out)
    render_search_icon(factory_out, destination)
    render_cover(destination, handoff, manifest, records, rat_path)
    render_small_scale(destination, records, rat_path)
    render_categories(destination, records, rat_path)
    render_utilities(destination, records, rat_path)
    render_animations(destination, handoff, animated_dir, rat_path, animation_summary)
    validate_media(destination)
    print(
        "RAT ICON ART PASS:",
        manifest.get("Name"),
        f"| {handoff['actual_icon_count']} static",
        f"| {handoff.get('animated_icon_count', 0)} animated",
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

from marketplace_text import draw_fitted_text

ROOT = Path(__file__).resolve().parents[2]
W, H = 1920, 960

WARM = (255, 126, 24)
COOL = (39, 158, 255)
WHITE = (247, 249, 251)
MUTED = (178, 188, 203)

DEFAULT_HERO_SCENE = ROOT / "tools" / "art" / "scenes" / "warm-studio-v1" / "base.png"
DEFAULT_GALLERY_SCENE = ROOT / "tools" / "art" / "scenes" / "warm-studio-clean-v1" / "base-v2.png"


@dataclass(frozen=True)
class CampaignConfig:
    product: str
    hero_scene: Path
    gallery_scene: Path
    hero_title_style: str
    campaign_style: str


def _repo_path(value: str | None, fallback: Path) -> Path:
    raw = str(value or "").strip()
    if not raw:
        return fallback
    resolved = (ROOT / raw).resolve()
    if not resolved.is_relative_to(ROOT.resolve()):
        raise SystemExit(f"Marketplace art path must stay inside the repository: {raw}")
    return resolved


def resolve_campaign_config(product: str) -> CampaignConfig:
    meta_path = ROOT / "products" / f"{product}.json"
    meta: dict = {}
    if meta_path.is_file():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise SystemExit(f"Could not read product metadata {meta_path}: {exc}") from exc

    art = meta.get("marketplace_art") if isinstance(meta.get("marketplace_art"), dict) else {}

    # Backward compatibility: the older single 'scene' field meant hero scene.
    hero_scene = _repo_path(
        art.get("hero_scene") or art.get("scene"),
        DEFAULT_HERO_SCENE,
    )
    gallery_scene = _repo_path(
        art.get("gallery_scene"),
        DEFAULT_GALLERY_SCENE,
    )
    title_style = str(art.get("hero_title_style") or "monitor").strip().lower()
    if title_style not in {"monitor", "glass"}:
        raise SystemExit(f"Unsupported Stream Deck hero title style for {product}: {title_style}")

    campaign_style = str(art.get("campaign_style") or "warm-studio-glass-v1").strip().lower()
    return CampaignConfig(
        product=product,
        hero_scene=hero_scene,
        gallery_scene=gallery_scene,
        hero_title_style=title_style,
        campaign_style=campaign_style,
    )


def load_scene(
    scene_path: Path,
    *,
    size: tuple[int, int] = (W, H),
    veil: tuple[int, int, int, int] | None = None,
    centering: tuple[float, float] = (0.5, 0.5),
) -> Image.Image:
    if not scene_path.is_file():
        raise SystemExit(f"Marketplace art scene missing: {scene_path}")
    image = Image.open(scene_path).convert("RGBA")
    if image.size != size:
        image = ImageOps.fit(
            image,
            size,
            method=Image.Resampling.LANCZOS,
            centering=centering,
        )
    if veil is not None:
        image = Image.alpha_composite(image, Image.new("RGBA", size, veil))
    return image


def _gradient_layer(
    size: tuple[int, int],
    box: tuple[int, int, int, int],
    *,
    alpha: int,
) -> Image.Image:
    x1, y1, x2, y2 = box
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    span = max(1, x2 - x1)
    for x in range(x1, x2 + 1):
        t = (x - x1) / span
        color = tuple(round(WARM[i] * (1 - t) + COOL[i] * t) for i in range(3))
        draw.line((x, y1, x, y2), fill=(*color, alpha), width=1)
    return layer


def glass_panel(
    image: Image.Image,
    box: tuple[int, int, int, int],
    *,
    radius: int = 30,
    fill: tuple[int, int, int, int] = (8, 12, 19, 206),
    border_alpha: int = 225,
    glow_alpha: int = 54,
    border_width: int = 3,
) -> None:
    x1, y1, x2, y2 = [int(v) for v in box]
    if x2 <= x1 or y2 <= y1:
        raise ValueError(f"Invalid glass panel box: {box}")

    surface = Image.new("RGBA", image.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(surface)
    sd.rounded_rectangle((x1, y1, x2, y2), radius=radius, fill=fill)
    image.alpha_composite(surface)

    outer = Image.new("L", image.size, 0)
    od = ImageDraw.Draw(outer)
    od.rounded_rectangle((x1, y1, x2, y2), radius=radius, fill=255)

    inner = Image.new("L", image.size, 0)
    idraw = ImageDraw.Draw(inner)
    inset = max(1, border_width)
    idraw.rounded_rectangle(
        (x1 + inset, y1 + inset, x2 - inset, y2 - inset),
        radius=max(1, radius - inset),
        fill=255,
    )
    ring = ImageChops.subtract(outer, inner)

    gradient = _gradient_layer(image.size, (x1, y1, x2, y2), alpha=border_alpha)
    gradient.putalpha(ImageChops.multiply(gradient.getchannel("A"), ring))

    glow_mask = ring.filter(ImageFilter.GaussianBlur(14))
    glow = gradient.copy()
    glow.putalpha(glow_mask.point(lambda p: round(p * glow_alpha / 255)))

    image.alpha_composite(glow)
    image.alpha_composite(gradient)


def campaign_header(
    image: Image.Image,
    title: str,
    subtitle: str,
    font_factory: Callable[[int, bool], ImageFont.FreeTypeFont],
    *,
    box: tuple[int, int, int, int] = (195, 74, 1725, 258),
    title_box: tuple[int, int, int, int] = (245, 108, 1675, 174),
    subtitle_box: tuple[int, int, int, int] = (275, 190, 1645, 228),
) -> None:
    glass_panel(
        image,
        box,
        radius=34,
        fill=(5, 9, 16, 196),
        border_alpha=205,
        glow_alpha=40,
        border_width=2,
    )
    draw = ImageDraw.Draw(image)
    draw_fitted_text(
        draw,
        title_box,
        title,
        font_factory,
        fill=(*WHITE, 255),
        max_size=56,
        min_size=40,
        bold=True,
        max_lines=1,
        align="center",
    )
    if str(subtitle or "").strip():
        draw_fitted_text(
            draw,
            subtitle_box,
            subtitle,
            font_factory,
            fill=(*MUTED, 255),
            max_size=27,
            min_size=21,
            bold=False,
            max_lines=1,
            align="center",
        )


def campaign_footer(
    image: Image.Image,
    *,
    logo_path: Path | None = None,
    divider_y: int = 835,
    x1: int = 115,
    x2: int = 1805,
    logo_y: int = 875,
    logo_box: int = 48,
) -> None:
    draw = ImageDraw.Draw(image)
    span = max(1, x2 - x1)
    for x in range(x1, x2 + 1):
        t = (x - x1) / span
        color = tuple(round(WARM[i] * (1 - t) + COOL[i] * t) for i in range(3))
        draw.line((x, divider_y, x, divider_y + 1), fill=(*color, 88), width=1)

    if logo_path and logo_path.is_file():
        logo = Image.open(logo_path).convert("RGBA")
        bbox = logo.getbbox()
        if bbox:
            logo = logo.crop(bbox)
        scale = min(logo_box / logo.width, logo_box / logo.height)
        logo = logo.resize(
            (max(1, int(logo.width * scale)), max(1, int(logo.height * scale))),
            Image.Resampling.LANCZOS,
        )
        image.alpha_composite(logo, ((image.width - logo.width) // 2, logo_y))


def thin_arrow(
    draw: ImageDraw.ImageDraw,
    x1: int,
    y: int,
    x2: int,
    *,
    color: tuple[int, int, int] = (255, 178, 30),
    width: int = 6,
) -> None:
    draw.line((x1, y, x2 - 18, y), fill=(*color, 238), width=width)
    draw.line((x2 - 18, y - 16, x2, y), fill=(*color, 238), width=width)
    draw.line((x2 - 18, y + 16, x2, y), fill=(*color, 238), width=width)


def paste_face(image: Image.Image, face: Image.Image, x: int, y: int, size: int) -> None:
    rendered = face.resize((size, size), Image.Resampling.LANCZOS)
    image.alpha_composite(rendered, (x, y))

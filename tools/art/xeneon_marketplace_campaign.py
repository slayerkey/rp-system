#!/usr/bin/env python3
"""Shared deterministic XENEON Marketplace gallery world.

The XENEON hero remains the approved warm-studio device composition.
Gallery slides reuse the Stream Deck campaign's approved clean studio,
orange-to-blue glass framing, typography and footer while showing only
actual XENEON widget captures. No generated or substitute product UI.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageFont

from streamdeck_marketplace_campaign import (
    DEFAULT_GALLERY_SCENE,
    WARM,
    COOL,
    WHITE,
    MUTED,
    load_scene,
    glass_panel,
    campaign_header,
    campaign_footer,
)

ROOT = Path(__file__).resolve().parents[2]
LOGO = ROOT / "tools" / "art" / "assets" / "ratpack-icon-transparent.png"
STYLE = "warm-studio-glass-v1"


def gallery_scene(slug: str) -> Path:
    """Use the common scene by default; accept only explicit repo-owned overrides."""
    product = ROOT / "products" / f"{slug}.json"
    if not product.is_file():
        raise SystemExit(f"XENEON gallery requires canonical product metadata: {product}")
    data = json.loads(product.read_text(encoding="utf-8"))
    if data.get("type") != "widget":
        raise SystemExit(f"XENEON gallery product must be a widget: {slug}")
    art = data.get("marketplace_art") or {}
    if not isinstance(art, dict):
        raise SystemExit("marketplace_art must be an object")
    style = str(art.get("campaign_style") or STYLE).strip()
    if style != STYLE:
        raise SystemExit(f"unsupported XENEON gallery campaign style: {style}")
    specified = str(art.get("gallery_scene") or "").strip()
    if not specified:
        return DEFAULT_GALLERY_SCENE
    root = ROOT.resolve()
    scene = (ROOT / specified).resolve()
    if not scene.is_relative_to(root):
        raise SystemExit("XENEON gallery scene must be a path inside the repository")
    return scene


def gallery_canvas(slug: str) -> Image.Image:
    scene = gallery_scene(slug)
    if not scene.is_file():
        raise SystemExit(f"approved XENEON gallery scene is missing: {scene}")
    # Dark veil is intentional: the room gives depth without competing with
    # screenshots or cutting into customer-visible small-scale typography.
    image = load_scene(scene, veil=(2, 6, 13, 112))
    glass_panel(
        image, (84, 264, 1836, 812),
        radius=34, fill=(5, 10, 18, 222),
        border_alpha=216, glow_alpha=49, border_width=3,
    )
    return image


def gallery_header(
    canvas: Image.Image,
    title: str,
    subtitle: str,
    font_factory,
) -> None:
    campaign_header(
        canvas,
        title,
        subtitle,
        font_factory,
        box=(124, 48, 1796, 244),
        title_box=(168, 85, 1752, 153),
        subtitle_box=(180, 173, 1740, 218),
    )


def gallery_footer(canvas: Image.Image) -> None:
    if not LOGO.is_file():
        raise SystemExit(f"required approved PackRat footer logo missing: {LOGO}")
    campaign_footer(
        canvas,
        logo_path=LOGO,
        divider_y=835,
        x1=118,
        x2=1802,
        logo_y=876,
        logo_box=43,
    )

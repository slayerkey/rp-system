#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from streamdeck_marketplace_campaign import load_scene, resolve_campaign_config


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--product", required=True)
    args = parser.parse_args()

    config = resolve_campaign_config(args.product)

    for label, path in (
        ("hero", config.hero_scene),
        ("gallery", config.gallery_scene),
    ):
        if not path.is_file():
            raise SystemExit(f"CAMPAIGN FAIL: {label} scene missing: {path}")
        image = load_scene(path)
        if image.size != (1920, 960):
            raise SystemExit(f"CAMPAIGN FAIL: {label} scene did not normalize to 1920x960")

    print("STREAM DECK MARKETPLACE CAMPAIGN PASS")
    print(f"  product: {config.product}")
    print(f"  campaign: {config.campaign_style}")
    print(f"  hero scene: {config.hero_scene}")
    print(f"  hero title: {config.hero_title_style}")
    print(f"  gallery scene: {config.gallery_scene}")
    print(f"  gallery mode: {config.gallery_mode}")


if __name__ == "__main__":
    main()

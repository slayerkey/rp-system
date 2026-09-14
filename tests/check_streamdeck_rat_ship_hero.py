#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "art"))

from render_streamdeck_ship_hero import render_ship_hero  # noqa: E402


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        plugin = root / "com.packrat.test-control-pro.sdPlugin"
        (plugin / "imgs").mkdir(parents=True)

        real = Image.new("RGBA", (288, 288), (12, 15, 20, 255))
        real.save(plugin / "imgs" / "real-key.png", "PNG")
        icon = Image.new("RGBA", (144, 144), (0, 0, 0, 0))
        for x in range(36, 108):
            for y in range(36, 108):
                if x in (36, 107) or y in (36, 107):
                    icon.putpixel((x, y), (245, 247, 251, 255))
        icon.save(plugin / "imgs" / "icon.png", "PNG")

        manifest = {
            "Name": "Test Control Pro",
            "UUID": "com.packrat.test-control-pro",
            "Actions": [
                {
                    "UUID": "com.packrat.test-control-pro.real",
                    "Name": "Real Key",
                    "Icon": "imgs/real-key",
                    "States": [{"Image": "imgs/real-key", "ShowTitle": False}],
                },
                {
                    "UUID": "com.packrat.test-control-pro.second",
                    "Name": "Second Action",
                    "Icon": "imgs/icon",
                    "States": [{"ShowTitle": False}],
                },
            ],
        }
        (plugin / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

        submission = root / "submission.json"
        submission.write_text(
            json.dumps({"slug": "test-control-pro", "name": "Test Control Pro", "type": "plugin"}),
            encoding="utf-8",
        )

        out = root / "02_cover.png"
        report = render_ship_hero("test-control-pro", plugin, submission, out)

        assert out.is_file()
        assert Image.open(out).size == (1920, 960)
        assert report["title"] == ["TEST", "CONTROL PRO"]
        assert report["only_marketplace_slot_replaced"] == "02_cover.png"
        assert report["image_generation"] == "disabled"
        assert len(report["key_sources"]) == 15
        assert report["key_sources"][0].startswith("state-raster:")
        assert report["key_sources"][1].startswith("icon-png:")
        assert report["key_sources"][2:] == ["blank"] * 13

        bad_manifest = {
            "Name": "Broken Text Fallback",
            "UUID": "com.packrat.broken",
            "Actions": [
                {
                    "UUID": "com.packrat.broken.no-art",
                    "Name": "No Visual Art",
                    "States": [{"ShowTitle": False}],
                }
            ],
        }
        (plugin / "manifest.json").write_text(json.dumps(bad_manifest), encoding="utf-8")
        try:
            render_ship_hero("test-control-pro", plugin, submission, root / "bad-cover.png")
            raise AssertionError("text-only fallback should be rejected")
        except SystemExit as exc:
            assert "refused text-only key placeholders" in str(exc)
        (plugin / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

        canonical = report["canonical_report"]
        assert canonical["detected_key_count"] == 15
        assert canonical["uncovered_lcd_pixels"] == 0
        assert canonical["scene"] == "warm-studio-v1"
        assert canonical["output"]["size"] == [1920, 960]

        fixture_path = root / "rat-art-key-fixtures.json"
        fixture_path.write_text(
            json.dumps({
                "schema_version": 1,
                "keys": [
                    {"action_uuid": "com.packrat.test-control-pro.real", "lines": ["65%"]},
                    {"action_uuid": "com.packrat.test-control-pro.second", "lines": ["INPUT", "DP"]},
                    *([None] * 13),
                ],
            }),
            encoding="utf-8",
        )
        fixture_out = root / "02_cover-fixtures.png"
        fixture_report = render_ship_hero(
            "test-control-pro",
            plugin,
            submission,
            fixture_out,
            None,
            fixture_path,
        )
        assert fixture_out.is_file()
        assert fixture_report["product_rat_art_key_fixtures"] == str(fixture_path)
        assert fixture_report["key_sources"][:2] == [
            "fixture:com.packrat.test-control-pro.real",
            "fixture:com.packrat.test-control-pro.second",
        ]
        assert fixture_report["key_sources"][2:] == ["fixture-blank"] * 13

        product_keys = root / "rat-art-keys"
        product_keys.mkdir()
        for index in range(15):
            face = Image.new("RGBA", (288, 288), (8 + index, 10, 14, 255))
            face.save(product_keys / f"{index:02d}.png", "PNG")

        product_out = root / "02_cover-product-keys.png"
        product_report = render_ship_hero(
            "test-control-pro",
            plugin,
            submission,
            product_out,
            product_keys,
        )
        assert product_out.is_file()
        assert product_report["product_rat_art_keys"] == str(product_keys)
        assert product_report["key_sources"] == [
            f"product-rat-art:{index:02d}.png" for index in range(15)
        ]
        assert product_report["canonical_report"]["detected_key_count"] == 15
        assert product_report["canonical_report"]["uncovered_lcd_pixels"] == 0

        cli_out = root / "02_cover-cli.png"
        subprocess.run(
            [
                sys.executable,
                str(ROOT / "tools" / "art" / "render_streamdeck_ship_hero.py"),
                "--product", "test-control-pro",
                "--plugin-dir", str(plugin),
                "--submission", str(submission),
                "--out", str(cli_out),
                "--keys-dir", str(product_keys),
            ],
            check=True,
            cwd=ROOT,
        )
        assert cli_out.is_file()

        renderer_source = (ROOT / "tools" / "art" / "render_streamdeck_ship_hero.py").read_text(encoding="utf-8")
        assert '".svg"' in renderer_source
        assert "render_svg_icon.mjs" in renderer_source
        assert "hashlib.sha256(svg_path.read_bytes())" in renderer_source
        assert "text-fallback" in renderer_source

    print("STREAM DECK RAT SHIP HERO TEST PASS")


if __name__ == "__main__":
    main()

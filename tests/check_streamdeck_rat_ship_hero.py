#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
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
                    "UUID": "com.packrat.test-control-pro.first",
                    "Name": "First Action",
                    "States": [{"Image": "imgs/not-rasterized-svg", "ShowTitle": False}],
                },
                {
                    "UUID": "com.packrat.test-control-pro.second",
                    "Name": "Second Action",
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
        assert report["key_sources"][0].startswith("state:")
        assert report["key_sources"][1] == "fallback"
        assert report["key_sources"][2] == "fallback"
        assert report["key_sources"][3:] == ["blank"] * 12

        canonical = report["canonical_report"]
        assert canonical["detected_key_count"] == 15
        assert canonical["uncovered_lcd_pixels"] == 0
        assert canonical["scene"] == "warm-studio-v1"
        assert canonical["output"]["size"] == [1920, 960]

    print("STREAM DECK RAT SHIP HERO TEST PASS")


if __name__ == "__main__":
    main()

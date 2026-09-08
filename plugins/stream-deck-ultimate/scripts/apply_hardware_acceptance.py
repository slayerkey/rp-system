#!/usr/bin/env python3
import argparse
import hashlib
import json
import zlib
from pathlib import Path

PAYLOADS = {
    "bin/audio.ps1": "bin__audio.ps1.zlib",
    "bin/plugin-v06.js": "bin__plugin-v06.js.zlib",
    "bin/lib-v06-config.js": "bin__lib-v06-config.js.zlib",
    "bin/lib-v071-diagnostics.js": "bin__lib-v071-diagnostics.js.zlib",
    "bin/app-audio/streamdeck-surface-model.js": "bin__app-audio__streamdeck-surface-model.js.zlib",
    "bin/app-audio/streamdeck-controller.js": "bin__app-audio__streamdeck-controller.js.zlib",
    "ui/onboarding-v06.html": "ui__onboarding-v06.html.zlib",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("plugin_dir", type=Path)
    args = parser.parse_args()

    product_root = Path(__file__).resolve().parent.parent
    payload_root = product_root / "accepted-payloads"
    expected = json.loads((payload_root / "SHA256.json").read_text(encoding="utf-8"))
    plugin = args.plugin_dir.resolve()

    if set(expected) != set(PAYLOADS):
        raise SystemExit("accepted payload SHA manifest does not match destination map")

    for relative, payload_name in PAYLOADS.items():
        compressed = (payload_root / payload_name).read_bytes()
        raw = zlib.decompress(compressed)
        digest = hashlib.sha256(raw).hexdigest()
        if digest != expected[relative]:
            raise SystemExit(f"accepted payload digest mismatch for {relative}: {digest}")
        destination = plugin / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(raw)
        if hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
            raise SystemExit(f"failed to materialize accepted bytes for {relative}")
        print(f"restored {relative} sha256={digest}")

    print("Stream Deck Ultimate exact hardware-acceptance payloads restored: 7/7")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Restore the exact immutable pieces of the hardware-accepted v1.0 release."""
import argparse
import hashlib
import zipfile
from pathlib import Path, PurePosixPath

PARTS = {
    "immutable-part1.zip": "d4c3f54db0134c4206d7224f8d7294d659810f6460f6a9466fc10e1d189d0d81",
    "immutable-part2.zip": "79e1c5ef609715bdd96dd16d5b13a95bfb6dec18b36ac616b4d80147d7fd240c",
    "immutable-part3.zip": "c66b1d818dfcff0c650122638f283ebac1cc88ecd05d7ba1b0a93b49cbe54fd5",
    "immutable-part4.zip": "632ce532b2ad2f748946211359d2f87698f113218951d41bd2c5c19248f08409",
}

FILES = {
    "V08_CANDIDATE_INFO.json": "582bbea9fb7c563060392d364a6d7fa61733a7dcb9cbd7aa1c17232c4eddebac",
    "bin/app-audio/PackRatAppAudio.dll": "e261060792da8183e2c4dfde04e3e385e58399b237d7a9a3df6598fc59e4fc08",
    "bin/app-audio/streamdeck-surface-model.js.orig-backup": "f44d89e63f7f78be230898e1b3f214d43aa61bb624d36bd8554bc27507e058b4",
    "bin/lib-v07-context.js": "55ed8fe19b75e009d48d76abf65e9c091bd371b3e76c929f0be5273500646a3b",
    "imgs/keys/app.png": "9a42369b17ebf6f98eeae41e2b3f3f4b577bde5cc6857c3b333eab7099b77659",
    "imgs/keys/app@2x.png": "9a42369b17ebf6f98eeae41e2b3f3f4b577bde5cc6857c3b333eab7099b77659",
    "imgs/keys/smart.png": "010464bec5921bfbec52aab83915910c37e64d408d39542ed820cfa162ed25b4",
    "imgs/keys/smart@2x.png": "010464bec5921bfbec52aab83915910c37e64d408d39542ed820cfa162ed25b4",
    "profiles/Stream Deck Ultimate - Audio & Modes.streamDeckProfile": "0e71a396a718adeae307b989455a42f137ad86ca85dd2c167069ba54170b055b",
    "profiles/Stream Deck Ultimate - Home.streamDeckProfile": "cf8786a18b7acba1bd15369476b27e962ea5ba885a47255a14a82d91027d3bf6",
    "profiles/Stream Deck Ultimate - Neo.streamDeckProfile": "77f889a4d3a357746e4e7f4ee0a0f17434fcd2dc9f3f9cf06eb4c55e42d983bc",
    "profiles/Stream Deck Ultimate - Plus.streamDeckProfile": "f73507ace9a41442ac79bebec75f001bcd82cffb8fd519a649e850a36efa0bc1",
    "profiles/Stream Deck Ultimate - Smart.streamDeckProfile": "fb9fd481b2dc3a3c1b3bcbf95123ade3687989efe2e63525828bf4298725863e",
    "profiles/Stream Deck Ultimate - Utilities.streamDeckProfile": "93072e830beb97d393c72883a7a1306fb307d9d8a9a4da6d080fed950c6b8285",
    "profiles/Stream Deck Ultimate - Windows.streamDeckProfile": "c4398824cb0538a8a76e33452f5998711ecbe28502504e00fa4e1c6082c8b8af",
    "profiles/Stream Deck Ultimate - XL.streamDeckProfile": "1164f15c886254aa76bb6336b0e15fe83e0a5f13f9b3edc07ee720126deb7067",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_name(name: str) -> str:
    p = PurePosixPath(name)
    if p.is_absolute() or ".." in p.parts or not p.parts:
        raise SystemExit(f"unsafe accepted capsule path: {name!r}")
    return p.as_posix()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("plugin_dir", type=Path)
    args = ap.parse_args()
    product = Path(__file__).resolve().parent.parent
    capsule_root = product / "recovery" / "accepted-v1"
    plugin = args.plugin_dir.resolve()
    if not plugin.is_dir():
        raise SystemExit(f"plugin directory not found: {plugin}")

    seen: set[str] = set()
    for part_name, expected_part_sha in PARTS.items():
        part = capsule_root / part_name
        raw_part = part.read_bytes()
        actual_part_sha = sha256(raw_part)
        if actual_part_sha != expected_part_sha:
            raise SystemExit(f"accepted capsule digest mismatch: {part_name} {actual_part_sha}")
        with zipfile.ZipFile(part) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                name = safe_name(info.filename)
                if name in seen:
                    raise SystemExit(f"duplicate accepted capsule member: {name}")
                if name not in FILES:
                    raise SystemExit(f"unexpected accepted capsule member: {name}")
                data = zf.read(info)
                actual = sha256(data)
                if actual != FILES[name]:
                    raise SystemExit(f"accepted file digest mismatch: {name} {actual}")
                destination = plugin / Path(*PurePosixPath(name).parts)
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(data)
                seen.add(name)

    if seen != set(FILES):
        missing = sorted(set(FILES) - seen)
        extra = sorted(seen - set(FILES))
        raise SystemExit(f"accepted capsule set mismatch; missing={missing} extra={extra}")
    print(f"accepted v1 immutable release bytes restored: {len(seen)}/{len(FILES)} files")


if __name__ == "__main__":
    main()

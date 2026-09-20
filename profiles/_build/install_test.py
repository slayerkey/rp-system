"""Direct-installs one built profile into ProfilesV3 for a live smoke test.

Usage: python install_test.py "..\\discord-essentials\\Discord Essentials.streamDeckProfile"
Rewrites Device.Model to the machine's real deck so it shows up in the app.
"""
import json
import os
import sys
import zipfile
from pathlib import Path

PROFILES_DIR = Path(os.environ["APPDATA"]) / "Elgato" / "StreamDeck" / "ProfilesV3"

def detect_device():
    for pd in PROFILES_DIR.iterdir():
        man = pd / "manifest.json"
        if not man.exists():
            continue
        try:
            dev = json.loads(man.read_text(encoding="utf-8")).get("Device", {})
            if dev.get("Model") and dev["Model"] != "UI Stream Deck":
                return dev
        except Exception:
            continue
    return {"Model": "20GBA9901", "UUID": ""}

def install(zip_path: Path):
    dev = detect_device()
    zf = zipfile.ZipFile(zip_path)
    root = next(n.split("/")[1] for n in zf.namelist() if n.startswith("Profiles/"))
    dest = PROFILES_DIR / root
    for n in zf.namelist():
        if not n.startswith(f"Profiles/{root}/") or n.endswith("/"):
            continue
        rel = n[len(f"Profiles/{root}/"):]
        out = dest / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        data = zf.read(n)
        if rel == "manifest.json":
            man = json.loads(data)
            man["Device"] = dev
            data = json.dumps(man, indent=2).encode()
        out.write_bytes(data)
    print(f"installed {zip_path.name} -> {dest} (device {dev['Model']})")

if __name__ == "__main__":
    install(Path(sys.argv[1]).resolve())

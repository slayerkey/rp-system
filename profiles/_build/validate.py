"""Structural + consistency validation for the built .streamDeckProfile ZIPs."""
import json
import sys
import zipfile
from pathlib import Path

import common as c
from marketplace_policy import check_marketplace_buttons

ROOT = Path(__file__).resolve().parent.parent

# Every device we build for, keyed by the DeviceModel written into package.json.
# Adding a device to common.py is all it takes for it to validate here too.
DEVICES = {d.model: d for d in (c.MK2, c.XL, c.PLUS, c.VSD)}

errors, warns = [], []

def check(zpath: Path):
    zf = zipfile.ZipFile(zpath)
    names = set(zf.namelist())
    pkg = json.loads(zf.read("package.json")) if "package.json" in names else None
    if pkg is None:
        errors.append(f"{zpath.name}: package.json missing at ZIP root")
        return {}
    device = DEVICES.get(pkg["DeviceModel"])
    if device is None:
        errors.append(f"{zpath.name}: unknown DeviceModel {pkg['DeviceModel']!r} "
                      f"(known: {', '.join(sorted(DEVICES))})")
        return {}
    if pkg["OSType"] not in c.OS_VERSION:
        errors.append(f"{zpath.name}: unknown OSType {pkg['OSType']!r}")
    prof_dirs = {n.split("/")[1] for n in names if n.startswith("Profiles/")}
    if len(prof_dirs) != 1:
        errors.append(f"{zpath.name}: expected 1 root profile, got {prof_dirs}")
    prof = f"Profiles/{next(iter(prof_dirs))}"
    root_man = json.loads(zf.read(f"{prof}/manifest.json"))
    page_dirs = sorted({n.split("/")[3] for n in names
                        if n.startswith(f"{prof}/Profiles/") and n.count("/") >= 4})
    default = root_man["Pages"]["Default"]
    if default not in page_dirs:
        errors.append(f"{zpath.name}: default page {default} has no folder")

    page_manifests = [json.loads(zf.read(f"{prof}/Profiles/{pd}/manifest.json"))
                      for pd in page_dirs]
    errors.extend(f"{zpath.name}: {issue}" for issue in check_marketplace_buttons(
        zpath.parent.name, page_manifests, pkg.get("RequiredPlugins", []), device == c.PLUS))

    consistency = {}
    for pd in page_dirs:
        base = f"{prof}/Profiles/{pd}"
        if f"{base}/Images/black.png" not in names:
            errors.append(f"{zpath.name}: {pd} missing Images/black.png")
        man = json.loads(zf.read(f"{base}/manifest.json"))

        seen_types = [ctl.get("Type") for ctl in man["Controllers"]]
        if "Keypad" not in seen_types:
            errors.append(f"{zpath.name}: page '{man['Name']}' has no Keypad controller")
        if "Encoder" in seen_types and not device.dials:
            errors.append(f"{zpath.name}: page '{man['Name']}' has dials but "
                          f"{device.slug or 'MK.2'} has none")

        for ctl in man["Controllers"]:
            kind = ctl.get("Type")
            actions = ctl.get("Actions") or {}
            for pos in actions:
                try:
                    col, row = (int(x) for x in pos.split(","))
                except ValueError:
                    errors.append(f"{zpath.name}: page '{man['Name']}' bad coordinate {pos!r}")
                    continue
                if kind == "Encoder":
                    if not (0 <= col < device.dials and row == 0):
                        errors.append(f"{zpath.name}: page '{man['Name']}' dial {pos} outside "
                                      f"{device.dials}-dial strip")
                elif not (0 <= col < device.cols and 0 <= row < device.rows):
                    errors.append(f"{zpath.name}: page '{man['Name']}' key {pos} outside "
                                  f"{device.cols}x{device.rows} grid")

        # Flattened across controllers: dial actions live on the Encoder one and
        # went entirely unvalidated while this only read Controllers[0].
        for pos, a in [(p, act) for ctl in man["Controllers"]
                       for p, act in (ctl.get("Actions") or {}).items()]:
            uuid = a["UUID"]
            if uuid == "com.elgato.streamdeck.profile.openchild":
                if a["Settings"]["ProfileUUID"] not in page_dirs:
                    errors.append(f"{zpath.name}: folder at {pos} points to missing page")
            if uuid == "com.elgato.streamdeck.system.open" and a["Settings"]["path"].startswith("http"):
                errors.append(f"{zpath.name}: system.open used for URL at {pos}")
            plugins = json.loads(zf.read("package.json"))["RequiredPlugins"]
            base_uuid = ".".join(uuid.split(".")[:3]) if uuid.startswith("com.packrat") else uuid
            if uuid.startswith("com.packrat") and "com.packrat.betterhotkeys" not in plugins:
                errors.append(f"{zpath.name}: uses Better Hotkeys but plugin not in RequiredPlugins")
            # Dials carry their icon in the Encoder block, not in States.
            dial_icon = (a.get("Encoder") or {}).get("Icon", "")
            if dial_icon and f"{base}/{dial_icon}" not in names:
                errors.append(f"{zpath.name}: dial {pos} references missing {dial_icon}")
            for st in a.get("States", []):
                img = st.get("Image", "")
                if img and f"{base}/{img}" not in names:
                    errors.append(f"{zpath.name}: {pos} references missing {img}")
                for line in (st.get("Title") or "").split("\n"):
                    if len(line) > 9:
                        warns.append(f"{zpath.name}: label line '{line}' >9 chars ({pos})")
            title = (a.get("States") or [{}])[0].get("Title", "")
            # Consistency contract applies to the hotkey-based mute/deafen buttons.
            # Discord Essentials' plugin-based mute/deafen are intentionally
            # different (live-state actions).
            # Keyed by OS: the macOS variants re-encode Ctrl to Cmd and use kVK
            # keycodes, so a Mac profile legitimately differs from a Windows one.
            # Comparing across OSes reported every Mac build as inconsistent.
            if title in ("Mute\nMic", "Deafen") and uuid == "com.elgato.streamdeck.system.hotkey":
                img = a["States"][0]["Image"]
                consistency[(title, pkg["OSType"])] = (json.dumps(a["Settings"], sort_keys=True),
                                      zf.read(f"{base}/{img}") if f"{base}/{img}" in names else b"")
    return consistency

# Underscore folders are build infrastructure and not-for-sale variants
# (profiles/_personal holds the owner's own SFX build, which never ships), so the
# rules that exist to protect a marketplace submission do not apply to them.
profiles = sorted(p for p in ROOT.glob("*/*.streamDeckProfile")
                  if not p.parent.name.startswith("_"))
shared: dict[str, tuple] = {}
for zp in profiles:
    cons = check(zp)
    for k, v in cons.items():
        if k in shared and shared[k][1] != (zp.name,) and shared[k][0] != v:
            errors.append(f"consistency: {k[0]!r} ({k[1]}) differs in {zp.name} vs {shared[k][1][0]}")
        else:
            shared.setdefault(k, (v, (zp.name,)))

print(f"checked {len(profiles)} profiles")
for w in warns:
    print("WARN:", w)
if errors:
    print("\n".join("ERROR: " + e for e in errors))
    sys.exit(1)
print("ALL OK")

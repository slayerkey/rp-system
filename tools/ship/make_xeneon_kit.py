"""Build a self-contained Maker Console SHIP_KIT for one XENEON widget."""
import argparse, hashlib, json, shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PLAYWRIGHT_VERSION = "1.62.1"

def fail(msg):
    raise SystemExit(f"RAT SHIP FAIL: {msg}")

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def require_png(path, size, label):
    try:
        with Image.open(path) as image:
            if image.format != "PNG":
                fail(f"{label} must be PNG: {path.name}")
            if image.size != size:
                fail(f"{label} must be {size[0]}x{size[1]} px, got {image.size[0]}x{image.size[1]}: {path.name}")
    except SystemExit:
        raise
    except Exception as exc:
        fail(f"could not validate {label} image {path.name}: {exc}")

def release_notes_text(value):
    """Normalize current bullet-list metadata and legacy prose for paste files."""
    if isinstance(value, str):
        text = value.strip()
        if not text:
            fail("submission.json release_notes cannot be blank")
        return text
    if isinstance(value, list):
        items = [str(item).strip() for item in value if str(item).strip()]
        if not items:
            fail("submission.json release_notes cannot be an empty list")
        return "\n".join(f"• {item}" for item in items)
    fail("submission.json release_notes must be a string or list of bullet items")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--package", required=True)
    ap.add_argument("--art", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    slug = args.slug
    pkg = Path(args.package)
    art = Path(args.art)
    out = Path(args.out)
    meta_path = ROOT / "widgets" / "_src" / slug / "submission.json"
    manifest_path = ROOT / "widgets" / slug / "manifest.json"
    driver_path = ROOT / "tools" / "ship" / "maker_console.mjs"
    if not pkg.is_file(): fail(f"missing official package: {pkg}")
    if not meta_path.is_file(): fail(f"missing structured submission metadata: {meta_path}")
    if not manifest_path.is_file(): fail(f"missing widget manifest: {manifest_path}")
    if not driver_path.is_file(): fail(f"missing Maker Console driver: {driver_path}")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if meta.get("slug") != slug: fail("submission.json slug mismatch")
    if meta.get("type") != "widget": fail("submission.json type must be widget")
    for key in ("name","version","price_usd","marketplace_category","marketplace_dashboard_sizes","marketplace_language","description","release_notes"):
        if key not in meta or meta[key] in (None, "", []): fail(f"submission.json missing {key}")
    if "marketplace_recommended_orientation" in meta and not str(meta["marketplace_recommended_orientation"]).strip():
        fail("submission.json marketplace_recommended_orientation cannot be blank")
    if meta["name"] != manifest.get("name") or meta["version"] != manifest.get("version"):
        fail("submission metadata disagrees with manifest name/version")
    required_art = ["1-hero.png","2-showcase.png","3-features.png","4-settings.png","5-sizes.png","icon-288x288.png"]
    missing = [x for x in required_art if not (art / x).is_file()]
    if missing: fail("missing Rat Art output: " + ", ".join(missing))
    if out.exists(): shutil.rmtree(out)
    out.mkdir(parents=True)
    shutil.copy2(pkg, out / pkg.name)

    # Marketplace sequence is intentionally value-first after the cover:
    # cover, breakdown/features, product showcase, settings/modes, slot sizes.
    mapping = {
        "icon-288x288.png": "01_search_icon.png",
        "1-hero.png": "02_cover.png",
        "3-features.png": "03_gallery_01.png",
        "2-showcase.png": "04_gallery_02.png",
        "4-settings.png": "05_gallery_03.png",
        "5-sizes.png": "06_gallery_04.png",
    }
    for src, dst in mapping.items(): shutil.copy2(art / src, out / dst)

    require_png(out / "01_search_icon.png", (288, 288), "Marketplace search/app icon")
    require_png(out / "02_cover.png", (1920, 960), "Marketplace cover")
    gallery_names = ["03_gallery_01.png", "04_gallery_02.png", "05_gallery_03.png", "06_gallery_04.png"]
    if len(gallery_names) < 3:
        fail("Marketplace requires at least 3 gallery items")
    for name in gallery_names:
        require_png(out / name, (1920, 960), f"Marketplace gallery {name}")

    # Fail closed if Rat Art accidentally produced a cover/gallery duplicate.
    # The cover is not a gallery item and every gallery frame must add information.
    listing_media = ["02_cover.png","03_gallery_01.png","04_gallery_02.png","05_gallery_03.png","06_gallery_04.png"]
    by_hash = {}
    for name in listing_media:
        value = digest(out / name)
        if value in by_hash:
            fail(f"duplicate marketplace image: {name} is identical to {by_hash[value]}")
        by_hash[value] = name

    (out / "PASTE_description.txt").write_text(meta["description"].strip() + "\n", encoding="utf-8")
    (out / "PASTE_release_notes.txt").write_text(release_notes_text(meta["release_notes"]) + "\n", encoding="utf-8")
    if meta.get("review_hardware_demo_required"):
        demo_name = meta.get("review_hardware_demo_recommended_filename", "REVIEW_DEMO_VIDEO.mp4")
        demo_lines = [
            "# Hardware review demo checklist",
            "",
            "Marketplace review guidance says hardware-dependent products may be asked for a video demonstrating full functionality.",
            "",
            "For **" + str(meta["name"]) + "**, automated QA is not physical-hardware proof. If a reviewer requests or the submission flow exposes a demo-video field, record a real setup with:",
            "",
            "1. XENEON Edge visible with the submitted widget installed.",
            "2. PackRat Lighting Companion running on the same Windows PC.",
            "3. A real Philips Hue and/or Govee light visible in-frame.",
            "4. Power toggle changing the physical light.",
            "5. Brightness adjustment changing the physical light.",
            "6. One color or white-temperature adjustment on supported hardware.",
            "7. One scene activation when supported.",
            "8. Live state on XENEON reflecting the resulting device state.",
            "9. A brief reconnect/recovery demonstration if practical.",
            "",
            "Do not label browser fixtures, StreamSpell, Corsair Labs runner output, or simulated provider fixtures as physical hardware evidence.",
            "",
            "Suggested filename: " + str(demo_name),
        ]
        (out / "REVIEW_DEMO_CHECKLIST.md").write_text("\n".join(demo_lines) + "\n", encoding="utf-8")
    public = {k: v for k, v in meta.items() if k not in ("description", "release_notes")}
    (out / "submission.json").write_text(json.dumps(public, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    orientation = meta.get("marketplace_recommended_orientation")
    orientation_line = f"Recommended Orientation: {orientation}\n" if orientation else ""
    (out / "PASTE_metadata.txt").write_text(
        f"Name: {meta['name']}\nType: Widget\nPrice USD: {meta['price_usd']}\nVersion: {meta['version']}\n"
        f"Category: {', '.join(meta['marketplace_category'])}\n"
        f"Dashboard Sizes: {', '.join(meta['marketplace_dashboard_sizes'])}\n"
        f"{orientation_line}"
        f"Language: {', '.join(meta['marketplace_language'])}\n"
        f"Author: {manifest.get('author')}\nWidget ID: {manifest.get('id')}\nOS: Windows\n",
        encoding="utf-8")
    orientation_check = f"7. Recommended orientation: **{orientation}**\n" if orientation else ""
    language_number = 8 if orientation else 7
    media_number = language_number + 1
    verify_number = media_number + 1
    (out / "CHECKLIST.md").write_text(f"""# {meta['name']} Maker Console kit

Canonical Rat Ship kit.

Media preflight enforces 288x288 PNG for the search/app icon, 1920x960 PNG for the cover, and at least three 1920x960 PNG gallery items.

If REVIEW_DEMO_CHECKLIST.md is present, automated QA is intentionally not being represented as physical hardware proof. A reviewer may request a real hardware functionality video.

Normal release path: run `rat ship {slug}`. Rat Ship builds this kit and then submits it through the persistent local Maker Console browser profile.

Manual fallback contents:

1. Product type: **Widget**
2. Upload `{pkg.name}`
3. Name: **{meta['name']}**
4. Price: **${meta['price_usd']:.2f}**
5. Category: **{', '.join(meta['marketplace_category'])}**
6. Dashboard sizes: **{', '.join(meta['marketplace_dashboard_sizes'])}**
{orientation_check}{language_number}. Language: **{', '.join(meta['marketplace_language'])}**
{media_number}. Upload media in numeric filename order. The cover is separate; gallery 01 is the feature breakdown and must not duplicate the cover.
{verify_number}. Verify version **{meta['version']}**, auto publish policy, dashboard sizes, recommended orientation when present, gallery order, and price immediately before Submit.

`SUBMIT_NOW.cmd` is a double click friendly portable fallback. `SUBMIT_NOW.ps1` contains the same fallback logic for PowerShell. The normal `rat ship` command is faster because it reuses the repository level browser runtime instead of installing dependencies inside every generated kit.
""", encoding="utf-8")

    # Portable authenticated fallback. Normal local shipping uses the shared
    # repository runtime through `rat ship`, so repeated releases do not reinstall
    # Playwright inside every generated kit.
    shutil.copy2(driver_path, out / "maker_console.mjs")
    (out / "package.json").write_text(json.dumps({
        "name": "ratpack-maker-console-bridge",
        "private": True,
        "type": "module",
        "devDependencies": {"playwright": PLAYWRIGHT_VERSION}
    }, indent=2) + "\n", encoding="utf-8")
    (out / "SUBMIT_NOW.ps1").write_text(f'''$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {{ throw "Node.js is required" }}
if (-not (Test-Path .\\node_modules\\playwright)) {{ npm install --no-fund --no-audit }}
if ($LASTEXITCODE -ne 0) {{ throw "Could not install Playwright" }}
npx playwright install chromium
if ($LASTEXITCODE -ne 0) {{ throw "Could not install Chromium" }}
$Profile = Join-Path $env:LOCALAPPDATA "PackRat\\maker-console-profile"
node .\\maker_console.mjs {slug} "--kit=$PSScriptRoot" "--profile=$Profile" --submit
if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}
''', encoding="utf-8")
    (out / "STAGE_ONLY.ps1").write_text(f'''$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path .\\node_modules\\playwright)) {{ npm install --no-fund --no-audit }}
if ($LASTEXITCODE -ne 0) {{ throw "Could not install Playwright" }}
npx playwright install chromium
if ($LASTEXITCODE -ne 0) {{ throw "Could not install Chromium" }}
$Profile = Join-Path $env:LOCALAPPDATA "PackRat\\maker-console-profile"
node .\\maker_console.mjs {slug} "--kit=$PSScriptRoot" "--profile=$Profile"
if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}
''', encoding="utf-8")
    (out / "SUBMIT_NOW.cmd").write_text('''@echo off\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0SUBMIT_NOW.ps1"\r\nif errorlevel 1 pause\r\n''', encoding="utf-8")
    (out / "STAGE_ONLY.cmd").write_text('''@echo off\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0STAGE_ONLY.ps1"\r\nif errorlevel 1 pause\r\n''', encoding="utf-8")
    print(f"RAT SHIP KIT PASS: {out}")

if __name__ == "__main__":
    main()

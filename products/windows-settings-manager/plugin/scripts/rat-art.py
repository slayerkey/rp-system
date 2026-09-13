from __future__ import annotations

import argparse
import json
import os
import shutil
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
W, H = 1920, 960


def font(size: int, bold: bool = False):
    env = os.environ.get("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    candidates = [env] if env else []
    if bold:
        candidates += [r"C:\Windows\Fonts\segoeuib.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
    else:
        candidates += [r"C:\Windows\Fonts\segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return ImageFont.truetype(candidate, size)
    raise SystemExit("Deterministic marketplace font missing")


def canvas():
    im = Image.new("RGB", (W, H), (9, 12, 17))
    d = ImageDraw.Draw(im)
    for i in range(18):
        x = int(W * (i / 17))
        shade = 10 + int(7 * (1 - abs(i - 8.5) / 8.5))
        d.rectangle((x, 0, x + W // 17 + 2, H), fill=(shade, shade + 3, shade + 8))
    return im


def title(draw, top, accent, subtitle=None):
    f1 = font(84, True)
    f2 = font(92, True)
    fs = font(30, False)
    draw.text((96, 80), top, font=f1, fill=(244, 247, 250))
    draw.text((96, 168), accent, font=f2, fill=(205, 214, 225))
    if subtitle:
        draw.text((101, 272), subtitle, font=fs, fill=(152, 163, 178))


def profile_actions(flavor: str):
    profile = ROOT / "out" / f"com.packrat.windows-settings-manager-{flavor}.sdPlugin" / "profiles" / f"windows-settings-{flavor}-standard.streamDeckProfile"
    if not profile.is_file():
        raise SystemExit(f"Built profile missing: {profile}")
    with zipfile.ZipFile(profile) as zf:
        root_manifest_name = next(name for name in zf.namelist() if name.endswith(".sdProfile/manifest.json"))
        root = json.loads(zf.read(root_manifest_name))
        page_id = root["Pages"]["Current"]
        page_names = [name for name in zf.namelist() if "/Profiles/" in name and name.endswith("/manifest.json")]
        # Stored page order is deterministic and the first page is Current.
        page = json.loads(zf.read(page_names[0]))
        actions = page["Controllers"][0]["Actions"]
        return [actions[key]["Name"] for key in sorted(actions, key=lambda k: (int(k.split(",")[1]), int(k.split(",")[0])))]


def key_grid(im, labels, columns=5):
    d = ImageDraw.Draw(im)
    key = 214
    gap = 24
    rows = (len(labels) + columns - 1) // columns
    total_w = columns * key + (columns - 1) * gap
    total_h = rows * key + (rows - 1) * gap
    ox = (W - total_w) // 2
    oy = 350 + max(0, (H - 390 - total_h) // 2)
    small = font(28, True)
    for i, label in enumerate(labels):
        c, r = i % columns, i // columns
        x, y = ox + c * (key + gap), oy + r * (key + gap)
        d.rounded_rectangle((x, y, x + key, y + key), radius=22, fill=(17, 22, 30), outline=(76, 87, 102), width=3)
        words = label.upper().replace(" PC ", " ").split()
        lines = [" ".join(words[: max(1, len(words)//2)]), " ".join(words[max(1, len(words)//2):])]
        lines = [line for line in lines if line]
        for j, line in enumerate(lines[:2]):
            box = d.textbbox((0, 0), line, font=small)
            d.text((x + (key - (box[2]-box[0]))/2, y + 74 + j*38), line, font=small, fill=(238, 242, 247))


def save(im, output, name):
    output.mkdir(parents=True, exist_ok=True)
    im.save(output / name, "PNG", optimize=True)


def text_frame(headline, accent, bullets, output, name):
    im = canvas()
    d = ImageDraw.Draw(im)
    title(d, headline, accent)
    fb = font(42, True)
    fs = font(29, False)
    y = 390
    for head, body in bullets:
        d.text((122, y), head, font=fb, fill=(238, 242, 247))
        d.text((128, y + 59), body, font=fs, fill=(157, 169, 184))
        y += 142
    save(im, output, name)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--flavor", choices=["lite", "pro"], required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    source = ROOT / "assets" / "marketplace.png"
    icon = Image.open(source).convert("RGB").resize((288, 288), Image.Resampling.LANCZOS)
    save(icon, args.output, "01_search_icon.png")

    labels = profile_actions(args.flavor)
    hero = canvas()
    d = ImageDraw.Draw(hero)
    title(d, "WINDOWS SETTINGS", "MANAGER " + args.flavor.upper(), "PC Modes & System Controls for Stream Deck" if args.flavor == "pro" else "Live Windows System Controls for Stream Deck")
    key_grid(hero, labels[:15] if args.flavor == "pro" else labels)
    save(hero, args.output, "02_cover.png")

    feature = canvas()
    fd = ImageDraw.Draw(feature)
    if args.flavor == "pro":
        title(fd, "CHANGE YOUR PC", "WITH ONE KEY", "Only the settings you choose")
    else:
        title(fd, "LIVE WINDOWS", "CONTROLS", "Focused controls instead of random commands")
    key_grid(feature, labels[:15] if args.flavor == "pro" else labels)
    save(feature, args.output, "03_gallery_01.png")

    text_frame(
        "REAL WINDOWS STATE",
        "READ BACK",
        [
            ("HDR", "Live capability and active state where Windows exposes it."),
            ("POWER + DISPLAY", "Active plan, topology, and timeouts are queried again after changes."),
            ("OUTSIDE CHANGES", "Keys poll Windows instead of trusting the last PackRat command.")
        ],
        args.output,
        "04_gallery_02.png",
    )

    if args.flavor == "pro":
        text_frame(
            "PC MODE RESULTS",
            "TELL THE TRUTH",
            [
                ("COMPLETE", "Every configured setting confirmed."),
                ("PARTIAL", "Some settings changed and at least one did not."),
                ("FAILED", "No configured setting could be confirmed.")
            ],
            args.output,
            "05_gallery_03.png",
        )
    else:
        text_frame(
            "DIRECT WINDOWS",
            "NO UI AUTOMATION",
            [
                ("NO COORDINATE CLICKS", "No hidden mouse movement or Quick Settings clicking."),
                ("NO FAKE STATE", "Unsupported HDR shows N/A instead of pretending."),
                ("LOCAL CONTROL", "Settings stay on this Windows PC.")
            ],
            args.output,
            "05_gallery_03.png",
        )

    text_frame(
        "READY-MADE",
        "PROFILES",
        [
            ("STANDARD + XL", "Readable layouts with room for the full control set."),
            ("STREAM DECK + + NEO", "Compact layouts keep the important mode and settings keys."),
            ("MINI", "A focused six-key layout without tiny labels.")
        ],
        args.output,
        "06_gallery_04.png",
    )


if __name__ == "__main__":
    main()

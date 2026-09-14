from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
REPO = Path(__file__).resolve().parents[4]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from tools.art.marketplace_text import draw_fitted_text
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
    draw_fitted_text(
        draw, (96, 72, 1824, 148), top, font,
        fill=(244, 247, 250), max_size=84, min_size=58, bold=True, max_lines=1
    )
    draw_fitted_text(
        draw, (96, 156, 1824, 246), accent, font,
        fill=(205, 214, 225), max_size=92, min_size=64, bold=True, max_lines=1
    )
    if subtitle:
        draw_fitted_text(
            draw, (101, 265, 1824, 315), subtitle, font,
            fill=(152, 163, 178), max_size=32, min_size=24, max_lines=1
        )


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
    gap = 24
    rows = (len(labels) + columns - 1) // columns

    available_top = 340
    available_bottom = 920
    available_h = available_bottom - available_top

    key = 214
    total_h = rows * key + (rows - 1) * gap
    if total_h > available_h:
        key = (available_h - (rows - 1) * gap) // rows

    total_w = columns * key + (columns - 1) * gap
    total_h = rows * key + (rows - 1) * gap
    ox = (W - total_w) // 2
    oy = available_top + max(0, (available_h - total_h) // 2)

    if oy + total_h > available_bottom:
        raise SystemExit("Marketplace key grid exceeds safe cover bounds")

    text_size = 30 if key >= 200 else 25

    for i, label in enumerate(labels):
        c, r = i % columns, i // columns
        x, y = ox + c * (key + gap), oy + r * (key + gap)
        radius = 22 if key >= 200 else 18
        d.rounded_rectangle((x, y, x + key, y + key), radius=radius, fill=(17, 22, 30), outline=(76, 87, 102), width=3)
        safe_label = label.upper().replace(" PC ", " ")
        draw_fitted_text(
            d,
            (x + 18, y + int(key * 0.27), x + key - 18, y + int(key * 0.76)),
            safe_label,
            font,
            fill=(238, 242, 247),
            max_size=text_size,
            min_size=max(17, text_size - 8),
            bold=True,
            spacing=5,
            max_lines=2,
            align="center",
            valign="middle",
        )


def save(im, output, name):
    output.mkdir(parents=True, exist_ok=True)
    im.save(output / name, "PNG", optimize=True)


def text_frame(headline, accent, bullets, output, name):
    im = canvas()
    d = ImageDraw.Draw(im)
    title(d, headline, accent)
    y = 365
    row_h = 150 if len(bullets) >= 4 else 178
    for head, body in bullets:
        draw_fitted_text(
            d, (122, y, 1795, y + 52), head, font,
            fill=(238, 242, 247), max_size=44, min_size=32, bold=True, max_lines=1
        )
        draw_fitted_text(
            d, (128, y + 60, 1795, y + row_h - 18), body, font,
            fill=(157, 169, 184), max_size=31, min_size=23, spacing=6, max_lines=2
        )
        y += row_h
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
    title(d, "WINDOWS SETTINGS", "MANAGER " + args.flavor.upper(), "15 Windows controls with live state" if args.flavor == "pro" else "Six useful Windows controls for Stream Deck")
    key_grid(hero, labels[:15] if args.flavor == "pro" else labels)
    save(hero, args.output, "02_cover.png")

    if args.flavor == "pro":
        text_frame(
            "WINDOWS CONTROLS",
            "YOU ACTUALLY USE",
            [
                ("PC POWER", "Lock, Sleep, Hibernate, protected Restart, and protected Shutdown."),
                ("RADIOS + POWER", "Wi-Fi, Bluetooth, power plan, Keep Awake, and Light / Dark theme."),
                ("VIRTUAL DESKTOPS", "Previous, Next, New, Close, and live Current Desktop state."),
                ("PREDICTABLE", "State-changing controls verify Windows instead of assuming success.")
            ],
            args.output,
            "03_gallery_01.png",
        )
    else:
        text_frame(
            "WINDOWS CONTROL",
            "STARTER SET",
            [
                ("LOCK + SLEEP", "Put two everyday PC controls directly on Stream Deck."),
                ("POWER + KEEP AWAKE", "See the active power plan and control idle sleep behavior."),
                ("DESKTOP NAVIGATION", "Move between previous and next Windows virtual desktops."),
                ("READY TO USE", "Editable profiles for seven current Stream Deck families.")
            ],
            args.output,
            "03_gallery_01.png",
        )

    text_frame(
        "REAL WINDOWS STATE",
        "READ BACK",
        [
            ("LIVE KEYS", "Power, radios, theme, Keep Awake, and desktop state are re-read from Windows."),
            ("OUTSIDE CHANGES", "Keys poll Windows instead of trusting the last PackRat command."),
            ("FAIL CLOSED", "Unavailable or uncertain controls show N/A, OFFLINE, or an alert instead of fake success.")
        ],
        args.output,
        "04_gallery_02.png",
    )

    if args.flavor == "pro":
        text_frame(
            "SAFE PHYSICAL",
            "BUTTONS",
            [
                ("RESTART", "Requires a second press by default before Windows restarts."),
                ("SHUTDOWN", "Requires a second press by default before Windows shuts down."),
                ("RADIOS + DESKTOPS", "Changes are followed by state verification where Windows exposes readable state.")
            ],
            args.output,
            "05_gallery_03.png",
        )
    else:
        text_frame(
            "DIRECT WINDOWS",
            "NO UI CLICKING",
            [
                ("NO COORDINATE CLICKS", "No hidden mouse movement or Quick Settings clicking."),
                ("NO FAKE STATE", "Unavailable controls fail closed instead of pretending."),
                ("LOCAL CONTROL", "Windows actions and settings stay on this PC.")
            ],
            args.output,
            "05_gallery_03.png",
        )

    text_frame(
        "READY-MADE",
        "PROFILES",
        [
            ("STANDARD", "The Pro 5 x 3 profile is the complete 15-key Windows Control Center."),
            ("XL / + XL", "Larger decks add advanced Windows controls without crowding the core set."),
            ("MINI / PLUS / NEO", "Compact layouts prioritize the Windows actions people reach for most.")
        ],
        args.output,
        "06_gallery_04.png",
    )


if __name__ == "__main__":
    main()

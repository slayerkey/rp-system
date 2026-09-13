#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = Path(__file__).resolve().parents[3]
W, H = 1920, 960
BG = (7, 9, 13)
PANEL = (14, 18, 25)
KEY = (10, 13, 18)
BORDER = (45, 53, 65)
WHITE = (245, 247, 250)
MUTED = (158, 169, 185)
ACCENT = (43, 232, 106)
WARN = (255, 179, 77)
DANGER = (255, 93, 108)
BLUE = (75, 143, 255)
RAT = REPO / "tools" / "art" / "assets" / "ratpack-icon-transparent.png"


def font(size: int, bold: bool = False):
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    raise SystemExit("Performance Grapher Rat Art requires a deterministic UI font")


def background():
    img = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((250, 260, 1320, 1350), fill=(*ACCENT, 17))
    d.ellipse((1260, -520, 2200, 520), fill=(*BLUE, 20))
    return Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(170)))


def title(img, headline, sub=""):
    d = ImageDraw.Draw(img)
    d.text((96, 72), headline, font=font(58, True), fill=WHITE)
    if sub:
        d.text((98, 148), sub, font=font(23), fill=MUTED)


def signature(img):
    if RAT.exists():
        rat = Image.open(RAT).convert("RGBA")
        box = rat.getbbox()
        if box:
            rat = rat.crop(box)
        scale = min(64 / rat.width, 64 / rat.height)
        rat = rat.resize((max(1, int(rat.width * scale)), max(1, int(rat.height * scale))), Image.Resampling.LANCZOS)
        img.alpha_composite(rat, (W - 82 - rat.width, 48))
    else:
        d = ImageDraw.Draw(img)
        d.ellipse((W - 120, 62, W - 94, 88), fill=ACCENT)


def spark(draw, box, values, color=ACCENT, spike=False):
    x0, y0, x1, y1 = box
    if len(values) < 2:
        return
    lo, hi = min(values), max(values)
    if hi <= lo:
        hi = lo + 1
    points = []
    for i, value in enumerate(values):
        x = x0 + (x1 - x0) * i / (len(values) - 1)
        y = y1 - (y1 - y0) * (value - lo) / (hi - lo)
        points.append((x, y))
    draw.line(points, fill=color, width=5, joint="curve")
    if spike:
        peak = max(range(len(values)), key=lambda i: values[i])
        px, py = points[peak]
        draw.ellipse((px - 7, py - 7, px + 7, py + 7), fill=DANGER)


def perf_key(draw, x, y, size, label, value, unit="", secondary="", values=None, color=ACCENT, alert=False):
    draw.rounded_rectangle((x, y, x + size, y + size), int(size * .15), fill=KEY, outline=(60, 70, 84), width=max(2, size // 65))
    dot = DANGER if alert else color
    r = max(4, int(size * .022))
    draw.ellipse((x + size*.08-r, y + size*.095-r, x + size*.08+r, y + size*.095+r), fill=dot)
    label_font = font(max(11, int(size * .08)), True)
    value_font = font(max(18, int(size * (.19 if len(str(value)) > 7 else .28))), True)
    small_font = font(max(9, int(size * .067)), True)
    draw.text((x + size*.13, y + size*.07), str(label).upper()[:17], font=label_font, fill=MUTED)
    text = str(value)
    bbox = draw.textbbox((0, 0), text, font=value_font)
    tw = bbox[2] - bbox[0]
    draw.text((x + size*.50 - tw/2, y + size*.30), text, font=value_font, fill=WHITE)
    if unit:
        draw.text((x + size*.52 + tw/2, y + size*.44), unit, font=font(max(9, int(size*.08))), fill=MUTED, anchor="lm")
    if values:
        spark(draw, (x + size*.12, y + size*.67, x + size*.88, y + size*.84), values, color, alert)
    draw.text((x + size*.50, y + size*.92), str(secondary).upper(), font=small_font, fill=DANGER if alert else MUTED, anchor="mm")


def deck(img, x, y, keys, key_size=155, gap=18, cols=5):
    # This is intentionally a deterministic key cluster, not a simulated
    # Stream Deck hardware chassis. PackRat has no approved calibrated
    # Stream Deck device plate in-repo, so Rat Art must not invent one.
    d = ImageDraw.Draw(img)
    rows = (len(keys) + cols - 1) // cols
    width = cols * key_size + (cols - 1) * gap
    height = rows * key_size + (rows - 1) * gap
    for i, spec in enumerate(keys):
        col = i % cols
        row = i // cols
        perf_key(d, x + col * (key_size + gap), y + row * (key_size + gap), key_size, **spec)
    return width, height


def search_icon(out):
    img = Image.new("RGB", (288, 288), BG)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((18, 18, 270, 270), 58, fill=PANEL, outline=ACCENT, width=8)
    values = [55, 61, 59, 68, 64, 79, 72, 86, 74, 92]
    spark(d, (55, 72, 233, 176), values, ACCENT, False)
    d.text((144, 220), "PERF", font=font(30, True), fill=WHITE, anchor="mm")
    img.save(out / "01_search_icon.png", quality=95)


def hero(out):
    img = background()
    d = ImageDraw.Draw(img)
    d.text((96, 92), "PC PERFORMANCE HISTORY", font=font(24, True), fill=ACCENT)
    d.text((96, 165), "See what", font=font(66, True), fill=WHITE)
    d.text((96, 238), "just happened.", font=font(66, True), fill=WHITE)
    d.text((100, 340), "FPS lows  •  frametime spikes  •  session peaks", font=font(21, True), fill=MUTED)

    keys = [
        dict(label="FPS", value="144", unit="", secondary="1% 118", values=[122, 138, 145, 142, 139, 147, 144, 143, 146, 144]),
        dict(label="1% LOW", value="118", unit="", secondary="SESSION", values=[130, 126, 124, 120, 118, 121, 119, 118, 122, 118]),
        dict(label="GPU TEMP", value="73", unit="°C", secondary="PEAK 78", values=[58, 61, 65, 67, 70, 72, 74, 73, 76, 73]),
        dict(label="FRAMETIME", value="31.4", unit="ms", secondary="SPIKE", values=[7, 7, 8, 8, 31, 9, 8, 7, 8, 7], color=DANGER, alert=True),
        dict(label="SESSION", value="42m", unit="", secondary="AVG 141", values=[]),
    ]
    deck(img, 700, 300, keys, key_size=210, gap=18, cols=5)
    d.text((1320, 635), "ONE SHARED TELEMETRY ENGINE  •  FIVE READABLE KEYS", font=font(17, True), fill=MUTED, anchor="mm")
    d.text((1320, 685), "PresentMon + Libre Hardware Monitor + Windows native fallback", font=font(17), fill=MUTED, anchor="mm")
    signature(img)
    img.convert("RGB").save(out / "02_cover.png", quality=95)


def history_context(out):
    img = background()
    title(img, "The moment is gone. The history isn't.", "A live number tells you now. Performance Grapher keeps enough context to diagnose what just happened.")
    d = ImageDraw.Draw(img)
    cards = [
        ("GAME FPS", "144", "1% 118", [141,145,144,142,137,62,121,140,144,145], ACCENT),
        ("GPU TEMP", "73", "PEAK 81", [60,62,64,67,70,74,81,79,75,73], WARN),
        ("FRAMETIME", "7.1", "WORST 31.4", [7,7,7,8,8,31,9,8,7,7], DANGER),
    ]
    for i, (label, value, secondary, vals, color) in enumerate(cards):
        x = 165 + i * 555
        d.rounded_rectangle((x, 255, x+460, 705), 32, fill=(*PANEL, 245), outline=BORDER, width=2)
        perf_key(d, x+105, 325, 250, label, value, "ms" if label=="FRAMETIME" else ("°C" if label=="GPU TEMP" else ""), secondary, vals, color, label=="FRAMETIME")
        if i == 0:
            d.text((x+230, 640), "FPS DROP SAVED", font=font(18, True), fill=WHITE, anchor="mm")
        elif i == 1:
            d.text((x+230, 640), "THERMAL PEAK SAVED", font=font(18, True), fill=WHITE, anchor="mm")
        else:
            d.text((x+230, 640), "SPIKE SAVED", font=font(18, True), fill=WHITE, anchor="mm")
    signature(img)
    img.convert("RGB").save(out / "03_gallery_01.png", quality=95)


def session_summary(out):
    img = background()
    title(img, "A game session, not a wall of live sensors", "Press one Session Summary key to cycle the diagnostics that matter after a stutter.")
    d = ImageDraw.Draw(img)
    pages = [
        ("AVG FPS", "141", "VALORANT"),
        ("1% LOW", "118", "SESSION LOW"),
        ("0.1% LOW", "93", "SESSION LOW"),
        ("WORST FRAME", "31.4", "ms SPIKE"),
        ("PEAK GPU", "78", "°C"),
        ("PEAK CPU", "71", "°C"),
        ("GPU LOAD", "99", "% PEAK"),
        ("SESSION", "42m", "VALORANT"),
        ("PRESSURE", "GPU", "SIGNAL"),
    ]
    for i, (label, value, sec) in enumerate(pages):
        col = i % 5
        row = i // 5
        x = 130 + col * 335
        y = 250 + row * 280
        perf_key(d, x, y, 225, label, value, "", sec, [])
    d.text((960, 830), "PRESSURE IS A CONSERVATIVE SIGNAL, NOT A CLAIM OF CAUSALITY", font=font(17, True), fill=MUTED, anchor="mm")
    signature(img)
    img.convert("RGB").save(out / "04_gallery_02.png", quality=95)


def readable_keys(out):
    img = background()
    title(img, "Readable on a key. Detailed in the history.", "The key shows one primary value, one useful secondary diagnostic, and a compact trend.")
    d = ImageDraw.Draw(img)
    perf_key(d, 220, 295, 330, "GPU TEMP", "73", "°C", "60 SEC", [58,61,65,68,72,76,73], ACCENT)
    perf_key(d, 795, 295, 330, "GPU TEMP", "91", "°C", "ALERT", [72,75,80,83,86,89,91], DANGER, True)
    perf_key(d, 1370, 295, 330, "GAME FPS", "144", "", "1% 118", [130,140,144,141,136,146,144], ACCENT)
    d.text((385, 700), "NORMAL", font=font(23, True), fill=ACCENT, anchor="mm")
    d.text((960, 700), "THRESHOLD", font=font(23, True), fill=DANGER, anchor="mm")
    d.text((1535, 700), "CONTEXT", font=font(23, True), fill=ACCENT, anchor="mm")
    d.text((960, 795), "No six-number dashboards squeezed into 72 / 96 / 144 px.", font=font(23), fill=MUTED, anchor="mm")
    signature(img)
    img.convert("RGB").save(out / "05_gallery_03.png", quality=95)


def local_architecture(out):
    img = background()
    title(img, "Local telemetry without another paid monitor", "Purpose-built providers, slow sensor polling, bounded history, and explicit permission states.")
    d = ImageDraw.Draw(img)
    boxes = [
        (150, "WINDOWS", "CPU + RAM fallback", "1 Hz", ACCENT),
        (620, "LIBRE HARDWARE MONITOR", "Temps · load · power", "1 Hz", BLUE),
        (1090, "PRESENTMON", "FPS · frametime", "100 ms buckets", WARN),
        (1560, "STREAM DECK", "Readable keys", "≤ 4 Hz render", ACCENT),
    ]
    for x, heading, desc, cadence, color in boxes:
        d.rounded_rectangle((x-115, 300, x+285, 560), 30, fill=(*PANEL, 245), outline=color, width=3)
        d.text((x+85, 355), heading, font=font(21, True), fill=color, anchor="mm")
        d.text((x+85, 425), desc, font=font(19), fill=WHITE, anchor="mm")
        d.text((x+85, 478), cadence, font=font(17, True), fill=MUTED, anchor="mm")
    for x in [450, 920, 1390]:
        d.line((x, 430, x+75, 430), fill=(86, 98, 116), width=5)
        d.polygon([(x+75,430),(x+58,420),(x+58,440)], fill=(86,98,116))
    d.rounded_rectangle((370, 665, 1550, 760), 26, fill=(14, 20, 24), outline=(55, 70, 75), width=2)
    d.text((960, 700), "NO API KEY  •  NO CLOUD  •  NO SCREEN SCRAPING  •  NO PAID SENSOR APP REQUIRED", font=font(20, True), fill=WHITE, anchor="mm")
    d.text((960, 735), "PresentMon permission and unsupported hardware states are shown honestly.", font=font(17), fill=MUTED, anchor="mm")
    signature(img)
    img.convert("RGB").save(out / "06_gallery_04.png", quality=95)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()
    out = Path(args.destination)
    out.mkdir(parents=True, exist_ok=True)
    search_icon(out)
    hero(out)
    history_context(out)
    session_summary(out)
    readable_keys(out)
    local_architecture(out)
    required = ["01_search_icon.png", "02_cover.png", "03_gallery_01.png", "04_gallery_02.png", "05_gallery_03.png", "06_gallery_04.png"]
    for name in required:
        path = out / name
        if not path.is_file():
            raise SystemExit(f"Missing Rat Art output: {name}")
        with Image.open(path) as check:
            expected = (288, 288) if name == "01_search_icon.png" else (W, H)
            if check.size != expected:
                raise SystemExit(f"Wrong Rat Art size for {name}: {check.size} != {expected}")
    print(f"Performance Grapher Rat Art ready: {out}")


if __name__ == "__main__":
    main()

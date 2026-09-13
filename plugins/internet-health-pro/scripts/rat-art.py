#!/usr/bin/env python3
from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = Path(__file__).resolve().parents[3]
W, H = 1920, 960
BG = (6, 8, 12)
PANEL = (13, 16, 23)
KEY = (16, 20, 27)
WHITE = (247, 249, 252)
MUTED = (163, 174, 190)
ACCENT = (43, 232, 106)
WARN = (255, 179, 77)
BAD = (255, 93, 108)
BORDER = (50, 59, 72)
RAT = REPO / "tools" / "art" / "assets" / "ratpack-icon-transparent.png"

def font(size: int, bold: bool = False):
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    raise SystemExit("Internet Health Pro Rat Art requires a deterministic UI font")

def background():
    img = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((250, 220, 1450, 1250), fill=(*ACCENT, 18))
    d.ellipse((1320, -350, 2250, 580), fill=(62, 115, 255, 23))
    return Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(180)))

def signature(img):
    if not RAT.exists():
        raise SystemExit(f"Missing PackRat brand mark: {RAT}")
    rat = Image.open(RAT).convert("RGBA")
    box = rat.getbbox()
    if box:
        rat = rat.crop(box)
    scale = min(44 / rat.width, 44 / rat.height)
    rat = rat.resize((max(1, int(rat.width * scale)), max(1, int(rat.height * scale))), Image.Resampling.LANCZOS)
    img.alpha_composite(rat, ((W - rat.width) // 2, 900 - rat.height // 2))

def header(img, headline, sub=""):
    d = ImageDraw.Draw(img)
    d.text((96, 72), headline, font=font(58, True), fill=WHITE)
    if sub:
        d.text((99, 150), sub, font=font(23), fill=MUTED)

def draw_graph(d, box, values, color=ACCENT):
    x1, y1, x2, y2 = box
    if len(values) < 2:
        return
    lo, hi = min(values), max(values)
    if hi - lo < 2:
        lo -= 1
        hi += 1
    pts = []
    for i, value in enumerate(values):
        x = x1 + (x2 - x1) * i / (len(values) - 1)
        y = y2 - (value - lo) / (hi - lo) * (y2 - y1)
        pts.append((x, y))
    d.line(pts, fill=color, width=4, joint="curve")

def key(d, x, y, label, primary, secondary="", color=ACCENT, values=None, size=180):
    d.rounded_rectangle((x, y, x + size, y + size), 24, fill=KEY, outline=BORDER, width=2)
    d.rounded_rectangle((x, y, x + 6, y + size), 3, fill=color)
    d.text((x + 20, y + 27), label, font=font(14, True), fill=MUTED)
    d.text((x + 20, y + 75), primary, font=font(31, True), fill=WHITE)
    if secondary:
        d.text((x + 20, y + 108), secondary, font=font(14, True), fill=color)
    d.line((x + 20, y + 125, x + size - 18, y + 125), fill=(35, 41, 51), width=1)
    draw_graph(d, (x + 20, y + 136, x + size - 18, y + 163), values or [24,23,25,24,26,24], color)

def deck(img, x, y):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((x, y, x + 1030, y + 300), 46, fill=(20, 23, 29), outline=(55, 61, 73), width=3)
    specs = [
        ("HEALTH", "GOOD", "24 ms", ACCENT, [22,23,24,22,25,24,24]),
        ("JITTER", "3 ms", "ADJACENT PROBES", ACCENT, [2,3,2,4,3,3,3]),
        ("LOSS", "0%", "PROBE LOSS", ACCENT, [0,0,0,0,0,0,0]),
        ("OUTAGE", "UP 6h", "NO CURRENT OUTAGE", ACCENT, [24,24,25,23,24,24,23]),
        ("TARGET", "UP", "ICMP 21 ms", ACCENT, [20,21,20,22,21,21,20]),
    ]
    for i, spec in enumerate(specs):
        key(d, x + 42 + i * 196, y + 58, *spec, size=178)

def save(img, path):
    img.convert("RGB").save(path, quality=95)

def cover(out):
    img = background()
    header(img, "Know when your internet is the problem.", "Continuous connection health on Stream Deck. Not another one-shot speed test.")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((96, 260, 690, 720), 34, fill=(*PANEL, 242), outline=BORDER, width=2)
    d.text((140, 315), "INTERNET HEALTH PRO", font=font(20, True), fill=ACCENT)
    for i, line in enumerate(["HEALTH OVER TIME", "LATENCY + JITTER", "PROBE LOSS", "OUTAGE HISTORY"]):
        d.text((140, 380 + i * 58), line, font=font(32, True), fill=WHITE)
    d.text((140, 650), "$7.99  ONE TIME", font=font(21, True), fill=ACCENT)
    deck(img, 790, 320)
    d.text((1305, 665), "ONE SHARED MONITORING ENGINE", font=font(16, True), fill=MUTED, anchor="mm")
    d.line((80, 850, 1840, 850), fill=(59, 69, 84), width=1)
    signature(img)
    save(img, out / "02_cover.png")

def feature_gallery(out):
    img = background()
    header(img, "See the problem, not just a number", "Clear states explain whether the issue is latency, jitter, probe loss, DNS, a target, or the full connection.")
    d = ImageDraw.Draw(img)
    cards = [
        ("WHOLE INTERNET", "Multiple independent checks must fail before OFFLINE.", "OFFLINE", BAD),
        ("DNS FAILURE", "IP connectivity can stay up while name resolution fails.", "DNS FAIL", WARN),
        ("TARGET ONLY", "One dead host never marks your whole internet down.", "TARGET DOWN", BAD),
        ("ICMP BLOCKED", "TCP fallback keeps healthy networks from showing fake loss.", "TCP HEALTHY", ACCENT),
    ]
    for i, (title, desc, state, color) in enumerate(cards):
        x = 96 + i * 448
        d.rounded_rectangle((x, 285, x + 405, 700), 30, fill=(*PANEL, 242), outline=BORDER, width=2)
        d.text((x + 34, 330), title, font=font(19, True), fill=WHITE)
        d.text((x + 34, 395), state, font=font(31, True), fill=color)
        d.multiline_text((x + 34, 470), desc, font=font(18), fill=MUTED, spacing=7)
    signature(img)
    save(img, out / "03_gallery_01.png")

def history_gallery(out):
    img = background()
    header(img, "The last spike does not disappear", "Rolling history and outage records keep connection problems visible after they recover.")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((120, 275, 1800, 710), 34, fill=(*PANEL, 240), outline=BORDER, width=2)
    d.text((175, 325), "LATENCY • 30 MIN", font=font(18, True), fill=MUTED)
    values = [23,24,22,25,24,27,26,29,110,145,92,48,31,27,25,24,23,25,24]
    draw_graph(d, (180, 400, 1130, 625), values, ACCENT)
    d.line((180, 560, 1130, 560), fill=WARN, width=1)
    d.text((1165, 420), "SPIKE", font=font(17, True), fill=WARN)
    d.text((1165, 465), "145 ms", font=font(38, True), fill=WHITE)
    d.text((1390, 420), "LAST OUTAGE", font=font(17, True), fill=MUTED)
    d.text((1390, 465), "2m 14s", font=font(38, True), fill=WHITE)
    d.text((1390, 545), "UPTIME", font=font(17, True), fill=MUTED)
    d.text((1390, 590), "6h 03m", font=font(38, True), fill=ACCENT)
    signature(img)
    save(img, out / "04_gallery_02.png")

def methods_gallery(out):
    img = background()
    header(img, "Every measurement says what it actually is", "Native Stream Deck code can use network primitives the XENEON browser environment cannot.")
    d = ImageDraw.Draw(img)
    methods = [
        ("ICMP LATENCY", "Preferred live latency when the network permits ICMP.", "24 ms"),
        ("TCP CONNECT", "Reachability fallback when ICMP is blocked or unavailable.", "31 ms"),
        ("DNS LOOKUP", "Separates name-resolution problems from full outages.", "7 ms"),
        ("HTTPS RESPONSE", "Service response timing, explicitly not labeled ping.", "42 ms"),
    ]
    for i, (name, desc, value) in enumerate(methods):
        x = 105 + (i % 2) * 890
        y = 270 + (i // 2) * 270
        d.rounded_rectangle((x, y, x + 820, y + 225), 28, fill=(*PANEL, 240), outline=BORDER, width=2)
        d.text((x + 40, y + 42), name, font=font(21, True), fill=ACCENT if i == 0 else WHITE)
        d.text((x + 40, y + 93), value, font=font(38, True), fill=WHITE)
        d.multiline_text((x + 220, y + 89), desc, font=font(18), fill=MUTED, spacing=6)
    signature(img)
    save(img, out / "05_gallery_03.png")

def privacy_gallery(out):
    img = background()
    header(img, "Always-on monitoring without becoming the problem", "Tiny shared probes in the background. Large transfers only when you explicitly ask.")
    d = ImageDraw.Draw(img)
    points = [
        ("10 SEC", "default shared latency interval"),
        ("30 SEC", "independent diagnostic cadence"),
        ("60 SEC", "HTTPS timing cadence"),
        ("~10 MB", "maximum manual speed-test transfer"),
        ("24 HRS", "maximum raw local health history"),
        ("ZERO", "PackRat telemetry"),
    ]
    for i, (big, small) in enumerate(points):
        x = 105 + (i % 3) * 590
        y = 280 + (i // 3) * 270
        d.rounded_rectangle((x, y, x + 535, y + 215), 28, fill=(*PANEL, 240), outline=BORDER, width=2)
        d.text((x + 35, y + 50), big, font=font(39, True), fill=ACCENT)
        d.text((x + 35, y + 125), small, font=font(18), fill=MUTED)
    signature(img)
    save(img, out / "06_gallery_04.png")

def search_icon(out):
    img = Image.new("RGBA", (288, 288), (*BG, 255))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, 16, 288), 8, fill=ACCENT)
    cx, cy = 160, 150
    for r, width in [(86, 9), (61, 10), (36, 11)]:
        d.arc((cx-r, cy-r, cx+r, cy+r), 215, 325, fill=WHITE, width=width)
    d.ellipse((150, 211, 170, 231), fill=ACCENT)
    img.save(out / "01_search_icon.png")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()
    out = Path(args.destination)
    out.mkdir(parents=True, exist_ok=True)
    search_icon(out)
    cover(out)
    feature_gallery(out)
    history_gallery(out)
    methods_gallery(out)
    privacy_gallery(out)

if __name__ == "__main__":
    main()

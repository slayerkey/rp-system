#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = Path(__file__).resolve().parents[3]
W, H = 1920, 960
BG = (7, 9, 13)
PANEL = (16, 19, 25)
PANEL_2 = (22, 26, 34)
KEY = (21, 25, 33)
WHITE = (247, 249, 252)
MUTED = (164, 174, 190)
BORDER = (54, 63, 78)
ACCENT = (70, 214, 190)
ACCENT_2 = (92, 156, 255)
PRO = (181, 119, 255)
RAT = REPO / "tools" / "art" / "assets" / "ratpack-icon-transparent.png"


def font(size: int, bold: bool = False):
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    raise SystemExit("Text Expander Rat Art requires Segoe UI or DejaVu Sans")


def background(edition: str):
    accent = PRO if edition == "pro" else ACCENT
    img = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((1110, -360, 2180, 690), fill=(*accent, 24))
    d.ellipse((180, 410, 1250, 1450), fill=(*ACCENT_2, 16))
    return Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(175)))


def signature(img):
    if not RAT.exists():
        raise SystemExit(f"Missing PackRat brand asset: {RAT}")
    rat = Image.open(RAT).convert("RGBA")
    box = rat.getbbox()
    if not box:
        raise SystemExit("PackRat brand asset has no visible pixels")
    rat = rat.crop(box)
    scale = min(46 / rat.width, 46 / rat.height)
    rat = rat.resize((max(1, int(rat.width * scale)), max(1, int(rat.height * scale))), Image.Resampling.LANCZOS)
    img.alpha_composite(rat, ((W - rat.width) // 2, 900 - rat.height // 2))


def heading(img, title, subtitle=""):
    d = ImageDraw.Draw(img)
    d.text((92, 64), title, font=font(56, True), fill=WHITE)
    if subtitle:
        d.text((94, 137), subtitle, font=font(23), fill=MUTED)


def pill(draw, x, y, text, color=ACCENT):
    f = font(17, True)
    box = draw.textbbox((0, 0), text, font=f)
    width = box[2] - box[0] + 32
    draw.rounded_rectangle((x, y, x + width, y + 34), 17, fill=(19, 23, 31), outline=(59, 70, 88), width=1)
    draw.text((x + 16, y + 17), text, font=f, fill=color, anchor="lm")
    return width


def _plus_badge(draw, cx, cy, r):
    draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=WHITE)
    stroke = max(2, int(r * .22))
    draw.line((cx-r*.45, cy, cx+r*.45, cy), fill=BG, width=stroke)
    draw.line((cx, cy-r*.45, cx, cy+r*.45), fill=BG, width=stroke)


def _semantic_glyph(draw, box, kind, add=False):
    x0, y0, x1, y1 = box
    w, h = x1-x0, y1-y0
    cx, cy = (x0+x1)/2, (y0+y1)/2
    stroke = max(3, int(min(w,h)*.075))
    pad = min(w,h)*.13
    kind = kind.lower()

    if kind in ("email", "email+"):
        left, top, right, bottom = x0+pad, y0+pad*1.3, x1-pad, y1-pad*1.3
        draw.rectangle((left, top, right, bottom), outline=WHITE, width=stroke)
        draw.line((left+stroke, top+stroke, cx, cy+pad*.15), fill=WHITE, width=stroke)
        draw.line((right-stroke, top+stroke, cx, cy+pad*.15), fill=WHITE, width=stroke)
        add = True if kind == "email+" else add
    elif kind in ("clip", "clipboard", "clip+", "clipboard+"):
        left, top, right, bottom = x0+pad*1.45, y0+pad, x1-pad*1.45, y1-pad*.8
        draw.rectangle((left, top, right, bottom), outline=WHITE, width=stroke)
        draw.rectangle((cx-w*.11, top-h*.035, cx+w*.11, top+h*.055), fill=WHITE)
        for yy in (cy-h*.09, cy+h*.04, cy+h*.17):
            draw.line((left+w*.11, yy, right-w*.11, yy), fill=WHITE, width=max(2,stroke//2))
        add = True if "+" in kind else add
    elif kind == "time":
        r = min(w,h)*.30
        draw.ellipse((cx-r, cy-r, cx+r, cy+r), outline=WHITE, width=stroke)
        draw.line((cx, cy, cx, cy-r*.55), fill=WHITE, width=stroke)
        draw.line((cx, cy, cx+r*.46, cy+r*.25), fill=WHITE, width=stroke)
    elif kind == "date":
        left, top, right, bottom = x0+pad, y0+pad*1.15, x1-pad, y1-pad
        draw.rectangle((left, top, right, bottom), outline=WHITE, width=stroke)
        draw.line((left, top+h*.19, right, top+h*.19), fill=WHITE, width=stroke)
        for xx in (left+w*.20, left+w*.38, left+w*.56):
            for yy in (top+h*.34, top+h*.51):
                rr=max(2,stroke//2); draw.ellipse((xx-rr,yy-rr,xx+rr,yy+rr),fill=WHITE)
    elif kind == "address":
        r=min(w,h)*.18
        draw.ellipse((cx-r, cy-r*1.65, cx+r, cy+r*.35), outline=WHITE, width=stroke)
        rr=max(3,stroke); draw.ellipse((cx-rr,cy-r*.70-rr,cx+rr,cy-r*.70+rr),fill=WHITE)
        draw.line((cx-r*.72, cy+r*.05, cx, cy+r*1.72), fill=WHITE, width=stroke)
        draw.line((cx+r*.72, cy+r*.05, cx, cy+r*1.72), fill=WHITE, width=stroke)
    elif kind == "link":
        r=min(w,h)*.19
        draw.ellipse((cx-r*1.55, cy-r*.55, cx+r*.05, cy+r*1.05), outline=WHITE, width=stroke)
        draw.ellipse((cx-r*.05, cy-r*1.05, cx+r*1.55, cy+r*.55), outline=WHITE, width=stroke)
        draw.line((cx-r*.28, cy+r*.18, cx+r*.28, cy-r*.18), fill=WHITE, width=stroke)
    else:
        left=x0+pad*1.2; right=x1-pad*1.2
        for yy in (cy-h*.17,cy,cy+h*.17):
            draw.line((left,yy,right,yy),fill=WHITE,width=stroke)

    if add:
        _plus_badge(draw, x1-pad*.50, y0+pad*.55, min(w,h)*.115)


def key(draw, x, y, label, sub="", color=ACCENT, size=126, kind=None, add=False):
    draw.rounded_rectangle((x, y, x + size, y + size), 22, fill=KEY, outline=BORDER, width=2)
    if not label and not sub:
        return
    glyph_box = (x + 21, y + 14, x + size - 21, y + 79)
    _semantic_glyph(draw, glyph_box, kind or label.lower(), add=add)
    draw.text((x + size / 2, y + 99), label, font=font(max(10, int(size * .10)), True), fill=WHITE, anchor="mm")
    if sub:
        draw.text((x + size / 2, y + 116), sub, font=font(max(8, int(size * .075))), fill=MUTED, anchor="mm")


def deck(img, x, y, specs, accent):
    d = ImageDraw.Draw(img)
    cols, rows = 5, 3
    size, gap, pad = 112, 15, 30
    width = pad * 2 + cols * size + (cols - 1) * gap
    height = pad * 2 + rows * size + (rows - 1) * gap
    d.rounded_rectangle((x, y, x + width, y + height), 42, fill=(19, 22, 28), outline=(58, 66, 80), width=3)
    d.rounded_rectangle((x + 12, y + 12, x + width - 12, y + height - 12), 34, outline=(5, 6, 8), width=3)
    for i in range(cols * rows):
        row, col = divmod(i, cols)
        spec = specs[i] if i < len(specs) else ("", "", "text", False)
        label, sub, kind, add = (list(spec) + ["text", False])[:4]
        key(d, x + pad + col * (size + gap), y + pad + row * (size + gap), label, sub, accent, size, kind, add)
    return width, height


def search_icon(out: Path, edition: str):
    accent = PRO if edition == "pro" else ACCENT
    img = Image.new("RGB", (288, 288), BG)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((18, 18, 270, 270), 58, fill=KEY, outline=accent, width=8)
    _semantic_glyph(d, (64, 48, 224, 190), "text", add=True)
    d.text((144, 224), "PRO" if edition == "pro" else "TEXT", font=font(25, True), fill=WHITE, anchor="mm")
    img.save(out / "01_search_icon.png", quality=95)


def cover(out: Path, edition: str):
    accent = PRO if edition == "pro" else ACCENT
    img = background(edition)
    d = ImageDraw.Draw(img)
    name = "TEXT EXPANDER PRO" if edition == "pro" else "TEXT EXPANDER LITE"
    heading(img, "Stop typing the same thing twice.", "Reusable text snippets and dynamic text, directly from Stream Deck.")
    pill(d, 94, 202, name, accent)
    d.rounded_rectangle((94, 274, 790, 720), 34, fill=(*PANEL, 240), outline=BORDER, width=2)
    d.text((138, 326), "YOUR REPEATED TEXT", font=font(18, True), fill=accent)
    lines = ["EMAIL REPLIES", "LINKS + ADDRESSES", "CODE SNIPPETS"]
    if edition == "pro":
        lines.append("FILL-IN TEMPLATES")
    else:
        lines.append("DATE + TIME + CLIPBOARD")
    for i, value in enumerate(lines):
        d.text((138, 380 + i * 58), value, font=font(31, True), fill=WHITE)
    d.text((138, 646), "$7.99  ONE TIME" if edition == "pro" else "FREE", font=font(23, True), fill=accent)
    if edition == "pro":
        specs = [
            ("EMAIL +", "", "email+", True), ("CLIP +", "", "clipboard+", True), ("TIME", "", "time", False), ("DATE", "", "date", False), ("ADDRESS", "", "address", False),
            ("LINK", "", "link", False), ("REPLY", "", "email", False), ("SUPPORT", "", "text", False), ("CODE", "", "text", False), ("MEETING", "", "link", False)
        ]
    else:
        specs = [
            ("EMAIL +", "", "email+", True), ("CLIP +", "", "clipboard+", True)
        ]
    deck(img, 1030, 268, specs, accent)
    d.text((1395, 756), "NAMED SNIPPETS  •  ONE PRESS", font=font(17, True), fill=MUTED, anchor="mm")
    d.line((80, 850, 1840, 850), fill=(57, 65, 78), width=1)
    signature(img)
    img.convert("RGB").save(out / "02_cover.png", quality=95)


def library_frame(out: Path, edition: str):
    accent = PRO if edition == "pro" else ACCENT
    img = background(edition)
    heading(img, "Build a library, not 15 copies.", "Edit the snippet once. Every Stream Deck key that uses it keeps the same saved text.")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((110, 232, 1810, 790), 34, fill=(*PANEL, 242), outline=BORDER, width=2)
    d.rounded_rectangle((145, 275, 530, 745), 24, fill=PANEL_2, outline=(50, 59, 73), width=1)
    folders = ["QUICK", "EMAIL", "SUPPORT"] if edition == "pro" else ["STARTER"]
    y = 315
    for folder in folders:
        d.text((175, y), folder, font=font(17, True), fill=accent)
        y += 34
        examples = {
            "QUICK":["EMAIL +","CLIP +","TIME","DATE","ADDRESS","LINK"],
            "EMAIL":["Email Reply","Follow-Up","Meeting Link"],
            "SUPPORT":["Support Response","Bug Details"],
            "CREATOR":["YouTube Block","Discord Announcement"],
            "DEVELOPMENT":["Code Snippet","Timestamp"],
            "PERSONAL":["Address / Contact","Meeting URL"],
            "STARTER":["EMAIL +","CLIP +"],
        }[folder]
        for item in examples[:2 if edition == "lite" else (6 if folder == "QUICK" else 3)]:
            d.text((193, y), item, font=font(16), fill=WHITE if y < 670 else MUTED)
            y += 29
        y += 13
    if edition == "pro":
        d.text((193, y + 2), "+ CREATOR · DEVELOPMENT · PERSONAL", font=font(13, True), fill=MUTED)
    d.text((580, 300), "Email Reply" if edition == "pro" else "Email", font=font(31, True), fill=WHITE)
    d.text((580, 348), "Saved text", font=font(16, True), fill=MUTED)
    d.rounded_rectangle((580, 382, 1740, 650), 18, fill=(10, 12, 17), outline=(48, 57, 70), width=1)
    snippet = "Hi {name},\n\nThanks for reaching out about {topic}.\n\n{reply}\n\n{signature}" if edition == "pro" else "REPLACE WITH YOUR EMAIL"
    d.multiline_text((612, 416), snippet, font=font(25), fill=WHITE, spacing=12)
    d.text((580, 696), "LOCAL LIBRARY  •  NO CLOUD ACCOUNT", font=font(17, True), fill=accent)
    signature(img)
    img.convert("RGB").save(out / "03_gallery_01.png", quality=95)


def variables_frame(out: Path, edition: str):
    accent = PRO if edition == "pro" else ACCENT
    img = background(edition)
    heading(img, "Dynamic text resolves when you press the key.", "Dates, clipboard text, and reliable local context stay reusable instead of becoming stale.")
    d = ImageDraw.Draw(img)
    tokens = ["{date}", "{time}", "{clipboard}"]
    if edition == "pro":
        tokens += ["{datetime:YYYY-MM-DD HH:mm}", "{app}", "{username}", "{computer}", "{counter:ticket}", "{cursor}"]
    x, y = 125, 255
    for token in tokens:
        width = pill(d, x, y, token, accent)
        x += width + 16
        if x > 1640:
            x = 125
            y += 58
    d.rounded_rectangle((125, 495, 875, 735), 26, fill=(*PANEL, 240), outline=BORDER, width=2)
    d.text((165, 535), "SNIPPET", font=font(18, True), fill=accent)
    before = "Build {counter:ticket} on {date}\nApp: {app}" if edition == "pro" else "Copied on {date} at {time}:\n{clipboard}"
    d.multiline_text((165, 585), before, font=font(27), fill=WHITE, spacing=10)
    d.rounded_rectangle((1045, 495, 1795, 735), 26, fill=(*PANEL, 240), outline=BORDER, width=2)
    d.text((1085, 535), "INSERTED TEXT", font=font(18, True), fill=accent)
    after = "Build 42 on 2026-09-13\nApp: notepad" if edition == "pro" else "Copied on 2026-09-13 at 09:56:\nYour clipboard text"
    d.multiline_text((1085, 585), after, font=font(27), fill=WHITE, spacing=10)
    d.line((900, 610, 1020, 610), fill=accent, width=5)
    d.polygon([(1018, 600), (1040, 610), (1018, 620)], fill=accent)
    signature(img)
    img.convert("RGB").save(out / "04_gallery_02.png", quality=95)


def template_frame(out: Path, edition: str):
    accent = PRO if edition == "pro" else ACCENT
    img = background(edition)
    if edition == "pro":
        heading(img, "Fill in what changes. Reuse everything else.", "Template fields prompt locally before insertion, then return you to the app you were using.")
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((115, 238, 840, 748), 30, fill=(*PANEL, 242), outline=BORDER, width=2)
        d.text((155, 284), "SUPPORT RESPONSE", font=font(20, True), fill=accent)
        d.multiline_text((155, 337), "Hi {name},\n\nThanks for reaching out about {topic}.\n\n{response}", font=font(26), fill=WHITE, spacing=11)
        d.rounded_rectangle((1010, 238, 1805, 748), 30, fill=(*PANEL, 242), outline=BORDER, width=2)
        d.text((1050, 284), "FILL TEMPLATE", font=font(20, True), fill=accent)
        for i, (label, value) in enumerate([("name","Alex"),("topic","the project update"),("response","Here is the latest status...")]):
            yy = 342 + i * 120
            d.text((1050, yy), label.upper(), font=font(15, True), fill=MUTED)
            d.rounded_rectangle((1050, yy + 30, 1760, yy + 88), 12, fill=(10, 12, 17), outline=(51, 60, 74), width=1)
            d.text((1070, yy + 59), value, font=font(20), fill=WHITE, anchor="lm")
        d.rounded_rectangle((1500, 665, 1760, 714), 13, fill=accent)
        d.text((1630, 689), "INSERT", font=font(17, True), fill=BG, anchor="mm")
    else:
        heading(img, "Start with the two snippets almost everyone needs.", "Email + and Clipboard + are ready immediately. Create anything else directly in the Property Inspector.")
        d = ImageDraw.Draw(img)
        cards = [
            ("EMAIL +", "Your email or reusable reply", "email+", True, "Save the text you type constantly"),
            ("CLIP +", "{clipboard}", "clipboard+", True, "Insert whatever is on your clipboard"),
        ]
        for i, (label, result, kind, add, caption) in enumerate(cards):
            x = 295 + i * 690
            d.rounded_rectangle((x, 270, x + 640, 700), 30, fill=(*PANEL, 242), outline=BORDER, width=2)
            key(d, x + 257, 320, label, "", accent, 126, kind, add)
            d.text((x + 320, 510), result, font=font(25, True), fill=WHITE, anchor="mm")
            d.text((x + 320, 575), caption, font=font(18), fill=MUTED, anchor="mm")
            d.text((x + 320, 635), "CREATE / EDIT IN PROPERTY INSPECTOR", font=font(15, True), fill=accent, anchor="mm")
    signature(img)
    img.convert("RGB").save(out / "05_gallery_03.png", quality=95)


def compare_frame(out: Path, edition: str):
    accent = PRO if edition == "pro" else ACCENT
    img = background(edition)
    heading(img, "Start free. Upgrade when templates become a workflow.", "The split is simple: Lite handles repeat text; Pro handles organized, dynamic templates at scale.")
    d = ImageDraw.Draw(img)
    cols = [
        (135, "LITE", "FREE", ACCENT, ["10 named snippets", "{date} + {time}", "{clipboard}", "Unicode + multiline", "Clipboard paste fallback"]),
        (995, "PRO", "$7.99", PRO, ["Large snippet library", "Folders + reusable variables", "Fill-in template fields", "Counters + app context", "Custom date/time + cursor"]),
    ]
    for x, name, price, color, items in cols:
        d.rounded_rectangle((x, 245, x + 790, 735), 34, fill=(*PANEL, 242), outline=color if (edition == "pro") == (name == "PRO") else BORDER, width=3)
        d.text((x + 48, 300), f"TEXT EXPANDER {name}", font=font(28, True), fill=WHITE)
        d.text((x + 48, 350), price, font=font(22, True), fill=color)
        for i, item in enumerate(items):
            yy = 425 + i * 55
            d.ellipse((x + 50, yy + 8, x + 64, yy + 22), fill=color)
            d.text((x + 88, yy + 15), item, font=font(22), fill=WHITE, anchor="lm")
    signature(img)
    img.convert("RGB").save(out / "06_gallery_04.png", quality=95)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", required=True)
    parser.add_argument("--edition", choices=("lite", "pro"), required=True)
    args = parser.parse_args()
    out = Path(args.destination)
    out.mkdir(parents=True, exist_ok=True)

    search_icon(out, args.edition)
    cover(out, args.edition)
    library_frame(out, args.edition)
    variables_frame(out, args.edition)
    template_frame(out, args.edition)
    compare_frame(out, args.edition)

    required = ["01_search_icon.png","02_cover.png","03_gallery_01.png","04_gallery_02.png","05_gallery_03.png","06_gallery_04.png"]
    seen = set()
    for name in required:
        path = out / name
        if not path.is_file():
            raise SystemExit(f"Missing Rat Art output: {name}")
        with Image.open(path) as check:
            expected = (288, 288) if name == "01_search_icon.png" else (W, H)
            if check.size != expected:
                raise SystemExit(f"Wrong Rat Art size for {name}: {check.size} != {expected}")
        digest = path.read_bytes()
        if name != "01_search_icon.png":
            if digest in seen:
                raise SystemExit(f"Duplicate marketplace frame: {name}")
            seen.add(digest)

    print(f"Text Expander {args.edition.title()} Rat Art ready: {out}")


if __name__ == "__main__":
    main()

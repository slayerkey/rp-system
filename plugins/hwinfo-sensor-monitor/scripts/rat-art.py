#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

PRODUCT = "hwinfo-sensor-monitor"
ROOT = Path(__file__).resolve().parents[3]
PRODUCT_DIR = Path(__file__).resolve().parents[1]
PLUGIN_DIR = PRODUCT_DIR / "com.packrat.hwinfo-sensor-monitor.sdPlugin"
SUBMISSION = PRODUCT_DIR / "submission.json"
KEY_FIXTURES = PRODUCT_DIR / "rat-art-keys.json"
W, H = 1920, 960
BG = (7, 10, 14)
PANEL = (14, 18, 24)
PANEL2 = (19, 24, 32)
WHITE = (246, 248, 251)
MUTED = (160, 171, 185)
ORANGE = (255, 178, 30)
GREEN = (43, 232, 106)
RED = (255, 93, 108)

def fail(message: str) -> None:
    raise SystemExit("HWiNFO RAT ART FAIL: " + message)

def font_path(bold: bool) -> str:
    env = os.getenv("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    candidates = [env] if env else []
    if os.name == "nt":
        candidates += [
            r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        ]
    else:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    fail("deterministic font not found")

def F(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(font_path(bold), size)

def fit(draw: ImageDraw.ImageDraw, text: str, max_width: int, max_size: int, min_size: int = 18, bold: bool = True):
    for size in range(max_size, min_size - 1, -2):
        f = F(size, bold)
        if draw.textbbox((0, 0), text, font=f)[2] <= max_width:
            return f
    return F(min_size, bold)

def background() -> Image.Image:
    image = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((-260, -260, 900, 780), fill=(*ORANGE, 26))
    draw.ellipse((1050, -260, 2200, 800), fill=(45, 126, 255, 18))
    return Image.alpha_composite(image.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(150))).convert("RGB")

def header(image: Image.Image, title: str, subtitle: str) -> None:
    draw = ImageDraw.Draw(image)
    draw.text((96, 78), title, font=fit(draw, title, 1680, 66, 34), fill=WHITE)
    draw.text((98, 158), subtitle, font=fit(draw, subtitle, 1660, 30, 20, False), fill=MUTED)
    draw.line((96, 214, W - 96, 214), fill=(73, 81, 92), width=2)

def card(draw: ImageDraw.ImageDraw, box, title: str = "", accent=ORANGE):
    draw.rounded_rectangle(box, radius=26, fill=PANEL, outline=(45, 52, 63), width=2)
    if title:
        draw.text((box[0] + 28, box[1] + 24), title, font=F(23, True), fill=WHITE)
        draw.line((box[0] + 28, box[1] + 63, box[2] - 28, box[1] + 63), fill=accent, width=3)

def sensor_row(draw, y, device, sensor, reading, state=GREEN):
    draw.rounded_rectangle((154, y, 1766, y + 74), radius=14, fill=PANEL2)
    draw.ellipse((178, y + 27, 194, y + 43), fill=state)
    draw.text((218, y + 13), sensor, font=F(24, True), fill=WHITE)
    draw.text((218, y + 44), device, font=F(15, False), fill=MUTED)
    draw.text((1728, y + 37), reading, font=F(26, True), fill=WHITE, anchor="rm")

def gallery_browser(out: Path) -> None:
    image = background()
    header(image, "Find any HWiNFO sensor fast", "Search hundreds of readings by hardware device without a giant dropdown.")
    draw = ImageDraw.Draw(image)
    card(draw, (98, 252, 1822, 860), "SEARCHABLE SENSOR BROWSER")
    draw.rounded_rectangle((150, 342, 1770, 398), radius=12, fill=(8, 11, 16), outline=(55, 63, 75), width=2)
    draw.text((178, 370), "gpu temp", font=F(21, False), fill=(205, 212, 220), anchor="lm")
    sensor_row(draw, 430, "NVIDIA GeForce RTX 5090", "GPU Temperature", "68.4 °C")
    sensor_row(draw, 516, "NVIDIA GeForce RTX 5090", "GPU Hot Spot Temperature", "79.1 °C", ORANGE)
    sensor_row(draw, 602, "AMD Ryzen 9 9950X", "CPU (Tctl/Tdie)", "71.1 °C")
    sensor_row(draw, 688, "Physical Memory", "Physical Memory Load", "62.0 %")
    draw.text((154, 810), "Stable identity: sensor ID + instance + reading ID", font=F(18, True), fill=ORANGE)
    image.save(out, "PNG", optimize=True)

def graph_panel(draw, box, label, value, unit, points, accent=GREEN):
    card(draw, box)
    x1,y1,x2,y2=box
    draw.text((x1+30,y1+30),label,font=F(22,True),fill=MUTED)
    draw.text((x1+30,y1+86),value,font=F(58,True),fill=WHITE)
    draw.text((x1+190,y1+107),unit,font=F(21,True),fill=MUTED)
    gx1,gy1,gx2,gy2=x1+30,y1+180,x2-30,y2-40
    draw.line((gx1,gy2,gx2,gy2),fill=(43,50,60),width=2)
    if len(points)>1:
        coords=[]
        lo=min(points); hi=max(points)
        if hi<=lo: hi=lo+1
        for i,p in enumerate(points):
            x=gx1+(gx2-gx1)*i/(len(points)-1)
            y=gy2-(gy2-gy1)*(p-lo)/(hi-lo)
            coords.append((x,y))
        draw.line(coords,fill=accent,width=5,joint="curve")

def gallery_graphs(out: Path) -> None:
    image=background()
    header(image,"Rolling history, not just a number","30 second, 1 minute, and 5 minute local history with current/min/max context.")
    draw=ImageDraw.Draw(image)
    graph_panel(draw,(108,270,900,820),"GPU TEMPERATURE","68.4","°C",[48,52,58,61,65,64,69,68,70,68])
    graph_panel(draw,(1020,270,1812,820),"CPU PACKAGE","71.1","°C",[44,48,50,57,66,72,75,69,72,71],ORANGE)
    draw.text((W//2,882),"Bounded history · local only · no PackRat telemetry",font=F(20,True),fill=MUTED,anchor="mm")
    image.save(out,"PNG",optimize=True)

def gallery_dashboard(out: Path) -> None:
    image=background()
    header(image,"One key. Several sensors.","Compact dashboards rotate or summarize selected HWiNFO readings without cloning dozens of actions.")
    draw=ImageDraw.Draw(image)
    card(draw,(116,278,1180,820),"MULTI SENSOR DASHBOARD")
    rows=[("GPU TEMP","68.4 °C",GREEN),("CPU TEMP","71.1 °C",ORANGE),("GPU LOAD","94 %",GREEN),("RAM LOAD","62 %",GREEN),("GPU FAN","1450 RPM",GREEN)]
    y=370
    for name,value,color in rows:
        draw.ellipse((172,y+10,190,y+28),fill=color)
        draw.text((218,y+18),name,font=F(28,True),fill=WHITE,anchor="lm")
        draw.text((1110,y+18),value,font=F(30,True),fill=color,anchor="rm")
        y+=78
    card(draw,(1240,278,1804,820),"THRESHOLDS")
    draw.text((1522,408),"NORMAL",font=F(34,True),fill=GREEN,anchor="mm")
    draw.text((1522,518),"WARNING",font=F(34,True),fill=ORANGE,anchor="mm")
    draw.text((1522,628),"CRITICAL",font=F(34,True),fill=RED,anchor="mm")
    draw.text((1522,727),"One visual pulse",font=F(19,False),fill=MUTED,anchor="mm")
    draw.text((1522,758),"when critical begins",font=F(19,False),fill=MUTED,anchor="mm")
    image.save(out,"PNG",optimize=True)

def gallery_plus(out: Path) -> None:
    image=background()
    header(image,"Built for Stream Deck +","Rotate through selected sensors. Touch strip shows value, min/max, and history. Read-only means read-only.")
    draw=ImageDraw.Draw(image)
    card(draw,(110,288,1810,800),"DIAL + TOUCH STRIP")
    strip=(188,405,1732,650)
    draw.rounded_rectangle(strip,radius=24,fill=(7,10,14),outline=(57,65,77),width=3)
    draw.text((236,452),"GPU TEMPERATURE",font=F(27,True),fill=MUTED)
    draw.text((1672,478),"68.4 °C",font=F(45,True),fill=WHITE,anchor="rm")
    pts=[52,58,54,61,65,63,69,70,68,71,68,69]
    coords=[]
    lo=min(pts);hi=max(pts)
    for i,p in enumerate(pts):
        x=238+(990*i/(len(pts)-1)); y=605-(108*(p-lo)/(hi-lo))
        coords.append((x,y))
    draw.line(coords,fill=GREEN,width=5,joint="curve")
    draw.text((1672,548),"MIN 30.0   MAX 89.0",font=F(20,True),fill=MUTED,anchor="rm")
    draw.text((236,704),"ROTATE",font=F(22,True),fill=ORANGE)
    draw.text((366,704),"Previous / next sensor",font=F(21,False),fill=WHITE)
    draw.text((922,704),"PRESS / TOUCH",font=F(22,True),fill=ORANGE)
    draw.text((1165,704),"Next sensor",font=F(21,False),fill=WHITE)
    image.save(out,"PNG",optimize=True)

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def build_key_faces(out_dir: Path) -> None:
    data=json.loads(KEY_FIXTURES.read_text(encoding="utf-8"))
    specs=data.get("keys") or []
    if len(specs)!=15:
        fail("Rat Art key fixture list must contain 15 entries")
    out_dir.mkdir(parents=True,exist_ok=True)
    tones={"brand":ORANGE,"success":GREEN,"danger":RED,"neutral":(139,147,161)}
    for index,spec in enumerate(specs):
        lines=[str(value) for value in (spec.get("lines") or [])][:2]
        image=Image.new("RGB",(288,288),(9,11,16))
        draw=ImageDraw.Draw(image)
        accent=tones.get(str(spec.get("tone") or "brand"),ORANGE)
        draw.rounded_rectangle((5,5,283,283),radius=32,fill=(9,11,16),outline=(43,50,60),width=4)
        draw.ellipse((24,25,40,41),fill=accent)
        if lines:
            draw.text((144,104),lines[0],font=fit(draw,lines[0],235,34,20),fill=MUTED,anchor="mm")
        if len(lines)>1:
            draw.text((144,170),lines[1],font=fit(draw,lines[1],245,48,24),fill=WHITE,anchor="mm")
        image.save(out_dir/f"{index:02d}.png","PNG",optimize=True)

def run(args: list[str]) -> None:
    result=subprocess.run(args,cwd=ROOT,text=True,capture_output=True)
    if result.returncode!=0:
        fail((result.stderr or result.stdout or "command failed").strip())
    if result.stdout.strip():
        print(result.stdout.strip())

def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--out",type=Path,default=PRODUCT_DIR/"dist"/"marketplace")
    args=parser.parse_args()
    out=args.out.resolve()
    out.mkdir(parents=True,exist_ok=True)

    icon=PLUGIN_DIR/"imgs"/"plugin"/"icon.png"
    if not icon.is_file():
        fail("built plugin icon is missing; run npm run build first")
    Image.open(icon).convert("RGBA").resize((288,288),Image.Resampling.LANCZOS).save(out/"01_icon.png","PNG",optimize=True)

    key_faces=out/"_rat-art-keys"
    build_key_faces(key_faces)
    run([
        "python",str(ROOT/"tools"/"art"/"render_streamdeck_ship_hero.py"),
        "--product",PRODUCT,
        "--plugin-dir",str(PLUGIN_DIR),
        "--submission",str(SUBMISSION),
        "--out",str(out/"02_cover.png"),
        "--keys-dir",str(key_faces)
    ])
    for file in key_faces.glob("*.png"):
        file.unlink()
    key_faces.rmdir()

    gallery_browser(out/"03_gallery_01.png")
    gallery_graphs(out/"04_gallery_02.png")
    gallery_dashboard(out/"05_gallery_03.png")
    gallery_plus(out/"06_gallery_04.png")
    run(["python",str(ROOT/"tools"/"art"/"apply_streamdeck_gallery_campaign.py"),"--product",PRODUCT,"--media-dir",str(out)])

    expected={
        "01_icon.png":(288,288),
        "02_cover.png":(1920,960),
        "03_gallery_01.png":(1920,960),
        "04_gallery_02.png":(1920,960),
        "05_gallery_03.png":(1920,960),
        "06_gallery_04.png":(1920,960)
    }
    # Canonical hero tooling may emit diagnostic PNGs beside the cover. They are
    # QA artifacts, not Marketplace slots; keep the release media directory exact.
    for path in out.glob("*.png"):
        if path.name not in expected:
            path.unlink()
    report={"schema_version":1,"product":PRODUCT,"image_generation":"disabled","outputs":{}}
    for name,size in expected.items():
        path=out/name
        if not path.is_file(): fail("missing "+name)
        actual=Image.open(path).size
        if actual!=size: fail(f"{name} size {actual} != {size}")
        report["outputs"][name]={"size":list(actual),"sha256":sha(path)}
    (out/"hwinfo-rat-art-report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print("HWiNFO RAT ART PASS:",out)

if __name__=="__main__":
    main()

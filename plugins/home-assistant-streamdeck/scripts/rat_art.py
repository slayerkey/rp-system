#!/usr/bin/env python3
"""Deterministic, real-source-key product gallery. Canonical Rat Ship owns the final cover."""
import argparse
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

P = argparse.ArgumentParser()
P.add_argument('--out', required=True)
P.add_argument('--keys', required=True)
args = P.parse_args()
out, keys = Path(args.out), Path(args.keys)
repo = Path(__file__).resolve().parents[3]
brand = repo / 'tools/art/assets/ratpack-icon-transparent.png'
if not brand.is_file():
    sys.exit('Approved canonical PackRat brand logo is missing')
source_icon = Path(__file__).resolve().parents[1] / 'com.packrat.home-assistant-streamdeck.sdPlugin/imgs/plugin/marketplace@2x.png'
if not source_icon.is_file():
    sys.exit('Actual source plugin Marketplace icon missing')
key_files = sorted(keys.glob('*.png'))
if len(key_files) != 15:
    sys.exit('Exactly fifteen real renderer-produced runtime keys are required')
regular = repo / 'tools/art/assets/packrat-font-regular.ttf'
bold = repo / 'tools/art/assets/packrat-font-bold.ttf'
# Follow canonical font resolver rather than silently substituting a lookalike.
sys.path.insert(0, str(repo / 'tools/art'))
from xeneon_all_hero_batch import F  # canonical PackRat font resolution
out.mkdir(parents=True, exist_ok=True)
Image.open(source_icon).convert('RGBA').resize((512,512), Image.Resampling.LANCZOS).save(out/'01_search_icon.png')

BG=(8,10,14);WHITE=(245,247,251);MUTED=(154,162,175);ACCENT=(255,178,30)
frames = [
 ('03_gallery_01.png','YOUR HOME. ONE DASHBOARD.','Live values • multi-entity overview • observed sensor trends',[0,1,2,3,4]),
 ('04_gallery_02.png','SEE REAL STATE HISTORY','Graph observations after connection, never fabricated history',[4,5,0,1,2]),
 ('05_gallery_03.png','CONTROL WHAT IS SUPPORTED','Domain-checked light and switch control • scene/script shortcuts',[6,7,8,9,10]),
 ('06_gallery_04.png','PROFILES FOR YOUR STREAM DECK','Editable Standard/MK.2 • XL • Plus • Neo',[0,1,6,8,3]),
]
for filename, title, subtitle, indices in frames:
    canvas=Image.new('RGB',(1920,960),BG)
    draw=ImageDraw.Draw(canvas)
    draw.rounded_rectangle((80,110,1840,840),radius=36,fill=(18,22,30),outline=(48,54,64),width=3)
    draw.line((130,150,1780,150),fill=ACCENT,width=7)
    draw.text((140,214),title,font=F(70),fill=WHITE)
    draw.text((140,315),subtitle,font=F(28),fill=MUTED)
    for i,key_idx in enumerate(indices):
        key=Image.open(key_files[key_idx]).convert('RGBA').resize((250,250),Image.Resampling.LANCZOS)
        canvas.paste(key,(135+i*332,434),key)
    draw.text((140,742),'ILLUSTRATIVE TEST VALUES • REAL PLUGIN RENDERER',font=F(22),fill=MUTED)
    canvas.save(out/filename)
print('Product Rat Art complete: real-source key gallery (canonical Rat Ship owns final 02_cover)')

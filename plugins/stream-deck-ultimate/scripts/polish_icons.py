#!/usr/bin/env python3
import argparse
from pathlib import Path
from PIL import Image

BG=(7,9,12,255)
LABEL_TOP=110
TARGET_MAX=80
GLYPH_CENTRE_Y=49
MAX_W,MAX_H=100,92
MAX_UPSCALE=1.35
DEADBAND=1.06


def glyph_bbox(im):
    px=im.load(); minx,miny,maxx,maxy=im.width,LABEL_TOP,-1,-1
    for y in range(min(LABEL_TOP, im.height)):
        for x in range(im.width):
            if px[x,y] != BG:
                minx=min(minx,x); maxx=max(maxx,x); miny=min(miny,y); maxy=max(maxy,y)
    return None if maxx < 0 else (minx,miny,maxx,maxy)


def polish(im):
    im=im.convert('RGBA')
    if im.size != (144,144):
        return im
    box=glyph_bbox(im)
    if not box:
        return im
    minx,miny,maxx,maxy=box
    gw,gh=maxx-minx+1,maxy-miny+1
    scale=min(TARGET_MAX/float(max(gw,gh)), MAX_UPSCALE, MAX_W/float(gw), MAX_H/float(gh))
    centred=abs((miny+maxy)/2.0-GLYPH_CENTRE_Y) <= 1.5
    if (1/DEADBAND) <= scale <= DEADBAND and centred:
        return im
    glyph=im.crop((minx,miny,maxx+1,maxy+1))
    nw,nh=max(1,int(round(gw*scale))),max(1,int(round(gh*scale)))
    glyph=glyph.resize((nw,nh), Image.Resampling.LANCZOS)
    out=Image.new('RGBA',(144,144),BG)
    out.paste(im.crop((0,LABEL_TOP,144,144)),(0,LABEL_TOP))
    out.paste(glyph,((144-nw)//2,int(round(GLYPH_CENTRE_Y-nh/2.0))),glyph)
    return out


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('keys_dir', type=Path)
    ap.add_argument('--apply', action='store_true')
    ns=ap.parse_args()
    root=ns.keys_dir.resolve()
    if not root.is_dir():
        raise SystemExit(f'key directory not found: {root}')

    stems=set()
    for path in root.glob('*.png'):
        stem=path.name[:-7] if path.name.endswith('@2x.png') else path.stem
        stems.add(stem)

    changed=0
    for stem in sorted(stems):
        base=root/f'{stem}.png'; hi=root/f'{stem}@2x.png'
        source=None
        if hi.is_file():
            with Image.open(hi) as candidate:
                if candidate.size == (144,144): source=hi
        if source is None and base.is_file(): source=base
        if source is None: continue
        with Image.open(source) as src:
            image=src.convert('RGBA')
        if image.size == (72,72):
            image=image.resize((144,144), Image.Resampling.LANCZOS)
        if image.size != (144,144):
            continue
        out=polish(image)
        targets=[base] + ([hi] if hi.is_file() else [])
        for target in targets:
            old = target.read_bytes() if target.is_file() else None
            if ns.apply:
                out.save(target)
                if old != target.read_bytes(): changed += 1
    print(f'key-art polish complete: changed={changed} apply={ns.apply}')


if __name__=='__main__':
    main()

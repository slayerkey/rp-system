#!/usr/bin/env python3
import argparse
from pathlib import Path
from PIL import Image, ImageChops


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('keys_dir', type=Path)
    ns=ap.parse_args()
    root=ns.keys_dir.resolve()
    bases=sorted(p for p in root.glob('*.png') if not p.name.endswith('@2x.png'))
    if len(bases) != 74:
        raise SystemExit(f'expected 74 base key assets, found {len(bases)}')
    paired=0
    errors=[]
    for base in bases:
        with Image.open(base) as src:
            image=src.convert('RGBA')
        if image.size != (144,144):
            errors.append(f'{base.name}: expected 144x144, got {image.size}')
        hi=root/f'{base.stem}@2x.png'
        if hi.is_file():
            paired += 1
            with Image.open(hi) as src:
                image2=src.convert('RGBA')
            if image2.size != (144,144):
                errors.append(f'{hi.name}: expected 144x144, got {image2.size}')
            elif image.size == image2.size and ImageChops.difference(image,image2).getbbox():
                errors.append(f'{base.name}: base/@2x pixels differ')
    if errors:
        raise SystemExit('accepted key-art contract failed:\n'+'\n'.join(errors))
    print(f'accepted key-art contract passed: {len(bases)} base keys, {paired} paired @2x assets, all 144x144')

if __name__=='__main__': main()

#!/usr/bin/env python3
import argparse,json
from pathlib import Path
from PIL import Image

def main():
 ap=argparse.ArgumentParser(); ap.add_argument('plugin',type=Path); p=ap.parse_args().plugin; m=json.loads((p/'manifest.json').read_text(encoding='utf-8-sig')); bases={m['CategoryIcon']}; bases.update(a['Icon'] for a in m.get('Actions',[]) if a.get('Icon')); files=[]
 for b in sorted(bases): files += [p/f'{b}.png',p/f'{b}@2x.png']
 if len(files)!=32: raise SystemExit(f'expected 32 PNGs, got {len(files)}')
 for f in files:
  if not f.is_file(): raise SystemExit(f'missing: {f}')
  for r,g,b,a in Image.open(f).convert('RGBA').getdata():
   if a and (r,g,b)!=(255,255,255): raise SystemExit(f'non-white visible pixel: {f}')
 print('white icon contract passed: 32/32 PNGs')
if __name__=='__main__': main()

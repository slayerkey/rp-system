#!/usr/bin/env python3
import argparse,json
from pathlib import Path
from PIL import Image

def paths(plugin):
 m=json.loads((plugin/'manifest.json').read_text(encoding='utf-8-sig')); bases={m['CategoryIcon']}; bases.update(a['Icon'] for a in m.get('Actions',[]) if a.get('Icon'))
 for b in sorted(bases): yield plugin/f'{b}.png'; yield plugin/f'{b}@2x.png'

def main():
 ap=argparse.ArgumentParser(); ap.add_argument('plugin',type=Path); p=ap.parse_args().plugin; n=0
 for f in paths(p):
  if not f.is_file(): raise SystemExit(f'missing: {f}')
  im=Image.open(f).convert('RGBA'); im.putdata([(255,255,255,a) if a else (0,0,0,0) for _,_,_,a in im.getdata()]); im.save(f); n+=1
 print(f'whitened {n} category/action icon PNGs')
if __name__=='__main__': main()

from pathlib import Path
import argparse
from PIL import Image, ImageDraw
import generate_prototype_assets_v4 as v4

BG=v4.BG; FG=v4.FG; ACCENT=v4.ACCENT

def make_command(size):
    im=Image.new('RGBA',(size,size),BG); d=ImageDraw.Draw(im); k=size/144.0
    S=lambda v:int(round(v*k)); W=lambda v:max(1,S(v))
    d.rounded_rectangle((S(24),S(22),S(120),S(93)),radius=S(9),outline=FG,width=W(5))
    # Small command/search header, then three distinct command rows.
    d.ellipse((S(36),S(34),S(49),S(47)),outline=ACCENT,width=W(4))
    d.line((S(47),S(45),S(55),S(52)),fill=ACCENT,width=W(4))
    d.line((S(64),S(41),S(105),S(41)),fill=FG,width=W(4))
    for y,w in ((59,34),(73,45),(87,29)):
        d.rounded_rectangle((S(36),S(y-4),S(44),S(y+4)),radius=S(2),fill=FG)
        d.line((S(53),S(y),S(53+w),S(y)),fill=FG,width=W(4))
    f=v4.fit_font(d,'COMMAND',size-20,19,10); b=d.textbbox((0,0),'COMMAND',font=f); tw=b[2]-b[0]; th=b[3]-b[1]
    d.text(((size-tw)/2,size-22-th/2),'COMMAND',font=f,fill=FG)
    return im

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('plugin',type=Path); ns=ap.parse_args(); plugin=ns.plugin.resolve()
    for size,sfx in ((72,''),(144,'@2x')):
        p=plugin/'imgs'/'keys'/f'ctx-command{sfx}.png'; p.parent.mkdir(parents=True,exist_ok=True); make_command(size).save(p)
    print('polished v0.7 context art: Command Palette is visually distinct from Terminal')

if __name__=='__main__': main()

from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "com.packrat.monitormanagerlite.sdPlugin" / "imgs" / "plugin"
OUT.mkdir(parents=True, exist_ok=True)

def png(path: Path, size: int) -> None:
    bg=(8,11,15,255); panel=(17,22,29,255); white=(255,255,255,255); green=(43,232,106,255)
    px=[list(bg) for _ in range(size*size)]
    def put(x,y,c):
        if 0<=x<size and 0<=y<size: px[y*size+x]=list(c)
    def rect(x1,y1,x2,y2,c):
        for y in range(max(0,y1),min(size,y2)):
            for x in range(max(0,x1),min(size,x2)): put(x,y,c)
    def line_h(x1,x2,y,w,c): rect(x1,y-w//2,x2,y+(w+1)//2,c)
    def line_v(x,y1,y2,w,c): rect(x-w//2,y1,x+(w+1)//2,y2,c)
    pad=int(size*.13); top=int(size*.18); bottom=int(size*.67); sw=max(3,size//64)
    rect(pad,top,size-pad,bottom,panel)
    rect(pad,top,size-pad,top+sw,white); rect(pad,bottom-sw,size-pad,bottom,white)
    rect(pad,top,pad+sw,bottom,white); rect(size-pad-sw,top,size-pad,bottom,white)
    cx=size//2; stand=int(size*.79)
    line_v(cx,bottom,stand,max(3,size//38),white); line_h(int(size*.34),int(size*.66),stand,max(3,size//38),white)
    y=int(size*.40); bar=max(6,size//28)
    line_h(int(size*.24),int(size*.76),y,bar,white)
    knob=int(size*.59); r=max(5,size//24)
    for yy in range(y-r,y+r+1):
        for xx in range(knob-r,knob+r+1):
            if (xx-knob)**2+(yy-y)**2<=r*r: put(xx,yy,green)
    raw=b"".join(b"\x00"+bytes(sum((px[y*size+x] for x in range(size)),[])) for y in range(size))
    def chunk(kind,data):
        return struct.pack(">I",len(data))+kind+data+struct.pack(">I",zlib.crc32(kind+data)&0xffffffff)
    data=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",size,size,8,6,0,0,0))+chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b"")
    path.write_bytes(data)

png(OUT/"marketplace.png",256)
png(OUT/"marketplace@2x.png",512)
print("Monitor Manager Lite plugin assets built.")

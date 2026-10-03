from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from streamdeck_marketplace_campaign import bounded_key_grid

region=(100,140,760,480)
layout=bounded_key_grid(region,[1,2,3,4,5,6],3,140,25,12)
assert len(layout)==6
for _,x,y,size in layout:
    assert region[0]<=x<x+size<=region[2]
    assert region[1]<=y<y+size<=region[3]
assert layout[0][1] == layout[3][1], "rows must share centered columns"
assert layout[0][1] + layout[-1][1] + layout[0][3] == region[0] + region[2], "grid must be horizontally centered"
for invalid in [(100,100,150,150),(200,200,180,300)]:
    try:
        bounded_key_grid(invalid,[1,2,3,4],4,140,25)
    except ValueError:
        pass
    else:
        raise AssertionError("Off-card/invalid native gallery content was not rejected")
print("GLOBAL STREAM DECK GALLERY BOUNDS PASS: real grid centering and overflow refusal")

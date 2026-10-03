from pathlib import Path
import importlib.util

script=Path(__file__).with_name("rat_art.py")
spec=importlib.util.spec_from_file_location("lighting_rat_art_layout",script)
art=importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

# Match the actual inset regions, real runtime key counts and caption bands.
# The rendering function refuses any key that would exceed the declared card.
layouts=[
 ("gallery1_right", (982,310,1770,740), (1032,403,1716,716), [1,7,3,4,5,10],3,142,25,20,None),
 ("gallery2_favorites",(205,327,1715,741),(286,407,1634,625),[1,7,5,10],4,200,110,0,(643,245)),
 ("gallery3_features",(175,317,1745,742),(231,395,1689,623),[2,3,8,9,6],5,204,45,0,(654,235)),
 ("gallery4_controls",(1000,318,1755,741),(1037,437,1718,619),[11,12,13,14],4,143,28,0,None),
]
for label,panel,region,keys,cols,size,gapx,gapy,cap in layouts:
 items=art.layout_faces(region,keys,cols,size,gapx,gapy)
 assert len(items)==len(keys),(label,"key count")
 for n,x,y,k in items:
  assert panel[0]<x<x+k<panel[2],(label,"key x",n,x)
  assert panel[1]<y<y+k<panel[3],(label,"key y",n,y)
 if cap:
  top,width=cap
  for _,x,_,k in items:
   b=art.caption_box(x+k//2,top,width)
   assert panel[0]<b[0]<b[2]<panel[2],(label,"caption x",b)
   assert panel[1]<b[1]<b[3]<panel[3],(label,"caption y",b)
   assert b[1]>items[0][2]+size,(label,"caption overlaps keys")
try:
 art.layout_faces((100,100,250,250),[1,2,3,4],4,143,28)
 raise AssertionError("oversized key row did not fail closed")
except ValueError as exc:
 assert "overflow" in str(exc)
print("SMART LIGHTING RAT ART LAYOUT PASS: four gallery panels, captions, key containment, and overflow refusal")

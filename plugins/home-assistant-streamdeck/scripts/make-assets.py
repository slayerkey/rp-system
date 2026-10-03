from pathlib import Path
from io import BytesIO
import cairosvg
P=Path(__file__).resolve().parents[1]/'com.packrat.home-assistant-streamdeck.sdPlugin'
paths={
'plugin':'<path d="M26 73L72 30l46 43M39 63v49h66V63M58 112V84h28v28" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M47 94l15-13 13 7 21-21" fill="none" stroke="#FFB21E" stroke-width="7" stroke-linecap="round"/>',
'status':'<circle cx="72" cy="70" r="39" fill="none" stroke="white" stroke-width="8"/><path d="M72 44v28l20 15" fill="none" stroke="#FFB21E" stroke-width="8" stroke-linecap="round"/>',
'graph':'<path d="M20 110l25-25 20 7 22-52 20 26 16-19" fill="none" stroke="#FFB21E" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
'overview':'<rect x="19" y="25" width="46" height="41" rx="7" fill="none" stroke="white" stroke-width="7"/><rect x="79" y="25" width="46" height="41" rx="7" fill="none" stroke="white" stroke-width="7"/><rect x="19" y="80" width="46" height="41" rx="7" fill="none" stroke="#FFB21E" stroke-width="7"/><rect x="79" y="80" width="46" height="41" rx="7" fill="none" stroke="white" stroke-width="7"/>',
'control':'<path d="M72 22v52M43 38a43 43 0 1 0 58 0" fill="none" stroke="#FFB21E" stroke-width="10" stroke-linecap="round"/>',
'trigger':'<path d="M76 16L38 82h34l-5 47 40-68H75z" fill="none" stroke="#FFB21E" stroke-width="7" stroke-linejoin="round"/>',
'brightness':'<circle cx="72" cy="72" r="20" fill="none" stroke="#FFB21E" stroke-width="8"/><path d="M72 16v23m0 66v23M16 72h23m66 0h23M32 32l16 16m48 48l16 16m0-80L96 48M48 96l-16 16" stroke="white" stroke-width="7" stroke-linecap="round"/>',
'neo-infobar':'<rect x="20" y="46" width="104" height="55" rx="11" fill="none" stroke="white" stroke-width="6"/><path d="M27 83l19-19 17 11 23-22 17 16 12-6" stroke="#FFB21E" stroke-width="7" fill="none" stroke-linecap="round"/>'}
def svg(glyph):return f'<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="24" fill="#080A0E"/><path d="M18 12h108" stroke="#FFB21E" stroke-width="4" stroke-linecap="round"/>{glyph}</svg>'
def png(image,dst,size):
 dst.parent.mkdir(parents=True,exist_ok=True)
 cairosvg.svg2png(bytestring=image.encode(),write_to=str(dst),output_width=size,output_height=size)
for slug,glyph in paths.items():
 s=svg(glyph)
 if slug=='plugin':
  for size,name in [(256,'icon.png'),(512,'icon@2x.png'),(256,'marketplace.png'),(512,'marketplace@2x.png')]:png(s,P/'imgs/plugin'/name,size)
  for size,name in [(28,'icon.png'),(56,'icon@2x.png')]:png(s,P/'imgs/category'/name,size)
 else:
  d=P/'imgs/actions'/slug
  for size,name in [(28,'icon.png'),(56,'icon@2x.png'),(144,'key.png')]:png(s,d/name,size)
print('Generated PackRat Home Assistant product and semantic-action assets')

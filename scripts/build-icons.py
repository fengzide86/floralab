from pathlib import Path
import cairosvg
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
icons=ROOT/'public'/'icons'; icons.mkdir(parents=True,exist_ok=True)
svg=(icons/'floralab-icon.svg').read_bytes()
for size in [16,32,64,180,192,512]:
    cairosvg.svg2png(bytestring=svg,write_to=str(icons/f'icon-{size}.png'),output_width=size,output_height=size)
im=Image.open(icons/'icon-512.png').convert('RGBA')
bg=Image.new('RGBA',(512,512),(244,241,234,255)); small=im.resize((410,410),Image.Resampling.LANCZOS); bg.alpha_composite(small,(51,51)); bg.save(icons/'icon-maskable-512.png')
desk=ROOT/'desktop'; desk.mkdir(exist_ok=True)
Image.open(icons/'icon-512.png').save(desk/'FloraLab.ico',format='ICO',sizes=[(16,16),(32,32),(64,64),(128,128),(256,256)])
print('icons built')
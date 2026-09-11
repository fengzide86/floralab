from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
icons=ROOT/'public'/'icons'; icons.mkdir(parents=True,exist_ok=True)
source=Image.open(icons/'floralab-source.webp').convert('RGBA')
for size in [16,32,64,180,192,512]:
    source.resize((size,size),Image.Resampling.LANCZOS).save(icons/f'icon-{size}.png')
# Maskable: fill transparent corners with a purple sampled from the approved icon.
maskable=Image.new('RGBA',(512,512),(126,105,142,255))
regular=source.resize((512,512),Image.Resampling.LANCZOS)
maskable.alpha_composite(regular,(0,0)); maskable.convert('RGB').save(icons/'icon-maskable-512.png')
desk=ROOT/'desktop'; desk.mkdir(exist_ok=True)
source.save(desk/'FloraLab.ico',format='ICO',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('approved FloraLab icon assets built')
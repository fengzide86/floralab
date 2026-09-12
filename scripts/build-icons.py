from pathlib import Path
from PIL import Image
from io import BytesIO
import base64
ROOT=Path(__file__).resolve().parents[1]
icons=ROOT/'public'/'icons'; icons.mkdir(parents=True,exist_ok=True)
source_file=icons/'floralab-source.webp'
if source_file.exists():
    source=Image.open(source_file).convert('RGBA')
else:
    part_dir=icons/'source-parts'
    parts=sorted(part_dir.glob('floralab-source.b64.*'))
    if not parts:
        raise FileNotFoundError('approved FloraLab icon source is missing')
    payload=''.join(p.read_text(encoding='ascii').strip() for p in parts)
    source=Image.open(BytesIO(base64.b64decode(payload))).convert('RGBA')
for size in [16,32,64,180,192,512]:
    source.resize((size,size),Image.Resampling.LANCZOS).save(icons/f'icon-{size}.png')
# Maskable: fill transparent corners with a Sprout Green sampled from the approved icon.
maskable=Image.new('RGBA',(512,512),(234,243,230,255))
regular=source.resize((512,512),Image.Resampling.LANCZOS)
maskable.alpha_composite(regular,(0,0)); maskable.convert('RGB').save(icons/'icon-maskable-512.png')
desk=ROOT/'desktop'; desk.mkdir(exist_ok=True)
source.save(desk/'FloraLab.ico',format='ICO',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('approved FloraLab Sprout icon assets built')
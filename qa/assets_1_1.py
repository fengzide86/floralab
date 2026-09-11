from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]; ICON=ROOT/'public/icons'; checks=[]
def ck(x,n):
    assert x,n; checks.append(n)
for s in [16,32,64,180,192,512]:
    p=ICON/f'icon-{s}.png'; ck(p.exists(),f'icon {s} exists'); im=Image.open(p); ck(im.size==(s,s),f'icon {s} dimensions')
p=ICON/'icon-maskable-512.png'; ck(p.exists(),'maskable exists'); ck(Image.open(p).size==(512,512),'maskable dimensions')
ico=ROOT/'desktop/FloraLab.ico'; ck(ico.exists(),'ico exists'); ck(Image.open(ico).size[0]>=128,'ico large frame')
print(f'assets-1.1: {len(checks)} checks passed')
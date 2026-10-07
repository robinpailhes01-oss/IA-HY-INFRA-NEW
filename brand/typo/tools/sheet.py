"""Planche de controle d'un rush : toutes les images (1/4), grille en pixels canevas."""
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
step = int(sys.argv[3]) if len(sys.argv) > 3 else 1
files = sorted(glob.glob(os.path.join(src, 'f*.png')))[::step]
sc = 4
w, h = 1080 // sc, 1920 // sc
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
W = Image.new('RGB', (len(files) * (w + 4), h + 16), 'white')
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h), Image.BILINEAR)
    d = ImageDraw.Draw(im)
    for y in range(120, 1920, 120):
        d.line([(0, y // sc), (w, y // sc)], fill=(255, 0, 0) if y % 480 == 0 else (255, 255, 0), width=1)
        if i == 0 or True:
            d.text((1, y // sc - 11), str(y), fill=(255, 0, 0), font=font)
    for x in range(108, 1080, 216):
        d.line([(x // sc, 0), (x // sc, h)], fill=(0, 255, 255), width=1)
    d.line([(0, 1500 // sc), (w, 1500 // sc)], fill=(255, 0, 255), width=2)
    W.paste(im, (i * (w + 4), 16))
    ImageDraw.Draw(W).text((i * (w + 4) + 2, 1), 't=%.1f' % (int(os.path.basename(f)[1:4]) * 0.5), fill=(0, 0, 0), font=font)
W.save(out, quality=88)

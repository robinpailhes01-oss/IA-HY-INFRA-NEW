"""Zoom d'une bande verticale de chaque image (1/2), grille 60 px en coordonnees canevas."""
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
src, out, y0, y1 = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
idx = [int(v) for v in sys.argv[5].split(',')] if len(sys.argv) > 5 else None
files = sorted(glob.glob(os.path.join(src, 'f*.png')))
if idx: files = [files[i] for i in idx]
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
w, h = 540, (y1 - y0) // 2
W = Image.new('RGB', (len(files) * (w + 6), h + 16), 'white')
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').crop((0, y0, 1080, y1)).resize((w, h))
    d = ImageDraw.Draw(im)
    for y in range((y0 // 60 + 1) * 60, y1, 60):
        d.line([(0, (y - y0) // 2), (w, (y - y0) // 2)], fill=(255, 0, 0) if y % 240 == 0 else (255, 255, 0))
        d.text((2, (y - y0) // 2 - 13), str(y), fill=(255, 0, 0), font=font)
    for x in range(0, 1080, 60):
        d.line([(x // 2, 0), (x // 2, h)], fill=(0, 255, 255) if x % 240 else (0, 0, 255))
        if x % 120 == 0: d.text((x // 2 + 1, 1), str(x), fill=(0, 0, 255), font=font)
    W.paste(im, (i * (w + 6), 16))
    ImageDraw.Draw(W).text((i * (w + 6) + 2, 1), os.path.basename(f), fill=(0, 0, 0), font=font)
W.save(out, quality=88)

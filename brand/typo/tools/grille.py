"""Planche quadrillee des images d'une fenetre (1/4), lignes tous les 60 px (rouge tous les 240), 6 images par rangee.
Usage : python3 -I tools/grille.py <dossier> <sortie.jpg> <nb_images> [x0 y0 x1 y1 ...]  (rectangles a dessiner)"""
import glob, os, sys
from PIL import Image, ImageDraw, ImageFont
src, out, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
rects = [tuple(int(v) for v in sys.argv[i:i + 4]) for i in range(4, len(sys.argv), 4)]
files = sorted(glob.glob(os.path.join(src, "f*.png")))[:n]
sc, per = 3, 6
w, h = 1080 // sc, 1920 // sc
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
rows = (len(files) + per - 1) // per
W = Image.new("RGB", (min(per, len(files)) * (w + 4), rows * (h + 18)), "white")
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((w, h), Image.BILINEAR)
    d = ImageDraw.Draw(im)
    for y in range(60, 1920, 60):
        d.line([(0, y // sc), (w, y // sc)], fill=(255, 0, 0) if y % 240 == 0 else (255, 230, 0), width=1)
        if y % 120 == 0:
            d.text((1, y // sc - 13), str(y), fill=(255, 0, 0), font=font)
    for x in range(120, 1080, 120):
        d.line([(x // sc, 0), (x // sc, h)], fill=(0, 220, 255), width=1)
        d.text((x // sc + 1, 1), str(x), fill=(0, 120, 255), font=font)
    for r in rects:
        d.rectangle([r[0] // sc, r[1] // sc, r[2] // sc, r[3] // sc], outline=(255, 0, 255), width=2)
    W.paste(im, ((i % per) * (w + 4), (i // per) * (h + 18) + 16))
    ImageDraw.Draw(W).text(((i % per) * (w + 4) + 2, (i // per) * (h + 18) + 1),
                           "%s  t=%.1f" % (os.path.basename(f)[:-4], int(os.path.basename(f)[1:4]) * 0.5), fill=(0, 0, 0), font=font)
W.save(out, quality=88)
print(out, W.size)

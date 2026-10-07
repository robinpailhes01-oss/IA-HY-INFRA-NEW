"""Planche : pour chaque rush, la carte 1 (accroche) et la carte 2 (ligne secondaire) cote a cote,
comme dans la video (jamais plus de 2 lignes a la fois). 4 rushes par rangee.
Usage : python3 -I tools/planche.py [sortie.jpg] [largeur_image]"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

FINAL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(FINAL, "planche.jpg")
W = int(sys.argv[2]) if len(sys.argv) > 2 else 170
H = W * 16 // 9
G, PAIR, LAB = max(6, W // 28), max(10, W // 12), max(46, W // 3)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", max(16, W // 9))
small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", max(11, W // 15))
names = ["%02d" % i for i in range(1, 12)]
PER = 4
cell_w = 2 * W + G
rows = (len(names) + PER - 1) // PER
sheet = Image.new("RGB", (PER * cell_w + (PER + 1) * PAIR, rows * (H + LAB) + (rows + 1) * PAIR), (245, 245, 242))
d = ImageDraw.Draw(sheet)


def note_for(r):
    if r["mode"].startswith("aucun texte"):
        return "sans texte (personne en gros plan)"
    m = r["mode"].split(" (")[0]
    m = m.replace("bloc sur l'accroche + la ligne secondaire", "bloc sur les 2 cartes").replace("bloc sur l'accroche", "bloc sur l'accroche")
    return m


for k, n in enumerate(names):
    x = PAIR + (k % PER) * (cell_w + PAIR)
    y = PAIR + (k // PER) * (H + LAB + PAIR)
    r = json.load(open(os.path.join(FINAL, n + ".json")))
    im1 = Image.open(os.path.join(FINAL, n + ".png")).convert("RGB").resize((W, H), Image.LANCZOS)
    sheet.paste(im1, (x, y))
    c2 = os.path.join(FINAL, n + "-carte2.png")
    if os.path.exists(c2) and not r["mode"].startswith("aucun texte"):
        sheet.paste(Image.open(c2).convert("RGB").resize((W, H), Image.LANCZOS), (x + W + G, y))
        sub = "carte 1  |  carte 2"
    else:
        d.rectangle([x + W + G, y, x + 2 * W + G - 1, y + H - 1], fill=(232, 232, 228))
        msg = ["pas de texte", "sur ce plan"] if r["mode"].startswith("aucun texte") else \
              ["ligne secondaire", "au plan suivant", "(plan de %s s)" % ("%.1f" % r["duree_texte"]).replace(".", ",")]
        for i, line in enumerate(msg):
            tw = d.textlength(line, font=small)
            d.text((x + W + G + (W - tw) / 2, y + H / 2 - 30 + i * (small.size + 6)), line, fill=(95, 100, 108), font=small)
        sub = "image seule" if r["mode"].startswith("aucun texte") else "carte 1"
    d.text((x, y + H + 6), n, fill=(20, 30, 45), font=font)
    d.text((x + d.textlength(n + "  ", font=font), y + H + 6 + font.size - small.size - 1), sub, fill=(70, 76, 86), font=small)
    d.text((x, y + H + 10 + font.size), note_for(r), fill=(90, 96, 105), font=small)
sheet.save(out, quality=90)
print(out, sheet.size)

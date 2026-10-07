"""Retire les blocs couleur (cICP, gAMA, cHRM, iCCP, sRGB) des PNG extraits par ffmpeg.

Pourquoi : ffmpeg marque les images d'un transfert BT.709 (cICP 1/1, gAMA 0,51). Chrome applique alors
une gestion des couleurs et les affiche 4 a 7 niveaux trop sombres. Au rendu, HyperFrames marque au
contraire les images extraites de la video en sRGB (setparams color_trc=iec61966-2-1) : Chrome montre
les pixels bruts. Une image sans bloc couleur est lue en sRGB, donc mesurer sur elle = mesurer le rendu.

Usage : python3 -I tools/nettoie_png.py <fichier.png | dossier> ...
"""
import glob
import os
import struct
import sys

import numpy as np
from PIL import Image

COULEUR = {b"cICP", b"gAMA", b"cHRM", b"iCCP", b"sRGB"}


def blocs(path):
    out = []
    with open(path, "rb") as f:
        b = f.read()
    i = 8
    while i < len(b):
        n, = struct.unpack(">I", b[i:i + 4])
        out.append(b[i + 4:i + 8])
        i += 12 + n
    return out


def a_nettoyer(path):
    return path.lower().endswith(".png") and bool(COULEUR & set(blocs(path)))


def nettoie(src, dst=None):
    """Ecrit une copie sans bloc couleur (pixels identiques). Renvoie le chemin propre."""
    dst = dst or src
    a = np.asarray(Image.open(src).convert("RGB"))
    Image.fromarray(a).save(dst, compress_level=1)
    return dst


def main(args):
    files = []
    for a in args:
        files += sorted(glob.glob(os.path.join(a, "*.png"))) if os.path.isdir(a) else [a]
    n = 0
    for f in files:
        if os.path.islink(f):
            continue
        if a_nettoyer(f):
            nettoie(f)
            n += 1
    print("%d image(s) nettoyee(s) sur %d" % (n, len(files)))


if __name__ == "__main__":
    main(sys.argv[1:])

"""Applique adapt.py aux 11 rushes, ecrit final/NN.png (carte 1), NN-carte2.png, NN.json.
Usage : python3 -I tools/run_all.py [NN ...]

Fenetre de mesure = duree du texte = min(duree du plan, 6 s) : images f000... dont l'instant est < duree.
Zones de personnes : union sur toute la fenetre, relevees sur work/zones/g_NN.jpg (grille 60 px) et
work/zones/z_NN.jpg (zooms), images toutes les 0,5 s.
"""
import glob
import json
import os
import sys

FINAL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, FINAL)
import adapt  # noqa: E402

NUIT = (["Ce soir, tu dors", "sur l’eau."], "Nuit à bord · Port de Carnon")
SOLEIL = (["Coucher de soleil", "en mer"], "À 15 min de Montpellier")

SPEC = {
    # 01 : gros plan, tete de y = 340 (0,5 s) sur toute la droite, main a gauche
    "01": dict(txt=NUIT, duree=2.27, eviter=[(480, 340, 1080, 1920), (0, 760, 560, 1150), (0, 1150, 1080, 1920)]),
    # 02 : une personne entre par la droite a 2 s
    "02": dict(txt=NUIT, duree=2.80, eviter=[(930, 940, 1080, 1500)]),
    # 03 : haut des cheveux a y = 545 a 1,5 s (f003) -> 530 par securite
    "03": dict(txt=NUIT, duree=2.70, eviter=[(0, 530, 840, 1500)]),
    "04": dict(txt=NUIT, duree=3.43, eviter=[(380, 1000, 1080, 1260)]),
    # 05 : personne 1 de y = 870 (se deplace de x 450-950 a 140-650) ; personne 2 entre a droite a 3 s,
    #      tete a y = 790-800 pour x >= 820 a 3,5-4 s
    "05": dict(txt=NUIT, duree=5.70, eviter=[(140, 870, 1080, 1600), (800, 780, 1080, 870)]),
    # 06 : jambes a partir de y = 1150
    "06": dict(txt=NUIT, duree=6.17, eviter=[(0, 1150, 1080, 1920)]),
    "07": dict(txt=NUIT, duree=6.07, eviter=[(0, 1160, 1080, 1500)]),
    # 08 : 14,2 s ; texte 0-6 s ; le soleil entre dans le haut du cadre a 6,0 s (apres la sortie du texte)
    "08": dict(txt=NUIT, duree=14.21, eviter=[(0, 840, 1080, 1500)]),
    # 09-11 : meme coucher de soleil (IMG_0175, 0177, 0176) -> une seule couleur pour la sequence
    "09": dict(txt=SOLEIL, duree=4.04, eviter=[(240, 940, 640, 1100)], groupe="coucher de soleil"),
    "10": dict(txt=SOLEIL, duree=6.86, eviter=[(0, 1060, 640, 1340)], groupe="coucher de soleil"),
    "11": dict(txt=SOLEIL, duree=13.20, eviter=[], groupe="coucher de soleil"),
}


def window(n, spec):
    w = min(spec["duree"], adapt.DUREE_MAX)
    files = sorted(glob.glob(os.path.join(FINAL, "frames", n, "f*.png")))
    return [f for f in files if adapt.frame_time(f) < w - 1e-6]


def show(n, r):
    print(n, r["mode"], r["ton"], r["variables"]["--hy-texte"], r["variables"]["--hy-secondaire"],
          "haut", r["zone"]["haut"], "moy", r["contraste_moyen_min"], "pire", r["contraste_pire_min"],
          "bords", r["zone"]["bords_moyens"], "ok", r.get("verification_ok"), flush=True)


def main(which):
    out = {}
    groups = {}
    for n in which:
        s = SPEC[n]
        if s.get("groupe"):
            groups.setdefault(s["groupe"], []).append(n)
            continue
        acc, info = s["txt"]
        r = adapt.run(window(n, s), acc, info, True, s["eviter"], None, s.get("cartes"), FINAL, n, s["duree"])
        out[n] = r
        show(n, r)
    for g, ns in groups.items():
        acc, info = SPEC[ns[0]]["txt"]
        items = [dict(src=window(n, SPEC[n]), duree=SPEC[n]["duree"], eviter=SPEC[n]["eviter"], nom=n,
                      cartes=SPEC[n].get("cartes")) for n in ns]
        res = adapt.run_suite(items, acc, info, FINAL, g)
        for n in ns:
            out[n] = res[n]
            show(n, res[n])
    return out


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] in ("--groupe-complet",):
        args = args[1:]
    which = args or sorted(SPEC)
    # un plan d'une sequence entraine toute la sequence (couleur commune)
    full = set(which)
    for n in which:
        g = SPEC[n].get("groupe")
        if g:
            full |= {m for m in SPEC if SPEC[m].get("groupe") == g}
    main(sorted(full))

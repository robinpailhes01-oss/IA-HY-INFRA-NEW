#!/usr/bin/env python3
"""adapt.py - systeme typo FINAL Harmonie Yacht, reels 9:16 (1080x1920).

A « continuite avec le site » (Instrument Serif 132 px + Instrument Sans 60 px, ferre a gauche,
couleur tiree du plan, filet fin) + bloc de C « seulement si besoin » (petit bloc arrondi par ligne,
teinte par le plan, opacite minimale).

Usage :
  python3 -I adapt.py <dossier_ou_image> --duree S [--accroche "L1" "L2"] [--info "texte"] [--sans-info]
                      [--eviter x0 y0 x1 y1 ...] [--haut Y] [--cartes img1 img2] [--sortie dossier] [--nom NN]
  python3 -I adapt.py --suite suite.json [--sortie dossier]      (plusieurs plans d'une meme sequence)

  <dossier_ou_image> : images du plan prises toutes les 0,5 s (f000.png = 0 s, f001.png = 0,5 s...)
                       PENDANT QUE LE TEXTE EST AFFICHE (de 0 s a --duree). Toutes les mesures gardent le
                       PIRE cas sur toutes les images. Les PNG avec blocs couleur (cICP/gAMA/cHRM, ajoutes
                       par ffmpeg) sont recopies sans ces blocs avant toute mesure (voir tools/nettoie_png.py).
  --duree            : duree du texte = duree du plan dans le montage, 6 s au plus (au-dela le texte sort a 6 s).
                       Moins de 5 s : pas de carte 2, la ligne secondaire va au plan suivant.
  --eviter           : rectangle(s) interdits (personnes : visage, tete, corps), en px du canevas, union
                       sur tout le plan ; repetable.
  --cartes           : images utilisees pour les captures des cartes 1 et 2 (defaut : 1,5 s et milieu de la carte 2).
  --suite            : JSON {"accroche": [...], "info": "...", "plans": [{"src", "duree", "eviter", "nom"}]} :
                       une seule couleur de texte pour toute la sequence (ex. coucher de soleil en 3 plans).
Sortie : JSON (ecran + <sortie>/<nom>.json) : variables CSS et attributs a recopier dans template.html,
         niveau de traitement, contrastes verifies ligne par ligne sur captures ; captures <nom>.png (carte 1)
         et <nom>-carte2.png (carte 2).

La regle, pas a pas :
  1. Placer : le texte glisse de y = 240 a y = 1500 - hauteur (pas de 12 px) ; 192-239 seulement si rien
     ne tient plus bas. Interdit (pour chaque variante, avec ou sans bloc) : toucher une personne
     (--eviter, marge 40 px) ou le soleil (pixels brules, marge 48 px). Cout = bords + ecart de lumiere
     sous chaque ligne (accroche x1, info x0,6), moyenne + 0,5 x pire image, preference pour y = 240.
     Si aucune place ne tient avec la ligne secondaire, elle est reportee au plan suivant ; si l'accroche
     seule ne tient pas, pas de texte sur ce plan.
  2. Teinte du plan : couleur moyenne de la zone (OKLCH) ; chroma < 0,03 -> teinte de l'accent du plan.
     Pour les elements fonces, une teinte orange/jaune (20-110 deg) est remplacee par la teinte voisine
     du plan (sinon marron). En --suite, la teinte est calculee sur tous les plans ensemble.
  3. Deux tons candidats : clair OKLCH(0,97 ; 0,022) et fonce OKLCH(0,27 ; 0,065), alignes sur une
     couleur du site si l'ecart OKLab <= 0,05. Secondaire : clair = accent L 0,90 C 0,06 ; fonce =
     teinte du texte L 0,34 C 0,09 ; rapproche du texte par pas de 0,01 si besoin.
  4. Seuils, LIGNE PAR LIGNE et au pire cas sur toutes les images : contraste >= 4,5:1 avec le fond moyen
     (4,6 exige : marge de 0,1 pour la compression video) ET >= 3:1 avec les 10 % de pixels les moins
     favorables (p90 sous texte clair, p10 sous fonce). Avec un bloc, le pire cas doit atteindre 4,5:1.
     A la verification, chaque ligne est mesuree deux fois (boite de la ligne, et pixels sous les lettres
     elargies de 4 px) et on garde le plus bas des deux.
  5. Trois niveaux, on prend le premier qui passe :
       0 = texte nu ; 1 = voile (couleur de l'autre ton, filtre degrade) : <= 0,40 s'il assombrit
           (texte clair), <= 0,20 s'il eclaircit (texte fonce : au-dela le ciel parait brumeux) ;
       2 = bloc arrondi (C) sur les seules lignes chargees (densite de bords > 0,015) ou qui ne passent pas.
     Une ligne posee sur une zone chargee passe directement au bloc, meme si son contraste passe.
  6. Ton : celui qui demande le moins de traitement. A egalite : niveau 0 -> meilleur pire cas ;
     niveau 1 -> texte clair + voile fonce, sauf s'il faut 0,15 de voile de plus qu'en fonce ;
     niveau 2 -> le moins de blocs, puis bloc proche de la valeur du plan (fond moyen < 0,36 -> bloc
     profond L 0,34 + texte clair ; sinon bloc clair L 0,955 + texte fonce).
  7. Bloc : couleur du plan, clair L 0,955 (chroma <= 0,024) ou profond L 0,34 (chroma <= 0,085),
     meme couleur et meme opacite pour toutes les lignes bloquees ; opacite = la plus faible de 0,60 a
     0,96 (pas de 0,02) qui passe.
  8. Verification sur captures reelles (lettres transparentes, voile/bloc/filet visibles) de CHAQUE
     image : si une ligne echoue, on passe au cran suivant (voile +0,05, puis bloc, puis bloc +0,04).
"""
import argparse
import concurrent.futures as cf
import glob
import html
import json
import os
import re
import struct
import subprocess

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = ("/root/.cache/hyperframes/chrome/chrome-headless-shell/linux-152.0.7977.30/"
          "chrome-headless-shell-linux64/chrome-headless-shell")

# ------------------------------------------------------------------ reglages
TOP_MIN, TOP_PREF, BOTTOM_MAX, STEP = 192, 240, 1500, 12
TH_MEAN, TH_WORST, TH_WORST_BLOC = 4.5, 3.0, 4.5     # seuils de la regle
MARGE = 0.1                                           # compression video (ecart mesure/rendu <= 1,25 niveau)
SEUIL_MOY = TH_MEAN + MARGE
DUREE_MAX, DUREE_CARTE2 = 6.0, 5.0
# Voile : assombrir un ciel parait naturel (filtre polarisant), le blanchir parait brumeux.
VEIL_STEPS = {"clair": [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40],  # voile fonce sous texte clair
              "fonce": [0.05, 0.10, 0.15, 0.20]}                          # voile clair sous texte fonce
E_BUSY = 0.015
BLOC_A_MIN, BLOC_A_MAX = 0.60, 0.96
LIGHT_LC, DARK_LC = (0.970, 0.022), (0.270, 0.065)
SEC_LIGHT_LC, SEC_DARK_LC = (0.900, 0.060), (0.340, 0.090)
BLOC_CLAIR, BLOC_PROFOND = (0.955, 0.024), (0.340, 0.085)
WARM = (20.0, 110.0)
POLARITE = 0.36
SUN_FRAC, SUN_MARGIN, FACE_MARGIN = 0.003, 48, 40
ACTION_SAFE, TITLE_SAFE_R = 54, 972
SNAP_DE = 0.05
BRAND = {
    "light": {"Écume": "#F5F8FA", "Sable": "#EFE7D8", "Pêche": "#F0C9A0"},
    "dark": {"Encre océan": "#0C2B45", "Encre": "#14314C", "Océan profond": "#123A5C", "Océan": "#1A4C74"},
}
LIGNES = {"accroche": ["accroche-l1", "accroche-l2"], "info": ["info-l1"]}


def role_of(lid):
    return "accroche" if lid.startswith("accroche") else "info"


# ------------------------------------------------------------------ couleur
def hex2rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def rgb2hex(c):
    c = np.clip(np.round(np.asarray(c, float) * 255), 0, 255).astype(int)
    return "#%02X%02X%02X" % tuple(c)


def to_lin(c):
    c = np.asarray(c, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(np.asarray(c, np.float64), 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)


def lum(srgb):
    lin = to_lin(srgb)
    return lin[..., 0] * 0.2126 + lin[..., 1] * 0.7152 + lin[..., 2] * 0.0722


def cr(y1, y2):
    return (max(y1, y2) + 0.05) / (min(y1, y2) + 0.05)


_M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                [0.2119034982, 0.6806995451, 0.1073969566],
                [0.0883024619, 0.2817188376, 0.6299787005]])
_M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                [1.9779984951, -2.4285922050, 0.4505937099],
                [0.0259040371, 0.7827717662, -0.8086757660]])


def lin_to_oklab(lin):
    return np.cbrt(np.asarray(lin, np.float64) @ _M1.T) @ _M2.T


def oklab_to_lin(lab):
    return ((np.asarray(lab, np.float64) @ np.linalg.inv(_M2).T) ** 3) @ np.linalg.inv(_M1).T


def srgb_to_oklch(srgb):
    L, a, b = lin_to_oklab(to_lin(srgb))
    return float(L), float(np.hypot(a, b)), float(np.degrees(np.arctan2(b, a)) % 360)


def oklch_to_srgb(L, C, h):
    """OKLCH -> sRGB (0-1), chroma reduit jusqu'a rentrer dans le gamut."""
    while C >= 0:
        lin = oklab_to_lin([L, C * np.cos(np.radians(h)), C * np.sin(np.radians(h))])
        if np.all(lin >= -1e-4) and np.all(lin <= 1 + 1e-4):
            return to_srgb(np.clip(lin, 0, 1))
        C -= 0.002
    return to_srgb(np.clip(oklab_to_lin([L, 0, 0]), 0, 1))


def de_ok(c1, c2):
    return float(np.linalg.norm(lin_to_oklab(to_lin(c1)) - lin_to_oklab(to_lin(c2))))


def snap(srgb, family):
    best = min(BRAND[family].items(), key=lambda kv: de_ok(srgb, hex2rgb(kv[1])))
    return (hex2rgb(best[1]), best[0]) if de_ok(srgb, hex2rgb(best[1])) <= SNAP_DE else (np.asarray(srgb), None)


HUE_OCEAN = srgb_to_oklch(hex2rgb("#1A4C74"))[2]


def circ_mean(h):
    r = np.radians(h)
    return float(np.degrees(np.arctan2(np.sin(r).sum(), np.cos(r).sum())) % 360)


def warm(h):
    return WARM[0] <= h <= WARM[1]


# ------------------------------------------------------------------ images du plan
def png_colour_chunks(path):
    if not path.lower().endswith(".png"):
        return False
    with open(path, "rb") as f:
        b = f.read()
    i, found = 8, False
    while i < len(b):
        n, = struct.unpack(">I", b[i:i + 4])
        if b[i + 4:i + 8] in (b"cICP", b"gAMA", b"cHRM", b"iCCP", b"sRGB"):
            found = True
        i += 12 + n
    return found


def frame_time(path):
    m = re.match(r"f(\d+)\.", os.path.basename(path))
    return int(m.group(1)) * 0.5 if m else None


class Plan:
    def __init__(self, src, avoid, work):
        if isinstance(src, (list, tuple)):
            files = list(src)
        elif os.path.isdir(src):
            files = sorted(glob.glob(os.path.join(src, "*.png")) + glob.glob(os.path.join(src, "*.jpg")))
        else:
            files = [src]
        clean_dir = os.path.join(work, "propre")
        self.files, self.nettoyees = [], 0
        self.img, self.Y, self.E, self.burnt_ii = [], [], [], []
        for f in files:
            im = Image.open(f).convert("RGB")
            if im.size != (1080, 1920):
                im = im.resize((1080, 1920), Image.LANCZOS)
            a = np.asarray(im)
            if png_colour_chunks(f) or im.size != Image.open(f).size:
                # Chrome appliquerait le transfert BT.709 marque par ffmpeg : copie sans bloc couleur
                os.makedirs(clean_dir, exist_ok=True)
                f = os.path.join(clean_dir, "%02d_%s" % (len(self.files), os.path.basename(f).rsplit(".", 1)[0] + ".png"))
                Image.fromarray(a).save(f, compress_level=1)
                self.nettoyees += 1
            self.files.append(os.path.abspath(f))
            self.img.append(a)
            self.Y.append(lum(a[::2, ::2] / 255.0).astype(np.float32))            # 1/2 resolution
            # densite de bords (methode A) : image au 1/4 legerement floutee, gradient de luminance
            q = im.resize((270, 480), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1))
            Yq = lum(np.asarray(q, np.float64) / 255)
            gy, gx = np.gradient(Yq)
            self.E.append(np.hypot(gx, gy).astype(np.float32))
            burnt = (a[::2, ::2].min(axis=2) >= 245).astype(np.float64)                # soleil / reflets brules
            self.burnt_ii.append(np.pad(burnt.cumsum(0).cumsum(1), ((1, 0), (1, 0))))
        mask = np.zeros((1920, 1080))
        for x0, y0, x1, y1 in avoid:
            mask[max(0, y0):min(1920, y1), max(0, x0):min(1080, x1)] = 1
        self.avoid_ii = np.pad(mask.cumsum(0).cumsum(1), ((1, 0), (1, 0)))

    @staticmethod
    def _sum(ii, x0, y0, x1, y1):
        return ii[y1, x1] - ii[y0, x1] - ii[y1, x0] + ii[y0, x0]

    def face_hit(self, b, m=FACE_MARGIN):
        x0, y0 = max(0, int(b[0] - m)), max(0, int(b[1] - m))
        x1, y1 = min(1080, int(b[2] + m)), min(1920, int(b[3] + m))
        return self._sum(self.avoid_ii, x0, y0, x1, y1) > 0

    def sun_hit(self, b, m=SUN_MARGIN):
        x0, y0 = max(0, int(b[0] - m)) // 2, max(0, int(b[1] - m)) // 2
        x1, y1 = min(1080, int(b[2] + m)) // 2, min(1920, int(b[3] + m)) // 2
        area = max(1, (x1 - x0) * (y1 - y0))
        return any(self._sum(ii, x0, y0, x1, y1) / area > SUN_FRAC for ii in self.burnt_ii)

    def px(self, i, boxes, stride=2):
        parts = []
        for x0, y0, x1, y1 in boxes:
            parts.append(self.img[i][int(y0):int(y1):stride, int(x0):int(x1):stride].reshape(-1, 3))
        return np.concatenate(parts).astype(np.float64) / 255

    def edges(self, i, boxes):
        v = [self.E[i][int(y0) // 4:max(int(y0) // 4 + 1, int(y1) // 4), int(x0) // 4:max(int(x0) // 4 + 1, int(x1) // 4)].ravel()
             for x0, y0, x1, y1 in boxes]
        return float(np.concatenate(v).mean())

    def spread(self, i, boxes):
        v = np.concatenate([self.Y[i][int(y0) // 2:int(y1) // 2:2, int(x0) // 2:int(x1) // 2:2].ravel()
                            for x0, y0, x1, y1 in boxes])
        p10, p90 = np.percentile(v, [10, 90])
        return float(p90 - p10)


# ------------------------------------------------------------------ pages et chrome
TEMPLATE = os.path.join(HERE, "template.html")
RECT_JS = """<script>document.fonts.ready.then(function(){var o={lines:[]};
document.querySelectorAll('#texte .ligne').forEach(function(e){var r=e.getBoundingClientRect();if(!r.width)return;
var s=getComputedStyle(e);o.lines.push({role:e.closest('#accroche')?'accroche':'info',id:e.id,x:r.left,y:r.top,w:r.width,h:r.height,
pt:parseFloat(s.paddingTop),pr:parseFloat(s.paddingRight),pb:parseFloat(s.paddingBottom),pl:parseFloat(s.paddingLeft)});});
var t=document.getElementById('texte').getBoundingClientRect();o.texte={x:t.left,y:t.top,w:t.width,h:t.height};
var f=document.getElementById('filet').getBoundingClientRect();o.filet={x:f.left,y:f.top,w:f.width,h:f.height};
var p=document.createElement('pre');p.id='rects';p.textContent=JSON.stringify(o);document.body.appendChild(p);});</script>"""
ENCRE_CSS = ("<style>#plan{display:none!important}#voile{display:none!important}"
             "html,body,#root{background:#000!important}#texte .ligne{background:transparent!important}"
             "#filet{visibility:hidden!important}.accroche,.accroche *,.info,.info *{color:#FF00FF!important}</style></head>")


def rgb_triplet(h):
    return " ".join(str(int(round(v * 255))) for v in hex2rgb(h))


def css_vars(cfg):
    v = cfg["voile"]
    return {
        "--hy-texte": cfg["texte"], "--hy-secondaire": cfg["secondaire"], "--hy-haut": "%dpx" % cfg["haut"],
        "--hy-voile": rgb_triplet(v["couleur"]), "--hy-voile-a": "%g" % v["a"],
        "--hy-voile-debut": "%dpx" % v["debut"], "--hy-voile-fin": "%dpx" % v["fin"],
        "--hy-bloc": rgb_triplet(cfg["bloc"]), "--hy-bloc-accroche-a": "%g" % cfg["bloc_accroche_a"],
        "--hy-bloc-info-a": "%g" % cfg["bloc_info_a"],
    }


def attrs(cfg):
    d = "%g" % cfg["duree"]
    return {"#root": {"data-duration": d}, "video#plan": {"data-duration": d},
            "#texte": {"data-duree": d, "data-info": str(cfg["info"]), "data-bloc-accroche": str(cfg["bloc_accroche"]),
                       "data-bloc-info": str(cfg["bloc_info"])},
            "#voile": {"data-forme": cfg["voile"]["forme"]}}


def write_composition(dossier, cfg, video):
    """Vraie composition HyperFrames : <dossier>/index.html (video en fond, timeline GSAP) + fonts/."""
    import shutil
    os.makedirs(dossier, exist_ok=True)
    shutil.copytree(os.path.join(HERE, "fonts"), os.path.join(dossier, "fonts"), dirs_exist_ok=True)
    return write_page(os.path.join(dossier, "index.html"), cfg, video=video)


def write_page(path, cfg, plate=None, mesure=False, rects=False, carte=None, encre=False, video=None):
    t = open(TEMPLATE, encoding="utf-8").read()
    if video:   # composition : polices relatives, video et GSAP gardes
        t = re.sub(r'(<video[^>]*?src=")[^"]*"', lambda m: m.group(1) + video + '"', t, flags=re.S)
    else:
        t = t.replace('url("fonts/', 'url("file://%s/fonts/' % HERE)
    body = "\n        ".join("%s: %s;" % kv for kv in css_vars(cfg).items())
    t = re.sub(r"/\*VARS\*/.*?/\*/VARS\*/", lambda m: "/*VARS*/\n        " + body + "\n        /*/VARS*/", t, flags=re.S)
    a = attrs(cfg)
    for k, v in a["#texte"].items():
        t = re.sub(r'(<div id="texte"[^>]*?)%s="[^"]*"' % k, lambda m: m.group(1) + '%s="%s"' % (k, v), t)
    t = re.sub(r'(data-composition-id="main"\s+data-start="0"\s+data-duration=")[^"]*"',
               lambda m: m.group(1) + a["#root"]["data-duration"] + '"', t)
    t = re.sub(r'(<video[^>]*?data-duration=")[^"]*"', lambda m: m.group(1) + a["#root"]["data-duration"] + '"', t, flags=re.S)
    t = t.replace('data-forme="aucun"', 'data-forme="%s"' % a["#voile"]["data-forme"])
    l1, l2 = cfg["accroche"]
    t = re.sub(r'(<span id="accroche-l1" class="ligne">).*?(</span>)', lambda m: m.group(1) + html.escape(l1, False) + m.group(2), t)
    t = re.sub(r'(<span id="accroche-l2" class="ligne">).*?</span>',
               lambda m: m.group(1) + "<em>" + html.escape(l2, False) + "</em></span>", t)
    t = re.sub(r'(<span id="info-l1" class="ligne">).*?(</span>)', lambda m: m.group(1) + html.escape(cfg["info_texte"], False) + m.group(2), t)
    if not video:
        img = '<img id="plan" class="plan" src="file://%s" alt="" />' % plate if plate else ""
        t = re.sub(r"<!--PLAN-->.*?<!--/PLAN-->", lambda m: img, t, flags=re.S)
        t = re.sub(r'<script src="https://cdn.jsdelivr.net/npm/gsap[^"]*"></script>', "", t)
    if mesure:
        t = t.replace('data-composition-id="main"', 'data-composition-id="main" data-mesure="1"')
    if carte:
        t = t.replace('data-composition-id="main"', 'data-composition-id="main" data-carte="%d"' % carte)
    if encre:
        t = t.replace("</head>", ENCRE_CSS, 1)
    if rects:
        t = t.replace("</body>", RECT_JS + "</body>")
    open(path, "w", encoding="utf-8").write(t)
    return path


def chrome(args):
    base = [CHROME, "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1",
            "--window-size=1080,1920", "--virtual-time-budget=3000"]
    return subprocess.run(base + args, capture_output=True, text=True, timeout=180)


def dump_rects(page):
    out = chrome(["--dump-dom", "file://" + page]).stdout
    m = re.search(r'<pre id="rects">(.*?)</pre>', out, re.S)
    return json.loads(html.unescape(m.group(1)))


def shoot(page, png):
    chrome(["--screenshot=" + png, "file://" + page])
    return png


# ------------------------------------------------------------------ geometrie
def boxes(rects, role, top=0, content=True):
    return [line_box(r, top, content) for r in rects["lines"] if r["role"] == role]


def line_box(r, top=0, content=True):
    if content:
        return (r["x"] + r["pl"], top + r["y"] + r["pt"], r["x"] + r["w"] - r["pr"], top + r["y"] + r["h"] - r["pb"])
    return (r["x"], top + r["y"], r["x"] + r["w"], top + r["y"] + r["h"])


def line_by_id(rects, lid):
    for r in rects["lines"]:
        if r["id"] == lid:
            return r
    return None


def base_cfg(acc, info_txt, info_on, duree=DUREE_MAX):
    return {"texte": "#F5F8FA", "secondaire": "#CFE2F5", "haut": 0, "duree": round(float(duree), 2),
            "voile": {"couleur": "#0C2B45", "a": 0, "forme": "aucun", "debut": 0, "fin": 0},
            "bloc": "#143863", "bloc_accroche_a": 0, "bloc_info_a": 0, "bloc_accroche": 0, "bloc_info": 0,
            "info": 1 if info_on else 0, "accroche": acc, "info_texte": info_txt}


_GEO = {}


def layouts(work, acc, info_txt):
    """Geometrie (haut = 0) des 6 variantes : bloc accroche oui/non x bloc info oui/non x info oui/non."""
    k0 = (tuple(acc), info_txt)
    if k0 in _GEO:
        return _GEO[k0]
    out = {}
    jobs = []
    for info_on in (1, 0):
        for ba in (0, 1):
            for bi in ((0, 1) if info_on else (0,)):
                cfg = dict(base_cfg(acc, info_txt, info_on), bloc_accroche=ba, bloc_info=bi)
                p = write_page(os.path.join(work, "geo-%d%d%d.html" % (ba, bi, info_on)), cfg, rects=True)
                jobs.append(((ba, bi, info_on), p))
    with cf.ThreadPoolExecutor(4) as ex:
        for k, r in zip([j[0] for j in jobs], ex.map(lambda j: dump_rects(j[1]), jobs)):
            out[k] = r
    for k, r in out.items():
        left = min(l["x"] for l in r["lines"])
        right = max(l["x"] + l["w"] for l in r["lines"])
        letters_left = min(l["x"] + l["pl"] for l in r["lines"])
        assert left >= ACTION_SAFE - 0.5, "fond de bloc hors zone action-safe (%.0f px)" % left
        assert right <= TITLE_SAFE_R + 0.5, "texte hors zone title-safe (%.0f px)" % right
        assert abs(letters_left - 108) < 1.5, "lettres non alignees a x = 108 (%.1f px)" % letters_left
    _GEO[k0] = out
    return out


# ------------------------------------------------------------------ etape 1 : placement
def place(plan, geo, info_on, top_fixed=None):
    """Renvoie les positions possibles, de la meilleure a la moins bonne : [(cout, haut, variantes_sures)].
    Une variante (bloc accroche oui/non, bloc info oui/non) est sure si aucune de ses boites ne touche
    un visage (marge FACE_MARGIN) ni le soleil (marge SUN_MARGIN). La variante sans bloc doit etre sure.
    y = 240 d'abord ; 192 a 239 seulement si rien ne tient plus bas."""
    keys = [k for k in geo if k[2] == info_on]
    roles = ["accroche", "info"] if info_on else ["accroche"]
    refus = {"visage": 0, "soleil": 0, "bas": 0}

    def scan(cands):
        found = []
        for top in cands:
            safe = []
            for k in keys:
                if top + max(r["y"] + r["h"] for r in geo[k]["lines"]) > BOTTOM_MAX:
                    if k[:2] == (0, 0):
                        refus["bas"] += 1
                    continue
                bad = None
                for role in roles:
                    for b in boxes(geo[k], role, top, content=False):
                        bad = "visage" if plan.face_hit(b) else ("soleil" if plan.sun_hit(b) else None)
                        if bad:
                            break
                    if bad:
                        break
                if bad and k[:2] == (0, 0):
                    refus[bad] += 1
                if not bad:
                    safe.append(k[:2])
            if (0, 0) not in safe:
                continue
            bare = geo[(0, 0, info_on)]
            costs = []
            for i in range(len(plan.img)):
                c = 0.0
                for role, w in (("accroche", 1.0), ("info", 0.6)):
                    if role in roles:
                        bx = boxes(bare, role, top)
                        c += w * (100 * plan.edges(i, bx) + plan.spread(i, bx))
                costs.append(c)
            cost = float(np.mean(costs) + 0.5 * np.max(costs)) + 0.0006 * abs(top - TOP_PREF)
            found.append((cost, top, safe))
        return sorted(found)

    bare_h = max(r["y"] + r["h"] for r in geo[(0, 0, info_on)]["lines"])
    if top_fixed:
        return scan([top_fixed]), refus
    found = scan(range(TOP_PREF, int(BOTTOM_MAX - bare_h) + 1, STEP))
    if not found:
        found = scan(range(TOP_MIN, TOP_PREF, 8))
    return found, refus


# ------------------------------------------------------------------ etapes 2 a 7 : couleur et fond
def tones_for(zone, allpx, mids):
    """Teintes et tons candidats a partir des pixels de la zone (un ou plusieurs plans)."""
    zmean = to_srgb(to_lin(zone).mean(0))
    zL, zC, zh = srgb_to_oklch(zmean)
    cands = []
    for mid in mids:
        q = Image.fromarray(mid).resize((108, 192)).quantize(6, method=Image.Quantize.MEDIANCUT)
        pal = np.array(q.getpalette()[:18]).reshape(6, 3) / 255
        cnt = np.bincount(np.array(q).ravel(), minlength=6) / (108 * 192)
        cands += [pal[i] for i in range(6) if cnt[i] >= 0.08]
    accent = max(cands, key=lambda c: srgb_to_oklch(c)[1])
    aL, aC, ah = srgb_to_oklch(accent)
    hue = zh if zC >= 0.03 else ah
    dark_hue = hue
    if warm(hue):  # orange/jaune assombri = marron : teinte voisine du plan (zone, puis image entiere)
        dark_hue = HUE_OCEAN
        for src in (zone, allpx):
            lab = lin_to_oklab(to_lin(src))
            C = np.hypot(lab[:, 1], lab[:, 2])
            h = np.degrees(np.arctan2(lab[:, 2], lab[:, 1])) % 360
            okm = (C >= 0.04) & ~((h >= WARM[0]) & (h <= WARM[1]))
            if okm.sum() >= 0.10 * max(1, (C >= 0.04).sum()):
                dark_hue = circ_mean(h[okm])
                break
    light, ln = snap(oklch_to_srgb(*LIGHT_LC, hue), "light")
    dark, dn = snap(oklch_to_srgb(*DARK_LC, dark_hue), "dark")
    text_dark_hue = srgb_to_oklch(dark)[2]   # secondaire foncee = teinte du texte (apres alignement sur le site)
    tones = {
        "clair": {"texte": rgb2hex(light), "nom": ln, "voile": rgb2hex(dark), "sec_lch": [*SEC_LIGHT_LC, ah],
                  "bloc_lch": [BLOC_PROFOND[0], min(zC, BLOC_PROFOND[1]), dark_hue]},
        "fonce": {"texte": rgb2hex(dark), "nom": dn, "voile": rgb2hex(light), "sec_lch": [*SEC_DARK_LC, text_dark_hue],
                  "bloc_lch": [BLOC_CLAIR[0], min(zC, BLOC_CLAIR[1]), hue]},
    }
    return {"hue": hue, "dark_hue": dark_hue, "accent_hue": ah, "zone_C": zC, "zone_hex": rgb2hex(zmean),
            "accent_hex": rgb2hex(accent), "tones": tones}


class Decider:
    def __init__(self, plan, geo, top, info_on, safe):
        self.plan, self.geo, self.top, self.info_on, self.safe = plan, geo, top, info_on, set(safe)
        self.roles = ["accroche", "info"] if info_on else ["accroche"]
        self.n = len(plan.img)
        self._px = {}
        self.sec_force = None

    def px(self, key, lid):
        k = (key, lid)
        if k not in self._px:
            bx = [line_box(line_by_id(self.geo[key + (self.info_on,)], lid), self.top)]
            self._px[k] = [self.plan.px(i, bx) for i in range(self.n)]
        return self._px[k]

    def evaluate(self, key, lid, color, veil=None, bloc=None):
        """Contraste d'UNE ligne : minimum sur toutes les images de (moyenne) et de (pire 10 %)."""
        Yt = float(lum(hex2rgb(color) if isinstance(color, str) else color))
        means, worsts = [], []
        for p in self.px(key, lid):
            if veil and veil[1] > 0:
                p = p * (1 - veil[1]) + hex2rgb(veil[0]) * veil[1]
            if bloc and bloc[1] > 0:
                p = p * (1 - bloc[1]) + hex2rgb(bloc[0]) * bloc[1]
            Y = lum(p)
            ym = float(Y.mean())
            p10, p90 = np.percentile(Y, [10, 90])
            means.append(cr(Yt, ym))
            worsts.append(cr(Yt, p90 if Yt > ym else p10))
        return {"moyenne": round(min(means), 2), "pire": round(min(worsts), 2)}

    @staticmethod
    def ok(res, bloc=False):
        return res["moyenne"] >= SEUIL_MOY and res["pire"] >= (TH_WORST_BLOC if bloc else TH_WORST)

    def collect(self):
        bx = {r: boxes(self.geo[(0, 0, self.info_on)], r, self.top) for r in self.roles}
        allb = sum(bx.values(), [])
        self.zone = np.concatenate([self.plan.px(i, allb, 3) for i in range(self.n)])
        self.allpx = np.concatenate([im[::8, ::8].reshape(-1, 3) / 255 for im in self.plan.img])
        self.mid = self.plan.img[self.n // 2]
        self.zone_Y = float(lum(self.zone).mean())
        self.busy = {r: round(float(np.mean([self.plan.edges(i, bx[r]) for i in range(self.n)])), 4) for r in self.roles}
        self.busy_max = {r: round(float(np.max([self.plan.edges(i, bx[r]) for i in range(self.n)])), 4) for r in self.roles}

    def set_tones(self, t):
        self.hue, self.dark_hue, self.accent_hue = t["hue"], t["dark_hue"], t["accent_hue"]
        self.zone_C, self.zone_hex, self.accent_hex, self.tones = t["zone_C"], t["zone_hex"], t["accent_hex"], t["tones"]

    def analyse(self):
        self.collect()
        self.set_tones(tones_for(self.zone, self.allpx, [self.mid]))

    def fit_sec(self, tone, key, veil=None, bloc=None):
        """Secondaire du ton, rapproche du texte par pas de 0,01 en L jusqu'a passer."""
        T = self.tones[tone]
        if self.sec_force:
            L, C, h = srgb_to_oklch(hex2rgb(self.sec_force))
            col = self.sec_force
        else:
            col = rgb2hex(snap(oklch_to_srgb(*T["sec_lch"]), "light" if tone == "clair" else "dark")[0])
            L, C, h = srgb_to_oklch(hex2rgb(col))   # on rapproche la couleur retenue (du site si alignee)
        Lt = srgb_to_oklch(hex2rgb(T["texte"]))[0]
        while True:
            res = self.evaluate(key, "info-l1", col, veil, bloc)
            if self.ok(res, bloc is not None):
                return col, res
            L = L + 0.01 if tone == "clair" else L - 0.01
            if (tone == "clair" and L >= Lt) or (tone == "fonce" and L <= Lt):
                res = self.evaluate(key, "info-l1", T["texte"], veil, bloc)
                return (T["texte"], res) if self.ok(res, bloc is not None) else (None, res)
            col = rgb2hex(oklch_to_srgb(L, C, h))

    def ladder(self, tone):
        """Liste ordonnee des configurations du ton, de la plus discrete a la plus visible.
        Chaque element : dict(niveau, voile_a, blocs, bloc_hex, bloc_a, sec, res). Seules celles qui
        passent la prevision (ligne par ligne) sont gardees ; la premiere est la proposition."""
        T = self.tones[tone]
        out = []
        busy = {r for r in self.roles if self.busy[r] > E_BUSY}

        def conf(level, a, blocked, bhex=None, ba=0.0):
            key = (1 if "accroche" in blocked else 0, 1 if "info" in blocked else 0)
            if key not in self.safe:  # ce bloc toucherait un visage ou le soleil
                return None
            veil = (T["voile"], a) if a else None
            res = {}
            rb = (bhex, ba) if "accroche" in blocked else None
            for lid in LIGNES["accroche"]:
                res[lid] = self.evaluate(key, lid, T["texte"], veil, rb)
                if not self.ok(res[lid], rb is not None):
                    return None
            if self.info_on:
                rb = (bhex, ba) if "info" in blocked else None
                sec_hex, res["info-l1"] = self.fit_sec(tone, key, veil, rb)
                if sec_hex is None:
                    return None
            else:
                sec_hex = self.sec_force or rgb2hex(snap(oklch_to_srgb(*T["sec_lch"]), "light" if tone == "clair" else "dark")[0])
            return {"ton": tone, "niveau": level, "voile_a": a, "blocs": sorted(blocked), "bloc_hex": bhex,
                    "bloc_a": ba, "texte": T["texte"], "secondaire": sec_hex, "res": res}

        if not busy:
            c = conf(0, 0, set())
            if c:
                out.append(c)
            for a in VEIL_STEPS[tone]:
                c = conf(1, a, set())
                if c:
                    out.append(c)
        # niveau 2 : lignes chargees + lignes qui ne passent pas nues
        need = set(busy)
        if not all(self.ok(self.evaluate((0, 0), lid, T["texte"])) for lid in LIGNES["accroche"]):
            need.add("accroche")
        if self.info_on and self.fit_sec(tone, (0, 0))[0] is None:
            need.add("info")
        if not need:  # tout passe nu mais rien de charge : bloc seulement en dernier recours
            need = set(self.roles)
        L, C, h = T["bloc_lch"]
        for _ in range(12):
            bhex = rgb2hex(oklch_to_srgb(L, C, h))
            a, extra = BLOC_A_MIN, 0
            while a <= BLOC_A_MAX + 1e-9 and extra < 4:
                c = conf(2, 0, need, bhex, round(a, 2))
                if c:
                    out.append(c)
                    extra += 1
                    a += 0.04  # crans suivants pour la verification
                else:
                    a += 0.02
            if any(c["niveau"] == 2 for c in out):
                break
            L = L - 0.02 if tone == "clair" else min(0.995, L + 0.008)
        # bloc sur toutes les lignes : dernier recours, aussi pour la verification (une ligne non bloquee
        # qui echoue sur capture recoit alors son bloc)
        if need != set(self.roles):
            a, extra = BLOC_A_MIN, 0
            bhex = next((c["bloc_hex"] for c in out if c["niveau"] == 2), rgb2hex(oklch_to_srgb(*T["bloc_lch"])))
            while a <= BLOC_A_MAX + 1e-9 and extra < 4:
                c = conf(2, 0, set(self.roles), bhex, round(a, 2))
                if c:
                    out.append(c)
                    extra += 1
                    a += 0.04
                else:
                    a += 0.02
        return out

    def choose(self):
        lad = {t: self.ladder(t) for t in ("clair", "fonce")}
        return choose_tone([self], {t: [lad[t]] for t in lad}) + (lad,)


def choose_tone(deciders, lads):
    """Regle 6, pour un plan ou une sequence (lads[ton] = une echelle par plan). Renvoie (ton, echelles)."""
    def first(t):
        return [l[0] if l else None for l in lads[t]]
    lv = {}
    for t in lads:
        f = first(t)
        lv[t] = 9 if any(c is None for c in f) else max(c["niveau"] for c in f)
    m = min(lv.values())
    if m == 9:
        return None, []
    cands = [t for t in lads if lv[t] == m]
    if len(cands) == 1:
        tone = cands[0]
    elif m == 0:
        tone = max(cands, key=lambda t: min(min(r["pire"] for r in c["res"].values()) for c in first(t)))
    elif m == 1:
        vc = max(c["voile_a"] for c in first("clair"))
        vf = max(c["voile_a"] for c in first("fonce"))
        tone = "clair" if vc <= vf + 0.15 + 1e-9 else "fonce"
    else:
        nb = {t: sum(len(c["blocs"]) for c in first(t)) for t in cands}
        k = min(nb.values())
        cands = [t for t in cands if nb[t] == k]
        zy = float(np.mean([d.zone_Y for d in deciders]))
        tone = cands[0] if len(cands) == 1 else ("clair" if zy < POLARITE else "fonce")
    return tone, lads[tone]


def minutage(duree, info):
    """Meme calcul que la timeline de template.html."""
    if info:
        ta = min(3.0, 2.3 + (duree - 5.0) * 0.6)
        return {"carte1_accroche": [0.0, round(ta + 0.4, 2)], "carte2_ligne_secondaire": [round(ta + 0.4, 2), round(duree - 0.1, 2)],
                "accroche_lisible_s": round(ta - 0.3, 2), "ligne_secondaire_lisible_s": round(duree - 0.5 - (ta + 0.7), 2),
                "sortie": [round(duree - 0.5, 2), round(duree - 0.1, 2)]}
    return {"carte1_accroche": [0.0, round(duree - 0.1, 2)], "accroche_lisible_s": round(duree - 0.8, 2),
            "sortie": [round(duree - 0.5, 2), round(duree - 0.1, 2)]}


def cfg_from(conf, acc, info_txt, info_on, top, geo, veil_hex, duree):
    key = (1 if "accroche" in conf["blocs"] else 0, 1 if "info" in conf["blocs"] else 0, info_on)
    lines = geo[key]["lines"]
    t0 = top + min(r["y"] for r in lines)
    t1 = top + max(r["y"] + r["h"] for r in lines)
    forme = "aucun"
    if conf["voile_a"] > 0:
        forme = "haut" if t0 < 800 else "bande"
    cfg = base_cfg(acc, info_txt, info_on, duree)
    cfg.update({"texte": conf["texte"], "secondaire": conf["secondaire"], "haut": int(top),
                "voile": {"couleur": veil_hex, "a": conf["voile_a"], "forme": forme, "debut": int(t0 - 48), "fin": int(t1 + 48)},
                "bloc": conf["bloc_hex"] or "#000000",
                "bloc_accroche": 1 if "accroche" in conf["blocs"] else 0,
                "bloc_info": 1 if "info" in conf["blocs"] else 0,
                "bloc_accroche_a": conf["bloc_a"] if "accroche" in conf["blocs"] else 0,
                "bloc_info_a": conf["bloc_a"] if "info" in conf["blocs"] else 0})
    return cfg


# ------------------------------------------------------------------ etape 8 : verification
def verify(plan, cfg, work, nom):
    """Capture chaque image (lettres transparentes ; voile, bloc, filet visibles) et mesure CHAQUE ligne
    deux fois : boite de la ligne, et pixels sous les lettres (masque des glyphes elargi de 4 px).
    On garde, image par image, le plus bas des deux."""
    rects = dump_rects(write_page(os.path.join(work, "%s-rects.html" % nom), cfg, rects=True))
    ink_png = shoot(write_page(os.path.join(work, "%s-encre.html" % nom), cfg, encre=True), os.path.join(work, "%s-encre.png" % nom))
    ink = np.asarray(Image.open(ink_png).convert("RGB"), np.int32)
    inkmask = (ink[..., 0] - ink[..., 1]) > 40
    jobs = []
    for i, f in enumerate(plan.files):
        p = write_page(os.path.join(work, "%s-mesure-%02d.html" % (nom, i)), cfg, plate=f, mesure=True)
        jobs.append((p, os.path.join(work, "%s-mesure-%02d.png" % (nom, i))))
    with cf.ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda j: shoot(*j), jobs))
    caps = [np.asarray(Image.open(png).convert("RGB"), np.float64) / 255 for _, png in jobs]
    out = {}
    for r in rects["lines"]:
        lid = r["id"]
        col = cfg["texte"] if r["role"] == "accroche" else cfg["secondaire"]
        Yt = float(lum(hex2rgb(col)))
        x0, y0, x1, y1 = [int(round(v)) for v in line_box(r)]
        m = np.zeros_like(inkmask)
        ox0, oy0, ox1, oy1 = [int(v) for v in line_box(r, content=False)]
        m[oy0:oy1, ox0:ox1] = inkmask[oy0:oy1, ox0:ox1]
        md = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
        per = []
        for a in caps:
            row = {}
            for meth, v in (("boite", lum(a[y0:y1, x0:x1].reshape(-1, 3))), ("lettres", lum(a[md]))):
                ym = float(v.mean())
                p10, p90 = np.percentile(v, [10, 90])
                row[meth] = {"moyenne": cr(Yt, ym), "pire": cr(Yt, p90 if Yt > ym else p10)}
            row["moyenne"] = min(row["boite"]["moyenne"], row["lettres"]["moyenne"])
            row["pire"] = min(row["boite"]["pire"], row["lettres"]["pire"])
            per.append(row)
        wi = int(np.argmin([p["pire"] for p in per]))
        mi = int(np.argmin([p["moyenne"] for p in per]))
        out[lid] = {"couleur": col, "moyenne": round(min(p["moyenne"] for p in per), 2),
                    "pire": round(min(p["pire"] for p in per), 2),
                    "boite": {"moyenne": round(min(p["boite"]["moyenne"] for p in per), 2),
                              "pire": round(min(p["boite"]["pire"] for p in per), 2)},
                    "lettres": {"moyenne": round(min(p["lettres"]["moyenne"] for p in per), 2),
                                "pire": round(min(p["lettres"]["pire"] for p in per), 2)},
                    "image_moyenne_min": os.path.basename(plan.files[mi]),
                    "image_pire": os.path.basename(plan.files[wi]),
                    "boite_px": [x0, y0, x1, y1]}
    for f in glob.glob(os.path.join(work, "%s-mesure-*" % nom)):
        os.remove(f)
    return out, rects


MODES = {0: "texte nu", 1: "voile", 2: "bloc"}


def prepare(src, acc, info_txt, info_on, avoid, top, duree, work):
    """Etapes 1 a 7 pour un plan. Renvoie un contexte, ou un dict {'aucun': raison} s'il n'y a pas de place."""
    duree = min(float(duree), DUREE_MAX)
    plan = Plan(src, avoid, work)
    geo = layouts(work, acc, info_txt)
    report = None
    if info_on and duree < DUREE_CARTE2:
        info_on = False
        report = "plan trop court (%.2f s < %.0f s)" % (duree, DUREE_CARTE2)
    refus_all = {}
    for info_try in ((1, 0) if info_on else (0,)):
        found, refus = place(plan, geo, info_try, top)
        refus_all[info_try] = refus
        for cost, t, safe in found[:8]:   # meilleure position d'abord ; la suivante si aucune variante ne passe
            d = Decider(plan, geo, t, info_try, safe)
            d.analyse()
            tone, lad, lads = d.choose()
            if lad:
                if info_on and not info_try:
                    report = "pas de place sûre pour la ligne secondaire"
                return {"plan": plan, "geo": geo, "top": t, "d": d, "tone": tone, "lad": lad[0], "lads": lads,
                        "info": info_try, "refus": refus, "report": report, "duree": duree, "src": src}
    return {"aucun": "Aucune zone sûre (visage/soleil/zone chargée sans place pour un bloc) pour l'accroche : "
                     "pas de texte sur ce plan.", "refus": refus_all, "plan": plan, "duree": duree, "src": src}


def finish(ctx, acc, info_txt, sortie, nom, instants=None, groupe=None):
    work = os.path.join(sortie, "travail")
    plan, geo, t, d, tone = ctx["plan"], ctx["geo"], ctx["top"], ctx["d"], ctx["tone"]
    info_flag, duree = ctx["info"], ctx["duree"]
    tried = []
    passed = None
    lad = ctx["lad"]
    i = 0
    while i < len(lad):
        conf = lad[i]
        cfg = cfg_from(conf, acc, info_txt, info_flag, t, geo, d.tones[tone]["voile"], duree)
        meas, rects = verify(plan, cfg, work, nom)
        failing = sorted({role_of(lid) for lid, m in meas.items() if not Decider.ok(m, role_of(lid) in conf["blocs"])})
        tried.append({"niveau": conf["niveau"], "voile_a": conf["voile_a"], "blocs": conf["blocs"], "bloc_a": conf["bloc_a"],
                      "ok": not failing, "lignes_en_echec": failing,
                      "moyenne_min": round(min(m["moyenne"] for m in meas.values()), 2),
                      "pire_min": round(min(m["pire"] for m in meas.values()), 2)})
        if not failing:
            passed = conf
            break
        # cran suivant utile : une ligne bloquee qui echoue -> bloc plus opaque ; une ligne non bloquee ->
        # voile plus fort, ou bloc sur cette ligne
        def helps(nx):
            for r in failing:
                if r in conf["blocs"]:
                    if not (r in nx["blocs"] and nx["bloc_a"] > conf["bloc_a"]):
                        return False
                elif not (r in nx["blocs"] or nx["voile_a"] > conf["voile_a"]):
                    return False
            return True
        i += 1
        while i < len(lad) and not helps(lad[i]):
            i += 1
    if passed is None:
        print("ATTENTION %s : aucune configuration ne passe la verification sur captures" % nom, flush=True)
    # captures des cartes
    tim = minutage(duree, info_flag)
    n = len(plan.files)
    times = [frame_time(f) if frame_time(f) is not None else i * 0.5 for i, f in enumerate(plan.files)]

    def nearest(tt):
        return int(np.argmin([abs(x - tt) for x in times]))
    i1 = nearest(1.5) if not instants else plan_index(plan, instants[0])
    caps = {}
    page = write_page(os.path.join(sortie, "%s.html" % nom), cfg, plate=plan.files[i1])
    p1 = write_page(os.path.join(sortie, "%s-carte1.html" % nom), cfg, plate=plan.files[i1], carte=1)
    caps["1"] = {"image": os.path.basename(plan.files[i1]), "t": times[i1], "png": shoot(p1, os.path.join(sortie, "%s.png" % nom))}
    if info_flag:
        a, b = tim["carte2_ligne_secondaire"]
        i2 = nearest((a + 0.3 + b - 0.4) / 2) if not instants or len(instants) < 2 else plan_index(plan, instants[1])
        p2 = write_page(os.path.join(sortie, "%s-carte2.html" % nom), cfg, plate=plan.files[i2], carte=2)
        caps["2"] = {"image": os.path.basename(plan.files[i2]), "t": times[i2],
                     "png": shoot(p2, os.path.join(sortie, "%s-carte2.png" % nom))}
    elif os.path.exists(os.path.join(sortie, "%s-carte2.png" % nom)):
        os.remove(os.path.join(sortie, "%s-carte2.png" % nom))
    conf = passed or conf
    lines = rects["lines"]
    mode = MODES[conf["niveau"]]
    if conf["niveau"] == 1:
        mode += " %.2f" % conf["voile_a"]
    if conf["niveau"] == 2:
        mode += " sur " + " + ".join({"accroche": "l'accroche", "info": "la ligne secondaire"}[r] for r in conf["blocs"])
    if not info_flag:
        mode += " (ligne secondaire au plan suivant : %s)" % (ctx["report"] or "désactivée")
    sans = {lid: d.evaluate((0, 0), lid, conf["texte"] if role_of(lid) == "accroche" else conf["secondaire"])
            for r in d.roles for lid in LIGNES[r]}
    result = {
        "plan": ctx["src"] if isinstance(ctx["src"], str) else os.path.dirname(ctx["src"][0]),
        "images": n, "images_nettoyees": plan.nettoyees, "duree_texte": duree, "minutage": tim, "cartes": caps,
        "capture": caps["1"]["png"], "page": page, "niveau": conf["niveau"], "mode": mode, "ton": tone,
        "texte_nom_site": d.tones[tone]["nom"], "groupe": groupe,
        "variables": css_vars(cfg), "attributs": attrs(cfg), "cfg": cfg,
        "contrastes": meas, "verification_ok": passed is not None,
        "contraste_moyen_min": round(min(m["moyenne"] for m in meas.values()), 2),
        "contraste_pire_min": round(min(m["pire"] for m in meas.values()), 2),
        "seuils": {"moyenne": SEUIL_MOY, "pire": TH_WORST, "pire_bloc": TH_WORST_BLOC},
        "sans_traitement": sans,
        "zone": {"haut": t, "bas_texte": round(max(r["y"] + r["h"] for r in lines), 1), "fond_moyen": d.zone_hex,
                 "Y_moyen": round(d.zone_Y, 3), "teinte": round(d.hue, 1), "teinte_foncee": round(d.dark_hue, 1),
                 "accent": d.accent_hex, "bords_moyens": d.busy, "bords_max": d.busy_max, "refus": ctx["refus"]},
        "prevision": {k: [{x: c[x] for x in ("niveau", "voile_a", "blocs", "bloc_a")} for c in v[:1]]
                      for k, v in ctx["lads"].items()},
        "verifications": tried,
        "boites_lignes": [[r["id"], round(r["x"]), round(r["y"]), round(r["x"] + r["w"]), round(r["y"] + r["h"])] for r in lines],
    }
    json.dump(result, open(os.path.join(sortie, "%s.json" % nom), "w"), ensure_ascii=False, indent=1)
    return result


def plan_index(plan, name):
    base = os.path.basename(name)
    for i, f in enumerate(plan.files):
        if os.path.basename(f).endswith(base):
            return i
    return len(plan.files) // 2


def no_text(ctx, sortie, nom):
    from shutil import copyfile
    png = os.path.join(sortie, "%s.png" % nom)
    plan = ctx["plan"]
    times = [frame_time(f) or 0 for f in plan.files]
    i1 = int(np.argmin([abs(x - 1.0) for x in times]))
    copyfile(plan.files[i1], png)
    for f in (os.path.join(sortie, "%s-carte2.png" % nom),):
        if os.path.exists(f):
            os.remove(f)
    r = {"mode": "aucun texte : " + ctx["aucun"], "ton": None, "duree_texte": ctx["duree"],
         "variables": {"--hy-texte": None, "--hy-secondaire": None}, "contrastes": {},
         "zone": {"haut": None, "bords_moyens": None, "bords_max": None, "refus": ctx["refus"]},
         "contraste_moyen_min": None, "contraste_pire_min": None, "capture": png,
         "cartes": {"1": {"image": os.path.basename(plan.files[i1]), "t": times[i1], "png": png}}, "niveau": None}
    json.dump(r, open(os.path.join(sortie, "%s.json" % nom), "w"), ensure_ascii=False, indent=1)
    return r


def run(src, acc, info_txt, info_on=True, avoid=(), top=None, instants=None, sortie=None, nom="plan", duree=DUREE_MAX):
    sortie = os.path.abspath(sortie or os.path.join(HERE, "sortie"))
    work = os.path.join(sortie, "travail", nom)
    os.makedirs(work, exist_ok=True)
    ctx = prepare(src, acc, info_txt, info_on, avoid, top, duree, work)
    if "aucun" in ctx:
        return no_text(ctx, sortie, nom)
    return finish(ctx, acc, info_txt, sortie, nom, instants)


def run_suite(items, acc, info_txt, sortie=None, groupe="suite"):
    """Plusieurs plans d'une meme sequence : une seule couleur de texte (et de ligne secondaire),
    teinte calculee sur tous les plans ensemble ; traitement (voile, bloc) choisi plan par plan.
    items : [{"src", "duree", "eviter", "nom", "info" (defaut True), "cartes"}]."""
    sortie = os.path.abspath(sortie or os.path.join(HERE, "sortie"))
    ctxs = []
    for it in items:
        work = os.path.join(sortie, "travail", it["nom"])
        os.makedirs(work, exist_ok=True)
        ctxs.append(prepare(it["src"], acc, info_txt, it.get("info", True), it.get("eviter", ()), it.get("haut"),
                            it["duree"], work))
    live = [c for c in ctxs if "aucun" not in c]
    if live:
        ds = [c["d"] for c in live]
        shared = tones_for(np.concatenate([d.zone for d in ds]), np.concatenate([d.allpx for d in ds]), [d.mid for d in ds])
        for d in ds:
            d.set_tones(shared)
        sec = None
        for _ in range(3):   # une seule secondaire pour la sequence : celle du plan le plus exigeant
            for d in ds:
                d.sec_force = sec
            lads = {t: [d.ladder(t) for d in ds] for t in ("clair", "fonce")}
            tone, per = choose_tone(ds, lads)
            if tone is None:
                break
            secs = [l[0]["secondaire"] for l in per]
            Lt = srgb_to_oklch(hex2rgb(shared["tones"][tone]["texte"]))[0]
            worst = min(secs, key=lambda s: abs(srgb_to_oklch(hex2rgb(s))[0] - Lt))
            if all(s == worst for s in secs):
                break
            sec = worst
        if tone is None:
            print("ATTENTION : pas de ton commun a la sequence, couleurs plan par plan", flush=True)
            for c in live:
                c["d"].analyse()
                c["d"].sec_force = None
                c["tone"], lad, c["lads"] = c["d"].choose()
                c["lad"] = lad[0]
        else:
            for c, l in zip(live, per):
                c["tone"], c["lad"] = tone, l
                c["lads"] = {t: lads[t][ds.index(c["d"])] for t in lads}
    out = {}
    for it, c in zip(items, ctxs):
        if "aucun" in c:
            out[it["nom"]] = no_text(c, sortie, it["nom"])
        else:
            out[it["nom"]] = finish(c, acc, info_txt, sortie, it["nom"], it.get("cartes"), groupe)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?")
    ap.add_argument("--duree", type=float, default=DUREE_MAX)
    ap.add_argument("--accroche", nargs=2, default=["Ce soir, tu dors", "sur l’eau."])
    ap.add_argument("--info", default="Nuit à bord · Port de Carnon")
    ap.add_argument("--sans-info", action="store_true")
    ap.add_argument("--eviter", nargs=4, type=int, action="append", default=[])
    ap.add_argument("--haut", type=int)
    ap.add_argument("--cartes", nargs="+")
    ap.add_argument("--suite")
    ap.add_argument("--sortie")
    ap.add_argument("--nom", default="plan")
    a = ap.parse_args()
    if a.suite:
        s = json.load(open(a.suite, encoding="utf-8"))
        info = s.get("info", a.info).replace(" · ", " · ")
        r = run_suite(s["plans"], s.get("accroche", a.accroche), info, a.sortie, s.get("groupe", "suite"))
    else:
        info = a.info.replace(" · ", " · ")
        r = run(a.src, a.accroche, info, not a.sans_info, a.eviter, a.haut, a.cartes, a.sortie, a.nom, a.duree)
    print(json.dumps(r, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()

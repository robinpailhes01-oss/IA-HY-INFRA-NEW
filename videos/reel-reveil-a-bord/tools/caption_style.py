"""Place et colore la légende fixe « waking up here » (centrée à mi-hauteur sur tout le reel, comme la référence).
Usage (depuis le projet) : python3 -I tools/caption_style.py layout.json

v3 (demande de Robin, 08/10/2026 : « on change la typo, enlève le petit fil blanc, une écriture ultra élégante avec un tout
petit effet d'ombre ») : MODE = 'ombre'. Cormorant Garamond Light Italic, encre claire teintée par les plans (jamais un blanc
neutre), ombre très légère dans l'encre foncée de la même teinte, sans bande ni voile. Le contraste n'est plus vérifié contre
le fond seul mais contre l'anneau de 1 à 4 px autour des lettres, ombre comprise (simulation image par image), et affiché par
plan : sur les draps blancs il reste en dessous du seuil du DESIGN §4, c'est le choix de Robin (lisible grâce à l'ombre).

Mode 'regle' (avant la v3) :
Règle DESIGN.md §4 : Instrument Serif, minuscules comme la référence, 60 px (minimum de lisibilité mobile), centrée,
interlettrage aéré comme la référence ; UNE couleur pour toute la vidéo, tirée des plans (teinte OKLCH, encre très foncée
ou très claire, paliers). Seuils vérifiés MOT PAR MOT et IMAGE PAR IMAGE (toutes les images) :
  - contraste avec le fond moyen du mot ≥ 4,5:1 sur toutes les images (≥ 4,75 sur 90 % : marge pour les traits fins) ;
  - contraste ≥ 3:1 sur les pixels les moins favorables (5e centile du fond sous le mot) sur toutes les images.
Si ça ne passe pas : déplacer la ligne (au plus près du milieu), puis voile très léger en dégradé depuis le haut,
puis petit bloc arrondi en tout dernier recours. Affiche le diagnostic par plan pour corriger le cadrage plutôt que le texte.
"""
import sys, json, subprocess
import numpy as np
from PIL import ImageFont

OUT = sys.argv[1]
POLARITY = sys.argv[2] if len(sys.argv) > 2 else 'clair'   # 'clair' : texte clair + ombre foncée (demande de Robin) ; 'foncé' : variante qui passe le contrôle
plan = json.load(open('plan.json'))
FPS, W, H, CUTS = plan['fps'], 1080, 1920, plan['cuts']
T = plan['caption']
MODE = 'ombre'
SIZE, LH, LS = 76, 1.5, 0.02          # 76 px : Cormorant a un petit œil, 76 px ≈ la taille visuelle de 60 px d'Instrument Serif
Y_PREF, RANGE = 957 - 57, 260          # référence : milieu de la ligne à y ≈ 957
FONT = 'assets/fonts/cormorant-garamond-latin-300-italic.woff2'
SHADOW_LAYERS = [(0, 1, 3, 0.60), (0, 0, 10, 0.20)]   # (décalage x, y, flou px, opacité) : une ombre serrée + un halo très léger
SITE_LIGHT = {'Écume': '#F5F8FA', 'Sable': '#EFE7D8', 'Pêche': '#F0C9A0'}
SITE_DARK = {'Encre océan': '#0C2B45', 'Encre': '#14314C', 'Océan profond': '#123A5C', 'Océan': '#1A4C74'}
DARK_LADDER = [0.27, 0.24, 0.21, 0.18, 0.15]
LIGHT_LADDER = [(0.97, 0.022), (0.985, 0.014), (0.995, 0.006)]


# ---------- couleur ----------
def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055) * 255

def rel_lum(rgb):
    lin = srgb_to_lin(rgb)
    return lin[..., 0] * 0.2126 + lin[..., 1] * 0.7152 + lin[..., 2] * 0.0722

def contrast(a, b):
    return (np.maximum(a, b) + 0.05) / (np.minimum(a, b) + 0.05)

def rgb_to_oklch(rgb):
    r, g, b = srgb_to_lin(rgb)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = np.cbrt([l, m, s])
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return float(L), float(np.hypot(a, bb)), float(np.degrees(np.arctan2(bb, a)) % 360)

def oklch_to_rgb(L, C, h):
    a, b = C * np.cos(np.radians(h)), C * np.sin(np.radians(h))
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return np.round(lin_to_srgb(np.array([r, g, bl])))

def hex2rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)

def rgb2hex(c):
    return '#%02X%02X%02X' % tuple(int(round(float(x))) for x in np.clip(c, 0, 255))

def oklab_dist(c1, c2):
    L1, C1, h1 = rgb_to_oklch(c1); L2, C2, h2 = rgb_to_oklch(c2)
    p1 = np.array([L1, C1 * np.cos(np.radians(h1)), C1 * np.sin(np.radians(h1))])
    p2 = np.array([L2, C2 * np.cos(np.radians(h2)), C2 * np.sin(np.radians(h2))])
    return float(np.linalg.norm(p1 - p2))

def snap(c, table):
    name, hx = min(table.items(), key=lambda kv: oklab_dist(c, hex2rgb(kv[1])))
    return (hex2rgb(hx), name) if oklab_dist(c, hex2rgb(hx)) < 0.015 else (c, None)

def candidates(h):
    dh = 350.0 if 20 <= h <= 110 else h      # orange/jaune assombri = brun : on prend un lie-de-vin
    dark = [snap(oklch_to_rgb(L, 0.065 * min(1, L / 0.27 + 0.2), dh), SITE_DARK) + (i,) for i, L in enumerate(DARK_LADDER)]
    light = [snap(oklch_to_rgb(L, C, h), SITE_LIGHT) + (i,) for i, (L, C) in enumerate(LIGHT_LADDER)]
    return {'foncé': dark, 'clair': light}


# ---------- géométrie de la ligne (mêmes règles que le CSS : centrée, interlettrage après chaque lettre) ----------
ft = ImageFont.truetype(FONT, SIZE)
asc, desc = ft.getmetrics()
lh = round(SIZE * LH)
text = T['texte']
ls_px = LS * SIZE
total = ft.getlength(text) + ls_px * len(text)
x0 = (W - total) / 2
base_off = (lh - (asc + desc)) / 2 + asc          # ligne de base, depuis le haut de la boîte de ligne
words, pos = [], 0
for w in text.split(' '):
    i = text.index(w, pos)
    wx = x0 + ft.getlength(text[:i]) + ls_px * i
    l, t_, r, b_ = ft.getbbox(w, anchor='ls')
    ww = r + ls_px * (len(w) - 1)
    words.append(dict(w=w, tx=wx, x0=int(wx + l) - 2, x1=int(wx + ww) + 2, ya=int(base_off + t_) - 2, yb=int(base_off + b_) + 2))
    pos = i + len(w)

# ---------- toutes les images, bande utile seulement ----------
Y0 = max(0, Y_PREF - RANGE - 10); Y1 = min(H, Y_PREF + RANGE + lh + 10)
lut = srgb_to_lin(np.arange(256)).astype(np.float32)
lum, rgbmean, shot_of = [], [], []
for k in range(len(CUTS) - 1):
    n = CUTS[k + 1] - CUTS[k]
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'assets/rushes/plan{k + 1:02d}.mp4', '-frames:v', str(n),
                          '-vf', f'crop={W}:{Y1 - Y0}:0:{Y0}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], check=True, capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, Y1 - Y0, W, 3)[:n]
    lum.append(0.2126 * lut[fr[..., 0]] + 0.7152 * lut[fr[..., 1]] + 0.0722 * lut[fr[..., 2]])
    rgbmean.append(fr)
    shot_of += [k + 1] * len(fr)
lum = np.concatenate(lum); frames = np.concatenate(rgbmean); shot_of = np.array(shot_of)


def word_stats(top):
    """Par mot et par image : luminance moyenne du fond, 5e et 95e centiles."""
    out = []
    for wd in words:
        ya, yb = top + wd['ya'] - Y0, top + wd['yb'] - Y0
        z = lum[:, ya:yb, wd['x0']:wd['x1']].reshape(len(lum), -1)
        out.append((z.mean(axis=1), np.percentile(z, 5, axis=1), np.percentile(z, 95, axis=1)))
    return out


def veiled(Lbg, veil_rgb, alpha, top):
    """Luminance après un voile en dégradé depuis le haut (plein jusqu'à 48 px sous la ligne) : mélange en RGB, fond gris équivalent."""
    if alpha <= 0:
        return Lbg
    srgb = np.where(Lbg <= 0.0031308, 12.92 * Lbg, 1.055 * np.clip(Lbg, 0, 1) ** (1 / 2.4) - 0.055) * 255
    vg = float(rel_lum(np.asarray(veil_rgb)) ** (1 / 2.2) * 255)
    mix = srgb * (1 - alpha) + vg * alpha
    return srgb_to_lin(mix)


def check(ink_L, polarity, stats, veil=None, alpha=0.0, top=0):
    res, ok, worst = [], True, 99.0
    for (m, p5, p95), wd in zip(stats, words):
        m2 = veiled(m, veil, alpha, top) if veil is not None else m
        weak = (p5 if polarity == 'foncé' else p95)
        weak = veiled(weak, veil, alpha, top) if veil is not None else weak
        cm, cw = contrast(ink_L, m2), contrast(ink_L, weak)
        good = cm.min() >= 4.5 and (cm >= 4.75).mean() >= 0.9 and cw.min() >= 3.0
        ok &= bool(good); worst = min(worst, float(cm.min()))
        res.append((wd['w'], float(cm.min()), float((cm >= 4.75).mean()), float(cw.min()), cm, cw))
    return ok, worst, res


def hue_at(top):
    ys, ye = top + min(w['ya'] for w in words) - Y0, top + max(w['yb'] for w in words) - Y0
    m = frames[:, ys:ye, words[0]['x0']:words[-1]['x1']].reshape(-1, 3).mean(axis=0)
    return rgb_to_oklch(m)[2]


def diagnose(ink, polarity, top, veil=None, alpha=0.0):
    _, _, res = check(float(rel_lum(ink)), polarity, word_stats(top), veil, alpha, top)
    for w, *_r, cm, cw in res:
        per = []
        for k in range(1, len(CUTS)):
            s = shot_of == k
            per.append(f'{k}:{cm[s].min():.1f}/{cw[s].min():.1f}')
        print(f'   « {w} » (moyen/pixels faibles, minimum par plan) ' + ' '.join(per))


def diagnose_shadow(ink, shadow, top):
    """Contraste encre / anneau de 1 à 4 px autour des lettres, ombre comprise, image par image (minimum par plan)."""
    from PIL import Image, ImageDraw, ImageFilter
    from scipy.ndimage import binary_dilation
    hh = Y1 - Y0
    res = {wd['w']: [] for wd in words}
    for wd in words:
        mask = Image.new('L', (W, hh), 0)
        ImageDraw.Draw(mask).text((wd['tx'], top + base_off - Y0), wd['w'], font=ft, fill=255, anchor='ls', features=None)
        m = np.array(mask) > 128
        wd['ring'] = binary_dilation(m, iterations=4) & ~binary_dilation(m, iterations=1)
        wd['mask'] = mask
    Li = float(rel_lum(ink))
    for f in range(len(frames)):
        im = Image.fromarray(frames[f]).convert('RGBA')
        for wd in words:
            for dx, dy, blur, a in SHADOW_LAYERS:
                sh = Image.new('RGBA', (W, hh), tuple(int(v) for v in shadow) + (0,))
                alpha = wd['mask'].transform(wd['mask'].size, Image.AFFINE, (1, 0, -dx, 0, 1, -dy)).filter(ImageFilter.GaussianBlur(blur / 2))
                sh.putalpha(alpha.point(lambda v, a=a: int(v * a)))
                im = Image.alpha_composite(im, sh)
        arr = np.asarray(im.convert('RGB')).astype(np.float64)
        for wd in words:
            Lr = rel_lum(arr[wd['ring']])
            res[wd['w']].append(float(contrast(Li, np.median(Lr))))
    for w, cs in res.items():
        cs = np.array(cs)
        print(f"   « {w} » contraste encre / anneau ombré (minimum par plan) " + ' '.join(f'{k}:{cs[shot_of == k].min():.1f}' for k in range(1, len(CUTS))))
    return min(min(v) for v in res.values())


tops = sorted(range(Y_PREF - RANGE, Y_PREF + RANGE + 1, 10), key=lambda y: (abs(y - Y_PREF), y))
chosen = None
if MODE == 'ombre':
    c = candidates(hue_at(Y_PREF))
    if POLARITY == 'clair':
        ink, shadow = c['clair'][0][0], c['foncé'][0][0]
    else:                    # texte foncé : petite ombre portée foncée et douce (effet « lettre imprimée »)
        ink, shadow = c['foncé'][0][0], c['foncé'][0][0]
        SHADOW_LAYERS[:] = [(0, 2, 5, 0.25)]
    print(f'diagnostic du choix (ombre, encre {POLARITY}) :')
    worst = diagnose_shadow(ink, shadow, Y_PREF)
    chosen = dict(top=Y_PREF, polarity=POLARITY, treatment='ombre', text_hex=rgb2hex(ink), shadow_hex=rgb2hex(shadow),
                  shadow_layers=SHADOW_LAYERS, contrast_ring_min=round(worst, 2))
for top in (tops if chosen is None else []):
    st = word_stats(top)
    c = candidates(hue_at(top))
    for pol in ('clair', 'foncé'):               # encre claire d'abord, comme le blanc de la référence
        for rgb, site, step in c[pol]:
            ok, worst, _ = check(float(rel_lum(rgb)), pol, st)
            if ok:
                chosen = dict(top=top, polarity=pol, treatment='nu', text_hex=rgb2hex(rgb), site_color=site, ladder_step=step,
                              contrast_word_min=round(worst, 2))
                break
        if chosen:
            break
    if chosen:
        break
if chosen is None:   # voile en dégradé depuis le haut, à la position préférée
    st = word_stats(Y_PREF); c = candidates(hue_at(Y_PREF)); best = None
    for pol, inks, veil, amax in (('clair', c['clair'], c['foncé'][0][0], 0.40), ('foncé', c['foncé'], c['clair'][0][0], 0.20)):
        for ink, _, step in inks:
            for alpha in np.arange(0.05, amax + 1e-9, 0.05):
                ok, worst, _ = check(float(rel_lum(ink)), pol, st, veil, float(alpha), Y_PREF)
                if ok:
                    cand = (alpha + 0.02 * step + (0.15 if pol == 'foncé' else 0), pol, ink, veil, round(float(alpha), 2), worst)
                    if best is None or cand[0] < best[0]:
                        best = cand
                    break
    if best:
        _, pol, ink, veil, alpha, worst = best
        chosen = dict(top=Y_PREF, polarity=pol, treatment='voile', text_hex=rgb2hex(ink), veil_hex=rgb2hex(veil), veil_alpha=alpha,
                      contrast_word_min=round(worst, 2))
if chosen is None:   # dernier recours : petit bloc arrondi, teinté par les plans, le plus transparent qui passe
    st = word_stats(Y_PREF); h = hue_at(Y_PREF); c = candidates(h)
    for pol, inks, blocks in (('foncé', c['foncé'], [(0.955, 0.03), (0.93, 0.04)]), ('clair', c['clair'], [(0.34, 0.06), (0.30, 0.05)])):
        for Lb, Cb in blocks:
            block = oklch_to_rgb(Lb, Cb, h)
            for alpha in np.arange(0.30, 0.95, 0.05):
                ok, worst, _ = check(float(rel_lum(inks[0][0])), pol, st, block, float(alpha), Y_PREF)
                if ok:
                    chosen = dict(top=Y_PREF, polarity=pol, treatment='bloc', text_hex=rgb2hex(inks[0][0]), block_hex=rgb2hex(block),
                                  block_alpha=round(float(alpha), 2), contrast_word_min=round(worst, 2))
                    break
            if chosen:
                break
        if chosen:
            break

print('choix :', chosen)
if chosen['treatment'] != 'ombre':
    print('diagnostic encre foncée de la règle, sans voile, à la position préférée :')
    diagnose(candidates(hue_at(Y_PREF))['foncé'][0][0], 'foncé', Y_PREF)
    print(f"diagnostic du choix ({chosen['treatment']}) :")
    fond = {'voile': ('veil_hex', 'veil_alpha'), 'bloc': ('block_hex', 'block_alpha')}.get(chosen['treatment'])
    diagnose(hex2rgb(chosen['text_hex']), chosen['polarity'], chosen['top'],
             hex2rgb(chosen[fond[0]]) if fond else None, chosen[fond[1]] if fond else 0.0)
rows = [dict(texte=text, italique=MODE == 'ombre', f0=T['f0'], y=0, hauteur_ligne=lh, largeur=round(total))]
out = dict(size=SIZE, line_height=LH, letter_spacing_em=LS, block_h=lh, rows=rows, f1=T['f1'], **chosen)
json.dump(out, open(OUT, 'w'), indent=1, ensure_ascii=False)

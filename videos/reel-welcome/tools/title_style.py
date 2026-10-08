"""Place et colore le titre « Welcome / to / Harmonie / Yacht » (un mot par plan, comme la référence).
Usage (depuis le projet) : python3 -I tools/title_style.py layout.json

Règle DESIGN.md : Instrument Serif (« to » en italique), casse de phrase, centré ; UNE couleur pour tout le titre,
tirée des 4 plans (teinte OKLCH, encre très foncée ou très claire, paliers) ; chaque mot ≥ 4,75:1 sur ≥ 90 % des images
où il est visible et ≥ 3:1 sur toutes ; voile en dégradé depuis le haut, puis petit bloc arrondi en tout dernier recours.
"""
import sys, json, subprocess
import numpy as np
from PIL import ImageFont

OUT = sys.argv[1]
plan = json.load(open('plan.json'))
FPS, W, H, CUTS = plan['fps'], 1080, 1920, plan['cuts']
SIZE, LH = 160, 1.1          # mots grands et espacés comme la référence (≈ 176 px d’une ligne à l’autre)
Y_PREF, Y_MIN = 440, 240        # 440 : « Harmonie » reste au-dessus du pare-brise et des têtes du groupe (plan 3, arceau à y ≈ 975)
STEP = 2
F = {False: 'assets/fonts/instrument-serif-latin-400-normal.woff2', True: 'assets/fonts/instrument-serif-latin-400-italic.woff2'}
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

def rel_lum_arr(rgb):
    lin = srgb_to_lin(rgb)
    return lin[..., 0] * 0.2126 + lin[..., 1] * 0.7152 + lin[..., 2] * 0.0722

def contrast(a, b):
    hi, lo = np.maximum(a, b), np.minimum(a, b)
    return (hi + 0.05) / (lo + 0.05)

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



def decode(n):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'assets/rushes/plan{n:02d}.mp4', '-frames:v', str(CUTS[n] - CUTS[n - 1]),
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)

T = plan['title']
f_end = T['f1']
# images globales (une sur deux) du début du 1er mot à la fin du titre
frames, gidx = [], []
for k in range(len(CUTS) - 1):
    a, b = max(T['words'][0]['f0'], CUTS[k]), min(f_end, CUTS[k + 1])
    if b > a:
        clip = decode(k + 1)
        for g in range(a, b, STEP):
            frames.append(clip[g - CUTS[k]]); gidx.append(g)
fr = np.stack(frames); gidx = np.array(gidx)
lut = srgb_to_lin(np.arange(256)).astype(np.float32)
lum_img = 0.2126 * lut[fr[..., 0]] + 0.7152 * lut[fr[..., 1]] + 0.0722 * lut[fr[..., 2]]

rows = []
lh = round(SIZE * LH)
for i, w in enumerate(T['words']):
    ft = ImageFont.truetype(F[bool(w.get('italique'))], SIZE)
    asc, desc = ft.getmetrics()
    tw = ft.getlength(w['texte'])
    x = (W - tw) / 2
    base = i * lh + (lh - (asc + desc)) / 2 + asc
    l, t_, r, b_ = ft.getbbox(w['texte'], anchor='ls')
    rows.append(dict(texte=w['texte'], italique=bool(w.get('italique')), f0=w['f0'], y=i * lh, hauteur_ligne=lh, largeur=round(tw),
                     box=(int(x + l) - 3, int(x + r) + 3, int(base + t_) - 2, int(base + min(b_, 0.05 * SIZE)) + 2)))
block_h = lh * len(rows)

def stats_at(top):
    w_rgb, vis = [], []
    for r in rows:
        x0, x1, ya, yb = r['box']
        w_rgb.append(fr[:, top + ya:top + yb, x0:x1].mean(axis=(1, 2), dtype=np.float64))
        vis.append(gidx >= r['f0'])
    w_rgb = np.stack(w_rgb, axis=1); vis = np.stack(vis, axis=1)       # n, mots(, 3)
    xs0 = min(r['box'][0] for r in rows); xs1 = max(r['box'][1] for r in rows)
    halo = lum_img[:, max(0, top - 100):min(H, top + block_h + 100), max(0, xs0 - 60):min(W, xs1 + 60)]
    mean_rgb = np.concatenate([w_rgb[vis[:, k], k] for k in range(len(rows))]).mean(axis=0)
    return w_rgb, vis, mean_rgb, float((halo > 0.95).mean())

def passes(txt_l, w_rgb, vis, veil=None, alpha=0.0):
    if veil is not None:
        w_rgb = w_rgb * (1 - alpha) + np.asarray(veil, dtype=np.float64) * alpha
    cw = contrast(txt_l, rel_lum_arr(w_rgb))
    ok, worst = True, 99.0
    for k in range(cw.shape[1]):
        c = cw[vis[:, k], k]
        worst = min(worst, float(c.min()))
        ok &= c.min() >= 3.0 and (c >= 4.75).mean() >= 0.9
    return bool(ok), worst

def hue_of(mean_rgb):
    return rgb_to_oklch(mean_rgb)[2]

def candidates(h):
    dh = 350.0 if 20 <= h <= 110 else h
    dark = [snap(oklch_to_rgb(L, 0.065 * min(1, L / 0.27 + 0.2), dh), SITE_DARK) + (i,) for i, L in enumerate(DARK_LADDER)]
    light = [snap(oklch_to_rgb(L, C, h), SITE_LIGHT) + (i,) for i, (L, C) in enumerate(LIGHT_LADDER)]
    return {'foncé': dark, 'clair': light}

chosen = None
for top in sorted(range(Y_MIN, 1500 - block_h + 1, 10), key=lambda y: (abs(y - Y_PREF), y)):
    w_rgb, vis, mean_rgb, glare = stats_at(top)
    if glare > 0.005:
        continue
    c = candidates(hue_of(mean_rgb))
    opts = []
    for pol in ('foncé', 'clair'):
        for rgb, site, step in c[pol]:
            ok, worst = passes(float(rel_lum_arr(rgb)), w_rgb, vis)
            if ok:
                opts.append((step, pol, rgb, site, worst)); break
    if opts:
        opts.sort(key=lambda o: (o[0], -o[4]))
        step, pol, rgb, site, worst = opts[0]
        chosen = dict(top=top, polarity=pol, treatment='nu', text_hex=rgb2hex(rgb), site_color=site, ladder_step=step, contrast_word_min=round(worst, 2))
        break
if chosen is None:   # voile en dégradé depuis le haut, à la position préférée
    w_rgb, vis, mean_rgb, _ = stats_at(Y_PREF)
    c = candidates(hue_of(mean_rgb)); best = None
    for pol, inks, veil, amax in (('clair', c['clair'], c['foncé'][0][0], 0.40), ('foncé', c['foncé'], c['clair'][0][0], 0.20)):
        for ink, _, step in inks:
            for alpha in np.arange(0.05, amax + 1e-9, 0.05):
                ok, worst = passes(float(rel_lum_arr(ink)), w_rgb, vis, veil=veil, alpha=float(alpha))
                if ok:
                    cand = (alpha + 0.02 * step + (0.15 if pol == 'foncé' else 0), pol, ink, veil, round(float(alpha), 2), worst)
                    if best is None or cand[0] < best[0]: best = cand
                    break
    if best:
        _, pol, ink, veil, alpha, worst = best
        chosen = dict(top=Y_PREF, polarity=pol, treatment='voile', text_hex=rgb2hex(ink), veil_hex=rgb2hex(veil), veil_alpha=alpha, contrast_word_min=round(worst, 2))
if chosen is None:   # dernier recours : petit bloc arrondi par mot, teinté par les plans
    w_rgb, vis, mean_rgb, _ = stats_at(Y_PREF)
    h = hue_of(mean_rgb); pol = 'clair' if float(rel_lum_arr(mean_rgb)) < 0.36 else 'foncé'
    txt = candidates(h)[pol][0][0]
    block = oklch_to_rgb(0.34 if pol == 'clair' else 0.955, min(rgb_to_oklch(mean_rgb)[1], 0.08), h)
    ok, worst = passes(float(rel_lum_arr(txt)), w_rgb, vis, veil=block, alpha=0.88)
    chosen = dict(top=Y_PREF, polarity=pol, treatment='bloc', text_hex=rgb2hex(txt), block_hex=rgb2hex(block), block_alpha=0.88, contrast_word_min=round(worst, 2))
out = dict(size=SIZE, line_height=LH, block_h=block_h, rows=[{k: v for k, v in r.items() if k != 'box'} for r in rows], f1=f_end, **chosen)
json.dump(out, open(OUT, 'w'), indent=1, ensure_ascii=False)
print({k: v for k, v in out.items() if k != 'rows'})

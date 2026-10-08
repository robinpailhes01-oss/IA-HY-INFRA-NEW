"""Place et colore chaque phrase (mise en page A du DESIGN.md) sur son plan.
Usage (depuis le projet) : python3 -I tools/text_style.py texts.json layout.json

- Mise en page A : ferré à gauche à x = 108 ; ligne 1 Instrument Serif romain, ligne 2 Instrument Serif italique ;
  signature : « Harmonie Yacht » (serif) + filet + « Port de Carnon » (Instrument Sans).
- Position : haut du bloc à y = 300 tant que ça passe, sinon la position qui passe la plus proche (entre 240 et 1500 − hauteur).
- Couleur : teinte du plan (OKLCH), encre très foncée ou très claire, jamais noir/blanc neutres ; on fonce/éclaircit par paliers
  avant de déplacer ; même polarité que la phrase précédente quand c'est possible ; bloc arrondi seulement en dernier recours.
- Contrôle mot par mot et image par image (15 i/s) : chaque mot ≥ 3:1 sur chaque image, chaque ligne ≥ 4,5:1 sur ≥ 90 % des images.
- Jamais sur le soleil (halo brûlé).
"""
import sys, json, subprocess
import numpy as np
from PIL import ImageFont

SRC, OUT = sys.argv[1], sys.argv[2]
texts = json.load(open(SRC))
plan = json.load(open('plan.json'))
FPS, W, H = plan['fps'], 1080, 1920
CUTS = plan['cuts']
X0 = 108
Y_PREF, Y_MIN = 300, 240
STEP = 2
F = {'serif': 'assets/fonts/instrument-serif-latin-400-normal.woff2', 'serif-i': 'assets/fonts/instrument-serif-latin-400-italic.woff2',
     'sans': 'assets/fonts/instrument-sans-latin-500-normal.woff2'}
SIZE = {'poeme': 100, 'sig-titre': 120, 'sig-info': 60}
LH = 1.06
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


# ---------- images ----------
_cache = {}
def decode(n):
    if n not in _cache:
        _cache.clear()
        k = n - 1
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'assets/rushes/plan{n:02d}.mp4', '-frames:v', str(CUTS[k + 1] - CUTS[k]),
                              '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], check=True, capture_output=True).stdout
        _cache[n] = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    return _cache[n]

def frames_for(f0, f1):
    out = []
    for k in range(len(CUTS) - 1):
        a, b = max(f0, CUTS[k]), min(f1, CUTS[k + 1])
        if b > a:
            clip = decode(k + 1)
            out += [clip[g - CUTS[k]] for g in range(a, b, STEP)]
    return np.stack(out)


def rows_of(t):
    """Lignes (texte, police, taille) et décalage vertical de chaque ligne dans le bloc."""
    if t['id'] == 'SIG':
        return [(t['ligne1'], 'serif', SIZE['sig-titre']), ('—filet—', None, 0), (t['ligne2'], 'sans', SIZE['sig-info'])]
    return [(t['ligne1'], 'serif', SIZE['poeme']), (t['ligne2'], 'serif-i', SIZE['poeme'])]

def layout_rows(rows):
    """Boîtes d'encre de chaque mot (x0, x1, y_haut, y_bas) relatives au haut du bloc ; hauteur totale."""
    words, y, out_rows = [], 0, []
    for txt, font, size in rows:
        if font is None:  # filet : 72 x 2 px, 36 px au-dessus et en dessous
            out_rows.append({'type': 'filet', 'y': y + 30}); y += 62; continue
        ft = ImageFont.truetype(F[font], size)
        lh = round(size * LH)
        asc, desc = ft.getmetrics()
        base = y + (lh - (asc + desc)) / 2 + asc  # comme le navigateur : demi-interlignage + ascendante
        tw = ft.getlength(txt)
        assert X0 + tw <= W - 108, f'« {txt} » dépasse la zone sûre ({tw:.0f} px)'
        pos = 0
        for wd in txt.split(' '):
            i = txt.index(wd, pos); pos = i + len(wd)
            l, t_, r, b_ = ft.getbbox(wd, anchor='ls')
            wx = X0 + ft.getlength(txt[:i])
            words.append((int(wx + l) - 3, int(wx + r) + 3, int(base + t_) - 2, int(base + min(b_, 0.05 * size)) + 2))
        out_rows.append({'type': 'texte', 'texte': txt, 'police': font, 'taille': size, 'y': y, 'hauteur_ligne': lh, 'largeur': round(tw)})
        y += lh
    return words, y, out_rows

prev_pol = None
res = {'x0': X0, 'line_height': LH, 'texts': []}
for t in texts:
    rows = rows_of(t)
    words, block_h, out_rows = layout_rows(rows)
    fr = frames_for(t['f0'], t['f1'])
    n = len(fr)
    lut = srgb_to_lin(np.arange(256)).astype(np.float32)
    lum_img = 0.2126 * lut[fr[..., 0]] + 0.7152 * lut[fr[..., 1]] + 0.0722 * lut[fr[..., 2]]
    x_right = max(w[1] for w in words)

    def stats_at(top):
        wl = []
        for x0, x1, ya, yb in words:
            rgb = fr[:, top + ya:top + yb, x0:x1].mean(axis=(1, 2), dtype=np.float64)
            wl.append(rgb)
        wl = np.stack(wl, axis=1)                                  # n, mots, 3 (RVB moyen sous chaque mot)
        line_rgb = fr[:, top:top + block_h, X0:x_right].mean(axis=(1, 2), dtype=np.float64)
        halo = lum_img[:, max(0, top - 100):min(H, top + block_h + 100), max(0, X0 - 60):min(W, x_right + 60)]
        return wl, rel_lum_arr(line_rgb), line_rgb.mean(axis=0), float((halo > 0.95).mean())

    def passes(txt_l, w_rgb, ll, veil=None, alpha=0.0):
        # le voile se mélange aux pixels en RVB (comme le navigateur), puis on calcule la luminance
        if veil is not None:
            w_rgb = w_rgb * (1 - alpha) + np.asarray(veil, dtype=np.float64) * alpha
        cw = contrast(txt_l, rel_lum_arr(w_rgb))                   # n, mots
        # DESIGN § 4 : chaque MOT ≥ 4,5:1 sur au moins 90 % des images, et ≥ 3:1 sur toutes
        # marge de 0,25 : au rendu, les traits fins (déliés, Instrument Sans 60 px) sortent un peu moins contrastés que prévu
        ok = cw.min() >= 3.0 and ((cw >= 4.75).mean(axis=0) >= 0.9).all()
        return ok, float(cw.min()), float(np.median(cw)), float(np.percentile(cw, 10))

    def hue_of(mean_rgb, top):
        L, C, h = rgb_to_oklch(mean_rgb)
        if C >= 0.03:
            return h
        px = fr[::max(1, n // 6), top:top + block_h:6, X0:x_right:6].reshape(-1, 3).astype(np.float64)
        hs = np.array([rgb_to_oklch(p) for p in px[::max(1, len(px) // 800)]])
        col = hs[hs[:, 1] > 0.04]
        if not len(col):
            return 245.0
        return float(np.degrees(np.arctan2(np.sin(np.radians(col[:, 2])).mean(), np.cos(np.radians(col[:, 2])).mean())) % 360)

    def candidates(h):
        dh = 350.0 if 20 <= h <= 110 else h
        dark = [snap(oklch_to_rgb(L, 0.065 * min(1, L / 0.27 + 0.2), dh), SITE_DARK) + (i,) for i, L in enumerate(DARK_LADDER)]
        light = [snap(oklch_to_rgb(L, C, h), SITE_LIGHT) + (i,) for i, (L, C) in enumerate(LIGHT_LADDER)]
        return {'foncé': dark, 'clair': light}

    chosen = None
    tops = sorted(range(Y_MIN, 1500 - block_h + 1, 10), key=lambda y: (abs(y - Y_PREF), y))
    for top in tops:
        wl, ll, mean_rgb, glare = stats_at(top)
        if glare > 0.005:
            continue
        h = hue_of(mean_rgb, top)
        order = [prev_pol, 'clair' if prev_pol == 'foncé' else 'foncé'] if prev_pol else ['foncé', 'clair']
        options = []
        for pol in order:
            for rgb, site_name, step in candidates(h)[pol]:
                ok, cmin, cmed, cp10 = passes(float(rel_lum_arr(rgb)), wl, ll)
                if ok:
                    options.append((step + (0.8 if pol != order[0] else 0), pol, rgb, site_name, step, cmin, cmed, cp10))
                    break
        if options:
            options.sort(key=lambda o: (o[0], -o[5]))
            _, pol, rgb, site_name, step, cmin, cmed, cp10 = options[0]
            chosen = dict(top=top, polarity=pol, treatment='nu', text_hex=rgb2hex(rgb), site_color=site_name, ladder_step=step, hue=round(h, 1),
                          contrast_word_min=round(cmin, 2), contrast_line_median=round(cmed, 2), contrast_line_p10=round(cp10, 2),
                          zone_mean_hex=rgb2hex(mean_rgb))
            break
    if chosen is None:  # avant le bloc : voile en dégradé depuis le haut du cadre (comme un filtre photo), à la position commune
        wl, ll, mean_rgb, _ = stats_at(Y_PREF)
        h = hue_of(mean_rgb, Y_PREF)
        c = candidates(h)
        best = None
        for pol, inks, veil, amax in (('clair', c['clair'], c['foncé'][0][0], 0.40), ('foncé', c['foncé'], c['clair'][0][0], 0.20)):
          for ink, _, step in inks:
            for alpha in np.arange(0.05, amax + 1e-9, 0.05):
                ok, cmin, cmed, cp10 = passes(float(rel_lum_arr(ink)), wl, ll, veil=veil, alpha=float(alpha))
                if ok:
                    cand = (alpha + 0.02 * step + (0.15 if pol == 'foncé' else 0), pol, ink, veil, round(float(alpha), 2), cmin, cmed, cp10)
                    if best is None or cand[0] < best[0]:
                        best = cand
                    break
        if best:
            _, pol, ink, veil, alpha, cmin, cmed, cp10 = best
            chosen = dict(top=Y_PREF, polarity=pol, treatment='voile', text_hex=rgb2hex(ink), veil_hex=rgb2hex(veil), veil_alpha=alpha,
                          hue=round(h, 1), contrast_word_min=round(cmin, 2), contrast_line_median=round(cmed, 2), contrast_line_p10=round(cp10, 2),
                          zone_mean_hex=rgb2hex(mean_rgb))
    if chosen is None:  # dernier recours : bloc arrondi par ligne, teinté par le plan
        wl, ll, mean_rgb, _ = stats_at(Y_PREF)
        h = hue_of(mean_rgb, Y_PREF)
        pol = 'clair' if float(rel_lum_arr(mean_rgb)) < 0.36 else 'foncé'
        txt = candidates(h)[pol][0][0]
        block = oklch_to_rgb(0.34 if pol == 'clair' else 0.955, min(rgb_to_oklch(mean_rgb)[1], 0.08), h)
        alpha = 0.88
        cmin = float(contrast(float(rel_lum_arr(txt)), rel_lum_arr(wl * (1 - alpha) + block * alpha)).min())
        chosen = dict(top=Y_PREF, polarity=pol, treatment='bloc', text_hex=rgb2hex(txt), block_hex=rgb2hex(block), block_alpha=alpha,
                      hue=round(h, 1), contrast_word_min=round(cmin, 2), zone_mean_hex=rgb2hex(mean_rgb))
    prev_pol = chosen['polarity']
    entry = dict(id=t['id'], f0=t['f0'], f1=t['f1'], rows=out_rows, block_h=block_h, **chosen)
    res['texts'].append(entry)
    print(f"{t['id']:3s} haut={entry['top']:4d} {entry['polarity']:5s} {entry['treatment']:4s} {entry['text_hex']} palier={entry.get('ladder_step', '-')} "
          f"mot_min={entry['contrast_word_min']} ligne_méd={entry.get('contrast_line_median', '-')} | {t['ligne1']} / {t['ligne2']}", flush=True)

json.dump(res, open(OUT, 'w'), indent=1, ensure_ascii=False)

"""Place et colore chaque ligne de paroles selon la règle DESIGN (système A + bloc C en dernier recours).

Usage : python3 -I tools/lyrics_style.py <dossier_clips> <police.woff2> <sortie.json>

Règle appliquée (v3, après relecture du brouillon) :
- temps exacts en images (30 i/s), repris du reel de référence ;
- position commune (y = 400) tant qu'elle passe ; sinon la plus proche qui passe ;
- couleur = teinte du plan (OKLCH), version très foncée ou très claire, jamais noir/blanc neutres ;
  on fonce / éclaircit l'encre par paliers avant de bouger la ligne ;
- contrôle MOT PAR MOT et IMAGE PAR IMAGE (15 i/s) : chaque mot ≥ 3:1 sur chaque image,
  la ligne ≥ 4,5:1 sur au moins 90 % des images ; jamais sur le soleil ;
- pas de voile en ovale (il se voit comme une tache) ; bloc arrondi façon C seulement si rien ne passe ;
- on garde la même polarité (clair/foncé) que la ligne précédente quand c'est possible.
"""
import sys, json, subprocess
import numpy as np
from PIL import ImageFont

CLIPS, FONT, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
FPS, W, H = 30, 1080, 1920
SIZE, LH = 72, 1.3
Y_PREF, Y_MIN, Y_MAX = 400, 250, 1380     # centre de ligne ; encre au-dessus de 192 px et bien au-dessus de y = 1500
INK_UP, INK_DOWN = 34, 30                  # zone d'encre autour du centre (corps + ascendantes) à 72 px
CUTS = [0, 103, 181, 241, 286, 332, 409, 538, 613, 722, 817]
LINES = [  # id, texte, image de début (incluse), image de fin (exclue) — calées sur le reel de référence
    ('l1', 'oh, life', 0, 103),
    ('l2', 'it’s bigger', 104, 181),
    ('l3', 'it’s bigger than you', 181, 241),
    ('l4', 'and you are not me', 242, 332),
    ('l5', 'the lengths that I will go to', 334, 409),
    ('l6', 'the distance in your eyes', 439, 538),
    ('l7', 'oh, no, I’ve said too much', 613, 722),
    ('l8', 'I haven’t said enough', 751, 817),
]
SITE_LIGHT = {'Écume': '#F5F8FA', 'Sable': '#EFE7D8', 'Pêche': '#F0C9A0'}
SITE_DARK = {'Encre océan': '#0C2B45', 'Encre': '#14314C', 'Océan profond': '#123A5C', 'Océan': '#1A4C74'}
DARK_LADDER = [0.27, 0.24, 0.21, 0.18, 0.15]   # on fonce l encre avant de déplacer la ligne
LIGHT_LADDER = [(0.97, 0.022), (0.985, 0.014), (0.995, 0.006)]
STEP = 2  # une image sur deux


# ---------- couleur ----------
def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055) * 255

def rel_lum_arr(rgb):  # (..., 3) -> (...)
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
def decode(clip, n_frames):
    """Toutes les images du segment (uint8, n,H,W,3)."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', clip, '-frames:v', str(n_frames), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)

def frames_for(f0, f1):
    """Images globales f0..f1 (pas STEP), décodées depuis le bon segment."""
    out = []
    for k in range(10):
        a, b = max(f0, CUTS[k]), min(f1, CUTS[k + 1])
        if b <= a:
            continue
        clip = decode(f'{CLIPS}/plan{k + 1:02d}.mp4', CUTS[k + 1] - CUTS[k])
        out += [clip[g - CUTS[k]] for g in range(a, b, STEP)]
    return np.stack(out)

font = ImageFont.truetype(FONT, SIZE)
res = {'font_size': SIZE, 'line_height': LH, 'fps': FPS, 'cuts': CUTS, 'y_pref': Y_PREF, 'lines': []}
prev_pol = None
for lid, text, f0, f1 in LINES:
    tw = font.getlength(text)
    x0 = (W - tw) / 2
    words, pos = [], 0
    for wd in text.split(' '):
        i = text.index(wd, pos); pos = i + len(wd)
        l, _, r, _ = font.getbbox(wd)
        wx = x0 + font.getlength(text[:i])
        words.append((int(wx + l) - 4, int(wx + r) + 4))
    assert x0 >= 108 and x0 + tw <= 972, f'« {text} » sort de la zone sûre'
    fr = frames_for(f0, f1)  # uint8
    n = len(fr)
    lut = srgb_to_lin(np.arange(256)).astype(np.float32)
    lum_img = 0.2126 * lut[fr[..., 0]] + 0.7152 * lut[fr[..., 1]] + 0.0722 * lut[fr[..., 2]]  # n,H,W (float32)

    def stats_at(yc):
        ya, yb = yc - INK_UP, yc + INK_DOWN
        word_rgb = np.stack([fr[:, ya:yb, a:b].mean(axis=(1, 2), dtype=np.float64) for a, b in words], axis=1)  # n, mots, 3
        line_rgb = fr[:, ya:yb, words[0][0]:words[-1][1]].mean(axis=(1, 2), dtype=np.float64)                    # n, 3
        halo = lum_img[:, max(0, ya - 120):yb + 120, int(x0) - 60:int(x0 + tw) + 60]
        glare = float((halo > 0.95).mean())
        return rel_lum_arr(word_rgb), rel_lum_arr(line_rgb), line_rgb.mean(axis=0), glare

    def passes(txt_l, wl, ll):
        cw = contrast(txt_l, wl)        # n, mots
        cl = contrast(txt_l, ll)        # n
        return cw.min() >= 3.0 and (cl >= 4.5).mean() >= 0.9, float(cw.min()), float(np.median(cl)), float(np.percentile(cl, 10))

    def hue_of(mean_rgb, yc):
        L, C, h = rgb_to_oklch(mean_rgb)
        if C >= 0.03:
            return h
        ya, yb = yc - INK_UP, yc + INK_DOWN
        px = fr[::max(1, n // 6), ya:yb:4, words[0][0]:words[-1][1]:4].reshape(-1, 3).astype(np.float64)
        hs = np.array([rgb_to_oklch(p) for p in px[::max(1, len(px) // 800)]])
        col = hs[hs[:, 1] > 0.04]
        if not len(col):
            return 245.0
        return float(np.degrees(np.arctan2(np.sin(np.radians(col[:, 2])).mean(), np.cos(np.radians(col[:, 2])).mean())) % 360)

    def candidates(h):
        dh = 350.0 if 20 <= h <= 110 else h   # orange/jaune assombri vire au brun : lie-de-vin
        dark = [snap(oklch_to_rgb(L, 0.065 * min(1, L / 0.27 + 0.2), dh), SITE_DARK) + (i,) for i, L in enumerate(DARK_LADDER)]
        light = [snap(oklch_to_rgb(L, C, h), SITE_LIGHT) + (i,) for i, (L, C) in enumerate(LIGHT_LADDER)]
        return {'foncé': dark, 'clair': light}

    chosen = None
    ys = sorted(range(Y_MIN, Y_MAX + 1, 10), key=lambda y: (abs(y - Y_PREF), y))
    for yc in ys:
        wl, ll, mean_rgb, glare = stats_at(yc)
        if glare > 0.005:
            continue
        h = hue_of(mean_rgb, yc)
        cands = candidates(h)
        order = [prev_pol, 'clair' if prev_pol == 'foncé' else 'foncé'] if prev_pol else ['foncé', 'clair']
        options = []
        for pol in order:
            for rgb, site_name, step in cands[pol]:
                ok, cmin, cmed, cp10 = passes(float(rel_lum_arr(rgb)), wl, ll)
                if ok:
                    options.append((step + (0.8 if pol != order[0] else 0), pol, rgb, site_name, step, cmin, cmed, cp10))
                    break
        if options:
            options.sort(key=lambda o: (o[0], -o[5]))
            _, pol, rgb, site_name, step, cmin, cmed, cp10 = options[0]
            chosen = dict(y_center=yc, polarity=pol, treatment='nu', text_hex=rgb2hex(rgb), site_color=site_name, ladder_step=step,
                          hue=round(h, 1), contrast_word_min=round(cmin, 2), contrast_line_median=round(cmed, 2),
                          contrast_line_p10=round(cp10, 2), zone_mean_hex=rgb2hex(mean_rgb))
            break
    if chosen is None:  # dernier recours : bloc arrondi teinté par le plan (façon C), à la position commune
        wl, ll, mean_rgb, _ = stats_at(Y_PREF)
        h = hue_of(mean_rgb, Y_PREF)
        mean_l = float(rel_lum_arr(mean_rgb))
        pol = 'clair' if mean_l < 0.36 else 'foncé'
        txt = candidates(h)[pol][0][0]
        block = oklch_to_rgb(0.34 if pol == 'clair' else 0.955, min(rgb_to_oklch(mean_rgb)[1], 0.08), h)
        alpha = 0.88
        bl = rel_lum_arr(block[None, :])[0]
        cmin = float(contrast(float(rel_lum_arr(txt)), wl * (1 - alpha) + bl * alpha).min())
        chosen = dict(y_center=Y_PREF, polarity=pol, treatment='bloc', text_hex=rgb2hex(txt), block_hex=rgb2hex(block), block_alpha=alpha,
                      hue=round(h, 1), contrast_word_min=round(cmin, 2), zone_mean_hex=rgb2hex(mean_rgb))
    prev_pol = chosen['polarity']
    res['lines'].append(dict(id=lid, text=text, f0=f0, f1=f1, text_w=round(tw, 1), **chosen))
    c = res['lines'][-1]
    print(f"{lid} y={c['y_center']:4d} {c['polarity']:5s} {c['treatment']:4s} {c['text_hex']} palier={c.get('ladder_step', '-')} "
          f"mot_min={c['contrast_word_min']} ligne_méd={c.get('contrast_line_median', '-')} p10={c.get('contrast_line_p10', '-')} « {text} »", flush=True)

json.dump(res, open(OUT, 'w'), indent=1, ensure_ascii=False)

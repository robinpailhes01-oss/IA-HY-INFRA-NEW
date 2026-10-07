"""Place et colore chaque ligne de paroles selon la règle DESIGN (A + bloc C si besoin).
Usage : python3 -I lyrics_style.py <dossier_clips> <police.woff2> <sortie.json>
"""
import sys, json, subprocess, tempfile, os
import numpy as np
from PIL import Image, ImageFont, ImageFilter

CLIPS, FONT, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
W, H, SIZE, LH = 1080, 1920, 66, 1.3
PAD_X, PAD_Y = 36, 18
SAFE_L, SAFE_R = 108, 972
Y_MIN, Y_MAX = 400, 1380          # centre de ligne : sous l'UI du haut (marge 192 + air), au-dessus de y=1500
SITE_LIGHT = {'Écume': '#F5F8FA', 'Sable': '#EFE7D8', 'Pêche': '#F0C9A0'}
SITE_DARK = {'Encre océan': '#0C2B45', 'Encre': '#14314C', 'Océan profond': '#123A5C', 'Océan': '#1A4C74'}

# plan : (début global, fin globale)
SLOTS = {1: (0.0, 3.4333), 2: (3.4333, 6.0333), 3: (6.0333, 8.0333), 4: (8.0333, 9.5333), 5: (9.5333, 11.0667),
         6: (11.0667, 13.6333), 7: (13.6333, 17.9333), 8: (17.9333, 20.4333), 9: (20.4333, 24.0667), 10: (24.0667, 27.2333)}
LINES = [
    ('l1', 'oh, life', 0.0, 3.4333),
    ('l2', 'it’s bigger', 3.4333, 6.0333),
    ('l3', 'it’s bigger than you', 6.0333, 8.0333),
    ('l4', 'and you are not me', 8.0333, 11.0667),
    ('l5', 'the lengths that I will go to', 11.0667, 13.6333),
    ('l6', 'the distance in your eyes', 14.6333, 17.9333),
    ('l7', 'oh, no, I’ve said too much', 20.4333, 24.0667),
    ('l8', 'I haven’t said enough', 24.9667, 27.2333),
]

# ---------- couleur ----------
def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055) * 255

def rel_lum(rgb):
    r, g, b = srgb_to_lin(rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(l1, l2):
    hi, lo = max(l1, l2), min(l1, l2)
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
    return L, float(np.hypot(a, bb)), float(np.degrees(np.arctan2(bb, a)) % 360)

def oklch_to_rgb(L, C, h):
    a, b = C * np.cos(np.radians(h)), C * np.sin(np.radians(h))
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return lin_to_srgb(np.array([r, g, bl]))

def hex2rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)

def rgb2hex(c):
    return '#%02X%02X%02X' % tuple(int(round(float(x))) for x in np.clip(c, 0, 255))

def oklab_dist(c1, c2):
    L1, C1, h1 = rgb_to_oklch(c1); L2, C2, h2 = rgb_to_oklch(c2)
    a1, b1 = C1 * np.cos(np.radians(h1)), C1 * np.sin(np.radians(h1))
    a2, b2 = C2 * np.cos(np.radians(h2)), C2 * np.sin(np.radians(h2))
    return float(np.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2))

def snap(c, table):
    best = min(table.items(), key=lambda kv: oklab_dist(c, hex2rgb(kv[1])))
    return (hex2rgb(best[1]), best[0]) if oklab_dist(c, hex2rgb(best[1])) < 0.015 else (c, None)  # seuil serré : garder la nuance du plan

# ---------- images ----------
def grab(clip, times):
    tmp = tempfile.mkdtemp()
    out = []
    for i, t in enumerate(times):
        f = f'{tmp}/{i}.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', clip, '-frames:v', '1', f], check=True)
        out.append(np.asarray(Image.open(f).convert('RGB')).astype(np.float64))
    return out

font = ImageFont.truetype(FONT, SIZE)
res = {'font_size': SIZE, 'line_height': LH, 'lines': []}
for lid, text, t0, t1 in LINES:
    x0b, _, x1b, _ = font.getbbox(text)
    tw = x1b - x0b
    box_w = tw + 2 * PAD_X
    box_h = int(SIZE * LH) + 2 * PAD_Y
    bx0 = int((W - box_w) / 2)
    assert bx0 + PAD_X >= SAFE_L and bx0 + box_w - PAD_X <= SAFE_R, f'{text} trop large ({tw}px)'
    # images : toutes les 0,2 s pendant l'affichage, sur chaque plan traversé
    frames = []
    for n, (s0, s1) in SLOTS.items():
        a, b = max(t0, s0), min(t1, s1)
        if b - a <= 0.01:
            continue
        ts = np.arange(a + 0.05, b - 0.02, 0.2) - s0
        frames += grab(os.path.join(CLIPS, f'plan{n:02d}.mp4'), ts)
    stack = np.stack(frames)
    gray = stack.mean(axis=3)
    # carte de « bruit » : bords sur image floutée (ignore le grain), pour le placement
    edges = []
    for g in gray:
        gi = Image.fromarray(g.astype(np.uint8)).resize((W // 4, H // 4)).filter(ImageFilter.GaussianBlur(1.2))
        a = np.asarray(gi).astype(np.float64)
        e = np.zeros_like(a); e[:-1] += np.abs(np.diff(a, axis=0)); e[:, :-1] += np.abs(np.diff(a, axis=1))
        edges.append(np.asarray(Image.fromarray(e.astype(np.float32)).resize((W, H))))
    edges = np.stack(edges)
    costs = []
    for yc in range(Y_MIN, Y_MAX + 1, 10):
        y0, y1 = yc - box_h // 2, yc + box_h // 2
        reg = stack[:, y0:y1, bx0:bx0 + box_w]
        lum = reg.mean(axis=3)
        e = edges[:, y0:y1, bx0:bx0 + box_w].mean()
        spread = np.percentile(lum, 90) - np.percentile(lum, 10)
        sun = (lum > 245).mean()
        # halo : zone élargie (soleil juste à côté = éblouissement)
        halo = stack[:, max(0, y0 - 120):min(H, y1 + 120), :].mean(axis=3)
        glare = (halo > 250).mean()
        costs.append((yc, 4.0 * e + 0.25 * spread + 400 * sun + 120 * glare))
    res['lines'].append({'id': lid, 'text': text, 't0': t0, 't1': t1, 'text_w': tw, 'box': [bx0, box_w, box_h],
                         'costs': costs, '_stack': stack})

# position commune (paroles au même endroit) sauf si une ligne y souffre trop
ys = [c[0] for c in res['lines'][0]['costs']]
norm = []
for ln in res['lines']:
    cs = np.array([c[1] for c in ln['costs']])
    norm.append((cs - cs.min()) / (cs.max() - cs.min() + 1e-9))
total = np.sum(norm, axis=0) + 0.002 * np.abs(np.array(ys) - 760) / 10   # léger penchant pour le tiers supérieur-centre
y_common = ys[int(np.argmin(total))]
res['y_common'] = y_common

for ln, nc in zip(res['lines'], norm):
    i_common = ys.index(y_common)
    i_best = int(np.argmin(nc))
    yc = y_common if nc[i_common] <= 0.35 else ys[i_best]
    ln['y_center'] = yc
    ln['moved'] = yc != y_common
    bx0, box_w, box_h = ln['box']
    y0, y1 = yc - box_h // 2, yc + box_h // 2
    reg = ln['_stack'][:, y0:y1, bx0:bx0 + box_w].reshape(-1, 3)
    mean_rgb = reg.mean(axis=0)
    lums = rel_lum(reg.T)
    p10, p50, p90 = np.percentile(lums, [10, 50, 90])
    mean_l = float(rel_lum(mean_rgb))
    L, C, h = rgb_to_oklch(mean_rgb)
    if C < 0.03:  # zone presque neutre : teinte la plus saturée des pixels colorés
        hs = np.array([rgb_to_oklch(px) for px in reg[::max(1, len(reg) // 3000)]])
        col = hs[hs[:, 1] > 0.04]
        h = float(np.degrees(np.arctan2(np.sin(np.radians(col[:, 2])).mean(), np.cos(np.radians(col[:, 2])).mean())) % 360) if len(col) else 245.0
    light, ln_l = snap(oklch_to_rgb(0.97, 0.022, h), SITE_LIGHT)
    dark_h = h if not (20 <= h <= 110) else 350.0   # orange/jaune assombri vire au brun : on passe au lie-de-vin
    dark, ln_d = snap(oklch_to_rgb(0.27, 0.065, dark_h), SITE_DARK)

    def evaluate(txt, veil_rgb, alpha):
        bg_mean = mean_rgb * (1 - alpha) + veil_rgb * alpha
        lt = float(rel_lum(txt))
        # pire cas : pixels du fond les moins favorables
        worst_bg = p90 if lt > mean_l else p10
        worst_rgb_l = worst_bg * (1 - alpha) + float(rel_lum(veil_rgb)) * alpha  # approx en luminance
        return contrast(lt, float(rel_lum(bg_mean))), contrast(lt, worst_rgb_l)

    options = []
    for name, txt, veil in (('clair', light, dark), ('foncé', dark, light)):
        for alpha in np.arange(0, 0.4501, 0.05):
            cm, cw = evaluate(txt, veil, alpha)
            if cm >= 4.5 and cw >= 3.0:
                options.append((alpha + (0.15 if name == 'foncé' and alpha > 0 else 0), name, txt, veil, round(alpha, 2), cm, cw))
                break
    if options:
        options.sort(key=lambda o: (o[0], -o[6]))
        _, mode, txt, veil, alpha, cm, cw = options[0]
        treatment = 'nu' if alpha == 0 else 'voile'
    else:  # bloc discret façon C
        mode = 'clair' if mean_l < 0.36 else 'foncé'
        txt = light if mode == 'clair' else dark
        Lb, Cb, hb = rgb_to_oklch(mean_rgb)
        veil = oklch_to_rgb(0.34 if mode == 'clair' else 0.955, min(Cb, 0.08), h)
        alpha = 0.88
        cm, cw = evaluate(txt, veil, alpha)
        treatment = 'bloc'
    ln.update({'mode': mode, 'treatment': treatment, 'text_hex': rgb2hex(txt), 'veil_hex': rgb2hex(veil), 'alpha': float(alpha),
               'contrast_mean': round(cm, 2), 'contrast_worst': round(cw, 2), 'hue': round(h, 1),
               'zone_mean_hex': rgb2hex(mean_rgb), 'zone_lum': [round(float(p10), 3), round(mean_l, 3), round(float(p90), 3)]})

for ln in res['lines']:
    ln.pop('_stack'); ln['costs'] = [c for c in ln['costs'] if c[0] % 50 == 0]
json.dump(res, open(OUT, 'w'), indent=1, ensure_ascii=False)
print('y commun', res['y_common'])
for ln in res['lines']:
    print(f"{ln['id']} y={ln['y_center']}{'*' if ln['moved'] else ' '} {ln['mode']:5s} {ln['treatment']:5s} txt={ln['text_hex']} voile={ln['veil_hex']}@{ln['alpha']} "
          f"C={ln['contrast_mean']}/{ln['contrast_worst']} zone={ln['zone_mean_hex']} {ln['zone_lum']} w={ln['text_w']}  « {ln['text']} »")

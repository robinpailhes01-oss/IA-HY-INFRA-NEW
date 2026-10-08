"""Génère index.html du reel « Welcome to Harmonie Yacht » à partir de plan.json et layout.json.
Usage (depuis le projet) : python3 -I tools/build_index.py layout.json index.html

Copie du reel de référence (Casa Santapietra), mesuré image par image :
- titre mot par mot, un mot par plan (« Welcome » à 0,2 s puis chaque mot sur sa coupe), coupé net à 2,73 s ;
- petit logo Instagram en haut à droite (apparaît avec « Welcome », disparaît à l'écran final) ;
- écran final à 9,17 s : image assombrie d'un coup, logo Instagram centré qui grossit un instant (9,2 → 9,5 s),
  compte sous le logo à 9,37 s, logo blanc qui passe aux couleurs d'Instagram (9,6 → 10 s) puis redevient blanc (11,7 → 12,1 s).
Temps en numéros d'image (30 i/s). Plans vidéo : chevauchement d'une demi-image (le suivant, plus bas dans le DOM, passe dessus).
"""
import sys, json, math

LAYOUT, OUT = sys.argv[1], sys.argv[2]
plan = json.load(open('plan.json'))
lay = json.load(open(LAYOUT))
FPS, CUTS, TOTAL = plan['fps'], plan['cuts'], plan['total_frames']
HALF = 0.5 / FPS
AUDIO = 11.376                       # durée de la musique de la référence (elle s'arrête avant l'image)
DARK = plan['end_card']['f0']
HANDLE = plan['end_card']['handle']
T = lay
F_TITLE0, F_TITLE1 = T['rows'][0]['f0'], T['f1']


def t(x):
    return f'{math.floor(x * 1e6) / 1e6:.6f}'


def s(f):           # instant d'un texte qui apparaît à l'image f (une demi-image avant, pour tomber pile)
    return f / FPS - HALF if f > 0 else 0.0


def rgba(hex_, a):
    h = hex_.lstrip('#')
    return f'rgba({int(h[0:2], 16)}, {int(h[2:4], 16)}, {int(h[4:6], 16)}, {a:.2f})'


def ig(id_):
    return (f'<defs><linearGradient id="{id_}" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">'
            '<stop offset="0" stop-color="#FEDA75"/><stop offset="0.25" stop-color="#FA7E1E"/><stop offset="0.5" stop-color="#D62976"/>'
            '<stop offset="0.75" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs>')


def glyph(stroke, defs=''):
    # logo Instagram (contour) : carré arrondi, objectif, point du flash
    return (f'<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="{stroke}" stroke-width="1.9">{defs}'
            f'<rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.4"/><circle cx="12" cy="12" r="4.4"/>'
            f'<circle cx="17.4" cy="6.6" r="0.55" fill="{stroke}" stroke-width="1.2"/></svg>')


videos, tweens = [], []
for i in range(len(CUTS) - 1):
    a, b = CUTS[i], CUTS[i + 1]
    dur = (b - a) / FPS + (HALF if i < len(CUTS) - 2 else 0)
    videos.append(f'      <div id="v{i + 1:02d}" class="inner"><video id="plan{i + 1:02d}" class="clip shot" src="assets/rushes/plan{i + 1:02d}.mp4" '
                  f'muted playsinline data-start="{t(a / FPS)}" data-duration="{t(dur)}" data-track-index="0"></video></div>')
    push = plan['shots'][i].get('push', 0)
    if push:
        tweens.append(f'      tl.fromTo("#v{i + 1:02d}", {{ scale: 1 }}, {{ scale: {1 + push:.3f}, duration: {(b - a) / FPS:.4f}, ease: "none" }}, {t(a / FPS)});')

# ---------- titre ----------
t0, t1 = s(F_TITLE0), F_TITLE1 / FPS - HALF
rows = ''.join(f'<div class="w w{k + 1}" style="top: {r["y"]}px; height: {r["hauteur_ligne"]}px; line-height: {r["hauteur_ligne"]}px; '
               f'font-style: {"italic" if r["italique"] else "normal"};">{r["texte"]}</div>' for k, r in enumerate(T['rows']))
extra_css, blocks = [], []
if T['treatment'] == 'voile':
    full = T['top'] + T['block_h'] + 48
    v = rgba(T['veil_hex'], T['veil_alpha'])
    extra_css.append(f'      #title-voile {{ height: {full + 380}px; background: linear-gradient(to bottom, {v} 0px, {v} {full}px, '
                     f'{rgba(T["veil_hex"], 0)} {full + 380}px); }}')
    blocks.append(f'      <div id="title-voile" class="clip voile" data-start="{t(t0)}" data-duration="{t(t1 - t0)}" data-track-index="2"></div>')
bg = ''
if T['treatment'] == 'bloc':
    extra_css.append(f'      #title .w {{ background: {rgba(T["block_hex"], T["block_alpha"])}; border-radius: 28px; padding: 0 26px; '
                     f'left: 50%; transform: translateX(-50%); right: auto; }}')
blocks.append(f'      <div id="title" class="clip" data-start="{t(t0)}" data-duration="{t(t1 - t0)}" data-track-index="3">{rows}</div>')
for k, r in enumerate(T['rows']):
    # chaque mot apparaît sur sa coupe en 2 images, comme les mots écrits à la main de la référence
    tweens.append(f'      tl.fromTo("#title .w{k + 1}", {{ opacity: 0 }}, {{ opacity: 1, duration: {2 / FPS:.4f}, ease: "none" }}, {t(s(r["f0"]))});')

# ---------- petit logo Instagram en haut à droite ----------
c0, c1 = s(F_TITLE0), DARK / FPS - HALF
blocks.append(f'      <div id="coin" class="clip" data-start="{t(c0)}" data-duration="{t(c1 - c0)}" data-track-index="4"><div class="pop">'
              f'<div class="g blanc">{glyph("#FFFFFF")}</div><div class="g couleurs">{glyph("url(#ig-coin)", ig("ig-coin"))}</div></div></div>')
tweens += [
    f'      tl.fromTo("#coin .pop", {{ opacity: 0, scale: 0.7 }}, {{ opacity: 1, scale: 1, duration: {8 / FPS:.4f}, ease: "back.out(2)" }}, {t(c0)});',
    # comme la référence : le petit logo passe aux couleurs d'Instagram de 2,1 à 4,7 s
    f'      tl.fromTo("#coin .couleurs", {{ opacity: 0 }}, {{ opacity: 1, duration: {12 / FPS:.4f}, ease: "power1.inOut", immediateRender: false }}, {t(s(63))});',
    f'      tl.to("#coin .couleurs", {{ opacity: 0, duration: {12 / FPS:.4f}, ease: "power1.inOut" }}, {t(s(129))});',
]

# ---------- écran final ----------
e0, e1 = s(DARK), TOTAL / FPS
blocks.append(f'      <div id="fin-voile" class="clip" data-start="{t(e0)}" data-duration="{t(e1 - e0)}" data-track-index="5"></div>')
blocks.append(f'      <div id="fin-logo" class="clip" data-start="{t(e0)}" data-duration="{t(e1 - e0)}" data-track-index="6"><div class="pop">'
              f'<div class="g blanc">{glyph("#FFFFFF")}</div>'
              f'<div class="g couleurs">{glyph("url(#ig-fin)", ig("ig-fin"))}</div></div></div>')
blocks.append(f'      <div id="fin-compte" class="clip" data-start="{t(s(DARK + 6))}" data-duration="{t(e1 - s(DARK + 6))}" data-track-index="7"><span class="h">{HANDLE}</span></div>')
tweens += [
    f'      tl.fromTo("#fin-logo .pop", {{ scale: 1 }}, {{ scale: 1.08, duration: {6 / FPS:.4f}, ease: "power2.out" }}, {t(s(DARK + 1))});',
    f'      tl.to("#fin-logo .pop", {{ scale: 1, duration: {5 / FPS:.4f}, ease: "power2.inOut" }}, {t(s(DARK + 7))});',
    f'      tl.fromTo("#fin-compte .h", {{ opacity: 0 }}, {{ opacity: 1, duration: {2 / FPS:.4f}, ease: "none" }}, {t(s(DARK + 6))});',
    f'      tl.fromTo("#fin-logo .couleurs", {{ opacity: 0 }}, {{ opacity: 1, duration: {12 / FPS:.4f}, ease: "power1.inOut" }}, {t(s(DARK + 13))});',
    f'      tl.to("#fin-logo .couleurs", {{ opacity: 0, duration: {12 / FPS:.4f}, ease: "power1.inOut" }}, {t(s(DARK + 76))});',
]

html = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <!-- Généré par tools/build_index.py depuis plan.json et layout.json : ne pas éditer à la main. -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face {{ font-family: "Instrument Serif"; src: url("assets/fonts/instrument-serif-latin-400-normal.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: block; }}
      @font-face {{ font-family: "Instrument Serif"; src: url("assets/fonts/instrument-serif-latin-400-italic.woff2") format("woff2"); font-weight: 400; font-style: italic; font-display: block; }}
      @font-face {{ font-family: "Instrument Sans"; src: url("assets/fonts/instrument-sans-latin-500-normal.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: block; }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #0c2b45; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; background: #0c2b45; }}
      .inner {{ position: absolute; inset: 0; transform-origin: 50% 50%; }}
      .shot {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
      .voile {{ position: absolute; left: 0; right: 0; top: 0; pointer-events: none; }}
      #title {{ position: absolute; left: 108px; right: 108px; top: {T["top"]}px; height: {T["block_h"]}px; }}
      #title .w {{ position: absolute; left: 0; right: 0; text-align: center; white-space: nowrap; color: {T["text_hex"]};
                  font-family: "Instrument Serif", serif; font-weight: 400; font-size: {T["size"]}px; letter-spacing: -0.005em; }}
      #coin {{ position: absolute; left: 916px; top: 477px; width: 56px; height: 56px; }}
      #fin-compte .h {{ display: inline-block; }}
      .pop {{ position: absolute; inset: 0; transform-origin: 50% 50%; }}
      #coin .g {{ position: absolute; inset: 0; filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.25)); }}
      #coin .couleurs, #fin-logo .couleurs {{ opacity: 0; }}
      #fin-voile {{ position: absolute; inset: 0; background: rgba(0, 0, 0, 0.75); }}
      #fin-logo {{ position: absolute; left: 465px; top: 839px; width: 150px; height: 150px; }}
      #fin-logo .g {{ position: absolute; inset: 0; }}
      #fin-compte {{ position: absolute; left: 108px; right: 108px; top: 1046px; height: 80px; line-height: 80px; text-align: center;
                    color: #FFFFFF; font-family: "Instrument Sans", sans-serif; font-weight: 500; font-size: 60px; letter-spacing: 0.01em; }}
{chr(10).join(extra_css)}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{t(TOTAL / FPS)}" data-width="1080" data-height="1920">
{chr(10).join(videos)}
{chr(10).join(blocks)}
      <audio id="music" src="assets/bgm.mp3" data-start="0" data-duration="{t(AUDIO)}" data-track-index="11" data-volume="1"></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(tweens)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
'''
open(OUT, 'w').write(html)
print(f'{OUT} : {len(videos)} plans, titre {T["treatment"]} {T["text_hex"]}, écran final à {DARK / FPS:.3f} s, {TOTAL / FPS:.3f} s ({TOTAL} images)')

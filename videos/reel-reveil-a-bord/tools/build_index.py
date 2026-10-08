"""Génère index.html du reel « waking up here » (réveil à bord) à partir de plan.json et layout.json.
Usage (depuis le projet) : python3 -I tools/build_index.py layout.json index.html

Copie du reel de référence (Evasion de charme), mesuré image par image : 8 plans fixes, coupes aux mêmes images,
légende « waking up here » fixe au milieu de l'image du début à la fin. Sans logos Instagram ni écran de fin
(demande de Robin) : la vidéo s'arrête à 9,13 s, là où la référence passait à l'écran de fin (musique déjà silencieuse).
Temps en numéros d'image (30 i/s). Plans vidéo : chevauchement d'une demi-image (le suivant, plus bas dans le DOM, passe dessus).
"""
import sys, json, math

LAYOUT, OUT = sys.argv[1], sys.argv[2]
plan = json.load(open('plan.json'))
lay = json.load(open(LAYOUT))
FPS, CUTS, TOTAL = plan['fps'], plan['cuts'], plan['total_frames']
HALF = 0.5 / FPS
AUDIO = min(11.330, TOTAL / FPS)     # musique de la référence (11,33 s), coupée à la fin de l'image


def t(x):
    return f'{math.floor(x * 1e6) / 1e6:.6f}'


def rgba(hex_, a):
    h = hex_.lstrip('#')
    return f'rgba({int(h[0:2], 16)}, {int(h[2:4], 16)}, {int(h[4:6], 16)}, {a:.2f})'


videos, tweens = [], []
for i in range(len(CUTS) - 1):
    a, b = CUTS[i], CUTS[i + 1]
    dur = (b - a) / FPS + (HALF if i < len(CUTS) - 2 else 0)
    videos.append(f'      <div id="v{i + 1:02d}" class="inner"><video id="plan{i + 1:02d}" class="clip shot" src="assets/rushes/plan{i + 1:02d}.mp4" '
                  f'muted playsinline data-start="{t(a / FPS)}" data-duration="{t(dur)}" data-track-index="0"></video></div>')
    push = plan['shots'][i].get('push', 0)
    if push:
        tweens.append(f'      tl.fromTo("#v{i + 1:02d}", {{ scale: 1 }}, {{ scale: {1 + push:.3f}, duration: {(b - a) / FPS:.4f}, ease: "none" }}, {t(a / FPS)});')

# ---------- légende fixe ----------
row = lay['rows'][0]
c0, c1 = 0.0, TOTAL / FPS
extra_css, blocks = [], []
if lay['treatment'] == 'voile':
    full = lay['top'] + lay['block_h'] + 48
    v = rgba(lay['veil_hex'], lay['veil_alpha'])
    extra_css.append(f'      #legende-voile {{ height: {full + 380}px; background: linear-gradient(to bottom, {v} 0px, {v} {full}px, '
                     f'{rgba(lay["veil_hex"], 0)} {full + 380}px); }}')
    blocks.append(f'      <div id="legende-voile" class="clip voile" data-start="{t(c0)}" data-duration="{t(c1 - c0)}" data-track-index="2"></div>')
if lay['treatment'] == 'bloc':
    extra_css.append(f'      #legende .w {{ background: {rgba(lay["block_hex"], lay["block_alpha"])}; border-radius: 22px; padding: 0 22px; '
                     f'left: 50%; transform: translateX(-50%); right: auto; }}')
blocks.append(f'      <div id="legende" class="clip" data-start="{t(c0)}" data-duration="{t(c1 - c0)}" data-track-index="3">'
              f'<div class="w" style="top: {row["y"]}px; height: {row["hauteur_ligne"]}px; line-height: {row["hauteur_ligne"]}px; '
              f'font-style: {"italic" if row["italique"] else "normal"};">{row["texte"]}</div></div>')

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
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #0c2b45; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; background: #0c2b45; }}
      .inner {{ position: absolute; inset: 0; transform-origin: 50% 50%; }}
      .shot {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
      .voile {{ position: absolute; left: 0; right: 0; top: 0; pointer-events: none; }}
      #legende {{ position: absolute; left: 108px; right: 108px; top: {lay["top"]}px; height: {lay["block_h"]}px; }}
      #legende .w {{ position: absolute; left: 0; right: 0; text-align: center; white-space: nowrap; color: {lay["text_hex"]};
                    font-family: "Instrument Serif", serif; font-weight: 400; font-size: {lay["size"]}px; letter-spacing: 0.005em; }}
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
print(f'{OUT} : {len(videos)} plans, légende {lay["treatment"]} {lay["text_hex"]} (haut {lay["top"]} px), {TOTAL / FPS:.3f} s ({TOTAL} images)')

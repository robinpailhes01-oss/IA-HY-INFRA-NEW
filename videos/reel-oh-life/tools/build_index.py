"""Génère index.html du reel « oh, life » à partir de lyrics.json (placement + couleurs calculés par lyrics_style.py).
Usage (depuis le dossier du projet) : python3 -I tools/build_index.py lyrics.json index.html

Temps : tout est calculé en numéros d'image (30 i/s) pour éviter les erreurs d'arrondi.
- Plans vidéo : début arrondi vers le bas + une demi-image de chevauchement avec le plan suivant
  (le plan suivant est plus bas dans le DOM, donc dessiné par-dessus) : aucune image sans vidéo.
- Paroles : visibles exactement de l'image f0 à l'image f1 - 1 (marges d'une demi-image).
"""
import sys, json, math

SRC, OUT = sys.argv[1], sys.argv[2]
cfg = json.load(open(SRC))
FPS = cfg['fps']
CUTS = cfg['cuts']
TOTAL = CUTS[-1]
HALF = 0.5 / FPS


def t(x):  # secondes, 6 décimales, arrondi vers le bas
    return f'{math.floor(x * 1e6) / 1e6:.6f}'


def rgba(hex_, a):
    h = hex_.lstrip('#')
    return f'rgba({int(h[0:2], 16)}, {int(h[2:4], 16)}, {int(h[4:6], 16)}, {a:.2f})'


videos = []
for i in range(len(CUTS) - 1):
    a, b = CUTS[i], CUTS[i + 1]
    dur = (b - a) / FPS + (HALF if i < len(CUTS) - 2 else 0)
    videos.append(
        f'      <video id="plan{i + 1:02d}" class="clip shot" src="assets/rushes/plan{i + 1:02d}.mp4" muted playsinline\n'
        f'        data-start="{t(a / FPS)}" data-duration="{t(dur)}" data-track-index="0"></video>')

size, lh = cfg['font_size'], cfg['line_height']
box_h = round(size * lh)
lyrics, css, tweens = [], [], []
for ln in cfg['lines']:
    lid, f0, f1 = ln['id'], ln['f0'], ln['f1']
    start = f0 / FPS - (HALF if f0 > 0 else 0)
    dur = (f1 - f0) / FPS + (HALF if f0 > 0 else 0) - (HALF if f1 < TOTAL else 0)
    css.append(f'      #{lid} {{ top: {ln["y_center"] - box_h // 2}px; --c: {ln["text_hex"]}; }}')
    if ln['treatment'] == 'bloc':
        css.append(f'      #{lid} span {{ background: {rgba(ln["block_hex"], ln["block_alpha"])}; border-radius: 28px; padding: 4px 30px 10px; }}')
    lyrics.append(
        f'      <div id="{lid}" class="clip lyric" data-start="{t(start)}" data-duration="{t(dur)}" data-track-index="3">'
        f'<span>{ln["text"]}</span></div>')
    # Apparition en 2 images (presque franche, comme la référence) ; la 1re ligne est pleine dès l'image 0 (accroche).
    # Disparition franche : la fin du clip coupe le texte sur la coupe, comme la référence.
    if f0 > 0:
        # le fondu démarre une image avant f0 : 50 % sur l'image f0, 100 % sur f0 + 1
        tweens.append(f'      tl.fromTo("#{lid} span", {{ opacity: 0 }}, {{ opacity: 1, duration: {2 / FPS:.4f}, ease: "none" }}, {t((f0 - 1) / FPS)});')

html = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <!-- Généré par tools/build_index.py depuis lyrics.json : ne pas éditer à la main. -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face {{
        font-family: "Instrument Serif";
        src: url("assets/fonts/instrument-serif-latin-400-normal.woff2") format("woff2");
        font-weight: 400;
        font-style: normal;
        font-display: block;
      }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #0c2b45; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; background: #0c2b45; }}
      .shot {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
      .lyric {{ position: absolute; left: 0; right: 0; height: {box_h}px; display: flex; align-items: center; justify-content: center; }}
      .lyric span {{
        display: inline-block;
        font-family: "Instrument Serif", serif;
        font-size: {size}px;
        line-height: {lh};
        letter-spacing: 0.005em;
        white-space: nowrap;
        color: var(--c);
      }}
{chr(10).join(css)}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{t(TOTAL / FPS)}" data-width="1080" data-height="1920">
{chr(10).join(videos)}
{chr(10).join(lyrics)}
      <audio id="music" src="assets/bgm.mp3" data-start="0" data-duration="{t(TOTAL / FPS)}" data-track-index="11" data-volume="1"></audio>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(tweens)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
'''
open(OUT, 'w').write(html)
print(f'{OUT} : {len(videos)} plans, {len(cfg["lines"])} lignes, durée {TOTAL / FPS:.6f} s ({TOTAL} images)')

"""Génère index.html du reel « oh, life » à partir de lyrics.json (placement + couleurs calculés par lyrics_style.py).
Usage (depuis le dossier du projet) : python3 -I tools/build_index.py lyrics.json index.html
"""
import sys, json

SRC, OUT = sys.argv[1], sys.argv[2]
cfg = json.load(open(SRC))
FPS = 30
DURATION = 817 / FPS  # 27,2333 s : longueur de la piste (audiomap) arrondie à l'image

# Coupes reprises du reel de référence (en images à 30 i/s) — storyboard validé par Robin
CUTS = [0, 103, 181, 241, 286, 332, 409, 538, 613, 722, 817]
SHOTS = ['plan%02d' % i for i in range(1, 11)]


def rgba(hex_, a):
    h = hex_.lstrip('#')
    return f'rgba({int(h[0:2], 16)}, {int(h[2:4], 16)}, {int(h[4:6], 16)}, {a:.2f})'


def sec(frames):
    return f'{frames / FPS:.4f}'


videos = []
for i, name in enumerate(SHOTS):
    a, b = CUTS[i], CUTS[i + 1]
    videos.append(
        f'      <video id="{name}" class="clip shot" src="assets/rushes/{name}.mp4" muted playsinline\n'
        f'        data-start="{sec(a)}" data-duration="{sec(b - a)}" data-track-index="0"></video>')

size, lh = cfg['font_size'], cfg['line_height']
lyrics, veils, css, tweens = [], [], [], []
prev_t1 = 0.0
for ln in cfg['lines']:
    lid = ln['id']
    t0, t1 = ln['t0'], ln['t1']
    ln['after_gap'] = t0 - prev_t1 > 0.05
    prev_t1 = t1
    bx0, box_w, box_h = ln['box']
    top = ln['y_center'] - box_h // 2
    dur = t1 - t0
    css.append(f'      #{lid} {{ top: {top}px; height: {box_h}px; --c: {ln["text_hex"]}; --glow: {rgba(ln["veil_hex"], 0.28)}; }}')
    lyrics.append(
        f'      <div id="{lid}" class="clip lyric" data-start="{t0:.4f}" data-duration="{dur:.4f}" data-track-index="3">'
        f'<span>{ln["text"]}</span></div>')
    if ln['treatment'] == 'bloc':
        css.append(f'      #{lid} span {{ background: {rgba(ln["veil_hex"], ln["alpha"])}; border-radius: 28px; padding: 6px 30px 12px; }}')
    if ln['treatment'] == 'voile':
        vw, vh = box_w + 500, box_h + 260
        css.append(
            f'      #{lid}-veil {{ top: {ln["y_center"] - vh // 2}px; left: {(1080 - vw) // 2}px; width: {vw}px; height: {vh}px; }}\n'
            f'      #{lid}-veil {{ background: radial-gradient(closest-side, {rgba(ln["veil_hex"], ln["alpha"])} 0%, '
            f'{rgba(ln["veil_hex"], ln["alpha"])} 70%, {rgba(ln["veil_hex"], 0)} 100%); }}')
        veils.append(
            f'      <div id="{lid}-veil" class="clip veil" data-start="{t0:.4f}" data-duration="{dur:.4f}" data-track-index="2"></div>')
    # Entrée : la 1re ligne est visible dès l'image 0 (accroche) ; les autres apparaissent en douceur.
    targets = f'"#{lid} span' + (f', #{lid}-veil"' if ln['treatment'] == 'voile' else '"')
    if t0 > 0:
        fade_in = 0.4 if ln.get('after_gap') else 0.25
        tweens.append(f'      tl.fromTo({targets}, {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: {fade_in}, ease: "power2.out" }}, {t0:.4f});')
    # Sortie : fondu court avant la fin, sauf la dernière ligne qui tient jusqu'à la dernière image.
    if t1 < DURATION - 0.01:
        tweens.append(f'      tl.to({targets}, {{ opacity: 0, duration: 0.2, ease: "power1.in" }}, {t1 - 0.2:.4f});')

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
      .veil {{ position: absolute; pointer-events: none; }}
      .lyric {{ position: absolute; left: 0; right: 0; display: flex; align-items: center; justify-content: center; }}
      .lyric span {{
        display: inline-block;
        font-family: "Instrument Serif", serif;
        font-size: {size}px;
        line-height: {lh};
        letter-spacing: 0.005em;
        white-space: nowrap;
        color: var(--c);
        text-shadow: 0 0 22px var(--glow);
      }}
{chr(10).join(css)}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DURATION:.4f}" data-width="1080" data-height="1920">
{chr(10).join(videos)}
{chr(10).join(veils)}
{chr(10).join(lyrics)}
      <audio id="music" src="assets/bgm.mp3" data-start="0" data-duration="{DURATION:.4f}" data-track-index="11" data-volume="1"></audio>
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
print(f'{OUT} : {len(SHOTS)} plans, {len(cfg["lines"])} lignes, {len(veils)} voile(s), durée {DURATION:.4f} s')

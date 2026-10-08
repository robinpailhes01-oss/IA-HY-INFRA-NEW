"""Génère index.html du reel « une journée en mer » à partir de plan.json et layout.json.
Usage (depuis le projet) : python3 -I tools/build_index.py layout.json index.html

Temps en numéros d'image (30 i/s). Plans vidéo : chevauchement d'une demi-image (le suivant, plus bas dans le DOM, passe dessus).
Phrases (mise en page A du DESIGN.md) : ligne 1 puis ligne 2 en italique (+0,25 s), fondu d'entrée 0,4 s ;
sortie en fondu 0,4 s qui finit 0,1 s avant la coupe. La 1re phrase est pleine dès l'image 0 (accroche).
Signature : « Harmonie Yacht », filet fin dans la couleur de l'encre (l'or se perd sur un ciel de coucher de soleil), « Port de Carnon ».
"""
import sys, json, math

LAYOUT, OUT = sys.argv[1], sys.argv[2]
plan = json.load(open('plan.json'))
lay = json.load(open(LAYOUT))
FPS, CUTS, TOTAL = plan['fps'], plan['cuts'], plan['total_frames']
HALF = 0.5 / FPS
OR = '#A07838'
FONTS = {'serif': ('Instrument Serif', 'normal'), 'serif-i': ('Instrument Serif', 'italic'), 'sans': ('Instrument Sans', 'normal')}


def t(x):
    return f'{math.floor(x * 1e6) / 1e6:.6f}'


def rgba(hex_, a):
    h = hex_.lstrip('#')
    return f'rgba({int(h[0:2], 16)}, {int(h[2:4], 16)}, {int(h[4:6], 16)}, {a:.2f})'


videos = []
for i in range(len(CUTS) - 1):
    a, b = CUTS[i], CUTS[i + 1]
    dur = (b - a) / FPS + (HALF if i < len(CUTS) - 2 else 0)
    videos.append(f'      <video id="plan{i + 1:02d}" class="clip shot" src="assets/rushes/plan{i + 1:02d}.mp4" muted playsinline '
                  f'data-start="{t(a / FPS)}" data-duration="{t(dur)}" data-track-index="0"></video>')

blocks, css, tweens = [], [], []
for e in lay['texts']:
    tid, f0, f1 = e['id'], e['f0'], e['f1']
    start = f0 / FPS - (HALF if f0 > 0 else 0)
    end = f1 / FPS - (HALF if f1 < TOTAL else 0)
    css.append(f'      #{tid} {{ top: {e["top"]}px; --c: {e["text_hex"]}; }}')
    rows_html, r = [], 0
    for row in e['rows']:
        if row['type'] == 'filet':
            rows_html.append(f'<div class="filet" style="top: {row["y"]}px"></div>')
            continue
        r += 1
        fam, style = FONTS[row['police']]
        bg = ''
        if e['treatment'] == 'bloc':
            bg = f' background: {rgba(e["block_hex"], e["block_alpha"])}; border-radius: 28px; padding: 0 26px; margin-left: -26px;'
        rows_html.append(f'<div class="r r{r}" style="top: {row["y"]}px; height: {row["hauteur_ligne"]}px; line-height: {row["hauteur_ligne"]}px; '
                         f'font-family: \'{fam}\', serif; font-style: {style}; font-size: {row["taille"]}px;{bg}">{row["texte"]}</div>')
    if e['treatment'] == 'voile':
        # voile plein du haut du cadre jusqu'à 48 px sous le texte, puis fondu sur 380 px (filtre dégradé, jamais une tache)
        full = e['top'] + e['block_h'] + 48
        v = rgba(e['veil_hex'], e['veil_alpha'])
        css.append(f'      #{tid}-voile {{ height: {full + 380}px; background: linear-gradient(to bottom, {v} 0px, {v} {full}px, '
                   f'{rgba(e["veil_hex"], 0)} {full + 380}px); }}')
        blocks.append(f'      <div id="{tid}-voile" class="clip voile" data-start="{t(start)}" data-duration="{t(end - start)}" data-track-index="2"></div>')
    blocks.append(f'      <div id="{tid}" class="clip bloc" data-start="{t(start)}" data-duration="{t(end - start)}" data-track-index="3">'
                  + ''.join(rows_html) + '</div>')
    # entrée
    if f0 > 0:
        tweens.append(f'      tl.fromTo("#{tid} .r1' + (f', #{tid}-voile' if e['treatment'] == 'voile' else '') + f'", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.4, ease: "power2.out" }}, {t(f0 / FPS)});')
        tweens.append(f'      tl.fromTo("#{tid} .r2, #{tid} .filet", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.4, ease: "power2.out" }}, {t(f0 / FPS + 0.25)});')
    # sortie (sauf la signature, qui tient jusqu'à la fin)
    if f1 < TOTAL:
        tweens.append(f'      tl.to("#{tid} .r, #{tid} .filet' + (f', #{tid}-voile' if e['treatment'] == 'voile' else '') + f'", {{ opacity: 0, duration: 0.4, ease: "power1.in" }}, {t(f1 / FPS - 0.5)});')

html = f'''<!doctype html>
<html lang="fr">
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
      .shot {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
      .bloc {{ position: absolute; left: {lay["x0"]}px; right: 108px; height: 600px; }}
      .bloc .r {{ position: absolute; left: 0; white-space: nowrap; color: var(--c); font-weight: 400; letter-spacing: -0.005em; }}
      .voile {{ position: absolute; left: 0; right: 0; top: 0; pointer-events: none; }}
      .bloc .filet {{ position: absolute; left: 0; width: 72px; height: 2px; background: var(--c); }}
{chr(10).join(css)}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{t(TOTAL / FPS)}" data-width="1080" data-height="1920">
{chr(10).join(videos)}
{chr(10).join(blocks)}
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
print(f'{OUT} : {len(videos)} plans, {len(lay["texts"])} textes, {TOTAL / FPS:.3f} s ({TOTAL} images)')

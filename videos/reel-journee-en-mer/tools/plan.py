"""Construit plan.json (storyboard en données) à partir de audiomap.json.
Usage (depuis le projet) : python3 -I tools/plan.py

Chaque coupe tombe sur un temps de la musique (beats_sec de l'analyse officielle), arrondi à l'image (30 i/s).
Plans : surtout 1 mesure (4 temps ≈ 2,96 s), 2 temps (≈ 1,48 s) dans les passages plus vifs.
Recadrage (zoom, ax, ay) seulement sur les rushes 4K (09, 10, 11) : zoom ≥ 1 sans perte jusqu'à 2.
"""
import json

FPS = 30
a = json.load(open('audiomap.json'))
B = a['grid']['beats_sec']
END = a['audio']['duration_sec']

# plan : (indice du temps de début, rush, début source s, vitesse (ralenti), zoom, ax, ay, description)
SHOTS = [
    (None, '06', 0.30, 1, 1, .5, .5, 'pieds au-dessus de l’eau turquoise (accroche)'),
    (5,  '02', 0.00, 1, 1, .5, .5, 'mer d’huile'),
    (7,  '04', 0.80, 1, 1, .5, .5, 'de la proue vers le groupe'),
    (9,  '07', 0.80, 1, 1, .5, .5, 'bain de soleil sur la plage avant'),
    (13, '05', 0.00, 1, 1, .5, .5, 'femme face au sillage'),
    (17, '03', 0.50, 1, 1, .5, .5, 'à table, verres (pas de texte)'),
    (19, '01', 0.40, 1, 1, .5, .5, 'femme de profil (pas de texte)'),
    (21, '08', 0.00, 1, 1, .5, .5, 'groupe à l’avant, face à l’horizon'),
    (25, '05', 3.40, 1, 1, .5, .5, 'amies, la photo souvenir (pas de texte)'),
    (27, '08', 3.20, 1, 1, .5, .5, 'le groupe se retourne'),
    (29, '09', 0.50, 2, 1, .5, .5, 'la lumière devient dorée'),
    (33, '10', 0.80, 2, 1, .5, .5, 'ciel rose, deux personnes à l’avant'),
    (37, '11', 1.00, 2, 1.6, .5, 0.0, 'gros plan sur le ciel en feu'),
    (39, '10', 2.40, 2, 1.5, 0.0, .62, 'plus près des deux personnes'),
    (41, '11', 2.40, 2, 1, .5, .5, 'la proue fend la mer cuivrée'),
    (45, '09', 2.10, 2, 1.3, .5, .5, 'proue vers le cockpit, plus serré'),
    (49, '11', 4.30, 4, 1.5, 1.0, .85, 'reflets dans l’eau, très ralenti'),
    (53, '10', 5.50, 2, 1, .5, .5, 'les deux personnes, ciel rose'),
    (55, '11', 6.00, 2, 1.4, 0.0, 1.0, 'détail de la rambarde'),
    (57, '11', 7.30, 2, 1.25, .5, .2, 'le ciel au-dessus de l’horizon'),
    (61, '11', 9.40, 2, 1, .5, .5, 'la proue, dernier plan (signature)'),
]
cuts = [0] + [round(B[s[0]] * FPS) for s in SHOTS[1:]] + [round(END * FPS)]
plan = {'fps': FPS, 'total_frames': cuts[-1], 'cuts': cuts, 'shots': []}
for i, (bi, rush, ss, slow, zoom, ax, ay, desc) in enumerate(SHOTS):
    f0, f1 = cuts[i], cuts[i + 1]
    plan['shots'].append({'n': i + 1, 'f0': f0, 'f1': f1, 'beats': None if bi is None else bi, 'rush': rush, 'src_start': ss,
                          'src_dur': round((f1 - f0) / FPS / slow, 4), 'slow': slow, 'zoom': zoom, 'ax': ax, 'ay': ay, 'desc': desc})

# Textes : sur les plans au ciel ou à l'eau calme ; jamais sur un gros plan de personne (plans 6, 7, 9).
# Chaque phrase dure son plan ; la signature occupe la fin du dernier plan.
TEXT_SHOTS = {'T1': 1, 'T2': 4, 'T3': 8, 'T4': 11, 'T5': 15, 'T6': 17, 'T7': 20}
plan['texts'] = [{'id': k, 'shot': v, 'f0': plan['shots'][v - 1]['f0'], 'f1': plan['shots'][v - 1]['f1']} for k, v in TEXT_SHOTS.items()]
last = plan['shots'][-1]
plan['texts'].append({'id': 'SIG', 'shot': last['n'], 'f0': last['f0'] + 15, 'f1': last['f1']})
json.dump(plan, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for s in plan['shots']:
    print(f"{s['n']:2d} {s['f0'] / FPS:6.2f}–{s['f1'] / FPS:6.2f} ({(s['f1'] - s['f0']) / FPS:4.2f} s) rush {s['rush']} src {s['src_start']:.2f}+{s['src_dur']:.2f} ×{s['slow']} zoom {s['zoom']}  {s['desc']}")
print('textes :', [(t['id'], round(t['f0'] / FPS, 2), round(t['f1'] / FPS, 2)) for t in plan['texts']])

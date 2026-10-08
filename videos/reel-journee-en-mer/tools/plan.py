"""Construit plan.json (storyboard en données) à partir de audiomap.json et de la musique.
Usage (depuis le projet) : python3 -I tools/plan.py

v2 (après relecture du brouillon) :
- Les coupes partent des temps de l'analyse officielle (beats_sec), puis sont CALÉES SUR L'ATTAQUE AUDIBLE la plus forte
  dans [-0,10 ; +0,30] s : sur cette guitare, la note forte des débuts de mesure arrive ~0,16 s après la grille
  (mesuré par la relecture et confirmé par librosa.onset_strength). Arrondi à l'image (30 i/s).
- Seconde moitié refaite : plans courts sur les passages forts, cadrages vraiment différents (4K recadré),
  un seul plan final continu (plus de faux raccord), « Port de Carnon » posé sur le coup final de la guitare.
- Plans retirés ou décalés pour éviter les intrusions vues à la relecture (plans 5, 12, 18 du brouillon, bord droit du rush 08).
v3 (relecture de confirmation) : plus de faux raccord (un seul plan final continu dès le temps 53), plus de plan 19 doublon
du plan 11 (les reflets ralentis tiennent toute la phrase T6), bas du plan 12 recadré.
"""
import json
import numpy as np
import librosa

FPS = 30
a = json.load(open('audiomap.json'))
B = a['grid']['beats_sec']
END = a['audio']['duration_sec']

y, sr = librosa.load('assets/bgm.mp3', sr=22050, mono=True)
HOP = 128
env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
tt = librosa.times_like(env, sr=sr, hop_length=HOP)
MED = float(np.median(env))


def attack(t0, lo=-0.10, hi=0.30):
    """Instant de l'attaque la plus forte autour de t0 (si elle est nette), sinon t0."""
    m = (tt >= t0 + lo) & (tt <= t0 + hi)
    i = int(np.argmax(env[m]))
    return float(tt[m][i]) if env[m][i] > 3 * MED else t0


def frame_at_beat(i):
    return round(attack(B[i]) * FPS)


# (temps de début, rush, début source s, ralenti, zoom, ax, ay, rotation°, poussée, description)
# poussée = zoom avant lent pendant le plan (1 → 1 + poussée), sur un conteneur autour de la vidéo
SHOTS = [
    (None, '06', 0.30, 1, 1, .5, .5, 0, 0, 'pieds au-dessus de l’eau turquoise (accroche)'),
    (5,  '02', 0.00, 1, 1.06, 0.0, .5, 0, 0, 'mer d’huile (bord droit recadré : doigts sur la rambarde)'),
    (7,  '04', 0.80, 1, 1, .5, .5, 0, 0, 'de la proue vers le groupe'),
    (9,  '07', 0.80, 1, 1, .5, .5, 0, 0, 'bain de soleil sur la plage avant'),
    (13, '05', 0.00, 1, 1, .5, .5, 0, 0, 'femme face au sillage (fini avant l’arrivée de l’amie)'),
    (16, '03', 0.00, 1, 1, .5, .5, 0, 0, 'à table, verres (pas de texte)'),
    (19, '01', 0.40, 1, 1, .5, .5, 0, 0, 'femme de profil (pas de texte)'),
    (21, '08', 0.00, 1, 1.08, 0.0, .5, 0, 0, 'groupe à l’avant (bord droit recadré : silhouette)'),
    (25, '05', 3.40, 1, 1, .5, .5, 0, 0, 'amies, la photo souvenir (pas de texte)'),
    (27, '08', 3.20, 1, 1, .5, .5, 0, 0, 'le groupe se retourne'),
    (29, '09', 0.50, 2, 1, .5, .5, 0, .05, 'la lumière devient dorée'),
    (33, '10', 1.10, 2, 1.10, .5, 0.0, 0, 0, 'ciel rose, deux personnes à l’avant (bas recadré)'),
    (35, '10', 3.40, 2, 1.3, 0.0, .62, 0, 0, 'plus près des deux personnes'),
    (37, '11', 1.00, 2, 1.6, .5, 0.0, 0, .05, 'gros plan sur le ciel en feu'),
    (39, '09', 2.20, 2, 2.0, .5, .3, 0, 0, 'le cockpit, la table, les amis'),
    (41, '11', 2.40, 2, 1.8, .9, .6, 0, .05, 'la mer cuivrée jusqu’à l’horizon'),
    (45, '10', 1.85, 2, 1.8, 1.0, .45, 0, .04, 'côté soleil : le ciel en feu, la mer'),
    (49, '11', 4.30, 4, 2.4, .80, .62, 0, 0, 'reflets dans l’eau, très ralenti, plan serré (toute la phrase T6)'),
    (53, '11', 5.90, 2, 1.04, .5, .5, -1.1, .08, 'la proue, dernier plan continu (T7 puis signature)'),
]
cuts = [0] + [frame_at_beat(s[0]) for s in SHOTS[1:]] + [round(END * FPS)]
assert all(b > a for a, b in zip(cuts, cuts[1:])), cuts
plan = {'fps': FPS, 'total_frames': cuts[-1], 'cuts': cuts, 'shots': []}
for i, (bi, rush, ss, slow, zoom, ax, ay, rot, push, desc) in enumerate(SHOTS):
    f0, f1 = cuts[i], cuts[i + 1]
    plan['shots'].append({'n': i + 1, 'f0': f0, 'f1': f1, 'beat': bi, 'rush': rush, 'src_start': ss,
                          'src_dur': round((f1 - f0) / FPS / slow, 4), 'slow': slow, 'zoom': zoom, 'ax': ax, 'ay': ay,
                          'rotate': rot, 'push': push, 'desc': desc})

# Textes : sur les plans au ciel ou à l'eau calme ; jamais sur un gros plan de personne.
S = {s['n']: s for s in plan['shots']}
def span(a_, b_):
    return S[a_]['f0'], S[b_]['f1']
texts = [('T1', *span(1, 1)), ('T2', *span(4, 4)), ('T3', *span(8, 8)), ('T4', *span(11, 11)), ('T5', *span(16, 16)), ('T6', *span(18, 18))]
last = S[len(SHOTS)]
t7_end = frame_at_beat(61)                       # T7 sur la 1re mesure du dernier plan
sig_title = frame_at_beat(62)                    # « Harmonie Yacht » sur le temps 62
hit = round(attack(48.23, -0.05, 0.10) * FPS)    # le coup final de la guitare, après le silence
texts.append(('T7', frame_at_beat(57), t7_end))   # T7 une mesure après le début du dernier plan
plan['texts'] = [{'id': k, 'f0': f0, 'f1': f1} for k, f0, f1 in texts]
plan['texts'].append({'id': 'SIG', 'f0': sig_title, 'f1': plan['total_frames'], 'f_info': hit})
json.dump(plan, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for s in plan['shots']:
    print(f"{s['n']:2d} {s['f0'] / FPS:6.2f}–{s['f1'] / FPS:6.2f} ({(s['f1'] - s['f0']) / FPS:4.2f} s) rush {s['rush']} src {s['src_start']:.2f}+{s['src_dur']:.2f} "
          f"×{s['slow']} zoom {s['zoom']}{' rot ' + str(s['rotate']) if s['rotate'] else ''}{' poussée' if s['push'] else ''}  {s['desc']}")
print('textes :', [(t['id'], round(t['f0'] / FPS, 2), round(t['f1'] / FPS, 2)) for t in plan['texts']], '| coup final à', round(hit / FPS, 3))

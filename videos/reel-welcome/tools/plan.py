"""Construit plan.json du reel « Welcome to Harmonie Yacht » : copie exacte du découpage du reel de référence
(Casa Santapietra, envoyé par Robin le 08/10/2026), avec les rushes d'Harmonie Yacht.
Usage (depuis le projet) : python3 -I tools/plan.py

Référence (30 i/s) : titre mot par mot sur les 4 premiers plans (0 → 2,73 s), montage rapide de 20 plans
(2,73 → 7,63 s, 4 à 13 images par plan), plan fixe (7,63 → 13,2 s) assombri à 9,17 s avec le logo Instagram et le compte.
v2 (demande de Robin) : sans logos Instagram ni écran de fin ; la vidéo s'arrête à 9,17 s, là où commençait l'écran de fin
(la musique est déjà silencieuse depuis 7,9 s, la fin tombe donc sans coupure audible).
Les passages de rushes choisis sont ceux déjà vérifiés sans intrusion (voir les relectures des reels précédents) ;
un rush qui revient change de passage ou de cadrage (plans 10, 11, 24 revus après le premier brouillon).
"""
import json

FPS = 30
# Coupes de la référence (détection de scène, en images à 30 i/s) ; 396 = fin (13,2 s)
END = 275           # 9,17 s : début de l'écran de fin de la référence, retiré à la demande de Robin
CUTS = [0, 25, 45, 61, 82, 87, 92, 97, 102, 111, 119, 131, 139, 147, 159, 167, 171, 176, 182, 189, 202, 208, 216, 223, 229, END]
# (rush, début source s, ralenti, zoom, ax, ay, rotation°, poussée, description)
SHOTS = [
    ('06', 0.30, 1, 1, .5, .5, 0, 0, 'pieds au-dessus de l’eau turquoise — « Welcome »'),
    ('02', 0.00, 1, 1.06, 0.0, .5, 0, 0, 'mer d’huile — « to »'),
    ('04', 0.80, 1, 1, .5, .5, 0, 0, 'de la proue vers le groupe — « Harmonie »'),
    ('11', 1.00, 2, 1.6, .5, 0.0, 0, 0, 'ciel en feu — « Yacht »'),
    ('05', 0.30, 1, 1, .5, .5, 0, 0, 'femme face au sillage'),
    ('03', 0.30, 1, 1, .5, .5, 0, 0, 'à table, verres'),
    ('08', 0.50, 1, 1.08, 0.0, .5, 0, 0, 'groupe à l’avant'),
    ('07', 2.00, 1, 1, .5, .5, 0, 0, 'bain de soleil'),
    ('01', 0.60, 1, 1, .5, .5, 0, 0, 'femme de profil'),
    ('06', 4.80, 1, 1.15, .5, 0.0, 0, 0, 'eau turquoise et échelle de proue (bas recadré : orteils)'),
    ('04', 2.60, 1, 1, .5, .5, 0, 0, 'le bateau vu de l’autre côté, la plage à l’horizon'),
    ('05', 3.60, 1, 1, .5, .5, 0, 0, 'amies, la photo'),
    ('08', 3.40, 1, 1, .5, .5, 0, 0, 'le groupe se retourne'),
    ('07', 4.00, 1, 1, .5, .5, 0, 0, 'bain de soleil, autre moment'),
    ('09', 0.60, 1, 1, .5, .5, 0, 0, 'la lumière devient dorée'),
    ('11', 3.00, 1, 1.6, .5, 0.0, 0, 0, 'ciel en feu'),
    ('10', 1.20, 1, 1.1, .5, 0.0, 0, 0, 'deux personnes, ciel rose'),
    ('09', 2.30, 1, 2.0, .5, .3, 0, 0, 'le cockpit, la table'),
    ('11', 2.50, 1, 1.8, .9, .6, 0, 0, 'la mer cuivrée'),
    ('10', 2.00, 1, 1.8, 1.0, .45, 0, 0, 'côté soleil'),
    ('11', 4.40, 1, 2.4, .80, .62, 0, 0, 'reflets sur l’eau'),
    ('10', 3.50, 1, 1.3, 0.0, .62, 0, 0, 'plus près des deux personnes'),
    ('11', 6.00, 1, 1.4, 0.0, 1.0, 0, 0, 'détail de la rambarde'),
    ('09', 1.60, 1, 1.7, 1.0, 0.2, 0, 0, 'le soleil couchant (recadrage 4K, différent du plan 15)'),
    ('11', 7.60, 2, 1.04, .5, .5, -1.1, .02, 'la proue au coucher de soleil, plan final'),
]
assert len(SHOTS) == len(CUTS) - 1
plan = {'fps': FPS, 'total_frames': CUTS[-1], 'cuts': CUTS, 'shots': []}
for i, (rush, ss, slow, zoom, ax, ay, rot, push, desc) in enumerate(SHOTS):
    f0, f1 = CUTS[i], CUTS[i + 1]
    plan['shots'].append({'n': i + 1, 'f0': f0, 'f1': f1, 'rush': rush, 'src_start': ss, 'src_dur': round((f1 - f0) / FPS / slow, 4),
                          'slow': slow, 'zoom': zoom, 'ax': ax, 'ay': ay, 'rotate': rot, 'push': push, 'desc': desc})
# Titre : un mot par plan, comme la référence (« WELCOME » à 0,2 s puis chaque mot sur sa coupe), jusqu'à la coupe de 2,73 s
plan['title'] = {'f1': CUTS[4], 'words': [{'texte': 'Welcome', 'f0': 6}, {'texte': 'to', 'f0': CUTS[1], 'italique': True},
                                          {'texte': 'Harmonie', 'f0': CUTS[2]}, {'texte': 'Yacht', 'f0': CUTS[3]}]}
json.dump(plan, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for s in plan['shots']:
    print(f"{s['n']:2d} {s['f0'] / FPS:5.2f}–{s['f1'] / FPS:5.2f} ({s['f1'] - s['f0']:3d} img) rush {s['rush']} src {s['src_start']:.2f} ×{s['slow']} zoom {s['zoom']}  {s['desc']}")

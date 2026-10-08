"""Construit plan.json du reel « waking up here » (réveil à bord) : copie exacte du découpage du reel de référence
(Evasion de charme, envoyé par Robin le 08/10/2026), avec les rushes d'Harmonie Yacht (dossier Drive de Robin).
Usage (depuis le projet) : python3 -I tools/plan.py

Référence (30 i/s) : 8 plans fixes, coupés aux images 50, 96, 132, 165, 186, 216, 236 ; légende « waking up here »
fixe au milieu de l'image du début à la fin ; écran de fin Instagram à 9,13 s (image 274), retiré à la demande de Robin :
la vidéo s'arrête là (la musique est silencieuse de 9,1 à 9,5 s, la fin tombe donc sans coupure audible).
Passages vérifiés image par image (pas de doigt, pas de visage face caméra, pas de logo « NEXT YACHT » visible).
Rushes à 60 i/s ralentis ×2 (ralenti exact) pour retrouver le calme des plans fixes de la référence.
"""
import json

FPS = 30
END = 274
CUTS = [0, 50, 96, 132, 165, 186, 216, 236, END]
# (rush, début source s, ralenti, zoom, ax, ay, rôle dans la référence → notre plan)
SHOTS = [
    ('N17', 0.30, 2, 1, .5, .5, 'chambre (grand plan) → la cabine principale, le lit aux pétales « LOVE »'),
    ('N09', 0.25, 1, 1, .5, .5, 'petit déjeuner → la table du carré, jus d’orange et viennoiseries'),
    ('N12', 0.20, 2, 1, .5, .5, 'la terrasse → sortie du port de Carnon au coucher du soleil, les invitées de dos à table'),
    ('N22', 0.50, 2, 1, .5, .5, 'vue depuis l’abri → sous le bimini, le port en fond'),
    ('N23', 0.40, 2, 1, .5, .5, 'la femme qui sort → les deux invitées sur la plage avant, face à la mer, de dos'),
    ('N08', 0.60, 1, 1.2, .5, 0.0, 'le lit et la fenêtre → le lit « LOVE », plan fixe (recadré : « LOVE » sous la légende)'),
    ('N19', 1.50, 2, 1, .5, .5, 'le détail (livre et café) → les pétales et le cœur sur le lit'),
    ('N01', 13.00, 1, 1.25, .5, 0.0, 'la lumière dorée → le yacht au coucher du soleil (recadré : bateau sous la légende)'),
]
assert len(SHOTS) == len(CUTS) - 1
plan = {'fps': FPS, 'total_frames': END, 'cuts': CUTS, 'shots': []}
for i, (rush, ss, slow, zoom, ax, ay, desc) in enumerate(SHOTS):
    f0, f1 = CUTS[i], CUTS[i + 1]
    plan['shots'].append({'n': i + 1, 'f0': f0, 'f1': f1, 'rush': rush, 'src_start': ss, 'src_dur': round((f1 - f0) / FPS / slow, 4),
                          'slow': slow, 'zoom': zoom, 'ax': ax, 'ay': ay, 'desc': desc})
plan['caption'] = {'texte': 'waking up here', 'f0': 0, 'f1': END}
json.dump(plan, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for s in plan['shots']:
    print(f"{s['n']} {s['f0'] / FPS:5.2f}–{s['f1'] / FPS:5.2f} ({s['f1'] - s['f0']:3d} img) {s['rush']} src {s['src_start']:.2f}+{s['src_dur']:.2f} ×{s['slow']} zoom {s['zoom']}  {s['desc']}")

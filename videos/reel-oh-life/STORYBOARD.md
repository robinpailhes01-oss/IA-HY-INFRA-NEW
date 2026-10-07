---
canvas: { w: 1080, h: 1920, fps: 30 }
duration_s: 27.2333
mode: collaborative
---

# Storyboard — reel « oh, life » (version Harmonie Yacht)

Validé par Robin le 07/10/2026.
Ce projet reprend le découpage exact du reel de référence : il n'utilise ni `validate-plan.mjs` ni `assemble-index.mjs`.
`index.html` est généré par `tools/build_index.py` à partir de `lyrics.json` (placement et couleurs calculés par `tools/lyrics_style.py`).

Récit : une journée à bord qui se termine au coucher de soleil ; on ouvre sur le plus beau plan pour accrocher dès la 1re image.

| Plan | Temps (s) | Paroles | Rush | Passage source | Vitesse |
|---|---|---|---|---|---|
| 1 | 0,00 – 3,43 | oh, life | 11 · proue, ciel flamboyant | 5,00 → 6,72 s | ralenti ×2 (120 i/s) |
| 2 | 3,43 – 6,03 | it’s bigger (dès 3,47) | 02 · mer d'huile | 0,00 → 1,95 s | ralenti ×1,33, images interpolées |
| 3 | 6,03 – 8,03 | it’s bigger than you | 04 · proue vers le groupe | 0,70 → 2,70 s | normale |
| 4 | 8,03 – 9,53 | and you are not me (dès 8,07) | 07 · bain de soleil, ciel dégagé | 1,00 → 2,50 s | normale |
| 5 | 9,53 – 11,07 | *(suite)* | 05 · femme face au sillage | 0,50 → 2,03 s | normale |
| 6 | 11,07 – 13,63 | the lengths that I will go to (dès 11,13) | 08 · groupe debout à l'avant | 0,00 → 2,57 s | normale |
| 7 | 13,63 – 17,93 | the distance in your eyes (dès 14,63) | 06 · pieds, eau turquoise (saturation adoucie) | 0,30 → 4,60 s | normale |
| 8 | 17,93 – 20,43 | — | 03 · femme à table, verres | 0,00 → 2,50 s | normale |
| 9 | 20,43 – 24,07 | oh, no, I’ve said too much | 10 · ciel rose, deux personnes (horizon redressé) | 1,10 → 2,92 s | ralenti ×2 (60 i/s) |
| 10 | 24,07 – 27,23 | I haven’t said enough (dès 25,03) | 09 · proue vers le cockpit | 0,50 → 2,08 s | ralenti ×2 (60 i/s) |

Écriture : Instrument Serif 72 px, centrée, une phrase à la fois, casse des paroles d'origine ; couleur tirée de chaque plan (règle DESIGN.md), contrôlée mot par mot et image par image ; pas de voile ; apparition en 2 images, disparition franche à la coupe, aux images exactes du reel de référence.

Révision v2 (après relecture du brouillon) : plans 4, 6 et 8 changés (tête sous le texte, bras et personne qui entrent dans le cadre), doigt évité au plan 9, ralentis réguliers, temps calculés à l'image près.
Coupes : franches, comme l'original. Pas de logo (le reel de référence n'en a pas ; usage du logo à confirmer dans DESIGN.md).

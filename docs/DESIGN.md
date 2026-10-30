# Tableau de bord Harmonie Yacht — spec de design

Document de référence. Toute décision de couleur, de typo ou d'espacement dans
l'application doit pouvoir se justifier par une ligne de ce fichier. Si quelque
chose n'y est pas, c'est que ça n'aurait pas dû être écrit en dur dans un
composant.

---

## 0. Ce qui n'allait pas (à lire avant de modifier quoi que ce soit)

Le rendu mobile d'octobre 2026 affichait tout le tableau de bord en **Times New
Roman**. Personne ne l'avait choisi. La cause est une seule ligne de
`globals.css` :

```css
@theme inline {
  --font-sans: var(--font-display);  /* ligne 9  */
  --font-sans: var(--font-sans);     /* ligne 12 — écrase la 9 */
}
```

Une custom property CSS qui se référence elle-même est **invalide**. `font-family:
var(--font-sans)` devient alors invalide au calcul, et le navigateur retombe sur
sa valeur initiale : une serif système. Sur iPhone, Times.

Deux conséquences à retenir :

1. **Ne jamais écrire `--x: var(--x)`** dans `@theme`. Si une variable de thème
   doit pointer vers une police chargée par `next/font`, les deux noms doivent
   être différents (`--font-sans` ↔ `--font-instrument-sans`).
2. Une pile `-apple-system, 'SF Pro Display', …` n'est pas une typographie, c'est
   un pari sur l'appareil du lecteur. Le dashboard charge désormais ses propres
   polices : le rendu est le même sur iPhone, sur un PC et sur une capture.

---

## 1. Type de projet

**Dashboard / admin.** Ce n'est ni une landing page ni une vitrine. Les règles
qui en découlent, et qui priment sur toute considération esthétique :

- La **densité d'information est le problème de design**, pas la décoration.
- La hiérarchie se fait par **taille, graisse et espacement** — jamais par la
  couleur. La couleur est réservée au sens (positif / négatif / à faire).
- **La lisibilité de la donnée gagne tous les arbitrages.** Si un effet rend un
  chiffre plus beau et moins lisible, l'effet saute.
- La navigation est de l'infrastructure : elle reste discrète.
- Le mouvement sert les changements d'état. Il ne décore pas.

## 2. Positionnement

Robin pilote seul une entreprise de location de yacht à Carnon. Il ouvre ce
tableau de bord sur son iPhone, souvent debout, souvent entre deux sorties. Il
vient y chercher trois choses, dans cet ordre :

1. Est-ce que quelqu'un attend une réponse de moi ?
2. Combien j'ai en banque, et combien je vais encaisser ?
3. Qu'est-ce qui sort cette semaine ?

**UVP du produit :** donner à Robin, en cinq secondes et à une main, l'état réel
de son entreprise — pas un rapport, une décision.

**Paire d'archétypes :** le *Souverain* (maîtrise, calme, chiffres nets) + le
*Navigateur* (le domaine réel : la mer, le carnet de bord, la météo).

**Ce contre quoi on se positionne :** les dashboards SaaS qui empilent des
cartes arrondies grises identiques, et les interfaces « fintech » qui mettent
du dégradé violet sur un fond ardoise.

## 3. Direction esthétique

> **La rigueur d'un terminal financier + la lumière d'une aurore sur la mer.**

Deux corrections successives ont mené ici, et les deux comptent :

1. Tout était en Times à cause d'une variable CSS cassée (§0).
2. En corrigeant, j'ai poussé « épuré » trop loin : surfaces à plat, grain
   supprimé, fond réduit à deux halos pâles. Techniquement propre, visuellement
   **terne** — un seul bleu désaturé partout, et le verre avait disparu.

La version actuelle garde la discipline typographique mais rend la matière et
la couleur.

### Le verre : la saturation, pas le flou

Ce qui fait qu'une surface se lit comme du verre et non comme un rectangle
flou, c'est **`saturate(200%)` accolé au `blur()`**. Le flou seul grise ce qu'il
y a derrière ; avec la saturation, la couleur du fond remonte à travers la
plaque et chaque carte prend la teinte de ce qui passe dessous.

Trois autres détails, anodins séparément, décisifs ensemble :

- un **dégradé interne** — la plaque est plus claire en haut, comme une vitre
  inclinée vers la lumière ;
- un **liseré clair** sur l'arête supérieure ;
- un **reflet d'angle** en haut à gauche. Une seule source lumineuse pour toute
  la page, sinon l'illusion d'épaisseur tombe.

### Le fond : il faut quelque chose à réfracter

Un effet de verre sur un fond uni ne se voit pas. Le fond porte donc quatre
halos saturés (aqua, indigo, or, bleu) **plus un ruban lumineux en diagonale**,
emprunté aux aurores. C'est ce ruban que les cartes attrapent quand elles
passent devant — et c'est la raison pour laquelle le verre paraissait absent
dans la version précédente.

Les dégradés sont sur un pseudo-élément **fixe** : `background-attachment: fixed`
est rendu de travers par Safari iOS et laissait une cassure horizontale.

### La couleur : quatre accents, pas un

Quatre cartes identiques se fondent en un bloc gris. Chaque indicateur porte
donc sa couleur — un halo diffus dans l'angle, un filet teinté, et le chiffre
lui-même pour la carte principale.

**Ce qu'on s'interdit toujours :** la grille de trois cartes à icônes, l'accent
bleu-violet réflexe sur fond ardoise, l'ombre portée douce sur tout ce qui est
rectangulaire.

## 4. Tokens

### Couleur

| Rôle | Valeur | Emploi |
| --- | --- | --- |
| `background` | `#04101D` | fond de page |
| `aqua` | `#3FC8D8` | la mer — réservations |
| `indigo` | `#7B8BFF` | le large — leads |
| `success` | `#2FD68E` | le résultat — marge |
| `gold` | `#E8C063` | l'argent — trésorerie, signature, pic du graphique |
| `info` | `#4A7DFF` | actions, liens |
| `danger` / `warning` | `#FF5C68` / `#FFB547` | alertes |
| `foreground` | `#F2F6FA` | texte principal |
| `muted-foreground` | `#95A8BE` | libellés, légendes |
| `hairline` | `rgba(255,255,255,.11)` | le filet des plaques |

Les accents disent quelque chose. Aucun n'est décoratif.

### Typographie — trois fontes, trois rôles qui ne se chevauchent jamais

| Fonte | Rôle | Où exactement |
| --- | --- | --- |
| **Bricolage Grotesque** (600) | les titres | titre de page, titres de carte, panneau signature |
| **Plus Jakarta Sans** (400–700) | le texte | libellés, prose, légendes |
| **Geist Mono** (500) | **tous les chiffres** | KPI, montants, scores, info-bulles |

Bricolage remplace la serif éditoriale : même ambition de caractère, registre
contemporain, et elle tient à toutes les tailles là où une serif à 12 px sur
fond marine devenait illisible.

**L'interlettrage des chiffres est légèrement positif** (`+0.005em`), à rebours
du réflexe « grand titre = resserré ». Serrés, les chiffres s'agglutinent en une
masse qu'on déchiffre ; aérés, chacun reste une unité qu'on lit d'un coup.

**Piège français :** `Intl.NumberFormat('fr-FR')` sépare les milliers par U+202F
et précède le € d'un U+00A0. En monospace, tout caractère occupe la même chasse
— « 49 800 € » s'affiche « 49  800  € » et l'œil lit deux nombres.
`word-spacing` n'y peut rien (la spec CSS ne compte que U+0020 comme séparateur).
`components/ui/num.tsx` rend ces seuls caractères dans la proportionnelle.
**Tout nombre affiché doit passer par `<Num>`.**

### Échelle typographique

| Classe | Taille | Graisse | Usage |
| --- | --- | --- | --- |
| `.t-page` | 32 → 44 px (display) | 600 | titre de page, un par écran |
| `.t-panel` | 21,6 px (display) | 600 | titre du panneau signature |
| `.t-card` | 16 px (display) | 600 | titre de carte |
| `.t-label` | **11 px, CAPITALES, +0.1em** | 600 | toute étiquette de valeur |
| `.n-hero` | 31 → 43 px (mono) | 500 | le chiffre principal de l'écran |
| `.n-gradient` | — | — | remplissage dégradé, **un seul chiffre par page** |
| `.n-kpi-lead` | 26 → 32 px (mono) | 500 | KPI mis en avant (un seul) |
| `.n-kpi` | 23 → 28 px (mono) | 500 | KPI courant |
| `.n-inline` | hérite (mono) | 500 | chiffre dans une ligne |
| `.t-body` | 14 px | 400 | prose |
| `.t-caption` | 11,5 px | 400 | précision sous un chiffre |
| `.pastille` | 11 px | 500 | variation, étiquette de contexte |

### Espacement, rayons, ombres, mouvement

- **Base 4 px** : `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`.
- **Rayon** : 18 px sur les cartes, 32 px sur la coque. Une seule philosophie.
- **Ombres** : une seule, douce et très large, sous les plaques de verre. Pas
  d'ombre sur autre chose.
- **Mouvement** : `120 ms` micro-retour, `240 ms` transition, `620 ms` entrée.
  Courbe unique `cubic-bezier(.32,.72,0,1)`, version `prefers-reduced-motion`
  systématique.

## 5. Élément signature

**Le panneau clair « Prochaines sorties »** : une plaque blanche posée sur le
bleu de nuit. Un seul par écran.

Sur un fond sombre, un panneau sombre se fond et perd son rôle d'ancrage —
l'inversion est volontaire, et c'est le seul élément autorisé à rompre avec le
reste. Son halo doré et son ombre portée ont été retirés : l'inversion suffit
largement, le reste n'était que du décor par-dessus.

## 6. Passe mobile

Le mobile est le cas principal, pas une réduction du bureau.

- Les KPI passent en grille 2×2. **Plus d'icône** : elle ne distinguait rien
  (quatre cartes, quatre icônes, aucune information en plus) et coûtait un tiers
  de la largeur, ce qui écrasait le chiffre qu'on vient précisément lire.
- Les blocs s'ordonnent indépendamment des colonnes du bureau : sur téléphone
  CA → prochaines sorties → leads → objectif, via `contents` + `order` (voir le
  commentaire dans `app/(dashboard)/page.tsx`).
- Le graphique n'affiche qu'une étiquette de mois sur deux au-delà de dix mois,
  en gardant toujours celle du mois le plus fort.
- Le bloc de libellé a une hauteur minimale de deux lignes sous `lg`, pour que
  les quatre chiffres s'alignent entre eux.
- Cibles tactiles ≥ 44 px.
- Pas d'effet au survol : il n'y a pas de survol sur un téléphone.
- `100dvh` et non `100vh`.

## 7. Vérification

Une capture d'écran à 390 px et une à 1440 px, à chaque modification de l'un des
fichiers suivants : `app/globals.css`, `app/layout.tsx`,
`components/dashboard/kpi-card.tsx`.

Et `npm run build` avant chaque push. `tsc` et `eslint` ne voient pas les
erreurs de frontière serveur/client, ni les polices cassées.

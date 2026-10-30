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

> **La rigueur d'un terminal financier + la retenue d'un carnet de bord.**

Référence prise sur les tableaux de bord les mieux dessinés (Linear, Vercel,
les blocs analytiques de 21st.dev). Trois choses y reviennent systématiquement,
et aucune ne coûte cher :

1. **Les libellés sont en capitales, petits, très espacés.** « TRÉSORERIE
   RÉELLE » se lit comme une étiquette de cadran ; « Trésorerie réelle » se lit
   comme du texte et entre en concurrence avec le chiffre qu'il annonce.
2. **Les chiffres sont en chasse fixe.** Un montant en proportionnelle se lit
   comme du texte ; en monospace il se lit comme de la donnée. Sur un tableau
   de bord financier, c'est aussi le registre du livre de comptes.
3. **Les surfaces sont franches.** Un filet d'un demi-pixel, pas d'ombre, pas
   de flou, pas de grain.

**Ce qu'on s'interdit :** la grille de trois cartes à icônes, l'accent
bleu-violet réflexe, l'ombre portée douce sur tout ce qui est rectangulaire.

### Un seul objet en verre

Avant, chaque carte était floutée, saturée, ombrée et grainée. Empilés, ces
effets ne produisent pas de la profondeur mais du bruit : plus rien ne ressort
parce que tout ressort.

Désormais **la coque est la seule plaque de verre** (`.vitre-shell`) ; tout ce
qui est posé dessus est plat (`.vitre`, `Card`). Le grain a été supprimé, et le
fond est passé de quatre halos à deux.

C'est ça, « épuré » : moins d'effets, des contours plus nets.

## 4. Tokens

### Couleur

| Rôle | Valeur | Emploi |
| --- | --- | --- |
| `background` | `#06121F` | fond de page |
| `surface` | `rgba(255,255,255,.045)` | la coque en verre, et elle seule |
| `plaque` | `rgba(255,255,255,.032)` | les cartes — opaques, franches |
| `hairline` | `rgba(255,255,255,.09)` | le filet qui sépare, à la place des ombres |
| `foreground` | `#F2F6FA` | texte principal |
| `muted-foreground` | `#8A9BB0` | libellés, légendes |
| `gold` | `#C9A84C` | **accent unique** — signature, pic du graphique, carte principale |
| `success` / `danger` / `warning` | `#10B981` / `#EF4444` / `#F59E0B` | sens uniquement |

L'or ne décore **jamais**. Il marque soit le panneau signature, soit une valeur
qui demande une décision.

### Typographie — trois fontes, trois rôles qui ne se chevauchent jamais

| Fonte | Rôle | Où exactement |
| --- | --- | --- |
| **Instrument Sans** (400–700) | tout le texte | libellés, titres de carte, prose |
| **Geist Mono** (500) | **tous les chiffres** | KPI, montants, scores, info-bulles |
| **Instrument Serif** (400) | accent éditorial | titre de page + titre du panneau signature. **Deux emplois par écran.** |

Note : la mono avait été retirée à l'étape précédente, au motif qu'elle n'avait
pas d'emploi légitime. C'était vrai de la mono dans la **prose**. C'est faux des
**chiffres** — et c'est précisément là que les meilleurs tableaux de bord
l'emploient.

**L'interlettrage des chiffres est légèrement positif** (`+0.005em`), à rebours
du réflexe « grand titre = resserré ». Serrés, les chiffres s'agglutinent en une
masse qu'on déchiffre ; aérés, chacun reste une unité qu'on lit d'un coup.

**Piège français :** `Intl.NumberFormat('fr-FR')` sépare les milliers par U+202F
et précède le € d'un U+00A0. En monospace, tout caractère occupe la même chasse
— « 49 800 € » s'affiche « 49  800  € » et l'œil lit deux nombres.
`word-spacing` n'y peut rien (la spec CSS ne compte que U+0020 comme séparateur).
Le composant `components/ui/num.tsx` rend ces seuls caractères dans la
proportionnelle, où une espace fine est enfin fine. **Tout nombre affiché doit
passer par `<Num>`.**

### Échelle typographique

| Classe | Taille | Graisse | Usage |
| --- | --- | --- | --- |
| `.t-page` | 30 → 41 px (serif) | 400 | titre de page, un par écran |
| `.t-panel` | 21 px (serif) | 400 | titre du panneau signature |
| `.t-card` | 15 px | 600 | titre de carte |
| `.t-label` | **11 px, CAPITALES, +0.1em** | 600 | toute étiquette de valeur |
| `.n-hero` | 31 → 43 px (mono) | 500 | le chiffre principal de l'écran |
| `.n-kpi-lead` | 26 → 32 px (mono) | 500 | KPI mis en avant (un seul) |
| `.n-kpi` | 23 → 28 px (mono) | 500 | KPI courant |
| `.n-inline` | hérite (mono) | 500 | chiffre dans une ligne |
| `.t-body` | 14 px | 400 | prose |
| `.t-caption` | 11,5 px | 400 | précision sous un chiffre |
| `.pastille` | 11 px | 500 | variation, étiquette de contexte |

### Espacement, rayons, ombres, mouvement

- **Base 4 px** : `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`.
- **Rayon** : 18 px sur les cartes, 32 px sur la coque. Une seule philosophie.
- **Ombres** : aucune, sauf sous la coque. Les surfaces se séparent par leur
  filet. C'est le changement le plus structurant de cette version.
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

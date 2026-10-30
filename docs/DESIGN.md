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

> **La discipline typographique de Linear + la retenue d'un carnet de bord de
> marine.**

De Linear : une seule famille sans serif pour 95 % de l'interface, un
interlettrage resserré sur les grandes tailles, des chiffres à chasse fixe, un
fond sombre qui n'est jamais un aplat noir.

Du carnet de bord : le bleu de nuit et l'or de l'identité Harmonie Yacht, une
serif éditoriale employée **deux fois par écran et pas une de plus**, et des
libellés qui disent ce qu'ils mesurent plutôt que de porter un nom de métrique.

Ce qu'on s'interdit explicitement : la grille de trois cartes à icônes, l'accent
bleu-violet réflexe, l'ombre portée douce sur tout ce qui est rectangulaire.

## 4. Tokens

### Couleur

| Rôle | Valeur | Emploi |
| --- | --- | --- |
| `background` | `#06121F` | fond de page, sous le verre |
| `card` / `surface` | `rgba(255,255,255,.055)` | plaques de verre |
| `foreground` | `#F2F6FA` | texte principal |
| `muted-foreground` | `#8A9BB0` | libellés, légendes |
| `gold` | `#C9A84C` | **accent unique** — signature, pic du graphique, montants à encaisser |
| `success` / `danger` / `warning` | `#10B981` / `#EF4444` / `#F59E0B` | sens uniquement, jamais décoratif |

L'or ne sert **jamais** à décorer. Il marque soit le panneau signature, soit une
valeur qui demande une décision.

### Typographie — trois fontes, trois rôles qui ne se chevauchent jamais

| Fonte | Rôle | Où exactement |
| --- | --- | --- |
| **Instrument Sans** (400–700) | 95 % de l'interface, **chiffres compris** | tout, sauf les deux cas ci-dessous |
| **Instrument Serif** (400) | accent éditorial | titre de page + titre du panneau signature. **Deux emplois par écran.** |
| mono **système** (`ui-monospace`) | colonnes de données alignées | tableaux, horodatages. **Jamais de prose.** |

Deux polices téléchargées, pas trois. La mono n'a aujourd'hui aucun emploi
légitime dans l'application — les chiffres de l'interface sont déjà à chasse
fixe en Instrument Sans. Faire télécharger JetBrains Mono sur un réseau mobile
pour des cas qui n'existent pas serait du poids gratuit ; `ui-monospace` rend
SF Mono sur l'iPhone de Robin, gratuitement. À réintroduire le jour où un vrai
tableau de données l'exige.

Trois règles qui expliquent ces choix :

- **Les chiffres sont en sans, pas en serif.** `49 800 €` en serif ressemble à
  un faire-part ; en Instrument Sans 600 avec chasse fixe, ça ressemble à de
  l'argent. Les chiffres sont la raison d'être de l'écran.
- **Instrument Sans est étroite.** Sur une carte de 150 px de large sur iPhone,
  un libellé y tient en deux lignes là où Inter en demandait trois. C'est ce qui
  règle le problème de débordement, bien plus que de réduire le corps.
- **La mono ne touche pas la prose.** « comptable · pas la trésorerie » en
  JetBrains Mono tenait sur trois lignes et ressemblait à un message d'erreur.

Pour revenir à une interface 100 % sans serif : passer `--font-title` à
`var(--font-instrument-sans)` dans `globals.css`. Un seul endroit.

### Échelle typographique

Base 4 px, resserrée pour une interface dense. Les tailles sont des classes, pas
des valeurs arbitraires dans les composants.

| Classe | Taille | Graisse | Usage |
| --- | --- | --- | --- |
| `.t-page` | 30 → 41 px (serif) | 400 | titre de page, un par écran |
| `.t-panel` | 21 px (serif) | 400 | titre du panneau signature |
| `.t-card` | 16 px | 600 | titre de carte |
| `.n-hero` | 32 → 46 px | 600 | le chiffre principal de l'écran |
| `.n-kpi-lead` | 27 → 34 px | 600 | KPI mis en avant (un seul) |
| `.n-kpi` | 24 → 30 px | 600 | KPI courant |
| `.n-inline` | hérite | 600 | chiffre dans une phrase |
| `.t-label` | 12,5 px | 500 | libellé de KPI |
| `.t-body` | 14 px | 400 | prose |
| `.t-caption` | 11,5 px | 400 | légende, précision sous un chiffre |

Toutes les classes `.n-*` portent `tabular-nums lining-nums` : les colonnes
s'alignent et le nombre ne tressaute pas pendant son animation de comptage.

### Espacement, rayons, ombres, mouvement

- **Base 4 px** : `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`.
- **Rayon** : plafond à 22 px sur les cartes, 32 px sur la coque. Une seule
  philosophie — pas de carte à 8 px à côté d'une carte à 24 px.
- **Ombres** : portées très larges et très douces, uniquement sur les surfaces
  en verre, plus un liseré clair intérieur en haut (la tranche éclairée de la
  plaque). Rien d'autre ne porte d'ombre.
- **Mouvement** : `120 ms` micro-retour, `240 ms` transition, `620 ms` entrée de
  page. Courbe unique `cubic-bezier(.32,.72,0,1)`. Toute animation a sa version
  `prefers-reduced-motion`.

## 5. Élément signature

**Le panneau clair « Prochaines sorties »** : une plaque blanche posée sur le
bleu de nuit, avec un halo doré. Un seul par écran.

Sur un fond sombre, un panneau sombre se fond et perd son rôle d'ancrage —
l'inversion est volontaire. C'est le seul élément autorisé à rompre avec le
reste, et c'est pour ça qu'il fonctionne : il porte ce que Robin vient voir en
premier.

## 6. Passe mobile

Le mobile est le cas principal, pas une réduction du bureau.

- Les KPI passent en grille 2×2. **Le libellé et l'icône occupent une ligne, le
  chiffre récupère ensuite toute la largeur de la carte** — c'est la différence
  entre un chiffre lisible et un chiffre coupé.
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

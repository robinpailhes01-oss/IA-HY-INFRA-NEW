# Tableau de bord Harmonie Yacht — spec de design « Verre glacier »

Document de référence. Toute décision de couleur, de typo, d'espacement ou de
structure doit pouvoir se justifier par une ligne de ce fichier. Si quelque
chose n'y est pas, c'est que ça n'aurait pas dû être écrit en dur dans un
composant.

Refonte de novembre 2026 : on quitte le thème sombre « terminal financier »
pour un verre clair — blanc, bleu ciel, bleu marine — et une architecture en
quatre espaces pilotée par l'agent IA.

---

## 0. Pièges connus (à lire avant de modifier quoi que ce soit)

1. **Ne jamais écrire `--x: var(--x)`** dans `@theme`. Une custom property qui
   se référence elle-même est invalide : tout le tableau de bord retombait en
   Times New Roman sur iPhone (octobre 2026). Les noms de `next/font`
   (`--font-geist`, `--font-instrument`) restent distincts des tokens Tailwind
   (`--font-sans`, `--font-serif`).
2. **Frontière serveur/client** : on ne passe ni fonction ni composant à un
   composant client. Une icône passe en élément déjà rendu (`icon={<Users />}`),
   un format passe en chaîne (`unit="eur"`), jamais en fonction.
3. **`useReducedMotion()` est interdit** dans les composants rendus côté serveur :
   il renvoie une valeur différente au serveur et au client (erreur
   d'hydratation). Le réglage est global : `MotionProvider` (`reducedMotion="user"`).
4. **`Intl.NumberFormat('fr-FR')`** insère U+202F et U+00A0 : tout nombre affiché
   passe par `<Num>` (ou `AnimatedNumber`, qui l'utilise).

---

## 1. Type de projet et positionnement

**Dashboard interne**, utilisé surtout sur iPhone, debout, entre deux sorties.
Robin y cherche trois choses, dans cet ordre :

1. Est-ce que quelqu'un attend une réponse de moi ?
2. Combien j'ai en banque, et combien je vais encaisser ?
3. Qu'est-ce qui sort cette semaine ?

**UVP :** l'état réel de l'entreprise en cinq secondes, à une main — et l'agent
IA qui dit quoi faire ensuite. Le tableau de bord d'une entreprise à plusieurs
millions tenue par très peu de personnes, parce qu'elles sont organisées.

**Archétypes :** le *Souverain* (maîtrise, calme, chiffres nets) + le
*Navigateur* (la mer, le carnet de bord, la météo).

**Contre quoi on se positionne :** les dashboards SaaS gris qui empilent des
cartes identiques, le dégradé violet réflexe, le « glassmorphism » flou et
illisible. Ici le verre est une matière construite, pas un filtre.

## 2. Architecture — quatre espaces

Source de vérité : `lib/navigation.ts`. Ajouter une page = l'y déclarer.

| Espace | URL | Sous-onglets |
| --- | --- | --- |
| **Vue d'ensemble** | `/` | — (le cockpit : brief de l'agent IA) |
| **Agent WhatsApp** | `/agent` | Pilotage `/agent` · Conversations `/agent/conversations` · Leads `/leads` · Résultats `/resultats` |
| **Réseaux sociaux** | `/social` | Vue d'ensemble `/social` · Audience du site `/analytics` · Visibilité SEO `/seo` |
| **Finance** | `/finances` | Vue d'ensemble `/finances` · Réservations `/bookings` · Rapports `/reports` |
| *Outils* (repliés) | — | Événements, Archives clients, Jarvis, Paramètres |

- Les **sous-onglets** sont rendus automatiquement dans l'en-tête
  (`components/shell/section-tabs.tsx`) d'après l'URL. Une page ne les
  redessine jamais elle-même.
- **Bureau (≥ 1024 px)** : barre latérale de verre flottante + en-tête
  (sous-onglets, recherche ⌘K, état de Léa, cloche « à traiter », profil).
- **Téléphone** : marque + cloche + profil en haut, sous-onglets défilables
  dessous, **barre d'onglets flottante en bas** (4 espaces + « Plus »).
  Le contenu garde `pb-32` pour ne pas passer sous la barre.

## 3. Direction esthétique

> **Une plaque de verre sur la Méditerranée un matin d'hiver.**

### Le fond — il faut quelque chose à réfracter

`.app-ambient` : nappes de bleu ciel, lavande, lagon et glace sur un blanc
bleuté (`#EDF3FA`), plus une bande de lumière en diagonale. Sur un pseudo-
élément **fixe** (Safari iOS rend `background-attachment: fixed` de travers).

### Le verre — trois épaisseurs, une seule lumière (haut-gauche)

| Classe | Emploi | Recette |
| --- | --- | --- |
| `.vitre` | carte standard (c'est ce que rend `<Card>`) | blanc 84 → 62 %, `blur(24px) saturate(175%)`, bord blanc 1 px, arête claire, ombre marine large, reflet d'angle |
| `.vitre-shell` | barre latérale, barre d'onglets | plus clair, plus flou |
| `.vitre-strong` | menus, dialogues, sheets, info-bulles | blanc 90 %, lisible quoi qu'il y ait derrière |
| `.vitre-inset` | puits dans une carte : rail, champ, ligne mise en avant, état vide | glace 72 %, ombre intérieure |
| `.vitre-signature` | **LE panneau marine** — un seul par page | dégradé marine + aurore animée |

Le **bord du verre est blanc, jamais gris** : c'est la tranche qui capte la
lumière. Les séparateurs internes utilisent `--hairline` (marine 8 %).

### Le panneau signature

Tout est clair sauf **un** panneau par page, en marine des grands fonds
(`SignaturePanel` / `.vitre-signature`). C'est là que **parle l'agent IA** :
son brief, sa recommandation, son état. L'inversion est le seul élément
autorisé à rompre.

### La forme

- **Rayons** : 24 px carte · 28 px panneau signature et dialogue · 30 px barre
  latérale · **pilule (`rounded-full`) pour TOUT ce qui se clique** : boutons,
  onglets, champs, filtres, pastilles. Icônes de contrôle dans des cercles.
- **Ombres** : uniquement celles des tokens (`--shadow-glass`, `--shadow-lift`).
- **Espacement** : base 4 px — `4 / 8 / 12 / 16 / 20 / 24 / 32 / 48`. Gouttière
  entre cartes : `gap-4` (mobile) → `gap-5` (bureau).

## 4. Tokens

### Couleur — la gamme maritime

| Token Tailwind | Valeur | Rôle |
| --- | --- | --- |
| `navy` | `#0B2545` | texte fort, bouton principal, panneau signature, icône active |
| `ocean` | `#2F7FE0` | action : liens, sélection, série principale |
| `sky` | `#7CC0F5` | séries secondaires, halos |
| `ice` | `#DCEBFA` | fonds de pastilles, rails |
| `foam` | `#F4F8FC` | survol de ligne |
| `aqua` | `#22A7BF` | la mer — réservations |
| `indigo` | `#6D7CF2` | le large — leads |
| `whatsapp` | `#1FAE5B` | **réservé** au canal WhatsApp |
| `gold` | `#A47E2C` | laiton de la marque — un détail par écran, jamais un aplat |
| `success` / `warning` / `danger` | `#0F9F6E` / `#D9822B` / `#E04D55` | sens uniquement |
| `foreground` | `#0B1B33` | texte principal |
| `ink-2` | `#4B5B73` | texte secondaire |
| `ink-3` | `#8394AB` | légendes, sur-titres |

**La couleur porte du sens, jamais de la décoration.** La hiérarchie se fait
par taille, graisse et espacement.

### Typographie — deux familles

| Fonte | Rôle |
| --- | --- |
| **Instrument Serif** (400, + italique) | la **voix** : titre de page (`.t-page`), panneau signature (`.t-panel`), salutation, phrase de l'agent. Un mot en `<em>` passe en italique océan — un seul par titre. |
| **Geist** (400–600) | tout le reste : interface, libellés, **chiffres** (tabulaires) |
| Geist Mono | identifiants techniques seulement (numéros masqués, références) |

| Classe | Usage |
| --- | --- |
| `.t-page` | titre de page, serif 33 → 46 px, un par écran |
| `.t-panel` | titre du panneau signature, serif 26 → 33 px |
| `.t-card` | titre de carte, Geist 15 px 600 |
| `.t-eyebrow` | sur-titre : **la seule capitale espacée** de l'interface |
| `.t-label` | libellé de valeur, 12,8 px 500, en phrase (pas de capitales) |
| `.n-hero` | LE chiffre de l'écran, 37 → 54 px, 500, −0,045 em |
| `.n-kpi-lead` / `.n-kpi` | chiffres de carte KPI |
| `.n-gradient` | dégradé marine → océan, **un seul chiffre par page** |
| `.n-inline` | chiffre dans une ligne |
| `.t-body` / `.t-caption` | prose 14 px / légende 12 px |
| `.pastille` | variation, étiquette de contexte (pilule) |

### Mouvement

Une courbe (`--ease-ios`), trois durées : 120 ms retour, 240 ms transition,
620 ms entrée (`.rise`, `MotionCard`). Les onglets glissent (`layoutId`).
`prefers-reduced-motion` respecté partout (CSS + `MotionProvider`).

## 5. Le kit — à utiliser plutôt que réécrire

| Composant | Fichier | Pour |
| --- | --- | --- |
| `PageHeader` | `components/shell/page-header.tsx` | sur-titre + titre serif + phrase + actions |
| `Card*` | `components/ui/card.tsx` | toute carte (verre) |
| `KpiCard` | `components/dashboard/kpi-card.tsx` | chiffre clé : icône teintée, valeur animée, variation, courbe, lien |
| `SignaturePanel` | `components/dashboard/signature-panel.tsx` | le panneau marine de la page |
| `TrendChart` | `components/charts/trend-chart.tsx` | aire ou barres, 1–2 séries (client, recharts) |
| `Sparkline` | `components/charts/sparkline.tsx` | tendance sans axe (serveur) |
| `RingGauge` | `components/charts/ring-gauge.tsx` | anneau de progression (serveur) |
| `CapsuleChart` | `components/dashboard/capsule-chart.tsx` | barres mensuelles en capsules |
| `Segmented` | `components/dashboard/segmented.tsx` | contrôle segmenté iOS |
| `EmptyState` | `components/ui/empty-state.tsx` | place réservée quand il n'y a pas encore de données |
| `Button` | `components/ui/button.tsx` | pilules : `default` marine, `outline` verre, `secondary` glace, `ghost` |
| `Badge` | `components/ui/badge.tsx` | variantes + `glass` |
| `LeaStatusPill`, `useLeaStatus` | `components/lea-status-pill.tsx` | état en direct de l'agent |

## 6. Passe mobile

Le mobile est le cas principal, pas une réduction du bureau.

- KPI en grille 2 × 2 ; le chiffre ne doit jamais être écrasé par une icône.
- Cibles tactiles ≥ 44 px. Pas d'information disponible seulement au survol.
- `100dvh`, jamais `100vh`. Rien ne passe sous la barre d'onglets.
- Aucun défilement horizontal de page ; les rangées d'onglets défilent seules.

## 7. Vérification

**Mode démo** — prévisualisation locale sans base réelle (jamais actif en
production, voir `lib/demo/mode.ts`) :

```bash
NEXT_PUBLIC_HY_DEMO=1 npm run dev
```

Les données fictives vivent dans `lib/demo/fixtures/` (déterministes, datées
relativement à aujourd'hui).

À chaque modification de `app/globals.css`, `app/layout.tsx`, de la coque ou
du kit : une capture à **390 px** et une à **1440 px** de chaque espace.
`npm run build` avant chaque push — `tsc` et `eslint` ne voient ni les erreurs
de frontière serveur/client, ni les polices cassées.

# DESIGN.md — Harmonie Yacht

Identité visuelle et éditoriale des vidéos (reels 9:16 rendus avec HyperFrames).
À lire avant toute vidéo. À compléter à chaque correction de Robin.
Sources : site harmonie-yacht.fr (code CSS lu le 07/10/2026), reels envoyés par Robin, 11 rushes originaux (sept. 2026).

---

## 1. L'essence

- **Ce qu'on vend :** des moments authentiques sur l'eau, sur un seul yacht tenu avec soin, au port de Carnon (à 15 min de Montpellier).
- **Ce qu'on montre :** des gens vrais qui profitent (trinquer, se baigner, regarder la mer), la lumière dorée, la mer calme. Pas un catalogue de bateau.
- **Ce qu'on ressent :** harmonieux. Dynamique mais jamais brouillon ; élégant mais jamais froid.
- **Focus hiver :** la nuit à quai, avec la sortie en mer, le petit-déjeuner sur plateau et les tapas.

## 2. Palette

Les couleurs de base viennent du site. Le texte des vidéos, lui, **prend sa couleur dans chaque plan** (voir § 4).

| Nom | Hex | Rôle dans les vidéos |
|---|---|---|
| Encre océan | `#0C2B45` | Texte foncé de référence, fonds de cartes sombres |
| Encre | `#14314C` | Texte foncé sur fond clair |
| Océan profond | `#123A5C` | Blocs profonds, fonds de fin |
| Océan | `#1A4C74` | Couleur principale de la marque (aplats, fonds unis) |
| Écume | `#F5F8FA` | Texte clair de référence |
| Sable | `#EFE7D8` | Texte clair chaud, fonds clairs |
| Pêche | `#F0C9A0` | Accent chaud (ligne secondaire sur coucher de soleil) |
| Terracotta | `#B4562E` | Accent rare, petits détails seulement |
| **Or du logo** | `≈ #A07838` | **Réservé au logo et aux filets fins.** Jamais pour du texte courant ni des aplats. |

Les rushes eux-mêmes tournent autour de deux familles, qui s'accordent avec cette palette :
- **Journée :** ciel `#69A1DD`→`#B6CCE6`, mer `#305A7B`, turquoise `#0096B7`.
- **Coucher de soleil :** orange `#D7734A`, rose `#B79999`, lilas `#9BA4C0`.

## 3. Typographie

Deux polices seulement, les mêmes que le site, en fichiers locaux (licence libre OFL, dans `brand/typo/fonts/`) :

| Police | Usage | Graisse |
|---|---|---|
| **Instrument Serif** | accroches, titres, paroles | 400 romain + italique |
| **Instrument Sans** | lignes d'information (lieu, offre) | 500 |

- **Minimaliste et élégante** : casse de phrase, jamais tout en capitales ; pas d'ombre, pas de halo, pas de contour, pas d'effet tape-à-l'œil.
- **Tailles minimales sur un canvas 1080 × 1920** : accroche ≥ 90 px, texte ≥ 60 px. Les déliés d'Instrument Serif sont fins : ne pas descendre sous ces tailles.
- **Jamais plus de 2 lignes à l'écran en même temps.**

Deux mises en page, selon la vidéo :

**A. Accroche + info (reels de présentation)** — validée par Robin sur planche (`brand/typo/planche.jpg`)
- Texte **ferré à gauche** à x = 108 px.
- Accroche en Instrument Serif **132 px**, sur 2 lignes coupées au sens, **la fin en italique** comme sur le site (« Ce soir, tu dors / *sur l'eau.* »).
- Un **filet fin** de 72 × 2 px, puis la ligne d'info en Instrument Sans **60 px** (« Nuit à bord · Port de Carnon »).
- **Carte 1** (l'accroche) visible dès 0 s ; **carte 2** (l'info) la remplace au même endroit si le plan dure au moins 5 s, sinon l'info passe au plan suivant.
- Le texte sort en fondu de 0,4 s qui finit avant la coupe.
- Outils : `brand/typo/adapt.py` (placement + couleur) et `brand/typo/template.html`.

**B. Paroles / sous-titres (reels musicaux)** — validée sur le reel « oh, life »
- Instrument Serif **72 px**, **centrée**, une phrase à la fois, toujours à la même hauteur (y ≈ 400) sauf si le plan l'interdit.
- Apparition en 2 images, disparition franche sur la coupe, calées **à l'image près** sur la musique ou la référence.
- Outil : `videos/reel-oh-life/tools/lyrics_style.py`.

## 4. Couleur du texte : elle s'adapte à chaque plan

C'est la demande n° 1 de Robin : **le texte prend sa couleur dans chaque plan**. La règle est appliquée automatiquement par les outils ci-dessus :

1. **Mesurer** la zone où va le texte, sur **toutes les images** du plan pendant que le texte est affiché (pire cas retenu).
2. **Teinte** : la couleur moyenne de la zone (en OKLCH). Si elle est presque grise, la teinte la plus vive du plan.
3. **Deux encres dans cette teinte**, jamais de blanc ou de noir neutres :
   - foncée, OKLCH(0,27 ; 0,065) ; une teinte orange ou jaune assombrie vire au brun, on prend alors un lie-de-vin ;
   - claire, OKLCH(0,97 ; 0,022).
   Si l'encre tombe presque exactement sur une couleur du site (Encre océan, Écume…), on prend celle du site.
4. **Seuils de lisibilité** : contraste ≥ **4,5:1** avec le fond moyen et ≥ **3:1** sur les pixels les moins favorables, vérifiés **mot par mot et image par image**.
5. **Si ça ne passe pas**, dans cet ordre :
   1. foncer ou éclaircir l'encre par paliers ;
   2. déplacer la ligne vers la zone calme la plus proche ;
   3. un voile très léger en **dégradé depuis le haut du cadre** (comme un filtre photo), jamais une tache ;
   4. en dernier recours, un **petit bloc arrondi** par ligne, teinté par le plan (style des reels qui ont marché).
6. **Garder la même polarité** (encre claire ou foncée) d'une phrase à l'autre quand c'est possible, pour que la couleur ne « clignote » pas.
7. Plusieurs plans d'une même séquence (ex. un coucher de soleil en 3 plans) partagent la même couleur de texte.

Constat utile : sur les ciels bleus de Carnon, la teinte du plan donne naturellement le bleu nuit du site (`#0C2B45`). Sur le coucher de soleil, elle donne un prune (`#3D172A`) ; sur l'eau turquoise, un pétrole profond ; sur un ciel lilas, un indigo (`#182446`).

## 5. Logo

- Fichier : `brand/logo-harmonie-yacht.png` (1024×604, fond transparent, repris du site), ornement + « HARMONIE / YACHT » en capitales à empattements.
- **Toujours en or** (≈ `#A07838`), jamais recoloré, jamais déformé, jamais posé sur un fond chargé.
- Les reels qui ont le mieux marché **n'affichent pas le logo** à l'écran (il apparaît seulement sur les verres).
- Quand et où le logo apparaît dans une vidéo : **[À CONFIRMER par Robin]**.

## 6. Ton des textes

- **Reels : tutoiement.** Site et publicités formelles : vouvoiement.
- **Accroche visible dès la 1re image**, courte, qui place la personne dans la scène et parle local :
  - « Tu trouves le meilleur plan de Montpellier pour cet été >> »
  - « L'expérience insolite à absolument tester cet hiver si tu es de Montpellier : »
  - « Pov: tu loues un yacht en août à Montpellier »
- Phrases calmes et sensorielles, comme sur le site (« le clapot de l'eau », « la nuit, heure par heure »).
- Casse normale, jamais tout en capitales. 2 lignes maximum à l'écran en même temps.
- **Aucune information inventée** : prix, horaires, capacité, équipements, partenaires viennent uniquement de Robin pour chaque vidéo.

## 7. Rythme et montage

Deux allures, au choix selon la vidéo :

| Allure | Durée d'un plan | Exemple | Quand |
|---|---|---|---|
| **Énergique** | ~1 s (2 temps à ~120 bpm), coupes sur le temps | Reel « meilleur plan de Montpellier », reel « Pov: août » | Sorties en mer, ambiance entre amis |
| **Contemplative** | 1,5 à 4 s, coupes douces | Reel « expérience insolite cet hiver », reel coucher de soleil sur la plage | Nuit à quai, coucher de soleil, intérieur |

Dans les deux cas : **mouvements de caméra doux**, plans **bien cadrés** (sujet centré, horizon droit), on voit l'environnement et l'atmosphère. Chaque plan montre un lieu ou un geste différent.

## 8. Musique

- **Fournie par Robin à chaque vidéo** (parfois la même qu'un reel de référence). Claude n'en choisit pas.
- Noter pour chaque vidéo d'où vient la musique.
- Attention aux droits : un son ajouté dans Instagram est couvert par Instagram ; un son **intégré dans le MP4 exporté** ne l'est pas toujours, surtout en publicité. À vérifier par Robin avant toute diffusion payante.

## 9. Rushes : règles techniques

- **Toujours les fichiers originaux du téléphone** (via Google Drive), jamais une copie passée par WhatsApp ou une messagerie : elles sont réduites (464×848) et aux couleurs délavées.
- Les iPhone filment en **HDR** : conversion systématique en SDR (BT.709) avant le montage, sinon les couleurs sortent ternes.
  Filtre ffmpeg validé : `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p`
- Cadence de rendu : 30 i/s. Les rushes à 60 ou 120 i/s servent aux ralentis.
- Le 4K est le meilleur choix (image la plus nette une fois recadrée).
- **Ralentis** : facteurs exacts (×2 sur du 60 i/s, ×4 ou ×2 sur du 120 i/s). Un rush à 30 i/s ne se ralentit qu'avec interpolation d'images, sinon il saccade.
- **Avant de choisir un passage**, regarder le rush au quart de seconde : personne qui entre dans le cadre, bras, doigt devant l'objectif, horizon penché.
- **Temps calculés à l'image près** (30 i/s), jamais en secondes arrondies : un arrondi fait apparaître une image vide ou figée sur une coupe.
- **Après chaque rendu**, vérifier automatiquement qu'aucune image n'est vide (y compris la toute première), que les coupes tombent aux bonnes images, et regarder une planche.
- Les médias sources ne sont pas committés dans le dépôt (règle du `CLAUDE.md`).

## 10. Interdits (connus à ce jour — liste qui grandit au fil des corrections)

- Inventer une information sur le yacht ou les prestations.
- Mettre l'or ailleurs que sur le logo et les filets fins.
- Plus de 2 polices ; une police non déclarée en `@font-face` local.
- Du texte blanc ou noir « neutre » posé sans tenir compte de la couleur du plan.
- Du texte sur un visage, une tête, un corps, sur le soleil, ou sous y = 1500 (zone de l'interface Instagram). Sur un gros plan de personne : pas de texte.
- Un voile en ovale derrière le texte : il se voit comme une tache sur l'objectif.
- Du texte trop petit pour un téléphone (voir tailles § 3).
- Des rushes compressés par une messagerie.
- Une musique qui n'a pas été fournie par Robin.
- Un ralenti qui saccade, une image vide ou figée, une intrusion dans le cadre.

## 11. Exemples

**Dans la marque**
- Reel « Tu trouves le meilleur plan de Montpellier pour cet été » : gestes vrais (rosé, trinquer, danser), coupes calées sur la musique, lumière dorée.
- Reel « L'expérience insolite… cet hiver » : texte dans les tons du décor (bois, crème), plans lents mais vivants qui font visiter le bateau.
- Reel « Pov: tu loues un yacht en août » : blocs de texte teintés par le ciel et la mer.
- Rush 11 (IMG_0176) : proue, ciel rose et orange, mer cuivrée, ralenti possible.
- Planche typographique validée : `brand/typo/planche.jpg` (§ 3).
- Reel « oh, life » v2 : paroles à l'image près, encre prise dans chaque plan, aucun voile.

**Hors marque**
- Une police très fine et « magazine » qui disparaît au soleil (proposition B écartée).
- Un texte minuscule (≈ 24 px sur 1080) : joli, mais illisible sur téléphone.
- Une vidéo aux couleurs grises et délavées (rush passé par WhatsApp, HDR mal converti).
- Une phrase posée sur la tête d'une personne, un voile ovale laiteux sur l'eau turquoise (brouillon 1 du reel « oh, life », corrigé).

## 12. Points à vérifier

- Le site affiche deux prix d'appel différents pour la sortie en mer (« dès 320 € » dans la description, « à partir de 380 € » sur la page) : ne citer aucun prix sans confirmation de Robin.
- La poupe du yacht porte le nom « NEXT YACHT » : à éviter en gros plan ? **[À CONFIRMER par Robin]**
- Personnes reconnaissables dans les rushes : accord pour un usage en publicité ? **[À CONFIRMER par Robin]**
- Aucun rush d'hiver pour l'instant (nuit à quai, cabine, salon, petit-déjeuner, tapas) : à tourner.

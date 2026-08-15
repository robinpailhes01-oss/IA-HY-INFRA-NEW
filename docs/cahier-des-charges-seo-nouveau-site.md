# Cahier des charges SEO & GEO — nouveau site Harmonie Yacht

> **Ce fichier s'adresse à Claude Code**, au démarrage du nouveau site
> harmonie-yacht.fr. L'ancien site (fait sur Lovable) obtient **42/100** à
> l'audit technique, avec 7 points critiques. Ces 7 points viennent tous du même
> défaut : une application JavaScript qui n'envoie aucun contenu aux moteurs.
> Le nouveau site doit sortir à **19/19 dès la mise en ligne**. Ce n'est pas un
> objectif ambitieux : c'est le résultat normal d'un site correctement construit.
> Ce document liste ce qui est non négociable, et donne les faits exacts de
> l'entreprise pour que tu n'aies rien à inventer.

## 1. Le contexte à connaître

Harmonie Yacht loue un yacht privatisé à Carnon (Hérault), depuis 2021 : sorties
en mer à la demi-journée et nuits à bord. Robin est le propriétaire et le
capitaine.

Ce site n'est pas un site vitrine : c'est le point d'entrée commercial. Il est
relié à une infrastructure existante — un agent WhatsApp (Léa) qui qualifie les
prospects, et un tableau de bord interne. **Le seul point d'intégration entre le
site et cette infrastructure est Google Calendar** : à chaque réservation payée,
le site crée un événement dont la description suit un format texte strict
(Client / Email / Téléphone / Durée / Invités / Demandes / Prix total / Acompte
payé). Une fonction côté Supabase lit ces événements toutes les 10 minutes et
crée la réservation en base. **Ce format doit être conservé à l'identique**,
sinon l'import casse silencieusement.

## 2. Exigences techniques non négociables

Ces 19 points sont exactement ceux que vérifie l'agent Auditeur
(`supabase/functions/seo-audit`). Ils doivent tous être verts avant la mise en
ligne.

### Rendu et contenu
1. **Rendu côté serveur.** Chaque page doit renvoyer son contenu complet en HTML
   dès la première réponse, sans exécution de JavaScript. C'est le point le plus
   important : les robots de ChatGPT et Perplexity n'exécutent jamais le
   JavaScript. Test : `curl https://harmonie-yacht.fr` doit contenir les tarifs
   et les descriptions en clair. Viser au minimum 500 caractères de texte lisible
   par page, en pratique bien davantage.
2. **Un `<h1>` unique et descriptif par page**, qui contient l'offre et le lieu.
3. **Toutes les pages répondent en 200.**

### Balises
4. **Un `<title>` différent par page**, 50–60 caractères, avec l'offre et la
   ville. Exemple : « Nuit à bord d'un yacht à Carnon — 380 € tout compris ».
5. **Une `meta description` différente par page**, 140–160 caractères, qui donne
   une raison de cliquer (prix, ce qui est inclus).
6. **Une balise `canonical`** sur chaque page, en absolu.
7. **`<html lang="fr">`** — l'ancien site se déclarait en anglais.
8. **`og:image` propre** : une vraie photo du yacht, 1200×630, hébergée sur le
   domaine. L'ancien site affichait encore le logo par défaut de Lovable quand on
   partageait le lien sur WhatsApp.

### Indexation
9. **`sitemap.xml`** généré automatiquement, listant toutes les pages publiques.
10. **`robots.txt`** ouvert, avec la ligne `Sitemap: https://harmonie-yacht.fr/sitemap.xml`.
11. **Ne bloquer aucun robot d'IA** : GPTBot, ClaudeBot, PerplexityBot,
    OAI-SearchBot doivent être explicitement autorisés. C'est la condition pour
    exister dans les réponses des IA.

### Données structurées (JSON-LD)
12. **Schema.org sur chaque page**, c'est le format que Google et les IA lisent
    en priorité. Au minimum :
    - `LocalBusiness` (ou `TouristAttraction`) sur l'accueil : nom, adresse,
      coordonnées GPS, téléphone, horaires, zone desservie, lien Instagram.
    - `Product` + `Offer` sur chaque page d'offre : nom, description, prix,
      devise, disponibilité, ce qui est inclus.
    - `AggregateRating` + `Review` avec les avis réels (voir §4).
    - `FAQPage` sur la page FAQ.
    - `BreadcrumbList` sur les pages profondes.

### Technique
13. HTTPS actif · 14. HSTS · 15. Réponse serveur sous 1,5 s · 16–19. Les
    contrôles de cohérence (titres uniques, descriptions uniques, H1 présents,
    pages accessibles) découlent des points ci-dessus.

## 3. Les faits de l'entreprise — source de vérité

Ces informations alimentent le contenu ET le JSON-LD. **Fais-les confirmer par
Robin avant publication** : certains tarifs diffèrent aujourd'hui entre le site
et la configuration de l'agent Léa, et publier une valeur fausse dans le
Schema.org la diffuse ensuite partout, y compris dans les réponses des IA.

**Le bateau** — « Harmonie », Atlantis 42, **12 mètres**. Capacité légale 10
personnes, confortable jusqu'à 7. Équipements : enceinte Bluetooth, paddle,
plateforme de bain, réfrigérateur, lit double à l'avant, bains de soleil avant et
arrière, table extérieure. Pas de WC à bord actuellement (sanitaires de la
capitainerie à 20 m).

> ⚠️ Les annuaires diffusent aujourd'hui « 13 mètres ». C'est faux, et les IA
> reprennent cette erreur. Le site doit porter la valeur correcte, clairement.

**Le lieu** — Port de Carnon, 239 rue de l'étang de l'or, Carnon-Port, 34130
Mauguio. GPS 43.5511 / 3.9806. À côté de l'Hôtel Neptune, 15 km de Montpellier.
Pas de parking dédié. Spots de navigation : Petit et Grand Travers, La
Grande-Motte, plage de la Maguelone.

**Les offres** (à confirmer avec Robin) :

| Offre | Prix | Détail |
|---|---|---|
| Sortie en mer 2 h | 400 € avec capitaine · 300 € sans | jusqu'à 10 personnes |
| Sortie en mer 3 h | 600 € avec capitaine · 450 € sans | BBQ à bord inclus |
| Sortie en mer 4 h | 800 € avec capitaine · 600 € sans | BBQ à bord inclus |
| Nuit à bord (Prestige, été) | 380 € | 2 personnes, 18 h → 12 h |
| Nuit insolite avec sortie (hiver) | 380 € | bateau chauffé |
| Nuit insolite sans sortie (hiver) | dès 180 € | bateau chauffé |

Inclus dans les sorties : skipper, carburant, eau, paddle, plateforme de bain.
Non inclus : nourriture et boissons. Inclus dans les nuits : sortie en mer d'une
heure, plateau tapas (partenaire Una Mas), petit-déjeuner livré (Hôtel Neptune).
Sans capitaine : permis côtier depuis 5 ans minimum et 50 h de navigation
justifiées. Réduction de 10 % sur les départs avant 11 h. Acompte de 30 % à la
réservation, solde à bord (CB ou espèces).

**Contact** — 07 53 48 12 63 · harmonieyacht@gmail.com ·
instagram.com/harmonieyacht

## 4. Les avis à intégrer

Trois avis réels sont déjà affichés sur l'ancien site, et Abracadaroom affiche
4,5/5. Ces avis doivent vivre **sur harmonie-yacht.fr**, en JSON-LD, pas
seulement en texte :

- **Adrien** (mai 2026) — « Merci à Robin pour cette aprèm au top en mer. Et les cocktails incroyable »
- **Alicia** (mai 2026) — « Une très belle expérience passée sur le bateau ! La nuit était magnifique, l'ambiance calme et relaxante »
- **Anthony** (mai 2026) — « Une équipe soignée et à la hauteur de ses prestations. Moments inoubliables »

N'invente jamais d'avis, et ne recopie pas la note d'un annuaire comme si elle
était collectée sur le site : c'est une fausse déclaration, et Google sanctionne.

## 5. Structure de pages

Une page par **intention de recherche**, pas par rubrique interne. Les gens ne
cherchent pas « Harmonie Yacht », ils cherchent ce qu'ils veulent vivre.

- `/` — accueil, les deux univers (sortie / nuit), preuve sociale, réservation
- `/sortie-en-mer-carnon` — l'offre sorties, les trois durées, tarifs en clair
- `/nuit-a-bord-yacht-carnon` — l'offre nuits, ce qui est inclus
- `/evjf-evg-bateau-montpellier` — intention forte, aujourd'hui non couverte
- `/demande-en-mariage-anniversaire-bateau` — intention à forte valeur
- `/seminaire-entreprise-bateau-herault` — cible B2B
- `/tarifs` — toute la grille, page qui sera citée par les IA
- `/faq` — en `FAQPage`, réponses factuelles courtes
- `/galerie`, `/contact`, `/mentions-legales`, `/confidentialite`

Chaque page d'offre porte son `Product` + `Offer` en JSON-LD, un H1 propre, et un
bouton de réservation visible sans scroller.

## 6. Règles d'écriture pour être cité par les IA

Les modèles reprennent ce qu'ils peuvent lire, comprendre et vérifier.

- **Réponds à la question dès la première phrase** de chaque section, puis
  développe. Un modèle cite un paragraphe qui se suffit à lui-même.
- **Chiffres explicites et unités écrites** : « 380 € la nuit pour 2 personnes,
  de 18 h à 12 h le lendemain » plutôt que « à partir de 380 € ».
- **Une page « tout savoir »** exhaustive : bateau, capacité, équipements,
  tarifs, conditions, accès, météo, annulation. C'est cette page que les IA
  citeront à la place des annuaires.
- **Pas de texte enfermé dans des images** ni dans des composants qui ne rendent
  qu'au clic (accordéons repliés côté serveur, onglets non rendus).
- **Cohérence stricte** entre le site, la configuration de Léa
  (`agent_config.offers` dans Supabase) et les annuaires. Un prix qui diffère
  d'une source à l'autre est un prix que personne ne peut citer avec confiance.

## 7. Migration — à ne pas rater

- **Garder le domaine harmonie-yacht.fr.** Toute la notoriété acquise y est
  attachée.
- **Rediriger en 301** chaque ancienne URL vers son équivalent :
  `/sorties-en-mer`, `/nuits-insolites`, `/offres-speciales`, `/galerie`.
  Sans ça, les liens existants sur Abracadaroom et InsOOlite tombent en 404.
- **Conserver le format des événements Google Calendar** (voir §1) — sinon les
  réservations n'arrivent plus dans le CRM.
- Après mise en ligne : soumettre le sitemap dans **Google Search Console**, et
  brancher Search Console à l'agent Auditeur pour disposer des vraies données
  d'impressions et de positions.
- Mettre à jour `DEFAULT_PATHS` dans `supabase/functions/seo-audit/index.ts`
  avec les nouvelles URLs.

## 8. Recette avant mise en ligne

Ne considère pas le site terminé tant que ces quatre vérifications ne passent pas :

1. `curl -s https://<url> | wc -c` renvoie plusieurs dizaines de milliers
   d'octets, et le texte des tarifs apparaît dans `curl -s https://<url>`.
2. Même test avec l'user-agent de GPTBot : résultat identique.
3. Les titres et descriptions sont différents sur chacune des pages.
4. L'agent Auditeur renvoie **19/19** depuis le tableau de bord interne.

---

*Rédigé à partir de l'audit réel du 14 août 2026 de l'ancien site (42/100,
7 points critiques) et de la configuration de production d'Harmonie Yacht.*

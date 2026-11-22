# Harmonie Yacht — tableau de bord et agents IA

Location de yacht au port de Carnon. Robin gère seul. Ce dépôt contient le tableau de bord (leads, réservations, finances, compta, marketing) et les agents IA qui travaillent pour les clients.

Robin vient ici pour quatre choses : améliorer le tableau de bord, régler Léa et les agents, gérer le quotidien (relances, compta, chiffres du mois), le marketing et le site.

## Comment travailler avec Robin
- **En français**, en tableau quand c'est possible, avec des mots simples : Robin n'est pas développeur et veut **apprendre**. Un mot technique est expliqué en une phrase la première fois.
- Chaque réponse finit par trois points : **fait** (ce que j'ai fait), **pourquoi** (pourquoi comme ça), **à toi** (ce que Robin doit tester ou valider).
- Moment actuel : basse saison, bateau peu actif ou fermé. Priorités : la compta et les stats de Léa.

## Ne rien oublier (le problème n°1 de Robin)
- Au début de chaque conversation : lire `hy-context/decisions.md` et `docs/etat.md`.
- Dès que Robin tranche quelque chose (prix, règle, choix) : une ligne datée + la raison dans `hy-context/decisions.md`, **tout de suite**, pas en fin de conversation.
- Une conversation = un sujet. En fin de tâche : mettre à jour `docs/etat.md`.

## Ce qu'il y a ici
| Quoi | Où |
|---|---|
| Tableau de bord (Next 15.5, App Router, Tailwind 4, shadcn/ui) | `app/`, `components/`, `lib/` |
| Agents du produit : Léa (WhatsApp, Instagram, mail), le Manager (Telegram), relances, récap du jour | `supabase/functions/` (une fonction par agent) |
| Base Supabase : 37 migrations | `supabase/migrations/` |
| Service WhatsApp (Baileys, hébergé sur Railway) | `baileys-service/` |
| Design « Verre glacier » | `docs/DESIGN.md` |
| Où on en est | `docs/etat.md` (lire au début, mettre à jour à la fin) |

Le site public n'est **pas** ici : c'est le dépôt `TESTE-HYSITE` (domaine harmonie-yacht.fr). `HY-SITE-` n'est pas le site en ligne.

## Pièges (ce qui a déjà cassé)
- **Léa a deux sources** : son discours et ses règles sont écrits dans le code (`supabase/functions/agent-lea/index.ts`), la grille de prix et les offres sont lues dans la table `agent_config`. Changer un prix ou une offre touche les deux : vérifier qu'ils restent cohérents.
- **Base reconstruite en novembre 2026** sur un nouveau projet Supabase. Ce qui reste à rebrancher (webhooks, secrets, site) : `docs/reprise-reconnexion.md`. Une erreur « introuvable » vient souvent de là.
- **Pièges du design** (police qui retombe en Times sur iPhone, erreurs d'hydratation, nombres mal formatés) : section 0 de `docs/DESIGN.md`, à lire avant de toucher l'interface.
- **Captures et tests visuels** : mode démo `NEXT_PUBLIC_HY_DEMO=1 npm run dev` (données fictives de `lib/demo/`). Jamais de vraies données client dans une capture.
- Pas de script `npm test` : la vérification, c'est `npm run build` et `npm run lint`.

## Ce qui attend toujours l'OK explicite de Robin
Ces actions touchent de vrais clients ou de l'argent, et ne se rattrapent pas.
- Tout message (WhatsApp, mail, Telegram) envoyé à un vrai client ou prospect.
- Changer un prix, une offre ou une règle de Léa en production.
- Une migration, une suppression de données ou de fichiers en production.
- Tout ce qui écrit dans Qonto, Stripe ou SumUp. Ces outils sont en lecture seule pour nous.

## Fusions
- Docs et design : fusion libre si le build passe.
- Léa et les agents, WhatsApp, paiements, compta, finances : Robin teste la Preview Vercel avant la fusion.
- La production (ia-hy-infra-new.vercel.app) est déployée depuis la branche `claude/keen-cray-IEgV8`, pas depuis `main`. Jamais de push direct dessus : une PR par étape.

## Règles
- Jamais de clé dans un fichier ni dans le chat : elles vont dans Vercel (Production et Preview) ou dans les secrets Supabase. `.env.example` ne contient que des noms.
- N'invente jamais un chiffre, un prix, un statut ou une règle : pose une question courte à Robin.
- Les chiffres (stats de Léa, compta, réservations) se lisent dans la base, en lecture seule, avec une requête ciblée montrée à Robin. Jamais une table entière.
- Même erreur 3 fois : stop, et explique ce qui bloque.

## Liens avec le reste
- Harmonie Yacht est une activité du groupe Harmonie Group (même SIREN, même compte Qonto). Le tableau de bord du groupe lit ce projet en lecture seule.
- C'est aussi la vitrine de Luma (l'agence IA de Robin). Chaque étape terminée : une ligne datée en haut de `docs/marketing/etapes.md` (l'étape, à quoi elle sert au client, ce que ça lui change) et 1 à 3 captures `.webp` (largeur 1600 au plus) dans `docs/marketing/captures/`, **avec des données de démonstration uniquement**. Rien n'est publié sans l'accord de Robin.

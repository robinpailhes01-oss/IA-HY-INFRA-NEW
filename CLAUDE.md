# Harmonie Yacht — tableau de bord et agents IA

Yacht de 12 m (10 personnes au plus) : nuits insolites et sorties en mer privatisées. À Carnon, puis à Sète à partir d'avril 2027. Fermé de début décembre à début avril. Robin gère ; sa femme s'occupe de l'Instagram et des photos.

Ce dépôt appartient à la **session HARMONIE YACHT**. Il contient le tableau de bord d'Harmonie Yacht et Léa, l'agente qui répond aux clients. Le contexte commun (et ce qui attend l'OK de Robin) est dans le socle et dans `harmonie-group/contexte/`.

## Au début de chaque conversation
Lis `hy-context/decisions.md` et `docs/etat.md`. Une décision de Robin sur Harmonie Yacht va tout de suite dans `hy-context/decisions.md`.

## Ce qu'il y a ici
| Quoi | Où |
|---|---|
| Tableau de bord (Next 15.5, App Router, Tailwind 4, shadcn/ui) | `app/`, `components/`, `lib/` |
| Léa (WhatsApp, Instagram, mail), relances, récap du jour | `supabase/functions/` (une fonction par agent) |
| Synchro Qonto et SumUp toutes les heures (`qonto-sync`, `sumup-sync`) | `supabase/functions/` |
| Base Supabase : 37 migrations | `supabase/migrations/` |
| Service WhatsApp (Baileys, hébergé sur Railway) | `baileys-service/` |
| Design « Verre glacier » | `docs/DESIGN.md` |

Le site public n'est **pas** ici : c'est le dépôt `TESTE-HYSITE` (harmonie-yacht.fr). `HY-SITE-` n'est pas le site en ligne.

## Ce qui change (décisions du groupe, 22/11/2026)
- **La compta et les factures** passent au comptable du groupe (`harmonie-group`). Le module compta d'ici reste en place en attendant ; ce qu'il devient se décide à l'étape du comptable.
- **Le Manager Telegram** (`supabase/functions/telegram-manager`) sera remplacé par le manager global. N'y ajoute rien de nouveau.
- **`qonto-sync` est la source de tout le groupe** : le compte Qonto est partagé avec Luma et des dépenses perso (privées). Ne la modifie pas sans prévenir la session HARMONIE GROUP.

## Pièges (ce qui a déjà cassé)
- **Léa a deux sources** : son discours et ses règles sont dans le code (`supabase/functions/agent-lea/index.ts`), la grille de prix et les offres dans la table `agent_config`. Changer un prix ou une offre touche les deux : vérifier qu'ils restent cohérents.
- **Base reconstruite en novembre 2026** sur un nouveau projet Supabase. Ce qui reste à rebrancher : `docs/reprise-reconnexion.md`. Une erreur « introuvable » vient souvent de là.
- **Design** (police qui retombe en Times sur iPhone, hydratation, nombres) : section 0 de `docs/DESIGN.md`, à lire avant de toucher l'interface.
- **Captures** : mode démo `NEXT_PUBLIC_HY_DEMO=1 npm run dev` (données fictives de `lib/demo/`). Jamais de vraies données client ni de perso dans une capture.
- Les chiffres se lisent dans la base, en lecture seule, avec une requête ciblée montrée à Robin. Jamais une table entière.
- Stripe et SumUp : jamais d'écriture sans l'OK de Robin.
- Plusieurs clés Vercel sont encore en « Production et aperçu » : à corriger (`docs/etat.md`).

## Fusions
- La production (ia-hy-infra-new.vercel.app) suit `main` depuis le 22/11/2026. Une PR par étape ; l'ancienne branche `claude/keen-cray-IEgV8` n'est plus utilisée.
- Docs et design : fusion libre si le build passe. Léa, WhatsApp, paiements, compta : Robin teste la Preview avant.
- Vérification : `npm run build` et `npm run lint` (pas de `npm test`).

## Vitrine de Luma
Chaque étape terminée : une ligne datée en haut de `docs/marketing/etapes.md` (l'étape, à quoi elle sert au client, ce que ça lui change) et 1 à 3 captures `.webp` (1600 px de large au plus) dans `docs/marketing/captures/`, **avec des données de démonstration uniquement**. Rien n'est publié sans l'accord de Robin.

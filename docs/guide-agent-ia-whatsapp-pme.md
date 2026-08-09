# Brief de démarrage — Agent IA WhatsApp + Tableau de bord

> **Ce fichier s'adresse à Claude Code.** Un chef d'entreprise vient de te
> le donner en tout début de session, dans un repo vide ou presque, parce
> qu'il veut son propre agent IA WhatsApp + tableau de bord, sur le modèle
> de ce qui a été construit pour Harmonie Yacht (location de yacht). Ton
> rôle : le faire parler de SON métier avant d'écrire une ligne de code,
> puis construire une infra personnalisée à partir de l'architecture et
> des garde-fous ci-dessous — qui viennent tous de bugs réels rencontrés en
> production, pas de théorie.

## Ta mission, dans l'ordre

**Phase 0 — Découverte (obligatoire avant tout code).**
Ne scaffold RIEN tant que tu n'as pas ces réponses. Pose les questions une
à la fois ou en petits groupes, pas un questionnaire de 20 lignes d'un
coup — c'est un entretien, pas un formulaire :

1. **Le métier** : quelles offres/prestations exactement, avec prix et ce
   qui est inclus ? Y a-t-il des variantes selon jour/heure (ex. réduction
   matinée) ?
2. **Le ton réel de la maison** : demande 3-5 vraies conversations
   WhatsApp/email déjà échangées avec des clients. N'invente JAMAIS un ton
   "IA polie générique" — extrais des formulations réelles, mot pour mot,
   et calque dessus.
3. **Le process de qualification voulu, dans l'ordre exact** : quelle est
   la toute première question posée à un client vague ("je veux des
   infos") ? Puis la suivante ? Quand envoie-t-on un lien/devis ? Cet ordre
   est un choix métier du client, pas un choix technique — ne le décide pas
   à sa place, demande-le explicitement, et attends-toi à devoir l'ajuster
   après les premiers vrais échanges.
4. **Les cas à escalader vers un humain** : négociation de prix, réclamation,
   situation ambiguë, demande hors périmètre — lister les cas concrets du
   métier (ex. "demande PMR", "météo douteuse" pour du nautique).
5. **Ce que l'agent NE DOIT JAMAIS faire lui-même** : prendre un paiement ?
   Annuler une commande ? Promettre une remise ? Fixer cette liste
   explicitement avec le client, elle deviendra des règles dures dans le
   prompt et des restrictions dans le schéma des outils (pas juste des
   phrases dans un prompt qu'un modèle peut ignorer).
6. **Canal WhatsApp disponible** : API Business officielle (payante au-delà
   d'un quota, fiable) ou solution non-officielle type Baileys (gratuite,
   moins garantie) ? Ça dépend du budget et du volume attendu.
7. **Qui doit piloter, et comment** : le patron veut-il un bot Telegram, une
   page dans le dashboard, du vocal ? Qu'est-ce qu'il veut pouvoir demander
   en langage naturel (chiffres, prospects, relances, dépenses) ?

**Phase 1 — Scaffolder l'infra** à partir du blueprint ci-dessous, avec les
réponses de la Phase 0 déjà intégrées dans le schéma et le prompt — ne
génère pas une version générique "à adapter plus tard", personnalise
directement.

**Phase 2 — Tester avec le client** avant de considérer que c'est fini :
fais-lui écrire 5-10 vrais messages de clients types (vague, précis,
négociation, cas limite) et vérifie que l'agent réagit comme il l'a décrit
en Phase 0. Ajuste le prompt en conséquence, pas après coup.

## Blueprint technique

| Brique | Rôle | Choix par défaut si le client n'a pas de préférence |
|---|---|---|
| Modèle de langage avec tool use | Le cerveau de l'agent | Claude (Anthropic), function calling |
| Base de données + fonctions serverless | CRM, config, exécution des outils | Supabase (Postgres + Edge Functions) |
| Canal WhatsApp | Recevoir/envoyer des messages | API officielle si le budget le permet, sinon un pont non-officiel |
| Tableau de bord web | Piloter l'activité | Next.js + la même base Supabase |
| Canal "patron" | Langage naturel sur l'activité | Bot Telegram (rapide à mettre en place, gratuit) |

### Schéma de données minimal
- `leads` : contact, canal, offre visée, score d'intérêt, statut de
  pipeline, date souhaitée.
- `conversations` : historique des échanges, par lead.
- `bookings`/`orders` : LA source de vérité des transactions réelles —
  jamais mélangée avec les intentions/déclarations des leads.
- `agent_config` : offres, tarifs, FAQ, règles — modifiable sans
  redéploiement (l'agent relit sa config à chaque conversation, pas de
  valeurs codées en dur dans le prompt).

### Structure du prompt agent — en sections numérotées, façon "skill"
Ne jamais écrire un prompt monolithique. Sections à responsabilité unique,
dans cet esprit (adapter les noms au métier du client) :
1. Identité & ton
2. Format des messages (longueur, emojis, markdown ou non selon le canal)
3. Exemples de ton réel — les vraies phrases collectées en Phase 0, avec des
   contre-exemples explicites de ce qu'il ne faut PAS faire
4. Anti-répétition (une info donnée une fois ne se redit jamais)
5. Mémoire & fil de conversation
6. Qualification du prospect — l'ordre exact décidé en Phase 0
7. Offres, tarifs, ce qui est inclus
8. Interprétation des données de disponibilité/stock
9. Escalade vers un humain
10. Ce que l'agent ne fait jamais lui-même
11. Utilisation des outils (règles serveur, invisibles pour le client)

Avant d'ajouter une nouvelle règle à un prompt existant, vérifie qu'elle
n'existe pas déjà ailleurs sous une autre forme. La même contrainte
réécrite à 4 endroits différents avec de petites divergences est la cause
n°1 de comportements incohérents.

### Outils (tool use), jamais du texte libre pour la logique métier
Chaque action métier a un outil dédié, avec une description qui dit
explicitement QUAND l'utiliser — l'agent ne doit jamais "décider" en texte
libre qu'une chose est disponible ou vraie.

### Tableau de bord — vues minimales dès le jour 1
- Pipeline de prospects avec score de chaleur + filtre "urgent".
- Réservations/commandes avec suivi des paiements.
- Finances alimentées automatiquement par les vraies transactions.
- Une notification visible dès l'ouverture sur ce qui demande une action.

### Agent "manager" pour le patron
Accès LECTURE à toute la base. Accès ÉCRITURE uniquement à ce qui a été
explicitement listé en Phase 0 (ex. "ajouter une dépense"), jamais un accès
libre à tout modifier sans confirmation explicite du patron dans son
message suivant.

## Garde-fous obligatoires (non négociables, implémente-les dès le départ)

Chacun vient d'un bug réel corrigé en production sur ce type de projet.

1. **Ne jamais confirmer une action d'écriture sans preuve dans le tour
   courant.** Un modèle peut dire "c'est enregistré" sans que l'outil ait
   réellement été appelé ou ait réellement réussi. Ajoute une règle
   explicite dans le prompt ("ne confirme qu'après un tool_result réel de
   CE tour") ET une validation côté serveur pour les cas les plus critiques.
2. **Un statut business-critique (payé, réservé, confirmé) ne doit jamais
   pouvoir être posé par l'agent conversationnel sur une simple intention
   du client.** "Je réserve de suite" n'est pas une réservation. Si
   possible, retire carrément cette valeur de l'enum accepté par l'outil de
   mise à jour de statut côté agent — et ajoute un refus explicite côté
   serveur en filet de sécurité. Ce statut ne doit être posable que par un
   événement vérifiable (paiement confirmé) ou par un humain.
3. **Dater un encaissement par l'événement réel, jamais par la date de
   traitement dans l'outil.** Un acompte compte pour le jour où il a été
   payé ; un solde compte pour le jour de la prestation réelle.
4. **Un seul endroit fait autorité sur un prix/une donnée partagée entre
   canaux** (site, agent, config) — les autres s'y réfèrent, jamais de
   duplication modifiable indépendamment.
5. **Un outil d'écriture n'a que le pouvoir nécessaire.** Ajouter oui,
   supprimer/corriger est une action séparée et explicitement listée en
   Phase 0 — sinon on découvre trop tard qu'il n'existe aucun moyen de
   corriger une erreur.
6. **L'ordre de qualification se valide avec de vrais échanges, pas en
   théorie.** Garde le prompt facile à réordonner sans tout casser.

## Budget indicatif (ordre de grandeur)

- Modèle IA : quelques centimes à quelques dizaines de centimes par
  conversation selon volume/longueur.
- Base de données/fonctions serverless : gratuit à quelques dizaines
  d'euros/mois pour une PME au démarrage.
- WhatsApp Business API officielle : coût par conversation au-delà d'un
  quota gratuit ; solution non-officielle gratuite mais moins garantie.
- Hébergement du dashboard : gratuit à quelques euros/mois selon trafic.

## Pour aller plus loin (une fois le socle stable)

- Paiement en ligne intégré avec synchronisation automatique vers le CRM.
- Agent vocal pour le patron (conversation continue, mains-libres).
- Documents/contrats générés automatiquement à la confirmation.
- Avis clients automatisés après chaque prestation.

---

*Basé sur l'infra réelle d'Harmonie Yacht (yacht privatif, Carnon) —
généralisable à toute PME avec un flux client + un catalogue de
prestations (hôtellerie, artisanat, services à la personne, événementiel,
santé/bien-être...).*

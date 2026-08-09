# Créer son agent IA WhatsApp + tableau de bord — guide pour une PME

> Basé sur l'infra réelle d'Harmonie Yacht (agent commercial WhatsApp, CRM,
> réservations, finances, agent manager). Ce document généralise ce qui a
> été construit et corrigé en conditions réelles — pas une théorie, un
> retour d'expérience reproductible pour n'importe quelle PME qui veut son
> propre "employé virtuel" 24/7.

## 1. Le principe

Un agent IA qui répond aux clients sur WhatsApp (ou Instagram/email) H24,
qualifie les prospects, communique les disponibilités/tarifs, et alimente
en temps réel un tableau de bord où le patron pilote son activité — sans
jamais avoir à coder pour l'utiliser au quotidien.

Deux composants distincts, qui ne doivent JAMAIS être confondus :
- **L'agent front-office** (ex. "Léa") : parle aux clients, qualifie, ne
  décide rien de définitif seul.
- **Le tableau de bord + l'agent manager** (ex. le Manager Telegram/Jarvis) :
  réservé au patron, chiffres réels, pilotage, corrections.

## 2. Prérequis techniques

| Brique | Rôle | Exemple utilisé ici |
|---|---|---|
| Un modèle de langage avec tool use | Le cerveau de l'agent | Claude (Anthropic) |
| Une base de données + fonctions serverless | CRM, config, exécution des outils | Supabase (Postgres + Edge Functions) |
| Un canal WhatsApp | Recevoir/envoyer des messages | API officielle WhatsApp Business, ou un pont non-officiel (Baileys) si le budget ne permet pas encore l'API officielle |
| Un tableau de bord web | Piloter l'activité | Next.js (ou équivalent) + la même base Supabase |
| Un canal "patron" | Poser des questions en langage naturel sur l'activité | Bot Telegram, ou une page vocale dans le dashboard |

## 3. Étape par étape

### Étape 1 — Cadrer le métier AVANT de coder
Répondre par écrit, noir sur blanc, avant d'écrire une ligne de prompt :
- Quelles sont les offres exactes (noms, prix, ce qui est inclus) ?
- Quel est le VRAI ton de la maison (pas un ton "IA générique poli") ?
  Le meilleur moyen : relire de vraies conversations WhatsApp de l'équipe et
  en extraire des exemples réels, phrase pour phrase.
- Quel est le process de qualification voulu, dans quel ORDRE exact ? (ex.
  "type de prestation → date → envoi du lien" — l'ordre compte énormément
  et change la conversion, testez-le avec de vrais clients avant de le figer)
- Quels cas doivent être escaladés à un humain (négociation, réclamation,
  cas hors périmètre) ?
- Qu'est-ce que l'agent NE DOIT JAMAIS faire lui-même ? (typiquement :
  prendre un paiement, annuler une commande, promettre un remboursement)

### Étape 2 — La base de données (le CRM)
Tables minimales :
- `leads` (prospects) : contact, canal, offre visée, score d'intérêt,
  statut de pipeline, date souhaitée.
- `conversations` : historique des échanges, par lead.
- `bookings`/`orders` (réservations/commandes) : la source de vérité des
  transactions réelles — jamais mélangée avec les intentions des leads.
- `agent_config` : offres, tarifs, FAQ, règles — modifiable SANS
  redéploiement (l'agent relit sa config à chaque conversation).

### Étape 3 — Le prompt de l'agent, structuré comme une "skill"
Ne PAS écrire un prompt monolithique. Le découper en sections numérotées à
responsabilité unique (identité/ton, format des messages, exemples de ton
réel, anti-répétition, mémoire, qualification, offres, disponibilité,
escalade, outils). Avant d'ajouter une règle, vérifier qu'elle n'existe pas
déjà ailleurs sous une autre forme — la même contrainte réécrite à 4
endroits différents avec de petites divergences est la cause n°1 de bugs de
comportement (deux règles qui se contredisent sans qu'on s'en rende compte).

### Étape 4 — Les outils (tool use), pas du texte libre
L'agent ne doit JAMAIS écrire de logique métier en texte libre ("je crois
que c'est disponible..."). Chaque action a un outil dédié, avec une
description qui dit explicitement QUAND l'utiliser :
- Vérifier une disponibilité → un outil qui interroge la vraie base, jamais
  une supposition du modèle.
- Qualifier/mettre à jour un prospect → un outil séparé, appelé à chaque
  info nouvelle, AVANT de répondre au client.
- Envoyer un lien de paiement/réservation → un outil qui renvoie le lien
  réel, jamais un lien inventé par le modèle.
- Escalader vers un humain → un outil dédié, avec une règle claire sur
  quand rester silencieux vs. envoyer un message d'attente au client.

### Étape 5 — Le tableau de bord
Vues indispensables dès le premier jour :
- **Pipeline de prospects** (kanban ou tableau), avec un score de chaleur
  et un filtre "urgent" (à reprendre, relances dues, leads chauds).
- **Réservations/commandes**, avec le suivi des paiements (acompte, solde).
- **Finances**, alimentées automatiquement par les vraies transactions —
  jamais par une déclaration de l'agent conversationnel.
- Une **notification visible dès l'ouverture** sur ce qui demande une
  action (pas besoin d'aller chercher l'info page par page).

### Étape 6 — L'agent "manager" pour le patron
Un deuxième agent, séparé, réservé au patron (Telegram, ou une page vocale
du dashboard) pour poser des questions en langage naturel : "combien de CA
ce mois-ci", "qui était intéressé cette semaine", "relance untel". Il doit
avoir accès en LECTURE à toute la même base, et en écriture UNIQUEMENT à ce
qui est explicitement voulu (ex. ajouter une dépense) — jamais un accès
gratuit à tout modifier sans confirmation.

### Étape 7 — Les automatisations
- Relances automatiques des prospects sans réponse.
- Synchronisation avec l'agenda existant de l'équipe (import ET export).
- Notification du patron en cas d'escalade ou de tentative de paiement
  échouée (ne jamais perdre un prospect chaud faute de suivi).

## 4. Les pièges réels rencontrés (et comment les éviter dès le départ)

Ces bugs ne sont pas théoriques — ils sont tous survenus en usage réel sur
ce projet, et ont un point commun : **on a fait confiance à l'agent pour
déclarer un succès au lieu de vérifier la vraie donnée.**

1. **L'agent affirme un succès sans preuve.** Un modèle peut dire "c'est
   enregistré" sans que l'action ait réellement eu lieu (tour précédent mal
   mémorisé, appel d'outil oublié). Règle : ne JAMAIS confirmer une action
   d'écriture au client/patron sans avoir reçu, DANS CE tour précis, un
   résultat d'outil qui le confirme.
2. **Un statut business-critique ne doit jamais être positionnable par
   l'IA sur une simple intention exprimée.** Un client qui dit "je réserve
   de suite" n'a pas réservé. Si l'agent peut lui-même marquer "réservé"/
   "payé", il finira par le faire trop tôt — et ce lead disparaîtra des
   vues de suivi comme s'il était déjà converti. Ces statuts ne doivent être
   posés QUE par un événement vérifiable (paiement confirmé) ou par un
   humain.
3. **Dater un encaissement par le bon événement, pas par la date de
   traitement.** Un acompte compte pour le jour où il a été payé ; un solde
   compte pour le jour de la prestation réelle — jamais pour le jour où
   quelqu'un a coché une case dans l'outil. Sinon le chiffre d'affaires du
   mois est faux sans que personne ne s'en aperçoive.
4. **Cohérence entre les canaux.** Si le site web, l'agent WhatsApp et le
   patron peuvent chacun changer un prix indépendamment, ils finissent par
   se contredire. Un seul endroit fait autorité, les autres s'y réfèrent.
5. **Ne jamais donner à un outil d'écriture plus de pouvoir que
   nécessaire.** Ajouter une dépense oui, la supprimer doit être une action
   séparée et explicite — sinon on découvre trop tard qu'il n'existe aucun
   moyen de corriger une erreur.
6. **Tester le flux réel avant de le figer.** L'ordre des questions de
   qualification qui convertit le mieux se découvre en observant de vrais
   échanges, pas en le devinant à l'avance — et il peut changer avec
   l'expérience. Le prompt doit rester facile à ajuster sans tout casser.

## 5. Budget indicatif (ordre de grandeur, pas un devis)

- Modèle IA : quelques centimes à quelques dizaines de centimes par
  conversation selon le volume et la longueur.
- Base de données/fonctions serverless : gratuit à quelques dizaines
  d'euros/mois pour une PME (paliers gratuits généreux au démarrage).
- WhatsApp Business API officielle : coût par conversation au-delà d'un
  quota gratuit ; une solution non-officielle (QR code) est gratuite mais
  moins stable et pas garantie par WhatsApp.
- Hébergement du tableau de bord : gratuit à quelques euros/mois selon le
  trafic.

## 6. Pour aller plus loin

- Paiement en ligne intégré (Stripe/autre) avec synchronisation automatique
  vers le CRM.
- Un agent vocal pour le patron (poser des questions à l'oral, en
  conversation continue).
- Contrats/documents générés automatiquement à la confirmation.
- Un système d'avis clients automatisé après chaque prestation.

---

*Ce guide est né de la construction réelle d'Harmonie Yacht — il est
volontairement générique pour s'appliquer à n'importe quelle PME avec un
flux client + un catalogue de prestations (hôtellerie, artisanat, services
à la personne, événementiel...).*

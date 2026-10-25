# Blueprint — Agent IA d'établissement

> **Ce document est la référence maître** pour redéployer rapidement, chez un
> autre établissement, le système construit pour Harmonie Yacht : un agent IA
> commercial sur WhatsApp, un agent de pilotage pour le patron, et un tableau
> de bord qui dit la vérité sur l'argent.
>
> Il est fait pour **vivre** : chaque déploiement chez un nouveau client doit
> l'enrichir, surtout la section 11 (les pièges). Une leçon apprise en
> production et non écrite ici sera réapprise au prix fort ailleurs.

**Comment lire ce document selon ce que tu veux faire :**

| Je veux… | Je lis |
|---|---|
| Comprendre ce qu'on vend | §1 |
| Démarrer chez un nouveau client | §2 puis §12 |
| Comprendre comment c'est fait | §3 à §10 |
| Éviter de refaire les erreurs | **§11 — la section la plus utile** |

**Rapport avec les autres documents du dossier `docs/` :**
`comment-on-a-construit-agent-ia-whatsapp.md` raconte l'historique de la
construction chez Harmonie Yacht (étude de cas).
`guide-agent-ia-whatsapp-pme.md` est le brief à coller dans Claude Code pour
démarrer un repo vide — il reste utile tel quel, mais **ce blueprint-ci fait
autorité** en cas de divergence. À terme les deux devraient fusionner : trois
documents qui décrivent la même chose finiront par se contredire.

---

## 1. Ce qu'on vend

Pas « un chatbot ». Trois résultats concrets :

1. **Plus aucun prospect sans réponse.** L'agent répond en quelques secondes,
   24h/24, dans le ton de la maison, et qualifie pendant que le patron dort.
2. **Le patron sait où il en est sans ouvrir un tableur.** Il demande ses
   chiffres en langage naturel et reçoit un point automatique chaque semaine.
3. **L'argent arrête de se perdre.** Encaissements, commissions et espèces
   convergent vers une seule vérité au lieu de vivre dans quatre endroits.

**Ce que ça remplace :** un répondeur, un cahier, un tableur, et la charge
mentale de se souvenir qui n'a pas encore payé.

**Ce que ça ne remplace pas :** le patron. L'agent qualifie et informe ; il ne
négocie pas, n'encaisse pas, et ne décide rien d'irréversible.

---

## 2. Phase de découverte — avant la moindre ligne de code

Rien ne se scaffolde tant que ces réponses n'existent pas. C'est un entretien,
pas un formulaire : poser les questions une par une.

1. **Les offres exactes** : intitulé, prix, durée, ce qui est inclus, ce qui ne
   l'est pas, variantes selon jour/heure/saison.
2. **Le ton réel de la maison** : réclamer 3 à 5 vraies conversations clients
   déjà échangées. Ne jamais inventer un ton « IA polie ». On extrait des
   formulations mot pour mot et on calque dessus.
3. **L'ordre de qualification voulu** : quelle est la toute première question
   posée à un client vague ? Puis la suivante ? Quand envoie-t-on un prix, un
   lien ? C'est une décision métier, jamais technique.
4. **Les cas d'escalade** : lister des cas concrets du métier, pas des
   catégories abstraites.
5. **Ce que l'agent ne fera JAMAIS seul** : encaisser, annuler, accorder une
   remise, confirmer une réservation… Cette liste devient des restrictions dans
   le schéma des outils, pas seulement des phrases dans un prompt.
6. **Le canal de messagerie disponible** et son coût (voir §7).
7. **Comment le patron veut piloter** : Telegram, dashboard, vocal ? Que
   veut-il pouvoir demander à voix haute ?
8. **Où vit l'argent aujourd'hui** : quelle banque, quel terminal de paiement,
   quel système de caisse, y a-t-il des espèces ? (voir §8 — c'est la question
   qu'on oublie et qui coûte le plus cher ensuite.)

---

## 3. Architecture de référence

```
Client ──WhatsApp──► Passerelle ──► Agent client (Edge Function)
                                          │
                                   ┌──────┴──────┐
                                   ▼             ▼
                            Base de données   Modèle IA (tool use)
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
   Tableau de bord          Agent manager            Synchros argent
      (web)              (Telegram + vocal)      (banque, terminal, en ligne)
```

| Brique | Rôle | Choix par défaut |
|---|---|---|
| Modèle de langage avec tool use | Le cerveau | Claude (Anthropic) |
| Base + fonctions serverless | CRM, config, outils | Supabase (Postgres + Edge Functions) |
| Passerelle messagerie | Recevoir/envoyer | Voir §7 |
| Tableau de bord | Piloter | Next.js sur la même base |
| Canal patron | Langage naturel | Bot Telegram |

### Le principe structurant : configuration ≠ règles

C'est la décision d'architecture qui fait gagner le plus de temps ensuite.

- **La configuration vit en base** (offres, prix, FAQ, horaires, faits sur
  l'établissement). Elle est injectée dans le prompt à chaque conversation :
  le patron change un prix, c'est actif immédiatement, sans redéploiement.
- **Les règles de comportement vivent dans le code** (ton, ordre de
  qualification, anti-répétition, escalade). Elles changent rarement et
  méritent une revue.

Ne jamais mettre une règle de comportement en base « parce que c'est plus
rapide » : on se retrouve avec la même contrainte écrite à deux endroits, et
elles divergent.

---

## 4. Modèle de données minimal

| Table | Rôle | Règle |
|---|---|---|
| `leads` | Prospects : contact, canal, offre visée, score, statut | Une intention |
| `conversations` | Historique par lead | — |
| `bookings` | Réservations/commandes | **Une transaction réelle** |
| `customers` | Clients confirmés | — |
| `revenues` / `expenses` | Comptabilité | Alimentées automatiquement |
| `agent_config` | Offres, prix, FAQ, règles métier | Modifiable sans déploiement |

**La règle qui structure tout :** une *intention* (lead) et une *transaction*
(booking) ne se mélangent jamais. « Je réserve de suite » est une intention.
Seul un paiement vérifié crée une transaction.

---

## 5. L'agent client

### 5.1 Structure du prompt — sections numérotées, à responsabilité unique

Jamais de prompt monolithique. Les onze sections qui ont fait leurs preuves :

1. Identité & ton
2. Format des messages (longueur, emojis, markdown selon le canal)
3. **Exemples de ton réel** — les vraies phrases de la Phase 0, avec des
   contre-exemples ❌ explicites
4. **Anti-répétition** — une info donnée une fois ne se redit jamais
5. Mémoire & fil de conversation
6. Qualification — l'ordre exact décidé en Phase 0
7. Offres, tarifs, inclusions
8. Interprétation des disponibilités/stock
9. Escalade vers un humain
10. Réservations — ce que l'agent ne fait jamais lui-même
11. Utilisation des outils (invisible pour le client)

**Le format qui porte le mieux** : des paires ❌/✅ tirées de vrais échanges
ratés. Une règle abstraite est ignorée ; un contre-exemple concret est suivi.

Avant d'ajouter une règle, vérifier qu'elle n'existe pas déjà ailleurs sous une
autre forme. La même contrainte réécrite à quatre endroits avec de petites
divergences est la cause n°1 d'incohérences.

### 5.2 La base de connaissances

Les faits sur l'établissement sont injectés en fin de prompt depuis la base.
**Ils doivent être audités** : voir §11.1, c'est le piège le plus sournois.

### 5.3 Les outils

Chaque action métier a un outil dédié dont la description dit explicitement
QUAND l'utiliser. L'agent ne « décide » jamais en texte libre qu'une chose est
disponible ou vraie.

Jeu de base : créer/enrichir une fiche prospect · qualifier · faire avancer le
statut · vérifier une disponibilité · transmettre un lien officiel · escalader.

### 5.4 Garde-fous serveur — non négociables

Un prompt n'est pas un contrat. Chacun de ces garde-fous existe parce que le
prompt seul n'a pas suffi en production :

- **Confirmation d'écriture bloquée sans preuve.** Si la réponse annonce « c'est
  enregistré » alors qu'aucun outil d'écriture n'a réussi dans CE tour, le
  serveur remplace le message. *(Constaté : 12 confirmations annoncées, 3 lignes
  réellement en base.)*
- **Statut critique refusé côté serveur.** « Payé/réservé/confirmé » retiré de
  l'énum de l'outil ET refusé par le serveur si le modèle insiste.
- **Jamais de silence.** Après un appel d'outil, un message texte est
  obligatoire. Si le modèle n'écrit rien, on relance un tour en interdisant les
  outils pour forcer une réponse.
- **Escalade avec message obligatoire.** Une escalade sans message au client est
  remplacée par un texte d'attente par défaut.
- **Filtre anti-méta.** Les notes internes du modèle (« réponse déjà envoyée »)
  ne doivent jamais partir au client.

---

## 6. L'agent manager (pour le patron)

Même cerveau partagé, deux canaux (chat texte et vocal), un seul fichier de
règles — ne jamais dupliquer le cerveau par canal.

- **Lecture large** sur toute la base.
- **Écriture étroite**, limitée à ce qui a été listé en Phase 0.
- **Confirmation en deux temps** pour tout changement de configuration :
  l'agent propose, décrit l'ancienne et la nouvelle valeur, et n'applique
  qu'après un « oui » explicite dans un message séparé.
- **Proactif** : un point hebdomadaire part tout seul. Un tableau de bord qu'on
  doit penser à ouvrir n'est pas consulté.

---

## 7. Canal WhatsApp

### 7.1 Connexion Blaze

> **[À COMPLÉTER — Robin]**
>
> Points à documenter ici pour que ce soit réutilisable :
> - Ce que Blaze apporte par rapport à la solution précédente, et pourquoi on a
>   basculé
> - Procédure de connexion d'un nouveau numéro, étape par étape
> - Coût réel (par message / par conversation / abonnement)
> - Ce qui est récupérable : numéro réel du client ? nom ? médias ?
> - Limites connues et comportement en cas de coupure

### 7.2 Pièges du canal, indépendants du fournisseur

- **Numéros masqués.** Certains contacts n'exposent pas leur vrai numéro à
  l'API, seulement un identifiant interne. Le patron voit le vrai numéro sur son
  téléphone, le système non. Conséquences : relance automatique impossible, et
  rapprochement paiement ↔ prospect cassé. **À tester dès le premier jour chez
  un nouveau client** — ça conditionne tout le suivi commercial.
- **Messages en rafale.** Un client écrit « Vers le 15 », « euh », « septembre »
  en trois bulles. Sans tampon, l'agent répond à la première phrase incomplète.
  Il faut regrouper les messages d'un même contact sur une courte fenêtre de
  silence avant d'appeler le modèle.
- **Reprise humaine.** Dès que le patron répond manuellement, l'agent se met en
  pause sur cette conversation — sinon les deux parlent en même temps.

---

## 8. L'argent — la partie qu'on sous-estime

### 8.1 Trois notions à ne jamais confondre

| Notion | Définition | Erreur classique |
|---|---|---|
| **Trésorerie** | Ce qu'il y a réellement sur le compte + en caisse | La confondre avec le résultat |
| **Chiffre d'affaires** | Ce qui a été encaissé sur une période | L'appeler « trésorerie » |
| **Marge nette** | CA − charges, un résultat comptable | **Croire que c'est de l'argent disponible** |

*Cas réel : un tableau de bord affichait 18 800 € de marge nette là où le compte
en banque contenait 6 000 €. L'écart venait des sorties d'argent jamais saisies
à la main. Un agent financier doit refuser de donner un chiffre quand une source
n'est pas connectée, plutôt que d'en inventer un à partir de données partielles.*

### 8.2 La règle anti-double-comptage

L'argent arrive par plusieurs canaux mais finit au même endroit :

| Événement | Nature |
|---|---|
| Paiement client en ligne / au terminal / en espèces | **Chiffre d'affaires** |
| Virement du prestataire de paiement vers la banque | **Transfert** |
| Dépôt des espèces à la banque | **Transfert** |

> **La banque porte la trésorerie. Les canaux de paiement portent le détail du
> chiffre d'affaires. Un transfert entre les deux n'est jamais du CA.**

Sans cette règle, le même client est compté deux fois.

### 8.3 Sources à brancher

Banque (trésorerie réelle et charges) · paiement en ligne · terminal de
paiement (avec ses commissions) · caisse espèces (saisie manuelle, seul flux
non automatisable).

### 8.4 Définir chaque indicateur une seule fois

Un même intitulé affiché à trois endroits avec trois calculs différents détruit
la confiance. Exemple vécu : « reste à encaisser » comptait toutes les
réservations à un endroit, seulement les futures à un autre.

**Chaque indicateur a une définition écrite, appliquée partout** — dashboard,
agent, rapports.

> **Définitions retenues chez Harmonie Yacht :**
> - *Reste à encaisser* = argent non perçu sur des prestations **à venir**
>   uniquement. Une prestation passée non soldée est une régularisation, pas de
>   l'argent attendu.
> - *Un encaissement est daté de l'événement réel*, pas du jour où on le saisit.
>   Un solde oublié puis régularisé compte pour le jour de la prestation.

---

## 9. Tableau de bord

> **[À COMPLÉTER — Robin]**
>
> Ossature de départ, à développer :
> - Les vues indispensables dès le jour 1
> - Ce qui doit sauter aux yeux à l'ouverture (ce qui demande une action)
> - Ce qu'on a ajouté après coup et qu'on referait d'emblée
> - Ce qu'on a construit et qui ne sert jamais

---

## 10. Mesure d'audience du site

Savoir d'où viennent les visiteurs conditionne les décisions marketing.

Un traqueur maison (un appel par page vue vers une fonction serverless) est
souvent préférable à une solution d'hébergeur : historique permanent au lieu de
30 jours glissants, données dans la base donc lisibles par l'agent manager, et
classement des provenances maîtrisé.

**Vie privée :** aucun cookie, aucune IP stockée. Un identifiant de visiteur
haché avec un sel et la date du jour permet de compter les visiteurs uniques
d'une journée sans jamais suivre quelqu'un dans le temps. Pas de bandeau de
consentement nécessaire.

**Garde-fous :** ignorer les robots, refuser les appels venant d'un autre
domaine que le site, et ne pas compter la navigation interne comme une
provenance.

---

## 11. Les pièges qui coûtent cher

**La section la plus importante du document.** Chaque ligne vient d'un bug réel
en production, pas d'une précaution théorique. À enrichir à chaque déploiement.

### 11.1 Une base de connaissances fausse est pire qu'une base vide
Deux faits erronés sont restés en place des mois : « pas de parking dédié »
alors qu'un parking gratuit existait, et un nom de bateau différent de celui
affiché sur place. Des clients ont cherché au mauvais endroit.
→ **Faire valider la base de connaissances point par point par le patron avant
la mise en ligne, puis la réauditer après les premières escalades.**

### 11.2 Les exemples du prompt périment avant les règles
Les tarifs avaient changé en base, mais les exemples du prompt citaient encore
les anciens prix. Un exemple chiffré est une ancre puissante : le modèle peut
annoncer l'ancien prix malgré la consigne d'utiliser la grille.
→ **Soit les exemples ne contiennent aucun chiffre, soit un contrôle vérifie
qu'ils correspondent à la configuration.**

### 11.3 Une escalade silencieuse fait perdre le client
L'agent passait la main à l'humain sans rien dire au client, qui restait sans
réponse. Pour lui, l'entreprise ne répond pas.
→ **Message d'attente obligatoire, imposé côté serveur.**

### 11.4 Escalader trop est aussi grave que pas assez
Une question factuelle dont la réponse est simplement « non, ce n'est pas
proposé » ne justifie pas de déranger un humain.
→ **Réserver l'escalade aux cas qui ont réellement besoin d'un arbitrage.**

### 11.5 Répondre par un lien à une question de prix tue la vente
Un prospect demande les tarifs et les prestations ; l'agent renvoie vers le
site. Le prospect répond « merci je vais regarder » et ne revient jamais. Une
demande de prix est le signal d'achat le plus fort qui existe.
→ **Toujours donner au moins une formule concrète avec son prix et ses
inclusions. Le lien vient en complément, jamais en remplacement.**

### 11.6 Le modèle se répète même quand le prompt l'interdit
Une règle anti-répétition existait et était quand même violée : en répondant à
une nouvelle question, le modèle rappelle le contexte précédent.
→ **Ajouter le cas précis en ❌/✅. Les règles abstraites ne suffisent pas.**

### 11.7 Le modèle confirme des actions qu'il n'a pas faites
Voir §5.4. **Vérification côté serveur obligatoire.**

### 11.8 L'argent encaissé sur place disparaît du système
La moitié du chiffre d'affaires était réglée le jour de la prestation, hors
paiement en ligne — bien comptée en CA, mais sans qu'on sache par quel moyen,
ni si elle avait atteint la banque.
→ **Traiter les encaissements sur place dès le départ, pas « plus tard ».**

### 11.9 Les commissions sont invisibles
Chaque prestataire de paiement prélève sa part. Le client paie 350 €, il en
arrive 344. Sur une année, c'est une charge réelle que personne n'enregistre.

### 11.10 Les tâches planifiées muettes
Une tâche programmée qui échoue sans alerter ne se découvre que le jour où on
cherche pourquoi un chiffre est faux.
→ **Journaliser chaque exécution avec sa date et son erreur éventuelle.**

### 11.11 Les secrets d'authentification jamais posés
Un secret partagé prévu dans le code mais jamais renseigné laisse des endpoints
ouverts sans que rien ne le signale.
→ **Vérifier que chaque protection prévue est réellement active.**

### 11.12 Le même indicateur calculé différemment selon l'écran
Voir §8.4.

---

## 12. Checklist de déploiement

**Avant le code**
- [ ] Entretien de découverte complet (§2), y compris la question sur l'argent
- [ ] 3 à 5 vraies conversations clients récupérées
- [ ] Ordre de qualification validé par écrit
- [ ] Liste de ce que l'agent ne fera jamais seul

**Socle**
- [ ] Base de données + configuration en base
- [ ] Agent client avec les 11 sections de prompt
- [ ] Les 5 garde-fous serveur (§5.4)
- [ ] Canal de messagerie connecté et testé sur un numéro masqué
- [ ] Escalade vers le patron testée de bout en bout

**Vérification avec le client**
- [ ] Base de connaissances validée fait par fait
- [ ] 5 à 10 messages types joués (vague, précis, négociation, cas limite)
- [ ] Le patron confirme que le ton est le sien

**Argent**
- [ ] Sources d'encaissement identifiées et branchées
- [ ] Règle anti-double-comptage appliquée
- [ ] Chaque indicateur défini une seule fois, par écrit

**Mise en service**
- [ ] Tous les secrets réellement posés et vérifiés
- [ ] Tâches planifiées actives et journalisées
- [ ] Point hebdomadaire automatique testé
- [ ] Mesure d'audience du site en place

---

## 13. Journal

| Date | Version | Changement |
|---|---|---|
| 2026-10-25 | 1.0 | Création. Consolide l'expérience Harmonie Yacht : architecture, garde-fous, règles comptables et 12 pièges issus de bugs réels. Sections Blaze (§7.1) et tableau de bord (§9) à compléter. |

---

*Issu de l'infra réelle d'Harmonie Yacht (yacht privatif, Carnon). Généralisable
à tout établissement avec un flux de demandes clients et un catalogue de
prestations : hôtellerie, restauration, loisirs, bien-être, événementiel.*

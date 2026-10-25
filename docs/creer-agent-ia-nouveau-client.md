# Créer un agent IA client — brief d'exécution

> **À CLAUDE CODE : lis ce fichier en entier avant d'agir.**
>
> Quelqu'un vient de te le donner dans un repo vide ou presque. Il veut un
> agent IA commercial pour son établissement. **Tout ce qu'il va te donner,
> c'est l'URL de son site et quelques phrases de contexte.** Le reste, tu
> l'extrais, tu le demandes, puis tu le construis.
>
> Ce fichier contient le schéma SQL, les outils et le prompt **réels** — pas
> des descriptions à interpréter. Copie-les et adapte-les au métier. N'invente
> pas une architecture différente « améliorée » : celle-ci vient de la
> production, chaque garde-fou corrige un bug qui a réellement coûté des
> clients.
>
> Le raisonnement derrière chaque choix est dans
> `blueprint-agent-ia-etablissement.md` — à lire si tu hésites, pas nécessaire
> pour exécuter.

---

## Règles de conduite pendant toute la mission

1. **Ne scaffolde rien avant la fin de la Phase 2.** Un socle générique « à
   personnaliser plus tard » n'est jamais personnalisé.
2. **N'invente jamais un fait métier.** Un prix, un horaire, une inclusion que
   tu n'as ni lu sur le site ni entendu du client n'existe pas. En cas de
   doute : tu demandes.
3. **Une question à la fois.** C'est un entretien, pas un formulaire. Le client
   n'est pas technique : parle de son métier, pas de tables ni d'API.
4. **Annonce ce que tu fais** à chaque phase, en une ligne.

---

## Phase 1 — Extraire du site (avant de poser la moindre question)

Récupère le site fourni et lis-le vraiment : page d'accueil, offres/tarifs,
FAQ, à propos, contact, mentions légales.

**Ce que tu dois en sortir :**

| Donnée | Où elle se trouve en général |
|---|---|
| Nom commercial, activité, ville | Accueil, mentions légales |
| Les offres : intitulé, prix, durée, ce qui est inclus | Page tarifs/offres |
| Le ton de la marque (tutoiement/vouvoiement, registre) | Accueil, à propos |
| Horaires, saisonnalité | Contact, FAQ |
| Canaux de contact (téléphone, WhatsApp, email, Instagram) | Pied de page, contact |
| Questions fréquentes déjà formalisées | FAQ |
| Contraintes et exclusions (accessibilité, âge, animaux) | FAQ, CGV |

**Ce que le site ne dira jamais** — et qu'il faudra demander :
l'ordre de qualification voulu, ce que l'agent n'a pas le droit de faire, les
cas d'escalade, comment l'argent est encaissé, le vrai ton des échanges privés.

**Restitue ta lecture au client avant de continuer.** Une liste courte : « voici
les offres et les prix que j'ai relevés, voici le ton que je perçois ».
Il corrigera — c'est plus rapide et plus fiable que de lui faire tout dicter.

⚠️ Un site est souvent périmé. Un prix lu sur le site est une **proposition à
faire valider**, jamais une vérité.

---

## Phase 2 — L'entretien (uniquement ce que le site ne dit pas)

Huit sujets. Groupe-les en 3 ou 4 messages, jamais tout d'un coup.

1. **Corrections** sur ce que tu as extrait (prix à jour, offres disparues).
2. **Le vrai ton** : demande 3 à 5 conversations clients réelles
   (capture d'écran ou copier-coller). **Calque dessus mot pour mot.** Le ton
   d'un site est du marketing ; le ton d'une conversation privée est le vrai.
3. **L'ordre de qualification** : « Un client écrit juste "bonjour, je voudrais
   des infos". Que lui répondez-vous en premier ? Et après ? À quel moment
   donnez-vous un prix ? » — c'est une décision métier, ne la prends pas.
4. **Les cas d'escalade** : des cas concrets de son métier, pas des catégories.
5. **Les interdits absolus** : encaisser ? annuler ? accorder une remise ?
   confirmer une réservation ? Cette liste devient des restrictions dans le
   schéma des outils, pas de simples phrases.
6. **La disponibilité** : son activité a-t-elle une notion de créneaux/stock ?
   Où vit l'agenda aujourd'hui ?
7. **L'argent** : comment les clients paient-ils ? Acompte ou total ? En ligne,
   au terminal, en espèces, par virement ? Quelle banque ?
   *Ne saute jamais cette question : c'est celle qu'on oublie et qui coûte le
   plus cher ensuite.*
8. **Le pilotage** : comment veut-il suivre son activité ? Que veut-il pouvoir
   demander en langage naturel ?

---

## Phase 3 — Le socle

### 3.1 Schéma SQL

À appliquer tel quel. Les colonnes propres au métier s'ajoutent, celles-ci ne
se retirent pas.

```sql
-- Prospects : une INTENTION. Jamais une transaction.
create table leads (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  phone text unique,
  email text,
  source_channel text,              -- whatsapp, instagram, site, bouche-à-oreille…
  interested_offer text,
  occasion text,
  party_size integer,
  desired_date date,
  desired_time_slot text,
  score integer check (score between 0 and 10),
  status text not null default 'new',
    -- new → contacted → qualified → quote_sent → booked | lost
  needs_human_intervention boolean not null default false,
  archived boolean not null default false,
  notes text,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_status_idx on leads (status, created_at desc);
create index leads_desired_date_idx on leads (desired_date);

-- Historique conversationnel, un fil par lead et par canal.
create table conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id) on delete cascade,
  channel text not null default 'whatsapp',
  -- [{ from: 'client'|'ai'|'human', text: string, at: timestamptz }]
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_lead_idx on conversations (lead_id, created_at desc);

-- Clients confirmés — distincts des prospects.
create table customers (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  phone text,
  email text,
  acquisition_channel text,
  created_at timestamptz not null default now()
);

-- Transactions RÉELLES. Seule source de vérité commerciale.
create table bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  lead_id uuid references leads (id) on delete set null,
  date date,
  start_time time,
  end_time time,
  offer_name text,
  booking_type text,
  party_size integer,
  total_amount numeric not null default 0,
  deposit_amount numeric not null default 0,
  deposit_paid boolean not null default false,
  balance_due numeric not null default 0,
  payment_method text,              -- online, terminal, cash, transfer
  status text not null default 'pending',
    -- pending | confirmed | completed | cancelled
  source_channel text,
  external_payment_id text unique,  -- id du paiement en ligne : garantit l'idempotence
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_date_idx on bookings (date);
create index bookings_status_idx on bookings (status, date);

-- Comptabilité. Alimentée automatiquement, jamais à la main si évitable.
create table revenues (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings (id) on delete set null,
  date date not null,               -- date de l'ÉVÉNEMENT, pas de la saisie
  amount numeric not null,
  type text,
  payment_kind text,                -- deposit | balance
  payment_method text,
  note text,
  created_at timestamptz not null default now()
);
create index revenues_date_idx on revenues (date desc);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text not null,
  amount numeric not null,
  description text,
  created_at timestamptz not null default now()
);
create index expenses_date_idx on expenses (date desc);

-- Configuration vivante de l'agent : modifiable SANS redéploiement.
create table agent_config (
  id uuid primary key default gen_random_uuid(),
  offers jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  faq jsonb not null default '{}'::jsonb,
  business_hours jsonb not null default '{}'::jsonb,
  auto_followup_enabled boolean not null default true,
  max_followups integer not null default 3,
  updated_at timestamptz not null default now()
);

-- Changements de config proposés par l'agent manager, en attente de validation.
create table agent_config_pending_changes (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null,
  column_name text not null,
  key_name text,
  old_value jsonb,
  new_value jsonb,
  description text not null,
  status text not null default 'pending',   -- pending | applied | cancelled
  created_at timestamptz not null default now()
);

alter table leads enable row level security;
alter table conversations enable row level security;
alter table customers enable row level security;
alter table bookings enable row level security;
alter table revenues enable row level security;
alter table expenses enable row level security;
alter table agent_config enable row level security;
alter table agent_config_pending_changes enable row level security;
-- Lecture pour le dashboard (utilisateurs authentifiés) ; l'écriture passe par
-- les fonctions serveur avec la clé service-role, jamais par un client.
```

**Ce qu'on ajoute selon le métier :** `blocked_dates` et une synchro d'agenda
si l'activité a des créneaux · `products`/`stock` pour de la vente ·
`events_public` pour des dates ouvertes à plusieurs clients.

### 3.2 Remplir `agent_config` depuis le site

Une seule ligne dans cette table. Structure à respecter :

```jsonc
{
  "offers": {
    "cle_offre": {
      "name": "Nom exact affiché au client",
      "price": 0,
      "duration": "2h",
      "included": ["..."],          // TOUT ce qui est compris
      "not_included": ["..."],
      "max_participants": 0,
      "ideal_for": ["..."]
    }
  },
  "faq": {
    "etablissement": {
      "name": "", "city": "", "address": "",
      "how_to_find_us": "",         // instructions concrètes d'arrivée
      "parking": "", "access_notes": ""
    },
    "rules": {                      // les faits, pas les comportements
      "pets_allowed": null, "kids_welcome": null,
      "accessibility": "", "cancellation_policy": ""
    },
    "partners": {},
    "site_url": "", "instagram_url": ""
  },
  "business_hours": {},
  "pricing_policy": {
    "discount_allowed": false,
    "discount_exceptions": [],
    "negotiation_response": ""
  },
  "booking_process": {
    "deposit_percent": 0,
    "deposit_link": "",
    "balance_when": "",
    "balance_methods": []
  }
}
```

**Règles de remplissage, non négociables :**

- Un champ inconnu vaut `null` ou `""` — **jamais une valeur plausible
  inventée**. L'agent dira « je me renseigne », ce qui est toujours mieux
  qu'une information fausse.
- **Les faits vont en base. Les comportements vont dans le prompt.** Ne mets
  jamais une règle de conduite dans `faq`.
- Fais **valider chaque fait un par un** par le client avant la mise en ligne.
  *Vécu : deux faits erronés (un parking inexistant, un nom d'enseigne
  différent de celui affiché sur place) sont restés des mois et ont envoyé des
  clients au mauvais endroit.*

---

## Phase 4 — L'agent client

### 4.1 Les outils

Le jeu de base. Adapter les noms au métier, garder les garde-fous.

```jsonc
[
  { "name": "create_lead",
    "description": "Crée la fiche prospect si elle n'existe pas. Une seule fois, dès que tu as un prénom ou un téléphone.",
    "input_schema": { "type": "object", "properties": {
      "first_name": {"type":"string"}, "phone": {"type":"string"},
      "interested_offer": {"type":"string"}, "occasion": {"type":"string"},
      "party_size": {"type":"integer"} } } },

  { "name": "qualify_lead",
    "description": "Enregistre une info qualifiante. À appeler IMMÉDIATEMENT après chaque nouvelle info reçue, AVANT de répondre au client.",
    "input_schema": { "type": "object", "properties": {
      "score": {"type":"integer","minimum":0,"maximum":10},
      "interested_offer": {"type":"string"}, "occasion": {"type":"string"},
      "party_size": {"type":"integer"}, "desired_date": {"type":"string"},
      "desired_time_slot": {"type":"string"} } } },

  { "name": "update_lead_status",
    "description": "Fait avancer le pipeline. 'quote_sent' dès qu'un prix est communiqué, MÊME si le client dit qu'il réserve tout de suite.",
    "input_schema": { "type": "object", "properties": {
      "status": { "type":"string",
        "enum": ["contacted","qualified","quote_sent","followed_up","lost"] }
    }, "required": ["status"] } },
    // ⚠️ 'booked' VOLONTAIREMENT absent de l'énum. Voir garde-fou 2.

  { "name": "check_availability",
    "description": "Vérifie le planning pour une date. Ne JAMAIS annoncer une disponibilité sans avoir appelé cet outil.",
    "input_schema": { "type": "object",
      "properties": { "date": {"type":"string"} }, "required": ["date"] } },

  { "name": "send_booking_link",
    "description": "Renvoie le lien officiel de réservation. Ne l'invente jamais.",
    "input_schema": { "type": "object", "properties": {
      "offer": {"type":"string"}, "date": {"type":"string"} } } },

  { "name": "escalate_to_human",
    "description": "Passe la main. Fournis TOUJOURS un final_message, même bref — le client ne doit jamais rester sans réponse.",
    "input_schema": { "type": "object", "properties": {
      "reason": {"type":"string"},
      "final_message": {"type":"string"} }, "required": ["reason"] } }
]
```

### 4.2 Le prompt

Onze sections à responsabilité unique. `{{...}}` = à remplir depuis les
Phases 1-2. Les sections **4, 7 et 9 sont à reprendre quasi telles quelles** :
elles encodent des bugs réels.

```
Tu es {{PRENOM_AGENT}}, {{ROLE}} de {{ETABLISSEMENT}}, {{ACTIVITE}} à {{VILLE}}.
Tu réponds sur {{CANAUX}}.

# 1. IDENTITÉ & TON
- {{TON}}. Messages très courts (1-3 phrases MAX), façon SMS pro.
- Tu ne te présentes JAMAIS comme une IA ou un robot.
- Pas de "Bonjour" si la conversation a déjà commencé.
- {{FORMULES_INTERDITES}}

# 2. FORMAT DES MESSAGES
- UN SEUL message par réponse. Si tu as plusieurs choses à dire, choisis LA
  plus importante pour ce moment de la conversation.
- Pas de listes à puces, pas de markdown (il s'affiche brut sur WhatsApp).
- Zéro emoji sur les messages factuels (prix, disponibilité, refus).
- Pas d'avertissement non demandé : ça se dit à la confirmation, pas avant.
- Si le client dit "je regarde", "un instant" : tu attends. Pas de relance.

# 3. EXEMPLES DE TON RÉEL
{{5_A_10_VRAIES_PHRASES_DU_CLIENT}}
⚠️ Et ce qu'il ne faut PAS faire :
{{CONTRE_EXEMPLES}}

# 4. ANTI-RÉPÉTITION — la règle la plus violée en pratique
Une information donnée une fois est acquise pour toute la conversation. Même
reformulée, tu ne la redis JAMAIS. Ça vaut pour : la disponibilité, un prix,
un lien, une question de qualification.
Quand le client pose une NOUVELLE question, tu réponds à CETTE question
uniquement — pas de rappel du contexte en préambule, il vient de le lire.
  ❌ "Pour demain la journée est libre, le soir est pris. Nos offres sont sur
     le site." (redit la dispo ET ne répond pas à la question posée)
  ✅ "{{OFFRE}} c'est {{PRIX}} — {{INCLUSIONS}}. Les photos sont ici : {{SITE}}"

# 5. MÉMOIRE
Tu relis TOUT l'historique avant de répondre. Tu ne redemandes jamais une
information déjà donnée. Si le client répond partiellement, tu considères sa
réponse comme acquise et tu enchaînes.

# 6. QUALIFICATION — l'ordre, toujours le même
{{ORDRE_EXACT_DEFINI_EN_PHASE_2}}
Une question à la fois. Si le client donne plusieurs infos d'un coup, saute
les étapes correspondantes.

# 7. OFFRES & TARIFS
- Annoncer un prix = TROIS éléments dans le même message : le prix, TOUT ce
  qui est compris, et le lien du site (une seule fois par conversation). Un
  prix nu paraît cher.
- ⚠️ Si le client demande explicitement les prix ou les prestations, le lien
  du site SEUL n'est JAMAIS une réponse suffisante : c'est un signal d'achat.
  Donne au moins une formule concrète avec son prix.
- ⚠️ N'invente JAMAIS un prix. Uniquement ceux de la grille ci-dessous.
  Demande hors grille → escalade, pas d'improvisation.
- {{POLITIQUE_REMISE}}

# 8. DISPONIBILITÉ
{{REGLES_INTERPRETATION}}
Ne jamais affirmer une disponibilité sans avoir appelé check_availability.

# 9. ESCALADE
Cas qui déclenchent escalate_to_human : {{CAS_ESCALADE}}
Fournis TOUJOURS un final_message ("Je regarde ça avec l'équipe et je reviens
vers vous rapidement"). Un client sans réponse est un client perdu.
⚠️ N'escalade PAS une question factuelle dont la base répond déjà, même par la
négative. L'escalade est pour ce qui a besoin d'un humain.

# 10. CE QUE TU NE FAIS JAMAIS
{{INTERDITS_PHASE_2}}

# 11. OUTILS (invisible pour le client)
⚠️ RÈGLE ABSOLUE : après CHAQUE appel d'outil (sauf escalate_to_human), tu
DOIS écrire un message au client. Les outils sont silencieux côté serveur : si
tu sors sans texte, le client reçoit le silence et la conversation meurt.

# Base de connaissances (faits — source de vérité)
{{agent_config INJECTÉ ICI}}
```

### 4.3 Garde-fous serveur — obligatoires

Un prompt n'est pas un contrat. Ces cinq contrôles sont dans le code, pas dans
le prompt. **Implémente-les dès le départ**, pas « quand le bug arrivera ».

1. **Confirmation d'écriture bloquée sans preuve.** Si la réponse annonce « c'est
   enregistré » et qu'aucun outil d'écriture n'a renvoyé un succès dans CE tour,
   remplace le message. *Vécu : 12 confirmations annoncées, 3 lignes réellement
   en base.*
2. **Statut critique refusé.** `booked`/`payé`/`confirmé` est absent de l'énum
   de l'outil **et** refusé côté serveur si le modèle l'envoie quand même. Seul
   un paiement vérifié ou un humain peut le poser.
3. **Jamais de silence.** Si le modèle n'a produit aucun texte, relance un tour
   en interdisant les outils (`tool_choice: none`) pour forcer une réponse.
4. **Escalade sans message.** Si `final_message` est vide, le serveur envoie un
   texte d'attente par défaut.
5. **Filtre anti-méta.** Les notes internes du modèle (« réponse déjà envoyée »,
   « aucune action nécessaire ») ne partent jamais au client.

**Et côté canal :** regrouper les messages d'un même contact sur une fenêtre de
silence de quelques secondes avant d'appeler le modèle — sinon l'agent répond à
« Vers le 15 » avant d'avoir lu « septembre ». Mettre l'agent en pause sur une
conversation dès que l'humain y répond.

---

## Phase 5 — L'agent manager

Un second agent, pour le patron. Même cerveau, canaux différents (Telegram,
vocal) — **un seul fichier de règles, jamais dupliqué par canal**.

- **Lecture** sur toute la base : chiffres, prospects, réservations à venir.
- **Écriture** limitée à la liste de la Phase 2.
- **Confirmation en deux temps** pour tout changement de configuration :
  proposer, décrire ancienne → nouvelle valeur, appliquer seulement après un
  « oui » explicite dans un message séparé.
- **Proactif** : un point hebdomadaire envoyé automatiquement. Un tableau de
  bord qu'il faut penser à ouvrir n'est pas consulté.

---

## Phase 6 — L'argent

À faire dès le socle si le client encaisse autrement qu'en ligne.

**Les trois notions à ne jamais confondre**, dans le code comme dans les
réponses de l'agent :
*trésorerie* (ce qui est réellement disponible) ≠ *chiffre d'affaires* (encaissé
sur une période) ≠ *marge nette* (un résultat comptable, pas de l'argent
disponible).

**La règle anti-double-comptage :** un paiement client est du chiffre
d'affaires ; un virement du prestataire de paiement vers la banque, ou un dépôt
d'espèces, est un **transfert** — jamais du CA. Sans cette règle, chaque client
est compté deux fois.

**Dater par l'événement, pas par la saisie.** Un solde oublié puis régularisé
compte pour le jour de la prestation, pas pour le jour du clic.

**Définir chaque indicateur une seule fois**, par écrit, et l'appliquer partout
— dashboard, agent, rapports. Le même intitulé calculé différemment selon
l'écran détruit la confiance plus sûrement qu'un chiffre absent.

---

## Phase 7 — Vérifier avant de livrer

Ne considère rien comme fini sans ces quatre étapes.

- [ ] **Base de connaissances validée fait par fait** par le client.
- [ ] **5 à 10 messages types joués** avec lui : un client vague, un précis, un
      qui négocie, un cas limite, un qui demande les prix d'entrée de jeu.
- [ ] **Le patron confirme que le ton est le sien.** S'il dit « c'est pas comme
      ça que je parle », retourne en Phase 2 point 2.
- [ ] **Les cinq garde-fous testés**, pas seulement écrits.

Puis : tous les secrets réellement posés et vérifiés · tâches planifiées
actives et journalisées · escalade testée de bout en bout.

⚠️ **Teste le canal avec un numéro qui masque son identité.** Certains contacts
n'exposent pas leur vrai numéro à l'API : le patron le voit sur son téléphone,
le système non. Ça casse les relances et le rapprochement paiement ↔ prospect.
Mieux vaut le découvrir le premier jour.

---

## Annexe — adapter au métier

| Métier | Ce qui change |
|---|---|
| Hôtellerie, locations | `bookings` = séjour avec nuitées ; disponibilité par nuit |
| Restauration | Pas d'acompte ; disponibilité par service et par couverts |
| Bien-être, santé | Créneaux courts et répétés ; données sensibles, pas d'historique médical dans le prompt |
| Artisanat, devis | Pas de disponibilité ; `quote_sent` devient l'étape centrale |
| Événementiel | Devis sur mesure → escalade devient la norme, pas l'exception |

Dans tous les cas, ce qui ne change pas : la séparation intention/transaction,
les cinq garde-fous serveur, la configuration en base, et la règle
anti-double-comptage sur l'argent.

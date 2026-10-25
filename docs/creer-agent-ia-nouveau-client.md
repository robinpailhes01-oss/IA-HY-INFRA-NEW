# Créer un agent IA client

> **À Claude Code.** Brief exécutable. Lis-le en entier, puis déroule les
> 6 étapes dans l'ordre.
>
> Les raisons derrière chaque choix sont dans
> `blueprint-agent-ia-etablissement.md`. Tu n'as pas besoin de les lire pour
> exécuter — seulement si tu es tenté de faire autrement.

**Ce que l'utilisateur te donne :** une URL de site + 2-3 phrases de contexte.
**Tout le reste, tu l'extrais, tu le demandes, puis tu le construis.**

| Étape | Tu fais | Tu produis |
|---|---|---|
| 1 | Lire le site | Une fiche à faire valider |
| 2 | Entretien ciblé | Les 8 réponses manquantes |
| 3 | Base de données | Schéma appliqué + config remplie |
| 4 | Agent client | Outils + prompt + garde-fous |
| 5 | Agent manager | Pilotage pour le patron |
| 6 | Vérifier | Tests joués avec le client |

**Trois règles pendant toute la mission :**
- Ne scaffolde rien avant la fin de l'étape 2.
- N'invente jamais un fait métier. Inconnu = tu demandes.
- Une question à la fois. Parle métier, pas technique.

---

## 1. Lire le site

Lis : accueil, offres/tarifs, FAQ, à propos, contact, mentions légales.

Extrais : nom · activité · ville · adresse · offres (intitulé, prix, durée,
inclus, non inclus) · ton · horaires · canaux de contact · FAQ existante ·
contraintes (accessibilité, enfants, animaux).

**Sortie :** restitue ta lecture au client en une liste courte. Il corrige.
C'est plus rapide et plus fiable que de lui faire tout dicter.

⚠️ Un prix lu sur un site est **à valider**, jamais une vérité.

---

## 2. Entretien

Huit sujets, groupés en 3 messages. Pas de questionnaire d'un bloc.

1. **Corrections** sur ce que tu as extrait.
2. **Le vrai ton** — réclame 3 à 5 vraies conversations clients. Le site, c'est
   du marketing ; une conversation privée, c'est le vrai ton. Calque mot pour mot.
3. **L'ordre de qualification** — « un client écrit juste *bonjour, je voudrais
   des infos*. Vous répondez quoi en premier ? Puis ? À quel moment un prix ? »
4. **Cas d'escalade** — concrets, tirés de son métier.
5. **Interdits absolus** — encaisser ? annuler ? remiser ? confirmer ?
6. **Disponibilité** — y a-t-il des créneaux/stock ? où vit l'agenda ?
7. **L'argent** — acompte ou total ? en ligne, terminal, espèces, virement ?
   *Ne saute jamais cette question.*
8. **Pilotage** — que veut-il demander en langage naturel ?

---

## 3. Base de données

### 3.1 Schéma — à appliquer tel quel

```sql
-- Prospect = une INTENTION. Jamais une transaction.
create table leads (
  id uuid primary key default gen_random_uuid(),
  first_name text, last_name text,
  phone text unique, email text,
  source_channel text,
  interested_offer text, occasion text, party_size integer,
  desired_date date, desired_time_slot text,
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

create table conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id) on delete cascade,
  channel text not null default 'whatsapp',
  -- [{ from: 'client'|'ai'|'human', text, at }]
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_lead_idx on conversations (lead_id, created_at desc);

create table customers (
  id uuid primary key default gen_random_uuid(),
  first_name text, last_name text, phone text, email text,
  acquisition_channel text,
  created_at timestamptz not null default now()
);

-- Transaction RÉELLE. Seule source de vérité commerciale.
create table bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  lead_id uuid references leads (id) on delete set null,
  date date, start_time time, end_time time,
  offer_name text, booking_type text, party_size integer,
  total_amount numeric not null default 0,
  deposit_amount numeric not null default 0,
  deposit_paid boolean not null default false,
  balance_due numeric not null default 0,
  payment_method text,              -- online | terminal | cash | transfer
  status text not null default 'pending',
    -- pending | confirmed | completed | cancelled
  source_channel text,
  external_payment_id text unique,  -- idempotence des webhooks de paiement
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_date_idx on bookings (date);
create index bookings_status_idx on bookings (status, date);

create table revenues (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings (id) on delete set null,
  date date not null,               -- date de l'ÉVÉNEMENT, pas de la saisie
  amount numeric not null,
  type text, payment_kind text,     -- deposit | balance
  payment_method text, note text,
  created_at timestamptz not null default now()
);
create index revenues_date_idx on revenues (date desc);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null, category text not null,
  amount numeric not null, description text,
  created_at timestamptz not null default now()
);
create index expenses_date_idx on expenses (date desc);

-- Config vivante : modifiable SANS redéploiement. Une seule ligne.
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

-- Changements proposés par l'agent manager, en attente de validation.
create table agent_config_pending_changes (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null,
  column_name text not null, key_name text,
  old_value jsonb, new_value jsonb,
  description text not null,
  status text not null default 'pending',  -- pending | applied | cancelled
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
-- Lecture : utilisateurs authentifiés (dashboard).
-- Écriture : fonctions serveur en service-role uniquement.
```

**À ajouter selon le métier :** `blocked_dates` + synchro agenda si créneaux ·
`products`/`stock` si vente · `events_public` si dates collectives.

### 3.2 Remplir `agent_config`

```jsonc
{
  "offers": {
    "cle_offre": {
      "name": "", "price": 0, "duration": "",
      "included": [], "not_included": [],
      "max_participants": 0, "ideal_for": []
    }
  },
  "faq": {
    "etablissement": {
      "name": "", "city": "", "address": "",
      "how_to_find_us": "", "parking": "", "access_notes": ""
    },
    "rules": {
      "pets_allowed": null, "kids_welcome": null,
      "accessibility": "", "cancellation_policy": ""
    },
    "partners": {}, "site_url": "", "instagram_url": ""
  },
  "business_hours": {},
  "pricing_policy": {
    "discount_allowed": false, "discount_exceptions": [],
    "negotiation_response": ""
  },
  "booking_process": {
    "deposit_percent": 0, "deposit_link": "",
    "balance_when": "", "balance_methods": []
  }
}
```

- Champ inconnu = `null` ou `""`. **Jamais une valeur plausible inventée.**
- **Les faits en base, les comportements dans le prompt.** Jamais de règle de
  conduite dans `faq`.
- Fais valider **chaque fait un par un** avant la mise en ligne.

---

## 4. Agent client

### 4.1 Outils

```jsonc
[
  { "name": "create_lead",
    "description": "Crée la fiche prospect. Une seule fois, dès que tu as un prénom ou un téléphone.",
    "input_schema": { "type":"object", "properties": {
      "first_name":{"type":"string"}, "phone":{"type":"string"},
      "interested_offer":{"type":"string"}, "occasion":{"type":"string"},
      "party_size":{"type":"integer"} } } },

  { "name": "qualify_lead",
    "description": "Enregistre une info qualifiante. IMMÉDIATEMENT après l'avoir reçue, AVANT de répondre.",
    "input_schema": { "type":"object", "properties": {
      "score":{"type":"integer","minimum":0,"maximum":10},
      "interested_offer":{"type":"string"}, "occasion":{"type":"string"},
      "party_size":{"type":"integer"}, "desired_date":{"type":"string"},
      "desired_time_slot":{"type":"string"} } } },

  { "name": "update_lead_status",
    "description": "Fait avancer le pipeline. 'quote_sent' dès qu'un prix est donné, MÊME si le client dit qu'il réserve tout de suite.",
    "input_schema": { "type":"object", "properties": {
      "status": { "type":"string",
        "enum": ["contacted","qualified","quote_sent","followed_up","lost"] }
    }, "required":["status"] } },
    // 'booked' VOLONTAIREMENT absent. Ce n'est pas un oubli — voir garde-fou 2.

  { "name": "check_availability",
    "description": "Vérifie le planning. Ne JAMAIS annoncer une disponibilité sans l'avoir appelé.",
    "input_schema": { "type":"object",
      "properties": {"date":{"type":"string"}}, "required":["date"] } },

  { "name": "send_booking_link",
    "description": "Renvoie le lien officiel de réservation. Ne l'invente jamais.",
    "input_schema": { "type":"object", "properties": {
      "offer":{"type":"string"}, "date":{"type":"string"} } } },

  { "name": "escalate_to_human",
    "description": "Passe la main. Fournis TOUJOURS un final_message, même bref.",
    "input_schema": { "type":"object", "properties": {
      "reason":{"type":"string"}, "final_message":{"type":"string"} },
      "required":["reason"] } }
]
```

### 4.2 Prompt

`{{...}}` = à remplir depuis les étapes 1-2.
Les sections **4, 7 et 9 se reprennent telles quelles** : elles corrigent des
bugs réels.

```
Tu es {{PRENOM}}, {{ROLE}} de {{ETABLISSEMENT}}, {{ACTIVITE}} à {{VILLE}}.
Tu réponds sur {{CANAUX}}.

# 1. IDENTITÉ & TON
- {{TON}}. Messages très courts (1-3 phrases MAX), façon SMS pro.
- Tu ne te présentes JAMAIS comme une IA.
- Pas de "Bonjour" si la conversation a déjà commencé.
- {{FORMULES_INTERDITES}}

# 2. FORMAT
- UN SEUL message par réponse. Plusieurs choses à dire → choisis LA plus importante.
- Pas de listes à puces, pas de markdown (il s'affiche brut sur WhatsApp).
- Zéro emoji sur un message factuel (prix, dispo, refus).
- Pas d'avertissement non demandé : ça se dit à la confirmation.
- Client qui dit "je regarde" → tu attends. Pas de relance.

# 3. TON RÉEL
{{VRAIES_PHRASES_DU_CLIENT}}
⚠️ À ne pas faire : {{CONTRE_EXEMPLES}}

# 4. ANTI-RÉPÉTITION — la règle la plus violée
Une info donnée une fois est acquise pour toute la conversation. Même
reformulée, tu ne la redis JAMAIS : dispo, prix, lien, question déjà posée.
Nouvelle question du client → tu réponds à CETTE question uniquement. Pas de
rappel du contexte en préambule, il vient de le lire.
  ❌ "Pour demain la journée est libre, le soir est pris. Nos offres sont sur
     le site." → redit la dispo ET ne répond pas à la question
  ✅ "{{OFFRE}} c'est {{PRIX}} — {{INCLUSIONS}}. Les photos : {{SITE}}"

# 5. MÉMOIRE
Tu relis TOUT l'historique. Tu ne redemandes jamais une info déjà donnée.
Réponse partielle → acquise, tu enchaînes.

# 6. QUALIFICATION
{{ORDRE_EXACT}}
Une question à la fois. Plusieurs infos d'un coup → saute les étapes.

# 7. OFFRES & TARIFS
- Annoncer un prix = 3 éléments : le prix, TOUT ce qui est compris, le lien
  (une seule fois par conversation). Un prix nu paraît cher.
- ⚠️ Demande explicite de prix ou de prestations → le lien SEUL n'est JAMAIS
  suffisant. C'est un signal d'achat : donne une formule concrète avec son prix.
- ⚠️ N'invente JAMAIS un prix. Hors grille → escalade.
- {{POLITIQUE_REMISE}}

# 8. DISPONIBILITÉ
{{REGLES}}
Jamais d'affirmation sans check_availability.

# 9. ESCALADE
Déclencheurs : {{CAS_ESCALADE}}
final_message TOUJOURS rempli ("Je regarde ça avec l'équipe et je reviens vers
vous rapidement"). Un client sans réponse est un client perdu.
⚠️ N'escalade PAS une question factuelle dont la base a déjà la réponse, même
négative. L'escalade est pour ce qui a besoin d'un humain.

# 10. JAMAIS
{{INTERDITS}}

# 11. OUTILS (invisible pour le client)
⚠️ Après CHAQUE outil (sauf escalate_to_human), tu DOIS écrire au client. Les
outils sont silencieux : sans texte, le client reçoit le silence.

# Base de connaissances (faits)
{{agent_config}}
```

### 4.3 Garde-fous serveur — du code, pas des consignes

Un prompt n'est pas un contrat. Les cinq, dès le départ :

1. **Confirmation bloquée sans preuve** — la réponse annonce « c'est
   enregistré » et aucun outil d'écriture n'a réussi dans CE tour → remplace le
   message. *Vécu : 12 confirmations annoncées, 3 lignes réellement en base.*
2. **Statut critique refusé** — `booked` absent de l'énum **et** refusé côté
   serveur. Seul un paiement vérifié ou un humain le pose.
3. **Jamais de silence** — aucun texte produit → relance un tour avec
   `tool_choice: none`.
4. **Escalade sans message** → texte d'attente par défaut envoyé par le serveur.
5. **Filtre anti-méta** — les notes internes du modèle ne partent jamais au
   client.

**Côté canal :** regrouper les messages d'un même contact sur quelques secondes
de silence avant d'appeler le modèle (sinon l'agent répond à « vers le 15 »
avant d'avoir lu « septembre ») · mettre l'agent en pause dès que l'humain
répond.

---

## 5. Agent manager

Pour le patron. Même cerveau, plusieurs canaux, **un seul fichier de règles**.

- **Lecture** sur toute la base.
- **Écriture** limitée à la liste de l'étape 2.
- **Confirmation en deux temps** pour toute modification de config : proposer,
  décrire ancienne → nouvelle valeur, appliquer après un « oui » explicite.
- **Proactif** : point hebdomadaire envoyé tout seul.

**Si le client encaisse autrement qu'en ligne :**
- Ne jamais confondre *trésorerie* (disponible) · *chiffre d'affaires*
  (encaissé) · *marge nette* (comptable, ≠ disponible).
- Un virement du prestataire de paiement vers la banque, ou un dépôt
  d'espèces, est un **transfert** — jamais du CA. Sinon chaque client compte
  double.
- Dater par l'événement, pas par la saisie.
- Chaque indicateur défini **une seule fois**, appliqué partout.

---

## 6. Vérifier avant de livrer

- [ ] Base de connaissances validée **fait par fait**
- [ ] 5 à 10 messages types joués avec le client : vague · précis · négociation
      · cas limite · demande de prix d'emblée
- [ ] Le patron confirme que **le ton est le sien** (sinon → étape 2.2)
- [ ] Les 5 garde-fous **testés**, pas seulement écrits
- [ ] Secrets réellement posés · tâches planifiées journalisées · escalade
      testée de bout en bout

⚠️ **Teste avec un numéro qui masque son identité.** Certains contacts
n'exposent pas leur vrai numéro à l'API : le patron le voit, le système non.
Ça casse les relances et le rapprochement paiement ↔ prospect.

---

## Adapter au métier

| Métier | Ce qui change |
|---|---|
| Hôtellerie | `bookings` = séjour ; dispo par nuit |
| Restauration | Pas d'acompte ; dispo par service et couverts |
| Bien-être, santé | Créneaux courts ; aucune donnée sensible dans le prompt |
| Artisanat, devis | Pas de dispo ; `quote_sent` devient l'étape centrale |
| Événementiel | Sur-mesure → l'escalade devient la norme |

Ne change jamais : séparation intention/transaction · les 5 garde-fous ·
la config en base · la règle anti-double-comptage.

-- Archive clients 2023-2025 (ère "Next Yacht") + suivi des campagnes de
-- relance par email.
--
-- Ces clients n'existent nulle part dans le système actuel : ils viennent des
-- exports .ics de l'ancien calendrier Google (next.yacht34@gmail.com), qui a
-- une structure différente du calendrier actuel (participant = client, pas de
-- description structurée Client:/Email:/Téléphone:...). On les garde dans une
-- table séparée de `leads`/`customers` — ce ne sont pas des prospects actifs
-- du pipeline actuel, mais un historique à réactiver ponctuellement.

create table if not exists legacy_clients (
  id uuid primary key default gen_random_uuid(),

  first_name text,
  last_name text,
  email text,
  phone text,
  -- Résumé de l'événement calendrier (ex. "Nuit Insolite + sortie en mer —
  -- Sophie Martin"), gardé tel quel : le format des vieux événements varie
  -- trop pour être découpé fiablement en offre/montant.
  offer_summary text,
  event_date date,
  -- Nullable : un événement sans date exploitable est quand même importé,
  -- juste non rattachable à une campagne "clients de l'année X".
  event_year int,

  -- UID de l'événement iCalendar. Un même événement peut avoir plusieurs
  -- invités (couple, amis réservant ensemble) : la déduplication au
  -- réimport porte donc sur (uid, email), pas sur l'uid seul — voir l'index
  -- unique plus bas.
  ics_uid text not null,
  -- Description brute de l'événement, gardée pour audit / relecture manuelle
  -- si jamais le parsing automatique a raté une info.
  raw_description text,
  source_file text,

  created_at timestamptz not null default now()
);

create unique index if not exists legacy_clients_uid_email_idx on legacy_clients (ics_uid, email);
create index if not exists legacy_clients_year_idx on legacy_clients (event_year);
create index if not exists legacy_clients_email_idx on legacy_clients (email);

alter table legacy_clients enable row level security;

drop policy if exists "Authenticated users full access" on legacy_clients;
create policy "Authenticated users full access"
  on legacy_clients for all
  to authenticated
  using (true)
  with check (true);

-- ── Suivi des campagnes de relance ──────────────────────────────────
--
-- Une ligne par (client, campagne) : un même client peut recevoir plusieurs
-- campagnes différentes dans le temps (le changement de nom aujourd'hui, une
-- autre offre plus tard) sans que l'historique de l'une écrase l'autre.

create table if not exists client_outreach (
  id uuid primary key default gen_random_uuid(),
  legacy_client_id uuid not null references legacy_clients(id) on delete cascade,

  -- Identifiant court de la campagne (ex. "changement_nom_2025"). Sert de
  -- clé fonctionnelle : un client ne reçoit jamais deux fois la même
  -- campagne (contrainte unique ci-dessous).
  campaign text not null,

  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),

  provider text not null default 'resend',
  provider_message_id text,
  error text,

  -- Snapshot du contenu réellement envoyé — utile si le template change
  -- entre deux vagues d'envoi, pour savoir exactement ce que CE client a reçu.
  email_subject text,
  email_body_html text,

  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (legacy_client_id, campaign)
);

create index if not exists client_outreach_campaign_idx on client_outreach (campaign, status);

alter table client_outreach enable row level security;

drop policy if exists "Authenticated users full access" on client_outreach;
create policy "Authenticated users full access"
  on client_outreach for all
  to authenticated
  using (true)
  with check (true);

-- Boîte mail : tri automatique des mails (clients, factures, banque…), avec
-- suppression (corbeille Gmail) UNIQUEMENT sur validation.
--
-- Alimenté par les fonctions Edge mail-oauth (connexion Google), mail-sync (lecture
-- et classement) et mail-act (corbeille, étiquette « Factures »).

-- Compte Gmail connecté. Le jeton de renouvellement donne accès à la boîte :
-- RLS activé SANS politique = lisible par la clé de service uniquement. Le tableau
-- de bord ne voit que la vue mail_account_status (sans le jeton).
create table mail_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  refresh_token text not null,
  scopes text,
  status text not null default 'connected',
  last_error text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz
);
alter table mail_accounts enable row level security;

create view mail_account_status as
select id, email, status, last_error, connected_at, last_sync_at from mail_accounts;
revoke all on mail_account_status from anon;
grant select on mail_account_status to authenticated, service_role;

-- Un mail = une ligne (métadonnées seulement : jamais le corps du message).
create table mail_messages (
  -- Identifiant Gmail du message.
  id text primary key,
  account_id uuid references mail_accounts (id) on delete cascade,
  thread_id text,
  from_name text,
  from_email text,
  subject text,
  snippet text,
  received_at timestamptz,
  has_attachment boolean not null default false,
  attachment_names text[] not null default '{}',
  -- En-tête List-Unsubscribe présent : presque toujours un envoi de masse.
  bulk boolean not null default false,
  -- client | facture | banque_impots | fournisseur | newsletter | notification | indesirable | autre | a_classer
  category text not null default 'a_classer',
  -- keep | trash : ce que l'agent PROPOSE. Rien n'est supprimé sans validation.
  proposed_action text not null default 'keep',
  confidence numeric,
  reason text,
  -- regle | ia | robin
  classified_by text,
  -- inbox | trashed | invoice (rangé sous l'étiquette « Factures »)
  status text not null default 'inbox',
  trashed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mail_messages_received_idx on mail_messages (received_at desc);
create index mail_messages_category_idx on mail_messages (category, status);
create index mail_messages_sender_idx on mail_messages (from_email);

-- Règles apprises : « toujours classer cet expéditeur ainsi ».
create table mail_rules (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sender', 'domain')),
  pattern text not null,
  category text not null,
  action text not null default 'keep' check (action in ('keep', 'trash')),
  created_at timestamptz not null default now(),
  unique (kind, pattern)
);

alter table mail_messages enable row level security;
alter table mail_rules enable row level security;
create policy "Authenticated users full access" on mail_messages for all to authenticated using (true) with check (true);
create policy "Authenticated users full access" on mail_rules for all to authenticated using (true) with check (true);

-- Synchronisation automatique : toutes les 30 minutes entre 6 h et 22 h (UTC 5–21).
create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'mail-sync-half-hourly') then
    perform cron.unschedule('mail-sync-half-hourly');
  end if;
end $$;

select cron.schedule(
  'mail-sync-half-hourly',
  '*/30 5-21 * * *',
  $cron$
    select net.http_post(
      url := 'https://szdfpjyytwedhochvzfd.supabase.co/functions/v1/mail-sync',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $cron$
);

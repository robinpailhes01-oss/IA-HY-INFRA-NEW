-- SQL de reconstruction — Harmonie Yacht. Généré par scripts/rebuild/build_schema.py.

-- À coller en entier dans Supabase → SQL Editor, puis Run.

create extension if not exists pgcrypto;

create extension if not exists pg_net with schema extensions;

create extension if not exists pg_cron;

-- ═══════════════════════════════════════════════════════════════════════
-- Schéma des tables de base — RECONSTITUÉ depuis les types générés.
-- Généré par scripts/rebuild/gen_base_schema.py : ne pas éditer à la main.
-- Les types SQL sont devinés ; à comparer au schéma réel (openapi.json).
-- ═══════════════════════════════════════════════════════════════════════

do $$ begin create type public.prospect_statut as enum ('nouveau', 'proposition_envoyee', 'visite_planifiee', 'signe', 'perdu'); exception when duplicate_object then null; end $$;

create table if not exists public.ad_stats (
  bookings_attributed integer,
  budget_spent numeric,
  campaign_name text,
  channel text not null,
  clicks integer,
  created_at timestamptz default now(),
  id uuid primary key default gen_random_uuid(),
  impressions integer,
  leads_generated integer,
  notes text,
  period_end date not null,
  period_start date not null,
  revenue_generated numeric
);

create table if not exists public.agent_config (
  auto_followup_enabled boolean default true,
  business_hours jsonb,
  faq jsonb,
  id uuid primary key default gen_random_uuid(),
  max_followups integer default 2,
  morning_discount_percent numeric,
  offers jsonb not null,
  options jsonb not null,
  updated_at timestamptz default now(),
  weekend_nuit_prestige_contact text
);

create table if not exists public.blocked_dates (
  created_at timestamptz default now(),
  date date not null,
  end_time time,
  google_calendar_event_id text,
  id uuid primary key default gen_random_uuid(),
  notes text,
  reason text,
  start_time time
);

create table if not exists public.leads (
  ai_memo text,
  archived boolean not null default false,
  assigned_to text,
  budget_range text,
  created_at timestamptz default now(),
  desired_date date,
  desired_time_slot text,
  email text,
  first_name text,
  id uuid primary key default gen_random_uuid(),
  instagram_handle text,
  interested_offer text,
  last_interaction_at timestamptz,
  last_name text,
  needs_human_intervention boolean default false,
  notes text,
  occasion text,
  party_size integer,
  phone text,
  score integer default 0,
  source_channel text,
  source_status text,
  status text default 'new',
  updated_at timestamptz default now()
);

create table if not exists public.customers (
  acquisition_channel text,
  ai_memo text,
  birthday date,
  bookings_count integer default 0,
  created_at timestamptz default now(),
  email text,
  first_name text not null,
  id uuid primary key default gen_random_uuid(),
  instagram_handle text,
  last_booking_at timestamptz,
  last_name text,
  lead_id uuid,
  member_card_issued boolean default false,
  member_number integer not null default 0,
  member_page_slug text,
  phone text,
  preferences jsonb,
  referral_code text,
  referred_by uuid,
  tier text default 'membre',
  total_spent numeric default 0,
  updated_at timestamptz default now()
);

create table if not exists public.bookings (
  balance_due numeric,
  balance_due_date date,
  balance_payments jsonb not null default '[]'::jsonb,
  booking_type text,
  costs numeric,
  created_at timestamptz default now(),
  customer_id uuid,
  date date,
  deposit_amount numeric,
  deposit_paid boolean default false,
  discount_amount numeric,
  discount_reason text,
  duration_hours numeric,
  end_time time,
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  net_margin numeric generated always as (coalesce(total_amount, 0) - coalesce(costs, 0)) stored,
  notes text,
  offer_name text,
  options jsonb,
  party_size integer,
  payment_method text,
  reminder_sent boolean default false,
  review_received boolean default false,
  review_requested boolean default false,
  source_channel text,
  start_time time,
  status text default 'pending',
  stripe_session_id text,
  total_amount numeric,
  updated_at timestamptz default now()
);

create table if not exists public.content_marketing (
  channel text not null,
  comments integer,
  content_type text,
  created_at timestamptz default now(),
  created_by text,
  description text,
  id uuid primary key default gen_random_uuid(),
  leads_attributed integer,
  likes integer,
  notes text,
  publish_date date,
  publish_time time,
  shares integer,
  status text,
  title text,
  updated_at timestamptz default now(),
  url text,
  views integer
);

create table if not exists public.conversations (
  channel text,
  created_at timestamptz default now(),
  customer_id uuid,
  escalation_reason text,
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  messages jsonb,
  outcome text,
  summary text,
  updated_at timestamptz default now()
);

create table if not exists public.events_public (
  cost_estimate numeric,
  created_at timestamptz default now(),
  current_bookings integer default 0,
  date date not null,
  description text,
  end_time time,
  id uuid primary key default gen_random_uuid(),
  max_participants integer,
  net_margin numeric,
  price_per_person numeric,
  start_time time,
  status text default 'published',
  sumup_payment_link text,
  theme text,
  title text not null,
  total_revenue numeric default 0,
  updated_at timestamptz default now(),
  whatsapp_message_template text
);

create table if not exists public.event_bookings (
  created_at timestamptz default now(),
  customer_id uuid,
  email text,
  event_id uuid,
  first_name text not null,
  id uuid primary key default gen_random_uuid(),
  is_member_priority boolean,
  last_name text,
  party_size integer default 1,
  payment_status text default 'pending',
  phone text,
  sumup_transaction_id text,
  total_paid numeric
);

create table if not exists public.expenses (
  amount numeric not null,
  category text not null,
  created_at timestamptz default now(),
  created_by text,
  date date not null,
  description text,
  id uuid primary key default gen_random_uuid(),
  is_recurring boolean,
  linked_booking_id uuid,
  linked_event_id uuid,
  receipt_url text,
  recurrence_period text
);

create table if not exists public.goals (
  created_at timestamptz default now(),
  current_revenue numeric,
  id uuid primary key default gen_random_uuid(),
  notes text,
  period_end date,
  period_start date,
  period_type text,
  target_medium numeric,
  target_min numeric,
  target_strong numeric
);

create table if not exists public.hub_workspaces (
  created_at timestamptz not null default now(),
  credit_balance numeric not null default 0,
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default ''
);

create table if not exists public.hub_agents (
  avatar_color text not null default '',
  created_at timestamptz not null default now(),
  hermes_agent_id text,
  id uuid primary key default gen_random_uuid(),
  model_config jsonb not null default '{}'::jsonb,
  name text not null,
  persona text not null default '',
  role text not null default '',
  slug text not null,
  status text not null default '',
  system_prompt text not null default '',
  updated_at timestamptz not null default now(),
  workspace_id uuid not null
);

create table if not exists public.hub_channel_connections (
  created_at timestamptz not null default now(),
  credentials jsonb not null default '{}'::jsonb,
  display_name text not null default '',
  id uuid primary key default gen_random_uuid(),
  last_connected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default '',
  type text not null,
  workspace_id uuid not null
);

create table if not exists public.hub_contacts (
  channel_type text not null,
  created_at timestamptz not null default now(),
  email text,
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  notes text not null default '',
  primary_handle text not null,
  tags text[] not null default '{}',
  updated_at timestamptz not null default now(),
  workspace_id uuid not null
);

create table if not exists public.hub_conversations (
  agent_id uuid,
  channel_connection_id uuid,
  channel_type text not null,
  contact_handle text not null default '',
  contact_id uuid,
  contact_name text not null default '',
  created_at timestamptz not null default now(),
  crm_stage text not null default '',
  crm_summary text not null default '',
  id uuid primary key default gen_random_uuid(),
  last_message_at timestamptz not null default now(),
  message_count integer not null default 0,
  outcome text,
  status text not null default '',
  subject text not null default '',
  tags text[] not null default '{}',
  workspace_id uuid not null
);

create table if not exists public.hub_agent_activities (
  agent_id uuid not null,
  conversation_id uuid,
  description text not null default '',
  id uuid primary key default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  title text not null,
  type text not null,
  workspace_id uuid not null
);

create table if not exists public.hub_agent_channels (
  agent_id uuid not null,
  channel_connection_id uuid not null,
  is_active boolean not null default false
);

create table if not exists public.hub_credit_ledger (
  agent_id uuid not null,
  channel_type text not null,
  conversation_id uuid,
  credits numeric not null,
  event_type text not null,
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  workspace_id uuid not null
);

create table if not exists public.hub_messages (
  content text not null,
  content_type text not null default '',
  conversation_id uuid not null,
  direction text not null,
  id uuid primary key default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  sender text not null,
  sent_at timestamptz not null default now()
);

create table if not exists public.hub_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  workspace_id uuid not null
);

create table if not exists public.profiles (
  created_at timestamptz default now(),
  email text not null,
  first_name text,
  id uuid primary key,
  notification_preferences jsonb,
  permissions jsonb,
  role text
);

create table if not exists public.prospects (
  adresse text not null,
  aides_totales numeric,
  co2_evite_kg_an numeric,
  code_postal text,
  cout_installation_ttc numeric,
  created_at timestamptz not null default now(),
  date_photo_satellite date,
  economie_annuelle numeric,
  email text,
  heures_ensoleillement numeric,
  id uuid primary key default gen_random_uuid(),
  latitude numeric,
  longitude numeric,
  nb_panneaux_recommande integer,
  nom text not null,
  notes text,
  orientation_principale text,
  panneaux_detectes text,
  prenom text not null,
  production_annuelle_kwh numeric,
  proposition_html text,
  proposition_id text,
  proposition_vue_at timestamptz,
  puissance_kwc numeric,
  qualite_imagerie text,
  reste_a_charge numeric,
  score_solaire numeric,
  site_web text,
  statut prospect_statut not null,
  surface_toit_m2 numeric,
  telephone text,
  temps_retour_ans numeric,
  updated_at timestamptz not null default now(),
  ville text not null
);

create table if not exists public.recaps (
  content text,
  created_at timestamptz default now(),
  data jsonb,
  id uuid primary key default gen_random_uuid(),
  period_end date,
  period_start date,
  sent_at timestamptz default now(),
  type text not null
);

create table if not exists public.referrals (
  converted_at timestamptz,
  created_at timestamptz default now(),
  id uuid primary key default gen_random_uuid(),
  referred_customer_id uuid,
  referred_lead_id uuid,
  referrer_customer_id uuid,
  reward_chosen text,
  reward_used boolean,
  status text
);

create table if not exists public.revenues (
  amount numeric not null,
  created_at timestamptz default now(),
  date date not null,
  id uuid primary key default gen_random_uuid(),
  note text,
  type text not null
);

create table if not exists public.transactions (
  account text not null default '',
  amount numeric not null,
  category text not null,
  created_at timestamptz not null default now(),
  date date not null,
  id uuid primary key,
  note text,
  source text not null default '',
  type text not null
);

create table if not exists public.wa_auth_state (
  data jsonb not null,
  id text primary key,
  updated_at timestamptz default now()
);

create table if not exists public.wa_conversations (
  created_at timestamptz default now(),
  customer_name text,
  customer_phone text not null,
  id uuid primary key default gen_random_uuid(),
  is_paused boolean not null default false,
  last_message_at timestamptz,
  paused_until timestamptz,
  unread_count integer not null default 0
);

create table if not exists public.wa_messages (
  body text not null,
  conversation_id uuid,
  created_at timestamptz default now(),
  from_me boolean not null default false,
  id uuid primary key default gen_random_uuid(),
  is_from_human boolean not null default false,
  wa_message_id text
);

create table if not exists public.weather_cache (
  date date not null,
  fetched_at timestamptz default now(),
  id uuid primary key default gen_random_uuid(),
  rating text,
  swell_m numeric,
  water_temp_c numeric,
  wave_height_m numeric,
  wind_direction text,
  wind_speed_kmh numeric
);

create sequence if not exists public.customers_member_number_seq;
alter table public.customers alter column member_number set default nextval('public.customers_member_number_seq');

-- Clés étrangères (après création de toutes les tables).
do $$ begin alter table public.customers add constraint customers_lead_id_fkey foreign key (lead_id) references public.leads (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.customers add constraint customers_referred_by_fkey foreign key (referred_by) references public.customers (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.bookings add constraint bookings_customer_id_fkey foreign key (customer_id) references public.customers (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.bookings add constraint bookings_lead_id_fkey foreign key (lead_id) references public.leads (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.conversations add constraint conversations_customer_id_fkey foreign key (customer_id) references public.customers (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.conversations add constraint conversations_lead_id_fkey foreign key (lead_id) references public.leads (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.event_bookings add constraint event_bookings_customer_id_fkey foreign key (customer_id) references public.customers (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.event_bookings add constraint event_bookings_event_id_fkey foreign key (event_id) references public.events_public (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.expenses add constraint expenses_linked_booking_id_fkey foreign key (linked_booking_id) references public.bookings (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.expenses add constraint expenses_linked_event_id_fkey foreign key (linked_event_id) references public.events_public (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_agents add constraint hub_agents_workspace_id_fkey foreign key (workspace_id) references public.hub_workspaces (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_channel_connections add constraint hub_channel_connections_workspace_id_fkey foreign key (workspace_id) references public.hub_workspaces (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_contacts add constraint hub_contacts_workspace_id_fkey foreign key (workspace_id) references public.hub_workspaces (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_conversations add constraint hub_conversations_agent_id_fkey foreign key (agent_id) references public.hub_agents (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_conversations add constraint hub_conversations_channel_connection_id_fkey foreign key (channel_connection_id) references public.hub_channel_connections (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_conversations add constraint hub_conversations_contact_id_fkey foreign key (contact_id) references public.hub_contacts (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_conversations add constraint hub_conversations_workspace_id_fkey foreign key (workspace_id) references public.hub_workspaces (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_agent_activities add constraint hub_agent_activities_agent_id_fkey foreign key (agent_id) references public.hub_agents (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_agent_activities add constraint hub_agent_activities_conversation_id_fkey foreign key (conversation_id) references public.hub_conversations (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_agent_activities add constraint hub_agent_activities_workspace_id_fkey foreign key (workspace_id) references public.hub_workspaces (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_agent_channels add constraint hub_agent_channels_agent_id_fkey foreign key (agent_id) references public.hub_agents (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_agent_channels add constraint hub_agent_channels_channel_connection_id_fkey foreign key (channel_connection_id) references public.hub_channel_connections (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_credit_ledger add constraint hub_credit_ledger_agent_id_fkey foreign key (agent_id) references public.hub_agents (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_credit_ledger add constraint hub_credit_ledger_conversation_id_fkey foreign key (conversation_id) references public.hub_conversations (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_credit_ledger add constraint hub_credit_ledger_workspace_id_fkey foreign key (workspace_id) references public.hub_workspaces (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_messages add constraint hub_messages_conversation_id_fkey foreign key (conversation_id) references public.hub_conversations (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.hub_settings add constraint hub_settings_workspace_id_fkey foreign key (workspace_id) references public.hub_workspaces (id) on delete cascade; exception when duplicate_object then null; end $$;
do $$ begin alter table public.referrals add constraint referrals_referred_customer_id_fkey foreign key (referred_customer_id) references public.customers (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.referrals add constraint referrals_referred_lead_id_fkey foreign key (referred_lead_id) references public.leads (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.referrals add constraint referrals_referrer_customer_id_fkey foreign key (referrer_customer_id) references public.customers (id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.wa_messages add constraint wa_messages_conversation_id_fkey foreign key (conversation_id) references public.wa_conversations (id) on delete set null; exception when duplicate_object then null; end $$;

-- profiles.id = identifiant du compte de connexion (auth.users).
do $$ begin alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade; exception when duplicate_object then null; end $$;

-- hub_agent_channels : table de liaison, clé composite.
do $$ begin alter table public.hub_agent_channels add primary key (agent_id, channel_connection_id); exception when others then null; end $$;

-- Unicité exigée par le code (upsert … onConflict).
create unique index if not exists wa_conversations_customer_phone_key on public.wa_conversations (customer_phone);
create unique index if not exists customers_member_number_key on public.customers (member_number);



-- ═══════════════════════════════════════════════════════════════════════
-- Après les tables de base : fonction publique, vue, accès (RLS), profils.
-- RECONSTITUÉ : l'original n'a pas été conservé. Choix par défaut sûrs —
-- tout utilisateur connecté au tableau de bord a accès à tout (équipe très
-- réduite), le public (anon) ne lit que ce que le site affiche.
-- ═══════════════════════════════════════════════════════════════════════

-- Créneaux déjà pris (appelée par le site public avec la clé anon).
create or replace function public.get_booked_slots(p_from date, p_to date)
returns table (booking_type text, date date, start_time time, end_time time)
language sql stable security definer set search_path = public as $$
  select b.booking_type, b.date, b.start_time, b.end_time
  from public.bookings b
  where b.date between p_from and p_to
    and coalesce(b.status, '') <> 'cancelled'
  union all
  select 'blocked'::text, d.date, d.start_time, d.end_time
  from public.blocked_dates d
  where d.date between p_from and p_to
$$;
grant execute on function public.get_booked_slots(date, date) to anon, authenticated, service_role;

-- Un instantané par jour pour la page Audience du site (dérivé de site_pageviews).
-- Créée après la migration 0033 : voir 03_after_migrations.sql.

-- Profil créé automatiquement pour chaque nouveau compte de connexion. Le
-- premier compte devient administrateur (c'est lui qui peut restaurer et
-- sauvegarder) ; les suivants sont des membres.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when exists (select 1 from public.profiles) then 'member' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accès : RLS activé sur toutes les tables de base.
do $$
declare
  t text;
begin
  foreach t in array array[
    'ad_stats','agent_config','blocked_dates','bookings','content_marketing','conversations','customers',
    'event_bookings','events_public','expenses','goals','hub_agent_activities','hub_agent_channels','hub_agents',
    'hub_channel_connections','hub_contacts','hub_conversations','hub_credit_ledger','hub_messages','hub_settings',
    'hub_workspaces','leads','profiles','prospects','recaps','referrals','revenues','transactions',
    'wa_auth_state','wa_conversations','wa_messages','weather_cache'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if t <> 'wa_auth_state' then
      -- wa_auth_state (session WhatsApp) : aucune politique = clé de service uniquement.
      execute format('drop policy if exists "Authenticated users full access" on public.%I', t);
      execute format('create policy "Authenticated users full access" on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- Ce que le site public a le droit de lire.
drop policy if exists "Public can read events" on public.events_public;
create policy "Public can read events" on public.events_public for select to anon using (true);


-- ═══ migration 0001_lea_followups.sql ═══
-- Relances automatiques de Léa : suivi du nombre de relances envoyées par lead.
-- Idempotent (mêmes conventions que supabase/seed.sql).
-- Consommé par l'Edge Function `lea-followups`.

begin;

alter table leads add column if not exists followup_count integer not null default 0;
alter table leads add column if not exists last_followup_at timestamptz;

-- Accélère la sélection des candidats à la relance (statut actif + dernière relance).
create index if not exists idx_leads_followup
  on leads (status, last_followup_at)
  where needs_human_intervention = false;

commit;


-- ═══ migration 0002_google_calendar_event_id.sql ═══
-- Synchronisation Google Calendar : colonne pour stocker l'ID de l'event GCal
-- associé à chaque booking, et pour les events_public.
-- Idempotent.

begin;

alter table bookings add column if not exists google_calendar_event_id text;
alter table events_public add column if not exists google_calendar_event_id text;

-- Index pour retrouver rapidement un booking depuis un event GCal
-- (utile si on reçoit un webhook GCal à l'avenir).
create index if not exists idx_bookings_gcal_event_id
  on bookings (google_calendar_event_id)
  where google_calendar_event_id is not null;

commit;


-- ═══ migration 0003_auto_sync_gcal_trigger.sql ═══
-- Trigger Postgres qui appelle sync-gcal automatiquement après chaque
-- INSERT / UPDATE / DELETE sur bookings et events_public.
-- Garantit que GCal reste synchronisé peu importe la source (site, dashboard,
-- app future, SQL manuel) — un seul point de vérité.

create extension if not exists pg_net with schema extensions;

-- Secret partagé avec l'Edge Function sync-gcal (stocké dans le vault).
-- ⚠️ À remplacer par votre propre secret avant de migrer un nouvel environnement.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'sync_gcal_secret') then
    perform vault.create_secret(
      'CHANGE_ME_BEFORE_DEPLOY',
      'sync_gcal_secret'
    );
  end if;
end $$;

create or replace function public.notify_sync_gcal()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $func$
declare
  v_action text;
  v_type   text := tg_argv[0];
  v_id     uuid;
  v_secret text;
begin
  if tg_op = 'DELETE' then
    v_action := 'delete';
    v_id     := old.id;
  else
    v_action := 'upsert';
    v_id     := new.id;

    -- Anti-boucle : si seul google_calendar_event_id / updated_at a changé,
    -- c'est sync-gcal qui écrit. On ne re-déclenche pas.
    if tg_op = 'UPDATE' and v_type = 'booking' then
      if (old.date           is not distinct from new.date
       and old.start_time    is not distinct from new.start_time
       and old.end_time      is not distinct from new.end_time
       and old.offer_name    is not distinct from new.offer_name
       and old.party_size    is not distinct from new.party_size
       and old.status        is not distinct from new.status
       and old.total_amount  is not distinct from new.total_amount
       and old.deposit_paid  is not distinct from new.deposit_paid
       and old.deposit_amount is not distinct from new.deposit_amount
       and old.balance_due   is not distinct from new.balance_due
       and old.source_channel is not distinct from new.source_channel
       and old.notes         is not distinct from new.notes) then
        return null;
      end if;
    end if;

    if tg_op = 'UPDATE' and v_type = 'event_public' then
      if (old.title             is not distinct from new.title
       and old.date             is not distinct from new.date
       and old.start_time       is not distinct from new.start_time
       and old.end_time         is not distinct from new.end_time
       and old.status           is not distinct from new.status
       and old.theme            is not distinct from new.theme
       and old.price_per_person is not distinct from new.price_per_person
       and old.max_participants is not distinct from new.max_participants) then
        return null;
      end if;
    end if;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'sync_gcal_secret';

  -- ⚠️ URL à adapter par projet
  perform net.http_post(
    url     := 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/sync-gcal',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-sync-secret', v_secret
    ),
    body    := jsonb_build_object(
      'action', v_action,
      'type',   v_type,
      'id',     v_id
    )
  );

  return null;
end;
$func$;

drop trigger if exists trg_bookings_sync_gcal on bookings;
create trigger trg_bookings_sync_gcal
  after insert or update or delete on bookings
  for each row execute function public.notify_sync_gcal('booking');

drop trigger if exists trg_events_public_sync_gcal on events_public;
create trigger trg_events_public_sync_gcal
  after insert or update or delete on events_public
  for each row execute function public.notify_sync_gcal('event_public');


-- ═══ migration 0004_link_wa_conversations_to_leads.sql ═══
-- Link WhatsApp conversations to leads so the dashboard can show the WhatsApp
-- thread on the lead detail page, and so the agent can find existing leads by
-- conversation rather than only by phone string-matching.
alter table public.wa_conversations
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

create index if not exists idx_wa_conversations_lead_id on public.wa_conversations(lead_id);
create index if not exists idx_wa_conversations_customer_phone on public.wa_conversations(customer_phone);
create index if not exists idx_leads_phone on public.leads(phone);


-- ═══ migration 0005_lea_followups_cron.sql ═══
-- Active pg_cron pour planifier les relances Léa toutes les heures.
-- L'extension pg_net est déjà active (utilisée pour les triggers GCal).
create extension if not exists pg_cron;

-- Idempotent : retire l'ancien job si déjà créé.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'lea-followups-hourly') then
    perform cron.unschedule('lea-followups-hourly');
  end if;
end $$;

-- Toutes les heures à h:00, ping la Edge Function. L'auth est gérée par
-- x-cron-secret côté fonction (configurable via le secret CRON_SECRET).
select cron.schedule(
  'lea-followups-hourly',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/lea-followups',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb
    );
  $cron$
);


-- ═══ migration 0006_wa_inbox_debounce.sql ═══
-- Buffer d'entrée WhatsApp pour debouncing.
-- Quand un client envoie plusieurs messages rapprochés (typique : « Bonjour »
-- + « Je veux savoir vos tarifs »), Meta appelle le webhook plusieurs fois.
-- Sans buffer, Léa était appelée en parallèle et envoyait plusieurs réponses
-- redondantes — parfois quasi à l'identique, parfois une note méta interne.
-- On bufferise 6s : le DERNIER message reçu pour un numéro déclenche l'appel
-- à Léa avec TOUS les messages non-traités concaténés.

create table if not exists public.wa_inbox (
  id            bigserial primary key,
  wa_message_id text not null unique,
  phone         text not null,
  text          text not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists wa_inbox_phone_pending_idx
  on public.wa_inbox (phone, received_at)
  where processed_at is null;

create index if not exists wa_inbox_received_idx
  on public.wa_inbox (received_at);

alter table public.wa_inbox enable row level security;
-- Aucune policy : seule la service role (edge function) y accède.

-- Cleanup : on garde 7 jours pour le debug, puis purge.
create or replace function public.wa_inbox_cleanup()
returns void
language sql
as $$
  delete from public.wa_inbox where received_at < now() - interval '7 days';
$$;


-- ═══ migration 0007_booking_contracts.sql ═══
-- Contrats de location : on garde une trace de la signature côté DB.
-- Le contrat lui-même est généré en HTML imprimable depuis les infos
-- existantes (client + booking) — pas de stockage de PDF. Cette migration
-- ajoute juste les champs pour marquer un contrat comme signé.

alter table public.bookings
  add column if not exists contract_signed_at timestamptz,
  add column if not exists contract_signed_by_name text;

create index if not exists bookings_contract_signed_at_idx
  on public.bookings (contract_signed_at)
  where contract_signed_at is not null;


-- ═══ migration 0008_gift_cards.sql ═══
-- Cartes cadeaux : une carte cadeau = une réservation pré-payée mais sans
-- date encore fixée. Le bénéficiaire revient plus tard et on lui attribue
-- une date — la carte devient alors une réservation normale.
--
-- Choix d'archi : on étend la table bookings au lieu de créer une table
-- dédiée. Avantages : un seul flux d'encaissement/comptabilité/contrat,
-- la carte cadeau apparaît dans la liste des « réservations à traiter »
-- jusqu'à ce qu'elle soit consommée.

-- 1) `date` devient nullable (NULL = carte cadeau en attente d'utilisation).
alter table public.bookings
  alter column date drop not null;

-- 2) Champs spécifiques aux cartes cadeaux.
alter table public.bookings
  add column if not exists is_gift_card boolean not null default false,
  add column if not exists gift_card_code text,
  add column if not exists gift_card_recipient_name text;

-- Code unique quand il est renseigné (collision improbable mais sécurise).
create unique index if not exists bookings_gift_card_code_uniq
  on public.bookings (gift_card_code)
  where gift_card_code is not null;

-- Index pour retrouver vite les cartes cadeaux en attente d'utilisation.
create index if not exists bookings_gift_card_pending_idx
  on public.bookings (created_at desc)
  where is_gift_card = true and date is null;

-- 3) Skip de la sync Google Calendar tant qu'une carte cadeau n'a pas
--    de date. Sinon l'edge function sync-gcal essaie de créer un event
--    avec une date NULL → erreur.
create or replace function public.notify_sync_gcal()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_action text;
  v_type   text := tg_argv[0];
  v_id     uuid;
  v_secret text;
begin
  if tg_op = 'DELETE' then
    v_action := 'delete';
    v_id     := old.id;
  else
    v_action := 'upsert';
    v_id     := new.id;

    -- Pour les bookings : pas de sync GCal tant qu'il n'y a pas de date
    -- (typiquement une carte cadeau non encore utilisée).
    if v_type = 'booking' and new.date is null then
      return null;
    end if;

    -- Anti-boucle : si seul google_calendar_event_id (ou updated_at) a changé,
    -- c'est l'Edge Function sync-gcal qui écrit. On ne re-déclenche pas.
    if tg_op = 'UPDATE' and v_type = 'booking' then
      if (old.date              is not distinct from new.date
       and old.start_time        is not distinct from new.start_time
       and old.end_time          is not distinct from new.end_time
       and old.offer_name        is not distinct from new.offer_name
       and old.party_size        is not distinct from new.party_size
       and old.status            is not distinct from new.status
       and old.total_amount      is not distinct from new.total_amount
       and old.deposit_paid      is not distinct from new.deposit_paid
       and old.deposit_amount    is not distinct from new.deposit_amount
       and old.balance_due       is not distinct from new.balance_due
       and old.source_channel    is not distinct from new.source_channel
       and old.notes             is not distinct from new.notes) then
        return null;
      end if;
    end if;

    if tg_op = 'UPDATE' and v_type = 'event_public' then
      if (old.title             is not distinct from new.title
       and old.date             is not distinct from new.date
       and old.start_time       is not distinct from new.start_time
       and old.end_time         is not distinct from new.end_time
       and old.status           is not distinct from new.status
       and old.theme            is not distinct from new.theme
       and old.price_per_person is not distinct from new.price_per_person
       and old.max_participants is not distinct from new.max_participants) then
        return null;
      end if;
    end if;
  end if;

  -- Récupère le secret du vault.
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'sync_gcal_secret';

  perform net.http_post(
    url     := 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/sync-gcal',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-sync-secret', v_secret
    ),
    body    := jsonb_build_object(
      'action', v_action,
      'type',   v_type,
      'id',     v_id
    )
  );

  return null;
end;
$function$;


-- ═══ migration 0009_email_agent.sql ═══
-- Suivi des threads email : lie les Message-ID/In-Reply-To aux conversations CRM.
-- Permet à l'agent email de retrouver le fil de discussion quand un client répond.

CREATE TABLE IF NOT EXISTS public.email_threads (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id   uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  lead_id           uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  from_email        text NOT NULL,
  subject           text,
  -- Message-ID du dernier email envoyé (pour le header In-Reply-To de la prochaine réponse).
  last_outbound_message_id text,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_threads_conversation_id
  ON public.email_threads(conversation_id);

CREATE INDEX IF NOT EXISTS idx_email_threads_lead_id
  ON public.email_threads(lead_id);

-- Recherche rapide par adresse email expéditeur (= identification du lead).
CREATE INDEX IF NOT EXISTS idx_email_threads_from_email
  ON public.email_threads(from_email);

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
  ON public.email_threads FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ═══ migration 0010_email_log.sql ═══
-- Journal des emails envoyés (confirmations, relances, réponses, envois manuels).
-- Sert à compter le total d'emails envoyés pour la page Résultats.

CREATE TABLE IF NOT EXISTS public.email_log (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id    uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  to_email   text NOT NULL,
  subject    text,
  -- 'booking_confirmation' | 'inbound_reply' | 'followup' | 'manual_dashboard'
  source     text NOT NULL,
  sent_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON public.email_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_log_lead_id ON public.email_log(lead_id);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
  ON public.email_log FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ═══ migration 0011_bookings_to_revenues_fix.sql ═══
-- Le trigger `bookings_to_revenues` existait déjà en base (créé hors
-- migrations, jamais versionné) mais avait un vrai bug : il insérait un
-- revenu à chaque acompte/solde encaissé, mais ne le retirait JAMAIS quand
-- la réservation était annulée, ni quand un paiement était corrigé/retiré.
-- Résultat : l'argent d'une résa annulée restait compté dans Finances.
--
-- Cette migration :
--   1. Ajoute revenues.booking_id (lien 1↔1 avec la réservation source).
--   2. Supprime les anciennes lignes auto-générées (reconnaissables à leur
--      note "(booking <uuid>)") — les entrées manuelles ne contenant pas ce
--      motif sont préservées telles quelles.
--   3. Remplace la fonction du trigger par une version idempotente : à
--      chaque INSERT/UPDATE d'une réservation, elle recalcule le montant
--      réellement encaissé (total_amount − balance_due, 0 si annulée) et
--      UPSERT une unique ligne revenues par réservation — jamais de doublon,
--      jamais de résidu après annulation ou retrait de paiement.
--   4. Force un re-passage du trigger sur toutes les réservations
--      existantes pour regénérer proprement les lignes consolidées.

begin;

alter table public.revenues
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade;

create unique index if not exists idx_revenues_booking_id_unique
  on public.revenues(booking_id)
  where booking_id is not null;

-- Purge des anciennes lignes auto-générées (motif "(booking <uuid>)" dans la note).
-- Les entrées manuelles (sans ce motif) ne sont pas touchées.
delete from public.revenues
where note ~ 'booking [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

create or replace function public.bookings_to_revenues()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_type text;
  v_collected numeric;
begin
  v_type := case coalesce(new.booking_type, '')
    when 'sortie_privative' then 'sea_trip'
    when 'nuit_prestige'    then 'unusual_night'
    when 'nuit_insolite'    then 'unusual_night'
    else 'other'
  end;

  -- Réservation annulée = plus rien de compté, même si un acompte avait
  -- été encaissé avant l'annulation.
  if new.status = 'cancelled' then
    v_collected := 0;
  else
    v_collected := greatest(0, coalesce(new.total_amount, 0) - coalesce(new.balance_due, 0));
  end if;

  if v_collected <= 0 then
    delete from revenues where booking_id = new.id;
    return null;
  end if;

  insert into revenues (booking_id, date, type, amount, note)
  values (
    new.id,
    coalesce(new.date, new.created_at::date, current_date),
    v_type,
    v_collected,
    format('Encaissé — %s', coalesce(new.offer_name, '—'))
  )
  on conflict (booking_id) where booking_id is not null
  do update set
    date   = excluded.date,
    type   = excluded.type,
    amount = excluded.amount,
    note   = excluded.note;

  return null;
end;
$function$;

drop trigger if exists trg_bookings_to_revenues on public.bookings;
create trigger trg_bookings_to_revenues
  after insert or update on public.bookings
  for each row execute function public.bookings_to_revenues();

-- Force le trigger à repasser sur toutes les réservations existantes pour
-- régénérer les lignes consolidées (une seule par réservation, montant
-- correct, absente si annulée). Ne modifie aucune autre colonne — le
-- trigger trg_bookings_sync_gcal ignore les updates qui ne touchent que
-- updated_at (aucun impact sur Google Agenda).
update public.bookings set updated_at = now();

commit;


-- ═══ migration 0012_telegram_manager.sql ═══
-- Mémoire de conversation pour l'agent Manager Telegram (edge function
-- telegram-manager). Une ligne par chat_id — un seul propriétaire attendu,
-- mais on garde la structure générique par sécurité.

create table if not exists public.telegram_manager_conversations (
  id         uuid primary key default gen_random_uuid(),
  chat_id    text unique not null,
  messages   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_manager_conversations enable row level security;

create policy "Authenticated users full access"
  on public.telegram_manager_conversations for all to authenticated
  using (true) with check (true);


-- ═══ migration 0013_revenues_date_fix.sql ═══
-- Bug découvert en usage réel : le trigger bookings_to_revenues (migration
-- 0011) datait la ligne revenues par la DATE DE SORTIE de la réservation
-- (new.date), pas par la date d'encaissement réel. Résultat : l'argent
-- collecté aujourd'hui pour une sortie future (ex. en août) était rangé
-- sous une date d'août — invisible dans la vue "mois courant" de Finances,
-- qui filtre par défaut sur le mois en cours. D'où l'impression que rien
-- ne se mettait à jour.
--
-- Correctif : la date d'une ligne revenues reflète désormais le jour où
-- l'argent a été enregistré comme encaissé (current_date), fixée UNE FOIS
-- à la création de la ligne — les mises à jour suivantes (nouveau
-- paiement, montant corrigé...) ne déplacent plus cette date, seul le
-- montant/type/note sont rafraîchis.

begin;

create or replace function public.bookings_to_revenues()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_type text;
  v_collected numeric;
begin
  v_type := case coalesce(new.booking_type, '')
    when 'sortie_privative' then 'sea_trip'
    when 'nuit_prestige'    then 'unusual_night'
    when 'nuit_insolite'    then 'unusual_night'
    else 'other'
  end;

  if new.status = 'cancelled' then
    v_collected := 0;
  else
    v_collected := greatest(0, coalesce(new.total_amount, 0) - coalesce(new.balance_due, 0));
  end if;

  if v_collected <= 0 then
    delete from revenues where booking_id = new.id;
    return null;
  end if;

  insert into revenues (booking_id, date, type, amount, note)
  values (
    new.id,
    current_date,
    v_type,
    v_collected,
    format('Encaissé — %s', coalesce(new.offer_name, '—'))
  )
  on conflict (booking_id) where booking_id is not null
  do update set
    type   = excluded.type,
    amount = excluded.amount,
    note   = excluded.note;
  -- `date` volontairement absent du do update : la date d'encaissement
  -- initiale ne bouge plus quand on corrige juste un montant plus tard.

  return null;
end;
$function$;

-- Corrige rétroactivement les lignes déjà créées par la migration 0011
-- (datées par erreur avec la date de sortie). On utilise updated_at de la
-- réservation liée comme date de référence — bien plus proche de la date
-- réelle d'encaissement que la date de sortie, et surtout ça évite de
-- tout regrouper artificiellement sur la date du jour (qui écraserait
-- l'historique réel des transactions passées).
update public.revenues r
set date = b.updated_at::date
from public.bookings b
where r.booking_id = b.id;

commit;


-- ═══ migration 0014_revenues_date_backfill_created_at.sql ═══
-- Correction du correctif précédent (0013) : updated_at avait déjà été
-- pollué par la migration 0011 (qui touchait toutes les réservations d'un
-- coup), donc son utilisation comme proxy de date de backfill donnait un
-- historique artificiellement compressé sur 1-2 jours. created_at n'a
-- jamais été touché par ces migrations et reflète un vrai étalement
-- historique (juin-juillet) — bien plus fidèle pour les lignes déjà
-- existantes. N'affecte pas le trigger lui-même (déjà correct depuis 0013,
-- utilise current_date pour toute nouvelle ligne).

begin;

update public.revenues r
set date = b.created_at::date
from public.bookings b
where r.booking_id = b.id;

commit;


-- ═══ migration 0015_manager_config_changes.sql ═══
-- Permet au Manager Telegram de modifier la configuration de Léa (offres,
-- tarifs, règles) — mais JAMAIS en un seul coup. Le flux est toujours :
--   1. propose_config_change → écrit une ligne "pending" ici, ne touche
--      PAS agent_config. Le Manager décrit le changement et demande
--      confirmation à Robin.
--   2. confirm_pending_change → SEULEMENT si Robin confirme explicitement
--      dans son message suivant → applique réellement le changement à
--      agent_config et journalise dans agent_config_history.
-- Aucun tool ne peut modifier agent_config directement — la mutation ne
-- se produit que dans le second temps, garantissant qu'un message ambigu
-- ou mal interprété ne casse jamais silencieusement la config de Léa.

create table if not exists public.agent_config_pending_changes (
  id          uuid primary key default gen_random_uuid(),
  chat_id     text not null,
  column_name text not null,
  key_name    text,
  old_value   jsonb,
  new_value   jsonb not null,
  description text not null,
  status      text not null default 'pending', -- pending | applied | cancelled
  created_at  timestamptz not null default now()
);

create index if not exists idx_agent_config_pending_chat
  on public.agent_config_pending_changes(chat_id, status);

create table if not exists public.agent_config_history (
  id          uuid primary key default gen_random_uuid(),
  applied_at  timestamptz not null default now(),
  column_name text not null,
  key_name    text,
  old_value   jsonb,
  new_value   jsonb not null,
  description text not null,
  source      text not null default 'telegram-manager'
);

alter table public.agent_config_pending_changes enable row level security;
alter table public.agent_config_history enable row level security;

create policy "Authenticated users full access"
  on public.agent_config_pending_changes for all to authenticated
  using (true) with check (true);

create policy "Authenticated users full access"
  on public.agent_config_history for all to authenticated
  using (true) with check (true);


-- ═══ migration 0016_link_bookings_to_leads.sql ═══
-- Lie automatiquement toute réservation à la fiche prospect existante du même
-- client (par téléphone ou email), quel que soit le point d'entrée qui crée la
-- réservation : formulaire du site (booking-form-webhook), saisie manuelle
-- dans Réservations, conversion depuis Prospects, import Google Agenda...
--
-- Sans ce lien (bookings.lead_id), agent-lea ne peut pas savoir qu'un contact
-- avec qui il discute sur WhatsApp a déjà réservé, et continue à le traiter
-- comme un prospect à qualifier au lieu d'un client déjà confirmé.

create or replace function public.link_booking_to_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_email text;
  v_lead_id uuid;
begin
  if new.lead_id is not null or new.customer_id is null then
    return new;
  end if;

  select phone, email into v_phone, v_email from customers where id = new.customer_id;

  if v_phone is not null then
    select id into v_lead_id from leads where phone = v_phone order by created_at desc limit 1;
  end if;

  if v_lead_id is null and v_email is not null then
    select id into v_lead_id from leads where email = v_email order by created_at desc limit 1;
  end if;

  if v_lead_id is not null then
    new.lead_id := v_lead_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_link_booking_to_lead on bookings;
create trigger trg_link_booking_to_lead
  before insert on bookings
  for each row execute function public.link_booking_to_lead();

-- Backfill : réservations déjà existantes sans lead_id mais dont le client
-- correspond à un prospect connu.
update bookings b
set lead_id = matched.lead_id
from (
  select
    c.id as customer_id,
    (
      select l.id from leads l
      where (c.phone is not null and l.phone = c.phone)
         or (c.email is not null and l.email = c.email)
      order by l.created_at desc
      limit 1
    ) as lead_id
  from customers c
) matched
where b.customer_id = matched.customer_id
  and b.lead_id is null
  and matched.lead_id is not null;


-- ═══ migration 0017_revenues_date_advance_on_new_payment.sql ═══
-- Bug découvert en usage réel (Ali Labrag, Aurore Moneta — résa du 1er
-- août) : le trigger bookings_to_revenues (0013) fige la date d'une ligne
-- revenues à la toute première fois où de l'argent est enregistré comme
-- encaissé sur une réservation (typiquement l'acompte, à la création). Un
-- solde encaissé bien plus tard — même un autre mois — met à jour le
-- montant mais garde l'ANCIENNE date : l'argent réellement collecté
-- aujourd'hui se retrouve compté sur le mois de l'acompte, invisible dans
-- le CA du mois en cours.
--
-- Correctif : la date avance à current_date UNIQUEMENT quand le montant
-- réellement collecté (v_collected) AUGMENTE par rapport à la ligne
-- existante — c'est-à-dire quand du nouvel argent est réellement encaissé
-- (acompte, puis solde plus tard). Si le montant reste identique ou
-- diminue (simple correction, retrait d'un paiement), la date d'origine
-- est conservée — comportement du fix 0013 préservé pour ce cas-là.

begin;

create or replace function public.bookings_to_revenues()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_type text;
  v_collected numeric;
  v_prev_amount numeric;
  v_date date;
begin
  v_type := case coalesce(new.booking_type, '')
    when 'sortie_privative' then 'sea_trip'
    when 'nuit_prestige'    then 'unusual_night'
    when 'nuit_insolite'    then 'unusual_night'
    else 'other'
  end;

  if new.status = 'cancelled' then
    v_collected := 0;
  else
    v_collected := greatest(0, coalesce(new.total_amount, 0) - coalesce(new.balance_due, 0));
  end if;

  if v_collected <= 0 then
    delete from revenues where booking_id = new.id;
    return null;
  end if;

  select amount, date into v_prev_amount, v_date
  from revenues where booking_id = new.id;

  if v_prev_amount is null or v_collected > v_prev_amount then
    -- Pas encore de ligne (1er encaissement) ou nouvel argent réellement
    -- collecté maintenant (ex: solde payé après l'acompte) → daté aujourd'hui.
    v_date := current_date;
  end if;
  -- Sinon (montant identique ou en baisse = correction) : v_date garde la
  -- valeur déjà lue en base, inchangée.

  insert into revenues (booking_id, date, type, amount, note)
  values (
    new.id,
    v_date,
    v_type,
    v_collected,
    format('Encaissé — %s', coalesce(new.offer_name, '—'))
  )
  on conflict (booking_id) where booking_id is not null
  do update set
    date   = excluded.date,
    type   = excluded.type,
    amount = excluded.amount,
    note   = excluded.note;

  return null;
end;
$function$;

-- Corrige rétroactivement les deux réservations à l'origine du bug : le
-- solde a été réellement encaissé le 01/08 (updated_at), pas à la date de
-- création de la résa.
update public.revenues r
set date = b.updated_at::date
from public.bookings b
where r.booking_id = b.id
  and b.id in ('16e72e9c-5e63-4efb-9668-2c9682e9d3e6', 'b6e0ee5b-0564-4aa5-aa82-dd6914e64649');

commit;


-- ═══ migration 0018_revenues_split_deposit_balance.sql ═══
-- Suite du fix 0017 : Robin précise la règle métier exacte —
--   - l'ACOMPTE compte pour le jour où il a été réellement payé (souvent
--     à la réservation) ;
--   - le SOLDE compte pour le jour DE LA SORTIE, pas le jour où
--     l'encaissement est validé dans l'outil (le solde est en pratique
--     remis le jour même du départ, même si Robin ne coche la case
--     qu'après coup).
-- Une seule ligne revenues par réservation ne peut pas porter deux dates
-- différentes → on passe à DEUX lignes par réservation (acompte / solde),
-- chacune avec sa propre date.

begin;

alter table public.revenues
  add column if not exists payment_kind text
    check (payment_kind is null or payment_kind in ('deposit', 'balance'));

-- Les lignes existantes liées à une résa mélangent acompte+solde sous une
-- seule date : on les supprime pour les regénérer proprement ci-dessous.
-- Les entrées manuelles (booking_id null) ne sont pas touchées.
delete from public.revenues where booking_id is not null;

drop index if exists idx_revenues_booking_id_unique;
create unique index if not exists idx_revenues_booking_id_kind_unique
  on public.revenues(booking_id, payment_kind)
  where booking_id is not null;

create or replace function public.bookings_to_revenues()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_type text;
  v_total_collected numeric;
  v_deposit_collected numeric;
  v_balance_collected numeric;
  v_prev_deposit_amount numeric;
  v_deposit_date date;
begin
  v_type := case coalesce(new.booking_type, '')
    when 'sortie_privative' then 'sea_trip'
    when 'nuit_prestige'    then 'unusual_night'
    when 'nuit_insolite'    then 'unusual_night'
    else 'other'
  end;

  if new.status = 'cancelled' then
    v_total_collected := 0;
  else
    v_total_collected := greatest(0, coalesce(new.total_amount, 0) - coalesce(new.balance_due, 0));
  end if;

  if v_total_collected <= 0 then
    delete from revenues where booking_id = new.id;
    return null;
  end if;

  v_deposit_collected := least(v_total_collected, greatest(0, coalesce(new.deposit_amount, 0)));
  v_balance_collected := v_total_collected - v_deposit_collected;

  -- Acompte : daté le jour où il a été réellement payé. Figé une fois
  -- posé, sauf si le montant d'acompte collecté augmente (nouvel argent
  -- réellement encaissé maintenant) — même logique que 0017.
  if v_deposit_collected <= 0 then
    delete from revenues where booking_id = new.id and payment_kind = 'deposit';
  else
    select amount, date into v_prev_deposit_amount, v_deposit_date
    from revenues where booking_id = new.id and payment_kind = 'deposit';

    if v_prev_deposit_amount is null or v_deposit_collected > v_prev_deposit_amount then
      v_deposit_date := current_date;
    end if;

    insert into revenues (booking_id, payment_kind, date, type, amount, note)
    values (new.id, 'deposit', v_deposit_date, v_type, v_deposit_collected, format('Acompte — %s', coalesce(new.offer_name, '—')))
    on conflict (booking_id, payment_kind) where booking_id is not null
    do update set date = excluded.date, type = excluded.type, amount = excluded.amount, note = excluded.note;
  end if;

  -- Solde : toujours daté le jour de la sortie — c'est là que l'argent
  -- change réellement de main, indépendamment du jour où l'encaissement
  -- est validé dans l'outil.
  if v_balance_collected <= 0 then
    delete from revenues where booking_id = new.id and payment_kind = 'balance';
  else
    insert into revenues (booking_id, payment_kind, date, type, amount, note)
    values (new.id, 'balance', coalesce(new.date, current_date), v_type, v_balance_collected, format('Solde — %s', coalesce(new.offer_name, '—')))
    on conflict (booking_id, payment_kind) where booking_id is not null
    do update set date = excluded.date, type = excluded.type, amount = excluded.amount, note = excluded.note;
  end if;

  return null;
end;
$function$;

-- Regénère les lignes pour toutes les réservations existantes. Pour
-- l'historique, faute d'avoir jamais enregistré la date exacte de
-- paiement de l'acompte, on utilise created_at de la résa comme meilleure
-- estimation (même logique que le fix 0014) ; le solde, lui, est connu
-- avec certitude : c'est toujours la date de sortie de la résa.
with calc as (
  select
    b.id as booking_id,
    b.date as outing_date,
    b.created_at::date as created_date,
    case coalesce(b.booking_type, '')
      when 'sortie_privative' then 'sea_trip'
      when 'nuit_prestige'    then 'unusual_night'
      when 'nuit_insolite'    then 'unusual_night'
      else 'other'
    end as v_type,
    b.offer_name,
    greatest(0, coalesce(b.total_amount, 0) - coalesce(b.balance_due, 0)) as total_collected,
    least(
      greatest(0, coalesce(b.total_amount, 0) - coalesce(b.balance_due, 0)),
      greatest(0, coalesce(b.deposit_amount, 0))
    ) as deposit_collected
  from public.bookings b
  where b.status <> 'cancelled'
)
insert into public.revenues (booking_id, payment_kind, date, type, amount, note)
select booking_id, 'deposit', created_date, v_type, deposit_collected, format('Acompte — %s', coalesce(offer_name, '—'))
from calc where deposit_collected > 0
union all
select booking_id, 'balance', coalesce(outing_date, created_date), v_type, (total_collected - deposit_collected), format('Solde — %s', coalesce(offer_name, '—'))
from calc where (total_collected - deposit_collected) > 0
on conflict (booking_id, payment_kind) where booking_id is not null
do update set date = excluded.date, type = excluded.type, amount = excluded.amount, note = excluded.note;

commit;


-- ═══ migration 0019_seo_audits.sql ═══
-- Audits SEO / GEO — historique des passages de l'agent Auditeur.
--
-- Une ligne = un audit complet du site public. Les contrôles sont stockés en
-- JSONB plutôt qu'en colonnes : la liste évolue (on ajoutera le suivi de
-- positions, les citations IA…) sans migration à chaque fois.
--
-- Le score est volontairement un simple ratio "contrôles conformes / total" :
-- il doit rester explicable en une phrase à quelqu'un qui n'y connaît rien.

create table if not exists seo_audits (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  run_at timestamptz not null default now(),

  score int not null check (score >= 0 and score <= 100),
  checks_passed int not null default 0,
  checks_total int not null default 0,
  critical_count int not null default 0,
  warning_count int not null default 0,

  -- [{ key, label, why, severity: critical|warning, status: pass|fail, detail }]
  checks jsonb not null default '[]'::jsonb,
  -- [{ url, status, bytes, text_length, title, description, h1_count }]
  pages jsonb not null default '[]'::jsonb,

  duration_ms int,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists seo_audits_run_at_idx on seo_audits (run_at desc);

alter table seo_audits enable row level security;

drop policy if exists "Authenticated users full access" on seo_audits;
create policy "Authenticated users full access"
  on seo_audits for all
  to authenticated
  using (true)
  with check (true);


-- ═══ migration 0020_source_channel_add_ai.sql ═══
-- Canaux d'acquisition : ajout des IA génératives (ChatGPT, Perplexity...) pour
-- pouvoir mesurer ce que rapporte le travail GEO.
--
-- Au passage, la liste autorisée sur `leads` était plus courte que le menu
-- déroulant du dashboard : choisir "Google (recherche)" ou "Je ne sais pas" sur
-- une fiche prospect provoquait une erreur de contrainte. On aligne les deux, et
-- on ajoute 'direct' qui est déjà utilisé côté bookings.

alter table leads drop constraint if exists leads_source_channel_check;

alter table leads add constraint leads_source_channel_check
  check (source_channel = any (array[
    'instagram_organic', 'instagram_ads',
    'tiktok_organic', 'tiktok_ads',
    'meta_ads',
    'google_ads', 'google_organic',
    'chatgpt', 'perplexity', 'ai_other',
    'whatsapp', 'email', 'website', 'phone',
    'word_of_mouth', 'direct', 'other', 'unknown'
  ]::text[]));


-- ═══ migration 0021_lead_last_message_view.sql ═══
-- Vue « dernier message » par lead.
--
-- Le signal le plus utile pour prioriser un prospect n'est pas son score, c'est
-- QUI a parlé en dernier. Si le client a écrit et que personne n'a répondu, on
-- est le point de blocage. S'il s'est tu après qu'on lui ait envoyé le site,
-- c'est une relance à faire. Ces deux cas demandent des actions opposées et
-- étaient jusqu'ici confondus dans un unique « sans interaction depuis 48h ».
--
-- security_invoker : la vue applique les politiques RLS de l'appelant plutôt
-- que celles de son propriétaire — sinon elle contournerait la sécurité des
-- tables sous-jacentes.

create or replace view lead_last_message
with (security_invoker = true) as
select distinct on (c.lead_id)
  c.lead_id,
  m.created_at                                        as last_message_at,
  m.from_me                                           as last_from_me,
  m.is_from_human                                     as last_is_from_human,
  (m.from_me and m.body ilike '%harmonie-yacht.fr%')  as site_link_sent
from wa_conversations c
join wa_messages m on m.conversation_id = c.id
where c.lead_id is not null
order by c.lead_id, m.created_at desc;


-- ═══ migration 0022_legacy_clients.sql ═══
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


-- ═══ migration 0023_legacy_clients_dedupe_fix.sql ═══
-- Correction : un même événement .ics peut avoir plusieurs invités (couple,
-- amis réservant ensemble) — chacun doit devenir un client distinct. La
-- déduplication doit donc porter sur (uid événement, email), pas sur l'uid
-- seul, sinon le 2e invité d'un même événement serait rejeté au réimport.
alter table legacy_clients drop constraint if exists legacy_clients_ics_uid_key;
alter table legacy_clients alter column event_year drop not null;
create unique index if not exists legacy_clients_uid_email_idx on legacy_clients (ics_uid, email);


-- ═══ migration 0024_email_unsubscribes.sql ═══
-- Liste globale de désabonnement — vérifiée par TOUTE campagne de relance,
-- pas seulement celle qui a déclenché le clic. Une personne qui se désabonne
-- ne doit plus jamais recevoir d'email marketing, quelle que soit la
-- campagne future.

create table if not exists email_unsubscribes (
  email text primary key,
  unsubscribed_at timestamptz not null default now(),
  -- Campagne à l'origine du désabonnement, pour comprendre d'où ça vient.
  source_campaign text
);

alter table email_unsubscribes enable row level security;

-- Lecture/écriture normale depuis le dashboard (vérifier qui s'est désabonné).
drop policy if exists "Authenticated users full access" on email_unsubscribes;
create policy "Authenticated users full access"
  on email_unsubscribes for all
  to authenticated
  using (true)
  with check (true);

-- Le lien de désabonnement dans l'email est cliqué par quelqu'un qui n'est
-- JAMAIS connecté au dashboard. La route /api/unsubscribe utilise donc la clé
-- de service (contourne RLS) plutôt qu'une policy anonyme ici — écrire une
-- policy "anon" reviendrait à autoriser n'importe qui sur internet à insérer
-- des lignes arbitraires dans cette table sans passer par notre validation
-- du jeton.


-- ═══ migration 0025_client_outreach_drafted_status.sql ═══
-- Ajoute le statut "drafted" : un brouillon Gmail a été créé pour ce client,
-- mais rien n'est parti — Robin doit encore l'ouvrir et cliquer "Envoyer"
-- lui-même dans Gmail. Distinct de "sending"/"sent" qui décrivent un envoi
-- automatique via Resend.
alter table client_outreach drop constraint client_outreach_status_check;
alter table client_outreach add constraint client_outreach_status_check
  check (status in ('pending', 'drafted', 'sending', 'sent', 'failed', 'skipped'));


-- ═══ migration 0026_analytics_daily_snapshots.sql ═══
-- Historique permanent des statistiques de visite du site (Vercel Web
-- Analytics ne garde que 30 jours en plan Hobby) — un instantané par jour et
-- par projet Vercel, alimenté par une synchro quotidienne (voir
-- app/api/analytics/sync).
create table analytics_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  vercel_project_id text not null,
  snapshot_date date not null,
  visitors integer not null default 0,
  pageviews integer not null default 0,
  -- [{ hostname: string, visitors: number, pageviews: number }, ...]
  top_referrers jsonb not null default '[]'::jsonb,
  -- [{ path: string, visitors: number, pageviews: number }, ...]
  top_pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vercel_project_id, snapshot_date)
);

create index analytics_daily_snapshots_date_idx
  on analytics_daily_snapshots (vercel_project_id, snapshot_date desc);

alter table analytics_daily_snapshots enable row level security;

-- Lecture réservée au dashboard (utilisateurs connectés) ; l'écriture ne
-- passe que par la route de synchro, avec la clé service-role (contourne
-- RLS), jamais par un client authentifié classique.
create policy "Authenticated users can read analytics snapshots"
  on analytics_daily_snapshots for select
  to authenticated
  using (true);


-- ═══ migration 0027_weekly_report_cron.sql ═══
-- Planifie l'envoi du rapport hebdomadaire (leads, messages, leads chauds) à
-- Robin sur Telegram, chaque lundi matin (8h Paris ≈ 6h UTC en heure d'été).
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'weekly-report-monday') then
    perform cron.unschedule('weekly-report-monday');
  end if;
end $$;

select cron.schedule(
  'weekly-report-monday',
  '0 6 * * 1',
  $cron$
    select net.http_post(
      url := 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/weekly-report',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb
    );
  $cron$
);


-- ═══ migration 0028_wa_lid_phone_mapping.sql ═══
-- Résolution LID → numéro réel. WhatsApp masque certains contacts derrière un
-- identifiant interne (LID, ex. "86630044070080@lid") au lieu de leur vrai
-- numéro — c'est ce qui rend "impossible" la relance directe par le Manager.
-- Baileys reçoit pourtant cette correspondance via plusieurs événements
-- (partage explicite du numéro, synchronisation des contacts/historique) —
-- on ne les écoutait simplement pas. Cette table les capture au fil de l'eau.
create table wa_lid_map (
  lid text primary key,
  phone text not null,
  source text not null default 'baileys',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wa_lid_map_phone_idx on wa_lid_map (phone);

-- Numéro réel résolu pour un lead dont le numéro stocké est un LID masqué.
-- On NE remplace PAS leads.phone (qui reste le LID, seul identifiant fiable
-- pour router les messages WhatsApp entrants/sortants) — real_phone est un
-- champ d'affichage/relance en plus, jamais l'identité de la conversation.
alter table leads add column real_phone text;


-- ═══ migration 0029_qonto_bank_sync.sql ═══
-- Synchronisation bancaire Qonto — la banque devient la source de vérité de la
-- trésorerie, à côté des tables `revenues`/`expenses` qui restent la vision
-- métier (saisie manuelle + revenus générés depuis les réservations).
--
-- Contexte : le dashboard affichait un « résultat cumulé » (revenus − dépenses
-- saisies) que Robin lisait comme sa trésorerie. Écart constaté : ~18 800 € en
-- base contre ~6 000 € réellement en banque, principalement parce que des
-- sorties d'argent réelles (charges sociales, taxes, prélèvements) ne sont
-- jamais saisies. On importe donc les mouvements bancaires bruts.
--
-- Alimenté par l'Edge Function `qonto-sync` (voir supabase/functions/qonto-sync).

-- Comptes bancaires + solde réel, rafraîchis à chaque synchro.
create table bank_accounts (
  -- Identifiant Qonto du compte (bank_account_id), pas un uuid à nous.
  id text primary key,
  name text,
  iban text,
  currency text not null default 'EUR',
  -- Soldes en centimes, comme les renvoie Qonto (balance_cents) — on évite
  -- les flottants sur de l'argent.
  balance_cents bigint not null default 0,
  -- Solde autorisé = solde moins les opérations engagées mais pas encore
  -- réglées (cartes en attente). C'est le montant réellement disponible.
  authorized_balance_cents bigint not null default 0,
  is_main boolean not null default false,
  status text,
  balance_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mouvements bancaires bruts. On ne transforme rien ici : le rapprochement
-- avec `expenses` se fait dans un second temps, via bank_transaction_id.
create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  qonto_id text not null unique,
  bank_account_id text references bank_accounts (id) on delete set null,
  -- 'debit' (sortie) ou 'credit' (entrée) — amount_cents reste toujours positif.
  side text not null check (side in ('debit', 'credit')),
  amount_cents bigint not null,
  currency text not null default 'EUR',
  -- completed | pending | declined | reversed
  status text not null,
  -- card, transfer, income, direct_debit, qonto_fee, cheque…
  operation_type text,
  label text,
  counterparty_name text,
  reference text,
  note text,
  -- Champ `category` de Qonto : déprécié côté Qonto (plus affiché dans leur UI,
  -- parfois absent ou 'fallback') mais encore renvoyé — gardé uniquement comme
  -- indice faible pour deviner notre propre catégorie.
  qonto_category text,
  -- Catégorie de flux Qonto : taxonomie personnalisée par organisation, à
  -- configurer côté Qonto si on veut qu'elle colle à nos catégories à nous.
  cashflow_category text,
  -- settled_at est null tant que l'opération n'est pas 'completed'.
  settled_at timestamptz,
  emitted_at timestamptz,
  qonto_updated_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bank_transactions_settled_idx on bank_transactions (settled_at desc);
create index bank_transactions_side_idx on bank_transactions (side, settled_at desc);
-- Curseur de synchro : on repolle par updated_at (et non settled_at) pour
-- rattraper aussi les opérations modifiées ou passées de pending à completed.
create index bank_transactions_qonto_updated_idx on bank_transactions (qonto_updated_at desc);

-- Rapprochement bancaire : une dépense saisie peut être rattachée au mouvement
-- bancaire correspondant. Nullable — l'historique saisi à la main avant la
-- synchro reste valide, simplement non rapproché.
alter table expenses add column bank_transaction_id uuid references bank_transactions (id) on delete set null;

-- Une transaction bancaire ne peut alimenter qu'une seule dépense (évite les
-- doublons si la synchro repasse sur un mouvement déjà traité).
create unique index expenses_bank_transaction_id_key
  on expenses (bank_transaction_id)
  where bank_transaction_id is not null;

-- État de la synchro : une seule ligne, contrainte par le check sur id.
create table qonto_sync_state (
  id boolean primary key default true check (id),
  -- Borne haute du dernier import réussi, réutilisée comme updated_at_from.
  last_synced_at timestamptz,
  last_run_at timestamptz,
  last_error text,
  transactions_synced integer not null default 0
);

insert into qonto_sync_state (id) values (true) on conflict (id) do nothing;

alter table bank_accounts enable row level security;
alter table bank_transactions enable row level security;
alter table qonto_sync_state enable row level security;

-- Lecture réservée au dashboard (utilisateurs connectés). L'écriture ne passe
-- que par l'Edge Function de synchro, avec la clé service-role qui contourne
-- RLS — jamais par un client authentifié classique.
create policy "Authenticated users can read bank accounts"
  on bank_accounts for select
  to authenticated
  using (true);

create policy "Authenticated users can read bank transactions"
  on bank_transactions for select
  to authenticated
  using (true);

create policy "Authenticated users can read qonto sync state"
  on qonto_sync_state for select
  to authenticated
  using (true);


-- ═══ migration 0030_cash_and_financial_score.sql ═══
-- Caisse espèces + historique du score financier.
--
-- Deux manques mis en évidence par l'écart de 12 800 € entre le dashboard et le
-- compte réel :
--   1. Tout ce qui se passe en espèces est invisible du système (Qonto ne voit
--      que ce qui passe par la banque).
--   2. Rien ne mémorise où on en était : impossible de dire si la situation
--      s'améliore ou se dégrade, seulement où elle en est aujourd'hui.

-- ── Caisse espèces ──────────────────────────────────────────────────────────
-- Saisie manuelle (c'est le seul endroit où Robin doit encore saisir).
--   'in'      encaissement espèces d'un client
--   'out'     dépense payée en espèces
--   'deposit' dépôt des espèces sur le compte Qonto
--
-- Le dépôt est le point délicat : il sort de la caisse ET apparaît en crédit
-- sur Qonto. Il ne doit JAMAIS être compté comme du chiffre d'affaires, sinon
-- l'encaissement client serait compté deux fois (une fois en espèces, une fois
-- à l'arrivée sur le compte). D'où une direction dédiée plutôt qu'un 'out'.
create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  direction text not null check (direction in ('in', 'out', 'deposit')),
  amount numeric not null check (amount > 0),
  -- Mêmes catégories que la table expenses, pour les sorties d'espèces.
  category text,
  description text,
  booking_id uuid references bookings (id) on delete set null,
  -- Un encaissement espèces reste du CA : on crée aussi la ligne dans revenues
  -- et on la rattache ici, pour garder une seule source de vérité sur le CA.
  revenue_id uuid references revenues (id) on delete set null,
  -- Idem pour une dépense payée en espèces : la ligne expenses reste la
  -- référence comptable, cash_movements ne suit que le solde de la caisse.
  expense_id uuid references expenses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cash_movements_date_idx on cash_movements (date desc);
create index cash_movements_direction_idx on cash_movements (direction, date desc);

-- Solde de la caisse : les entrées augmentent, les sorties et les dépôts en
-- banque diminuent (le dépôt ne disparaît pas, il change simplement de poche).
create view cash_balance as
select
  coalesce(sum(case when direction = 'in' then amount else -amount end), 0) as balance,
  max(date) as last_movement_date,
  count(*) as movement_count
from cash_movements;

-- ── Historique du score financier ───────────────────────────────────────────
-- Une photo par jour, pour pouvoir répondre à « est-ce que ça va mieux qu'il y
-- a un mois ? » — la question à laquelle rien ne répond aujourd'hui.
create table financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  -- Une seule photo par jour : un recalcul le même jour écrase la précédente.
  date date not null unique,
  captured_at timestamptz not null default now(),
  bank_balance numeric,
  cash_balance numeric,
  treasury numeric,
  -- Charges moyennes mensuelles observées sur les 90 derniers jours.
  monthly_burn numeric,
  -- Trésorerie / charges mensuelles = nombre de mois tenables sans aucune
  -- rentrée d'argent. null si les charges sont nulles (runway infini).
  runway_months numeric,
  -- Reste à encaisser sur les réservations confirmées à venir.
  outstanding numeric,
  revenue_30d numeric,
  expenses_30d numeric,
  score integer check (score between 0 and 100),
  score_label text,
  -- Détail du calcul (sous-scores, hypothèses) — pour que le score reste
  -- explicable et jamais un chiffre sorti d'une boîte noire.
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index financial_snapshots_date_idx on financial_snapshots (date desc);

alter table cash_movements enable row level security;
alter table financial_snapshots enable row level security;

create policy "Authenticated users can read cash movements"
  on cash_movements for select
  to authenticated
  using (true);

create policy "Authenticated users can insert cash movements"
  on cash_movements for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update cash movements"
  on cash_movements for update
  to authenticated
  using (true);

create policy "Authenticated users can delete cash movements"
  on cash_movements for delete
  to authenticated
  using (true);

create policy "Authenticated users can read financial snapshots"
  on financial_snapshots for select
  to authenticated
  using (true);


-- ═══ migration 0031_sumup_sync.sql ═══
-- Synchronisation SumUp — les encaissements par carte sur place.
--
-- Pourquoi c'est le maillon manquant : 15 353 € de soldes de réservations sont
-- réglés le jour de la sortie, hors Stripe. Ce flux n'existait nulle part dans
-- le système. Qonto n'en voit que le virement groupé qui arrive quelques jours
-- plus tard, sans le détail des ventes qui le composent.
--
-- Règle anti-double-comptage (la même que pour les dépôts d'espèces) :
--   • une transaction SumUp        = du chiffre d'affaires
--   • un virement SumUp → Qonto    = un transfert, JAMAIS du chiffre d'affaires
-- Qonto porte la trésorerie, SumUp porte le détail du CA. Les deux ne
-- s'additionnent pas, ils se rapprochent.

-- ── Ventes encaissées via SumUp ─────────────────────────────────────────────
create table sumup_transactions (
  -- Identifiant SumUp (uuid côté API, stocké en text : on ne le génère pas).
  id text primary key,
  -- Clé de jointure avec les virements : chaque ligne de virement porte le
  -- transaction_code de la vente d'origine.
  transaction_code text unique,
  -- Montants en unités majeures (l'API SumUp renvoie des flottants, ex. 132.45)
  -- convertis en numeric dès l'insertion — jamais de float sur de l'argent.
  amount numeric not null,
  currency text not null default 'EUR',
  -- SUCCESSFUL | CANCELLED | FAILED | PENDING | REFUNDED
  status text,
  -- PAYMENT | REFUND | CHARGE_BACK
  type text,
  -- POS (terminal) | ECOM (en ligne) | CASH | MOTO | BALANCE…
  payment_type text,
  card_type text,
  -- CHIP | CONTACTLESS | APPLE_PAY | GOOGLE_PAY | MANUAL_ENTRY…
  entry_mode text,
  -- La commission n'est PAS renvoyée par la liste des transactions : il faut un
  -- appel de détail par vente. detail_fetched_at évite de le refaire à chaque
  -- passage (voir la fonction sumup-sync).
  fee_amount numeric,
  vat_amount numeric,
  tip_amount numeric,
  refunded_amount numeric,
  occurred_at timestamptz,
  -- Date à laquelle SumUp reverse cette vente : permet de regrouper les ventes
  -- par virement sans même appeler l'endpoint des virements.
  payout_date date,
  payout_type text,
  detail_fetched_at timestamptz,
  -- Rapprochement avec une réservation — laissé vide pour l'instant, SumUp ne
  -- transmet aucune donnée client (pas de nom, pas d'email, pas de téléphone) :
  -- le rapprochement se fera sur le montant et la date, pas automatiquement.
  booking_id uuid references bookings (id) on delete set null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sumup_transactions_occurred_idx on sumup_transactions (occurred_at desc);
create index sumup_transactions_payout_date_idx on sumup_transactions (payout_date);
create index sumup_transactions_detail_idx on sumup_transactions (detail_fetched_at) where detail_fetched_at is null;

-- ── Virements SumUp → banque ────────────────────────────────────────────────
-- Attention au nom : ce ne sont pas les virements groupés tels qu'ils
-- apparaissent sur le relevé bancaire, mais une ligne par vente reversée. Le
-- montant réellement crédité en banque est la somme d'une journée.
create table sumup_payouts (
  id bigint primary key,
  -- PAYOUT | CHARGE_BACK_DEDUCTION | REFUND_DEDUCTION | DD_RETURN_DEDUCTION |
  -- BALANCE_DEDUCTION — seul PAYOUT est un encaissement, le reste retranche.
  type text not null,
  amount numeric not null,
  fee numeric,
  currency text not null default 'EUR',
  date date not null,
  status text,
  reference text,
  -- Vente d'origine, jointure directe vers sumup_transactions.transaction_code.
  transaction_code text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sumup_payouts_date_idx on sumup_payouts (date desc);
create index sumup_payouts_transaction_code_idx on sumup_payouts (transaction_code);

-- Montant net crédité en banque par jour : c'est cette somme qu'on doit
-- retrouver en crédit sur Qonto, et non les ventes individuelles.
create view sumup_daily_settlements as
select
  date,
  currency,
  sum(case when type = 'PAYOUT' then amount else -amount end) as net_amount,
  sum(coalesce(fee, 0)) as fees,
  count(*) as line_count
from sumup_payouts
where status = 'SUCCESSFUL'
group by date, currency;

create table sumup_sync_state (
  id boolean primary key default true check (id),
  -- Sert de `changes_since` : rattrape aussi les remboursements et impayés
  -- survenus après coup sur des ventes déjà importées.
  last_synced_at timestamptz,
  last_payout_date date,
  last_run_at timestamptz,
  last_error text,
  transactions_synced integer not null default 0,
  payouts_synced integer not null default 0
);

insert into sumup_sync_state (id) values (true) on conflict (id) do nothing;

alter table sumup_transactions enable row level security;
alter table sumup_payouts enable row level security;
alter table sumup_sync_state enable row level security;

create policy "Authenticated users can read sumup transactions"
  on sumup_transactions for select
  to authenticated
  using (true);

create policy "Authenticated users can read sumup payouts"
  on sumup_payouts for select
  to authenticated
  using (true);

create policy "Authenticated users can read sumup sync state"
  on sumup_sync_state for select
  to authenticated
  using (true);


-- ═══ migration 0032_finance_pulse_cron.sql ═══
-- Point financier hebdomadaire, envoyé sur Telegram le lundi matin.
--
-- Planifié une heure après le rapport hebdo d'activité (weekly-report, 6h UTC)
-- pour que Robin reçoive d'abord ce qui s'est passé, puis ce que ça donne côté
-- argent — et non deux messages en même temps.
--
-- La fonction refuse de produire un score tant que la banque n'est pas
-- connectée : ce cron peut donc être posé maintenant sans risque de diffuser
-- un chiffre faux, il expliquera simplement ce qui manque.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'finance-pulse-monday') then
    perform cron.unschedule('finance-pulse-monday');
  end if;
end $$;

select cron.schedule(
  'finance-pulse-monday',
  '0 7 * * 1',
  $cron$
    select net.http_post(
      url := 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/finance-pulse',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb
    );
  $cron$
);


-- ═══ migration 0033_site_traffic.sql ═══
-- Mesure d'audience du site, en propre (sans dépendre de Vercel Web Analytics).
--
-- Pourquoi ne pas utiliser Vercel : Web Analytics n'est pas activé sur le projet
-- du site, et l'activer demande de toute façon de toucher au code du site
-- (le site est en Vite, Vercel n'injecte pas le traqueur tout seul). À effort
-- égal, un traqueur maison donne trois avantages décisifs :
--   • l'historique est permanent (le plan Hobby de Vercel ne garde que 30 jours)
--   • les données vivent dans notre base, donc l'agent Manager peut les lire
--   • on mesure exactement ce que Robin demande : d'OÙ viennent les visiteurs
--
-- RGPD : aucun cookie, aucune adresse IP stockée. L'identifiant de visiteur est
-- un hachage non réversible (IP + user-agent + jour + sel), qui change chaque
-- jour — il permet de compter les visiteurs uniques d'une journée sans jamais
-- pouvoir remonter à une personne, ni la suivre d'un jour à l'autre.

create table site_pageviews (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  -- Jour en Europe/Paris, calculé côté fonction : c'est la maille d'analyse.
  day date not null,
  path text not null,
  -- Domaine de provenance : 'instagram.com', 'google.com'… null = accès direct.
  referrer_host text,
  referrer_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  -- Libellé lisible calculé à l'arrivée (Instagram, Google, WhatsApp, Direct…).
  -- Stocké plutôt que recalculé à la lecture : si on change les règles de
  -- classement plus tard, l'historique déjà classé ne bouge pas sous nos pieds.
  source_label text not null default 'Direct',
  -- Regroupement large : recherche, social, direct, referral, campagne payante.
  source_group text not null default 'direct',
  visitor_hash text not null,
  device text,
  country text,
  created_at timestamptz not null default now()
);

create index site_pageviews_day_idx on site_pageviews (day desc);
create index site_pageviews_source_idx on site_pageviews (source_label, day desc);
create index site_pageviews_visitor_idx on site_pageviews (day, visitor_hash);
create index site_pageviews_path_idx on site_pageviews (path, day desc);

-- ── Vues de lecture pour le dashboard ───────────────────────────────────────

-- Trafic par jour : visiteurs uniques et pages vues.
create view site_traffic_daily as
select
  day,
  count(distinct visitor_hash) as visitors,
  count(*) as pageviews
from site_pageviews
group by day;

-- LA réponse à « d'où viennent les gens ». Une ligne par source.
create view site_traffic_by_source as
select
  day,
  source_label,
  source_group,
  count(distinct visitor_hash) as visitors,
  count(*) as pageviews
from site_pageviews
group by day, source_label, source_group;

-- Pages les plus vues.
create view site_traffic_by_page as
select
  day,
  path,
  count(distinct visitor_hash) as visitors,
  count(*) as pageviews
from site_pageviews
group by day, path;

alter table site_pageviews enable row level security;

-- Lecture par le dashboard uniquement. L'écriture passe exclusivement par la
-- fonction track-pageview (clé service-role, contourne RLS) : aucun client
-- authentifié ne peut insérer, et le site public n'écrit jamais en direct.
create policy "Authenticated users can read site pageviews"
  on site_pageviews for select
  to authenticated
  using (true);


-- ═══ migration 0034_bank_sync_cron.sql ═══
-- Synchronisation automatique Qonto + SumUp, toutes les heures.
--
-- Les deux fonctions (0029 qonto-sync, 0031 sumup-sync) existaient mais rien
-- ne les appelait : la banque et les ventes au terminal ne remontaient que sur
-- appel manuel. Ce sont elles qui alimentent la future partie Comptabilité
-- (journal bancaire, justificatifs, TVA).
--
-- Décalées dans l'heure (:07 et :37) pour ne pas tomber en même temps que les
-- autres tâches planifiées, ni l'une sur l'autre.
--
-- Sans les secrets (QONTO_API_KEY, SUMUP_API_KEY, SUMUP_MERCHANT_CODE), chaque
-- passage renvoie simplement une erreur explicite et n'écrit rien : on peut
-- donc poser ce planning avant même d'avoir créé les clés.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'qonto-sync-hourly') then
    perform cron.unschedule('qonto-sync-hourly');
  end if;
  if exists (select 1 from cron.job where jobname = 'sumup-sync-hourly') then
    perform cron.unschedule('sumup-sync-hourly');
  end if;
end $$;

select cron.schedule(
  'qonto-sync-hourly',
  '7 * * * *',
  $cron$
    select net.http_post(
      url := 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/qonto-sync',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);

select cron.schedule(
  'sumup-sync-hourly',
  '37 * * * *',
  $cron$
    select net.http_post(
      url := 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/sumup-sync',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);


-- ═══ migration 0035_comptabilite.sql ═══
-- Comptabilité — de la banque à un FEC propre.
--
-- Harmonie Yacht est une SAS assujettie à la TVA, sans expert-comptable. Le
-- tableau de bord ne remplace pas un logiciel comptable agréé, mais il doit
-- produire des données qu'un comptable (ou l'administration) peut reprendre :
--   · chaque mouvement bancaire (Qonto) et chaque mouvement de caisse classé
--     sur un compte du plan comptable général (PCG), avec sa TVA ;
--   · un justificatif rattaché à chaque pièce (conservation 10 ans) ;
--   · la TVA à déclarer, au régime réel normal (CA3 mensuelle) OU simplifié
--     (CA12 annuelle + deux acomptes) — les deux sont prévus ;
--   · des mois clôturés, qu'on ne peut plus modifier ;
--   · un export FEC (fichier des écritures comptables).
--
-- Principe : les tables de synchro (bank_transactions, cash_movements) ne
-- sont jamais modifiées par la compta. La classification vit à part, dans
-- accounting_entries, une ligne par mouvement.

-- ── Réglages (une seule ligne) ──────────────────────────────────────────────
create table accounting_settings (
  id boolean primary key default true check (id),
  company_name text not null default 'Harmonie Yacht',
  legal_form text not null default 'SAS',
  -- 9 chiffres : nécessaire au nom du fichier FEC.
  siren text,
  -- 'normal'    : réel normal, CA3 chaque mois
  -- 'simplifie' : réel simplifié, CA12 annuelle + acomptes juillet/décembre
  vat_regime text not null default 'normal' check (vat_regime in ('normal', 'simplifie')),
  -- Jour limite de dépôt de la CA3 (entre le 15 et le 24 selon l'entreprise :
  -- il est indiqué dans l'espace professionnel impots.gouv).
  vat_due_day integer not null default 19 check (vat_due_day between 1 and 31),
  -- Mois de début de l'exercice (1 = janvier → exercice calé sur l'année civile).
  fiscal_year_start_month integer not null default 1 check (fiscal_year_start_month between 1 and 12),
  -- TVA due l'an dernier (régime simplifié) : base des acomptes.
  previous_year_vat numeric,
  updated_at timestamptz not null default now()
);

insert into accounting_settings (id) values (true) on conflict (id) do nothing;

-- ── Plan de comptes (PCG, sous-ensemble utile à l'activité) ─────────────────
create table accounting_accounts (
  code text primary key,
  label text not null,
  -- charge | produit | immobilisation | tva | tiers | tresorerie | capital | attente
  kind text not null check (kind in ('charge', 'produit', 'immobilisation', 'tva', 'tiers', 'tresorerie', 'capital', 'attente')),
  -- Taux de TVA proposé par défaut quand on classe sur ce compte (en %).
  default_vat_rate numeric not null default 0,
  -- Le mouvement exige-t-il un justificatif ? (non pour un virement interne)
  needs_receipt boolean not null default true,
  -- Groupe d'affichage dans le sélecteur.
  grp text not null,
  sort integer not null default 0,
  active boolean not null default true
);

insert into accounting_accounts (code, label, kind, default_vat_rate, needs_receipt, grp, sort) values
  -- Produits
  ('706100', 'Sorties en mer', 'produit', 10, true, 'Ventes', 10),
  ('706200', 'Nuits insolites', 'produit', 10, true, 'Ventes', 11),
  ('706300', 'eFoil', 'produit', 20, true, 'Ventes', 12),
  ('706000', 'Autres prestations', 'produit', 20, true, 'Ventes', 13),
  ('708000', 'Produits annexes', 'produit', 20, true, 'Ventes', 14),
  ('758000', 'Produits divers', 'produit', 0, true, 'Ventes', 15),
  -- Charges
  ('606100', 'Carburant, eau, énergie', 'charge', 20, true, 'Bateau', 20),
  ('615500', 'Entretien et réparations bateau', 'charge', 20, true, 'Bateau', 21),
  ('613200', 'Place de port', 'charge', 20, true, 'Bateau', 22),
  ('616000', 'Assurances', 'charge', 0, true, 'Bateau', 23),
  ('606300', 'Petit équipement (< 500 € HT)', 'charge', 20, true, 'Bateau', 24),
  ('604000', 'Sous-traitance (skippers, prestataires)', 'charge', 20, true, 'Activité', 30),
  ('613500', 'Locations de matériel', 'charge', 20, true, 'Activité', 31),
  ('625700', 'Réceptions, accueil clients', 'charge', 20, true, 'Activité', 32),
  ('606400', 'Fournitures administratives', 'charge', 20, true, 'Fonctionnement', 40),
  ('651100', 'Logiciels et abonnements', 'charge', 20, true, 'Fonctionnement', 41),
  ('623000', 'Publicité et marketing', 'charge', 20, true, 'Fonctionnement', 42),
  ('622600', 'Honoraires', 'charge', 20, true, 'Fonctionnement', 43),
  ('626000', 'Téléphone, internet, poste', 'charge', 20, true, 'Fonctionnement', 44),
  ('625100', 'Déplacements', 'charge', 20, true, 'Fonctionnement', 45),
  ('627000', 'Frais bancaires et commissions', 'charge', 0, true, 'Fonctionnement', 46),
  ('641000', 'Salaires', 'charge', 0, true, 'Personnel et État', 50),
  ('645000', 'Charges sociales (URSSAF…)', 'charge', 0, true, 'Personnel et État', 51),
  ('635000', 'Impôts et taxes (CFE…)', 'charge', 0, true, 'Personnel et État', 52),
  ('695000', 'Impôt sur les sociétés', 'charge', 0, true, 'Personnel et État', 53),
  ('661000', 'Intérêts d''emprunt', 'charge', 0, true, 'Personnel et État', 54),
  ('671000', 'Charges exceptionnelles (amendes…)', 'charge', 0, true, 'Personnel et État', 55),
  -- Immobilisations
  ('218200', 'Bateau, matériel de transport', 'immobilisation', 20, true, 'Investissements', 60),
  ('215400', 'Matériel nautique (> 500 € HT)', 'immobilisation', 20, true, 'Investissements', 61),
  ('218300', 'Matériel informatique (> 500 € HT)', 'immobilisation', 20, true, 'Investissements', 62),
  -- TVA, tiers, capital, trésorerie
  ('445510', 'Paiement de TVA aux impôts', 'tva', 0, false, 'État, associés, banque', 70),
  ('445670', 'Remboursement de crédit de TVA', 'tva', 0, false, 'État, associés, banque', 71),
  ('455000', 'Compte courant d''associé', 'tiers', 0, false, 'État, associés, banque', 72),
  ('101300', 'Apport en capital', 'capital', 0, false, 'État, associés, banque', 73),
  ('164000', 'Emprunt (capital remboursé ou reçu)', 'capital', 0, true, 'État, associés, banque', 74),
  ('580000', 'Virement interne (dépôt d''espèces…)', 'tresorerie', 0, false, 'État, associés, banque', 75),
  ('471000', 'À classer (compte d''attente)', 'attente', 0, false, 'État, associés, banque', 99);

-- ── Classification d'un mouvement ───────────────────────────────────────────
create table accounting_entries (
  id uuid primary key default gen_random_uuid(),
  -- 'bank' → bank_transactions.id ; 'cash' → cash_movements.id
  source text not null check (source in ('bank', 'cash')),
  source_id uuid not null,
  -- Date de l'opération, recopiée : sert au verrouillage des mois clôturés.
  entry_date date not null,
  account_code text not null references accounting_accounts (code),
  -- Taux de TVA en % (0, 2.1, 5.5, 10, 20).
  vat_rate numeric not null default 0,
  -- Autoliquidation : achat de service à un fournisseur étranger (Google,
  -- Meta, Anthropic…). La facture est HT ; la TVA est à la fois collectée et
  -- déductible par nous, pour le même montant. Elle doit figurer sur la CA3.
  reverse_charge boolean not null default false,
  -- Montant de TVA saisi à la main (facture à plusieurs taux) — sinon calculé.
  vat_amount_override numeric,
  -- Chemin dans le bucket « justificatifs ».
  receipt_path text,
  receipt_name text,
  -- Raison quand il n'y a volontairement pas de justificatif.
  no_receipt_reason text,
  label text,
  note text,
  -- 'regle' (règle automatique) | 'lea' | 'robin'
  classified_by text not null default 'robin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index accounting_entries_date_idx on accounting_entries (entry_date desc);

-- ── Règles de classement automatique ────────────────────────────────────────
create table accounting_rules (
  id uuid primary key default gen_random_uuid(),
  -- Texte cherché (insensible à la casse) dans « contrepartie + libellé ».
  pattern text not null,
  -- 'debit' | 'credit' | null (les deux)
  side text check (side in ('debit', 'credit')),
  -- Filtre optionnel sur le type d'opération Qonto (ex. 'qonto_fee').
  operation_type text,
  account_code text not null references accounting_accounts (code),
  vat_rate numeric not null default 0,
  reverse_charge boolean not null default false,
  -- Aucun justificatif attendu (ex. frais Qonto : le relevé suffit).
  no_receipt_reason text,
  priority integer not null default 100,
  created_at timestamptz not null default now()
);

insert into accounting_rules (pattern, side, operation_type, account_code, vat_rate, reverse_charge, no_receipt_reason, priority) values
  ('', 'debit', 'qonto_fee', '627000', 0, false, 'Frais bancaires : figurent sur le relevé Qonto', 10),
  ('sumup', 'credit', null, '706100', 10, false, 'Ventes détaillées dans SumUp', 20),
  ('stripe', 'credit', null, '706100', 10, false, 'Acomptes en ligne : détail dans Stripe', 20),
  ('urssaf', 'debit', null, '645000', 0, false, null, 30),
  ('total', 'debit', null, '606100', 20, false, null, 50),
  ('esso', 'debit', null, '606100', 20, false, null, 50),
  ('shell', 'debit', null, '606100', 20, false, null, 50),
  ('google', 'debit', null, '623000', 20, true, null, 60),
  ('facebk', 'debit', null, '623000', 20, true, null, 60),
  ('meta platforms', 'debit', null, '623000', 20, true, null, 60),
  ('anthropic', 'debit', null, '651100', 20, true, null, 60),
  ('openai', 'debit', null, '651100', 20, true, null, 60),
  ('vercel', 'debit', null, '651100', 20, true, null, 60),
  ('supabase', 'debit', null, '651100', 20, true, null, 60),
  ('notion', 'debit', null, '651100', 20, true, null, 60);

-- ── Mois (clôture + TVA) ────────────────────────────────────────────────────
create table accounting_periods (
  -- Premier jour du mois.
  month date primary key check (extract(day from month) = 1),
  closed_at timestamptz,
  -- Déclaration de TVA faite pour ce mois (régime normal) — montant déclaré.
  vat_declared_at timestamptz,
  vat_declared_amount numeric,
  note text,
  updated_at timestamptz not null default now()
);

-- Déclarations annuelles (régime simplifié : CA12 + acomptes).
create table accounting_vat_filings (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  -- 'acompte_juillet' | 'acompte_decembre' | 'ca12' | 'ca3'
  kind text not null check (kind in ('acompte_juillet', 'acompte_decembre', 'ca12', 'ca3')),
  amount numeric,
  filed_at timestamptz not null default now(),
  unique (year, kind)
);

-- ── Verrou : un mois clôturé ne se modifie plus ─────────────────────────────
create or replace function accounting_guard_closed_period() returns trigger
language plpgsql as $$
declare
  d date;
begin
  d := coalesce(case when tg_op = 'DELETE' then old.entry_date else new.entry_date end, current_date);
  if exists (
    select 1 from accounting_periods
    where month = date_trunc('month', d)::date and closed_at is not null
  ) then
    raise exception 'Le mois de % est clôturé : rouvre-le avant de modifier une écriture.', to_char(d, 'MM/YYYY');
  end if;
  if tg_op = 'UPDATE' and old.entry_date <> new.entry_date and exists (
    select 1 from accounting_periods
    where month = date_trunc('month', old.entry_date)::date and closed_at is not null
  ) then
    raise exception 'Le mois d''origine est clôturé.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $$;

create trigger accounting_entries_guard
  before insert or update or delete on accounting_entries
  for each row execute function accounting_guard_closed_period();

-- ── Classement automatique des nouveaux mouvements Qonto ────────────────────
create or replace function accounting_apply_rules(tx bank_transactions) returns void
language plpgsql security definer set search_path = public as $$
declare
  r accounting_rules;
  haystack text;
begin
  if tx.status not in ('completed', 'pending') then return; end if;
  haystack := lower(coalesce(tx.counterparty_name, '') || ' ' || coalesce(tx.label, ''));
  select * into r from accounting_rules
  where (side is null or side = tx.side)
    and (operation_type is null or operation_type = tx.operation_type)
    and (pattern = '' or haystack like '%' || lower(pattern) || '%')
  order by priority, length(pattern) desc
  limit 1;
  if not found then return; end if;

  insert into accounting_entries (source, source_id, entry_date, account_code, vat_rate, reverse_charge, no_receipt_reason, classified_by)
  values ('bank', tx.id, coalesce(tx.settled_at, tx.emitted_at, now())::date, r.account_code, r.vat_rate, r.reverse_charge, r.no_receipt_reason, 'regle')
  on conflict (source, source_id) do nothing;
exception when others then
  -- Un mois clôturé ou une règle cassée ne doit jamais bloquer la synchro
  -- bancaire : le mouvement restera simplement « à classer ».
  null;
end $$;

create or replace function accounting_bank_tx_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform accounting_apply_rules(new);
  return new;
end $$;

create trigger bank_transactions_auto_classify
  after insert on bank_transactions
  for each row execute function accounting_bank_tx_inserted();

-- Rattrapage : on classe l'historique déjà importé.
do $$
declare
  tx bank_transactions;
begin
  for tx in select * from bank_transactions loop
    perform accounting_apply_rules(tx);
  end loop;
end $$;

-- ── Sécurité ────────────────────────────────────────────────────────────────
alter table accounting_settings enable row level security;
alter table accounting_accounts enable row level security;
alter table accounting_entries enable row level security;
alter table accounting_rules enable row level security;
alter table accounting_periods enable row level security;
alter table accounting_vat_filings enable row level security;

-- Le tableau de bord est mono-entreprise : tout utilisateur connecté gère la
-- compta, comme pour les dépenses et les réservations.
create policy "compta settings" on accounting_settings for all to authenticated using (true) with check (true);
create policy "compta accounts read" on accounting_accounts for select to authenticated using (true);
create policy "compta entries" on accounting_entries for all to authenticated using (true) with check (true);
create policy "compta rules" on accounting_rules for all to authenticated using (true) with check (true);
create policy "compta periods" on accounting_periods for all to authenticated using (true) with check (true);
create policy "compta vat filings" on accounting_vat_filings for all to authenticated using (true) with check (true);

-- ── Justificatifs (stockage privé) ──────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('justificatifs', 'justificatifs', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "justificatifs lecture" on storage.objects for select to authenticated
  using (bucket_id = 'justificatifs');
create policy "justificatifs ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'justificatifs');
-- Pas de suppression ni de remplacement depuis le tableau de bord : une pièce
-- comptable se conserve (10 ans). On peut en rattacher une autre, l'ancienne
-- reste dans le bucket.


-- ═══════════════════════════════════════════════════════════════════════
-- Après les migrations 0001–0035.
-- ═══════════════════════════════════════════════════════════════════════

-- Un instantané par jour pour la page Audience du site (vue dérivée de site_pageviews).
create or replace view public.site_daily_snapshots as
select
  d.day as snapshot_date,
  d.visitors::integer as visitors,
  d.pageviews::integer as pageviews,
  coalesce((
    select jsonb_agg(jsonb_build_object('hostname', r.host, 'visitors', r.visitors, 'pageviews', r.pageviews) order by r.visitors desc, r.pageviews desc)
    from (
      select coalesce(referrer_host, 'Direct') as host, count(distinct visitor_hash) as visitors, count(*) as pageviews
      from public.site_pageviews p where p.day = d.day
      group by 1 order by 2 desc, 3 desc limit 10
    ) r
  ), '[]'::jsonb) as top_referrers,
  coalesce((
    select jsonb_agg(jsonb_build_object('path', g.path, 'visitors', g.visitors, 'pageviews', g.pageviews) order by g.visitors desc, g.pageviews desc)
    from (
      select path, count(distinct visitor_hash) as visitors, count(*) as pageviews
      from public.site_pageviews p where p.day = d.day
      group by 1 order by 2 desc, 3 desc limit 10
    ) g
  ), '[]'::jsonb) as top_pages
from public.site_traffic_daily d;

-- Les vues n'héritent pas de la sécurité des tables : on les ouvre aux seuls utilisateurs connectés.
revoke all on public.site_daily_snapshots, public.site_traffic_daily, public.site_traffic_by_source,
  public.site_traffic_by_page, public.lead_last_message, public.cash_balance, public.sumup_daily_settlements from anon;
grant select on public.site_daily_snapshots, public.site_traffic_daily, public.site_traffic_by_source,
  public.site_traffic_by_page, public.lead_last_message, public.cash_balance, public.sumup_daily_settlements
  to authenticated, service_role;

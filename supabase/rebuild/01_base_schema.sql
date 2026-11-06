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

